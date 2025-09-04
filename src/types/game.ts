// src/types/game.ts
export type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'
  | 'เกมประกาศรางวัล'; // ✅ ใหม่

export type GameData = {
  id: string;
  type: GameType;
  name: string;
  unlocked?: boolean;
  locked?: boolean;
  codes?: string[];
  codeCursor?: number;
  claimedBy?: Record<string, any>;
  puzzle?: { imageDataUrl?: string; answer?: string };
  numberPick?: { imageDataUrl?: string; endAt?: number | null };
  football?: { imageDataUrl?: string; homeTeam?: string; awayTeam?: string; endAt?: number | null };
  slot?: any;
  announce?: { users: string[] }; // ✅ สำหรับเกมประกาศรางวัล
};
