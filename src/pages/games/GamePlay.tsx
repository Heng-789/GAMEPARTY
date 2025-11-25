// src/pages/play/PlayGame.tsx
import React from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
// ✅ Removed Firebase RTDB imports - using PostgreSQL 100%
import { dataCache } from '../../services/cache'
import * as postgresqlAdapter from '../../services/postgresql-adapter'
import '../../styles/style.css'
import SlotGame from '../../components/SlotGame'
import PuzzleGame from '../../components/PuzzleGame'
import NumberGame from '../../components/NumberGame'
import FootballGame from '../../components/FootballGame'
import CheckinGame from '../../components/CheckinGame'
import TrickOrTreatGame from '../../components/TrickOrTreatGame'
import LoyKrathongGame from '../../components/LoyKrathongGame'
import BingoGame from '../../components/BingoGame'
import AnnounceGame from '../../components/AnnounceGame'
import SnowEffect from '../../components/SnowEffect'
import { useTheme, useThemeAssets, useThemeBranding, useThemeColors } from '../../contexts/ThemeContext'
import { getImageUrl } from '../../services/image-upload'
import { useSocketIOGameData } from '../../hooks/useSocketIO'

/** แปลงชื่อให้เป็นรูปแบบคีย์ใน DB (ตัดช่องว่างและอักขระพิเศษ) */
const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '').replace(/[.#$[\]@]/g, '_').toUpperCase()

const hexToRgba = (hex: string, alpha = 1) => {
  if (!hex) return `rgba(0,0,0,${alpha})`
  let sanitized = hex.replace('#', '')
  if (sanitized.length === 3) {
    sanitized = sanitized
      .split('')
      .map((c) => c + c)
      .join('')
  }
  if (sanitized.length !== 6) return `rgba(0,0,0,${alpha})`
  const intVal = parseInt(sanitized, 16)
  const r = (intVal >> 16) & 255
  const g = (intVal >> 8) & 255
  const b = intVal & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const clampSize = (min: number, vw: number, max: number) => `clamp(${min}px, ${vw}vw, ${max}px)`

type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'
  | 'เกมประกาศรางวัล'
  | 'เกม Trick or Treat'
  | 'เกมลอยกระทง'
  | 'เกม BINGO'

type GameData = {
  id: string
  type: GameType
  name: string
  unlocked?: boolean
  locked?: boolean
  userAccessType?: 'all' | 'selected'
  selectedUsers?: string[]
  codes?: string[]
  codeCursor?: number
  claimedBy?: Record<string, any>
  puzzle?: { imageDataUrl?: string; answer?: string }
  numberPick?: { imageDataUrl?: string; endAt?: number | null }
  football?: { imageDataUrl?: string; homeTeam?: string; awayTeam?: string; endAt?: number | null }
  slot?: any
  announce?: { users: string[] }
  checkin?: { users?: string[]; [key: string]: any }
  trickOrTreat?: { 
    winChance?: number
    ghostImage?: string
  }
  bingo?: {
    maxUsers: number
    autoStartUsers: number
    codes: string[]
    players: Record<string, any>
    status: 'waiting' | 'playing' | 'finished'
    gameState: {
      calledNumbers: number[]
      gameStarted: boolean
      gameEnded: boolean
    }
  }
}

type ModalKind = 'info' | 'code' | 'codes-empty';

const TYPE_META: Record<GameType, { icon: string; cls: string; label: string }> = {
  'เกมทายภาพปริศนา': { icon: '🧩', cls: 'type-puzzle',   label: 'เกมทายภาพปริศนา' },
  'เกมทายเบอร์เงิน' : { icon: '🔢', cls: 'type-number',   label: 'เกมทายเบอร์เงิน' },
  'เกมทายผลบอล'     : { icon: '⚽️', cls: 'type-football', label: 'เกมทายผลบอล' },
  'เกมสล็อต'         : { icon: '🎰', cls: 'type-slot',     label: 'เกมสล็อต' },
  'เกมเช็คอิน'       : { icon: '📍', cls: 'type-checkin',  label: 'HENG36 GAME ' },
  'เกมประกาศรางวัล': { icon: '🏆', cls: 'type-announce', label: 'เกมประกาศรางวัล' },
  'เกม Trick or Treat': { icon: '🎃', cls: 'type-trickortreat', label: 'เกม Trick or Treat' },
  'เกมลอยกระทง'     : { icon: '🪔', cls: 'type-loy',       label: 'เกมลอยกระทง' },
  'เกม BINGO'        : { icon: '🎯', cls: 'type-bingo',    label: 'เกม BINGO' },
}
const getTypeMeta = (t: GameType) => TYPE_META[t] ?? { icon: '🎮', cls: 'type-default', label: t }

/** ----- Overlay แบบ portal ----- */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose || undefined}>{children}</div>,
    document.body
  )
}

type ModalState =
  | { open: false }
  | { open: true; kind: 'info'; title: string; message: string; extra?: any }
  | { open: true; kind: 'code'; title: string; message: string; code: string }
  | { open: true; kind: 'saved'; title: string; message: string; extra?: any }
  | { open: true; kind: ModalKind; title?: string; message?: string; code?: string }
  | {
      open: true; kind: 'confirm-replace'; title: string; message?: string;
      oldLabel: string; oldValue: string;
      newLabel: string; newValue: string;
      onConfirm: () => Promise<void> | void;
    }
  | { open: true; kind: 'codes-empty'; title: string; message: string }

export default function PlayGame() {
  // รองรับทั้ง /play/:id, /?id=..., และ /host/:id
  const params = useParams()
  const [sp] = useSearchParams()
  const location = useLocation()
  const id = (params.id || sp.get('id') || '').trim()
  // เช็คเงื่อนไข HOST จาก path /host/:id
  const isHost = location.pathname.startsWith('/host/')
  const assets = useThemeAssets()
  const branding = useThemeBranding()
  const colors = useThemeColors()
  const { themeName } = useTheme()

  const buildExpiredMessage = React.useCallback(
    (player: string, score?: string | null) => {
      const headlineColor = colors.primary ?? '#2563eb'
      const subColor = colors.primaryDark ?? colors.primary ?? '#1d4ed8'
      const scoreColor = colors.danger ?? '#dc2626'
      const safePlayer = player || 'คุณ'
      const parts = [
        `<span style="color:${headlineColor}; font-weight:800;">เกมจบลงแล้ว</span>`,
        `<span style="color:${subColor}; font-weight:700;">สกอร์ที่ ${safePlayer} ทายไว้</span>`,
      ]
      if (score) {
        parts.push(`<span style="color:${scoreColor}; font-weight:800; font-size:18px;">${score}</span>`)
      } else {
        const muted = colors.textSecondary ?? '#64748b'
        parts.push(`<span style="color:${muted}; font-weight:600;">ยังไม่ได้ทายสกอร์ไว้ค่ะ</span>`)
      }
      return parts.join('<br/>')
    },
    [colors.danger, colors.primary, colors.primaryDark]
  )

  const [game, setGame] = React.useState<GameData | null>(null)
  const [loading, setLoading] = React.useState(true)
  
  // ✅ Use Socket.io for game data real-time updates (แทน polling)
  const { data: gameData, loading: gameDataLoading } = useSocketIOGameData(id)
  
  React.useEffect(() => {
    if (!id) {
      setGame(null)
      setLoading(false)
      return
    }

    setLoading(gameDataLoading)
    
    if (gameData) {
      const gameDataTyped = { id, ...gameData } as GameData
      setGame(gameDataTyped)
      // ✅ Invalidate cache เมื่อมีการอัพเดต
      dataCache.invalidateGame(id)
    } else if (!gameDataLoading) {
      setGame(null)
    }
  }, [id, gameData, gameDataLoading])

  // กำหนด username สำหรับ HOST ตามธีม
  const getHostUsername = () => {
    if (themeName === 'max56') return 'MAX56'
    if (themeName === 'jeed24') return 'JEED24'
    return 'HENG36'
  }

  // ผู้เล่น
  // ✅ ไม่โหลด username จาก localStorage เมื่อ component mount - ให้ login ใหม่ทุกครั้งที่ refresh
  const [username, setUsername] = React.useState(
    isHost ? getHostUsername() : ''
  )
  const [password, setPassword] = React.useState('')
  const [userStatus, setUserStatus] = React.useState<string | null>(null)  
  const [needName, setNeedName] = React.useState(!isHost)
  const [checkingName, setCheckingName] = React.useState(false)

  // ✅ สำหรับ HOST: ข้ามการ login ทันทีเมื่อ game โหลดเสร็จ
  React.useEffect(() => {
    if (isHost && game?.type === 'เกม BINGO' && username) {
      setNeedName(false)
      localStorage.setItem('player_name', username)
    }
  }, [isHost, game?.type, username])

React.useEffect(() => {
  if (typeof window === 'undefined') return
  const update = () => setIsNarrowScreen(window.innerWidth < 560)
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
}, [])

  // ทั่วไป
  const [submitting, setSubmitting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [expiredShown, setExpiredShown] = React.useState(false)
  const [runtimeExpired, setRuntimeExpired] = React.useState(false)
  const userKey = React.useMemo(() => normalizeUser(username || ''), [username])
  // สำหรับเกมประกาศรางวัล: เก็บข้อมูลโบนัสที่จะแสดงในหน้า
const [announceBonus, setAnnounceBonus] = React.useState<{ user: string; bonus: number } | null>(null)
const [initialFootballGuess, setInitialFootballGuess] = React.useState<{ home: number; away: number } | null>(null)
const [lastFootballGuessText, setLastFootballGuessText] = React.useState<string | null>(null)
const [lastFootballGuessLoaded, setLastFootballGuessLoaded] = React.useState(false)
const footballGuessShownRef = React.useRef(false)
const [lastNumberGuess, setLastNumberGuess] = React.useState<string | null>(null)
const [lastNumberGuessLoaded, setLastNumberGuessLoaded] = React.useState(false)
const numberGuessShownRef = React.useRef(false)
// ให้ปุ่ม 'ตกลง' ทำงานพิเศษ (ตอนพบว่าเคยตอบแล้ว)
const [redirectOnOk, setRedirectOnOk] = React.useState<null | 'heng36'>(null);
const [isNarrowScreen, setIsNarrowScreen] = React.useState<boolean>(() => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 560
})

  const [ignoreSoldOutOnce, setIgnoreSoldOutOnce] = React.useState(false);
  const soldOutGuardRef = React.useRef(false);
  const [autoSoldOutDismissed, setAutoSoldOutDismissed] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false)

  // modal ส่วนกลาง (ทุกเกมใช้ร่วมกัน)
  const [modal, setModal] = React.useState<ModalState>({ open: false })
  const modalKind = modal.open ? modal.kind : undefined;
const modalTitle =
  modal.open && typeof (modal as any)?.title === 'string' ? (modal as any).title : '';
const modalHeaderTone =
  modal.open && (modal.kind === 'codes-empty' || modal.kind === 'confirm-replace') ? 'danger' : 'primary';
