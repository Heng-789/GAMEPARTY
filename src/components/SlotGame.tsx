// src/components/SlotGame.tsx
import React, {
  useEffect, useMemo, useRef, useState,
  forwardRef, useImperativeHandle, useCallback,
} from 'react'
import { db } from '../services/firebase'
import { ref, get, set, runTransaction, onValue } from 'firebase/database'
import { useRealtimeData } from '../hooks/useOptimizedData'
import UserBar from './UserBar'
import * as postgresqlAdapter from '../services/postgresql-adapter'

import '../styles/slot.css'

type SlotConfig = {
  startCredit?: number
  startBet?: number
  targetCredit?: number
  winRatePct?: number
  winRate?: number
  symbols?: string[]
}

type EmbedConfig = {
  startBet: number
  winRate: number
  /** path เครดิตจริงใน RTDB เช่น USERS_EXTRA/{user}/hcoin */
  creditRef: string
  onClose?: () => void
}

type SlotGameProps = {
  gameId: string
  gameData: any
  username: string
  /** ใช้โหมดฝังในหน้าเช็คอิน */
  embed?: EmbedConfig
  displayCredit?: number
}

type ReelHandle = {
  spinTo: (targetIndex: number, extraRounds: number, durationMs?: number) => Promise<void>
  setInstant: (index: number) => void
}

type Tier = 'slot1_triple' | 'slot1_pair' | 'other_triple' | 'other_pair' | 'none'

const DEFAULT_SYMBOLS = [
  '/image/slot1.png',     // index 0 = ตัวพิเศษ "slot1"
  '/image/Asset1.png',
  '/image/Asset2.png',
  '/image/Asset3.png',
  '/image/Asset4.png',
  '/image/Asset5.png',
  '/image/Asset6.png',
  '/image/Asset7.png',
  '/image/Asset8.png',
  '/image/Asset9.png',
  '/image/Asset10.png',
];

const slotAnswersId = (id: string) => id

async function logSlotPlayLast(baseGameId: string, user: string, row: {
  bet: number
  balanceBefore: number
  balanceAfter: number
}) {
  // ✅ ใช้ PostgreSQL 100% (log as answer)
  await postgresqlAdapter.submitAnswer(
    baseGameId,
    user,
    `slot:bet=${row.bet},before=${row.balanceBefore},after=${row.balanceAfter}`,
    false
  )
}

/* ---------------- Reel ---------------- */
function buildStrip(symbols: string[], repeat = 18) {
  const arr: string[] = []
  for (let i = 0; i < repeat; i++) arr.push(...symbols)
  return arr
}

const Reel = forwardRef<ReelHandle, { symbols: string[]; highlight?: boolean; effectClass?: string }>(
({ symbols, highlight, effectClass }, ref) => {
  const strip = useMemo(() => buildStrip(symbols, 18), [symbols])
  const stripEl = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)

  const SPEED_PER_STEP = 70
  const MIN_DUR = 1300
  const MAX_DUR = 2200

  const getStep = useCallback(() => {
    const el = stripEl.current
    if (!el) return 0
    const first  = el.querySelector('.reel-cell') as HTMLElement | null
    const second = first?.nextElementSibling as HTMLElement | null
    if (first && second) {
      const d = second.offsetTop - first.offsetTop
      if (d > 0) return d
    }
    if (first) {
      const h = first.getBoundingClientRect().height
      if (h > 0) return h
    }
    const win = el.parentElement as HTMLElement | null
    return win?.clientHeight || 120
  }, [])

  const setY = (el: HTMLElement, steps: number) => {
    const step = Math.max(1, getStep())
    el.style.transition = 'none'
    el.style.transform = `translate3d(0, ${-steps * step}px, 0)`
  }

  const ease = (t: number) => 1 - Math.pow(1 - t, 3)

  const realign = useCallback(() => {
    const el = stripEl.current
    if (!el) return
    const N = symbols.length
    const symIndex = at % N
    const base = N * 2 + symIndex
    setY(el, base)
    setAt(base)
  }, [at, symbols.length, getStep])

  const rafId = useRef<number | null>(null)
  const cancelAnim = () => { if (rafId.current != null) cancelAnimationFrame(rafId.current); rafId.current = null }

  useImperativeHandle(ref, () => ({
    setInstant: (index) => {
      const el = stripEl.current
      if (!el) return
      const N = symbols.length
      const base = N * 2 + (index % N)
      cancelAnim()
      setY(el, base)
      setAt(base)
    },

    spinTo: (targetIndex, extraRounds, durationMs) => new Promise<void>((resolve) => {
      const el = stripEl.current
      if (!el) return resolve()

      cancelAnim()

      const N = symbols.length
      const cur = at % N
      const delta = (targetIndex - cur + N) % N
      const steps = extraRounds * N + delta
      const toSteps = at + steps

      const base = Number.isFinite(durationMs) ? Number(durationMs) : steps * SPEED_PER_STEP
      const dur  = Math.max(MIN_DUR, Math.min(MAX_DUR, base))

      const stepPx = Math.max(1, getStep())
      const fromSteps = at
      const start = performance.now()

      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur)
        const eased = ease(p)
        const curSteps = fromSteps + (toSteps - fromSteps) * eased
        el.style.transform = `translate3d(0, ${-curSteps * stepPx}px, 0)`
        if (p < 1) {
          rafId.current = requestAnimationFrame(tick)
        } else {
          rafId.current = null
          const basePos = N * 2 + (toSteps % N)
          setY(el, basePos)
          setAt(basePos)
          resolve()
        }
      }

      setY(el, fromSteps)
      void el.offsetHeight
      rafId.current = requestAnimationFrame(tick)
    }),
  }), [at, symbols.length, getStep])

  useEffect(() => { realign() }, [realign])
  useEffect(() => {
    const onResize = () => realign()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnim() }
  }, [realign])

  return (
    <div className={`reel-window ${highlight ? 'win' : ''} ${effectClass || ''}`}>
      <div ref={stripEl} className="reel-strip">
        {strip.map((src, i) => (
          <div className="reel-cell" key={i}>
            <div className="reel-img"><img src={src} alt="" /></div>
          </div>
        ))}
      </div>
    </div>
  )
})
Reel.displayName = 'Reel'

