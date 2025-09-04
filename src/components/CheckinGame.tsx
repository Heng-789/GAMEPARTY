// src/components/CheckinGame.tsx
import React from 'react'
import { db } from '../services/firebase'
import { ref, onValue, runTransaction, set } from 'firebase/database'
import '../styles/checkin.css'
import { createPortal } from 'react-dom'
import CouponGame from './CouponGame';
import SlotGame from './SlotGame'
import UserBar from './UserBar'

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

const normalizeUser = (s: string) => (s || '').trim().replace(/\s+/g, '')
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
          <svg viewBox="0 0 64 64" width="36" height="36">
            <defs>
              <linearGradient id="vipG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFE08A" />
                <stop offset="1" stopColor="#FFB703" />
              </linearGradient>
            </defs>
            <path d="M6 22l10 8 8-14 8 14 10-8 8 24H-2z" fill="url(#vipG)" stroke="#C48A00" strokeWidth="2" />
            <circle cx="32" cy="18" r="4" fill="#E11D48" />
          </svg>
        </span>
        <div className="vip-card__text">
          <div className="vip-card__title">{title}</div>
          <div className="vip-card__sub">{subtitle}</div>
        </div>
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
  return (
    <button className="vip-card vip-card--green" onClick={onClick}>
      <div className="vip-card__left">
        <span className="vip-card__icon" aria-hidden>
          <svg viewBox="0 0 64 64" width="36" height="36">
            <defs>
              <linearGradient id="gSlot" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#B7F3C7" />
                <stop offset="1" stopColor="#22C55E" />
              </linearGradient>
            </defs>
            <rect x="8" y="14" width="48" height="36" rx="6" fill="url(#gSlot)" stroke="#0F9D58" strokeWidth="2" />
            <circle cx="22" cy="32" r="5" fill="#fff" />
            <circle cx="32" cy="32" r="5" fill="#fff" />
            <circle cx="42" cy="32" r="5" fill="#fff" />
          </svg>
        </span>
        <div className="vip-card__text">
          <div className="vip-card__title">{title}</div>
          <div className="vip-card__sub">{subtitle}</div>
        </div>
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
          {/* ไอคอนตั๋วคูปอง */}
          <svg viewBox="0 0 64 64" width="36" height="36">
            <defs>
              <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#a5b4fc" />
                <stop offset="1" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <rect x="8" y="16" width="48" height="32" rx="8" fill="url(#gBlue)" stroke="#2563eb" strokeWidth="2" />
            <circle cx="24" cy="32" r="4" fill="#fff" />
            <circle cx="32" cy="32" r="4" fill="#fff" />
            <circle cx="40" cy="32" r="4" fill="#fff" />
          </svg>
        </span>
        <div className="vip-card__text">
          <div className="vip-card__title">{title}</div>
          <div className="vip-card__sub">{subtitle}</div>
        </div>
      </div>
    </button>
  )
}


