import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getLeaderboardData,
  computeRoundRankings,
  freezeLeaderboard,
  unfreezeLeaderboard,
  setLeaderboardPublishState,
  grantManualRoundUnlock,
  revokeManualRoundUnlock,
} from '../services/rankingService.js';
import { logAdminAudit, findTeamById } from '../services/store.js';
import { emitLeaderboardUpdated, notifyAdminLiveStateUpdate } from '../services/socketService.js';

const router = express.Router();

/**
 * @route   GET /api/v1/leaderboard
 * @desc    Fetch leaderboard rankings for a round (snapshot if frozen, or live; checks publish status)
 * @access  Public / Authenticated
 */
router.get('/', async (req, res) => {
  try {
    const roundNumber = parseInt(req.query.round) || 1;
    const data = await getLeaderboardData(roundNumber);

    // If caller has an active team, flag user's team in the entries
    let userTeamId = null;
    if (req.user && req.user.teamId) {
      userTeamId = String(req.user.teamId);
    }

    const formattedEntries = (data.entries || []).map((entry) => ({
      ...entry,
      isMyTeam: userTeamId ? String(entry.teamId) === userTeamId : false,
    }));

    return res.status(200).json({
      success: true,
      roundNumber: data.roundNumber,
      isFrozen: data.isFrozen,
      isPublished: data.isPublished,
      published: data.isPublished, // for backward compatibility with frontend
      frozenAt: data.frozenAt,
      publishedAt: data.publishedAt,
      qualifyingCount: data.qualifyingCount || 50,
      tieBreakRules: data.tieBreakRules,
      totalTeamsEvaluated: data.totalTeamsEvaluated,
      totalQualifiedTeams: data.totalQualifiedTeams,
      entries: formattedEntries,
      leaderboard: formattedEntries, // for frontend compatibility
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/leaderboard/admin/preview
 * @desc    Compute live leaderboard ranking preview with custom tie-break rules and qualifying count
 * @access  Admin Only
 */
router.post('/admin/preview', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { roundNumber = 1, qualifyingCount = 50, tieBreakRules } = req.body;
    const computed = await computeRoundRankings(parseInt(roundNumber), {
      qualifyingCount: parseInt(qualifyingCount),
      tieBreakRules,
    });

    return res.status(200).json({
      success: true,
      preview: computed,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to preview leaderboard: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/leaderboard/admin/freeze
 * @desc    Freeze leaderboard for a round, save snapshot, and propagate qualification to all team members
 * @access  Admin Only
 */
router.post('/admin/freeze', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { roundNumber = 1, qualifyingCount = 50, tieBreakRules, isPublished = true } = req.body;
    const roundNum = parseInt(roundNumber);

    const snapshot = await freezeLeaderboard(roundNum, req.user, {
      qualifyingCount: parseInt(qualifyingCount),
      tieBreakRules,
      isPublished,
    });

    await logAdminAudit(
      req.user,
      'LEADERBOARD_FREEZE',
      'Leaderboard',
      `round_${roundNum}`,
      `Round ${roundNum} Leaderboard`,
      { status: 'LIVE' },
      {
        status: 'FROZEN',
        roundNumber: roundNum,
        qualifyingCount: snapshot.qualifyingCount,
        totalQualifiedTeams: snapshot.totalQualifiedTeams,
        frozenAt: snapshot.frozenAt,
      },
      req
    );

    emitLeaderboardUpdated(roundNum);

    return res.status(200).json({
      success: true,
      message: `Round ${roundNum} leaderboard frozen successfully. Top ${snapshot.qualifyingCount} teams (and all their members) qualified for Round ${roundNum + 1}.`,
      snapshot,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to freeze leaderboard: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/leaderboard/admin/unfreeze
 * @desc    Unfreeze leaderboard for a round
 * @access  Admin Only
 */
router.post('/admin/unfreeze', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { roundNumber = 1 } = req.body;
    const roundNum = parseInt(roundNumber);

    const result = await unfreezeLeaderboard(roundNum, req.user);

    await logAdminAudit(
      req.user,
      'LEADERBOARD_UNFREEZE',
      'Leaderboard',
      `round_${roundNum}`,
      `Round ${roundNum} Leaderboard`,
      { status: 'FROZEN' },
      { status: 'LIVE_UNFROZEN', roundNumber: roundNum },
      req
    );

    emitLeaderboardUpdated(roundNum);

    return res.status(200).json({
      success: true,
      message: `Round ${roundNum} leaderboard unfrozen. Live calculations resumed.`,
      result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to unfreeze leaderboard: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/leaderboard/admin/publish
 * @desc    Toggle publication status of a round's leaderboard
 * @access  Admin Only
 */
router.post('/admin/publish', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { roundNumber = 1, isPublished = true } = req.body;
    const roundNum = parseInt(roundNumber);

    const snapshot = await setLeaderboardPublishState(roundNum, isPublished, req.user);

    await logAdminAudit(
      req.user,
      isPublished ? 'LEADERBOARD_PUBLISH' : 'LEADERBOARD_UNPUBLISH',
      'Leaderboard',
      `round_${roundNum}`,
      `Round ${roundNum} Leaderboard`,
      { isPublished: !isPublished },
      { isPublished, roundNumber: roundNum },
      req
    );

    emitLeaderboardUpdated(roundNum);

    return res.status(200).json({
      success: true,
      message: `Round ${roundNum} leaderboard is now ${isPublished ? 'PUBLISHED' : 'UNPUBLISHED (Hidden)'}.`,
      snapshot,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle leaderboard publication: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/leaderboard/admin/manual-unlock
 * @desc    Admin exception override to manually unlock a round for a specific team
 * @access  Admin Only
 */
router.post('/admin/manual-unlock', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { teamId, roundNumber, reason } = req.body;
    if (!teamId || !roundNumber) {
      return res.status(400).json({ success: false, message: 'teamId and roundNumber are required.' });
    }

    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const updatedTeam = await grantManualRoundUnlock(teamId, parseInt(roundNumber), reason, req.user);

    await logAdminAudit(
      req.user,
      'MANUAL_ROUND_UNLOCK_OVERRIDE',
      'Team',
      team._id,
      team.name,
      { roundNumber: parseInt(roundNumber), unlocked: false },
      { roundNumber: parseInt(roundNumber), unlocked: true, reason },
      req
    );

    notifyAdminLiveStateUpdate();

    return res.status(200).json({
      success: true,
      message: `Round ${roundNumber} manually unlocked for Team '${team.name}' (Exception Override). All team members inherited access.`,
      team: updatedTeam,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to grant round override: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/leaderboard/admin/manual-revoke
 * @desc    Admin exception override to lock/revoke a round for a specific team
 * @access  Admin Only
 */
router.post('/admin/manual-revoke', requireAuth, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { teamId, roundNumber, reason } = req.body;
    if (!teamId || !roundNumber) {
      return res.status(400).json({ success: false, message: 'teamId and roundNumber are required.' });
    }

    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const updatedTeam = await revokeManualRoundUnlock(teamId, parseInt(roundNumber), reason, req.user);

    await logAdminAudit(
      req.user,
      'MANUAL_ROUND_REVOKE_OVERRIDE',
      'Team',
      team._id,
      team.name,
      { roundNumber: parseInt(roundNumber), unlocked: true },
      { roundNumber: parseInt(roundNumber), unlocked: false, reason },
      req
    );

    notifyAdminLiveStateUpdate();

    return res.status(200).json({
      success: true,
      message: `Round ${roundNumber} access revoked for Team '${team.name}'. Access locked.`,
      team: updatedTeam,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to revoke round override: ' + error.message });
  }
});

export default router;
