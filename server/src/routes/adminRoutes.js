import express from 'express';
import { getAllUsers, updateUserRole } from '../services/store.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireRole('admin', 'super_admin'));

/**
 * @route   GET /api/v1/admin/users
 * @desc    Fetch list of all registered users
 * @access  Admin Only
 */
router.get('/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users: ' + error.message });
  }
});

/**
 * @route   PATCH /api/v1/admin/users/:userId/role
 * @desc    Change user role
 * @access  Admin Only
 */
router.patch('/users/:userId/role', requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['participant', 'team_leader', 'admin', 'super_admin'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: [${allowedRoles.join(', ')}]`,
      });
    }

    const updatedUser = await updateUserRole(req.params.userId, role);
    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    console.log(`[Admin] Changed role of ${updatedUser.email} to ${role} by ${req.user.email}`);

    return res.status(200).json({
      success: true,
      message: `Updated ${updatedUser.name}'s role to ${role}.`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update role: ' + error.message });
  }
});

/**
 * @route   GET /api/v1/admin/dashboard-stats
 * @desc    Fetch high-level administrative platform metrics
 * @access  Admin Only
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    const users = await getAllUsers();
    const totalUsers = users.length;
    const completedProfiles = users.filter((u) => u.isProfileComplete).length;
    const participants = users.filter((u) => u.role === 'participant' || u.role === 'team_leader').length;
    const admins = users.filter((u) => u.role === 'admin' || u.role === 'super_admin').length;

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        completedProfiles,
        pendingProfiles: totalUsers - completedProfiles,
        participants,
        admins,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin stats: ' + error.message });
  }
});

export default router;
