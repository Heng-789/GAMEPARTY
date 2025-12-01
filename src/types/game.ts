// src/types/game.ts
export type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'
  | 'เกมประกาศรางวัล'
  | 'เกม Trick or Treat'
  | 'เกมลอยกระทง'
  | 'เกม BINGO';

export type GameData = {
  id: string;
  type: GameType;
  name: string;
  unlocked?: boolean;
  locked?: boolean;
  userAccessType?: 'all' | 'selected';
  selectedUsers?: string[];
  codes?: string[];
  codeCursor?: number;
  claimedBy?: Record<string, any>;
  puzzle?: { imageDataUrl?: string; answer?: string };
  numberPick?: { imageDataUrl?: string; endAt?: number | null };
  football?: { imageDataUrl?: string; homeTeam?: string; awayTeam?: string; endAt?: number | null };
  slot?: any;
  announce?: { 
    users?: string[]; 
    userBonuses?: Array<{ user: string; bonus: number }>; 
    imageDataUrl?: string; // รูปภาพประกาศรางวัล (CDN URL หรือ Supabase Storage URL)
    fileName?: string; // ชื่อไฟล์รูปภาพ
  };
  trickOrTreat?: {
    winChance?: number; // โอกาสชนะ (0-100)
    ghostImage?: string; // รูปผีที่เด้งขึ้นมา
  };
  loyKrathong?: {
    image?: string; // รูปภาพพื้นหลัง
    endAt?: number | null; // เวลาจบเกม
    codes?: string[]; // โค้ดรางวัลธรรมดา
    codeCursor?: number; // ตำแหน่งโค้ดปัจจุบัน
    claimedBy?: Record<string, any>; // ใครได้รับโค้ดแล้ว
    bigPrizeCodes?: string[]; // โค้ดรางวัลใหญ่
    bigPrizeCodeCursor?: number; // ตำแหน่งโค้ดรางวัลใหญ่ปัจจุบัน
    bigPrizeClaimedBy?: Record<string, any>; // ใครได้รับรางวัลใหญ่แล้ว
    playerCount?: number; // จำนวนผู้เล่นที่เล่นแล้ว (สำหรับคำนวณทุกๆ 20)
  };
  bingo?: {
    image?: string; // รูปภาพพื้นหลัง
    endAt?: number | null; // เวลาจบเกม
    codes?: string[]; // โค้ดรางวัล
    codeCursor?: number; // ตำแหน่งโค้ดปัจจุบัน
    claimedBy?: Record<string, any>; // ใครได้รับโค้ดแล้ว
    playerCount?: number; // จำนวนผู้เล่นที่เล่นแล้ว
    numbers?: number[]; // ตัวเลขที่สุ่มออกมาแล้ว
    currentNumber?: number; // ตัวเลขปัจจุบัน
    gameStarted?: boolean; // เกมเริ่มแล้วหรือยัง
    players?: Record<string, any>; // ข้อมูลผู้เล่นที่เข้าร่วม
    maxUsers?: number; // จำนวน USER สูงสุดต่อรอบ
    autoStartUsers?: number; // จำนวน USER ที่จะเริ่มเกมอัตโนมัติ
    readyCountdown?: number; // เวลานับถอยหลังก่อนเกมเริ่ม (วินาที)
    readyCountdownEnd?: number; // เวลาที่นับถอยหลังจะจบ
    readyPlayers?: Record<string, boolean>; // ผู้เล่นที่กด READY แล้ว
    gamePhase?: 'waiting' | 'ready' | 'playing' | 'finished'; // ระยะของเกม
    autoDrawInterval?: number; // ช่วงเวลาสุ่มตัวเลข (วินาที)
    drawnNumbers?: number[]; // ตัวเลขที่ออกไปแล้วทั้งหมด
  };
};
