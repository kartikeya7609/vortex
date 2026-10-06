import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getAllPuzzles,
  createPuzzle,
  getPuzzleById,
  updatePuzzle,
  deletePuzzle,
  reorderPuzzles,
  togglePuzzlePublish,
  getAllRounds,
  getRoundByNumber,
  updateRoundStatus,
  updateRoundConfig,
  createRound,
  deleteRound,
  resetTeamSession,
  adjustTeamScore,
  getLeaderboardStatus,
  setLeaderboardFreeze,
  setLeaderboardPublish,
  logAdminAudit,
  getAuditLogs,
  findTeamById,
  getAdminWhitelist,
  addAdminWhitelistEmail,
  removeAdminWhitelistEmail,
  getAllFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
} from '../services/store.js';
import { uploadAndProcessPuzzleImage, validateImagePayload, processGridSections } from '../services/imageProcessor.js';
import cloudinary from '../config/cloudinary.js';
import { notifyAdminLiveStateUpdate } from '../services/socketService.js';

const router = express.Router();

// Strict Backend API Protection for All Administrative Endpoints
router.use(requireAuth, requireRole('admin', 'super_admin'));

// ==================== PUZZLE MANAGEMENT & IMAGE PROCESSING ====================

/**
 * @route   POST /api/v1/admin/mgmt/puzzles/upload-and-process
 * @desc    Upload a source image, crop deterministic pieces, persist a draft puzzle and piece IDs
 * @access  Admin Only
 */
router.post('/puzzles/upload-and-process', async (req, res) => {
  let generatedAssets = null;
  try {
    const { image, mimeType, sizeBytes, gridRows = 3, gridCols = 3, title, description = '', roundNumber = 1, points = 100, timeLimitSeconds = 1800, hint = '' } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, message: 'Choose an image file to generate puzzle pieces.' });
    }

    // 1. Payload & File Validation
    if (!String(title || '').trim()) return res.status(400).json({ success: false, message: 'Puzzle name is required.' });
    if (!Number.isInteger(Number(roundNumber)) || Number(roundNumber) < 1 || Number(roundNumber) > 4 || !Number.isFinite(Number(points)) || Number(points) < 0 || !Number.isFinite(Number(timeLimitSeconds)) || Number(timeLimitSeconds) < 60) {
      return res.status(400).json({ success: false, message: 'Round, points, or time limit values are invalid.' });
    }
    const validation = validateImagePayload(mimeType, sizeBytes, gridRows, gridCols);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    // 2. Deterministic Image Processing & Cloudinary Storage
    const result = await uploadAndProcessPuzzleImage(image, gridRows, gridCols);
    generatedAssets = result;
    const duplicate = (await getAllPuzzles(parseInt(roundNumber))).some((p) => p.title?.trim().toLowerCase() === title.trim().toLowerCase());
    if (duplicate) {
      await Promise.allSettled([result.originalPublicId, ...result.pieces.map((piece) => piece.cloudinaryPublicId)]
        .map((publicId) => cloudinary.uploader.destroy(publicId, { resource_type: 'image' })));
      return res.status(409).json({ success: false, message: 'A puzzle with this name already exists in this round.' });
    }
    const puzzle = await createPuzzle({
      roundNumber: Number(roundNumber), title: title.trim(), description, imageUrl: result.originalUrl,
      originalPublicId: result.originalPublicId, puzzleCode: result.puzzleCode,
      gridRows: result.rows, gridCols: result.columns, pieces: result.pieces, correctOrder: result.correctOrder,
      points: Number(points), timeLimitSeconds: Number(timeLimitSeconds), hint, isPublished: false, displayOrder: (await getAllPuzzles(Number(roundNumber))).length + 1,
    });
    await logAdminAudit(req.user, 'PUZZLE_CREATE', 'Puzzle', puzzle._id, puzzle.title, null, puzzle, req);
    generatedAssets = null;

    return res.status(200).json({
      success: true,
      message: 'Original image and deterministic puzzle pieces saved as a draft.',
      puzzle,
    });
  } catch (error) {
    if (generatedAssets) {
      await Promise.allSettled([generatedAssets.originalPublicId, ...generatedAssets.pieces.map((piece) => piece.cloudinaryPublicId)]
        .map((publicId) => cloudinary.uploader.destroy(publicId, { resource_type: 'image' })));
    }
    console.error('[Admin Upload Error]:', error);
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Image upload or processing failed.' });
  }
});