const modalBodyBackground = React.useMemo(
  () => hexToRgba(colors.bgSecondary ?? colors.gray100 ?? colors.primaryLight ?? colors.primary ?? '#ffffff', 0.95),
  [colors.bgSecondary, colors.gray100, colors.primary, colors.primaryLight]
);
const modalActionBackground = React.useMemo(
  () => hexToRgba(colors.bgPrimary ?? colors.bgSecondary ?? '#ffffff', 0.95),
  [colors.bgPrimary, colors.bgSecondary]
);
const modalExtra = modal.open && 'extra' in modal ? (modal as any).extra : undefined;
const modalTextStyles = React.useMemo(() => {
  const accent = colors.primary ?? '#2563eb';
  const primaryText = colors.textPrimary ?? '#0f172a';
  const secondaryText = colors.textSecondary ?? '#475569';
  const toRgba = (value: string, alpha: number) =>
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
      ? hexToRgba(value, alpha)
      : `rgba(0,0,0,${alpha})`;
  return {
    accentColor: accent,
    headline: {
      fontSize: clampSize(18, 2.4, 22),
      fontWeight: 800,
      letterSpacing: 0.3,
      color: primaryText,
      textShadow: `0 1px 2px ${toRgba(primaryText, 0.08)}`,
    },
    body: {
      fontSize: clampSize(14, 2.0, 16),
      fontWeight: 600,
      lineHeight: 1.7,
      letterSpacing: 0.12,
      color: secondaryText,
    },
    bodyStrong: {
      fontSize: clampSize(14, 2.0, 16),
      fontWeight: 700,
      lineHeight: 1.7,
      letterSpacing: 0.12,
      color: primaryText,
    },
    caption: {
      fontSize: clampSize(12, 1.6, 13.5),
      fontWeight: 500,
      letterSpacing: 0.4,
      textTransform: 'none' as const,
      color: secondaryText,
      opacity: 0.85,
    },
    highlightBox: {
      background: toRgba(accent, 0.09),
      borderRadius: 12,
      padding: '14px 18px',
      color: primaryText,
      fontWeight: 700,
      lineHeight: 1.65,
      letterSpacing: 0.2,
      fontSize: clampSize(13, 1.9, 16),
      boxShadow: `0 6px 18px ${toRgba(accent, 0.18)}`,
    },
  };
}, [colors.primary, colors.textPrimary, colors.textSecondary]);

  const goHeng36 = React.useCallback(() => {
    const targetUrl = themeName === 'max56' ? 'https://max-56.com' : 'https://heng-36z.com/'
    
    // ✅ เปิดในแท็บใหม่แทนการ redirect ทั้งหน้า เพื่อไม่ให้ auth state เปลี่ยน
    try {
      // ใช้ window.open เพื่อเปิดในแท็บใหม่
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      // Fallback: สร้าง link element และคลิก
      const link = document.createElement('a')
      link.href = targetUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }, [themeName])
  // ✅ แสดงชื่อธีมตาม branding
  const getThemeDisplayName = () => {
    switch (themeName) {
      case 'max56':
        return 'MAX56'
      case 'jeed24':
        return 'JEED24'
      case 'heng36':
      default:
        return 'HENG36'
    }
  }
  const goButtonLabel = `ไปที่ ${getThemeDisplayName()}`

  // หัวข้อ+คำอธิบายสำหรับ popup กรอกชื่อ (แตกต่างตามประเภทเกม)
const needTitle =
  game?.type === 'เกมประกาศรางวัล'
    ? 'เช็ค USER ที่ได้รับโบนัสประจำเดือน 100'
    : 'กรอกยูสเซอร์เพื่อเข้าเล่น'

const needSubtitle =
  game?.type === 'เกมประกาศรางวัล'
    ? 'กรอกยูสเซอร์เว็บ HENG36 ของคุณ เพื่อเช็คสิทธิ์รับโบนัสประจำเดือน'
    : 'ใช้ยูสเซอร์ของเว็บ HENG36 เท่านั้น'

  // อ่านสถานะโค้ด: รองรับ codes เป็น array/object และนับ "แจกจริง" จาก claimedBy
  const getCodeState = (g: any) => {
    const src: any = g ?? {};

    const rawCodes = src.codes;
    const total = Array.isArray(rawCodes)
      ? rawCodes.length
      : rawCodes && typeof rawCodes === 'object'
        ? Object.keys(rawCodes).length
        : 0;

    const rawClaimed = src.claimedBy || {};
    const used = Object.values(rawClaimed).filter((v: any) => {
      if (v == null) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string')  return v.length > 0;
      if (typeof v === 'number')  return v > 0;
      if (typeof v === 'object')  return !!(v.code || v.c) || Object.keys(v).length > 0;
      return false;
    }).length;

    const cursorRaw = Number(src.codeCursor ?? 0);
    const progress  = cursorRaw; // ใช้ cursorRaw โดยตรง ไม่ต้อง max กับ used

    return { total, used, cursor: progress, claimedBy: rawClaimed };
  };

    // ✅ OPTIMIZED: getPrevAnswer - ใช้ cache
    const getPrevAnswer = async (gameId: string, player: string) => {
      const answersIndexCacheKey = `answersIndex:${gameId}:${player}`
      let v = dataCache.get<any>(answersIndexCacheKey)
      
      if (!v) {
        // Use PostgreSQL adapter if available
        try {
          const answers = await postgresqlAdapter.getAnswers(gameId, 100)
          const playerAnswers = answers.filter((a: any) => a.userId === player)
          if (playerAnswers.length > 0) {
            const latestAnswer = playerAnswers.sort((a: any, b: any) => 
              (b.ts || 0) - (a.ts || 0)
            )[0]
            v = {
              answer: latestAnswer.answer,
              code: latestAnswer.code,
              correct: latestAnswer.correct,
              ts: latestAnswer.ts
            }
            // Cache ไว้ 2 นาที
            dataCache.set(answersIndexCacheKey, v, 2 * 60 * 1000)
          } else {
            return null
          }
        } catch (error) {
          console.error('Error fetching answers from PostgreSQL:', error)
          // ✅ No Firebase fallback - PostgreSQL only
          return null
        }
      }
      
      // รองรับทั้ง { answer: '...' } หรือเป็นสตริงตรงๆ
      return typeof v === 'string' ? v : (v.answer ?? null)
    }

const parseFootballAnswer = (raw: string): { home: number; away: number } | null => {
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) return null;
  const home = Number(match[1]);
  const away = Number(match[2]);
  if (Number.isNaN(home) || Number.isNaN(away)) return null;
  return { home, away };
};

const parseNumberGuess = (raw: string): string | null => {
  if (!raw) return null;
  const match = raw.match(/\d+/g);
  if (!match || match.length === 0) {
    const cleaned = raw.replace(/(เบอร์เงินที่ทาย|เลขที่ทาย)[:\s]*/i, '').trim();
    return cleaned || null;
  }
  return match[match.length - 1] ?? null;
};

const prettifyNumberLabel = (raw?: string | null) => {
  if (!raw) return raw ?? null;
  return raw.replace(/เลขที่ทาย/g, 'เบอร์เงินที่ทาย');
};

  // ✅ SOLD OUT popup (แบบไม่ใช้ useEffect): คำนวณเงื่อนไขและแสดงป๊อปอัปเมื่อเรนเดอร์
const showAutoSoldOut =
  !!game &&
  game.type === 'เกมทายภาพปริศนา' &&
  !needName &&                 // ต้องผ่านหน้ากรอกชื่อแล้ว
  !modal.open &&               // ถ้ามี popup อื่นเปิดอยู่ ไม่ทับ
  !autoSoldOutDismissed &&     // กดปิดไปแล้ว ไม่เด้งซ้ำ
  (() => {
    const { total, cursor, claimedBy } = getCodeState(game);
    if (total === 0) return false; // ไม่ได้ตั้งช่องโค้ด → ไม่ถือว่าหมด
    const meRaw = localStorage.getItem('player_name') || username || '';
    const me = normalizeUser(meRaw);
    const hasMyCode = !!(me && (claimedBy?.[me]?.code || claimedBy?.[me]));
    // ถ้าโค้ดหมด และผู้เล่นรายนี้ยังไม่เคยได้โค้ด → ถือว่า sold out
    const result = cursor >= total && !hasMyCode && !soldOutGuardRef.current && !ignoreSoldOutOnce;
    return result;
  })();

  // ✅ ใช้ real-time listener สำหรับ game data (ดูโค้ดด้านบน)

  /** เปลี่ยนเกม → รีเซ็ตสถานะ */
  React.useEffect(() => {
    // ✅ ป้องกันไม่ให้ reset needName เมื่อ modal code เปิดอยู่
    if (modal.open && modal.kind === 'code') {
      return // ไม่ reset needName เมื่อกำลังแสดง popup โค้ด
    }
    
    // ✅ ป้องกันไม่ให้ reset needName ถ้า username มีค่าแล้ว (ผู้ใช้ login แล้ว)
    // เพื่อป้องกันกรณีที่ game.updatedAt เปลี่ยนหลังจาก claim code สำเร็จ
    if (!isHost && username && username.trim()) {
      return // ไม่ reset needName ถ้า username มีค่าแล้ว
    }
    
    // ✅ สำหรับ HOST: ใช้ username ตามธีม
    if (isHost) {
      const hostUsername = getHostUsername()
      setUsername(hostUsername)
      setNeedName(false)
      localStorage.setItem('player_name', hostUsername)
    } else {
      // ✅ ไม่โหลด username จาก localStorage - ให้ login ใหม่ทุกครั้งที่เปลี่ยนเกมหรือ refresh
      // แต่ถ้า username มีค่าแล้ว (จาก state) ไม่ต้อง reset
      if (!username || !username.trim()) {
        setUsername('')
        setNeedName(true)
      }
    }
    setExpiredShown(false)
    setRuntimeExpired(false)
  }, [id, game?.type, (game as any)?.updatedAt, isHost, modal.open, (modal as any).kind, username])

  /** ล็อกสกอลล์เมื่อมีป๊อปอัป/กรอกยูส */
  React.useEffect(() => {
    const lock = needName || modal.open
    const prev = document.body.style.overflow
    document.body.style.overflow = lock ? 'hidden' : prev || ''
    return () => { document.body.style.overflow = prev }
  }, [needName, modal.open])

  /** ฟังก์ชันช่วยเปิด popup (ให้ลูกเรียกผ่าน props) */
  const openInfo = React.useCallback((title: string, message: string) => {
    const soldOut = /โค้ด(เต็ม|หมด)|code\s*(full|out)/i.test(`${title} ${message}`)
    if (soldOut) {
      // ไม่ต้องเช็ค soldOutGuardRef สำหรับโค้ดเต็ม เพราะเป็นสถานการณ์ปกติ
      setModal({ open:true, kind:'codes-empty', title:'🎉 โค้ดเต็มแล้วค่ะ', message:'ขออภัยค่ะ โค้ดรางวัลในเกมนี้ได้ถูกแจกหมดแล้ว\n\nรอติดตามกิจกรรมรอบหน้าค่ะ! 🎮' })
      return
    }
    setModal({ open:true, kind:'info', title, message })
  }, [])

  const isLocked = (g: GameData) => (g.locked === true) || (g.unlocked === false)
  const isExpired = (g: GameData) => {
    const now = Date.now()
    const t = g.numberPick?.endAt ?? g.football?.endAt ?? null
    return !!(t && now > t)
  }

const expired = React.useMemo(() => (game ? isExpired(game) : false), [game?.numberPick?.endAt, game?.football?.endAt])
  const locked  = React.useMemo(() => (game ? isLocked(game)  : false), [game])
  const normalize = (s: string) => s.trim().replace(/\s+/g, '')

