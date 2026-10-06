import express from 'express';
import { getAllRounds, getRoundByNumber, findTeamById } from '../services/store.js';
import { requireAuth, requireProfileComplete } from '../middleware/auth.js';
import {
  verifyRoundEligibility,
  getOrCreateRoundSession,
  submitGenericRoundAttempt,
  ROUND_CHALLENGES,
} from '../services/roundSessionService.js';
import { GameSession } from '../models/GameSession.js';

const router = express.Router();

/**
 * @route   GET /api/v1/rounds/dashboard
 * @desc    Fetch status, qualification, and readiness for all 4 rounds for participant caller
 * @access  Private
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const rounds = await getAllRounds();
    let team = null;

    if (req.user.teamId) {
      team = await findTeamById(req.user.teamId);
    }

    const teamSize = team ? (team.memberIds || []).length : 0;
    const isTeamReady = team ? teamSize >= (team.minSizeRequired || 2) || team.allowAdminBypass : false;

    // Build per-round participant response
    const roundStatuses = rounds.map((r) => {
      let teamQualificationStatus = 'PENDING';
      let isManualUnlocked = false;

      if (team) {
        // Check manual unlocks exception list
        if (team.manualRoundUnlocks?.some((u) => u.roundNumber === r.roundNumber)) {
          teamQualificationStatus = 'QUALIFIED';
          isManualUnlocked = true;
        } else if (r.roundNumber === 1) {
          // Round 1 default qualification rule for registered teams
          teamQualificationStatus = 'QUALIFIED';
        } else {
          // For Rounds 2, 3, 4: check if team qualified in the PREVIOUS round (r.roundNumber - 1)
          const prevQual = team.qualifications?.find((q) => q.roundNumber === r.roundNumber - 1);
          if (prevQual && prevQual.status === 'QUALIFIED') {
            teamQualificationStatus = 'QUALIFIED';
          } else if (prevQual && prevQual.status === 'ELIMINATED') {
            teamQualificationStatus = 'ELIMINATED';
          } else {
            teamQualificationStatus = 'NOT_QUALIFIED';
          }
        }
      }

      let computedStatus = r.status;

      if (teamQualificationStatus === 'ELIMINATED') {
        computedStatus = 'Eliminated';
      } else if (r.status === 'LOCKED') {
        computedStatus = 'Locked';
      } else if (teamQualificationStatus === 'NOT_QUALIFIED' && r.roundNumber > 1) {
        computedStatus = 'Locked';
      } else if (r.status === 'COMPLETED' || r.status === 'Completed') {
        computedStatus = 'Completed';
      } else if (r.status === 'IN_PROGRESS' || r.status === 'In Progress') {
        computedStatus = 'In Progress';
      } else if (r.status === 'ACTIVE' || r.status === 'AVAILABLE' || r.status === 'Available') {
        computedStatus = 'Available';
      } else {
        computedStatus = 'Locked';
      }

      // Check current team score for this round if any
      const qualRecord = team?.qualifications?.find((q) => q.roundNumber === r.roundNumber);

      return {
        id: r._id,
        roundNumber: r.roundNumber,
        title: r.title,
        description: r.description,
        mechanicType: r.mechanicType,
        status: computedStatus,
        durationSeconds: r.durationSeconds,
        teamQualificationStatus,
        isManualUnlocked,
        isAccessible: computedStatus === 'Available' || computedStatus === 'In Progress',
        teamScore: qualRecord ? qualRecord.score : undefined,
      };
    });

    return res.status(200).json({
      success: true,
      hasTeam: !!team,
      teamName: team ? team.name : null,
      teamCode: team ? team.code : null,
      teamSize,
      minTeamSizeRequired: team ? team.minSizeRequired || 2 : 2,
      isTeamReady,
      allowAdminBypass: team ? team.allowAdminBypass : false,
      rounds: roundStatuses,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch round dashboard: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/rounds/:roundNumber/enter
 * @desc    STRICT BACKEND ROUTE GUARD for entering a round (gated on previous round qualification / manual override)
 * @access  Private (Profile Complete)
 */
