import React from 'react';

export function Header({
  soundMuted,
  onToggleSound,
  theme,
  onToggleTheme,
  onOpenHelp,
  onOpenImagePicker,
  currentPreset
}) {
  return (
    <header className="header-container solid-panel">
      <div className="header-brand">
        <div className="avengers-logo-badge" style={{ backgroundColor: 'transparent', border: 'none' }}>
          <img src="/logo.svg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div className="brand-text">
          <h1 className="action-title brand-title">AVENGERS PUZZLE</h1>
          <p className="brand-subtitle">IEEE SB NITDGP</p>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="btn-game btn-dark"
          onClick={onOpenImagePicker}
        >
          Artwork: {currentPreset?.title?.split(' ')[0] || 'Image'}
        </button>

        <button
          type="button"
          className="btn-game btn-dark"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
        </button>


        <button
          type="button"
          className="btn-icon-simple"
          onClick={onOpenHelp}
          title="How to play"
          aria-label="Help"
        >
          ?
        </button>
      </div>
    </header>
  );
}
