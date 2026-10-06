import React from 'react';
import { GRID_SIZES, GAME_MODES } from '../utils/puzzleLogic';

export function Controls({
  gridSize,
  onChangeGridSize,
  gameMode,
  onChangeGameMode,
  onShuffle,
  onSubmitAnswer,
  onToggleGhostHint,
  showGhostHint,
  onToggleNumbers,
  showNumbers,
  onOpenPreview,
  onAutoSolve,
  isSolving
}) {
  return (
    <div className="controls-container solid-panel">
      {/* Modes & Grid Dimensions */}
      <div className="controls-options-row">
        {/* Game Mode */}
        <div className="control-group">
          <span className="control-label">GAME MODE</span>
          <div className="segmented-tabs">
            <button
              type="button"
              className={`tab-btn ${gameMode === GAME_MODES.TRAY ? 'tab-active' : ''}`}
              onClick={() => onChangeGameMode(GAME_MODES.TRAY)}
            >
              Assemble Tray
            </button>
            <button
              type="button"
              className={`tab-btn ${gameMode === GAME_MODES.SWAP ? 'tab-active' : ''}`}
              onClick={() => onChangeGameMode(GAME_MODES.SWAP)}
            >
              Board Swap
            </button>
          </div>
        </div>

        {/* Grid Size */}
        <div className="control-group">
          <span className="control-label">GRID SIZE</span>
          <div className="segmented-tabs">
            {GRID_SIZES.map((item) => (
              <button
                key={item.size}
                type="button"
                className={`tab-btn ${gridSize === item.size ? 'tab-active' : ''}`}
                onClick={() => onChangeGridSize(item.size)}
              >
                {item.size}x{item.size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="controls-actions-row">
        <button
          type="button"
          className="btn-game btn-gold-action submit-btn"
          onClick={onSubmitAnswer}
          title="Compare currentPosition with correctPosition"
        >
          SUBMIT ANSWER
        </button>

        <button
          type="button"
          className="btn-game btn-red"
          onClick={onShuffle}
        >
          SHUFFLE
        </button>


        <button
          type="button"
          className={`btn-game ${showGhostHint ? 'btn-gold-action' : 'btn-dark'}`}
          onClick={onToggleGhostHint}
        >
          {showGhostHint ? 'HINT: ON' : 'HINT'}
        </button>


      </div>
    </div>
  );
}