/* ---------------- SlotGame ---------------- */
export default function SlotGame({ gameId, gameData, username, embed, displayCredit }: SlotGameProps) {
  const cfg: SlotConfig = useMemo(() => gameData?.slot || {}, [gameData])
  const reelRef0 = useRef<ReelHandle>(null)
  const reelRef1 = useRef<ReelHandle>(null)
  const reelRef2 = useRef<ReelHandle>(null)

  const symbols = useMemo(
    () => (Array.isArray(cfg.symbols) && cfg.symbols.length ? cfg.symbols : DEFAULT_SYMBOLS),
    [cfg.symbols]
  )

  const toMultiplier = (raw: any, fallback: number) => {
    let n: number | null = null
    if (typeof raw === 'number') n = raw
    else if (raw != null) {
      const s = String(raw).trim().toLowerCase()
      if (s.endsWith('x')) n = parseFloat(s.slice(0, -1))
      else if (s.endsWith('%')) n = parseFloat(s.slice(0, -1)) / 100
      else n = parseFloat(s)
    }
    if (!Number.isFinite(n!) || (n as number) <= 0) return fallback
    return (n as number) > 100 ? (n as number) / 100 : (n as number)
  }

  const TIER_TABLE = {
    slot1_triple: { label: 'slot1 ×3', defaultMult: 2.0 },
    other_triple: { label: 'อื่น ๆ ×3', defaultMult: 1.8 },
    slot1_pair:   { label: 'slot1 ×2', defaultMult: 1.5  },
    other_pair:   { label: 'อื่น ๆ ×2', defaultMult: 0.9  },
  } as const

  /* ---------- ความน่าจะเป็นตามทฤษฎี (สัญลักษณ์ 11 ตัว, 1/11 ต่อรีล) ---------- */
  const THEORETICAL_PROBABILITIES = {
    slot1_triple: 1 / (11 * 11 * 11),           // ≈ 0.0752%
    other_triple: 10 / (11 * 11 * 11),          // ≈ 0.7523%
    slot1_pair:   30 / (11 * 11 * 11),          // ≈ 2.254%
    other_pair:   300 / (11 * 11 * 11),         // ≈ 22.54%
  } as const
  const THEORETICAL_WIN_RATE =
    THEORETICAL_PROBABILITIES.slot1_triple +
    THEORETICAL_PROBABILITIES.other_triple +
    THEORETICAL_PROBABILITIES.slot1_pair +
    THEORETICAL_PROBABILITIES.other_pair // 341/1331 ≈ 0.25621 (25.621%)

  /* ---------- โอกาสชนะ (รองรับ embed.winRate) ---------- */
  const clampPct = (n: any) => Math.max(0, Math.min(100, Number(n ?? 0)))
  const desiredWinRatePct = clampPct(
    embed?.winRate ?? (cfg as any)?.winRate ?? (cfg as any)?.winRatePct ?? 0
  )
  const desiredWinRate = desiredWinRatePct / 100

  const winTiers = useMemo(() => {
    const raw: any = (cfg as any)?.winTiers || {}

    const getPayout = (t: keyof typeof TIER_TABLE) => {
      const fromConfig = raw?.[t]?.payoutX ?? raw?.[t]?.payoutPct ?? raw?.[t]?.mult
      return toMultiplier(fromConfig, TIER_TABLE[t].defaultMult)
    }

    const defaultMults = {
      slot1_triple: getPayout('slot1_triple'),
      other_triple: getPayout('other_triple'),
      slot1_pair:   getPayout('slot1_pair'),
      other_pair:   getPayout('other_pair'),
    }

    const mk = (t: keyof typeof TIER_TABLE, prob: number, mult: number) => ({
      chancePct: +(prob * 100).toFixed(4),
      mult,
      label: TIER_TABLE[t].label,
    })

    if (!desiredWinRate) {
      return {
        slot1_triple: mk('slot1_triple', THEORETICAL_PROBABILITIES.slot1_triple, defaultMults.slot1_triple),
        other_triple: mk('other_triple', THEORETICAL_PROBABILITIES.other_triple, defaultMults.other_triple),
        slot1_pair:   mk('slot1_pair',   THEORETICAL_PROBABILITIES.slot1_pair,   defaultMults.slot1_pair),
        other_pair:   mk('other_pair',   THEORETICAL_PROBABILITIES.other_pair,   defaultMults.other_pair),
      }
    }

    const winRateScale = desiredWinRate / THEORETICAL_WIN_RATE
    const scaledProbs = {
      slot1_triple: THEORETICAL_PROBABILITIES.slot1_triple * winRateScale,
      other_triple: THEORETICAL_PROBABILITIES.other_triple * winRateScale,
      slot1_pair:   THEORETICAL_PROBABILITIES.slot1_pair * winRateScale,
      other_pair:   THEORETICAL_PROBABILITIES.other_pair * winRateScale,
    }

    const scaledSum =
      scaledProbs.slot1_triple +
      scaledProbs.other_triple +
      scaledProbs.slot1_pair +
      scaledProbs.other_pair

    const normFactor = scaledSum > 0 ? desiredWinRate / scaledSum : 0
    const normalizedProbs = {
      slot1_triple: scaledProbs.slot1_triple * normFactor,
      other_triple: scaledProbs.other_triple * normFactor,
      slot1_pair:   scaledProbs.slot1_pair * normFactor,
      other_pair:   scaledProbs.other_pair * normFactor,
    }

    const theoreticalRTP = THEORETICAL_PROBABILITIES.slot1_triple * defaultMults.slot1_triple +
      THEORETICAL_PROBABILITIES.other_triple * defaultMults.other_triple +
      THEORETICAL_PROBABILITIES.slot1_pair * defaultMults.slot1_pair +
      THEORETICAL_PROBABILITIES.other_pair * defaultMults.other_pair

    const scaledRTP = normalizedProbs.slot1_triple * defaultMults.slot1_triple +
      normalizedProbs.other_triple * defaultMults.other_triple +
      normalizedProbs.slot1_pair * defaultMults.slot1_pair +
      normalizedProbs.other_pair * defaultMults.other_pair

    const rtpScale = scaledRTP > 0 ? theoreticalRTP / scaledRTP : 1

    const mkScaled = (t: keyof typeof TIER_TABLE) => ({
      chancePct: +(normalizedProbs[t] * 100).toFixed(4),
      mult: defaultMults[t] * rtpScale,
      label: TIER_TABLE[t].label,
    })

    return {
      slot1_triple: mkScaled('slot1_triple'),
      other_triple: mkScaled('other_triple'),
      slot1_pair:   mkScaled('slot1_pair'),
      other_pair:   mkScaled('other_pair'),
    }
  }, [cfg, desiredWinRate])

  /* ---------- สถานะ ---------- */
  const userKey = (username || '').trim().toUpperCase()
  // ✅ เก็บ creditRefEmbed ไว้สำหรับ parse userId (ไม่ใช้ Firebase ref แล้ว)
  const creditRefEmbedPath = embed?.creditRef || null
  // ✅ Parse userId จาก creditRef path (เช่น "USERS_EXTRA/USER123/hcoin" -> "USER123")
  const creditRefUserId = useMemo(() => {
    if (!creditRefEmbedPath) return null
    // Parse path format: "USERS_EXTRA/{userId}/hcoin"
    const match = creditRefEmbedPath.match(/USERS_EXTRA\/([^/]+)\/hcoin/)
    return match ? match[1].toUpperCase() : null
  }, [creditRefEmbedPath])
  // ✅ เก็บ stateRef ไว้ใน Firebase RTDB ชั่วคราว (เพราะเป็น game state ที่ต้อง real-time)
  const stateRef = useMemo(
    () => (userKey ? ref(db, `slots/${gameId}/${userKey}`) : null),
    [gameId, userKey]
  )

  // ✅ OPTIMIZED: ใช้ useRealtimeData สำหรับ hcoin listener (มี cache + throttle)
  const { data: hcoinData } = useRealtimeData<number>(
    embed?.creditRef || '',
    {
      cacheKey: embed?.creditRef ? `hcoin:${embed.creditRef}` : undefined,
      cacheTTL: 60000, // 1 minute cache
      throttleMs: 200, // Throttle 200ms
      enabled: !!embed?.creditRef
    }
  )

  const [credit, setCredit] = useState<number>(Number(cfg.startCredit ?? 0))
  const [bet, setBet] = useState<number>(Math.max(1, Number(embed?.startBet ?? cfg.startBet ?? 1)))
  const [awarded, setAwarded] = useState<boolean>(false)

  const [spinning, setSpinning] = useState(false)
  const [lastPayout, setLastPayout] = useState(0)
  const [msg, setMsg] = useState('กรอกยูสเซอร์เพื่อเริ่มเล่น')
  const [lastTier, setLastTier] = useState<Tier>('none')
  const [creditDelta, setCreditDelta] = useState(0)
  const [reelWins, setReelWins] = useState<[boolean, boolean, boolean]>([false,false,false])
  const [reelEffects, setReelEffects] = useState<[string|null, string|null, string|null]>([null,null,null])

  const [autoOpen, setAutoOpen] = useState(false)
  const [autoActive, setAutoActive] = useState(false)
  const [autoTotal, setAutoTotal] = useState(0)
  const [autoLeft, setAutoLeft]   = useState(0)
   const shownCredit = (typeof displayCredit === 'number') ? displayCredit : credit
  const autoActiveRef = useRef(false)
  const autoLeftRef   = useRef(0)
  const creditRef     = useRef(credit)
  const betRef        = useRef(bet)
  // เพิ่ม
  const spinningRef = React.useRef(false)
  useEffect(() => { spinningRef.current = spinning }, [spinning])

  useEffect(()=>{ autoActiveRef.current = autoActive },[autoActive])
  useEffect(()=>{ autoLeftRef.current   = autoLeft },[autoLeft])
  useEffect(()=>{ creditRef.current     = credit },[credit])
  useEffect(()=>{ betRef.current        = bet },[bet])

  /* ---------- โหลดรูปและ index เริ่ม ---------- */
  useEffect(() => {
    let alive = true
    const load = (src: string) =>
      new Promise<void>(res => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = src })
    ;(async ()=>{
      await Promise.all(symbols.map(load))
      if (!alive) return
      const rnd = () => Math.floor(Math.random() * symbols.length)
      reelRef0.current?.setInstant(rnd())
      reelRef1.current?.setInstant(rnd())
      reelRef2.current?.setInstant(rnd())
    })()
    return () => { alive = false }
  }, [symbols])

  // ✅ OPTIMIZED: อัพเดท credit จาก hcoinData (ใช้ useRealtimeData แทน onValue)
  useEffect(() => {
    if (hcoinData !== null && creditRefEmbedPath) {
      const v = Number(hcoinData ?? 0)
      const n = Number.isFinite(v) ? v : 0
      setCredit(n)
      creditRef.current = n
    }
  }, [hcoinData, creditRefEmbedPath])

  /* ---------- โหลดสถานะเริ่มต้น ---------- */
  useEffect(() => {
    ;(async () => {
      if (!userKey) { setMsg('กรอกยูสเซอร์เพื่อเริ่มเล่น'); return }

      // โหลดค่า BET/awarded จาก stateRef (ยังเก็บไว้เหมือนเดิม)
      if (stateRef) {
        try {
          const snap = await get(stateRef)
          const state = snap.val() || {
            bet: Math.max(1, Number(embed?.startBet ?? cfg.startBet ?? 1)),
            awarded: false,
            credit: Number(cfg.startCredit ?? 0),
          }
             if (!creditRefEmbedPath) {
          const creditInit = Number(state.credit ?? cfg.startCredit ?? 0)
          setCredit(creditInit)
          creditRef.current = creditInit
        }
          setBet(Math.max(1, Number(state.bet || embed?.startBet || cfg.startBet || 1)))
          setAwarded(!!state.awarded)
        } catch {}
      }

      setMsg('พร้อมเล่นแล้ว กด SPIN ได้เลย')
    })()
  }, [userKey, stateRef, creditRefEmbedPath, embed?.startBet, cfg.startBet, cfg.startCredit])

  /* ---------- AUTO loop ---------- */
  useEffect(() => {
  if (!autoActive) return;
  let stopped = false;

  (async () => {
    while (!stopped && autoActiveRef.current) {
      if (autoLeftRef.current <= 0) break;
      if (creditRef.current < betRef.current) { 
        setMsg('เครดิตไม่พอสำหรับ AUTO'); 
        break; 
      }
      if (spinningRef.current) { 
        await new Promise(r => setTimeout(r, 80)); 
        continue; 
      }
      await onSpin({ fromAuto: true });
      await new Promise(r => setTimeout(r, 300));
    }
    stopAuto();
  })();

  return () => { stopped = true; };
}, [autoActive]);
// ชี้ว่ารีลไหน "ชนะ" จากผล 3 ช่อง (ใช้ซ้ำได้)
const winningIndexesFromRoll = (r: number[]): number[] => {
  const [a,b,c] = r
  if (a === b && b === c) return [0,1,2]
  if (a === b && a !== c) return [0,1]
  if (a === c && a !== b) return [0,2]
  if (b === c && b !== a) return [1,2]
  return []
}

