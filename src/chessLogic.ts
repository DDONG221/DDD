import { ChessPiece, PieceColor, PieceType, GameMove } from "./types";

// Generate unique IDs for chess pieces to support React key animations
export function createInitialBoard(): (ChessPiece | null)[][] {
  const board: (ChessPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  const backRow: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

  // Black pieces setup (row 0 & 1)
  for (let col = 0; col < 8; col++) {
    board[0][col] = {
      type: backRow[col],
      color: "b",
      id: `b_${backRow[col]}_${col}`,
    };
    board[1][col] = {
      type: "p",
      color: "b",
      id: `b_pawn_${col}`,
    };
  }

  // White pieces setup (row 6 & 7)
  for (let col = 0; col < 8; col++) {
    board[6][col] = {
      type: "p",
      color: "w",
      id: `w_pawn_${col}`,
    };
    board[7][col] = {
      type: backRow[col],
      color: "w",
      id: `w_${backRow[col]}_${col}`,
    };
  }

  return board;
}

export function getSquareName(row: number, col: number): string {
  const file = String.fromCharCode(97 + col); // 97 is 'a'
  const rank = 8 - row;
  return `${file}${rank}`;
}

export function isKingInCheck(
  board: (ChessPiece | null)[][],
  color: PieceColor
): boolean {
  // 1. Locate King of the given color
  let kingRow = -1;
  let kingCol = -1;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === "k" && piece.color === color) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  // If no king is found (shouldn't happen in a normal game), return false
  if (kingRow === -1 || kingCol === -1) return false;

  // 2. Check if any opponent piece can legally capture that King
  const opponentColor = color === "w" ? "b" : "w";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === opponentColor) {
        // Evaluate move validation WITHOUT checking recursive king safety to avoid infinite loop
        if (isValidMoveInternal(r, c, kingRow, kingCol, board)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Basic move rules for each piece without considering self-check
function isValidMoveInternal(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  board: (ChessPiece | null)[][]
): boolean {
  // Boundary check
  if (
    fromRow < 0 ||
    fromRow > 7 ||
    fromCol < 0 ||
    fromCol > 7 ||
    toRow < 0 ||
    toRow > 7 ||
    toCol < 0 ||
    toCol > 7
  ) {
    return false;
  }

  const piece = board[fromRow][fromCol];
  if (!piece) return false;

  // Cannot move to the same square
  if (fromRow === toRow && fromCol === toCol) return false;

  const targetPiece = board[toRow][toCol];
  // Cannot capture teammate
  if (targetPiece && targetPiece.color === piece.color) return false;

  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;

  switch (piece.type) {
    case "p": {
      const dir = piece.color === "w" ? -1 : 1; // White moves up (indices decrease), Black moves down

      // Moving 1 square forward
      if (rowDiff === dir && colDiff === 0 && !targetPiece) {
        return true;
      }

      // Moving 2 squares forward from starting rank
      const startRank = piece.color === "w" ? 6 : 1;
      if (
        fromRow === startRank &&
        rowDiff === 2 * dir &&
        colDiff === 0 &&
        !targetPiece &&
        !board[fromRow + dir][fromCol]
      ) {
        return true;
      }

      // capturing diagonally
      if (
        rowDiff === dir &&
        Math.abs(colDiff) === 1 &&
        targetPiece &&
        targetPiece.color !== piece.color
      ) {
        return true;
      }

      return false;
    }

    case "r": {
      // Must move along straight line
      if (fromRow !== toRow && fromCol !== toCol) return false;

      // Check path collision
      const rStep = fromRow === toRow ? 0 : rowDiff > 0 ? 1 : -1;
      const cStep = fromCol === toCol ? 0 : colDiff > 0 ? 1 : -1;

      let r = fromRow + rStep;
      let c = fromCol + cStep;
      while (r !== toRow || c !== toCol) {
        if (board[r][c] !== null) return false; // Path blocked
        r += rStep;
        c += cStep;
      }

      return true;
    }

    case "n": {
      // L shape: 2x1 or 1x2 movement
      const rAbs = Math.abs(rowDiff);
      const cAbs = Math.abs(colDiff);
      return (rAbs === 2 && cAbs === 1) || (rAbs === 1 && cAbs === 2);
    }

    case "b": {
      // Diagonal check
      if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;

      // Check path collision
      const rStep = rowDiff > 0 ? 1 : -1;
      const cStep = colDiff > 0 ? 1 : -1;

      let r = fromRow + rStep;
      let c = fromCol + cStep;
      while (r !== toRow && c !== toCol) {
        if (board[r][c] !== null) return false; // Path blocked
        r += rStep;
        c += cStep;
      }

      return true;
    }

    case "q": {
      // Rook + Bishop movement combined
      const isLinear = fromRow === toRow || fromCol === toCol;
      const isDiagonal = Math.abs(rowDiff) === Math.abs(colDiff);

      if (!isLinear && !isDiagonal) return false;

      // Path check
      const rStep = rowDiff === 0 ? 0 : rowDiff > 0 ? 1 : -1;
      const cStep = colDiff === 0 ? 0 : colDiff > 0 ? 1 : -1;

      let r = fromRow + rStep;
      let c = fromCol + cStep;
      while (r !== toRow || c !== toCol) {
        if (board[r][c] !== null) return false;
        r += rStep;
        c += cStep;
      }

      return true;
    }

    case "k": {
      // Normal: 1 square in any direction
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    }

    default:
      return false;
  }
}

// Full move verification including testing for put-in-check rules
export function isValidMove(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  board: (ChessPiece | null)[][],
  checkKingSafety = true
): boolean {
  // Validate basic path and coordinate rules first
  if (!isValidMoveInternal(fromRow, fromCol, toRow, toCol, board)) {
    return false;
  }

  if (checkKingSafety) {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;

    // Simulate move to ensure it does not put or keep current player's King in check
    const copiedBoard = board.map((row) => [...row]);
    copiedBoard[toRow][toCol] = piece;
    copiedBoard[fromRow][fromCol] = null;

    if (isKingInCheck(copiedBoard, piece.color)) {
      return false; // Leave or put King in check, illegal move!
    }
  }

  return true;
}

// Returns a full list of valid destinations for a given piece
export function getValidMovesForPiece(
  row: number,
  col: number,
  board: (ChessPiece | null)[][]
): { row: number; col: number }[] {
  const piece = board[row][col];
  if (!piece) return [];

  const moves: { row: number; col: number }[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      // Allow pieces to move freely without blocking when King is in check,
      // enabling other pieces to move as requested by the user.
      if (isValidMove(row, col, r, c, board, false)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
}

// Check if a player has any valid/legal moves left
export function hasLegalMoves(
  board: (ChessPiece | null)[][],
  color: PieceColor
): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const moves = getValidMovesForPiece(r, c, board);
        if (moves.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// Determines if color is in checkmate
export function isCheckmate(
  board: (ChessPiece | null)[][],
  color: PieceColor
): boolean {
  return isKingInCheck(board, color) && !hasLegalMoves(board, color);
}

// Determines if color has stalemated (draw)
export function isStalemate(
  board: (ChessPiece | null)[][],
  color: PieceColor
): boolean {
  return !isKingInCheck(board, color) && !hasLegalMoves(board, color);
}

// Generate Standard Chess Algebraic Notation (like Nf3, Qxd4, e4, etc.)
export function generateMoveNotation(
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  board: (ChessPiece | null)[][],
  targetPiece: ChessPiece | null
): string {
  const piece = board[fromRow][fromCol];
  if (!piece) return "";

  const destSquare = getSquareName(toRow, toCol);
  const isCapture = targetPiece !== null;

  if (piece.type === "p") {
    if (isCapture) {
      const origFile = String.fromCharCode(97 + fromCol);
      return `${origFile}x${destSquare}`;
    }
    return destSquare;
  }

  const pieceLetter = piece.type.toUpperCase();
  const captureIndicator = isCapture ? "x" : "";

  // Check if check or checkmate will occur
  const copiedBoard = board.map((row) => [...row]);
  copiedBoard[toRow][toCol] = piece;
  copiedBoard[fromRow][fromCol] = null;

  const nextColor = piece.color === "w" ? "b" : "w";
  let suffix = "";
  if (isCheckmate(copiedBoard, nextColor)) {
    suffix = "#";
  } else if (isKingInCheck(copiedBoard, nextColor)) {
    suffix = "+";
  }

  return `${pieceLetter}${captureIndicator}${destSquare}${suffix}`;
}

// Optional synthesized sound effect using Web Audio API so moves feel amazing!
export function playChessSound(type: "move" | "capture" | "check" | "gameover") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === "move") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "capture") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(250, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === "check") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "gameover") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    // Soft ignore browser block on AudioContext initialization before user interaction
  }
}
