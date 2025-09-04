import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../services/firebase'
import { ref, push, set, update, get, remove, onValue } from 'firebase/database'
import PrettySelect from '../components/PrettySelect'
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'

// ใช้ชนิดเกมแบบเดิม
type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'
  | 'เกมประกาศรางวัล'

type SlotCfg = { startCredit: number; startBet: number; winRate: number; targetCredit: number }
type AnswerRow = {
  ts: number
  user?: string
  answer?: string
  correct?: boolean
  code?: string
}

// ==== Usage types (admin report for CheckinGame) ====



// ✅ เพิ่ม date (YYYY-MM-DD) สำหรับกำหนดวันที่ที่อนุญาตให้เช็คอินวันนั้น
type CheckinReward = { kind: 'coin' | 'code'; value: number | string; date?: string }
type CouponTier = { title?: string; rewardCredit: number; price: number; codes: string[] }


const normalizeUser = (s: string) => (s || '').trim().replace(/\s+/g, '')
const clean = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

const num = (v: any, d = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}

const gameTypes: GameType[] = [
  'เกมทายภาพปริศนา',
  'เกมทายเบอร์เงิน',
  'เกมทายผลบอล',
  'เกมสล็อต',
  'เกมเช็คอิน',
  'เกมประกาศรางวัล',
]

// ---------- ประเภทที่ "ต้องมีรูปภาพ" ----------
const NEED_IMAGE = new Set<GameType>([
  'เกมทายภาพปริศนา',
  'เกมทายเบอร์เงิน',
  'เกมทายผลบอล',
])
const needImage = (t: GameType) => NEED_IMAGE.has(t)

// util: File → dataURL
const fileToDataURL = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })

// helper: timestamp → ค่าที่ใส่ใน input type="datetime-local"
const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (ts?: number | null) => {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function CreateGame() {
  const nav = useNavigate()
  const { id: routeId } = useParams()
  const isEdit = !!routeId
  const gameId = routeId || ''

  // ====== state ของ "หน้าเดิม" ======
  const [type, setType] = React.useState<GameType>('เกมทายภาพปริศนา')
  const [name, setName] = React.useState('')
  const [imageDataUrl, setImageDataUrl] = React.useState<string>('')
  const [fileName, setFileName] = React.useState('')
  // state เก็บผู้ที่เคยรับโค้ด (ใช้เป็น fallback เวลา infer คำตอบถูก)
  const [claimedBy, setClaimedBy] = React.useState<Record<string, { code?: string }>>({})

  // เฉพาะเกมทายภาพ
  const [answer, setAnswer] = React.useState('')

  // โค้ดแจก (ใช้ในเกมทายภาพ)
  const [numCodes, setNumCodes] = React.useState(1)
  const [codes, setCodes] = React.useState<string[]>([''])

  // ปลดล็อก (ค่าเริ่มต้น ปลดล็อกเสมอ)
  const [unlocked, setUnlocked] = React.useState(true)

  // เฉพาะเกมทายผลบอล / เบอร์เงิน
  const [homeTeam, setHomeTeam] = React.useState('')
  const [awayTeam, setAwayTeam] = React.useState('')
  const [endAt, setEndAt] = React.useState<string>('') // datetime-local string
  const [resetCodeRound, setResetCodeRound] = React.useState(false);

  // ===== เช็คอิน
  const [checkinDays, setCheckinDays] = React.useState(7)
  // ✅ เพิ่ม date ค่าเริ่มต้นเป็นว่าง
  const [rewards, setRewards] = React.useState<CheckinReward[]>(
    Array.from({ length: 7 }).map(() => ({ kind: 'coin', value: 1000, date: '' }))
  )
  // ตั้งค่า SLOT ภายใน "เกมเช็คอิน"
  const [checkinSlot, setCheckinSlot] = React.useState({ startBet: 1, winRate: 30 })
  const [couponCount, setCouponCount] = React.useState(1);
  const [couponItems, setCouponItems] = React.useState<CouponTier[]>(
    Array.from({ length: 1 }).map((_, i) => ({
      title: '',
      rewardCredit: [50][i] ?? 5000,
      price:        [10,50,100,200,300,500][i] ?? 10,
      codes: [''],
    }))
  );
// ===== รายงานการใช้งาน (หน้าเกมเช็คอิน) =====
const [allUsers, setAllUsers] = React.useState<UserBalanceRow[]>([])
const [logCheckin, setLogCheckin] = React.useState<UsageLog[]>([])
const [logSlot, setLogSlot] = React.useState<UsageLog[]>([])
const [logCoupon, setLogCoupon] = React.useState<UsageLog[]>([])

// รายชื่อผู้ได้รับรางวัลจาก CSV (อ่านเฉพาะคอลัมน์แรก col=0 ตั้งแต่แถว1)
const [announceUsers, setAnnounceUsers] = React.useState<string[]>([])


const parseUsersFirstCol = (text: string) => {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    // แยก CSV แบบง่ายพอสำหรับคอลัมน์แรก (รองรับคอมมา/เซมิโคลอน/แท็บ)
    const cell0 = line.split(/[,;\t]/)[0] ?? ''
    const s = cell0.trim()
    if (s) out.push(s)
  }
  // unique แบบคงลำดับ
  const seen = new Set<string>(), uniq: string[] = []
  for (const u of out) if (!seen.has(u)) { seen.add(u); uniq.push(u) }
  return uniq
}

async function importAnnounceUsers(file?: File) {
  if (!file) return
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text()
    const users = parseUsersFirstCol(text)
    if (!users.length) { alert('ไม่พบ USER ในคอลัมน์แรก'); return }
    setAnnounceUsers(users)
    alert(`นำเข้า USER ${users.length} รายการ`)
    return
  }
  // .xlsx (ถ้ามี SheetJS ติดตั้ง)
  const XLSX = (window as any).XLSX
  if (!XLSX) { alert('ไฟล์ .xlsx ต้องมีไลบรารี XLSX หรือแปลงเป็น .csv'); return }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { type:'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
  const list: string[] = []
  for (let r = 0; r < rows.length; r++) {
    const cell0 = (rows[r]?.[0] ?? '').toString().trim()
    if (cell0) list.push(cell0)
  }
  const seen = new Set<string>(), uniq: string[] = []
  for (const u of list) if (!seen.has(u)) { seen.add(u); uniq.push(u) }
  if (!uniq.length) { alert('ไม่พบ USER ในคอลัมน์แรก'); return }
  setAnnounceUsers(uniq)
  alert(`นำเข้า USER ${uniq.length} รายการ`)
}


const fmtNum = (n?: number) =>
  Number(n ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })

// ชื่อคูปองจาก index ใน shop ปัจจุบัน
const couponNameByIndex = (idx?: number) => {
  const i = Number(idx)
  const it = Number.isFinite(i) ? couponItems[i] : undefined
  if (!it) return '-'
  const title = (it.title || '').trim()
  if (title) return title
  const credit = Number(it.rewardCredit || 0)
  return `x${credit.toLocaleString('th-TH')}`
}

