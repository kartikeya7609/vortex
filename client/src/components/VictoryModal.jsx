import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { formatTime, getHeroRating } from '../utils/puzzleLogic';

export function VictoryModal({
  isOpen,
  onClose,
  turns,
  seconds,
  gridSize,
  onReplay,
  onNextLevel,
  canNextLevel,
  heroTitle
}) {
  useEffect(() => {
    if (isOpen) {
      // Confetti burst on solve
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ed1d24', '#f5a623', '#0070f3', '#ffffff']
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const rating = getHeroRating(turns, seconds, gridSize);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box solid-panel victory-box" onClick={(e) => e.stopPropagation()}>
        <div className="victory-badge-large">
          <span className="action-title victory-badge-letter">A</span>
        </div>

        <h2 className="action-title victory-main-title">PUZZLE SOLVED!</h2>
        <p className="victory-text">
          You completed {heroTitle || 'Avengers'} in {turns} turns.
        </p>

        {/* Clean Results Table (No 3-icon box row) */}
        <div className="victory-table">
          <div className="victory-row">
            <span className="victory-cell-label">TOTAL TURNS</span>
            <span className="victory-cell-val action-mono">{turns}</span>
          </div>
          <div className="victory-row">
            <span className="victory-cell-label">TIME ELAPSED</span>
            <span className="victory-cell-val action-mono">{formatTime(seconds)}</span>
          </div>
          <div className="victory-row">
            <span className="victory-cell-label">GRID SIZE</span>
            <span className="victory-cell-val action-mono">{gridSize}x{gridSize}</span>
          </div>
          <div className="victory-row rating-row">
            <span className="victory-cell-label">RATING</span>
            <span className="victory-cell-val action-title rating-val">{rating.title}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-bottom-actions">
          <button type="button" className="btn-game btn-red" onClick={onReplay}>
            PLAY AGAIN
          </button>

          {canNextLevel && (
            <button type="button" className="btn-game btn-gold-action" onClick={onNextLevel}>
              NEXT LEVEL ({gridSize + 1}x{gridSize + 1})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
