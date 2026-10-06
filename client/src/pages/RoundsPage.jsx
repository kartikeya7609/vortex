import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Lock, Loader2, ShieldAlert, Trophy, Clock } from 'lucide-react';

import { API_BASE_URL, apiFetch } from '../services/api';

const STATUS_STYLES = {
  OPEN:        { label: 'OPEN',        cls: 'ieee-open-status' },
  AVAILABLE:   { label: 'OPEN',        cls: 'ieee-open-status' },
  IN_PROGRESS: { label: 'IN PROGRESS', cls: 'round-status-progress' },
  COMPLETED:   { label: 'COMPLETED',   cls: 'round-status-done' },
  ELIMINATED:  { label: 'ELIMINATED',  cls: 'round-status-elim' },
  LOCKED:      { label: 'LOCKED',      cls: '' },
};

export function RoundsPage() {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [enteringRound, setEnteringRound] = useState(null);
  const [accessDeniedModal, setAccessDeniedModal] = useState(null);

  const fetchRounds = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await apiFetch(`${API_BASE_URL}/rounds/dashboard`);
      const data = await res.json();
      if (res.ok && data.success) setRounds(data.rounds || []);
      else throw new Error(data.message || 'Failed to load rounds');
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRounds(); }, [fetchRounds]);

  const handleEnter = async (roundNumber) => {
    try {
      setEnteringRound(roundNumber);
      const res = await apiFetch(`${API_BASE_URL}/rounds/${roundNumber}/enter`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAccessDeniedModal({ title: `Round ${roundNumber} Access Denied`, message: data.message });
        return;
      }
      if (roundNumber === 1) navigate('/game');
    } catch (err) {
      setAccessDeniedModal({ title: 'Connection Error', message: err.message });
    } finally {
      setEnteringRound(null);
    }
  };

  return (
    <AppShell>
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Event Rounds</h1>
          <p className="page-subtitle">All competitive rounds of AAROhan 2026</p>
        </div>
        <button onClick={fetchRounds} className="ieee-outline-btn">↻ Refresh</button>
      </div>

      {apiError && (
        <div className="dash-error-banner">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{apiError}</span>
          <button onClick={fetchRounds} className="dash-retry-btn">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="dash-loading">
          <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
          <span>Loading rounds…</span>
        </div>
      ) : rounds.length === 0 ? (
        <div className="dash-empty">
          <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p>No rounds configured yet. Check back soon.</p>
        </div>
      ) : (
        <div className="rounds-full-grid">
          {rounds.map((r, index) => {
            const statusKey = (r.status || 'LOCKED').toUpperCase().replace(' ', '_');
            const isLocked = statusKey === 'LOCKED';
            const isAvailable =
              (statusKey === 'OPEN' || statusKey === 'AVAILABLE' || r.isAccessible) && !isLocked;
            const { label, cls } = STATUS_STYLES[statusKey] || { label: r.status, cls: '' };
            const roundNumStr = String(r.roundNumber || index + 1).padStart(2, '0');
            const mins = Math.floor((r.durationSeconds || 1800) / 60);

            return (
              <article
                key={r.id || r.roundNumber}
                className={`rounds-full-card${isAvailable ? ' open' : ''}${isLocked ? ' locked' : ''}`}
              >
                {/* Left accent bar */}
                <div className={`rounds-card-bar${isAvailable ? ' open' : ''}`} />

                <div className="rounds-card-body">
                  <div className="rounds-card-top">
                    <div className="rounds-num-badge">{roundNumStr}</div>
                    <span className={`ieee-status ${cls}`}>
                      {!isAvailable && !['IN_PROGRESS','COMPLETED','ELIMINATED'].includes(statusKey) && (
                        <Lock className="w-3 h-3 inline mr-1" />
                      )}
                      {label}
                    </span>
                  </div>

                  <h3 className="rounds-card-title">{r.title}</h3>
                  <p className="rounds-card-desc">{r.description}</p>

                  <div className="rounds-card-meta">
                    <span className="ieee-round-meta">
                      TYPE <strong>{r.mechanicType || 'SEQUENTIAL_PUZZLE'}</strong>
                    </span>
                    <span className="rounds-time">
                      <Clock className="w-3.5 h-3.5" /> {mins}m limit
                    </span>
                  </div>

                  {/* Score info if completed */}
                  {r.teamScore !== undefined && (
                    <div className="rounds-score-row">
                      <span>Your Score:</span>
                      <strong>{r.teamScore} pts</strong>
                    </div>
                  )}

                  <div className="rounds-card-bottom">
                    {isAvailable ? (
                      <button
                        onClick={() => handleEnter(r.roundNumber)}
                        disabled={enteringRound === r.roundNumber}
                        className="ieee-enter-btn"
                        style={{ width: '100%' }}
                      >
                        {enteringRound === r.roundNumber
                          ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Entering…</>
                          : '▶ Enter Round'}
                      </button>
                    ) : (
                      <div className="rounds-locked-msg">
                        {isLocked
                          ? '🔒 This round is currently locked by administrators.'
                          : `Status: ${label}`}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Access denied modal */}
      {accessDeniedModal && (
        <div className="ieee-modal-overlay">
          <div className="ieee-modal-box">
            <div className="ieee-modal-icon error">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3>{accessDeniedModal.title}</h3>
            <p className="ieee-modal-msg">{accessDeniedModal.message}</p>
            <button onClick={() => setAccessDeniedModal(null)} className="ieee-modal-btn">
              Acknowledge &amp; Return
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
