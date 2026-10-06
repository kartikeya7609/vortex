import express from 'express';
import { getAllTeams, findTeamById, logAdminAudit, getAuditLogs, findUserById, leaveTeam, toggleUserAccessBlock, toggleTeamDisqualification } from '../services/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'super_admin'));

/**
 * @route   GET /api/v1/admin/teams-mgmt/teams
 * @desc    Get list of all teams with member details
 * @access  Admin Only
 */
router.get('/teams', async (req, res) => {
  try {
    const teams = await getAllTeams();
    return res.status(200).json({
      success: true,
      count: teams.length,
      teams,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch teams: ' + error.message });
  }
});

/**
 * @route   PUT /api/v1/admin/teams-mgmt/teams/:teamId
 * @desc    Edit team details
 * @access  Admin Only
 */
router.put('/teams/:teamId', async (req, res) => {
  try {
    const { name, maxSize, minSizeRequired, allowAdminBypass, isDisqualified, disqualificationReason } = req.body;
    const team = await findTeamById(req.params.teamId);

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const previousState = {
      name: team.name,
      maxSize: team.maxSize,
      minSizeRequired: team.minSizeRequired,
      allowAdminBypass: team.allowAdminBypass,
    };

    if (name && name.trim()) team.name = name.trim();
    if (maxSize !== undefined) team.maxSize = Math.min(Math.max(parseInt(maxSize) || 1, 1), 3);
    if (minSizeRequired !== undefined) team.minSizeRequired = Math.min(Math.max(parseInt(minSizeRequired) || 1, 1), team.maxSize || 3);
    if (allowAdminBypass !== undefined) team.allowAdminBypass = Boolean(allowAdminBypass);
    if (isDisqualified !== undefined) team.isDisqualified = Boolean(isDisqualified);
    if (disqualificationReason !== undefined) team.disqualificationReason = disqualificationReason.trim();

    if (typeof team.save === 'function') {
      await team.save();
    }

    await logAdminAudit(req.user, 'EDIT_TEAM', 'Team', team._id, team.name, { before: previousState, after: team }, req);

    return res.status(200).json({
      success: true,
      message: `Updated team '${team.name}'.`,
      team,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update team: ' + error.message });
  }
});

/**
 * @route   DELETE /api/v1/admin/teams-mgmt/teams/:teamId/members/:userId
 * @desc    Admin manually removes a member from team
 * @access  Admin Only
 */
router.delete('/teams/:teamId/members/:userId', async (req, res) => {
  try {
    const userToRemove = await findUserById(req.params.userId);
    if (!userToRemove) return res.status(404).json({ success: false, message: 'User not found.' });
    const targetTeam = await findTeamById(req.params.teamId);
    if (!targetTeam || String(userToRemove.teamId) !== String(targetTeam._id) ||
        !(targetTeam.memberIds || []).some((member) => String(member?._id || member) === String(userToRemove._id))) {
      return res.status(404).json({ success: false, message: 'User is not a member of this team.' });
    }

    const teamName = userToRemove.teamName || 'Team';
    await leaveTeam(userToRemove);

    await logAdminAudit(req.user, 'REMOVE_TEAM_MEMBER', 'Team', req.params.teamId, teamName, { removedUser: userToRemove.email }, req);

    return res.status(200).json({
      success: true,
      message: `Removed ${userToRemove.name} from team.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to remove team member: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/teams-mgmt/teams/:teamId/qualify
 * @desc    Qualify or Eliminate team for a specific round
 * @access  Admin Only
 */
router.post('/teams/:teamId/qualify', async (req, res) => {
  try {
    const { roundNumber, status, score } = req.body;
    const team = await findTeamById(req.params.teamId);

    if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

    if (!team.qualifications) team.qualifications = [];

    let qual = team.qualifications.find((q) => q.roundNumber === parseInt(roundNumber));
    if (!qual) {
      qual = { roundNumber: parseInt(roundNumber), status: 'PENDING', score: 0 };
      team.qualifications.push(qual);
    }

    qual.status = status;
    if (score !== undefined) qual.score = parseInt(score);
    if (status === 'QUALIFIED') qual.qualifiedAt = new Date();

    if (typeof team.save === 'function') {
      await team.save();
    }

    await logAdminAudit(req.user, 'QUALIFY_TEAM', 'Team', team._id, team.name, { roundNumber, status, score }, req);

    return res.status(200).json({
      success: true,
      message: `Set Team '${team.name}' Round ${roundNumber} status to ${status}.`,
      team,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update qualification: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/teams-mgmt/users/:userId/toggle-access
 * @desc    Toggle individual team member access (Grant or Revoke)
 * @access  Admin Only
 */
router.post('/users/:userId/toggle-access', async (req, res) => {
  try {
    const { isBlocked, reason } = req.body;
    const targetUser = await findUserById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updatedUser = await toggleUserAccessBlock(req.params.userId, isBlocked, reason);
    await logAdminAudit(
      req.user,
      isBlocked ? 'BLOCK_USER_ACCESS' : 'RESTORE_USER_ACCESS',
      'User',
      targetUser._id,
      targetUser.name,
      { isAccessBlocked: targetUser.isAccessBlocked },
      { isAccessBlocked: Boolean(isBlocked), reason },
      req
    );

    return res.status(200).json({
      success: true,
      message: `${isBlocked ? 'Blocked' : 'Restored'} access for user ${targetUser.name}.`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle user access: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/teams-mgmt/teams/:teamId/disqualify
 * @desc    Disqualify or Restore Team Access
 * @access  Admin Only
 */
router.post('/teams/:teamId/disqualify', async (req, res) => {
  try {
    const { isDisqualified, reason } = req.body;
    const team = await findTeamById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const updatedTeam = await toggleTeamDisqualification(req.params.teamId, isDisqualified, reason);
    await logAdminAudit(
      req.user,
      isDisqualified ? 'DISQUALIFY_TEAM' : 'RESTORE_TEAM',
      'Team',
      team._id,
      team.name,
      { isDisqualified: team.isDisqualified },
      { isDisqualified: Boolean(isDisqualified), reason },
      req
    );

    return res.status(200).json({
      success: true,
      message: `Team '${team.name}' has been ${isDisqualified ? 'disqualified' : 'restored'}.`,
      team: updatedTeam,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle team disqualification: ' + error.message });
  }
});

/**
 * @route   GET /api/v1/admin/teams-mgmt/audit-logs
 * @desc    Fetch administrator audit trail
 * @access  Admin Only
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await getAuditLogs();
    return res.status(200).json({ success: true, count: logs.length, logs });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs: ' + error.message });
  }
});

export default router;
