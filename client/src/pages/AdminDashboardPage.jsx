import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { getSocket } from '../services/socket';
import { API_BASE_URL, apiFetch } from '../services/api';
import {
  ShieldCheck, Search, RefreshCw, Trash2, Edit3, X, Users, Layers, GripVertical, Plus,
  Lock, Unlock, Play, CheckCircle2, Award, SlidersHorizontal, Clock, AlertCircle, Grid,
  Radio, Flame, UserCheck, CheckCheck, HelpCircle, Mail, FileText, UserPlus, Download,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Eye, EyeOff, Trophy,
  WifiOff, Wifi, Info,
} from 'lucide-react';

/* ============================================================================
   CONSTANTS & HELPERS
   ============================================================================ */

const PRIMARY_ADMINS = ['sankasatyaavinash2034@gmail.com', 'kartikeyakk2007@gmail.com'];
const ADMIN_ROLES = ['admin', 'super_admin'];
const ROLE_OPTIONS = ['participant', 'team_leader', 'admin', 'super_admin'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIE_BREAK_LABELS = {
  puzzlesCompleted: 'Puzzles solved (most first)',
  totalScore: 'Total score (highest first)',
  completionTime: 'Completion time (fastest first)',
  finalPuzzleTimestamp: 'Last solve time (earliest first)',
};

const STATUS_TONE = { LOCKED: 'red', AVAILABLE: 'green', IN_PROGRESS: 'blue', COMPLETED: 'purple' };

const EMPTY_LIVE = {
  timestamp: null,
  totalRegisteredUsers: 0,
  onlineCount: 0,
  onlineUsers: [],
  totalTeams: 0,
  activeRound1PlayingCount: 0,
  playingTeams: [],
  completedTeamsCount: 0,
  completedTeams: [],
  liveLeaderboard: [],
};

const normalizeLive = (d = {}) => ({
  ...EMPTY_LIVE,
  ...d,
  onlineUsers: Array.isArray(d.onlineUsers) ? d.onlineUsers : [],
  playingTeams: Array.isArray(d.playingTeams) ? d.playingTeams : [],
  completedTeams: Array.isArray(d.completedTeams) ? d.completedTeams : [],
  liveLeaderboard: Array.isArray(d.liveLeaderboard) ? d.liveLeaderboard : [],
  onlineCount: Number(d.onlineCount) || 0,
  totalRegisteredUsers: Number(d.totalRegisteredUsers) || 0,
  totalTeams: Number(d.totalTeams) || 0,
  activeRound1PlayingCount: Number(d.activeRound1PlayingCount) || 0,
  completedTeamsCount: Number(d.completedTeamsCount) || 0,
});

async function request(path, options) {
  const res = await apiFetch(`${API_BASE_URL}${path}`, options);
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok || (data && data.success === false)) {
    throw new Error((data && data.message) || `Request failed (${res.status})`);
  }
  return data || {};
}
const send = (method, body) => ({ method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

const lc = (v) => String(v ?? '').toLowerCase();

const formatClock = (secs) => {
  const n = Number(secs);
  if (!Number.isFinite(n)) return '00:00';
  const t = Math.max(0, Math.floor(n));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const formatDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

function downloadCsv(filename, rows) {
  const esc = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function usePagination(items, size, resetKey) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.min(page, totalPages);
  return { page: safe, setPage, totalPages, total: items.length, pageItems: items.slice((safe - 1) * size, safe * size) };
}

/* ============================================================================
   SMALL UI PIECES
   ============================================================================ */

function Badge({ tone = 'gray', children }) {
  return <span className={`adm-badge ${tone}`}>{children}</span>;
}

function Empty({ icon: Icon = Info, title, hint, action }) {
  return (
    <div className="adm-empty">
      <Icon size={26} />
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}

function Pager({ pg }) {
  if (pg.total === 0 || pg.totalPages <= 1) return null;
  return (
    <div className="adm-pager">
      <span>Page {pg.page} of {pg.totalPages} · {pg.total} records</span>
      <div>
        <button className="adm-icon-btn" disabled={pg.page <= 1} onClick={() => pg.setPage(pg.page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
        <button className="adm-icon-btn" disabled={pg.page >= pg.totalPages} onClick={() => pg.setPage(pg.page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Modal({ title, subtitle, onClose, children, footer, width = 520 }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="adm-overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-modal" style={{ maxWidth: width }}>
        <div className="adm-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
        </div>
        <div className="adm-modal-body">{children}</div>
        {footer && <div className="adm-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function ConfirmDialog({ state, onClose }) {
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const run = async () => {
    setBusy(true);
    try { await state.onConfirm(); } finally { setBusy(false); onClose(); }
  };
  return (
    <Modal
      title={state.title}
      onClose={busy ? () => { } : onClose}
      width={440}
      footer={(
        <>
          <button className="adm-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`adm-btn ${state.danger ? 'danger-solid' : 'primary'}`} onClick={run} disabled={busy}>
            {busy ? 'Working…' : state.confirmLabel || 'Confirm'}
          </button>
        </>
      )}
    >
      <p className="adm-confirm-text">{state.message}</p>
    </Modal>
  );
}

function Toasts({ toasts, dismiss }) {
  return (
    <div className="adm-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`adm-toast ${t.type}`}>
          {t.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{t.msg}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, suffix, icon: Icon, tone }) {
  return (
    <div className={`adm-kpi ${tone}`}>
      <div className="adm-kpi-top"><span>{label}</span><Icon size={16} /></div>
      <div className="adm-kpi-val">{value}{suffix && <small>{suffix}</small>}</div>
    </div>
  );
}

function SkeletonRows({ rows = 5 }) {
  return (
    <div className="adm-skel-wrap">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="adm-skel" />)}
    </div>
  );
}

/* ============================================================================
   MAIN PAGE
   ============================================================================ */

export function AdminDashboardPage() {
  const { user } = useAuth();
  const selfEmail = lc(user?.email);
  const selfId = String(user?._id || user?.id || '');

  const [activeTab, setActiveTab] = useState('live_monitor');
  const [searchQuery, setSearchQuery] = useState('');

  // Server data
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [puzzles, setPuzzles] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState({ isFrozen: false, isPublished: true });
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [whitelistEmails, setWhitelistEmails] = useState([]);
  const [faqsList, setFaqsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastSynced, setLastSynced] = useState(null);

  // Feedback
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const toastTimers = useRef(new Map());

  // Live monitor
  const [socketConnected, setSocketConnected] = useState(false);
  const [liveState, setLiveState] = useState(EMPTY_LIVE);
  const [liveAt, setLiveAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [liveEventLogs, setLiveEventLogs] = useState([]);

  // Whitelist
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdminEmail, setAddingAdminEmail] = useState(false);

  // FAQs
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [faqForm, setFaqForm] = useState({ category: 'General', question: '', answer: '' });

  // Rounds
  const [isCreateRoundOpen, setIsCreateRoundOpen] = useState(false);
  const [newRoundForm, setNewRoundForm] = useState({ roundNumber: 2, title: '', description: '', durationMinutes: 30, minTeamSize: 2, mechanicType: 'quiz', status: 'LOCKED' });
  const [editingRound, setEditingRound] = useState(null);
  const [roundForm, setRoundForm] = useState({ title: '', description: '', durationMinutes: 30, minTeamSize: 2, mechanicType: 'puzzle' });

  // Puzzles
  const [selectedPuzzleRound, setSelectedPuzzleRound] = useState(1);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isPuzzleModalOpen, setIsPuzzleModalOpen] = useState(false);
  const [editingPuzzle, setEditingPuzzle] = useState(null);
  const [selectedPuzzleFile, setSelectedPuzzleFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [generatedPuzzle, setGeneratedPuzzle] = useState(null);
  const [puzzleForm, setPuzzleForm] = useState({ title: '', description: '', gridRows: 3, gridCols: 3, points: 100, timeLimitSeconds: 300, hint: '' });
  const [draggedPuzzleIndex, setDraggedPuzzleIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Teams
  const [editingTeam, setEditingTeam] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', maxSize: 3, minSize: 2, bypass: false });
  const [adjustScoreModal, setAdjustScoreModal] = useState(null);

  // Audit
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [viewingAudit, setViewingAudit] = useState(null);

  // Ranking
  const [selectedRankingRound, setSelectedRankingRound] = useState(1);
  const [qualifyingLimit, setQualifyingLimit] = useState(50);
  const [tieBreakOrder, setTieBreakOrder] = useState(['puzzlesCompleted', 'totalScore', 'completionTime', 'finalPuzzleTimestamp']);
  const [rankingPreview, setRankingPreview] = useState(null);
  const [loadingRankingPreview, setLoadingRankingPreview] = useState(false);
  const [manualUnlockModal, setManualUnlockModal] = useState(null);

  /* ----------------------------- feedback ----------------------------- */

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) { clearTimeout(timer); toastTimers.current.delete(id); }
  }, []);

  const notify = useCallback((msg, type = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-3), { id, msg, type }]);
    toastTimers.current.set(id, setTimeout(() => dismissToast(id), type === 'error' ? 6000 : 3500));
  }, [dismissToast]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => { timers.forEach((t) => clearTimeout(t)); timers.clear(); };
  }, []);

  const askConfirm = useCallback((cfg) => setConfirmState(cfg), []);

  /* ----------------------------- data loading ----------------------------- */

  const reqCounter = useRef(0);

  const fetchAllAdminData = useCallback(async (silent = false) => {
    const reqId = ++reqCounter.current;
    if (!silent) setLoading(true);

    const endpoints = [
      ['stats', '/admin/dashboard-stats'],
      ['users', '/admin/users'],
      ['teams', '/admin/teams-mgmt/teams'],
      ['puzzles', '/admin/mgmt/puzzles'],
      ['rounds', '/admin/mgmt/rounds'],
      ['leaderboard', '/admin/mgmt/leaderboard/status'],
      ['audit', '/admin/mgmt/audit-logs'],
      ['whitelist', '/admin/mgmt/whitelist'],
      ['faqs', '/help'],
    ];
    const results = await Promise.allSettled(endpoints.map(([, p]) => request(p)));
    if (reqId !== reqCounter.current) return; // a newer request superseded this one

    const failed = [];
    results.forEach((r, i) => {
      const key = endpoints[i][0];
      if (r.status === 'rejected') { failed.push(key); return; }
      const d = r.value;
      switch (key) {
        case 'stats': setStats(d.stats || null); break;
        case 'users': setUsers(d.users || []); break;
        case 'teams': setTeams(d.teams || []); break;
        case 'puzzles': setPuzzles(d.puzzles || []); break;
        case 'rounds': setRounds(d.rounds || []); break;
        case 'leaderboard': setLeaderboardStatus(d.leaderboard || { isFrozen: false, isPublished: true }); break;
        case 'audit': setAuditLogs(d.logs || []); break;
        case 'whitelist': setWhitelistEmails(d.emails || []); break;
        case 'faqs': setFaqsList(d.data?.faqs || []); break;
        default: break;
      }
    });
    setLoadError(failed.length ? `Could not load: ${failed.join(', ')}. Showing the last data we had.` : '');
    setLastSynced(new Date());
    setLoading(false);
  }, []);

  const refreshTimer = useRef(null);
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => fetchAllAdminData(true), 500);
  }, [fetchAllAdminData]);

  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  // Runs an API mutation, reports the result and quietly refreshes.
  const mutate = useCallback(async (fn, okMsg) => {
    try {
      const d = await fn();
      notify(okMsg || d?.message || 'Saved');
      fetchAllAdminData(true);
      return d || {};
    } catch (err) {
      notify(err.message || 'Something went wrong', 'error');
      return null;
    }
  }, [notify, fetchAllAdminData]);

  /* ----------------------------- sockets ----------------------------- */

  useEffect(() => {
    fetchAllAdminData();
    const socket = getSocket();
    if (!socket) return undefined;

    const requestState = () => socket.emit('admin:request_state');
    const onConnect = () => { setSocketConnected(true); requestState(); };
    const onDisconnect = () => setSocketConnected(false);
    const onLiveState = (d) => { setLiveState(normalizeLive(d)); setLiveAt(Date.now()); };
    const onPresence = (d) => setLiveState((prev) => ({
      ...prev,
      onlineCount: Number(d?.onlineCount) || 0,
      onlineUsers: Array.isArray(d?.onlineUsers) ? d.onlineUsers : [],
    }));
    const onGameEvent = (evt) => setLiveEventLogs((prev) => [
      { id: `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...evt, receivedAt: new Date().toLocaleTimeString() },
      ...prev.slice(0, 49),
    ]);

    if (socket.connected) { setSocketConnected(true); requestState(); }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('admin:live_state', onLiveState);
    socket.on('admin:presence_update', onPresence);
    socket.on('admin:game_event', onGameEvent);
    socket.on('admin:leaderboard_changed', scheduleRefresh);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('admin:live_state', onLiveState);
      socket.off('admin:presence_update', onPresence);
      socket.off('admin:game_event', onGameEvent);
      socket.off('admin:leaderboard_changed', scheduleRefresh);
    };
  }, [fetchAllAdminData, scheduleRefresh]);

  // Tick once a second on the live tab so timers move between server pushes.
  useEffect(() => {
    if (activeTab !== 'live_monitor') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeTab]);

  // Local preview of the chosen puzzle image (released when it changes).
  useEffect(() => {
    if (!selectedPuzzleFile) { setPreviewUrl(''); return undefined; }
    const url = URL.createObjectURL(selectedPuzzleFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedPuzzleFile]);

  // Keep chosen round numbers valid when rounds change.
  const roundNumbers = useMemo(
    () => (rounds.length ? [...rounds].map((r) => r.roundNumber).sort((a, b) => a - b) : [1]),
    [rounds],
  );
  useEffect(() => {
    if (!roundNumbers.includes(selectedPuzzleRound)) setSelectedPuzzleRound(roundNumbers[0]);
    if (!roundNumbers.includes(selectedRankingRound)) setSelectedRankingRound(roundNumbers[0]);
  }, [roundNumbers, selectedPuzzleRound, selectedRankingRound]);

  /* ----------------------------- derived lists ----------------------------- */

  const q = lc(searchQuery.trim());

  const filteredUsers = useMemo(() => users.filter((u) =>
    !q || lc(u.name).includes(q) || lc(u.email).includes(q) || lc(u.teamName).includes(q) || lc(u.profile?.registrationNumber).includes(q)), [users, q]);

  const filteredTeams = useMemo(() => teams.filter((t) => !q || lc(t.name).includes(q) || lc(t.code).includes(q)), [teams, q]);

  const roundPuzzles = useMemo(() => puzzles
    .filter((p) => p.roundNumber === selectedPuzzleRound)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)), [puzzles, selectedPuzzleRound]);

  const filteredPuzzles = useMemo(() => roundPuzzles.filter((p) =>
    !q || lc(p.title).includes(q) || lc(p.solution).includes(q)), [roundPuzzles, q]);

  const auditActions = useMemo(() => ['all', ...Array.from(new Set(auditLogs.map((l) => l.action).filter(Boolean)))], [auditLogs]);

  const filteredAuditLogs = useMemo(() => auditLogs.filter((l) =>
    (auditActionFilter === 'all' || l.action === auditActionFilter)
    && (!q || lc(l.adminEmail).includes(q) || lc(l.action).includes(q) || lc(l.targetName).includes(q))), [auditLogs, q, auditActionFilter]);

  const filteredFaqs = useMemo(() => faqsList.filter((f) =>
    !q || lc(f.question || f.q).includes(q) || lc(f.answer || f.a).includes(q) || lc(f.category).includes(q)), [faqsList, q]);

  const usersPg = usePagination(filteredUsers, 12, q);
  const teamsPg = usePagination(filteredTeams, 12, q);
  const auditPg = usePagination(filteredAuditLogs, 15, `${q}|${auditActionFilter}`);

  const reorderEnabled = !q;
  const nextRoundNumber = (rounds.reduce((m, r) => Math.max(m, r.roundNumber || 0), 0) || 0) + 1;

  /* ----------------------------- user handlers ----------------------------- */

  const applyRole = (target, role) => mutate(
    () => request(`/admin/users/${target._id}/role`, send('PATCH', { role })),
    `${target.name || target.email} is now ${role}`,
  );

  const handleRoleChange = (target, role) => {
    if (role === target.role) return;
    if (ADMIN_ROLES.includes(role) || ADMIN_ROLES.includes(target.role)) {
      askConfirm({
        title: 'Change administrator access',
        message: `Set ${target.name || target.email} to "${role}"? This changes what they can see and edit in the console.`,
        confirmLabel: 'Change role',
        danger: ADMIN_ROLES.includes(target.role) && !ADMIN_ROLES.includes(role),
        onConfirm: () => applyRole(target, role),
      });
    } else {
      applyRole(target, role);
    }
  };

  /* ----------------------------- team handlers ----------------------------- */

  const openEditTeam = (t) => {
    setEditingTeam(t);
    setTeamForm({ name: t.name || '', maxSize: t.maxSize || 3, minSize: t.minSizeRequired || 2, bypass: t.allowAdminBypass === true });
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;
    const maxSize = parseInt(teamForm.maxSize, 10);
    const minSize = parseInt(teamForm.minSize, 10);
    if (!teamForm.name.trim()) return notify('Enter a team name.', 'error');
    if (!(minSize >= 1) || !(maxSize >= 1)) return notify('Team sizes must be at least 1.', 'error');
    if (minSize > maxSize) return notify('Minimum size cannot be larger than maximum size.', 'error');
    const ok = await mutate(
      () => request(`/admin/teams-mgmt/teams/${editingTeam._id}`, send('PUT', {
        name: teamForm.name.trim(), maxSize, minSizeRequired: minSize, allowAdminBypass: teamForm.bypass,
      })),
      `Updated team "${teamForm.name.trim()}"`,
    );
    if (ok) setEditingTeam(null);
  };

  const handleResetTeamSession = (teamId, teamName) => askConfirm({
    title: 'Reset game session',
    message: `Reset the active session for "${teamName}"? Their current progress will be cleared.`,
    confirmLabel: 'Reset session',
    danger: true,
    onConfirm: () => mutate(() => request(`/admin/mgmt/teams/${teamId}/reset-session`, send('POST')), `Session reset for "${teamName}"`),
  });

  const handleAdjustScore = async (e) => {
    e.preventDefault();
    const m = adjustScoreModal;
    if (!m) return;
    const delta = Number(m.scoreDelta);
    if (!Number.isFinite(delta) || delta === 0) return notify('Enter a score change other than 0.', 'error');
    if (!m.reason.trim()) return notify('Add a reason so the audit trail makes sense.', 'error');
    const ok = await mutate(
      () => request(`/admin/mgmt/teams/${m.teamId}/adjust-score`, send('POST', { roundNumber: Number(m.roundNumber), scoreDelta: delta, reason: m.reason.trim() })),
      `Adjusted score for "${m.teamName}" by ${delta > 0 ? '+' : ''}${delta}`,
    );
    if (ok) setAdjustScoreModal(null);
  };

  /* ----------------------------- puzzle handlers ----------------------------- */

  const openCreatePuzzle = () => {
    setEditingPuzzle(null);
    setPuzzleForm({ title: '', description: '', gridRows: 3, gridCols: 3, points: 100, timeLimitSeconds: 300, hint: '' });
    setSelectedPuzzleFile(null);
    setGeneratedPuzzle(null);
    setIsPuzzleModalOpen(true);
  };

  const openEditPuzzle = (p) => {
    setEditingPuzzle(p);
    setPuzzleForm({
      title: p.title || '', description: p.description || '', gridRows: p.gridRows || 3, gridCols: p.gridCols || 3,
      points: p.points ?? 100, timeLimitSeconds: p.timeLimitSeconds ?? 300, hint: p.hint || '',
    });
    setSelectedPuzzleFile(null);
    setGeneratedPuzzle(p);
    setIsPuzzleModalOpen(true);
  };

  const handlePickFile = (e) => {
    const file = e.target.files?.[0] || null;
    if (file && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      notify('Use a JPEG, PNG or WebP image.', 'error');
      e.target.value = '';
      return;
    }
    if (file && file.size > MAX_IMAGE_BYTES) {
      notify('That image is over 5 MB. Choose a smaller file.', 'error');
      e.target.value = '';
      return;
    }
    setSelectedPuzzleFile(file);
    setGeneratedPuzzle(null);
  };

  const handleGeneratePuzzle = async () => {
    const rows = Number(puzzleForm.gridRows);
    const cols = Number(puzzleForm.gridCols);
    if (!selectedPuzzleFile) return notify('Choose an original image first.', 'error');
    if (!puzzleForm.title.trim()) return notify('Enter a puzzle name first.', 'error');
    if (![rows, cols].every((n) => Number.isInteger(n) && n >= 2 && n <= 8)) return notify('Rows and columns must be whole numbers from 2 to 8.', 'error');
    try {
      setUploadingImage(true);
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('The selected image could not be read.'));
        reader.readAsDataURL(selectedPuzzleFile);
      });
      const data = await request('/admin/mgmt/puzzles/upload-and-process', send('POST', {
        title: puzzleForm.title.trim(), description: puzzleForm.description, roundNumber: selectedPuzzleRound,
        gridRows: rows, gridCols: cols, points: puzzleForm.points, timeLimitSeconds: puzzleForm.timeLimitSeconds, hint: puzzleForm.hint,
        image, mimeType: selectedPuzzleFile.type, sizeBytes: selectedPuzzleFile.size,
      }));
      if (!data || !data.puzzle) {
        throw new Error((data && data.message) || 'Image generation failed: Server did not return puzzle data.');
      }
      setGeneratedPuzzle(data.puzzle);
      setPuzzleForm((old) => ({ ...old, imageUrl: data.puzzle.imageUrl || old.imageUrl }));
      notify('Pieces generated and saved as a draft. Check them, then save or publish.');
      fetchAllAdminData(true);
    } catch (err) {
      notify(err.message || 'Image generation failed.', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSavePuzzle = async (e) => {
    e.preventDefault();
    let target = editingPuzzle || generatedPuzzle;

    // Auto-generate pieces if new puzzle creation with selected file
    if (!target && selectedPuzzleFile) {
      const rows = Number(puzzleForm.gridRows);
      const cols = Number(puzzleForm.gridCols);
      if (!puzzleForm.title.trim()) return notify('Enter a puzzle name first.', 'error');
      if (![rows, cols].every((n) => Number.isInteger(n) && n >= 2 && n <= 8)) return notify('Rows and columns must be whole numbers from 2 to 8.', 'error');
      try {
        setUploadingImage(true);
        const image = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('The selected image could not be read.'));
          reader.readAsDataURL(selectedPuzzleFile);
        });
        const data = await request('/admin/mgmt/puzzles/upload-and-process', send('POST', {
          title: puzzleForm.title.trim(), description: puzzleForm.description, roundNumber: selectedPuzzleRound,
          gridRows: rows, gridCols: cols, points: puzzleForm.points, timeLimitSeconds: puzzleForm.timeLimitSeconds, hint: puzzleForm.hint,
          image, mimeType: selectedPuzzleFile.type, sizeBytes: selectedPuzzleFile.size,
        }));
        if (!data || !data.puzzle) {
          throw new Error((data && data.message) || 'Image generation failed.');
        }
        target = data.puzzle;
        setGeneratedPuzzle(target);
      } catch (err) {
        notify(err.message || 'Image generation failed.', 'error');
        setUploadingImage(false);
        return;
      } finally {
        setUploadingImage(false);
      }
    }

    if (!target) return notify('Choose an original image and generate pieces before saving.', 'error');
    if (!puzzleForm.title.trim()) return notify('Enter a puzzle name.', 'error');
    const ok = await mutate(
      () => request(`/admin/mgmt/puzzles/${target._id}`, send('PUT', {
        title: puzzleForm.title.trim(), description: puzzleForm.description, points: Number(puzzleForm.points),
        timeLimitSeconds: Number(puzzleForm.timeLimitSeconds), hint: puzzleForm.hint, displayOrder: target.displayOrder,
      })),
      editingPuzzle ? 'Puzzle updated' : 'Puzzle saved',
    );
    if (ok) setIsPuzzleModalOpen(false);
  };

  const handleDeletePuzzle = (p) => askConfirm({
    title: 'Delete puzzle',
    message: `Delete "${p.title}"? This cannot be undone.`,
    confirmLabel: 'Delete puzzle',
    danger: true,
    onConfirm: () => mutate(() => request(`/admin/mgmt/puzzles/${p._id}`, send('DELETE')), `Deleted "${p.title}"`),
  });

  const handleTogglePublish = async (p) => {
    const next = !p.isPublished;
    const res = await mutate(
      () => request(`/admin/mgmt/puzzles/${p._id}/publish`, send('PATCH', { isPublished: next })),
      `"${p.title}" ${next ? 'published' : 'moved to draft'}`,
    );
    if (res && generatedPuzzle && String(generatedPuzzle._id) === String(p._id) && res.puzzle) setGeneratedPuzzle(res.puzzle);
  };

  const persistOrder = async (reordered, okMsg) => {
    const orders = reordered.map((p, i) => ({ id: p._id, displayOrder: i + 1 }));
    const orderMap = new Map(orders.map((o) => [String(o.id), o.displayOrder]));
    setPuzzles((prev) => prev.map((p) => (orderMap.has(String(p._id)) ? { ...p, displayOrder: orderMap.get(String(p._id)) } : p))); // optimistic
    try {
      await request('/admin/mgmt/puzzles/reorder', send('POST', { orders }));
      notify(okMsg);
    } catch (err) {
      notify(err.message, 'error');
    }
    fetchAllAdminData(true);
  };

  const moveItem = (from, to) => {
    if (!reorderEnabled || from === to || to < 0 || to >= roundPuzzles.length) return;
    const next = [...roundPuzzles];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next, 'Puzzle order updated');
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const from = draggedPuzzleIndex;
    setDraggedPuzzleIndex(null);
    setDragOverIndex(null);
    if (from === null) return;
    moveItem(from, dropIndex);
  };

  /* ----------------------------- round handlers ----------------------------- */

  const applyRoundStatus = (r, status) => mutate(
    () => request(`/admin/mgmt/rounds/${r.roundNumber}/status`, send('PATCH', { status })),
    `Round ${r.roundNumber} is now ${status.replace('_', ' ').toLowerCase()}`,
  );

  const handleRoundStatus = (r, status) => {
    if (r.status === status) return;
    if (status === 'LOCKED' || status === 'COMPLETED') {
      askConfirm({
        title: status === 'LOCKED' ? `Lock round ${r.roundNumber}` : `Close round ${r.roundNumber}`,
        message: status === 'LOCKED'
          ? 'Participants will no longer be able to enter this round.'
          : 'This marks the round as finished for everyone.',
        confirmLabel: status === 'LOCKED' ? 'Lock round' : 'Close round',
        danger: true,
        onConfirm: () => applyRoundStatus(r, status),
      });
    } else {
      applyRoundStatus(r, status);
    }
  };

  const openEditRound = (r) => {
    setEditingRound(r);
    setRoundForm({
      title: r.title || '', description: r.description || '',
      durationMinutes: Math.max(1, Math.round((r.durationSeconds || 1800) / 60)),
      minTeamSize: r.minTeamSize || 2, mechanicType: r.mechanicType || 'puzzle',
    });
  };

  const handleSaveRound = async (e) => {
    e.preventDefault();
    if (!editingRound) return;
    const mins = parseInt(roundForm.durationMinutes, 10);
    const minTeam = parseInt(roundForm.minTeamSize, 10);
    if (!roundForm.title.trim()) return notify('Enter a round title.', 'error');
    if (!(mins >= 1) || !(minTeam >= 1)) return notify('Duration and team size must be at least 1.', 'error');
    const ok = await mutate(
      () => request(`/admin/mgmt/rounds/${editingRound.roundNumber}/config`, send('PUT', {
        title: roundForm.title.trim(), description: roundForm.description,
        durationSeconds: mins * 60, minTeamSize: minTeam, mechanicType: roundForm.mechanicType,
      })),
      `Round ${editingRound.roundNumber} updated`,
    );
    if (ok) setEditingRound(null);
  };

  const openCreateRound = () => {
    setNewRoundForm({ roundNumber: nextRoundNumber, title: '', description: '', durationMinutes: 30, minTeamSize: 2, mechanicType: 'quiz', status: 'LOCKED' });
    setIsCreateRoundOpen(true);
  };

  const handleCreateRound = async (e) => {
    e.preventDefault();
    if (rounds.some((r) => r.roundNumber === newRoundForm.roundNumber)) return notify(`Round ${newRoundForm.roundNumber} already exists.`, 'error');
    if (!newRoundForm.title.trim()) return notify('Enter a round title.', 'error');
    const ok = await mutate(
      () => request('/admin/mgmt/rounds', send('POST', { ...newRoundForm, title: newRoundForm.title.trim() })),
      'New round created',
    );
    if (ok) setIsCreateRoundOpen(false);
  };

  const handleDeleteRound = (r) => askConfirm({
    title: `Delete round ${r.roundNumber}`,
    message: `Delete "${r.title}"? This cannot be undone.`,
    confirmLabel: 'Delete round',
    danger: true,
    onConfirm: () => mutate(() => request(`/admin/mgmt/rounds/${r.roundNumber}`, send('DELETE')), `Round ${r.roundNumber} deleted`),
  });

  /* ----------------------------- whitelist handlers ----------------------------- */

  const handleAddWhitelist = async (e) => {
    e.preventDefault();
    const email = newAdminEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return notify('Enter a valid email address.', 'error');
    if (whitelistEmails.some((x) => lc(x) === email)) return notify(`${email} is already authorised.`, 'error');
    setAddingAdminEmail(true);
    try {
      const data = await request('/admin/mgmt/whitelist', send('POST', { email }));
      setNewAdminEmail('');
      setWhitelistEmails(data.emails || []);
      notify(`${email} can now sign in as an administrator`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setAddingAdminEmail(false);
    }
  };

  const handleRemoveWhitelist = (email) => askConfirm({
    title: 'Revoke administrator access',
    message: `Remove ${email} from the administrator whitelist?`,
    confirmLabel: 'Revoke access',
    danger: true,
    onConfirm: async () => {
      try {
        const data = await request(`/admin/mgmt/whitelist/${encodeURIComponent(email)}`, send('DELETE'));
        setWhitelistEmails(data.emails || []);
        notify(`${email} removed`);
      } catch (err) {
        notify(err.message, 'error');
      }
    },
  });

  /* ----------------------------- FAQ handlers ----------------------------- */

  const openCreateFaq = () => {
    setEditingFaq(null);
    setFaqForm({ category: 'General', question: '', answer: '' });
    setIsFaqModalOpen(true);
  };

  const openEditFaq = (faq) => {
    setEditingFaq(faq);
    setFaqForm({ category: faq.category || 'General', question: faq.question || faq.q || '', answer: faq.answer || faq.a || '' });
    setIsFaqModalOpen(true);
  };

  const faqId = (f) => f.id ?? f._id;

  const handleSaveFaq = async (e) => {
    e.preventDefault();
    const body = { category: faqForm.category.trim(), question: faqForm.question.trim(), answer: faqForm.answer.trim() };
    if (!body.category || !body.question || !body.answer) return notify('Fill in category, question and answer.', 'error');
    const ok = await mutate(
      () => request(editingFaq ? `/admin/mgmt/help/${faqId(editingFaq)}` : '/admin/mgmt/help', send(editingFaq ? 'PUT' : 'POST', body)),
      editingFaq ? 'FAQ updated' : 'FAQ published',
    );
    if (ok) setIsFaqModalOpen(false);
  };

  const handleDeleteFaq = (faq) => askConfirm({
    title: 'Delete FAQ',
    message: `Delete "${faq.question || faq.q}"?`,
    confirmLabel: 'Delete FAQ',
    danger: true,
    onConfirm: () => mutate(() => request(`/admin/mgmt/help/${faqId(faq)}`, send('DELETE')), 'FAQ deleted'),
  });

  /* ----------------------------- ranking handlers ----------------------------- */

  const rankingPayload = () => ({ roundNumber: selectedRankingRound, qualifyingCount: qualifyingLimit, tieBreakRules: tieBreakOrder });

  const handleComputePreview = async (silent = false) => {
    try {
      setLoadingRankingPreview(true);
      const data = await request('/leaderboard/admin/preview', send('POST', rankingPayload()));
      setRankingPreview(data.preview);
      if (!silent) notify(`Preview ready for round ${selectedRankingRound}`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setLoadingRankingPreview(false);
    }
  };

  const handleFreeze = () => askConfirm({
    title: `Freeze round ${selectedRankingRound} leaderboard`,
    message: `This locks the rankings and qualifies the top ${qualifyingLimit} teams for round ${selectedRankingRound + 1}. Qualification will not update automatically after this.`,
    confirmLabel: 'Freeze and qualify',
    danger: true,
    onConfirm: async () => {
      const ok = await mutate(() => request('/leaderboard/admin/freeze', send('POST', { ...rankingPayload(), isPublished: true })));
      if (ok) handleComputePreview(true);
    },
  });

  const handleUnfreeze = () => askConfirm({
    title: `Unfreeze round ${selectedRankingRound} leaderboard`,
    message: 'Rankings will start updating live again.',
    confirmLabel: 'Unfreeze',
    onConfirm: async () => {
      const ok = await mutate(() => request('/leaderboard/admin/unfreeze', send('POST', { roundNumber: selectedRankingRound })));
      if (ok) handleComputePreview(true);
    },
  });

  const handlePublish = (isPublished) => mutate(
    () => request('/leaderboard/admin/publish', send('POST', { roundNumber: selectedRankingRound, isPublished })),
  );

  const handleManualUnlock = async (e) => {
    e.preventDefault();
    const m = manualUnlockModal;
    if (!m) return;
    if (!m.reason.trim()) return notify('Add a reason for this exception.', 'error');
    const ok = await mutate(() => request('/leaderboard/admin/manual-unlock', send('POST', {
      teamId: m.teamId, roundNumber: Number(m.roundNumber), reason: m.reason.trim(),
    })));
    if (ok) setManualUnlockModal(null);
  };

  const moveTieBreak = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= tieBreakOrder.length) return;
    const next = [...tieBreakOrder];
    [next[i], next[j]] = [next[j], next[i]];
    setTieBreakOrder(next);
    setRankingPreview(null);
  };

  /* ----------------------------- exports ----------------------------- */

  const exportUsers = () => downloadCsv('participants.csv', [
    ['Name', 'Email', 'Registration number', 'Team', 'Role', 'Profile complete'],
    ...filteredUsers.map((u) => [u.name, u.email, u.profile?.registrationNumber, u.teamName, u.role, u.isProfileComplete ? 'Yes' : 'No']),
  ]);
  const exportTeams = () => downloadCsv('teams.csv', [
    ['Name', 'Code', 'Members', 'Min size', 'Max size', 'Disqualified'],
    ...filteredTeams.map((t) => [t.name, t.code, t.memberIds?.length || 0, t.minSizeRequired || 2, t.maxSize || 3, t.isDisqualified ? 'Yes' : 'No']),
  ]);
  const exportAudit = () => downloadCsv('audit-log.csv', [
    ['Action', 'Administrator', 'Target', 'Time'],
    ...filteredAuditLogs.map((l) => [l.action, l.adminEmail, `${l.targetType || ''}: ${l.targetName || l.targetId || ''}`, formatDate(l.createdAt || l.timestamp)]),
  ]);
  const exportPreview = () => rankingPreview && downloadCsv(`round-${selectedRankingRound}-ranking.csv`, [
    ['Rank', 'Team', 'Solved', 'Score', 'Time (s)', 'Qualified'],
    ...rankingPreview.entries.map((e) => [e.rank, e.teamName, e.puzzlesCompleted, e.totalScore, e.completionTimeSeconds, e.isQualified ? 'Yes' : 'No']),
  ]);

  /* ----------------------------- tabs ----------------------------- */

  const TABS = [
    { key: 'live_monitor', label: 'Live monitor', icon: Radio, count: liveState.activeRound1PlayingCount, live: true },
    { key: 'users', label: 'Participants', icon: Users, count: users.length },
    { key: 'teams', label: 'Teams', icon: Layers, count: teams.length },
    { key: 'puzzles', label: 'Puzzles', icon: Grid, count: puzzles.length },
    { key: 'rounds', label: 'Rounds', icon: SlidersHorizontal, count: rounds.length },
    { key: 'scoring', label: 'Ranking', icon: Award },
    { key: 'whitelist', label: 'Admins', icon: ShieldCheck, count: whitelistEmails.length },
    { key: 'faqs', label: 'Help & FAQ', icon: HelpCircle, count: faqsList.length },
    { key: 'audit', label: 'Audit trail', icon: FileText, count: auditLogs.length },
  ];

  const searchPlaceholder = {
    users: 'Search name, email, team or registration number',
    teams: 'Search team name or code',
    puzzles: 'Search title or solution',
    scoring: 'Filter teams',
    faqs: 'Search questions, answers or category',
    audit: 'Search action, administrator or target',
    rounds: 'Search',
    whitelist: 'Search',
  }[activeTab] || 'Search';
  const showSearch = ['users', 'teams', 'puzzles', 'faqs', 'audit', 'scoring'].includes(activeTab);

  /* ============================================================================
     RENDER SECTIONS
     ============================================================================ */

  const drift = Math.max(0, Math.floor((now - liveAt) / 1000));

  const renderLive = () => (
    <div className="adm-stack">
      <div className="adm-kpis">
        <Kpi tone="green" icon={UserCheck} label="Online now" value={liveState.onlineCount} suffix={` of ${liveState.totalRegisteredUsers} registered`} />
        <Kpi tone="blue" icon={Layers} label="Registered teams" value={liveState.totalTeams} />
        <Kpi tone="amber" icon={Flame} label="Playing round 1" value={liveState.activeRound1PlayingCount} suffix=" live sessions" />
        <Kpi tone="purple" icon={CheckCheck} label="Round 1 finished" value={liveState.completedTeamsCount} suffix=" sessions" />
      </div>

      {stats && Object.entries(stats).some(([, v]) => typeof v === 'number') && (
        <div className="adm-chips">
          {Object.entries(stats).filter(([, v]) => typeof v === 'number').map(([k, v]) => (
            <span key={k} className="adm-chip"><b>{v}</b> {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase()}</span>
          ))}
        </div>
      )}

      <section className="adm-panel adm-hero-panel">
        <div className="adm-panel-head">
          <div>
            <h2>Round 1 sessions in play</h2>
            <p>Each row is a team's live session. Timers keep counting between server updates.</p>
          </div>
          <Badge tone={socketConnected ? 'green' : 'red'}>{socketConnected ? 'Receiving live data' : 'Waiting for connection'}</Badge>
        </div>
        {liveState.playingTeams.length === 0 ? (
          <Empty icon={Clock} title="No teams are playing right now" hint="Sessions appear here the moment a team starts round 1." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Team</th><th>Puzzle</th><th>Solved</th><th>Score</th><th>Time used</th><th>Time left</th><th /></tr></thead>
              <tbody>
                {liveState.playingTeams.map((s) => {
                  const elapsed = (Number(s.elapsedSeconds) || 0) + drift;
                  const remaining = Math.max(0, (Number(s.remainingSeconds) || 0) - drift);
                  const pct = elapsed + remaining > 0 ? Math.min(100, (elapsed / (elapsed + remaining)) * 100) : 0;
                  const low = remaining <= 60;
                  return (
                    <tr key={s.sessionId || s.teamId}>
                      <td><strong>{s.teamName}</strong><small>{s.attemptsCount ?? 0} attempts</small></td>
                      <td className="num">#{(Number(s.currentPuzzleIndex) || 0) + 1}</td>
                      <td className="num good">{s.puzzlesCompleted ?? 0}</td>
                      <td className="num">{s.score ?? 0}</td>
                      <td className="num mono">{formatClock(elapsed)}</td>
                      <td>
                        <div className="adm-timer">
                          <span className={`mono ${low ? 'warn' : ''}`}>{formatClock(remaining)}</span>
                          <div className="adm-bar"><i className={low ? 'warn' : ''} style={{ width: `${pct}%` }} /></div>
                        </div>
                      </td>
                      <td className="right"><button className="adm-btn ghost sm" onClick={() => handleResetTeamSession(s.teamId, s.teamName)}><RotateCcw size={13} /> Reset</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="adm-grid-2">
        <section className="adm-panel">
          <div className="adm-panel-head"><h2>Live leaderboard</h2><Trophy size={16} className="adm-muted" /></div>
          {liveState.liveLeaderboard.length === 0 ? (
            <Empty icon={Trophy} title="No scores yet" hint="Rankings show here once teams start solving." />
          ) : (
            <ol className="adm-list">
              {liveState.liveLeaderboard.slice(0, 10).map((t, i) => (
                <li key={t.teamId || i} className="adm-row">
                  <span className={`adm-rank r${i + 1}`}>{t.rank ?? i + 1}</span>
                  <div className="grow"><strong>{t.teamName || t.name}</strong><small>{t.puzzlesCompleted ?? 0} solved</small></div>
                  <span className="adm-score">{t.totalScore ?? t.score ?? 0}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="adm-panel">
          <div className="adm-panel-head"><h2>Finished sessions ({liveState.completedTeams.length})</h2></div>
          {liveState.completedTeams.length === 0 ? (
            <Empty icon={CheckCheck} title="Nobody has finished yet" />
          ) : (
            <ul className="adm-list scroll">
              {liveState.completedTeams.map((t, i) => (
                <li key={t.teamId || i} className="adm-row">
                  <div className="grow">
                    <strong>{t.teamName}</strong>
                    <small>{t.status === 'TIME_EXPIRED' ? 'Time ran out' : `Finished in ${formatClock(t.elapsedSeconds)}`}</small>
                  </div>
                  <span className="adm-score">{t.score} pts</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="adm-grid-2">
        <section className="adm-panel">
          <div className="adm-panel-head"><h2>Online users ({liveState.onlineUsers.length})</h2></div>
          {liveState.onlineUsers.length === 0 ? (
            <Empty icon={WifiOff} title="No one is connected" />
          ) : (
            <ul className="adm-list scroll">
              {liveState.onlineUsers.map((u, i) => (
                <li key={u.userId || u.socketId || i} className="adm-row">
                  <div className="grow"><strong>{u.name || u.email}</strong><small>{u.email}</small></div>
                  <div className="right">
                    <Badge tone="blue">{u.role}</Badge>
                    {u.teamName && <small>{u.teamName}</small>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-panel">
          <div className="adm-panel-head"><h2>Event stream</h2><Badge tone="gray">{liveEventLogs.length} recent</Badge></div>
          {liveEventLogs.length === 0 ? (
            <Empty icon={Radio} title="Listening for activity" hint="Session starts, solves and failed attempts appear here." />
          ) : (
            <ul className="adm-list scroll">
              {liveEventLogs.map((evt) => (
                <li key={evt.id} className={`adm-row ev ${evt.type === 'PUZZLE_SOLVED' ? 'ok' : evt.type === 'PUZZLE_ATTEMPT_FAILED' ? 'bad' : ''}`}>
                  <div className="grow">
                    <strong>{evt.teamName}</strong>
                    <small>
                      {evt.type === 'SESSION_STARTED' && 'Started a round 1 session'}
                      {evt.type === 'PUZZLE_SOLVED' && `Solved puzzle #${evt.currentPuzzleIndex} (+${evt.pointsAwarded} pts)`}
                      {evt.type === 'PUZZLE_ATTEMPT_FAILED' && `Wrong attempt on puzzle #${(Number(evt.currentPuzzleIndex) || 0) + 1}`}
                      {evt.type === 'ROUND_COMPLETED' && `Completed round 1 with ${evt.finalScore} pts`}
                      {!['SESSION_STARTED', 'PUZZLE_SOLVED', 'PUZZLE_ATTEMPT_FAILED', 'ROUND_COMPLETED'].includes(evt.type) && (evt.message || evt.type)}
                    </small>
                  </div>
                  <span className="mono adm-muted">{evt.receivedAt}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );

  const renderUsers = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>Participants</h2><p>{filteredUsers.length} of {users.length} shown</p></div>
        <button className="adm-btn ghost sm" onClick={exportUsers} disabled={!filteredUsers.length}><Download size={14} /> Export CSV</button>
      </div>
      {loading && !users.length ? <SkeletonRows /> : filteredUsers.length === 0 ? (
        <Empty icon={Users} title="No participants match" hint={q ? 'Try a different search.' : 'People appear here after they sign up.'} />
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Participant</th><th>Email</th><th>Team</th><th>Profile</th><th>Role</th></tr></thead>
              <tbody>
                {usersPg.pageItems.map((u) => {
                  const isSelf = (selfId && String(u._id) === selfId) || (selfEmail && lc(u.email) === selfEmail);
                  return (
                    <tr key={u._id}>
                      <td><strong>{u.name || '—'}</strong>{u.profile?.registrationNumber && <small>Reg. {u.profile.registrationNumber}</small>}</td>
                      <td className="adm-muted">{u.email}</td>
                      <td>{u.teamName ? <span className="adm-accent">{u.teamName}</span> : <span className="adm-muted">—</span>}</td>
                      <td><Badge tone={u.isProfileComplete ? 'green' : 'amber'}>{u.isProfileComplete ? 'Complete' : 'Incomplete'}</Badge></td>
                      <td>
                        <select className="adm-select sm" value={u.role} disabled={isSelf} title={isSelf ? 'You cannot change your own role' : undefined} onChange={(e) => handleRoleChange(u, e.target.value)}>
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager pg={usersPg} />
        </>
      )}
    </section>
  );

  const renderTeams = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>Teams</h2><p>{filteredTeams.length} of {teams.length} shown</p></div>
        <button className="adm-btn ghost sm" onClick={exportTeams} disabled={!filteredTeams.length}><Download size={14} /> Export CSV</button>
      </div>
      {loading && !teams.length ? <SkeletonRows /> : filteredTeams.length === 0 ? (
        <Empty icon={Layers} title="No teams match" hint={q ? 'Try a different search.' : 'Teams appear here once participants create them.'} />
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Team</th><th>Members</th><th>Allowed size</th><th>Status</th><th /></tr></thead>
              <tbody>
                {teamsPg.pageItems.map((t) => (
                  <tr key={t._id}>
                    <td><strong>{t.name}</strong><small className="mono">{t.code}</small></td>
                    <td className="num">{t.memberIds?.length || 0}</td>
                    <td className="adm-muted">{t.minSizeRequired || 2} to {t.maxSize || 3}{t.allowAdminBypass && <small>Admin bypass on</small>}</td>
                    <td><Badge tone={t.isDisqualified ? 'red' : 'green'}>{t.isDisqualified ? 'Disqualified' : 'Active'}</Badge></td>
                    <td className="right">
                      <div className="adm-actions">
                        <button className="adm-btn ghost sm" onClick={() => openEditTeam(t)}><Edit3 size={13} /> Edit</button>
                        <button className="adm-btn ghost sm" onClick={() => setAdjustScoreModal({ teamId: t._id, teamName: t.name, roundNumber: roundNumbers[0], scoreDelta: 50, reason: '' })}><Award size={13} /> Score</button>
                        <button className="adm-btn danger sm" onClick={() => handleResetTeamSession(t._id, t.name)}><RotateCcw size={13} /> Reset</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager pg={teamsPg} />
        </>
      )}
    </section>
  );

  const renderPuzzles = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>Round {selectedPuzzleRound} puzzles ({roundPuzzles.length})</h2>
          <p>{reorderEnabled ? 'Drag rows or use the arrows to set the order teams see them in.' : 'Clear the search to reorder puzzles.'}</p>
        </div>
        <button className="adm-btn primary" onClick={openCreatePuzzle}><Plus size={15} /> Add puzzle</button>
      </div>

      <div className="adm-segment" role="tablist" aria-label="Round">
        {roundNumbers.map((n) => (
          <button key={n} role="tab" aria-selected={selectedPuzzleRound === n} className={selectedPuzzleRound === n ? 'on' : ''} onClick={() => setSelectedPuzzleRound(n)}>Round {n}</button>
        ))}
      </div>

      {filteredPuzzles.length === 0 ? (
        <Empty icon={Grid} title={q ? 'No puzzles match your search' : `No puzzles in round ${selectedPuzzleRound} yet`} hint={q ? undefined : 'Upload an image and it is cut into pieces automatically.'} action={!q && <button className="adm-btn primary" onClick={openCreatePuzzle}><Plus size={15} /> Add puzzle</button>} />
      ) : (
        <ul className="adm-puzzles">
          {filteredPuzzles.map((p, idx) => (
            <li
              key={p._id}
              draggable={reorderEnabled}
              onDragStart={(e) => { setDraggedPuzzleIndex(idx); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); if (reorderEnabled) setDragOverIndex(idx); }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={() => { setDraggedPuzzleIndex(null); setDragOverIndex(null); }}
              className={`adm-puzzle ${draggedPuzzleIndex === idx ? 'dragging' : ''} ${dragOverIndex === idx && draggedPuzzleIndex !== idx ? 'over' : ''}`}
            >
              {reorderEnabled && <GripVertical size={16} className="adm-muted grip" />}
              <span className="adm-order">{idx + 1}</span>
              {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="adm-thumb-empty"><Grid size={16} /></div>}
              <div className="grow">
                <strong>{p.title}</strong>
                <small>{p.gridRows || '?'}×{p.gridCols || '?'} grid · {p.points} pts · {formatClock(p.timeLimitSeconds)} limit{p.solution ? ` · Solution: ${p.solution}` : ''}</small>
              </div>
              <div className="adm-actions">
                {reorderEnabled && (
                  <>
                    <button className="adm-icon-btn" onClick={() => moveItem(idx, idx - 1)} disabled={idx === 0} aria-label="Move up"><ChevronUp size={16} /></button>
                    <button className="adm-icon-btn" onClick={() => moveItem(idx, idx + 1)} disabled={idx === roundPuzzles.length - 1} aria-label="Move down"><ChevronDown size={16} /></button>
                  </>
                )}
                <button className={`adm-btn sm ${p.isPublished ? 'success' : 'ghost'}`} onClick={() => handleTogglePublish(p)}>
                  {p.isPublished ? <><Eye size={13} /> Published</> : <><EyeOff size={13} /> Draft</>}
                </button>
                <button className="adm-icon-btn" onClick={() => openEditPuzzle(p)} aria-label={`Edit ${p.title}`}><Edit3 size={15} /></button>
                <button className="adm-icon-btn danger" onClick={() => handleDeletePuzzle(p)} aria-label={`Delete ${p.title}`}><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const renderRounds = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>Rounds</h2><p>Open, start, lock or close each stage of the event.</p></div>
        <button className="adm-btn primary" onClick={openCreateRound}><Plus size={15} /> Add round</button>
      </div>
      {loading && !rounds.length ? <SkeletonRows rows={3} /> : rounds.length === 0 ? (
        <Empty icon={SlidersHorizontal} title="No rounds yet" action={<button className="adm-btn primary" onClick={openCreateRound}><Plus size={15} /> Add round</button>} />
      ) : (
        <div className="adm-cards">
          {[...rounds].sort((a, b) => a.roundNumber - b.roundNumber).map((r) => (
            <article key={r._id || r.roundNumber} className={`adm-round ${STATUS_TONE[r.status] || 'gray'}`}>
              <div className="adm-round-top">
                <h3>Round {r.roundNumber}: {r.title}</h3>
                <Badge tone={STATUS_TONE[r.status] || 'gray'}>{(r.status || '').replace('_', ' ')}</Badge>
              </div>
              <p>{r.description || 'No description yet.'}</p>
              <dl className="adm-meta">
                <div><dt>Duration</dt><dd>{Math.floor((r.durationSeconds || 1800) / 60)} min</dd></div>
                <div><dt>Min team</dt><dd>{r.minTeamSize || 2}</dd></div>
                <div><dt>Mechanic</dt><dd>{r.mechanicType || 'puzzle'}</dd></div>
              </dl>
              <div className="adm-status-btns" role="group" aria-label={`Status for round ${r.roundNumber}`}>
                {[
                  ['LOCKED', 'Lock', Lock], ['AVAILABLE', 'Open', Unlock], ['IN_PROGRESS', 'Start', Play], ['COMPLETED', 'Close', CheckCircle2],
                ].map(([s, label, Icon]) => (
                  <button key={s} className={r.status === s ? 'on' : ''} disabled={r.status === s} onClick={() => handleRoundStatus(r, s)}><Icon size={13} /> {label}</button>
                ))}
              </div>
              <div className="adm-actions">
                <button className="adm-btn ghost sm grow" onClick={() => openEditRound(r)}><Edit3 size={13} /> Edit details</button>
                {r.roundNumber > 1 && <button className="adm-icon-btn danger" onClick={() => handleDeleteRound(r)} aria-label={`Delete round ${r.roundNumber}`}><Trash2 size={15} /></button>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  const renderScoring = () => {
    const scopedTeams = teams.filter((t) => !q || lc(t.name).includes(q) || lc(t.code).includes(q));
    const frozen = !!leaderboardStatus?.isFrozen;
    const published = leaderboardStatus?.isPublished !== false;
    return (
      <div className="adm-stack">
        <section className="adm-panel">
          <div className="adm-panel-head">
            <div><h2>Ranking and qualification</h2><p>Preview the standings, then freeze them to lock in who moves on.</p></div>
            <div className="adm-chips">
              <Badge tone={frozen ? 'amber' : 'gray'}>{frozen ? 'Frozen' : 'Live'}</Badge>
              <Badge tone={published ? 'green' : 'gray'}>{published ? 'Published' : 'Hidden'}</Badge>
            </div>
          </div>

          <div className="adm-segment">
            {roundNumbers.map((n) => (
              <button key={n} className={selectedRankingRound === n ? 'on' : ''} onClick={() => { setSelectedRankingRound(n); setRankingPreview(null); }}>Round {n}</button>
            ))}
          </div>

          <div className="adm-grid-3">
            <div className="adm-box">
              <Field label="Teams that qualify" hint="How many top teams move to the next round.">
                <input type="number" min="1" className="adm-input" value={qualifyingLimit} onChange={(e) => { setQualifyingLimit(Math.max(1, parseInt(e.target.value, 10) || 1)); setRankingPreview(null); }} />
              </Field>
            </div>
            <div className="adm-box">
              <span className="adm-label">Tie-break order</span>
              <ol className="adm-tiebreak">
                {tieBreakOrder.map((k, i) => (
                  <li key={k}>
                    <span>{TIE_BREAK_LABELS[k] || k}</span>
                    <span>
                      <button className="adm-icon-btn" onClick={() => moveTieBreak(i, -1)} disabled={i === 0} aria-label="Move up"><ChevronUp size={14} /></button>
                      <button className="adm-icon-btn" onClick={() => moveTieBreak(i, 1)} disabled={i === tieBreakOrder.length - 1} aria-label="Move down"><ChevronDown size={14} /></button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="adm-box adm-box-actions">
              <button className="adm-btn primary" onClick={() => handleComputePreview()} disabled={loadingRankingPreview}>
                <RefreshCw size={14} className={loadingRankingPreview ? 'spin' : ''} /> {loadingRankingPreview ? 'Calculating…' : 'Preview rankings'}
              </button>
              {frozen
                ? <button className="adm-btn ghost" onClick={handleUnfreeze}><Unlock size={14} /> Unfreeze</button>
                : <button className="adm-btn warn" onClick={handleFreeze}><Lock size={14} /> Freeze and qualify</button>}
              <button className="adm-btn ghost" onClick={() => handlePublish(!published)}>{published ? <><EyeOff size={14} /> Hide leaderboard</> : <><Eye size={14} /> Publish leaderboard</>}</button>
            </div>
          </div>
        </section>

        {rankingPreview && (
          <section className="adm-panel">
            <div className="adm-panel-head">
              <div><h2>Round {selectedRankingRound} preview</h2><p>{rankingPreview.totalQualifiedTeams} teams qualify</p></div>
              <button className="adm-btn ghost sm" onClick={exportPreview}><Download size={14} /> Export CSV</button>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Rank</th><th>Team</th><th>Solved</th><th>Score</th><th>Time</th><th>Result</th></tr></thead>
                <tbody>
                  {(rankingPreview.entries || []).map((en) => (
                    <tr key={en.teamId} className={en.isQualified ? '' : 'dim'}>
                      <td><span className={`adm-rank r${en.rank}`}>{en.rank}</span></td>
                      <td><strong>{en.teamName}</strong>{en.isManualOverride && <Badge tone="purple">Override</Badge>}</td>
                      <td className="num">{en.puzzlesCompleted}</td>
                      <td className="num">{en.totalScore}</td>
                      <td className="num mono">{formatClock(en.completionTimeSeconds)}</td>
                      <td><Badge tone={en.isQualified ? 'green' : 'gray'}>{en.isQualified ? 'Qualified' : 'Eliminated'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="adm-panel">
          <div className="adm-panel-head"><div><h2>Exceptions</h2><p>Let a specific team into a later round, outside the normal cut.</p></div></div>
          {scopedTeams.length === 0 ? <Empty icon={Layers} title="No teams to show" /> : (
            <div className="adm-cards tight">
              {scopedTeams.map((t) => (
                <div key={t._id} className="adm-row box">
                  <div className="grow"><strong>{t.name}</strong><small className="mono">{t.code}</small></div>
                  <button
                    className="adm-btn ghost sm"
                    disabled={!rounds.some((r) => r.roundNumber > 1)}
                    onClick={() => setManualUnlockModal({ teamId: t._id, teamName: t.name, roundNumber: (rounds.find((r) => r.roundNumber > 1) || {}).roundNumber || 2, reason: '' })}
                  >
                    <Unlock size={13} /> Unlock round
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderWhitelist = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>Administrator access</h2><p>Google accounts listed here sign in straight to this console with full permissions.</p></div>
        <Badge tone="blue">{whitelistEmails.length} authorised</Badge>
      </div>
      <form onSubmit={handleAddWhitelist} className="adm-inline-form">
        <div className="adm-input-icon">
          <Mail size={15} />
          <input type="email" className="adm-input" placeholder="name@gmail.com" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} required aria-label="Google email to authorise" />
        </div>
        <button type="submit" className="adm-btn primary" disabled={addingAdminEmail || !newAdminEmail.trim()}><UserPlus size={15} /> {addingAdminEmail ? 'Adding…' : 'Authorise admin'}</button>
      </form>
      {whitelistEmails.length === 0 ? <Empty icon={ShieldCheck} title="No administrators listed" /> : (
        <div className="adm-cards tight">
          {whitelistEmails.map((email) => {
            const isPrimary = PRIMARY_ADMINS.includes(lc(email));
            const isSelf = lc(email) === selfEmail;
            return (
              <div key={email} className="adm-row box">
                <span className="adm-avatar"><ShieldCheck size={16} /></span>
                <div className="grow"><strong>{email}</strong><small>{isPrimary ? 'Primary super admin' : isSelf ? 'You' : 'Administrator'}</small></div>
                {!isPrimary && !isSelf && <button className="adm-btn danger sm" onClick={() => handleRemoveWhitelist(email)}><Trash2 size={13} /> Revoke</button>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderFaqs = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>Help and FAQ</h2><p>These answers appear on the participant Help &amp; Support page.</p></div>
        <button className="adm-btn primary" onClick={openCreateFaq}><Plus size={15} /> Add FAQ</button>
      </div>
      {filteredFaqs.length === 0 ? (
        <Empty icon={HelpCircle} title={q ? 'No FAQs match your search' : 'No FAQs yet'} action={!q && <button className="adm-btn primary" onClick={openCreateFaq}><Plus size={15} /> Add FAQ</button>} />
      ) : (
        <div className="adm-stack tight">
          {filteredFaqs.map((faq, i) => (
            <article key={faqId(faq) ?? i} className="adm-faq">
              <div className="grow">
                <Badge tone="blue">{faq.category || 'General'}</Badge>
                <h4>{faq.question || faq.q}</h4>
                <p>{faq.answer || faq.a}</p>
              </div>
              <div className="adm-actions">
                <button className="adm-btn ghost sm" onClick={() => openEditFaq(faq)}><Edit3 size={13} /> Edit</button>
                <button className="adm-icon-btn danger" onClick={() => handleDeleteFaq(faq)} aria-label="Delete FAQ"><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  const renderAudit = () => (
    <section className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>Audit trail</h2><p>Every administrator action, newest data first. Select a row for full details.</p></div>
        <div className="adm-actions">
          <select className="adm-select sm" value={auditActionFilter} onChange={(e) => setAuditActionFilter(e.target.value)} aria-label="Filter by action">
            {auditActions.map((a) => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
          </select>
          <button className="adm-btn ghost sm" onClick={exportAudit} disabled={!filteredAuditLogs.length}><Download size={14} /> Export CSV</button>
        </div>
      </div>
      {filteredAuditLogs.length === 0 ? <Empty icon={FileText} title="No log entries match" /> : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table clickable">
              <thead><tr><th>Action</th><th>Administrator</th><th>Target</th><th>Time</th></tr></thead>
              <tbody>
                {auditPg.pageItems.map((log, i) => (
                  <tr key={log._id || i} tabIndex={0} onClick={() => setViewingAudit(log)} onKeyDown={(e) => { if (e.key === 'Enter') setViewingAudit(log); }}>
                    <td><span className="adm-accent mono">{log.action}</span></td>
                    <td className="adm-muted">{log.adminEmail}</td>
                    <td>{log.targetType ? `${log.targetType}: ` : ''}{log.targetName || log.targetId || '—'}</td>
                    <td className="mono adm-muted">{formatDate(log.createdAt || log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager pg={auditPg} />
        </>
      )}
    </section>
  );

  /* ============================================================================
     RENDER
     ============================================================================ */

  const gridCols = Number(puzzleForm.gridCols) || 3;
  const gridRows = Number(puzzleForm.gridRows) || 3;
  const canSavePuzzle = Boolean(generatedPuzzle || editingPuzzle || selectedPuzzleFile);

  return (
    <AppShell>
      <style>{STYLES}</style>
      <div className="adm">
        <header className="adm-hero">
          <div>
            <h1>Admin console</h1>
            <p>Run the event: watch teams play live, manage puzzles and rounds, and control who qualifies.</p>
          </div>
          <div className="adm-hero-side">
            <span className={`adm-sync ${socketConnected ? 'on' : 'off'}`}>
              {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
              {socketConnected ? 'Live sync on' : 'Live sync offline'}
            </span>
            {lastSynced && <small>Updated {lastSynced.toLocaleTimeString()}</small>}
            <button
              className="adm-btn ghost"
              disabled={loading}
              onClick={() => { fetchAllAdminData(); getSocket()?.emit('admin:request_state'); }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </header>

        {loadError && (
          <div className="adm-banner error" role="alert">
            <AlertCircle size={16} /><span>{loadError}</span>
            <button className="adm-btn ghost sm" onClick={() => fetchAllAdminData()}>Try again</button>
          </div>
        )}

        <nav className="adm-tabs" aria-label="Console sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const on = activeTab === tab.key;
            return (
              <button key={tab.key} className={`adm-tab ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}>
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && <em className={tab.live && tab.count > 0 ? 'live' : ''}>{tab.count}</em>}
              </button>
            );
          })}
        </nav>

        {showSearch && (
          <div className="adm-search">
            <Search size={15} />
            <input className="adm-input" type="search" placeholder={searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label="Search" />
          </div>
        )}

        <main>
          {activeTab === 'live_monitor' && renderLive()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'teams' && renderTeams()}
          {activeTab === 'puzzles' && renderPuzzles()}
          {activeTab === 'rounds' && renderRounds()}
          {activeTab === 'scoring' && renderScoring()}
          {activeTab === 'whitelist' && renderWhitelist()}
          {activeTab === 'faqs' && renderFaqs()}
          {activeTab === 'audit' && renderAudit()}
        </main>
      </div>

      {/* ---------------- Modals ---------------- */}

      {editingTeam && (
        <Modal
          title={`Edit ${editingTeam.name}`}
          onClose={() => setEditingTeam(null)}
          footer={<><button className="adm-btn ghost" onClick={() => setEditingTeam(null)}>Cancel</button><button className="adm-btn primary" type="submit" form="team-form">Save team</button></>}
        >
          <form id="team-form" onSubmit={handleSaveTeam} className="adm-form">
            <Field label="Team name"><input className="adm-input" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required /></Field>
            <div className="adm-grid-2 tight">
              <Field label="Minimum size"><input type="number" min="1" className="adm-input" value={teamForm.minSize} onChange={(e) => setTeamForm({ ...teamForm, minSize: e.target.value })} required /></Field>
              <Field label="Maximum size"><input type="number" min="1" className="adm-input" value={teamForm.maxSize} onChange={(e) => setTeamForm({ ...teamForm, maxSize: e.target.value })} required /></Field>
            </div>
            <label className="adm-check">
              <input type="checkbox" checked={teamForm.bypass} onChange={(e) => setTeamForm({ ...teamForm, bypass: e.target.checked })} />
              <span><strong>Allow admin bypass</strong><small>Lets this team play even if it is below the minimum size.</small></span>
            </label>
          </form>
        </Modal>
      )}

      {adjustScoreModal && (
        <Modal
          title={`Adjust score: ${adjustScoreModal.teamName}`}
          subtitle="Use a negative number to remove points."
          onClose={() => setAdjustScoreModal(null)}
          footer={<><button className="adm-btn ghost" onClick={() => setAdjustScoreModal(null)}>Cancel</button><button className="adm-btn primary" type="submit" form="score-form">Apply adjustment</button></>}
        >
          <form id="score-form" onSubmit={handleAdjustScore} className="adm-form">
            <div className="adm-grid-2 tight">
              <Field label="Round">
                <select className="adm-select" value={adjustScoreModal.roundNumber} onChange={(e) => setAdjustScoreModal({ ...adjustScoreModal, roundNumber: e.target.value })}>
                  {roundNumbers.map((n) => <option key={n} value={n}>Round {n}</option>)}
                </select>
              </Field>
              <Field label="Points to add or remove"><input type="number" className="adm-input" value={adjustScoreModal.scoreDelta} onChange={(e) => setAdjustScoreModal({ ...adjustScoreModal, scoreDelta: e.target.value })} required /></Field>
            </div>
            <Field label="Reason" hint="Saved in the audit trail."><input className="adm-input" placeholder="e.g. Bonus challenge completed" value={adjustScoreModal.reason} onChange={(e) => setAdjustScoreModal({ ...adjustScoreModal, reason: e.target.value })} required /></Field>
          </form>
        </Modal>
      )}

      {isPuzzleModalOpen && (
        <Modal
          title={editingPuzzle ? 'Edit puzzle' : 'New puzzle'}
          subtitle={`Round ${selectedPuzzleRound}`}
          width={880}
          onClose={() => setIsPuzzleModalOpen(false)}
          footer={(
            <>
              <button className="adm-btn ghost" onClick={() => setIsPuzzleModalOpen(false)}>Cancel</button>
              {generatedPuzzle && !generatedPuzzle.isPublished && (
                <button className="adm-btn ghost" type="button" onClick={() => handleTogglePublish(generatedPuzzle)}><Eye size={14} /> Publish puzzle</button>
              )}
              <button className="adm-btn primary" type="submit" form="puzzle-form" disabled={!canSavePuzzle}>Save puzzle</button>
            </>
          )}
        >
          <form id="puzzle-form" onSubmit={handleSavePuzzle} className="adm-puzzle-form">
            <div className="adm-form">
              <Field label="Title"><input className="adm-input" value={puzzleForm.title} onChange={(e) => setPuzzleForm({ ...puzzleForm, title: e.target.value })} required /></Field>
              <Field label="Description"><textarea className="adm-input" rows={2} value={puzzleForm.description} onChange={(e) => setPuzzleForm({ ...puzzleForm, description: e.target.value })} /></Field>
              <Field label="Original image" hint={editingPuzzle ? 'Pieces are fixed once generated. Create a new puzzle to use a different image.' : 'JPEG, PNG or WebP, up to 5 MB.'}>
                <input type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} className="adm-input" onChange={handlePickFile} disabled={Boolean(editingPuzzle)} />
              </Field>
              <div className="adm-grid-2 tight">
                <Field label="Rows (2 to 8)"><input type="number" min="2" max="8" className="adm-input" value={puzzleForm.gridRows} disabled={Boolean(editingPuzzle)} onChange={(e) => { setPuzzleForm({ ...puzzleForm, gridRows: e.target.value }); setGeneratedPuzzle(null); }} required /></Field>
                <Field label="Columns (2 to 8)"><input type="number" min="2" max="8" className="adm-input" value={puzzleForm.gridCols} disabled={Boolean(editingPuzzle)} onChange={(e) => { setPuzzleForm({ ...puzzleForm, gridCols: e.target.value }); setGeneratedPuzzle(null); }} required /></Field>
                <Field label="Points"><input type="number" min="0" className="adm-input" value={puzzleForm.points} onChange={(e) => setPuzzleForm({ ...puzzleForm, points: e.target.value })} required /></Field>
                <Field label="Session time limit (seconds)"><input type="number" min="60" className="adm-input" value={puzzleForm.timeLimitSeconds} onChange={(e) => setPuzzleForm({ ...puzzleForm, timeLimitSeconds: e.target.value })} required /></Field>
              </div>
              <Field label="Hint" hint="Optional."><input className="adm-input" value={puzzleForm.hint} onChange={(e) => setPuzzleForm({ ...puzzleForm, hint: e.target.value })} /></Field>
              {!editingPuzzle && (
                <button type="button" className="adm-btn primary" onClick={handleGeneratePuzzle} disabled={uploadingImage || !selectedPuzzleFile}>
                  {uploadingImage ? 'Generating pieces…' : `Generate ${gridRows * gridCols} pieces`}
                </button>
              )}
            </div>

            <div className="adm-preview">
              {(generatedPuzzle?.imageUrl || previewUrl) ? (
                <div className="adm-preview-img">
                  <img src={generatedPuzzle?.imageUrl || previewUrl} alt="Original puzzle" />
                  {!generatedPuzzle && (
                    <div className="adm-preview-grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gridTemplateRows: `repeat(${gridRows}, 1fr)` }}>
                      {Array.from({ length: gridRows * gridCols }).map((_, i) => <span key={i} />)}
                    </div>
                  )}
                </div>
              ) : <Empty icon={Grid} title="No image yet" hint="Choose an image to preview the grid." />}
              <small className="adm-muted">
                {generatedPuzzle ? `${generatedPuzzle.puzzleCode || 'Puzzle'} · ${generatedPuzzle.pieces?.length || 0} saved pieces` : `${gridRows} × ${gridCols} · ${gridRows * gridCols} pieces`}
              </small>
            </div>
          </form>

          {generatedPuzzle?.pieces?.length > 0 && (
            <div className="adm-pieces" style={{ gridTemplateColumns: `repeat(${Math.min(generatedPuzzle.gridCols || gridCols, 8)}, minmax(56px, 1fr))` }}>
              {[...generatedPuzzle.pieces].sort((a, b) => a.originalIndex - b.originalIndex).map((piece) => (
                <figure key={piece.pieceId}>
                  <img src={piece.imageUrl} alt={`Piece ${piece.originalIndex + 1}`} />
                  <figcaption className="mono">{piece.pieceId}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </Modal>
      )}

      {isCreateRoundOpen && (
        <Modal
          title="New round"
          onClose={() => setIsCreateRoundOpen(false)}
          footer={<><button className="adm-btn ghost" onClick={() => setIsCreateRoundOpen(false)}>Cancel</button><button className="adm-btn primary" type="submit" form="create-round-form">Create round</button></>}
        >
          <form id="create-round-form" onSubmit={handleCreateRound} className="adm-form">
            <div className="adm-grid-2 tight narrow-first">
              <Field label="Round number"><input type="number" min="1" className="adm-input" value={newRoundForm.roundNumber} onChange={(e) => setNewRoundForm({ ...newRoundForm, roundNumber: parseInt(e.target.value, 10) || 1 })} required /></Field>
              <Field label="Title"><input className="adm-input" placeholder="e.g. Speed challenge" value={newRoundForm.title} onChange={(e) => setNewRoundForm({ ...newRoundForm, title: e.target.value })} required /></Field>
            </div>
            <Field label="Summary"><textarea rows={3} className="adm-input" placeholder="Rules and mechanics for this round" value={newRoundForm.description} onChange={(e) => setNewRoundForm({ ...newRoundForm, description: e.target.value })} /></Field>
            <div className="adm-grid-3 tight">
              <Field label="Duration (min)"><input type="number" min="1" className="adm-input" value={newRoundForm.durationMinutes} onChange={(e) => setNewRoundForm({ ...newRoundForm, durationMinutes: parseInt(e.target.value, 10) || 1 })} required /></Field>
              <Field label="Min team size"><input type="number" min="1" className="adm-input" value={newRoundForm.minTeamSize} onChange={(e) => setNewRoundForm({ ...newRoundForm, minTeamSize: parseInt(e.target.value, 10) || 1 })} required /></Field>
              <Field label="Mechanic">
                <select className="adm-select" value={newRoundForm.mechanicType} onChange={(e) => setNewRoundForm({ ...newRoundForm, mechanicType: e.target.value })}>
                  <option value="puzzle">Puzzle</option><option value="quiz">Quiz</option><option value="media">Media</option><option value="speedrun">Speed run</option>
                </select>
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {editingRound && (
        <Modal
          title={`Edit round ${editingRound.roundNumber}`}
          onClose={() => setEditingRound(null)}
          footer={<><button className="adm-btn ghost" onClick={() => setEditingRound(null)}>Cancel</button><button className="adm-btn primary" type="submit" form="edit-round-form">Save changes</button></>}
        >
          <form id="edit-round-form" onSubmit={handleSaveRound} className="adm-form">
            <Field label="Title"><input className="adm-input" value={roundForm.title} onChange={(e) => setRoundForm({ ...roundForm, title: e.target.value })} required /></Field>
            <Field label="Summary"><textarea rows={3} className="adm-input" value={roundForm.description} onChange={(e) => setRoundForm({ ...roundForm, description: e.target.value })} /></Field>
            <div className="adm-grid-3 tight">
              <Field label="Duration (min)"><input type="number" min="1" className="adm-input" value={roundForm.durationMinutes} onChange={(e) => setRoundForm({ ...roundForm, durationMinutes: e.target.value })} required /></Field>
              <Field label="Min team size"><input type="number" min="1" className="adm-input" value={roundForm.minTeamSize} onChange={(e) => setRoundForm({ ...roundForm, minTeamSize: e.target.value })} required /></Field>
              <Field label="Mechanic">
                <select className="adm-select" value={roundForm.mechanicType} onChange={(e) => setRoundForm({ ...roundForm, mechanicType: e.target.value })}>
                  <option value="puzzle">Puzzle</option><option value="quiz">Quiz</option><option value="media">Media</option><option value="speedrun">Speed run</option>
                </select>
              </Field>
            </div>
          </form>
        </Modal>
      )}

      {isFaqModalOpen && (
        <Modal
          title={editingFaq ? 'Edit FAQ' : 'New FAQ'}
          onClose={() => setIsFaqModalOpen(false)}
          footer={<><button className="adm-btn ghost" onClick={() => setIsFaqModalOpen(false)}>Cancel</button><button className="adm-btn primary" type="submit" form="faq-form">{editingFaq ? 'Save FAQ' : 'Publish FAQ'}</button></>}
        >
          <form id="faq-form" onSubmit={handleSaveFaq} className="adm-form">
            <Field label="Category"><input className="adm-input" list="faq-cats" placeholder="e.g. Teams, Gameplay, Scoring" value={faqForm.category} onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })} required /></Field>
            <datalist id="faq-cats">{Array.from(new Set(faqsList.map((f) => f.category).filter(Boolean))).map((c) => <option key={c} value={c} />)}</datalist>
            <Field label="Question"><input className="adm-input" placeholder="How do I join or create a team?" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })} required /></Field>
            <Field label="Answer"><textarea rows={5} className="adm-input" value={faqForm.answer} onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })} required /></Field>
          </form>
        </Modal>
      )}

      {manualUnlockModal && (
        <Modal
          title={`Unlock a round for ${manualUnlockModal.teamName}`}
          subtitle="This bypasses the normal qualification cut."
          onClose={() => setManualUnlockModal(null)}
          footer={<><button className="adm-btn ghost" onClick={() => setManualUnlockModal(null)}>Cancel</button><button className="adm-btn primary" type="submit" form="unlock-form">Grant access</button></>}
        >
          <form id="unlock-form" onSubmit={handleManualUnlock} className="adm-form">
            <Field label="Round">
              <select className="adm-select" value={manualUnlockModal.roundNumber} onChange={(e) => setManualUnlockModal({ ...manualUnlockModal, roundNumber: e.target.value })}>
                {rounds.filter((r) => r.roundNumber > 1).sort((a, b) => a.roundNumber - b.roundNumber).map((r) => <option key={r.roundNumber} value={r.roundNumber}>Round {r.roundNumber}: {r.title}</option>)}
              </select>
            </Field>
            <Field label="Reason" hint="Saved in the audit trail."><input className="adm-input" placeholder="e.g. Technical failure during round 1" value={manualUnlockModal.reason} onChange={(e) => setManualUnlockModal({ ...manualUnlockModal, reason: e.target.value })} required /></Field>
          </form>
        </Modal>
      )}

      {viewingAudit && (
        <Modal title={viewingAudit.action || 'Log entry'} subtitle={formatDate(viewingAudit.createdAt || viewingAudit.timestamp)} width={640} onClose={() => setViewingAudit(null)}>
          <dl className="adm-meta stacked">
            <div><dt>Administrator</dt><dd>{viewingAudit.adminEmail || '—'}</dd></div>
            <div><dt>Target</dt><dd>{viewingAudit.targetType ? `${viewingAudit.targetType}: ` : ''}{viewingAudit.targetName || viewingAudit.targetId || '—'}</dd></div>
          </dl>
          <pre className="adm-json">{JSON.stringify(viewingAudit, null, 2)}</pre>
        </Modal>
      )}

      <ConfirmDialog state={confirmState} onClose={() => setConfirmState(null)} />
      <Toasts toasts={toasts} dismiss={dismissToast} />
    </AppShell>
  );
}

export default AdminDashboardPage;

/* ============================================================================
   STYLES (scoped under .adm and .adm-* so they cannot leak into the rest of the app)
   ============================================================================ */

const STYLES = `
.adm{--ink:#070d1a;--panel:#0d1627;--panel2:#111c31;--line:#1d2a44;--line2:#2a3b5e;--text:#e6edf8;--mute:#8b9bb8;--dim:#5d6f91;
--sky:#38bdf8;--green:#34d399;--amber:#fbbf24;--red:#f87171;--purple:#c4a1ff;--r:12px;
color:var(--text);font-variant-numeric:tabular-nums;max-width:1280px;margin:0 auto;padding-bottom:64px}
.adm *{box-sizing:border-box}
.adm h1,.adm h2,.adm h3,.adm h4,.adm p{margin:0}
.adm-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;padding:26px 28px;margin-bottom:16px;border-radius:16px;
background:linear-gradient(135deg,#0f1d36 0%,#0a1324 60%);border:1px solid var(--line2);position:relative;overflow:hidden}
.adm-hero:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 47px,rgba(56,189,248,.05) 47px 48px),repeating-linear-gradient(0deg,transparent 0 47px,rgba(56,189,248,.05) 47px 48px);pointer-events:none}
.adm-hero>*{position:relative}
.adm-hero h1{font-size:28px;font-weight:800;letter-spacing:-.02em}
.adm-hero p{color:var(--mute);margin-top:6px;font-size:14px;max-width:520px;line-height:1.5}
.adm-hero-side{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.adm-hero-side small{color:var(--dim);font-size:12px}
.adm-sync{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:5px 11px;border-radius:999px;border:1px solid}
.adm-sync.on{color:var(--green);border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.08)}
.adm-sync.off{color:var(--red);border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.08)}
.adm-banner{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:var(--r);margin-bottom:14px;font-size:13px}
.adm-banner.error{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.3);color:#fecaca}
.adm-banner span{flex:1}
.adm-tabs{position:sticky;top:0;z-index:20;display:flex;gap:6px;overflow-x:auto;padding:8px;margin-bottom:14px;background:rgba(7,13,26,.88);backdrop-filter:blur(10px);border:1px solid var(--line);border-radius:14px;scrollbar-width:thin}
.adm-tab{display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--mute);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}
.adm-tab:hover{background:var(--panel2);color:var(--text)}
.adm-tab.on{background:rgba(56,189,248,.12);border-color:rgba(56,189,248,.45);color:var(--sky)}
.adm-tab em{font-style:normal;font-size:11px;padding:1px 7px;border-radius:999px;background:var(--line);color:var(--text)}
.adm-tab.on em{background:#0369a1}
.adm-tab em.live{background:#b45309;animation:adm-pulse 1.6s ease-in-out infinite}
.adm-search{position:relative;max-width:420px;margin-bottom:14px}
.adm-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--dim)}
.adm-search .adm-input{padding-left:36px}
.adm-stack{display:flex;flex-direction:column;gap:18px}.adm-stack.tight{gap:10px}
.adm-panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px}
.adm-hero-panel{border-color:var(--line2)}
.adm-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:16px}
.adm-panel-head h2{font-size:17px;font-weight:700;letter-spacing:-.01em}
.adm-panel-head p{font-size:13px;color:var(--mute);margin-top:3px}
.adm-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}.adm-grid-2.tight{gap:12px}.adm-grid-2.narrow-first{grid-template-columns:1fr 2fr}
.adm-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.adm-grid-3.tight{gap:12px}
.adm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
.adm-kpi{padding:16px 18px;background:var(--panel);border:1px solid var(--line);border-radius:14px;border-left:3px solid var(--c)}
.adm-kpi.green{--c:var(--green)}.adm-kpi.blue{--c:var(--sky)}.adm-kpi.amber{--c:var(--amber)}.adm-kpi.purple{--c:var(--purple)}
.adm-kpi-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--mute)}
.adm-kpi-top svg{color:var(--c)}
.adm-kpi-val{font-size:30px;font-weight:800;margin-top:6px;color:var(--c);letter-spacing:-.02em}
.adm-kpi-val small{font-size:12px;font-weight:500;color:var(--dim);margin-left:6px;letter-spacing:0}
.adm-chips{display:flex;gap:8px;flex-wrap:wrap}
.adm-chip{font-size:12px;color:var(--mute);padding:5px 11px;border:1px solid var(--line);border-radius:999px;background:var(--panel)}
.adm-chip b{color:var(--text);margin-right:3px}
.adm-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
.adm-table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.adm-table th{text-align:left;font-weight:600;font-size:12px;color:var(--mute);padding:11px 14px;background:var(--panel2);border-bottom:1px solid var(--line);white-space:nowrap}
.adm-table td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
.adm-table tbody tr:last-child td{border-bottom:0}
.adm-table tbody tr:hover{background:rgba(56,189,248,.04)}
.adm-table tr.dim{opacity:.55}
.adm-table.clickable tbody tr{cursor:pointer}
.adm-table.clickable tbody tr:focus-visible{outline:2px solid var(--sky);outline-offset:-2px}
.adm-table td strong{display:block;font-weight:600}
.adm-table td small,.adm-row small{display:block;color:var(--dim);font-size:11.5px;margin-top:2px}
.adm-table .num{font-weight:600}.adm-table .good{color:var(--green)}.adm-table .right,.adm .right{text-align:right}
.adm-mono,.adm .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.adm .warn{color:var(--amber)}
.adm-muted,.adm .adm-muted{color:var(--mute)}.adm-accent{color:var(--sky)}
.adm-timer{display:flex;flex-direction:column;gap:5px;min-width:96px}
.adm-bar{height:4px;background:var(--line);border-radius:4px;overflow:hidden}
.adm-bar i{display:block;height:100%;background:var(--sky);transition:width 1s linear}
.adm-bar i.warn{background:var(--amber)}
.adm-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.adm-list.scroll{max-height:300px;overflow-y:auto;padding-right:4px}
.adm-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:var(--ink);border:1px solid var(--line)}
.adm-row.box{padding:12px 14px}
.adm-row.ev.ok{border-left:3px solid var(--green)}.adm-row.ev.bad{border-left:3px solid var(--red)}
.adm-row strong{font-size:13px;font-weight:600}
.adm-row .right{display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.grow{flex:1;min-width:0}
.adm-score{font-weight:800;color:var(--sky);font-size:15px}
.adm-rank{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:8px;background:var(--line);font-size:12px;font-weight:700}
.adm-rank.r1{background:#f59e0b;color:#1c1203}.adm-rank.r2{background:#cbd5e1;color:#0f172a}.adm-rank.r3{background:#c2763a;color:#1a0d03}
.adm-badge{display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid;margin-left:0;white-space:nowrap}
td strong+.adm-badge,.adm-faq .adm-badge{margin-top:4px}
.adm-badge.green{color:var(--green);background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.3)}
.adm-badge.amber{color:var(--amber);background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.3)}
.adm-badge.red{color:var(--red);background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3)}
.adm-badge.blue{color:var(--sky);background:rgba(56,189,248,.1);border-color:rgba(56,189,248,.3)}
.adm-badge.purple{color:var(--purple);background:rgba(196,161,255,.1);border-color:rgba(196,161,255,.3)}
.adm-badge.gray{color:var(--mute);background:var(--panel2);border-color:var(--line2)}
.adm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:background .15s,border-color .15s,transform .05s;white-space:nowrap}
.adm-btn:active:not(:disabled){transform:translateY(1px)}
.adm-btn:disabled,.adm-icon-btn:disabled{opacity:.45;cursor:not-allowed}
.adm-btn.sm{padding:6px 10px;font-size:12px;border-radius:8px}
.adm-btn.primary{background:#0ea5e9;color:#02131f}.adm-btn.primary:hover:not(:disabled){background:#38bdf8}
.adm-btn.ghost{background:transparent;color:var(--text);border-color:var(--line2)}.adm-btn.ghost:hover:not(:disabled){background:var(--panel2);border-color:var(--sky)}
.adm-btn.success{background:rgba(52,211,153,.12);color:var(--green);border-color:rgba(52,211,153,.35)}
.adm-btn.warn{background:rgba(251,191,36,.12);color:var(--amber);border-color:rgba(251,191,36,.4)}.adm-btn.warn:hover{background:rgba(251,191,36,.2)}
.adm-btn.danger{background:transparent;color:var(--red);border-color:rgba(248,113,113,.35)}.adm-btn.danger:hover:not(:disabled){background:rgba(248,113,113,.1)}
.adm-btn.danger-solid{background:#dc2626;color:#fff}.adm-btn.danger-solid:hover:not(:disabled){background:#ef4444}
.adm-icon-btn{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--mute);cursor:pointer}
.adm-icon-btn:hover:not(:disabled){background:var(--panel2);color:var(--text)}.adm-icon-btn.danger:hover{color:var(--red);background:rgba(248,113,113,.1)}
.adm :focus-visible,.adm-overlay :focus-visible{outline:2px solid var(--sky);outline-offset:2px}
.adm-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.adm-input,.adm-select{width:100%;font:inherit;font-size:13.5px;color:var(--text);background:var(--ink);border:1px solid var(--line2);border-radius:10px;padding:9px 12px;min-height:38px}
textarea.adm-input{resize:vertical}
.adm-input::placeholder{color:var(--dim)}
.adm-input:focus,.adm-select:focus{outline:none;border-color:var(--sky);box-shadow:0 0 0 3px rgba(56,189,248,.18)}
.adm-input:disabled,.adm-select:disabled{opacity:.5;cursor:not-allowed}
.adm-select.sm{min-height:32px;padding:4px 8px;font-size:12px;width:auto}
.adm-field{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--mute);font-weight:600}
.adm-field small{font-weight:400;color:var(--dim)}
.adm-label{display:block;font-size:12.5px;color:var(--mute);font-weight:600;margin-bottom:8px}
.adm-form{display:flex;flex-direction:column;gap:14px}
.adm-check{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--ink);cursor:pointer}
.adm-check input{margin-top:3px;accent-color:#0ea5e9}.adm-check strong{display:block;font-size:13px}.adm-check small{color:var(--dim);font-size:12px}
.adm-segment{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:var(--ink);border:1px solid var(--line);margin-bottom:16px;flex-wrap:wrap}
.adm-segment button{font:inherit;font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:8px;border:0;background:transparent;color:var(--mute);cursor:pointer}
.adm-segment button.on{background:rgba(56,189,248,.16);color:var(--sky)}
.adm-box{background:var(--ink);border:1px solid var(--line);border-radius:12px;padding:14px}
.adm-box-actions{display:flex;flex-direction:column;gap:8px;justify-content:center}
.adm-tiebreak{list-style:decimal;margin:0;padding-left:20px;display:flex;flex-direction:column;gap:2px;font-size:12.5px}
.adm-tiebreak li{padding-left:4px}.adm-tiebreak li::marker{color:var(--dim)}
.adm-tiebreak li{display:list-item}
.adm-tiebreak li>span:first-child{display:inline}
.adm-tiebreak li>span:last-child{float:right;display:inline-flex}
.adm-tiebreak .adm-icon-btn{width:24px;height:24px}
.adm-puzzles{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.adm-puzzle{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:var(--ink);border:1px solid var(--line);transition:border-color .15s,opacity .15s}
.adm-puzzle[draggable=true]{cursor:grab}
.adm-puzzle.dragging{opacity:.4}.adm-puzzle.over{border-color:var(--sky);box-shadow:0 0 0 2px rgba(56,189,248,.25)}
.adm-puzzle img,.adm-thumb-empty{width:48px;height:48px;border-radius:8px;object-fit:cover;flex:none;background:var(--panel2)}
.adm-thumb-empty{display:grid;place-items:center;color:var(--dim)}
.adm-puzzle strong{font-size:14px}.adm-puzzle small{display:block;color:var(--dim);font-size:12px;margin-top:2px}
.adm-order{font-weight:800;color:var(--sky);min-width:22px;text-align:center}
.adm-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}.adm-cards.tight{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.adm-round{display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:14px;background:var(--ink);border:1px solid var(--line);border-top:3px solid var(--line2)}
.adm-round.green{border-top-color:var(--green)}.adm-round.blue{border-top-color:var(--sky)}.adm-round.purple{border-top-color:var(--purple)}.adm-round.red{border-top-color:var(--red)}
.adm-round-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.adm-round h3{font-size:16px;font-weight:700}
.adm-round>p{font-size:13px;color:var(--mute);line-height:1.5;flex:1}
.adm-meta{display:flex;gap:18px;flex-wrap:wrap;margin:0;padding:10px 12px;border-radius:10px;background:var(--panel);font-size:12px}
.adm-meta dt{color:var(--dim)}.adm-meta dd{margin:2px 0 0;font-weight:700;color:var(--text);text-transform:capitalize}
.adm-meta.stacked{margin-bottom:12px;flex-direction:column;gap:8px}.adm-meta.stacked dd{text-transform:none;font-weight:600}
.adm-status-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px;background:var(--panel);border-radius:10px}
.adm-status-btns button{display:inline-flex;align-items:center;justify-content:center;gap:4px;font:inherit;font-size:11.5px;font-weight:600;padding:7px 4px;border-radius:7px;border:0;background:transparent;color:var(--mute);cursor:pointer}
.adm-status-btns button:hover:not(:disabled){background:var(--panel2);color:var(--text)}
.adm-status-btns button.on{background:rgba(56,189,248,.18);color:var(--sky);opacity:1;cursor:default}
.adm-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:rgba(56,189,248,.12);color:var(--sky);flex:none}
.adm-inline-form{display:flex;gap:10px;margin-bottom:18px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--ink);flex-wrap:wrap}
.adm-input-icon{position:relative;flex:1;min-width:240px}.adm-input-icon svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--sky)}.adm-input-icon .adm-input{padding-left:36px}
.adm-faq{display:flex;gap:16px;align-items:flex-start;padding:16px 18px;border-radius:12px;background:var(--ink);border:1px solid var(--line)}
.adm-faq h4{font-size:15px;margin:8px 0 6px}.adm-faq p{font-size:13px;color:var(--mute);line-height:1.55;white-space:pre-wrap}
.adm-puzzle-form{display:grid;grid-template-columns:1.6fr 1fr;gap:20px}
.adm-preview{display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;padding:14px;border-radius:12px;background:var(--ink);border:1px solid var(--line);min-height:220px}
.adm-preview-img{position:relative;width:100%;line-height:0}.adm-preview-img img{width:100%;max-height:260px;object-fit:contain;border-radius:8px}
.adm-preview-grid{position:absolute;inset:0;display:grid;pointer-events:none}.adm-preview-grid span{border:1px solid rgba(255,255,255,.55);box-shadow:inset 0 0 0 1px rgba(0,0,0,.3)}
.adm-pieces{display:grid;gap:8px;margin-top:18px}
.adm-pieces figure{margin:0;padding:5px;text-align:center;background:var(--ink);border:1px solid var(--line);border-radius:8px;min-width:0}
.adm-pieces img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;display:block}
.adm-pieces figcaption{font-size:9px;color:var(--sky);margin-top:3px;overflow-wrap:anywhere}
.adm-json{margin:0;max-height:320px;overflow:auto;padding:14px;border-radius:10px;background:var(--ink);border:1px solid var(--line);font-size:12px;line-height:1.5;color:#cbd5e1}
.adm-pager{display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:12.5px;color:var(--mute)}
.adm-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:36px 16px;color:var(--dim)}
.adm-empty strong{color:var(--mute);font-size:14px}.adm-empty p{font-size:12.5px;max-width:320px}
.adm-empty .adm-btn{margin-top:8px}
.adm-skel-wrap{display:flex;flex-direction:column;gap:10px}
.adm-skel{height:44px;border-radius:10px;background:linear-gradient(90deg,var(--panel2) 25%,var(--line) 50%,var(--panel2) 75%);background-size:200% 100%;animation:adm-shimmer 1.4s infinite}
.adm-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(2,6,15,.72);backdrop-filter:blur(4px);overflow-y:auto}
.adm-modal{width:100%;background:#0d1627;color:#e6edf8;border:1px solid #2a3b5e;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.6);display:flex;flex-direction:column;max-height:calc(100vh - 40px);animation:adm-pop .16s ease-out}
.adm-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px 22px 0}
.adm-modal-head h3{font-size:18px;font-weight:700;margin:0}.adm-modal-head p{font-size:13px;color:#8b9bb8;margin:4px 0 0}
.adm-modal-body{padding:18px 22px;overflow-y:auto}
.adm-modal-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 22px;border-top:1px solid #1d2a44}
.adm-confirm-text{font-size:14px;line-height:1.6;color:#cbd5e1;margin:0}
.adm-overlay .adm-field{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:#8b9bb8;font-weight:600}
.adm-overlay .adm-field small{font-weight:400;color:#5d6f91}
.adm-overlay .adm-form{display:flex;flex-direction:column;gap:14px}
.adm-overlay .adm-grid-2,.adm-overlay .adm-grid-3{display:grid;gap:12px}.adm-overlay .adm-grid-2{grid-template-columns:1fr 1fr}.adm-overlay .adm-grid-2.narrow-first{grid-template-columns:1fr 2fr}.adm-overlay .adm-grid-3{grid-template-columns:repeat(3,1fr)}
.adm-overlay .adm-input,.adm-overlay .adm-select{width:100%;font:inherit;font-size:13.5px;color:#e6edf8;background:#070d1a;border:1px solid #2a3b5e;border-radius:10px;padding:9px 12px;min-height:38px}
.adm-overlay .adm-input:focus,.adm-overlay .adm-select:focus{outline:none;border-color:#38bdf8;box-shadow:0 0 0 3px rgba(56,189,248,.18)}
.adm-overlay .adm-input:disabled{opacity:.5}
.adm-overlay .adm-btn,.adm-overlay .adm-icon-btn,.adm-toasts button{font:inherit}
.adm-overlay .adm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;border:1px solid transparent;cursor:pointer}
.adm-overlay .adm-btn.primary{background:#0ea5e9;color:#02131f}.adm-overlay .adm-btn.ghost{background:transparent;color:#e6edf8;border-color:#2a3b5e}
.adm-overlay .adm-btn.danger-solid{background:#dc2626;color:#fff}.adm-overlay .adm-btn:disabled{opacity:.45;cursor:not-allowed}
.adm-overlay .adm-icon-btn{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:#8b9bb8;cursor:pointer}
.adm-overlay .adm-check{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid #1d2a44;border-radius:10px;background:#070d1a;cursor:pointer}
.adm-overlay .adm-check strong{display:block;font-size:13px}.adm-overlay .adm-check small{color:#5d6f91;font-size:12px;display:block}
.adm-overlay .adm-puzzle-form{display:grid;grid-template-columns:1.6fr 1fr;gap:20px}
.adm-overlay .adm-preview{display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;padding:14px;border-radius:12px;background:#070d1a;border:1px solid #1d2a44;min-height:220px}
.adm-overlay .adm-preview-img{position:relative;width:100%;line-height:0}.adm-overlay .adm-preview-img img{width:100%;max-height:260px;object-fit:contain;border-radius:8px}
.adm-overlay .adm-preview-grid{position:absolute;inset:0;display:grid;pointer-events:none}.adm-overlay .adm-preview-grid span{border:1px solid rgba(255,255,255,.55)}
.adm-overlay .adm-pieces{display:grid;gap:8px;margin-top:18px}
.adm-overlay .adm-pieces figure{margin:0;padding:5px;text-align:center;background:#070d1a;border:1px solid #1d2a44;border-radius:8px;min-width:0}
.adm-overlay .adm-pieces img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;display:block}
.adm-overlay .adm-pieces figcaption{font-size:9px;color:#38bdf8;margin-top:3px;overflow-wrap:anywhere;font-family:ui-monospace,monospace}
.adm-overlay .adm-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:24px 12px;color:#5d6f91}
.adm-overlay .adm-empty strong{color:#8b9bb8;font-size:14px}.adm-overlay .adm-empty p{font-size:12.5px}
.adm-overlay .adm-meta{display:flex;gap:18px;margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#111c31;font-size:12px;flex-direction:column}
.adm-overlay .adm-meta div{display:flex;gap:10px}.adm-overlay .adm-meta dt{color:#5d6f91;min-width:100px}.adm-overlay .adm-meta dd{margin:0;font-weight:600}
.adm-overlay .adm-json{margin:0;max-height:320px;overflow:auto;padding:14px;border-radius:10px;background:#070d1a;border:1px solid #1d2a44;font-size:12px;line-height:1.5;color:#cbd5e1}
.adm-overlay .adm-muted{color:#8b9bb8}
.adm-toasts{position:fixed;right:20px;bottom:20px;z-index:1100;display:flex;flex-direction:column;gap:8px;max-width:min(380px,calc(100vw - 40px))}
.adm-toast{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;font-size:13px;font-weight:500;background:#0d1627;border:1px solid #2a3b5e;box-shadow:0 12px 30px rgba(0,0,0,.45);animation:adm-pop .18s ease-out;color:#e6edf8}
.adm-toast.success{border-color:rgba(52,211,153,.5)}.adm-toast.success svg:first-child{color:#34d399}
.adm-toast.error{border-color:rgba(248,113,113,.55)}.adm-toast.error svg:first-child{color:#f87171}
.adm-toast span{flex:1}.adm-toast button{background:none;border:0;color:#8b9bb8;cursor:pointer;padding:2px;display:grid}
.spin{animation:adm-spin 1s linear infinite}
@keyframes adm-spin{to{transform:rotate(360deg)}}
@keyframes adm-pulse{50%{opacity:.55}}
@keyframes adm-shimmer{to{background-position:-200% 0}}
@keyframes adm-pop{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
@media (max-width:860px){
.adm-grid-2,.adm-grid-3,.adm-puzzle-form,.adm-overlay .adm-puzzle-form{grid-template-columns:1fr}
.adm-overlay .adm-grid-3{grid-template-columns:1fr}
.adm-hero{padding:20px}.adm-hero h1{font-size:23px}
.adm-puzzle{flex-wrap:wrap}.adm-faq{flex-direction:column}
.adm-cards{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){.adm *,.adm-overlay *,.adm-toasts *{animation:none!important;transition:none!important}}
`;