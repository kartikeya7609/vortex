import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import {
  Trophy,
  CheckCircle2,
  Lock,
  ShieldAlert,
  Loader2,
  UserCheck,
  X,
} from 'lucide-react';

import { API_BASE_URL, apiFetch } from '../services/api';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [roundsData, setRoundsData] = useState([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [apiError, setApiError] = useState(null);

  const [stats, setStats] = useState({
    totalScore: 0,
    gamesAttempted: 0,
    gamesCompleted: 0,
    currentRound: 1,
    eventStatus: 'REGISTERED',
  });

  const [teamOverview, setTeamOverview] = useState({
    hasTeam: false,
    teamName: null,
    teamCode: null,
    teamSize: 0,
    minTeamSizeRequired: 2,
    isTeamReady: false,
  });

  const [enteringRound, setEnteringRound] = useState(null);
  const [accessDeniedModal, setAccessDeniedModal] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingRounds(true);
      setApiError(null);

      const [roundsRes, statsRes] = await Promise.all([
        apiFetch(`${API_BASE_URL}/rounds/dashboard`),
        apiFetch(`${API_BASE_URL}/users/stats`),
      ]);

      const roundsJson = await roundsRes.json();
      if (roundsRes.ok && roundsJson.success) {
        setRoundsData(roundsJson.rounds || []);
        setTeamOverview({
          hasTeam: roundsJson.hasTeam,
          teamName: roundsJson.teamName,
          teamCode: roundsJson.teamCode,
          teamSize: roundsJson.teamSize,
          minTeamSizeRequired: roundsJson.minTeamSizeRequired || 2,
          isTeamReady: roundsJson.isTeamReady,
        });
      } else {
        throw new Error(roundsJson.message || 'Failed to fetch round data');
      }

      const statsJson = await statsRes.json();
      if (statsRes.ok && statsJson.success) {
        setStats(statsJson.stats);
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoadingRounds(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleEnterRound = async (roundNumber) => {
    try {
      setEnteringRound(roundNumber);
      const res = await apiFetch(`${API_BASE_URL}/rounds/${roundNumber}/enter`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAccessDeniedModal({
          title: `Round ${roundNumber} Access Denied`,
          message: data.message || 'Server rejected entrance request.',
        });
        return;
      }

      if (roundNumber === 1) navigate('/game');
    } catch (err) {
      setAccessDeniedModal({
        title: 'Connection Error',
        message: 'Could not reach backend: ' + err.message,
      });
    } finally {
      setEnteringRound(null);
    }
  };

  // Eligibility stepper
  const isProfileDone   = !!user?.isProfileComplete;
  const isTeamJoined    = teamOverview.hasTeam;
  const isTeamCapacityMet = teamOverview.isTeamReady;
  const isRound1Unlocked  = isProfileDone && isTeamJoined && isTeamCapacityMet;

  const steps = [
    { label: 'Profile Verified',  done: isProfileDone,      status: isProfileDone ? 'COMPLETE' : 'PENDING' },
    { label: 'Team Associated',   done: isTeamJoined,        status: isTeamJoined ? 'COMPLETE' : 'NO TEAM' },
    { label: 'Roster Capacity',   done: isTeamCapacityMet,   status: `${teamOverview.teamSize || 1} / ${teamOverview.minTeamSizeRequired || 3} MEMBERS` },
    { label: 'All Rounds Unlocked', done: isRound1Unlocked,  status: isRound1Unlocked ? 'READY' : 'LOCKED' },
  ];

  return (
    <AppShell>
      {/* ── Error Banner ── */}
      {apiError && (
        <div className="dash-error-banner">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{apiError}</span>
          <button onClick={fetchDashboardData} className="dash-retry-btn">Retry</button>
        </div>
      )}

      {/* ── Welcome Header ── */}
      <section className="dash-welcome">
        <div className="dash-welcome-left">
          <h1 className="dash-welcome-title">
            Welcome back, <span className="dash-name-accent">{user?.profile?.fullName?.split(' ')[0] || user?.name?.split(' ')[0] || 'Participant'}</span> 👋
          </h1>
          <p className="dash-welcome-sub">
            {teamOverview.hasTeam
              ? `You're part of team "${teamOverview.teamName}" · ${teamOverview.teamSize} member(s)`
              : 'Join or create a team to start competing.'}
          </p>
        </div>
        <div className="dash-stat-row">
          <div className="ieee-stat-box">
            <strong>{stats.totalScore || 0}</strong>
            <span>SCORE</span>
          </div>
          <div className="ieee-stat-box">
            <strong>{stats.gamesCompleted || 0}</strong>
            <span>ROUNDS</span>
          </div>
          <div className="ieee-stat-box">
            <strong>{teamOverview.hasTeam ? teamOverview.teamSize : 0}</strong>
            <span>MEMBERS</span>
          </div>
        </div>
      </section>

      {/* ── Event Progress Stepper ── */}
      <section className="ieee-panel">
        <div className="ieee-panel-heading">
          <h2>Event Readiness</h2>
          <span className={`ieee-role-tag${isRound1Unlocked ? ' ready' : ''}`}>
            {isRound1Unlocked ? '✓ READY TO PLAY' : 'SETUP REQUIRED'}
          </span>
        </div>
        <div className="ieee-progress-track">
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div className={`ieee-progress-step${step.done ? ' completed' : ''}`}>
                <span className="ieee-step-number">
                  {step.done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.status}</small>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={`ieee-connector${step.done ? ' complete' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── Quick-Action Cards ── */}
      <section className="dash-quick-actions">
        <button className="dash-action-card" onClick={() => navigate('/profile')}>
          <div className="dash-action-icon">🪪</div>
          <strong>My Profile</strong>
          <small>View &amp; edit your info</small>
        </button>
        <button className="dash-action-card" onClick={() => navigate('/team')}>
          <div className="dash-action-icon">👥</div>
          <strong>My Team</strong>
          <small>{teamOverview.hasTeam ? `Team: ${teamOverview.teamName}` : 'Join or create a team'}</small>
        </button>
        <button className="dash-action-card" onClick={() => navigate('/rounds')}>
          <div className="dash-action-icon">🏆</div>
          <strong>Event Rounds</strong>
          <small>View all rounds &amp; enter</small>
        </button>
        <button className="dash-action-card" onClick={() => navigate('/leaderboard')}>
          <div className="dash-action-icon">📊</div>
          <strong>Leaderboard</strong>
          <small>See team rankings</small>
        </button>
      </section>

      {/* ── Event Rounds Preview ── */}
      <section className="ieee-rounds-section">
        <h2>Event Rounds</h2>
        {loadingRounds ? (
          <div className="dash-loading">
            <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            <span>Loading event rounds...</span>
          </div>
        ) : roundsData.length === 0 ? (
          <div className="dash-empty">No rounds configured yet. Check back soon.</div>
        ) : (
          <div className="ieee-round-grid">
            {roundsData.map((r, index) => {
              const isLocked = r.status === 'Locked' || r.status === 'LOCKED';
              const isAvailable =
                (r.status === 'Available' || r.status === 'AVAILABLE' ||
                  r.status === 'OPEN' || r.isAccessible) && !isLocked;
              const roundNumStr = String(r.roundNumber || index + 1).padStart(2, '0');

              return (
                <article
                  key={r.id || r.roundNumber}
                  className={`ieee-round-card${isAvailable ? ' open' : ''}`}
                >
                  <div className="ieee-round-top">
                    <span className="ieee-round-number">{roundNumStr}</span>
                    {isAvailable
                      ? <span className="ieee-status ieee-open-status">OPEN</span>
                      : <span className="ieee-status"><Lock className="w-3 h-3 inline mr-1" />LOCKED</span>
                    }
                  </div>
                  <h3>{r.title}</h3>
                  <p>{r.description}</p>
                  <div className="ieee-round-meta">
                    <span>TYPE</span>
                    <strong>{r.mechanicType || 'SEQUENTIAL_PUZZLE'}</strong>
                  </div>
                  <div className="ieee-round-bottom">
                    <span>⏱ {Math.floor((r.durationSeconds || 1800) / 60)}M LIMIT</span>
                    {isAvailable && (
                      <button
                        onClick={() => handleEnterRound(r.roundNumber)}
                        disabled={enteringRound === r.roundNumber}
                        className="ieee-enter-btn"
                      >
                        {enteringRound === r.roundNumber
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : 'Enter →'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Access Denied Modal ── */}
      {accessDeniedModal && (
        <div className="ieee-modal-overlay">
          <div className="ieee-modal-box">
            <div className="ieee-modal-icon error">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3>{accessDeniedModal.title}</h3>
            <p className="ieee-modal-msg">{accessDeniedModal.message}</p>
            <button
              onClick={() => setAccessDeniedModal(null)}
              className="ieee-modal-btn"
            >
              Acknowledge &amp; Return
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
