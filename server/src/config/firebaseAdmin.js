import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import jwt from 'jsonwebtoken';

const getFirebaseAuth = () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return null;
  }
  if (!getApps().length) {
    const options = {};
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      options.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    }
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) options.projectId = projectId;
    initializeApp(options);
  }
  return getAuth();
};

export const verifyFirebaseIdToken = async (token) => {
  const auth = getFirebaseAuth();
  if (!auth) {
    // In local development without service account keys, decode the standard JWT payload sent by client Firebase SDK
    const decoded = jwt.decode(token);
    if (!decoded) {
      throw new Error('Invalid Firebase ID token format');
    }
    return {
      uid: decoded.sub || decoded.user_id || decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email?.split('@')[0],
      picture: decoded.picture || '',
      email_verified: decoded.email_verified ?? true,
      firebase: {
        sign_in_provider: decoded.firebase?.sign_in_provider || 'google.com',
      },
    };
  }
  return auth.verifyIdToken(token, true);
};

