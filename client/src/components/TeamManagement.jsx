import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  LogOut,
  Search,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Sparkles,
  Crown,
  UserCheck,
  Layers,
} from 'lucide-react';

import { API_BASE_URL, apiFetch } from '../services/api';

export function TeamManagement({ onTeamUpdated }) {
  const { refreshAuth } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [createName, setCreateName] = useState('');
  const [createMaxSize, setCreateMaxSize] = useState('3');
  const [joinCode, setJoinCode] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchMyTeam = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await apiFetch(`${API_BASE_URL}/teams/my-team`);
      const data = await res.json();
      if (res.ok && data.success) {
        setTeam(data.team);
        if (onTeamUpdated) onTeamUpdated(data.team);
      }
    } catch (err) {
      console.warn('[Team Management] Error fetching team:', err.message);
    } finally {
      setLoading(false);
    }
  }, [onTeamUpdated]);

  useEffect(() => {
    fetchMyTeam();
  }, [fetchMyTeam]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!createName.trim()) return setErrorMsg('Team Name is required.');

    try {
      setActionLoading(true);
      const res = await apiFetch(`${API_BASE_URL}/teams/create`, {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim(), maxSize: createMaxSize }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to create team.');

      setSuccessMsg(data.message);
      setTeam(data.team);
      setCreateName('');
      await refreshAuth();
      if (onTeamUpdated) onTeamUpdated(data.team);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLookupTeam = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLookupResult(null);
    if (!joinCode.trim()) return setErrorMsg('Team Code is required.');

    try {
      setLookingUp(true);
      const res = await apiFetch(`${API_BASE_URL}/teams/lookup/${joinCode.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Team lookup failed.');

      setLookupResult(data.team);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLookingUp(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      setActionLoading(true);
      const res = await apiFetch(`${API_BASE_URL}/teams/join`, {
        method: 'POST',
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to join team.');

      setSuccessMsg(data.message);
      setTeam(data.team);
      setJoinCode('');
      setLookupResult(null);
      await refreshAuth();
      if (onTeamUpdated) onTeamUpdated(data.team);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!window.confirm('Are you sure you want to leave your team?')) return;

    try {
      setActionLoading(true);
      setErrorMsg('');
      const res = await apiFetch(`${API_BASE_URL}/teams/leave`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to leave team.');

      setTeam(null);
      setSuccessMsg(data.message);
      await refreshAuth();
      if (onTeamUpdated) onTeamUpdated(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (team?.code) {
      navigator.clipboard.writeText(team.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="dash-loading" style={{ padding: '60px 0' }}>
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        <span>Loading team details…</span>
      </div>
    );
  }

  return (
    <div>
      {/* Feedback Messages */}
      {errorMsg && (
        <div className="dash-error-banner" style={{ marginBottom: 18 }}>
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="dash-retry-btn">Dismiss</button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '12px 18px',
            color: '#6ee7b7',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Case A: User ALREADY HAS A TEAM */}
      {team ? (
        <section className="ieee-panel" style={{ padding: 24 }}>
          {/* Team Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #1e293b', pb: 18, paddingBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                  {team.name}
                </h2>
                <div
                  onClick={copyCodeToClipboard}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(2, 132, 199, 0.15)',
                    border: '1px solid rgba(2, 132, 199, 0.35)',
                    color: '#38bdf8',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  title="Click to copy team join code"
                >
                  <span>CODE: {team.code}</span>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
                Official Registered Team for AAROhan 2026 Competition
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="ieee-role-tag" style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', fontSize: 12, padding: '5px 12px' }}>
                <Users className="w-3.5 h-3.5 inline mr-1" /> {team.memberCount} / {team.maxSize} Members
              </span>
              <button
                onClick={handleLeaveTeam}
                disabled={actionLoading}
                className="dash-retry-btn"
                style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <LogOut className="w-3.5 h-3.5" /> Leave Team
              </button>
            </div>
          </div>

          {/* Team Roster Grid */}
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Team Members ({team.memberCount})
              </h3>
              {team.memberCount < (team.minSizeRequired || 2) && (
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                  ⚠️ Need at least {team.minSizeRequired || 2} members to launch Round 1
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {team.members.map((m) => (
                <div
                  key={m.id || m._id}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    backgroundColor: '#0b111e',
                    border: m.isLeader ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid #1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    position: 'relative',
                  }}
                >
                  <img
                    src={m.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                    alt={m.name}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      objectFit: 'cover',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ fontSize: 13, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.name}
                      </strong>
                      {m.isLeader && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.email || (m.registrationNumber ? `Reg: ${m.registrationNumber}` : 'Member')}
                    </p>
                  </div>
                  {m.isLeader && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: 4,
                        backgroundColor: '#78350f',
                        color: '#fde68a',
                        textTransform: 'uppercase',
                      }}
                    >
                      LEADER
                    </span>
                  )}
                </div>
              ))}

              {/* Slot to Invite / Add member */}
              {team.memberCount < team.maxSize && (
                <div
                  onClick={copyCodeToClipboard}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    border: '1px dashed #334155',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    textAlign: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  title="Click to copy join code"
                >
                  <UserPlus className="w-5 h-5 text-sky-400" />
                  <strong style={{ fontSize: 12, color: '#38bdf8' }}>
                    {copied ? 'Code Copied!' : 'Invite Member'}
                  </strong>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Share Code: <strong>{team.code}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        /* Case B: User DOES NOT HAVE A TEAM -> Sleek Form */
        <section className="ieee-panel" style={{ maxWidth: 640, margin: '0 auto', padding: 28 }}>
          {/* Header & Clean Tab Toggle */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: 'rgba(2, 132, 199, 0.15)',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <Users className="w-6 h-6" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', margin: 0 }}>
              Team Formation &amp; Registration
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Create a new team as leader, or join an existing team with an invite code.
            </p>

            {/* Toggle Tabs */}
            <div
              style={{
                display: 'inline-flex',
                padding: 4,
                backgroundColor: '#0b111e',
                borderRadius: 12,
                border: '1px solid #1e293b',
                marginTop: 18,
              }}
            >
              <button
                type="button"
                onClick={() => { setActiveTab('create'); setErrorMsg(''); setLookupResult(null); }}
                style={{
                  padding: '8px 20px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeTab === 'create' ? '#0284c7' : 'transparent',
                  color: activeTab === 'create' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                Create Team
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('join'); setErrorMsg(''); }}
                style={{
                  padding: '8px 20px',
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: activeTab === 'join' ? '#0284c7' : 'transparent',
                  color: activeTab === 'join' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                Join with Code
              </button>
            </div>
          </div>

          {/* Form: Create Team */}
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 6 }}>
                  Team Name <span style={{ color: '#38bdf8' }}>*</span>
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Quantum Avengers"
                  className="ieee-input"
                  style={{ height: 44, fontSize: 14 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 6 }}>
                  Maximum Team Capacity
                </label>
                <select
                  value={createMaxSize}
                  onChange={(e) => setCreateMaxSize(e.target.value)}
                  className="ieee-input"
                  style={{ height: 44, fontSize: 14 }}
                >
                  <option value="2">2 Members (Duo)</option>
                  <option value="3">3 Members (Standard Default)</option>
                  <option value="4">4 Members (Squad)</option>
                </select>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  You will automatically become the Team Leader upon creation.
                </p>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="ieee-btn"
                style={{
                  height: 46,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Team &amp; Generate Code</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Form: Join Team */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <form onSubmit={handleLookupTeam} style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-char team code (e.g. ARH-9042)"
                  className="ieee-input"
                  style={{ height: 44, fontSize: 14, textTransform: 'uppercase', fontFamily: 'monospace' }}
                  required
                />
                <button
                  type="submit"
                  disabled={lookingUp}
                  className="ieee-btn"
                  style={{ height: 44, padding: '0 18px', shrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Lookup</span>
                </button>
              </form>

              {/* Lookup Card Result */}
              {lookupResult && (
                <div
                  style={{
                    backgroundColor: '#0b111e',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                        {lookupResult.name}
                      </h4>
                      <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                        Leader: <strong style={{ color: '#e2e8f0' }}>{lookupResult.leaderName}</strong>
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 8,
                        backgroundColor: lookupResult.isFull ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: lookupResult.isFull ? '#f87171' : '#34d399',
                      }}
                    >
                      {lookupResult.memberCount} / {lookupResult.maxSize} Members
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                    {lookupResult.isFull
                      ? '⚠️ This team is currently full and cannot accept new members.'
                      : `✓ Space available for ${lookupResult.maxSize - lookupResult.memberCount} more member(s).`}
                  </p>

                  {!lookupResult.isFull && (
                    <button
                      onClick={handleJoinTeam}
                      disabled={actionLoading}
                      className="ieee-btn"
                      style={{ height: 42, fontSize: 13 }}
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Join Team '${lookupResult.name}'`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
