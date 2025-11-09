// src/components/CheckinGame.tsx
import React from 'react'
import { db } from '../services/firebase'
import { ref, onValue, runTransaction, set, get } from 'firebase/database'
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
const todayKey = dkey(new Date())

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


function coerceRewards(g: any): Reward[] {
  const arr = Array.isArray(g?.checkin?.rewards) ? g.checkin.rewards : null
  if (arr) {
    return arr.map((r: any) => {
      const date = r?.date || r?.availableOn || ''
      if ((r?.kind || r?.type) === 'code') {
        return { type: 'code', code: String(r?.value ?? r?.code ?? ''), date }
      }
      const amt = Number(r?.value ?? r?.amount ?? 0)
      return { type: 'coin', amount: Number.isFinite(amt) ? amt : 0, date }
    })
  }
  const days = Number(g?.checkin?.days ?? g?.checkinDays ?? 0) | 0
  return Array.from({ length: Math.max(0, days) }, () => ({ type: 'coin', amount: 0 }))
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
  const coinLogo = '/image/jewels.svg' // ใช้รูปเพชรเหมือนเดิมทั้งสามธีม
  
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
  
  
  const [busy, setBusy] = React.useState(false)
  const [openCheckin, setOpenCheckin] = React.useState(false)
  const [openSlot, setOpenSlot] = React.useState(false)
  const [userStatus, setUserStatus] = React.useState<string | null>(null)
  const [isUserActive, setIsUserActive] = React.useState(false)

  // slot config (จากหน้า CreateGame)
  const slotStartBet = Number(game?.checkin?.slot?.startBet ?? 1) || 1
  const slotWinRate = Math.max(0, Math.min(100, Number(game?.checkin?.slot?.winRate ?? 30) || 30))

  const [openCoupon, setOpenCoupon] = React.useState(false);
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

  // Update state when data changes
  React.useEffect(() => {
    if (hcoinData !== null) {
      const v = Number(hcoinData ?? 0)
      setHcoin(Number.isFinite(v) ? v : 0)
    }
  }, [hcoinData])

  React.useEffect(() => {
    if (checkinData !== null) {
      setChecked(checkinData ?? {})
    }
  }, [checkinData])

  React.useEffect(() => {
    if (completeRewardClaimedData !== null) {
      setCompleteRewardClaimed(completeRewardClaimedData === true)
    }
  }, [completeRewardClaimedData])

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
        // เขียน lastLogin เฉพาะครั้งแรก (ไม่ต้องเขียน username ซ้ำ)
        await set(ref(db, `checkins/${gameId}/${user}/lastLogin`), Date.now())
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

  // Helper functions and computed values
  const isDayOpen = (i: number) => {
    const d = rewards[i]?.date
    if (!d) return true
    return d === todayKey
  }

  // หา "วันนี้" ที่เปิดเช็คอิน และยังไม่ถูกเช็ค (ข้ามวันก่อนหน้าได้)
  const openTodayIndex = React.useMemo(() => {
    for (let i = 0; i < rewards.length; i++) {
      if (isDayOpen(i) && !checked?.[i]) return i
    }
    return -1
  }, [rewards, checked])


  // เช็คว่ากดเช็คอินได้ไหม (วันนี้เปิด + ยังไม่เช็ค + ไม่ busy)
  const canCheckin = openTodayIndex >= 0 && !busy && rewards.length > 0

  // (ตัวช่วยอื่น ถ้าใช้ใน JSX ปุ่ม/ข้อความ)
  const allChecked = rewards.length > 0 && rewards.every((_, i) => !!checked?.[i])

  // ✅ ตรวจสอบว่าวันสุดท้าย (วันที่มากที่สุด) ถูกเช็คอินแล้วหรือไม่
  const lastDayChecked = React.useMemo(() => {
    if (rewards.length === 0) return false
    
    // หาวันสุดท้าย (วันที่มากที่สุด)
    let lastDate = ''
    let lastIndex = -1
    
    for (let i = 0; i < rewards.length; i++) {
      const d = rewards[i]?.date
      if (d && d > lastDate) {
        lastDate = d
        lastIndex = i
      }
    }
    
    // ถ้าไม่พบวันที่ ให้ใช้ index สุดท้าย
    if (lastIndex === -1) {
      lastIndex = rewards.length - 1
    }
    
    // ตรวจสอบว่าวันสุดท้ายถูกเช็คอินแล้วหรือไม่
    return !!checked?.[lastIndex]
  }, [rewards, checked])

  const nextFutureDate = React.useMemo(() => {
    for (let i = 0; i < rewards.length; i++) {
      const d = rewards[i]?.date
      if (d && d > todayKey) return d
    }
    return null
  }, [rewards, todayKey])


  // บันทึกเหตุการณ์ลง answers/<gameId>/<date>/<timestamp> (ใช้ sharding ตามวันที่)
  async function logAction(gameId: string, user: string, payload: any) {
    const ts = Date.now()
    const dateKey = todayKey.replace(/-/g, '')
    await set(ref(db, `answers/${gameId}/${dateKey}/${ts}`), { ts, user, ...payload })
  }




const doCheckin = async () => {
  // ตรวจสอบอีกครั้งก่อนทำ (ป้องกัน race condition)
  const currentOpenTodayIndex = rewards.findIndex((_, i) => {
    const d = rewards[i]?.date
    const isOpen = !d || d === todayKey
    return isOpen && !checked?.[i]
  })
  
  if (currentOpenTodayIndex < 0 || busy || rewards.length === 0) {
    console.warn('Cannot checkin:', { currentOpenTodayIndex, busy, rewardsLength: rewards.length })
    return
  }
  
  const idx = currentOpenTodayIndex
  const r = rewards[idx]
  
  if (!r) {
    console.error('Reward not found for index:', idx)
    return
  }
  
  setBusy(true)

  const before = Number(hcoin || 0)
  const ts = Date.now()
  let countBefore = 0
  for (let i = 0; i < rewards.length; i++) {
    if (checked?.[i]) countBefore++
  }

  try {
    // mark checked (ใช้ transaction เพื่อป้องกัน race condition)
    const checkinResult = await runTransaction(ref(db, `checkins/${gameId}/${user}/${idx}`), (cur: any) => {
      // ถ้าเคยเช็คอินแล้ว ไม่ต้องทำอะไร
      if (cur === true) {
        console.warn('Already checked in for day:', idx)
        return cur
      }
      // ยังไม่เคยเช็คอิน ให้ mark เป็น true
      return true
    })
    
    // ถ้า transaction ไม่สำเร็จ (เช่น มีคนอื่นเช็คอินไปแล้ว) ให้หยุด
    if (!checkinResult.committed) {
      console.warn('Checkin transaction not committed')
      onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถเช็คอินได้ กรุณาลองใหม่อีกครั้ง')
      return
    }
    
    // อัพเดท local state ทันที (optimistic update)
    setChecked(prev => ({ ...prev, [idx]: true }))

    // แสดง notification popup ถ้ามีรูปภาพ (ย้ายไปแสดงตอน login แทน)
    // if (game?.checkin?.imageDataUrl && onNotification) {
    //   onNotification(
    //     game.checkin.imageDataUrl,
    //     '🎉 เช็คอินสำเร็จ!',
    //     'ยินดีด้วย! คุณได้เช็คอินเรียบร้อยแล้ว'
    //   )
    // }

    if (r.type === 'coin') {
      const amt = Number(r.amount ?? 0)
      const tx = await runTransaction(ref(db, `USERS_EXTRA/${user}/hcoin`), (cur: any) => {
        const n = Number(cur ?? 0)
        return (Number.isFinite(n) ? n : 0) + (Number.isFinite(amt) ? amt : 0)
      })
      const after = Number(tx?.snapshot?.val() ?? before + amt)

      // log (ใช้ sharding ตามวันที่เพื่อลดขนาด node)
      const dateKey = todayKey.replace(/-/g, '')
      await set(ref(db, `answers/${gameId}/${dateKey}/${ts}`), {
        ts, user, action: 'checkin', dayIndex: idx + 1,
        amount: amt, balanceBefore: before, balanceAfter: after,
      })

      // ✅ แสดง popup แบบใหม่
      setSuccess({
        amt,
        dayIndex: idx + 1,
        checked: countBefore + 1,
        total: rewards.length,
        type: 'coin',
      })
    } else {
      const code = r.code ?? ''
      if (code) onCode?.(code)
      else onInfo?.('ยังไม่ได้ตั้งค่าโค้ด', 'วันเช็คอินนี้ไม่มีโค้ดที่กำหนดไว้')

      // log (ใช้ sharding ตามวันที่)
      const dateKey = todayKey.replace(/-/g, '')
      await set(ref(db, `answers/${gameId}/${dateKey}/${ts}`), {
        ts, user, action: 'checkin', dayIndex: idx + 1,
        amount: 0, code: code || undefined,
        balanceBefore: before, balanceAfter: before,
      })

      // ถ้าวันนี้เป็น "โค้ด" ก็ยังโชว์สรุปเช็คอิน (amt=0)
      setSuccess({
        amt: 0,
        dayIndex: idx + 1,
        checked: countBefore + 1,
        total: rewards.length,
        type: 'code',
        code: code,
      })
    }

    // ✅ ตรวจสอบว่าผู้ใช้เช็คอินครบทุกวันหรือไม่ และให้รางวัล
    const countAfter = countBefore + 1
    const allChecked = countAfter === rewards.length
    const completeReward = game?.checkin?.completeReward
    
    if (allChecked && completeReward && !completeRewardClaimed) {
      // ตรวจสอบว่าผู้ใช้เคยได้รับรางวัลครบทุกวันหรือยัง
      const claimedRef = ref(db, `checkins/${gameId}/${user}/completeRewardClaimed`)
      const claimedSnap = await get(claimedRef)
      
      if (!claimedSnap.exists()) {
        // ยังไม่เคยได้รับ ให้รางวัล
        if (completeReward.kind === 'coin') {
          const amt = Number(completeReward.value ?? 0)
          if (amt > 0) {
            await runTransaction(ref(db, `USERS_EXTRA/${user}/hcoin`), (cur: any) => {
              const n = Number(cur ?? 0)
              return (Number.isFinite(n) ? n : 0) + (Number.isFinite(amt) ? amt : 0)
            })
            
            // บันทึกว่าได้รับแล้ว
            await set(claimedRef, true)
            setCompleteRewardClaimed(true)
            
            // log (ใช้ sharding ตามวันที่)
            const dateKey = todayKey.replace(/-/g, '')
            const completeTs = Date.now()
            await set(ref(db, `answers/${gameId}/${dateKey}/${completeTs}`), {
              ts: completeTs,
              user,
              action: 'checkin-complete',
              amount: amt,
              balanceBefore: before,
            })
            
            // แสดง popup
            setSuccess({
              amt,
              dayIndex: rewards.length,
              checked: countAfter,
              total: rewards.length,
              type: 'coin',
            })
          }
        } else {
          // CODE
          const codesString = String(completeReward.value || '')
          const codes = codesString.split('\n').map(c => c.trim()).filter(Boolean)
          if (codes.length > 0) {
            // ใช้โค้ดแรก
            const code = codes[0]
            onCode?.(code)
            
            // บันทึกว่าได้รับแล้ว
            await set(claimedRef, true)
            setCompleteRewardClaimed(true)
            
            // log (ใช้ sharding ตามวันที่)
            const dateKey = todayKey.replace(/-/g, '')
            const completeTs = Date.now()
            await set(ref(db, `answers/${gameId}/${dateKey}/${completeTs}`), {
              ts: completeTs,
              user,
              action: 'checkin-complete',
              code: code,
            })
            
            // แสดง popup
            setSuccess({
              amt: 0,
              dayIndex: rewards.length,
              checked: countAfter,
              total: rewards.length,
              type: 'code',
              code: code,
            })
          }
        }
      } else {
        setCompleteRewardClaimed(true)
      }
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

          // ✅ แคบชนิดของ r.date ให้เหลือ string | null ก่อนใช้
          const d: string | null =
            typeof r.date === 'string' && r.date.trim() ? r.date.trim() : null

          const isToday  = d === todayKey
          const isFuture = d !== null && d >  todayKey
          const isPast   = d !== null && d <  todayKey

          return (
            <div
              key={i}
              className={`ci-card ${done ? 'is-done' : isPast ? 'is-missed' : ''}`}
            >
              <div className="ci-head">Day {i + 1}</div>

              <div className="ci-body">
                {done ? (
                  <div className="ci-checked-pill">✓</div>
                ) : r.type === 'coin' ? (
                  <>
                    <div className="ci-icon coin" role="img" aria-label="coin">
                      <img src={coinLogo} alt={coinName} width="32" height="32" />
                    </div>
                    <div className="ci-amt">รับ {fmt(r.amount)} {coinName}</div>
                  </>
                ) : (
                  <>
                    <div className="ci-icon code" role="img" aria-label="code">
                      <img src="/image/coupon.svg" alt="CODE" width="32" height="32" />
                    </div>
                    <div className="ci-amt">CODE</div>
                  </>
                )}
              </div>

              {/* Footer */}
              {!done && (
                <div className="ci-foot">
                  {!!d && <div className="ci-date">{fmtDMY(d)}</div>}
                  {isToday  && <div className="ci-note ci-note--ok">วันนี้เช็คอินได้</div>}
                  {isFuture && <div className="ci-note">ยังไม่ถึงวัน</div>}
                  {isPast   && <div className="ci-note ci-note--overdue">หมดเวลาเช็คอิน</div>}
                </div>
              )}
            </div>
          )
              })}
  </div>
        )}

        {/* ข้อความบอกวันถัดไป + ปุ่มเช็คอิน */}
{openTodayIndex < 0 && !allChecked && nextFutureDate && (
  <div className="muted" style={{ textAlign: 'center', marginTop: 15 }}>
    วันถัดไปที่เช็คอินได้: <b>{fmtDMY(nextFutureDate)}</b>
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
    ? 'สิ้นสุดกิจกรรมแล้ว'
    : busy
      ? 'กำลังเช็คอิน…'
      : openTodayIndex >= 0
        ? 'CHECKIN'
        : 'รอวันถัดไป'}
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
    items={(Array.isArray(game?.checkin?.coupon?.items) ? game.checkin.coupon.items : []).map((it: any) => ({
      title: typeof it?.title === 'string' ? it.title : '',
      rewardCredit: Number(it?.rewardCredit) || 0,
      price: Number(it?.price) || 0,
      codes: Array.isArray(it?.codes) ? it.codes.filter(Boolean) : [],
    }))}
    onRedeem={async (idx) => {
  const items = Array.isArray(game?.checkin?.coupon?.items) ? game.checkin.coupon.items : [];
  const item = items[idx];
  if (!item) return { ok:false, message:'ไม่พบรางวัลนี้' };

  const price = Number(item.price||0);
  const before = hcoin;                          // ✅ เก็บยอดก่อนหัก (สำหรับ log)
  if (before < price) return { ok:false, message:`${coinName} ไม่พอ` };

  const couponRef = ref(db, `games/${gameId}/checkin/coupon`);
  let chosenCode: string | null = null;

  try {
    await runTransaction(couponRef, (cur:any) => {
      const items = Array.isArray(cur?.items) ? cur.items : [];
      const cursors = Array.isArray(cur?.cursors) ? cur.cursors : [];
      const codes:string[] = Array.isArray(items[idx]?.codes) ? items[idx].codes.filter(Boolean) : [];
      const c = Number(cursors[idx] ?? 0);
      const code = codes[c];
      if (!code) return cur || null;
      chosenCode = String(code);
      const next = cur ? { ...cur } : { items, cursors:[] as number[] };
      const nextCursors = Array.isArray(next.cursors) ? [...next.cursors] : [];
      nextCursors[idx] = (Number(nextCursors[idx] ?? 0) || 0) + 1;
      next.cursors = nextCursors;
      return next;
    }, { applyLocally:false });
  } catch {
    return { ok:false, message:'ไม่สามารถจองโค้ดได้' };
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
      // ยกเลิก cursor คืน
      await runTransaction(couponRef, (cur:any) => {
        const next = cur ? { ...cur } : {};
        const cursors = Array.isArray(next?.cursors) ? [...next.cursors] : [];
        const current = Number(cursors[idx] ?? 0);
        if (current > 0) cursors[idx] = current - 1;
        next.cursors = cursors;
        return next;
      });
      return { ok:false, message:`${coinName} ไม่พอ` };
    }
    after = Number(res.snapshot?.val() ?? (before - price));   // ✅ ยอดหลังหัก
  } catch {
    // คืน cursor หากตัดเหรียญล้มเหลว
    await runTransaction(couponRef, (cur:any) => {
      const next = cur ? { ...cur } : {};
      const cursors = Array.isArray(next?.cursors) ? [...next.cursors] : [];
      const current = Number(cursors[idx] ?? 0);
      if (current > 0) cursors[idx] = current - 1;
      next.cursors = cursors;
      return next;
    });
    return { ok:false, message:'ไม่สามารถตัดเหรียญได้' };
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
