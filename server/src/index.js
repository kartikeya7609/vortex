import './config/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import roundRoutes from './routes/roundRoutes.js';
import adminTeamRoutes from './routes/adminTeamRoutes.js';
import adminManagementRoutes from './routes/adminManagementRoutes.js';
import round1GameRoutes from './routes/round1GameRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import helpRoutes from './routes/helpRoutes.js';
import detectiveRoutes from './routes/detectiveRoutes.js';
import { getJwtSecret } from './config/jwt.js';
import { expireDueRound1Sessions, unpublishMalformedRoundOnePuzzles } from './services/store.js';
import { seedDefaultDetectiveCaseIfNeeded } from './services/detectiveService.js';

// Environment configuration is loaded before modules that initialize external clients.

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

if (process.env.NODE_ENV === 'production') {
  getJwtSecret();
  const required = ['MONGO_URI', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const missing = required.filter((name) => !process.env[name]);
  const missingAll = [...missing, ...(!process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_CLOUD_PROJECT ? ['FIREBASE_PROJECT_ID'] : []), ...(!process.env.CLIENT_ORIGIN ? ['CLIENT_ORIGIN'] : [])];
  if (missingAll.length > 0) {
    console.warn(`[Production Config Warning] Missing production env variables: ${missingAll.join(', ')}. Using resilient store and dev fallbacks.`);
  }
}

// Core Middlewares
app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
  })
);
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());

// API Health Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Aarohan Multi-Round Platform Backend Operational',
    timestamp: new Date().toISOString(),
  });
});

// API Routes Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/rounds', roundRoutes);
app.use('/api/v1/admin/teams-mgmt', adminTeamRoutes);
app.use('/api/v1/admin/mgmt', adminManagementRoutes);
app.use('/api/v1/game/r1', round1GameRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/help', helpRoutes);
app.use('/api/v1/detective', detectiveRoutes);

// Global 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.status && err.status < 500 ? err.message : 'Internal Server Error',
  });
});

import http from 'http';
import { initSocket, notifyAdminLiveStateUpdate } from './services/socketService.js';

// Start Server with Socket.IO Attached
const httpServer = http.createServer(app);
initSocket(httpServer, allowedOrigins);

connectDB().then(async () => {
  await unpublishMalformedRoundOnePuzzles();
  await expireDueRound1Sessions();
  await seedDefaultDetectiveCaseIfNeeded();
  setInterval(async () => {
    try {
      const expiredCount = await expireDueRound1Sessions();
      if (expiredCount) await notifyAdminLiveStateUpdate();
    } catch (error) {
      console.error('[Session Timer Error]:', error.message);
    }
  }, 15000).unref();
  httpServer.listen(PORT, () => {
    console.log(`[Aarohan Server] Listening on port ${PORT} with Socket.IO Real-Time Engine`);
    console.log(`[Aarohan Server] Client origins allowed: ${allowedOrigins.join(', ')}`);
  });
}).catch((error) => {
  console.error('[Startup Error] Required production services are unavailable:', error.message);
  process.exit(1);
});
