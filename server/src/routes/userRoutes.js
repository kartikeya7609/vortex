import express from 'express';
import { updateUserProfile, findUserById } from '../services/store.js';
import { requireAuth, requireProfileComplete } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Complete or update user onboarding profile
 * @access  Private
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { fullName, registrationNumber, rollNumber, phoneNumber, paymentReference } = req.body;

    // Validate required profile fields for onboarding
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }
    if (!registrationNumber || !registrationNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Registration Number is required.' });
    }
    if (!rollNumber || !rollNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Roll Number is required.' });
    }
    if (!phoneNumber || !phoneNumber.trim()) {
      return res.status(400).json({ success: false, message: 'Phone Number is required.' });
    }
    const username = String(req.body.username || req.user.profile?.username || req.user.email.split('@')[0])
      .trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 32);
    if (username.length < 3) return res.status(400).json({ success: false, message: 'Username must contain at least 3 valid characters.' });

    const updatedUser = await updateUserProfile(req.user._id, {
      fullName: fullName.trim(),
      username,
      registrationNumber: registrationNumber.trim(),
      rollNumber: rollNumber.trim(),
      phoneNumber: phoneNumber.trim(),
      paymentStatus: paymentReference ? 'VERIFIED' : req.user.profile?.paymentStatus || 'NOT_REQUIRED',
      paymentReference: paymentReference ? paymentReference.trim() : req.user.profile?.paymentReference || '',
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    console.log(`[User Profile] Profile completed for ${updatedUser.email}`);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: updatedUser._id,
        googleId: updatedUser.googleId,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        role: updatedUser.role,
        isProfileComplete: updatedUser.isProfileComplete,
        profile: updatedUser.profile,
        teamId: updatedUser.teamId,
        teamName: updatedUser.teamName,
        stats: updatedUser.stats,
      },
    });
  } catch (error) {
    console.error('[Profile Update Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile: ' + error.message,
    });
  }
});

/**
 * @route   GET /api/v1/users/stats
 * @desc    Fetch team, role, games attempted/completed, total score, and event status
 * @access  Private (Requires Profile Complete)
 */
router.get('/stats', requireAuth, requireProfileComplete, async (req, res) => {
  try {
    const user = await findUserById(req.user._id);

    return res.status(200).json({
      success: true,
      stats: {
        role: user.role,
        teamId: user.teamId,
        teamName: user.teamName || 'No Team Assigned',
        totalScore: user.stats?.totalScore || 0,
        gamesAttempted: user.stats?.gamesAttempted || 0,
        gamesCompleted: user.stats?.gamesCompleted || 0,
        currentRound: user.stats?.currentRound || 1,
        eventStatus: user.stats?.eventStatus || 'REGISTERED',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats: ' + error.message,
    });
  }
});

export default router;
