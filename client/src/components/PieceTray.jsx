import React from 'react';

export function PieceTray({
  pieces,
  gridSize,
  imageSrc,
  selectedTile,
  onTileClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dragOverTarget,
  showNumbers,
  isSolved
}) {
  const remainingCount = pieces.filter((p) => p !== null).length;

  if (remainingCount === 0 && !isSolved) {
    return (
      <div className="tray-panel solid-panel tray-all-placed">
        <p className="tray-empty-text">All pieces placed on the board. Swap pieces to solve the puzzle.</p>
      </div>
    );
  }

  if (isSolved) {
    return null;
  }

  return (
    <div className="tray-panel solid-panel">
      <div className="tray-header">
        <h3 className="action-title tray-title">PIECES TRAY</h3>
        <span className="tray-counter action-mono">{remainingCount} PIECES LEFT</span>
      </div>

      <div
        className="tray-grid"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${gridSize >= 5 ? '64px' : '76px'}, 1fr))`
        }}
      >
        {pieces.map((tile, index) => {
          const isSelected = selectedTile?.source === 'tray' && selectedTile?.index === index;
          const isDragOver = dragOverTarget?.source === 'tray' && dragOverTarget?.index === index;

          if (!tile) {
            return (
              <div
                key={`tray-slot-${index}`}
                className={`tray-cell cell-empty ${isDragOver ? 'cell-hover' : ''}`}
                onDragOver={(e) => onDragOver(e, { source: 'tray', index })}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, { source: 'tray', index })}
                onClick={() => onTileClick({ source: 'tray', index, tile: null })}
              >
                <span className="empty-slot-num action-mono">#{index + 1}</span>
              </div>
            );
          }

          return (
            <div
              key={`tray-tile-${tile.id}-${index}`}
              className={`tray-cell cell-filled ${isSelected ? 'cell-selected' : ''} ${
                isDragOver ? 'cell-hover' : ''
              }`}
              onClick={() => onTileClick({ source: 'tray', index, tile })}
              onDragOver={(e) => onDragOver(e, { source: 'tray', index })}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, { source: 'tray', index })}
            >
              <div
                className="tile-piece"
                draggable
                onDragStart={(e) => onDragStart(e, { source: 'tray', index, tile })}
                onDragEnd={onDragEnd}
                style={{
                  backgroundImage: `url(${imageSrc})`,
                  backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                  backgroundPosition: `${tile.bgX}% ${tile.bgY}%`
                }}
              >
                {showNumbers && (
                  <span className="tile-number action-mono">
                    {tile.correctIndex + 1}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