/**
 * @route   GET /api/v1/admin/mgmt/puzzles
 * @desc    Fetch all puzzles (optional filter by roundNumber)
 * @access  Admin Only
 */
router.get('/puzzles', async (req, res) => {
  try {
    const roundNumber = req.query.roundNumber ? parseInt(req.query.roundNumber) : null;
    const puzzles = await getAllPuzzles(roundNumber);
    return res.status(200).json({ success: true, count: puzzles.length, puzzles });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch puzzles: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/mgmt/puzzles
 * @desc    Create a new puzzle and audit log
 * @access  Admin Only
 */
router.post('/puzzles', async (req, res) => {
  try {
    const { roundNumber, title, description, imageUrl, gridRows, gridCols, solution, points, timeLimitSeconds, hint, isPublished, displayOrder } = req.body;

    if (!title || !roundNumber) {
      return res.status(400).json({ success: false, message: 'Title and roundNumber are required.' });
    }

    if (parseInt(roundNumber) === 1) return res.status(400).json({ success: false, message: 'Generate Round 1 pieces from an uploaded image before saving the puzzle.' });

    const rows = parseInt(gridRows) || 3;
    const cols = parseInt(gridCols) || 3;
    const processedSections = processGridSections(imageUrl || 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?w=800', rows, cols);

    const puzzle = await createPuzzle({
      roundNumber: parseInt(roundNumber),
      title,
      description,
      imageUrl,
      gridRows: rows,
      gridCols: cols,
      processedSections,
      solution: solution || '',
      points,
      timeLimitSeconds,
      hint,
      isPublished,
      displayOrder,
    });

    await logAdminAudit(
      req.user,
      'PUZZLE_CREATE',
      'Puzzle',
      puzzle._id,
      puzzle.title,
      null,
      puzzle,
      req
    );

    return res.status(201).json({ success: true, message: 'Puzzle created successfully.', puzzle });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create puzzle: ' + error.message });
  }
});

/**
 * @route   PUT /api/v1/admin/mgmt/puzzles/:id
 * @desc    Edit existing puzzle configuration
 * @access  Admin Only
 */
router.put('/puzzles/:id', async (req, res) => {
  try {
    const existing = await getPuzzleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Puzzle not found.' });
    }

    const previousValue = JSON.parse(JSON.stringify(existing));
    const updated = await updatePuzzle(req.params.id, req.body);

    await logAdminAudit(
      req.user,
      'PUZZLE_EDIT',
      'Puzzle',
      updated._id,
      updated.title,
      previousValue,
      updated,
      req
    );

    return res.status(200).json({ success: true, message: 'Puzzle updated successfully.', puzzle: updated });
  } catch (error) {
    const isConflict = /locked while a team|immutable/.test(error.message);
    return res.status(isConflict ? 409 : 500).json({ success: false, message: isConflict ? error.message : 'Failed to update puzzle.' });
  }
});

/**
 * @route   DELETE /api/v1/admin/mgmt/puzzles/:id
 * @desc    Delete a puzzle
 * @access  Admin Only
 */
router.delete('/puzzles/:id', async (req, res) => {
  try {
    const existing = await getPuzzleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Puzzle not found.' });
    }

    await deletePuzzle(req.params.id);

    const publicIds = [existing.originalPublicId, ...(existing.pieces || []).map((piece) => piece.cloudinaryPublicId)].filter(Boolean);
    const cleanup = await Promise.allSettled(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId, { resource_type: 'image' })));

    await logAdminAudit(
      req.user,
      'PUZZLE_DELETE',
      'Puzzle',
      existing._id,
      existing.title,
      existing,
      null,
      req
    );

    return res.status(200).json({ success: true, message: `Deleted puzzle '${existing.title}'.`, cloudinaryCleanup: cleanup.every((item) => item.status === 'fulfilled') });
  } catch (error) {
    const isConflict = /cannot be deleted while a team is playing/.test(error.message);
    return res.status(isConflict ? 409 : 500).json({ success: false, message: isConflict ? error.message : 'Failed to delete puzzle.' });
  }
});