// fallback: หา index จาก CODE ที่ได้รับ (ถ้า log ยังไม่เก็บ itemIndex)
const findCouponIndexByCode = (code?: string) => {
  if (!code) return -1
  const c = String(code).trim()
  for (let i = 0; i < couponItems.length; i++) {
    const codes = couponItems[i]?.codes || []
    if (codes.some(x => String(x).trim() === c)) return i
  }
  return -1
}

// ชื่อคูปองจากแถว log
const couponNameFromLog = (r: UsageLog) => {
  let idx = Number.isFinite(r.itemIndex) ? Number(r.itemIndex) : -1
  if (idx < 0) idx = findCouponIndexByCode(r.code)
  return couponNameByIndex(idx)
}



  // เฉพาะเกมสล็อต
  const [slot, setSlot] = React.useState<SlotCfg>({
    startCredit: 100,
    startBet: 1,
    winRate: 30,
    targetCredit: 200,
  })

  // ====== โซนล่าง (ตามรูป) ======
  const [answers, setAnswers] = React.useState<AnswerRow[]>([])

    type UsageLog = {
    ts: number
    user: string
    action: 'checkin' | 'slot' | 'coupon-redeem'
    amount?: number        // ได้เหรียญ (checkin) / ผลสุทธิสล็อต (+/-)
    price?: number         // ราคาที่ใช้แลกคูปอง
    itemIndex?: number     // แถวคูปอง (เริ่ม 0)
    bet?: number           // เบทสล็อต
    balanceBefore?: number
    balanceAfter?: number
    dayIndex?: number  
    code?: string 
  }

  type UserBalanceRow = { user: string; hcoin: number }

// ===== Helpers: นำเข้า CODE จาก Excel/CSV (ดึงทุกคอลัมน์/ทุกบรรทัด + คงลำดับ) =====
const uniqKeepOrder = (arr: string[]) => {
  const seen = new Set<string>(), out: string[] = [];
  for (const raw of arr) {
    const s = (raw ?? '').toString().trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

// แยกบรรทัด CSV เป็นเซลล์ (รองรับ "..." )
const splitCsvLine = (line: string) => {
  const out: string[] = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (!q && (ch === ',' || ch === ';' || ch === '\t')) { out.push(cur); cur=''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
};

// คำที่ถือว่าเป็นหัวตาราง
const isHeader = (s: string) => /^code$/i.test(s) || /โค้ด/i.test(s) || /coupon/i.test(s);

// แยกโค้ดหลายตัวที่อยู่ในเซลล์เดียว (เช่น มีขึ้นบรรทัด/คอมมา/เซมิโคลอน/ช่องว่าง)
const splitCellCodes = (v: string) =>
  (v ?? '')
    .toString()
    .split(/[\r\n,;|\t ]+/)   // แยกด้วย newline, comma, semicolon, tab, space
    .map(s => s.trim())
    .filter(Boolean);

// ✅ ดึงโค้ดจาก "ทุกเซลล์" ของชีต (ซ้าย→ขวา, บน→ล่าง) และคงลำดับ
const extractCodesFromRows = (rows: any[][]): string[] => {
  if (!rows?.length) return [];
  const codes: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const s = (cell ?? '').toString().trim();
      if (!s) continue;
      // ข้ามหัวตารางเฉพาะแถวแรก
      if (r === 0 && isHeader(s)) continue;
      const parts = splitCellCodes(s);
      if (parts.length) codes.push(...parts);
    }
  }
  return uniqKeepOrder(codes);
};

async function parseCodesFromFile(file: File): Promise<string[]> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean).map(splitCsvLine);
    return extractCodesFromRows(rows);
  }

  // .xlsx/.xls ใช้ SheetJS (XLSX) ถ้ามี
  const XLSX = (window as any).XLSX;
  if (!XLSX) throw new Error('ไฟล์ .xlsx/.xls ต้องมีไลบรารี SheetJS (XLSX) หรือแปลงเป็น .csv');

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  return extractCodesFromRows(rows);
}

async function importCodesForRow(rowIndex: number, file?: File) {
  if (!file) return;
  const codes = await parseCodesFromFile(file);
  if (!codes.length) { alert('ไม่พบ CODE ในไฟล์'); return; }

  setCouponItems(prev => {
    const next = [...prev];
    // ถ้าต้องการ "ต่อท้าย" กับของเดิม ให้ใช้ merged แทน:
    // const merged = uniqKeepOrder([...(next[rowIndex]?.codes || []), ...codes]);
    next[rowIndex] = { ...next[rowIndex], codes }; // หรือใช้ merged
    return next;
  });

  alert(`นำเข้า CODE ${codes.length} รายการให้แถวที่ ${rowIndex + 1} แล้ว`);
}


  // โหลด ALL USER + HENGCOIN คงเหลือ
React.useEffect(() => {
  const off = onValue(ref(db, 'USERS_EXTRA'), (s) => {
    const v = s.val() || {}
    const rows: UserBalanceRow[] = Object.keys(v).map((u: string) => ({
      user: u,
      hcoin: Number(v[u]?.hcoin ?? 0),
    }))
    rows.sort((a, b) => b.hcoin - a.hcoin)
    setAllUsers(rows)
  })
  return () => off()
}, [])
// โหลด LOG จาก answers/{gameId} แล้วแยกเป็น 3 หมวด
React.useEffect(() => {
  // isEdit / gameId มักมีอยู่แล้วในหน้า CreateGame ของคุณ
  // ถ้าไม่มี isEdit ให้ลบเงื่อนไขนี้ออก
  const off = onValue(ref(db, `answers/${gameId}`), (s) => {
    const v = s.val() || {}
    const rows: UsageLog[] = Object.keys(v).map((k: string) => ({
      ts: Number(k) || 0,
      user: String(v[k]?.user ?? v[k]?.username ?? ''),
      action: v[k]?.action,
      amount: Number(v[k]?.amount ?? NaN),
      price: Number(v[k]?.price ?? NaN),
      itemIndex: Number(v[k]?.itemIndex ?? NaN),
      bet: Number(v[k]?.bet ?? NaN),
      balanceBefore: Number(v[k]?.balanceBefore ?? NaN),
      balanceAfter: Number(v[k]?.balanceAfter ?? NaN),
      dayIndex: Number(v[k]?.dayIndex ?? NaN), 
      code: typeof v[k]?.code === 'string' ? String(v[k].code) : undefined,
    })).filter((r) => !!r.action && !!r.ts)

    rows.sort((a, b) => b.ts - a.ts)
    setLogCheckin(rows.filter((r) => r.action === 'checkin'))
    setLogCoupon(rows.filter((r) => r.action === 'coupon-redeem'))
  })
  return () => off()
}, [gameId])