export default function CheckinGame({ gameId, game, username, onInfo, onCode }: Props) {
  const user = normalizeUser(username)
  const rewards: Reward[] = React.useMemo(() => coerceRewards(game), [game])

  const [hcoin, setHcoin] = React.useState(0)
  const [checked, setChecked] = React.useState<Record<number, boolean>>({})
  const [busy, setBusy] = React.useState(false)
  const [openCheckin, setOpenCheckin] = React.useState(false)
  const [openSlot, setOpenSlot] = React.useState(false)

  // slot config (จากหน้า CreateGame)
  const slotStartBet = Number(game?.checkin?.slot?.startBet ?? 1) || 1
  const slotWinRate = Math.max(0, Math.min(100, Number(game?.checkin?.slot?.winRate ?? 30) || 30))

  const [openCoupon, setOpenCoupon] = React.useState(false);
  const [success, setSuccess] = React.useState<null | {
    amt: number
    dayIndex: number
    checked: number
    total: number
  }>(null)

  const miniSlotCreditRef = `checkin_slot_credit/${gameId}/${user}`


    React.useEffect(() => {
    if (!openSlot) return
    // ตั้งค่าเริ่มต้นให้เลดเจอร์ Mini Slot "ครั้งเดียวตอนเปิด"
    // ถ้าเคยถูกตั้ง/กำลังเล่นอยู่แล้ว จะไม่ทับค่าเดิม
    runTransaction(ref(db, miniSlotCreditRef), (cur:any) => {
      return cur == null ? Number(hcoin || 0) : cur
    })
  }, [openSlot, miniSlotCreditRef, hcoin])

  React.useEffect(() => {
    if (!user) return
    const off1 = onValue(ref(db, `USERS_EXTRA/${user}/hcoin`), (s) => {
      const v = Number(s.val() ?? 0)
      setHcoin(Number.isFinite(v) ? v : 0)
    })
    const off2 = onValue(ref(db, `checkins/${gameId}/${user}`), (s) => {
      setChecked(s.val() ?? {})
    })
    return () => {
      off1()
      off2()
    }
  }, [user, gameId])

  if (!user) {
    return (
      <>
        {!!game?.checkin?.imageDataUrl && <img src={game.checkin.imageDataUrl} className="play-image" alt="checkin" />}
        <div className="banner warn" style={{ textAlign: 'center' }}>
          กรุณาเข้าสู่ระบบจากป๊อปอัปเพื่อเริ่มเช็คอิน
        </div>
      </>
    )
  }

  // บันทึกเหตุการณ์ลง answers/<gameId>/<timestamp> (ใช้สำหรับเช็คอิน/คูปอง = เก็บประวัติ)
  async function logAction(gameId: string, user: string, payload: any) {
    const ts = Date.now()
    await set(ref(db, `answers/${gameId}/${ts}`), { ts, user, ...payload })
  }


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

const nextFutureDate = React.useMemo(() => {
  for (let i = 0; i < rewards.length; i++) {
    const d = rewards[i]?.date
    if (d && d > todayKey) return d
  }
  return null
}, [rewards, todayKey])


const doCheckin = async () => {
  if (!canCheckin) return
  const idx = openTodayIndex
  const r = rewards[idx]
  setBusy(true)

  const before = Number(hcoin || 0)
  const ts = Date.now()
  const countBefore = Object.values(checked || {}).filter(Boolean).length

  try {
    // mark checked
    await set(ref(db, `checkins/${gameId}/${user}/${idx}`), true)

    if (r.type === 'coin') {
      const amt = Number(r.amount ?? 0)
      const tx = await runTransaction(ref(db, `USERS_EXTRA/${user}/hcoin`), (cur: any) => {
        const n = Number(cur ?? 0)
        return (Number.isFinite(n) ? n : 0) + (Number.isFinite(amt) ? amt : 0)
      })
      const after = Number(tx?.snapshot?.val() ?? before + amt)

      // log
      await set(ref(db, `answers/${gameId}/${ts}`), {
        ts, user, action: 'checkin', dayIndex: idx + 1,
        amount: amt, balanceBefore: before, balanceAfter: after,
      })

      // ✅ แสดง popup แบบใหม่
      setSuccess({
        amt,
        dayIndex: idx + 1,
        checked: countBefore + 1,
        total: rewards.length,
      })
    } else {
      const code = r.code ?? ''
      if (code) onCode?.(code)
      else onInfo?.('ยังไม่ได้ตั้งค่าโค้ด', 'วันเช็คอินนี้ไม่มีโค้ดที่กำหนดไว้')

      await set(ref(db, `answers/${gameId}/${ts}`), {
        ts, user, action: 'checkin', dayIndex: idx + 1,
        amount: 0, code: code || undefined,
        balanceBefore: before, balanceAfter: before,
      })

      // ถ้าวันนี้เป็น “โค้ด” ก็ยังโชว์สรุปเช็คอิน (amt=0)
      setSuccess({
        amt: 0,
        dayIndex: idx + 1,
        checked: countBefore + 1,
        total: rewards.length,
      })
    }
  } finally {
    setBusy(false)
  }
}

  return (
    
    <div className="checkin-wrap">
      <div style={{ margin: '6px 0 12px' }}>
          <UserBar username={user} credit={hcoin} className="userbar--blackgold" />

        </div>
      {/* การ์ดเมนู */}
      <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
        <VipOrangeCard onClick={() => setOpenCheckin(true)} />
        <VipGreenCard onClick={() => setOpenSlot(true)} />
        <VipBlueCard onClick={() => setOpenCoupon(true)} />
      </div>

      {/* ===== Popup: เช็คอิน (ย้ายเนื้อหามาไว้ในนี้) ===== */}
      <Overlay open={openCheckin} onClose={() => setOpenCheckin(false)} maxWidth={980}>
        <div className="ol-header ol--orange">
          <div>
            <div className="ol-title">
              <span className="ol-ico">🏆</span> Daily Reward
            </div>
            <div className="ol-sub">เช็คอินเพื่อรับรางวัลประจำวัน</div>
          </div>
          <button className="ol-close" aria-label="Close" onClick={()=>setOpenCheckin(false)}>✕</button>
        </div>

        {/* แถบยูส + HENGCOIN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px' }}>
        </div>

        {/* รูป (ถ้ามี) */}
        {!!game?.checkin?.imageDataUrl && <img src={game.checkin.imageDataUrl} className="play-image" alt="checkin" />}

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
                    <div className="ci-icon coin" role="img" aria-label="coin" />
                    <div className="ci-amt">{fmt(r.amount)}</div>
                  </>
                ) : (
                  <>
                    <div className="ci-icon code" role="img" aria-label="code" />
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
  className="btn-cta"
  style={{ marginTop: 14 }}
  onClick={doCheckin}
  disabled={!canCheckin}
>
  {allChecked
    ? 'เช็คอินครบแล้ว'
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
            <span className="ol-ico">🎰</span> Mini Slot
          </div>
          <div className="ol-sub">ใช้ HENGCOIN เล่นเพื่อลุ้นรางวัล</div>
        </div>

        <button className="ol-close" aria-label="Close" onClick={()=>setOpenSlot(false)}>✕</button>
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
              <span className="ol-ico">🎟️</span> Coupon Shop
            </div>
            <div className="ol-sub">แลกโค้ดรางวัล โดยใช้ HENGCOIN ใช้การแลกรับรางวัล</div>
          </div>
          <button className="ol-close" aria-label="Close" onClick={()=>setOpenCoupon(false)}>✕</button>
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
  if (before < price) return { ok:false, message:'HENGCOIN ไม่พอ' };

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
      return { ok:false, message:'HENGCOIN ไม่พอ' };
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
              <div className="cis-item">
                <div className="cis-label">ได้รับ HENGCOIN</div>
                <div className="cis-value cis-plus">+{fmt(success.amt)}</div>
              </div>
            </div>

            <button className="btn-cta" onClick={() => setSuccess(null)} style={{marginTop: 12}}>
              ตกลง
            </button>
          </div>
        </Overlay>
)}

    </div>
  )
}
