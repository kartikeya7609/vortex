import mongoose from 'mongoose';
import dns from 'dns';
import './env.js';

// Configure fallback DNS servers (Google & Cloudflare) for reliable MongoDB Atlas SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Gracefully fallback to OS default DNS if prohibited
}

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI is not configured.');

    mongoose.set('bufferCommands', false);

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });

    global.isMongoConnected = true;
    console.log(`[MongoDB Atlas] Connected successfully to Cloud Cluster: ${conn.connection.host}`);
  } catch (error) {
    global.isMongoConnected = false;
    console.warn(`[MongoDB Atlas Warning]: ${error.message}`);
    if (process.env.NODE_ENV === 'production') throw error;
    console.log('[Aarohan Engine] Running in Resilient Data Store Mode (Zero-Interruption Local Execution).');
  }
};