// เอฟเฟ็กต์ตอน "เริ่มหมุน"
const playStartEffect = () => {
  setReelEffects(['eff-spin-start','eff-spin-start','eff-spin-start'])
  // ปล่อยให้แอนิเมชันเปิดสั้นๆ แล้วเคลียร์
  setTimeout(() => setReelEffects([null,null,null]), 380)
}

// เอฟเฟ็กต์ตอน "จบการหมุนทั้งหมด" (รวมรีสปิน)
const playEndEffect = () => {
  setReelEffects(['eff-spin-end','eff-spin-end','eff-spin-end'])
  setTimeout(() => setReelEffects([null,null,null]), 380)
}


  /* ---------- random / payout helpers ---------- */
  const pickTierByChance = (): Tier => {
    const order: Exclude<Tier,'none'>[] = ['slot1_triple','other_triple','slot1_pair','other_pair']
    const chances = order.map(t => Math.max(0, Math.min(100, (winTiers as any)[t].chancePct)))
    const sum = chances.reduce((a,b)=>a+b,0)
    const losePct = Math.max(0, 100 - sum)
    let r = Math.random() * (sum + losePct)
    if (r >= sum) return 'none'
    for (let i = 0; i < order.length; i++) {
      if (r < chances[i]) return order[i]
      r -= chances[i]
    }
    return 'none'
  }

  function makeRollForTier(tier: Tier): number[] {
    const N = symbols.length
    const nonZero = Array.from({ length: Math.max(0, N - 1) }, (_, i) => i + 1)
    const randomPairPos = () => {
      const odd = Math.floor(Math.random() * 3)
      return { pairPos: [0,1,2].filter(p => p !== odd), oddPos: odd }
    }
    if (tier === 'slot1_triple') return [0,0,0]
    if (tier === 'slot1_pair') {
      const { pairPos, oddPos } = randomPairPos()
      const odd = nonZero[Math.floor(Math.random()*nonZero.length)] || 1
      const arr = [odd, odd, odd]
      arr[pairPos[0]] = 0; arr[pairPos[1]] = 0; arr[oddPos] = odd
      return arr
    }
    if (tier === 'other_triple') {
      const sym = nonZero[Math.floor(Math.random()*nonZero.length)] || 1
      return [sym,sym,sym]
    }
    if (tier === 'other_pair') {
      const sym = nonZero[Math.floor(Math.random()*nonZero.length)] || 1
      const rest = nonZero.filter(i => i !== sym)
      const odd  = rest.length ? rest[Math.floor(Math.random()*rest.length)] : 0
      const { pairPos, oddPos } = randomPairPos()
      const arr = [odd, odd, odd]
      arr[pairPos[0]] = sym; arr[pairPos[1]] = sym; arr[oddPos] = odd
      return arr
    }
    const pool = Array.from({ length: N }, (_, i) => i)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const r = pool.slice(0,3)
    return r.length === 3 ? r : [0,1,2]
  }

  const payoutForTier = (tier: Tier, betVal: number) => {
    if (tier === 'none') return 0
    const mult = Math.max(0, (winTiers as any)[tier].mult)
    const raw = betVal * mult
    if (raw <= 0) return 0
    const rounded = Math.round(raw)
    return Math.max(1, rounded)
  }

  const tierFromRoll = (r: number[]): Tier => {
  const [a, b, c] = r;
  if (a === b && b === c) return a === 0 ? 'slot1_triple' : 'other_triple';
  if (a === b || a === c || b === c) {
    const v = (a === b) ? a : (a === c ? a : b);
    return v === 0 ? 'slot1_pair' : 'other_pair';
  }
  return 'none';
};

  /* ---------- AUTO controls ---------- */
