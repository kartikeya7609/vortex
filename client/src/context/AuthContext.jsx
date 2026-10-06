import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, googleProvider } from '../config/firebase';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { API_BASE_URL, apiFetch } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Check authentication status on initial load
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Auth status check failed:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  /**
   * Firebase Google Auth Sign-In with Popup
   */
  const loginWithFirebaseGoogle = async () => {
    try {
      setAuthError(null);
      setLoading(true);

      // Trigger Firebase Google Popup
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const idToken = await firebaseUser.getIdToken();

      // Post Firebase verified identity to Backend Server
      const res = await apiFetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        body: JSON.stringify({
          firebaseToken: idToken,
          googleId: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || 'Firebase User',
          avatar: firebaseUser.photoURL || '',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Backend Firebase authentication failed.');
      }

      setUser(data.user);
      return data.user;
    } catch (err) {
      console.error('[Firebase Auth Error]:', err);
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Development Mock Login (for testing without live credentials)
   */
  const loginDevUser = async (role = 'participant') => {
    try {
      setAuthError(null);
      setLoading(true);

      const devUser = {
        googleId: `firebase-dev-${role}-${Date.now()}`,
        email: role === 'admin' ? 'admin.marvel@aarohan.edu' : 'stark.tony@aarohan.edu',
        name: role === 'admin' ? 'Nick Fury (Admin)' : 'Tony Stark',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      };

      const res = await apiFetch(`${API_BASE_URL}/auth/google`, {
        method: 'POST',
        body: JSON.stringify({ devUser }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Dev sign-in failed.');
      }

      setUser(data.user);
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update Profile Details (Onboarding completion)
   */
  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      setAuthError(null);

      const res = await apiFetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update profile.');
      }

      setUser(data.user);
      return data.user;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign Out
   */
  const logout = async () => {
    try {
      setLoading(true);
      await firebaseSignOut(auth).catch(() => {});
      await apiFetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[Logout Error]:', err.message);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        loginWithFirebaseGoogle,
        loginDevUser,
        updateProfile,
        logout,
        refreshAuth: checkAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