router.post('/:roundNumber/enter', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    const roundNumber = parseInt(req.params.roundNumber);

    if (isNaN(roundNumber) || roundNumber < 1 || roundNumber > 4) {
      return res.status(400).json({ success: false, message: 'Invalid round number.' });
    }

    // 1. Team Requirement Check
    if (!req.user.teamId) {
      return res.status(403).json({
        success: false,
        code: 'NO_TEAM',
        message: 'Round access denied: You must create or join a team before entering competition rounds.',
      });
    }

    const team = await findTeamById(req.user.teamId);
    if (!team) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_NOT_FOUND',
        message: 'Round access denied: Associated team record not found.',
      });
    }

    if (!(team.memberIds || []).some((member) => String(member?._id || member) === String(req.user._id))) {
      return res.status(403).json({ success: false, code: 'NOT_TEAM_MEMBER', message: 'You are not a member of this team.' });
    }

    if (team.isDisqualified) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_DISQUALIFIED',
        message: `Round access denied: Your team '${team.name}' has been disqualified by an administrator. Reason: ${team.disqualificationReason || 'Policy violation'}`,
      });
    }

    // 2. Team Capacity / Readiness Check
    const currentMemberCount = (team.memberIds || []).length;
    const requiredMinSize = team.minSizeRequired || 2;
    const hasAdminBypass = team.allowAdminBypass === true;

    if (currentMemberCount < requiredMinSize && !hasAdminBypass) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_NOT_READY',
        message: `Round access denied: Team '${team.name}' requires at least ${requiredMinSize} members to start (Current: ${currentMemberCount}/${team.maxSize}). Invite more members or ask an admin for a bypass exception.`,
        currentMemberCount,
        requiredMinSize,
      });
    }

    // 3. Round Availability Check
    const round = await getRoundByNumber(roundNumber);
    if (!round) {
      return res.status(404).json({ success: false, message: `Round ${roundNumber} configuration not found.` });
    }

    if (!['AVAILABLE', 'IN_PROGRESS'].includes(round.status)) {
      return res.status(403).json({
        success: false,
        code: 'ROUND_LOCKED',
        message: `Round ${roundNumber} is currently LOCKED by event administrators.`,
      });
    }

    // 4. Multi-Round Gating: Check previous round qualification or manual override
    const eligibility = await verifyRoundEligibility(team._id, roundNumber);
    if (!eligibility.isEligible) {
      return res.status(403).json({
        success: false,
        code: eligibility.code || 'UNQUALIFIED',
        message: eligibility.reason || `Round access denied: Your team '${team.name}' has not qualified for Round ${roundNumber}.`,
      });
    }

    // Access Granted
    console.log(`[Round Guard] Granted entrance to Round ${roundNumber} for User ${req.user.email} (Team: ${team.name})`);

    return res.status(200).json({
      success: true,
      message: `Access granted to Round ${roundNumber}: ${round.title}`,
      round: {
        roundNumber: round.roundNumber,
        title: round.title,
        mechanicType: round.mechanicType,
        durationSeconds: round.durationSeconds,
      },
      team: {
        id: team._id,
        name: team.name,
        code: team.code,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Round entrance authorization error: ' + error.message });
  }
});

/**
 * @route   GET /api/v1/rounds/:roundNumber/game-state
 * @desc    Fetch isolated game state, session, and challenge data for Rounds 2, 3, 4
 * @access  Private (Leader & Members)
 */
router.get('/:roundNumber/game-state', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    const roundNumber = parseInt(req.params.roundNumber);
    if (isNaN(roundNumber) || roundNumber < 2 || roundNumber > 4) {
      return res.status(400).json({ success: false, message: 'Invalid round number for this endpoint.' });
    }

    if (!req.user.teamId) {
      return res.status(403).json({ success: false, message: 'No team associated.' });
    }

    const eligibility = await verifyRoundEligibility(req.user.teamId, roundNumber);
    if (!eligibility.isEligible) {
      return res.status(403).json({ success: false, message: eligibility.reason });
    }

    const team = await findTeamById(req.user.teamId);
    if (!team || !(team.memberIds || []).some((member) => String(member?._id || member) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'You are not a member of this team.' });
    }
    const round = await getRoundByNumber(roundNumber);
    if (!round || !['AVAILABLE', 'IN_PROGRESS'].includes(round.status)) return res.status(403).json({ success: false, message: 'This round is not currently active.' });

    const session = await getOrCreateRoundSession(req.user.teamId, roundNumber, req.user);
    const rawChallenges = ROUND_CHALLENGES[roundNumber] || {};
    const challenges = roundNumber === 2
      ? { ...rawChallenges, questions: rawChallenges.questions.map(({ correctOptionIndex, ...question }) => question) }
      : roundNumber === 4
        ? { ...rawChallenges, challenges: rawChallenges.challenges.map(({ testCases, ...challenge }) => challenge) }
        : rawChallenges;

    return res.status(200).json({
      success: true,
      roundNumber,
      session,
      challenges,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch round game state: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/rounds/:roundNumber/submit
 * @desc    Submit attempt/solution for generic round mechanics (Round 2 MCQ, Round 3 Media, Round 4 Code)
 * @access  Private (Leader Only)
 */
router.post('/:roundNumber/submit', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    const roundNumber = parseInt(req.params.roundNumber);
    if (isNaN(roundNumber) || roundNumber < 2 || roundNumber > 4) {
      return res.status(400).json({ success: false, message: 'Invalid round number for this endpoint.' });
    }

    if (!req.user.teamId) {
      return res.status(403).json({ success: false, message: 'No team associated.' });
    }

    const team = await findTeamById(req.user.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    if (!(team.memberIds || []).some((member) => String(member?._id || member) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'You are not a member of this team.' });
    }

    // Enforce leader only submission rule
    const isLeader = String(team.leaderId?._id || team.leaderId) === String(req.user._id || req.user.id);
    if (!isLeader) {
      return res.status(403).json({
        success: false,
        message: 'Only the designated Team Leader can submit answers for this round.',
      });
    }

    const eligibility = await verifyRoundEligibility(req.user.teamId, roundNumber);
    if (!eligibility.isEligible) {
      return res.status(403).json({ success: false, message: eligibility.reason });
    }

    const result = await submitGenericRoundAttempt(req.user.teamId, roundNumber, req.body, req.user);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Round submission error: ' + error.message });
  }
});

export default router;
