import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';
import { IEEELoader } from './IEEELoader';

export function ProtectedRoute({ children, allowedRoles, requireProfile = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <IEEELoader label="VERIFYING CREDENTIALS..." />;
  }

  // 1. Check Authentication
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Check Profile Completion Requirement
  if (requireProfile && !user.isProfileComplete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // 3. Check Role Authorization (e.g. for Admin routes)
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-950/60 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black uppercase text-red-500 tracking-wider mb-2">Access Denied</h2>
          <p className="text-slate-400 mb-6 text-sm">
            Your current role (<span className="text-amber-400 font-mono font-bold">{user.role}</span>) does not have authorization to view this administrator section.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition duration-200 shadow-lg shadow-red-600/30"
          >
            Return to Participant Dashboard
          </a>
        </div>
      </div>
    );
  }

  return children;
}