/**
 * @route   POST /api/v1/admin/mgmt/puzzles/reorder
 * @desc    Batch reorder puzzles via drag and drop
 * @access  Admin Only
 */
router.post('/puzzles/reorder', async (req, res) => {
  try {
    const { orders } = req.body; // Array of { id, displayOrder }
    if (!Array.isArray(orders) || orders.length === 0 || orders.some((order) => !order?.id || !Number.isInteger(Number(order.displayOrder)) || Number(order.displayOrder) < 1) ||
        new Set(orders.map((order) => String(order.id))).size !== orders.length || new Set(orders.map((order) => Number(order.displayOrder))).size !== orders.length) {
      return res.status(400).json({ success: false, message: 'Invalid payload. Array of order specs required.' });
    }

    const puzzles = await Promise.all(orders.map((order) => getPuzzleById(order.id)));
    if (puzzles.some((puzzle) => !puzzle)) return res.status(404).json({ success: false, message: 'One or more puzzles were not found.' });
    const roundNumber = puzzles[0].roundNumber;
    const roundPuzzleIds = (await getAllPuzzles(roundNumber)).map((puzzle) => String(puzzle._id)).sort();
    if (puzzles.some((puzzle) => puzzle.roundNumber !== roundNumber) ||
        roundPuzzleIds.join(',') !== puzzles.map((puzzle) => String(puzzle._id)).sort().join(',')) {
      return res.status(400).json({ success: false, message: 'Reorder all puzzles from one round together.' });
    }

    const reorderedPuzzles = await reorderPuzzles(orders);

    await logAdminAudit(
      req.user,
      'PUZZLE_REORDER',
      'Puzzle',
      'batch',
      'Reordered Puzzle Display Sequence',
      { count: orders.length },
      { orders },
      req
    );

    return res.status(200).json({ success: true, message: 'Puzzles reordered successfully.', puzzles: reorderedPuzzles });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reorder puzzles: ' + error.message });
  }
});

/**
 * @route   PATCH /api/v1/admin/mgmt/puzzles/:id/publish
 * @desc    Toggle puzzle publish or unpublish state
 * @access  Admin Only
 */
router.patch('/puzzles/:id/publish', async (req, res) => {
  try {
    const { isPublished } = req.body;
    if (typeof isPublished !== 'boolean') return res.status(400).json({ success: false, message: 'isPublished must be a boolean.' });
    const existing = await getPuzzleById(req.params.id);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Puzzle not found.' });
    }

    const previousValue = { isPublished: existing.isPublished };
    const updated = await togglePuzzlePublish(req.params.id, isPublished);

    await logAdminAudit(
      req.user,
      isPublished ? 'PUZZLE_PUBLISH' : 'PUZZLE_UNPUBLISH',
      'Puzzle',
      updated._id,
      updated.title,
      previousValue,
      { isPublished: updated.isPublished },
      req
    );

    return res.status(200).json({
      success: true,
      message: `Puzzle '${updated.title}' ${updated.isPublished ? 'published' : 'unpublished'}.`,
      puzzle: updated,
    });
  } catch (error) {
    const invalid = /cannot be published/.test(error.message);
    return res.status(invalid ? 400 : 500).json({ success: false, message: invalid ? error.message : 'Failed to publish or unpublish puzzle.' });
  }
});

// ==================== ROUND CONFIGURATION & AVAILABILITY ====================

