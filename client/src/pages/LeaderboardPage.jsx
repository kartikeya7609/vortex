import React, { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../components/AppShell';
import { Trophy, Loader2, ShieldAlert, Medal, CheckCircle2, Lock, Sparkles, HelpCircle, Flame, Clock } from 'lucide-react';

import { API_BASE_URL, apiFetch } from '../services/api';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

const ROUND_TABS = [
  { round: 1, label: 'Round 1: Tile Puzzle' },
  { round: 2, label: 'Round 2: Mystery Solver' },
];

export function LeaderboardPage() {
  const [selectedRound, setSelectedRound] = useState(1);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [published, setPublished] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [qualifyingCount, setQualifyingCount] = useState(50);
  const [showTieBreakModal, setShowTieBreakModal] = useState(false);

  const fetchLeaderboard = useCallback(async (roundNum) => {
    try {
      setLoading(true);
      setApiError(null);
      const res = await apiFetch(`${API_BASE_URL}/leaderboard?round=${roundNum}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setLeaderboardData(data);
        setEntries(data.entries || data.leaderboard || []);
        setPublished(data.isPublished ?? data.published ?? true);
        setIsFrozen(data.isFrozen || false);
        setQualifyingCount(data.qualifyingCount || 50);
      } else {
        throw new Error(data.message || 'Failed to load leaderboard');
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(selectedRound);
  }, [selectedRound, fetchLeaderboard]);

  const formatTime = (secs) => {
    if (!secs || secs === 0) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <AppShell>
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Leaderboard &amp; Rankings</h1>
          <p className="page-subtitle">Live and official qualified team standings for AAROhan 2026</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowTieBreakModal(true)} className="ieee-outline-btn" style={{ fontSize: 13 }}>
            <HelpCircle className="w-4 h-4 inline mr-1" /> Tie-Break Rules
          </button>
          <button onClick={() => fetchLeaderboard(selectedRound)} className="ieee-outline-btn">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Round Selection Tabs */}
      <div className="dash-quick-tabs" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {ROUND_TABS.map((tab) => (
          <button
            key={tab.round}
            onClick={() => setSelectedRound(tab.round)}
            className={`ieee-round-tab-btn ${selectedRound === tab.round ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              border: selectedRound === tab.round ? '1px solid #38bdf8' : '1px solid #1e293b',
              backgroundColor: selectedRound === tab.round ? 'rgba(14, 165, 233, 0.15)' : '#0f172a',
              color: selectedRound === tab.round ? '#38bdf8' : '#94a3b8',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status Notice Banner */}
      {isFrozen ? (
        <div
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 12,
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock className="w-5 h-5 text-sky-400" />
            <div>
              <span style={{ fontWeight: 700, color: '#93c5fd', fontSize: 14 }}>
                Leaderboard Frozen &amp; Finalized (Round {selectedRound})
              </span>
              <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>
                Official rankings are locked. The top {qualifyingCount} teams have qualified and unlocked Round {selectedRound + 1}.
              </p>
            </div>
          </div>
          <span className="ieee-role-tag" style={{ backgroundColor: '#1e3a8a', color: '#60a5fa' }}>
            OFFICIAL
          </span>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Flame className="w-4 h-4 text-emerald-400" />
          <span style={{ fontSize: 13, color: '#6ee7b7' }}>
            <strong>Live Round Rankings:</strong> Results update in real-time as teams solve challenges. Top {qualifyingCount} teams qualify upon round freeze.
          </span>
        </div>
      )}

      {apiError && (
        <div className="dash-error-banner">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{apiError}</span>
          <button onClick={() => fetchLeaderboard(selectedRound)} className="dash-retry-btn">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="dash-loading">
          <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
          <span>Loading Round {selectedRound} leaderboard…</span>
        </div>
      ) : !published ? (
        <div className="dash-empty">
          <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 12px rgba(251,191,36,0.5))' }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
            Round {selectedRound} Leaderboard Not Published Yet
          </p>
          <p style={{ color: '#64748b', fontSize: 13 }}>Results will appear here once administrators publish this round’s standings.</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="dash-empty">No team activity recorded for Round {selectedRound} yet.</div>
      ) : (
        <>
          {/* Top-3 podium */}
          <div className="lb-podium">
            {entries.slice(0, 3).map((entry, i) => (
              <div
                key={entry.teamId || entry.teamName || i}
                className={`lb-podium-card rank-${i + 1}`}
              >
                <div className="lb-medal" style={{ color: MEDAL_COLORS[i] }}>
                  <Medal className="w-6 h-6" />
                </div>
                <div className="lb-podium-rank">#{entry.rank || i + 1}</div>
                <div className="lb-podium-name">{entry.teamName || 'Unknown Team'}</div>
                <div className="lb-podium-score">{entry.totalScore ?? entry.score ?? 0}</div>
                <div className="lb-podium-label">POINTS</div>
                {entry.isQualified && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#34d399',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> QUALIFIED
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Full rankings table */}
          <section className="ieee-panel" style={{ marginTop: 24 }}>
            <div className="ieee-panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Round {selectedRound} Standings</h2>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                  Ranked by Puzzles Solved &rarr; Total Score &rarr; Time Taken &rarr; Final Solve Timestamp
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="ieee-role-tag">{entries.length} EVALUATED TEAMS</span>
                <span className="ieee-role-tag" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                  TOP {qualifyingCount} QUALIFY
                </span>
              </div>
            </div>

            <div className="lb-table">
              <div className="lb-table-head" style={{ gridTemplateColumns: '70px 2.5fr 1fr 1fr 1fr 1.2fr' }}>
                <span>Rank</span>
                <span>Team Name</span>
                <span>Puzzles Solved</span>
                <span>Time Taken</span>
                <span>Total Score</span>
                <span>Qualification Status</span>
              </div>

              {entries.map((entry, i) => {
                const isQualifyingCutoff = entry.rank === qualifyingCount;
                const isTopRanked = entry.rank <= qualifyingCount;

                return (
                  <React.Fragment key={entry.teamId || entry.teamName || i}>
                    <div
                      className={`lb-table-row${entry.isMyTeam ? ' my-team' : ''}`}
                      style={{
                        gridTemplateColumns: '70px 2.5fr 1fr 1fr 1fr 1.2fr',
                        backgroundColor: entry.isMyTeam ? 'rgba(56, 189, 248, 0.08)' : undefined,
                      }}
                    >
                      <span className="lb-rank">
                        {entry.rank <= 3 ? (
                          <span style={{ color: MEDAL_COLORS[entry.rank - 1], fontWeight: 900 }}>#{entry.rank}</span>
                        ) : (
                          `#${entry.rank}`
                        )}
                      </span>

                      <span className="lb-team-name">
                        <strong>{entry.teamName || '—'}</strong>
                        {entry.teamCode && <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>({entry.teamCode})</span>}
                        {entry.isMyTeam && <span className="lb-my-badge">YOU</span>}
                        {entry.isManualOverride && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              backgroundColor: '#4c1d95',
                              color: '#c4b5fd',
                              marginLeft: 6,
                            }}
                          >
                            OVERRIDE
                          </span>
                        )}
                      </span>

                      <span style={{ color: '#e2e8f0' }}>
                        {entry.puzzlesCompleted !== undefined ? `${entry.puzzlesCompleted} solved` : '—'}
                      </span>

                      <span style={{ color: '#94a3b8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {formatTime(entry.completionTimeSeconds)}
                      </span>

                      <span className="lb-score">
                        {entry.totalScore ?? entry.score ?? 0} <span style={{ fontSize: 11, color: '#64748b' }}>pts</span>
                      </span>

                      <span>
                        {entry.isQualified ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              color: '#34d399',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Qualified for R{selectedRound + 1}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: '#94a3b8',
                              backgroundColor: 'rgba(148, 163, 184, 0.1)',
                              padding: '3px 8px',
                              borderRadius: 6,
                            }}
                          >
                            Eliminated / Pending
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Cutoff visual separator line */}
                    {isQualifyingCutoff && (
                      <div
                        style={{
                          margin: '8px 0',
                          padding: '6px 16px',
                          backgroundColor: 'rgba(234, 179, 8, 0.08)',
                          borderLeft: '4px solid #eab308',
                          borderRight: '1px solid rgba(234, 179, 8, 0.2)',
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#fde047',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>▲ QUALIFICATION CUTOFF (TOP {qualifyingCount} TEAMS)</span>
                        <span style={{ fontSize: 11, fontWeight: 400, color: '#fef08a' }}>
                          Teams above this line advance to Round {selectedRound + 1}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Tie-Break Rules Explanation Modal */}
      {showTieBreakModal && (
        <div className="ieee-modal-overlay">
          <div className="ieee-modal-box" style={{ maxWidth: 520, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Sparkles className="w-6 h-6 text-sky-400" />
              <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>AAROhan Ranking &amp; Tie-Break Rules</h3>
            </div>

            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 14 }}>
              Teams are automatically ranked according to the strict multi-factor criteria configured by event administrators:
            </p>

            <ol style={{ paddingLeft: 20, fontSize: 13, color: '#e2e8f0', lineHeight: 1.8, marginBottom: 16 }}>
              <li>
                <strong>1. Number of Puzzles Completed (DESC):</strong> Teams solving more challenges place higher.
              </li>
              <li>
                <strong>2. Total Score (DESC):</strong> Higher accumulated points break ties among equal puzzle counts.
              </li>
              <li>
                <strong>3. Total Completion Time (ASC):</strong> Faster overall completion time takes precedence.
              </li>
              <li>
                <strong>4. Final Puzzle Completion Timestamp (ASC):</strong> Teams that solved their final challenge earlier in the competition window rank higher.
              </li>
            </ol>

            <div
              style={{
                backgroundColor: '#0b1329',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #1e293b',
                fontSize: 12,
                color: '#94a3b8',
                marginBottom: 20,
              }}
            >
              <strong>Qualification Rule:</strong> The top {qualifyingCount} teams qualify for subsequent rounds upon leaderboard freeze. All registered members of a qualifying team inherit qualification.
            </div>

            <button onClick={() => setShowTieBreakModal(false)} className="ieee-modal-btn" style={{ width: '100%' }}>
              Got It
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
