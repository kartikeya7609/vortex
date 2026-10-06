import express from 'express';
import { requireAuth, requireProfileComplete } from '../middleware/auth.js';
import {
  findTeamById,
  getAllPuzzles,
  getPuzzleById,
  saveDiskBackup,
  getRoundByNumber,
  findActiveGameSession,
  startTeamGameSession,
  submitTeamGameAttempt,
} from '../services/store.js';
import {
  emitGameSessionStarted,
  emitPuzzleSolved,
  emitRoundCompleted,
} from '../services/socketService.js';

const router = express.Router();

const publicPuzzle = (puzzle) => {
  const pieces = (puzzle.pieces || []).map(({ pieceId, imageUrl }) => ({ pieceId, imageUrl }));
  for (let i = pieces.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  if (pieces.length > 1 && pieces.every((piece, index) => piece.pieceId === puzzle.correctOrder?.[index])) pieces.push(pieces.shift());
  return { id: String(puzzle._id), puzzleCode: puzzle.puzzleCode, roundNumber: puzzle.roundNumber,
    title: puzzle.title, description: puzzle.description, imageUrl: puzzle.imageUrl,
    gridRows: puzzle.gridRows, gridCols: puzzle.gridCols, points: puzzle.points,
    timeLimitSeconds: puzzle.timeLimitSeconds, hint: puzzle.hint, pieces };
};

/**
 * Helper middleware to verify team membership and readiness before any Round 1 operation
 */
const verifyTeamEligibility = async (req, res, next) => {
  try {
    if (!req.user.teamId) {
      return res.status(403).json({
        success: false,
        code: 'NO_TEAM',
        message: 'Game access denied: You must join or create a team before participating in Round 1.',
      });
    }

    const team = await findTeamById(req.user.teamId);
    if (!team) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_NOT_FOUND',
        message: 'Game access denied: Associated team record not found.',
      });
    }

    if (!(team.memberIds || []).some((member) => String(member?._id || member) === String(req.user._id))) {
      return res.status(403).json({ success: false, code: 'NOT_TEAM_MEMBER', message: 'You are not a member of this team.' });
    }

    if (team.isDisqualified) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_DISQUALIFIED',
        message: `Game access denied: Your team '${team.name}' has been disqualified. Reason: ${team.disqualificationReason || 'Policy violation'}`,
      });
    }

    const memberCount = team.memberIds ? team.memberIds.length : 0;
    const minRequired = team.minSizeRequired || 2;
    const hasAdminBypass = team.allowAdminBypass === true;

    if (memberCount < minRequired && !hasAdminBypass) {
      return res.status(403).json({
        success: false,
        code: 'TEAM_NOT_READY',
        message: `Game access denied: Team '${team.name}' requires at least ${minRequired} members to start (Current: ${memberCount}/${team.maxSize}).`,
        memberCount,
        minRequired,
      });
    }

    const round1 = await getRoundByNumber(1);
    if (!round1 || !['AVAILABLE', 'IN_PROGRESS'].includes(round1.status)) {
      return res.status(403).json({
        success: false,
        code: 'ROUND_LOCKED',
        message: 'Round 1 is currently LOCKED by event administrators.',
      });
    }

    req.team = team;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Team eligibility check error: ' + error.message });
  }
};

// Protect all Round 1 Game routes
router.use(requireAuth, requireProfileComplete, verifyTeamEligibility);

/**
 * @route   GET /api/v1/game/r1/state
 * @desc    Fetch real-time Round 1 session state for team caller (Leader or Member)
 * @access  Private (Team Members & Leaders)
 */
