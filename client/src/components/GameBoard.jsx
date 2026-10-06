import React from 'react';

export function GameBoard({
  gridSize,
  board,
  imageSrc,
  selectedTile,
  onTileClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  dragOverTarget,
  showGhostHint,
  showNumbers,
  isSolved,
  submissionFeedback
}) {
  return (
    <div className="board-wrapper">
      {/* Submission Feedback Banner (Flowchart Validation result) */}
      {submissionFeedback && (
        <div className={`submission-banner ${submissionFeedback.isCorrect ? 'banner-correct' : 'banner-wrong'}`}>
          <span className="action-title banner-text">
            {submissionFeedback.isCorrect
              ? 'CORRECT: PUZZLE COMPLETED!'
              : `WRONG: ${submissionFeedback.correctCount} OF ${submissionFeedback.total} PIECES IN POSITION`}
          </span>
        </div>
      )}

      <div
        className={`game-board-grid ${isSolved ? 'board-solved' : ''} ${
          submissionFeedback && !submissionFeedback.isCorrect ? 'board-shake' : ''
        }`}
        style={{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize}, 1fr)`
        }}
      >
        {/* Ghost Hint Blueprint */}
        {showGhostHint && (
          <div
            className="ghost-blueprint-img"
            style={{ backgroundImage: `url(${imageSrc})` }}
          />
        )}

        {board.map((tile, index) => {
          const isSelected = selectedTile?.source === 'board' && selectedTile?.index === index;
          const isDragOver = dragOverTarget?.source === 'board' && dragOverTarget?.index === index;
          const isCorrect = tile && tile.correctPosition?.index === index;
          const isMisplaced = submissionFeedback && !submissionFeedback.isCorrect && (!tile || tile.correctPosition?.index !== index);
          const isEmpty = !tile;

          return (
            <div
              key={`board-slot-${index}`}
              className={`board-cell ${isEmpty ? 'cell-empty' : 'cell-filled'} ${
                isSelected ? 'cell-selected' : ''
              } ${isDragOver ? 'cell-hover' : ''} ${isCorrect ? 'cell-correct' : ''} ${
                isMisplaced ? 'cell-wrong' : ''
              }`}
              onClick={() => onTileClick({ source: 'board', index, tile })}
              onDragOver={(e) => onDragOver(e, { source: 'board', index })}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, { source: 'board', index })}
            >
              {tile ? (
                <div
                  className="tile-piece"
                  draggable={!isSolved}
                  onDragStart={(e) => onDragStart(e, { source: 'board', index, tile })}
                  onDragEnd={onDragEnd}
                  style={{
                    backgroundImage: `url(${imageSrc})`,
                    backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                    backgroundPosition: `${tile.bgX}% ${tile.bgY}%`
                  }}
                >


                  {/* Tile Number */}
                  {showNumbers && (
                    <span className="tile-number action-mono">
                      {tile.correctPosition ? tile.correctPosition.index + 1 : tile.correctIndex + 1}
                    </span>
                  )}
                </div>
              ) : (
                <div className="empty-cell-label">
                  <span className="cell-pos action-mono">
                    {Math.floor(index / gridSize) + 1}:{index % gridSize + 1}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
