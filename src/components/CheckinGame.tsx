// src/components/CheckinGame.tsx
import React from 'react'
import { db, firestore } from '../services/firebase'
import { ref, onValue, off, runTransaction, set, get, push } from 'firebase/database'
import { collection, doc, setDoc, getDoc, serverTimestamp, deleteDoc, Timestamp } from 'firebase/firestore'
import {
  checkinWithFirestore,
  verifyCheckin,
  claimCompleteRewardWithFirestore,
  verifyCompleteReward,
  rollbackCheckin,
  rollbackCompleteReward
} from '../services/checkin-firestore'
import '../styles/checkin.css'
import { createPortal } from 'react-dom'
import CouponGame from './CouponGame';
import SlotGame from './SlotGame'
import UserBar from './UserBar'
import { useRealtimeData } from '../hooks/useOptimizedData'
import { dataCache } from '../services/cache'
import { useTheme, useThemeAssets, useThemeBranding } from '../contexts/ThemeContext'

const fmtDMY = (key?: string | null): string => {
  if (!key) return ''
  const [y, m, d] = String(key).split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

type Reward = {
  type: 'coin' | 'code'
  amount?: number
  code?: string
  date?: string | null
}

type Props = {
  gameId: string
  game: any
  username: string
  onInfo?: (title: string, msg: string) => void
  onCode?: (code: string) => void
}

const normalizeUser = (s: string) => (s || '').trim().replace(/\s+/g, '').toUpperCase()
const dkey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// ✅ Helper function: อ่าน offset ด้วย onValue (รองรับ .info/serverTimeOffset)
const getOffsetOnce = (offsetRef: any, timeout: number = 5000): Promise<number> => {
  return new Promise((resolve, reject) => {
    let resolved = false
    let unsubscribe: (() => void) | null = null
    
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true
        if (unsubscribe) {
          unsubscribe()
        }
        reject(new Error('Timeout reading serverTimeOffset'))
      }
    }, timeout)

    unsubscribe = onValue(offsetRef, (snapshot) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        if (unsubscribe) {
          unsubscribe()
        }
        const offset = snapshot.val() || 0
        resolve(offset)
      }
    }, (error) => {
      if (!resolved) {
        resolved = true
        clearTimeout(timeoutId)
        if (unsubscribe) {
          unsubscribe()
        }
        reject(error)
      }
    })
  })
}

// ✅ ฟังก์ชันสำหรับดึง server time จาก Firestore (ใช้ serverTimestamp())
// ✅ วิธีนี้ปลอดภัยกว่าเพราะใช้เวลาจาก server โดยตรง ไม่สามารถแก้ไขได้
const getServerTimeFromFirestore = async (): Promise<number> => {
  try {
    // ✅ สร้าง temporary document เพื่อดึง server timestamp
    const tempRef = doc(collection(firestore, '_temp'))
    await setDoc(tempRef, { timestamp: serverTimestamp() })
    
    const tempSnap = await getDoc(tempRef)
    const timestamp = tempSnap.data()?.timestamp as Timestamp | undefined
    
    // ✅ ลบ temporary document
    await deleteDoc(tempRef)
    
    if (!timestamp) {
      throw new Error('Failed to get server timestamp from Firestore')
    }
    
    // ✅ แปลง Timestamp เป็น milliseconds
    const serverTime = timestamp.toMillis()
    return serverTime
  } catch (error) {
    console.error('Error getting server time from Firestore:', error)
    // ✅ ถ้าเกิด error ให้ปฏิเสธการเช็คอิน (ไม่ใช้ fallback)
    throw new Error('Cannot get server time. Please check your connection and try again.')
  }
}

// ✅ ฟังก์ชันสำหรับคำนวณวันที่ปัจจุบันจาก server (ใช้ Firestore)
const getServerDateKeyFromFirestore = async (): Promise<string> => {
  const serverTime = await getServerTimeFromFirestore()
  return dkey(new Date(serverTime))
}

// ✅ ใช้ Firestore เป็นหลัก แต่ยังคง fallback ไปที่ Realtime Database (ถ้าจำเป็น)
// ✅ สำหรับ backward compatibility
const getServerTime = async (): Promise<number> => {
  try {
    return await getServerTimeFromFirestore()
  } catch (error) {
    console.error('Error getting server time from Firestore, falling back to Realtime Database:', error)
    // ✅ Fallback: ใช้วิธีเดิม (Realtime Database) ถ้า Firestore ไม่ทำงาน
    try {
      const offsetRef = ref(db, '.info/serverTimeOffset')
      const offset1 = await getOffsetOnce(offsetRef, 5000)
      const clientTime1 = Date.now()
      
      await new Promise(resolve => setTimeout(resolve, 50))
      const offset2 = await getOffsetOnce(offsetRef, 5000)
      const clientTime2 = Date.now()
      
      const offsetDiff = Math.abs(offset2 - offset1)
      const timeDiff = clientTime2 - clientTime1
      
      if (offsetDiff > 5000 && Math.abs(offsetDiff - timeDiff) > 5000) {
        throw new Error('Suspicious time change detected')
      }
      
      const serverTime = clientTime2 + offset2
      
      if (Math.abs(serverTime - clientTime2) > 3600000) {
        throw new Error('Server time seems incorrect')
      }
      
      if (Math.abs(offset2) > 3600000) {
        throw new Error('Server time offset is too large')
      }
      
      if (timeDiff > 60000) {
        throw new Error('Time difference is too large')
      }
      
      return serverTime
    } catch (fallbackError) {
      console.error('Fallback method also failed:', fallbackError)
      throw new Error('Cannot get server time. Please check your connection and try again.')
    }
  }
}

// ✅ ฟังก์ชันสำหรับคำนวณวันที่ปัจจุบันจาก server
const getServerDateKey = async (): Promise<string> => {
  const serverTime = await getServerTime()
  return dkey(new Date(serverTime))
}

// ✅ ใช้ client date เป็นค่าเริ่มต้น (จะถูกอัพเดตด้วย server date เมื่อจำเป็น)
// ⚠️ หมายเหตุ: todayKey ใช้เฉพาะเป็นค่าเริ่มต้นเท่านั้น ต้องใช้ serverDateKey สำหรับการตรวจสอบจริง
let todayKey = dkey(new Date())