/**
 * @route   GET /api/v1/admin/mgmt/rounds
 * @desc    Fetch status and configuration for all rounds
 * @access  Admin Only
 */
router.get('/rounds', async (req, res) => {
  try {
    const rounds = await getAllRounds();
    return res.status(200).json({ success: true, count: rounds.length, rounds });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch round config: ' + error.message });
  }
});

/**
 * @route   PATCH /api/v1/admin/mgmt/rounds/:roundNumber/status
 * @desc    Open, close, lock, or unlock a round (LOCKED, AVAILABLE, IN_PROGRESS, COMPLETED)
 * @access  Admin Only
 */
router.patch('/rounds/:roundNumber/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: [${allowedStatuses.join(', ')}]` });
    }

    const existingRound = await getRoundByNumber(req.params.roundNumber);
    if (!existingRound) {
      return res.status(404).json({ success: false, message: `Round ${req.params.roundNumber} not found.` });
    }

    const previousValue = { status: existingRound.status };
    const updatedRound = await updateRoundStatus(req.params.roundNumber, status);

    await logAdminAudit(
      req.user,
      'ROUND_STATUS_CHANGE',
      'Round',
      String(req.params.roundNumber),
      existingRound.title,
      previousValue,
      { status: updatedRound.status },
      req
    );

    return res.status(200).json({
      success: true,
      message: `Updated Round ${req.params.roundNumber} status to '${status}'.`,
      round: updatedRound,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to change round status: ' + error.message });
  }
});

/**
 * @route   PUT /api/v1/admin/mgmt/rounds/:roundNumber/config
 * @desc    Configure round availability, duration, min team size, scoring rules
 * @access  Admin Only
 */
