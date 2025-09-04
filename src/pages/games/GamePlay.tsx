// src/pages/play/PlayGame.tsx
import React from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { db } from '../../services/firebase'
import { ref, onValue, get, set } from 'firebase/database'
import '../../styles/style.css'
import SlotGame from '../../components/SlotGame'
import PuzzleGame from '../../components/PuzzleGame'
import NumberGame from '../../components/NumberGame'
import FootballGame from '../../components/FootballGame'
import CheckinGame from '../../components/CheckinGame'
/** ====== CONFIG: path รายชื่อผู้เล่นใน RTDB ====== */
const USERS_PATH = 'username'

/** แปลงชื่อให้เป็นรูปแบบคีย์ใน DB (ตัดช่องว่าง) */
const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '')

type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'
  | 'เกมประกาศรางวัล'

type GameData = {
  id: string
  type: GameType
  name: string
  unlocked?: boolean
  locked?: boolean
  codes?: string[]
  codeCursor?: number
  claimedBy?: Record<string, any>
  puzzle?: { imageDataUrl?: string; answer?: string }
  numberPick?: { imageDataUrl?: string; endAt?: number | null }
  football?: { imageDataUrl?: string; homeTeam?: string; awayTeam?: string; endAt?: number | null }
  slot?: any
  announce?: { users: string[] }
}

type ModalKind = 'info' | 'code' | 'codes-empty';

const TYPE_META: Record<GameType, { icon: string; cls: string; label: string }> = {
  'เกมทายภาพปริศนา': { icon: '🧩', cls: 'type-puzzle',   label: 'เกมทายภาพปริศนา' },
  'เกมทายเบอร์เงิน' : { icon: '🔢', cls: 'type-number',   label: 'เกมทายเบอร์เงิน' },
  'เกมทายผลบอล'     : { icon: '⚽️', cls: 'type-football', label: 'เกมทายผลบอล' },
  'เกมสล็อต'         : { icon: '🎰', cls: 'type-slot',     label: 'เกมสล็อต' },
  'เกมเช็คอิน'       : { icon: '📍', cls: 'type-checkin',  label: 'HENG36 GAME ' },
  'เกมประกาศรางวัล': { icon: '🏆', cls: 'type-announce', label: 'เกมประกาศรางวัล' },
}
const getTypeMeta = (t: GameType) => TYPE_META[t] ?? { icon: '🎮', cls: 'type-default', label: t }

/** ----- Overlay แบบ portal ----- */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>{children}</div>,
    document.body
  )
}

