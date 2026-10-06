import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserCheck, LogOut, Trophy, LayoutDashboard, Shield } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/dashboard') {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="w-full bg-[#0c0e14] border-b border-white/10 sticky top-0 z-50 shadow-md">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
        {/* Left Logo Badge */}
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center p-1.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition duration-200">
            <img src="/ieeesb_logo_theme.svg" alt="IEEE Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-white flex items-center gap-2 uppercase">
              VORTEX <span className="text-cyan-400 text-xs font-mono font-bold">2026</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">IEEE SB NIT DURGAPUR</p>
          </div>
        </Link>

        {/* Center Navigation Links (Matching Screenshot 2 Nav Pills) */}
        {user && (
          <nav className="hidden md:flex items-center gap-1.5 bg-[#161a24] p-1.5 rounded-full border border-white/5 shadow-inner">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white px-5 py-2 rounded-full bg-[#222938] shadow-sm transition"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
              Account
            </Link>

            <Link
              to="/game"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white px-5 py-2 rounded-full transition"
            >
              <Trophy className="w-3.5 h-3.5" />
              Rounds
            </Link>

            {(user.role === 'admin' || user.role === 'super_admin') && (
              <Link
                to="/admin"
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 px-5 py-2 rounded-full transition"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>
        )}

        {/* Right Action Items */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Blue Pill Action Button (Matching INSTALL APP in Screenshot 2) */}
            <Link
              to="/game"
              className="hidden sm:flex items-center gap-2 text-xs font-extrabold text-white uppercase tracking-wider bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-full shadow-[0_4px_20px_rgba(59,130,246,0.4)] transition-all active:scale-[0.98]"
            >
              Play Game
            </Link>

            {/* User Badge Chip (Matching Screenshot 2 Top Right Chip) */}
            <div className="flex items-center gap-2.5 bg-[#161a24] pl-2 pr-3 py-1.5 rounded-full border border-white/5 shadow-sm">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                alt={user.name}
                className="w-7 h-7 rounded-full object-cover ring-2 ring-emerald-500/40"
              />
              <div className="text-left text-xs font-bold uppercase font-mono">
                <span className="text-white block text-[11px] leading-none truncate max-w-[100px]">{user.name}</span>
                <span className="text-emerald-400 text-[10px] font-semibold">Score: {user?.stats?.totalScore || 0}</span>
              </div>

              {/* Sign Out Icon */}
              <button
                onClick={handleLogout}
                className="ml-1 p-1 text-slate-400 hover:text-red-400 rounded-full transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
