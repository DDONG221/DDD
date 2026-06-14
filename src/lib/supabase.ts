import { createClient } from "@supabase/supabase-js";

// Load Supabase environment variables
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

// Check if credentials are provided
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface PlayerStats {
  username: string;
  wins: number;
  losses: number;
  draws: number;
  updated_at?: string;
}

// Local storage backup key
const STATS_LOCAL_KEY = "chess_local_player_stats";

// Helper to load all stats from localStorage
function getLocalStats(): PlayerStats[] {
  try {
    const cached = localStorage.getItem(STATS_LOCAL_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (e) {
    console.error("Failed to read local stats", e);
    return [];
  }
}

// Helper to save stats to localStorage
function saveLocalStats(stats: PlayerStats[]) {
  try {
    localStorage.setItem(STATS_LOCAL_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to write local stats", e);
  }
}

/**
 * Fetches the statistics for all players.
 * If Supabase is connected, it retrieves records from supabase database.
 * If not, it falls back to localStorage.
 */
export async function getLeaderboard(): Promise<PlayerStats[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("player_stats")
        .select("*")
        .order("wins", { ascending: false });

      if (error) {
        console.warn("Supabase fetch failed, falling back to local storage.", error);
        return getLocalStats().sort((a, b) => b.wins - a.wins);
      }
      return data || [];
    } catch (e) {
      console.warn("Failed to talk to Supabase. Falling back to local storage.", e);
      return getLocalStats().sort((a, b) => b.wins - a.wins);
    }
  } else {
    // If Supabase credentials are not entered yet, fetch from localStorage sorted by wins
    return getLocalStats().sort((a, b) => b.wins - a.wins);
  }
}

/**
 * Records a game result by incrementing wins, losses, or draws for the players.
 * If Supabase is connected, it performs an upsert with increments.
 * If not, it applies the updates to localStorage.
 */
export async function recordGameResult(
  whitePlayer: string,
  blackPlayer: string,
  winner: "w" | "b" | "draw" | null
): Promise<{ success: boolean; whiteStats?: PlayerStats; blackStats?: PlayerStats }> {
  // Normalize player names, skip AI or spectator cases
  const p1 = whitePlayer?.trim();
  const p2 = blackPlayer?.trim();

  if (!p1 || !p2 || p1 === "Computer (AI)" || p2 === "Computer (AI)") {
    return { success: false };
  }

  // Determine win/loss status
  let wWins = 0, wLosses = 0, wDraws = 0;
  let bWins = 0, bLosses = 0, bDraws = 0;

  if (winner === "w") {
    wWins = 1;
    bLosses = 1;
  } else if (winner === "b") {
    bWins = 1;
    wLosses = 1;
  } else if (winner === "draw") {
    wDraws = 1;
    bDraws = 1;
  } else {
    // Game not ended or unknown winner
    return { success: false };
  }

  if (supabase) {
    try {
      // 1. Update White Player
      // First fetch current record to do calculation, or do dynamic upsert if your DB triggers support it.
      // Since client-side RPC or simple select-then-upsert is safest without custom database package functions:
      const { data: wOld } = await supabase
        .from("player_stats")
        .select("*")
        .eq("username", p1)
        .single();

      const newWhite: PlayerStats = {
        username: p1,
        wins: (wOld?.wins || 0) + wWins,
        losses: (wOld?.losses || 0) + wLosses,
        draws: (wOld?.draws || 0) + wDraws,
        updated_at: new Date().toISOString()
      };

      await supabase.from("player_stats").upsert(newWhite);

      // 2. Update Black Player
      const { data: bOld } = await supabase
        .from("player_stats")
        .select("*")
        .eq("username", p2)
        .single();

      const newBlack: PlayerStats = {
        username: p2,
        wins: (bOld?.wins || 0) + bWins,
        losses: (bOld?.losses || 0) + bLosses,
        draws: (bOld?.draws || 0) + bDraws,
        updated_at: new Date().toISOString()
      };

      await supabase.from("player_stats").upsert(newBlack);

      return { success: true, whiteStats: newWhite, blackStats: newBlack };
    } catch (e) {
      console.warn("Supabase upsert failed, recording locally.", e);
    }
  }

  // Fallback / standard localStorage storage logic
  const localList = getLocalStats();
  
  // Find or insert white player
  let wIdx = localList.findIndex((item) => item.username.toLowerCase() === p1.toLowerCase());
  if (wIdx === -1) {
    localList.push({ username: p1, wins: 0, losses: 0, draws: 0 });
    wIdx = localList.length - 1;
  }
  localList[wIdx].wins += wWins;
  localList[wIdx].losses += wLosses;
  localList[wIdx].draws += wDraws;
  localList[wIdx].updated_at = new Date().toISOString();

  // Find or insert black player
  let bIdx = localList.findIndex((item) => item.username.toLowerCase() === p2.toLowerCase());
  if (bIdx === -1) {
    localList.push({ username: p2, wins: 0, losses: 0, draws: 0 });
    bIdx = localList.length - 1;
  }
  localList[bIdx].wins += bWins;
  localList[bIdx].losses += bLosses;
  localList[bIdx].draws += bDraws;
  localList[bIdx].updated_at = new Date().toISOString();

  saveLocalStats(localList);

  return {
    success: true,
    whiteStats: localList[wIdx],
    blackStats: localList[bIdx]
  };
}
