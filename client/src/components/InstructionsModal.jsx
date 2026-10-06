import React from 'react';

export function InstructionsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box solid-panel instructions-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <h2 className="action-title modal-heading">HOW TO PLAY</h2>
          <button type="button" className="btn-icon-simple modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="instructions-list">
          <div className="rule-item">
            <h4 className="rule-title">1. Goal</h4>
            <p className="rule-desc">
              Arrange the image tiles on the board so they form the complete picture.
            </p>
          </div>

          <div className="rule-item">
            <h4 className="rule-title">2. Drag & Drop or Click to Swap</h4>
            <p className="rule-desc">
              Drag any piece into an empty slot or onto another piece to swap them. On phones and tablets, tap a piece to select it, then tap your target slot.
            </p>
          </div>

          <div className="rule-item">
            <h4 className="rule-title">3. Assists</h4>
            <p className="rule-desc">
              Use <strong>Preview</strong> to see the full image, <strong>Hint</strong> to show a ghost outline on the board, or <strong>Numbers</strong> to see tile numbers.
            </p>
          </div>
        </div>

        <div className="modal-bottom-actions">
          <button type="button" className="btn-game btn-red" onClick={onClose}>
            GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}