// โหลด "สล็อตล่าสุดต่อ USER" จาก answers_last/<gameId>/slot
React.useEffect(() => {
  const off = onValue(ref(db, `answers_last/${gameId}/slot`), (s) => {
    const v = s.val() || {}
    const rows: UsageLog[] = Object.keys(v).map((u: string) => ({
      ts: Number(v[u]?.ts || 0),
      user: u,
      action: 'slot',
      bet: Number(v[u]?.bet || 0),
      balanceBefore: Number(v[u]?.balanceBefore ?? NaN),
      balanceAfter: Number(v[u]?.balanceAfter ?? NaN),
    }))
    rows.sort((a,b)=> b.ts - a.ts)
    setLogSlot(rows)
  })
  return () => off()
}, [gameId])

// สรุปจำนวนวันเช็คอิน (นับจากประวัติ checkin ทั้งหมด) → { user: count }
const checkedCountByUser = React.useMemo(() => {
  const byUser = new Map<string, Set<number>>()
  for (const r of logCheckin) {
    if (!r.user) continue
    const d = Number(r.dayIndex || 0)
    if (!byUser.has(r.user)) byUser.set(r.user, new Set<number>())
    if (Number.isFinite(d) && d > 0) byUser.get(r.user)!.add(d)
  }
  const out: Record<string, number> = {}
  for (const [u, setDays] of byUser) out[u] = setDays.size
  return out
}, [logCheckin])

