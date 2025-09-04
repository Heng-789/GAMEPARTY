import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ref, onValue, update, remove, get } from 'firebase/database'
import { db } from '../../services/firebase'

type AnswerRow = { ts: number; user?: string; answer?: string }

export default function GameAdmin() {
  const { id = '' } = useParams()
  const nav = useNavigate()

  const [game, setGame] = useState<any>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [loading, setLoading] = useState(true)

  // ลิงก์ที่ส่งให้ลูกค้า (เล่นได้โดยไม่ต้องล็อกอิน)
  const playerLink = useMemo(() => `${location.origin}/?id=${id}`, [id])

  // โหลดข้อมูลเกมแบบ realtime
  useEffect(() => {
    if (!id) return
    const r = ref(db, `games/${id}`)
    const unsub = onValue(r, (snap) => {
      setGame(snap.val())
      setLoading(false)
    })
    return () => unsub()
  }, [id])

  // ปุ่มสลับล็อก/ปลดล็อก
  async function toggleUnlock(next: boolean) {
    setGame((g: any) => ({ ...(g || {}), unlocked: next }))
    await update(ref(db, `games/${id}`), { unlocked: next })
  }

  // ดึงคำตอบของผู้เล่น
  async function refreshAnswers() {
    const snap = await get(ref(db, `answers/${id}`))
    const v = snap.val() || {}
    const rows: AnswerRow[] = Object.keys(v).map((k) => ({
      ts: Number(k) || 0,
      user: v[k]?.user ?? v[k]?.username ?? v[k]?.name ?? '',
      answer: v[k]?.answer ?? v[k]?.value ?? v[k]?.text ?? '',
    }))
    rows.sort((a, b) => b.ts - a.ts)
    setAnswers(rows)
  }

  // ลบเกมพร้อมคำตอบ (ถ้ามี)
  async function handleDelete() {
    if (!confirm('ต้องการลบเกมนี้และข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?')) return
    try { await remove(ref(db, `answers/${id}`)) } catch {}
    await remove(ref(db, `games/${id}`))
    alert('ลบเกมเรียบร้อย')
    nav('/games', { replace: true })
  }

  if (loading || !game) return <div style={{ padding: 16 }}>กำลังโหลด…</div>

  return (
    <section className="admin-wrap">
      {/* แถบบน: สวิตช์ปลดล็อก + ช่องลิงก์ลูกค้า */}
      <div className="admin-top">
        <div className="unlock-row">
          <label className="switch">
            <input
              type="checkbox"
              checked={!!game.unlocked}
              onChange={(e) => toggleUnlock(e.currentTarget.checked)}
            />
            <span className="slider" />
          </label>
          <span className="muted">{game.unlocked ? '🔓 ปลดล็อกแล้ว' : '🔒 ยังล็อกอยู่'}</span>
        </div>

        <label className="share-label">ลิงก์สำหรับส่งให้ลูกค้า</label>
        <div className="share-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
          <input className="share-input" value={playerLink} readOnly />
          <button
            className="btn-copy"
            onClick={async () => { try { await navigator.clipboard.writeText(playerLink) } catch {} }}
          >
            คัดลอกลิงก์
          </button>
        </div>
      </div>

      {/* โซนล่าง: คำตอบ/รีเฟรช/ลบ/กลับ (ตามรูป) */}
      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        <button className="btn" onClick={refreshAnswers}>รีเฟรชคำตอบ</button>

        <div
          className="answers-card"
          style={{ maxHeight: 320, overflow: 'auto', border: '1px solid #eee', borderRadius: 12, padding: 10 }}
        >
          {answers.length === 0 ? (
            <div className="muted">ยังไม่มีคำตอบ</div>
          ) : (
            answers.map((row, idx) => (
              <div
                key={idx}
                style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '6px 0', borderBottom: '1px dashed #f0f0f0' }}
              >
                <div style={{ color: '#666' }}>
                  {new Date(row.ts).toLocaleString('th-TH')}
                </div>
                <div><b>{row.user || '-'}</b> — คำตอบ: {row.answer ?? '-'}</div>
              </div>
            ))
          )}
        </div>

        <button className="btn-danger" onClick={handleDelete}>ลบเกมนี้</button>
        <button className="btn-back" onClick={() => nav('/games')}>กลับ</button>
      </div>
    </section>
  )
}
