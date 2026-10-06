import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import {
  findUserById,
  getAllUsers,
  getAllTeams,
  getLeaderboardStatus,
  getMemoryStore,
  isDbConnected,
} from './store.js';
import { GameSession } from '../models/GameSession.js';
import { computeRoundRankings } from './rankingService.js';
import { getJwtSecret } from '../config/jwt.js';

let io = null;
const onlineUsers = new Map(); // socketId -> { userId, email, name, role, teamId, teamName, socketId, connectedAt }

export const initSocket = (httpServer, clientOrigins) => {
  const allowedOrigins = Array.isArray(clientOrigins) ? clientOrigins : [clientOrigins];
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Socket Authentication & Authorization Middleware
  io.use(async (socket, next) => {
    try {
      let token = null;

      // Check cookie header
      if (socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        for (const cookie of cookies) {
          const [key, val] = cookie.trim().split('=');
          if (key === 'token') {
            token = decodeURIComponent(val);
            break;
          }
        }
      }

      // Check auth object or query fallback
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }
      if (!token && socket.handshake.query?.token) {
        token = socket.handshake.query.token;
      }

      if (!token) {
        // Allow unauthenticated connection with guest scope (for public leaderboard live updates only)
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const user = await findUserById(decoded.userId);
      if (!user) {
        socket.user = null;
        return next();
      }

      socket.user = {
        _id: String(user._id || user.id),
        id: String(user._id || user.id),
        email: user.email,
        name: user.name,
        role: user.role || 'participant',
        teamId: user.teamId ? String(user.teamId) : null,
        teamName: user.teamName || '',
      };

      return next();
    } catch (err) {
      console.warn('[Socket Auth Error]:', err.message);
      socket.user = null;
      return next();
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;

    if (user) {
      onlineUsers.set(socket.id, {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
        teamName: user.teamName,
        socketId: socket.id,
        connectedAt: new Date(),
      });

      // Join Team-specific channel for participant isolation
      if (user.teamId) {
        socket.join(`team_${user.teamId}`);
      }

      // Join Administrator Monitoring Channel if authorized
      if (user.role === 'admin' || user.role === 'super_admin') {
        socket.join('admin_feed');
        console.log(`[Socket] Administrator ${user.email} joined admin_feed room.`);
        // Send initial comprehensive authoritative state to admin
        const liveState = await buildAdminLiveMonitoringState();
        socket.emit('admin:live_state', liveState);
      }
    }

    // Public room for live public notifications
    socket.join('public_room');

    // Notify admins of updated online roster
    broadcastAdminPresence();

    // Client requests state recovery
    socket.on('admin:request_state', async () => {
      if (socket.user && (socket.user.role === 'admin' || socket.user.role === 'super_admin')) {
        const liveState = await buildAdminLiveMonitoringState();
        socket.emit('admin:live_state', liveState);
      }
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id);
      broadcastAdminPresence();
    });
  });

  return io;
};

/**
 * Builds authoritative live state payload for the administrator dashboard
 */
export const buildAdminLiveMonitoringState = async () => {
  try {
    const allUsers = await getAllUsers();
    const allTeams = await getAllTeams();

    // Compile online participants list (deduplicating by userId)
    const uniqueOnlineMap = new Map();
    for (const online of onlineUsers.values()) {
      if (!uniqueOnlineMap.has(online.userId)) {
        uniqueOnlineMap.set(online.userId, online);
      }
    }
    const onlineParticipants = Array.from(uniqueOnlineMap.values());

    // Fetch active & completed game sessions for Round 1
    let sessions = [];
    if (isDbConnected()) {
      try {
        sessions = await GameSession.find({ roundNumber: 1 });
      } catch (e) {
        sessions = (getMemoryStore().gameSessions || []).filter((s) => (s.roundNumber || 1) === 1);
      }
    } else {
      sessions = (getMemoryStore().gameSessions || []).filter((s) => (s.roundNumber || 1) === 1);
    }

    const playingTeams = [];
    const completedTeams = [];

    const now = new Date();
    for (const s of sessions) {
      const startTime = new Date(s.startTime);
      const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
      const durationSeconds = s.expiresAt ? Math.max(0, Math.floor((new Date(s.expiresAt) - startTime) / 1000)) : 1800;
      const remainingSeconds = s.status === 'TIME_EXPIRED' ? 0 : Math.max(0, s.expiresAt ? Math.ceil((new Date(s.expiresAt) - now) / 1000) : durationSeconds - elapsedSeconds);
      const isCompleted = s.status === 'COMPLETED' || s.isCompleted === true;
      const isExpired = s.status === 'TIME_EXPIRED' || s.status === 'EXPIRED';

      const sessionObj = {
        sessionId: s._id,
        teamId: s.teamId,
        teamName: s.teamName,
        currentPuzzleIndex: s.currentPuzzleIndex || 0,
        currentPuzzleId: s.currentPuzzleId || '',
        puzzlesCompleted: s.completedPuzzleIds?.length || s.currentPuzzleIndex || 0,
        score: s.score || 0,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        elapsedSeconds: (isCompleted || isExpired) && s.endTime ? Math.floor((new Date(s.endTime) - startTime) / 1000) : elapsedSeconds,
        remainingSeconds: isCompleted || isExpired ? 0 : remainingSeconds,
        durationSeconds,
        attemptsCount: s.attempts?.length || 0,
        lastAttempt: s.attempts?.length > 0 ? s.attempts[s.attempts.length - 1] : null,
      };

      if (isCompleted || isExpired) {
        completedTeams.push(sessionObj);
      } else if (s.status === 'IN_PROGRESS') {
        playingTeams.push(sessionObj);
      }
    }

    // Live Round 1 rankings
    let liveLeaderboard = [];
    try {
      const computed = await computeRoundRankings(1);
      liveLeaderboard = computed.entries.slice(0, 10);
    } catch (e) {}

    return {
      timestamp: new Date().toISOString(),
      totalRegisteredUsers: allUsers.length,
      onlineCount: onlineParticipants.length,
      onlineUsers: onlineParticipants,
      totalTeams: allTeams.length,
      activeRound1PlayingCount: playingTeams.length,
      playingTeams,
      completedTeamsCount: completedTeams.length,
      completedTeams,
      liveLeaderboard,
    };
  } catch (err) {
    console.error('[buildAdminLiveMonitoringState Error]:', err);
    return {
      timestamp: new Date().toISOString(),
      totalRegisteredUsers: 0,
      onlineCount: 0,
      onlineUsers: [],
      totalTeams: 0,
      activeRound1PlayingCount: 0,
      playingTeams: [],
      completedTeamsCount: 0,
      completedTeams: [],
      liveLeaderboard: [],
    };
  }
};