// รายชื่อผู้ที่เคยเช็คอินเกมนี้ (จาก logCheckin)
const checkinUsers = React.useMemo(() => {
  const st = new Set<string>()
  for (const r of logCheckin) {
    const u = normalizeUser(r.user || '')
    if (u) st.add(u)
  }
  return st
}, [logCheckin])

  
  // sync จำนวนช่อง CODE (เกมทายภาพ)
  React.useEffect(() => {
    setCodes((prev) => {
      const next = [...prev]
      if (numCodes > next.length) {
        while (next.length < numCodes) next.push('')
      } else {
        next.length = numCodes
      }
      return next
    })
  }, [numCodes])

  // โหลดข้อมูลเกมเมื่ออยู่โหมดแก้ไข (เพิ่ม setClaimedBy)
  React.useEffect(() => {
    if (!isEdit) return
    const r = ref(db, `games/${gameId}`)
    const off = onValue(r, (snap) => {
      const g = snap.val() || {}

      // map ค่าลง "หน้าเดิม"
      setType(g.type || 'เกมทายภาพปริศนา')
      setName(g.name || g.title || '')
      const computedUnlocked = Object.prototype.hasOwnProperty.call(g, 'locked')
        ? !g.locked
        : !!g.unlocked
      setClaimedBy(g.claimedBy || {})
      setUnlocked(computedUnlocked)

      if (g.puzzle) {
        setImageDataUrl(g.puzzle.imageDataUrl || '')
        setAnswer(g.puzzle.answer || '')
        const arr: string[] = Array.isArray(g.codes) ? g.codes : []
        setCodes(arr.length ? arr : [''])
        setNumCodes(Math.max(1, arr.length || 1))
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if (g.numberPick) {
        setImageDataUrl(g.numberPick.imageDataUrl || '')
        setEndAt(toLocalInput(g.numberPick.endAt))
        setAnswer(''); setCodes(['']); setNumCodes(1)
        setHomeTeam(''); setAwayTeam('')
      } else if (g.football) {
        setImageDataUrl(g.football.imageDataUrl || '')
        setHomeTeam(g.football.homeTeam || '')
        setAwayTeam(g.football.awayTeam || '')
        setEndAt(toLocalInput(g.football.endAt))
        setAnswer(''); setCodes(['']); setNumCodes(1)
      } else if (g.slot) {
        setSlot({
          startCredit: num(g.slot.startCredit, 100),
          startBet: num(g.slot.startBet, 1),
          winRate: num(g.slot.winRate, 30),
          targetCredit: num(g.slot.targetCredit, 200),
        })
        setImageDataUrl(''); setAnswer(''); setCodes(['']); setNumCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if (g.checkin) {
        // ✅ โหลดค่าเกมเช็คอิน (รวม date ถ้ามี)
        const gDays = Number(g.checkin?.days) || (Array.isArray(g.checkin?.rewards) ? g.checkin.rewards.length : 7)
        const d = clamp(gDays, 1, 30)

        const arr: CheckinReward[] = Array.from({ length: d }, (_, i) => {
          const r = g.checkin?.rewards?.[i]
          if (!r) return { kind: 'coin', value: 1000, date: '' }
          const kind: 'coin' | 'code' = r.kind === 'code' ? 'code' : 'coin'
          const value = kind === 'coin' ? Number(r.value) || 0 : String(r.value || '')
          const date  = (r.date && typeof r.date === 'string') ? r.date : '' // YYYY-MM-DD
          return { kind, value, date }
        })
        setCheckinSlot({
          startBet: num(g.checkin?.slot?.startBet, 1),
          winRate:  num(g.checkin?.slot?.winRate, 30),
        })

        const couponArr = g.checkin?.coupon?.items;
        if (Array.isArray(couponArr) && couponArr.length) {
          setCouponCount(couponArr.length);
          setCouponItems(
            couponArr.map((it: any) => ({
              title: typeof it?.title === 'string' ? it.title : '',
              rewardCredit: Number(it?.rewardCredit) || 0,
              price: Number(it?.price) || 0,
              codes: Array.isArray(it?.codes) ? it.codes : [''],
            }))
          );
        } else {
          setCouponCount(1);
          setCouponItems(Array.from({ length: 1 }).map((_, i) => ({
            title: '',
            rewardCredit: [5000,25000,50000,100000,165000,300000][i] ?? 5000,
            price:        [10,50,100,200,300,500][i] ?? 10,
            codes: [''],
          })));
        }
        setCheckinDays(d)
        setRewards(arr)

        // รีเซ็ต field ของประเภทอื่น
        setImageDataUrl('')
        setAnswer('')
        setCodes(['']); setNumCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else {
        // fallback
        setImageDataUrl(''); setAnswer(''); setCodes(['']); setNumCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      }
    })
    return () => off()
  }, [isEdit, gameId])

  // เวลาไทยแบบมีวินาที
  const fmtThai = (ts: number) =>
    new Date(ts).toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

  // ดาวน์โหลดเป็น .txt
  const downloadAnswers = () => {
    const header =
      `เกม: ${name || '-'}\nประเภท: ${type}\nลิงก์: ${location.origin}/?id=${gameId}\nรวมทั้งหมด: ${answers.length} รายการ\n\n`
    const body = answers
      .map((r, i) => `${i + 1}. ${fmtThai(r.ts)}\t${r.user || '-'}\t${r.answer ?? ''}`)
      .join('\n')

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `answers_${gameId}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // โหลดคำตอบผู้เล่น (เฉพาะตอนแก้ไข) + คำนวณถูก/ผิด + ดึงโค้ดเฉพาะตอนถูก
  const refreshAnswers = React.useCallback(async () => {
    if (!isEdit) return

    const snap = await get(ref(db, `answers/${gameId}`))
    const v = snap.val() || {}

    const rows: AnswerRow[] = Object.keys(v).map((k) => {
      const user = v[k]?.user ?? v[k]?.username ?? v[k]?.name ?? ''
      const ans  = v[k]?.answer ?? v[k]?.value ?? v[k]?.text ?? ''
      const isCorrect =
        type === 'เกมทายภาพปริศนา' ? (clean(ans) === clean(answer)) : undefined

      const code = isCorrect
        ? (v[k]?.code ?? claimedBy?.[normalizeUser(user)]?.code ?? undefined)
        : undefined

      return {
        ts: Number(k) || 0,
        user,
        answer: ans,
        correct: isCorrect,
        code,
      }
    })

    rows.sort((a, b) => b.ts - a.ts)
    setAnswers(rows)
  }, [isEdit, gameId, type, answer, claimedBy])

  React.useEffect(() => { refreshAnswers() }, [refreshAnswers])

  const onPickImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\//.test(f.type)) { alert('โปรดเลือกไฟล์รูปภาพ'); return }
    setFileName(f.name)
    const data = await fileToDataURL(f)
    setImageDataUrl(data)
  }

  // เงื่อนไขแสดง UI เฉพาะประเภท
  const showPuzzle = type === 'เกมทายภาพปริศนา'
  const showNumberPick = type === 'เกมทายเบอร์เงิน'
  const showFootball = type === 'เกมทายผลบอล'
  const showSlot = type === 'เกมสล็อต'
  const showCodes = showPuzzle
  const showImagePicker = needImage(type)
  const showCheckin = type === 'เกมเช็คอิน'

  // toggle ล็อก/ปลดล็อก
  const toggleUnlock = async (nextUnlocked: boolean) => {
    setUnlocked(nextUnlocked)
    if (isEdit) {
      try {
        await update(ref(db, `games/${gameId}`), {
          unlocked: nextUnlocked,
          locked: !nextUnlocked,
        })
      } catch {
        setUnlocked(!nextUnlocked)
        alert('อัปเดตสถานะล็อกไม่สำเร็จ')
      }
    }
  }

  // ===== submit =====
  const submit = async () => {
    if (!name.trim()) { alert('กรุณาระบุชื่อเกม'); return }
    if (needImage(type) && !imageDataUrl) { alert('ประเภทเกมนี้ต้องเลือกรูปภาพก่อน'); return }
    if (type === 'เกมทายภาพปริศนา' && !answer.trim()) {
      alert('กรุณากำหนดคำตอบที่ถูกต้อง'); return
    }

    const saveUnlocked = isEdit ? unlocked : true

    // payload พื้นฐาน
    const base: any = {
      type,
      name: name.trim(),
      unlocked: saveUnlocked,
      locked: !saveUnlocked,
      updatedAt: Date.now(),
    }

    if (type === 'เกมทายภาพปริศนา') {
      base.puzzle = { imageDataUrl, answer: answer.trim() }
      base.codes  = codes.map((c) => c.trim()).filter(Boolean)
      base.codeCursor = 0
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
    }

    if (type === 'เกมทายเบอร์เงิน') {
      base.numberPick = { imageDataUrl, endAt: endAt ? new Date(endAt).getTime() : null }
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
    }

    if (type === 'เกมทายผลบอล') {
      base.football = {
        imageDataUrl,
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        endAt: endAt ? new Date(endAt).getTime() : null,
      }
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.slot       = null
      base.checkin    = base.checkin || {}
    }

    if (type === 'เกมสล็อต') {
      base.slot = {
        startCredit: num(slot.startCredit, 0),
        startBet: num(slot.startBet, 1),
        winRate: num(slot.winRate, 0),
        targetCredit: num(slot.targetCredit, 0),
      }
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.checkin    = base.checkin || {}
    }

    if (type === 'เกมประกาศรางวัล') {
      base.announce = { users: announceUsers } // ⬅️ บันทึกคอลัมน์แรกทั้งก้อน
      // เคลียร์ field ประเภทอื่น ๆ กันค้าง
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
    }


    if (type === 'เกมเช็คอิน') {
      // ✅ ทำ rewards ให้สะอาดและมีเท่าที่กำหนดวัน (พร้อม date)
      const normalized: CheckinReward[] = rewards.slice(0, checkinDays).map((r) =>
        r.kind === 'coin'
          ? ({ kind: 'coin', value: Math.max(0, Number(r.value) || 0), date: (r.date || '').trim() })
          : ({ kind: 'code', value: String(r.value || '').trim(), date: (r.date || '').trim() })
      )
      const cleanCouponItems = couponItems.slice(0, couponCount).map((it) => ({
        title: (it.title || '').trim(),
        rewardCredit: Math.max(0, Number(it.rewardCredit) || 0),
        price: Math.max(0, Number(it.price) || 0),
        codes: (it.codes || []).map(c => String(c || '').trim()).filter(Boolean),
      }));
      base.checkin = {
        days: checkinDays,
        rewards: normalized,
        updatedAt: Date.now(),
        slot: {
          startBet: num(checkinSlot.startBet, 1),
          winRate:  num(checkinSlot.winRate, 30),
        },
        coupon: {
          items: cleanCouponItems,
          cursors: cleanCouponItems.map(() => 0),   // ใช้ FIFO ต่อแถว
        },
      }

      // เคลียร์ field ประเภทอื่น ๆ กันค้าง
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
    }

    if (isEdit) {
      await update(ref(db, `games/${gameId}`), base)
      alert('บันทึกการเปลี่ยนแปลงเรียบร้อย')
      return
    }

    // ===== โหมดสร้าง =====
    const pushRef = push(ref(db, 'games'))
    const rawKey = pushRef.key!
    const id = rawKey.startsWith('game_') ? rawKey : `game_${rawKey}`

    const payload = { id, createdAt: Date.now(), ...base }
    await set(ref(db, `games/${id}`), payload)

    const linkQuery = `${location.origin}/?id=${id}`
    try { await navigator.clipboard.writeText(linkQuery) } catch {}

    nav(`/games/${id}`, { replace: true })
  }

  // ยืนยันรหัสผ่านก่อนลบ (ถ้าล็อกอยู่)
  async function verifyDeletionPassword(): Promise<boolean> {
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) { alert('กรุณาเข้าสู่ระบบก่อนทำรายการลบเกม'); return false }

    const providerIds = (user.providerData || []).map(p => p?.providerId).filter(Boolean)
    const canUsePassword = !!user.email && (providerIds.includes('password') || providerIds.length === 0)
    if (!canUsePassword) { alert('บัญชีนี้ไม่ได้ใช้รหัสผ่าน (เช่น Google/Facebook) ไม่สามารถยืนยันด้วยรหัสผ่านได้'); return false }

    const password = window.prompt('ใส่รหัสผ่านที่ใช้ล็อกอินเพื่อยืนยันการลบเกมที่ถูกล็อก')
    if (!password) return false
    try {
      const cred = EmailAuthProvider.credential(user.email!, password)
      await reauthenticateWithCredential(user, cred)
      return true
    } catch (err) {
      console.error('Re-auth failed:', err)
      alert('รหัสผ่านไม่ถูกต้อง')
      return false
    }
  }

  const removeGame = async () => {
    if (!isEdit) return
    const isLockedNow = !unlocked
    if (isLockedNow) {
      const ok = await verifyDeletionPassword()
      if (!ok) return
    }
    if (!confirm('ต้องการลบเกมนี้และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?')) return
    try { await remove(ref(db, `answers/${gameId}`)) } catch {}
    await remove(ref(db, `games/${gameId}`))
    alert('ลบเกมเรียบร้อย')
    nav('/home', { replace: true })
  }

  // ===== UI =====
  return (
    <section className="create-wrap">
      <div className="create-card">
        <img src="/image/logo.png" className="create-logo" alt="HENG36 PARTY" />

        <label className="f-label">เลือกประเภทเกม</label>
        <PrettySelect
          options={gameTypes}
          value={type}
          onChange={(v) => setType(v as any)}
        />

        {/* ชื่อเกม */}
        <label className="f-label">ชื่อเกม</label>
        <input className="f-control" placeholder="ชื่อเกม" value={name} onChange={(e) => setName(e.target.value)} />

        {/* เลือกรูปภาพ: เฉพาะ 3 ประเภท */}
        {needImage(type) && (
          <>
            <label className="f-label">เลือกรูปภาพ (jpg/png):</label>
            <div className="file-picker">
              <input id="game-image" type="file" accept="image/*" onChange={onPickImage} />
              <label htmlFor="game-image" className="file-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M5 20h14a2 2 0 0 0 2-2v-5h-2v5H5V7h5V5H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2Zm7-15v7.59l2.29-2.3L16.71 12L12 16.71L7.29 12l1.42-1.71L11 12.59V5h1Z"/>
                </svg>
                <span>เลือกไฟล์</span>
              </label>
              <span className="file-name">{fileName || 'ยังไม่ได้เลือกไฟล์'}</span>
            </div>
            {imageDataUrl && <img src={imageDataUrl} alt="preview" className="img-preview" />}
          </>
        )}

        {/* เฉพาะเกมทายภาพ */}
        {type === 'เกมทายภาพปริศนา' && (
          <>
            <label className="f-label">กำหนดคำตอบ</label>
            <input className="f-control" placeholder="คำตอบที่ถูกต้อง" value={answer} onChange={(e) => setAnswer(e.target.value)} />

            <label className="f-label">กำหนดจำนวน CODE ที่ต้องแจก</label>
            <input
              type="number"
              min={1}
              className="f-control"
              value={numCodes}
              onChange={(e) => setNumCodes(Math.max(1, Number(e.target.value) || 1))}
            />
            {true && codes.map((c, i) => (
              <input
                key={i}
                className="f-control"
                placeholder={`CODE ลำดับที่ ${i + 1}`}
                value={c}
                onChange={(e) => {
                  const v = e.target.value
                  setCodes((prev) => {
                    const next = [...prev]; next[i] = v; return next
                  })
                }}
              />
            ))}
          </>
        )}
        {type === 'เกมทายภาพปริศนา' && isEdit && (
          <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
            <input
              type="checkbox"
              id="resetCodeRound"
              checked={resetCodeRound}
              onChange={(e)=>setResetCodeRound(e.currentTarget.checked)}
            />
            <label htmlFor="resetCodeRound" className="muted">
              เริ่มรอบแจกโค้ดใหม่ (รีเซ็ตคิวและรายชื่อที่รับโค้ด)
            </label>
          </div>
        )}

        {/* เฉพาะเกมทายเบอร์เงิน */}
        {type === 'เกมทายเบอร์เงิน' && (
          <>
            <label className="f-label">กำหนดหมดเวลา</label>
            <input type="datetime-local" className="f-control" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </>
        )}

        {/* เฉพาะเกมทายผลบอล */}
        {type === 'เกมทายผลบอล' && (
          <>
            <div className="grid2">
              <label className="f-label">ทีมเหย้า</label>
              <label className="f-label">ทีมเยือน</label>
              <input className="f-control" placeholder="ชื่อทีมเหย้า" value={homeTeam} onChange={(e)=>setHomeTeam(e.target.value)} />
              <input className="f-control" placeholder="ชื่อทีมเยือน" value={awayTeam} onChange={(e)=>setAwayTeam(e.target.value)} />
            </div>
            <label className="f-label">กำหนดหมดเวลา</label>
            <input type="datetime-local" className="f-control" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </>
        )}

        {/* เฉพาะเกมสล็อต */}
        {type === 'เกมสล็อต' && (
          <>
            <div className="grid2">
              <div>
                <label className="f-label">เครดิตเริ่มต้น</label>
                <input
                  type="number"
                  className="f-control"
                  value={slot.startCredit}
                  onChange={(e)=>setSlot(s=>({...s, startCredit:Number(e.target.value)||0}))}
                />
              </div>
              <div>
                <label className="f-label">BET เริ่มต้น</label>
                <input
                  type="number"
                  className="f-control"
                  value={slot.startBet}
                  onChange={(e)=>setSlot(s=>({...s, startBet:Number(e.target.value)||0}))}
                />
              </div>
            </div>
            <div className="grid2">
              <div>
                <label className="f-label">อัตราชนะ (%)</label>
                <input
                  type="number"
                  className="f-control"
                  value={slot.winRate}
                  onChange={(e)=>setSlot(s=>({...s, winRate:Number(e.target.value)||0}))}
                />
              </div>
              <div>
                <label className="f-label">เป้าเครดิต</label>
                <input
                  type="number"
                  className="f-control"
                  value={slot.targetCredit}
                  onChange={(e)=>setSlot(s=>({...s, targetCredit:Number(e.target.value)||0}))}
                />
              </div>
            </div>
          </>
        )}

        {type === 'เกมประกาศรางวัล' && (
          <div className="card">
            <div className="card-title">รายชื่อผู้ได้รับรางวัล (อัปโหลดไฟล์)</div>

            <label className="btn">
              อัปโหลด USER CSV
              <input type="file" accept=".csv,.txt,.xlsx" hidden
                    onChange={(e)=>importAnnounceUsers(e.target.files?.[0])}/>
            </label>

            <div style={{marginTop:8, opacity:.8}}>ตัวอย่างรายชื่อ (เลื่อนซ้าย-ขวา)</div>
            <div style={{display:'flex',gap:8,overflowX:'auto',padding:'6px 2px',
                        border:'1px dashed #ddd',borderRadius:8}}>
              {announceUsers.length ? announceUsers.map((u,i)=>(
                <div key={`${u}-${i}`} style={{
                  flex:'0 0 auto',padding:'6px 10px',border:'1px solid #eee',
                  borderRadius:999,background:'#fafafa'
                }}>
                  {u}
                </div>
              )) : <div style={{padding:8,opacity:.6}}>ยังไม่มีข้อมูล</div>}
            </div>
          </div>
        )}


        {/* ✅ เฉพาะเกมเช็คอิน (เพิ่มคอลัมน์เลือกวันที่) */}
        {type === 'เกมเช็คอิน' && (
          <>
            <label className="f-label">จำนวนวันสำหรับ CHECK-IN</label>
            <input
              type="number"
              min={1}
              max={30}
              className="f-control"
              value={checkinDays}
              onChange={(e) => {
                const d = clamp(Number(e.target.value) || 1, 1, 30)
                setCheckinDays(d)
                setRewards(prev => {
                  const next = [...prev]
                  if (next.length < d) {
                    while (next.length < d) next.push({ kind: 'coin', value: 1000, date: '' })
                  } else {
                    next.length = d
                  }
                  return next
                })
              }}
            />

            <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              {/* หัวตาราง */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '86px 160px 1fr 220px', // ✅ เพิ่มคอลัมน์วันที่
                gap: 8,
                padding: '10px 12px',
                background: '#f8fafc',
                fontWeight: 800,
                color: '#0f172a',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div>Day</div>
                <div>ของรางวัล</div>
                <div>ค่าที่ได้รับ / โค้ด</div>
                <div>วันที่เช็คอิน (อนุญาต)</div>
              </div>

              {/* รายการวัน */}
              {rewards.slice(0, checkinDays).map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '86px 160px 1fr 220px', // ✅ ให้สอดคล้องหัวตาราง
                    gap: 8,
                    padding: '10px 12px',
                    borderBottom: i === checkinDays - 1 ? 'none' : '1px solid #f1f5f9',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontWeight: 800 }}>Day {i + 1}</div>

                  <select
                    className="f-control"
                    value={r.kind}
                    onChange={(e) => {
                      const kind = (e.target.value as 'coin' | 'code')
                      setRewards(prev => {
                        const next = [...prev]
                        next[i] = {
                          kind,
                          value: kind === 'coin' ? (Number(next[i].value) || 1000) : String(next[i].value || ''),
                          date: next[i].date || ''
                        }
                        return next
                      })
                    }}
                  >
                    <option value="coin">HENGCOIN</option>
                    <option value="code">CODE</option>
                  </select>

                  {r.kind === 'coin' ? (
                    <input
                      type="number"
                      min={0}
                      className="f-control"
                      value={Number(r.value) || 0}
                      onChange={(e) => {
                        const v = clamp(Number(e.target.value) || 0, 0, 99999999)
                        setRewards(prev => {
                          const next = [...prev]; next[i] = { ...next[i], value: v }; return next
                        })
                      }}
                      placeholder="จำนวนเหรียญที่ได้รับ"
                    />
                  ) : (
                    <input
                      className="f-control"
                      value={String(r.value || '')}
                      onChange={(e) => {
                        const v = e.target.value
                        setRewards(prev => {
                          const next = [...prev]; next[i] = { ...next[i], value: v }; return next
                        })
                      }}
                      placeholder="ข้อความโค้ดที่ต้องการแจก"
                    />
                  )}

                  {/* ✅ ช่องเลือกวันที่แบบ date (ปล่อยว่าง = ไม่ล็อกวัน) */}
                  <input
                    type="date"
                    className="f-control"
                    value={r.date || ''}
                    onChange={(e) => {
                      const v = e.target.value  // YYYY-MM-DD
                      setRewards(prev => {
                        const next = [...prev]; next[i] = { ...next[i], date: v }; return next
                      })
                    }}
                  />
                </div>
              ))}
              
            </div>
            {/* ตั้งค่าเกมสล็อต (ใช้ในหน้าเช็คอิน) */}
                    <div style={{ marginTop: 14 }}>
                      <div className="box-title" style={{fontWeight:900, marginBottom:8}}>ตั้งค่าเกมสล็อต (ในหน้าเช็คอิน)</div>
                      <div className="grid2">
                        <div>
                          <label className="f-label">BET เริ่มต้น</label>
                          <input
                            type="number"
                            className="f-control"
                            min={1}
                            value={checkinSlot.startBet}
                            onChange={(e)=>setCheckinSlot(s=>({...s, startBet: Math.max(1, Number(e.target.value)||1)}))}
                          />
                        </div>
                        <div>
                          <label className="f-label">อัตราชนะ (%)</label>
                          <input
                            type="number"
                            className="f-control"
                            min={0}
                            max={100}
                            value={checkinSlot.winRate}
                            onChange={(e)=>setCheckinSlot(s=>({...s, winRate: Math.max(0, Math.min(100, Number(e.target.value)||0))}))}
                          />
                        </div>
                      </div>
                      <div className="muted" style={{marginTop:6}}>
                        * เครดิตจะดึงจาก HENGCOIN ของผู้เล่นโดยตรง และอัปเดตจริงลง DB
                      </div>
                    </div>
               {/* ตั้งค่า Coupon Shop (แลกโค้ด) */}
                  <div style={{ marginTop: 18 }}>
                    <div className="box-title" style={{ fontWeight: 900, marginBottom: 8 }}>
                      ตั้งค่า Coupon Shop (แลกโค้ด)
                    </div>

                    {/* จำนวนรายการคูปอง */}
                    <label className="f-label">จำนวนรายการคูปอง</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="f-control"
                      value={couponCount}
                      onChange={(e) => {
                        const n = clamp(Number(e.target.value) || 1, 1, 12)
                        setCouponCount(n)
                        setCouponItems(prev => {
                          const next = [...prev]
                          if (next.length < n) {
                            while (next.length < n) next.push({ title: '', rewardCredit: 0, price: 0, codes: [''] })
                          } else {
                            next.length = n
                          }
                          return next
                        })
                      }}
                    />

                    {/* รายการคูปองแต่ละแถว */}
                    {/* รายการคูปองแต่ละแถว */}
                      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {couponItems.slice(0, couponCount).map((it, i) => (
                          <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>รายการคูปอง : {i + 1}</div>

                            <div className="grid2" style={{ gap: 8 }}>
                              <div>
                                <label className="f-label">
                                  ชื่อรายการคูปอง
                                </label>
                                <input
                                  className="f-control"
                                  value={it.title || ''}
                                  onChange={e => {
                                    const v = e.target.value
                                    setCouponItems(prev => { const n = [...prev]; n[i] = { ...n[i], title: v }; return n })
                                  }}
                                />
                              </div>
                              <div>
                                <label className="f-label">เครดิตฟรีโบนัสที่รับ</label>
                                <input
                                  type="number"
                                  className="f-control"
                                  value={it.rewardCredit}
                                  onChange={e => {
                                    const v = Number(e.target.value) || 0
                                    setCouponItems(prev => { const n = [...prev]; n[i] = { ...n[i], rewardCredit: v }; return n })
                                  }}
                                />
                              </div>
                            </div>

                            <div className="grid2" style={{ gap: 8, marginTop: 8, alignItems:'end' }}>
                              <div>
                                <label className="f-label">ราคาแลก : HENGCOIN</label>
                                <input
                                  type="number"
                                  className="f-control"
                                  value={it.price}
                                  onChange={e => {
                                    const v = Number(e.target.value) || 0
                                    setCouponItems(prev => { const n = [...prev]; n[i] = { ...n[i], price: v }; return n })
                                  }}
                                />
                              </div>

                              <div>
                                <label className="f-label">จำนวน CODE ในแถวนี้</label>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                                  <input
                                    type="number"
                                    min={0}
                                    className="f-control"
                                    value={it.codes?.length || 0}
                                    onChange={e => {
                                      const k = Math.max(0, Number(e.target.value) || 0)
                                      setCouponItems(prev => {
                                        const n = [...prev]
                                        const codes = [...(n[i].codes || [])]
                                        if (codes.length < k) while (codes.length < k) codes.push('')
                                        else codes.length = k
                                        n[i] = { ...n[i], codes }
                                        return n
                                      })
                                    }}
                                  />
                                  {/* ปุ่มอัปโหลดไฟล์ */}
                                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <input
                                      id={`import-codes-${i}`}
                                      type="file"
                                      accept=".xlsx,.xls,.csv,.txt"
                                      style={{ display:'none' }}
                                      onChange={async (e) => {
                                        const f = e.currentTarget.files?.[0]
                                        try { await importCodesForRow(i, f) } 
                                        catch (err:any) { alert(err?.message || 'นำเข้าไม่สำเร็จ') }
                                        finally { e.currentTarget.value = '' }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="btn-upload"
                                      onClick={() => (document.getElementById(`import-codes-${i}`) as HTMLInputElement)?.click()}
                                    >
                                      ⬆️ อัปโหลด CODE Excel/CSV
                                    </button>
                                  </div>
                                </div>                                             
                              </div>
                            </div>

                            {/* ✅ รายการโค้ด + ลำดับ + แถบเลื่อน */}
                            <div
                              style={{
                                marginTop: 8, maxHeight: 260, overflowY: 'auto',
                                border: '1px solid #eef2f7', borderRadius: 10, padding: 8, background: '#fff',
                                boxShadow:'inset 0 1px 0 rgba(0,0,0,.02)'
                              }}
                            >
                              {(it.codes || []).map((c, j) => (
                                <div
                                  key={j}
                                  style={{
                                    display:'grid', gridTemplateColumns:'64px 1fr',
                                    gap:8, alignItems:'center', marginBottom:6
                                  }}
                                >
                                  {/* ลำดับโค้ด */}
                                  <div
                                    className="mono"
                                    style={{
                                      fontWeight:800, fontSize:13, lineHeight:'36px',
                                      height:36, textAlign:'center',
                                      background:'#f1f5f9', border:'1px solid #e5e7eb',
                                      borderRadius:8
                                    }}
                                  >
                                    CODE : {j + 1}
                                  </div>

                                  {/* ช่องกรอกโค้ด */}
                                  <input
                                    className="f-control"
                                    style={{ height:36 }}
                                    placeholder={`CODE ลำดับที่ ${j + 1}`}
                                    value={c}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      setCouponItems(prev => {
                                        const n = [...prev]
                                        const codes = [...(n[i].codes || [])]
                                        codes[j] = v
                                        n[i] = { ...n[i], codes }
                                        return n
                                      })
                                    }}
                                  />
                                </div>
                              ))}
                              {(it.codes || []).length === 0 && (
                                <div className="muted" style={{ textAlign:'center', padding:'8px' }}>ยังไม่มี CODE</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                  </div>
     
          </>
              
        )}

        {/* ===== ส่วนกลางที่ใช้ร่วมกันทุกประเภท (เฉพาะโหมดแก้ไข): ลิงก์ + คัดลอก + ท็อกเกิล ===== */}
        {isEdit && (
          <>
            <label className="f-label">ลิงก์สำหรับส่งให้ลูกค้า</label>
            <div className="share-row" style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
                    <input
                      id="customerLinkInput"
                      className="f-control"
                      value={`${location.origin}/?id=${gameId}`}
                      readOnly
                    />
                    <button
                      className="btn-copy"
                      onClick={async () => {
                        const el = document.getElementById('customerLinkInput') as HTMLInputElement | null;
                        if (!el) return;
                        const text = el.value;
                        try {
                          if (navigator.clipboard && window.isSecureContext) {
                            await navigator.clipboard.writeText(text);
                            alert('คัดลอกลิงก์แล้ว');
                          } else {
                            // fallback textarea method
                            el.select();
                            el.setSelectionRange(0, text.length);
                            const ok = document.execCommand('copy');
                            alert(ok ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่สำเร็จ');
                          }
                        } catch (e) {
                          alert('คัดลอกไม่สำเร็จ');
                        }
                      }}
                    >
                      <span className="ico">📋</span> คัดลอกลิงก์
                    </button>
                  </div>


            <div className="unlock-row" style={{ marginTop: 12 }}>
              <label className="switch" aria-label="ล็อกเกม">
                <input
                  type="checkbox"
                  checked={!unlocked}
                  onChange={(e) => toggleUnlock(!e.currentTarget.checked)}
                />
                <span className="slider" />
              </label>
              <span className="muted">{unlocked ? '🔓 ปลดล็อกแล้ว' : '🔒 ล็อกอยู่'}</span>
            </div>
          </>
        )}

        {/* ===== โซนล่างในโหมดแก้ไข ===== */}
        {isEdit && (
          <section className="answers-panel">
            <div className="answers-head">
              <div className="answers-title">📊 คำตอบที่ผู้เล่นทาย</div>
              <button className="btn-ghost btn-sm" onClick={refreshAnswers}>
                <span className="ico">🔄</span> รีเฟรชคำตอบ
              </button>
            </div>

            {/* ----- answers-list ----- */}
              {type !== 'เกมเช็คอิน' && (
                <div className="answers-list">
                  {answers.length === 0 ? (
                    <div className="muted" style={{ textAlign: 'center', padding: '8px 0' }}>
                      ยังไม่มีคำตอบ
                    </div>
                  ) : (
                    answers.map((row, idx) => {
                      const isCorrect = row.correct === true
                      const isWrong   = row.correct === false

                      return (
                        <div
                          className={`answer-item ${isWrong ? 'is-wrong' : ''}`}
                          key={idx}
                        >
                          <div className="ai-left">
                            <div className="ai-time">🕒 {fmtThai(row.ts)}</div>
                            <div className="ai-user">USER : <b>{row.user || '-'}</b></div>
                            <div>
                              <span className="ai-label">คำตอบ: </span>
                              <span className="ai-value">{row.answer ?? '-'}</span>
                            </div>
                          </div>

                          <div className="ai-right">
                            {isCorrect && <span className="badge badge--correct">✓ ถูกต้อง</span>}
                            {isCorrect && row.code && (
                              <span className="badge badge--code">
                                🎁 โค้ด: <span className="mono">{row.code}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

            {isEdit && type === 'เกมเช็คอิน' && (
              <section className="usage-panel">
              {/* 4.1 เช็ค ALL USER */}
              <div className="usage-card">
                <div className="usage-head usage--blue">
                  <div className="usage-title">👥 เช็ค ALL USER</div>
                  <div className="usage-sub">แสดงเฉพาะผู้ที่เคยเช็คอินเกมนี้ + HENGCOIN คงเหลือ</div>
                </div>

                <div className="usage-table table-center">
                  <div className="ut-head ut-3">
                    <div>#</div>
                    <div>USER</div>
                    <div>HENGCOIN คงเหลือ</div>
                  </div>

                  <div className="ut-body">
                    {(() => {
                      const filtered = allUsers.filter(r => checkinUsers.has(normalizeUser(r.user)))
                      return filtered.length ? (
                        filtered.map((r, i) => (
                          <div className="ut-row ut-3" key={r.user}>
                            <div>{i + 1}</div>
                            <div><b>{r.user}</b></div>
                            <div>{fmtNum(r.hcoin)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="muted" style={{textAlign:'center', padding:'8px'}}>ยังไม่มีผู้เล่นที่เช็คอิน</div>
                      )
                    })()}
                  </div>
                </div>
              </div>



              {/* 4.2 เช็คอิน */}
              <div className="usage-card">
                <div className="usage-head usage--green">
                  <div className="usage-title">✅ เช็คอิน</div>
                  <div className="usage-sub">USER, วันที่เช็คอิน, จำนวน HENGCOIN ที่ได้, คงเหลือ, วันเวลา</div>
                </div>

                <div className="usage-table">
                  {/* หัวตาราง: ไม่อยู่ในส่วนเลื่อน */}
                  <div className="ut-head ut-5">
                    <div>วันเวลา</div><div>USER</div><div>ได้ (เหรียญ)</div><div>คงเหลือ</div><div>หมายเหตุ</div>
                  </div>

                  {/* ตัวข้อมูล: อยู่ในส่วนเลื่อน */}
                  <div className="ut-body ut-5">
                    {logCheckin.map((r: UsageLog, i: number) => (
                      <div className="ut-row ut-5" key={`ci-${i}`}>
                        <div>{fmtThai(r.ts)}</div>
                        <div><b>{r.user}</b></div>
                        <div>{fmtNum(r.amount)}</div>
                        <div>{fmtNum(r.balanceAfter)}</div>
                        <div>
                          DAY {Number.isFinite(Number(r.dayIndex)) ? r.dayIndex : '-'}
                          {' '}•{' '}
                          {(checkedCountByUser[r.user] ?? 0)}/{checkinDays}
                        </div>
                      </div>
                    ))}

                    {logCheckin.length === 0 && (
                      <div className="muted" style={{textAlign:'center', padding:'8px'}}>ยังไม่มีรายการ</div>
                    )}
                  </div>
                </div>
              </div>


              {/* 4.3 สล็อต */}
              <div className="usage-card">
                <div className="usage-head usage--purple">
                  <div className="usage-title">🎰 สล็อต</div>
                  <div className="usage-sub">USER, จำนวนเบท, HENGCOIN คงเหลือ, วันเวลา</div>
                </div>

                <div className="usage-table">
                  <div className="ut-head ut-4">
                    <div>วันเวลา</div><div>USER</div><div>เบท</div><div>คงเหลือ</div>
                  </div>

                  <div className="ut-body ut-4">
                    {logSlot.map((r: UsageLog, i: number) => (
                      <div className="ut-row ut-4" key={`sl-${i}`}>
                        <div>{fmtThai(r.ts)}</div>
                        <div><b>{r.user}</b></div>
                        <div>{fmtNum(r.bet)}</div>
                        <div>{fmtNum(r.balanceAfter)}</div>
                      </div>
                    ))}
                    {logSlot.length === 0 && (
                      <div className="muted" style={{textAlign:'center', padding:'8px'}}>ยังไม่มีรายการ</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 4.4 แลกคูปอง */}
             <div className="usage-card">
                <div className="usage-head usage--gold">
                  <div className="usage-title">🎟️ แลกคูปอง</div>
                  <div className="usage-sub">USER, คูปองที่รับ, CODE ที่ได้รับ, ใช้ HENGCOIN, HENGCOIN คงเหลือ, วันเวลา</div>
                </div>

                <div className="usage-table">
                  <div
                    className="ut-head ut-4"
                    style={{ display:'grid', gridTemplateColumns:'180px 1fr 1.2fr 1fr 1fr 1fr' }}
                  >
                    <div>วันเวลา</div>
                    <div>USER</div>
                    <div>คูปองที่รับ</div>
                    <div>CODE ที่ได้รับ</div>
                    <div>ใช้ HENGCOIN</div>
                    <div>คงเหลือ</div>
                  </div>

                  <div className="ut-body" style={{ display:'block' }}>
                    {logCoupon.map((r: UsageLog, i: number) => (
                      <div
                        className="ut-row"
                        key={`cp-${i}`}
                        style={{ display:'grid', gridTemplateColumns:'180px 1fr 1.2fr 1fr 1fr 1fr' }}
                      >
                        <div>{fmtThai(r.ts)}</div>
                        <div><b>{r.user}</b></div>
                        <div>{couponNameFromLog(r)}</div>
                        <div className="mono">{r.code || '-'}</div>
                        <div>{fmtNum(r.price)}</div>
                        <div>{fmtNum(r.balanceAfter)}</div>
                      </div>
                    ))}
                    {logCoupon.length === 0 && (
                      <div className="muted" style={{textAlign:'center', padding:'8px'}}>ยังไม่มีรายการ</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            )}

            <button className="btn-download" onClick={downloadAnswers}>
              ⬇️ ดาวน์โหลดคำตอบลูกค้า
            </button>
          </section>
        )}
        {/* ====== รายงานการใช้งานของผู้เล่น (เฉพาะเกมเช็คอิน) ====== */}


        {isEdit ? (
          <div className="actions-row">
            <button className="btn-cta" onClick={submit}>บันทึกการเปลี่ยนแปลง</button>
            <button className="btn-danger" onClick={removeGame}>ลบเกมนี้</button>
          </div>
        ) : (
          <button className="btn-cta" onClick={submit}>สร้างเกมและรับลิงก์</button>
        )}

        {/* ปุ่มกลับ (ล่างสุดเสมอ) */}
        <div style={{marginTop:24}}>
          <button className="btn-back" style={{width:'100%'}} onClick={() => nav('/home')}>
            กลับ
          </button>
        </div>
      </div>
    </section>
  )
}
