import React from "react";
import { ChessPiece, PieceColor } from "../types";
import { ChessPieceIcon } from "./ChessPieceIcon";

interface ChessBoardProps {
  board: (ChessPiece | null)[][];
  selectedSquare: { row: number; col: number } | null;
  validMoves: { row: number; col: number }[];
  onSquareClick: (row: number, col: number) => void;
  isFlipped: boolean;
  turn: PieceColor;
  kingInCheckPos: { row: number; col: number } | null;
  userColor?: "w" | "b" | "both" | "spectator";
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  board,
  selectedSquare,
  validMoves,
  onSquareClick,
  isFlipped,
  turn,
  kingInCheckPos,
  userColor = "both",
}) => {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];

  const displayRows = isFlipped ? [...rows].reverse() : rows;
  const displayCols = isFlipped ? [...cols].reverse() : cols;

  const isSquareValidTarget = (r: number, c: number) => {
    return validMoves.some((m) => m.row === r && m.col === c);
  };

  const isSelected = (r: number, c: number) => {
    return selectedSquare?.row === r && selectedSquare?.col === c;
  };

  const isKingCheck = (r: number, c: number) => {
    return kingInCheckPos?.row === r && kingInCheckPos?.col === c;
  };

  // Helper to determine if a piece can be dragged by the current player
  const canDragPiece = (pieceColor: PieceColor) => {
    if (pieceColor !== turn) return false;
    if (userColor === "both") return true;
    return userColor === pieceColor;
  };

  const handleDragStart = (e: React.DragEvent, r: number, c: number) => {
    // Auto-select piece on drag start to highlight potential squares
    if (selectedSquare?.row !== r || selectedSquare?.col !== c) {
      onSquareClick(r, c);
    }
    e.dataTransfer.setData("text/plain", JSON.stringify({ row: r, col: c }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (dataStr) {
        const source = JSON.parse(dataStr);
        if (source.row !== r || source.col !== c) {
          // Trigger movement execution inside App.tsx
          onSquareClick(r, c);
        }
      }
    } catch {
      onSquareClick(r, c);
    }
  };

  return (
    <div id="chessboard_container" className="aspect-square w-full max-w-[520px] bg-pink-100 p-2 md:p-3 rounded-2xl shadow-[0_10px_30px_rgba(244,143,177,0.25)] border border-pink-200 select-none">
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full rounded-lg overflow-hidden border border-pink-200">
        {displayRows.map((rowIdx) =>
          displayCols.map((colIdx) => {
            const piece = board[rowIdx][colIdx];
            const isLightSquare = (rowIdx + colIdx) % 2 === 0;
            const validTarget = isSquareValidTarget(rowIdx, colIdx);
            const selected = isSelected(rowIdx, colIdx);
            const check = isKingCheck(rowIdx, colIdx);

            // Determine background colors
            let squareClass = "relative flex items-center justify-center transition-all duration-150 aspect-square ";
            if (selected) {
              squareClass += "bg-amber-400/80 shadow-inner scale-[0.98] z-10";
            } else if (check) {
              squareClass += "bg-rose-500 shadow-[inset_0_0_20px_rgba(225,29,72,0.8)] animate-pulse z-10";
            } else if (validTarget) {
              squareClass += isLightSquare
                ? "bg-emerald-300/60 hover:bg-emerald-300/80 cursor-pointer"
                : "bg-emerald-400/70 hover:bg-emerald-400/95 cursor-pointer";
            } else {
              squareClass += isLightSquare
                ? "bg-[#fff0f3] hover:bg-[#ffe5ec]"
                : "bg-[#f4acb7] hover:bg-[#e295a1]";
            }

            // Determine coordinates labels (File on bottom row, Rank on left column)
            // Left column relative to visual display (first column)
            const showRankLabel = isFlipped
              ? colIdx === 7 // If flipped, rightmost is 'col 7' which appears on the left when reversed
              : colIdx === 0; // If normal, leftmost is 'col 0'

            const showFileLabel = isFlipped
              ? rowIdx === 0 // If flipped, topmost is 'row 0' which appears on the bottom when reversed
              : rowIdx === 7; // If normal, bottom-most is 'row 7'

            const rankLabel = 8 - rowIdx;
            const fileLabel = String.fromCharCode(97 + colIdx);

            return (
              <div
                id={`square-${rowIdx}-${colIdx}`}
                key={`${rowIdx}-${colIdx}`}
                className={squareClass}
                onClick={() => onSquareClick(rowIdx, colIdx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, rowIdx, colIdx)}
              >
                {/* Chess coordinates text inside the square */}
                {showRankLabel && (
                  <span
                    className={`absolute top-0.5 left-1 text-[10px] font-bold ${
                      isLightSquare ? "text-[#f4acb7]" : "text-[#fff0f3]"
                    }`}
                  >
                    {rankLabel}
                  </span>
                )}
                {showFileLabel && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[10px] font-bold ${
                      isLightSquare ? "text-[#f4acb7]" : "text-[#fff0f3]"
                    }`}
                  >
                    {fileLabel}
                  </span>
                )}

                {/* Valid move target dots */}
                {validTarget && !piece && (
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-900/40 pointer-events-none border border-emerald-950/30" />
                )}

                {/* Captured indicators or rings if valid target contains piece */}
                {validTarget && piece && (
                  <div className="absolute inset-0 border-4 border-emerald-500/80 rounded-full m-1 pointer-events-none animate-ping" />
                )}

                {/* Render the actual piece */}
                {piece && (
                  <div
                    draggable={canDragPiece(piece.color)}
                    onDragStart={(e) => handleDragStart(e, rowIdx, colIdx)}
                    className={`w-[85%] h-[85%] flex items-center justify-center transform active:scale-95 transition-transform duration-100 hover:scale-105 ${
                      canDragPiece(piece.color) ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-90"
                    }`}
                  >
                    <ChessPieceIcon type={piece.type} color={piece.color} className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