router.get('/state', async (req, res) => {
  try {
    const team = req.team;
    const isLeader = String(team.leaderId?._id || team.leaderId) === String(req.user._id);

    const publishedPuzzles = await getAllPuzzles(1);
    const activePuzzles = publishedPuzzles
      .filter((p) => p.isPublished !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const session = await findActiveGameSession(team._id, 1);

    if (!session) {
      return res.status(200).json({
        success: true,
        hasStarted: false,
        isLeader,
        teamName: team.name,
        leaderName: team.leaderId?.name || 'Leader',
        totalPublishedPuzzles: activePuzzles.length,
        message: isLeader
          ? 'You are the Team Leader. Click "Start Team Game" to launch Round 1.'
          : `Waiting for Team Leader '${team.leaderId?.name || 'Leader'}' to start Round 1.`,
      });
    }

    if (session.status === 'IN_PROGRESS' && session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      session.status = 'TIME_EXPIRED';
      session.endTime = new Date();
    if (typeof session.save === 'function') await session.save();
    saveDiskBackup();
    }
    const isCompleted = session.status === 'COMPLETED' || session.isCompleted;
    const isExpired = ['TIME_EXPIRED', 'EXPIRED'].includes(session.status);
    const puzzleIdx = session.currentPuzzleIndex || 0;
    const puzzleCount = session.puzzleIds?.length || activePuzzles.length;

    let currentPuzzleData = null;
    if (!isCompleted && !isExpired && puzzleIdx < puzzleCount) {
      const targetP = session.currentPuzzleId ? await getPuzzleById(session.currentPuzzleId) : activePuzzles[puzzleIdx];
      if (!targetP || targetP.roundNumber !== 1) return res.status(409).json({ success: false, message: 'The current puzzle configuration is unavailable.' });
      currentPuzzleData = publicPuzzle(targetP);
    }

    return res.status(200).json({
      success: true,
      hasStarted: true,
      isLeader,
      isCompleted,
      isExpired,
      session: {
        id: session._id,
        status: session.status,
        currentPuzzleIndex: puzzleIdx,
        totalPuzzles: puzzleCount,
        score: session.score || 0,
        startTime: session.startTime,
        expiresAt: session.expiresAt,
        remainingSeconds: session.expiresAt ? Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000)) : null,
        attemptsCount: session.attempts ? session.attempts.length : 0,
        attempts: (session.attempts || []).map(({ submittedAnswer, submittedPieceOrder, ...attempt }) => attempt),
      },
      currentPuzzle: currentPuzzleData,
      team: {
        id: team._id,
        name: team.name,
        code: team.code,
        leaderName: team.leaderId?.name || 'Leader',
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch game state.' });
  }
});

/**
 * @route   POST /api/v1/game/r1/start
 * @desc    Start Round 1 game session (TEAM LEADER ONLY)
 * @access  Private (Team Leader Only)
 */
router.post('/start', async (req, res) => {
  try {
    const team = req.team;
    const isLeader = String(team.leaderId?._id || team.leaderId) === String(req.user._id);

    if (!isLeader) {
      return res.status(403).json({
        success: false,
        code: 'ONLY_LEADER_CAN_START',
        message: `Round 1 access denied: Only Team Leader '${team.leaderId?.name || 'Leader'}' can start the game session.`,
      });
    }

    const session = await startTeamGameSession(team._id, req.user, 1);

    // Real-time broadcast to administrator feed & team room
    emitGameSessionStarted(team._id, team.name, session);

    const publishedPuzzles = await getAllPuzzles(1);
    const activePuzzles = publishedPuzzles
      .filter((p) => p.isPublished !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const firstPuzzle = activePuzzles[0];
    const firstPuzzleData = publicPuzzle(firstPuzzle);

    return res.status(200).json({
      success: true,
      message: `Round 1 game session launched for Team '${team.name}'.`,
      session: {
        id: session._id,
        currentPuzzleIndex: 0,
        totalPuzzles: activePuzzles.length,
        score: session.score || 0,
      },
      currentPuzzle: firstPuzzleData,
    });
  } catch (error) {
    const businessConflict = /No published puzzles|without valid generated pieces|already used its game session/.test(error.message);
    const statusCode = error.code === 'ONLY_LEADER_CAN_START' ? 403 : businessConflict ? 409 : 500;
    return res.status(statusCode).json({ success: false, code: error.code || 'START_ERROR', message: statusCode === 500 ? 'Unable to start the team game session.' : error.message });
  }
});

/**
 * @route   POST /api/v1/game/r1/submit
 * @desc    Submit answer for current puzzle in sequential session (TEAM LEADER ONLY)
 * @access  Private (Team Leader Only)
 */
router.post('/submit', async (req, res) => {
  try {
    const { pieceOrder } = req.body;
    const team = req.team;

    const isLeader = String(team.leaderId?._id || team.leaderId) === String(req.user._id);

    if (!isLeader) {
      return res.status(403).json({
        success: false,
        code: 'ONLY_LEADER_CAN_SUBMIT',
        message: `Submission denied: Only Team Leader '${team.leaderId?.name || 'Leader'}' can submit puzzle answers.`,
      });
    }

    if (!Array.isArray(pieceOrder) || !pieceOrder.length) {
      return res.status(400).json({ success: false, message: 'An ordered list of piece IDs is required.' });
    }

    const result = await submitTeamGameAttempt(team._id, req.user, pieceOrder, 0, 1);

    // Real-time broadcast puzzle solve attempt
    emitPuzzleSolved(team._id, team.name, result);

    if (result.isRoundCompleted) {
      emitRoundCompleted(team._id, team.name, result.session);
    }

    return res.status(200).json({
      success: true,
      isCorrect: result.isCorrect,
      pointsAwarded: result.pointsAwarded,
      isRoundCompleted: result.isRoundCompleted,
      nextPuzzleUnlocked: result.nextPuzzleUnlocked,
      currentPuzzleIndex: result.currentPuzzleIndex,
      totalPuzzles: result.totalPuzzles,
      message: result.isRoundCompleted
        ? 'Congratulations! All Round 1 puzzles solved! Team qualified for Round 2.'
        : result.isCorrect
        ? 'Correct answer! Next puzzle unlocked.'
        : 'Incorrect answer. Try again!',
    });
  } catch (error) {
    const statusCode = error.code === 'ONLY_LEADER_CAN_SUBMIT' ? 403 : error.code === 'SESSION_EXPIRED' ? 410 : ['INVALID_PIECE_ORDER', 'STALE_PUZZLE'].includes(error.code) ? 400 : 500;
    return res.status(statusCode).json({ success: false, code: error.code || 'SUBMISSION_ERROR', message: statusCode === 500 ? 'Submission could not be processed.' : error.message });
  }
});

export default router;
