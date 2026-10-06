import React from 'react';
import { formatTime } from '../utils/puzzleLogic';

export function StatsBar({
  turns,
  seconds,
  progress,
  bestScore,
  onReset
}) {
  return (
    <div className="scoreboard-container solid-panel">
      {/* Turns */}
      <div className="score-block">
        <span className="score-label">TURNS</span>
        <span className="score-value action-mono">{turns}</span>
      </div>

      {/* Time */}
      <div className="score-block">
        <span className="score-label">TIME</span>
        <span className="score-value action-mono">{formatTime(seconds)}</span>
      </div>

      {/* Accuracy */}
      <div className="score-block progress-score-block">
        <div className="score-label-row">
          <span className="score-label">ACCURACY</span>
          <span className="score-value-sm action-mono">{progress}%</span>
        </div>
        <div className="score-progress-track">
          <div
            className="score-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Best Score */}
      <div className="score-block">
        <span className="score-label">BEST RECORD</span>
        <span className="score-value action-mono">
          {bestScore ? `${bestScore} turns` : 'None'}
        </span>
      </div>
    </div>
  );
}
