import express from 'express';
import {
  findTeamById,
  findTeamByCode,
  findTeamByName,
  createTeam,
  joinTeam,
  leaveTeam
} from '../services/store.js';
import { requireAuth, requireProfileComplete } from '../middleware/auth.js';

const router = express.Router();

/**
 * Helper to generate unique 6-character team code (e.g., ARH-9042)
 */
const generateTeamCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ARH-${rand}`;
};

/**
 * @route   POST /api/v1/teams/create
 * @desc    Create a new team (Caller becomes Team Leader)
 * @access  Private (Profile Complete)
 */
router.post('/create', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    const { name, maxSize } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Team Name is required.' });
    }

    if (req.user.teamId) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of a team. Please leave your current team before creating a new one.',
      });
    }

    const existingTeam = await findTeamByName(name.trim());
    if (existingTeam) {
      return res.status(400).json({ success: false, message: 'Team Name is already taken. Please choose another name.' });
    }

    let code = generateTeamCode();
    let codeExists = await findTeamByCode(code);
    while (codeExists) {
      code = generateTeamCode();
      codeExists = await findTeamByCode(code);
    }

    const teamData = {
      name: name.trim(),
      code,
      maxSize: maxSize ? Math.min(Math.max(parseInt(maxSize), 1), 3) : 3,
    };

    const team = await createTeam(teamData, req.user);
    console.log(`[Team] Created team ${team.name} (${team.code}) by leader ${req.user.email}`);

    const populatedTeam = await findTeamById(team._id);

    return res.status(201).json({
      success: true,
      message: `Team '${team.name}' created successfully with code ${team.code}.`,
      team: populatedTeam,
    });
  } catch (error) {
    console.error('[Create Team Error]:', error);
    return res.status(500).json({ success: false, message: 'Failed to create team: ' + error.message });
  }
});

/**
 * @route   GET /api/v1/teams/lookup/:code
 * @desc    Find team details & show capacity before joining
 * @access  Private
 */
router.get('/lookup/:code', requireAuth, async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const team = await findTeamByCode(code);

    if (!team) {
      return res.status(404).json({ success: false, message: `No team found with Team Code '${code}'.` });
    }

    const memberCount = team.memberIds.length;
    const effectiveMaxSize = Math.min(team.maxSize || 3, 3);
    const isFull = memberCount >= effectiveMaxSize;
    const leaderName = team.leaderId?.name || 'Unknown';

    return res.status(200).json({
      success: true,
      team: {
        id: team._id,
        name: team.name,
        code: team.code,
        leaderName,
        memberCount,
        maxSize: effectiveMaxSize,
        minSizeRequired: team.minSizeRequired,
        isFull,
        allowAdminBypass: team.allowAdminBypass,
        members: team.memberIds.map((m) => ({
          id: m._id,
          name: m.name,
          avatar: m.avatar,
          isLeader: String(m._id) === String(team.leaderId?._id || team.leaderId),
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to lookup team: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/teams/join
 * @desc    Join an existing team using Team Code
 * @access  Private (Profile Complete)
 */
router.post('/join', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Team Code is required.' });
    }

    if (req.user.teamId) {
      return res.status(400).json({
        success: false,
        message: 'You are already in a team. You must leave your current team before joining another.',
      });
    }

    const team = await findTeamByCode(code.trim().toUpperCase());
    if (!team) {
      return res.status(404).json({ success: false, message: `Invalid Team Code '${code}'. No team found.` });
    }

    if (team.memberIds.length >= team.maxSize) {
      return res.status(400).json({
        success: false,
        message: `Team '${team.name}' is full (${team.memberIds.length}/${team.maxSize} members). Maximum capacity reached.`,
      });
    }

    await joinTeam(team._id, req.user);
    console.log(`[Team] User ${req.user.email} joined team ${team.name} (${team.code})`);

    const updatedTeam = await findTeamById(team._id);

    return res.status(200).json({
      success: true,
      message: `Successfully joined team '${team.name}'!`,
      team: updatedTeam,
    });
  } catch (error) {
    const conflict = /already a member|full|unavailable/.test(error.message);
    return res.status(conflict ? 409 : 500).json({ success: false, message: conflict ? error.message : 'Failed to join team.' });
  }
});

/**
 * @route   POST /api/v1/teams/leave
 * @desc    Leave current team
 * @access  Private
 */
router.post('/leave', requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.status(400).json({ success: false, message: 'You are not currently in any team.' });
    }

    const teamName = req.user.teamName || 'your team';
    await leaveTeam(req.user);

    return res.status(200).json({
      success: true,
      message: `You have left team '${teamName}'.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to leave team: ' + error.message });
  }
});

/**
 * @route   GET /api/v1/teams/my-team
 * @desc    Get caller's current team details
 * @access  Private
 */
router.get('/my-team', requireAuth, async (req, res) => {
  try {
    if (!req.user.teamId) {
      return res.status(200).json({ success: true, team: null });
    }

    const team = await findTeamById(req.user.teamId);
    if (!team) {
      return res.status(200).json({ success: true, team: null });
    }

    const isReadyToPlay = team.memberIds.length >= team.minSizeRequired || team.allowAdminBypass;
    const leaderIdStr = String(team.leaderId?._id || team.leaderId);

    return res.status(200).json({
      success: true,
      team: {
        id: team._id,
        name: team.name,
        code: team.code,
        leaderId: leaderIdStr,
        leaderName: team.leaderId?.name || 'Leader',
        memberCount: team.memberIds.length,
        maxSize: Math.min(team.maxSize || 3, 3),
        minSizeRequired: team.minSizeRequired,
        isReadyToPlay,
        allowAdminBypass: team.allowAdminBypass,
        qualifications: team.qualifications || [],
        isDisqualified: team.isDisqualified || false,
        disqualificationReason: team.disqualificationReason || '',
        members: team.memberIds.map((m) => ({
          id: m._id,
          name: m.name,
          email: m.email,
          avatar: m.avatar,
          registrationNumber: m.profile?.registrationNumber || 'N/A',
          isLeader: String(m._id) === leaderIdStr,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch team details: ' + error.message });
  }
});

export default router;
