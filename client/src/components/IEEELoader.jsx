import React from 'react';

export function IEEELoader({ label = 'AUTHENTICATING IEEE AGENT...' }) {
  return (
    <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center p-6 text-white select-none">
      {/* Glow Backdrop */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-36 h-36 bg-blue-500/20 rounded-full blur-2xl animate-pulse" />
        
        {/* Outer Rotating Ring */}
        <div className="w-28 h-28 border-2 border-transparent border-t-cyan-400 border-r-blue-600 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />

        {/* Counter Rotating Ring */}
        <div className="absolute w-20 h-20 border-2 border-transparent border-b-blue-400 border-l-indigo-500 rounded-full animate-spin" style={{ animationDuration: '2.5s', animationDirection: 'reverse' }} />

        {/* IEEE Logo Badge in Center */}
        <div className="absolute bg-[#0f1420] border border-blue-500/30 rounded-2xl p-3 shadow-xl flex items-center justify-center">
          <img src="/ieeesb_logo_theme.svg" alt="IEEE Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
        </div>
      </div>

      {/* Loading Label */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">{label}</span>
        </div>
        <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">IEEE SB NIT Durgapur · Cipher & Vision Platform</p>
      </div>
    </div>
  );
}

export default IEEELoader;