React.useEffect(() => {
  if (!game || game.type !== 'เกมทายผลบอล' || needName || !username.trim()) {
    setInitialFootballGuess(null);
    setLastFootballGuessText(null);
    setLastFootballGuessLoaded(false);
    footballGuessShownRef.current = false;
    return;
  }

  footballGuessShownRef.current = false;
  setLastFootballGuessText(null);
  setLastFootballGuessLoaded(false);
  const player = normalizeUser(username);
  let cancelled = false;

  (async () => {
    try {
      const prev = await getPrevAnswer(id, player);
      if (cancelled) return;
      if (!prev) {
        setInitialFootballGuess(null);
        setLastFootballGuessText(null);
        setLastFootballGuessLoaded(true);
        return;
      }

      const homeName = game?.football?.homeTeam || 'ทีมเหย้า';
      const awayName = game?.football?.awayTeam || 'ทีมเยือน';
      const parsed = parseFootballAnswer(prev);
      if (parsed) {
        setInitialFootballGuess(parsed);
        setLastFootballGuessText(`${homeName} ${parsed.home} - ${parsed.away} ${awayName}`);
        setLastFootballGuessLoaded(true);
      } else if (!footballGuessShownRef.current) {
        footballGuessShownRef.current = true;
        setInitialFootballGuess(null);
        setLastFootballGuessText(prev);
        setLastFootballGuessLoaded(true);
        const who = username.trim() || 'คุณ';
        const title = expired ? 'เกมจบลงแล้ว' : 'สกอร์ที่คุณเคยทายไว้';
        if (expired) {
          setModal({
            open: true,
            kind: 'saved',
            title,
            message: '',
            extra: {
              user: username,
              answer: prev || 'ยังไม่ได้ทายสกอร์ไว้ค่ะ',
            },
          });
        } else {
          setModal({
            open: true,
            kind: 'info',
            title,
            message: prev,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load previous football guess', error);
      setLastFootballGuessLoaded(true);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [buildExpiredMessage, expired, game, id, needName, setModal, username]);

React.useEffect(() => {
  if (!game || game.type !== 'เกมทายเบอร์เงิน' || needName || !username.trim()) {
    setLastNumberGuess(null);
    setLastNumberGuessLoaded(false);
    numberGuessShownRef.current = false;
    return;
  }

  numberGuessShownRef.current = false;
  setLastNumberGuess(null);
  setLastNumberGuessLoaded(false);
  const player = normalizeUser(username);
  let cancelled = false;

  (async () => {
    try {
      const prev = await getPrevAnswer(id, player);
      if (cancelled) return;
      if (!prev) {
        setLastNumberGuess(null);
        setLastNumberGuessLoaded(true);
        return;
      }
      const value = parseNumberGuess(prev) || prev;
      setLastNumberGuess(prev);
      setLastNumberGuessLoaded(true);
      if (!expired && !numberGuessShownRef.current) {
        numberGuessShownRef.current = true;
        const primaryBg = `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.05)} 0%, ${hexToRgba(colors.primary, 0.18)} 100%)`;
        const primaryShadow = `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`;
        setModal({
          open: true,
          kind: 'saved',
          title: 'เบอร์เงินที่คุณเคยทายไว้',
          message: '',
          extra: {
            user: username,
            number: {
              value,
              label: prettifyNumberLabel(prev) || `เบอร์เงินที่ทาย: ${value}`,
              primaryBg,
              primaryShadow,
            },
            actions: {
              showRetake: true,
              onRetake: () => setModal({ open: false }),
            },
          },
        });
      }
    } catch (error) {
      console.error('Failed to load previous number guess', error);
      setLastNumberGuessLoaded(true);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [colors.primary, expired, game, id, needName, setModal, username]);

const renderModalHeader = React.useCallback(
  (title: string, tone: 'primary' | 'danger' = 'primary') => {
    if (!title) return null;
    const base =
      tone === 'danger'
        ? colors.danger ?? '#dc2626'
        : colors.primary ?? '#2563eb';
    const shadow = hexToRgba(base, 0.4);
    return (
      <div
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(base, 0.95)} 0%, ${hexToRgba(base, 0.75)} 100%)`,
          color: colors.textInverse ?? '#ffffff',
          padding: '18px 20px',
          textAlign: 'center',
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: 0.4,
          textTransform: 'none',
          boxShadow: `0 6px 18px ${shadow}`,
          borderRadius: '20px 20px 0 0',
        }}
      >
        {title}
      </div>
    );
  },
  [colors.danger, colors.primary, colors.textInverse]
);

const handleFootballGuessShown = React.useCallback((guess: { home: number; away: number }) => {
  if (footballGuessShownRef.current) return;
  footballGuessShownRef.current = true;
  const hName = game?.football?.homeTeam || 'ทีมเหย้า';
  const aName = game?.football?.awayTeam || 'ทีมเยือน';
  const primary = colors.primary;
  const danger = colors.danger;
  const primaryBg = `linear-gradient(135deg, ${hexToRgba(primary, 0.05)} 0%, ${hexToRgba(primary, 0.18)} 100%)`;
  const primaryShadow = `0 8px 22px ${hexToRgba(primary, 0.25)}`;
  const dangerBg = `linear-gradient(135deg, ${hexToRgba(danger, 0.05)} 0%, ${hexToRgba(danger, 0.18)} 100%)`;
  const dangerShadow = `0 8px 22px ${hexToRgba(danger, 0.25)}`;
  const who = username.trim() || 'คุณ';
  const title = expired ? 'เกมจบลงแล้ว' : 'สกอร์ที่คุณเคยทายไว้';
  const scoreText = `${hName} ${guess.home} - ${guess.away} ${aName}`;
  setLastFootballGuessText(scoreText);
  setLastFootballGuessLoaded(true);
  const message = expired
    ? buildExpiredMessage(who, scoreText)
    : '';
  setModal({
    open: true,
    kind: 'saved',
    title,
    message,
    extra: {
      user: username,
      football: { homeName: hName, awayName: aName, home: guess.home, away: guess.away, primaryBg, primaryShadow, dangerBg, dangerShadow },
      actions: {
        showRetake: true,
        onRetake: () => setModal({ open: false }),
      },
      ...(expired ? { html: true } : {}),
    },
  });
}, [buildExpiredMessage, colors.danger, colors.primary, expired, game?.football?.homeTeam, game?.football?.awayTeam, setModal, username]);

  // ดึงข้อมูล user status เมื่อ username เปลี่ยน
  React.useEffect(() => {
    if (!username.trim()) {
      setUserStatus(null)
      return
    }

    const key = normalizeUser(username)
    const fetchUserStatus = async () => {
      try {
        // ✅ ใช้ PostgreSQL adapter 100%
        const userData = await postgresqlAdapter.getUserData(key)
        
        if (userData) {
          setUserStatus(userData.status || null)
        } else {
          setUserStatus(null)
        }
      } catch (error) {
        console.error('Error fetching user status:', error)
        setUserStatus(null)
      }
    }

    fetchUserStatus()
  }, [username])

  /** เด้ง "หมดเวลาเล่น" ทันทีถ้าโหลดมาแล้วหมดเวลา */
  React.useEffect(() => {
    if (!game) return
    if (needName || !username.trim()) return
    const ready =
      game.type === 'เกมทายผลบอล'
        ? lastFootballGuessLoaded
        : game.type === 'เกมทายเบอร์เงิน'
        ? lastNumberGuessLoaded
        : true
    if (expired && !expiredShown && ready) {
      setExpiredShown(true)
      if (game.type === 'เกมทายผลบอล') {
        const homeName = game.football?.homeTeam || 'ทีมเหย้า'
        const awayName = game.football?.awayTeam || 'ทีมเยือน'
        const primaryBg = `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.05)} 0%, ${hexToRgba(colors.primary, 0.18)} 100%)`
        const primaryShadow = `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`
        const dangerBg = `linear-gradient(135deg, ${hexToRgba(colors.danger, 0.05)} 0%, ${hexToRgba(colors.danger, 0.18)} 100%)`
        const dangerShadow = `0 8px 22px ${hexToRgba(colors.danger, 0.25)}`
        const extra =
          initialFootballGuess != null
            ? {
                user: username,
                football: {
                  homeName,
                  awayName,
                  home: initialFootballGuess.home,
                  away: initialFootballGuess.away,
                  primaryBg,
                  primaryShadow,
                  dangerBg,
                  dangerShadow,
                },
              }
            : {
                user: username,
                answer: lastFootballGuessText || 'ยังไม่ได้ทายสกอร์ไว้ค่ะ',
              }
        setModal({
          open: true,
          kind: 'saved',
          title: 'เกมจบลงแล้ว',
          message: '',
          extra,
        })
      } else if (game.type === 'เกมทายเบอร์เงิน') {
        const primaryBg = `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.05)} 0%, ${hexToRgba(colors.primary, 0.18)} 100%)`
        const primaryShadow = `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`
        const value = lastNumberGuess ? parseNumberGuess(lastNumberGuess) || lastNumberGuess : 'ยังไม่ได้ทายเบอร์เงินไว้ค่ะ'
        const extra = lastNumberGuess
          ? {
              user: username,
              number: {
                value,
                label: prettifyNumberLabel(lastNumberGuess) || lastNumberGuess,
                primaryBg,
                primaryShadow,
              },
            }
          : {
              user: username,
              answer: 'ยังไม่ได้ทายเบอร์เงินไว้ค่ะ',
            }
        numberGuessShownRef.current = true
        setModal({
          open: true,
          kind: 'saved',
          title: 'เกมจบลงแล้ว',
          message: '',
          extra,
        })
      } else {
        const who = username.trim() || 'คุณ'
        const message = buildExpiredMessage(who, lastFootballGuessText || undefined)
        setModal({
          open: true,
          kind: 'info',
          title: 'เกมจบลงแล้ว',
          message,
          extra: { html: true },
        })
      }
      setRedirectOnOk('heng36')
    }
  }, [
    buildExpiredMessage,
    colors.danger,
    colors.primary,
    expired,
    expiredShown,
    game,
    initialFootballGuess,
    lastFootballGuessLoaded,
    lastFootballGuessText,
    lastNumberGuess,
    lastNumberGuessLoaded,
    needName,
    username,
  ])

  React.useEffect(() => { soldOutGuardRef.current = false; }, [id]);

  // ⛔️ ลบ useEffect ที่เด้ง "โค้ดเต็ม" อัตโนมัติเมื่อเข้าเกมทายภาพปริศนาออก (ย pr รักษาพฤติกรรมเด้งเฉพาะตอน submit)
  // (ไม่มีบล็อกนี้อีกต่อไป)

  React.useEffect(() => {
    const isCode = modal.open && modalKind === 'code';
    if (!isCode) {
      soldOutGuardRef.current = false;
      if (ignoreSoldOutOnce) setIgnoreSoldOutOnce(false);
    }
  }, [modal.open, modalKind])

  React.useEffect(() => {
    soldOutGuardRef.current = false;
    setIgnoreSoldOutOnce(false);
  }, [id])

  const openCode = React.useCallback((code: string) => {
    soldOutGuardRef.current = true       // กัน onInfo ยิงโค้ดเต็มตามมา
    setIgnoreSoldOutOnce(true)           // กัน useEffect ยิงทับในเฟรมเดียวกัน
    setModal({ open:true, kind:'code', title:'🎊 ยินดีด้วย! คำตอบถูกต้อง', message:'คุณตอบถูกแล้ว! นี่คือโค้ดรางวัลของคุณ ✨', code })
  }, [])

  // ✅ ตรวจสอบ USER และ PASSWORD จาก PostgreSQL
  const saveName = async () => {
  const raw = username
  const key = normalizeUser(raw)
  if (!key) return

  setCheckingName(true)
  try {
    // ✅ Validate input
    if (!key || key.trim().length === 0) {
      setModal({ 
        open: true, 
        kind: 'info', 
        title: '⚠️ กรุณากรอก USER', 
        message: 'กรุณากรอก USER ให้ถูกต้อง' 
      })
      return
    }
    // ✅ เกมเช็คอิน: ใช้ USER+PASSWORD จาก USERS_EXTRA (เดิมของคุณ)
    if (game?.type === 'เกมเช็คอิน') {
      if (!password.trim()) {
        setModal({ open: true, kind: 'info', title: '🔐 กรอกรหัสผ่าน', message: 'กรุณากรอกรหัสผ่านให้ครบถ้วนเพื่อเข้าสู่ระบบ' })
        return
      }
      
      // ตรวจสอบสิทธิ์ USER เข้าเล่นเกม
      if (game?.userAccessType === 'selected' && game?.selectedUsers && Array.isArray(game.selectedUsers) && game.selectedUsers.length > 0) {
        const allowedUsers = game.selectedUsers.map((u: string) => normalizeUser(String(u || '')))
        const hasAccess = allowedUsers.includes(key)
        
        if (!hasAccess) {
          setModal({
            open: true,
            kind: 'info',
            title: 'ไม่มีสิทธิ์เข้าเล่น',
            message: `USER : ${key}\nไม่มีสิทธิ์เข้าเล่นเกมนี้\nเฉพาะ USER ที่เลือกไว้เท่านั้นที่สามารถเข้าเล่นได้`
          })
          setUsername('')
          setPassword('')
          localStorage.removeItem('player_name')
          return
        }
      }
      
      // ตรวจสอบเงื่อนไขพิเศษสำหรับเกมเช็คอิน (ถ้ามีรายชื่อผู้ใช้ที่เข้าเงื่อนไข) - ตรวจสอบก่อน
      if (game?.checkin?.users && Array.isArray(game.checkin.users) && game.checkin.users.length > 0) {
        const allowedUsers = game.checkin.users.map((u: string) => normalizeUser(String(u || '')))
        const hasAccess = allowedUsers.includes(key)
        
        if (!hasAccess) {
          setModal({
            open: true,
            kind: 'info',
            title: 'ไม่เข้าเงื่อนไข',
            message: 'USER ลูกค้ายังไม่เข้าเงื่อนไขการรับค่ะ'
          })
          setUsername('')
          setPassword('')
          localStorage.removeItem('player_name')
          return
        }
      }
      
      // ✅ ใช้ PostgreSQL adapter 100%
      const userData = await postgresqlAdapter.getUserData(key)
      
      if (!userData) {
        setModal({
          open: true,
          kind: 'info',
          title: '👤 ไม่พบ USER ในระบบ',
          message: `ไม่พบ USER "${raw}" ในระบบ\nกรุณาตรวจสอบการสะกดและลองใหม่อีกครั้ง`
        })
        setUsername('')
        setPassword('')
        localStorage.removeItem('player_name')
        return
      }
      
      const passInDb = String(userData.password ?? '')
      if (!passInDb || password !== passInDb) {
        setModal({ 
          open: true, 
          kind: 'info', 
          title: '❌ รหัสผ่านไม่ถูกต้อง', 
          message: 'รหัสผ่านที่กรอกไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' 
        })
        setPassword('')
        return
      }


      localStorage.setItem('player_name', key)
      setUsername(key)
      setNeedName(false)
      
      return
    }

    // ✅ เกม BINGO: สำหรับ HOST ข้ามการตรวจสอบ login
    if (game?.type === 'เกม BINGO' && isHost) {
      localStorage.setItem('player_name', key)
      setUsername(key)
      setNeedName(false)
      return
    }

    // ✅ เกมประกาศรางวัล: ตรวจจากรายชื่อที่แนบไว้ในตัวเกม (announce.users)
    if (game?.type === 'เกมประกาศรางวัล') {
      // ตรวจสอบสิทธิ์ USER เข้าเล่นเกม
      if (game?.userAccessType === 'selected' && game?.selectedUsers && Array.isArray(game.selectedUsers) && game.selectedUsers.length > 0) {
        const allowedUsers = game.selectedUsers.map((u: string) => normalizeUser(String(u || '')))
        const hasAccess = allowedUsers.includes(key)
        
        if (!hasAccess) {
          setModal({
            open: true,
            kind: 'info',
            title: 'ไม่มีสิทธิ์เข้าเล่น',
            message: `USER : ${key}\nไม่มีสิทธิ์เข้าเล่นเกมนี้\nเฉพาะ ACTIVE USER ที่เลือกไว้เท่านั้นที่สามารถเข้าเล่นได้`
          })
          setUsername('')
          setPassword('')
          localStorage.removeItem('player_name')
          return
        }
      }
      
        const list: string[] = Array.isArray((game as any)?.announce?.users)
          ? (game as any).announce.users
          : []
        const userBonuses: Array<{ user: string; bonus: number }> = Array.isArray((game as any)?.announce?.userBonuses)
          ? (game as any).announce.userBonuses
          : []
        
        const has = new Set(list.map((u) => normalizeUser(String(u || '')))).has(key)

        if (!has) {
          setModal({
            open: true,
            kind: 'info',
            title: 'ไม่เข้าเงื่อนไข',
            message: `${key} ไม่เข้าเงื่อนไขการรับรางวัลประจำเดือนนะคะ\n\nสู้ๆ ใหม่ค่ะ เดือนหน้ายังมีหวังค่ะ`
          })
          setUsername('')
          setPassword('')
          localStorage.removeItem('player_name')
          return
        }

        // หาข้อมูล BONUS ของผู้เล่นปัจจุบัน
        const myBonusData = userBonuses.find(item => normalizeUser(item.user) === key)
        const myBonus = myBonusData?.bonus || 0

        // ผ่าน → บันทึกชื่อ แล้วแสดงข้อมูลในหน้าเกม
        localStorage.setItem('player_name', key)
        setUsername(key)
        setNeedName(false)
        
        // เก็บข้อมูลโบนัสเพื่อแสดงในหน้า
        setAnnounceBonus({ user: key, bonus: myBonus })
        return
      }


    // ✅ เกมสล็อต, เกมทายภาพปริศนา, เกมทายเบอร์เงิน, เกมทายผลบอล, เกม Trick or Treat, เกมลอยกระทง, เกม BINGO: ตรวจจาก USERS_EXTRA แต่ไม่ต้องมี status ACTIVE
    if (
      game?.type === 'เกมสล็อต' ||
      game?.type === 'เกมทายภาพปริศนา' ||
      game?.type === 'เกมทายเบอร์เงิน' ||
      game?.type === 'เกมทายผลบอล' ||
      game?.type === 'เกม Trick or Treat' ||
      game?.type === 'เกมลอยกระทง' ||
      game?.type === 'เกม BINGO'
    ) {
      // ตรวจสอบสิทธิ์ USER เข้าเล่นเกม
      if (game?.userAccessType === 'selected' && game?.selectedUsers && Array.isArray(game.selectedUsers) && game.selectedUsers.length > 0) {
        const allowedUsers = game.selectedUsers.map((u: string) => normalizeUser(String(u || '')))
        const hasAccess = allowedUsers.includes(key)
        
        if (!hasAccess) {
          setModal({
            open: true,
            kind: 'info',
            title: 'ไม่มีสิทธิ์เข้าเล่น',
            message: `USER : ${key}\nไม่มีสิทธิ์เข้าเล่นเกมนี้\nเฉพาะ ACTIVE USER ที่เลือกไว้เท่านั้นที่สามารถเข้าเล่นได้`
          })
          setUsername('')
          setPassword('')
          localStorage.removeItem('player_name')
          return
        }
      }
      
      if (!password.trim()) {
        setModal({ 
          open: true, 
          kind: 'info', 
          title: '🔐 กรอกรหัสผ่าน', 
          message: 'กรุณากรอกรหัสผ่านให้ครบถ้วนเพื่อเข้าสู่ระบบ' 
        })
        return
      }
      
      // ✅ ใช้ PostgreSQL adapter 100%
      const userData = await postgresqlAdapter.getUserData(key)
      
      if (!userData) {
        setModal({
          open: true,
          kind: 'info',
          title: '👤 ไม่พบ USER ในระบบ',
          message: `ไม่พบ USER "${key}" ในระบบ\nกรุณาตรวจสอบการสะกดและลองใหม่อีกครั้ง`
        })
        setUsername('')
        setPassword('')
        localStorage.removeItem('player_name')
        return
      }
      
      // ✅ ตรวจสอบ status (ถ้ามี) - สำหรับเกมที่ต้องการ status
      // แต่ถ้าไม่มี status field (null/undefined/empty) ก็ให้ผ่าน (รองรับ user ที่ migrate มาแล้ว)
      // ให้ผ่านถ้า: status เป็น null, undefined, '', 'ACTIVE', หรือ 'active'
      // Block ถ้า: status มีค่าแต่ไม่ใช่ 'ACTIVE' หรือ 'active' (เช่น 'inactive', 'pending', etc.)
      const status = userData.status
      if (status != null && status !== '' && status !== 'ACTIVE' && status !== 'active') {
        setModal({
          open: true,
          kind: 'info',
          title: 'ไม่สามารถเข้าร่วมกิจกรรม',
          message: `USER : ${key}\nเนื่องจาก USER ยังไม่สามารถเข้าร่วมกิจกรรมได้\nติดต่อสอบถามการเข้าร่วมที่แอดมินได้เลยค่ะ`,
          extra: { user: key }
        })
        setUsername('')
        setPassword('')
        localStorage.removeItem('player_name')
        return
      }
      
      // ตรวจสอบรหัสผ่าน
      const passInDb = String(userData.password ?? '')
      if (!passInDb || password !== passInDb) {
        setModal({ 
          open: true, 
          kind: 'info', 
          title: '❌ รหัสผ่านไม่ถูกต้อง', 
          message: 'รหัสผ่านที่กรอกไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' 
        })
        setPassword('')
        return
      }

      localStorage.setItem('player_name', key)
      setUsername(key)
      setNeedName(false)
      return
    }

    // ✅ Fallback: สำหรับเกมประเภทอื่นๆ ที่ยังไม่ได้ handle
    // ตรวจสอบสิทธิ์ USER เข้าเล่นเกม
    if (game?.userAccessType === 'selected' && game?.selectedUsers && Array.isArray(game.selectedUsers) && game.selectedUsers.length > 0) {
      const allowedUsers = game.selectedUsers.map((u: string) => normalizeUser(String(u || '')))
      const hasAccess = allowedUsers.includes(key)
      
      if (!hasAccess) {
        setModal({
          open: true,
          kind: 'info',
          title: 'ไม่มีสิทธิ์เข้าเล่น',
          message: `USER : ${key}\nไม่มีสิทธิ์เข้าเล่นเกมนี้\nเฉพาะ USER ที่เลือกไว้เท่านั้นที่สามารถเข้าเล่นได้`
        })
        setUsername('')
        localStorage.removeItem('player_name')
        return
      }
    }
    
    // ✅ ใช้ PostgreSQL adapter 100%
    const userData = await postgresqlAdapter.getUserData(key)
    
    if (!userData) {
      setModal({ 
        open: true, 
        kind: 'info', 
        title: '👤 ไม่พบ USER ในระบบ', 
        message: `ไม่พบ USER "${raw}" ในระบบ\nกรุณาตรวจสอบการสะกดและลองใหม่อีกครั้ง` 
      })
      setUsername('')
      setPassword('')
      localStorage.removeItem('player_name')
      return
    }

    // ✅ ตรวจสอบรหัสผ่าน (สำหรับเกมที่ต้องการ password)
    if (game?.type !== 'เกมประกาศรางวัล') {
      if (!password.trim()) {
        setModal({ 
          open: true, 
          kind: 'info', 
          title: '🔐 กรอกรหัสผ่าน', 
          message: 'กรุณากรอกรหัสผ่านให้ครบถ้วนเพื่อเข้าสู่ระบบ' 
        })
        return
      }
      
      const passInDb = String(userData.password ?? '')
      if (!passInDb || password !== passInDb) {
        setModal({ 
          open: true, 
          kind: 'info', 
          title: '❌ รหัสผ่านไม่ถูกต้อง', 
          message: 'รหัสผ่านที่กรอกไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' 
        })
        setPassword('')
        return
      }
    }

    // ✅ เช็คซ้ำว่าเคยตอบแล้วไหม - ใช้ PostgreSQL
    const shouldCheckDuplicate = !!game && !['เกมสล็อต', 'เกมทายผลบอล', 'เกมทายเบอร์เงิน'].includes(game.type)
    if (shouldCheckDuplicate) {
      const answersIndexCacheKey = `answersIndex:${game!.id}:${key}`
      let dupData = dataCache.get<any>(answersIndexCacheKey)
      
      if (!dupData) {
        try {
          const answers = await postgresqlAdapter.getAnswers(game!.id, 100)
          const playerAnswers = answers.filter((a: any) => a.userId === key)
          if (playerAnswers.length > 0) {
            const latestAnswer = playerAnswers.sort((a: any, b: any) => 
              (b.ts || 0) - (a.ts || 0)
            )[0]
            dupData = {
              answer: latestAnswer.answer,
              ts: latestAnswer.ts
            }
            // Cache ไว้ 2 นาที
            dataCache.set(answersIndexCacheKey, dupData, 2 * 60 * 1000)
          }
        } catch (error) {
          console.error('Error checking duplicate answer:', error)
        }
      }
      
      if (dupData) {
        setNeedName(false)
        setRedirectOnOk('heng36')
        setModal({ 
          open: true, 
          kind: 'info', 
          title: '⚠️ แจ้งเตือน', 
          message: 'ยูสเซอร์นี้ได้ทำการตอบคำถามของวันนี้ไปแล้วค่ะ\n\nรอติดตามกิจกรรมในวันถัดไปนะคะ! 🎮' 
        })
        setUsername('')
        setPassword('')
        localStorage.removeItem('player_name')
        return
      }
    }

    // ✅ Login สำเร็จ
    localStorage.setItem('player_name', key)
    setUsername(key)
    setPassword('') // ✅ Clear password after successful login
    setNeedName(false)
  } catch (error) {
    console.error('Error in saveName:', error)
    setModal({
      open: true,
      kind: 'info',
      title: '⚠️ เกิดข้อผิดพลาด',
      message: error instanceof Error 
        ? `เกิดข้อผิดพลาด: ${error.message}\nกรุณาลองใหม่อีกครั้ง`
        : 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล\nกรุณาลองใหม่อีกครั้ง'
    })
  } finally {
    setCheckingName(false)
  }
}




  /** helper ตอนลูกแจ้งว่าเวลาหมด */
  const handleExpire = React.useCallback(() => {
    if (runtimeExpired) return
    setRuntimeExpired(true)
    setNeedName(false)
    setModal({
      open: true,
      kind: 'info',
      title: 'หมดเวลาเล่น',
      message: 'เกินกำหนดเวลาที่ตั้งไว้แล้ว',
    })
    setRedirectOnOk('heng36')   // ⬅️ ให้ปุ่ม "ตกลง" ใช้ goHeng36
  }, [runtimeExpired])

  // ======= ฟังก์ชันส่งคำตอบ =======

  /** เกมทายเบอร์เงิน (NumberGame) */
 const submitNumberAnswer = async (ansText: string) => {
  if (!game) return;
  if (needName || !username.trim()) { openInfo('ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นเพื่อเริ่มเล่นเกม'); setNeedName(true); return; }
  if (isLocked(game)) { openInfo('ยังไม่เปิดให้เล่น', 'เกมนี้ยังถูกล็อกอยู่ โปรดติดต่อแอดมิน'); return; }
  if (runtimeExpired || (game.numberPick?.endAt && Date.now() > game.numberPick.endAt)) { 
    setModal({ open: true, kind: 'info', title: 'หมดเวลาเล่น', message: 'เกินกำหนดเวลาที่ตั้งไว้แล้ว' })
    setRedirectOnOk('heng36')
    return; 
  }

  const player = normalizeUser(username);
  const v = ansText.trim();
  if (!v) { openInfo('กรอกคำตอบก่อน', 'โปรดพิมพ์คำตอบของคุณ'); return; }

  // เช็คคำตอบเดิมของยูสนี้ก่อน
  const prev = await getPrevAnswer(id, player);
  const newHuman = `เบอร์เงินที่ทาย: ${v}`;

  if (prev && prev !== newHuman) {
    // เปิด confirm modal ให้ยืนยันว่าจะทับค่าหรือไม่
    setModal({
      open: true,
      kind: 'confirm-replace',
      title: 'ยืนยันเปลี่ยนคำตอบ',
      message: 'ยูสเซอร์นี้มีคำตอบเดิมอยู่แล้ว ต้องการแทนที่หรือไม่?',
      oldLabel: 'คำตอบเดิม',
      oldValue: String(prev),
      newLabel: 'คำตอบใหม่',
      newValue: newHuman,
      onConfirm: async () => {
        setSubmitting(true);
        try {
          const ts = Date.now();
          
          // ✅ ดึงคำตอบเดิมของยูสนี้จาก PostgreSQL
          let oldAnswer = null;
          try {
            const answersIndexCacheKey = `answersIndex:${id}:${player}`
            let oldAnswerData = dataCache.get<any>(answersIndexCacheKey)
            
            if (!oldAnswerData) {
              const answers = await postgresqlAdapter.getAnswers(id, 100)
              const playerAnswers = answers.filter((a: any) => a.userId === player)
              if (playerAnswers.length > 0) {
                const latestAnswer = playerAnswers.sort((a: any, b: any) => 
                  (b.ts || 0) - (a.ts || 0)
                )[0]
                oldAnswerData = {
                  answer: latestAnswer.answer,
                  ts: latestAnswer.ts
                }
                // Cache ไว้ 2 นาที
                dataCache.set(answersIndexCacheKey, oldAnswerData, 2 * 60 * 1000)
              }
            }
            
            if (oldAnswerData) {
              oldAnswer = oldAnswerData?.answer || null
            }
          } catch (error) {
            console.error('Error fetching previous answer:', error)
          }
          
          // ✅ บันทึกคำตอบใหม่ผ่าน PostgreSQL
          await postgresqlAdapter.submitAnswer(id, player, newHuman, false, undefined)
          const primaryBg = `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.05)} 0%, ${hexToRgba(colors.primary, 0.18)} 100%)`;
          const primaryShadow = `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`;
          const numberValue = parseNumberGuess(newHuman) || v;
          const oldAnswerDisplay = oldAnswer ? prettifyNumberLabel(oldAnswer) : oldAnswer;
          setLastNumberGuess(newHuman);
          setLastNumberGuessLoaded(true);
          numberGuessShownRef.current = true;
          setModal({
            open: true,
            kind: 'saved',
            title: 'คุณได้เลือกคำตอบใหม่แล้ว',
      message: `ยูสเซอร์: ${username}\n\n⚠️ กรุณาแคปหน้านี้ไว้เป็นหลักฐาน`,
            extra: { 
              user: username, 
              answer: newHuman,
              oldAnswer: oldAnswerDisplay, // เพิ่มเบอร์เงินเดิม
              newAnswer: newHuman,   // เพิ่มเบอร์เงินใหม่
              number: {
                value: numberValue,
                label: prettifyNumberLabel(newHuman) || newHuman,
                primaryBg,
                primaryShadow,
              },
              actions: {
                showRetake: true,
                onRetake: () => setModal({ open: false }),
              },
            },
          });
        } finally {
          setSubmitting(false);
        }
      },
    });
    return;
  }

  // ✅ ไม่มีคำตอบเดิม หรือเหมือนเดิม → บันทึกผ่าน PostgreSQL
  setSubmitting(true);
  try {
    await postgresqlAdapter.submitAnswer(id, player, newHuman, false, undefined)
    const primaryBg = `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.05)} 0%, ${hexToRgba(colors.primary, 0.18)} 100%)`;
    const primaryShadow = `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`;
    const numberValue = parseNumberGuess(newHuman) || v;
    setLastNumberGuess(newHuman);
    setLastNumberGuessLoaded(true);
    numberGuessShownRef.current = true;
    setModal({
      open: true,
      kind: 'saved',
      title: 'คุณได้เลือกคำตอบใหม่แล้ว',
      message: `ยูสเซอร์: ${username}\nคำตอบที่เลือก: ${newHuman}\n\n⚠️ กรุณาแคปหน้านี้ไว้เป็นหลักฐาน`,
      extra: { 
        user: username, 
        answer: newHuman,
        number: {
          value: numberValue,
          label: prettifyNumberLabel(newHuman) || newHuman,
          primaryBg,
          primaryShadow,
        },
        actions: {
          showRetake: true,
          onRetake: () => setModal({ open: false }),
        },
      },
    });
  } finally {
    setSubmitting(false);
  }
};


  /** เกมทายผลบอล (FootballGame) — รับคะแนนจากลูกแล้วบันทึกที่นี่ */
const submitFootballFromChild = async (home: number, away: number) => {
  if (!game) return;
  if (needName || !username.trim()) { openInfo('ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นเพื่อเริ่มเล่นเกม'); setNeedName(true); return; }
  if (isLocked(game)) { openInfo('ยังไม่เปิดให้เล่น', 'เกมนี้ยังถูกล็อกอยู่ โปรดติดต่อแอดมิน'); return; }
  if (runtimeExpired || (game.football?.endAt && Date.now() > game.football.endAt)) { 
    setModal({ open: true, kind: 'info', title: 'หมดเวลาเล่น', message: 'เกินกำหนดเวลาที่ตั้งไว้แล้ว' })
    setRedirectOnOk('heng36')
    return; 
  }

  const h = Math.floor(home), a = Math.floor(away);
  if (h < 0 || h > 99 || a < 0 || a > 99 || Number.isNaN(h) || Number.isNaN(a)) {
    openInfo('กรอกสกอร์ไม่ถูกต้อง', 'โปรดกรอกสกอร์ของทั้งสองทีมเป็นตัวเลข 0–99');
    return;
  }

  const player = normalizeUser(username);
  const hName = game.football?.homeTeam || 'ทีมเหย้า';
  const aName = game.football?.awayTeam || 'ทีมเยือน';
  const human = `${hName} ${h} - ${a} ${aName}`;
  const primaryBgGradient = `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.05)} 0%, ${hexToRgba(colors.primary, 0.2)} 100%)`;
  const primaryShadow = `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`;
  const dangerBgGradient = `linear-gradient(135deg, ${hexToRgba(colors.danger, 0.05)} 0%, ${hexToRgba(colors.danger, 0.2)} 100%)`;
  const dangerShadow = `0 8px 22px ${hexToRgba(colors.danger, 0.25)}`;

  // เช็คคำตอบเดิมของยูสนี้ก่อน
  const prev = await getPrevAnswer(id, player);
  if (prev && prev !== human) {
    setModal({
      open: true,
      kind: 'confirm-replace',
      title: 'ยืนยันเปลี่ยนสกอร์',
      message: 'ยูสเซอร์นี้มีสกอร์เดิมอยู่แล้ว ต้องการแทนที่หรือไม่?',
      oldLabel: 'สกอร์เดิม',
      oldValue: String(prev),
      newLabel: 'สกอร์ใหม่',
      newValue: human,
      onConfirm: async () => {
        setSubmitting(true);
        try {
          // ✅ บันทึกคำตอบใหม่ผ่าน PostgreSQL
          await postgresqlAdapter.submitAnswer(id, player, human, false, undefined)
          setInitialFootballGuess({ home: h, away: a });
          footballGuessShownRef.current = true;
          
          setModal({
            open: true,
            kind: 'saved',
            title: 'คุณอัปเดตสกอร์เรียบร้อย',
            message: '',
            extra: { 
              user: username, 
              football: { homeName: hName, awayName: aName, home: h, away: a, primaryBg: primaryBgGradient, primaryShadow, dangerBg: dangerBgGradient, dangerShadow },
              oldAnswer: prev,  // เพิ่มคำตอบเก่า
              newAnswer: human  // เพิ่มคำตอบใหม่
            },
          });
        } finally {
          setSubmitting(false);
        }
      },
    });
    return;
  }

  // ✅ ไม่มีคำตอบเดิม หรือเหมือนเดิม → บันทึกผ่าน PostgreSQL
  setSubmitting(true);
  try {
    await postgresqlAdapter.submitAnswer(id, player, human, false, undefined)
    setInitialFootballGuess({ home: h, away: a });
    footballGuessShownRef.current = true;
    setModal({
      open: true,
      kind: 'saved',
      title: 'คุณส่งสกอร์เรียบร้อย',
      message: '',
      extra: {
        user: username,
        football: { homeName: hName, awayName: aName, home: h, away: a, primaryBg: primaryBgGradient, primaryShadow, dangerBg: dangerBgGradient, dangerShadow },
        actions: {
          showRetake: true,
          onRetake: () => setModal({ open: false }),
        },
      },
    });
  } finally {
    setSubmitting(false);
  }
};

  // ---------- UI ----------
  if (!id)      return <div className="checkin-wrap checkin-wrap--modern"><div className="checkin-loading">ไม่พบบัตรเกม</div></div>
  if (loading)  return <div className="checkin-wrap checkin-wrap--modern"><div className="checkin-loading">กำลังโหลดเกม…</div></div>
  if (!game)    return <div className="checkin-wrap checkin-wrap--modern"><div className="checkin-loading">ไม่พบเกมนี้</div></div>

  const img = getImageUrl(
    game.puzzle?.imageDataUrl ||
    game.numberPick?.imageDataUrl ||
    game.football?.imageDataUrl ||
    ''
  )

  const renderGlobalModal = () => {
    if (!modal.open) return null;
    const { accentColor, headline, body, bodyStrong, caption, highlightBox } = modalTextStyles;
    return (
      <Overlay key="modal-popup" onClose={undefined /* บล็อกคลิกนอก popup */}>
        <div className={`modal modal-centered modal--auth ${
          modalKind === 'code' ? 'modal--code' :
          modalKind === 'info' ? 'modal--info' :
          modalKind === 'codes-empty' ? 'modal--warning' :
          'modal--info'
        }`} onClick={(e)=>e.stopPropagation()} style={{ padding: 0, overflow: 'hidden', borderRadius: 20 }}>
          {renderModalHeader(modalTitle, modalHeaderTone)}

          {modal.kind === 'code' ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, background: modalBodyBackground }}>
              <div
                className="code-section"
                style={{
                  display: 'grid',
                  gap: 18,
                  textAlign: 'center',
                  color: body.color,
                  padding: '4px 0',
                }}
              >
                <div
                  className="success-badge"
                  role="status"
                  aria-live="polite"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    padding: '12px 22px',
                    borderRadius: 999,
                  fontSize: clampSize(14, 2.8, 18),
                    fontWeight: 800,
                  letterSpacing: clampSize(0.2, 0.6, 0.5),
                    color: accentColor,
                    background: hexToRgba(accentColor, 0.12),
                    boxShadow: `0 8px 22px ${hexToRgba(accentColor, 0.22)}`,
                    textTransform: 'uppercase' as const,
                  }}
                >
                  <span className="spark">✨</span>
                  <span>นี่โค้ดของคุณค่ะ</span>
                  <span className="spark">✨</span>
                </div>
                <div
                  className="code-box"
                  aria-label="โค้ดของคุณ"
                  style={{
                    fontSize: clampSize(20, 5, 28),
                    fontWeight: 900,
                    letterSpacing: clampSize(1.5, 1, 2.8),
                    color: accentColor,
                    background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.08)} 0%, ${hexToRgba(accentColor, 0.22)} 100%)`,
                    borderRadius: 18,
                    padding: '18px 24px',
                    boxShadow: `0 12px 28px ${hexToRgba(accentColor, 0.28)}`,
                    // ✅ ลบ textTransform: 'uppercase' เพื่อแสดงโค้ดตามข้อมูลจริง
                  }}
                >
                  {modal.code}
                </div>
                <div
                  style={{
                    ...caption,
                    color: accentColor,
                    fontWeight: 600,
                    marginTop: 2,
                    opacity: 1,
                  }}
                >
                  คัดลอกโค้ดแล้วนำไปกรอกที่เว็บไซต์เพื่อรับรางวัลนะคะ ✨
                </div>
              </div>

              <div
                className="modal-actions"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                  background: modalActionBackground,
                }}
              >
                <button
                  className="btn-copy"
                  style={{ width: '100%', height: 44, fontWeight: 800 }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(modal.code || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    } catch {}
                  }}
                >
                  <span className="ico">{copied ? '✔︎' : '📋'}</span>
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}
                </button>

                <button
                  className="btn-cta btn-cta-green"
                  style={{ 
                    width: '100%', 
                    height: 44, 
                    fontWeight: 800, 
                    textAlign: 'center', 
                    display: 'inline-flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    zIndex: 9999,
                    position: 'relative'
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    goHeng36()
                  }}
                >
                  <span className="ico">↗︎</span>
                  ไปกรอกโค้ด {themeName === 'max56' ? 'MAX56' : 'HENG36'}
                </button>
              </div>
            </div>
          ) : modal.kind === 'saved' ? (
            <>
              <div className="saved-wrap saved--center" style={{ textAlign: 'center', padding: '24px', background: modalBodyBackground }}>
                {/* removed title */}
                {modal.extra?.football ? (() => {
                  const foot = modal.extra.football;
                  const homeBg = foot.primaryBg ?? `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.06)} 0%, ${hexToRgba(colors.primary, 0.2)} 100%)`;
                  const homeShadow = foot.primaryShadow ?? `0 8px 22px ${hexToRgba(colors.primary, 0.25)}`;
                  const awayBg = foot.dangerBg ?? `linear-gradient(135deg, ${hexToRgba(colors.danger, 0.06)} 0%, ${hexToRgba(colors.danger, 0.2)} 100%)`;
                  const awayShadow = foot.dangerShadow ?? `0 8px 22px ${hexToRgba(colors.danger, 0.25)}`;
                  return (
                    <div style={{ marginTop: 4 }}>
                      <div
                        style={{
                          padding: '18px',
                          borderRadius: 18,
                          background: `linear-gradient(135deg, ${hexToRgba(colors.primaryLight ?? colors.primary, 0.05)} 0%, ${hexToRgba(colors.primaryLight ?? colors.primary, 0.12)} 100%)`,
                          border: `1px solid ${hexToRgba(colors.primary ?? '#0ea5e9', 0.25)}`,
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
                          display: 'grid',
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            fontWeight: 700,
                            color: colors.textPrimary ?? '#1f2937',
                            fontSize: clampSize(13, 2.2, 16),
                          }}
                        >
                          <span aria-hidden style={{ color: colors.primary ?? '#3b82f6' }}>👤</span>
                          <span>ยูสเซอร์:</span>
                          <span style={{ color: colors.primary ?? '#3b82f6', fontWeight: 800 }}>{modal.extra.user || username}</span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 24,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              padding: '6px 12px',
                              borderRadius: 999,
                              background: hexToRgba(colors.success ?? colors.primary, 0.25),
                            color: colors.primaryDark ?? colors.success ?? '#166534',
                              fontWeight: 800,
                              letterSpacing: 0.3,
                            }}>
                              {foot.homeName}
                            </div>
                            <div style={{
                              width: 56,
                              height: 56,
                              borderRadius: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: clampSize(22, 5.8, 30),
                              fontWeight: 900,
                              color: colors.primary ?? '#2563eb',
                              background: homeBg,
                              boxShadow: homeShadow,
                            }}>
                              {foot.home}
                            </div>
                          </div>

                          <div style={{ fontSize: clampSize(22, 5, 28), fontWeight: 900, color: hexToRgba(colors.textSecondary ?? '#64748b', 0.7) }}>-</div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              padding: '6px 12px',
                              borderRadius: 999,
                              background: hexToRgba(colors.danger ?? '#ef4444', 0.15),
                            color: colors.danger ?? '#b91c1c',
                              fontWeight: 800,
                              letterSpacing: 0.3,
                            }}>
                              {foot.awayName}
                            </div>
                            <div style={{
                              width: 56,
                              height: 56,
                              borderRadius: 16,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: clampSize(22, 5.8, 30),
                              fontWeight: 900,
                              color: colors.danger ?? '#db2777',
                              background: awayBg,
                              boxShadow: awayShadow,
                            }}>
                              {foot.away}
                            </div>
                          </div>
                        </div>
                      </div>

                      {modal.extra?.oldAnswer && modal.extra?.newAnswer ? (
                        <div style={{ marginTop: 16 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                          }}>
                            <div style={{
                              padding: '10px 16px',
                              borderRadius: 14,
                              border: `1px solid ${hexToRgba(colors.danger ?? '#ef4444', 0.25)}`,
                              background: `linear-gradient(135deg, ${hexToRgba(colors.danger ?? '#ef4444', 0.12)} 0%, ${hexToRgba(colors.danger ?? '#ef4444', 0.05)} 100%)`,
                              minWidth: 140,
                              textAlign: 'center',
                              boxShadow: `0 6px 16px ${hexToRgba(colors.danger ?? '#ef4444', 0.18)}`,
                            }}>
                              <div style={{ color: colors.danger ?? '#dc2626', fontSize: clampSize(11, 1.6, 13), fontWeight: 700, marginBottom: 4 }}>สกอร์เดิม</div>
                              <div style={{ color: colors.danger ?? '#991b1b', fontSize: clampSize(13, 2.0, 16), fontWeight: 800 }}>{modal.extra.oldAnswer}</div>
                            </div>
                            <div style={{ color: hexToRgba(colors.textSecondary ?? '#64748b', 0.7), fontSize: clampSize(18, 3.8, 24), fontWeight: 800 }}>→</div>
                            <div style={{
                              padding: '10px 16px',
                              borderRadius: 14,
                              border: `1px solid ${hexToRgba(colors.success ?? '#22c55e', 0.25)}`,
                              background: `linear-gradient(135deg, ${hexToRgba(colors.success ?? '#22c55e', 0.12)} 0%, ${hexToRgba(colors.success ?? '#22c55e', 0.05)} 100%)`,
                              minWidth: 140,
                              textAlign: 'center',
                              boxShadow: `0 6px 16px ${hexToRgba(colors.success ?? '#22c55e', 0.18)}`,
                            }}>
                              <div style={{ color: colors.success ?? '#15803d', fontSize: clampSize(11, 1.6, 13), fontWeight: 700, marginBottom: 4 }}>สกอร์ใหม่</div>
                              <div style={{ color: colors.success ?? '#16a34a', fontSize: clampSize(13, 2.0, 16), fontWeight: 800 }}>{modal.extra.newAnswer}</div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })() : modal.extra?.number ? (() => {
                  const num = modal.extra.number;
                  const cardBg = num.primaryBg ?? `linear-gradient(135deg, ${hexToRgba(colors.primary, 0.06)} 0%, ${hexToRgba(colors.primary, 0.18)} 100%)`;
                  const cardShadow = num.primaryShadow ?? `0 10px 30px ${hexToRgba(colors.primary, 0.2)}`;
                  return (
                    <div style={{ marginTop: 4 }}>
                      <div
                        style={{
                          padding: 18,
                          borderRadius: 18,
                          background: `linear-gradient(135deg, ${hexToRgba(colors.primaryLight ?? colors.primary, 0.05)} 0%, ${hexToRgba(colors.primaryLight ?? colors.primary, 0.12)} 100%)`,
                          border: `1px solid ${hexToRgba(colors.primary ?? '#0ea5e9', 0.25)}`,
                          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
                          display: 'grid',
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            fontWeight: 700,
                            color: colors.textPrimary ?? '#1f2937',
                            fontSize: clampSize(13, 2.2, 16),
                          }}
                        >
                          <span aria-hidden style={{ color: colors.primary ?? '#3b82f6' }}>👤</span>
                          <span>ยูสเซอร์:</span>
                          <span style={{ color: colors.primary ?? '#3b82f6', fontWeight: 800 }}>{modal.extra.user || username}</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 16,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div style={{
                            padding: '12px 16px',
                            borderRadius: 14,
                            background: cardBg,
                            boxShadow: cardShadow,
                            minWidth: 160,
                            textAlign: 'center',
                          }}>
                            <div style={{ fontSize: clampSize(12, 1.8, 14), fontWeight: 700, color: colors.textSecondary ?? '#475569' }}>เบอร์เงินที่ทาย</div>
                            <div style={{ fontSize: clampSize(26, 6.5, 40), fontWeight: 900, marginTop: 8, letterSpacing: clampSize(2, 0.8, 4) }}>{num.value}</div>
                          </div>
                          {num.label ? (
                            <div style={{
                              padding: '10px 16px',
                              borderRadius: 14,
                              background: hexToRgba(colors.bgPrimary ?? '#0f172a', 0.05),
                              color: colors.textPrimary ?? '#1f2937',
                              fontWeight: 700,
                              minWidth: 160,
                              textAlign: 'center',
                            }}>
                              {num.label}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })() : modal.extra?.actions?.html ? (
                  <div
                    style={{
                      ...body,
                      padding: '0 20px',
                      textAlign: 'left',
                      color: body.color,
                    }}
                    dangerouslySetInnerHTML={{ __html: modal.message ?? '' }}
                  />
                ) : modal.message ? (
                  <p style={{ ...bodyStrong, textAlign: 'center', whiteSpace: 'pre-line', margin: '0 auto' }}>
                    {modal.message}
                  </p>
                ) : null}
              </div>

              {'extra' in modal && modal.extra?.actions?.showRetake ? (
                <div
                  className="modal-actions"
                  style={{
                    display: 'flex',
                    flexDirection: isNarrowScreen ? 'column' : 'row',
                    gap: 12,
                    width: '100%',
                    padding: '0 24px 24px',
                    background: modalActionBackground,
                  }}
                >
                  <button
                    className="btn-cta"
                    style={{ width: isNarrowScreen ? '100%' : undefined, height: 44, fontWeight: 800, borderRadius: 50 }}
                    onClick={() => {
                      setModal({ open: false });
                      modal.extra?.actions?.onRetake?.();
                    }}
                  >
                    ทายสกอร์ใหม่
                  </button>
                  <button className="btn-cta btn-cta-green btn-wide primary" onClick={goHeng36}>
                    {goButtonLabel}
                  </button>
                </div>
              ) : (
                <div className="modal-actions" style={{ padding: '0 24px 24px', background: modalActionBackground }}>
                  <button className="btn-cta btn-cta-green btn-wide primary" onClick={goHeng36}>
                    {goButtonLabel}
                  </button>
                </div>
              )}
            </>
          ) : modal.kind === 'confirm-replace' ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, background: modalBodyBackground }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...headline, fontSize: clampSize(16, 2.3, 20) }}>
                  {modal.message || 'ต้องการแทนที่คำตอบเดิมหรือไม่?'}
                </div>
                <p style={{ ...body, margin: 0 }}>
                  ระบบจะบันทึกเฉพาะคำตอบล่าสุดไว้ในฐานข้อมูล และใช้ประกาศผลเพียงคำตอบล่าสุดเท่านั้นนะคะ
                </p>
              </div>
              <div style={{ display: 'grid', gap: 12, background: hexToRgba(colors.bgPrimary ?? '#0f172a', 0.05), borderRadius: 16, padding: '16px 18px' }}>
                <div>
                  <div style={{ ...caption, marginBottom: 4 }}>{modal.oldLabel}</div>
                  <div style={{ ...bodyStrong }}>{modal.oldValue}</div>
                </div>
                <div>
                  <div style={{ ...caption, marginBottom: 4 }}>{modal.newLabel}</div>
                  <div style={{ ...bodyStrong }}>{modal.newValue}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isNarrowScreen ? '1fr' : '1fr 1fr' }}>
                <button
                  className="btn-cta btn-cta-light"
                  style={{ height: 44, fontWeight: 800, borderRadius: 50 }}
                  onClick={() => setModal({ open: false })}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn-cta btn-cta-green btn-wide primary"
                  onClick={() => {
                    setModal({ open: false });
                    modal.onConfirm?.();
                  }}
                >
                  ยืนยันเปลี่ยนคำตอบ
                </button>
              </div>
            </div>
          ) : modal.kind === 'codes-empty' ? (
            <div className="modal-body" style={{ padding: '24px', background: modalBodyBackground }}>
              <div className="saved-wrap saved--center" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: clampSize(28, 6, 42) }}>🎉</div>
                <div style={{ ...headline }}>โค้ดเต็มแล้วค่ะ</div>
                <div style={{ ...highlightBox, textAlign: 'center' }}>
                  ขออภัยด้วยนะคะ โค้ดรางวัลหมดแล้ว
                </div>
                <div style={{ ...caption }}>
                  แอดมินจะรีเซ็ตโค้ดรางวัลในรอบถัดไปนะคะ
                </div>
              </div>
              <div className="modal-actions" style={{ paddingTop: 20 }}>
                <button className="btn-cta btn-cta-green btn-wide primary" onClick={goHeng36}>
                  {goButtonLabel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div 
                className="modal-message" 
                style={{ ...body, whiteSpace:'pre-wrap', padding: '0 24px', textAlign: 'center', background: modalBodyBackground }}
                dangerouslySetInnerHTML={{ 
                  __html: (modal.kind === 'info' && 'extra' in modal && modal.extra?.html)
                    ? modal.message || ''
                    : ('message' in modal ? modal.message || '' : '').replace(/\n/g, '<br/>') 
                }}
              />
              {modal.kind !== 'info' && (
                <div className="modal-actions" style={{ padding: '0 24px 24px', background: modalActionBackground }}>
                  <button
                    className="btn-cta btn-cta-green btn-wide primary"
                    onClick={() => {
                      setModal({ open: false });
                      if (redirectOnOk) {
                        const dest = redirectOnOk;
                        setRedirectOnOk(null);
                        if (dest === 'heng36') goHeng36();
                      }
                    }}
                  >
                    {goButtonLabel}
                  </button>
                </div>
              )}
            </>
          )}

          {modal.kind === 'info' && (
            <div className="modal-actions" style={{ padding: '0 24px 24px', background: modalActionBackground }}>
              <button
                className="btn-cta btn-cta-green btn-wide primary"
                onClick={() => {
                  setModal({ open: false });
                  if (redirectOnOk) {
                    const dest = redirectOnOk;
                    setRedirectOnOk(null);
                    if (dest === 'heng36') goHeng36();
                  }
                }}
              >
                {goButtonLabel}
              </button>
            </div>
          )}
        </div>
      </Overlay>
    );
  };

  const modalPortal = renderGlobalModal();

  // สำหรับเกมเช็คอิน ให้แสดงโดยไม่ใช้ play-card
  if (game.type === 'เกมเช็คอิน') {
    return (
      <div className="checkin-wrap checkin-wrap--modern">
        <SnowEffect />
        {!needName ? (
          <CheckinGame
            gameId={id}
            game={game}
            username={username}
            onInfo={(t,m)=>setModal({ open:true, kind:'info', title:t, message:m })}
            onCode={(code)=>setModal({ open:true, kind:'code', title:'ยินดีด้วย! คำตอบถูกต้อง', message:'นี่โค้ดของคุณค่ะ', code })}
          />
        ) : (
          <div className="checkin-loading">กำลังโหลดเกมเช็คอิน...</div>
        )}
        
        {/* ✅ Popup : ตั้งชื่อผู้เล่น สำหรับเกมเช็คอิน - ไม่แสดงเมื่อ modal code เปิดอยู่ */}
        {needName && !(modal.open && modal.kind === 'code') && (
          <Overlay key="checkin-login" onClose={undefined /* ไม่ปิดด้วยคลิกนอก */}>
            <div className="checkin-login-modal" onClick={(e)=>e.stopPropagation()}>
              {/* Logo */}
              <div className="modal-logo">
                <img src={assets.logoContainer} alt="Logo" />
              </div>
              
              {/* หัวข้อ */}
              <h2 className="modal-title">เข้าสู่ระบบเกมเช็คอิน</h2>
              <p className="muted" style={{marginTop:4}}>กรอก USER และ PASSWORD เพื่อเล่นเกมเช็คอิน</p>

              {/* USER */}
              <input
                className="f-control"
                type="text"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder="USER ของคุณ"
                value={username}
                onChange={(e)=>setUsername(e.target.value.toUpperCase())}
                onKeyDown={(e)=>{
                  if (e.key==='Enter') {
                    const pw = document.getElementById('game-pw') as HTMLInputElement | null
                    pw?.focus()
                  }
                }}
                autoFocus
              />

              {/* PASSWORD */}
              <div className="f-pass">
                <input
                  id="game-pw"
                  className="f-control f-lg f-pw"
                  type={showPw ? 'text' : 'password'}
                  placeholder="รหัสผ่าน (เลขบัญชี 4 ตัวท้าย)"
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  onKeyDown={(e)=>{
                    if (e.key==='Enter') {
                      saveName()
                    }
                  }}
                />
                <button
                  type="button"
                  className="f-toggle"
                  onClick={()=>setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>

              {/* ปุ่มยืนยัน */}
              <button
                className="f-btn primary"
                onClick={saveName}
                disabled={checkingName || !username.trim() || !password.trim()}
              >
                {checkingName ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
              </button>
            </div>
          </Overlay>
        )}

        {modalPortal}
      </div>
    )
  }

  return (
    <section className="play-wrap bg-game">
      <SnowEffect />
      <div className="play-card">
        <img src={assets.logoContainer} alt={branding.title} className="play-logo" />

        <div className="play-head">
          {(() => {
            const m = getTypeMeta(game.type)
            return (
              <div className={`type-badge ${m.cls}`} title={m.label}>
                <span className="ico">{m.icon}</span>
                <span className="label">{m.label}</span>
              </div>
            )
          })()}
        </div>

        {/* ===== เลือกแสดงแต่ละประเภท ===== */}
        {game.type === 'เกมสล็อต' && !needName && (
          <SlotGame
            key={`slot:${id}:${userKey}`}
            gameId={id}
            gameData={game}
            username={userKey}
          />
        )}

        {game.type === 'เกมทายภาพปริศนา' && !needName && (
          <PuzzleGame
            gameId={id}
            game={game as any} 
            username={username}
            onInfo={openInfo}
            onCode={openCode}
          />
        )}

        {game.type === 'เกมทายเบอร์เงิน' && !needName && (
          <NumberGame
            image={img}
            endAtMs={game.numberPick?.endAt ?? null}
            onExpire={handleExpire}
            disabled={runtimeExpired || locked || submitting}
            submitting={submitting}
            onSubmit={submitNumberAnswer}
          />
        )}

        {game.type === 'เกมทายผลบอล' && !needName && (
          <FootballGame
            image={getImageUrl(game.football?.imageDataUrl || '')}
            endAtMs={game.football?.endAt ?? null}
            onExpire={handleExpire}
            homeName={game.football?.homeTeam || 'ทีมเหย้า'}
            awayName={game.football?.awayTeam || 'ทีมเยือน'}
            disabled={expired || runtimeExpired || locked}
            submitting={submitting}
            onSubmit={submitFootballFromChild}
            initialGuess={initialFootballGuess}
            onShowGuess={handleFootballGuessShown}
          />
        )}

        {game.type === 'เกม Trick or Treat' && !needName && (
          <TrickOrTreatGame
            gameId={id}
            game={game as any} 
            username={username}
            onInfo={openInfo}
            onCode={openCode}
          />
        )}

        {game.type === 'เกมลอยกระทง' && !needName && (
          <LoyKrathongGame
            gameId={id}
            game={game as any}
            username={username}
            onInfo={openInfo}
            onCode={openCode}
          />
        )}

        {game.type === 'เกมประกาศรางวัล' && !needName && (
          <AnnounceGame
            gameId={id}
            game={game}
            username={username}
            bonusData={announceBonus}
            onGoToWebsite={goHeng36}
          />
        )}

        {game.type === 'เกม BINGO' && !needName && (
          <BingoGame
            gameId={id}
            game={game}
            username={username}
            onInfo={openInfo}
            onCode={openCode}
            isHost={isHost}
          />
        )}


        {locked  && <div className="banner warn">เกมนี้ยัง <b>ล็อกอยู่</b> โปรดติดต่อแอดมิน</div>}
        {(expired || runtimeExpired) && <div className="banner warn">เกมนี้ <b>หมดเวลา</b> แล้ว</div>}
      </div>

      {/* ✅ Popup : ตั้งชื่อผู้เล่น - ไม่แสดงเมื่อ modal code เปิดอยู่ */}
      {needName && !(modal.open && modal.kind === 'code') && (
        <Overlay key="game-login" onClose={undefined /* ไม่ปิดด้วยคลิกนอก */}>
          <div className="checkin-login-modal" onClick={(e)=>e.stopPropagation()}>
            {/* Logo */}
            <div className="modal-logo">
              <img src={assets.logoContainer} alt="Logo" />
            </div>
            
            {/* หัวข้อ */}
            <h2 className="modal-title">
              {(game?.type as string) === 'เกมสล็อต' && 'เข้าสู่ระบบเกมสล็อต'}
              {(game?.type as string) === 'เกมทายภาพปริศนา' && 'เข้าสู่ระบบเกมทายภาพปริศนา'}
              {(game?.type as string) === 'เกมทายเบอร์เงิน' && 'เข้าสู่ระบบเกมทายเบอร์เงิน'}
              {(game?.type as string) === 'เกมทายผลบอล' && 'เข้าสู่ระบบเกมทายผลบอล'}
              {(game?.type as string) === 'เกม Trick or Treat' && 'เข้าสู่ระบบเกม Trick or Treat'}
              {(game?.type as string) === 'เกมลอยกระทง' && 'เข้าสู่ระบบเกมลอยกระทง'}
              {(game?.type as string) === 'เกม BINGO' && 'เข้าสู่ระบบเกม BINGO'}
              {(game?.type as string) === 'เกมเช็คอิน' && 'เข้าสู่ระบบเกมเช็คอิน'}
              {!['เกมสล็อต', 'เกมทายภาพปริศนา', 'เกมทายเบอร์เงิน', 'เกมทายผลบอล', 'เกม Trick or Treat', 'เกมลอยกระทง', 'เกม BINGO', 'เกมเช็คอิน'].includes((game?.type as string) || '') && 'เข้าสู่ระบบเกม'}
            </h2>
            <p className="muted" style={{marginTop:4}}>
              {(game?.type as string) === 'เกมสล็อต' && 'กรอก USER และ PASSWORD เพื่อเล่นเกมสล็อต'}
              {(game?.type as string) === 'เกมทายภาพปริศนา' && 'กรอก USER และ PASSWORD เพื่อเล่นเกมทายภาพปริศนา'}
              {(game?.type as string) === 'เกมทายเบอร์เงิน' && 'กรอก USER และ PASSWORD เพื่อเล่นเกมทายเบอร์เงิน'}
              {(game?.type as string) === 'เกมทายผลบอล' && 'กรอก USER และ PASSWORD เพื่อเล่นเกมทายผลบอล'}
              {(game?.type as string) === 'เกม Trick or Treat' && 'กรอก USER และ PASSWORD เพื่อเล่นเกม Trick or Treat'}
              {(game?.type as string) === 'เกมลอยกระทง' && 'กรอก USER และ PASSWORD เพื่อเล่นเกมลอยกระทง'}
              {(game?.type as string) === 'เกม BINGO' && 'กรอก USER และ PASSWORD เพื่อเล่นเกม BINGO'}
              {(game?.type as string) === 'เกมเช็คอิน' && 'กรอก USER และ PASSWORD เพื่อเล่นเกมเช็คอิน'}
              {!['เกมสล็อต', 'เกมทายภาพปริศนา', 'เกมทายเบอร์เงิน', 'เกมทายผลบอล', 'เกม Trick or Treat', 'เกมลอยกระทง', 'เกม BINGO', 'เกมเช็คอิน'].includes((game?.type as string) || '') && 'กรอก USER และ PASSWORD'}
            </p>

            {/* USER */}
            <input
              className="f-control"
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              placeholder="USER ของคุณ"
              value={username}
              onChange={(e)=>setUsername(e.target.value.toUpperCase())}
              onKeyDown={(e)=>{
                if (e.key==='Enter') {
                  const pw = document.getElementById('game-pw') as HTMLInputElement | null
                  pw?.focus()
                }
              }}
              autoFocus
            />

            {/* PASSWORD */}
            <div className="f-pass">
              <input
                id="game-pw"
                className="f-control f-lg f-pw"
                type={showPw ? 'text' : 'password'}
                placeholder="รหัสผ่าน (เลขบัญชี 4 ตัวท้าย)"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.key==='Enter') {
                    saveName()
                  }
                }}
              />
              <button
                type="button"
                className="f-toggle"
                onClick={()=>setShowPw(!showPw)}
                tabIndex={-1}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>

            {/* ปุ่มยืนยัน */}
            <button
              className="f-btn primary"
              onClick={saveName}
              disabled={checkingName || !username.trim() || !password.trim()}
            >
              {checkingName ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
            </button>
          </div>
        </Overlay>
      )}
      {/* ✅ Auto SOLD-OUT Popup (ไม่ใช้ useEffect) */}
        {showAutoSoldOut && (
          <Overlay key="sold-out" onClose={undefined /* บล็อกคลิกนอก */}>
            <div className="modal modal-centered modal--warning" onClick={(e)=>e.stopPropagation()}>
              {/* Header Section */}
              <div style={{
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  background: `linear-gradient(135deg, ${colors.danger} 0%, ${colors.dangerLight} 100%)`,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  boxShadow: `0 8px 32px ${colors.danger}40`,
                  animation: 'pulse 2s infinite'
                }}>
                  <span style={{ fontSize: '32px' }}>🎉</span>
                </div>
                <h3 style={{
                  fontSize: '24px',
                  fontWeight: '800',
                  color: colors.textPrimary,
                  margin: '0 0 8px 0',
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  โค้ดเต็มแล้วค่ะ
                </h3>
              </div>

              {/* Message Section */}
              <div style={{
                background: `linear-gradient(135deg, ${colors.dangerLight}20 0%, ${colors.dangerLight}30 100%)`,
                border: `2px solid ${colors.danger}`,
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px',
                position: 'relative',
                boxShadow: `0 4px 16px ${colors.danger}30`
              }}>
                <div style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: colors.danger,
                  color: colors.textInverse,
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  แจ้งเตือน
                </div>
                
                <div style={{
                  textAlign: 'center',
                  color: colors.danger,
                  lineHeight: '1.6'
                }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    ขออภัยค่ะ โค้ดรางวัลในเกมในรอบนี้ถูกแจกหมดแล้ว
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#b91c1c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span>🎮</span>
                    <span>รอติดตามกิจกรรมรอบหน้าค่ะ!</span>
                    <span>🎮</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
                <div className="modal-actions">
                  <button
                    className="btn-cta primary"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '14px 32px',
                      fontSize: '16px',
                      fontWeight: '700',
                      color: 'white',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)'
                    }}
                    onClick={goHeng36}
                  >
                    {goButtonLabel}
                  </button>
                </div>
            </div>
          </Overlay>
        )}


      {/* Popup ส่วนกลาง */}
      {modalPortal}

     </section>
   )
 }
