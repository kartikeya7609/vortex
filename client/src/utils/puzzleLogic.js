// Flowchart-aligned Puzzle Architecture:
// 1. Assets Image -> 2. Grid Size -> 3. Divide Image -> 4. Random ID -> 5. Store correctPosition -> 6. Shuffle -> 7. Board -> 8. Player rearranges -> 9. SUBMIT ANSWER -> 10. Compare currentPosition with correctPosition -> TRUE (Correct) / FALSE (Wrong)

export const GRID_SIZES = [
  { size: 3, label: '3x3 (Easy)', total: 9 },
  { size: 4, label: '4x4 (Medium)', total: 16 },
  { size: 5, label: '5x5 (Classic)', total: 25 },
  { size: 6, label: '6x6 (Hard)', total: 36 }
];

export const GAME_MODES = {
  TRAY: 'tray',       // Drag pieces from tray onto board slots
  SWAP: 'swap'        // Direct board swap
};

/**
 * Generates a unique random piece ID
 */
function generateRandomPieceId() {
  return `piece-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Divides image and creates pieces with Random IDs and stored correctPosition
 */
export function createTiles(gridSize) {
  const total = gridSize * gridSize;
  const tiles = [];
  
  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    
    tiles.push({
      id: generateRandomPieceId(), // Give every piece a random ID
      correctIndex: i,             // Backward compatibility index
      correctPosition: {           // Store correctPosition
        index: i,
        row: row,
        col: col
      },
      row,
      col,
      // Calculate background position percentages (Divide image)
      bgX: gridSize > 1 ? (col / (gridSize - 1)) * 100 : 0,
      bgY: gridSize > 1 ? (row / (gridSize - 1)) * 100 : 0
    });
  }
  
  return tiles;
}

/**
 * Fisher-Yates Shuffle Pieces
 */
export function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Compares currentPosition with correctPosition (Submit Answer Validation)
 */
export function validateSolution(board, gridSize) {
  const total = gridSize * gridSize;
  if (!board || board.length !== total) {
    return { isCorrect: false, correctCount: 0, total, misplacedIndices: [] };
  }

  let correctCount = 0;
  const misplacedIndices = [];

  for (let currentPosition = 0; currentPosition < total; currentPosition++) {
    const piece = board[currentPosition];
    
    // Check if slot has a piece and its correctPosition matches currentPosition
    if (piece && piece.correctPosition?.index === currentPosition) {
      correctCount++;
    } else {
      misplacedIndices.push(currentPosition);
    }
  }

  const isCorrect = correctCount === total;
  return {
    isCorrect,
    correctCount,
    total,
    misplacedIndices
  };
}

/**
 * Helper to check if solved continuously
 */
export function checkIsSolved(board, gridSize) {
  const result = validateSolution(board, gridSize);
  return result.isCorrect;
}

/**
 * Calculates current completion percentage
 */
export function calculateProgress(board, gridSize) {
  const result = validateSolution(board, gridSize);
  return Math.round((result.correctCount / result.total) * 100);
}

/**
 * Formats seconds into MM:SS
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Evaluates hero rating based on turns and time
 */
export function getHeroRating(turns, timeInSeconds, gridSize) {
  const baseTurns = gridSize * gridSize * 1.5;
  if (turns <= baseTurns && timeInSeconds < 60) {
    return { title: 'Legendary Master', rank: 'S' };
  } else if (turns <= baseTurns * 2.2 && timeInSeconds < 180) {
    return { title: 'Avenger Rank', rank: 'A' };
  } else {
    return { title: 'Completed', rank: 'B' };
  }
}
