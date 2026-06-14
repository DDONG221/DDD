import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  User,
  Volume2,
  VolumeX,
  RotateCcw,
  Flag,
  MessageSquare,
  Clock,
  ArrowLeft,
  Crown,
  Swords,
  Users,
  CheckCircle2,
  Sparkles,
  Trophy,
  Coffee,
  HelpCircle,
  Skull,
} from "lucide-react";
import { ChessRoom, ChessPiece, PieceColor, ChatMessage, GameMove } from "./types";
import {
  createInitialBoard,
  isValidMove,
  isKingInCheck,
  getValidMovesForPiece,
  isCheckmate,
  isStalemate,
  generateMoveNotation,
  playChessSound,
  getSquareName,
} from "./chessLogic";
import { ChessBoard } from "./components/ChessBoard";
import { ChessClock } from "./components/ChessClock";
import { MoveLog } from "./components/MoveLog";
import { ChatBox } from "./components/ChatBox";
import { CapturedPieces } from "./components/CapturedPieces";
import { getLeaderboard, recordGameResult, PlayerStats, supabase } from "./lib/supabase";

const GUEST_KEY = "chess_guest_name";

export default function App() {
  // 1. Load player name from sessionStorage or generate a random guest name
  // Using sessionStorage ensures that if the user opens multiple tabs to test the game,
  // each tab automatically gets a unique and separate random nickname!
  const [playerName, setPlayerName] = useState<string>(() => {
    const cached = sessionStorage.getItem(GUEST_KEY);
    if (cached) return cached;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generated = `Player_${randomNum}`;
    sessionStorage.setItem(GUEST_KEY, generated);
    return generated;
  });

  // 2. Load rooms from localStorage (Starts EMPTY, satisfying 'remove sample default room'!)
  const [rooms, setRooms] = useState<ChessRoom[]>(() => {
    const cached = localStorage.getItem("chess_rooms");
    return cached ? JSON.parse(cached) : [];
  });

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // App lobby creation panel states
  const [newRoomName, setNewRoomName] = useState("");
  const [timeControl, setTimeControl] = useState<number>(10);
  const [lobbyTab, setLobbyTab] = useState<"host" | "guest">("host");
  const [joinRoomIdInput, setJoinRoomIdInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [idCopied, setIdCopied] = useState(false);

  // Active game play states
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [validDestinations, setValidDestinations] = useState<{ row: number; col: number }[]>([]);

  // Local state for editing display nickname
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);

  // Supabase Scoreboard states
  const [leaderboard, setLeaderboard] = useState<PlayerStats[]>([]);
  const [processedEnds, setProcessedEnds] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem("chess_processed_ends");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const fetchStats = async () => {
    try {
      const stats = await getLeaderboard();
      setLeaderboard(stats);
    } catch (e) {
      console.error("Failed to fetch leaderboard stats:", e);
    }
  };

  // Sync processedEnds to localStorage to persist registered records
  useEffect(() => {
    localStorage.setItem("chess_processed_ends", JSON.stringify(processedEnds));
  }, [processedEnds]);

  // Load stats on mounting
  useEffect(() => {
    fetchStats();
  }, []);

  // Monitor rooms to record finished games
  useEffect(() => {
    const finishedRooms = rooms.filter(
      (r) => r.status === "finished" && !processedEnds.includes(r.id)
    );

    if (finishedRooms.length > 0) {
      finishedRooms.forEach(async (room) => {
        // Mark as processed immediately to prevent duplicate updates
        setProcessedEnds((prev) => [...prev, room.id]);

        const whitePlayer = room.players.w || "White Player";
        const blackPlayer = room.players.b || "Black Player";
        const winner = room.winner;

        try {
          const res = await recordGameResult(whitePlayer, blackPlayer, winner);
          if (res.success) {
            await fetchStats();
          }
        } catch (e) {
          console.error("Error during recording result to Supabase / Storage:", e);
        }
      });
    }
  }, [rooms, processedEnds]);

  // Find the currently active selected room
  const currentRoom = rooms.find((r) => r.id === selectedRoomId);

  // We keep a reference to the last serialized non-clock state to avoid duplicate localStorage writes during clock ticking
  const lastSerializedNonClockRef = React.useRef("");

  // Helper utility to serialize ChessRooms excluding precise ticked clock values
  const serializeNonClockState = (roomsList: ChessRoom[]) => {
    return JSON.stringify(
      roomsList.map((r) => ({
        id: r.id,
        name: r.name,
        creator: r.creator,
        timeControl: r.timeControl,
        status: r.status,
        board: r.board,
        turn: r.turn,
        players: r.players,
        spectators: r.spectators,
        moveHistory: r.moveHistory,
        chatLog: r.chatLog,
        isClockActive: r.isClockActive,
        winner: r.winner,
        reason: r.reason,
      }))
    );
  };

  // -------------------------------------------------------------
  // Sync state to localStorage (Filtered to avoid continuous clock updates)
  // -------------------------------------------------------------
  useEffect(() => {
    const serialized = serializeNonClockState(rooms);
    if (serialized !== lastSerializedNonClockRef.current) {
      lastSerializedNonClockRef.current = serialized;
      localStorage.setItem("chess_rooms", JSON.stringify(rooms));
    }
  }, [rooms]);

  // -------------------------------------------------------------
  // Real-time synchronization across multiple local tabs/windows
  // -------------------------------------------------------------
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "chess_rooms") {
        if (e.newValue) {
          try {
            const syncedRooms: ChessRoom[] = JSON.parse(e.newValue);
            
            // Generate immersive audio feedback for incoming remote actions!
            if (selectedRoomId) {
              const currentActiveLocal = rooms.find((r) => r.id === selectedRoomId);
              const incomingActiveSynced = syncedRooms.find((r) => r.id === selectedRoomId);
              
              if (currentActiveLocal && incomingActiveSynced) {
                const prevHistLength = currentActiveLocal.moveHistory.length;
                const nextHistLength = incomingActiveSynced.moveHistory.length;
                
                // If a new turn was added to the history, play corresponding chess sound!
                if (nextHistLength > prevHistLength) {
                  const lastMove = incomingActiveSynced.moveHistory[nextHistLength - 1];
                  if (lastMove) {
                    if (incomingActiveSynced.winner) {
                      if (soundEnabled) playChessSound("gameover");
                    } else if (isKingInCheck(incomingActiveSynced.board, incomingActiveSynced.turn)) {
                      if (soundEnabled) playChessSound("check");
                    } else if (lastMove.captured) {
                      if (soundEnabled) playChessSound("capture");
                    } else {
                      if (soundEnabled) playChessSound("move");
                    }
                  }
                }
              }
            }
            
            // Update the local serialized ref *before* setting state, to prevent
            // this tab from echoing the same state right back to localStorage!
            lastSerializedNonClockRef.current = serializeNonClockState(syncedRooms);
            setRooms(syncedRooms);
          } catch (err) {
            console.error("Storage sync parsing failed:", err);
          }
        } else {
          setRooms([]);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [selectedRoomId, rooms, soundEnabled]);

  // Handle auto-flipping perspective based on the side the user claimed
  useEffect(() => {
    if (!currentRoom) return;
    const isW = currentRoom.players.w === playerName;
    const isB = currentRoom.players.b === playerName;
    if (isB && !isW) {
      setIsFlipped(true);
    } else if (isW && !isB) {
      setIsFlipped(false);
    }
  }, [selectedRoomId, currentRoom?.players.w, currentRoom?.players.b, playerName]);

  // -------------------------------------------------------------
  // Real-time Chess Clock Ticking Effect
  // -------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      setRooms((prevRooms) => {
        let morphed = false;
        const next = prevRooms.map((room) => {
          if (
            room.status === "active" &&
            room.isClockActive &&
            room.timeControl > 0
          ) {
            morphed = true;
            const currentTurn = room.turn;
            const updatedClocks = { ...room.clocks };

            if (currentTurn === "w") {
              updatedClocks.w = Math.max(0, updatedClocks.w - 1);
            } else {
              updatedClocks.b = Math.max(0, updatedClocks.b - 1);
            }

            // Timeout occurred!
            if (updatedClocks.w === 0 || updatedClocks.b === 0) {
              const loser: PieceColor = updatedClocks.w === 0 ? "w" : "b";
              const winnerColor: PieceColor = loser === "w" ? "b" : "w";
              const winnerName = room.players[winnerColor] || "Opponent";

              if (soundEnabled) {
                playChessSound("gameover");
              }

              // Send system message to chat log
              const timeoutAlert: ChatMessage = {
                id: `msg_sys_${Date.now()}`,
                sender: "System",
                senderColor: "spectator",
                text: `⏰ Time's up! ${winnerName} (${winnerColor === "w" ? "White" : "Black"}) wins by timeout!`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              };

              return {
                ...room,
                clocks: updatedClocks,
                status: "finished",
                winner: winnerColor,
                reason: "timeout",
                isClockActive: false,
                chatLog: [...room.chatLog, timeoutAlert],
              };
            }

            return {
              ...room,
              clocks: updatedClocks,
            };
          }
          return room;
        });

        return morphed ? next : prevRooms;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [soundEnabled]);

  // -------------------------------------------------------------
  // Intel Intelligent local AI Bot Opponent Handler
  // -------------------------------------------------------------
  useEffect(() => {
    if (!currentRoom) return;

    const isAITurn =
      currentRoom.status === "active" &&
      ((currentRoom.turn === "w" && currentRoom.players.w === "Computer (AI)") ||
        (currentRoom.turn === "b" && currentRoom.players.b === "Computer (AI)"));

    if (isAITurn) {
      const aiColor = currentRoom.turn;
      const timer = setTimeout(() => {
        // Collect all legal moves for AI pieces
        const aiMoves: {
          from: { row: number; col: number };
          to: { row: number; col: number };
          capturedPieceValue: number;
        }[] = [];

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = currentRoom.board[r][c];
            if (piece && piece.color === aiColor) {
              const targets = getValidMovesForPiece(r, c, currentRoom.board);
              targets.forEach((tgt) => {
                const targetPiece = currentRoom.board[tgt.row][tgt.col];
                let value = 0;
                if (targetPiece) {
                  const valMap: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
                  value = valMap[targetPiece.type] || 0;
                }
                aiMoves.push({
                  from: { row: r, col: c },
                  to: { row: tgt.row, col: tgt.col },
                  capturedPieceValue: value,
                });
              });
            }
          }
        }

        if (aiMoves.length === 0) {
          // No moves available (Checkmate or Stalemate handled)
          return;
        }

        // HEURISTICS: Sort to prioritize captures of highest value, then do random moves
        aiMoves.sort((a, b) => b.capturedPieceValue - a.capturedPieceValue);
        const topCaptureValue = aiMoves[0].capturedPieceValue;

        const candidates = aiMoves.filter((m) => m.capturedPieceValue === topCaptureValue);
        // Randomly pick from candidates
        const chosenMove = candidates[Math.floor(Math.random() * candidates.length)];

        // Execute AI Move
        makeMove(chosenMove.from.row, chosenMove.from.col, chosenMove.to.row, chosenMove.to.col);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [currentRoom?.turn, currentRoom?.status, currentRoom?.players]);

  // -------------------------------------------------------------
  // LOBBY ACTIONS
  // -------------------------------------------------------------
  const handleSaveNickname = () => {
    if (!tempName.trim()) return;
    setPlayerName(tempName.trim());
    sessionStorage.setItem(GUEST_KEY, tempName.trim());
    setIsEditingName(false);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoomName.trim() || `${playerName}'s Match`;
    const newRoomId = `room_${Date.now()}`;

    const newCreatedRoom: ChessRoom = {
      id: newRoomId,
      name,
      creator: playerName,
      timeControl: timeControl,
      status: "waiting",
      board: createInitialBoard(),
      turn: "w",
      players: {
        w: playerName, // Creator defaults to White
        b: null,
      },
      spectators: [],
      moveHistory: [],
      chatLog: [
        {
          id: `msg_init_${Date.now()}`,
          sender: "System",
          senderColor: "spectator",
          text: `👋 Room "${name}" has been established! Click to claim seats or add a Computer (AI) opponent.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
      clocks: {
        w: timeControl * 60,
        b: timeControl * 60,
      },
      isClockActive: false,
      winner: null,
      createdAt: new Date().toLocaleDateString(),
    };

    setRooms([newCreatedRoom, ...rooms]);
    setNewRoomName("");
    setSelectedRoomId(newRoomId);
  };

  const handleDeleteRoom = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRooms(rooms.filter((r) => r.id !== roomId));
    if (selectedRoomId === roomId) {
      setSelectedRoomId(null);
    }
  };

  const handleGuestJoinById = (e: React.FormEvent) => {
    e.preventDefault();
    const query = joinRoomIdInput.trim().toLowerCase();
    if (!query) return;

    // Search room by exact ID, suffix of ID, exact name, or partial name match
    const foundRoom = rooms.find((r) => {
      const idMatches =
        r.id.toLowerCase() === query ||
        `room_${query}` === r.id.toLowerCase() ||
        r.id.slice(5).toLowerCase() === query ||
        r.id.toLowerCase().endsWith(query);

      const nameMatches =
        r.name.toLowerCase() === query ||
        r.name.toLowerCase().includes(query);

      return idMatches || nameMatches;
    });

    if (foundRoom) {
      setJoinError("");
      setJoinRoomIdInput("");
      setSelectedRoomId(foundRoom.id);
    } else {
      setJoinError("입력하신 방을 찾을 수 없습니다. 올바른 방 이름이나 ID 코드를 입력하거나 우측의 생성된 방 목록에서 직접 선택해 주세요!");
    }
  };

  // -------------------------------------------------------------
  // GAME ROOM SEAT ACTIONS
  // -------------------------------------------------------------
  const handleJoinSide = (side: "w" | "b") => {
    if (!selectedRoomId) return;

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;

        const updatedRoom = { ...r };
        const opposingSide = side === "w" ? "b" : "w";

        // Prevent joining the same player to both sides
        if (updatedRoom.players[opposingSide] === playerName) {
          updatedRoom.players[opposingSide] = null;
        }

        updatedRoom.players[side] = playerName;

        // Automatically activate visual match if both seats are occupied
        if (updatedRoom.players.w && updatedRoom.players.b) {
          updatedRoom.status = "active";
          updatedRoom.isClockActive = updatedRoom.timeControl > 0;
        }

        return updatedRoom;
      })
    );
  };

  const handleAddAI = (side: "w" | "b") => {
    if (!selectedRoomId) return;

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;

        const updatedRoom = { ...r };
        updatedRoom.players[side] = "Computer (AI)";

        if (updatedRoom.players.w && updatedRoom.players.b) {
          updatedRoom.status = "active";
          updatedRoom.isClockActive = updatedRoom.timeControl > 0;
        }
        return updatedRoom;
      })
    );
  };

  const handleJoinSpectator = () => {
    if (!selectedRoomId) return;

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;

        const updatedRoom = { ...r };
        // Empty player seat if they were sitting
        if (updatedRoom.players.w === playerName) updatedRoom.players.w = null;
        if (updatedRoom.players.b === playerName) updatedRoom.players.b = null;

        if (!updatedRoom.spectators.includes(playerName)) {
          updatedRoom.spectators = [...updatedRoom.spectators, playerName];
        }

        return updatedRoom;
      })
    );
  };

  // -------------------------------------------------------------
  // CHESS GAME PLAY & MOVES ACTIONS
  // -------------------------------------------------------------
  const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) => {
        if (room.id !== selectedRoomId) return room;

        const piece = room.board[fromRow][fromCol];
        if (!piece) return room;

        const targetPiece = room.board[toRow][toCol];
        const notationText = generateMoveNotation(fromRow, fromCol, toRow, toCol, room.board, targetPiece);

        // Compute deep cloned moves
        const nextBoard = room.board.map((row) => [...row]);
        nextBoard[toRow][toCol] = piece;
        nextBoard[fromRow][fromCol] = null;

        const nextTurn: PieceColor = room.turn === "w" ? "b" : "w";
        let status = room.status;
        let winner = room.winner;
        let reason = room.reason;
        let chatLogs = [...room.chatLog];

        const audioType = targetPiece ? "capture" : "move";

        // Evaluate checks, matches, stales
        if (targetPiece && targetPiece.type === "k") {
          status = "finished";
          winner = room.turn;
          reason = "checkmate";

          const winningName = room.players[room.turn] || "Opponent";
          chatLogs.push({
            id: `sys_mate_${Date.now()}`,
            sender: "System",
            senderColor: "spectator",
            text: `👑 King Captured! ${winningName} (${room.turn === "w" ? "White" : "Black"}) won the battle!`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });

          if (soundEnabled) playChessSound("gameover");
        } else if (isCheckmate(nextBoard, nextTurn)) {
          status = "finished";
          winner = room.turn;
          reason = "checkmate";

          const winningName = room.players[room.turn] || "Opponent";
          chatLogs.push({
            id: `sys_mate_${Date.now()}`,
            sender: "System",
            senderColor: "spectator",
            text: `🏆 Checkmate! ${winningName} (${room.turn === "w" ? "White" : "Black"}) wins the match!`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });

          if (soundEnabled) playChessSound("gameover");
        } else if (isStalemate(nextBoard, nextTurn)) {
          status = "finished";
          winner = "draw";
          reason = "stalemate";

          chatLogs.push({
            id: `sys_stale_${Date.now()}`,
            sender: "System",
            senderColor: "spectator",
            text: `⚖️ Stalemate! The match ends in a draw.`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });

          if (soundEnabled) playChessSound("gameover");
        } else if (isKingInCheck(nextBoard, nextTurn)) {
          if (soundEnabled) playChessSound("check");
        } else {
          if (soundEnabled) playChessSound(audioType);
        }

        const newMove: GameMove = {
          id: `move_${Date.now()}_${room.moveHistory.length}`,
          from: {
            row: fromRow,
            col: fromCol,
            squareName: getSquareName(fromRow, fromCol),
          },
          to: {
            row: toRow,
            col: toCol,
            squareName: getSquareName(toRow, toCol),
          },
          piece,
          captured: targetPiece,
          notation: notationText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        return {
          ...room,
          board: nextBoard,
          turn: nextTurn,
          moveHistory: [...room.moveHistory, newMove],
          status,
          winner,
          reason,
          chatLog: chatLogs,
        };
      })
    );

    // Reset selection state
    setSelectedSquare(null);
    setValidDestinations([]);
  };

  const handleSquareClick = (row: number, col: number) => {
    if (!currentRoom || currentRoom.status !== "active") return;

    // Detect user role / control authority
    const userRole =
      currentRoom.players.w === playerName ? "w" : currentRoom.players.b === playerName ? "b" : "spectator";

    const localSandboxMode = currentRoom.players.w === null && currentRoom.players.b === null;

    const isAITurn =
      (currentRoom.turn === "w" && currentRoom.players.w === "Computer (AI)") ||
      (currentRoom.turn === "b" && currentRoom.players.b === "Computer (AI)");

    if (isAITurn) return; // Ignore input when computer is calculating

    if (userRole === "spectator" && !localSandboxMode) {
      // Spectator click - do nothing
      return;
    }

    // If sandbox mode is inactive (seats claimed), the user can only click/move their own assigned pieces
    if (!localSandboxMode && userRole !== currentRoom.turn) {
      // It's not your turn
      return;
    }

    const clickedPiece = currentRoom.board[row][col];

    if (selectedSquare) {
      const isTargetValid = validDestinations.some((d) => d.row === row && d.col === col);

      if (isTargetValid) {
        // Carry out move
        makeMove(selectedSquare.row, selectedSquare.col, row, col);
      } else {
        // If clicked on another piece, change selection (or deselect)
        if (clickedPiece && clickedPiece.color === currentRoom.turn) {
          // If sandbox or assigned color
          const isAllowedSelection =
            localSandboxMode || clickedPiece.color === userRole;

          if (isAllowedSelection) {
            setSelectedSquare({ row, col });
            setValidDestinations(getValidMovesForPiece(row, col, currentRoom.board));
          } else {
            setSelectedSquare(null);
            setValidDestinations([]);
          }
        } else {
          setSelectedSquare(null);
          setValidDestinations([]);
        }
      }
    } else {
      // First selection click
      if (clickedPiece && clickedPiece.color === currentRoom.turn) {
        const isAllowedSelection =
          localSandboxMode || clickedPiece.color === userRole;

        if (isAllowedSelection) {
          setSelectedSquare({ row, col });
          setValidDestinations(getValidMovesForPiece(row, col, currentRoom.board));
        }
      }
    }
  };

  const handleUndoMove = () => {
    if (!selectedRoomId || !currentRoom || currentRoom.moveHistory.length === 0) return;

    setRooms(
      rooms.map((room) => {
        if (room.id !== selectedRoomId) return room;

        const history = [...room.moveHistory];
        const undoneMove = history.pop();
        if (!undoneMove) return room;

        // Restore initial board mapping
        const restoredBoard = createInitialBoard();
        // Re-simulate up to the last move
        history.forEach((m) => {
          restoredBoard[m.to.row][m.to.col] = restoredBoard[m.from.row][m.from.col];
          restoredBoard[m.from.row][m.from.col] = null;
        });

        const prevTurn: PieceColor = room.turn === "w" ? "b" : "w";

        if (soundEnabled) playChessSound("move");

        return {
          ...room,
          board: restoredBoard,
          turn: prevTurn,
          moveHistory: history,
          status: "active",
          winner: null,
          reason: undefined,
        };
      })
    );

    setSelectedSquare(null);
    setValidDestinations([]);
  };

  const handleResign = () => {
    if (!currentRoom || currentRoom.status !== "active") return;

    const resignColor = currentRoom.turn;
    const winningColor: PieceColor = resignColor === "w" ? "b" : "w";
    const winnerName = currentRoom.players[winningColor] || "Opponent";
    const loserName = currentRoom.players[resignColor] || "Player";

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;

        const chatLogs = [...r.chatLog];
        chatLogs.push({
          id: `sys_resign_${Date.now()}`,
          sender: "System",
          senderColor: "spectator",
          text: `🏳️ ${loserName} resigned. ${winnerName} (${winningColor === "w" ? "White" : "Black"}) wins!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        if (soundEnabled) playChessSound("gameover");

        return {
          ...r,
          status: "finished",
          winner: winningColor,
          reason: "resignation",
          isClockActive: false,
          chatLog: chatLogs,
        };
      })
    );
  };

  const handleDrawOffer = () => {
    if (!currentRoom || currentRoom.status !== "active") return;

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;

        const chatLogs = [...r.chatLog];
        chatLogs.push({
          id: `sys_draw_${Date.now()}`,
          sender: "System",
          senderColor: "spectator",
          text: `🤝 Draw agreement! The game was completed as a draw.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        if (soundEnabled) playChessSound("gameover");

        return {
          ...r,
          status: "finished",
          winner: "draw",
          reason: "agreement",
          isClockActive: false,
          chatLog: chatLogs,
        };
      })
    );
  };

  const handleResetBoard = () => {
    if (!currentRoom) return;

    // Allow re-recording of future endings in this room
    if (selectedRoomId) {
      setProcessedEnds((prev) => prev.filter((id) => id !== selectedRoomId));
    }

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;

        const initClocks = {
          w: r.timeControl > 0 ? r.timeControl * 60 : 0,
          b: r.timeControl > 0 ? r.timeControl * 60 : 0,
        };

        const chatLogs = [...r.chatLog];
        chatLogs.push({
          id: `sys_reset_${Date.now()}`,
          sender: "System",
          senderColor: "spectator",
          text: `🔄 The chess board of this room was reset. Time to start fresh!`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        if (soundEnabled) playChessSound("move");

        return {
          ...r,
          board: createInitialBoard(),
          turn: "w",
          status: r.players.w && r.players.b ? "active" : "waiting",
          moveHistory: [],
          clocks: initClocks,
          isClockActive: r.players.w && r.players.b && r.timeControl > 0 ? true : false,
          winner: null,
          reason: undefined,
          chatLog: chatLogs,
        };
      })
    );

    setSelectedSquare(null);
    setValidDestinations([]);
  };

  const handleSendMessage = (text: string) => {
    if (!selectedRoomId || !currentRoom) return;

    const userRole =
      currentRoom.players.w === playerName ? "w" : currentRoom.players.b === playerName ? "b" : "spectator";

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: playerName,
      senderColor: userRole,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setRooms(
      rooms.map((r) => {
        if (r.id !== selectedRoomId) return r;
        return {
          ...r,
          chatLog: [...r.chatLog, newMsg],
        };
      })
    );
  };

  // Determine if the turn colors King is directly in check right now
  const activeKingInCheckPos = currentRoom
    ? (() => {
        const turnColor = currentRoom.turn;
        if (isKingInCheck(currentRoom.board, turnColor)) {
          // Find the King position
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const p = currentRoom.board[r][c];
              if (p && p.type === "k" && p.color === turnColor) {
                return { row: r, col: c };
              }
            }
          }
        }
        return null;
      })()
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100 text-slate-800 flex flex-col font-sans transition-all">
      {/* Dynamic App Navbar Header Overlay */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-pink-200 shadow-[0_2px_15px_-3px_rgba(244,143,177,0.15)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedRoomId(null)}>
            <div className="bg-pink-500 p-2 rounded-xl text-white shadow-lg shadow-pink-200/50">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-pink-600 flex items-center gap-1.5 font-sans">
                Chess Rooms 🌸
              </h1>
              <p className="text-[10px] text-pink-400 font-mono">Sandbox Multiplayer Chess Lounge</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Nickname Setter component */}
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-pink-500" />
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    maxLength={15}
                    className="bg-white text-slate-800 text-xs py-1 px-2 border border-pink-300 rounded-md focus:outline-none focus:border-pink-500 w-32 font-mono"
                  />
                  <button
                    onClick={handleSaveNickname}
                    className="bg-pink-500 hover:bg-pink-600 text-white text-[10px] px-2 py-1 rounded transition-colors font-mono font-medium shadow-sm"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    onClick={() => {
                      setTempName(playerName);
                      setIsEditingName(true);
                    }}
                    className="text-xs text-slate-700 font-bold font-mono hover:text-pink-600 hover:underline cursor-pointer"
                    title="Click to change your nickname"
                  >
                    {playerName}
                  </span>
                </div>
              )}
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg border border-pink-200 hover:bg-pink-50 text-pink-600 transition-all duration-155"
              title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-500" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Stage */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {!selectedRoomId ? (
          /* =========================================================================
             LOBBY SCREEN (Zero Sample/Default Rooms! Pure custom!)
             ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Host Room and Guest Room selection panel wrapping stats */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white/95 border border-pink-100 rounded-2xl p-6 shadow-[0_4px_20px_rgba(244,143,177,0.1)] space-y-5">
              {/* Tab Selector Header */}
              <div className="flex bg-pink-50 p-1.5 rounded-xl border border-pink-100">
                <button
                  type="button"
                  id="tab_host_room"
                  onClick={() => {
                    setLobbyTab("host");
                    setJoinError("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold font-mono tracking-wider transition-all duration-155 uppercase ${
                    lobbyTab === "host"
                      ? "bg-pink-500 text-white shadow-md shadow-pink-200/50"
                      : "text-pink-700/80 hover:text-pink-600"
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" /> HOST ROOM
                </button>
                <button
                  type="button"
                  id="tab_guest_room"
                  onClick={() => {
                    setLobbyTab("guest");
                    setJoinError("");
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold font-mono tracking-wider transition-all duration-155 uppercase ${
                    lobbyTab === "guest"
                      ? "bg-pink-500 text-white shadow-md shadow-pink-200/50"
                      : "text-pink-700/80 hover:text-pink-600"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" /> GUEST ROOM
                </button>
              </div>

              {lobbyTab === "host" ? (
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="new_room_input" className="block text-[11px] font-mono tracking-wider font-bold text-pink-600 uppercase">
                      Chess Room Name
                    </label>
                    <input
                      id="new_room_input"
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="E.g., Grandmaster Blitz, Friendly Match"
                      maxLength={30}
                      required
                      className="w-full bg-white text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-pink-200 focus:outline-none focus:border-pink-500 transition-colors placeholder-pink-300 font-sans"
                    />
                  </div>

                  {/* Clock Settings - enableClock removed! Always active! */}
                  <div className="space-y-1 bg-pink-50/50 p-3 rounded-xl border border-pink-100">
                    <label className="block text-[10px] text-pink-700/90 font-mono uppercase font-bold">
                      Minutes per Player ({timeControl}m)
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={60}
                      value={timeControl}
                      onChange={(e) => setTimeControl(Number(e.target.value))}
                      className="w-full h-1 bg-pink-200 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between text-[9px] text-pink-700/65 font-mono mt-0.5 font-bold">
                      <span>1m (Bullet)</span>
                      <span>10m (Rapid)</span>
                      <span>60m (Classical)</span>
                    </div>
                  </div>

                  <button
                    id="submit_create_room"
                    type="submit"
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-pink-200/40 border border-pink-400/30 cursor-pointer"
                  >
                    <Crown className="w-4 h-4" /> Create Room (Host)
                  </button>
                </form>
              ) : (
                <form onSubmit={handleGuestJoinById} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="guest_room_input" className="block text-[11px] font-mono tracking-wider font-bold text-pink-600 uppercase">
                      Enter Chess Room Code / ID
                    </label>
                    <input
                      id="guest_room_input"
                      type="text"
                      value={joinRoomIdInput}
                      onChange={(e) => {
                        setJoinRoomIdInput(e.target.value);
                        setJoinError("");
                      }}
                      placeholder="Enter 5-digit code or complete Room ID"
                      required
                      className="w-full bg-white text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-pink-200 focus:outline-none focus:border-pink-500 transition-colors placeholder-pink-300 font-mono"
                    />
                  </div>

                  {joinError && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl p-3 text-xs leading-relaxed font-sans">
                      ⚠️ {joinError}
                    </div>
                  )}

                  <button
                    id="submit_join_guest"
                    type="submit"
                    className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-pink-200/40 border border-pink-400/30 cursor-pointer"
                  >
                    <Users className="w-4 h-4" /> Enter Room (Guest)
                  </button>
                </form>
              )}

              {/* Informative Alert */}
              <div className="bg-pink-50/60 p-4 rounded-xl border border-pink-100/70 space-y-2">
                <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-pink-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Core Update Applied
                </span>
                <p className="text-[11px] text-slate-600 font-sans leading-relaxed">
                  As requested, the hardcoded sample chess room has been successfully purged. All rooms in your current listing are custom-made sandboxes that save in your browser.
                </p>
              </div>
            </div>

            {/* Robust Global Scoreboard (Supabase) Card */}
            <div className="bg-white/95 border border-pink-100 rounded-2xl p-6 shadow-[0_4px_20px_rgba(244,143,177,0.1)] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-pink-100">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-pink-500 animate-bounce" />
                  <h3 className="text-sm font-bold tracking-wider uppercase font-sans text-pink-700">
                    Global Scoreboard
                  </h3>
                </div>
                {supabase ? (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-md font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    Supabase Live
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold" title="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your env/settings to sync online!">
                    Local Tally
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                Real-time leaderboard ranks and total wins. Each completed rematch updates records instantly!
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pink-200">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic font-sans">
                    No scoreboards recorded yet.
                    <p className="text-[10px] text-pink-400 mt-1">Complete a match to begin tallying!</p>
                  </div>
                ) : (
                  leaderboard.slice(0, 8).map((player, idx) => {
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
                    const isCurrentPlayer = player.username.toLowerCase() === playerName.toLowerCase();

                    return (
                      <div
                        id={`leaderboard_item_${player.username}`}
                        key={player.username}
                        className={`flex justify-between items-center px-3 py-2 rounded-xl transition ${
                          isCurrentPlayer
                            ? "bg-pink-100/50 border border-pink-300 font-bold font-semibold text-pink-700"
                            : "bg-pink-50/20 border border-pink-100/50 hover:bg-pink-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-pink-500 font-semibold w-5">{medal}</span>
                          <span className={`text-xs truncate max-w-[120px] ${isCurrentPlayer ? "text-pink-700 font-semibold" : "text-slate-700"}`}>
                            {player.username}
                          </span>
                        </div>
                        
                        {/* Score Tally Display standard format: PLAYERNAME 1:0 representation */}
                        <div className="flex items-center gap-1.5">
                          <span className="bg-white text-pink-600 px-2.5 py-0.5 rounded-lg border border-pink-200 font-mono text-xs font-bold shadow-xs">
                            {player.wins} : {player.losses}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Rooms list panel */}
          <div className="lg:col-span-8 bg-white/95 border border-pink-100 rounded-2xl p-6 shadow-[0_4px_20px_rgba(244,143,177,0.1)] space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-pink-100">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-pink-500" />
                  <h2 className="text-sm font-bold tracking-wider uppercase font-sans text-pink-700">
                    Active Chess Rooms ({rooms.length})
                  </h2>
                </div>
              </div>

              {rooms.length === 0 ? (
                /* Pure Clean Empty state illustration */
                <div id="empty_lobby_state" className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div className="bg-pink-50/40 w-16 h-16 rounded-2xl flex items-center justify-center border border-pink-100 text-pink-400 shadow-inner">
                    <Coffee className="w-8 h-8 opacity-60" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h3 className="font-semibold text-slate-700 font-sans">Lobby is Completely Empty</h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-sans">
                      All basic sample rooms have been successfully deleted. Create a custom chess room on the left to start a fresh battle or computer practice!
                    </p>
                  </div>
                </div>
              ) : (
                <div id="rooms_catalog" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.map((room) => {
                    const whiteP = room.players.w || "Empty";
                    const blackP = room.players.b || "Empty";
                    const hasAI = room.players.w === "Computer (AI)" || room.players.b === "Computer (AI)";

                    return (
                      <div
                        id={`room_card_${room.id}`}
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className="bg-pink-50/30 border border-pink-100 hover:border-pink-300 hover:bg-pink-50/60 rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-md animate-fade-in"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <h3 className="font-bold text-slate-800 group-hover:text-pink-600 transition-colors truncate max-w-[80%]">
                              {room.name}
                            </h3>
                            <button
                              id={`delete_room_btn_${room.id}`}
                              onClick={(e) => handleDeleteRoom(room.id, e)}
                              className="text-pink-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-100 transition-colors"
                              title="Delete room"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[9px] font-mono text-pink-600 uppercase flex items-center gap-1.5 mt-1 font-semibold">
                            Creator: {room.creator} • {room.createdAt}
                          </span>

                          {/* Players row block */}
                          <div className="mt-4 grid grid-cols-2 gap-2 bg-white/80 p-2.5 rounded-lg border border-pink-100">
                            <div className="text-[10px] space-y-0.5">
                              <span className="text-pink-500 font-mono font-bold block">⬜ White</span>
                              <span className="text-slate-700 font-bold truncate block">
                                {whiteP}
                              </span>
                            </div>
                            <div className="text-[10px] space-y-0.5 border-l border-pink-100 pl-2.5">
                              <span className="text-pink-500 font-mono font-bold block">⬛ Black</span>
                              <span className="text-slate-700 font-bold truncate block">
                                {blackP}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-pink-100 flex items-center justify-between text-[10px] font-mono font-semibold">
                          <div className="flex items-center gap-1.5 text-pink-700">
                            <Clock className="w-3.5 h-3.5 text-pink-500" />
                            <span>
                              {room.timeControl > 0 ? `${room.timeControl} mins` : "Untimed Sandbox"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {room.status === "finished" ? (
                              <span className="bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                Finished
                              </span>
                            ) : room.players.w && room.players.b ? (
                              <span className="bg-rose-50 text-pink-600 border border-pink-200 px-2 py-0.5 rounded-full font-bold animate-pulse">
                                Live In Action
                              </span>
                            ) : (
                              <span className="bg-sky-50 text-sky-600 border border-sky-200 px-2 py-0.5 rounded-full font-bold">
                                Waiting
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =========================================================================
             ACTIVE GAME ROOM BOARD SCREEN
             ========================================================================= */
          currentRoom && (
            <div className="space-y-6">
              {/* Back to lobby navigation banner row */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white/95 border border-pink-100 rounded-2xl p-4 shadow-[0_4px_20px_rgba(244,143,177,0.1)]">
                <button
                  id="back_to_lobby_button"
                  onClick={() => setSelectedRoomId(null)}
                  className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs py-1.5 px-3 rounded-xl border border-pink-200 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Rooms List
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-800 tracking-tight leading-none font-sans">
                    {currentRoom.name}
                  </h2>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentRoom.id.slice(5));
                      setIdCopied(true);
                      setTimeout(() => setIdCopied(false), 2000);
                    }}
                    title="Click to copy Room Code ID"
                    className="bg-white hover:bg-pink-50 text-pink-600 hover:text-pink-700 font-mono text-[9px] py-1 px-2 rounded-lg border border-pink-200 active:scale-95 transition-all flex items-center gap-1.5 focus:outline-none font-semibold"
                  >
                    <span>ID: {currentRoom.id.slice(5)}</span>
                    <span className="text-[8px] bg-pink-100 px-1 py-0.5 rounded text-pink-600 font-sans">
                      {idCopied ? "✓ Copied!" : "📋 Copy"}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="flip_board_button"
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="text-xs bg-white hover:bg-pink-50 text-pink-700 border border-pink-200 font-mono tracking-wider font-bold py-1.5 px-3 rounded-xl transition"
                  >
                    🔄 Flip Board perspective
                  </button>
                  <button
                    id="reset_board_button"
                    onClick={handleResetBoard}
                    className="text-xs bg-rose-50 hover:bg-rose-100/80 text-rose-600 border border-rose-200 font-mono tracking-wider font-bold py-1.5 px-3 rounded-xl transition"
                    title="Soft reset chess board to start a fresh game"
                  >
                    Reset Board
                  </button>
                </div>
              </div>

              {/* Game match-up active status banner cards */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Chess board and main actions (Left, occupies 7/12 cols) */}
                <div className="col-span-1 md:col-span-7 flex flex-col items-center gap-4 bg-white/95 border border-pink-100 p-4 md:p-6 rounded-2xl shadow-[0_4px_20px_rgba(244,143,177,0.1)]">
                  {/* Dynamic Match Opponents HUD */}
                  <div className="w-full flex justify-between items-center px-4 py-2 border-b border-pink-100 bg-pink-50/35 rounded-xl mb-2">
                    {/* White details */}
                    <div className="flex flex-col font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-white rounded border border-pink-300 shadow-sm" />
                        <span
                          className={`text-slate-800 text-xs font-bold ${
                            currentRoom.turn === "w" ? "text-pink-600 ring-2 ring-pink-500/20 px-1.5 py-0.5 rounded bg-pink-100/80" : "text-slate-700"
                          }`}
                        >
                          {currentRoom.players.w || "Waiting to Join..."}
                        </span>
                      </div>
                      <span className="text-[9px] text-pink-500 font-mono font-bold pl-4">White Player</span>
                    </div>

                    <div className="flex items-center gap-2 font-semibold text-pink-500">
                      <Swords className="w-4 h-4 text-pink-400 animate-pulse" />
                      <span className="text-[10px] tracking-widest font-mono">VS</span>
                    </div>

                    {/* Black details */}
                    <div className="flex flex-col items-end font-sans">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-slate-800 text-xs font-bold ${
                            currentRoom.turn === "b" ? "text-pink-600 ring-2 ring-pink-500/20 px-1.5 py-0.5 rounded bg-pink-100/80" : "text-slate-700"
                          }`}
                        >
                          {currentRoom.players.b || "Waiting to Join..."}
                        </span>
                        <span className="w-2.5 h-2.5 bg-slate-800 rounded border border-slate-950 shadow-sm" />
                      </div>
                      <span className="text-[9px] text-pink-500 font-mono font-bold pr-4">Black Player</span>
                    </div>
                  </div>

                  {/* Chess board rendering component */}
                  <div className="w-full flex justify-center">
                    {(() => {
                      const userRole = currentRoom.players.w === playerName ? "w" : currentRoom.players.b === playerName ? "b" : "spectator";
                      const localSandboxMode = currentRoom.players.w === null && currentRoom.players.b === null;
                      const userColor = localSandboxMode ? "both" : userRole;
                      return (
                        <ChessBoard
                          board={currentRoom.board}
                          selectedSquare={selectedSquare}
                          validMoves={validDestinations}
                          onSquareClick={handleSquareClick}
                          isFlipped={isFlipped}
                          turn={currentRoom.turn}
                          kingInCheckPos={activeKingInCheckPos}
                          userColor={userColor}
                        />
                      );
                    })()}
                  </div>

                  {currentRoom.status === "waiting" && (
                    <div className="w-full bg-pink-50/50 border border-pink-100 p-5 rounded-2xl flex flex-col items-center text-center gap-4 mt-2 animate-fade-in shadow-inner">
                      <div className="space-y-1">
                        <span className="font-sans font-bold block uppercase tracking-wider text-[11px] text-pink-600 flex items-center justify-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                          대국 대기 및 준비 중 (Game Setup / Waiting)
                        </span>
                        <p className="text-xs text-slate-600 font-sans max-w-md">
                          온라인 멀티플레이 상태이거나, 혼자서도 즉시 실행해 볼 수 있습니다. 아래의 매치 모드 중 하나를 선택하여 게임을 즉시 실행하고 시작하세요!
                        </p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2.5 justify-center w-full max-w-md">
                        {/* Option 1: VS AI */}
                        <button
                          onClick={() => {
                            const emptySide = currentRoom.players.w ? "b" : "w";
                            handleAddAI(emptySide);
                          }}
                          className="flex-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold font-sans px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-pink-200 transition-all active:scale-95 duration-150 cursor-pointer"
                        >
                          🤖 AI 컴퓨터 대결 시작 (Play vs AI)
                        </button>

                        {/* Option 2: Practice sandbox playing both sides */}
                        <button
                          onClick={() => {
                            const emptySide = currentRoom.players.w ? "b" : "w";
                            setRooms(rooms.map(r => {
                              if (r.id !== selectedRoomId) return r;
                              const updated = { ...r };
                              updated.players[emptySide] = "Local Player (혼자 연습)";
                              updated.status = "active";
                              updated.isClockActive = updated.timeControl > 0;
                              return updated;
                            }));
                          }}
                          className="flex-1 bg-white hover:bg-pink-50 text-slate-700 text-xs font-bold font-sans px-4 py-2.5 rounded-xl border border-pink-200 flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-150 cursor-pointer shadow-sm"
                        >
                          👥 1인 2역 혼자 대국 (Sandbox)
                        </button>
                      </div>

                      {/* Info on how friends can join */}
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5 font-semibold">
                        💡 상단의 <span className="bg-pink-100/60 border border-pink-200 px-1 py-0.5 rounded text-pink-700 font-mono font-bold">ID: {currentRoom.id.slice(5)}</span> 코드를 복사해 다른 브라우저 탭(GUEST)에 입력하면 친구와 함께 플레이가 가능합니다!
                      </div>
                    </div>
                  )}

                  {/* Mid-Game functional controls panel underneath */}
                  <div className="w-full flex justify-between items-center gap-4 mt-2">
                    {/* Seat claiming sandbox buttons if seats are empty */}
                    <div className="flex gap-2 text-xs font-mono">
                      {!currentRoom.players.w && (
                        <div className="flex gap-1 bg-white p-1 rounded-lg border border-pink-200">
                          <button
                            onClick={() => handleJoinSide("w")}
                            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-1 px-2.5 rounded text-[10px] cursor-pointer"
                          >
                            Claim White
                          </button>
                          <button
                            onClick={() => handleAddAI("w")}
                            className="bg-pink-50 hover:bg-pink-100 text-pink-700 py-1 px-2 rounded text-[10px] cursor-pointer"
                          >
                            Add AI
                          </button>
                        </div>
                      )}
                      {!currentRoom.players.b && (
                        <div className="flex gap-1 bg-white p-1 rounded-lg border border-pink-200">
                          <button
                            onClick={() => handleJoinSide("b")}
                            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-1 px-2.5 rounded text-[10px] cursor-pointer"
                          >
                            Claim Black
                          </button>
                          <button
                            onClick={() => handleAddAI("b")}
                            className="bg-pink-50 hover:bg-pink-100 text-pink-700 py-1 px-2 rounded text-[10px] cursor-pointer"
                          >
                            Add AI
                          </button>
                        </div>
                      )}
                      {(currentRoom.players.w || currentRoom.players.b) && (
                        <button
                          onClick={handleJoinSpectator}
                          className="bg-white hover:bg-pink-50 text-pink-700 py-1 px-3 border border-pink-200 rounded-lg text-[10px] font-semibold cursor-pointer"
                        >
                          Join Spectators
                        </button>
                      )}
                    </div>

                    {/* Operational resign/draw offers */}
                    {currentRoom.status === "active" && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleDrawOffer}
                          className="bg-white hover:bg-pink-50 text-pink-700 font-mono text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded-lg border border-pink-200 transition cursor-pointer"
                        >
                          Offer Draw
                        </button>
                        <button
                          onClick={handleResign}
                          className="bg-rose-50 hover:bg-rose-100/80 text-rose-600 font-mono text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded-lg border border-rose-200 transition cursor-pointer"
                        >
                          Resign
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Highlight Banner for Checked status */}
                  {currentRoom.status === "active" && activeKingInCheckPos && (
                    <div className="w-full bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-3.5 text-rose-600 text-xs animate-pulse mt-4">
                      <Skull className="w-5 h-5 text-rose-500 animate-bounce" />
                      <div>
                        <span className="font-extrabold block uppercase tracking-wide text-[10px] font-mono text-rose-700">Under Siege! (체크 상태)</span>
                        <span className="font-sans text-slate-700 font-semibold">
                          The {currentRoom.turn === "w" ? "White" : "Black"} King is in check! However, you can move any other piece too!
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Game Ending Outcome Declaration card */}
                  {currentRoom.status === "finished" && (() => {
                    const wName = currentRoom.players.w || "White";
                    const bName = currentRoom.players.b || "Black";
                    
                    const wStats = leaderboard.find(p => p.username.toLowerCase() === wName.toLowerCase());
                    const bStats = leaderboard.find(p => p.username.toLowerCase() === bName.toLowerCase());
                    
                    const wWins = wStats ? wStats.wins : 0;
                    const bWins = bStats ? bStats.wins : 0;

                    return (
                      <div className="w-full bg-pink-50 border border-pink-200 p-4 rounded-xl flex items-center gap-4 text-xs mt-4 animate-fade-in shadow-sm">
                        <div className="bg-pink-500 p-2.5 rounded-lg text-white shadow flex-shrink-0">
                          <Trophy className="w-6 h-6 animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-mono font-bold block uppercase tracking-wider text-[10px] text-pink-600">
                            Game Over - {currentRoom.reason}
                          </span>
                          <span className="font-sans text-slate-800 text-sm font-semibold">
                            {currentRoom.winner === "draw" ? (
                              "Match concluded as a draw."
                            ) : (
                              <>
                                Winner:{" "}
                                <strong className="text-pink-600">
                                  {currentRoom.players[currentRoom.winner!] ||
                                    (currentRoom.winner === "w" ? "White" : "Black")}
                                </strong>{" "}
                                ({currentRoom.winner === "w" ? "White" : "Black"}) won the battle!
                              </>
                            )}
                          </span>
                          
                          {/* Live Tally Scoreboard details in PLAYER9162 1 : 0 format */}
                          <div className="mt-2.5 pt-2 border-t border-pink-100 flex flex-col gap-1 select-none">
                            <span className="text-[9px] uppercase tracking-wider font-mono text-pink-500 font-bold">
                              🏆 Current Record Tally:
                            </span>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs font-semibold text-slate-700">
                              <span className="text-slate-900 font-bold">{wName}</span>
                              <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {wWins}
                              </span>
                              <span className="text-pink-300">:</span>
                              <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {bWins}
                              </span>
                              <span className="text-slate-900 font-bold">{bName}</span>
                              
                              <span className="text-[10px] font-sans text-pink-500 ml-auto font-bold animate-pulse">
                                (Saved to {supabase ? "Supabase Realtime" : "Local Storage DB"}!)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Captured, Move logs, Chat side controls (Right, occupies 5/12 cols) */}
                <div className="col-span-1 md:col-span-5 flex flex-col gap-4">
                  {/* Real-time clocks dashboard if enabled */}
                  {currentRoom.timeControl > 0 && (
                    <ChessClock
                      clocks={currentRoom.clocks}
                      turn={currentRoom.turn}
                      isClockActive={currentRoom.isClockActive}
                      gameStatus={currentRoom.status}
                    />
                  )}

                  {/* Captured trophies */}
                  <CapturedPieces moves={currentRoom.moveHistory} />

                  {/* Move history log register */}
                  <MoveLog
                    moves={currentRoom.moveHistory}
                    onUndoMove={handleUndoMove}
                    gameStatus={currentRoom.status}
                  />

                  {/* Living chat feed */}
                  <ChatBox
                    chatLog={currentRoom.chatLog}
                    onSendMessage={handleSendMessage}
                    currentUser={playerName}
                    userRole={
                      currentRoom.players.w === playerName
                        ? "w"
                        : currentRoom.players.b === playerName
                        ? "b"
                        : "spectator"
                    }
                  />
                </div>
              </div>
            </div>
          )
        )}
      </main>

      {/* Decorative clean footer */}
      <footer className="bg-white/80 border-t border-pink-100 py-6 text-center select-none mt-auto">
        <p className="text-[10px] text-pink-600 font-sans uppercase tracking-widest font-semibold">
          Chess Rooms Lounge 🌸 Pure Sandbox Code Base
        </p>
      </footer>
    </div>
  );
}
