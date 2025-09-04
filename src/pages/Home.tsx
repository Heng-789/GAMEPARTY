import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../services/firebase'
import { ref, onValue, remove, get } from 'firebase/database'
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'

type GameRow = { id: string; name: string; type: string; createdAt?: number; unlocked?: boolean }

export default function Home() {
  const nav = useNavigate()
  const [rows, setRows] = React.useState<GameRow[]>([])
  const [loading, setLoading] = React.useState(true)

  // กำลังลบรายการไหนอยู่ (กันกดซ้ำ)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // modal ยืนยันรหัสผ่านก่อนลบ (เฉพาะเกมที่ล็อก)
  const [pwdModal, setPwdModal] = React.useState<{
    open: boolean
    gameId: string
    gameName: string
    password: string
    loading: boolean
    error?: string
  }>({ open: false, gameId: '', gameName: '', password: '', loading: false })

  // ถ้ามี ?id=... ให้ส่งผู้เล่นไปหน้าเล่น
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('id')
    if (q) nav(`/play/${q.trim()}`, { replace: true })
  }, [nav])

  // ดึงรายการเกมจาก /games
  useEffect(() => {
    const r = ref(db, 'games')
    const off = onValue(
      r,
      (snap) => {
        if (!snap.exists()) {
          setRows([])
          setLoading(false)
          return
        }
        const raw = snap.val() as Record<string, any>
        const list: GameRow[] = Object.keys(raw).map((k) => {
          const g = raw[k] || {}
          const createdAt =
            typeof g.createdAt === 'number'
              ? g.createdAt
              : typeof g.updatedAt === 'number'
              ? g.updatedAt
              : 0
          const unlocked =
            typeof g.unlocked === 'boolean'
              ? g.unlocked
              : typeof g.locked === 'boolean'
              ? !g.locked
              : false

          return {
            id: g.id || k,
            name: g.name || g.title || '',
            type: g.type || 'เกมทายภาพปริศนา',
            createdAt,
            unlocked,
          }
        })
        list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        setRows(list)
        setLoading(false)
      },
      (err) => {
        console.error('[Home] read /games error:', err)
        setRows([])
        setLoading(false)
      }
    )
    return () => off()
  }, [])

  // ล็อกสกอร์ลเมื่อเปิดโมดัล
  useEffect(() => {
    if (pwdModal.open) document.body.classList.add('no-scroll')
    return () => document.body.classList.remove('no-scroll')
  }, [pwdModal.open])

  /** อ่านสถานะ locked ล่าสุดจาก DB (กันข้อมูลบนการ์ดไม่ทันอัปเดต) */
  const isLockedOnDb = async (id: string): Promise<boolean> => {
    try {
      const snap = await get(ref(db, `games/${id}`))
      if (!snap.exists()) return false
      const v = snap.val()
      return v?.locked === true || v?.unlocked === false
    } catch {
      return false
    }
  }

  /** ลบจริง (ทุก collection ที่เกี่ยวข้อง) */
  const doDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบเกม "${name || id}" และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?`)) return
    try {
      setDeletingId(id)
      try { await remove(ref(db, `answers/${id}`)) } catch {}
      try { await remove(ref(db, `answersIndex/${id}`)) } catch {}
      await remove(ref(db, `games/${id}`))
      alert('ลบเกมเรียบร้อย')
    } finally {
      setDeletingId(null)
    }
  }

  /** กดปุ่มลบจากการ์ด */
  const handleDelete = async (id: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (deletingId) return

    // เช็คสถานะล่าสุดจาก DB
    const lockedNow = await isLockedOnDb(id)

    if (!lockedNow) {
      await doDelete(id, name)
      return
    }

    // ล็อกอยู่ → ให้กรอกรหัสผ่านที่ใช้ล็อกอิน
    setPwdModal({ open: true, gameId: id, gameName: name, password: '', loading: false, error: undefined })
  }

  /** ยืนยันรหัสผ่านใน modal แล้วลบ */
  const confirmPasswordAndDelete = async () => {
    const { gameId, gameName, password } = pwdModal
    const auth = getAuth()
    const user = auth.currentUser

    if (!user || !user.email) {
      setPwdModal(s => ({ ...s, error: 'กรุณาเข้าสู่ระบบด้วยอีเมล/รหัสผ่านก่อน' }))
      return
    }

    const providerIds = (user.providerData || []).map(p => p?.providerId).filter(Boolean)
    const canUsePassword = providerIds.includes('password') || providerIds.length === 0
    if (!canUsePassword) {
      setPwdModal(s => ({ ...s, error: 'บัญชีนี้ไม่ได้ใช้รหัสผ่าน (เช่น Google/Facebook)' }))
      return
    }

    if (!password.trim()) {
      setPwdModal(s => ({ ...s, error: 'กรุณากรอกรหัสผ่าน' }))
      return
    }

    try {
      setPwdModal(s => ({ ...s, loading: true, error: undefined }))
      const cred = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, cred)
      setPwdModal({ open: false, gameId: '', gameName: '', password: '', loading: false })
      await doDelete(gameId, gameName)
    } catch (err) {
      setPwdModal(s => ({ ...s, loading: false, error: 'รหัสผ่านไม่ถูกต้อง' }))
    }
  }

  const uiByType = (t: string) => {
    switch (t) {
      case 'เกมทายภาพปริศนา':
        return { emoji: '🧩', from: '#E7F0FF', to: '#F6FAFF', accent: '#6EA8FE' }
      case 'เกมทายเบอร์เงิน':
        return { emoji: '🔢', from: '#FFF4D6', to: '#FFF9EB', accent: '#F4B000' }
      case 'เกมทายผลบอล':
        return { emoji: '⚽️', from: '#E9F7EC', to: '#F4FBF6', accent: '#33A65C' }
      case 'เกมสล็อต':
        return { emoji: '🎰', from: '#FFE8E8', to: '#FFF1F1', accent: '#F25555' }
      case 'เกมเช็คอิน':
        return { emoji: '📍', from: '#F1E9FF', to: '#F8F3FF', accent: '#9B5DE5' }
      default:
        return { emoji: '🎮', from: '#F4F7FA', to: '#FFFFFF', accent: '#C7D3E0' }
    }
  }

  return (
    <section className="home-hero">
      <div className="home-card">
        <img src="/image/logo.png" alt="HENG36 PARTY" className="home-logo" />

        <div className="home-actions">
          <button className="btn-pill btn-blue" onClick={() => nav('/upload-users')}>📋 USERS</button>
          <button className="btn-pill btn-blue" onClick={() => nav('/upload-users-extra')}>📒 USERS EXTRA</button>
        </div>

        <button className="btn-cta" onClick={() => nav('/creategame')}>สร้างเกม</button>
        <h3 className="home-subhead">รายการเกมที่สร้างไว้</h3>

        <div className="home-list">
          {loading && (
            <div className="muted center-pad">กำลังโหลดรายการเกม…</div>
          )}

          {!loading && rows.length === 0 && (
            <div className="muted center-pad">ยังไม่มีเกมที่สร้างไว้</div>
          )}

          {!loading && rows.length > 0 && rows.map((g) => {
            const ui = uiByType(g.type)
            const bg = `linear-gradient(135deg, ${ui.from} 0%, ${ui.to} 100%)`
            return (
              <div
                key={g.id}
                className="game-row"
                style={{ background: bg, borderLeft: `6px solid ${ui.accent}` }}
                onClick={() => nav(`/games/${g.id}`)}
                role="button"
                title="คลิกเพื่อแก้ไข"
              >
                {/* ซ้าย */}
                <div className="gr-left">
                  <span className="gr-emoji" style={{ borderColor: ui.accent }}>
                    {ui.emoji}
                  </span>
                  <div className="gr-text">
                    <div className="gr-name">{g.name || '(ไม่มีชื่อเกม)'}</div>
                    <div className="gr-meta">{g.type}</div>
                  </div>
                </div>

                {/* ขวา */}
                <div className="gr-right">
                  {!g.unlocked && <span className="gr-lock" title="ยังล็อกอยู่">🔒</span>}

                  <button
                    className={`gr-delete ${deletingId === g.id ? 'is-loading' : ''}`}
                    onClick={(e) => handleDelete(g.id, g.name, e)}
                    aria-label="ลบเกม"
                    title="ลบเกมนี้"
                    disabled={deletingId === g.id}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v8h-2v-8Zm4 0h2v8h-2v-8ZM7 10h2v8H7v-8Zm-1 11h12a2 2 0 0 0 2-2V9H4v10a2 2 0 0 0 2 2Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal: กรอกรหัสผ่านเพื่อยืนยันการลบเกมที่ล็อก */}
      {pwdModal.open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="del-title">
          {/* ไม่ปิดด้วยการคลิกนอก */}
          <div className="modal-card" onClick={(e)=>e.stopPropagation()}>
            <h3 id="del-title" className="modal-title">ใส่รหัสผ่านเพื่อยืนยันการลบเกมที่ถูกล็อก</h3>
            <p className="modal-desc">จะใช้รหัสผ่านเดียวกับที่คุณใช้ล็อกอิน</p>
            <div className="modal-game-name">{pwdModal.gameName}</div>

            <input
              type="password"
              className="modal-input"
              placeholder="รหัสผ่าน"
              value={pwdModal.password}
              onChange={(e)=>setPwdModal(s=>({ ...s, password:e.target.value }))}
              onKeyDown={(e)=>{ if(e.key==='Enter') confirmPasswordAndDelete() }}
              autoFocus
            />

            {!!pwdModal.error && (
              <div className="modal-error">{pwdModal.error}</div>
            )}

            <div className="modal-actions">
              <button className="btn-primary" onClick={confirmPasswordAndDelete} disabled={pwdModal.loading}>
                {pwdModal.loading ? 'กำลังตรวจสอบ…' : 'ตกลง'}
              </button>
              <button
                className="btn-outline"
                onClick={()=>setPwdModal({ open:false, gameId:'', gameName:'', password:'', loading:false })}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
