import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  User,
  Users,
  Trophy,
  BarChart2,
  FolderOpen,
  Bell,
  HelpCircle,
  Shield,
  LogOut,
  Menu,
  X,
  Gamepad2,
} from 'lucide-react';

const BASE_NAV_ITEMS = [
  { key: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard, path: '/dashboard' },
  { key: 'profile',       label: 'My Profile',     icon: User,            path: '/profile' },
  { key: 'team',          label: 'My Team',        icon: Users,           path: '/team' },
  { key: 'rounds',        label: 'Event Rounds',   icon: Trophy,          path: '/rounds' },
  { key: 'leaderboard',  label: 'Leaderboard',    icon: BarChart2,       path: '/leaderboard' },
  { key: 'help',         label: 'Help & Support', icon: HelpCircle,      path: '/help' },
];

export function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePath = location.pathname;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // For admins, do not show 'My Team'
  const navItems = BASE_NAV_ITEMS.filter((item) => {
    if (isAdmin && item.key === 'team') return false;
    return true;
  });

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="ieee-app-shell">
      {/* ── SIDEBAR (PRIMARY LEFT NAVBAR) ──────────────────── */}
      <aside className={`ieee-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div>
          {/* Brand */}
          <div className="ieee-brand">
            <img src="/ieeesb_logo_theme.svg" alt="IEEE SB Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
            <div>
              <strong>IEEE SB</strong>
              <span>NIT DURGAPUR</span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>VORTEX 2026</span>
            </div>
          </div>

          {/* Primary left nav */}
          <nav className="ieee-side-nav">
            {navItems.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                onClick={() => { navigate(path); setMobileMenuOpen(false); }}
                className={`ieee-nav-item${activePath === path ? ' active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}

            {/* Admin link for admins */}
            {isAdmin && (
              <button
                onClick={() => { navigate('/admin'); setMobileMenuOpen(false); }}
                className={`ieee-nav-item${activePath === '/admin' ? ' active' : ''}`}
                style={{ color: '#38bdf8', marginTop: '12px', border: '1px solid rgba(56,189,248,0.3)', background: activePath === '/admin' ? 'rgba(56,189,248,0.15)' : 'transparent' }}
              >
                <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Admin Console</span>
              </button>
            )}
          </nav>
        </div>

        {/* Sidebar footer */}
        <div className="ieee-sidebar-footer">
          <div className="ieee-footer-title">IEEE</div>
          <strong>IEEE SB<br />NIT DURGAPUR</strong>
          <div className="ieee-footer-links">
            <span>Connect</span>
            <span>Learn</span>
            <span>Build</span>
            <span>Belong</span>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="ieee-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── MAIN ────────────────────────────────────────────── */}
      <main className="ieee-main">

        {/* Minimal Top Header (User Actions & Mobile Menu) */}
        <header className="ieee-topbar">
          {/* Mobile menu toggle */}
          <button
            className="ieee-mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em' }}>
              AAROHAN 2026
            </span>
          </div>

          <div className="ieee-top-actions">
            <button
              onClick={() => navigate('/rounds')}
              className="ieee-portal-btn"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>EVENT PORTAL</span>
            </button>

            <button className="ieee-icon-btn" aria-label="Notifications">
              <Bell className="w-4 h-4" />
            </button>

            <div
              className="ieee-avatar-small"
              onClick={() => navigate('/profile')}
              title={user?.name}
              style={{ cursor: 'pointer' }}
            >
              {user?.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : userInitials}
            </div>

            <button
              onClick={handleLogout}
              className="ieee-icon-btn"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <section className="ieee-content">
          {children}
        </section>
      </main>
    </div>
  );
}
