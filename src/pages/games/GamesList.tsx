// src/pages/admin/GamesList.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../services/firebase'
import { ref, onValue, remove, get } from 'firebase/database'
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'

type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'

type GameItem = {
  id: string
  name?: string
  type: GameType
  createdAt?: number
  unlocked?: boolean
  locked?: boolean
}

const TYPE_STYLES: Record<GameType, { bg: string; border: string }> = {
  'เกมทายภาพปริศนา': { bg: '#E7F0FF', border: '#6EA8FE' },
  'เกมทายเบอร์เงิน':  { bg: '#FFF4D6', border: '#F4B000' },
  'เกมทายผลบอล':      { bg: '#E9F7EC', border: '#33A65C' },
  'เกมสล็อต':         { bg: '#FFE8E8', border: '#F25555' },
  'เกมเช็คอิน':       { bg: '#F1E9FF', border: '#9B5DE5' },
}

export default function GamesList() {
  const nav = useNavigate()
  const [items, setItems] = React.useState<GameItem[]>([])
  const [loading, setLoading] = React.useState(true)

  // กันกดซ้ำตอนลบ
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // modal กรอกรหัสผ่าน
  const [pwdModal, setPwdModal] = React.useState<{
    open: boolean
    game: GameItem | null
    password: string
    loading: boolean
    error?: string
  }>({ open: false, game: null, password: '', loading: false })

  React.useEffect(() => {
    const r = ref(db, 'games')
    const off = onValue(
      r,
      (snap) => {
        if (!snap.exists()) { setItems([]); setLoading(false); return }
        const raw = snap.val() || {}
        const entries = Object.entries(raw as Record<string, any>)
        const list: GameItem[] = entries.map(([k, g]) => ({
          id: g.id || k,
          name: g.name || g.title || '',
          type: (g.type || 'เกมทายภาพปริศนา') as GameType,
          createdAt: typeof g.createdAt === 'number' ? g.createdAt : (typeof g.updatedAt === 'number' ? g.updatedAt : 0),
          unlocked: typeof g.unlocked === 'boolean' ? g.unlocked : (typeof g.locked === 'boolean' ? !g.locked : false),
          locked: typeof g.locked === 'boolean' ? g.locked : (typeof g.unlocked === 'boolean' ? !g.unlocked : true),
        }))
        list.sort((a,b) => (b.createdAt||0) - (a.createdAt||0))
        setItems(list)
        setLoading(false)
      },
      () => { setItems([]); setLoading(false) }
    )
    return () => off()
  }, [])

  /** อ่านสถานะล็อกจริงจาก RTDB */
  async function readLockedFromDb(gameId: string): Promise<boolean> {
    try {
      const snap = await get(ref(db, `games/${gameId}`))
      if (!snap.exists()) return false
      const v = snap.val()
      return v?.locked === true || v?.unlocked === false
    } catch {
      return false
    }
  }

  /** ทำการลบจริง */
  async function reallyDelete(game: GameItem) {
    if (!game?.id) return
    if (!confirm(`ต้องการลบเกม "${game.name || game.id}" และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?`)) return
    try {
      setDeletingId(game.id)
      try { await remove(ref(db, `answers/${game.id}`)) } catch {}
      try { await remove(ref(db, `answersIndex/${game.id}`)) } catch {}
      await remove(ref(db, `games/${game.id}`))
      alert('ลบเกมเรียบร้อย')
    } finally {
      setDeletingId(null)
    }
  }

  /** กดลบการ์ด */
  async function handleDelete(g: GameItem, e?: React.MouseEvent) {
    e?.stopPropagation()
    if (!g?.id || deletingId) return

    // เช็คสถานะล็อกล่าสุดจาก DB
    const lockedNow = await readLockedFromDb(g.id)

    if (!lockedNow) {
      // ไม่ล็อก -> ลบได้เลย
      await reallyDelete(g)
      return
    }

    // ล็อกอยู่ -> เปิด modal กรอกรหัสผ่าน
    setPwdModal({ open: true, game: g, password: '', loading: false, error: undefined })
  }

  /** กดยืนยันรหัสผ่านใน modal */
  async function confirmPasswordAndDelete() {
    const g = pwdModal.game
    if (!g) return
    const auth = getAuth()
    const user = auth.currentUser

    if (!user || !user.email) {
      setPwdModal(s => ({ ...s, error: 'กรุณาล็อกอินด้วยอีเมล/รหัสผ่านก่อน' }))
      return
    }

    // ต้องเป็นบัญชีที่มี provider password
    const providerIds = (user.providerData || []).map(p => p?.providerId).filter(Boolean)
    const canUsePassword = providerIds.includes('password') || providerIds.length === 0
    if (!canUsePassword) {
      setPwdModal(s => ({ ...s, error: 'บัญชีนี้ไม่ได้ใช้รหัสผ่าน (เช่น Google/Facebook) ไม่สามารถยืนยันด้วยรหัสผ่านได้' }))
      return
    }

    if (!pwdModal.password.trim()) {
      setPwdModal(s => ({ ...s, error: 'กรุณากรอกรหัสผ่าน' }))
      return
    }

    try {
      setPwdModal(s => ({ ...s, loading: true, error: undefined }))
      const cred = EmailAuthProvider.credential(user.email, pwdModal.password)
      await reauthenticateWithCredential(user, cred)
      setPwdModal({ open: false, game: null, password: '', loading: false })
      await reallyDelete(g)
    } catch (err) {
      setPwdModal(s => ({ ...s, loading: false, error: 'รหัสผ่านไม่ถูกต้อง' }))
    }
  }

  if (loading) {
    return (
      <section className="create-wrap">
        <div className="create-card">
          <h3 style={{textAlign:'center', marginTop:0}}>รายการเกมที่สร้างไว้</h3>
          <div style={{textAlign:'center', color:'#666'}}>กำลังโหลด…</div>
        </div>
      </section>
    )
  }

  return (
    <section className="create-wrap">
      <div className="create-card" style={{paddingBottom:16}}>
        <h3 style={{textAlign:'center', marginTop:0}}>รายการเกมที่สร้างไว้333</h3>

        {items.length === 0 ? (
          <div style={{textAlign:'center', color:'#666'}}>ยังไม่มีเกมที่สร้างไว้</div>
        ) : (
          <div style={{display:'grid', gap:12}}>
            {items.map((g) => {
              const st = TYPE_STYLES[g.type] || { bg: '#f5f5f5', border: '#ddd' }
              const lockedIcon = (g.locked ?? !g.unlocked)
              return (
                <div
                  key={g.id}
                  onClick={() => nav(`/games/${g.id}`)}
                  style={{
                    display:'grid',
                    gridTemplateColumns:'1fr auto',
                    gap:10,
                    alignItems:'center',
                    background: st.bg,
                    border: `1px solid ${st.border}`,
                    borderRadius: 12,
                    padding: '10px 12px',
                    cursor:'pointer'
                  }}
                >
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <span style={{
                      display:'inline-flex',
                      width:34, height:34, borderRadius:8,
                      alignItems:'center', justifyContent:'center',
                      background:'#fff', border:`1px solid ${st.border}`
                    }}>
                      🎮
                    </span>
                    <div style={{lineHeight:1.25}}>
                      <div style={{fontWeight:600}}>
                        {g.name || '(ไม่มีชื่อเกม)'} — <span style={{opacity:.85}}>{g.type}</span>
                        {lockedIcon && <span title="ล็อกอยู่"> &nbsp;🔒</span>}
                      </div>
                      {g.createdAt ? (
                        <div style={{fontSize:12, color:'#666'}}>
                          สร้างเมื่อ {new Date(g.createdAt).toLocaleString('th-TH')}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(g, e)}
                    title="ลบเกมนี้"
                    disabled={deletingId === g.id}
                    style={{
                      border: 'none',
                      background: '#f25555',
                      color:'#fff',
                      borderRadius: 8,
                      padding: '8px 10px',
                      cursor: deletingId === g.id ? 'not-allowed' : 'pointer',
                      opacity: deletingId === g.id ? .7 : 1
                    }}
                  >
                    {deletingId === g.id ? '…' : '🗑️'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal กรอกรหัสผ่านก่อนลบ */}
      {pwdModal.open && (
        <div
          className="modal-overlay"
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:50
          }}
        >
          <div
            className="modal"
            onClick={(e)=>e.stopPropagation()}
            style={{
              width:'min(440px, 92vw)',
              background:'#fff',
              borderRadius:16,
              padding:'18px 16px',
              boxShadow:'0 10px 30px rgba(0,0,0,.25)'
            }}
          >
            <h3 style={{margin:'4px 0 10px', textAlign:'center'}}>ใส่รหัสผ่านเพื่อยืนยันการลบเกมที่ถูกล็อก</h3>
            <div style={{fontSize:13, color:'#64748b', textAlign:'center', marginBottom:10}}>
              จะใช้รหัสผ่านเดียวกับที่คุณใช้ล็อกอิน
            </div>
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={pwdModal.password}
              onChange={(e)=>setPwdModal(s=>({ ...s, password:e.target.value }))}
              onKeyDown={(e)=>{ if(e.key==='Enter') confirmPasswordAndDelete() }}
              autoFocus
              style={{
                width:'100%', height:44, borderRadius:10, padding:'0 12px',
                border:'1px solid #d1d5db', outline:'none'
              }}
            />
            {!!pwdModal.error && (
              <div style={{color:'#dc2626', fontSize:13, marginTop:8, textAlign:'center'}}>{pwdModal.error}</div>
            )}

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14}}>
              <button
                className="btn-cta"
                onClick={confirmPasswordAndDelete}
                disabled={pwdModal.loading}
                style={{
                  height:44, borderRadius:10, border:'none',
                  background:'#16a34a', color:'#fff', fontWeight:700,
                  cursor: pwdModal.loading ? 'not-allowed' : 'pointer'
                }}
              >
                {pwdModal.loading ? 'กำลังตรวจสอบ…' : 'ตกลง'}
              </button>
              <button
                className="btn-outline"
                onClick={()=>setPwdModal({ open:false, game:null, password:'', loading:false })}
                style={{
                  height:44, borderRadius:10, border:'1px solid #d1d5db',
                  background:'#fff', fontWeight:700, cursor:'pointer'
                }}
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
