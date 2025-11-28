// src/components/CheckinGame.tsx
import React from 'react'
// ✅ Removed Firebase RTDB and Firestore imports - using PostgreSQL 100%
import * as postgresqlAdapter from '../services/postgresql-adapter'
import '../styles/checkin.css'
import { createPortal } from 'react-dom'
import CouponGame from './CouponGame';
import SlotGame from './SlotGame'
import UserBar from './UserBar'
import { useRealtimeData } from '../hooks/useOptimizedData'
import { dataCache } from '../services/cache'
import { useTheme, useThemeAssets, useThemeBranding } from '../contexts/ThemeContext'
import { useSocketIOUserData, useSocketIOCheckinData, useSocketIOAnswers } from '../hooks/useSocketIO'
// ✅ Removed Firestore user data imports - using PostgreSQL 100%
import { getImageUrl } from '../services/image-upload'

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

// ✅ Helper function: อ่าน offset ด้วย onValue (รองรับ .info/serverTimeOffset) - สำหรับ fallback เท่านั้น
const getOffsetOnce = async (offsetRef: any, timeout: number = 5000): Promise<number> => {
  const { onValue } = await import('firebase/database')
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

// ✅ ฟังก์ชันสำหรับดึง server time (ใช้ PostgreSQL API)
const getServerTime = async (): Promise<number> => {
  try {
    // ✅ ใช้ PostgreSQL API เท่านั้น
    const serverTime = await postgresqlAdapter.getServerTime()
    return serverTime
  } catch (error) {
    console.error('Error getting server time from PostgreSQL, using client time:', error)
    // ✅ ใช้ client time เป็น fallback (ไม่ใช้ Firebase)
    return Date.now()
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
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true) // ✅ ใช้ capture phase เพื่อป้องกัน event bubbling
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, closeOnEsc, onClose])
  
  // ✅ Early return หลัง hooks
  if (!open) return null

  return createPortal(
    <div
      className="ci-ol"
      // เดิม: onClick={onClose}  → เอาออก
      // ถ้าต้องให้คลิกนอกแล้วปิดจริง ๆ ค่อยส่ง closeOnBackdrop=true เข้ามา
      onClick={closeOnBackdrop ? (e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } : undefined}
      onMouseDown={(e) => {
        // ✅ ป้องกันการ click event ที่อาจทำให้ redirect
        if (!closeOnBackdrop) {
          e.stopPropagation()
        }
      }}
    >
      <div
        className="ci-ol__panel"
        style={{ width: `min(96vw, ${maxWidth}px)` }}
        onClick={(e) => e.stopPropagation()}  // กันคลิกทะลุ
        onMouseDown={(e) => e.stopPropagation()} // ✅ ป้องกัน mouse down event
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


  // ✅ Removed: Mini Slot credit initialization - handled by SlotGame component
  // React.useEffect(() => {
  //   if (!openSlot) return
  //   // ตั้งค่าเริ่มต้นให้เลดเจอร์ Mini Slot "ครั้งเดียวตอนเปิด"
  //   // ถ้าเคยถูกตั้ง/กำลังเล่นอยู่แล้ว จะไม่ทับค่าเดิม
  //   runTransaction(ref(db, miniSlotCreditRef), (cur:any) => {
  //     return cur == null ? Number(hcoin || 0) : cur
  //   })
  // }, [openSlot, miniSlotCreditRef, hcoin])

  // ✅ Use WebSocket for user data (hcoin, status) - real-time updates
  const { data: userData, loading: userDataLoading } = useSocketIOUserData(user)
  const hcoinData = userData?.hcoin ?? null
  const userStatusData = userData?.status ?? null
  
  // ✅ Function to refresh user data immediately (called after coin operations)
  // ✅ Fallback to API if WebSocket not ready
  const refreshUserData = React.useCallback(async () => {
    if (!user) return
    try {
      const userData = await postgresqlAdapter.getUserData(user)
      if (userData) {
        // WebSocket will update automatically, but we can trigger a manual refresh if needed
        // The WebSocket hook will handle the real-time updates
      }
    } catch (error) {
      console.error('Error loading user data from PostgreSQL:', error)
    }
  }, [user])

  // ✅ Use WebSocket for checkin data - real-time updates
  const { data: checkinData, loading: checkinDataLoading } = useSocketIOCheckinData(gameId, user)
  
  // ✅ Function to refresh checkin data immediately (called after check-in operations)
  const refreshCheckinData = React.useCallback(async () => {
    if (!user || !gameId) return
    try {
      // WebSocket will update automatically, but we can trigger a manual refresh if needed
      const checkins = await postgresqlAdapter.getCheckins(gameId, user, 30)
      // The WebSocket hook will handle the real-time updates
    } catch (error) {
      console.error('Error loading checkins from PostgreSQL:', error)
    }
  }, [user, gameId])

  // ✅ Use WebSocket answers for complete reward status - real-time updates
  const { data: answersData } = useSocketIOAnswers(gameId, 100)
  const completeRewardClaimedData = React.useMemo(() => {
    if (!user || !gameId || !answersData) return null
    const completeRewardAnswer = answersData
      .filter((a: any) => a.userId === user && a.action === 'checkin-complete')
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
    return completeRewardAnswer ? true : false
  }, [user, gameId, answersData])

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
        // ✅ โหลด codes สำหรับแต่ละ item จาก game data (PostgreSQL)
        const codes = items.map((item: any, index: number) => {
          // Codes are stored in game.checkin.coupon.items[index].codes
          const itemCodes = Array.isArray(item?.codes) ? item.codes.filter(Boolean) : []
          return itemCodes
        })
        
        setCouponItemCodes(codes)
      } catch (error) {
        console.error('Error loading coupon codes:', error)
        setCouponItemCodes([])
      }
    }

    loadCouponCodes()
  }, [gameId, game?.checkin?.coupon?.items])

  // ✅ Use WebSocket answers for complete reward code - real-time updates
  const completeRewardCodeData = React.useMemo(() => {
    if (!user || !gameId || !answersData) return null
    const completeRewardAnswer = answersData
      .filter((a: any) => a.userId === user && a.code && a.action === 'checkin-complete')
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
    return completeRewardAnswer?.code ? String(completeRewardAnswer.code) : null
  }, [user, gameId, answersData])

  // ✅ REMOVED: ลบ listener ที่ซ้ำซ้อน (มี useRealtimeData อยู่แล้ว)
  // ✅ ใช้ checkinData จาก useRealtimeData แทน (ดูที่ useEffect บรรทัด 641-661)
  // ✅ checkinData มีทั้ง checked status และ date field แล้ว ไม่ต้อง listen ซ้ำ
  // ✅ checkinDates จะถูกอัพเดทจาก checkinData ใน useEffect ที่บรรทัด 641-661

  // ✅ Use WebSocket answers for day codes - real-time updates
  const { data: dayCodesAnswersData } = useSocketIOAnswers(gameId, 200)
  React.useEffect(() => {
    if (!user || !gameId || !dayCodesAnswersData) return

    const codes: Record<number, string> = {}
    const codeTimestamps: Record<number, number> = {}
    
    // ✅ กรองเฉพาะที่ user ตรงกัน, action === 'checkin', และมี code
    dayCodesAnswersData
      .filter((a: any) => 
        a.userId === user && 
        a.action === 'checkin' && 
        a.code &&
        a.dayIndex !== undefined
      )
      .forEach((answer: any) => {
        const dayIndex = Number(answer.dayIndex) - 1 // dayIndex ใน answers เป็น 1-based, เราใช้ 0-based
        if (!isNaN(dayIndex) && dayIndex >= 0) {
          const currentTs = answer.createdAt ? (typeof answer.createdAt === 'string' ? new Date(answer.createdAt).getTime() : answer.createdAt) : (answer.ts || 0)
          const existingTs = codeTimestamps[dayIndex] || 0
          
          // ✅ เก็บโค้ดล่าสุด (ถ้ามีหลายโค้ดในวันเดียวกัน ใช้ตัวล่าสุด)
          if (!codes[dayIndex] || currentTs > existingTs) {
            codes[dayIndex] = String(answer.code)
            codeTimestamps[dayIndex] = currentTs
          }
        }
      })
    
    // ✅ อัพเดท state เมื่อมีโค้ดใหม่
    if (Object.keys(codes).length > 0) {
      setDayCodes(codes)
    }
  }, [user, gameId, dayCodesAnswersData])

  // Update state when data changes
  React.useEffect(() => {
    if (hcoinData !== null) {
      const v = Number(hcoinData ?? 0)
      setHcoin(Number.isFinite(v) ? v : 0)
    }
  }, [hcoinData])

  React.useEffect(() => {
    // ✅ รองรับทั้ง null, empty object {}, และ object ที่มีข้อมูล
    // ✅ ตรวจสอบว่า checkinData เป็น object และไม่ใช่ null
    if (checkinData !== null && typeof checkinData === 'object' && !Array.isArray(checkinData)) {
      // ✅ รองรับทั้ง boolean (true) และ object ({ checked: true, date: ... })
      const checkedData: Record<number, boolean> = {}
      const checkinDatesData: Record<number, string> = {}
      
      Object.keys(checkinData).forEach((key) => {
        const dayIndex = parseInt(key, 10)
        if (!isNaN(dayIndex)) {
          const value = (checkinData as any)[key]
          // ✅ ถ้า value เป็น boolean (true) หรือ object ที่มี checked: true
          checkedData[dayIndex] = value === true || (value && value.checked === true)
          // ✅ เก็บวันที่เช็คอิน - ตรวจสอบหลายรูปแบบ
          if (value && typeof value === 'object') {
            // ✅ รองรับทั้ง date, checkin_date, checkinDate
            let dateValue = value.date || value.checkin_date || value.checkinDate
            if (!dateValue && value.createdAt) {
              // ✅ ถ้าไม่มี date แต่มี createdAt ให้ใช้ createdAt แปลงเป็น date key
              try {
                dateValue = dkey(new Date(value.createdAt))
              } catch (error) {
                console.warn('[CheckinGame] Error parsing createdAt:', error, value.createdAt)
              }
            }
            if (dateValue) {
              checkinDatesData[dayIndex] = dateValue
            }
          }
        }
      })
      
      // ✅ Debug: Log checkin data for troubleshooting
      if (Object.keys(checkedData).length > 0) {
        console.log('[CheckinGame] Updated checked state:', checkedData, 'from checkinData:', checkinData)
        console.log('[CheckinGame] Checkin dates:', checkinDatesData)
        console.log('[CheckinGame] Full checkinData keys:', Object.keys(checkinData))
      } else if (checkinData && typeof checkinData === 'object' && Object.keys(checkinData).length > 0) {
        // ✅ Log even if no checked data found (might be empty objects)
        console.log('[CheckinGame] checkinData exists but no checked items found:', {
          checkinData,
          keys: Object.keys(checkinData),
          sampleValue: checkinData[Object.keys(checkinData)[0]]
        })
      }
      
      // ✅ อัพเดท checked state - ใช้ spread operator เพื่อไม่ให้ลบข้อมูลเดิม
      // ✅ แปลง string keys เป็น number keys เพื่อให้ตรงกับ dayIndex
      setChecked(prev => {
        const updated: Record<number, boolean> = { ...prev }
        // ✅ อัพเดท checked state จาก checkinData (รองรับทั้ง string และ number keys)
        Object.keys(checkedData).forEach(key => {
          const dayIndex = parseInt(key, 10)
          if (!isNaN(dayIndex)) {
            updated[dayIndex] = checkedData[dayIndex]
          }
        })
        
        // ✅ Debug: Log if there are differences
        const hasChanges = Object.keys(checkedData).some(key => {
          const dayIndex = parseInt(key, 10)
          return prev[dayIndex] !== checkedData[dayIndex]
        })
        if (hasChanges) {
          console.log('[CheckinGame] Checked state changed:', { prev, updated, checkedData })
        }
        return updated
      })
      setCheckinDates(prev => ({ ...prev, ...checkinDatesData }))
    } else if (checkinData === null || (typeof checkinData === 'object' && Object.keys(checkinData).length === 0)) {
      // ✅ ถ้าไม่มีข้อมูล (null หรือ empty object) ให้ clear state
      // ✅ แต่ไม่ clear ถ้ายัง loading อยู่ (รอให้ loading เสร็จก่อน)
      if (!checkinDataLoading) {
        setChecked({})
        setCheckinDates({})
      }
    }
  }, [checkinData, checkinDataLoading])
  
  // ✅ Removed: Migration and sync logic - PostgreSQL is the source of truth

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

  // ✅ Removed: Record user login - not needed for PostgreSQL

  // แสดง notification popup เมื่อ component mount (หลังจาก login สำเร็จ)
  React.useEffect(() => {
    if (game?.checkin?.imageDataUrl) {
      setNotification({
        open: true,
        imageUrl: getImageUrl(game.checkin.imageDataUrl),
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
    const interval = window.setInterval(updateServerTime, 60 * 1000)

    return () => window.clearInterval(interval)
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
    
    // ✅ ตรวจสอบ Day 1: ถ้า Day 1 เช็คอินในวันนี้แล้ว → return -1 (ไม่ให้เช็คอิน Day 2 ในวันเดียวกัน)
    // ✅ รองรับทั้ง number key และ string key
    const day1CheckinItem = checkinData?.[0] || checkinData?.['0'] || checkinData?.[`0`]
    const day1CheckinDateRaw = day1CheckinItem && typeof day1CheckinItem === 'object' && day1CheckinItem.date
      ? day1CheckinItem.date
      : checkinDates[0]
    const day1IsChecked = day1CheckinItem && (
      day1CheckinItem === true || 
      (typeof day1CheckinItem === 'object' && day1CheckinItem.checked === true)
    ) || checked?.[0]
    
    // ✅ แปลง day1CheckinDate เป็น date key (รองรับทั้ง ISO string และ date key)
    let day1CheckinDate: string | null = null
    if (day1CheckinDateRaw) {
      try {
        // ✅ ถ้าเป็น ISO string ให้แปลงเป็น date key
        if (day1CheckinDateRaw.includes('T') || day1CheckinDateRaw.includes('Z')) {
          day1CheckinDate = dkey(new Date(day1CheckinDateRaw))
        } else {
          // ✅ ถ้าเป็น date key อยู่แล้ว ใช้เลย
          day1CheckinDate = day1CheckinDateRaw
        }
      } catch (error) {
        // ✅ ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
        day1CheckinDate = day1CheckinDateRaw
      }
    }
    
    if (day1IsChecked && day1CheckinDate && day1CheckinDate === serverDateKey) {
      // ✅ Day 1 เช็คอินในวันนี้แล้ว → ไม่ให้เช็คอิน Day 2 ในวันเดียวกัน
      return -1
    }
    
    // ✅ หาวันแรกที่ยังไม่เช็คอิน (เริ่มจาก index 0)
    for (let i = 0; i < rewards.length; i++) {
      // ✅ รองรับทั้ง number key และ string key
      const checkinItem = checkinData?.[i] || checkinData?.[String(i)] || checkinData?.[`${i}`]
      const isChecked = checkinItem && (
        checkinItem === true || 
        (typeof checkinItem === 'object' && checkinItem.checked === true)
      ) || checked?.[i]
      
      if (isChecked) {
        // ✅ ถ้าเช็คอินไปแล้ว ข้ามไปเช็ควันถัดไป
        continue
      }
      
      // ✅ ถ้ายังไม่เช็คอิน
      if (i === 0) {
        // ✅ Day 1: สามารถเช็คอินได้ (ถ้าไม่ผ่าน endDate)
        return i
      } else {
        // ✅ Day 2, 3, ... : ต้องเช็คอินวันก่อนหน้าแล้ว และวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน
        const prevDayIndex = i - 1
        const prevDayCheckinItem = checkinData?.[prevDayIndex] || checkinData?.[String(prevDayIndex)] || checkinData?.[`${prevDayIndex}`]
        const prevDayIsChecked = prevDayCheckinItem && (
          prevDayCheckinItem === true || 
          (typeof prevDayCheckinItem === 'object' && prevDayCheckinItem.checked === true)
        ) || checked?.[prevDayIndex]
        
        if (!prevDayIsChecked) {
          // ✅ ยังไม่เช็คอินวันก่อนหน้า → หยุดที่นี้
          break
        }
        
        // ✅ เช็ควันที่เช็คอินวันก่อนหน้า
        let prevDayCheckinDateRaw: string | null = null
        if (prevDayCheckinItem && typeof prevDayCheckinItem === 'object') {
          // ✅ รองรับหลายรูปแบบ: date, checkin_date, checkinDate
          prevDayCheckinDateRaw = prevDayCheckinItem.date || prevDayCheckinItem.checkin_date || prevDayCheckinItem.checkinDate || null
          // ✅ ถ้าไม่มี date แต่มี createdAt ให้ใช้ createdAt
          if (!prevDayCheckinDateRaw && prevDayCheckinItem.createdAt) {
            try {
              prevDayCheckinDateRaw = dkey(new Date(prevDayCheckinItem.createdAt))
            } catch (error) {
              console.warn('[openTodayIndex] Error parsing createdAt:', error, prevDayCheckinItem.createdAt)
            }
          }
        }
        // ✅ Fallback: ใช้ checkinDates
        if (!prevDayCheckinDateRaw && checkinDates[i - 1]) {
          prevDayCheckinDateRaw = checkinDates[i - 1]
        }
        
        // ✅ แปลง prevDayCheckinDate เป็น date key (รองรับทั้ง ISO string และ date key)
        let prevDayCheckinDate: string | null = null
        if (prevDayCheckinDateRaw) {
          try {
            // ✅ ถ้าเป็น ISO string ให้แปลงเป็น date key
            if (prevDayCheckinDateRaw.includes('T') || prevDayCheckinDateRaw.includes('Z')) {
              prevDayCheckinDate = dkey(new Date(prevDayCheckinDateRaw))
            } else {
              // ✅ ถ้าเป็น date key อยู่แล้ว ใช้เลย
              prevDayCheckinDate = prevDayCheckinDateRaw
            }
          } catch (error) {
            // ✅ ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
            prevDayCheckinDate = prevDayCheckinDateRaw
          }
        }
        
        if (prevDayCheckinDate && prevDayCheckinDate < serverDateKey) {
          // ✅ เช็คอินวันก่อนหน้าไปแล้วในวันอื่น → สามารถเช็คอินได้
          return i
        } else {
          // ✅ เช็คอินวันก่อนหน้าในวันนี้ (หรือไม่มี date) → ต้องรอ
          break
        }
      }
    }
    return -1
  }, [rewards, checked, serverDateKey, endDate, checkinDates, checkinData])


  // เช็คว่ากดเช็คอินได้ไหม
  // ✅ ระบบใหม่: ไม่ต้องเช็ค isWithinActivityPeriod หรือ startDate
  // ✅ เช็คเฉพาะว่าไม่ผ่าน endDate ไปแล้ว (ถ้ามี endDate)
  const canCheckin = React.useMemo(() => {
    // ✅ ตรวจสอบเงื่อนไขพื้นฐาน
    if (busy || rewards.length === 0) return false
    if (endDate && serverDateKey > endDate) return false
    
    // ✅ ตรวจสอบ Day 1 ก่อนทุกอย่าง: ถ้า Day 1 เช็คอินในวันนี้แล้ว → ไม่สามารถเช็คอิน Day 2 ได้ (เช็คอินได้วันละ 1 ครั้ง)
    // ✅ ใช้ checked state เป็นหลัก (update ทันที) และ checkinData/checkinDates เป็น fallback
    // ✅ รองรับทั้ง number key และ string key
    const day1CheckinData = checkinData?.[0] || checkinData?.['0'] || checkinData?.[`0`]
    const day1IsChecked = checked?.[0] || (
      day1CheckinData && (
        day1CheckinData === true || 
        (typeof day1CheckinData === 'object' && day1CheckinData.checked === true)
      )
    )
    
    const day1CheckinDateRaw = checkinDates[0] || (
      day1CheckinData && typeof day1CheckinData === 'object' && day1CheckinData.date
        ? day1CheckinData.date
        : null
    )
    
    // ✅ แปลง day1CheckinDate เป็น date key (รองรับทั้ง ISO string และ date key)
    let day1CheckinDate: string | null = null
    if (day1CheckinDateRaw) {
      try {
        // ✅ ถ้าเป็น ISO string ให้แปลงเป็น date key
        if (day1CheckinDateRaw.includes('T') || day1CheckinDateRaw.includes('Z')) {
          day1CheckinDate = dkey(new Date(day1CheckinDateRaw))
        } else {
          // ✅ ถ้าเป็น date key อยู่แล้ว ใช้เลย
          day1CheckinDate = day1CheckinDateRaw
        }
      } catch (error) {
        // ✅ ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
        day1CheckinDate = day1CheckinDateRaw
      }
    }
    
    // ✅ ถ้า Day 1 เช็คอินในวันนี้แล้ว → return false ทันที (ไม่ต้องเช็คเงื่อนไขอื่น)
    // ✅ สำคัญ: ตรวจสอบก่อน openTodayIndex เพื่อป้องกันการเช็คอิน Day 2 ในวันเดียวกัน
    if (day1IsChecked && day1CheckinDate && day1CheckinDate === serverDateKey) {
      return false
    }
    
    // ✅ ถ้า openTodayIndex < 0 → ไม่มีวันที่สามารถเช็คอินได้
    if (openTodayIndex < 0) {
      return false
    }
    
    // ✅ ถ้า openTodayIndex === 0 (Day 1) → สามารถเช็คอินได้ (ถ้าไม่เช็คอินในวันนี้แล้ว - ตรวจสอบแล้วข้างบน)
    if (openTodayIndex === 0) {
      return true
    }
    
    // ✅ ถ้า openTodayIndex > 0 (Day 2, 3, ...) → ต้องเช็คว่าเช็คอินวันก่อนหน้าไปแล้วในวันอื่น
    if (openTodayIndex > 0) {
      const prevDayIndex = openTodayIndex - 1
      // ✅ ใช้ checked state เป็นหลัก (update ทันที)
      const prevDayCheckinItem = checkinData?.[prevDayIndex] || checkinData?.[String(prevDayIndex)] || checkinData?.[`${prevDayIndex}`]
      const prevDayIsChecked = checked?.[prevDayIndex] || (
        prevDayCheckinItem && (
          prevDayCheckinItem === true || 
          (typeof prevDayCheckinItem === 'object' && prevDayCheckinItem.checked === true)
        )
      )
      
      if (!prevDayIsChecked) {
        return false
      }
      
      // ✅ เช็ควันที่เช็คอินวันก่อนหน้า
      let prevDayCheckinDateRaw: string | null = checkinDates[prevDayIndex] || (
        prevDayCheckinItem && typeof prevDayCheckinItem === 'object' && prevDayCheckinItem.date
          ? prevDayCheckinItem.date
          : null
      )
      
      // ✅ แปลง prevDayCheckinDate เป็น date key (รองรับทั้ง ISO string และ date key)
      let prevDayCheckinDate: string | null = null
      if (prevDayCheckinDateRaw) {
        try {
          // ✅ ถ้าเป็น ISO string ให้แปลงเป็น date key
          if (prevDayCheckinDateRaw.includes('T') || prevDayCheckinDateRaw.includes('Z')) {
            prevDayCheckinDate = dkey(new Date(prevDayCheckinDateRaw))
          } else {
            // ✅ ถ้าเป็น date key อยู่แล้ว ใช้เลย
            prevDayCheckinDate = prevDayCheckinDateRaw
          }
        } catch (error) {
          // ✅ ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
          prevDayCheckinDate = prevDayCheckinDateRaw
        }
      }
      
      if (prevDayCheckinDate && prevDayCheckinDate < serverDateKey) {
        // ✅ เช็คอินวันก่อนหน้าไปแล้วในวันอื่น → สามารถเช็คอินได้
        return true
      }
      
      // ✅ เช็คอินวันก่อนหน้าในวันนี้ (หรือไม่มี date) → ไม่สามารถเช็คอินได้
      return false
    }
    
    return false
  }, [openTodayIndex, busy, rewards.length, endDate, serverDateKey, checkinDates, checkinData, checked])

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


  // ✅ บันทึกเหตุการณ์ลง PostgreSQL answers
  async function logAction(gameId: string, user: string, payload: any) {
    // ✅ ใช้ server time สำหรับ timestamp เพื่อป้องกันการปรับเวลา
    try {
      const serverTime = await getServerTime()
      const serverDate = dkey(new Date(serverTime))
      
      // ✅ สร้าง answer text จาก payload (สำหรับแสดงในประวัติ)
      const actionText = payload.action || 'action'
      const answerText = `${actionText}${payload.itemIndex !== undefined ? ` (item ${payload.itemIndex})` : ''}${payload.price !== undefined ? ` - ${payload.price} ${coinName}` : ''}`
      
      await postgresqlAdapter.submitAnswer(gameId, {
        userId: user,
        answer: answerText, // ✅ ส่ง answer string ด้วย
        ts: serverTime,
        serverDate: serverDate,
        ...payload
      })
    } catch (error) {
      console.error('Error logging action:', error)
    }
  }




const doCheckin = async () => {
  // ✅ ตรวจสอบว่า canCheckin = true ก่อนทำการเช็คอิน
  if (!canCheckin) {
    console.warn('Cannot checkin: canCheckin is false')
    return
  }
  
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
    
    // ✅ ตรวจสอบเพิ่มเติม: เปรียบเทียบกับวันที่เช็คอินล่าสุด (ถ้ามี) จาก PostgreSQL
    // ✅ เพื่อตรวจสอบว่า currentServerDateKey ไม่ผิดปกติ
    try {
      const checkins = await postgresqlAdapter.getCheckins(gameId, user, rewards.length)
      
      // ✅ หาวันที่เช็คอินล่าสุด
      let latestCheckinDate: string | null = null
      for (let i = 0; i < rewards.length; i++) {
        const checkinData = checkins[i]
        if (checkinData && checkinData.date) {
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
      // ✅ อ่านสถานะเช็คอินจาก PostgreSQL
    try {
      const checkinStatus = await postgresqlAdapter.getCheckinStatus(gameId, user, i)
      
      // ✅ ตรวจสอบเฉพาะ checked === true และ date เป็นวันเดียวกันเท่านั้น
      if (checkinStatus && checkinStatus.checked === true) {
        // ถ้าเช็คอินไปแล้ว ข้าม
        continue
      }
    } catch (error) {
      console.error('Error checking checkin status from PostgreSQL:', error)
      // ✅ สำหรับ Day 1 (i === 0): ถ้าอ่านไม่ได้ ให้ดำเนินการต่อ (ไม่ข้าม) เพื่อให้สามารถเช็คอินได้
      // ✅ สำหรับ Day อื่นๆ: ถ้าอ่านไม่ได้ ให้ข้ามวันนี้ (เพื่อความปลอดภัย)
      if (i === 0) {
        // Day 1: ดำเนินการต่อ (ไม่ข้าม) เพื่อให้สามารถเช็คอินได้
      } else {
        // Day อื่นๆ: ข้ามวันนี้
        continue
      }
    }
    
    // ✅ ถ้ายังไม่เช็คอินวันนี้ (index i) ให้ตรวจสอบว่า:
    // 1. ถ้าเป็นวันแรก (i === 0) ต้องตรวจสอบว่ายังไม่เคยเช็คอินวันแรกมาก่อน (เพื่อป้องกันการเช็คอินล่วงหน้า)
    // 2. ถ้าไม่ใช่วันแรก (i > 0) ต้องเช็คอินวันก่อนหน้าแล้ว และต้องเช็คว่าวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน
    if (i === 0) {
      // DAY 1: ตรวจสอบว่ายังไม่เคยเช็คอินวันแรกมาก่อน (เพื่อป้องกันการเช็คอินล่วงหน้า)
      // ✅ อ่านวันที่เช็คอินวันแรกจาก PostgreSQL (ถ้ามี)
      try {
        const firstDayCheckin = await postgresqlAdapter.getCheckinStatus(gameId, user, 0)
        
        if (firstDayCheckin && firstDayCheckin.date) {
          // ✅ ถ้ามีวันที่เช็คอินวันแรก ตรวจสอบว่า currentServerDateKey ไม่น้อยกว่าวันที่เช็คอินวันแรก
          const firstDayDate = new Date(firstDayCheckin.date + 'T00:00:00')
          const currentDate = new Date(currentServerDateKey + 'T00:00:00')
          const daysDiff = Math.floor((currentDate.getTime() - firstDayDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // ✅ ถ้า currentServerDateKey น้อยกว่าวันที่เช็คอินวันแรก แสดงว่าอาจมีการปรับเวลา
          if (daysDiff < 0) {
            console.warn('Current server date is before first checkin date:', {
              firstDayDate: firstDayCheckin.date,
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
      // ✅ อ่านสถานะเช็คอินวันก่อนหน้าจาก PostgreSQL
      try {
        const prevDayCheckin = await postgresqlAdapter.getCheckinStatus(gameId, user, i - 1)
        
        // ✅ ตรวจสอบจาก PostgreSQL
        if (prevDayCheckin && prevDayCheckin.checked === true) {
          const prevDayCheckinDateRaw = prevDayCheckin.date || null
          
          // ✅ แปลง prevDayCheckinDate เป็น date key (รองรับทั้ง ISO string และ date key)
          let prevDayCheckinDate: string | null = null
          if (prevDayCheckinDateRaw) {
            try {
              // ✅ ถ้าเป็น ISO string ให้แปลงเป็น date key
              if (prevDayCheckinDateRaw.includes('T') || prevDayCheckinDateRaw.includes('Z')) {
                prevDayCheckinDate = dkey(new Date(prevDayCheckinDateRaw))
              } else {
                // ✅ ถ้าเป็น date key อยู่แล้ว ใช้เลย
                prevDayCheckinDate = prevDayCheckinDateRaw
              }
            } catch (error) {
              // ✅ ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
              prevDayCheckinDate = prevDayCheckinDateRaw
            }
          }
          
          // ✅ สำคัญ: ต้องเช็คว่าวันที่เช็คอินวันก่อนหน้า < วันปัจจุบัน (ไม่ใช่ = วันปัจจุบัน)
          if (prevDayCheckinDate) {
            // ✅ ถ้ามีวันที่เช็คอินวันก่อนหน้า ต้องเช็คว่า < วันปัจจุบัน (ใช้ server date)
            if (prevDayCheckinDate < currentServerDateKey) {
              // เช็คอินวันก่อนหน้าไปแล้วในวันอื่น (ไม่ใช่วันนี้) สามารถเช็คอินได้
              currentOpenTodayIndex = i
              break
            } else {
              // ✅ เช็คอินวันก่อนหน้าในวันนี้ (หรืออนาคต) ต้องรอจนกว่าจะถึงวันถัดไป
              // ✅ ป้องกันการเช็คอิน Day 2 ในวันเดียวกันกับ Day 1
              onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันก่อนหน้าในวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
              setBusy(false)
              return
            }
          } else {
            // ✅ ถ้ายังไม่มีวันที่เช็คอินวันก่อนหน้า แต่เช็คอินวันก่อนหน้าแล้ว (checked === true)
            // ✅ ให้ถือว่าเช็คอินวันก่อนหน้าในวันนี้ (เพื่อความปลอดภัย - ป้องกันการเช็คอิน Day 2 ในวันเดียวกัน)
            // ✅ ไม่ให้เช็คอิน Day 2 ในวันเดียวกันกับ Day 1
            onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันก่อนหน้าในวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
            setBusy(false)
            return
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
        // ✅ ตรวจสอบว่า Day 1 เช็คอินไปแล้วหรือไม่
        // ✅ รองรับทั้ง number key และ string key
        const day1CheckinItem = checkinData?.[0] || checkinData?.['0'] || checkinData?.[`0`]
        const day1Checked = checked?.[0] || (day1CheckinItem && (
          day1CheckinItem === true || 
          (typeof day1CheckinItem === 'object' && day1CheckinItem.checked === true)
        ))
        
        if (day1Checked) {
          // ✅ Day 1 เช็คอินไปแล้ว แต่ไม่สามารถเช็คอิน Day ถัดไปได้
          onInfo?.('ไม่สามารถเช็คอินได้', 'กรุณาเช็คอินวันก่อนหน้าให้เสร็จก่อน')
        } else {
          // ✅ Day 1 ยังไม่เช็คอิน แต่ไม่สามารถเช็คอินได้ (อาจเป็นเพราะ error หรือเงื่อนไขอื่น)
          onInfo?.('ไม่สามารถเช็คอินได้', 'เกิดข้อผิดพลาดในการตรวจสอบการเช็คอิน กรุณาลองใหม่อีกครั้ง')
        }
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
      console.warn('Cannot checkin: previous day not checked', { idx, checked, previousDayIndex: idx - 1 })
      onInfo?.('ไม่สามารถเช็คอินได้', 'กรุณาเช็คอินวันก่อนหน้าให้เสร็จก่อน')
      setBusy(false)
      return
    }
  } else if (idx === 0) {
    // ✅ Day 1: ไม่ต้องเช็ควันที่ อนุญาตได้เสมอ (ถ้าอยู่ในช่วงกิจกรรม)
  } else {
    // ✅ idx < 0: ไม่ควรเกิดขึ้น แต่ถ้าเกิดขึ้นให้แสดง error
    console.error('[doCheckin] Invalid idx:', { idx, currentOpenTodayIndex })
    onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบวันที่จะเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
    setBusy(false)
    return
  }
  // สำหรับ DAY 1 (idx === 0): ไม่ต้องเช็ควันที่ อนุญาตได้เสมอ (ถ้าอยู่ในช่วงกิจกรรม)

  const before = Number(hcoin || 0)
  // ✅ ใช้ server time สำหรับ timestamp เพื่อป้องกันการปรับเวลา
  const ts = await getServerTime()
  
  // ✅ นับจำนวนวันที่เช็คอินแล้วจาก PostgreSQL โดยตรง (ไม่ใช้ local state)
  let countBefore = 0
  try {
    const checkins = await postgresqlAdapter.getCheckins(gameId, user, rewards.length)
    for (let i = 0; i < rewards.length; i++) {
      const checkinData = checkins[i]
      const isChecked = checkinData && checkinData.checked === true
      if (isChecked) countBefore++
    }
  } catch (error) {
    console.error('Error counting checkins from PostgreSQL:', error)
    // ถ้าอ่านไม่ได้ ให้ใช้ local state เป็น fallback
    for (let i = 0; i < rewards.length; i++) {
      if (checked?.[i]) countBefore++
    }
  }

  try {
    // ✅ อ่านข้อมูล startDate/endDate จาก game data (PostgreSQL)
    // (เพื่อตรวจสอบวันที่อีกครั้ง)
    let dbStartDate: string | null = startDate || null
    let dbEndDate: string | null = endDate || null
    
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
      // ✅ ตรวจสอบว่าการเช็คอินวันก่อนหน้าแล้ว (อ่านจาก PostgreSQL)
      try {
        const prevDayCheckin = await postgresqlAdapter.getCheckinStatus(gameId, user, idx - 1)
        
        if (!prevDayCheckin || !prevDayCheckin.checked) {
          console.warn('Cannot checkin: previous day not checked', { idx })
          onInfo?.('ไม่สามารถเช็คอินได้', 'กรุณาเช็คอินวันก่อนหน้าให้เสร็จก่อน')
          setBusy(false)
          return
        }
        
        // ✅ ตรวจสอบวันที่เช็คอินวันก่อนหน้า
        const prevDayCheckinDateRaw = prevDayCheckin.date || null
        
        // ✅ แปลง prevDayCheckinDate เป็น date key (รองรับทั้ง ISO string และ date key)
        let prevDayCheckinDate: string | null = null
        if (prevDayCheckinDateRaw) {
          try {
            // ✅ ถ้าเป็น ISO string ให้แปลงเป็น date key
            if (prevDayCheckinDateRaw.includes('T') || prevDayCheckinDateRaw.includes('Z')) {
              prevDayCheckinDate = dkey(new Date(prevDayCheckinDateRaw))
            } else {
              // ✅ ถ้าเป็น date key อยู่แล้ว ใช้เลย
              prevDayCheckinDate = prevDayCheckinDateRaw
            }
          } catch (error) {
            // ✅ ถ้าแปลงไม่ได้ ให้ใช้ค่าเดิม
            prevDayCheckinDate = prevDayCheckinDateRaw
          }
        }
        
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
      
      // ✅ ตรวจสอบว่าวันนี้ยังไม่เช็คอินแล้ว (อ่านจาก PostgreSQL) - สำคัญมาก!
      // ✅ ต้องตรวจสอบก่อน transaction เพื่อป้องกัน race condition
      // ✅ ตรวจสอบด้วย finalServerDate ที่ได้จาก server
      try {
        const currentDayCheckin = await postgresqlAdapter.getCheckinStatus(gameId, user, idx)
        
        // ✅ ตรวจสอบเฉพาะ checked === true
        if (currentDayCheckin && currentDayCheckin.checked === true) {
          // ✅ ถ้ามี date และเป็นวันเดียวกันกับ finalServerDate แสดงว่าเช็คอินวันนี้แล้ว
          // ✅ ถ้าไม่มี date แต่ checked === true แสดงว่าเช็คอินไปแล้ว (ข้อมูลเก่า)
          if (currentDayCheckin.date) {
            const isSameDate = currentDayCheckin.date === finalServerDate
            if (isSameDate) {
              console.warn('Already checked in for day (PostgreSQL):', idx, { 
                currentDayCheckin,
                finalServerDate 
              })
              onInfo?.('คุณเช็คอินวันนี้แล้ว', 'คุณได้เช็คอินวันนี้เรียบร้อยแล้ว')
              setBusy(false)
              return
            }
          } else {
            // ✅ ถ้า checked === true แต่ไม่มี date (ข้อมูลเก่า) ให้ตรวจสอบอีกครั้งใน transaction
            // ✅ แต่ถ้าเป็น DAY 1 (idx === 0) และ checked === true แสดงว่าเช็คอินไปแล้ว
            if (idx === 0) {
              console.warn('Day 1 already checked in (no date):', idx, { 
                currentDayCheckin,
                finalServerDate 
              })
              onInfo?.('คุณเช็คอินวันนี้แล้ว', 'คุณได้เช็คอินวันนี้เรียบร้อยแล้ว')
              setBusy(false)
              return
            }
          }
        }
      } catch (error) {
        console.error('Error checking current day checkin status:', error)
        // ถ้าอ่านไม่ได้ ให้ดำเนินการต่อ (จะตรวจสอบใน transaction อีกครั้ง)
      }
      
      // ✅ ตรวจสอบเพิ่มเติม: เปรียบเทียบกับวันที่เช็คอินวันก่อนหน้า (ถ้ามี)
      if (idx > 0) {
        try {
          const prevDayCheckin = await postgresqlAdapter.getCheckinStatus(gameId, user, idx - 1)
          const prevDayCheckinDate = prevDayCheckin?.date || null
          
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
        const prevDayCheckin = await postgresqlAdapter.getCheckinStatus(gameId, user, idx - 1)
        const prevDayCheckinDate = prevDayCheckin?.date || null
        
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
    
    // ✅ ใช้ PostgreSQL API หรือ Firestore transaction เพื่อป้องกัน race condition
    // ✅ สร้าง unique key สำหรับแต่ละ transaction โดยใช้ timestamp + random
    const uniqueKey = `${ts}_${Math.random().toString(36).substring(2, 9)}`
    
    // ✅ ใช้ PostgreSQL adapter สำหรับ check-in transaction
    let checkinResult: any
    try {
      checkinResult = await postgresqlAdapter.checkin(
        gameId,
        user,
        idx,
        finalServerDate,
        uniqueKey
      )
    } catch (error) {
      console.error('Error checking in with PostgreSQL:', error)
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
      setBusy(false)
      return
    }
    
    // ✅ ตรวจสอบผลลัพธ์
    if (!checkinResult.success) {
      if (checkinResult.error === 'ALREADY_CHECKED_IN' || checkinResult.error === 'ALREADY_CHECKED_IN_TODAY') {
        console.warn('Already checked in for day:', idx)
        onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
      } else if (checkinResult.error === 'PREVIOUS_DAY_NOT_CHECKED') {
        console.warn('Previous day not checked in:', idx)
        onInfo?.('ไม่สามารถเช็คอินได้', 'คุณต้องเช็คอินวันก่อนหน้าก่อน')
      } else if (checkinResult.error === 'PREVIOUS_DAY_CHECKED_IN_TODAY') {
        console.warn('Previous day checked in today:', idx)
        onInfo?.('ไม่สามารถเช็คอินได้', 'คุณเช็คอินวันก่อนหน้าในวันนี้แล้ว กรุณารอจนกว่าจะถึงวันถัดไป')
      } else {
        console.warn('Checkin transaction failed:', checkinResult.error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
      }
      setBusy(false)
      return
    }
    
    // ✅ ไม่ทำ optimistic update ที่นี่ - จะอัพเดทหลังจาก operations สำเร็จแล้ว
    // ✅ เพื่อป้องกัน UI เปลี่ยนก่อนที่การเช็คอินจะเสร็จสมบูรณ์

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
      
      // ✅ ตรวจสอบว่า amount เป็นค่าบวกและเป็นตัวเลขที่ถูกต้อง (ป้องกันการหัก HENGCOIN)
      if (!Number.isFinite(amt) || amt <= 0) {
        console.error('Invalid coin amount in check-in reward:', { idx, amount: r.amount, amt })
        onInfo?.('เกิดข้อผิดพลาด', 'จำนวน HENGCOIN ที่จะได้รับไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ')
        setBusy(false)
        return
      }
      
      if (amt > 0) {
        try {
          // ✅ เพิ่ม HENGCOIN ด้วย PostgreSQL
          const result = await postgresqlAdapter.addUserCoins(user, amt, false)
          
          // ✅ ตรวจสอบผลลัพธ์
          if (!result.success) {
            console.warn('Coin transaction failed:', { user, amt, idx, error: result.error })
            
            // ✅ Rollback: PostgreSQL handles rollback automatically
            // ✅ Rollback local state only
            try {
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
              console.error('Error rolling back local state after coin transaction failure:', rollbackError)
            }
            
            onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN ได้ กรุณาลองใหม่อีกครั้ง')
            setBusy(false)
            return
          }
          
          // ✅ ใช้ balance ใหม่จาก result
          const after = result.newBalance || (before + amt)
          
          // ✅ อัพเดท UI หลังจาก operations สำเร็จแล้ว (ไม่ใช่ optimistic update)
          // ✅ อัพเดท checked state และ checkinDates
          setChecked(prev => ({ ...prev, [idx]: true }))
          setCheckinDates(prev => ({ ...prev, [idx]: finalServerDate }))
          
          // ✅ อัพเดท hcoin
          setHcoin(after)
          
          // ✅ WebSocket will update user data and checkin data automatically
          // No need to manually refresh - WebSocket hooks handle it

          // ✅ แสดง popup ทันที (ไม่ต้องรอ log)
          setSuccess({
            amt,
            dayIndex: idx + 1,
            checked: countBefore + 1,
            total: rewards.length,
            type: 'coin',
          })
          
          // ✅ log - ใช้ PostgreSQL
          try {
            await postgresqlAdapter.submitAnswer(gameId, {
              userId: user,
              action: 'checkin',
              dayIndex: idx + 1,
              amount: amt,
              balanceBefore: before,
              balanceAfter: after,
              serverDate: finalServerDate,
              ts: ts
            })
          } catch (err) {
            console.error('Error logging checkin action:', err)
            // ไม่ต้อง rollback เพราะ transaction สำเร็จแล้ว
          }
        } catch (coinError: any) {
          console.error('Error adding coins:', coinError)
          
          // ✅ Rollback: PostgreSQL handles rollback automatically
          // ✅ Rollback local state only
          try {
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
            console.error('Error rolling back local state after coin error:', rollbackError)
          }
          
          onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN ได้ กรุณาลองใหม่อีกครั้ง')
          setBusy(false)
          return
        }
      }
    } else {
      // ✅ CODE: ใช้ PostgreSQL API เพื่อแจกโค้ดทีละโค้ด
      let chosenCode: string | null = null

      try {
        // ✅ แจกโค้ด - ใช้ PostgreSQL backend endpoint (จัดการ cursor และ claimedBy อัตโนมัติ)
        // ✅ ส่ง idx (0-based) ไปที่ backend ซึ่งจะใช้เป็น dayIndex
        const result = await postgresqlAdapter.claimDailyRewardCode(gameId, user, idx)
        
        if (typeof result === 'string' && result !== 'ALREADY' && result !== 'EMPTY') {
          chosenCode = result
        } else if (result === 'ALREADY') {
          // เคยได้โค้ดไปแล้ว - ดึงโค้ดเดิมมาแสดงจาก answers
          const existingAnswers = await postgresqlAdapter.getAnswers(gameId, 100)
          const userAnswer = existingAnswers
            .filter((a: any) => a.userId === user && a.code && a.action === 'checkin' && a.dayIndex === idx + 1)
            .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
          
          if (userAnswer?.code) {
            chosenCode = userAnswer.code
          } else {
            chosenCode = null
          }
        } else if (result === 'EMPTY') {
          chosenCode = null
        } else {
          chosenCode = null
        }
      } catch (error) {
        console.error(`[CheckinGame] Error claiming daily reward code for day ${idx + 1}:`, error)
        chosenCode = null
      }

      if (!chosenCode) {
        // ✅ สำคัญ: ถ้าการแจกโค้ดล้มเหลว ต้อง rollback การเช็คอิน
        // ✅ เพื่อป้องกันกรณีที่ user เช็คอินสำเร็จแล้วแต่ไม่ได้โค้ด
        // Note: PostgreSQL checkin is atomic, so rollback is handled by the backend
        try {
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
          console.error('Error rolling back checkin after code failure:', rollbackError)
        }
        
        if (chosenCode === null) {
          onInfo?.('โค้ดหมดแล้ว', 'โค้ดสำหรับวันนี้หมดแล้ว')
        } else {
          onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถแจกโค้ดได้ กรุณาลองใหม่อีกครั้ง')
        }
        setBusy(false)
        return
      }

      // ✅ อัพเดท UI หลังจาก operations สำเร็จแล้ว (ไม่ใช่ optimistic update)
      // ✅ อัพเดท checked state และ checkinDates
      setChecked(prev => ({ ...prev, [idx]: true }))
      setCheckinDates(prev => ({ ...prev, [idx]: finalServerDate }))
      
      // ✅ WebSocket will update checkin data automatically
      // No need to manually refresh - WebSocket hook handles it
      
      // ✅ แสดง popup ทันที (ไม่ต้องรอ log)
      setSuccess({
        amt: 0,
        dayIndex: idx + 1,
        checked: countBefore + 1,
        total: rewards.length,
        type: 'code',
        code: chosenCode,
      })
      
      // ✅ log แบบ non-blocking (ไม่ต้องรอ) - ใช้ PostgreSQL
      try {
        await postgresqlAdapter.submitAnswer(gameId, {
          userId: user,
          action: 'checkin',
          dayIndex: idx + 1,
          code: chosenCode,
          amount: 0,
          balanceBefore: before,
          balanceAfter: before,
          serverDate: finalServerDate,
          ts: ts
        })
      } catch (err) {
        console.error('Error logging checkin action:', err)
        // ไม่ต้อง rollback เพราะ transaction สำเร็จแล้ว
      }
    }

    // ✅ ตรวจสอบว่าผู้ใช้เช็คอินครบทุกวันหรือไม่ และให้รางวัล
    const countAfter = countBefore + 1
    const allChecked = countAfter === rewards.length
    const completeReward = game?.checkin?.completeReward
    
    if (allChecked && completeReward && !completeRewardClaimed) {
      // ✅ ใช้ PostgreSQL API หรือ Firestore transaction เพื่อป้องกัน race condition
      // ✅ สร้าง unique key สำหรับแต่ละ transaction
      const uniqueKey = `${ts}_${Math.random().toString(36).substring(2, 9)}`
      
      // ✅ ใช้ PostgreSQL adapter สำหรับ complete reward transaction
      let claimedResult: any
      try {
        claimedResult = await postgresqlAdapter.claimCompleteReward(
          gameId,
          user,
          uniqueKey
        )
      } catch (error) {
        console.error('Error claiming complete reward with PostgreSQL:', error)
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถรับรางวัลครบทุกวันได้ กรุณาลองใหม่อีกครั้ง')
        setBusy(false)
        return
      }
      
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
      
      // ✅ PostgreSQL handles verification and rollback automatically
      
      // ✅ ยังไม่เคยได้รับ ให้รางวัล
      if (completeReward.kind === 'coin') {
        const amt = Number(completeReward.value ?? 0)
        
        // ✅ ตรวจสอบว่า amount เป็นค่าบวกและเป็นตัวเลขที่ถูกต้อง (ป้องกันการหัก HENGCOIN)
        if (!Number.isFinite(amt) || amt <= 0) {
          console.error('Invalid coin amount in complete reward:', { amount: completeReward.value, amt })
          onInfo?.('เกิดข้อผิดพลาด', 'จำนวน HENGCOIN รางวัลครบทุกวันไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ')
          setBusy(false)
          return
        }
        
        if (amt > 0) {
          try {
            // ✅ เพิ่ม HENGCOIN ด้วย PostgreSQL
            const result = await postgresqlAdapter.addUserCoins(user, amt, false)
            
            // ✅ ตรวจสอบผลลัพธ์
            if (!result.success) {
              console.warn('Complete reward coin transaction failed:', { user, amt })
              
              // ✅ Rollback: PostgreSQL handles rollback automatically
              try {
                setCompleteRewardClaimed(false)
              } catch (rollbackError) {
                console.error('Error rolling back complete reward after coin transaction failure:', rollbackError)
              }
              
              onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN รางวัลครบทุกวันได้ กรุณาลองใหม่อีกครั้ง')
              setBusy(false)
              return
            }
            
            // ✅ บันทึกว่าได้รับแล้ว (ใช้ balance จาก result แทนการอ่านใหม่)
            setCompleteRewardClaimed(true)
            setCompleteRewardCode(null)
            
            // ✅ อัพเดท hcoin ทันที (optimistic update)
            const afterCompleteReward = result.newBalance || (Number(hcoin || 0) + amt)
            setHcoin(afterCompleteReward)
            
            // ✅ WebSocket will update user data automatically
            // No need to manually refresh - WebSocket hook handles it
            
            // ✅ log - ใช้ PostgreSQL
            try {
              const serverTime = await getServerTime()
              const serverDate = dkey(new Date(serverTime))
              const beforeCompleteReward = Number(hcoin || 0)
              await postgresqlAdapter.submitAnswer(gameId, {
                userId: user,
                action: 'checkin-complete',
                amount: amt,
                balanceBefore: beforeCompleteReward,
                balanceAfter: afterCompleteReward,
                serverDate: serverDate,
                ts: serverTime
              })
            } catch (err) {
              console.error('Error logging complete reward action:', err)
            }
          
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
            
            // ✅ Rollback: PostgreSQL handles rollback automatically
            try {
              setCompleteRewardClaimed(false)
            } catch (rollbackError) {
              console.error('Error rolling back complete reward after coin error:', rollbackError)
            }
            
            onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่ม HENGCOIN รางวัลครบทุกวันได้ กรุณาลองใหม่อีกครั้ง')
            setBusy(false)
            return
          }
        }
      } else {
        // ✅ CODE: ใช้ PostgreSQL API เพื่อแจกโค้ดทีละโค้ด
        let chosenCode: string | null = null

        try {
          // ✅ แจกโค้ด - ใช้ PostgreSQL backend endpoint (จัดการ cursor และ claimedBy อัตโนมัติ)
          const result = await postgresqlAdapter.claimCompleteRewardCode(gameId, user)
          
          if (typeof result === 'string' && result !== 'ALREADY' && result !== 'EMPTY') {
            chosenCode = result
          } else if (result === 'ALREADY') {
            // เคยได้โค้ดไปแล้ว - ดึงโค้ดเดิมมาแสดงจาก answers
            const existingAnswers = await postgresqlAdapter.getAnswers(gameId, 100)
            const userAnswer = existingAnswers
              .filter((a: any) => a.userId === user && a.code && a.action === 'checkin-complete')
              .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
            
            if (userAnswer?.code) {
              chosenCode = userAnswer.code
            } else {
              chosenCode = null
            }
          } else if (result === 'EMPTY') {
            chosenCode = null
          }
        } catch (error) {
          console.error('Error claiming complete reward code:', error)
          chosenCode = null
        }

        if (!chosenCode) {
          onInfo?.('โค้ดหมดแล้ว', 'โค้ดรางวัลครบทุกวันหมดแล้ว')
          setBusy(false)
          return
        }

        // ✅ บันทึกว่าได้รับแล้ว
        setCompleteRewardClaimed(true)
        setCompleteRewardCode(chosenCode)
        
        // ✅ log - ใช้ PostgreSQL
        try {
          const serverTime = await getServerTime()
          const serverDate = dkey(new Date(serverTime))
          await postgresqlAdapter.submitAnswer(gameId, {
            userId: user,
            action: 'checkin-complete',
            code: chosenCode,
            serverDate: serverDate,
            ts: serverTime
          })
        } catch (err) {
          console.error('Error logging complete reward code action:', err)
        }
        
        // แสดง popup
        setSuccess({
          amt: 0,
          dayIndex: rewards.length,
          checked: countAfter,
          total: rewards.length,
          type: 'code',
          code: chosenCode,
        })
      }
    } else {
      setCompleteRewardClaimed(true)
    }
  } catch (error: any) {
    console.error('Checkin error:', error)
    
    // ✅ ตรวจสอบว่าเป็น authentication error หรือไม่
    const isAuthError = error?.message?.includes('auth') || 
                       error?.message?.includes('session') ||
                       error?.status === 401 ||
                       error?.status === 403
    
    if (isAuthError) {
      console.error('Authentication error during checkin:', error)
      onInfo?.('เกิดข้อผิดพลาด', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
      // ✅ ไม่ redirect อัตโนมัติ - ให้ user ตัดสินใจเอง
    } else {
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
    }
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
        {(game?.checkin?.features?.dailyReward === true) && (
          <VipOrangeCard onClick={() => setOpenCheckin(true)} />
        )}
        {/* ✅ แสดง Mini Slot ตามการตั้งค่า */}
        {(game?.checkin?.features?.miniSlot === true) && (
          <VipGreenCard onClick={() => setOpenSlot(true)} />
        )}
        {/* ✅ แสดง Coupon Shop ตามการตั้งค่า */}
        {(game?.checkin?.features?.couponShop === true) && (
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
          // ✅ ตรวจสอบสถานะ checkin จากหลายแหล่ง
          // ✅ รองรับทั้ง number key และ string key (เช่น "0", "1", "2")
          const checkinItem = checkinData?.[i] || checkinData?.[String(i)] || checkinData?.[`${i}`]
          const checkedFromState = !!checked[i]
          const checkedFromData = !!(checkinItem && (
            checkinItem === true || 
            (typeof checkinItem === 'object' && checkinItem.checked === true)
          ))
          const done = checkedFromState || checkedFromData
          
          // ✅ Debug: Log checkin status (only for first few days to avoid spam)
          if (i < 4) {
            console.log(`[CheckinGame] Day ${i + 1} checkin status:`, {
              dayIndex: i,
              checkinItem,
              checkedFromState,
              checkedFromData,
              done,
              checkedState: checked[i],
              checkinDataExists: !!checkinData,
              checkinDataLoading,
              checkinDataKeys: checkinData ? Object.keys(checkinData) : [],
              checkinDataValue: checkinData ? (checkinData[i] || checkinData[String(i)] || checkinData[`${i}`]) : null
            })
          }

          // ✅ ตรวจสอบสถานะตามลำดับที่เช็คอิน
          // - ถ้าเช็คอินแล้ว = ไม่แสดงข้อความ
          // - ถ้ายังไม่เช็คอินและเป็นวันแรกที่สามารถเช็คอินได้ = "วันนี้เช็คอินได้"
          // - ถ้ายังไม่เช็คอินและไม่สามารถเช็คอินได้ (ยังไม่เช็คอินวันก่อนหน้า) = "รอเช็คอินวันก่อนหน้า"
          // - ถ้าเช็คอินวันก่อนหน้าแล้วในวันนี้ = "เช็คอินได้ในวันถัดไป"
          let canCheckinToday = false
          let waitingForPrevious = !done && i > 0 && !checked?.[i - 1]
          let canCheckinLater = false
          let prevDayCheckedInToday = false
          
          // ✅ ตรวจสอบว่าเช็คอินวันนี้ได้หรือไม่
          if (!done) {
            if (i === 0) {
              // ✅ Day 1: ตรวจสอบว่า canCheckin = true หรือไม่
              if (openTodayIndex === i && canCheckin) {
                canCheckinToday = true
                canCheckinLater = false
              } else {
                canCheckinToday = false
                canCheckinLater = false
              }
            } else {
              // ✅ Day 2, 3, ... : ตรวจสอบว่าเช็คอินได้หรือไม่
              // ✅ ถ้า openTodayIndex === i และ canCheckin = true → แสดง "วันนี้เช็คอินได้"
              // ✅ ถ้า openTodayIndex !== i หรือ canCheckin = false → แสดง "เช็คอินได้ในวันถัดไป"
              if (openTodayIndex === i && canCheckin) {
                canCheckinToday = true
                canCheckinLater = false
              } else {
                // ✅ ตรวจสอบว่าวันก่อนหน้าเช็คอินแล้วหรือยัง
                // ✅ รองรับทั้ง number key และ string key
                const prevDayIndex = i - 1
                const prevDayCheckinData = checkinData?.[prevDayIndex] || checkinData?.[String(prevDayIndex)] || checkinData?.[`${prevDayIndex}`]
                const prevDayIsChecked = checked?.[prevDayIndex] || (
                  prevDayCheckinData && (
                    prevDayCheckinData === true || 
                    (typeof prevDayCheckinData === 'object' && prevDayCheckinData.checked === true)
                  )
                )
                
                if (prevDayIsChecked) {
                  // ✅ เช็คอินวันก่อนหน้าแล้ว → แสดง "เช็คอินได้ในวันถัดไป" (รอให้ถึงวันถัดไป)
                  canCheckinToday = false
                  canCheckinLater = true
                } else {
                  // ✅ ยังไม่เช็คอินวันก่อนหน้า → แสดง "รอเช็คอินวันก่อนหน้า"
                  canCheckinToday = false
                  canCheckinLater = false
                }
              }
            }
          }
          
          // ✅ ถ้ายังไม่เช็คอินวันก่อนหน้า → แสดง "เช็คอินได้ในวันถัดไป" (แทน "รอเช็คอินวันก่อนหน้า")
          if (waitingForPrevious) {
            canCheckinToday = false
            canCheckinLater = true
          }

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
                  {canCheckinLater && <div className="ci-note">เช็คอินได้ในวันถัดไป</div>}
                  {waitingForPrevious && !canCheckinLater && <div className="ci-note">รอเช็คอินวันก่อนหน้า</div>}
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

{(() => {
  const isDisabled = !canCheckin || lastDayChecked
  
  return (
    <button
      className={lastDayChecked ? 'btn-cta btn-cta-red' : !canCheckin ? 'btn-cta btn-cta-gray' : 'btn-cta btn-cta-green'}
      style={{
        marginTop: 14,
        ...(lastDayChecked ? {
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important',
          color: '#ffffff !important',
          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4) !important',
          cursor: 'not-allowed',
          opacity: 0.9,
          pointerEvents: 'none'
        } : !canCheckin ? {
          background: 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%) !important',
          color: '#ffffff !important',
          boxShadow: '0 4px 16px rgba(156, 163, 175, 0.3) !important',
          cursor: 'not-allowed',
          opacity: 0.9,
          pointerEvents: 'none'
        } : {
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important',
          color: '#ffffff !important',
          boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3) !important'
        })
      }}
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        doCheckin()
      }}
      disabled={isDisabled}
      aria-disabled={isDisabled}
    >
      {lastDayChecked
        ? 'เช็คอินครบทุกวันแล้ว'
        : endDate && serverDateKey > endDate
        ? 'กิจกรรมสิ้นสุดแล้ว'
        : busy
          ? 'กำลังเช็คอิน…'
          : canCheckin
            ? 'CHECKIN'
            : 'เช็คอินได้ในวันถัดไป'}
    </button>
  )
})()}

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
    items={(Array.isArray(game?.checkin?.coupon?.items) ? game.checkin.coupon.items : []).map((it: any, idx: number) => {
      // ✅ แปลง codes เป็น array (รองรับทั้ง array และ object)
      const codesToArray = (codes: any): string[] => {
        if (Array.isArray(codes)) return codes.filter(Boolean);
        if (codes && typeof codes === 'object') {
          return Object.keys(codes)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => String(codes[k] || ''))
            .filter(Boolean);
        }
        return [];
      };
      
      // ✅ ใช้ codes จาก game data โดยตรง (ไม่ต้องพึ่ง couponItemCodes state)
      const itemCodes = codesToArray(it?.codes);
      const stateCodes = Array.isArray(couponItemCodes[idx]) ? couponItemCodes[idx].filter(Boolean) : []
      // ✅ ใช้ codes ที่มีค่ามากกว่า (จาก game data หรือ state)
      const codes = itemCodes.length > 0 ? itemCodes : stateCodes
      
      return {
        title: typeof it?.title === 'string' ? it.title : '',
        rewardCredit: Number(it?.rewardCredit) || 0,
        price: Number(it?.price) || 0,
        codes: codes,
      }
    })}
    onRedeem={async (idx) => {
  const items = Array.isArray(game?.checkin?.coupon?.items) ? game.checkin.coupon.items : [];
  const item = items[idx];
  if (!item) return { ok:false, message:'ไม่พบรางวัลนี้' };

  const price = Number(item.price||0);
  const before = hcoin;                          // ✅ เก็บยอดก่อนหัก (สำหรับ log)
  if (before < price) return { ok:false, message:`${coinName} ไม่พอ` };

  // ✅ อนุญาตให้ user แลกซ้ำได้ (ไม่บล็อกการแลกซ้ำ)

    // ✅ แจกโค้ด - ใช้ PostgreSQL backend endpoint (จัดการ cursor และ claimedBy อัตโนมัติ)
    let chosenCode: string | null = null;

    try {
      // ✅ ลบ debug logs เพื่อเพิ่มความเร็ว
      const result = await postgresqlAdapter.claimCouponCode(gameId, user, idx)
      
      // ✅ ระบบใหม่: ไม่มี ALREADY แล้ว - user แลกได้หลายครั้ง
      if (typeof result === 'string' && result !== 'EMPTY') {
        chosenCode = result
      } else if (result === 'EMPTY') {
        chosenCode = null
      } else {
        chosenCode = null
      }
    } catch (error) {
      console.error('Error claiming coupon code:', error)
      return { ok: false, message: 'ไม่สามารถจองโค้ดได้' }
    }

    if (!chosenCode) {
      return { ok: false, message: 'โค้ดหมดแล้ว' }
    }

  // ✅ ตัดเหรียญจาก PostgreSQL
  let after = before;
  try {
    const result = await postgresqlAdapter.addUserCoins(user, -price, true); // allowNegative: true
    
    if (!result.success || result.newBalance === undefined) {
      // ✅ Rollback: PostgreSQL handles rollback automatically
      // Note: Cursor rollback is handled by backend if needed
      
      // ✅ แสดง error message ที่เหมาะสม
      if (result.error === 'INSUFFICIENT_BALANCE') {
        return { ok: false, message: `${coinName} ไม่พอสำหรับแลกรางวัลนี้` };
      }
      return { ok: false, message: 'ไม่สามารถตัดเหรียญได้' };
    }
    
    after = result.newBalance;
  } catch (error) {
    console.error('Error deducting coins:', error);
    return { ok: false, message: 'ไม่สามารถตัดเหรียญได้' };
  }

  // อัปเดต UI
  setHcoin(after);

  // ✅ บันทึกว่า user แลกรางวัลนี้ไปแล้ว - ใช้ answers log (PostgreSQL) แทน

  // ✅ LOG ประวัติ "แลกคูปอง" ลง answers/<gameId>/<ts> (fire-and-forget เพื่อความเร็ว)
  // ✅ ไม่ต้อง await เพื่อไม่ให้ block response - ให้แสดงโค้ดทันที
  logAction(gameId, user, {
    action: 'coupon-redeem',
    itemIndex: idx,
    price,
    code: chosenCode!,
    balanceBefore: before,
    balanceAfter: after,
  }).catch(err => console.error('Error logging action:', err)); // Silent error handling

  return { ok:true, code: chosenCode! };
}}

  />
</Overlay>
      {success && (
        <Overlay 
          open={true} 
          onClose={() => {
            // ✅ ป้องกันการ redirect เมื่อปิด popup
            setSuccess(null)
          }} 
          maxWidth={540} 
          closeOnBackdrop={false}
          closeOnEsc={true}
        >
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
