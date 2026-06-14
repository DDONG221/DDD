import React from "react";
import { PieceColor } from "../types";

interface ChessClockProps {
  clocks: { w: number; b: number };
  turn: PieceColor;
  isClockActive: boolean;
  gameStatus: "waiting" | "active" | "finished";
}

export const ChessClock: React.FC<ChessClockProps> = ({
  clocks,
  turn,
  isClockActive,
  gameStatus,
}) => {
  const formatTime = (seconds: number) => {
    if (seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);

    const secondsStr = secs < 10 ? `0${secs}` : `${secs}`;

    if (seconds < 20 && seconds > 0) {
      return `${mins}:${secondsStr}.${tenths}`;
    }
    return `${mins}:${secondsStr}`;
  };

  const isWhiteTicking = isClockActive && turn === "w" && gameStatus === "active";
  const isBlackTicking = isClockActive && turn === "b" && gameStatus === "active";

  const getClockColorClass = (seconds: number, isActive: boolean) => {
    if (seconds === 0) return "bg-rose-50 text-rose-600 border-rose-300 animate-pulse";
    if (seconds < 30) return "bg-amber-50 text-amber-600 border-amber-300 animate-pulse";
    return isActive
      ? "bg-pink-100/80 text-pink-700 border-pink-300 shadow-md shadow-pink-100"
      : "bg-white text-slate-600 border-pink-200 shadow-sm";
  };

  return (
    <div id="chess_clocks" className="grid grid-cols-2 gap-4 w-full select-none">
      {/* White Clock Card */}
      <div
        id="white_clock_card"
        className={`flex flex-col justify-center items-center py-3 px-4 rounded-xl border transition-all duration-200 ${getClockColorClass(
          clocks.w,
          isWhiteTicking
        )}`}
      >
        <span className="text-xs uppercase tracking-widest font-sans font-bold opacity-80 mb-1">
          White Clock
        </span>
        <div id="white_clock_time" className="text-2xl md:text-3xl font-bold font-mono tracking-wider">
          {formatTime(clocks.w)}
        </div>
        {isWhiteTicking && (
          <span className="text-[9px] bg-pink-500 text-white border border-pink-600 px-1.5 py-0.5 rounded mt-1.5 animate-pulse uppercase tracking-wider font-semibold font-sans">
            Active Turn
          </span>
        )}
      </div>

      {/* Black Clock Card */}
      <div
        id="black_clock_card"
        className={`flex flex-col justify-center items-center py-3 px-4 rounded-xl border transition-all duration-200 ${getClockColorClass(
          clocks.b,
          isBlackTicking
        )}`}
      >
        <span className="text-xs uppercase tracking-widest font-sans font-bold opacity-80 mb-1">
          Black Clock
        </span>
        <div id="black_clock_time" className="text-2xl md:text-3xl font-bold font-mono tracking-wider">
          {formatTime(clocks.b)}
        </div>
        {isBlackTicking && (
          <span className="text-[9px] bg-pink-500 text-white border border-pink-600 px-1.5 py-0.5 rounded mt-1.5 animate-pulse uppercase tracking-wider font-semibold font-sans">
            Active Turn
          </span>
        )}
      </div>
    </div>
  );
};