router.put('/rounds/:roundNumber/config', async (req, res) => {
  try {
    const existingRound = await getRoundByNumber(req.params.roundNumber);
    if (!existingRound) {
      return res.status(404).json({ success: false, message: `Round ${req.params.roundNumber} not found.` });
    }

    const previousValue = JSON.parse(JSON.stringify(existingRound));
    const updatedRound = await updateRoundConfig(req.params.roundNumber, req.body);

    await logAdminAudit(
      req.user,
      'ROUND_CONFIG_UPDATE',
      'Round',
      String(req.params.roundNumber),
      existingRound.title,
      previousValue,
      updatedRound,
      req
    );

    return res.status(200).json({
      success: true,
      message: `Updated configuration for Round ${req.params.roundNumber}.`,
      round: updatedRound,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update round config: ' + error.message });
  }
});

// ==================== TEAM SESSION RESETS & SCORE ADJUSTMENTS ====================

/**
 * @route   POST /api/v1/admin/mgmt/teams/:teamId/reset-session
 * @desc    Reset an individual team's active game session & progress
 * @access  Admin Only
 */
router.post('/teams/:teamId/reset-session', async (req, res) => {
  try {
    const team = await findTeamById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const result = await resetTeamSession(req.params.teamId);

    await logAdminAudit(
      req.user,
      'RESET_TEAM_SESSION',
      'Team',
      team._id,
      team.name,
      result.previousState,
      result.newState,
      req
    );

    notifyAdminLiveStateUpdate();

    return res.status(200).json({
      success: true,
      message: `Game session for Team '${team.name}' has been reset successfully.`,
      team: result.team,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset team game session: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/mgmt/teams/:teamId/adjust-score
 * @desc    Make manual score adjustment for a team with audit record
 * @access  Admin Only
 */
router.post('/teams/:teamId/adjust-score', async (req, res) => {
  try {
    const { roundNumber = 1, scoreDelta, reason } = req.body;
    if (scoreDelta === undefined || isNaN(parseInt(scoreDelta))) {
      return res.status(400).json({ success: false, message: 'Valid scoreDelta integer is required.' });
    }

    const team = await findTeamById(req.params.teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const result = await adjustTeamScore(req.params.teamId, roundNumber, scoreDelta, reason);

    await logAdminAudit(
      req.user,
      'SCORE_ADJUSTMENT',
      'Team',
      team._id,
      team.name,
      { roundNumber, score: result.previousScore },
      { roundNumber, score: result.newScore, scoreDelta: parseInt(scoreDelta), reason },
      req
    );

    notifyAdminLiveStateUpdate();

    return res.status(200).json({
      success: true,
      message: `Adjusted score for Team '${team.name}' (Round ${roundNumber}) from ${result.previousScore} to ${result.newScore}.`,
      team: result.team,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to adjust team score: ' + error.message });
  }
});

// ==================== LEADERBOARD FREEZE & PUBLISH ====================

/**
 * @route   GET /api/v1/admin/mgmt/leaderboard/status
 * @desc    Fetch current leaderboard freeze and publish status
 * @access  Admin Only
 */
router.get('/leaderboard/status', async (req, res) => {
  try {
    const status = await getLeaderboardStatus();
    return res.status(200).json({ success: true, leaderboard: status });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard status: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/mgmt/leaderboard/freeze
 * @desc    Freeze or unfreeze leaderboard
 * @access  Admin Only
 */
router.post('/leaderboard/freeze', async (req, res) => {
  try {
    const { isFrozen } = req.body;
    const result = await setLeaderboardFreeze(isFrozen, req.user.email);

    await logAdminAudit(
      req.user,
      isFrozen ? 'LEADERBOARD_FREEZE' : 'LEADERBOARD_UNFREEZE',
      'Leaderboard',
      'global_leaderboard',
      'Event Leaderboard',
      result.previousState,
      result.newState,
      req
    );

    return res.status(200).json({
      success: true,
      message: `Event Leaderboard is now ${isFrozen ? 'FROZEN' : 'UNFROZEN'}.`,
      leaderboard: result.setting,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to toggle leaderboard freeze: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/mgmt/leaderboard/publish
 * @desc    Publish or hide leaderboard
 * @access  Admin Only
 */
router.post('/leaderboard/publish', async (req, res) => {
  try {
    const { isPublished } = req.body;
    const result = await setLeaderboardPublish(isPublished, req.user.email);

    await logAdminAudit(
      req.user,
      isPublished ? 'LEADERBOARD_PUBLISH' : 'LEADERBOARD_UNPUBLISH',
      'Leaderboard',
      'global_leaderboard',
      'Event Leaderboard',
      result.previousState,
      result.newState,
      req
    );

    return res.status(200).json({
      success: true,
      message: `Leaderboard is now ${isPublished ? 'PUBLISHED' : 'UNPUBLISHED'}.`,
      leaderboard: result.setting,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update leaderboard publish state: ' + error.message });
  }
});

/**
 * @route   GET /api/v1/admin/mgmt/audit-logs
 * @desc    Fetch administrative audit logs
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

// ==================== ROUND CRUD OPERATIONS ====================

/**
 * @route   POST /api/v1/admin/mgmt/rounds
 * @desc    Create a new competition round
 * @access  Admin Only
 */
router.post('/rounds', async (req, res) => {
  try {
    const { roundNumber, title, description, mechanicType, durationSeconds, minTeamSize, status } = req.body;
    if (!title || !roundNumber) {
      return res.status(400).json({ success: false, message: 'Round title and round number are required.' });
    }

    const round = await createRound({
      roundNumber: parseInt(roundNumber),
      title,
      description,
      mechanicType: mechanicType || 'SEQUENTIAL_PUZZLE',
      durationSeconds: parseInt(durationSeconds) || 1800,
      minTeamSize: parseInt(minTeamSize) || 2,
      status: status || 'LOCKED',
    });

    await logAdminAudit(req.user, 'ROUND_CREATE', 'Round', `round_${roundNumber}`, round.title, null, round, req);

    return res.status(201).json({ success: true, message: `Round ${roundNumber} created successfully.`, round });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create round: ' + error.message });
  }
});

/**
 * @route   DELETE /api/v1/admin/mgmt/rounds/:roundNumber
 * @desc    Delete a competition round
 * @access  Admin Only
 */
router.delete('/rounds/:roundNumber', async (req, res) => {
  try {
    const roundNumber = parseInt(req.params.roundNumber);
    if (roundNumber === 1) {
      return res.status(400).json({ success: false, message: 'Round 1 is standard and cannot be deleted.' });
    }

    await deleteRound(roundNumber);
    await logAdminAudit(req.user, 'ROUND_DELETE', 'Round', `round_${roundNumber}`, `Round ${roundNumber}`, null, null, req);

    return res.status(200).json({ success: true, message: `Round ${roundNumber} deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete round: ' + error.message });
  }
});

// ==================== ADMIN WHITELIST MANAGEMENT ====================

/**
 * @route   GET /api/v1/admin/mgmt/whitelist
 * @desc    Get all admin whitelist emails
 * @access  Admin Only
 */
router.get('/whitelist', async (req, res) => {
  try {
    const list = await getAdminWhitelist();
    return res.status(200).json({ success: true, whitelist: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin whitelist: ' + error.message });
  }
});

/**
 * @route   POST /api/v1/admin/mgmt/whitelist
 * @desc    Add a new administrator email to the whitelist
 * @access  Admin Only
 */
router.post('/whitelist', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email is required.' });
    }

    const updated = await addAdminWhitelistEmail(email);
    await logAdminAudit(req.user, 'ADMIN_WHITELIST_ADD', 'AdminWhitelist', email, email, null, { email }, req);

    return res.status(200).json({ success: true, message: `Added ${email} to admin whitelist.`, whitelist: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to add admin email: ' + error.message });
  }
});

/**
 * @route   DELETE /api/v1/admin/mgmt/whitelist/:email
 * @desc    Remove an administrator email from the whitelist
 * @access  Admin Only
 */
router.delete('/whitelist/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const updated = await removeAdminWhitelistEmail(email);
    await logAdminAudit(req.user, 'ADMIN_WHITELIST_REMOVE', 'AdminWhitelist', email, email, { email }, null, req);

    return res.status(200).json({ success: true, message: `Removed ${email} from admin whitelist.`, whitelist: updated });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// ==================== HELP & SUPPORT FAQ MANAGEMENT ====================

/**
 * @route   POST /api/v1/admin/mgmt/help
 * @desc    Add an FAQ entry
 * @access  Admin Only
 */
router.post('/help', async (req, res) => {
  try {
    const { question, answer, category, displayOrder } = req.body;
    if (!question || !answer) {
      return res.status(400).json({ success: false, message: 'Question and answer are required.' });
    }

    const faq = await createFAQ({ question, answer, category, displayOrder });
    await logAdminAudit(req.user, 'FAQ_CREATE', 'FAQ', faq._id, faq.question, null, faq, req);

    return res.status(201).json({ success: true, message: 'FAQ created successfully.', faq });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create FAQ: ' + error.message });
  }
});

/**
 * @route   PUT /api/v1/admin/mgmt/help/:id
 * @desc    Edit an FAQ entry
 * @access  Admin Only
 */
router.put('/help/:id', async (req, res) => {
  try {
    const faq = await updateFAQ(req.params.id, req.body);
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found.' });
    }

    await logAdminAudit(req.user, 'FAQ_UPDATE', 'FAQ', faq._id, faq.question, null, faq, req);

    return res.status(200).json({ success: true, message: 'FAQ updated successfully.', faq });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update FAQ: ' + error.message });
  }
});

/**
 * @route   DELETE /api/v1/admin/mgmt/help/:id
 * @desc    Delete an FAQ entry
 * @access  Admin Only
 */
router.delete('/help/:id', async (req, res) => {
  try {
    await deleteFAQ(req.params.id);
    await logAdminAudit(req.user, 'FAQ_DELETE', 'FAQ', req.params.id, 'FAQ', null, null, req);

    return res.status(200).json({ success: true, message: 'FAQ deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete FAQ: ' + error.message });
  }
});

export default router;
