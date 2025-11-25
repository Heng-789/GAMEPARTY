import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PrettySelect from '../components/PrettySelect'
// ✅ ใช้ Supabase Auth แทน Firebase Auth
import { getUser, signInWithPassword } from '../services/supabase-auth'
import { dataCache } from '../services/cache'
import * as XLSX from 'xlsx'
import PlayerAnswersList from '../components/PlayerAnswersList'
import { useTheme, useThemeBranding, useThemeAssets, useThemeColors } from '../contexts/ThemeContext'
import { getPlayerLink, getHostLink } from '../utils/playerLinks'
import * as postgresqlAdapter from '../services/postgresql-adapter'
import { uploadImageToStorage, getImageUrl } from '../services/image-upload'
import type { GameData } from '../services/postgresql-api'
import { useSocketIOAnswers } from '../hooks/useSocketIO'
import { getSocketIO, subscribeAnswers } from '../services/socket-io-client'

// ใช้ชนิดเกมแบบเดิม
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

type SlotCfg = { 
  startCredit: number; 
  startBet: number; 
  winRate: number; 
  targetCredit: number;
  winTiers?: {
    slot1_triple?: { payoutX?: number; payoutPct?: number };
    other_triple?: { payoutX?: number; payoutPct?: number };
    slot1_pair?: { payoutX?: number; payoutPct?: number };
    other_pair?: { payoutX?: number; payoutPct?: number };
  };
}
type AnswerRow = {
  ts: number
  user?: string
  answer?: string
  correct?: boolean
  code?: string
  // เพิ่มสำหรับ Trick or Treat
  won?: boolean
  cardSelected?: number
}

// ==== Usage types (admin report for CheckinGame) ====



// ✅ รางวัลเช็คอิน (ไม่ใช้ date แล้ว ใช้ startDate + dayIndex แทน)
type CheckinReward = { kind: 'coin' | 'code'; value: number | string }
type CouponTier = { title?: string; rewardCredit: number; price: number; codes: string[] }


const normalizeUser = (s: string) => (s || '').trim().replace(/\s+/g, '').toUpperCase()
const clean = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

// ฟังก์ชันสร้างห้องสำหรับเกม BINGO

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
  'เกม Trick or Treat',
  'เกมลอยกระทง',
  'เกม BINGO',
]

// ---------- ประเภทที่ "ต้องมีรูปภาพ" ----------
const NEED_IMAGE = new Set<GameType>([
  'เกมทายภาพปริศนา',
  'เกมทายเบอร์เงิน',
  'เกมทายผลบอล',
])
const needImage = (t: GameType) => NEED_IMAGE.has(t)

// ✅ Wrapper component สำหรับ lazy loading answers
const PlayerAnswersListWrapper = React.memo(({ 
  gameId, 
  isEdit, 
  onLoadAnswers, 
  shouldLoadAnswers,
  answers,
  loading,
  onRefresh
}: { 
  gameId: string
  isEdit: boolean
  onLoadAnswers: () => void
  shouldLoadAnswers: boolean
  answers: any[]
  loading?: boolean
  onRefresh?: () => void
}) => {
  // ✅ เรียก load answers เมื่อ component mount (lazy loading)
  React.useEffect(() => {
    if (isEdit && !shouldLoadAnswers) {
      onLoadAnswers()
    }
  }, [isEdit, shouldLoadAnswers, onLoadAnswers])

  return <PlayerAnswersList 
    answers={answers} 
    loading={loading}
    onRefresh={onRefresh}
  />
})

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
  const { themeName } = useTheme()
  const branding = useThemeBranding()
  const assets = useThemeAssets()
  const colors = useThemeColors()
  const { id: routeId } = useParams()
  
  // กำหนดชื่อ coin ตามธีม
  const coinName = themeName === 'max56' ? 'MAXCOIN' : themeName === 'jeed24' ? 'JEEDCOIN' : 'HENGCOIN'
  const isEdit = !!routeId
  const gameId = routeId || ''

  // ====== state ของ "หน้าเดิม" ======
  const [type, setType] = React.useState<GameType>('เกมทายภาพปริศนา')
  const [name, setName] = React.useState('')
  const [imageDataUrl, setImageDataUrl] = React.useState<string>('') // ✅ เก็บ CDN URL หรือ data URL (สำหรับ preview)
  const [imageFile, setImageFile] = React.useState<File | null>(null) // ✅ เก็บ File object ที่เลือกไว้ (รออัปโหลดตอนสร้างเกม)
  const [imageUploading, setImageUploading] = React.useState(false)
  const [fileName, setFileName] = React.useState('')
  // state เก็บผู้ที่เคยรับโค้ด (ใช้เป็น fallback เวลา infer คำตอบถูก)
  const [claimedBy, setClaimedBy] = React.useState<Record<string, { code?: string }>>({})

  // เฉพาะเกมทายภาพ
  const [answer, setAnswer] = React.useState('')

  // โค้ดแจก (ใช้ในเกมทายภาพ)
  const [numCodes, setNumCodes] = React.useState(1)
  const [codes, setCodes] = React.useState<string[]>([''])
  
  // โค้ดรางวัลใหญ่ (ใช้ในเกมลอยกระทง)
  const [numBigPrizeCodes, setNumBigPrizeCodes] = React.useState(1)
  const [bigPrizeCodes, setBigPrizeCodes] = React.useState<string[]>([''])
  const [maxUsers, setMaxUsers] = React.useState(50)
  const [readyCountdown, setReadyCountdown] = React.useState(3)
  const [numRooms, setNumRooms] = React.useState(1)

  // ระบบเลือก USER เข้าเล่นเกม
  const [userAccessType, setUserAccessType] = React.useState<'all' | 'selected'>('all')
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([])
  const [selectedUsersFile, setSelectedUsersFile] = React.useState<File | null>(null)


  // เฉพาะเกมทายผลบอล / เบอร์เงิน
  const [homeTeam, setHomeTeam] = React.useState('')
  const [awayTeam, setAwayTeam] = React.useState('')
  const [endAt, setEndAt] = React.useState<string>('') // datetime-local string
  const [resetCodeRound, setResetCodeRound] = React.useState(false);
  
  // ===== เช็คอิน - รูปภาพแจ้งเตือน
  const [checkinImageDataUrl, setCheckinImageDataUrl] = React.useState('') // ✅ เก็บ CDN URL หรือ data URL
  const [checkinImageFile, setCheckinImageFile] = React.useState<File | null>(null) // ✅ เก็บ File object ที่เลือกไว้ (รออัปโหลดตอนสร้างเกม)
  const [checkinImageUploading, setCheckinImageUploading] = React.useState(false)
  const [checkinFileName, setCheckinFileName] = React.useState('')

  // ===== เช็คอิน
  const [checkinDays, setCheckinDays] = React.useState(1)
  // ✅ รางวัลเช็คอิน (ไม่ใช้ date แล้ว)
  const [rewards, setRewards] = React.useState<CheckinReward[]>(
    Array.from({ length: 1 }).map(() => ({ kind: 'coin', value: 100 }))
  )
  // ✅ รางวัลสำหรับผู้ที่เช็คอินครบทุกวัน
  const [completeReward, setCompleteReward] = React.useState<CheckinReward>({ kind: 'coin', value: 0 })
  // ✅ วันที่เริ่มต้นและสิ้นสุดกิจกรรม (YYYY-MM-DD)
  const [checkinStartDate, setCheckinStartDate] = React.useState<string>('')
  const [checkinEndDate, setCheckinEndDate] = React.useState<string>('')
  
  // ✅ ฟังก์ชันคำนวณจำนวนวันจากวันที่เริ่มต้นและสิ้นสุด
  const calculateDaysFromDates = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0
    try {
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T00:00:00')
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
      if (end < start) return 0
      // คำนวณจำนวนวัน (รวมทั้งวันเริ่มต้นและวันสิ้นสุด)
      const diffTime = end.getTime() - start.getTime()
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
      return Math.max(1, diffDays)
    } catch {
      return 0
    }
  }
  
  // ✅ คำนวณจำนวนวันอัตโนมัติเมื่อวันที่เริ่มต้นหรือสิ้นสุดเปลี่ยน
  React.useEffect(() => {
    if (checkinStartDate && checkinEndDate) {
      // ✅ ตรวจสอบว่าวันที่เริ่มต้นไม่เกินวันที่สิ้นสุด
      if (checkinStartDate > checkinEndDate) {
        // ถ้าวันที่เริ่มต้นเกินวันที่สิ้นสุด ไม่ต้องคำนวณ
        return
      }
      
      const calculatedDays = calculateDaysFromDates(checkinStartDate, checkinEndDate)
      if (calculatedDays > 0 && calculatedDays <= 30) {
        setCheckinDays(calculatedDays)
        // ปรับ rewards ให้มีจำนวนตาม calculatedDays
        setRewards(prev => {
          const next = [...prev]
          if (next.length < calculatedDays) {
            while (next.length < calculatedDays) {
              next.push({ kind: 'coin', value: 100 })
            }
          } else {
            next.length = calculatedDays
          }
          return next
        })
      } else if (calculatedDays > 30) {
        // ถ้าคำนวณได้มากกว่า 30 วัน ให้แจ้งเตือน (แต่ไม่บังคับ)
        console.warn('คำนวณได้จำนวนวันเกิน 30 วัน:', calculatedDays)
      }
    }
  }, [checkinStartDate, checkinEndDate])
  // ✅ ระบบเปิด/ปิดส่วนต่างๆ ในหน้าเกม
  const normalizeFeatureFlag = React.useCallback((value: any, fallback: boolean = true) => {
    if (value === undefined || value === null) return fallback
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    const str = String(value).trim().toLowerCase()
    if (str === '' || str === 'true') return true
    if (str === 'false' || str === '0' || str === 'off' || str === 'no' || str === 'disabled') return false
    return fallback
  }, [])

  const [checkinFeatures, setCheckinFeatures] = React.useState({
    dailyReward: true,
    miniSlot: true,
    couponShop: true
  })
  
  // ✅ State สำหรับ popup ยืนยันการเปลี่ยนแปลง
  const [confirmFeatureChange, setConfirmFeatureChange] = React.useState<{
    open: boolean
    feature: 'dailyReward' | 'miniSlot' | 'couponShop' | null
    newValue: boolean
    oldValue: boolean
  }>({
    open: false,
    feature: null,
    newValue: false,
    oldValue: false
  })

  // ✅ State สำหรับ popup ยืนยันการอัพโหลดโค้ด
  const [confirmCodeUpload, setConfirmCodeUpload] = React.useState<{
    open: boolean
    type: 'dailyReward' | 'completeReward' | 'couponItem' | null
    index: number | null
    codes: string[] | null
    onConfirm: (() => void) | null
  }>({
    open: false,
    type: null,
    index: null,
    codes: null,
    onConfirm: null
  })
  
  // ✅ ฟังก์ชันสำหรับเปลี่ยน feature พร้อม popup ยืนยัน
  const handleFeatureChange = (feature: 'dailyReward' | 'miniSlot' | 'couponShop', newValue: boolean) => {
    const oldValue = checkinFeatures[feature]
    if (oldValue === newValue) return // ไม่มีการเปลี่ยนแปลง
    
    // ✅ แสดง popup ยืนยัน
    setConfirmFeatureChange({
      open: true,
      feature,
      newValue,
      oldValue
    })
  }
  
  // ✅ ฟังก์ชันยืนยันการเปลี่ยนแปลง
  const confirmFeatureChangeHandler = async () => {
    if (confirmFeatureChange.feature) {
      // ✅ อัพเดต state
      const newFeatures = {
        ...checkinFeatures,
        [confirmFeatureChange.feature!]: confirmFeatureChange.newValue
      }
      setCheckinFeatures(newFeatures)
      
      // ✅ บันทึกลง Firebase ทันที (ถ้าเป็นเกมเช็คอินและอยู่ในโหมดแก้ไข)
      if (isEdit && gameId && type === 'เกมเช็คอิน') {
        try {
          // ✅ Debug: log features ก่อนบันทึก (เฉพาะใน development)
          if (process.env.NODE_ENV === 'development') {
            console.log('[CreateGame] Saving features immediately:', newFeatures)
          }
          
          // ✅ บันทึกเฉพาะ features ลง PostgreSQL
          try {
            const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
            await postgresqlAdapter.updateGame(gameId, {
              ...currentGame,
              gameData: {
                ...(currentGame as any).gameData,
                checkin: {
                  ...(currentGame as any).gameData?.checkin,
                  features: newFeatures
                }
              }
            })
          } catch (error) {
            console.error('Error updating checkin features:', error)
          }
          
          // ✅ Invalidate cache
          dataCache.invalidateGame(gameId)
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[CreateGame] Features saved successfully')
          }
        } catch (error) {
          console.error('[CreateGame] Error saving features:', error)
          // ✅ ถ้าบันทึกไม่สำเร็จ ให้ revert state
          setCheckinFeatures(checkinFeatures)
          alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า กรุณาลองใหม่อีกครั้ง')
        }
      }
    }
    
    setConfirmFeatureChange({
      open: false,
      feature: null,
      newValue: false,
      oldValue: false
    })
  }
  
  // ✅ ฟังก์ชันยกเลิกการเปลี่ยนแปลง
  const cancelFeatureChangeHandler = () => {
    setConfirmFeatureChange({
      open: false,
      feature: null,
      newValue: false,
      oldValue: false
    })
  }
  // ตั้งค่า SLOT ภายใน "เกมเช็คอิน"
  const [checkinSlot, setCheckinSlot] = React.useState({ startBet: 1, winRate: 30 })
  const [couponCount, setCouponCount] = React.useState(1);
  const [couponItems, setCouponItems] = React.useState<CouponTier[]>(
    Array.from({ length: 1 }).map((_, i) => ({
      title: '',
      rewardCredit: [50][i] ?? 5000,
      price:        [10,50,100,200,300,500][i] ?? 10,
      codes: [''],  // ✅ เก็บเฉพาะโค้ดที่ผู้ใช้กรอกใหม่ ไม่โหลดทั้งหมดจาก DB
    }))
  );
  // ✅ เก็บจำนวนโค้ดสำหรับแต่ละ coupon item (ไม่โหลดโค้ดทั้งหมดมา)
  const [couponItemCodeCounts, setCouponItemCodeCounts] = React.useState<number[]>([]);
  const [couponItemCodeCountsLoading, setCouponItemCodeCountsLoading] = React.useState(false);
  // ✅ เก็บโค้ดที่อัพโหลดใหม่สำหรับ coupon items (เพื่อบันทึกไปที่ DB)
  const [couponItemCodesNew, setCouponItemCodesNew] = React.useState<string[][]>([]);
  // ✅ เก็บจำนวนโค้ดสำหรับ daily rewards (ไม่โหลดโค้ดทั้งหมดมา)
  const [dailyRewardCodeCounts, setDailyRewardCodeCounts] = React.useState<number[]>([]);
  const [dailyRewardCodeCountsLoading, setDailyRewardCodeCountsLoading] = React.useState(false);
  // ✅ เก็บโค้ดที่อัพโหลดใหม่สำหรับ daily rewards (เพื่อบันทึกไปที่ DB)
  const [dailyRewardCodes, setDailyRewardCodes] = React.useState<string[][]>([]);
  // ✅ เก็บจำนวนโค้ดสำหรับ complete reward (ไม่โหลดโค้ดทั้งหมดมา)
  const [completeRewardCodeCount, setCompleteRewardCodeCount] = React.useState<number>(0);
  const [completeRewardCodeCountLoading, setCompleteRewardCodeCountLoading] = React.useState(false);
  // ✅ เก็บโค้ดที่อัพโหลดใหม่สำหรับ complete reward (เพื่อบันทึกไปที่ DB)
  const [completeRewardCodes, setCompleteRewardCodes] = React.useState<string[]>([]);
// ===== รายงานการใช้งาน (หน้าเกมเช็คอิน) =====
const [allUsers, setAllUsers] = React.useState<UserBalanceRow[]>([])
const [logCheckin, setLogCheckin] = React.useState<UsageLog[]>([])
const [logSlot, setLogSlot] = React.useState<UsageLog[]>([])
const [logCoupon, setLogCoupon] = React.useState<UsageLog[]>([])

// Loading states for different data sections
const [checkinDataLoading, setCheckinDataLoading] = React.useState(false)
const [slotDataLoading, setSlotDataLoading] = React.useState(false)

  // รายชื่อผู้ได้รับรางวัลจาก CSV (อ่านเฉพาะคอลัมน์แรก col=0 ตั้งแต่แถว1)
  const [announceUsers, setAnnounceUsers] = React.useState<string[]>([])
  const [announceUserBonuses, setAnnounceUserBonuses] = React.useState<Array<{ user: string; bonus: number }>>([])
  const [announceImageDataUrl, setAnnounceImageDataUrl] = React.useState<string>('') // ✅ เก็บ CDN URL หรือ data URL
  const [announceImageFile, setAnnounceImageFile] = React.useState<File | null>(null) // ✅ เก็บ File object ที่เลือกไว้ (รออัปโหลดตอนสร้างเกม)
  const [announceImageUploading, setAnnounceImageUploading] = React.useState(false)
  const [announceFileName, setAnnounceFileName] = React.useState<string>('')

  // เฉพาะเกม Trick or Treat
  const [trickOrTreatWinChance, setTrickOrTreatWinChance] = React.useState(50) // โอกาสชนะ (0-100)

const parseUsersAndBonuses = (text: string) => {
  const lines = text.split(/\r?\n/)
  const users: string[] = []
  const userBonuses: Array<{ user: string; bonus: number }> = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    
    // แยก CSV แบบง่ายพอสำหรับคอลัมน์ A และ B (รองรับคอมมา/เซมิโคลอน/แท็บ)
    const cells = line.split(/[,;\t]/)
    const user = (cells[0] ?? '').trim()
    const bonusStr = (cells[1] ?? '').trim()
    
    if (user) {
      users.push(user)
      
      // ถ้ามี BONUS ในคอลัมน์ B ให้เพิ่มเข้าไป
      if (bonusStr) {
        const bonus = Number(bonusStr) || 0
        userBonuses.push({ user, bonus })
      }
    }
  }
  
  // unique แบบคงลำดับ
  const seenUsers = new Set<string>(), uniqUsers: string[] = []
  for (const u of users) if (!seenUsers.has(u)) { seenUsers.add(u); uniqUsers.push(u) }
  
  const seenBonuses = new Set<string>(), uniqBonuses: Array<{ user: string; bonus: number }> = []
  for (const item of userBonuses) if (!seenBonuses.has(item.user)) { seenBonuses.add(item.user); uniqBonuses.push(item) }
  
  return { users: uniqUsers, userBonuses: uniqBonuses }
}

async function importAnnounceUsers(file?: File) {
  if (!file) return
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text()
    const { users, userBonuses } = parseUsersAndBonuses(text)
    if (!users.length) { alert('ไม่พบ USER ในคอลัมน์ A'); return }
    
    setAnnounceUsers(users)
    setAnnounceUserBonuses(userBonuses)
    
    let message = `นำเข้า USER ${users.length} รายการ`
    if (userBonuses.length > 0) {
      message += ` พร้อม BONUS ${userBonuses.length} รายการ`
    }
    alert(message)
    return
  }
  // .xlsx (ถ้ามี SheetJS ติดตั้ง)
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { type:'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
  
  const users: string[] = []
  const userBonuses: Array<{ user: string; bonus: number }> = []
  
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    
    const user = (row[0] ?? '').toString().trim()
    const bonusStr = (row[1] ?? '').toString().trim()
    
    if (user) {
      users.push(user)
      
      // ถ้ามี BONUS ในคอลัมน์ B ให้เพิ่มเข้าไป
      if (bonusStr) {
        const bonus = Number(bonusStr) || 0
        userBonuses.push({ user, bonus })
      }
    }
  }
  
  // unique แบบคงลำดับ
  const seenUsers = new Set<string>(), uniqUsers: string[] = []
  for (const u of users) if (!seenUsers.has(u)) { seenUsers.add(u); uniqUsers.push(u) }
  
  const seenBonuses = new Set<string>(), uniqBonuses: Array<{ user: string; bonus: number }> = []
  for (const item of userBonuses) if (!seenBonuses.has(item.user)) { seenBonuses.add(item.user); uniqBonuses.push(item) }
  
  if (!uniqUsers.length) { alert('ไม่พบ USER ในคอลัมน์ A'); return }
  
  setAnnounceUsers(uniqUsers)
  setAnnounceUserBonuses(uniqBonuses)
  
  let message = `นำเข้า USER ${uniqUsers.length} รายการ`
  if (uniqBonuses.length > 0) {
    message += ` พร้อม BONUS ${uniqBonuses.length} รายการ`
  }
  alert(message)
}

// ฟังก์ชันอัพโหลด USER ที่เลือกไว้
async function importSelectedUsers(file?: File) {
  if (!file) return
  
  try {
    const text = await file.text()
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
    
    if (lines.length === 0) {
      alert('ไม่พบ USER ในไฟล์')
      return
    }
    
    // กรอง USER ที่ไม่ซ้ำ
    const uniqueUsers = [...new Set(lines)]
    setSelectedUsers(uniqueUsers)
    setSelectedUsersFile(file)
    
    alert(`นำเข้า USER ${uniqueUsers.length} รายการ`)
  } catch (error) {
    console.error('Error importing users:', error)
    alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
  }
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
    winTiers: undefined,
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
    
    // ข้ามแถวแรกที่เป็นหัวตาราง
    if (r === 0) continue;
    
    // ตรวจสอบว่ามีคอลัมน์ครบ (อย่างน้อย 11 คอลัมน์)
    if (row.length >= 11) {
      const serialCode = String(row[4] || '').trim(); // คอลัมน์ E (index 4)
      const colG = String(row[6] || '').trim(); // คอลัมน์ G (index 6)
      const colH = String(row[7] || '').trim(); // คอลัมน์ H (index 7)
      const colK = String(row[10] || '').trim(); // คอลัมน์ K (index 10)
      
      // เช็คเงื่อนไขจากคอลัมน์ G, H, K (ต้องว่างทั้งหมด) และมี serialcode
      if (serialCode && !colG && !colH && !colK) {
        codes.push(serialCode);
      }
    }
  }
  
  return uniqKeepOrder(codes);
};

