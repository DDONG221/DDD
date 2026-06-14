import React from "react";
import { ChessPiece } from "../types";
import { ChessPieceIcon } from "./ChessPieceIcon";

interface CapturedPiecesProps {
  moves: { captured?: ChessPiece | null }[];
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({ moves }) => {
  // Extract all non-null captured pieces
  const capturedList: ChessPiece[] = [];
  moves.forEach((m) => {
    if (m.captured) {
      capturedList.push(m.captured);
    }
  });

  // Black captured pieces (captured by White, so White has them as trophies)
  const blackCaptured = capturedList.filter((p) => p.color === "b");
  // White captured pieces (captured by Black, so Black has them as trophies)
  const whiteCaptured = capturedList.filter((p) => p.color === "w");

  // Calculate total material values
  const whiteMaterialPoints = whiteCaptured.reduce(
    (acc, p) => acc + (PIECE_VALUES[p.type] || 0),
    0
  );
  const blackMaterialPoints = blackCaptured.reduce(
    (acc, p) => acc + (PIECE_VALUES[p.type] || 0),
    0
  );

  const whiteAdvantage = blackMaterialPoints - whiteMaterialPoints; // captured black minus captured white
  const blackAdvantage = whiteMaterialPoints - blackMaterialPoints; // captured white minus captured black

  return (
    <div id="captured_pieces_container" className="bg-white border border-pink-100 rounded-xl p-3.5 select-none font-sans text-xs flex flex-col gap-3.5 shadow-[0_2px_15px_-3px_rgba(244,143,177,0.1)]">
      <h3 className="text-pink-700 font-bold uppercase tracking-wider text-[11px] pb-1.5 border-b border-pink-100">
        Captured Material
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Captured by White (Black pieces got captured) */}
        <div id="captured_by_white" className="flex flex-col gap-1.5 bg-pink-50/30 p-2 rounded-lg border border-pink-100">
          <div className="flex items-center justify-between">
            <span className="text-pink-600 font-bold text-[10px]">White Trophies</span>
            {whiteAdvantage > 0 && (
              <span className="bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded text-[9px] font-bold">
                +{whiteAdvantage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 min-h-[28px] items-center bg-white p-1 rounded-md border border-pink-100">
            {blackCaptured.length === 0 ? (
              <span className="text-[10px] text-pink-400 italic pl-1 font-semibold">None</span>
            ) : (
              blackCaptured.map((p) => (
                <div
                  key={p.id}
                  className="w-5 h-5 flex items-center justify-center bg-pink-50 rounded border border-pink-150"
                  title={`${p.color === "w" ? "White" : "Black"} ${p.type.toUpperCase()}`}
                >
                  <ChessPieceIcon type={p.type} color={p.color} className="w-4 h-4" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Captured by Black (White pieces got captured) */}
        <div id="captured_by_black" className="flex flex-col gap-1.5 bg-pink-50/30 p-2 rounded-lg border border-pink-100">
          <div className="flex items-center justify-between">
            <span className="text-slate-700 font-bold text-[10px]">Black Trophies</span>
            {blackAdvantage > 0 && (
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                +{blackAdvantage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 min-h-[28px] items-center bg-white p-1 rounded-md border border-pink-100">
            {whiteCaptured.length === 0 ? (
              <span className="text-[10px] text-slate-400 italic pl-1 font-semibold">None</span>
            ) : (
              whiteCaptured.map((p) => (
                <div
                  key={p.id}
                  className="w-5 h-5 flex items-center justify-center bg-slate-50 rounded border border-slate-200"
                  title={`${p.color === "w" ? "White" : "Black"} ${p.type.toUpperCase()}`}
                >
                  <ChessPieceIcon type={p.type} color={p.color} className="w-4 h-4" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