function Overlay({
  open,
  onClose,
  children,
  maxWidth = 880,
  closeOnBackdrop = false,   // <— เพิ่ม option (ค่าเริ่มต้น: ไม่ปิด)
  closeOnEsc = true,         // <— ปิดด้วย ESC ได้ (ปรับได้)
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
  closeOnBackdrop?: boolean
  closeOnEsc?: boolean
}) {
  // ✅ ย้าย hooks มาก่อน early return เพื่อให้ hooks ถูกเรียกในลำดับเดียวกันเสมอ
  // ล็อกสกรอลล์พื้นหลัง
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // ปิดด้วย ESC (ถ้าต้องการ)
  React.useEffect(() => {
    if (!open || !closeOnEsc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeOnEsc, onClose])
  
  // ✅ Early return หลัง hooks
  if (!open) return null

  return createPortal(
    <div
      className="ci-ol"
      // เดิม: onClick={onClose}  → เอาออก
      // ถ้าต้องให้คลิกนอกแล้วปิดจริง ๆ ค่อยส่ง closeOnBackdrop=true เข้ามา
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className="ci-ol__panel"
        style={{ width: `min(96vw, ${maxWidth}px)` }}
        onClick={(e) => e.stopPropagation()}  // กันคลิกทะลุ
      >
        {children}
      </div>
    </div>,
    document.body
  )
}


// ✅ ฟังก์ชันสำหรับคำนวณวันที่จาก startDate + dayIndex
function calculateCheckinDate(startDate: string, dayIndex: number): string {
  if (!startDate) return ''
  try {
    const start = new Date(startDate + 'T00:00:00')
    if (isNaN(start.getTime())) return ''
    const targetDate = new Date(start)
    targetDate.setDate(start.getDate() + dayIndex)
    const y = targetDate.getFullYear()
    const m = String(targetDate.getMonth() + 1).padStart(2, '0')
    const d = String(targetDate.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  } catch {
    return ''
  }
}

function coerceRewards(g: any): Reward[] {
  const arr = Array.isArray(g?.checkin?.rewards) ? g.checkin.rewards : null
  
  if (arr) {
    return arr.map((r: any, index: number) => {
      // ✅ ไม่ต้องคำนวณวันที่จาก startDate แล้ว (ใช้ระบบใหม่: นับตามลำดับที่เช็คอิน)
      // ✅ ไม่ต้องใช้ date field แล้ว
      if ((r?.kind || r?.type) === 'code') {
        return { type: 'code', code: String(r?.value ?? r?.code ?? ''), date: null }
      }
      const amt = Number(r?.value ?? r?.amount ?? 0)
      return { type: 'coin', amount: Number.isFinite(amt) ? amt : 0, date: null }
    })
  }
  const days = Number(g?.checkin?.days ?? g?.checkinDays ?? 0) | 0
  // ✅ ไม่ต้องคำนวณวันที่สำหรับแต่ละวันแล้ว
  return Array.from({ length: Math.max(0, days) }, (_, i) => {
    return { type: 'coin' as const, amount: 0, date: null }
  })
}

const fmt = (n: number | undefined) => (Number(n ?? 0)).toLocaleString('th-TH')

// ---------- VIP Cards ----------
function VipOrangeCard({
  title = 'Daily Reward',
  subtitle = 'เช็คอินเพื่อรับรางวัล',
  onClick,
}: {
  title?: string
  subtitle?: string
  onClick?: () => void
}) {
  return (
    <button className="vip-card vip-card--orange" onClick={onClick}>
      <div className="vip-card__left">
        <span className="vip-card__icon" aria-hidden>
          <img src="/image/checkin.svg" alt="Check-in" width="36" height="36" />
        </span>
        <div className="vip-card__text">
          <div className="vip-card__title">{title}</div>
          <div className="vip-card__sub">{subtitle}</div>
        </div>
      </div>
      <div className="vip-card__right">
        <img src="/image/right.svg" alt="Arrow" width="20" height="20" />
      </div>
    </button>
  )
}

function VipGreenCard({
  title = 'Mini Slot',
  subtitle = 'ใช้ HENGCOIN เล่น',
  onClick,
}: {
  title?: string
  subtitle?: string
  onClick?: () => void
}) {
  const { themeName } = useTheme()
  const coinName = themeName === 'max56' ? 'MAXCOIN' : 'HENGCOIN'
  
  return (
    <button className="vip-card vip-card--green" onClick={onClick}>
      <div className="vip-card__left">
        <span className="vip-card__icon" aria-hidden>
          <img src="/image/slot.svg" alt="Slot" width="36" height="36" />
        </span>
        <div className="vip-card__text">
          <div className="vip-card__title">{title}</div>
          <div className="vip-card__sub">ใช้ {coinName} เล่น</div>
        </div>
      </div>
      <div className="vip-card__right">
        <img src="/image/right.svg" alt="Arrow" width="20" height="20" />
      </div>
    </button>
  )
}

function VipBlueCard({
  title = 'Coupon Shop',
  subtitle = 'แลกโค้ดรางวัล',
  onClick,
}: {
  title?: string
  subtitle?: string
  onClick?: () => void
}) {
  return (
    <button className="vip-card vip-card--blue" onClick={onClick}>
      <div className="vip-card__left">
        <span className="vip-card__icon" aria-hidden>
          <img src="/image/shop.svg" alt="Shop" width="36" height="36" />
        </span>
        <div className="vip-card__text">
          <div className="vip-card__title">{title}</div>
          <div className="vip-card__sub">{subtitle}</div>
        </div>
      </div>
      <div className="vip-card__right">
        <img src="/image/right.svg" alt="Arrow" width="20" height="20" />
      </div>
    </button>
  )
}


export default function CheckinGame({ gameId, game, username, onInfo, onCode }: Props) {
  const user = normalizeUser(username)
  const { themeName } = useTheme()
  const assets = useThemeAssets()
  const branding = useThemeBranding()

  // กำหนดชื่อ coin และ logo ตามธีม พร้อม fallback
  const coinName = themeName === 'max56' ? 'MAXCOIN' : themeName === 'jeed24' ? 'JEEDCOIN' : 'HENGCOIN'
  const coinLogo = themeName === 'max56' ? '/image/maxcoin_icon.png' : themeName === 'jeed24' ? '/image/jeedcoin_icon.png' : '/image/hengcoin_icon.png'
  
  // Fallback values สำหรับ assets และ branding
  const safeAssets = assets || {
    logoContainer: themeName === 'max56' ? '/image/logo-max56.png' : themeName === 'jeed24' ? '/image/logo-jeed24.png' : '/image/logo-heng36.png'
  }
  const safeBranding = branding || {
    title: themeName === 'max56' ? 'MAX56 GAME' : themeName === 'jeed24' ? 'JEED24 PARTY' : 'HENG36 PARTY'
  }

  const rewards: Reward[] = React.useMemo(() => coerceRewards(game), [game])

  const [hcoin, setHcoin] = React.useState(0)
  const [checked, setChecked] = React.useState<Record<number, boolean>>({})
  // ✅ เพิ่ม local state สำหรับวันที่เช็คอินของแต่ละวัน (checkinDates)
  const [checkinDates, setCheckinDates] = React.useState<Record<number, string>>({})
  // ✅ เพิ่ม local state สำหรับโค้ดที่ได้รับจากแต่ละ DAY
  const [dayCodes, setDayCodes] = React.useState<Record<number, string>>({})
  
  const [busy, setBusy] = React.useState(false)
  const [openCheckin, setOpenCheckin] = React.useState(false)
  const [openSlot, setOpenSlot] = React.useState(false)
  const [userStatus, setUserStatus] = React.useState<string | null>(null)
  const [isUserActive, setIsUserActive] = React.useState(false)

  // slot config (จากหน้า CreateGame)
  const slotStartBet = Number(game?.checkin?.slot?.startBet ?? 1) || 1
  const slotWinRate = Math.max(0, Math.min(100, Number(game?.checkin?.slot?.winRate ?? 30) || 30))

  const [openCoupon, setOpenCoupon] = React.useState(false);
  // ✅ เก็บ codes สำหรับแต่ละ coupon item (โหลดจาก path ใหม่)
  const [couponItemCodes, setCouponItemCodes] = React.useState<string[][]>([]);
  const [success, setSuccess] = React.useState<null | {
    amt: number
    dayIndex: number
    checked: number
    total: number
    type: 'coin' | 'code'
    code?: string
  }>(null)
  const [copied, setCopied] = React.useState(false)
  const [completeRewardClaimed, setCompleteRewardClaimed] = React.useState(false)
  const [completeRewardCode, setCompleteRewardCode] = React.useState<string | null>(null)
  const [completeCodeCopied, setCompleteCodeCopied] = React.useState(false)

  // Notification popup state
  const [notification, setNotification] = React.useState<{
    open: boolean
    imageUrl: string
    title: string
    message: string
  }>({ open: false, imageUrl: '', title: '', message: '' })

  const miniSlotCreditRef = `checkin_slot_credit/${gameId}/${user}`


    React.useEffect(() => {
    if (!openSlot) return
    // ตั้งค่าเริ่มต้นให้เลดเจอร์ Mini Slot "ครั้งเดียวตอนเปิด"
    // ถ้าเคยถูกตั้ง/กำลังเล่นอยู่แล้ว จะไม่ทับค่าเดิม
    runTransaction(ref(db, miniSlotCreditRef), (cur:any) => {
      return cur == null ? Number(hcoin || 0) : cur
    })
  }, [openSlot, miniSlotCreditRef, hcoin])

  // Use optimized real-time data fetching
  const { data: hcoinData } = useRealtimeData<number>(
    user ? `USERS_EXTRA/${user}/hcoin` : '',
    { 
      cacheKey: user ? `user:hcoin:${user}` : undefined,
      cacheTTL: 60000,
      throttleMs: 200,
      enabled: !!user
    }
  )

  const { data: checkinData } = useRealtimeData<Record<number, boolean>>(
    user ? `checkins/${gameId}/${user}` : '',
    { 
      cacheKey: user ? `checkin:${gameId}:${user}` : undefined,
      cacheTTL: 120000,
      throttleMs: 200,
      enabled: !!user
    }
  )

  const { data: completeRewardClaimedData } = useRealtimeData<boolean>(
    user ? `checkins/${gameId}/${user}/completeRewardClaimed` : '',
    { 
      cacheKey: user ? `checkin:complete:${gameId}:${user}` : undefined,
      cacheTTL: 120000,
      throttleMs: 200,
      enabled: !!user
    }
  )

  const { data: userStatusData } = useRealtimeData<string>(
    user ? `USERS_EXTRA/${user}/status` : '',
    { 
      cacheKey: user ? `user:status:${user}` : undefined,
      cacheTTL: 300000,
      throttleMs: 500,
      enabled: !!user
    }
  )

  // ✅ โหลด codes สำหรับแต่ละ coupon item จาก path ใหม่
  React.useEffect(() => {
    const loadCouponCodes = async () => {
      if (!gameId || !game?.checkin?.coupon?.items) {
        setCouponItemCodes([])
        return
      }

      const items = Array.isArray(game.checkin.coupon.items) ? game.checkin.coupon.items : []
      if (items.length === 0) {
        setCouponItemCodes([])
        return
      }

      try {
        // ✅ โหลด codes สำหรับแต่ละ item จาก path ใหม่
        const codesPromises = items.map((_: any, index: number) => 
          get(ref(db, `games/${gameId}/checkin/coupon/items/${index}/codes`))
            .then(snap => Array.isArray(snap.val()) ? snap.val().filter(Boolean) : [])
            .catch(() => [])
        )
        
        const codes = await Promise.all(codesPromises)
        setCouponItemCodes(codes)
      } catch (error) {
        console.error('Error loading coupon codes:', error)
        setCouponItemCodes([])
      }
    }

    loadCouponCodes()
  }, [gameId, game?.checkin?.coupon?.items])

  const { data: completeRewardCodeData } = useRealtimeData<string>(
    user ? `checkins/${gameId}/${user}/completeRewardCode` : '',
    {
      cacheKey: user ? `checkin:complete-code:${gameId}:${user}` : undefined,
      cacheTTL: 120000,
      throttleMs: 200,
      enabled: !!user,
    }
  )

  // ✅ อ่านวันที่เช็คอินของแต่ละวัน (checkins/{gameId}/{user}/{dayIndex}/date)
  // ✅ ใช้เพื่อตรวจสอบว่าวันที่เช็คอินวันก่อนหน้าคือวันไหน
  // ✅ สำหรับ DAY 2+ ต้องเช็คว่าวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน (ไม่ใช่ = วันปัจจุบัน)
  React.useEffect(() => {
    if (!user || !gameId) return
    
    // ✅ อ่านข้อมูล check-ins ทั้งหมด (รวม checked และ date)
    const checkinRef = ref(db, `checkins/${gameId}/${user}`)
    const unsubscribe = onValue(checkinRef, (snapshot) => {
      const data = snapshot.val() || {}
      const dates: Record<number, string> = {}
      
      // ✅ อ่านวันที่เช็คอินของแต่ละวัน (checkins/{gameId}/{user}/{dayIndex}/date)
      Object.keys(data).forEach((key) => {
        // ✅ ถ้า key เป็นตัวเลข (dayIndex)
        const dayIndex = parseInt(key, 10)
        if (!isNaN(dayIndex)) {
          // ✅ ถ้า value เป็น object และมี date field
          if (typeof data[key] === 'object' && data[key]?.date) {
            dates[dayIndex] = data[key].date
          }
          // ✅ ถ้า value เป็น boolean (true) แต่ยังไม่มี date field
          //    หมายความว่าเช็คอินแล้วแต่ยังไม่มีการบันทึก date (ข้อมูลเก่า)
          //    ในกรณีนี้จะไม่มี date และจะใช้การตรวจสอบแบบเก่า (ตรวจสอบจาก checked status เท่านั้น)
        }
      })
      
      setCheckinDates(dates)
    })
    
    return () => unsubscribe()
  }, [user, gameId])

  // ✅ อ่านโค้ดที่ได้รับจากแต่ละ DAY (จาก answers/{gameId}/{dateKey}/{ts})
  React.useEffect(() => {
    if (!user || !gameId) return

    let isMounted = true
    const codes: Record<number, string> = {}
    const codeTimestamps: Record<number, number> = {} // เก็บ timestamp ของโค้ดแต่ละวัน

    // ✅ อ่านข้อมูล answers ทั้งหมด (sharding ตามวันที่)
    const answersRef = ref(db, `answers/${gameId}`)
    const unsubscribe = onValue(answersRef, (snapshot) => {
      if (!isMounted) return

      if (snapshot.exists()) {
        const answersData = snapshot.val()
        
        // ✅ วนลูปผ่าน dateKey (เช่น 20241113, 20241114, ...)
        for (const [dateKey, dateData] of Object.entries(answersData)) {
          if (dateData && typeof dateData === 'object') {
            // ✅ วนลูปผ่าน timestamp ในแต่ละ dateKey
            for (const [tsKey, value] of Object.entries(dateData)) {
              if (value && typeof value === 'object') {
                const answerData = value as any
                // ✅ กรองเฉพาะที่ user ตรงกัน, action === 'checkin', และมี code
                if (answerData.user === user && 
                    answerData.action === 'checkin' && 
                    answerData.code &&
                    answerData.dayIndex !== undefined) {
                  const dayIndex = Number(answerData.dayIndex) - 1 // dayIndex ใน answers เป็น 1-based, เราใช้ 0-based
                  if (!isNaN(dayIndex) && dayIndex >= 0) {
                    // ✅ เก็บโค้ดล่าสุด (ถ้ามีหลายโค้ดในวันเดียวกัน ใช้ตัวล่าสุด)
                    const currentTs = Number(tsKey) || 0
                    const existingTs = codeTimestamps[dayIndex] || 0
                    
                    if (!codes[dayIndex] || currentTs > existingTs) {
                      codes[dayIndex] = String(answerData.code)
                      codeTimestamps[dayIndex] = currentTs
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (isMounted) {
        setDayCodes(codes)
      }
    }, (error) => {
      console.error('Error loading day codes:', error)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [user, gameId])

  // Update state when data changes
  React.useEffect(() => {
    if (hcoinData !== null) {
      const v = Number(hcoinData ?? 0)
      setHcoin(Number.isFinite(v) ? v : 0)
    }
  }, [hcoinData])

  React.useEffect(() => {
    if (checkinData !== null) {
      // ✅ รองรับทั้ง boolean (true) และ object ({ checked: true, date: ... })
      const checkedData: Record<number, boolean> = {}
      const checkinDatesData: Record<number, string> = {}
      Object.keys(checkinData).forEach((key) => {
        const dayIndex = parseInt(key, 10)
        if (!isNaN(dayIndex)) {
          const value = (checkinData as any)[key]
          // ✅ ถ้า value เป็น boolean (true) หรือ object ที่มี checked: true
          checkedData[dayIndex] = value === true || (value && value.checked === true)
          // ✅ เก็บวันที่เช็คอิน
          if (value && typeof value === 'object' && value.date) {
            checkinDatesData[dayIndex] = value.date
          }
        }
      })
      setChecked(checkedData)
      setCheckinDates(checkinDatesData)
    }
  }, [checkinData])
  
  // ✅ Migrate และ Sync ข้อมูลระหว่าง Firestore และ RTDB เมื่อโหลดหน้า
  // ✅ 1. Migrate ข้อมูลเก่าจาก RTDB ไป Firestore (ถ้ายังไม่มี)
  // ✅ 2. Sync ข้อมูลจาก Firestore ไป RTDB (เพื่อให้ UI แสดงผลถูกต้อง)
  React.useEffect(() => {
    if (!user || !gameId) return
    
    const migrateAndSync = async () => {
      try {
        // ✅ Step 1: Migrate ข้อมูลเก่าจาก RTDB ไป Firestore
        const { migrateAllCheckinsForUser } = await import('../services/checkin-migration')
        const migrationResult = await migrateAllCheckinsForUser(gameId, user, rewards.length)
        
        if (migrationResult.migrated > 0) {
          console.log(`[CheckinGame] Migrated ${migrationResult.migrated} check-in records from RTDB to Firestore`)
        }
        
        // ✅ Step 2: Sync ข้อมูลจาก Firestore ไป RTDB (เพื่อให้ UI แสดงผลถูกต้อง)
        // ✅ ใช้ RTDB listener ที่มีอยู่แล้วเป็น primary source
        // ✅ Sync เฉพาะเมื่อจำเป็น (เช่น เมื่อ migrate ข้อมูลใหม่)
        // ✅ ลดการอ่าน Firestore โดยใช้ RTDB listener แทน
        
        // ✅ อ่านเฉพาะวันที่จำเป็น (ไม่ต้องอ่านทั้งหมด)
        const { getAllCheckins } = await import('../services/checkin-firestore')
        const firestoreCheckins = await getAllCheckins(gameId, user, rewards.length)
        
        // ✅ Sync เฉพาะวันที่ migrate ใหม่ (ไม่ต้อง sync ทั้งหมด)
        for (const [dayIndexStr, checkinData] of Object.entries(firestoreCheckins)) {
          const dayIndex = parseInt(dayIndexStr, 10)
          if (isNaN(dayIndex)) continue
          
          if (checkinData && checkinData.checked === true) {
            const checkinRef = ref(db, `checkins/${gameId}/${user}/${dayIndex}`)
            const existingSnap = await get(checkinRef)
            const existingData = existingSnap.val()
            
            // ✅ ถ้า RTDB ไม่มีข้อมูล หรือข้อมูลไม่ตรงกับ Firestore ให้ sync
            if (!existingData || existingData.date !== checkinData.date) {
              await set(checkinRef, {
                checked: true,
                date: checkinData.date,
                ts: checkinData.ts?.toMillis() || Date.now(),
                key: checkinData.key
              })
            }
          }
        }
        
        // ✅ Sync complete reward
        const { getCompleteRewardStatus } = await import('../services/checkin-firestore')
        const completeRewardStatus = await getCompleteRewardStatus(gameId, user)
        
        if (completeRewardStatus && completeRewardStatus.claimed === true) {
          const completeRewardRef = ref(db, `checkins/${gameId}/${user}/completeRewardClaimed`)
          const existingSnap = await get(completeRewardRef)
          const existingData = existingSnap.val()
          
          if (!existingData || existingData.claimed !== true) {
            await set(completeRewardRef, {
              claimed: true,
              ts: completeRewardStatus.ts?.toMillis() || Date.now(),
              key: completeRewardStatus.key
            })
          }
        }
      } catch (error) {
        console.error('Error migrating and syncing data:', error)
        // ไม่ต้องแสดง error ให้ user เพราะเป็น background operation
      }
    }
    
    migrateAndSync()
  }, [user, gameId, rewards.length])

  React.useEffect(() => {
    if (completeRewardClaimedData !== null) {
      setCompleteRewardClaimed(completeRewardClaimedData === true)
    }
  }, [completeRewardClaimedData])

  React.useEffect(() => {
    if (typeof completeRewardCodeData === 'string') {
      setCompleteRewardCode(completeRewardCodeData.trim() || null)
    } else if (completeRewardCodeData === null) {
      setCompleteRewardCode(null)
    }
  }, [completeRewardCodeData])

  React.useEffect(() => {
    if (userStatusData !== null) {
      setUserStatus(userStatusData)
      setIsUserActive(userStatusData === 'ACTIVE')
    }
  }, [userStatusData])

  // Record user login (เฉพาะครั้งแรกที่ mount - ไม่ต้องเขียนทุกครั้งที่ checked เปลี่ยน)
  const loginRecordedRef = React.useRef(false)
  React.useEffect(() => {
    if (!user || loginRecordedRef.current) return
    
    const recordUserLogin = async () => {
      try {
        // ✅ ใช้ server time สำหรับ lastLogin เพื่อป้องกันการปรับเวลา
        const serverTime = await getServerTime()
        await set(ref(db, `checkins/${gameId}/${user}/lastLogin`), serverTime)
        loginRecordedRef.current = true
      } catch (error) {
        // Silent error handling
      }
    }
    
    recordUserLogin()
  }, [user, gameId])

  // แสดง notification popup เมื่อ component mount (หลังจาก login สำเร็จ)
  React.useEffect(() => {
    if (game?.checkin?.imageDataUrl) {
      setNotification({
        open: true,
        imageUrl: game.checkin.imageDataUrl,
        title: '🎉 เข้าสู่ระบบสำเร็จ!',
        message: 'ยินดีต้อนรับ! คุณสามารถเริ่มเล่นเกมเช็คอินได้แล้ว'
      })
    }
  }, [game?.checkin?.imageDataUrl])

  // ✅ State สำหรับ server date (จะถูกอัพเดตเมื่อ component mount)
  const [serverDateKey, setServerDateKey] = React.useState<string>(todayKey)
  const [serverTimeOffset, setServerTimeOffset] = React.useState<number>(0)

  // ✅ ดึง server time offset เมื่อ component mount และอัพเดตเป็นระยะ
  React.useEffect(() => {
    const updateServerTime = async () => {
      try {
        // ใช้ getServerTime() ที่แก้ไขแล้วแทน
        const serverTime = await getServerTime()
        const offset = serverTime - Date.now()
        setServerTimeOffset(offset)
        
        // คำนวณ server date
        const serverDate = dkey(new Date(serverTime))
        setServerDateKey(serverDate)
      } catch (error) {
        // Silent fallback to client date
        setServerDateKey(todayKey)
      }
    }

    // อัพเดตทันที
    updateServerTime()

    // อัพเดตทุก 1 นาที (เพื่อให้แน่ใจว่า date ถูกต้อง)
    const interval = setInterval(updateServerTime, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  // ✅ อ่านวันที่เริ่มต้นและสิ้นสุดกิจกรรม
  const startDate = game?.checkin?.startDate || ''
  const endDate = game?.checkin?.endDate || ''

  // ✅ ตรวจสอบว่าวันปัจจุบันอยู่ในช่วงกิจกรรมหรือไม่
  const isWithinActivityPeriod = React.useMemo(() => {
    if (!startDate) return true  // ถ้าไม่มี startDate ให้อนุญาต (backward compatibility)
    
    const serverDate = serverDateKey
    if (!serverDate) return false
    
    // ตรวจสอบว่าวันนี้ >= startDate และ <= endDate (ถ้ามี endDate)
    if (serverDate < startDate) return false
    if (endDate && serverDate > endDate) return false
    
    return true
  }, [startDate, endDate, serverDateKey])

  // Helper functions and computed values
  // ✅ ตรวจสอบว่าวันนี้เป็นวันที่อนุญาตให้เช็คอินวันนั้นหรือไม่ (ใช้ startDate + dayIndex)
  const isDayOpen = (i: number, useServerDate: boolean = false) => {
    if (!startDate) return true  // ถ้าไม่มี startDate ให้อนุญาต (backward compatibility)
    
    // คำนวณวันที่ที่อนุญาตให้เช็คอินวันนั้น (startDate + dayIndex)
    const allowedDate = calculateCheckinDate(startDate, i)
    if (!allowedDate) return true
    
    const dateToCheck = useServerDate ? serverDateKey : todayKey
    return allowedDate === dateToCheck
  }

  // หาวันแรกที่สามารถเช็คอินได้ (ตามลำดับ ไม่สามารถข้ามวันได้)
  // ✅ ระบบใหม่: นับวันแรกที่ USER เช็คอินเป็น DAY 1
  // ✅ ไม่ต้องกำหนดจำนวน DAY ตามวันที่ ให้นับตามลำดับที่เช็คอิน
  // ✅ ต้องเช็คอินได้แค่วันละครั้ง (เช็คอินวันถัดไปได้ในวันถัดไป)
  // ✅ สำคัญ: startDate และ endDate เป็นแค่ช่วงเวลาที่สามารถทำกิจกรรมได้ ไม่ใช่การกำหนดวันที่เช็คอินแต่ละวัน
  // ⚠️ หมายเหตุ: openTodayIndex เป็นแค่การแสดงผลเบื้องต้น การตรวจสอบจริงจะทำใน doCheckin function ด้วย server date
  const openTodayIndex = React.useMemo(() => {
    // ✅ ถ้ามี endDate และผ่านไปแล้ว ไม่ให้เช็คอิน
    if (endDate && serverDateKey > endDate) {
      return -1
    }
    
    // ✅ หาวันแรกที่ยังไม่เช็คอิน (เริ่มจาก index 0)
    // วันแรกที่ยังไม่เช็คอิน = DAY 1, วันถัดไป = DAY 2, ...
    for (let i = 0; i < rewards.length; i++) {
      // ถ้าเช็คอินไปแล้ว ข้าม
      if (checked?.[i]) continue
      
      // ✅ ถ้ายังไม่เช็คอินวันนี้ (index i) ให้ตรวจสอบว่า:
      // 1. ถ้าเป็นวันแรก (i === 0) สามารถเช็คอินได้เสมอ (ถ้าไม่ผ่าน endDate)
      // 2. ถ้าไม่ใช่วันแรก (i > 0) ต้องเช็คอินวันก่อนหน้าแล้ว
      // ⚠️ หมายเหตุ: การตรวจสอบวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน จะทำใน doCheckin function ด้วย server date
      if (i === 0) {
        // DAY 1: สามารถเช็คอินได้เสมอ (ถ้าไม่ผ่าน endDate)
        return i
      } else {
        // DAY 2, 3, ... : ต้องเช็คอินวันก่อนหน้าแล้ว
        if (checked?.[i - 1]) {
          // ✅ ใช้ checkinDates เพื่อแสดงผลเบื้องต้นเท่านั้น
          // ✅ การตรวจสอบจริงจะทำใน doCheckin function ด้วย server date
          const prevDayCheckinDate = checkinDates[i - 1]
          
          if (prevDayCheckinDate) {
            // ✅ เปรียบเทียบกับ serverDateKey (ไม่ใช่ todayKey)
            // ✅ ถ้า prevDayCheckinDate < serverDateKey แสดงว่าเช็คอินวันก่อนหน้าไปแล้วในวันอื่น สามารถเช็คอินได้
            // ✅ ถ้า prevDayCheckinDate >= serverDateKey แสดงว่าเช็คอินวันก่อนหน้าในวันนี้ (หรืออนาคต) ต้องรอ
            // ⚠️ หมายเหตุ: การตรวจสอบจริงจะทำใน doCheckin function ด้วย server date จาก Firebase
            if (prevDayCheckinDate < serverDateKey) {
              // เช็คอินวันก่อนหน้าไปแล้วในวันอื่น (ไม่ใช่วันนี้) สามารถเช็คอินได้
              return i
            } else {
              // เช็คอินวันก่อนหน้าในวันนี้ (หรืออนาคต) ต้องรอจนกว่าจะถึงวันถัดไป
              break
            }
          } else {
            // ✅ ถ้ายังไม่มีวันที่เช็คอินวันก่อนหน้า (อาจเป็นข้อมูลเก่าที่ยังไม่มีการบันทึก date)
            // ✅ ให้อนุญาตให้เช็คอินได้ (เพื่อรองรับข้อมูลเก่า)
            // ✅ แต่จะบันทึก date เมื่อเช็คอิน (ด้วย server date)
            return i
          }
        }
        // ถ้ายังไม่เช็คอินวันก่อนหน้า หยุดที่นี้
        break
      }
    }
    return -1
  }, [rewards, checked, serverDateKey, endDate, checkinDates])


  // เช็คว่ากดเช็คอินได้ไหม
  // ✅ ระบบใหม่: ไม่ต้องเช็ค isWithinActivityPeriod หรือ startDate
  // ✅ เช็คเฉพาะว่าไม่ผ่าน endDate ไปแล้ว (ถ้ามี endDate)
  const canCheckin = React.useMemo(() => {
    if (openTodayIndex < 0 || busy || rewards.length === 0) return false
    // เช็คว่าไม่ผ่าน endDate ไปแล้ว (ถ้ามี endDate)
    if (endDate && serverDateKey > endDate) return false
    return true
  }, [openTodayIndex, busy, rewards.length, endDate, serverDateKey])

  // (ตัวช่วยอื่น ถ้าใช้ใน JSX ปุ่ม/ข้อความ)
  const checkedCount = React.useMemo(() => {
    if (rewards.length === 0) return 0
    let total = 0
    for (let i = 0; i < rewards.length; i++) {
      if (checked?.[i]) total += 1
    }
    return total
  }, [rewards, checked])

  const allChecked = rewards.length > 0 && checkedCount === rewards.length

  // ✅ ตรวจสอบว่าวันสุดท้ายถูกเช็คอินแล้วหรือไม่ (ใช้ index สุดท้าย)
  const lastDayChecked = React.useMemo(() => {
    if (rewards.length === 0) return false
    const lastIndex = rewards.length - 1
    return !!checked?.[lastIndex]
  }, [rewards, checked])

  // ✅ ลบ nextCheckinDate ออก เพราะไม่ต้องกำหนดจำนวน DAY ตามวันที่
  // ✅ ให้นับตามลำดับที่เช็คอินเท่านั้น (ไม่ต้องแสดงวันที่ถัดไป)


  // บันทึกเหตุการณ์ลง answers/<gameId>/<date>/<timestamp> (ใช้ sharding ตามวันที่)
  async function logAction(gameId: string, user: string, payload: any) {
    // ✅ ใช้ server time สำหรับ timestamp เพื่อป้องกันการปรับเวลา
    const serverTime = await getServerTime()
    const serverDate = dkey(new Date(serverTime))
    const dateKey = serverDate.replace(/-/g, '')
    await set(ref(db, `answers/${gameId}/${dateKey}/${serverTime}`), { 
      ts: serverTime, 
      user, 
      ...payload,
      serverDate: serverDate // ✅ บันทึก server date ด้วย
    })
  }




const doCheckin = async () => {
  // ✅ ตั้ง busy state ทันทีเพื่อป้องกัน race condition (กดปุ่มหลายครั้งติดกัน)
  if (busy) {
    console.warn('Checkin already in progress')
    return
  }
  setBusy(true)
  
  // ✅ ประกาศตัวแปรข้างนอก try block เพื่อให้ใช้ได้ใน scope ทั้งหมด
  let currentServerDateKey: string = ''
  
  try {
    // ✅ ตรวจสอบวันที่จาก server ก่อนทำการเช็คอิน (ตรวจสอบหลายครั้ง)
    // ✅ ใช้ getServerTime() แต่ตรวจสอบหลายครั้งและตรวจสอบกับข้อมูลใน database
    // ✅ อ่าน server time หลายครั้งเพื่อตรวจสอบความสอดคล้อง
    const serverTime1 = await getServerTime()
    const serverDate1 = dkey(new Date(serverTime1))
    
    // ✅ รอสักครู่แล้วอ่านอีกครั้ง
    await new Promise(resolve => setTimeout(resolve, 100))
    const serverTime2 = await getServerTime()
    const serverDate2 = dkey(new Date(serverTime2))
    
    // ✅ ตรวจสอบว่า server date ไม่เปลี่ยนแปลง (ควรเป็นวันเดียวกัน)
    if (serverDate1 !== serverDate2) {
      console.warn('Server date changed between reads:', { serverDate1, serverDate2 })
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบวันที่จาก server ได้ กรุณาลองใหม่อีกครั้ง')
      setBusy(false)
      return
    }
    
    currentServerDateKey = serverDate1
    
    // ✅ ตรวจสอบเพิ่มเติม: เปรียบเทียบกับวันที่เช็คอินล่าสุด (ถ้ามี)
    // ✅ เพื่อตรวจสอบว่า currentServerDateKey ไม่ผิดปกติ
    try {
      const checkinsRef = ref(db, `checkins/${gameId}/${user}`)
      const checkinsSnap = await get(checkinsRef)
      const checkinsData = checkinsSnap.val() || {}
      
      // ✅ หาวันที่เช็คอินล่าสุด
      let latestCheckinDate: string | null = null
      for (let i = 0; i < rewards.length; i++) {
        const checkinData = checkinsData[i]
        if (checkinData && typeof checkinData === 'object' && checkinData.date) {
          if (!latestCheckinDate || checkinData.date > latestCheckinDate) {
            latestCheckinDate = checkinData.date
          }
        }
      }
      
      // ✅ ถ้ามีวันที่เช็คอินล่าสุด ตรวจสอบว่า currentServerDateKey ไม่น้อยกว่าวันที่เช็คอินล่าสุด
      if (latestCheckinDate) {
        const latestDate = new Date(latestCheckinDate + 'T00:00:00')
        const currentDate = new Date(currentServerDateKey + 'T00:00:00')
        const daysDiff = Math.floor((currentDate.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24))
        
          // ✅ ถ้า currentServerDateKey น้อยกว่าวันที่เช็คอินล่าสุด แสดงว่าอาจมีการปรับเวลา
        if (daysDiff < 0) {
          console.warn('Current server date is before latest checkin date:', {
            latestCheckinDate,
            currentServerDateKey,
            daysDiff
          })
          onInfo?.('เกิดข้อผิดพลาด', 'พบข้อมูลวันที่เช็คอินที่ผิดปกติ กรุณาติดต่อผู้ดูแลระบบ')
          setBusy(false)
          return
        }
      }
    } catch (error) {
      console.error('Error validating server date with checkin history:', error)
      // ถ้าอ่านไม่ได้ ให้ดำเนินการต่อ (ไม่บล็อกการเช็คอิน)
    }
  } catch (error) {
    console.error('Error getting server date:', error)
    onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบวันที่จาก server ได้ กรุณาลองใหม่อีกครั้ง')
    setBusy(false)
    return
  }

  // ✅ ตรวจสอบอีกครั้งก่อนทำ (ใช้ระบบใหม่: เช็คตามลำดับ ไม่สามารถข้ามวันได้)
  // ✅ ไม่ต้องกำหนดจำนวน DAY ตามวันที่ ให้นับตามลำดับที่เช็คอิน
  // ✅ ต้องเช็คอินได้แค่วันละครั้ง (เช็คอินวันถัดไปได้ในวันถัดไป)
  // ✅ สำคัญ: startDate และ endDate เป็นแค่ช่วงเวลาที่สามารถทำกิจกรรมได้ ไม่ใช่การกำหนดวันที่เช็คอินแต่ละวัน
  
  // ✅ ถ้ามี endDate และผ่านไปแล้ว ไม่ให้เช็คอิน
  if (endDate && currentServerDateKey > endDate) {
    onInfo?.('กิจกรรมสิ้นสุดแล้ว', `กิจกรรมสิ้นสุดในวันที่ ${fmtDMY(endDate)}`)
    setBusy(false)
    return
  }
  
  // ✅ หาวันแรกที่ยังไม่เช็คอิน (เริ่มจาก index 0)
  // วันแรกที่ยังไม่เช็คอิน = DAY 1, วันถัดไป = DAY 2, ...
  // ⚠️ สำคัญ: ต้องอ่านจาก database โดยตรงทุกครั้ง (ไม่ใช้ local state) เพื่อป้องกันการปรับเวลา
  let currentOpenTodayIndex = -1
  for (let i = 0; i < rewards.length; i++) {
      // ✅ อ่านสถานะเช็คอินจาก Firestore ก่อน (source of truth)
    try {
      // ✅ ตรวจสอบจาก Firestore ก่อน (ใช้ cache เพื่อลดการอ่าน)
      const { getCheckinStatus } = await import('../services/checkin-firestore')
      // ✅ ตรวจสอบ migration เฉพาะเมื่อจำเป็น (ใช้ cache)
      const { checkMigrationNeeded, migrateCheckinFromRTDB } = await import('../services/checkin-migration')
      const needsMigration = await checkMigrationNeeded(gameId, user, i)
      if (needsMigration) {
        await migrateCheckinFromRTDB(gameId, user, i)
      }
      const firestoreCheckin = await getCheckinStatus(gameId, user, i)
      
      // ✅ ตรวจสอบเฉพาะ checked === true เท่านั้น (ไม่ตรวจสอบ date เพราะอาจมีข้อมูลเก่า)
      if (firestoreCheckin && firestoreCheckin.checked === true) {
        // ✅ Sync ไป RTDB เพื่อให้ UI อัพเดท
        const checkinRef = ref(db, `checkins/${gameId}/${user}/${i}`)
        const existingSnap = await get(checkinRef)
        const existingData = existingSnap.val()
        
        if (!existingData || existingData.date !== firestoreCheckin.date) {
          await set(checkinRef, {
            checked: true,
            date: firestoreCheckin.date,
            ts: firestoreCheckin.ts?.toMillis() || Date.now(),
            key: firestoreCheckin.key
          })
        }
        // ถ้าเช็คอินไปแล้ว ข้าม
        continue
      }
      
      // ✅ ตรวจสอบจาก RTDB เป็น fallback
      const checkinRef = ref(db, `checkins/${gameId}/${user}/${i}`)
      const checkinSnap = await get(checkinRef)
      const checkinData = checkinSnap.val()
      const isChecked = checkinData === true || (checkinData && checkinData.checked === true)
      
      // ✅ ตรวจสอบเพิ่มเติม: ถ้ามี date field และ date เป็นวันเดียวกันกับวันปัจจุบัน แสดงว่าเช็คอินวันนี้แล้ว
      const isSameDate = checkinData && typeof checkinData === 'object' && checkinData.date && checkinData.date === currentServerDateKey
      
      // ถ้าเช็คอินไปแล้ว หรือเช็คอินวันนี้แล้ว ข้าม
      if (isChecked || isSameDate) continue
    } catch (error) {
      console.error('Error checking checkin status from database:', error)
      // ถ้าอ่านไม่ได้ ให้ข้ามวันนี้
      continue
    }
    
    // ✅ ถ้ายังไม่เช็คอินวันนี้ (index i) ให้ตรวจสอบว่า:
    // 1. ถ้าเป็นวันแรก (i === 0) ต้องตรวจสอบว่ายังไม่เคยเช็คอินวันแรกมาก่อน (เพื่อป้องกันการเช็คอินล่วงหน้า)
    // 2. ถ้าไม่ใช่วันแรก (i > 0) ต้องเช็คอินวันก่อนหน้าแล้ว และต้องเช็คว่าวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน
    if (i === 0) {
      // DAY 1: ตรวจสอบว่ายังไม่เคยเช็คอินวันแรกมาก่อน (เพื่อป้องกันการเช็คอินล่วงหน้า)
      // ✅ อ่านวันที่เช็คอินวันแรกจาก database (ถ้ามี)
      try {
        const firstDayRef = ref(db, `checkins/${gameId}/${user}/0`)
        const firstDaySnap = await get(firstDayRef)
        const firstDayData = firstDaySnap.val()
        
        if (firstDayData && typeof firstDayData === 'object' && firstDayData.date) {
          // ✅ ถ้ามีวันที่เช็คอินวันแรก ตรวจสอบว่า currentServerDateKey ไม่น้อยกว่าวันที่เช็คอินวันแรก
          const firstDayDate = new Date(firstDayData.date + 'T00:00:00')
          const currentDate = new Date(currentServerDateKey + 'T00:00:00')
          const daysDiff = Math.floor((currentDate.getTime() - firstDayDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // ✅ ถ้า currentServerDateKey น้อยกว่าวันที่เช็คอินวันแรก แสดงว่าอาจมีการปรับเวลา
          if (daysDiff < 0) {
            console.warn('Current server date is before first checkin date:', {
              firstDayDate: firstDayData.date,
              currentServerDateKey,
              daysDiff
            })
            onInfo?.('เกิดข้อผิดพลาด', 'พบข้อมูลวันที่เช็คอินที่ผิดปกติ กรุณาติดต่อผู้ดูแลระบบ')
            setBusy(false)
            return
          }
        }
      } catch (error) {
        console.error('Error checking first day checkin date:', error)
        // ถ้าอ่านไม่ได้ ให้ดำเนินการต่อ (ไม่บล็อกการเช็คอิน)
      }
      
      // DAY 1: สามารถเช็คอินได้ (ถ้าไม่ผ่าน endDate และผ่านการตรวจสอบข้างต้น)
      currentOpenTodayIndex = i
      break
    } else {
      // DAY 2, 3, ... : ต้องเช็คอินวันก่อนหน้าแล้ว
      // ✅ อ่านสถานะเช็คอินวันก่อนหน้าจาก Firestore ก่อน
      try {
        const { getCheckinStatus } = await import('../services/checkin-firestore')
        const { checkMigrationNeeded, migrateCheckinFromRTDB } = await import('../services/checkin-migration')
        
        // ✅ ตรวจสอบว่าต้อง migrate วันก่อนหน้าหรือไม่
        const prevDayNeedsMigration = await checkMigrationNeeded(gameId, user, i - 1)
        if (prevDayNeedsMigration) {
          // ✅ Migrate ข้อมูลเก่าจาก RTDB ไป Firestore
          await migrateCheckinFromRTDB(gameId, user, i - 1)
        }
        
        const prevDayFirestoreCheckin = await getCheckinStatus(gameId, user, i - 1)
        
        // ✅ ตรวจสอบจาก Firestore ก่อน
        let prevDayChecked = false
        let prevDayCheckinDate: string | null = null
        
        if (prevDayFirestoreCheckin && prevDayFirestoreCheckin.checked === true) {
          prevDayChecked = true
          prevDayCheckinDate = prevDayFirestoreCheckin.date
        } else {
          // ✅ ตรวจสอบจาก RTDB เป็น fallback (รองรับข้อมูลเก่าที่ยังไม่ได้ migrate)
          const prevDayRef = ref(db, `checkins/${gameId}/${user}/${i - 1}`)
          const prevDaySnap = await get(prevDayRef)
          const prevDayData = prevDaySnap.val()
          prevDayChecked = prevDayData === true || (prevDayData && prevDayData.checked === true)
          prevDayCheckinDate = prevDayData?.date || null
        }
        
        if (prevDayChecked) {
          // ✅ สำคัญ: ต้องเช็คว่าวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน (ไม่ใช่ = วันปัจจุบัน)
          if (prevDayCheckinDate) {
            // ✅ ถ้ามีวันที่เช็คอินวันก่อนหน้า ต้องเช็คว่า < วันปัจจุบัน (ใช้ server date)
            if (prevDayCheckinDate < currentServerDateKey) {
              // เช็คอินวันก่อนหน้าไปแล้วในวันอื่น (ไม่ใช่วันนี้) สามารถเช็คอินได้
              currentOpenTodayIndex = i
              break
            } else {
              // เช็คอินวันก่อนหน้าในวันนี้ (หรืออนาคต) ต้องรอจนกว่าจะถึงวันถัดไป
              onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันก่อนหน้าในวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
              setBusy(false)
              return
            }
          } else {
            // ✅ ถ้ายังไม่มีวันที่เช็คอินวันก่อนหน้า (อาจเป็นข้อมูลเก่า)
            // ✅ ให้อนุญาตให้เช็คอินได้ (เพื่อรองรับข้อมูลเก่าที่ยังไม่มีการบันทึก date)
            // ✅ แต่จะบันทึก date เมื่อเช็คอิน (ด้วย server date)
            currentOpenTodayIndex = i
            break
          }
        } else {
          // ถ้ายังไม่เช็คอินวันก่อนหน้า หยุดที่นี้
          break
        }
      } catch (error) {
        console.error('Error checking previous day from database:', error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบการเช็คอินวันก่อนหน้าได้ กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
    }
  }
  
  if (currentOpenTodayIndex < 0 || busy || rewards.length === 0) {
    console.warn('Cannot checkin:', { 
      currentOpenTodayIndex, 
      busy, 
      rewardsLength: rewards.length,
      serverDate: currentServerDateKey,
      endDate
    })
    
    // ✅ แสดงข้อความที่เหมาะสม
    if (endDate && currentServerDateKey > endDate) {
      onInfo?.('กิจกรรมสิ้นสุดแล้ว', `กิจกรรมสิ้นสุดในวันที่ ${fmtDMY(endDate)}`)
    } else {
      // เช็คว่าเช็คอินครบทุกวันแล้วหรือไม่
      const allChecked = rewards.length > 0 && rewards.every((_, i) => checked?.[i])
      if (allChecked) {
        onInfo?.('ไม่สามารถเช็คอินได้', 'เช็คอินครบทุกวันแล้ว')
      } else {
        onInfo?.('ไม่สามารถเช็คอินได้', 'กรุณาตรวจสอบเงื่อนไขการเช็คอิน')
      }
    }
    setBusy(false)
    return
  }
  
  const idx = currentOpenTodayIndex
  const r = rewards[idx]
  
  if (!r) {
    console.error('Reward not found for index:', idx)
    setBusy(false)
    return
  }

  // ✅ ตรวจสอบเงื่อนไขการเช็คอินอีกครั้ง (double check)
  // สำหรับ DAY 1 (idx === 0): ไม่ต้องเช็ควันที่ อนุญาตได้เสมอ (ถ้าอยู่ในช่วงกิจกรรม)
  // สำหรับ DAY 2, 3, ... (idx > 0): ต้องเช็คว่าเช็คอินวันก่อนหน้าแล้ว และผ่านวันที่อนุญาตมาแล้ว
  if (idx > 0) {
    // ตรวจสอบว่าการเช็คอินวันก่อนหน้าแล้ว
    if (!checked?.[idx - 1]) {
      console.warn('Cannot checkin: previous day not checked', { idx, checked })
      onInfo?.('ไม่สามารถเช็คอินได้', 'กรุณาเช็คอินวันก่อนหน้าให้เสร็จก่อน')
      setBusy(false)
      return
    }
  }
  // สำหรับ DAY 1 (idx === 0): ไม่ต้องเช็ควันที่ อนุญาตได้เสมอ (ถ้าอยู่ในช่วงกิจกรรม)

  const before = Number(hcoin || 0)
  // ✅ ใช้ server time สำหรับ timestamp เพื่อป้องกันการปรับเวลา
  const ts = await getServerTime()
  
  // ✅ นับจำนวนวันที่เช็คอินแล้วจาก database โดยตรง (ไม่ใช้ local state)
  let countBefore = 0
  try {
    const checkinsRef = ref(db, `checkins/${gameId}/${user}`)
    const checkinsSnap = await get(checkinsRef)
    const checkinsData = checkinsSnap.val() || {}
    for (let i = 0; i < rewards.length; i++) {
      const checkinData = checkinsData[i]
      const isChecked = checkinData === true || (checkinData && checkinData.checked === true)
      if (isChecked) countBefore++
    }
  } catch (error) {
    console.error('Error counting checkins from database:', error)
    // ถ้าอ่านไม่ได้ ให้ใช้ local state เป็น fallback
    for (let i = 0; i < rewards.length; i++) {
      if (checked?.[i]) countBefore++
    }
  }

  try {
    // ✅ อ่านข้อมูล startDate จาก database ก่อนทำ transaction
    // (เพื่อตรวจสอบวันที่อีกครั้ง)
    let dbStartDate: string | null = null
    let dbEndDate: string | null = null
    try {
      const startDateRef = ref(db, `games/${gameId}/checkin/startDate`)
      const endDateRef = ref(db, `games/${gameId}/checkin/endDate`)
      const startDateSnap = await get(startDateRef)
      const endDateSnap = await get(endDateRef)
      dbStartDate = startDateSnap.val() || null
      dbEndDate = endDateSnap.val() || null
    } catch (error) {
      console.error('Error reading start/end date from database:', error)
      // ถ้าอ่านไม่ได้ ให้ใช้ date จาก game object ที่มีอยู่
      dbStartDate = startDate || null
      dbEndDate = endDate || null
    }
    
    // ✅ ตรวจสอบวันที่จาก server อีกครั้งก่อนทำ transaction
    const serverTime = await getServerTime()
    const serverDate = dkey(new Date(serverTime))
    
    // ✅ ตรวจสอบเงื่อนไขการเช็คอิน
    // ✅ ไม่ต้องกำหนดจำนวน DAY ตามวันที่ ให้นับตามลำดับที่เช็คอิน
    // ✅ สำหรับทุกวัน: เช็คว่าไม่ผ่าน endDate ไปแล้ว (ถ้ามี endDate)
    if (dbEndDate && serverDate > dbEndDate) {
      console.warn('Activity ended:', { serverDate, dbEndDate, idx })
      onInfo?.('กิจกรรมสิ้นสุดแล้ว', `กิจกรรมสิ้นสุดในวันที่ ${fmtDMY(dbEndDate)}`)
      setBusy(false)
      return
    }
    
    // ✅ สำหรับ DAY 2+ (idx > 0): ต้องเช็คว่าเช็คอินวันก่อนหน้าแล้ว และวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน
    if (idx > 0) {
      // ✅ ตรวจสอบว่าการเช็คอินวันก่อนหน้าแล้ว (อ่านจาก database อีกครั้ง)
      try {
        const prevDayRef = ref(db, `checkins/${gameId}/${user}/${idx - 1}`)
        const prevDaySnap = await get(prevDayRef)
        const prevDayData = prevDaySnap.val()
        
        // ✅ ถ้า prevDayData เป็น boolean (true) หรือ object ที่มี checked: true
        const prevDayChecked = prevDayData === true || (prevDayData && prevDayData.checked === true)
        
        if (!prevDayChecked) {
          console.warn('Cannot checkin: previous day not checked', { idx, prevDayChecked })
          onInfo?.('ไม่สามารถเช็คอินได้', 'กรุณาเช็คอินวันก่อนหน้าให้เสร็จก่อน')
          setBusy(false)
          return
        }
        
        // ✅ ตรวจสอบวันที่เช็คอินวันก่อนหน้า
        // ✅ ถ้า prevDayData เป็น object และมี date field
        const prevDayCheckinDate = prevDayData?.date || null
        
        if (prevDayCheckinDate) {
          // ✅ ถ้ามีวันที่เช็คอินวันก่อนหน้า ต้องเช็คว่า < วันปัจจุบัน (ใช้ serverDate ที่ตรวจสอบก่อน transaction)
          if (prevDayCheckinDate >= serverDate) {
            // เช็คอินวันก่อนหน้าในวันนี้ (หรืออนาคต) ต้องรอจนกว่าจะถึงวันถัดไป
            console.warn('Cannot checkin: previous day checked in today or future', { 
              prevDayCheckinDate, 
              serverDate, 
              idx 
            })
            onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันก่อนหน้าในวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
            setBusy(false)
            return
          }
        } else {
          // ✅ ถ้ายังไม่มีวันที่เช็คอินวันก่อนหน้า (อาจเป็นข้อมูลเก่า)
          // ✅ ให้อนุญาตให้เช็คอินได้ (เพื่อรองรับข้อมูลเก่า)
          // ✅ แต่จะบันทึก date เมื่อเช็คอิน (ด้วย server date)
        }
      } catch (error) {
        console.error('Error checking previous day:', error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบการเช็คอินวันก่อนหน้าได้ กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
    }
    
    // ✅ mark checked และบันทึกวันที่เช็คอิน (ใช้ transaction เพื่อป้องกัน race condition)
    // ✅ บันทึกเป็น object { checked: true, date: serverDate } แทน boolean
    // ✅ สำคัญ: ใช้ getServerTime() แต่ตรวจสอบหลายครั้งและตรวจสอบกับข้อมูลใน database
    let finalServerDate: string
    try {
      // ✅ อ่าน server time หลายครั้งเพื่อตรวจสอบความสอดคล้อง
      const finalServerTime1 = await getServerTime()
      const finalServerDate1 = dkey(new Date(finalServerTime1))
      
      // ✅ รอสักครู่แล้วอ่านอีกครั้ง
      await new Promise(resolve => setTimeout(resolve, 100))
      const finalServerTime2 = await getServerTime()
      const finalServerDate2 = dkey(new Date(finalServerTime2))
      
      // ✅ ตรวจสอบว่า server date ไม่เปลี่ยนแปลง
      if (finalServerDate1 !== finalServerDate2) {
        console.warn('Server date changed between reads before transaction:', { 
          finalServerDate1, 
          finalServerDate2 
        })
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ เนื่องจากมีการเปลี่ยนแปลงเวลา กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
      
      finalServerDate = finalServerDate1
      
      // ✅ ตรวจสอบว่าวันนี้ยังไม่เช็คอินแล้ว (อ่านจาก Firestore และ RTDB) - สำคัญมาก!
      // ✅ ต้องตรวจสอบก่อน transaction เพื่อป้องกัน race condition
      // ✅ ตรวจสอบด้วย finalServerDate ที่ได้จาก server
      try {
        // ✅ ตรวจสอบจาก Firestore ก่อน (source of truth)
        const { getCheckinStatus } = await import('../services/checkin-firestore')
        const { checkMigrationNeeded, migrateCheckinFromRTDB } = await import('../services/checkin-migration')
        
        // ✅ ตรวจสอบว่าต้อง migrate หรือไม่ (ถ้า Firestore ยังไม่มีข้อมูล แต่ RTDB มี)
        const needsMigration = await checkMigrationNeeded(gameId, user, idx)
        if (needsMigration) {
          // ✅ Migrate ข้อมูลเก่าจาก RTDB ไป Firestore
          await migrateCheckinFromRTDB(gameId, user, idx)
        }
        
        const firestoreCheckin = await getCheckinStatus(gameId, user, idx)
        
        // ✅ ตรวจสอบเฉพาะ checked === true และ date เป็นวันเดียวกันเท่านั้น
        // ✅ ถ้า checked === false แสดงว่าเป็นข้อมูลเก่าที่ migrate มา (ให้เช็คอินใหม่ได้)
        if (firestoreCheckin && firestoreCheckin.checked === true) {
          // ✅ ตรวจสอบเพิ่มเติม: ถ้า date เป็นวันเดียวกันกับ finalServerDate แสดงว่าเช็คอินวันนี้แล้ว
          const isFirestoreSameDate = firestoreCheckin.date === finalServerDate
          
          if (isFirestoreSameDate) {
            console.warn('Already checked in for day (Firestore):', idx, { 
              firestoreCheckin,
              finalServerDate 
            })
            // ✅ Sync ไป RTDB เพื่อให้ UI อัพเดท
            const currentDayRef = ref(db, `checkins/${gameId}/${user}/${idx}`)
            await set(currentDayRef, { 
              checked: true, 
              date: firestoreCheckin.date || finalServerDate,
              ts: firestoreCheckin.ts?.toMillis() || Date.now(),
              key: firestoreCheckin.key
            })
            onInfo?.('คุณเช็คอินวันนี้แล้ว', 'คุณได้เช็คอินวันนี้เรียบร้อยแล้ว')
            setBusy(false)
            return
          }
        }
        
        // ✅ ถ้า Firestore มีข้อมูลแต่ checked === false และ date เป็นวันปัจจุบัน
        // ✅ แสดงว่าเป็นข้อมูลเก่าที่ migrate มา ให้เช็คอินใหม่ได้ (จะเขียนทับข้อมูลเก่า)
        if (firestoreCheckin && firestoreCheckin.checked === false && firestoreCheckin.date === finalServerDate) {
          console.log('Found migrated data with checked=false, allowing new check-in:', idx)
          // ✅ ให้ดำเนินการต่อ (จะเขียนทับข้อมูลเก่าใน transaction)
        }
        
        // ✅ ตรวจสอบจาก RTDB เป็น fallback
        const currentDayRef = ref(db, `checkins/${gameId}/${user}/${idx}`)
        const currentDaySnap = await get(currentDayRef)
        const currentDayData = currentDaySnap.val()
        const isAlreadyChecked = currentDayData === true || (currentDayData && currentDayData.checked === true)
        
        // ✅ ตรวจสอบเพิ่มเติม: ถ้า currentDayData เป็น object ที่มี date field และ date เป็นวันเดียวกันกับ finalServerDate
        // ✅ แสดงว่าเคยเช็คอินวันนี้แล้ว (แม้ว่า checked จะเป็น false หรือไม่มี checked field)
        const isSameDate = currentDayData && typeof currentDayData === 'object' && currentDayData.date && currentDayData.date === finalServerDate
        
        if (isAlreadyChecked || isSameDate) {
          console.warn('Already checked in for day (RTDB):', idx, { 
            isAlreadyChecked, 
            isSameDate, 
            currentDayData, 
            finalServerDate 
          })
          onInfo?.('คุณเช็คอินวันนี้แล้ว', 'คุณได้เช็คอินวันนี้เรียบร้อยแล้ว')
          setBusy(false)
          return
        }
      } catch (error) {
        console.error('Error checking current day checkin status:', error)
        // ถ้าอ่านไม่ได้ ให้ดำเนินการต่อ (จะตรวจสอบใน transaction อีกครั้ง)
      }
      
      // ✅ ตรวจสอบเพิ่มเติม: เปรียบเทียบกับวันที่เช็คอินวันก่อนหน้า (ถ้ามี)
      if (idx > 0) {
        try {
          const prevDayRef = ref(db, `checkins/${gameId}/${user}/${idx - 1}`)
          const prevDaySnap = await get(prevDayRef)
          const prevDayData = prevDaySnap.val()
          const prevDayCheckinDate = prevDayData?.date || null
          
          if (prevDayCheckinDate) {
            // ✅ ตรวจสอบว่า finalServerDate ไม่น้อยกว่าวันที่เช็คอินวันก่อนหน้ามากเกินไป (ไม่เกิน 1 วัน)
            const prevDate = new Date(prevDayCheckinDate + 'T00:00:00')
            const currentDate = new Date(finalServerDate + 'T00:00:00')
            const daysDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
            
            // ✅ ถ้า finalServerDate น้อยกว่าวันที่เช็คอินวันก่อนหน้า แสดงว่าอาจมีการปรับเวลา
            if (daysDiff < 0) {
              console.warn('Current server date is before previous checkin date:', {
                prevDayCheckinDate,
                finalServerDate,
                daysDiff
              })
              onInfo?.('เกิดข้อผิดพลาด', 'พบข้อมูลวันที่เช็คอินที่ผิดปกติ กรุณาติดต่อผู้ดูแลระบบ')
              setBusy(false)
              return
            }
            
            // ✅ ถ้า finalServerDate มากกว่าวันที่เช็คอินวันก่อนหน้ามากเกินไป (มากกว่า 2 วัน) แสดงว่าอาจมีการปรับเวลา
            if (daysDiff > 2) {
              console.warn('Current server date is too far from previous checkin date:', {
                prevDayCheckinDate,
                finalServerDate,
                daysDiff
              })
              onInfo?.('เกิดข้อผิดพลาด', 'พบข้อมูลวันที่เช็คอินที่ผิดปกติ กรุณาติดต่อผู้ดูแลระบบ')
              setBusy(false)
              return
            }
          }
        } catch (error) {
          console.error('Error validating server date with previous checkin:', error)
          // ถ้าอ่านไม่ได้ ให้ดำเนินการต่อ (ไม่บล็อกการเช็คอิน)
        }
      }
    } catch (error) {
      console.error('Error getting server time before transaction:', error)
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบวันที่จาก server ได้ กรุณาลองใหม่อีกครั้ง')
      setBusy(false)
      return
    }
    
    // ✅ ตรวจสอบว่า server date ที่ได้ก่อน transaction ตรงกับ server date ที่ตรวจสอบก่อนหน้านี้หรือไม่
    // ✅ ถ้าไม่ตรง แสดงว่าอาจมีการปรับเวลา ให้ปฏิเสธการเช็คอิน
    if (finalServerDate !== serverDate) {
      console.warn('Server date changed before transaction:', { 
        finalServerDate, 
        serverDate,
        idx 
      })
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ เนื่องจากมีการเปลี่ยนแปลงเวลา กรุณาลองใหม่อีกครั้ง')
      setBusy(false)
      return
    }
    
    // ✅ สำหรับ DAY 2+ (idx > 0): ตรวจสอบวันที่เช็คอินวันก่อนหน้าอีกครั้งก่อน transaction
    if (idx > 0) {
      try {
        const prevDayRef = ref(db, `checkins/${gameId}/${user}/${idx - 1}`)
        const prevDaySnap = await get(prevDayRef)
        const prevDayData = prevDaySnap.val()
        const prevDayCheckinDate = prevDayData?.date || null
        
        if (prevDayCheckinDate) {
          // ✅ ตรวจสอบว่า prevDayCheckinDate < finalServerDate
          // ✅ สำคัญ: เปรียบเทียบวันที่เช็คอินวันก่อนหน้ากับวันที่ปัจจุบัน (ทั้งคู่มาจาก server)
          if (prevDayCheckinDate >= finalServerDate) {
            console.warn('Previous day checkin date is not before current server date:', {
              prevDayCheckinDate,
              finalServerDate,
              idx
            })
            onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันก่อนหน้าในวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
            setBusy(false)
            return
          }
          
          // ✅ ตรวจสอบเพิ่มเติม: วันที่เช็คอินวันก่อนหน้าไม่ควรเป็นอนาคต (มากกว่า 1 วัน)
          const prevDate = new Date(prevDayCheckinDate + 'T00:00:00')
          const currentDate = new Date(finalServerDate + 'T00:00:00')
          const daysDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff < 0) {
            // ✅ วันที่เช็คอินวันก่อนหน้าเป็นอนาคต (ผิดปกติ)
            console.warn('Previous day checkin date is in the future:', {
              prevDayCheckinDate,
              finalServerDate,
              daysDiff,
              idx
            })
            onInfo?.('เกิดข้อผิดพลาด', 'พบข้อมูลวันที่เช็คอินที่ผิดปกติ กรุณาติดต่อผู้ดูแลระบบ')
            setBusy(false)
            return
          }
        }
      } catch (error) {
        console.error('Error checking previous day before transaction:', error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบการเช็คอินวันก่อนหน้าได้ กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
    }
    
    // ✅ ใช้ Firestore transaction เพื่อป้องกัน race condition (ดีกว่า RTDB)
    // ✅ สร้าง unique key สำหรับแต่ละ transaction โดยใช้ timestamp + random
    const uniqueKey = `${ts}_${Math.random().toString(36).substring(2, 9)}`
    
    // ✅ ใช้ Firestore service สำหรับ check-in transaction
    const checkinResult = await checkinWithFirestore(
      gameId,
      user,
      idx,
      finalServerDate,
      uniqueKey
    )
    
    // ✅ ตรวจสอบผลลัพธ์
    if (!checkinResult.success) {
      if (checkinResult.error === 'ALREADY_CHECKED_IN' || checkinResult.error === 'ALREADY_CHECKED_IN_TODAY') {
        console.warn('Already checked in for day:', idx)
        onInfo?.('คุณเช็คอินวันนี้แล้ว', 'คุณได้เช็คอินวันนี้เรียบร้อยแล้ว')
      } else {
        console.warn('Checkin transaction failed:', checkinResult.error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
      }
      setBusy(false)
      return
    }
    
    // ✅ ตรวจสอบอีกครั้งหลัง transaction เพื่อยืนยันว่าไม่มีการเช็คอินซ้ำ
    const verifyResult = await verifyCheckin(gameId, user, idx, uniqueKey)
    if (!verifyResult.verified) {
      // ✅ พบว่า transaction อื่นเช็คอินไปแล้วก่อนเรา
      console.warn('Another transaction checked in before this one:', { 
        ourKey: uniqueKey, 
        actualKey: verifyResult.data?.key 
      })
      // ✅ Rollback: ลบ checkin record ที่เราสร้าง
      await rollbackCheckin(gameId, user, idx)
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ มีการเช็คอินซ้ำ กรุณาลองใหม่อีกครั้ง')
      setBusy(false)
      return
    }
    
    // ✅ บันทึกใน RTDB เพื่อให้ real-time listeners ทำงาน (backward compatibility)
    // ✅ ใช้ set แทน transaction เพราะ Firestore transaction ทำแล้ว
    const checkinRef = ref(db, `checkins/${gameId}/${user}/${idx}`)
    await set(checkinRef, { checked: true, date: finalServerDate, ts: ts, key: uniqueKey })
    
    // ✅ อัพเดท local state ทันที (optimistic update) ก่อนบันทึก database
    // ✅ อัพเดท checked state
    setChecked(prev => ({ ...prev, [idx]: true }))
    // ✅ อัพเดท checkinDates ใน local state ทันที (optimistic update)
    // เพื่อป้องกันการเช็คอินซ้ำในวันเดียวกันทันที
    // ✅ ใช้ finalServerDate ที่ตรวจสอบก่อน transaction
    setCheckinDates(prev => ({ ...prev, [idx]: finalServerDate }))

    // แสดง notification popup ถ้ามีรูปภาพ (ย้ายไปแสดงตอน login แทน)
    // if (game?.checkin?.imageDataUrl && onNotification) {
    //   onNotification(
    //     game.checkin.imageDataUrl,
    //     '🎉 เช็คอินสำเร็จ!',
    //     'ยินดีด้วย! คุณได้เช็คอินเรียบร้อยแล้ว'
    //   )
    // }

    if (r.type === 'coin') {
      // ✅ เพิ่ม HENGCOIN ตามที่กำหนดไว้ใน rewards ของเกม (เช่น DAY 1 = 50 HENGCOIN)
      // ✅ เนื่องจากระบบป้องกันการเช็คอินซ้ำได้แล้ว จึงไม่ต้องกังวลเรื่องการเช็คอินซ้ำ
      // ✅ เพิ่ม HENGCOIN ลง RTDB โดยตรง (เหมือน Test 2)
      const amt = Number(r.amount ?? 0)
      
      if (amt > 0) {
        try {
          // ✅ เพิ่ม HENGCOIN ลงใน RTDB โดยตรง (ใช้ runTransaction เพื่อป้องกัน race condition)
          const coinRef = ref(db, `USERS_EXTRA/${user}/hcoin`)
          const coinTransaction = await runTransaction(coinRef, (cur: any) => {
            const currentBalance = Number(cur || 0)
            return currentBalance + amt
          })
          
          // ✅ ตรวจสอบผลลัพธ์
          if (!coinTransaction.committed) {
            console.warn('Coin transaction failed:', { user, amt, idx })
            
            // ✅ Rollback: ลบ checkin record เพราะ coin transaction ล้มเหลว
            // ✅ เพื่อป้องกันสถานะไม่สอดคล้อง (checkin บันทึกแล้วแต่ coin ไม่ได้เพิ่ม)
            try {
              // ✅ Rollback Firestore check-in
              await rollbackCheckin(gameId, user, idx)
              // ✅ Rollback RTDB check-in
              await set(ref(db, `checkins/${gameId}/${user}/${idx}`), null)
              // ✅ Rollback local state
              setChecked(prev => {
                const newState = { ...prev }
                delete newState[idx]
                return newState
              })
              setCheckinDates(prev => {
                const newState = { ...prev }
                delete newState[idx]
                return newState
              })
            } catch (rollbackError) {
              console.error('Error rolling back checkin after coin transaction failure:', rollbackError)
            }
            
            onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN ได้ กรุณาลองใหม่อีกครั้ง')
            setBusy(false)
            return
          }
          
          // ✅ อ่านยอดหลัง transaction
          const afterSnap = await get(coinRef)
          const after = Number(afterSnap.val() || 0)

          // ✅ log (ใช้ sharding ตามวันที่เพื่อลดขนาด node) - ใช้ finalServerDate ที่ตรวจสอบก่อน transaction
          const dateKey = finalServerDate.replace(/-/g, '')
          await set(ref(db, `answers/${gameId}/${dateKey}/${ts}`), {
            ts, user, action: 'checkin', dayIndex: idx + 1,
            amount: amt, balanceBefore: before, balanceAfter: after,
            serverDate: finalServerDate,  // ✅ บันทึก finalServerDate ที่ตรวจสอบก่อน transaction
          })

          // ✅ แสดง popup แบบใหม่
          setSuccess({
            amt,
            dayIndex: idx + 1,
            checked: countBefore + 1,
            total: rewards.length,
            type: 'coin',
          })
        } catch (coinError: any) {
          console.error('Error adding coins:', coinError)
          
          // ✅ Rollback: ลบ checkin record เพราะ coin transaction ล้มเหลว
          try {
            await rollbackCheckin(gameId, user, idx)
            await set(ref(db, `checkins/${gameId}/${user}/${idx}`), null)
            setChecked(prev => {
              const newState = { ...prev }
              delete newState[idx]
              return newState
            })
            setCheckinDates(prev => {
              const newState = { ...prev }
              delete newState[idx]
              return newState
            })
          } catch (rollbackError) {
            console.error('Error rolling back checkin after coin error:', rollbackError)
          }
          
          onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN ได้ กรุณาลองใหม่อีกครั้ง')
          setBusy(false)
          return
        }
      }
    } else {
      // ✅ CODE: ใช้ระบบ cursor เพื่อแจกโค้ดทีละโค้ด
      // ✅ อ่านโค้ดจาก Firebase เพื่อให้แน่ใจว่าได้โค้ดล่าสุด
      let codesString = String(r.code ?? '')
      
      // ✅ อ่านโค้ดจาก Firebase เสมอ (เพื่อให้ได้โค้ดล่าสุด)
      try {
        const rewardRef = ref(db, `games/${gameId}/checkin/rewards/${idx}`)
        const rewardSnap = await get(rewardRef)
        const rewardData = rewardSnap.val()
        if (rewardData && rewardData.kind === 'code') {
          codesString = String(rewardData.value || codesString)
        }
      } catch (error) {
        console.error('Error reading reward from Firebase:', error)
        // ใช้โค้ดจาก local state เป็น fallback
      }
      
      const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
      
      if (codes.length === 0) {
        onInfo?.('ยังไม่ได้ตั้งค่าโค้ด', 'วันเช็คอินนี้ไม่มีโค้ดที่กำหนดไว้')
        setBusy(false)
        return
      }

      // ✅ ใช้ transaction เพื่อแจกโค้ดทีละโค้ด (ใช้ cursor สำหรับแต่ละ dayIndex)
      const rewardCodesRef = ref(db, `games/${gameId}/checkin/rewardCodes/${idx}`)
      let chosenCode: string | null = null

      try {
        const codeResult = await runTransaction(rewardCodesRef, (cur: any) => {
          // cur = { cursor: number, codes: string[] }
          const cursor = Number(cur?.cursor ?? 0)
          const storedCodes = Array.isArray(cur?.codes) && cur.codes.length > 0 ? cur.codes : []
          
          // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่ (เปรียบเทียบกับโค้ดใหม่)
          const codesChanged = storedCodes.length === 0 || 
            JSON.stringify(storedCodes) !== JSON.stringify(codes)
          
          // ✅ ถ้าโค้ดเปลี่ยนไป ให้รีเซ็ต cursor และใช้โค้ดใหม่
          const finalCodes = codesChanged ? codes : storedCodes
          const finalCursor = codesChanged ? 0 : cursor
          
          // ✅ ถ้าโค้ดหมดแล้ว
          if (finalCursor >= finalCodes.length) {
            return cur // ไม่เปลี่ยน state
          }
          
          // ✅ แจกโค้ดตัวถัดไป
          chosenCode = finalCodes[finalCursor]
          return {
            cursor: finalCursor + 1,
            codes: finalCodes // ✅ เก็บโค้ดไว้ใน Firebase เพื่อใช้ในครั้งถัดไป
          }
        }, { applyLocally: false })

        if (!codeResult.committed || !chosenCode) {
          onInfo?.('โค้ดหมดแล้ว', 'โค้ดสำหรับวันนี้หมดแล้ว')
          setBusy(false)
          return
        }

        // ✅ log (ใช้ sharding ตามวันที่) - ใช้ finalServerDate ที่ตรวจสอบก่อน transaction
        const dateKey = finalServerDate.replace(/-/g, '')
        await set(ref(db, `answers/${gameId}/${dateKey}/${ts}`), {
          ts, user, action: 'checkin', dayIndex: idx + 1,
          amount: 0, code: chosenCode,
          balanceBefore: before, balanceAfter: before,
          serverDate: finalServerDate,  // ✅ บันทึก finalServerDate ที่ตรวจสอบก่อน transaction
        })

        // ถ้าวันนี้เป็น "โค้ด" ก็ยังโชว์สรุปเช็คอิน (amt=0)
        setSuccess({
          amt: 0,
          dayIndex: idx + 1,
          checked: countBefore + 1,
          total: rewards.length,
          type: 'code',
          code: chosenCode,
        })
      } catch (error) {
        console.error('Error claiming code:', error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถแจกโค้ดได้ กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
    }

    // ✅ ตรวจสอบว่าผู้ใช้เช็คอินครบทุกวันหรือไม่ และให้รางวัล
    const countAfter = countBefore + 1
    const allChecked = countAfter === rewards.length
    const completeReward = game?.checkin?.completeReward
    
    if (allChecked && completeReward && !completeRewardClaimed) {
      // ✅ ใช้ Firestore transaction เพื่อป้องกัน race condition (ดีกว่า RTDB)
      // ✅ สร้าง unique key สำหรับแต่ละ transaction
      const uniqueKey = `${ts}_${Math.random().toString(36).substring(2, 9)}`
      
      // ✅ ใช้ Firestore service สำหรับ complete reward transaction
      const claimedResult = await claimCompleteRewardWithFirestore(
        gameId,
        user,
        uniqueKey
      )
      
      // ✅ ตรวจสอบผลลัพธ์
      if (!claimedResult.success) {
        if (claimedResult.error === 'ALREADY_CLAIMED') {
          console.warn('Complete reward already claimed')
          setCompleteRewardClaimed(true)
        } else {
          console.warn('Complete reward transaction failed:', claimedResult.error)
          onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเคลมรางวัลได้ กรุณาลองใหม่อีกครั้ง')
        }
        setBusy(false)
        return
      }
      
      // ✅ ตรวจสอบอีกครั้งหลัง transaction เพื่อยืนยันว่าไม่มีการเคลมซ้ำ
      const verifyResult = await verifyCompleteReward(gameId, user, uniqueKey)
      if (!verifyResult.verified) {
        // ✅ พบว่า transaction อื่นเคลมไปแล้วก่อนเรา
        console.warn('Another transaction claimed before this one:', { 
          ourKey: uniqueKey, 
          actualKey: verifyResult.data?.key 
        })
        // ✅ Rollback: ลบ claimed flag
        await rollbackCompleteReward(gameId, user)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเคลมรางวัลได้ มีการเคลมซ้ำ กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
      
      // ✅ บันทึกใน RTDB เพื่อให้ real-time listeners ทำงาน (backward compatibility)
      const claimedRef = ref(db, `checkins/${gameId}/${user}/completeRewardClaimed`)
      await set(claimedRef, { claimed: true, ts: ts, key: uniqueKey })
      
      // ✅ ยังไม่เคยได้รับ ให้รางวัล
      if (completeReward.kind === 'coin') {
        const amt = Number(completeReward.value ?? 0)
        if (amt > 0) {
          try {
            // ✅ เพิ่ม HENGCOIN ลงใน RTDB โดยตรง (ใช้ runTransaction เพื่อป้องกัน race condition)
            const coinRef = ref(db, `USERS_EXTRA/${user}/hcoin`)
            const coinTransaction = await runTransaction(coinRef, (cur: any) => {
              const currentBalance = Number(cur || 0)
              return currentBalance + amt
            })
            
            // ✅ ตรวจสอบผลลัพธ์
            if (!coinTransaction.committed) {
              console.warn('Complete reward coin transaction failed:', { user, amt })
              
              // ✅ Rollback: ลบ claimed flag เพราะ transaction ไม่สำเร็จ
              try {
                await rollbackCompleteReward(gameId, user)
                await set(ref(db, `checkins/${gameId}/${user}/completeRewardClaimed`), null)
              } catch (rollbackError) {
                console.error('Error rolling back complete reward after coin transaction failure:', rollbackError)
              }
              
              onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN รางวัลครบทุกวันได้ กรุณาลองใหม่อีกครั้ง')
              setBusy(false)
              return
            }
            
            // ✅ อ่านยอดหลัง transaction
            const afterSnap = await get(coinRef)
            const after = Number(afterSnap.val() || 0)
            
            // ✅ บันทึกว่าได้รับแล้ว
            setCompleteRewardClaimed(true)
            setCompleteRewardCode(null)
            await set(ref(db, `checkins/${gameId}/${user}/completeRewardCode`), null)
            
            // ✅ log (ใช้ sharding ตามวันที่) - ใช้ server date และ server timestamp
            const serverTime = await getServerTime()
            const serverDate = dkey(new Date(serverTime))
            const dateKey = serverDate.replace(/-/g, '')
            const beforeCompleteReward = Number(hcoin || 0)
            await set(ref(db, `answers/${gameId}/${dateKey}/${serverTime}`), {
              ts: serverTime,
              user,
              action: 'checkin-complete',
              amount: amt,
              balanceBefore: beforeCompleteReward,
              balanceAfter: after,
              serverDate: serverDate, // ✅ บันทึก server date ด้วย
            })
          
            // แสดง popup
            setSuccess({
              amt,
              dayIndex: rewards.length,
              checked: countAfter,
              total: rewards.length,
              type: 'coin',
            })
          } catch (coinError: any) {
            console.error('Error adding complete reward coins:', coinError)
            
            // ✅ Rollback: ลบ claimed flag เพราะ coin transaction ล้มเหลว
            try {
              await rollbackCompleteReward(gameId, user)
              await set(ref(db, `checkins/${gameId}/${user}/completeRewardClaimed`), null)
            } catch (rollbackError) {
              console.error('Error rolling back complete reward after coin error:', rollbackError)
            }
            
            onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN รางวัลครบทุกวันได้ กรุณาลองใหม่อีกครั้ง')
            setBusy(false)
            return
          }
        }
      } else {
        // ✅ CODE: ใช้ระบบ cursor เพื่อแจกโค้ดทีละโค้ด
        // ✅ อ่านโค้ดจาก Firebase เพื่อให้แน่ใจว่าได้โค้ดล่าสุด
        let codesString = String(completeReward.value || '')
        
        // ✅ อ่านโค้ดจาก Firebase เสมอ (เพื่อให้ได้โค้ดล่าสุด)
        try {
          const completeRewardRef = ref(db, `games/${gameId}/checkin/completeReward`)
          const completeRewardSnap = await get(completeRewardRef)
          const completeRewardData = completeRewardSnap.val()
          if (completeRewardData && completeRewardData.kind === 'code') {
            codesString = String(completeRewardData.value || codesString)
          }
        } catch (error) {
          console.error('Error reading completeReward from Firebase:', error)
          // ใช้โค้ดจาก local state เป็น fallback
        }
        
        const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
        
        if (codes.length === 0) {
          onInfo?.('ยังไม่ได้ตั้งค่าโค้ด', 'รางวัลครบทุกวันไม่มีโค้ดที่กำหนดไว้')
          return
        }

        // ✅ ใช้ transaction เพื่อแจกโค้ดทีละโค้ด (ใช้ cursor สำหรับ completeReward)
        const completeRewardCodesRef = ref(db, `games/${gameId}/checkin/completeRewardCodes`)
        let chosenCode: string | null = null

        try {
          const codeResult = await runTransaction(completeRewardCodesRef, (cur: any) => {
            // cur = { cursor: number, codes: string[] }
            const cursor = Number(cur?.cursor ?? 0)
            const storedCodes = Array.isArray(cur?.codes) && cur.codes.length > 0 ? cur.codes : []
            
            // ✅ ตรวจสอบว่าโค้ดเปลี่ยนไปหรือไม่ (เปรียบเทียบกับโค้ดใหม่)
            const codesChanged = storedCodes.length === 0 || 
              JSON.stringify(storedCodes) !== JSON.stringify(codes)
            
            // ✅ ถ้าโค้ดเปลี่ยนไป ให้รีเซ็ต cursor และใช้โค้ดใหม่
            const finalCodes = codesChanged ? codes : storedCodes
            const finalCursor = codesChanged ? 0 : cursor
            
            // ✅ ถ้าโค้ดหมดแล้ว
            if (finalCursor >= finalCodes.length) {
              return cur // ไม่เปลี่ยน state
            }
            
            // ✅ แจกโค้ดตัวถัดไป
            chosenCode = finalCodes[finalCursor]
            return {
              cursor: finalCursor + 1,
              codes: finalCodes // ✅ เก็บโค้ดไว้ใน Firebase เพื่อใช้ในครั้งถัดไป
            }
          }, { applyLocally: false })

          if (!codeResult.committed || !chosenCode) {
            onInfo?.('โค้ดหมดแล้ว', 'โค้ดรางวัลครบทุกวันหมดแล้ว')
            return
          }

          // ✅ บันทึกว่าได้รับแล้ว (ใช้ set แทน transaction เพราะ transaction ด้านบนทำแล้ว)
          setCompleteRewardClaimed(true)
          setCompleteRewardCode(chosenCode)

          await set(ref(db, `checkins/${gameId}/${user}/completeRewardCode`), chosenCode)
          
          // ✅ log (ใช้ sharding ตามวันที่) - ใช้ server date และ server timestamp
          const serverTime = await getServerTime()
          const serverDate = dkey(new Date(serverTime))
          const dateKey = serverDate.replace(/-/g, '')
          await set(ref(db, `answers/${gameId}/${dateKey}/${serverTime}`), {
            ts: serverTime,
            user,
            action: 'checkin-complete',
            code: chosenCode,
            serverDate: serverDate, // ✅ บันทึก server date ด้วย
          })
          
          // แสดง popup
          setSuccess({
            amt: 0,
            dayIndex: rewards.length,
            checked: countAfter,
            total: rewards.length,
            type: 'code',
            code: chosenCode,
          })
        } catch (error) {
          console.error('Error claiming complete reward code:', error)
          onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถแจกโค้ดรางวัลครบทุกวันได้ กรุณาลองใหม่อีกครั้ง')
          return
        }
      }
    } else {
      setCompleteRewardClaimed(true)
    }
  } catch (error) {
    console.error('Checkin error:', error)
    onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
  } finally {
    setBusy(false)
  }
}

  return (
    <>
    <div className="checkin-wrap checkin-wrap--modern">
      {/* Logo ด้านบนสุด */}
      <img 
        src={safeAssets.logoContainer}
        alt={safeBranding.title}
        className="checkin-logo-image"
      />
      
      {/* Header Section */}
      <div className="checkin-header">
        <div className="checkin-logo">
          <span className="logo-text logo-green">{safeBranding.title.split(' ')[0]}</span>
          <span className="logo-text logo-yellow">{safeBranding.title.split(' ')[1] || ''}</span>
          <span className="logo-text logo-yellow logo-bold">{safeBranding.title.split(' ')[2] || ''}</span>
        </div>
      </div>

      {/* User Info Bar */}
      <div className="checkin-user-bar">
        <div className="user-info-section">
          <div className="user-icon">
            <img src="/image/user.svg" alt="User" width="24" height="24" />
          </div>
          <div className="username">{user}</div>
        </div>
        <div className="coin-info-section">
          <div className="coin-container">
            <div className="coin-icon">
              <img src={coinLogo} alt={coinName} width="24" height="24" />
            </div>
            <div className="coin-text-container">
              <div className="coin-label">{coinName}</div>
              <div className="coin-amount">:{hcoin.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Cards */}
      <div className="checkin-menu">
        {/* ✅ แสดง Daily Reward ตามการตั้งค่า */}
        {(game?.checkin?.features?.dailyReward !== false) && (
          <VipOrangeCard onClick={() => setOpenCheckin(true)} />
        )}
        {/* ✅ แสดง Mini Slot ตามการตั้งค่า */}
        {(game?.checkin?.features?.miniSlot !== false) && (
          <VipGreenCard onClick={() => setOpenSlot(true)} />
        )}
        {/* ✅ แสดง Coupon Shop ตามการตั้งค่า */}
        {(game?.checkin?.features?.couponShop !== false) && (
          <VipBlueCard onClick={() => setOpenCoupon(true)} />
        )}
      </div>

      {/* Contact Channels Section */}
      <div className="checkin-contact-section">
        <div className="contact-section-title">ช่องทางติดต่อ</div>
        <div className="checkin-contact">
          <div className="contact-card" onClick={() => window.open(themeName === 'max56' ? 'https://t.me/MAX56VIP' : 'https://t.me/HENG36_VIP', '_blank')}>
            <div className="contact-icon">
              <img src="/image/telegram.svg" alt="Telegram" />
            </div>
            <div className="contact-content">
              <div className="contact-title">TELEGRAM</div>
              <div className="contact-sub">กลุ่ม VIP</div>
            </div>
          </div>

          <div className="contact-card" onClick={() => window.open(themeName === 'max56' ? 'https://lin.ee/5rJ7GF7' : 'https://lin.ee/NFv6DgX', '_blank')}>
            <div className="contact-icon">
              <img src="/image/line.svg" alt="LINE" />
            </div>
            <div className="contact-content">
              <div className="contact-title">LINE</div>
              <div className="contact-sub">ติดต่อ 24 ชม.</div>
            </div>
          </div>

          <div className="contact-card" onClick={() => window.open(themeName === 'max56' ? 'https://max-56.com' : 'https://heng-36z.com/', '_blank')}>
            <div className="contact-icon">
              <img src={themeName === 'max56' ? '/image/max56.png' : '/image/slot1.png'} alt="Website" />
            </div>
            <div className="contact-content">
              <div className="contact-title">เว็บไซต์</div>
              <div className="contact-sub">{themeName === 'max56' ? 'MAX56' : 'HENG36'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Popup: เช็คอิน (ย้ายเนื้อหามาไว้ในนี้) ===== */}
      <Overlay open={openCheckin} onClose={() => setOpenCheckin(false)} maxWidth={980}>
        <div className="ol-header ol--orange">
          <div>
            <div className="ol-title">
              <span className="ol-ico">
                <img src="/image/checkin.svg" alt="Check-in" width="24" height="24" />
              </span> Daily Reward
            </div>
            <div className="ol-sub">เช็คอินเพื่อรับรางวัลประจำวัน</div>
          </div>
          <div></div>
          <button className="ol-close" aria-label="Close" onClick={()=>setOpenCheckin(false)}>
            <img src="/image/close.svg" alt="Close" width="20" height="20" />
          </button>
        </div>


        {/* ตารางวันเช็คอิน */}
        {rewards.length === 0 ? (
          <div className="banner warn" style={{ textAlign: 'center', marginTop: 10 }}>
            ยังไม่กำหนดรางวัลเช็คอิน
          </div>
        ) : (
           <div className="checkin-grid">
            {rewards.map((r, i) => {
          const done = !!checked[i]

          // ✅ ไม่ต้องคำนวณวันที่จาก startDate แล้ว (ใช้ระบบใหม่: นับตามลำดับที่เช็คอิน)
          // ✅ ตรวจสอบสถานะตามลำดับที่เช็คอิน
          // - ถ้าเช็คอินแล้ว = ไม่แสดงข้อความ
          // - ถ้ายังไม่เช็คอินและเป็นวันแรกที่สามารถเช็คอินได้ = "วันนี้เช็คอินได้"
          // - ถ้ายังไม่เช็คอินและไม่สามารถเช็คอินได้ (ยังไม่เช็คอินวันก่อนหน้า) = "รอเช็คอินวันก่อนหน้า"
          const canCheckinToday = !done && openTodayIndex === i
          const waitingForPrevious = !done && i > 0 && !checked?.[i - 1]
          const canCheckinLater = !done && !canCheckinToday && !waitingForPrevious

          return (
            <div
              key={i}
              className={`ci-card ${done ? 'is-done' : ''}`}
            >
              <div className="ci-head">Day {i + 1}</div>

              <div className="ci-body">
                {done ? (
                  <div className="ci-checked-pill">✓</div>
                ) : r.type === 'coin' ? (
                  <>
                    <div className="ci-icon coin" role="img" aria-label="coin">
                      <img src={coinLogo} alt={coinName} />
                    </div>
                    <div className="ci-amt">+ {fmt(r.amount)} {coinName}</div>
                  </>
                ) : (
                  <>
                    <div className="ci-icon code" role="img" aria-label="code">
                      <img src="/image/coupon.svg" alt="CODE" />
                    </div>
                    <div className="ci-amt">CODE</div>
                  </>
                )}
              </div>

              {/* Footer */}
              {!done && (
                <div className="ci-foot">
                  {canCheckinToday && <div className="ci-note ci-note--ok">วันนี้เช็คอินได้</div>}
                  {waitingForPrevious && <div className="ci-note">รอเช็คอินวันก่อนหน้า</div>}
                  {canCheckinLater && <div className="ci-note">ยังไม่ถึงวัน</div>}
                </div>
              )}
              
              {/* ✅ แสดงโค้ดที่ได้รับ (เฉพาะ DAY ที่มีรางวัลเป็นโค้ดและเช็คอินแล้ว) */}
              {done && r.type === 'code' && dayCodes[i] && (
                <div className="ci-foot" style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(59,130,246,0.08) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59,130,246,0.2)'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#1d4ed8',
                    marginBottom: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>🎁</span>
                    <span>โค้ดที่ได้รับ:</span>
                  </div>
                  <div style={{
                    fontSize: '15px',
                    fontWeight: 800,
                    color: '#1d4ed8',
                    fontFamily: 'monospace',
                    letterSpacing: '1px',
                    wordBreak: 'break-all',
                    padding: '6px 8px',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid rgba(59,130,246,0.3)',
                    marginBottom: '8px'
                  }}>
                    {dayCodes[i]}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(dayCodes[i])
                        onInfo?.('คัดลอกสำเร็จ', `โค้ด Day ${i + 1} ถูกคัดลอกแล้ว`)
                      } catch (err) {
                        try {
                          const textArea = document.createElement('textarea')
                          textArea.value = dayCodes[i]
                          textArea.style.position = 'fixed'
                          textArea.style.opacity = '0'
                          document.body.appendChild(textArea)
                          textArea.select()
                          document.execCommand('copy')
                          document.body.removeChild(textArea)
                          onInfo?.('คัดลอกสำเร็จ', `โค้ด Day ${i + 1} ถูกคัดลอกแล้ว`)
                        } catch {
                          onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถคัดลอกโค้ดได้')
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#1d4ed8',
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(59,130,246,0.25)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(59,130,246,0.15)'
                    }}
                  >
                    คัดลอก
                  </button>
                </div>
              )}
            </div>
          )
              })}
  </div>
        )}

        {game?.checkin?.completeReward && (
          (() => {
            const completeReward = game.checkin.completeReward
            const totalDays = rewards.length
            const remainingDays = Math.max(totalDays - checkedCount, 0)
            const summaryTone = completeRewardClaimed
              ? {
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  background: 'linear-gradient(135deg, rgba(134,239,172,0.25) 0%, rgba(59,130,246,0.18) 100%)',
                  accent: '#047857',
                  accentBg: 'rgba(34, 197, 94, 0.16)'
                }
              : {
                  border: '1px solid rgba(251, 191, 36, 0.45)',
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(249,115,22,0.12) 100%)',
                  accent: '#b45309',
                  accentBg: 'rgba(250, 204, 21, 0.18)'
                }

            const baseStyle: React.CSSProperties = {
              marginTop: 18,
              padding: '20px 22px',
              borderRadius: 18,
              position: 'relative',
              border: summaryTone.border,
              background: summaryTone.background,
              boxShadow: '0 18px 36px rgba(15, 23, 42, 0.16)'
            }

            const statusText = completeRewardClaimed
              ? 'คุณเช็คอินครบทุกวันและรับรางวัลเรียบร้อยแล้ว'
              : allChecked
                ? 'เช็คอินครบแล้ว ระบบกำลังมอบรางวัลให้ภายในไม่กี่นาที'
                : remainingDays === 0
                  ? 'เช็คอินครบแล้ว'
                  : `เช็คอินอีก ${remainingDays} วันเพื่อปลดล็อกรางวัลนี้`

            const renderRewardDetail = () => {
              if (completeReward.kind === 'coin') {
                const amt = Number(completeReward.value ?? 0)
                return (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '16px 18px',
                      borderRadius: 14,
                      background: 'linear-gradient(135deg, rgba(34,197,94,0.16) 0%, rgba(16,185,129,0.12) 100%)',
                      border: '1px solid rgba(34,197,94,0.35)',
                      color: '#14532d'
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 15 }}>
                      รางวัล: รับ {fmt(amt)} {coinName}
                    </div>
                    {completeRewardClaimed && (
                      <div style={{ marginTop: 6, fontWeight: 500, fontSize: 13 }}>
                        ระบบเพิ่มยอดให้กับบัญชีของคุณแล้ว
                      </div>
                    )}
                  </div>
                )
              }

              return completeRewardClaimed ? null : (
                <div
                  style={{
                    marginTop: 16,
                    padding: '16px 18px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(96,165,250,0.18) 0%, rgba(59,130,246,0.14) 100%)',
                    border: '1px solid rgba(59,130,246,0.35)',
                    color: '#1d4ed8'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>
                    รางวัล: จะได้รับ CODE โบนัสฟรี 30
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 500, fontSize: 13, color: '#0f172a' }}>
                    โค้ดจะปรากฏเฉพาะเมื่อเช็คอินครบทุกวันและได้รับรางวัลแล้ว
                  </div>
                </div>
              )
            }

            return (
              <div style={baseStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: summaryTone.accentBg,
                        color: summaryTone.accent,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 20,
                        boxShadow: '0 10px 24px rgba(124, 45, 18, 0.18)'
                      }}
                    >
                      🌟
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: summaryTone.accent }}>รางวัลเมื่อเช็คอินครบทุกวัน</div>
                      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: summaryTone.accent }}>{statusText}</div>
                    </div>
                  </div>
                  {totalDays > 0 && (
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: summaryTone.accent,
                        background: summaryTone.accentBg,
                        padding: '8px 14px',
                        borderRadius: 999
                      }}
                    >
                      {checkedCount}/{totalDays} วัน
                    </div>
                  )}
                </div>
                {renderRewardDetail()}
              </div>
            )
          })()
        )}
 
        {/* ข้อความบอกสถานะ + ปุ่มเช็คอิน */}
{endDate && serverDateKey > endDate && (
  <div style={{ textAlign: 'center', marginTop: 15, fontSize: 14, color: '#dc2626', fontWeight: 600 }}>
    กิจกรรมสิ้นสุดในวันที่ {fmtDMY(endDate)}
  </div>
)}

{completeRewardCode && completeRewardClaimed && (
  <div
    style={{
      marginTop: 16,
      padding: '18px 20px',
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(30,64,175,0.12) 100%)',
      border: '1px solid rgba(59,130,246,0.35)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      alignItems: 'center',
    }}
  >
    <div style={{ fontWeight: 800, fontSize: 16, color: '#1d4ed8', textAlign: 'center' }}>
      โค้ดรางวัลเมื่อเช็คอินครบ
    </div>
    <div
      style={{
        fontWeight: 900,
        fontSize: 20,
        letterSpacing: 2,
        padding: '12px 18px',
        borderRadius: 12,
        background: '#ffffff',
        color: '#1d4ed8',
        boxShadow: '0 10px 26px rgba(37, 99, 235, 0.25)',
      }}
    >
      {completeRewardCode}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center' }}>
      <button
        type="button"
        className="btn-copy"
        style={{
          fontWeight: 700,
          padding: '10px 18px',
          width: '100%',
          maxWidth: 260,
        }}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(completeRewardCode)
            setCompleteCodeCopied(true)
            setTimeout(() => setCompleteCodeCopied(false), 2000)
          } catch {
            try {
              const textarea = document.createElement('textarea')
              textarea.value = completeRewardCode
              textarea.style.position = 'fixed'
              textarea.style.opacity = '0'
              document.body.appendChild(textarea)
              textarea.select()
              document.execCommand('copy')
              document.body.removeChild(textarea)
              setCompleteCodeCopied(true)
              setTimeout(() => setCompleteCodeCopied(false), 2000)
            } catch {
              setCompleteCodeCopied(false)
            }
          }
        }}
      >
        {completeCodeCopied ? 'คัดลอกแล้ว ✓' : 'คัดลอกโค้ด'}
      </button>
      <a
        href={
          themeName === 'max56'
            ? 'https://max-56.com'
            : themeName === 'jeed24'
            ? 'https://jeed24.party'
            : 'https://heng-36z.com/'
        }
        target="_blank"
        rel="noopener noreferrer"
        className="btn-cta btn-cta-green"
        style={{
          width: '100%',
          maxWidth: 260,
          textAlign: 'center',
          fontWeight: 800,
        }}
      >
        ไปที่ {themeName === 'max56' ? 'MAX56' : themeName === 'jeed24' ? 'JEED24' : 'HENG36'}
      </a>
    </div>
  </div>
)}

<button
  className={lastDayChecked ? 'btn-cta btn-cta-red' : 'btn-cta btn-cta-green'}
  style={{
    marginTop: 14,
    ...(lastDayChecked ? {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important',
      color: '#ffffff !important',
      boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4) !important',
      cursor: 'not-allowed',
      opacity: 0.9
    } : {
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important',
      color: '#ffffff !important',
      boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3) !important'
    })
  }}
  onClick={doCheckin}
  disabled={!canCheckin || lastDayChecked}
>
  {lastDayChecked
    ? 'เช็คอินครบทุกวันแล้ว'
    : endDate && serverDateKey > endDate
    ? 'กิจกรรมสิ้นสุดแล้ว'
    : busy
      ? 'กำลังเช็คอิน…'
      : openTodayIndex >= 0
        ? 'CHECKIN'
        : 'ไม่สามารถเช็คอินได้'}
</button>

      </Overlay>

      {/* ===== Popup: สล็อต (ใช้ SlotGame + ใช้ HENGCOIN เป็นเครดิตจริง) ===== */}
     <Overlay open={openSlot} onClose={() => setOpenSlot(false)} maxWidth={980}>
      <div className="ol-header ol--green">
        <div>
          <div className="ol-title">
            <span className="ol-ico">
              <img src="/image/slot.svg" alt="Mini Slot" width="24" height="24" />
            </span> Mini Slot
          </div>
          <div className="ol-sub">ใช้ {coinName} เล่นเพื่อลุ้นรางวัล</div>
        </div>
        <div></div>
        <button className="ol-close" aria-label="Close" onClick={()=>setOpenSlot(false)}>
          <img src="/image/close.svg" alt="Close" width="20" height="20" />
        </button>
      </div>
        <SlotGame
          username={user}
          gameId={`checkin-slot:${gameId}`}
          gameData={game}
          displayCredit={hcoin}
          embed={{
            startBet: slotStartBet,
            winRate: slotWinRate,
            creditRef: `USERS_EXTRA/${user}/hcoin`,
            onClose: () => setOpenSlot(false),
          }}
        />
      </Overlay>
      <Overlay open={openCoupon} onClose={() => setOpenCoupon(false)} maxWidth={860} closeOnBackdrop={false}>
        <div className="ol-header ol--blue">
          <div>
            <div className="ol-title">
              <span className="ol-ico">
                <img src="/image/shop.svg" alt="Coupon Shop" width="24" height="24" />
              </span> Coupon Shop
            </div>
            <div className="ol-sub">แลกโค้ดรางวัล โดยใช้ {coinName} ใช้การแลกรับรางวัล</div>
          </div>
          <div></div>
          <button className="ol-close" aria-label="Close" onClick={()=>setOpenCoupon(false)}>
            <img src="/image/close.svg" alt="Close" width="20" height="20" />
          </button>
        </div>

  <CouponGame
    open={true}
    onClose={() => setOpenCoupon(false)}
    hengcoin={hcoin}
    gameId={gameId}
    username={user}
    items={(Array.isArray(game?.checkin?.coupon?.items) ? game.checkin.coupon.items : []).map((it: any, idx: number) => ({
      title: typeof it?.title === 'string' ? it.title : '',
      rewardCredit: Number(it?.rewardCredit) || 0,
      price: Number(it?.price) || 0,
      codes: Array.isArray(couponItemCodes[idx]) ? couponItemCodes[idx].filter(Boolean) : [],
    }))}
    onRedeem={async (idx) => {
  const items = Array.isArray(game?.checkin?.coupon?.items) ? game.checkin.coupon.items : [];
  const item = items[idx];
  if (!item) return { ok:false, message:'ไม่พบรางวัลนี้' };

  const price = Number(item.price||0);
  const before = hcoin;                          // ✅ เก็บยอดก่อนหัก (สำหรับ log)
  if (before < price) return { ok:false, message:`${coinName} ไม่พอ` };

  const cursorsRef = ref(db, `games/${gameId}/checkin/coupon/cursors`);
  let chosenCode: string | null = null;

  try {
    // ✅ อ่าน codes จาก items/{index}/codes (แยกออกจาก items เพื่อป้องกัน write_too_big)
    const codesRef = ref(db, `games/${gameId}/checkin/coupon/items/${idx}/codes`);
    const codesSnap = await get(codesRef);
    const codes: string[] = Array.isArray(codesSnap.val()) ? codesSnap.val().filter(Boolean) : [];
    
    if (codes.length === 0) {
      return { ok: false, message: 'ไม่มีโค้ดสำหรับรางวัลนี้' };
    }
    
    // ✅ ใช้ transaction เฉพาะ cursors (ไม่เขียน codes array กลับไป)
    const cursorResult = await runTransaction(cursorsRef, (cur: any) => {
      const cursors = Array.isArray(cur) ? [...cur] : [];
      const c = Number(cursors[idx] ?? 0);
      
      // ✅ ตรวจสอบว่า cursor อยู่ในช่วงที่ถูกต้อง
      if (c >= codes.length) {
        return cur; // โค้ดหมดแล้ว
      }
      
      const code = codes[c];
      if (!code) return cur; // ไม่มีโค้ดแล้ว
      
      chosenCode = String(code);
      cursors[idx] = c + 1;
      return cursors;
    }, { applyLocally: false });
    
    if (!cursorResult.committed) {
      return { ok: false, message: 'ไม่สามารถจองโค้ดได้' };
    }
  } catch (error) {
    console.error('Coupon transaction error:', error);
    return { ok: false, message: 'ไม่สามารถจองโค้ดได้' };
  }

  if (!chosenCode) return { ok:false, message:'โค้ดหมดแล้ว' };

  // ตัดเหรียญ
  const balRef = ref(db, `USERS_EXTRA/${user}/hcoin`);
  let after = before;
  try {
    const res = await runTransaction(balRef, (cur:any) => {
      const curBal = Number(cur ?? 0);
      if (!Number.isFinite(curBal) || curBal < price) return;  // ยกเลิก
      return curBal - price;
    });
    if (!res.committed) {
      // ยกเลิก cursor คืน (เขียนเฉพาะ cursors ไม่เขียน codes)
      await runTransaction(cursorsRef, (cur: any) => {
        const cursors = Array.isArray(cur) ? [...cur] : [];
        const current = Number(cursors[idx] ?? 0);
        if (current > 0) cursors[idx] = current - 1;
        return cursors;
      });
      return { ok: false, message: `${coinName} ไม่พอ` };
    }
    after = Number(res.snapshot?.val() ?? (before - price));   // ✅ ยอดหลังหัก
  } catch {
    // คืน cursor หากตัดเหรียญล้มเหลว (เขียนเฉพาะ cursors ไม่เขียน codes)
    await runTransaction(cursorsRef, (cur: any) => {
      const cursors = Array.isArray(cur) ? [...cur] : [];
      const current = Number(cursors[idx] ?? 0);
      if (current > 0) cursors[idx] = current - 1;
      return cursors;
    });
    return { ok: false, message: 'ไม่สามารถตัดเหรียญได้' };
  }

  // อัปเดต UI
  setHcoin(after);

  // ✅ LOG ประวัติ “แลกคูปอง” ลง answers/<gameId>/<ts>
  await logAction(gameId, user, {
    action: 'coupon-redeem',
    itemIndex: idx,
    price,
    code: chosenCode!,
    balanceBefore: before,
    balanceAfter: after,
  });

  return { ok:true, code: chosenCode! };
}}

  />
</Overlay>
      {success && (
        <Overlay open={true} onClose={() => setSuccess(null)} maxWidth={540} closeOnBackdrop>
          <div className="cis-wrap">
            <div className="cis-head">
              <div className="cis-check">✓</div>
              <div className="cis-title">เช็คอินสำเร็จ</div>
              <div className="cis-sub">รับรางวัลของวันนี้เรียบร้อย</div>
            </div>

            <div className="cis-grid">
              <div className="cis-item">
                <div className="cis-label">USER</div>
                <div className="cis-value mono">{user}</div>
              </div>
              <div className="cis-item">
                <div className="cis-label">DAY</div>
                <div className="cis-value">Day {success.dayIndex}</div>
              </div>
              <div className="cis-item">
                <div className="cis-label">เช็คอินแล้ว</div>
                <div className="cis-value">{success.checked}/{success.total}</div>
              </div>
              {success.type === 'coin' ? (
                <div className="cis-item">
                  <div className="cis-label">ได้รับ {coinName}</div>
                  <div className="cis-value cis-plus">+{fmt(success.amt)}</div>
                </div>
              ) : (
                <div className="cis-item">
                  <div className="cis-label">ได้รับ CODE</div>
                  <div className="cis-value cis-code">{success.code}</div>
                </div>
              )}
            </div>

            {success.type === 'code' && (
              <div className="cis-code-actions">
                <button
                  className="btn-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(success.code || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      // fallback for older browsers
                      const textArea = document.createElement('textarea');
                      textArea.value = success.code || '';
                      document.body.appendChild(textArea);
                      textArea.select();
                      try {
                        document.execCommand('copy');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } finally {
                        document.body.removeChild(textArea);
                      }
                    }
                  }}
                  aria-label="คัดลอกโค้ด"
                >
                  {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกโค้ด'}
                </button>
                <a
                  href={
                    themeName === 'max56' 
                      ? 'https://max-56.com' 
                      : themeName === 'jeed24' 
                      ? 'https://jeed24.party' 
                      : 'https://heng-36z.com/'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-fill link-btn"
                >
                  ไปที่ {themeName === 'max56' ? 'MAX56' : themeName === 'jeed24' ? 'JEED24' : 'HENG36'}
                </a>
              </div>
            )}

            <button className="btn-cta" onClick={() => setSuccess(null)} style={{marginTop: 12}}>
              ตกลง
            </button>
          </div>
        </Overlay>
      )}

    </div>
    
    {/* Notification Popup */}
    {notification.open && createPortal(
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.8)', 
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
          padding: 0
        }}
        onClick={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <div 
          style={{
            background: 'transparent',
            padding: '0',
            borderRadius: '16px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            width: 'auto',
            height: 'auto',
            position: 'relative',
            zIndex: 100000,
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={() => setNotification(prev => ({ ...prev, open: false }))}
            style={{ 
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0,0,0,0.5)', 
              border: 'none', 
              fontSize: '20px', 
              cursor: 'pointer', 
              color: 'white',
              padding: '8px',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100001
            }}
          >
            ✕
          </button>
          
          {/* Full size image */}
          {notification.imageUrl && (
            <img 
              src={notification.imageUrl} 
              alt="Notification" 
              style={{ 
                maxWidth: 'min(90vw, 1200px)',
                maxHeight: '90vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '16px',
                display: 'block',
                margin: '0 auto'
              }}
            />
          )}
        </div>
      </div>,
      document.body
    )}
    
  </>
  )
}