async function parseCodesFromFile(file: File): Promise<string[]> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    const rows = lines.map(line => line.split(',').map(col => col.trim().replace(/"/g, '')));
    return extractCodesFromRows(rows);
  }

  // .xlsx/.xls ใช้ SheetJS (XLSX) ถ้ามี
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  return extractCodesFromRows(rows);
}

// ✅ importCodesForRow จะถูกสร้างใหม่ใน component เพื่อใช้ state setters


  // ✅ OPTIMIZED: โหลด ALL USER + COIN คงเหลือ - ใช้ get() แทน onValue() เพื่อลด download
  // ✅ ใช้ cache และ refresh เมื่อต้องการ (เมื่อ focus window หรือกด refresh)
  React.useEffect(() => {
    let isMounted = true
    
    const loadUsers = async () => {
      try {
        // ✅ ใช้ PostgreSQL adapter
        const MAX_USERS_DISPLAY = 100 // แสดงเฉพาะ top 100 users (ตาม hcoin)
        const result = await postgresqlAdapter.getAllUsers(1, MAX_USERS_DISPLAY, '')
        
        if (!isMounted) return
        
        // แปลงเป็น UserBalanceRow format
        const rows: UserBalanceRow[] = (result.users || []).map(u => ({
          user: u.userId,
          hcoin: Number(u.hcoin ?? 0),
        }))
        
        if (isMounted) {
          setAllUsers(rows)
        }
      } catch (error) {
        console.error('Error loading users:', error)
        // ✅ แสดง error message ที่ชัดเจนกว่า
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
          })
        }
        // ✅ ตั้งค่า empty array แทนการ throw error (เพื่อไม่ให้ UI crash)
        if (isMounted) {
          setAllUsers([])
        }
      }
    }
    
    // โหลดครั้งแรก
    loadUsers()
    
    // ✅ Refresh เมื่อ window focus (เช่น เมื่อกลับมาจากหน้าอื่น)
    const handleFocus = () => {
      loadUsers()
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      isMounted = false
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
// โหลด LOG จาก answers/{gameId} แล้วแยกเป็น 3 หมวด - Lazy Loading
const loadCheckinData = React.useCallback(async () => {
  if (!isEdit || !gameId) return
  
  setCheckinDataLoading(true)
  try {
    // ✅ OPTIMIZED: ใช้ sharding ตามวันที่ (90 วันล่าสุด) เพื่อรองรับ 10,000+ users
    const today = new Date()
    const dateKeys: string[] = []
    
    // สร้าง dateKey list สำหรับ 90 วันล่าสุด
    for (let i = 0; i < 90; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      dateKeys.push(`${year}${month}${day}`)
    }

    const rows: UsageLog[] = []

    const pushRow = (tsKey: string, payload: any) => {
      if (!payload || typeof payload !== 'object') return
      const action = payload.action
      if (!action) return
      const tsFromPayload = Number(payload.ts)
      const tsFromKey = Number(tsKey)
      const ts = Number.isFinite(tsFromPayload) ? tsFromPayload : (Number.isFinite(tsFromKey) ? tsFromKey : Date.parse(tsKey))
      if (!Number.isFinite(ts)) return

      rows.push({
        ts,
        user: String(payload.user ?? payload.username ?? ''),
        action,
        amount: Number(payload.amount ?? NaN),
        price: Number(payload.price ?? NaN),
        itemIndex: Number(payload.itemIndex ?? NaN),
        bet: Number(payload.bet ?? NaN),
        balanceBefore: Number(payload.balanceBefore ?? NaN),
        balanceAfter: Number(payload.balanceAfter ?? NaN),
        dayIndex: Number(payload.dayIndex ?? NaN),
        code: typeof payload.code === 'string' ? String(payload.code) : undefined,
      })
    }

    // ✅ OPTIMIZED: โหลด answers ทั้งหมดครั้งเดียว แล้วกรองตาม dateKey ทั้งหมด
    try {
      // ✅ เรียก getAnswers แค่ครั้งเดียว (ไม่ใช่ใน loop)
      const allAnswers = await postgresqlAdapter.getAnswers(gameId, 10000)
      
      // ✅ สร้าง dateKey set เพื่อกรองเร็วขึ้น
      const dateKeySet = new Set(dateKeys)
      
      // ✅ กรอง answers ที่ตรงกับ dateKey ทั้งหมด
      for (const answer of allAnswers) {
        const answerDate = new Date(answer.ts || answer.createdAt || Date.now())
        const answerDateKey = `${answerDate.getFullYear()}${String(answerDate.getMonth() + 1).padStart(2, '0')}${String(answerDate.getDate()).padStart(2, '0')}`
        
        // ✅ ถ้า dateKey อยู่ใน set ให้ push row
        if (dateKeySet.has(answerDateKey)) {
          const tsKey = String(answer.ts || answer.createdAt || Date.now())
          const payload = answer.answer || answer
          if (payload && typeof payload === 'object') {
            pushRow(tsKey, payload)
          }
        }
      }
    } catch (err) {
      console.error('Error loading checkin data:', err)
    }

    rows.sort((a, b) => b.ts - a.ts)
    const checkinRows = rows.filter((r) => r.action === 'checkin')
    setLogCheckin(checkinRows)
    setLogCoupon(rows.filter((r) => r.action === 'coupon-redeem'))
  } catch (error) {
    console.error('Error loading checkin data:', error)
  } finally {
    setCheckinDataLoading(false)
  }
}, [isEdit, gameId])

  // โหลดข้อมูล checkin เมื่อเปลี่ยนเป็นเกมเช็คอิน (เฉพาะเมื่อ isEdit = true)
React.useEffect(() => {
  if (isEdit && type === 'เกมเช็คอิน') {
    loadCheckinData()
  }
}, [isEdit, type, loadCheckinData])

// โหลด "สล็อตล่าสุดต่อ USER" จาก answers_last/<gameId>/slot - Lazy Loading
const loadSlotData = React.useCallback(async () => {
  if (!isEdit || !gameId || type !== 'เกมสล็อต') return
  
  setSlotDataLoading(true)
  try {
    // ✅ ใช้ PostgreSQL adapter - โหลด answers ทั้งหมดแล้วกรองตาม action = 'slot'
    const allAnswers = await postgresqlAdapter.getAnswers(gameId, 10000)
    const slotAnswers = allAnswers.filter(a => a.answer?.includes('slot') || a.code?.includes('slot'))
    const v: Record<string, any> = {}
    
    // จัดกลุ่มตาม user
    for (const answer of slotAnswers) {
      const userId = answer.userId || (answer as any).user || ''
      if (userId) {
        v[userId] = {
          bet: answer.answer || 0,
          ...answer
        }
      }
    }
    
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
  } catch (error) {
    console.error('Error loading slot data:', error)
  } finally {
    setSlotDataLoading(false)
  }
}, [isEdit, gameId, type])

// โหลดข้อมูลสล็อตเมื่อเปลี่ยนเป็นเกมสล็อต (เฉพาะเมื่อ isEdit = true)
React.useEffect(() => {
  if (isEdit && type === 'เกมสล็อต') {
    loadSlotData()
  }
}, [isEdit, type, loadSlotData])

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

  // Loading states for different data sections
  const [gameDataLoading, setGameDataLoading] = React.useState(false)
  const [answersDataLoading, setAnswersDataLoading] = React.useState(false)
  
  // สำหรับ trigger reload หลังจากบันทึก
  const [reloadTrigger, setReloadTrigger] = React.useState(0)
  
  // สถานะการบันทึกข้อมูล
  const [isSaving, setIsSaving] = React.useState(false)
  
  // ✅ เก็บโค้ดเดิมไว้เพื่อเปรียบเทียบ (ป้องกันการ reset cursor เมื่อโค้ดไม่เปลี่ยน)
  const originalCodesRef = React.useRef<string[]>([])
  const originalCheckinRewardsRef = React.useRef<any>(null)
  const originalCheckinCompleteRewardRef = React.useRef<any>(null)
  const originalCheckinCouponItemsRef = React.useRef<any[]>([])
  const originalLoyKrathongCodesRef = React.useRef<string[]>([])
  const originalLoyKrathongBigPrizeCodesRef = React.useRef<string[]>([])
  const originalTrickOrTreatCodesRef = React.useRef<string[]>([])
  const originalBingoCodesRef = React.useRef<string[]>([])
  
  // ✅ เก็บสถานะเกม BINGO
  const [bingoGameStatus, setBingoGameStatus] = React.useState<'waiting' | 'countdown' | 'playing' | 'finished' | null>(null)

  // ขั้นตอนที่ 1: โหลดข้อมูลเกมที่ตั้งค่าไว้แล้ว (ข้อมูลน้อย) - โหลดก่อน
  React.useEffect(() => {
    if (!isEdit) return
    
    // ✅ Clear cache เมื่อเปลี่ยน gameId เพื่อป้องกันการแสดงข้อมูลเกมผิด
    if (gameId) {
      dataCache.delete(`game:${gameId}`)
      console.log('[CreateGame] Cleared cache for gameId:', gameId)
    }
    
    // useEffect โหลดข้อมูลเกมทำงาน
    
    const loadGameData = async () => {
      setGameDataLoading(true)
      try {
        console.log('[CreateGame] Loading game data for gameId:', gameId)
        // ✅ ใช้ PostgreSQL adapter 100%
        // ✅ Force fetch (ไม่ใช้ cache) โดย clear cache ก่อน
        let gameData = await postgresqlAdapter.getGameData(gameId)
        console.log('[CreateGame] Raw game data:', gameData)
        console.log('[CreateGame] Is array:', Array.isArray(gameData))
        
        // ✅ แก้ไข: ถ้าเป็น array ให้เอาตัวแรก
        if (Array.isArray(gameData)) {
          console.warn('[CreateGame] getGameData returned array, taking first element')
          gameData = gameData.length > 0 ? gameData[0] : null
        }
        
        let g = (gameData || {}) as GameData
        let loadedGameId = g.id || (g as any).game_id || ''
        
        // ✅ ตรวจสอบว่า gameId ที่โหลดมาถูกต้องหรือไม่
        if (loadedGameId && loadedGameId !== gameId) {
          console.error('[CreateGame] ❌ Game ID mismatch!', {
            requested: gameId,
            loaded: loadedGameId,
            gameData: g
          })
          // ✅ ถ้า gameId ไม่ตรง ให้ clear cache และโหลดใหม่
          dataCache.delete(`game:${gameId}`)
          dataCache.delete(`game:${loadedGameId}`)
          // ✅ Retry 1 ครั้ง
          console.log('[CreateGame] Retrying with cache cleared...')
          gameData = await postgresqlAdapter.getGameData(gameId)
          if (Array.isArray(gameData)) {
            gameData = gameData.length > 0 ? gameData[0] : null
          }
          g = (gameData || {}) as GameData
          loadedGameId = g.id || (g as any).game_id || ''
          if (loadedGameId && loadedGameId !== gameId) {
            console.error('[CreateGame] ❌ Still wrong game ID after retry!', {
              requested: gameId,
              loaded: loadedGameId
            })
            alert(`เกิดข้อผิดพลาด: โหลดข้อมูลเกมผิด (ต้องการ: ${gameId}, ได้: ${loadedGameId})`)
            setGameDataLoading(false)
            return
          }
        }
        
        console.log('[CreateGame] ========== Game Data Loaded ==========')
        console.log('[CreateGame] Full game data:', JSON.stringify(g, null, 2))
        console.log('[CreateGame] Game data keys:', Object.keys(g))
        console.log('[CreateGame] Game ID:', loadedGameId)
        console.log('[CreateGame] Game type:', g.type)
        console.log('[CreateGame] Game name:', g.name || (g as any).title)
        console.log('[CreateGame] Has puzzle:', !!(g as any).puzzle)
        console.log('[CreateGame] Has loyKrathong:', !!(g as any).loyKrathong)
        console.log('[CreateGame] Has slot:', !!(g as any).slot)
        console.log('[CreateGame] Has trickOrTreat:', !!(g as any).trickOrTreat)
        console.log('[CreateGame] Has bingo:', !!(g as any).bingo)
        console.log('[CreateGame] Has numberPick:', !!(g as any).numberPick)
        console.log('[CreateGame] Has football:', !!(g as any).football)
        console.log('[CreateGame] Has checkin:', !!(g as any).checkin)
        console.log('[CreateGame] =======================================')
        
        if (!g || Object.keys(g).length === 0) {
          console.warn('[CreateGame] Game data is empty or null for gameId:', gameId)
          alert('ไม่พบข้อมูลเกม กรุณาตรวจสอบ gameId')
          setGameDataLoading(false)
          return
        }

        // map ค่าลง "หน้าเดิม"
        setType((g.type || 'เกมทายภาพปริศนา') as GameType)
        setName(g.name || (g as any).title || '')
        setClaimedBy((g as any).claimedBy || {})
        
        // โหลดข้อมูลสิทธิ์ USER เข้าเล่นเกม
        setUserAccessType((g.userAccessType || 'all') as 'all' | 'selected')
        setSelectedUsers(g.selectedUsers || [])
        
        console.log('[CreateGame] Setting type to:', g.type || 'เกมทายภาพปริศนา')
        console.log('[CreateGame] Setting name to:', g.name || (g as any).title || '')

      // ✅ ตรวจสอบ type ของเกมก่อน map ข้อมูล
      console.log('[CreateGame] Processing game type:', g.type)
      
      if (g.type === 'เกมทายภาพปริศนา' || (g as any).puzzle) {
        console.log('[CreateGame] Processing puzzle game')
        console.log('[CreateGame] puzzle object:', (g as any).puzzle)
        console.log('[CreateGame] codes:', (g as any).codes)
        console.log('[CreateGame] answer:', (g as any).puzzle?.answer, (g as any).answer)
        
        // ✅ รองรับทั้ง nested (puzzle.imageDataUrl) และ flat (imageDataUrl)
        const rawImageUrl = (g as any).puzzle?.imageDataUrl || (g as any).imageDataUrl || ''
        const rawAnswer = (g as any).puzzle?.answer || (g as any).answer || ''
        const rawCodes = (g as any).puzzle?.codes || (g as any).codes || []
        
        console.log('[CreateGame] Raw image URL:', rawImageUrl)
        console.log('[CreateGame] Raw answer:', rawAnswer)
        console.log('[CreateGame] Raw codes:', rawCodes)
        
        setImageDataUrl(rawImageUrl)
        setAnswer(rawAnswer)
        const arr: string[] = Array.isArray(rawCodes) ? rawCodes : []
        setCodes(arr.length ? arr : [''])
        setNumCodes(Math.max(1, arr.length || 1))
        // ✅ เก็บโค้ดเดิมไว้เพื่อเปรียบเทียบ
        originalCodesRef.current = arr.map(c => String(c || '').trim()).filter(Boolean)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if (g.type === 'เกมลอยกระทง' || (g as any).loyKrathong) {
        console.log('[CreateGame] Processing loyKrathong game')
        // โหลดค่าเกมลอยกระทง
        setImageDataUrl('')
        setEndAt(toLocalInput((g as any).loyKrathong?.endAt))
        const arr: string[] = Array.isArray((g as any).codes) ? (g as any).codes : []
        setCodes(arr.length ? arr : [''])
        setNumCodes(Math.max(1, arr.length || 1))
        // ✅ เก็บโค้ดเดิมไว้เพื่อเปรียบเทียบ
        originalLoyKrathongCodesRef.current = arr.map(c => String(c || '').trim()).filter(Boolean)
        
        // โหลดโค้ดรางวัลใหญ่
        const bigPrizeArr: string[] = Array.isArray((g as any).loyKrathong?.bigPrizeCodes) ? (g as any).loyKrathong.bigPrizeCodes : []
        setBigPrizeCodes(bigPrizeArr.length ? bigPrizeArr : [''])
        setNumBigPrizeCodes(Math.max(1, bigPrizeArr.length || 1))
        // ✅ เก็บโค้ดรางวัลใหญ่เดิมไว้เพื่อเปรียบเทียบ
        originalLoyKrathongBigPrizeCodesRef.current = bigPrizeArr.map(c => String(c || '').trim()).filter(Boolean)
        
        setAnswer('')
        setHomeTeam(''); setAwayTeam('')
      } else if (g.type === 'เกมทายเบอร์เงิน' || (g as any).numberPick) {
        console.log('[CreateGame] Processing numberPick game')
        setImageDataUrl((g as any).numberPick?.imageDataUrl || (g as any).imageDataUrl || '')
        setEndAt(toLocalInput((g as any).numberPick?.endAt || (g as any).endAt))
        setAnswer(''); setCodes(['']); setNumCodes(1)
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam('')
      } else if (g.type === 'เกมทายผลบอล' || (g as any).football) {
        console.log('[CreateGame] Processing football game')
        setImageDataUrl((g as any).football?.imageDataUrl || (g as any).imageDataUrl || '')
        setHomeTeam((g as any).football?.homeTeam || (g as any).homeTeam || '')
        setAwayTeam((g as any).football?.awayTeam || (g as any).awayTeam || '')
        setEndAt(toLocalInput((g as any).football?.endAt || (g as any).endAt))
        setAnswer(''); setCodes(['']); setNumCodes(1)
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
      } else if (g.type === 'เกมสล็อต' || (g as any).slot) {
        console.log('[CreateGame] Processing slot game')
        setSlot({
          startCredit: num((g as any).slot?.startCredit || (g as any).startCredit, 100),
          startBet: num((g as any).slot?.startBet || (g as any).startBet, 1),
          winRate: num((g as any).slot?.winRate || (g as any).winRate, 30),
          targetCredit: num((g as any).slot?.targetCredit || (g as any).targetCredit, 200),
          winTiers: (g as any).slot?.winTiers || (g as any).winTiers || undefined,
        })
        setImageDataUrl(''); setAnswer(''); setCodes(['']); setNumCodes(1)
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if (g.type === 'เกม Trick or Treat' || (g as any).trickOrTreat) {
        console.log('[CreateGame] Processing trickOrTreat game')
        // โหลดค่าเกม Trick or Treat
        setTrickOrTreatWinChance(num((g as any).trickOrTreat?.winChance || (g as any).winChance, 50))
        const arr: string[] = Array.isArray((g as any).codes) ? (g as any).codes : []
        setCodes(arr.length ? arr : [''])
        setNumCodes(Math.max(1, arr.length || 1))
        // ✅ เก็บโค้ดเดิมไว้เพื่อเปรียบเทียบ
        originalTrickOrTreatCodesRef.current = arr.map(c => String(c || '').trim()).filter(Boolean)
        
        // รีเซ็ต field ของประเภทอื่น
        setImageDataUrl(''); setAnswer('')
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if (g.type === 'เกม BINGO' || (g as any).bingo) {
        console.log('[CreateGame] Processing bingo game')
        // ✅ โหลดค่าเกม BINGO
        setMaxUsers(num((g as any).bingo?.maxUsers || (g as any).maxUsers, 50))
        // คำนวณจำนวนห้องจาก rooms object
        const roomsCount = ((g as any).bingo?.rooms || (g as any).rooms) ? Object.keys((g as any).bingo?.rooms || (g as any).rooms || {}).length : 1
        setNumRooms(roomsCount)
        const arr: string[] = Array.isArray((g as any).codes) ? (g as any).codes : []
        setCodes(arr.length ? arr : [''])
        setNumCodes(Math.max(1, arr.length || 1))
        // ✅ เก็บโค้ดเดิมไว้เพื่อเปรียบเทียบ
        originalBingoCodesRef.current = arr.map(c => String(c || '').trim()).filter(Boolean)
        
        // รีเซ็ต field ของประเภทอื่น
        setImageDataUrl(''); setAnswer('')
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if ((g as any).checkin) {
        // ✅ โหลดค่าเกมเช็คอิน (รวม date ถ้ามี)
        const gDays = Number((g as any).checkin?.days) || (Array.isArray((g as any).checkin?.rewards) ? (g as any).checkin.rewards.length : 1)
        const d = clamp(gDays, 1, 30)

        // ✅ ไม่โหลดโค้ดทั้งหมดมาเก็บใน state (เพื่อป้องกันหน่วง)
        const arr: CheckinReward[] = Array.from({ length: d }, (_, i) => {
          const r = (g as any).checkin?.rewards?.[i]
          if (!r) return { kind: 'coin', value: 1000 }
          const kind: 'coin' | 'code' = r.kind === 'code' ? 'code' : 'coin'
          // ✅ ถ้าเป็นโค้ด ให้เก็บเป็น string ว่าง (ไม่โหลดโค้ดทั้งหมด)
          const value = kind === 'coin' ? Number(r.value) || 0 : ''
          return { kind, value }
        })
        // ✅ เก็บรางวัลเดิมไว้เพื่อเปรียบเทียบ (ไม่เก็บโค้ดเพื่อลด memory)
        originalCheckinRewardsRef.current = arr.map(r => ({
          kind: r.kind,
          value: r.kind === 'code' ? '' : Number(r.value || 0)  // ✅ ไม่เก็บโค้ด
        }))
        
        // ✅ โหลดจำนวนโค้ดสำหรับ daily rewards (ไม่โหลดโค้ดทั้งหมด)
        const loadDailyRewardCodeCounts = async () => {
          setDailyRewardCodeCountsLoading(true)
          try {
            const counts = await Promise.all(
              arr.map(async (r, index) => {
                if (r.kind !== 'code') return 0
                try {
                  // ✅ ใช้ข้อมูลจาก game data ที่โหลดมาแล้ว (เก็บใน game_data JSONB)
                  const rewardCodesData = (g as any).checkin?.rewardCodes?.[index]
                  
                  // ✅ ตรวจสอบโค้ดใน rewardCodes/{index}/codes (ถ้ามี)
                  const codesFromDB = Array.isArray(rewardCodesData?.codes) ? rewardCodesData.codes : []
                  const countFromDB = codesFromDB.filter((c: any) => c && String(c).trim()).length
                  
                  // ✅ ตรวจสอบโค้ดใน rewards[i].value (ถ้าเป็น string ที่มีโค้ด)
                  const originalReward = (g as any).checkin?.rewards?.[index]
                  let countFromValue = 0
                  if (originalReward && originalReward.kind === 'code' && typeof originalReward.value === 'string') {
                    const codesString = String(originalReward.value || '')
                    const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
                    countFromValue = codes.length
                  }
                  
                  // ✅ ใช้ค่าที่มากกว่า (เพราะโค้ดอาจถูกย้ายไป DB แล้ว)
                  return Math.max(countFromDB, countFromValue)
                } catch {
                  // ✅ ถ้าเกิด error ให้ตรวจสอบจาก rewards[i].value
                  try {
                    const originalReward = (g as any).checkin?.rewards?.[index]
                    if (originalReward && originalReward.kind === 'code' && typeof originalReward.value === 'string') {
                      const codesString = String(originalReward.value || '')
                      const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
                      return codes.length
                    }
                  } catch {}
                  return 0
                }
              })
            )
            setDailyRewardCodeCounts(counts)
          } catch (error) {
            console.error('Error loading daily reward code counts:', error)
            setDailyRewardCodeCounts(arr.map(() => 0))
          } finally {
            setDailyRewardCodeCountsLoading(false)
          }
        }
        loadDailyRewardCodeCounts()
        
        // ✅ รีเซ็ต dailyRewardCodes, completeRewardCodes และ couponItemCodesNew เมื่อโหลดเกมใหม่
        setDailyRewardCodes([])
        setCompleteRewardCodes([])
        setCouponItemCodesNew([])
        
         // โหลดรูปภาพสำหรับเกมเช็คอิน
         setCheckinImageDataUrl((g as any).checkin?.imageDataUrl || '')
         setCheckinFileName((g as any).checkin?.fileName || '')
         setCheckinSlot({
           startBet: num((g as any).checkin?.slot?.startBet, 1),
           winRate:  num((g as any).checkin?.slot?.winRate, 30),
         })
         // ✅ โหลดรางวัลครบทุกวัน
         const completeR = (g as any).checkin?.completeReward
         if (completeR) {
           const kind: 'coin' | 'code' = completeR.kind === 'code' ? 'code' : 'coin'
           // ✅ ถ้าเป็นโค้ด ให้เก็บเป็น string ว่าง (ไม่โหลดโค้ดทั้งหมด)
           const value = kind === 'coin' ? Number(completeR.value) || 0 : ''
           setCompleteReward({ kind, value })
           // ✅ เก็บรางวัลครบทุกวันเดิมไว้เพื่อเปรียบเทียบ (ไม่เก็บโค้ดเพื่อลด memory)
           originalCheckinCompleteRewardRef.current = {
             kind,
             value: kind === 'code' ? '' : Number(value || 0)  // ✅ ไม่เก็บโค้ด
           }
           
           // ✅ โหลดจำนวนโค้ดสำหรับ complete reward (ไม่โหลดโค้ดทั้งหมด)
           if (kind === 'code') {
             const loadCompleteRewardCodeCount = async () => {
               setCompleteRewardCodeCountLoading(true)
               try {
                 // ✅ ตรวจสอบทั้งสองที่: completeRewardCodes/codes (ถ้ามีใน DB) และ completeReward.value (ถ้าเป็น string)
                 // ✅ ใช้ข้อมูลจาก game data ที่โหลดมาแล้ว (เก็บใน game_data JSONB)
                 const completeRewardCodesData = (g as any).checkin?.completeRewardCodes
                 
                 // ✅ ตรวจสอบโค้ดใน completeRewardCodes/codes (ถ้ามี)
                 const codesFromDB = Array.isArray(completeRewardCodesData?.codes) ? completeRewardCodesData.codes : []
                 const countFromDB = codesFromDB.filter((c: any) => c && String(c).trim()).length
                 
                 // ✅ ตรวจสอบโค้ดใน completeReward.value (ถ้าเป็น string ที่มีโค้ด)
                 let countFromValue = 0
                 if (completeR && completeR.kind === 'code' && typeof completeR.value === 'string') {
                   const codesString = String(completeR.value || '')
                   const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
                   countFromValue = codes.length
                 }
                 
                 // ✅ ใช้ค่าที่มากกว่า (เพราะโค้ดอาจถูกย้ายไป DB แล้ว)
                 setCompleteRewardCodeCount(Math.max(countFromDB, countFromValue))
               } catch (error) {
                 console.error('Error loading complete reward code count:', error)
                 // ✅ ถ้าเกิด error ให้ตรวจสอบจาก completeReward.value
                 try {
                   if (completeR && completeR.kind === 'code' && typeof completeR.value === 'string') {
                     const codesString = String(completeR.value || '')
                     const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
                     setCompleteRewardCodeCount(codes.length)
                   } else {
                     setCompleteRewardCodeCount(0)
                   }
                 } catch {
                   setCompleteRewardCodeCount(0)
                 }
               } finally {
                 setCompleteRewardCodeCountLoading(false)
               }
             }
             loadCompleteRewardCodeCount()
           } else {
             setCompleteRewardCodeCount(0)
           }
         } else {
           setCompleteReward({ kind: 'coin', value: 0 })
           originalCheckinCompleteRewardRef.current = { kind: 'coin', value: 0 }
           setCompleteRewardCodeCount(0)
         }
         // ✅ โหลดวันที่เริ่มต้นและสิ้นสุดกิจกรรม
         const startDate = (g as any).checkin?.startDate || ''
         const endDate = (g as any).checkin?.endDate || ''
         setCheckinStartDate(startDate)
         setCheckinEndDate(endDate)
         
         // ✅ ถ้ามีวันที่เริ่มต้นและสิ้นสุด ให้คำนวณจำนวนวันอัตโนมัติ
         if (startDate && endDate) {
           const calculatedDays = calculateDaysFromDates(startDate, endDate)
           if (calculatedDays > 0 && calculatedDays <= 30) {
             // ใช้จำนวนวันที่คำนวณได้แทนจำนวนวันที่เก็บไว้
             const finalDays = calculatedDays
             setCheckinDays(finalDays)
             // ปรับ rewards ให้มีจำนวนตาม calculatedDays
             const normalizedRewards = arr.slice(0, finalDays).map((r, i) => {
               // ใช้ข้อมูลที่มีอยู่ก่อน หรือสร้างใหม่ถ้าไม่มี
               return arr[i] || { kind: 'coin' as const, value: 100 }
             })
             // ถ้ามีน้อยกว่า finalDays ให้เพิ่ม
             if (normalizedRewards.length < finalDays) {
               while (normalizedRewards.length < finalDays) {
                 normalizedRewards.push({ kind: 'coin', value: 100 })
               }
             }
             setRewards(normalizedRewards)
           } else {
             // ถ้าคำนวณไม่ได้ หรือเกิน 30 วัน ให้ใช้ค่าที่มีอยู่
             setCheckinDays(d)
             setRewards(arr)
           }
         } else {
           // ถ้าไม่มีวันที่เริ่มต้นและสิ้นสุด ให้ใช้ค่าที่มีอยู่
           setCheckinDays(d)
           setRewards(arr)
         }
         
         // ✅ โหลดการตั้งค่าเปิด/ปิดส่วนต่างๆ
         setCheckinFeatures({
           dailyReward: normalizeFeatureFlag((g as any).checkin?.features?.dailyReward, true),
           miniSlot: normalizeFeatureFlag((g as any).checkin?.features?.miniSlot, true),
           couponShop: normalizeFeatureFlag((g as any).checkin?.features?.couponShop, true)
         })

        const couponArr = (g as any).checkin?.coupon?.items;
        if (Array.isArray(couponArr) && couponArr.length) {
          setCouponCount(couponArr.length);
          // ✅ ไม่โหลด codes ทั้งหมดมาเก็บใน state (เพื่อป้องกันหน่วง)
          const mappedCouponItems = couponArr.map((it: any) => ({
            title: typeof it?.title === 'string' ? it.title : '',
            rewardCredit: Number(it?.rewardCredit) || 0,
            price: Number(it?.price) || 0,
            codes: [''],  // ✅ เก็บเป็น array ว่าง ไม่โหลดโค้ดทั้งหมด
          }))
          setCouponItems(mappedCouponItems)
          
          // ✅ โหลดจำนวนโค้ดสำหรับแต่ละ item (ไม่โหลดโค้ดทั้งหมด)
          const loadCodeCounts = async () => {
            setCouponItemCodeCountsLoading(true)
            try {
              const counts = await Promise.all(
                mappedCouponItems.map(async (_, index) => {
                  try {
                    // ✅ ใช้ข้อมูลจาก game data ที่โหลดมาแล้ว (เก็บใน game_data JSONB)
                    const codesData = (g as any).checkin?.coupon?.items?.[index]
                    const codes = codesData?.codes
                    return Array.isArray(codes) ? codes.filter((c: any) => c && String(c).trim()).length : 0
                  } catch {
                    return 0
                  }
                })
              )
              setCouponItemCodeCounts(counts)
            } catch (error) {
              console.error('Error loading coupon code counts:', error)
              setCouponItemCodeCounts(mappedCouponItems.map(() => 0))
            } finally {
              setCouponItemCodeCountsLoading(false)
            }
          }
          loadCodeCounts()
          
          // ✅ เก็บคูปองเดิมไว้เพื่อเปรียบเทียบ (ไม่เก็บ codes เพื่อลด memory)
          originalCheckinCouponItemsRef.current = mappedCouponItems.map(it => ({
            title: it.title,
            rewardCredit: it.rewardCredit,
            price: it.price,
            codes: []  // ✅ ไม่เก็บ codes เพื่อลด memory
          }))
        } else {
          setCouponCount(1);
          setCouponItems(Array.from({ length: 1 }).map((_, i) => ({
            title: '',
            rewardCredit: [5000,25000,50000,100000,165000,300000][i] ?? 5000,
            price:        [10,50,100,200,300,500][i] ?? 10,
            codes: [''],
          })));
          setCouponItemCodeCounts([0]);
        }

        // รีเซ็ต field ของประเภทอื่น
        setImageDataUrl('')
        setAnswer('')
        setCodes(['']); setNumCodes(1)
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else if ((g as any).announce) {
        // ✅ โหลดค่าเกมประกาศรางวัล
        const users: string[] = Array.isArray((g as any).announce?.users) ? (g as any).announce.users : []
        const userBonuses: Array<{ user: string; bonus: number }> = Array.isArray((g as any).announce?.userBonuses) ? (g as any).announce.userBonuses : []
        
        setAnnounceUsers(users)
        setAnnounceUserBonuses(userBonuses)
        setAnnounceImageDataUrl((g as any).announce?.imageDataUrl || '')
        setAnnounceFileName((g as any).announce?.fileName || '')
        
        // รีเซ็ต field ของประเภทอื่น
        setImageDataUrl('')
        setAnswer('')
        setCodes(['']); setNumCodes(1)
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      } else {
        // fallback
        setImageDataUrl(''); setAnswer(''); setCodes(['']); setNumCodes(1)
        setBigPrizeCodes(['']); setNumBigPrizeCodes(1)
        setHomeTeam(''); setAwayTeam(''); setEndAt('')
      }
    } catch (error) {
        console.error('Error loading game data:', error)
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูลเกม')
      } finally {
        setGameDataLoading(false)
      }
    }

    loadGameData()
  }, [isEdit, gameId, reloadTrigger])

  // ✅ ดึงสถานะเกม BINGO
  React.useEffect(() => {
    if (!isEdit || type !== 'เกม BINGO') {
      setBingoGameStatus(null)
      return
    }

    // ✅ ใช้ PostgreSQL adapter - polling แทน realtime listener
    const pollBingoStatus = async () => {
      try {
        const gameState = await postgresqlAdapter.getBingoGameState(gameId)
        if (gameState && (gameState.status || gameState.gamePhase)) {
          setBingoGameStatus(gameState.status || gameState.gamePhase)
        } else {
          setBingoGameStatus('waiting')
        }
      } catch (error) {
        console.error('Error loading bingo game state:', error)
        setBingoGameStatus('waiting')
      }
    }

    // Poll immediately
    pollBingoStatus()

    // Poll every 2 seconds
    const interval = setInterval(pollBingoStatus, 2000)

    return () => {
      clearInterval(interval)
    }
  }, [isEdit, gameId, type])

  // ✅ State สำหรับควบคุมว่าโหลด answers หรือยัง (lazy loading)
  const [shouldLoadAnswers, setShouldLoadAnswers] = React.useState(false)
  const answersLoadedRef = React.useRef(false) // ✅ ใช้ ref เพื่อ track ว่าโหลดแล้วหรือยัง

  // ✅ ฟังก์ชันสำหรับโหลด answers (เรียกเมื่อต้องการ)
  const loadGameAnswersData = React.useCallback(async () => {
    if (!isEdit || !gameId) return // ✅ ไม่ต้อง check answersLoadedRef.current เพราะจะใช้ Socket.io update
    
    setAnswersDataLoading(true)
    try {
        // Use PostgreSQL adapter if available
        // ✅ ใช้ PostgreSQL adapter 100%
        // ✅ เพิ่ม limit เป็น 10000 เพื่อแสดงคำตอบทั้งหมด (สำหรับหน้าแก้ไขเกม)
        const answersList = await postgresqlAdapter.getAnswers(gameId, 10000) || []

      // Convert to AnswerRow format
      const rows: AnswerRow[] = answersList.map((item) => {
        // ✅ แปลง user field และ trim เพื่อให้แน่ใจว่าไม่มีช่องว่าง
        const user = (item.userId || item.user || item.username || item.name || '').trim()
        const ans = item.answer || item.value || item.text || ''
        const ts = item.ts || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now())
        
        let isCorrect: boolean | undefined
        let code: string | undefined
        
        if (type === 'เกมทายภาพปริศนา') {
          isCorrect = item.correct !== undefined ? item.correct : (clean(ans) === clean(answer))
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        } else if (type === 'เกม Trick or Treat' || type === 'เกมลอยกระทง') {
          isCorrect = item.correct !== undefined ? item.correct : ((item as any).won === true || typeof item.code === 'string')
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        } else {
          isCorrect = item.correct
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        }

        return {
          ts,
          user,
          answer: ans,
          correct: isCorrect,
          code,
        }
      })

      rows.sort((a, b) => b.ts - a.ts)
      
      setAnswers(rows)
      answersLoadedRef.current = true // ✅ Mark as loaded
    } catch (error) {
      console.error('Error loading game answers data:', error)
      answersLoadedRef.current = false // ✅ Reset ถ้า error
    } finally {
      setAnswersDataLoading(false)
    }
  }, [isEdit, gameId, type, answer, claimedBy])
  
  // ✅ Real-time updates via Socket.io
  React.useEffect(() => {
    if (!isEdit || !gameId || !shouldLoadAnswers) return
    
    const socket = getSocketIO()
    
    if (!socket) return
    
    // Subscribe to answers updates (ใช้ themeName จาก useTheme)
    subscribeAnswers(socket, gameId, themeName)
    
    // Listen for answer updates
    const handleAnswerUpdate = (payload: { gameId: string; answers?: any[] }) => {
      if (payload.gameId !== gameId) return
      
      console.log('[CreateGame] Received answer update via Socket.io:', payload)
      
      if (payload.answers && Array.isArray(payload.answers)) {
        // Convert to AnswerRow format
        const rows: AnswerRow[] = payload.answers.map((item: any) => {
          const user = (item.userId || item.user || item.username || item.name || '').trim()
          const ans = typeof item.answer === 'object' ? (item.answer.text || item.answer.answer || '') : (item.answer || item.value || item.text || '')
          const ts = item.ts || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now())
          
          let isCorrect: boolean | undefined
          let code: string | undefined
          
          if (type === 'เกมทายภาพปริศนา') {
            isCorrect = item.correct !== undefined ? item.correct : (clean(ans) === clean(answer))
            code = item.code ?? undefined
          } else if (type === 'เกม Trick or Treat' || type === 'เกมลอยกระทง') {
            isCorrect = item.correct !== undefined ? item.correct : ((item as any).won === true || typeof item.code === 'string')
            code = item.code ?? undefined
          } else {
            isCorrect = item.correct
            code = item.code ?? undefined
          }

          return {
            ts,
            user,
            answer: ans,
            correct: isCorrect,
            code,
          }
        })

        rows.sort((a, b) => b.ts - a.ts)
        setAnswers(rows)
      }
    }
    
    socket.on('answer:updated', handleAnswerUpdate)
    
    return () => {
      socket.off('answer:updated', handleAnswerUpdate)
    }
  }, [isEdit, gameId, shouldLoadAnswers, type, answer, themeName])

  // ✅ โหลด answers เฉพาะเมื่อ shouldLoadAnswers = true (lazy loading)
  // ✅ ใช้ Socket.io สำหรับ real-time updates (จะอัพเดตอัตโนมัติ)
  // ✅ Fallback ไปที่ API ถ้า Socket.io ยังไม่พร้อม
  React.useEffect(() => {
    if (!isEdit || gameDataLoading || !shouldLoadAnswers) return
    
    // ✅ โหลดจาก API ครั้งแรก (Socket.io จะอัพเดตอัตโนมัติเมื่อมีคำตอบใหม่)
    loadGameAnswersData()
  }, [isEdit, gameId, type, answer, claimedBy, gameDataLoading, shouldLoadAnswers, loadGameAnswersData])

  // ✅ Reset shouldLoadAnswers และ answersLoadedRef เมื่อเปลี่ยน gameId
  React.useEffect(() => {
    setShouldLoadAnswers(false)
    setAnswers([])
    answersLoadedRef.current = false
  }, [gameId])

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
      `เกม: ${name || '-'}\nประเภท: ${type}\nลิงก์: ${getPlayerLink(gameId)}\nรวมทั้งหมด: ${answers.length} รายการ\n\n`
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

  // ฟังก์ชันรีเฟรชคำตอบ (สำหรับปุ่มรีเฟรช)
  const refreshAnswers = React.useCallback(async () => {
    if (!isEdit) return

    // ✅ Reset และโหลด answers ใหม่
    answersLoadedRef.current = false
    setAnswersDataLoading(true)
    try {
      // Use PostgreSQL adapter if available
      let answersList: any[] = []
      try {
        // ✅ เพิ่ม limit เป็น 10000 เพื่อแสดงคำตอบทั้งหมด
        answersList = await postgresqlAdapter.getAnswers(gameId, 10000) || []
        answersLoadedRef.current = true
      } catch (error) {
        console.error('Error loading answers from PostgreSQL:', error)
        answersList = []
        answersLoadedRef.current = false
      }

      // Convert to AnswerRow format
      const rows: AnswerRow[] = answersList.map((item) => {
        // ✅ แปลง user field และ trim เพื่อให้แน่ใจว่าไม่มีช่องว่าง
        const user = (item.userId || item.user || item.username || item.name || '').trim()
        const ans = item.answer || item.value || item.text || ''
        const ts = item.ts || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now())
        
        let isCorrect: boolean | undefined
        let code: string | undefined
        
        if (type === 'เกมทายภาพปริศนา') {
          isCorrect = item.correct !== undefined ? item.correct : (clean(ans) === clean(answer))
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        } else if (type === 'เกม Trick or Treat') {
          // สำหรับ Trick or Treat ใช้ won field
          isCorrect = item.correct !== undefined ? item.correct : (item.won === true)
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        } else if (type === 'เกมลอยกระทง') {
          // เกมลอยกระทง: ผู้ที่ได้รับโค้ดถือว่าได้รางวัล
          isCorrect = item.correct !== undefined ? item.correct : (typeof item.code === 'string' && item.code.length > 0)
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        } else {
          isCorrect = item.correct
          // ✅ เก็บโค้ดจากคำตอบเดิมไว้เสมอ (ไม่ลบโค้ดเก่า)
          code = item.code ?? undefined
        }

        return {
          ts,
          user,
          answer: ans,
          correct: isCorrect,
          code,
          // เพิ่มข้อมูลสำหรับ Trick or Treat
          ...(type === 'เกม Trick or Treat' && {
            won: item.won,
            cardSelected: item.cardSelected
          })
        }
      })

      rows.sort((a, b) => b.ts - a.ts)
      
      setAnswers(rows)
    } catch (error) {
      console.error('Error refreshing answers:', error)
    } finally {
      setAnswersDataLoading(false)
    }
  }, [isEdit, gameId, type, answer, claimedBy])

  // ✅ Cleanup preview URLs เมื่อ component unmount
  React.useEffect(() => {
    return () => {
      // Cleanup preview URLs (blob URLs)
      if (imageDataUrl && imageDataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imageDataUrl)
      }
      if (checkinImageDataUrl && checkinImageDataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(checkinImageDataUrl)
      }
      if (announceImageDataUrl && announceImageDataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(announceImageDataUrl)
      }
    }
  }, [imageDataUrl, checkinImageDataUrl, announceImageDataUrl])

  // ✅ เลือกรูปภาพ (เก็บ File object ไว้ รออัปโหลดตอนสร้างเกม)
  const onPickImage: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/^image\//.test(f.type)) { alert('โปรดเลือกไฟล์รูปภาพ'); return }
    
    // ✅ Cleanup preview URL เก่า (ถ้ามี)
    if (imageDataUrl && imageDataUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageDataUrl)
    }
    
    setFileName(f.name)
    setImageFile(f) // ✅ เก็บ File object ไว้
    
    // ✅ สร้าง preview URL จาก File object (ไม่ต้องอัปโหลดทันที)
    try {
      const previewUrl = URL.createObjectURL(f)
      setImageDataUrl(previewUrl) // ใช้สำหรับ preview เท่านั้น
    } catch (error) {
      console.error('Error creating preview URL:', error)
      // Fallback: ใช้ fileToDataURL
      const data = await fileToDataURL(f)
      setImageDataUrl(data)
    }
  }

  // เงื่อนไขแสดง UI เฉพาะประเภท
  const showPuzzle = type === 'เกมทายภาพปริศนา'
  const showNumberPick = type === 'เกมทายเบอร์เงิน'
  const showFootball = type === 'เกมทายผลบอล'
  const showSlot = type === 'เกมสล็อต'
  const showCodes = showPuzzle || type === 'เกม Trick or Treat' || type === 'เกม BINGO'
  const showImagePicker = needImage(type)
  const showCheckin = type === 'เกมเช็คอิน'
  const showTrickOrTreat = type === 'เกม Trick or Treat'
  const showLoyKrathong = type === 'เกมลอยกระทง'
  const showBingo = type === 'เกม BINGO'

  // ===== รีเกม BINGO =====
  const resetBingoGame = async () => {
    if (!gameId || type !== 'เกม BINGO') return
    
    if (!confirm('คุณแน่ใจว่าต้องการรีเกม BINGO นี้หรือไม่?\n\nการรีเกมจะลบผู้เล่น ข้อมูลเกม และข้อความแชททั้งหมด\nและตั้งค่าเกมกลับเป็นสถานะเริ่มต้น')) {
      return
    }

    try {
      // ✅ ใช้ PostgreSQL adapter - สร้าง bingo ใหม่ด้วยข้อมูลเต็มรูปแบบ
      const newBingoData = {
        maxUsers: maxUsers,
        codes: codes.map((c) => c.trim()).filter(Boolean),
        players: {},
        status: 'waiting',
        gameState: {
          status: 'waiting',
          calledNumbers: [],
          currentNumber: null,
          gameStarted: false,
          gameEnded: false,
          winner: null,
          winnerCardId: null,
          finishedAt: null
        },
        rooms: {}
      }
      // ✅ ใช้ PostgreSQL adapter - update game with new bingo data
      const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
      await postgresqlAdapter.updateGame(gameId, {
        ...currentGame,
        gameData: {
          ...(currentGame as any).gameData,
          bingo: newBingoData
        }
      })
      
      // Invalidate cache after resetting game
      dataCache.invalidateGame(gameId)
      
      alert('รีเกม BINGO เรียบร้อยแล้ว\n\nเกมและข้อความแชทถูกรีเซ็ตเป็นสถานะเริ่มต้นแล้ว\nกรุณารีเฟรชหน้าเกมเพื่อดูผลลัพธ์')
    } catch (error) {
      console.error('Error resetting BINGO game:', error)
      alert('เกิดข้อผิดพลาดในการรีเกม\nกรุณาลองใหม่อีกครั้ง')
    }
  }

  // ===== submit =====
  const submit = async () => {
    // ป้องกันการคลิกซ้ำ
    if (isSaving) return
    
    // ✅ ตรวจสอบชื่อเกมอย่างเข้มงวด - ต้องมีชื่อและไม่เป็น whitespace เท่านั้น
    const trimmedName = (name || '').trim()
    if (!trimmedName || trimmedName.length === 0) { 
      alert('กรุณาระบุชื่อเกม'); 
      return 
    }
    if (needImage(type) && !imageDataUrl) { alert('ประเภทเกมนี้ต้องเลือกรูปภาพก่อน'); return }
    if (type === 'เกมทายภาพปริศนา' && !answer.trim()) {
      alert('กรุณากำหนดคำตอบที่ถูกต้อง'); return
    }
    
    // ✅ ตรวจสอบบังคับกรอกโค้ดสำหรับเกมที่ต้องมีโค้ด
    if (showCodes) {
      const validCodes = codes.map((c) => c.trim()).filter(Boolean)
      if (validCodes.length === 0) {
        alert('กรุณากรอกโค้ดรางวัลอย่างน้อย 1 โค้ด')
        return
      }
    }
    
    // ตรวจสอบเงื่อนไขสำหรับ ACTIVE USER
    if (userAccessType === 'selected' && (!selectedUsers || selectedUsers.length === 0)) {
      alert('กรุณาอัพโหลดรายชื่อ USER เมื่อเลือก ACTIVE USER'); return
    }
    
    setIsSaving(true)

    // ✅ อัปโหลดรูปภาพก่อนบันทึกเกม (ถ้ามีไฟล์ใหม่)
    let finalImageDataUrl = imageDataUrl // ใช้ URL เดิม (ถ้าเป็น CDN URL หรือ data URL จาก edit)
    let finalCheckinImageDataUrl = checkinImageDataUrl
    let finalAnnounceImageDataUrl = announceImageDataUrl
    
    // อัปโหลดรูปภาพหลัก (games)
    if (imageFile) {
      setImageUploading(true)
      try {
        const cdnUrl = await uploadImageToStorage(imageFile, 'games')
        finalImageDataUrl = cdnUrl
        console.log('Image uploaded successfully, CDN URL:', cdnUrl)
        
        // ✅ Cleanup preview URL (ถ้าเป็น object URL)
        if (imageDataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(imageDataUrl)
        }
        
        setImageDataUrl(cdnUrl)
        setImageFile(null)
      } catch (error) {
        console.error('Error uploading image:', error)
        setIsSaving(false)
        setImageUploading(false)
        alert(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      } finally {
        setImageUploading(false)
      }
    }
    
    // อัปโหลดรูปภาพ checkin
    if (checkinImageFile) {
      setCheckinImageUploading(true)
      try {
        const cdnUrl = await uploadImageToStorage(checkinImageFile, 'checkin')
        finalCheckinImageDataUrl = cdnUrl
        console.log('Checkin image uploaded successfully, CDN URL:', cdnUrl)
        
        if (checkinImageDataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(checkinImageDataUrl)
        }
        
        setCheckinImageDataUrl(cdnUrl)
        setCheckinImageFile(null)
      } catch (error) {
        console.error('Error uploading checkin image:', error)
        setIsSaving(false)
        setCheckinImageUploading(false)
        alert(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพเช็คอิน: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      } finally {
        setCheckinImageUploading(false)
      }
    }
    
    // อัปโหลดรูปภาพ announce
    if (announceImageFile) {
      setAnnounceImageUploading(true)
      try {
        const cdnUrl = await uploadImageToStorage(announceImageFile, 'announce')
        finalAnnounceImageDataUrl = cdnUrl
        console.log('Announce image uploaded successfully, CDN URL:', cdnUrl)
        
        if (announceImageDataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(announceImageDataUrl)
        }
        
        setAnnounceImageDataUrl(cdnUrl)
        setAnnounceImageFile(null)
      } catch (error) {
        console.error('Error uploading announce image:', error)
        setIsSaving(false)
        setAnnounceImageUploading(false)
        alert(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพประกาศ: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      } finally {
        setAnnounceImageUploading(false)
      }
    }

    const saveUnlocked = true

    // ✅ ประกาศ couponItemCodes ไว้ข้างนอกเพื่อให้ใช้ได้ใน scope ที่ต้องการ
    let couponItemCodes: string[][] = []

    // payload พื้นฐาน
    const base: any = {
      type,
      name: trimmedName, // ใช้ trimmedName ที่ตรวจสอบแล้ว
      userAccessType,
    }
    
    // จัดการ selectedUsers ตาม userAccessType
    if (userAccessType === 'selected' && selectedUsers && selectedUsers.length > 0) {
      base.selectedUsers = selectedUsers
    } else {
      // เคลียร์ selectedUsers เมื่อเปลี่ยนเป็น 'all'
      base.selectedUsers = null
    }

    if (type === 'เกมทายภาพปริศนา') {
      base.puzzle = { imageDataUrl: finalImageDataUrl, answer: answer.trim() }
      const newCodes = codes.map((c) => c.trim()).filter(Boolean)
      base.codes = newCodes
      
      // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่
      const oldCodes = originalCodesRef.current
      const codesChanged = JSON.stringify(oldCodes) !== JSON.stringify(newCodes)
      
      // ✅ ถ้าโค้ดเปลี่ยนไป ให้ reset cursor และ codesVersion
      if (codesChanged || !isEdit) {
        base.codeCursor = 0
        base.claimedBy = null
        base.codesVersion = Date.now()
      }
      // ✅ ถ้าโค้ดไม่เปลี่ยน ไม่ต้อง reset cursor และ codesVersion (จะใช้ค่าที่มีอยู่)
      
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
    }

    if (type === 'เกมลอยกระทง') {
      const newCodes = codes.map((c) => c.trim()).filter(Boolean)
      const newBigPrizeCodes = bigPrizeCodes.map((c) => c.trim()).filter(Boolean)
      
      // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่
      const oldCodes = originalLoyKrathongCodesRef.current
      const oldBigPrizeCodes = originalLoyKrathongBigPrizeCodesRef.current
      const codesChanged = JSON.stringify(oldCodes) !== JSON.stringify(newCodes)
      const bigPrizeCodesChanged = JSON.stringify(oldBigPrizeCodes) !== JSON.stringify(newBigPrizeCodes)
      
      base.loyKrathong = { 
        imageDataUrl: '', 
        endAt: endAt ? new Date(endAt).getTime() : null,
        codes: newCodes,
        codeCursor: (codesChanged || !isEdit) ? 0 : undefined, // ✅ ถ้าโค้ดไม่เปลี่ยน ไม่ต้อง reset
        claimedBy: (codesChanged || !isEdit) ? null : undefined,
        bigPrizeCodes: newBigPrizeCodes,
        bigPrizeCodeCursor: (bigPrizeCodesChanged || !isEdit) ? 0 : undefined, // ✅ ถ้าโค้ดไม่เปลี่ยน ไม่ต้อง reset
        bigPrizeClaimedBy: (bigPrizeCodesChanged || !isEdit) ? null : undefined,
        playerCount: 0
      }
      base.puzzle     = null
      base.codes      = newCodes
      base.codeCursor = (codesChanged || !isEdit) ? 0 : undefined
      base.claimedBy  = (codesChanged || !isEdit) ? null : undefined
      base.football   = null
      base.slot       = null
      base.numberPick = null
      base.checkin    = base.checkin || {}
      base.codesVersion = null
    }


    if (type === 'เกมทายเบอร์เงิน') {
      base.numberPick = { imageDataUrl: finalImageDataUrl, endAt: endAt ? new Date(endAt).getTime() : null }
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
      base.codesVersion = null
    }

    if (type === 'เกมทายผลบอล') {
      base.football = {
        imageDataUrl: finalImageDataUrl,
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
      base.codesVersion = null
    }

    if (type === 'เกมสล็อต') {
      base.slot = {
        startCredit: num(slot.startCredit, 0),
        startBet: num(slot.startBet, 1),
        winRate: num(slot.winRate, 0),
        targetCredit: num(slot.targetCredit, 0),
        ...(slot.winTiers ? { winTiers: slot.winTiers } : {}),
      }
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.checkin    = base.checkin || {}
      base.codesVersion = null
    }

    if (type === 'เกมประกาศรางวัล') {
      base.announce = { 
        users: announceUsers,
        userBonuses: announceUserBonuses,
        imageDataUrl: finalAnnounceImageDataUrl || undefined,
        fileName: announceFileName || undefined
      }
      // เคลียร์ field ประเภทอื่น ๆ กันค้าง
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
      base.codesVersion = null
    }

    if (type === 'เกม Trick or Treat') {
      base.trickOrTreat = { winChance: trickOrTreatWinChance }
      const newCodes = codes.map((c) => c.trim()).filter(Boolean)
      base.codes = newCodes
      
      // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่
      const oldCodes = originalTrickOrTreatCodesRef.current
      const codesChanged = JSON.stringify(oldCodes) !== JSON.stringify(newCodes)
      
      // ✅ ถ้าโค้ดเปลี่ยนไป ให้ reset cursor
      if (codesChanged || !isEdit) {
        base.codeCursor = 0
        base.claimedBy = null
      }
      // ✅ ถ้าโค้ดไม่เปลี่ยน ไม่ต้อง reset cursor (จะใช้ค่าที่มีอยู่)
      
      // เคลียร์ field ประเภทอื่น ๆ กันค้าง
      base.puzzle     = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
      base.codesVersion = null
    }

    if (type === 'เกม BINGO') {
      // ❌ ไม่ต้องตั้ง base.bingo เพราะเราจะลบและสร้างใหม่ในส่วน isEdit อยู่แล้ว
      // ไม่เช่นนั้น update() จะเขียน bingo object ที่ไม่สมบูรณ์ลงไป
      const newCodes = codes.map((c) => c.trim()).filter(Boolean)
      base.codes = newCodes
      
      // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่
      const oldCodes = originalBingoCodesRef.current
      const codesChanged = JSON.stringify(oldCodes) !== JSON.stringify(newCodes)
      
      // ✅ ถ้าโค้ดเปลี่ยนไป ให้ reset cursor
      if (codesChanged || !isEdit) {
        base.codeCursor = 0
        base.claimedBy = null
      }
      // ✅ ถ้าโค้ดไม่เปลี่ยน ไม่ต้อง reset cursor (จะใช้ค่าที่มีอยู่)
      
      // เคลียร์ field ประเภทอื่น ๆ กันค้าง
      base.puzzle     = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.checkin    = base.checkin || {}
      base.codesVersion = null
    }

    // ✅ ประกาศ cleanCouponItems ไว้ข้างนอกเพื่อให้ใช้ได้ใน scope ที่ต้องการ
    let cleanCouponItems: Array<{ title: string; rewardCredit: number; price: number }> = []
    
    if (type === 'เกมเช็คอิน') {
      // ✅ ทำ rewards ให้สะอาดและมีเท่าที่กำหนดวัน (ไม่ใช้ date แล้ว)
      const normalized: CheckinReward[] = rewards.slice(0, checkinDays).map((r) =>
        r.kind === 'coin'
          ? ({ kind: 'coin', value: Math.max(0, Number(r.value) || 0) })
          : ({ kind: 'code', value: String(r.value || '').trim() })
      )
      // ✅ แยก codes ออกจาก items เพื่อป้องกัน write_too_big error
      cleanCouponItems = couponItems.slice(0, couponCount).map((it) => ({
        title: (it.title || '').trim(),
        rewardCredit: Math.max(0, Number(it.rewardCredit) || 0),
        price: Math.max(0, Number(it.price) || 0),
        // ✅ ไม่เก็บ codes ใน items เพื่อป้องกัน write_too_big (จะเก็บแยกใน items/{index}/codes)
      }));
      
      // ✅ เก็บ codes แยกสำหรับแต่ละ item (ใช้โค้ดที่อัพโหลดใหม่ถ้ามี)
      couponItemCodes = couponItems.slice(0, couponCount).map((it, index) => {
        // ✅ ถ้ามีโค้ดที่อัพโหลดใหม่ ให้ใช้โค้ดใหม่
        if (couponItemCodesNew[index] && couponItemCodesNew[index].length > 0) {
          return couponItemCodesNew[index]
        }
        // ✅ ถ้าไม่มี ให้ใช้โค้ดจาก couponItems (ถ้ามี)
        return (it.codes || []).map(c => String(c || '').trim()).filter(Boolean)
      });
         // ✅ ทำ completeReward ให้สะอาด
         const normalizedCompleteReward: CheckinReward = 
           completeReward.kind === 'coin'
             ? ({ kind: 'coin', value: Math.max(0, Number(completeReward.value) || 0) })
             : ({ kind: 'code', value: String(completeReward.value || '').trim() })
         
         // ✅ ตรวจสอบการเปลี่ยนแปลงโค้ดสำหรับเกมเช็คอิน
         const oldRewards = originalCheckinRewardsRef.current || []
         const oldCompleteReward = originalCheckinCompleteRewardRef.current
         const oldCouponItems = originalCheckinCouponItemsRef.current || []
         
         // ✅ ตรวจสอบว่าโค้ดใน daily rewards เปลี่ยนไปหรือไม่
         // ✅ ถ้ามีโค้ดใหม่ที่อัพโหลด (ใน dailyRewardCodes) ให้ถือว่าเปลี่ยน
         // ✅ ถ้าไม่มีโค้ดใหม่ (เป็น array ว่าง) ให้ถือว่าไม่เปลี่ยน (ใช้โค้ดเดิมใน DB)
         const rewardsChanged = dailyRewardCodes.some((codes) => {
           return codes && codes.length > 0  // ถ้ามีโค้ดใหม่ที่อัพโหลด ถือว่าเปลี่ยน
         })
         
         // ✅ ตรวจสอบว่าโค้ดใน complete reward เปลี่ยนไปหรือไม่
         // ✅ ถ้ามีโค้ดใหม่ที่อัพโหลด (ใน completeRewardCodes) ให้ถือว่าเปลี่ยน
         // ✅ ถ้าไม่มีโค้ดใหม่ (เป็น array ว่าง) ให้ถือว่าไม่เปลี่ยน (ใช้โค้ดเดิมใน DB)
         const completeRewardChanged = normalizedCompleteReward.kind === 'code' && completeRewardCodes.length > 0
         
         // ✅ ตรวจสอบว่าโค้ดใน coupon items เปลี่ยนไปหรือไม่
         // ✅ ถ้ามีโค้ดใหม่ที่อัพโหลด (ใน couponItemCodesNew) ให้ถือว่าเปลี่ยน
         // ✅ ถ้าไม่มีโค้ดใหม่ (เป็น array ว่าง) ให้ถือว่าไม่เปลี่ยน (ใช้โค้ดเดิมใน DB)
         const couponItemsChanged = couponItemCodesNew.some((newCodes) => {
           return newCodes && newCodes.length > 0  // ถ้ามีโค้ดใหม่ที่อัพโหลด ถือว่าเปลี่ยน
         })
         
         // ✅ อ่าน cursor เดิมจาก game data (ถ้าโค้ดไม่เปลี่ยน)
         let couponCursors: number[] = []
         if (isEdit && !couponItemsChanged) {
           try {
             // ✅ โหลด game data เพื่ออ่าน cursors
             const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
             const existingCursors = (currentGame as any).gameData?.checkin?.coupon?.cursors
             if (Array.isArray(existingCursors)) {
               couponCursors = existingCursors.slice(0, cleanCouponItems.length)
               // ถ้ามี item ใหม่ ให้เพิ่ม cursor = 0
               while (couponCursors.length < cleanCouponItems.length) {
                 couponCursors.push(0)
               }
             }
           } catch (error) {
             console.error('Error reading coupon cursors:', error)
           }
         }
         
         // ✅ ถ้าโค้ดเปลี่ยนหรือไม่มี cursor เดิม ให้ reset เป็น 0
         if (couponCursors.length === 0 || couponItemsChanged || !isEdit) {
           couponCursors = cleanCouponItems.map(() => 0)
         }
         
         base.checkin = {
           days: checkinDays,
           rewards: normalized,
           completeReward: normalizedCompleteReward,
           features: checkinFeatures,  // ✅ บันทึกการตั้งค่าเปิด/ปิด
           startDate: (checkinStartDate || '').trim(),  // ✅ วันที่เริ่มต้นกิจกรรม
           endDate: (checkinEndDate || '').trim(),  // ✅ วันที่สิ้นสุดกิจกรรม
           updatedAt: Date.now(),
           imageDataUrl: finalCheckinImageDataUrl,
           fileName: checkinFileName,
           slot: {
             startBet: num(checkinSlot.startBet, 1),
             winRate:  num(checkinSlot.winRate, 30),
           },
           coupon: {
             items: cleanCouponItems,  // ✅ ไม่มี codes ใน items เพื่อป้องกัน write_too_big
             cursors: couponCursors,   // ✅ ใช้ cursor เดิมถ้าโค้ดไม่เปลี่ยน
           },
         }
         
         // ✅ บันทึก codes แยกใน items/{index}/codes เพื่อป้องกัน write_too_big
         // ✅ จะบันทึกหลังจาก update base.checkin แล้ว

      // เคลียร์ field ประเภทอื่น ๆ กันค้าง
      base.puzzle     = null
      base.codes      = null
      base.codeCursor = null
      base.claimedBy  = null
      base.numberPick = null
      base.football   = null
      base.slot       = null
      base.codesVersion = null
    }

    if (isEdit) {
      try {
        // ✅ Debug: log features ก่อนบันทึก (เฉพาะใน development)
        if (process.env.NODE_ENV === 'development' && type === 'เกมเช็คอิน') {
          console.log('[CreateGame] Saving features:', checkinFeatures)
          console.log('[CreateGame] Base checkin features:', base.checkin?.features)
        }
        
        // อัปเดต base (สำหรับเกม BINGO ไม่ต้องลบหรือสร้าง bingo ใหม่ เพราะมีปุ่มรีเกมแยกแล้ว)
        // Use PostgreSQL adapter if available
        try {
          // Convert base to PostgreSQL format
          const gameData = {
            gameId,
            name: base.name || base.title || '',
            type: base.type || type,
            unlocked: base.unlocked !== false,
            locked: base.locked === true,
            userAccessType: base.userAccessType || 'all',
            selectedUsers: base.selectedUsers || null,
            gameData: {
              ...(base.puzzle && { puzzle: base.puzzle }),
              ...(base.numberPick && { numberPick: base.numberPick }),
              ...(base.football && { football: base.football }),
              ...(base.slot && { slot: base.slot }),
              ...(base.checkin && { checkin: base.checkin }),
              ...(base.announce && { announce: base.announce }),
              ...(base.trickOrTreat && { trickOrTreat: base.trickOrTreat }),
              ...(base.loyKrathong && { loyKrathong: base.loyKrathong }),
              ...(base.bingo && { bingo: base.bingo }),
              ...(base.codes && { codes: base.codes }),
              ...(base.codeCursor !== undefined && { codeCursor: base.codeCursor }),
              ...(base.claimedBy && { claimedBy: base.claimedBy }),
              ...(base.codesVersion && { codesVersion: base.codesVersion }),
            }
          }
          await postgresqlAdapter.updateGame(gameId, gameData)
        } catch (error) {
          console.error('Error updating game in PostgreSQL:', error)
          throw error
        }
        
        // ✅ สำหรับเกมเช็คอิน: บันทึก codes โดยรวมเข้าไปใน gameData JSONB
        if (type === 'เกมเช็คอิน' && (couponItemCodesNew?.length > 0 || dailyRewardCodes?.length > 0 || completeRewardCodes?.length > 0)) {
          try {
            // ✅ อ่าน game data ปัจจุบัน
            const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
            // ✅ โครงสร้างข้อมูล: checkin อยู่ใน game_data JSONB (ถูก spread จาก backend)
            const currentCheckin = (currentGame as any).checkin || {}
            
            // ✅ อัปเดต coupon codes
            if (couponItemCodesNew && couponItemCodesNew.length > 0) {
              if (!currentCheckin.coupon) currentCheckin.coupon = {}
              if (!currentCheckin.coupon.items) currentCheckin.coupon.items = []
              
              for (let index = 0; index < couponItemCodesNew.length; index++) {
                const newCodes = couponItemCodesNew[index]
                if (newCodes && newCodes.length > 0) {
                  if (!currentCheckin.coupon.items[index]) {
                    currentCheckin.coupon.items[index] = {}
                  }
                  currentCheckin.coupon.items[index].codes = newCodes
                }
              }
            }
            
            // ✅ อัปเดต daily reward codes
            if (dailyRewardCodes && dailyRewardCodes.length > 0) {
              if (!currentCheckin.rewardCodes) currentCheckin.rewardCodes = {}
              
              for (let index = 0; index < dailyRewardCodes.length; index++) {
                const newCodes = dailyRewardCodes[index]
                if (newCodes && newCodes.length > 0) {
                  currentCheckin.rewardCodes[index] = {
                    cursor: 0,  // ✅ reset cursor เมื่อบันทึกโค้ดใหม่
                    codes: newCodes
                  }
                }
              }
            }
            
            // ✅ อัปเดต complete reward codes
            if (completeRewardCodes && completeRewardCodes.length > 0) {
              currentCheckin.completeRewardCodes = {
                cursor: 0,  // ✅ reset cursor เมื่อบันทึกโค้ดใหม่
                codes: completeRewardCodes
              }
            }
            
            // ✅ บันทึกกลับไปยัง PostgreSQL (ส่ง checkin เป็น top-level property)
            await postgresqlAdapter.updateGame(gameId, {
              checkin: currentCheckin
            })
          } catch (error) {
            console.error('Error saving checkin codes:', error)
            // ไม่ throw error เพราะ base.checkin ถูกบันทึกแล้ว
          }
        }
        
        // Invalidate cache after updating game
        dataCache.invalidateGame(gameId)
        
        // ✅ ไม่ trigger reload ทันที (เพื่อไม่ให้รีเซ็ต couponItemCodesNew, dailyRewardCodes, completeRewardCodes)
        // ✅ ให้ user refresh หน้าเองถ้าต้องการดูข้อมูลใหม่
        // setReloadTrigger(prev => prev + 1)
        
        alert('บันทึกการเปลี่ยนแปลงเรียบร้อย')
      } catch (error) {
        console.error('Error saving game:', error)
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง')
      } finally {
        setIsSaving(false)
      }
      return
    }

    // ===== โหมดสร้าง =====
    try {
      // Generate game ID
      const id = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Use PostgreSQL adapter if available
      try {
        // Convert base to PostgreSQL format
        const gameData = {
          gameId: id,
          name: base.name || base.title || '',
          type: base.type || type,
          unlocked: base.unlocked !== false,
          locked: base.locked === true,
          userAccessType: base.userAccessType || 'all',
          selectedUsers: base.selectedUsers || null,
          gameData: {
            ...(base.puzzle && { puzzle: base.puzzle }),
            ...(base.numberPick && { numberPick: base.numberPick }),
            ...(base.football && { football: base.football }),
            ...(base.slot && { slot: base.slot }),
            ...(base.checkin && { checkin: base.checkin }),
            ...(base.announce && { announce: base.announce }),
            ...(base.trickOrTreat && { trickOrTreat: base.trickOrTreat }),
            ...(base.loyKrathong && { loyKrathong: base.loyKrathong }),
            ...(base.bingo && { bingo: base.bingo }),
            ...(base.codes && { codes: base.codes }),
            ...(base.codeCursor !== undefined && { codeCursor: base.codeCursor }),
            ...(base.claimedBy && { claimedBy: base.claimedBy }),
            ...(base.codesVersion && { codesVersion: base.codesVersion }),
          }
        }
        await postgresqlAdapter.createGame(gameData)
      } catch (error) {
        console.error('Error creating game in PostgreSQL:', error)
        throw error
      }

      // ✅ สำหรับเกมเช็คอิน: บันทึก codes โดยรวมเข้าไปใน gameData JSONB
      if (type === 'เกมเช็คอิน' && (couponItemCodes?.length > 0 || dailyRewardCodes?.length > 0 || completeRewardCodes?.length > 0)) {
        try {
          // ✅ อ่าน game data ที่สร้างไปแล้ว
          const createdGame = (await postgresqlAdapter.getGameData(id) || {}) as GameData
          // ✅ โครงสร้างข้อมูล: checkin อยู่ใน game_data JSONB (ถูก spread จาก backend)
          const currentCheckin = (createdGame as any).checkin || {}
          
          // ✅ อัปเดต coupon codes
          if (couponItemCodes && couponItemCodes.length > 0) {
            if (!currentCheckin.coupon) currentCheckin.coupon = {}
            if (!currentCheckin.coupon.items) currentCheckin.coupon.items = []
            
            for (let index = 0; index < couponItemCodes.length; index++) {
              const codes = couponItemCodes[index]
              if (codes && codes.length > 0) {
                if (!currentCheckin.coupon.items[index]) {
                  currentCheckin.coupon.items[index] = {}
                }
                currentCheckin.coupon.items[index].codes = codes
              }
            }
          }
          
          // ✅ อัปเดต daily reward codes
          if (dailyRewardCodes && dailyRewardCodes.length > 0) {
            if (!currentCheckin.rewardCodes) currentCheckin.rewardCodes = {}
            
            for (let index = 0; index < dailyRewardCodes.length; index++) {
              const codes = dailyRewardCodes[index]
              if (codes && codes.length > 0) {
                currentCheckin.rewardCodes[index] = {
                  cursor: 0,  // ✅ reset cursor เมื่อบันทึกโค้ดใหม่
                  codes: codes
                }
              }
            }
          }
          
          // ✅ อัปเดต complete reward codes
          if (completeRewardCodes && completeRewardCodes.length > 0) {
            currentCheckin.completeRewardCodes = {
              cursor: 0,  // ✅ reset cursor เมื่อบันทึกโค้ดใหม่
              codes: completeRewardCodes
            }
          }
          
          // ✅ บันทึกกลับไปยัง PostgreSQL (ส่ง checkin เป็น top-level property)
          await postgresqlAdapter.updateGame(id, {
            checkin: currentCheckin
          })
        } catch (error) {
          console.error('Error saving checkin codes:', error)
          // ไม่ throw error เพราะ base.checkin ถูกบันทึกแล้ว
        }
      }

      // ✅ สำหรับเกม BINGO: อัปเดต bingo data ใน gameData
      if (type === 'เกม BINGO') {
        try {
          const createdGame = await postgresqlAdapter.getGameData(id) || {}
          const newBingoData = {
            maxUsers: maxUsers,
            codes: codes.map((c) => c.trim()).filter(Boolean),
            players: {},
            status: 'waiting',
            gameState: {
              status: 'waiting',
              calledNumbers: [],
              currentNumber: null,
              gameStarted: false,
              gameEnded: false,
              winner: null,
              winnerCardId: null,
              finishedAt: null
            },
            rooms: {}
          }
          
          await postgresqlAdapter.updateGame(id, {
            ...createdGame,
            gameData: {
              ...(createdGame as any).gameData,
              bingo: newBingoData
            }
          })
        } catch (error) {
          console.error('Error saving bingo data:', error)
        }
      }

      const linkQuery = getPlayerLink(id)
      try { await navigator.clipboard.writeText(linkQuery) } catch {}

      // Invalidate cache after creating new game
      dataCache.invalidateGame(id)
      
      nav(`/games/${id}`, { replace: true })
    } catch (error) {
      console.error('Error creating game:', error)
      alert('เกิดข้อผิดพลาดในการสร้างเกม กรุณาลองใหม่อีกครั้ง')
      setIsSaving(false)
    }
  }

  // ยืนยันรหัสผ่านก่อนลบ (ถ้าล็อกอยู่)
  async function verifyDeletionPassword(): Promise<boolean> {
    // ✅ ใช้ Supabase Auth
    const { data: { user } } = await getUser()
    if (!user || !user.email) { 
      alert('กรุณาเข้าสู่ระบบก่อนทำรายการลบเกม')
      return false 
    }

    // ✅ ตรวจสอบว่า user ใช้ email/password authentication
    // Supabase ไม่มี providerData เหมือน Firebase แต่เราสามารถตรวจสอบได้จาก user.app_metadata
    const password = window.prompt('ใส่รหัสผ่านที่ใช้ล็อกอินเพื่อยืนยันการลบเกมที่ถูกล็อก')
    if (!password) return false
    
    try {
      // ✅ ใช้ signInWithPassword เพื่อ verify password
      // ถ้า password ถูกต้อง จะ sign in สำเร็จ
      const { data, error } = await signInWithPassword(user.email, password)
      
      if (error) {
        console.error('Re-auth failed:', error)
        alert('รหัสผ่านไม่ถูกต้อง')
        return false
      }
      
      return true
    } catch (err) {
      console.error('Re-auth failed:', err)
      alert('รหัสผ่านไม่ถูกต้อง')
      return false
    }
  }

  const removeGame = async () => {
    if (!isEdit) return
    if (!confirm('ต้องการลบเกมนี้และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?')) return
    try {
      // ✅ ใช้ PostgreSQL adapter 100%
      await postgresqlAdapter.deleteGame(gameId)
      
      // Invalidate cache after deleting game
      dataCache.invalidateGame(gameId)
      
      alert('ลบเกมเรียบร้อย')
      nav('/home', { replace: true })
    } catch (error) {
      console.error('Error deleting game:', error)
      alert('เกิดข้อผิดพลาดในการลบเกม')
    }
  }

  // ===== UI =====
  // Show loading state when editing and loading game data
  if (isEdit && gameDataLoading) {
    return (
      <section className="create-wrap">
        <div className="create-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h3 style={{ color: '#666', margin: '0' }}>กำลังโหลดข้อมูลเกม...</h3>
          <p style={{ color: '#999', margin: '10px 0 0 0' }}>กรุณารอสักครู่</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </section>
    )
  }

  return (
    <section className="create-wrap">
      <div className="create-card">
               <img
                 src={assets.logoContainer}
                 className="create-logo"
                 alt={branding.title}
                 style={{
                   width: '250px',
                   height: 'auto',
                   marginBottom: '16px'
                 }}
               />

        <label className="f-label">เลือกประเภทเกม</label>
        <PrettySelect
          options={gameTypes}
          value={type}
          onChange={(v) => setType(v as any)}
        />

        {/* ชื่อเกม */}
        <label className="f-label">ชื่อเกม</label>
        <input className="f-control" placeholder="ชื่อเกม" value={name} onChange={(e) => setName(e.target.value)} />

        {/* ส่วนเลือกสิทธิ์ USER เข้าเล่นเกม */}
        <div className="user-access-section" style={{ marginTop: 20 }}>
          <label className="f-label">สิทธิ์การเข้าเล่น</label>
          
          <div className="access-options" style={{ 
            marginBottom: 16,
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <label className="radio-option" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              marginBottom: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: userAccessType === 'all' ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' : 'transparent',
              color: userAccessType === 'all' ? 'white' : '#1c2a22',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: userAccessType === 'all' ? 'none' : '1px solid #dfe9e3'
            }}>
              <input
                type="radio"
                name="userAccess"
                value="all"
                checked={userAccessType === 'all'}
                onChange={(e) => setUserAccessType(e.target.value as 'all' | 'selected')}
                style={{ margin: 0 }}
              />
              <span style={{ fontWeight: 600 }}>👥 USER ทั้งหมด</span>
            </label>
            
            <label className="radio-option" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background: userAccessType === 'selected' ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'transparent',
              color: userAccessType === 'selected' ? 'white' : '#1c2a22',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              border: userAccessType === 'selected' ? 'none' : '1px solid #dfe9e3'
            }}>
              <input
                type="radio"
                name="userAccess"
                value="selected"
                checked={userAccessType === 'selected'}
                onChange={(e) => setUserAccessType(e.target.value as 'all' | 'selected')}
                style={{ margin: 0 }}
              />
              <span style={{ fontWeight: 600 }}>🎯 ACTIVE USER (เฉพาะที่เลือก)</span>
            </label>
          </div>

          {/* ส่วนอัพโหลด USER เมื่อเลือก ACTIVE USER */}
          {userAccessType === 'selected' && (
            <div className="selected-users-section" style={{ 
              background: 'rgba(255,255,255,0.95)',
              padding: 20, 
              borderRadius: 12, 
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              marginTop: 8
            }}>
              <div className="upload-section" style={{ marginBottom: 16 }}>
                <label className="upload-label" style={{ 
                  display: 'block', 
                  marginBottom: 8, 
                  fontWeight: 700,
                  color: '#1c2a22',
                  fontSize: 14
                }}>
                  อัพโหลดรายชื่อ USER
                </label>
                <div className="file-picker" style={{ marginBottom: 8 }}>
                  <input
                    id="user-file"
                    type="file"
                    accept=".txt,.csv"
                    onChange={(e) => importSelectedUsers(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="user-file" className="file-btn" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.3s ease'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    </svg>
                    <span>เลือกไฟล์</span>
                  </label>
                  <span className="file-name" style={{ 
                    marginLeft: 12, 
                    color: '#6b7280',
                    fontSize: 14
                  }}>
                    {selectedUsersFile?.name || 'ยังไม่ได้เลือกไฟล์'}
                  </span>
                </div>
                <small className="upload-hint" style={{ 
                  display: 'block', 
                  color: '#6b7280',
                  fontSize: 12,
                  fontStyle: 'italic'
                }}>
                  รองรับไฟล์ .txt หรือ .csv (หนึ่ง USER ต่อบรรทัด)
                </small>
              </div>

              {/* พรีวิว USER ที่เลือก */}
              {selectedUsers.length > 0 && (
                <div className="users-preview">
                  <div className="preview-header" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <span className="preview-title" style={{ 
                      fontWeight: 700, 
                      color: '#1c2a22',
                      fontSize: 14
                    }}>
                      รายชื่อ USER ที่เลือก ({selectedUsers.length} รายการ)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUsers([])
                        setSelectedUsersFile(null)
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      ล้างรายการ
                    </button>
                  </div>
                  
                  <div className="users-list" style={{ 
                    maxHeight: 200, 
                    overflowY: 'auto',
                    background: 'rgba(248, 250, 252, 0.8)',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 8
                  }}>
                    {selectedUsers.map((user, index) => (
                      <div key={index} className="user-item" style={{
                        padding: '8px 12px',
                        borderBottom: index < selectedUsers.length - 1 ? '1px solid #f1f5f9' : 'none',
                        fontSize: 14,
                        color: '#374151',
                        background: index % 2 === 0 ? 'rgba(255,255,255,0.5)' : 'transparent',
                        borderRadius: index === 0 ? '4px 4px 0 0' : index === selectedUsers.length - 1 ? '0 0 4px 4px' : '0',
                        fontWeight: 500
                      }}>
                        {user}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* เลือกรูปภาพ: เฉพาะประเภทที่ต้องใช้รูป */}
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
            {imageDataUrl && (
              <img 
                src={getImageUrl(imageDataUrl)} 
                alt="preview" 
                className="img-preview" 
                style={{ opacity: imageUploading ? 0.5 : 1 }}
              />
            )}
            {imageUploading && (
              <div style={{ 
                textAlign: 'center', 
                padding: '10px', 
                color: '#666',
                fontSize: '14px' 
              }}>
                กำลังอัปโหลดรูปภาพ...
              </div>
            )}
          </>
        )}

        {/* เฉพาะเกมทายภาพ */}
        {type === 'เกมทายภาพปริศนา' && (
          <>
            <label className="f-label">กำหนดคำตอบ</label>
            <input className="f-control" placeholder="คำตอบที่ถูกต้อง" value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </>
        )}

        {/* อัปโหลด/จัดการ CODE: ใช้กับ เกมทายภาพปริศนา, เกมลอยกระทง และ เกม BINGO */}
        {(type === 'เกมทายภาพปริศนา' || type === 'เกมลอยกระทง' || type === 'เกม BINGO') && (
          <>
            <label className="f-label">กำหนดจำนวน CODE ที่ต้องแจก</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                className="f-control"
                value={numCodes}
                onChange={(e) => setNumCodes(Math.max(1, Number(e.target.value) || 1))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-upload"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.csv,.txt,.xlsx'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    
                    try {
                      const ext = (file.name.split('.').pop() || '').toLowerCase()
                      let newCodes: string[] = []
                      
                      if (ext === 'csv' || ext === 'txt') {
                        // อ่านไฟล์ CSV/TXT
                        const text = await file.text()
                        const lines = text.split(/\r?\n/).filter(line => line.trim())
                        
                        for (const line of lines) {
                          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''))
                          
                          // คอลัมน์ E (index 4) = serialcode
                          // คอลัมน์ G (index 6), H (index 7), K (index 10) = เงื่อนไข
                          if (columns.length >= 11) {
                            const serialCode = columns[4] // คอลัมน์ E
                            const colG = columns[6] // คอลัมน์ G
                            const colH = columns[7] // คอลัมน์ H
                            const colK = columns[10] // คอลัมน์ K
                            
                            // เช็คเงื่อนไขจากคอลัมน์ G, H, K (ต้องว่างทั้งหมด)
                            if (serialCode && !colG && !colH && !colK) {
                              newCodes.push(serialCode)
                            }
                          }
                        }
                      } else if (ext === 'xlsx' || ext === 'xls') {
                        // อ่านไฟล์ Excel
                        const buf = await file.arrayBuffer()
                        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
                        const ws = wb.Sheets[wb.SheetNames[0]]
                        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
                        
                        for (const row of rows) {
                          if (row.length >= 11) {
                            const serialCode = row[4] // คอลัมน์ E
                            const colG = row[6] // คอลัมน์ G
                            const colH = row[7] // คอลัมน์ H
                            const colK = row[10] // คอลัมน์ K
                            
                            // เช็คเงื่อนไขจากคอลัมน์ G, H, K (ต้องว่างทั้งหมด)
                            if (serialCode && !colG && !colH && !colK) {
                              newCodes.push(String(serialCode).trim())
                            }
                          }
                        }
                      } else {
                        alert('รองรับเฉพาะไฟล์ .csv, .txt, .xlsx, .xls')
                        return
                      }
                      
                      if (newCodes.length > 0) {
                        // ใช้ CODE จากไฟล์เท่านั้น (ไม่รวม CODE เดิม)
                        setCodes(newCodes)
                        setNumCodes(newCodes.length)
                        
                        alert(`อัปโหลด CODE สำเร็จ ${newCodes.length} รายการ`)
                      } else {
                        alert('ไม่พบ CODE ที่ตรงเงื่อนไขในไฟล์\nตรวจสอบคอลัมน์ E (serialcode) และคอลัมน์ G, H, K ต้องว่าง')
                      }
                    } catch (error) {
                      console.error('Error loading file:', error)
                      alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
                    }
                  }
                  input.click()
                }}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  minWidth: '140px',
                  height: '40px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.35), 0 4px 8px rgba(0, 0, 0, 0.15)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(0.98)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                }}
              >
                <span style={{
                  fontSize: '16px',
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
                }}>
                  📁
                </span>
                <span style={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                  letterSpacing: '0.5px'
                }}>
                  อัปโหลด CODE
                </span>
              </button>
            </div>
            {/* รายการโค้ดทั้งหมดพร้อมแทบเลื่อน */}
            <div style={{
              marginTop: 8,
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              background: '#f9fafb',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  รายการโค้ดทั้งหมด ({codes.length} รายการ)
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  background: '#e5e7eb',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  แทบเลื่อนลง
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {codes.map((c, i) => {
                  // ตรวจสอบว่าโค้ดนี้ถูกใช้ไปแล้วหรือไม่
                  const isUsed = answers.some(row => row.code === c && row.correct === true)
                  
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: isUsed 
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' 
                        : '#ffffff',
                      border: isUsed 
                        ? '2px solid #fecaca' 
                        : '1px solid #e5e7eb',
                      borderRadius: '6px',
                      boxShadow: isUsed 
                        ? '0 2px 4px rgba(239, 68, 68, 0.1)' 
                        : '0 1px 2px rgba(0, 0, 0, 0.05)',
                      opacity: isUsed ? 0.7 : 1,
                      position: 'relative'
                    }}>
                      <div style={{
                        minWidth: '80px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: isUsed ? '#dc2626' : '#6b7280',
                        background: isUsed ? '#fecaca' : '#f3f4f6',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        CODE {i + 1}
                      </div>
                      <input
                        className="f-control"
                        placeholder={`CODE ลำดับที่ ${i + 1}`}
                        value={c}
                        onChange={(e) => {
                          const v = e.target.value
                          setCodes((prev) => {
                            const next = [...prev]; next[i] = v; return next
                          })
                        }}
                        style={{
                          flex: 1,
                          border: isUsed ? '1px solid #fca5a5' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '14px',
                          background: isUsed ? '#fef2f2' : '#ffffff',
                          color: isUsed ? '#991b1b' : '#374151',
                          textDecoration: isUsed ? 'line-through' : 'none'
                        }}
                        disabled={isUsed}
                      />
                      {isUsed && (
                        <div style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          background: '#dc2626',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                        }}>
                          ใช้แล้ว
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* อัปโหลด/จัดการ CODE รางวัลใหญ่: เฉพาะเกมลอยกระทง */}
        {type === 'เกมลอยกระทง' && (
          <>
            <label className="f-label">กำหนดจำนวน CODE รางวัลใหญ่</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                className="f-control"
                value={numBigPrizeCodes}
                onChange={(e) => setNumBigPrizeCodes(Math.max(1, Number(e.target.value) || 1))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-upload"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.csv,.txt,.xlsx'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    
                    try {
                      const ext = (file.name.split('.').pop() || '').toLowerCase()
                      let newCodes: string[] = []
                      
                      if (ext === 'csv' || ext === 'txt') {
                        // อ่านไฟล์ CSV/TXT
                        const text = await file.text()
                        const lines = text.split(/\r?\n/).filter(line => line.trim())
                        
                        for (const line of lines) {
                          const columns = line.split(',').map(col => col.trim().replace(/"/g, ''))
                          
                          // คอลัมน์ E (index 4) = serialcode
                          // คอลัมน์ G (index 6), H (index 7), K (index 10) = เงื่อนไข
                          if (columns.length >= 11) {
                            const serialCode = columns[4] // คอลัมน์ E
                            const colG = columns[6] // คอลัมน์ G
                            const colH = columns[7] // คอลัมน์ H
                            const colK = columns[10] // คอลัมน์ K
                            
                            // เช็คเงื่อนไขจากคอลัมน์ G, H, K (ต้องว่างทั้งหมด)
                            if (serialCode && !colG && !colH && !colK) {
                              newCodes.push(serialCode)
                            }
                          }
                        }
                      } else if (ext === 'xlsx' || ext === 'xls') {
                        // อ่านไฟล์ Excel
                        const buf = await file.arrayBuffer()
                        const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
                        const ws = wb.Sheets[wb.SheetNames[0]]
                        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]
                        
                        for (const row of rows) {
                          if (row.length >= 11) {
                            const serialCode = row[4] // คอลัมน์ E
                            const colG = row[6] // คอลัมน์ G
                            const colH = row[7] // คอลัมน์ H
                            const colK = row[10] // คอลัมน์ K
                            
                            // เช็คเงื่อนไขจากคอลัมน์ G, H, K (ต้องว่างทั้งหมด)
                            if (serialCode && !colG && !colH && !colK) {
                              newCodes.push(String(serialCode).trim())
                            }
                          }
                        }
                      } else {
                        alert('รองรับเฉพาะไฟล์ .csv, .txt, .xlsx, .xls')
                        return
                      }
                      
                      if (newCodes.length > 0) {
                        // ใช้ CODE จากไฟล์เท่านั้น (ไม่รวม CODE เดิม)
                        setBigPrizeCodes(newCodes)
                        setNumBigPrizeCodes(newCodes.length)
                        
                        alert(`อัปโหลด CODE รางวัลใหญ่สำเร็จ ${newCodes.length} รายการ`)
                      } else {
                        alert('ไม่พบ CODE ที่ตรงเงื่อนไขในไฟล์\nตรวจสอบคอลัมน์ E (serialcode) และคอลัมน์ G, H, K ต้องว่าง')
                      }
                    } catch (error) {
                      console.error('Error loading file:', error)
                      alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
                    }
                  }
                  input.click()
                }}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: '140px',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(245, 158, 11, 0.35), 0 4px 8px rgba(0, 0, 0, 0.15)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(0.98)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                }}
              >
                <span style={{
                  fontSize: '16px',
                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
                }}>
                  🏆
                </span>
                <span style={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                  letterSpacing: '0.5px'
                }}>
                  อัปโหลด CODE รางวัลใหญ่
                </span>
              </button>
            </div>
            
            {/* รายการโค้ดรางวัลใหญ่ทั้งหมดพร้อมแทบเลื่อน */}
            <div style={{
              marginTop: 8,
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              background: '#f9fafb',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#f59e0b',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                }}>
                  🏆 รายการโค้ดรางวัลใหญ่ ({bigPrizeCodes.length} รายการ)
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontStyle: 'italic'
                }}>
                  แทบเลื่อนลง
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bigPrizeCodes.map((c, i) => {
                  // ตรวจสอบว่าโค้ดนี้ถูกใช้ไปแล้วหรือไม่
                  const isUsed = answers.some(row => row.code === c && row.correct === true)
                  
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: isUsed 
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' 
                        : '#ffffff',
                      border: isUsed 
                        ? '2px solid #fecaca' 
                        : '1px solid #f59e0b',
                      borderRadius: '6px',
                      boxShadow: isUsed 
                        ? '0 2px 4px rgba(239, 68, 68, 0.1)' 
                        : '0 1px 2px rgba(245, 158, 11, 0.05)',
                      opacity: isUsed ? 0.7 : 1,
                      position: 'relative'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#f59e0b',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #f59e0b',
                        minWidth: '60px',
                        textAlign: 'center',
                        boxShadow: '0 1px 2px rgba(245, 158, 11, 0.2)'
                      }}>
                        CODE {i + 1}
                      </div>
                      <input
                        className="f-control"
                        placeholder={`CODE รางวัลใหญ่ ลำดับที่ ${i + 1}`}
                        value={c}
                        onChange={(e) => {
                          const v = e.target.value
                          setBigPrizeCodes((prev) => {
                            const next = [...prev]; next[i] = v; return next
                          })
                        }}
                        style={{
                          flex: 1,
                          border: isUsed ? '1px solid #fca5a5' : '1px solid #f59e0b',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '14px',
                          background: isUsed ? '#fef2f2' : '#ffffff',
                          color: isUsed ? '#991b1b' : '#374151',
                          textDecoration: isUsed ? 'line-through' : 'none'
                        }}
                        disabled={isUsed}
                      />
                      {isUsed && (
                        <div style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          background: '#dc2626',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                        }}>
                          ใช้แล้ว
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            
            {/* ข้อมูลระบบรางวัลใหญ่ */}
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', border: '1px solid #f59e0b' }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#f59e0b',
                marginBottom: '8px',
                textAlign: 'center'
              }}>
                🏆 ระบบรางวัลใหญ่
              </div>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                ทุกๆ USER ที่ 20 จะได้รับรางวัลใหญ่<br/>
                (USER ที่ 20, 40, 60, 80, 100...)
              </div>
            </div>
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

        {/* เฉพาะเกม BINGO */}
        {showBingo && (
          <>
            <label className="f-label">จำนวน USER ที่เข้าร่วมเกมต่อห้อง</label>
            <input
              type="number"
              min={2}
              max={100}
              className="f-control"
              placeholder="จำนวน USER สูงสุด"
              value={maxUsers}
              onChange={(e) => setMaxUsers(Number(e.target.value))}
            />
            
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

        {/* เฉพาะเกม Trick or Treat */}
        {type === 'เกม Trick or Treat' && (
          <>
            <label className="f-label">กำหนดโอกาสชนะ (%)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                className="f-control"
                value={trickOrTreatWinChance}
                onChange={(e) => setTrickOrTreatWinChance(Number(e.target.value))}
                style={{ marginRight: 12 }}
              />
              <div style={{ 
                minWidth: 60, 
                textAlign: 'center', 
                fontWeight: 'bold', 
                color: '#ff6b35',
                fontSize: 18 
              }}>
                {trickOrTreatWinChance}%
              </div>
            </div>
            <div style={{ 
              fontSize: 14, 
              color: '#666', 
              marginBottom: 16,
              textAlign: 'center',
              padding: 8,
              background: '#f8f9fa',
              borderRadius: 6
            }}>
              ผู้เล่นมีโอกาส {trickOrTreatWinChance}% ที่จะได้รับโค้ดรางวัล
            </div>

            <label className="f-label">กำหนดจำนวน CODE ที่ต้องแจก</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                className="f-control"
                value={numCodes}
                onChange={(e) => setNumCodes(Math.max(1, Number(e.target.value) || 1))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn-upload"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.csv,.txt,.xlsx'
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    
                    try {
                      const codes = await parseCodesFromFile(file)
                      if (codes.length > 0) {
                        setCodes(codes)
                        setNumCodes(codes.length)
                        alert(`อัปโหลด CODE สำเร็จ ${codes.length} รายการ`)
                      } else {
                        alert('ไม่พบ CODE ที่ตรงเงื่อนไขในไฟล์\nตรวจสอบคอลัมน์ E (serialcode) และคอลัมน์ G, H, K ต้องว่าง')
                      }
                    } catch (error) {
                      console.error('Error loading file:', error)
                      alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
                    }
                  }
                  input.click()
                }}
                style={{
                  background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                  border: '1px solid rgba(255, 107, 53, 0.2)',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(255, 107, 53, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  minWidth: '140px',
                  height: '40px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 107, 53, 0.35), 0 4px 8px rgba(0, 0, 0, 0.15)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f7931e 0%, #e8681b 100%)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)'
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)'
                }}
              >
                <span>🎃</span>
                อัปโหลด CODE
              </button>
            </div>

            {/* รายการโค้ดทั้งหมด */}
            <div style={{
              marginTop: 8,
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
              background: '#fff5f0',
              boxShadow: 'inset 0 1px 3px rgba(255, 107, 53, 0.1)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #ffc299'
              }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#ff6b35'
                }}>
                  🎃 รายการโค้ด Trick or Treat ({codes.length} รายการ)
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {codes.map((c, i) => {
                  const isUsed = answers.some(row => row.code === c && (row as any).won === true)
                  
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: isUsed 
                        ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' 
                        : '#ffffff',
                      border: isUsed 
                        ? '2px solid #fecaca' 
                        : '1px solid #ffc299',
                      borderRadius: '6px',
                      boxShadow: isUsed 
                        ? '0 2px 4px rgba(239, 68, 68, 0.1)' 
                        : '0 1px 2px rgba(255, 107, 53, 0.05)',
                      opacity: isUsed ? 0.7 : 1
                    }}>
                      <div style={{
                        minWidth: '80px',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: isUsed ? '#dc2626' : '#ff6b35',
                        background: isUsed ? '#fecaca' : '#ffe8d9',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        🎃 {i + 1}
                      </div>
                      <input
                        className="f-control"
                        placeholder={`CODE ลำดับที่ ${i + 1}`}
                        value={c}
                        onChange={(e) => {
                          const v = e.target.value
                          setCodes((prev) => {
                            const next = [...prev]; next[i] = v; return next
                          })
                        }}
                        style={{
                          flex: 1,
                          border: isUsed ? '1px solid #fca5a5' : '1px solid #ffc299',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          fontSize: '14px',
                          background: isUsed ? '#fef2f2' : '#ffffff',
                          color: isUsed ? '#991b1b' : '#374151',
                          textDecoration: isUsed ? 'line-through' : 'none'
                        }}
                        disabled={isUsed}
                      />
                      {isUsed && (
                        <div style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          background: '#dc2626',
                          color: 'white'
                        }}>
                          ใช้แล้ว
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              background: '#fff5f0', 
              borderRadius: 8, 
              border: '1px solid #ffc299' 
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#ff6b35' }}>🎃 วิธีเล่น Trick or Treat:</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#666', lineHeight: 1.6 }}>
                <li>ผู้เล่นเลือกการ์ดจาก 2 ใบที่แสดง</li>
                <li>โอกาสชนะขึ้นอยู่กับที่คุณตั้งค่าไว้ ({trickOrTreatWinChance}%)</li>
                <li>หากชนะจะได้รับโค้ดรางวัล</li>
                <li>หากแพ้จะเห็นภาพผีแทน</li>
                <li>ผู้เล่นแต่ละคนเล่นได้เพียงครั้งเดียวต่อเกม</li>
              </ul>
            </div>
          </>
        )}

        {type === 'เกมประกาศรางวัล' && (
          <div className="card" style={{
            background:colors.bgPrimary,
            border:`1px solid ${colors.borderLight}`,
            borderRadius:'16px',
            padding:'24px',
            boxShadow:`0 2px 12px ${colors.shadowLight}`
          }}>
            {/* หัวข้อ */}
            <div style={{
              marginBottom:'24px',
              textAlign:'center'
            }}>
              <div style={{
                fontSize:'22px',
                fontWeight:'800',
                color:colors.textPrimary,
                marginBottom:'8px',
                background:`linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                WebkitBackgroundClip:'text',
                WebkitTextFillColor:'transparent',
                backgroundClip:'text'
              }}>
                📋 รายชื่อผู้ได้รับรางวัล
              </div>
              <div style={{
                fontSize:'14px',
                color:colors.textSecondary,
                fontWeight:'500'
              }}>
                อัปโหลดไฟล์ CSV เพื่อเพิ่มรายชื่อผู้ได้รับรางวัล
              </div>
            </div>

            {/* ปุ่มอัปโหลด */}
            <div style={{
              display:'flex',
              justifyContent:'center',
              marginBottom:'16px'
            }}>
              <label 
                style={{
                  display:'inline-flex',
                  alignItems:'center',
                  gap:'10px',
                  padding:'14px 28px',
                  background:`linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                  color:colors.textInverse,
                  borderRadius:'12px',
                  fontSize:'16px',
                  fontWeight:'700',
                  cursor:'pointer',
                  boxShadow:`0 4px 12px ${colors.primary}30`,
                  transition:'all 0.2s ease',
                  border:'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = `0 6px 16px ${colors.primary}40`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = `0 4px 12px ${colors.primary}30`
                }}
              >
                <span style={{fontSize:'20px'}}>📤</span>
                <span>อัปโหลด USER + BONUS CSV</span>
                <input 
                  type="file" 
                  accept=".csv,.txt,.xlsx" 
                  hidden
                  onChange={(e)=>importAnnounceUsers(e.target.files?.[0])}
                />
              </label>
            </div>

            {/* อัพโหลดรูปภาพ */}
            <div style={{
              marginTop:'24px',
              padding:'20px',
              background:`${colors.bgSecondary}`,
              borderRadius:'12px',
              border:`1px solid ${colors.borderLight}`
            }}>
              <div style={{
                fontSize:'16px',
                fontWeight:'700',
                color:colors.textPrimary,
                marginBottom:'12px'
              }}>
                🖼️ รูปภาพประกาศรางวัล
              </div>
              <div style={{
                display:'flex',
                flexDirection:'column',
                gap:'12px'
              }}>
                <div style={{
                  display:'flex',
                  alignItems:'center',
                  gap:'12px'
                }}>
                  <input 
                    id="announce-image" 
                    type="file" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      if (!/^image\//.test(f.type)) { alert('โปรดเลือกไฟล์รูปภาพ'); return }
                      
                      // ✅ Cleanup preview URL เก่า (ถ้ามี)
                      if (announceImageDataUrl && announceImageDataUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(announceImageDataUrl)
                      }
                      
                      setAnnounceFileName(f.name)
                      setAnnounceImageFile(f) // ✅ เก็บ File object ไว้
                      
                      // ✅ สร้าง preview URL จาก File object (ไม่ต้องอัปโหลดทันที)
                      try {
                        const previewUrl = URL.createObjectURL(f)
                        setAnnounceImageDataUrl(previewUrl) // ใช้สำหรับ preview เท่านั้น
                      } catch (error) {
                        console.error('Error creating preview URL:', error)
                        // Fallback: ใช้ fileToDataURL
                        const data = await fileToDataURL(f)
                        setAnnounceImageDataUrl(data)
                      }
                    }}
                    style={{display:'none'}}
                  />
                  <label 
                    htmlFor="announce-image"
                    style={{
                      display:'inline-flex',
                      alignItems:'center',
                      gap:'8px',
                      padding:'10px 20px',
                      background:`linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondaryDark} 100%)`,
                      color:colors.textInverse,
                      borderRadius:'8px',
                      fontSize:'14px',
                      fontWeight:'600',
                      cursor:'pointer',
                      boxShadow:`0 2px 8px ${colors.secondary}25`,
                      transition:'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = `0 4px 12px ${colors.secondary}35`
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = `0 2px 8px ${colors.secondary}25`
                    }}
                  >
                    <span>📤</span>
                    <span>เลือกรูปภาพ</span>
                  </label>
                  {announceFileName && (
                    <span style={{
                      fontSize:'13px',
                      color:colors.textSecondary,
                      fontWeight:'500'
                    }}>
                      {announceFileName}
                    </span>
                  )}
                  {announceImageDataUrl && (
                    <button
                      onClick={() => {
                        setAnnounceImageDataUrl('')
                        setAnnounceFileName('')
                      }}
                      style={{
                        padding:'6px 12px',
                        background:colors.dangerLight,
                        color:colors.textInverse,
                        border:'none',
                        borderRadius:'6px',
                        fontSize:'12px',
                        fontWeight:'600',
                        cursor:'pointer'
                      }}
                    >
                      ลบรูป
                    </button>
                  )}
                </div>
                {announceImageDataUrl && (
                  <div style={{
                    marginTop:'8px',
                    borderRadius:'8px',
                    overflow:'hidden',
                    border:`1px solid ${colors.borderLight}`
                  }}>
                    <img 
                      src={getImageUrl(announceImageDataUrl)}
                      alt="preview" 
                      style={{
                        width:'100%',
                        maxHeight:'400px',
                        objectFit:'contain',
                        display:'block',
                        opacity: announceImageUploading ? 0.5 : 1
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* สถิติจำนวนรายการ */}
            <div style={{
              marginTop:'16px',
              padding:'12px 16px',
              background:`linear-gradient(135deg, ${colors.warning}15 0%, ${colors.warning}25 100%)`,
              border:`1px solid ${colors.warning}40`,
              borderRadius:'10px',
              display:'flex',
              alignItems:'center',
              gap:'12px',
              boxShadow:`0 2px 8px ${colors.warning}20`
            }}>
              <div style={{
                width:'40px',
                height:'40px',
                borderRadius:'10px',
                background:`linear-gradient(135deg, ${colors.warning} 0%, ${colors.secondaryDark} 100%)`,
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                color:colors.textInverse,
                fontWeight:'700',
                fontSize:'18px',
                boxShadow:`0 2px 6px ${colors.warning}30`
              }}>
                📊
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'12px', color:colors.textSecondary, fontWeight:'600', marginBottom:'2px'}}>
                  จำนวนรายการทั้งหมด
                </div>
                <div style={{fontSize:'20px', color:colors.textPrimary, fontWeight:'800'}}>
                  {(announceUserBonuses.length || announceUsers.length || 0).toLocaleString()} รายการ
                </div>
              </div>
            </div>

            {/* รายชื่อ */}
            <div style={{marginTop:'16px'}}>
              <div 
                className="announce-users-list"
                style={{
                  display:'flex',
                  flexDirection:'column',
                  gap:'10px',
                  maxHeight:'450px',
                  overflowY:'auto',
                  padding:'16px',
                  border:`2px solid ${colors.borderLight}`,
                  borderRadius:'12px',
                  backgroundColor:colors.bgPrimary,
                  boxShadow:`inset 0 2px 4px ${colors.shadowLight}`
                }}
              >
                {announceUserBonuses.length > 0 ? (
                  announceUserBonuses.map((item,i)=>(
                    <div 
                      key={`${item.user}-${i}`}
                      className="announce-item with-bonus"
                    >
                      <div className="announce-item-accent announce-item-accent--danger" />
                      <div className="announce-item-content">
                        <div className="announce-item-number announce-item-number--danger">
                          {i + 1}
                        </div>
                        <div className="announce-item-user">{item.user}</div>
                      </div>
                      <div className="announce-item-bonus">
                        <span>🎁</span>
                        <span>{item.bonus.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                ) : announceUsers.length > 0 ? (
                  announceUsers.map((u,i)=>(
                    <div 
                      key={`${u}-${i}`}
                      className="announce-item"
                    >
                      <div className="announce-item-accent announce-item-accent--info" />
                      <div className="announce-item-content">
                        <div className="announce-item-number announce-item-number--info">
                          {i + 1}
                        </div>
                        <span className="announce-item-user">{u}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding:'40px 20px',
                    textAlign:'center',
                    color:colors.textTertiary,
                    fontSize:'15px',
                    fontWeight:'500'
                  }}>
                    <div style={{fontSize:'48px', marginBottom:'12px', opacity:0.5}}>📋</div>
                    <div>ยังไม่มีข้อมูล</div>
                    <div style={{fontSize:'13px', marginTop:'8px', color:colors.textSecondary, opacity:0.7}}>
                      กรุณาอัปโหลดไฟล์ CSV เพื่อเพิ่มรายชื่อผู้ได้รับรางวัล
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


         {/* ✅ เฉพาะเกมเช็คอิน (เพิ่มคอลัมน์เลือกวันที่) */}
         {type === 'เกมเช็คอิน' && (
           <>
             {/* Card 1: รูปภาพแจ้งเตือน */}
             <div className="settings-card">
               <div className="settings-card-header">
                 <div className="settings-card-icon">🖼️</div>
                 <div className="settings-card-title">รูปภาพแจ้งเตือน</div>
                 <div className="settings-card-subtitle">แสดงเมื่อผู้เล่นเข้าสู่ระบบสำเร็จ</div>
               </div>
               <div className="settings-card-content">
             <div className="image-upload-section">
               <input
                 type="file"
                 accept="image/*"
                 onChange={async (e) => {
                   const f = e.target.files?.[0]
                   if (!f) return
                   if (!/^image\//.test(f.type)) { 
                     alert('โปรดเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, GIF)')
                     return 
                   }
                   
                   // ✅ Cleanup preview URL เก่า (ถ้ามี)
                   if (checkinImageDataUrl && checkinImageDataUrl.startsWith('blob:')) {
                     URL.revokeObjectURL(checkinImageDataUrl)
                   }
                   
                   setCheckinFileName(f.name)
                   setCheckinImageFile(f) // ✅ เก็บ File object ไว้
                   
                   // ✅ สร้าง preview URL จาก File object (ไม่ต้องอัปโหลดทันที)
                   try {
                     const previewUrl = URL.createObjectURL(f)
                     setCheckinImageDataUrl(previewUrl) // ใช้สำหรับ preview เท่านั้น
                   } catch (error) {
                     console.error('Error creating preview URL:', error)
                     // Fallback: ใช้ fileToDataURL
                     const data = await fileToDataURL(f)
                     setCheckinImageDataUrl(data)
                   }
                 }}
                 hidden
                 ref={(el) => {
                   if (el) (window as any).checkinImageInput = el
                 }}
               />
               
               {!checkinImageDataUrl ? (
                 <div 
                   className="image-upload-area"
                   onClick={() => (window as any).checkinImageInput?.click()}
                   style={{
                     border: '2px dashed rgba(255, 255, 255, 0.3)',
                     borderRadius: '16px',
                     padding: '40px 20px',
                     textAlign: 'center',
                     cursor: 'pointer',
                     transition: 'all 0.3s ease',
                     background: 'rgba(255, 255, 255, 0.05)',
                     marginBottom: '20px'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)'
                     e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                     e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                   }}
                 >
                   <div style={{ fontSize: '48px', marginBottom: '16px' }}>📷</div>
                   <div style={{ 
                     fontSize: '18px', 
                     fontWeight: '600', 
                     color: '#ffffff', 
                     marginBottom: '8px',
                     textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                   }}>
                     คลิกเพื่อเลือกรูปภาพ
                   </div>
                   <div style={{ 
                     fontSize: '14px', 
                     color: 'rgba(255, 255, 255, 0.7)',
                     textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                   }}>
                     รองรับไฟล์ JPG, PNG, GIF (ขนาดไม่เกิน 10MB)
                   </div>
                 </div>
               ) : (
                 <div className="image-preview-container" style={{
                   background: 'rgba(255, 255, 255, 0.95)',
                   borderRadius: '16px',
                   padding: '20px',
                   boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                   border: '1px solid rgba(255, 255, 255, 0.3)',
                   marginBottom: '20px'
                 }}>
                   <div className="image-preview-header" style={{
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     marginBottom: '16px',
                     paddingBottom: '12px',
                     borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                   }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ fontSize: '16px' }}>✅</span>
                       <span className="file-name" style={{ 
                         fontSize: '14px', 
                         fontWeight: '600', 
                         color: '#991B1B',
                         wordBreak: 'break-all'
                       }}>
                         {checkinFileName || 'รูปภาพถูกอัปโหลดแล้ว'}
                       </span>
                     </div>
                     <button
                       type="button"
                       className="btn-remove-image"
                       onClick={() => {
                         setCheckinImageDataUrl('')
                         setCheckinFileName('')
                       }}
                       style={{
                         background: 'rgba(239, 68, 68, 0.1)',
                         border: '1px solid rgba(239, 68, 68, 0.2)',
                         borderRadius: '8px',
                         padding: '6px 12px',
                         color: '#dc2626',
                         fontSize: '12px',
                         fontWeight: '600',
                         cursor: 'pointer',
                         transition: 'all 0.2s ease'
                       }}
                       onMouseEnter={(e) => {
                         e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                       }}
                       onMouseLeave={(e) => {
                         e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                       }}
                     >
                       🗑️ ลบรูปภาพ
                     </button>
                   </div>
                   <div style={{ textAlign: 'center' }}>
                     <img 
                       src={getImageUrl(checkinImageDataUrl)}
                       alt="Preview" 
                       className="image-preview"
                       style={{ 
                         maxWidth: '100%', 
                         maxHeight: '300px', 
                         borderRadius: '12px', 
                         boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                         objectFit: 'contain',
                         opacity: checkinImageUploading ? 0.5 : 1
                       }}
                     />
                     <div style={{
                       marginTop: '12px',
                       fontSize: '12px',
                       color: '#6b7280',
                       fontStyle: 'italic'
                     }}>
                       รูปภาพนี้จะแสดงใน popup เมื่อผู้เล่นเข้าสู่ระบบสำเร็จ
                     </div>
                   </div>
                 </div>
               )}
             </div>
               </div>
             </div>

             {/* Card 1.5: ระบบเปิด/ปิดส่วนต่างๆ */}
             <div className="settings-card">
               <div className="settings-card-header">
                 <div className="settings-card-icon">⚙️</div>
                 <div className="settings-card-title">การตั้งค่าการแสดงผล</div>
                 <div className="settings-card-subtitle">เปิด/ปิดการแสดงผลส่วนต่างๆ ในหน้าเกม</div>
               </div>
               <div className="settings-card-content">
                 <div style={{ marginTop: 14 }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                     {/* Daily Reward Toggle */}
                     <div style={{ 
                       display: 'flex', 
                       justifyContent: 'space-between', 
                       alignItems: 'center',
                       padding: '12px 16px',
                       background: '#f8fafc',
                       borderRadius: '12px',
                       border: '1px solid #e5e7eb'
                     }}>
                       <div>
                         <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: 4 }}>
                           Daily Reward
                         </div>
                         <div style={{ fontSize: '13px', color: '#64748b' }}>
                           แสดงการ์ดเช็คอินประจำวัน
                         </div>
                       </div>
                       <label style={{ 
                         position: 'relative', 
                         display: 'inline-block', 
                         width: '52px', 
                         height: '28px',
                         cursor: 'pointer'
                       }}>
                         <input
                           type="checkbox"
                           checked={checkinFeatures.dailyReward}
                           onChange={(e) => handleFeatureChange('dailyReward', e.target.checked)}
                           style={{ opacity: 0, width: 0, height: 0 }}
                         />
                         <span style={{
                           position: 'absolute',
                           top: 0,
                           left: 0,
                           right: 0,
                           bottom: 0,
                           backgroundColor: checkinFeatures.dailyReward ? '#22c55e' : '#cbd5e1',
                           borderRadius: '28px',
                           transition: 'background-color 0.3s',
                         }}>
                           <span style={{
                             position: 'absolute',
                             content: '""',
                             height: '22px',
                             width: '22px',
                             left: checkinFeatures.dailyReward ? '26px' : '3px',
                             bottom: '3px',
                             backgroundColor: 'white',
                             borderRadius: '50%',
                             transition: 'left 0.3s',
                             boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                           }} />
                         </span>
                       </label>
                     </div>

                     {/* Mini Slot Toggle */}
                     <div style={{ 
                       display: 'flex', 
                       justifyContent: 'space-between', 
                       alignItems: 'center',
                       padding: '12px 16px',
                       background: '#f8fafc',
                       borderRadius: '12px',
                       border: '1px solid #e5e7eb'
                     }}>
                       <div>
                         <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: 4 }}>
                           Mini Slot
                         </div>
                         <div style={{ fontSize: '13px', color: '#64748b' }}>
                           แสดงการ์ดเกมสล็อต
                         </div>
                       </div>
                       <label style={{ 
                         position: 'relative', 
                         display: 'inline-block', 
                         width: '52px', 
                         height: '28px',
                         cursor: 'pointer'
                       }}>
                         <input
                           type="checkbox"
                           checked={checkinFeatures.miniSlot}
                           onChange={(e) => handleFeatureChange('miniSlot', e.target.checked)}
                           style={{ opacity: 0, width: 0, height: 0 }}
                         />
                         <span style={{
                           position: 'absolute',
                           top: 0,
                           left: 0,
                           right: 0,
                           bottom: 0,
                           backgroundColor: checkinFeatures.miniSlot ? '#22c55e' : '#cbd5e1',
                           borderRadius: '28px',
                           transition: 'background-color 0.3s',
                         }}>
                           <span style={{
                             position: 'absolute',
                             content: '""',
                             height: '22px',
                             width: '22px',
                             left: checkinFeatures.miniSlot ? '26px' : '3px',
                             bottom: '3px',
                             backgroundColor: 'white',
                             borderRadius: '50%',
                             transition: 'left 0.3s',
                             boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                           }} />
                         </span>
                       </label>
                     </div>

                     {/* Coupon Shop Toggle */}
                     <div style={{ 
                       display: 'flex', 
                       justifyContent: 'space-between', 
                       alignItems: 'center',
                       padding: '12px 16px',
                       background: '#f8fafc',
                       borderRadius: '12px',
                       border: '1px solid #e5e7eb'
                     }}>
                       <div>
                         <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', marginBottom: 4 }}>
                           Coupon Shop
                         </div>
                         <div style={{ fontSize: '13px', color: '#64748b' }}>
                           แสดงการ์ดร้านแลกโค้ด
                         </div>
                       </div>
                       <label style={{ 
                         position: 'relative', 
                         display: 'inline-block', 
                         width: '52px', 
                         height: '28px',
                         cursor: 'pointer'
                       }}>
                         <input
                           type="checkbox"
                           checked={checkinFeatures.couponShop}
                           onChange={(e) => handleFeatureChange('couponShop', e.target.checked)}
                           style={{ opacity: 0, width: 0, height: 0 }}
                         />
                         <span style={{
                           position: 'absolute',
                           top: 0,
                           left: 0,
                           right: 0,
                           bottom: 0,
                           backgroundColor: checkinFeatures.couponShop ? '#22c55e' : '#cbd5e1',
                           borderRadius: '28px',
                           transition: 'background-color 0.3s',
                         }}>
                           <span style={{
                             position: 'absolute',
                             content: '""',
                             height: '22px',
                             width: '22px',
                             left: checkinFeatures.couponShop ? '26px' : '3px',
                             bottom: '3px',
                             backgroundColor: 'white',
                             borderRadius: '50%',
                             transition: 'left 0.3s',
                             boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                           }} />
                         </span>
                       </label>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             {/* Card 2: ตารางรางวัลเช็คอิน (ซ่อนเมื่อปิด Daily Reward) */}
             {checkinFeatures.dailyReward && (
             <div className="settings-card">
               <div className="settings-card-header">
                 <div className="settings-card-icon">🎁</div>
                 <div className="settings-card-title">ตารางรางวัลเช็คอิน</div>
                 <div className="settings-card-subtitle">กำหนดจำนวนวันและรางวัลสำหรับแต่ละวันเช็คอิน</div>
               </div>
               <div className="settings-card-content">
                 {/* ✅ วันที่เริ่มต้นและสิ้นสุดกิจกรรม */}
                 <div style={{ marginBottom: 16, padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                   <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 12 }}>
                     📅 ระยะเวลากิจกรรม
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                     <div>
                       <label className="f-label">วันที่เริ่มต้นกิจกรรม</label>
                       <input
                         type="date"
                         className="f-control"
                         value={checkinStartDate}
                         onChange={(e) => {
                           const newStartDate = e.target.value
                           setCheckinStartDate(newStartDate)
                           if (checkinEndDate && newStartDate > checkinEndDate) {
                             setCheckinEndDate('')
                           }
                         }}
                         max={checkinEndDate || undefined}
                         placeholder="เลือกวันที่เริ่มต้น"
                       />
                       <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                         User จะสามารถเช็คอิน DAY 1 ได้ในวันนี้
                       </div>
                     </div>
                     <div>
                       <label className="f-label">วันที่สิ้นสุดกิจกรรม</label>
                       <input
                         type="date"
                         className="f-control"
                         value={checkinEndDate}
                         onChange={(e) => setCheckinEndDate(e.target.value)}
                         min={checkinStartDate || undefined}
                         placeholder="เลือกวันที่สิ้นสุด"
                       />
                       <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                         กิจกรรมจะสิ้นสุดในวันนี้
                       </div>
                       {checkinStartDate && checkinEndDate && checkinEndDate >= checkinStartDate && (
                         <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
                           ✅ ระยะเวลา: {calculateDaysFromDates(checkinStartDate, checkinEndDate)} วัน
                         </div>
                       )}
                     </div>
                   </div>
                 </div>

                 {/* ✅ จำนวนวันสำหรับ CHECK-IN (คำนวณอัตโนมัติ) */}
                 <label className="f-label">
                   จำนวนวันสำหรับ CHECK-IN
                   {checkinStartDate && checkinEndDate && (
                     <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 8 }}>
                       (คำนวณอัตโนมัติ: {calculateDaysFromDates(checkinStartDate, checkinEndDate)} วัน)
                     </span>
                   )}
                 </label>
            <input
              type="number"
              min={1}
              max={30}
              className="f-control"
              value={checkinDays}
              readOnly={!!(checkinStartDate && checkinEndDate)}  // ✅ ถ้ามีวันที่เริ่มต้นและสิ้นสุด ให้ read-only
              style={{
                backgroundColor: checkinStartDate && checkinEndDate ? '#f8fafc' : '#fff',
                cursor: checkinStartDate && checkinEndDate ? 'not-allowed' : 'text'
              }}
              onChange={(e) => {
                // ✅ อนุญาตให้แก้ไขได้เฉพาะเมื่อไม่มีวันที่เริ่มต้นและสิ้นสุด
                if (checkinStartDate && checkinEndDate) return
                const d = clamp(Number(e.target.value) || 1, 1, 30)
                setCheckinDays(d)
                setRewards(prev => {
                  const next = [...prev]
                  if (next.length < d) {
                    while (next.length < d) next.push({ kind: 'coin', value: 1000 })
                  } else {
                    next.length = d
                  }
                  return next
                })
              }}
              placeholder={checkinStartDate && checkinEndDate ? 'คำนวณอัตโนมัติ' : 'ระบุจำนวนวัน'}
            />
            {checkinStartDate && checkinEndDate && (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                จำนวนวันถูกคำนวณอัตโนมัติจากวันที่เริ่มต้นและสิ้นสุดกิจกรรม
              </div>
            )}
            {(!checkinStartDate || !checkinEndDate) && (
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
                💡 คำแนะนำ: เลือกวันที่เริ่มต้นและสิ้นสุดกิจกรรมเพื่อให้ระบบคำนวณจำนวนวันอัตโนมัติ
              </div>
            )}
            <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
              {/* หัวตาราง */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '86px 160px 1fr', // ✅ ลบคอลัมน์วันที่ออก
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
              </div>

              {/* รายการวัน */}
              {rewards.slice(0, checkinDays).map((r, i) => {
                // ฟังก์ชันสำหรับอัพโหลดโค้ดจากไฟล์ (ใช้ระบบเดียวกับเกมอื่นๆ)
                const handleCodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0]
                  if (!file) return

                  try {
                    // ใช้ฟังก์ชัน parseCodesFromFile ที่มีอยู่แล้ว
                    const codes = await parseCodesFromFile(file)
                    if (codes.length > 0) {
                      // ✅ แสดง popup ยืนยันก่อนบันทึก
                      setConfirmCodeUpload({
                        open: true,
                        type: 'dailyReward',
                        index: i,
                        codes: codes,
                        onConfirm: async () => {
                          // ✅ ไม่เก็บโค้ดใน rewards state (จะบันทึกแยกใน DB)
                          setRewards(prev => {
                            const next = [...prev]
                            next[i] = { ...next[i], value: '' }  // ✅ เก็บเป็น string ว่าง
                            return next
                          })
                          // ✅ เก็บโค้ดที่อัพโหลดใหม่ไว้ใน dailyRewardCodes (เพื่อบันทึกไปที่ DB)
                          setDailyRewardCodes(prev => {
                            const next = [...prev]
                            next[i] = codes
                            return next
                          })
                          // ✅ อัพเดทจำนวนโค้ดหลังจากอัพโหลด
                          setDailyRewardCodeCounts(prev => {
                            const next = [...prev]
                            next[i] = codes.length
                            return next
                          })
                          
                          // ✅ บันทึกโค้ดทันที (ถ้าเป็นเกมเช็คอินและอยู่ในโหมดแก้ไข)
                          if (isEdit && gameId && type === 'เกมเช็คอิน') {
                            try {
                              // ✅ ใช้ PostgreSQL adapter
                              const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
                              // ✅ โครงสร้างข้อมูล: checkin อยู่ใน game_data JSONB (ถูก spread จาก backend)
                              const currentCheckin = (currentGame as any).checkin || {}
                              if (!currentCheckin.rewardCodes) currentCheckin.rewardCodes = {}
                              currentCheckin.rewardCodes[i] = {
                                cursor: 0,
                                codes: codes
                              }
                              // ✅ อัพเดทเฉพาะ checkin data
                              await postgresqlAdapter.updateGame(gameId, {
                                checkin: currentCheckin
                              })
                              alert(`อัปโหลด CODE สำเร็จ ${codes.length.toLocaleString('th-TH')} รายการ`)
                            } catch (error) {
                              console.error('Error saving codes:', error)
                              alert('เกิดข้อผิดพลาดในการบันทึกโค้ด')
                            }
                          } else {
                            alert(`อัปโหลด CODE สำเร็จ ${codes.length.toLocaleString('th-TH')} รายการ (จะบันทึกเมื่อกดบันทึกเกม)`)
                          }
                          
                          setConfirmCodeUpload({
                            open: false,
                            type: null,
                            index: null,
                            codes: null,
                            onConfirm: null
                          })
                        }
                      })
                    } else {
                      alert('ไม่พบ CODE ที่ตรงเงื่อนไขในไฟล์\nตรวจสอบคอลัมน์ E (serialcode) และคอลัมน์ G, H, K ต้องว่าง')
                    }
                  } catch (error) {
                    console.error('Error loading file:', error)
                    alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
                  } finally {
                    // Reset input เพื่อให้สามารถอัพโหลดไฟล์เดิมได้อีกครั้ง
                    if (e.target) {
                      e.target.value = ''
                    }
                  }
                }

                return (
                  <div
                    key={i}
                    style={{
                      borderBottom: i === checkinDays - 1 ? 'none' : '1px solid #f1f5f9',
                      padding: '10px 12px'
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '86px 160px 1fr', // ✅ ลบคอลัมน์วันที่ออก
                        gap: 8,
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
                              value: kind === 'coin' ? (Number(next[i].value) || 1000) : String(next[i].value || '')
                            }
                            return next
                          })
                        }}
                      >
                        <option value="coin">{coinName}</option>
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
                        <div style={{ position: 'relative' }}>
                          <input
                            className="f-control"
                            value={
                              dailyRewardCodeCountsLoading 
                                ? '...' 
                                : dailyRewardCodes[i] && dailyRewardCodes[i].length > 0
                                  ? `🆕 ${dailyRewardCodes[i].length.toLocaleString('th-TH')} CODE (ใหม่)`
                                  : dailyRewardCodeCounts[i] !== undefined 
                                    ? `${dailyRewardCodeCounts[i].toLocaleString('th-TH')} CODE`
                                    : ''
                            }
                            readOnly
                            placeholder="อัพโหลดไฟล์เพื่อเพิ่มโค้ด"
                            style={{ 
                              backgroundColor: dailyRewardCodes[i] && dailyRewardCodes[i].length > 0
                                ? '#fef3c7'  // สีเหลืองสำหรับโค้ดใหม่
                                : dailyRewardCodeCounts[i] !== undefined && dailyRewardCodeCounts[i] > 0 
                                  ? '#f0f9ff' 
                                  : '#fff',
                              cursor: 'default',
                              color: dailyRewardCodeCountsLoading ? '#94a3b8' : '#1e293b',
                              fontWeight: dailyRewardCodes[i] && dailyRewardCodes[i].length > 0 ? 600 : 400
                            }}
                          />
                          {dailyRewardCodeCountsLoading && (
                            <div style={{
                              position: 'absolute',
                              right: '12px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              fontSize: '12px',
                              color: '#64748b'
                            }}>
                              กำลังโหลด...
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ✅ ส่วนอัพโหลดโค้ด (แสดงเฉพาะเมื่อเลือกเป็น CODE) */}
                    {r.kind === 'code' && (
                      <div style={{ marginTop: 8, paddingLeft: 94 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <input
                            type="file"
                            accept=".xlsx,.xls,.csv,.txt"
                            onChange={handleCodeUpload}
                            style={{ display: 'none' }}
                            id={`code-upload-${i}`}
                          />
                          <button
                            type="button"
                            className="btn-upload"
                            onClick={() => (document.getElementById(`code-upload-${i}`) as HTMLInputElement)?.click()}
                          >
                            ⬆️ อัปโหลด CODE
                          </button>
                        </div>
                        
                        {/* ✅ แสดงข้อความแทนการแสดงโค้ดทั้งหมด (เพื่อป้องกันหน่วง) */}
                        <div
                          style={{
                            marginTop: 8,
                            border: dailyRewardCodes[i] && dailyRewardCodes[i].length > 0 ? '2px solid #f59e0b' : '1px solid #eef2f7',
                            borderRadius: 10,
                            padding: 16,
                            background: dailyRewardCodes[i] && dailyRewardCodes[i].length > 0 ? '#fef3c7' : '#f8fafc',
                            textAlign: 'center'
                          }}
                        >
                          {dailyRewardCodeCountsLoading ? (
                            <div className="muted" style={{ padding: '8px' }}>
                              <div style={{display:'inline-block', width:'16px', height:'16px', border:'2px solid #f3f3f3', borderTop:'2px solid #3498db', borderRadius:'50%', animation:'spin 1s linear infinite', marginRight: 8}}></div>
                              กำลังโหลดจำนวนโค้ด...
                            </div>
                          ) : dailyRewardCodes[i] && dailyRewardCodes[i].length > 0 ? (
                            <div style={{ color: '#d97706', fontWeight: 600 }}>
                              🆕 อัพโหลด CODE ใหม่แล้ว: {dailyRewardCodes[i].length.toLocaleString('th-TH')} รายการ
                              <div style={{ fontSize: '12px', color: '#92400e', marginTop: 4, fontWeight: 500 }}>
                                ⚠️ โค้ดใหม่รอการบันทึก (กดปุ่ม "บันทึก" เพื่อบันทึกโค้ดลงฐานข้อมูล)
                              </div>
                            </div>
                          ) : dailyRewardCodeCounts[i] !== undefined && dailyRewardCodeCounts[i] > 0 ? (
                            <div style={{ color: '#059669', fontWeight: 600 }}>
                              ✅ มีโค้ด {dailyRewardCodeCounts[i].toLocaleString('th-TH')} รายการในฐานข้อมูล
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4, fontWeight: 400 }}>
                                โค้ดถูกเก็บไว้ในฐานข้อมูลแล้ว ไม่ต้องแสดงทั้งหมดเพื่อป้องกันหน่วง
                              </div>
                            </div>
                          ) : (
                            <div className="muted" style={{ padding: '8px' }}>
                              ยังไม่มี CODE (อัพโหลดไฟล์เพื่อเพิ่มโค้ด)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              
            </div>
               </div>
             </div>
             )}

             {/* Card 2.5: รางวัลครบทุกวัน (ซ่อนเมื่อปิด Daily Reward) */}
             {checkinFeatures.dailyReward && (
             <div className="settings-card">
               <div className="settings-card-header">
                 <div className="settings-card-icon">🏆</div>
                 <div className="settings-card-title">รางวัลครบทุกวัน</div>
                 <div className="settings-card-subtitle">รางวัลสำหรับผู้ที่เช็คอินครบทุกวัน ({checkinDays} วัน)</div>
               </div>
               <div className="settings-card-content">
                 <div style={{ marginTop: 14 }}>
                   <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'center' }}>
                     <label className="f-label">ของรางวัล</label>
                     <select
                       className="f-control"
                       value={completeReward.kind}
                       onChange={(e) => {
                         const kind = (e.target.value as 'coin' | 'code')
                         setCompleteReward(prev => ({
                           kind,
                           value: kind === 'coin' ? (Number(prev.value) || 0) : String(prev.value || '')
                         }))
                       }}
                     >
                       <option value="coin">{coinName}</option>
                       <option value="code">CODE</option>
                     </select>
                   </div>

                   {completeReward.kind === 'coin' ? (
                     <div style={{ marginTop: 8 }}>
                       <label className="f-label">จำนวนเหรียญที่ได้รับ</label>
                       <input
                         type="number"
                         min={0}
                         className="f-control"
                         value={Number(completeReward.value) || 0}
                         onChange={(e) => {
                           const v = clamp(Number(e.target.value) || 0, 0, 99999999)
                           setCompleteReward(prev => ({ ...prev, value: v }))
                         }}
                         placeholder="จำนวนเหรียญที่ได้รับ"
                       />
                     </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <label className="f-label">โค้ดรางวัล</label>
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <input
                          className="f-control"
                          value={
                            completeRewardCodeCountLoading 
                              ? '...' 
                              : completeRewardCodes.length > 0
                                ? `🆕 ${completeRewardCodes.length.toLocaleString('th-TH')} CODE (ใหม่)`
                                : completeRewardCodeCount > 0 
                                  ? `${completeRewardCodeCount.toLocaleString('th-TH')} CODE`
                                  : ''
                          }
                          readOnly
                          placeholder="อัพโหลดไฟล์เพื่อเพิ่มโค้ด"
                          style={{ 
                            backgroundColor: completeRewardCodes.length > 0
                              ? '#fef3c7'  // สีเหลืองสำหรับโค้ดใหม่
                              : completeRewardCodeCount > 0 
                                ? '#f0f9ff' 
                                : '#fff',
                            cursor: 'default',
                            color: completeRewardCodeCountLoading ? '#94a3b8' : '#1e293b',
                            fontWeight: completeRewardCodes.length > 0 ? 600 : 400
                          }}
                        />
                        {completeRewardCodeCountLoading && (
                          <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '12px',
                            color: '#64748b'
                          }}>
                            กำลังโหลด...
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: 8 }}>
                        {completeRewardCodeCountLoading 
                          ? 'กำลังโหลดจำนวนโค้ด...'
                          : completeRewardCodes.length > 0
                            ? `🆕 อัพโหลด CODE ใหม่แล้ว: ${completeRewardCodes.length.toLocaleString('th-TH')} รายการ (รอการบันทึก)`
                            : completeRewardCodeCount > 0 
                              ? `✅ มีโค้ด ${completeRewardCodeCount.toLocaleString('th-TH')} รายการในฐานข้อมูล`
                              : 'ยังไม่มีโค้ด (อัพโหลดไฟล์เพื่อเพิ่มโค้ด)'}
                      </div>
                      {(() => {
                        return (
                          <>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                               <input
                                 type="file"
                                 accept=".xlsx,.xls,.csv,.txt"
                                 onChange={async (e) => {
                                   const file = e.target.files?.[0]
                                   if (!file) return

                                    try {
                                     const codes = await parseCodesFromFile(file)
                                     if (codes.length > 0) {
                                       // ✅ แสดง popup ยืนยันก่อนบันทึก
                                       setConfirmCodeUpload({
                                         open: true,
                                         type: 'completeReward',
                                         index: null,
                                         codes: codes,
                                         onConfirm: async () => {
                                           // ✅ ไม่เก็บโค้ดใน completeReward state (จะบันทึกแยกใน DB)
                                           setCompleteReward(prev => ({ ...prev, value: '' }))
                                           // ✅ เก็บโค้ดที่อัพโหลดใหม่ไว้ใน completeRewardCodes (เพื่อบันทึกไปที่ DB)
                                           setCompleteRewardCodes(codes)
                                           // ✅ อัพเดทจำนวนโค้ดหลังจากอัพโหลด
                                           setCompleteRewardCodeCount(codes.length)
                                           
                                           // ✅ บันทึกโค้ดทันที (ถ้าเป็นเกมเช็คอินและอยู่ในโหมดแก้ไข)
                                           if (isEdit && gameId && type === 'เกมเช็คอิน') {
                                             try {
                                               // ✅ ใช้ PostgreSQL adapter
                                               const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
                                               // ✅ โครงสร้างข้อมูล: checkin อยู่ใน game_data JSONB (ถูก spread จาก backend)
                                               const currentCheckin = (currentGame as any).checkin || {}
                                               currentCheckin.completeRewardCodes = {
                                                 cursor: 0,
                                                 codes: codes
                                               }
                                               // ✅ อัพเดทเฉพาะ checkin data
                                               await postgresqlAdapter.updateGame(gameId, {
                                                 checkin: currentCheckin
                                               })
                                               alert(`อัปโหลด CODE สำเร็จ ${codes.length.toLocaleString('th-TH')} รายการ`)
                                             } catch (error) {
                                               console.error('Error saving codes:', error)
                                               alert('เกิดข้อผิดพลาดในการบันทึกโค้ด')
                                             }
                                           } else {
                                             alert(`อัปโหลด CODE สำเร็จ ${codes.length.toLocaleString('th-TH')} รายการ (จะบันทึกเมื่อกดบันทึกเกม)`)
                                           }
                                           
                                           setConfirmCodeUpload({
                                             open: false,
                                             type: null,
                                             index: null,
                                             codes: null,
                                             onConfirm: null
                                           })
                                         }
                                       })
                                     } else {
                                       alert('ไม่พบ CODE ที่ตรงเงื่อนไขในไฟล์\nตรวจสอบคอลัมน์ E (serialcode) และคอลัมน์ G, H, K ต้องว่าง')
                                     }
                                   } catch (error) {
                                     console.error('Error loading file:', error)
                                     alert('เกิดข้อผิดพลาดในการอ่านไฟล์')
                                   } finally {
                                     if (e.target) {
                                       e.target.value = ''
                                     }
                                   }
                                 }}
                                 style={{ display: 'none' }}
                                 id="complete-reward-code-upload"
                               />
                               <button
                                 type="button"
                                 className="btn-upload"
                                 onClick={() => (document.getElementById('complete-reward-code-upload') as HTMLInputElement)?.click()}
                               >
                                 ⬆️ อัปโหลด CODE
                               </button>
                             </div>
                             
                             {/* ✅ แสดงข้อความแทนการแสดงโค้ดทั้งหมด (เพื่อป้องกันหน่วง) */}
                             <div
                               style={{
                                 marginTop: 8,
                                 border: completeRewardCodes.length > 0 ? '2px solid #f59e0b' : '1px solid #eef2f7',
                                 borderRadius: 10,
                                 padding: 16,
                                 background: completeRewardCodes.length > 0 ? '#fef3c7' : '#f8fafc',
                                 textAlign: 'center'
                               }}
                             >
                               {completeRewardCodeCountLoading ? (
                                 <div className="muted" style={{ padding: '8px' }}>
                                   <div style={{display:'inline-block', width:'16px', height:'16px', border:'2px solid #f3f3f3', borderTop:'2px solid #3498db', borderRadius:'50%', animation:'spin 1s linear infinite', marginRight: 8}}></div>
                                   กำลังโหลดจำนวนโค้ด...
                                 </div>
                               ) : completeRewardCodes.length > 0 ? (
                                 <div style={{ 
                                   color: '#d97706', 
                                   fontWeight: 600
                                 }}>
                                   🆕 อัพโหลด CODE ใหม่แล้ว: {completeRewardCodes.length.toLocaleString('th-TH')} รายการ
                                   <div style={{ fontSize: '12px', color: '#92400e', marginTop: 4, fontWeight: 500 }}>
                                     ⚠️ โค้ดใหม่รอการบันทึก (กดปุ่ม "บันทึก" เพื่อบันทึกโค้ดลงฐานข้อมูล)
                                   </div>
                                 </div>
                               ) : completeRewardCodeCount > 0 ? (
                                 <div style={{ color: '#059669', fontWeight: 600 }}>
                                   ✅ มีโค้ด {completeRewardCodeCount.toLocaleString('th-TH')} รายการในฐานข้อมูล
                                   <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4, fontWeight: 400 }}>
                                     โค้ดถูกเก็บไว้ในฐานข้อมูลแล้ว ไม่ต้องแสดงทั้งหมดเพื่อป้องกันหน่วง
                                   </div>
                                 </div>
                               ) : (
                                 <div className="muted" style={{ padding: '8px' }}>
                                   ยังไม่มี CODE (อัพโหลดไฟล์เพื่อเพิ่มโค้ด)
                                 </div>
                               )}
                             </div>
                           </>
                         )
                       })()}
                     </div>
                   )}
                 </div>
               </div>
             </div>
             )}

             {/* Card 3: ตั้งค่าเกมสล็อต */}
             <div className="settings-card">
               <div className="settings-card-header">
                 <div className="settings-card-icon">🎰</div>
                 <div className="settings-card-title">เกมสล็อต</div>
                 <div className="settings-card-subtitle">ตั้งค่าการเล่นสล็อตในหน้าเช็คอิน</div>
               </div>
               <div className="settings-card-content">
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
                        * เครดิตจะดึงจาก {branding.title} COIN ของผู้เล่นโดยตรง และอัปเดตจริงลง DB
                      </div>
                    </div>
               </div>
             </div>

             {/* Card 4: ตั้งค่า Coupon Shop */}
             <div className="settings-card">
               <div className="settings-card-header">
                 <div className="settings-card-icon">🎫</div>
                 <div className="settings-card-title">Coupon Shop</div>
                 <div className="settings-card-subtitle">ตั้งค่าร้านแลกโค้ดในหน้าเช็คอิน</div>
               </div>
               <div className="settings-card-content">
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
                                <label className="f-label">ราคาแลก : {branding.title} COIN</label>
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
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="text"
                                      className="f-control"
                                      value={
                                        couponItemCodeCountsLoading 
                                          ? '...' 
                                          : couponItemCodesNew[i] && couponItemCodesNew[i].length > 0
                                            ? `🆕 ${couponItemCodesNew[i].length.toLocaleString('th-TH')} (ใหม่)`
                                            : couponItemCodeCounts[i] !== undefined 
                                              ? `${couponItemCodeCounts[i].toLocaleString('th-TH')}`
                                              : '0'
                                      }
                                      readOnly
                                      style={{ 
                                        background: couponItemCodesNew[i] && couponItemCodesNew[i].length > 0
                                          ? '#fef3c7'  // สีเหลืองสำหรับโค้ดใหม่
                                          : '#f8fafc',
                                        cursor: 'not-allowed',
                                        color: couponItemCodeCountsLoading ? '#94a3b8' : '#1e293b',
                                        fontWeight: couponItemCodesNew[i] && couponItemCodesNew[i].length > 0 ? 600 : 400
                                      }}
                                    />
                                    {couponItemCodeCountsLoading && (
                                      <div style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        fontSize: '12px',
                                        color: '#64748b'
                                      }}>
                                        กำลังโหลด...
                                      </div>
                                    )}
                                  </div>
                                  {/* ปุ่มอัปโหลดไฟล์ */}
                                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                                    <input
                                      id={`import-codes-${i}`}
                                      type="file"
                                      accept=".xlsx,.xls,.csv,.txt"
                                      style={{ display:'none' }}
                                      onChange={async (e) => {
                                        const f = e.currentTarget.files?.[0]
                                        if (!f) return
                                        try {
                                          const codes = await parseCodesFromFile(f)
                                          if (!codes.length) {
                                            alert('ไม่พบ CODE ที่ตรงเงื่อนไขในไฟล์\nตรวจสอบคอลัมน์ E (serialcode) และคอลัมน์ G, H, K ต้องว่าง')
                                            return
                                          }
                                          
                                          // ✅ แสดง popup ยืนยันก่อนบันทึก
                                          setConfirmCodeUpload({
                                            open: true,
                                            type: 'couponItem',
                                            index: i,
                                            codes: codes,
                                            onConfirm: async () => {
                                              // ✅ ไม่เก็บโค้ดใน couponItems state (จะบันทึกแยกใน DB)
                                              setCouponItems(prev => {
                                                const next = [...prev]
                                                next[i] = { ...next[i], codes: [''] }  // ✅ เก็บเป็น array ว่าง
                                                return next
                                              })
                                              
                                              // ✅ เก็บโค้ดที่อัพโหลดใหม่ไว้ใน couponItemCodesNew (เพื่อบันทึกไปที่ DB)
                                              setCouponItemCodesNew(prev => {
                                                const next = [...prev]
                                                next[i] = codes
                                                return next
                                              })
                                              
                                              // ✅ อัพเดทจำนวนโค้ดหลังจากอัพโหลด
                                              setCouponItemCodeCounts(prev => {
                                                const next = [...prev]
                                                next[i] = codes.length
                                                return next
                                              })
                                              
                                              // ✅ บันทึกโค้ดทันที (ถ้าเป็นเกมเช็คอินและอยู่ในโหมดแก้ไข)
                                              if (isEdit && gameId && type === 'เกมเช็คอิน') {
                                                try {
                                                  // ✅ ใช้ PostgreSQL adapter
                                                  const currentGame = (await postgresqlAdapter.getGameData(gameId) || {}) as GameData
                                                  const currentCheckin = (currentGame as any).gameData?.checkin || {}
                                                  if (!currentCheckin.coupon) currentCheckin.coupon = {}
                                                  if (!currentCheckin.coupon.items) currentCheckin.coupon.items = []
                                                  if (!currentCheckin.coupon.items[i]) currentCheckin.coupon.items[i] = {}
                                                  currentCheckin.coupon.items[i].codes = codes
                                                  await postgresqlAdapter.updateGame(gameId, {
                                                    ...currentGame,
                                                    gameData: {
                                                      ...(currentGame as any).gameData,
                                                      checkin: currentCheckin
                                                    }
                                                  })
                                                  alert(`อัปโหลด CODE สำเร็จ ${codes.length.toLocaleString('th-TH')} รายการ`)
                                                } catch (error) {
                                                  console.error('Error saving codes:', error)
                                                  alert('เกิดข้อผิดพลาดในการบันทึกโค้ด')
                                                }
                                              } else {
                                                alert(`อัปโหลด CODE สำเร็จ ${codes.length.toLocaleString('th-TH')} รายการ (จะบันทึกเมื่อกดบันทึกเกม)`)
                                              }
                                              
                                              setConfirmCodeUpload({
                                                open: false,
                                                type: null,
                                                index: null,
                                                codes: null,
                                                onConfirm: null
                                              })
                                            }
                                          })
                                        } 
                                        catch (err:any) { 
                                          alert(err?.message || 'นำเข้าไม่สำเร็จ') 
                                        }
                                        finally { 
                                          if (e.currentTarget) {
                                            e.currentTarget.value = '' 
                                          }
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="btn-upload"
                                      onClick={() => (document.getElementById(`import-codes-${i}`) as HTMLInputElement)?.click()}
                                    >
                                      ⬆️ อัปโหลด CODE
                                    </button>
                                  </div>
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4 }}>
                                  {couponItemCodeCountsLoading 
                                    ? 'กำลังโหลดจำนวนโค้ด...'
                                    : couponItemCodesNew[i] && couponItemCodesNew[i].length > 0
                                      ? `🆕 อัพโหลด CODE ใหม่แล้ว: ${couponItemCodesNew[i].length.toLocaleString('th-TH')} รายการ (รอการบันทึก)`
                                      : couponItemCodeCounts[i] !== undefined 
                                        ? `✅ มีโค้ด ${couponItemCodeCounts[i].toLocaleString('th-TH')} รายการในฐานข้อมูล`
                                        : 'ยังไม่มีโค้ด (อัพโหลดไฟล์เพื่อเพิ่มโค้ด)'}
                                </div>
                              </div>
                            </div>

                            {/* ✅ แสดงข้อความแทนการแสดงโค้ดทั้งหมด (เพื่อป้องกันหน่วง) */}
                            <div
                              style={{
                                marginTop: 8,
                                border: couponItemCodesNew[i] && couponItemCodesNew[i].length > 0 ? '2px solid #f59e0b' : '1px solid #eef2f7',
                                borderRadius: 10,
                                padding: 16,
                                background: couponItemCodesNew[i] && couponItemCodesNew[i].length > 0 ? '#fef3c7' : '#f8fafc',
                                textAlign: 'center'
                              }}
                            >
                              {couponItemCodeCountsLoading ? (
                                <div className="muted" style={{ padding: '8px' }}>
                                  <div style={{display:'inline-block', width:'16px', height:'16px', border:'2px solid #f3f3f3', borderTop:'2px solid #3498db', borderRadius:'50%', animation:'spin 1s linear infinite', marginRight: 8}}></div>
                                  กำลังโหลดจำนวนโค้ด...
                                </div>
                              ) : couponItemCodesNew[i] && couponItemCodesNew[i].length > 0 ? (
                                <div style={{ color: '#d97706', fontWeight: 600 }}>
                                  🆕 อัพโหลด CODE ใหม่แล้ว: {couponItemCodesNew[i].length.toLocaleString('th-TH')} รายการ
                                  <div style={{ fontSize: '12px', color: '#92400e', marginTop: 4, fontWeight: 500 }}>
                                    ⚠️ โค้ดใหม่รอการบันทึก (กดปุ่ม "บันทึก" เพื่อบันทึกโค้ดลงฐานข้อมูล)
                                  </div>
                                </div>
                              ) : couponItemCodeCounts[i] !== undefined && couponItemCodeCounts[i] > 0 ? (
                                <div style={{ color: '#059669', fontWeight: 600 }}>
                                  ✅ มีโค้ด {couponItemCodeCounts[i].toLocaleString('th-TH')} รายการในฐานข้อมูล
                                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: 4, fontWeight: 400 }}>
                                    โค้ดถูกเก็บไว้ในฐานข้อมูลแล้ว ไม่ต้องแสดงทั้งหมดเพื่อป้องกันหน่วง
                                  </div>
                                </div>
                              ) : (
                                <div className="muted" style={{ padding: '8px' }}>
                                  ยังไม่มี CODE (อัพโหลดไฟล์เพื่อเพิ่มโค้ด)
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                  </div>
               </div>
             </div>
     
          </>
              
        )}

        {/* ===== ส่วนกลางที่ใช้ร่วมกันทุกประเภท (เฉพาะโหมดแก้ไข): ลิงก์ + คัดลอก + ท็อกเกิล ===== */}
        {isEdit && (
          <>
            {/* Container สำหรับลิงก์และปุ่มควบคุม */}
            <div className="game-controls-container" style={{
              background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%)',
              border: '1px solid rgba(251, 146, 60, 0.3)',
              borderRadius: '16px',
              padding: '20px',
              marginTop: '20px',
              boxShadow: '0 8px 32px rgba(251, 146, 60, 0.15)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(251, 146, 60, 0.2)'
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  borderRadius: '8px',
                  padding: '8px',
                  marginRight: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '18px' }}>🔗</span>
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1f2937',
                    textShadow: '0 1px 2px rgba(255,255,255,0.5)'
                  }}>
                    ลิงก์สำหรับส่งให้ลูกค้า
                  </h3>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    คัดลอกลิงก์นี้เพื่อส่งให้ลูกค้าเล่นเกม
                  </p>
                </div>
              </div>

              {/* ลิงก์และปุ่มคัดลอก */}
              <div className="share-row" style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <input
                  id="customerLinkInput"
                  className="f-control"
                value={getPlayerLink(gameId)}
                  readOnly
                  style={{
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1f2937',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }}
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
                  style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 20px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.3)';
                  }}
                >
                  <span className="ico">📋</span> คัดลอกลิงก์
                </button>
              </div>
            </div>
          </>
        )}

        {/* ลิงก์สำหรับ HOST (เฉพาะเกม BINGO) */}
        {isEdit && type === 'เกม BINGO' && (
          <div className="host-link-container" style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(196, 181, 253, 0.1) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            marginTop: '20px',
            boxShadow: '0 8px 32px rgba(168, 85, 247, 0.1)'
          }}>
            {/* Header */}
            <div className="host-link-header" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(168, 85, 247, 0.2)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
              }}>
                <span style={{ fontSize: '18px' }}>👑</span>
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1f2937',
                  textShadow: '0 1px 2px rgba(255,255,255,0.5)'
                }}>
                  ลิงก์สำหรับ HOST
                </h3>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  คัดลอกลิงก์นี้เพื่อเข้าหน้าเล่นเกม BINGO สำหรับ HOST
                </p>
              </div>
            </div>
            {/* ลิงก์และปุ่มคัดลอก */}
            <div className="host-share-row" style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px'
            }}>
              <input
                id="hostLinkInput"
                className="f-control"
                value={getHostLink(gameId)}
                readOnly
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#1f2937',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              />
              <button
                className="btn-copy"
                onClick={async () => {
                  const el = document.getElementById('hostLinkInput') as HTMLInputElement | null;
                  if (!el) return;
                  const text = el.value;
                  try {
                    if (navigator.clipboard && window.isSecureContext) {
                      await navigator.clipboard.writeText(text);
                      alert('คัดลอกลิงก์ HOST เรียบร้อยแล้ว');
                    } else {
                      // fallback textarea method
                      el.select();
                      el.setSelectionRange(0, text.length);
                      const ok = document.execCommand('copy');
                      alert(ok ? 'คัดลอกลิงก์ HOST เรียบร้อยแล้ว' : 'คัดลอกไม่สำเร็จ');
                    }
                  } catch (e) {
                    alert('คัดลอกไม่สำเร็จ');
                  }
                }}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 85, 247, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
                }}
              >
                <span className="ico">📋</span> คัดลอกลิงก์
              </button>
            </div>
          </div>
        )}

        {/* ลิงก์สำหรับแอดมิน - Container แยกต่างหาก */}
        {isEdit && (
          <div className="admin-link-container" style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            marginTop: '20px',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.1)'
          }}>
            {/* Header */}
            <div className="admin-link-header" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                <span style={{ fontSize: '18px' }}>🔗</span>
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1f2937',
                  textShadow: '0 1px 2px rgba(255,255,255,0.5)'
                }}>
                  ลิงก์สำหรับแอดมิน
                </h3>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  คัดลอกลิงก์นี้เพื่อเข้าดูคำตอบผู้เล่น
                </p>
              </div>
            </div>

            {/* ลิงก์และปุ่มคัดลอก */}
            <div className="admin-share-row" style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '12px'
            }}>
              <input
                id="adminLinkInput"
                className="f-control"
                value={`${location.origin}/admin/answers/${gameId}`}
                readOnly
                style={{
                  background: '#fff',
                  border: '1px solid var(--theme-border-light)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--theme-text-primary)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              />
              <button
                className="btn-copy-admin"
                onClick={() => {
                  navigator.clipboard.writeText(`${location.origin}/admin/answers/${gameId}`)
                  const el = document.getElementById('adminLinkInput') as HTMLInputElement | null
                  if (el) el.select()
                  const toast = document.createElement('div')
                  toast.textContent = 'คัดลอกลิงก์แล้ว'
                  toast.style.position = 'fixed'
                  toast.style.right = '16px'
                  toast.style.bottom = '16px'
                  toast.style.background = 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)'
                  toast.style.color = '#fff'
                  toast.style.padding = '10px 14px'
                  toast.style.borderRadius = '8px'
                  toast.style.fontWeight = '800'
                  document.body.appendChild(toast)
                  setTimeout(()=>toast.remove(), 1200)
                }}
                style={{
                  background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease',
                  minWidth: '120px',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                }}
              >
                <span className="ico">📋</span> คัดลอกลิงก์
              </button>
            </div>
          </div>
        )}

        {/* ===== ปุ่มเริ่มเกม BINGO สำหรับแอดมิน - ย้ายไปไว้ในหน้า HOST แล้ว ===== */}
        {/* {isEdit && type === 'เกม BINGO' && (
          <div className="admin-start-game-container" style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.05) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            marginTop: '20px',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}>
                <span style={{ fontSize: '20px' }}>🎮</span>
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>
                  {bingoGameStatus === 'waiting' ? 'เริ่มเกม BINGO' : 
                   bingoGameStatus === 'countdown' ? '⏳ เกมกำลังนับถอยหลัง' :
                   bingoGameStatus === 'playing' ? '🎮 เกมกำลังเล่นอยู่' :
                   bingoGameStatus === 'finished' ? '🏁 เกมจบแล้ว' :
                   'เริ่มเกม BINGO'}
                </h3>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  {bingoGameStatus === 'waiting' ? 'คลิกเพื่อเริ่มเกม BINGO' :
                   bingoGameStatus === 'countdown' ? 'รอเกมเริ่มในอีกไม่กี่วินาที' :
                   bingoGameStatus === 'playing' ? 'เกมกำลังเล่นอยู่' :
                   bingoGameStatus === 'finished' ? 'เกมนี้จบแล้ว' :
                   'คลิกเพื่อเริ่มเกม BINGO'}
                </p>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  // ✅ ใช้ PostgreSQL adapter
                  const currentState = await postgresqlAdapter.getBingoGameState(gameId)
                  
                  // ถ้าเกมเริ่มแล้ว ให้แจ้งเตือน
                  if (currentState && currentState.status && currentState.status !== 'waiting') {
                    alert(`⚠️ เกมได้เริ่มแล้ว (สถานะ: ${currentState.status})`)
                    return
                  }
                  
                  // ✅ ตรวจสอบว่ามี USER ที่ READY อย่างน้อย 1 คนหรือไม่
                  const players = await postgresqlAdapter.getBingoPlayers(gameId)
                  const readyPlayers = players.filter((p: any) => p.isReady === true)
                  const waitingPlayers = players.filter((p: any) => !p.isReady)
                  
                  if (readyPlayers.length === 0) {
                    alert('⚠️ ยังไม่มีผู้เล่นที่พร้อม (READY) กรุณารอให้ผู้เล่นกดปุ่ม "พร้อมเล่น" ก่อน')
                    return
                  }
                  
                  // บันทึกรายชื่อผู้เล่นที่ไม่ได้ READY เพื่อให้แสดง popup
                  const waitingUserIds = waitingPlayers.map((p: any) => p.userId || p.username)
                  
                  // เริ่มเกมโดยตั้ง status เป็น countdown
                  const gameStateData = {
                    status: 'countdown',
                    calledNumbers: [],
                    currentNumber: null,
                    gameStarted: false,
                    gameEnded: false,
                    startedBy: 'admin',
                    startedAt: Date.now(),
                    readyPlayers: readyPlayers.length,
                    waitingPlayers: waitingUserIds // บันทึกรายชื่อผู้ที่ไม่ได้ READY
                  }
                  
                  // ✅ ใช้ PostgreSQL adapter
                  await postgresqlAdapter.updateBingoGameState(gameId, gameStateData)
                  
                  // อัปเดต bingo status
                  const currentGame = await postgresqlAdapter.getGameData(gameId) || {}
                  await postgresqlAdapter.updateGame(gameId, {
                    ...currentGame,
                    gameData: {
                      ...(currentGame as any).gameData,
                      bingo: {
                        ...(currentGame as any).gameData?.bingo,
                        status: 'countdown'
                      }
                    }
                  })
                  
                  alert(`✅ เริ่มเกม BINGO สำเร็จ! มีผู้เล่นที่พร้อม ${readyPlayers.length} คน${waitingPlayers.length > 0 ? ` (ผู้ที่ไม่ได้พร้อม ${waitingPlayers.length} คน)` : ''}`)
                  
                  // รีเฟรช cache
                  dataCache.invalidateGame(gameId)
                } catch (error) {
                  console.error('Error starting game:', error)
                  alert('❌ เกิดข้อผิดพลาดในการเริ่มเกม กรุณาลองใหม่อีกครั้ง')
                }
              }}
              disabled={bingoGameStatus !== 'waiting'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '16px 24px',
                background: bingoGameStatus === 'waiting' 
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : bingoGameStatus === 'countdown'
                  ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                  : bingoGameStatus === 'playing'
                  ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                  : bingoGameStatus === 'finished'
                  ? 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)'
                  : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '700',
                borderRadius: '12px',
                border: 'none',
                boxShadow: bingoGameStatus === 'waiting' 
                  ? '0 4px 16px rgba(16, 185, 129, 0.3)'
                  : bingoGameStatus === 'countdown'
                  ? '0 4px 16px rgba(245, 158, 11, 0.3)'
                  : bingoGameStatus === 'playing'
                  ? '0 4px 16px rgba(59, 130, 246, 0.3)'
                  : bingoGameStatus === 'finished'
                  ? '0 4px 16px rgba(107, 114, 128, 0.3)'
                  : '0 4px 16px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.3s ease',
                cursor: bingoGameStatus === 'waiting' ? 'pointer' : 'not-allowed',
                opacity: bingoGameStatus !== 'waiting' ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (bingoGameStatus === 'waiting') {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (bingoGameStatus === 'waiting') {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)'
                }
              }}
            >
              {bingoGameStatus === 'waiting' ? '🎮 เริ่มเกม BINGO เลย' :
               bingoGameStatus === 'countdown' ? '⏳ กำลังนับถอยหลัง...' :
               bingoGameStatus === 'playing' ? '🎮 เกมกำลังเล่นอยู่' :
               bingoGameStatus === 'finished' ? '🏁 เกมจบแล้ว' :
               '🎮 เริ่มเกม BINGO เลย'}
            </button>
          </div>
        )} */}

        {/* ===== โซนล่างในโหมดแก้ไข ===== */}
        {/* ✅ ซ่อนส่วนคำตอบผู้เล่นสำหรับเกมเช็คอิน (ย้ายไปไว้ในหน้า AdminAnswers.tsx แล้ว) */}
        {isEdit && type !== 'เกมเช็คอิน' && (
          <section className="answers-panel">
            <div className="answers-head">
              <div className="answers-title">📊 คำตอบที่ผู้เล่นทาย</div>
              <button 
                className="btn-ghost btn-sm" 
                onClick={refreshAnswers}
                disabled={answersDataLoading}
              >
                {answersDataLoading ? (
                  <>
                    <div style={{display:'inline-block', width:'12px', height:'12px', border:'2px solid #f3f3f3', borderTop:'2px solid #3498db', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
                    กำลังโหลด...
                  </>
                ) : (
                  <>
                    <span className="ico">🔄</span> รีเฟรชคำตอบ
                  </>
                )}
              </button>
            </div>
            {/* ----- answers-list ----- */}
              {type !== 'เกม Trick or Treat' && (
                <PlayerAnswersListWrapper
                  gameId={gameId}
                  isEdit={isEdit}
                  onLoadAnswers={() => setShouldLoadAnswers(true)}
                  shouldLoadAnswers={shouldLoadAnswers}
                  answers={answers
                    .filter(row => row.user && row.user.trim()) // ✅ กรองเฉพาะที่มี user และไม่ว่าง
                    .map(row => ({
                    id: `${row.ts}`,
                    username: (row.user || '').trim() || 'ไม่ระบุชื่อ', // ✅ แปลง user เป็น username และ trim
                    answer: row.answer || '',
                    timestamp: row.ts,
                    ts: row.ts,
                    gameId: gameId || '',
                    correct: row.correct,
                    code: row.code,
                    won: (row as any).won,
                    amount: (row as any).amount
                  }))}
                  loading={answersDataLoading}
                  onRefresh={refreshAnswers}
                />
              )}

              {/* ----- Trick or Treat Answers ----- */}
              {type === 'เกม Trick or Treat' && (
                <div className="answers-list">
                  {answersDataLoading ? (
                    <div className="muted" style={{ textAlign: 'center', padding: '20px' }}>
                      <div style={{display:'inline-block', width:'20px', height:'20px', border:'2px solid #f3f3f3', borderTop:'2px solid #3498db', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
                      <div style={{marginTop:'8px'}}>กำลังโหลดคำตอบที่ผู้เล่นทาย...</div>
                    </div>
                  ) : answers.length === 0 ? (
                    <div className="muted" style={{ textAlign: 'center', padding: '8px 0' }}>
                      ยังไม่มีผู้เล่น
                    </div>
                  ) : (
                    answers.map((row, idx) => {
                      const isWin = row.won === true
                      const isLose = row.won === false

                      return (
                        <div
                          className={`answer-item ${isLose ? 'is-wrong' : ''}`}
                          key={idx}
                        >
                          <div className="ai-left">
                            <div className="ai-time">🕒 {fmtThai(row.ts)}</div>
                            <div className="ai-user">USER : <b>{row.user || '-'}</b></div>
                          </div>

                          <div className="ai-right">
                            {isWin && row.code && (
                              <div style={{ 
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                                border: '1px solid #bbf7d0',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#DC2626'
                              }}>
                                🎁 โค้ดที่ได้: <span className="mono" style={{ 
                                  background: '#ffffff',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #86efac',
                                  color: '#166534',
                                  fontWeight: '700',
                                  fontSize: '16px'
                                }}>{row.code}</span>
                              </div>
                            )}
                            {isLose && (
                              <div style={{ 
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#dc2626'
                              }}>
                                👻 ไม่ได้รับโค้ด
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
          </section>
        )}

      {/* ====== รายงานการใช้งานของผู้เล่น (เฉพาะเกมเช็คอิน) ====== */}


      {isEdit ? (
        <div className="actions-row">
          <button 
            className="btn-cta" 
            onClick={submit}
            disabled={isSaving || gameDataLoading}
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
          <button 
            className="btn-danger" 
            onClick={removeGame}
            disabled={isSaving || gameDataLoading}
          >
            ลบเกมนี้
          </button>
        </div>
      ) : (
        <button 
          className="btn-cta" 
          onClick={submit}
          disabled={isSaving}
        >
          {isSaving ? 'กำลังสร้าง...' : 'สร้างเกมและรับลิงก์'}
        </button>
      )}

      {/* ปุ่มกลับ (ล่างสุดเสมอ) */}
      <div style={{marginTop:24}}>
        <button className="btn-back" style={{width:'100%'}} onClick={() => nav('/home')}>
          กลับ
        </button>
      </div>
    </div>
    
    {/* ✅ Popup ยืนยันการเปลี่ยนแปลงการตั้งค่าการแสดงผล */}
    {/* ✅ Popup ยืนยันการอัพโหลดโค้ด */}
    {confirmCodeUpload.open && confirmCodeUpload.codes && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '20px',
            fontWeight: '700',
            color: '#1e293b'
          }}>
            ยืนยันการอัพโหลดโค้ด
          </h3>
          <div style={{
            marginBottom: '20px',
            padding: '16px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#64748b' }}>
              {confirmCodeUpload.type === 'dailyReward' && `Day ${(confirmCodeUpload.index ?? 0) + 1} - Daily Reward`}
              {confirmCodeUpload.type === 'completeReward' && 'Complete Reward'}
              {confirmCodeUpload.type === 'couponItem' && `Coupon Item ${(confirmCodeUpload.index ?? 0) + 1}`}
            </div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
              จำนวนโค้ด: {confirmCodeUpload.codes.length.toLocaleString('th-TH')} รายการ
            </div>
            {confirmCodeUpload.codes.length > 0 && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#475569'
              }}>
                {confirmCodeUpload.codes.slice(0, 10).map((code, idx) => (
                  <div key={idx} style={{ marginBottom: '4px' }}>{code}</div>
                ))}
                {confirmCodeUpload.codes.length > 10 && (
                  <div style={{ marginTop: '8px', color: '#64748b', fontStyle: 'italic' }}>
                    ... และอีก {confirmCodeUpload.codes.length - 10} รายการ
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={() => {
                setConfirmCodeUpload({
                  open: false,
                  type: null,
                  index: null,
                  codes: null,
                  onConfirm: null
                })
              }}
              style={{
                padding: '10px 20px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569'
              }}
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirmCodeUpload.onConfirm) {
                  confirmCodeUpload.onConfirm()
                }
              }}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              ยืนยัน
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmFeatureChange.open && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }} onClick={cancelFeatureChangeHandler}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            ⚙️ ยืนยันการเปลี่ยนแปลง
          </div>
          <div style={{
            fontSize: '15px',
            color: '#475569',
            marginBottom: '24px',
            lineHeight: '1.6'
          }}>
            คุณต้องการ{confirmFeatureChange.newValue ? 'เปิด' : 'ปิด'} <strong>{
              confirmFeatureChange.feature === 'dailyReward' ? 'Daily Reward' :
              confirmFeatureChange.feature === 'miniSlot' ? 'Mini Slot' :
              confirmFeatureChange.feature === 'couponShop' ? 'Coupon Shop' : ''
            }</strong> หรือไม่?
            <br />
            <span style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px', display: 'block' }}>
              การเปลี่ยนแปลงนี้จะมีผลทันทีหลังจากบันทึก
            </span>
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={cancelFeatureChangeHandler}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#475569',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc'
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={confirmFeatureChangeHandler}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6'
              }}
            >
              ยืนยัน
            </button>
          </div>
        </div>
      </div>
    )}
    </section>
  )
}