function startAuto(n: number) {
  if (!userKey || !stateRef) return;
  if (creditRef.current < betRef.current) {
    setMsg('เครดิตไม่พอสำหรับ AUTO'); 
    return;
  }
  // ตั้งค่าที่ ref ก่อน เพื่อให้ลูปเห็นค่าถูกต้องตั้งแต่รอบแรก
  autoActiveRef.current = true;
  autoLeftRef.current   = n;

  setAutoTotal(n);
  setAutoLeft(n);
  setAutoActive(true);
  setAutoOpen(false);
}

function stopAuto() {
  autoActiveRef.current = false;
  autoLeftRef.current   = 0;
  setAutoActive(false);
  setAutoLeft(0);
  setAutoOpen(false);
}



  /* ---------- คว้าโค้ด (โหมดเกมเดิม) — ข้ามในโหมดฝัง ---------- */
  async function tryAwardCodeAndResetCredit() {
    if (embed?.creditRef) return  // ⬅️ โหมดฝัง: ไม่ยุ่งเรื่องโค้ด/รีเซ็ตเครดิต
    if (awarded || !userKey) return
    const target = Number(cfg?.targetCredit || 0)
    if (!target || credit < target) return
    // ✅ ใช้ PostgreSQL 100% - ใช้ claimCode แทน claimedCount transaction
    const result = await postgresqlAdapter.claimCode(gameId, userKey)
    if (result === 'EMPTY' || result === null) {
      alert('โค้ดเต็มแล้วน้า รอบติดตามรอบต่อไปค่ะ'); return
    }
    if (result === 'ALREADY') {
      // เคยได้โค้ดไปแล้ว - ดึงโค้ดเดิมมาแสดง
      const existingAnswers = await postgresqlAdapter.getAnswers(gameId, 100)
      const userAnswer = existingAnswers
        .filter((a: any) => a.userId === userKey && a.code)
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
      if (userAnswer?.code) {
        const assignedCode = userAnswer.code
        const now = Date.now()
        // ✅ ใช้ PostgreSQL 100%
        await postgresqlAdapter.submitAnswer(
          gameId,
          userKey,
          `slot:awarded=${assignedCode},credit=${Number(credit).toFixed(2)}`,
          true,
          assignedCode
        )
        if (stateRef) await set(stateRef, { credit: 0, bet, awarded: true })
        setCredit(0); setAwarded(true)
        alert(`ยินดีด้วย! ได้รับโค้ด\n${assignedCode}`)
        return
      }
      alert('โค้ดเต็มแล้วน้า รอบติดตามรอบต่อไปค่ะ'); return
    }
    // ✅ ได้โค้ดใหม่
    const assignedCode = result
    const now = Date.now()
    // ✅ ใช้ PostgreSQL 100%
    await postgresqlAdapter.submitAnswer(
      gameId,
      userKey,
      `slot:awarded=${assignedCode},credit=${Number(credit).toFixed(2)}`,
      true,
      assignedCode
    )
    if (stateRef) await set(stateRef, { credit: 0, bet, awarded: true })
    setCredit(0); setAwarded(true)
    alert(`ยินดีด้วย! ได้รับโค้ด\n${assignedCode}`)
  }

  async function recordSpin(roll: number[], payout: number, creditAfter: number) {
    const ts = Date.now()
    // ✅ ใช้ PostgreSQL 100% (log as answer)
    await postgresqlAdapter.submitAnswer(
      gameId,
      userKey,
      `slot:spin=roll[${roll.join(',')}],bet=${bet},payout=${payout},credit=${creditAfter}`,
      false
    )
    return ts
  }

  /* ---------- SPIN ---------- */
  async function onSpin(opts?: { fromAuto?: boolean }) {
    if (spinning || !userKey) return
    if (!stateRef) return

    const betNow = betRef.current
    const curCredit = creditRef.current
    if (curCredit < betNow) { setMsg('เครดิตไม่พอ กรุณาลด BET หรือเติมเครดิต'); return }

    setSpinning(true); setMsg(''); setLastPayout(0); setLastTier('none')
    setReelWins([false,false,false]); setReelEffects([null,null,null])
    playStartEffect()

    /* --- หักเครดิต (embed = PostgreSQL hcoin / ปกติ = slots state) --- */
    let newCredit = curCredit - betNow
    if (creditRefEmbedPath && creditRefUserId) {
      // ✅ ใช้ PostgreSQL 100% - หัก hcoin
      try {
        const result = await postgresqlAdapter.addUserCoins(creditRefUserId, -betNow, false)
        if (!result.success) {
          setMsg('เครดิตไม่พอ'); setSpinning(false); return
        }
        newCredit = result.newBalance || 0
      } catch (error) {
        console.error('Error deducting coins:', error)
        setMsg('เครดิตไม่พอ'); setSpinning(false); return
      }
    } else {
      // ✅ เก็บ stateRef ไว้ใน Firebase RTDB ชั่วคราว (เพราะเป็น game state)
      await set(stateRef, { credit: newCredit, bet: betNow, awarded })
    }
    setCreditDelta(0)
    setCredit(newCredit); creditRef.current = newCredit

    /* --- สุ่มผล + หมุน --- */
    const rollTier = pickTierByChance()
    const roll = makeRollForTier(rollTier)
    const winAmount = payoutForTier(rollTier, betNow)

    const extra0 = 12, extra1 = 13, extra2 = 14
    const d0 = 1500, d1 = 1650, d2 = 1800
    const p0 = reelRef0.current?.spinTo(roll[0], extra0, d0) ?? Promise.resolve()
    const p1 = new Promise<void>((res) =>
      setTimeout(() => (reelRef1.current?.spinTo(roll[1], extra1, d1) ?? Promise.resolve()).then(res), 110)
    )
    const p2 = new Promise<void>((res) =>
      setTimeout(() => (reelRef2.current?.spinTo(roll[2], extra2, d2) ?? Promise.resolve()).then(res), 220)
    )
    await Promise.all([p0, p1, p2])

    /* --- ไฮไลต์รีล --- */
    const winningIdx = (() => {
      const [a,b,c] = roll
      if (a===b && b===c) return [0,1,2]
      if (a===b && a!==c) return [0,1]
      if (a===c && a!==b) return [0,2]
      if (b===c && b!==a) return [1,2]
      return []
    })()
    if (winningIdx.length) {
      const wins: [boolean,boolean,boolean] = [false,false,false]
      winningIdx.forEach(i => { wins[i] = true })
      setReelWins(wins)
      const eff: [string|null,string|null,string|null] = [null,null,null]
      winningIdx.forEach(i => { eff[i] = 'eff-bounce eff-blink' })
      setReelEffects(eff); setTimeout(() => setReelEffects([null,null,null]), 1000)
    } else {
      setReelWins([false,false,false])
      setReelEffects(['eff-shake','eff-shake','eff-shake'])
      setTimeout(() => setReelEffects([null,null,null]), 350)
    }

    /* --- สรุปผลเครดิต --- */
    setLastTier(rollTier)
    if (winAmount > 0) {
      let after = newCredit + winAmount
      if (creditRefEmbedPath && creditRefUserId) {
        // ✅ ใช้ PostgreSQL 100% - เพิ่ม hcoin
        try {
          const result = await postgresqlAdapter.addUserCoins(creditRefUserId, winAmount, false)
          after = result.newBalance || after
        } catch (error) {
          console.error('Error adding coins:', error)
          // ใช้ค่า after ที่คำนวณไว้
        }
      } else {
        // ✅ เก็บ stateRef ไว้ใน Firebase RTDB ชั่วคราว (เพราะเป็น game state)
        await set(stateRef, { credit: after, bet: betNow, awarded })
      }
      setCredit(after); creditRef.current = after
      setLastPayout(winAmount)
      setMsg(''); setCreditDelta(winAmount); setTimeout(() => setCreditDelta(0), 1600)
    } else {
      setMsg(''); setLastPayout(0); setCreditDelta(0)
    }

    await recordSpin(roll, winAmount, creditRef.current)
    // ====== รีสปินฟรีต่อเนื่อง "เฉพาะรีลที่ชนะ" จนกว่าจะไม่ชนะ ======
      {
        let curRoll = [...roll]
        let curWinning = [...winningIdx]
        let guard = 10 // กันลูปยาวเกินไป (ปรับได้)

        while (curWinning.length && guard-- > 0) {
          // สุ่มผลใหม่ (ทั้ง 3 ช่อง) แล้วใช้เฉพาะรีลที่ชนะให้หมุนต่อ
          const tierNext = pickTierByChance()
          const nextRollFull = makeRollForTier(tierNext)
          const target = [...curRoll]
          curWinning.forEach(i => { target[i] = nextRollFull[i] })

          // หมุนเฉพาะรีลที่ชนะ (สั้นกว่ารอบปกติ)
          const rx = [6,7,8]
          const rd = [900,1000,1100]
          const tasks: Promise<void>[] = []
          if (curWinning.includes(0) && reelRef0.current) tasks.push(reelRef0.current.spinTo(target[0], rx[0], rd[0]))
          if (curWinning.includes(1) && reelRef1.current) tasks.push(reelRef1.current.spinTo(target[1], rx[1], rd[1]))
          if (curWinning.includes(2) && reelRef2.current) tasks.push(reelRef2.current.spinTo(target[2], rx[2], rd[2]))
          await Promise.all(tasks)

          // อัปเดตผลล่าสุด
          curRoll = target

          // ไฮไลต์รีลที่ชนะในผลใหม่
          const winIdx2 = winningIndexesFromRoll(curRoll)
          if (winIdx2.length) {
            const wFlags: [boolean,boolean,boolean] = [false,false,false]
            winIdx2.forEach(i => { wFlags[i] = true })
            setReelWins(wFlags)
            const eff: [string|null,string|null,string|null] = [null,null,null]
            winIdx2.forEach(i => { eff[i] = 'eff-bounce eff-blink' })
            setReelEffects(eff)
            setTimeout(() => setReelEffects([null,null,null]), 1000)
          } else {
            setReelWins([false,false,false])
          }

          // จ่ายรางวัลรอบรีสปินฟรี (ไม่หักเครดิต/ไม่ลด AUTO)
          const tier2 = tierFromRoll(curRoll)
          const win2  = payoutForTier(tier2, betNow)
          if (win2 > 0) {
            let after2 = creditRef.current + win2
            if (creditRefEmbedPath && creditRefUserId) {
              // ✅ ใช้ PostgreSQL 100% - เพิ่ม hcoin
              try {
                const result = await postgresqlAdapter.addUserCoins(creditRefUserId, win2, false)
                after2 = result.newBalance || after2
              } catch (error) {
                console.error('Error adding coins:', error)
                // ใช้ค่า after2 ที่คำนวณไว้
              }
            } else {
              // ✅ เก็บ stateRef ไว้ใน Firebase RTDB ชั่วคราว (เพราะเป็น game state)
              await set(stateRef, { credit: after2, bet: betNow, awarded })
            }
            setCredit(after2); creditRef.current = after2
            setLastPayout(prev => prev + win2)
            setMsg(''); setCreditDelta(win2); setTimeout(() => setCreditDelta(0), 1600)

            // บันทึกประวัติของรีสปินฟรี
            await recordSpin(curRoll, win2, creditRef.current)
          }

          // ตัดสินใจว่าจะรีสปินฟรีต่อไหม: ใช้ “รีลที่ชนะในผลล่าสุด”
          curWinning = winningIndexesFromRoll(curRoll)
        }
      }
    await logSlotPlayLast(
      slotAnswersId(gameId),
      userKey,
      { bet: betNow, balanceBefore: curCredit, balanceAfter: creditRef.current }
    )

    await tryAwardCodeAndResetCredit()
    playEndEffect()
    setSpinning(false)

    if (opts?.fromAuto) setAutoLeft(v => Math.max(0, v - 1))
  }

  /* ---------- ปุ่มคลิก ---------- */
  const onSpinClick: React.MouseEventHandler<HTMLButtonElement> = (e) => { e.preventDefault(); void onSpin() }
  const onAutoToggleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => { e.preventDefault(); autoActive ? stopAuto() : setAutoOpen(v => !v) }
  const onAutoSelect = (n: number) => () => startAuto(n)
  const onBetMinusClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => { e.preventDefault(); if (!stateRef || bet <= 1) return; const v = Math.max(1, bet - 1); setBet(v); await set(stateRef, { ...(embed ? {} : { credit }), bet: v, awarded }) }
  const onBetPlusClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => { e.preventDefault(); if (!stateRef) return; const v = bet + 1; setBet(v); await set(stateRef, { ...(embed ? {} : { credit }), bet: v, awarded }) }

  const autoPanelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!autoOpen) return
    const onDocClick = (ev: MouseEvent) => {
      const root = autoPanelRef.current
      if (!root) return
      if (!root.contains(ev.target as Node)) setAutoOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [autoOpen])

  /* ---------- UI ---------- */
  return (
    <div className=" ">
      <div style={{ marginBottom: 12 }}>
        <UserBar username={userKey || '-'} credit={shownCredit}  className="userbar--blackgold"/>
      </div>

      <div className="slot-card">
        <div className="slot-card-head">
          <span className="win-label">WIN : </span>
          <span className={`win-amount ${lastPayout > 0 ? 'pos' : 'zero'}`}>
            {lastPayout > 0 ? `+${lastPayout.toLocaleString()}` : '+0'}
          </span>
        </div>

        <div className="slot-card-reels">
          <div className="reels">
            <Reel ref={reelRef0} symbols={symbols} highlight={reelWins[0]} effectClass={reelEffects[0] || ''} />
            <Reel ref={reelRef1} symbols={symbols} highlight={reelWins[1]} effectClass={reelEffects[1] || ''} />
            <Reel ref={reelRef2} symbols={symbols} highlight={reelWins[2]} effectClass={reelEffects[2] || ''} />
          </div>
        </div>

        <div className={`slot-msg ${lastPayout > 0 ? 'win' : ''}`}>
          {userKey ? msg : 'กรุณากรอกยูสเซอร์เพื่อเริ่มเล่น'}
        </div>

        {/* SPIN + AUTO */}
        <div className="slot-controls slot-controls--with-auto">
          <button
            className={`btnx btnx--spin ${spinning ? 'is-loading' : ''}`}
            onClick={onSpinClick}
            disabled={spinning || !userKey || autoActive}
          >
            {autoActive ? `${autoLeft}` : (spinning ? '...' : 'SPIN')}
          </button>

          <div className="auto-wrap">
            <button
              className={`btnx btnx--auto ${autoActive ? 'is-active' : ''}`}
              onClick={onAutoToggleClick}
              disabled={!userKey}
            >
              {autoActive ? 'STOP AUTO' : 'AUTO'}
            </button>

            {autoOpen && !autoActive && (
              <div className="auto-panel" ref={autoPanelRef}>
                {[10, 30, 50, 100].map(n => (
                  <button key={n} className="auto-opt" onClick={onAutoSelect(n)}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BET bar */}
        <div className="betbar" role="group" aria-label="Total bet">
          <button
            className={`betbar-btn betbar-btn--minus ${(spinning || !userKey || bet <= 1) ? 'is-disabled' : ''}`}
            onClick={onBetMinusClick}
            disabled={spinning || !userKey || bet <= 1}
            aria-label="Decrease bet"
          >
            −
          </button>

          <div className="betbar-value">{bet}</div>

          <button
            className={`betbar-btn betbar-btn--plus ${(spinning || !userKey) ? 'is-disabled' : ''}`}
            onClick={onBetPlusClick}
            disabled={spinning || !userKey}
            aria-label="Increase bet"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
