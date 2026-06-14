import React from "react";
import { PieceColor, PieceType } from "../types";

interface ChessPieceIconProps {
  type: PieceType;
  color: PieceColor;
  className?: string;
}

export const ChessPieceIcon: React.FC<ChessPieceIconProps> = ({
  type,
  color,
  className = "w-10 h-10",
}) => {
  const fillColor = color === "w" ? "#FFFFFF" : "#1C1917";
  const strokeColor = color === "w" ? "#1C1917" : "#FFFFFF";

  switch (type) {
    case "p": // Pawn
      return (
        <svg
          viewBox="0 0 45 45"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83.56-1.41 1.5-1.41 2.59 0 1.66 1.34 3 3 3h5c1.66 0 3-1.34 3-3 0-1.09-.58-2.03-1.41-2.59C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "r": // Rook
      return (
        <svg
          viewBox="0 0 45 45"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M9 39h27v-3H9v3zM12 36h21l-3-6H15l-3 6zM14 27h17v-4H14v4z" />
            <path d="M14 20h17L33 9h-4l-3 5h-7l-3-5h-4l2 11z" />
          </g>
        </svg>
      );

    case "n": // Knight
      return (
        <svg
          viewBox="0 0 45 45"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 22,10 C 22,10 19,11 16,15 C 13,19 13,23 13,23 C 13,23 14,21 16,20 C 16,20 16,21 15,22 C 14,23 12,24 12,27 C 12,30 13,31 15,31 C 17,31 22,29 24,31 C 26,33 24,36 24,36 C 24,36 29,36 31,34 C 33,32 32,29 32,29 C 32,29 33,28 33,26 C 33,24 31,20 28,17 C 25,14 22,10 22,10 z"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle
            cx="17"
            cy="15"
            r="1.5"
            fill={color === "w" ? "#1C1917" : "#FFFFFF"}
          />
        </svg>
      );

    case "b": // Bishop
      return (
        <svg
          viewBox="0 0 45 45"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M9 36h27v-3H9v3z" />
            <path d="M22.5 9C19 14 15 18.5 15 22.5c0 4.5 3.5 8 7.5 8s7.5-3.5 7.5-8C30 18.5 26 14 22.5 9z" />
            <path
              d="M17.5 19.5h10M22.5 14.5v10"
              stroke={strokeColor}
              strokeWidth="1.5"
            />
          </g>
        </svg>
      );

    case "q": // Queen
      return (
        <svg
          viewBox="0 0 45 45"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm14.5 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm14.5 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" />
            <path d="M9 37h27v-3H9v3z" />
            <path d="M12 30h21l2-14-6 7-6.5-12L16 23l-6-14 2 15z" />
          </g>
        </svg>
      );

    case "k": // King
      return (
        <svg
          viewBox="0 0 45 45"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <g
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M8.5 37h28v-3h-28v3z" />
            <path d="M11.5 30h22l2.5-14H31l-3 4h-11l-3-4H9l2.5 14z" />
            <path d="M16 21h13M22.5 13v9" />
            <path d="M20 9h5M22.5 6.5v5" stroke={strokeColor} strokeWidth="1.5" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};