type ModalState =
  | { open: false }
  | { open: true; kind: 'info'; title: string; message: string }
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
  // รองรับทั้ง /play/:id และ /?id=...
  const params = useParams()
  const [sp] = useSearchParams()
  const id = (params.id || sp.get('id') || '').trim()

  const [game, setGame] = React.useState<GameData | null>(null)
  const [loading, setLoading] = React.useState(true)

  // ผู้เล่น
  const [username, setUsername] = React.useState(localStorage.getItem('player_name') || '')
  const [password, setPassword] = React.useState('')  
  const [needName, setNeedName] = React.useState(true)
  const [checkingName, setCheckingName] = React.useState(false)

  // ทั่วไป
  const [submitting, setSubmitting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [expiredShown, setExpiredShown] = React.useState(false)
  const [runtimeExpired, setRuntimeExpired] = React.useState(false)
  const userKey = React.useMemo(() => normalizeUser(username || ''), [username])
  // ให้ปุ่ม 'ตกลง' ทำงานพิเศษ (ตอนพบว่าเคยตอบแล้ว)
  const [redirectOnOk, setRedirectOnOk] = React.useState<null | 'heng36'>(null);

  const [ignoreSoldOutOnce, setIgnoreSoldOutOnce] = React.useState(false);
  const soldOutGuardRef = React.useRef(false);
  const [autoSoldOutDismissed, setAutoSoldOutDismissed] = React.useState(false);
  const [showPw, setShowPw] = React.useState(false)

  // modal ส่วนกลาง (ทุกเกมใช้ร่วมกัน)
  const [modal, setModal] = React.useState<ModalState>({ open: false })
  const modalKind = modal.open ? modal.kind : undefined;
  const goHeng36 = React.useCallback(() => {
    window.location.assign('https://heng-36z.com/')
  }, [])

  // หัวข้อ+คำอธิบายสำหรับ popup กรอกชื่อ (แตกต่างตามประเภทเกม)
const needTitle =
  game?.type === 'เกมประกาศรางวัล'
    ? 'เช็ค USER ที่ได้รับโบนัสพิเศษ 100'
    : 'กรอกยูสเซอร์เพื่อเข้าเล่น'

const needSubtitle =
  game?.type === 'เกมประกาศรางวัล'
    ? 'กรอกยูสเซอร์เว็บ HENG36 ของคุณ เพื่อเช็คสิทธิ์รับโบนัสชดเชย'
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
    const progress  = Math.max(used, cursorRaw);

    return { total, used, cursor: progress, claimedBy: rawClaimed };
  };

    const getPrevAnswer = async (gameId: string, player: string) => {
    const snap = await get(ref(db, `answersIndex/${gameId}/${player}`));
    if (!snap.exists()) return null;
    const v = snap.val() || {};
    // รองรับทั้ง { answer: '...' } หรือเป็นสตริงตรงๆ
    return typeof v === 'string' ? v : (v.answer ?? null);
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
    return cursor >= total && !hasMyCode && !soldOutGuardRef.current && !ignoreSoldOutOnce;
  })();

  /** โหลดเกม */
  React.useEffect(() => {
    if (!id) { setLoading(false); return }
    const off = onValue(ref(db, `games/${id}`), (snap) => {
      const g = snap.val()
      setGame(g ? { id, ...g } : null)
      setLoading(false)
    })
    return () => off()
  }, [id])

  /** เปลี่ยนเกม → รีเซ็ตสถานะ */
  React.useEffect(() => {
    const last = localStorage.getItem('player_name') || ''
    setUsername(last)
    setNeedName(true)
    setExpiredShown(false)
    setRuntimeExpired(false)
  }, [id, game?.type, (game as any)?.updatedAt])

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
      if (soldOutGuardRef.current) return // เพิ่งแจกโค้ดสำเร็จ → ไม่เด้งโค้ดเต็มซ้ำ
      setModal({ open:true, kind:'codes-empty', title:'โค้ดเต็มแล้วค่ะ', message:'โค้ดเต็มแล้วค่ะ รอติดตามกิจกรรมรอบหน้าค่ะ' })
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

  const expired = React.useMemo(() => (game ? isExpired(game) : false), [game])
  const locked  = React.useMemo(() => (game ? isLocked(game)  : false), [game])
  const normalize = (s: string) => s.trim().replace(/\s+/g, '')

  /** เด้ง "หมดเวลาเล่น" ทันทีถ้าโหลดมาแล้วหมดเวลา */
  React.useEffect(() => {
    if (!game) return
    if (expired && !expiredShown) {
      setExpiredShown(true)
      setNeedName(false)
      setModal({
        open: true,
        kind: 'info',
        title: 'หมดเวลาเล่น',
        message: 'เกินกำหนดเวลาที่ตั้งไว้แล้ว',
      })
    }
  }, [game, expired, expiredShown])

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
    setModal({ open:true, kind:'code', title:'ยินดีด้วย! คำตอบถูกต้อง', message:'นี่โค้ดของคุณค่ะ ✨', code })
  }, [])

  // ตรวจ USER กับ RTDB (ปรับให้ข้ามการเช็คซ้ำในเกมทายผลบอล/เบอร์เงิน)
  const saveName = async () => {
  const raw = username
  const key = normalizeUser(raw)
  if (!key) return

  setCheckingName(true)
  try {
    // ✅ เกมเช็คอิน: ใช้ USER+PASSWORD จาก USERS_EXTRA (เดิมของคุณ)
    if (game?.type === 'เกมเช็คอิน') {
      if (!password.trim()) {
        setModal({ open: true, kind: 'info', title: 'กรอกรหัสผ่าน', message: 'โปรดกรอกรหัสผ่านให้ครบ' })
        return
      }
      const snap = await get(ref(db, `USERS_EXTRA/${key}`))
      if (!snap.exists()) {
        setModal({
          open: true,
          kind: 'info',
          title: 'ไม่สามารถเข้าร่วมกิจกรรม',
          message: `USER : ${key}\nเนื่องจาก USER ยังไม่สามารถเข้าร่วมกิจกรรมได้\nติดต่อสอบถามการเข้าร่วมที่แอดมินได้เลยค่ะ`
        })
        return
      }
      const rec = snap.val() || {}
      const passInDb = String(rec.password ?? rec.pass ?? '')
      if (password !== passInDb) {
        setModal({ open: true, kind: 'info', title: 'รหัสผ่านไม่ถูกต้อง', message: 'โปรดลองใหม่อีกครั้ง' })
        return
      }
      localStorage.setItem('player_name', key)
      setUsername(key)
      setNeedName(false)
      return
    }

    // ✅ เกมประกาศรางวัล: ตรวจจากรายชื่อที่แนบไว้ในตัวเกม (announce.users)
    if (game?.type === 'เกมประกาศรางวัล') {
        const list: string[] = Array.isArray((game as any)?.announce?.users)
          ? (game as any).announce.users
          : []
        const has = new Set(list.map((u) => normalizeUser(String(u || '')))).has(key)

        if (!has) {
          setModal({
            open: true,
            kind: 'info',
            title: 'ไม่เข้าเงื่อนไข',
            message: 'USER ลูกค้ายังไม่เข้าเงื่อนไขการรับค่ะ'
          })
          setUsername('')
          localStorage.removeItem('player_name')
          return
        }

        // ผ่าน → บันทึกชื่อ แล้วเด้ง popup วิธีเช็คโบนัส
          localStorage.setItem('player_name', key)
          setUsername(key)
          setNeedName(false)

          setModal({
            open: true,
            kind: 'info',
            title: 'ยินดีด้วย! USER นี้ได้รับรางวัลโบนัสพิเศษ 100 🎉',
            message:
              `วิธีการเช็คโบนัส\n\n` +
              `1) ล็อกอินเข้าหน้าระบบ\n` +
              `2) ไปที่เมนู "บัญชีของฉัน"\n` +
              `3) เช็คที่หัวข้อ "โบนัส"\n\n` +
              `หากมีโบนัสอยู่ สามารถกดรับได้เลยค่ะ\n\n` +
              `แนะนำให้เล่นเครดิตที่มีอยู่ในกระเป๋าหลักให้เรียบร้อยก่อนที่จะโยกเงินเข้านะคะ\n` +
              `เพื่อป้องกันการติดเทิร์นจากโปรโมชั่นต่างๆค่ะ`,
          })
          setRedirectOnOk('heng36')   // ⬅️ ให้ปุ่ม "ตกลง" ใช้ goHeng36
          return
        }


    // เกมอื่นๆ (เดิม) → ตรวจ USER ใน path USERS_PATH
    const snap = await get(ref(db, `${USERS_PATH}/${key}`))
    if (!snap.exists() || snap.val() !== true) {
      setModal({ open: true, kind: 'info', title: 'ไม่พบ USER ในระบบ', message: `USER "${raw}"` })
      setUsername('')
      localStorage.removeItem('player_name')
      return
    }

    // เช็คซ้ำว่าเคยตอบแล้วไหม (เวอร์ชันเดิมของคุณ)
    const shouldCheckDuplicate = !!game && !['เกมทายผลบอล', 'เกมทายเบอร์เงิน'].includes(game.type)
    if (shouldCheckDuplicate) {
      const dup = await get(ref(db, `answersIndex/${game!.id}/${key}`))
      if (dup.exists()) {
        setNeedName(false)
        setRedirectOnOk('heng36')
        setModal({ open: true, kind: 'info', title: 'แจ้งเตือน', message: 'ยูสเซอร์นี้ได้ทำการตอบของวันนี้ไปแล้วค่ะ' })
        return
      }
    }

    localStorage.setItem('player_name', key)
    setUsername(key)
    setNeedName(false)
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
  }, [runtimeExpired])

  // ======= ฟังก์ชันส่งคำตอบ =======

  /** เกมทายเบอร์เงิน (NumberGame) */
 const submitNumberAnswer = async (ansText: string) => {
  if (!game) return;
  if (needName || !username.trim()) { openInfo('ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นเพื่อเริ่มเล่นเกม'); setNeedName(true); return; }
  if (isLocked(game)) { openInfo('ยังไม่เปิดให้เล่น', 'เกมนี้ยังถูกล็อกอยู่ โปรดติดต่อแอดมิน'); return; }
  if (runtimeExpired || (game.numberPick?.endAt && Date.now() > game.numberPick.endAt)) { openInfo('หมดเวลาเล่น', 'เกินกำหนดเวลาที่ตั้งไว้แล้ว'); return; }

  const player = normalizeUser(username);
  const v = ansText.trim();
  if (!v) { openInfo('กรอกคำตอบก่อน', 'โปรดพิมพ์คำตอบของคุณ'); return; }

  // เช็คคำตอบเดิมของยูสนี้ก่อน
  const prev = await getPrevAnswer(id, player);
  const newHuman = `เลขที่ทาย: ${v}`;

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
          await Promise.all([
            set(ref(db, `answers/${id}/${ts}`), { user: player, answer: newHuman }),
            set(ref(db, `answersIndex/${id}/${player}`), { answer: newHuman, ts }),
          ]);
          setModal({
            open: true,
            kind: 'saved',
            title: 'คุณได้เลือกคำตอบใหม่แล้ว',
            message: `ยูสเซอร์: ${username}\nคำตอบที่เลือก: ${newHuman}\n\n⚠️ กรุณาแคปหน้านี้ไว้เป็นหลักฐาน`,
            extra: { user: username, answer: newHuman },
          });
        } finally {
          setSubmitting(false);
        }
      },
    });
    return;
  }

  // ไม่มีคำตอบเดิม หรือเหมือนเดิม → บันทึกตรง ๆ
  setSubmitting(true);
  try {
    const ts = Date.now();
    await Promise.all([
      set(ref(db, `answers/${id}/${ts}`), { user: player, answer: newHuman }),
      set(ref(db, `answersIndex/${id}/${player}`), { answer: newHuman, ts }),
    ]);
    setModal({
      open: true,
      kind: 'saved',
      title: 'คุณได้เลือกคำตอบใหม่แล้ว',
      message: `ยูสเซอร์: ${username}\nคำตอบที่เลือก: ${newHuman}\n\n⚠️ กรุณาแคปหน้านี้ไว้เป็นหลักฐาน`,
      extra: { user: username, answer: newHuman },
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
  if (runtimeExpired || (game.football?.endAt && Date.now() > game.football.endAt)) { openInfo('หมดเวลาเล่น', 'เกินกำหนดเวลาที่ตั้งไว้แล้ว'); return; }

  const h = Math.floor(home), a = Math.floor(away);
  if (h < 0 || h > 99 || a < 0 || a > 99 || Number.isNaN(h) || Number.isNaN(a)) {
    openInfo('กรอกสกอร์ไม่ถูกต้อง', 'โปรดกรอกสกอร์ของทั้งสองทีมเป็นตัวเลข 0–99');
    return;
  }

  const player = normalizeUser(username);
  const hName = game.football?.homeTeam || 'ทีมเหย้า';
  const aName = game.football?.awayTeam || 'ทีมเยือน';
  const human = `${hName} ${h} - ${a} ${aName}`;

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
          const ts = Date.now();
          await Promise.all([
            set(ref(db, `answers/${id}/${ts}`), { user: player, answer: human }),
            set(ref(db, `answersIndex/${id}/${player}`), { answer: human, ts }),
          ]);
          setModal({
            open: true,
            kind: 'saved',
            title: 'คุณส่งสกอร์เรียบร้อย',
            message: '',
            extra: { user: username, football: { homeName: hName, awayName: aName, home: h, away: a } },
          });
        } finally {
          setSubmitting(false);
        }
      },
    });
    return;
  }

  // ไม่มีคำตอบเดิม หรือเหมือนเดิม → บันทึกตรง ๆ
  setSubmitting(true);
  try {
    const ts = Date.now();
    await Promise.all([
      set(ref(db, `answers/${id}/${ts}`), { user: player, answer: human }),
      set(ref(db, `answersIndex/${id}/${player}`), { answer: human, ts }),
    ]);
    setModal({
      open: true,
      kind: 'saved',
      title: 'คุณส่งสกอร์เรียบร้อย',
      message: '',
      extra: { user: username, football: { homeName: hName, awayName: aName, home: h, away: a } },
    });
  } finally {
    setSubmitting(false);
  }
};

  // ---------- UI ----------
  if (!id)      return <div className="play-wrap"><div className="play-card">ไม่พบบัตรเกม</div></div>
  if (loading)  return <div className="play-wrap"><div className="play-card">กำลังโหลดเกม…</div></div>
  if (!game)    return <div className="play-wrap"><div className="play-card">ไม่พบเกมนี้</div></div>

  const img =
    game.puzzle?.imageDataUrl ||
    game.numberPick?.imageDataUrl ||
    game.football?.imageDataUrl ||
    ''

  return (
    <section className="play-wrap bg-game">
      <div className="play-card">
        <img src="/image/logo.png" alt="HENG36 PARTY" className="play-logo" />

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

        {game.type === 'เกมเช็คอิน' && !needName && (
          <CheckinGame
            gameId={id}
            game={game}
            username={username}
            onInfo={(t,m)=>setModal({ open:true, kind:'info', title:t, message:m })}
            onCode={(code)=>setModal({ open:true, kind:'code', title:'ยินดีด้วย! คำตอบถูกต้อง', message:'นี่โค้ดของคุณค่ะ', code })}
          />
        )}

        {game.type === 'เกมทายภาพปริศนา' && (
          <PuzzleGame
            gameId={id}
            game={game as any} 
            username={username}
            onInfo={openInfo}
            onCode={openCode}
          />
        )}

        {game.type === 'เกมทายเบอร์เงิน' && (
          <NumberGame
            image={img}
            endAtMs={game.numberPick?.endAt ?? null}
            onExpire={handleExpire}
            disabled={runtimeExpired || locked || submitting}
            submitting={submitting}
            onSubmit={submitNumberAnswer}
          />
        )}

        {game.type === 'เกมทายผลบอล' && (
          <FootballGame
            image={game.football?.imageDataUrl || ''}
            endAtMs={game.football?.endAt ?? null}
            onExpire={handleExpire}
            homeName={game.football?.homeTeam || 'ทีมเหย้า'}
            awayName={game.football?.awayTeam || 'ทีมเยือน'}
            disabled={expired || runtimeExpired || locked}
            submitting={submitting}
            onSubmit={submitFootballFromChild}
          />
        )}
        {game.type === 'เกมประกาศรางวัล' && !needName && (
          <div className="announce-box">
            <h3>รายชื่อผู้ได้รับรางวัล</h3>
            <div style={{display:'flex', overflowX:'auto', gap:8}}>
              {(game.announce?.users||[]).map((u,i)=>(
                <div key={i} className="tag">{u}</div>
              ))}
            </div>
          </div>
        )}

        {locked  && <div className="banner warn">เกมนี้ยัง <b>ล็อกอยู่</b> โปรดติดต่อแอดมิน</div>}
        {(expired || runtimeExpired) && <div className="banner warn">เกมนี้ <b>หมดเวลา</b> แล้ว</div>}
      </div>

      {/* ✅ Popup : ตั้งชื่อผู้เล่น */}
      {needName && (
        <Overlay onClose={undefined /* ไม่ปิดด้วยคลิกนอก */}>
          <div className="modal modal-centered modal--auth" onClick={(e)=>e.stopPropagation()}>
            {/* หัวข้อ */}
            <h2 className="modal-title">
              {game?.type === 'เกมเช็คอิน' ? 'เข้าสู่ระบบเกมเช็คอิน' : 'กรอกยูสเซอร์เพื่อเข้าเล่น'}
            </h2>
            <p className="muted" style={{marginTop:4}}>
              {game?.type === 'เกมเช็คอิน'
                ? 'กรอก USER และ PASSWORD'
                : 'ใช้ยูสเซอร์ของเว็บ HENG36 เท่านั้น'}
            </p>

            {/* USER */}
            {/* USER */}
              <input
                className="f-control"
                type="text"                // ← ใช้ text เสมอ
                inputMode="text"           // ← บังคับคีย์บอร์ดตัวอักษรบนมือถือ
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                placeholder={game?.type === 'เกมเช็คอิน' ? 'USER ของคุณ' : 'ยูสเซอร์ของคุณ'}
                value={username}
                onChange={(e)=>setUsername(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.key==='Enter') {
                    if (game?.type === 'เกมเช็คอิน') {
                      const pw = document.getElementById('chk-pw') as HTMLInputElement | null
                      pw?.focus()
                    } else {
                      saveName()
                    }
                  }
                }}
                autoFocus
              />


            {/* PASSWORD เฉพาะเกมเช็คอิน */}
              {game?.type === 'เกมเช็คอิน' && (
                <>
                  <div className="f-pass">
                    <input
                      id="chk-pw"
                      className="f-control f-lg f-pw"
                      type={showPw ? 'text' : 'password'}
                      placeholder="รหัสผ่าน (เลขบัญชี 4 ตัวท้าย)"
                      value={password}
                      onChange={(e)=>setPassword(e.target.value)}
                      onKeyDown={(e)=>{ if (e.key==='Enter') saveName() }}
                    />
                    <button
                      type="button"
                      className="f-eye"
                      onClick={()=>setShowPw(v=>!v)}
                      aria-label="toggle password"
                      title={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPw ? '🙈' : '👁️'}
                    </button>
                  </div>

                  <div className="auth-warning">
                    PASSWORD คือ เลขบัญชี 4 ตัวท้าย
                  </div>
                </>
              )}


            <div className="modal-actions single">
              <button className="btn-cta " onClick={saveName} disabled={!username.trim() || (game?.type==='เกมเช็คอิน' && !password) || checkingName}>
                {checkingName ? 'กำลังตรวจสอบ…' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
      {/* ✅ Auto SOLD-OUT Popup (ไม่ใช้ useEffect) */}
        {showAutoSoldOut && (
          <Overlay onClose={undefined /* บล็อกคลิกนอก */}>
            <div className="modal modal-centered" onClick={(e)=>e.stopPropagation()}>
              <h3 className="modal-title" style={{ textAlign:'center' }}>โค้ดเต็มแล้วค่ะ</h3>
              <p className="modal-message" style={{ whiteSpace:'pre-wrap' }}>
                โค้ดเต็มแล้วค่ะ รอติดตามกิจกรรมรอบหน้าค่ะ
              </p>
              <div className="modal-actions">
                <button
                  className="btn-cta"
                  onClick={goHeng36}
                >
                  ตกลง
                </button>
              </div>
            </div>
          </Overlay>
        )}


      {/* Popup ส่วนกลาง */}
      {modal.open && (
        <Overlay onClose={undefined /* บล็อกคลิกนอก popup */}>
          <div className={`modal modal-centered modal--auth ${modalKind === 'info' ? 'modal--info' : ''}`} onClick={(e)=>e.stopPropagation()}>
            {modal.kind !== 'confirm-replace' && (
              <h3 className="modal-title" style={{ textAlign:'center' }}>
                {'title' in modal ? modal.title : ''}
              </h3>
            )}

            {modal.kind === 'code' ? (
              <>
                <div className="code-section">
                  <div className="success-badge" role="status" aria-live="polite">
                    <span className="spark">✨</span>
                    <span>นี่โค้ดของคุณค่ะ</span>
                    <span className="spark">✨</span>
                  </div>
                  <div className="code-box" aria-label="โค้ดของคุณ">{modal.code}</div>
                </div>

                <div
                  className="modal-actions" 
                  style={{ display: 'flex',
                    flexDirection: 'column', // ⬅️ เรียงแนวตั้ง
                    gap: 12 }}
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

                  <a
                    className="btn-cta btn-cta-green"
                    style={{ width: '100%', height: 44, fontWeight: 800, textAlign: 'center', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}
                    onClick={goHeng36}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="ico">↗︎</span>
                    ไปกรอกโค้ด HENG36
                  </a>
                </div>

              </>
            ) : modal.kind === 'saved' ? (
              <>
                <div className="saved-wrap saved--center" style={{ textAlign: 'center' }}>
                  <div
                    className="saved-user"
                    style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                  >
                    <span className="ico" aria-hidden>👤</span>
                    <span>ยูสเซอร์:</span>
                    <b style={{ marginInlineStart: 4 }}>{modal.extra?.user || username}</b>
                  </div>

                  {modal.extra?.football ? (
                    <div
                      className="saved-score"
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 12,
                        fontWeight: 800,
                        marginTop: 8,
                      }}
                    >
                      <span className="team">{modal.extra.football.homeName}</span>
                      <span className="score">{modal.extra.football.home} - {modal.extra.football.away}</span>
                      <span className="team">{modal.extra.football.awayName}</span>
                    </div>
                  ) : (
                    <div className="saved-answer" style={{ fontWeight: 700, marginTop: 6 }}>
                      {modal.extra?.answer || ''}
                    </div>
                  )}

                  <hr className="modal-sep" />

                  <div role="alert" aria-live="polite" className="warning-2lines">
                    <span aria-hidden>⚠️</span>
                    <div className="text">
                      <div>รบกวนแคปหน้านี้ไว้เป็นหลักฐานให้แอดมิน</div>
                      <div>กรณีที่ตอบถูกแล้วไม่ได้เครดิต</div>
                    </div>
                  </div>
                </div>

                <div className="modal-actions">
                  <button className="btn-cta btn-cta-green btn-wide" onClick={goHeng36}>
                    ตกลง
                  </button>
                </div>
              </>
            ) : modal.kind === 'confirm-replace' ? (
              <>
                <h3 className="modal-title" style={{ textAlign:'center', color:'#dc2626', fontWeight:800 }}>
                  {modal.title}
                </h3>
                {!!modal.message && (
                  <p className="modal-message" style={{ textAlign:'center', marginTop:2, color:'#334155' }}>
                    {modal.message}
                  </p>
                )}

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10 }}>
                  <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:'10px 12px', background:'#f8fafc' }}>
                    <div style={{ color:'#64748b', fontWeight:700, marginBottom:6 }}>{modal.oldLabel}</div>
                    <div style={{ color:'#0f172a', fontWeight:800 }}>{modal.oldValue}</div>
                  </div>
                  <div style={{ border:'1px solid #e5e7eb', borderRadius:12, padding:'10px 12px', background:'#fff' }}>
                    <div style={{ color:'#64748b', fontWeight:700, marginBottom:6 }}>{modal.newLabel}</div>
                    <div style={{ color:'#1d4ed8', fontWeight:900 }}>{modal.newValue}</div>
                  </div>
                </div>

                <div style={{ color:'#b91c1c', fontWeight:800, textAlign:'center', marginTop:12 }}>
                  ยืนยันกำหนดคำตอบใหม่ คำตอบเก่าจะเป็นโมฆะทันที
                </div>

                <div className="modal-actions" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
                  <button
                    className="btn-cta"
                    style={{ background:'#ffffff', color:'#111827', border:'1px solid #e5e7eb' }}
                    onClick={() => setModal({ open:false })}
                    disabled={submitting}
                  >
                    ยกเลิก
                  </button>
                  <button
                    className="btn-cta"
                    style={{ background:'#dc2626' }}
                    onClick={() => modal.onConfirm?.()}
                    disabled={submitting}
                  >
                    {submitting ? 'กำลังยืนยัน…' : 'ยืนยัน'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modal-message" style={{ whiteSpace:'pre-wrap' }}>
                  {'message' in modal ? modal.message : ''}
                </p>
                <div className="modal-actions">
                  <button
                    className="btn-cta btn-cta-green btn-wide "
                    onClick={() => {
                      setModal({ open: false });
                      if (redirectOnOk) {
                        const dest = redirectOnOk;
                        setRedirectOnOk(null);
                        if (dest === 'heng36') goHeng36();
                      }
                    }}
                  >
                    ตกลง
                  </button>
                </div>
              </>
            )}
          </div>
        </Overlay>
      )}
    </section>
  )
}
