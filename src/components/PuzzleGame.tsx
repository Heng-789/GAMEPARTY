import React from 'react'
import { db } from '../services/firebase'
import { ref, get, set, runTransaction } from 'firebase/database'

type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'

type GameData = {
  id: string
  type: GameType
  name: string
  codes?: string[] | Record<string, string>
  codeCursor?: number
  claimedBy?: Record<string, { idx: number; code: string; ts: number } | any>
  puzzle?: { imageDataUrl?: string; answer?: string }
}

type Props = {
  gameId: string
  game: GameData                 // ต้องเป็นประเภท "เกมทายภาพปริศนา"
  username: string               // ชื่อผู้เล่นที่ตรวจสอบสิทธิ์แล้ว
  onInfo: (title: string, message: string) => void
  onCode: (code: string) => void
}

const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '')
const clean = (s = '') => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** แปลง codes ให้เป็น array เสมอ (รองรับ object { "0": "...", "1": "..." }) */
const codesToArray = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    return Object.keys(raw)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => String(raw[k] ?? ''))
  }
  return []
}

export default function PuzzleGame({ gameId, game, username, onInfo, onCode }: Props) {
  const [answer, setAnswer] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [autoSoldOutDismissed, setAutoSoldOutDismissed] = React.useState(false);

  const player = normalizeUser(username)
  const img = game.puzzle?.imageDataUrl || ''

  /** บันทึก timeline + index */
  const writeAnswer = async (payload: Record<string, any>) => {
    const ts = Date.now()
    await Promise.all([
      set(ref(db, `answers/${gameId}/${ts}`), payload),
      set(ref(db, `answersIndex/${gameId}/${player}`), { ...payload, ts }),
    ])
  }
  /** บันทึกเฉพาะ timeline (ตอนตอบผิด) */
  const writeTimelineOnly = async (payload: Record<string, any>) => {
    const ts = Date.now()
    await set(ref(db, `answers/${gameId}/${ts}`), payload)
  }
  

  /** เคลมโค้ดแบบคิวเดียว (atomic) — รองรับ codes เป็น array หรือ object */
  const claimCode = async (): Promise<'ALREADY'|'EMPTY'|string|null> => {
    const { committed, snapshot } = await runTransaction(
      ref(db, `games/${gameId}`),
      (g: any | null) => {
        if (!g) return g

        const list = codesToArray(g.codes)
        g.claimedBy = g.claimedBy || {}

        // เคยมีชื่อเราใน claimedBy แล้ว → ไม่ขยับ cursor อีก
        if (g.claimedBy[player]) return g

        const total = list.length
        g.codeCursor = Number(g.codeCursor ?? 0)

        // ไม่มีโค้ด หรือโค้ดหมด → ไม่เปลี่ยน state ให้ภายนอกตีความ
        if (total <= 0 || g.codeCursor >= total) return g

        // แจกโค้ดตัวถัดไป
        const idx  = g.codeCursor
        const code = list[idx] ?? ''
        g.codeCursor = idx + 1
        g.claimedBy[player] = { idx, code, ts: Date.now() }
        return g
      }
    )

    if (!committed) return null
    const g: any = snapshot.val() || {}

    // เพิ่งได้โค้ดสำเร็จ
    const claimed = g?.claimedBy?.[player]
    if (claimed?.code) return String(claimed.code)

    // เคยมีชื่อเราอยู่แล้วในรูปแบบอื่น
    if (g?.claimedBy && g.claimedBy[player]) return 'ALREADY'

    // ประเมินสถานะ sold out ปัจจุบัน
    const total = codesToArray(g?.codes).length
    const cursor = Number(g?.codeCursor ?? 0)
    if (total <= 0 || cursor >= total) return 'EMPTY'

    return null
  }

  const submit = async () => {
    if (!player) { onInfo('ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นที่หน้าแรก'); return }
    if (!answer.trim()) { onInfo('กรอกคำตอบก่อน', 'โปรดพิมพ์คำตอบของคุณ'); return }

    setSubmitting(true)
    try {
      const ans = answer.trim()
      const correct = clean(ans) === clean(game.puzzle?.answer || '')

      if (!correct) {
        await writeTimelineOnly({ user: player, answer: ans, correct: false })
        onInfo('คำตอบไม่ถูกต้อง', 'ลองอีกครั้งนะ!')
        return
      }

      // ถูกต้อง → เคลมโค้ด
      const code = await claimCode()

      if (code === 'ALREADY') {
        // ถ้าเคยได้แล้ว พยายามดึง code เดิมมาโชว์ให้
        let prevCode: string | undefined
        try {
          const snap = await get(ref(db, `games/${gameId}/claimedBy/${player}/code`))
          if (snap.exists()) prevCode = String(snap.val())
        } catch {}
        await writeAnswer({ user: player, answer: ans, correct: true, ...(prevCode ? { code: prevCode } : {}) })
        if (prevCode) {
          onCode(prevCode)
        } else {
          onInfo('คุณรับโค้ดไปแล้ว', `USER ${player} ได้รับโค้ดไปก่อนหน้านี้`)
        }
      } else if (code === 'EMPTY') {
        await writeAnswer({ user: player, answer: ans, correct: true })
        onInfo('โค้ดเต็มแล้วค่ะ', 'โค้ดเต็มแล้วค่ะ รอติดตามกิจกรรมรอบหน้าค่ะ')
      } else if (typeof code === 'string') {
        try { await navigator.clipboard.writeText(code) } catch {}
        await writeAnswer({ user: player, answer: ans, correct: true, code })
        onCode(code)            // 👉 parent เปิด popup โค้ด
      } else {
        onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถรับโค้ดได้ ลองใหม่ภายหลัง')
      }

      setAnswer('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display:'grid', gap:12 }}>
      {!!img && <img src={img} className="play-image" alt="puzzle" />}

      <label className="f-label">คำตอบของคุณ</label>
      <input
        className="f-control"
        placeholder="พิมพ์คำตอบที่นี่…"
        value={answer}
        onChange={(e)=>setAnswer(e.target.value)}
        onKeyDown={(e)=>{ if (e.key==='Enter' && !submitting) submit() }}
        disabled={submitting}
      />

      <button className="btn-cta" disabled={submitting} onClick={submit}>
        {submitting ? 'กำลังส่ง…' : 'ตอบคำถาม'}
      </button>
    </div>
  )
}
