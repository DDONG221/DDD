export type PieceType = "p" | "r" | "n" | "b" | "q" | "k";
export type PieceColor = "w" | "b";

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  id: string; // Used as React key to manage piece animations elegantly
}

export interface GameMove {
  id: string;
  from: { row: number; col: number; squareName: string };
  to: { row: number; col: number; squareName: string };
  piece: ChessPiece;
  captured?: ChessPiece | null;
  notation: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderColor?: PieceColor | "spectator";
  text: string;
  timestamp: string;
}

export interface ChessRoom {
  id: string;
  name: string;
  creator: string;
  timeControl: number; // in minutes (e.g., 5, 10, 15, 30)
  status: "waiting" | "active" | "finished";
  board: (ChessPiece | null)[][]; // 8x8 board representation
  turn: PieceColor;
  players: {
    w: string | null; // Name of White player
    b: string | null; // Name of Black player
  };
  spectators: string[];
  moveHistory: GameMove[];
  chatLog: ChatMessage[];
  clocks: {
    w: number; // White clock in seconds
    b: number; // Black clock in seconds
  };
  isClockActive: boolean;
  winner: PieceColor | "draw" | null;
  reason?: string; // Checkmate, resignation, timeout, draw
  createdAt: string;
}