const broadcastAdminPresence = async () => {
  if (!io) return;
  const uniqueOnlineMap = new Map();
  for (const online of onlineUsers.values()) {
    if (!uniqueOnlineMap.has(online.userId)) {
      uniqueOnlineMap.set(online.userId, online);
    }
  }
  const onlineParticipants = Array.from(uniqueOnlineMap.values());

  io.to('admin_feed').emit('admin:presence_update', {
    onlineCount: onlineParticipants.length,
    onlineUsers: onlineParticipants,
  });
};

/**
 * Triggers full live monitoring refresh broadcast to all connected administrators
 */
export const notifyAdminLiveStateUpdate = async () => {
  if (!io) return;
  try {
    const liveState = await buildAdminLiveMonitoringState();
    io.to('admin_feed').emit('admin:live_state', liveState);
  } catch (e) {
    console.warn('[notifyAdminLiveStateUpdate Error]:', e.message);
  }
};

/**
 * Real-time event emitters for game events
 */
export const emitGameSessionStarted = async (teamId, teamName, session) => {
  if (!io) return;
  const payload = {
    type: 'SESSION_STARTED',
    teamId: String(teamId),
    teamName,
    roundNumber: session.roundNumber || 1,
    startTime: session.startTime,
    currentPuzzleIndex: session.currentPuzzleIndex || 0,
    score: session.score || 0,
  };

  // Notify team room
  io.to(`team_${teamId}`).emit('game:state_changed', payload);
  // Notify admin feed
  io.to('admin_feed').emit('admin:game_event', payload);
  // Refresh full admin monitor state
  await notifyAdminLiveStateUpdate();
};

export const emitPuzzleSolved = async (teamId, teamName, result) => {
  if (!io) return;
  const payload = {
    type: result.isCorrect ? 'PUZZLE_SOLVED' : 'PUZZLE_ATTEMPT_FAILED',
    teamId: String(teamId),
    teamName,
    roundNumber: 1,
    isCorrect: result.isCorrect,
    pointsAwarded: result.pointsAwarded,
    totalScore: result.session?.score || 0,
    currentPuzzleIndex: result.currentPuzzleIndex,
    isRoundCompleted: result.isRoundCompleted,
    timestamp: new Date().toISOString(),
  };

  io.to(`team_${teamId}`).emit('game:puzzle_result', payload);
  io.to('admin_feed').emit('admin:game_event', payload);
  await notifyAdminLiveStateUpdate();
};

export const emitRoundCompleted = async (teamId, teamName, session) => {
  if (!io) return;
  const payload = {
    type: 'ROUND_COMPLETED',
    teamId: String(teamId),
    teamName,
    roundNumber: session.roundNumber || 1,
    finalScore: session.score,
    completedAt: session.endTime || new Date(),
  };

  io.to(`team_${teamId}`).emit('game:round_completed', payload);
  io.to('admin_feed').emit('admin:game_event', payload);
  io.to('public_room').emit('leaderboard:refresh_needed');
  await notifyAdminLiveStateUpdate();
};

export const emitLeaderboardUpdated = async (roundNumber = 1) => {
  if (!io) return;
  io.to('public_room').emit('leaderboard:updated', { roundNumber });
  io.to('admin_feed').emit('admin:leaderboard_changed', { roundNumber });
  await notifyAdminLiveStateUpdate();
};

export const getIO = () => io;
