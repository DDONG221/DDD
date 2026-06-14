import React, { useEffect, useRef } from "react";
import { GameMove } from "../types";
import { ScrollText, ChevronRight } from "lucide-react";

interface MoveLogProps {
  moves: GameMove[];
  onUndoMove: () => void;
  gameStatus: "waiting" | "active" | "finished";
}

export const MoveLog: React.FC<MoveLogProps> = ({
  moves,
  onUndoMove,
  gameStatus,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs { whiteMove, blackMove, number }
  const groupedMoves: {
    num: number;
    wMove?: GameMove;
    bMove?: GameMove;
  }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      num: Math.floor(i / 2) + 1,
      wMove: moves[i],
      bMove: moves[i + 1],
    });
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  return (
    <div id="movelog_container" className="bg-white border border-pink-100 rounded-xl p-4 flex flex-col h-56 select-none shadow-[0_2px_15px_-3px_rgba(244,143,177,0.1)]">
      <div className="flex items-center justify-between border-b border-pink-100 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-pink-500" />
          <h3 className="text-sm font-bold tracking-wide uppercase text-pink-700 font-sans">
            Move Log ({moves.length})
          </h3>
        </div>
        {gameStatus === "active" && moves.length > 0 && (
          <button
            id="undo_move_button"
            onClick={onUndoMove}
            className="text-[10px] text-pink-600 font-bold font-sans hover:text-pink-700 hover:bg-pink-50 px-2 py-1 rounded border border-pink-200 transition-all duration-150 cursor-pointer"
          >
            Undo Last
          </button>
        )}
      </div>

      <div
        id="movelog_scroll"
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-pink-200 scrollbar-track-transparent pr-1 font-mono text-xs"
      >
        {groupedMoves.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic py-6 font-sans">
            <span>No moves made yet.</span>
            <span className="text-[10px] mt-1 text-pink-400 font-semibold">Select a piece to play!</span>
          </div>
        ) : (
          groupedMoves.map((item) => (
            <div
              id={`move_row_${item.num}`}
              key={item.num}
              className="grid grid-cols-12 gap-1 py-1 px-2 rounded hover:bg-pink-50/50 border border-transparent hover:border-pink-100/35 transition-colors font-sans"
            >
              <span className="col-span-2 text-pink-500 font-bold">{item.num}.</span>
              <div
                id={`white_move_${item.num}`}
                className="col-span-5 flex items-center gap-1.5 font-bold text-pink-600"
              >
                <ChevronRight className="w-3 h-3 text-pink-400" />
                <span>{item.wMove?.notation}</span>
                <span className="text-[9px] text-slate-500 font-normal">
                  ({item.wMove?.to.squareName})
                </span>
              </div>
              <div
                id={`black_move_${item.num}`}
                className="col-span-5 flex items-center gap-1.5 font-bold text-slate-700"
              >
                {item.bMove ? (
                  <>
                    <ChevronRight className="w-3 h-3 text-pink-400" />
                    <span>{item.bMove.notation}</span>
                    <span className="text-[9px] text-slate-500 font-normal">
                      ({item.bMove.to.squareName})
                    </span>
                  </>
                ) : (
                  <span className="text-slate-400 font-light italic">...</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
