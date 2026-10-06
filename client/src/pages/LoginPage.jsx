import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle, ShieldCheck, Sparkles, Lock } from 'lucide-react';

export function LoginPage() {
  const { loginWithFirebaseGoogle, user, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(authError || '');

  const from = location.state?.from?.pathname;

  // Handle immediate redirect if user is already authenticated
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin' || user.role === 'super_admin') {
        navigate('/admin', { replace: true });
      } else if (!user.isProfileComplete) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate(from || '/dashboard', { replace: true });
      }
    }
  }, [user, navigate, from]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const loggedUser = await loginWithFirebaseGoogle();
      
      // Direct routing based on recognized role
      if (loggedUser.role === 'admin' || loggedUser.role === 'super_admin') {
        navigate('/admin', { replace: true });
      } else if (!loggedUser.isProfileComplete) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate(from || '/dashboard', { replace: true });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Google Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page-container">
      {/* Left-side event branding */}
      <section className="event-info" aria-label="Event information">
        <header className="brand">
          <img src="/ieeesb_logo_theme.svg" alt="IEEE Logo" style={{ width: 44, height: 44, objectFit: 'contain' }} />
          <div className="brand-text">
            <h1>
              VORTEX <span>2026</span>
            </h1>
            <p>IEEE SB NIT DURGAPUR</p>
          </div>
        </header>

        <div className="left-copy">
          <h2>
            BEYOND
            <br />
            <strong>LIMITS</strong>
          </h2>
          <div className="short-line"></div>

          <div className="copy-list">
            <span>EXPLORE</span>
            <span>COMPETE</span>
            <span>COLLABORATE</span>
            <span>CREATE</span>
          </div>
        </div>

        <div className="top-words">
          <span>IDEAS</span>
          <i></i>
          <span>PEOPLE</span>
          <i></i>
          <span>POSSIBILITIES</span>
        </div>

        <div className="right-copy">
          <span>KNOWLEDGE</span>
          <span>BUILDS</span>
          <span>BRIGHTER</span>
          <span>TOMORROWS</span>
          <div className="short-line"></div>
        </div>
      </section>

      {/* Login panel */}
      <section className="login-area" aria-label="Login">
        <div className="login-card">
          <div className="login-logo">
            <Sparkles className="w-6 h-6 text-sky-400" />
          </div>

          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in with your Google account to access your portal</p>

          <div className="title-line"></div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/80 rounded-xl flex items-center gap-2 text-red-200 text-xs font-mono border border-red-500/30 w-full text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <label className="provider-label" htmlFor="google-login">
            AUTHENTICATION PROVIDER
          </label>

          <div className="provider-row">
            <div className="google-letter">G</div>
            <span>Google Single Sign-On</span>
            <span className="verified-icon">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </span>
          </div>

          <button
            className="google-button"
            id="google-login"
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-white" />
            ) : (
              <>
                <span className="google-icon">G</span>
                <span>Continue with Google</span>
                <span className="button-arrow">→</span>
              </>
            )}
          </button>

          <div style={{ marginTop: 24, padding: 14, background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock className="w-4 h-4 text-sky-400 shrink-0" />
            <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4, textAlign: 'left' }}>
              Authorized administrators are routed directly to the Admin Console upon verification.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
