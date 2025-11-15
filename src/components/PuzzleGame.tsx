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

const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '').toUpperCase()
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
  const initialCodeShownRef = React.useRef(false)
  const codesVersion = React.useMemo(
    () => Number((game as any)?.codesVersion ?? 0),
    [game]
  )

  React.useEffect(() => {
    initialCodeShownRef.current = false
  }, [gameId, player, codesVersion])

  /** ฟังก์ชันสำหรับดึงโค้ดที่ user เคยได้ไปแล้ว (ไม่สนใจ version) */
  const getExistingCode = React.useCallback(async (): Promise<string | undefined> => {
    try {
      // 1. ตรวจสอบจาก claimedBy
      const claimed = (game as any)?.claimedBy
      const claimedEntry = claimed && typeof claimed === 'object' ? claimed[player] : undefined
      if (
        claimedEntry &&
        typeof claimedEntry === 'object' &&
        claimedEntry.code
      ) {
        return String(claimedEntry.code)
      }

      // 2. ตรวจสอบจาก answersIndex
      const idxSnap = await get(ref(db, `answersIndex/${gameId}/${player}`))
      if (idxSnap.exists()) {
        const data = idxSnap.val()
        if (
          data &&
          typeof data === 'object' &&
          'code' in data &&
          data.code &&
          'correct' in data &&
          data.correct === true
        ) {
          return String((data as any).code)
        }
      }

      // 3. ตรวจสอบจาก answers (หาล่าสุด)
      const answersSnap = await get(ref(db, `answers/${gameId}`))
      if (answersSnap.exists()) {
        const entries = Object.entries(answersSnap.val() || {})
          .sort((a, b) => Number(b[0]) - Number(a[0]))
        for (const [, data] of entries) {
          if (
            data &&
            typeof data === 'object' &&
            (data as any).user === player &&
            (data as any).correct === true &&
            (data as any).code
          ) {
            return String((data as any).code)
          }
        }
      }
    } catch (error) {
      console.error('Failed to get existing puzzle code', error)
    }
    return undefined
  }, [gameId, player, game])

  React.useEffect(() => {
    if (!player || initialCodeShownRef.current) return
    let cancelled = false

    const resolveExistingCode = async () => {
      const existingCode = await getExistingCode()
      if (!cancelled && existingCode) {
        initialCodeShownRef.current = true
        onCode(existingCode)
      }
    }

    void resolveExistingCode()

    return () => {
      cancelled = true
    }
  }, [gameId, player, game, onCode, codesVersion, getExistingCode])

  const attachVersion = (payload: Record<string, any>) => (
    codesVersion ? { ...payload, version: codesVersion } : payload
  )

  /** บันทึก timeline + index */
  const writeAnswer = async (payload: Record<string, any>) => {
    const ts = Date.now()
    await Promise.all([
      set(ref(db, `answers/${gameId}/${ts}`), attachVersion(payload)),
      set(ref(db, `answersIndex/${gameId}/${player}`), { ...attachVersion(payload), ts }),
    ])
  }
  /** บันทึกเฉพาะ timeline (ตอนตอบผิด) */
  const writeTimelineOnly = async (payload: Record<string, any>) => {
    const ts = Date.now()
    await set(ref(db, `answers/${gameId}/${ts}`), attachVersion(payload))
  }
  

  /** เคลมโค้ดแบบคิวเดียว (atomic) — รองรับ codes เป็น array หรือ object */
  const claimCode = async (): Promise<'ALREADY'|'EMPTY'|string|null> => {
    const { committed, snapshot } = await runTransaction(
      ref(db, `games/${gameId}`),
      (g: any | null) => {
        if (!g) return g

        const list = codesToArray(g.codes)
        const version = Number(g?.codesVersion ?? 0)
        g.claimedBy = g.claimedBy || {}

        const existing = g.claimedBy[player]
        if (existing) {
          const existingVersion = Number(existing?.version ?? 0)
          if (!version || existingVersion === version) {
            return g
          }
          delete g.claimedBy[player]
        }

        const total = list.length
        g.codeCursor = Number(g.codeCursor ?? 0)

        // ไม่มีโค้ด หรือโค้ดหมด → ไม่เปลี่ยน state ให้ภายนอกตีความ
        if (total <= 0 || g.codeCursor >= total) return g

        // แจกโค้ดตัวถัดไป
        const idx  = g.codeCursor
        const code = list[idx] ?? ''
        g.codeCursor = idx + 1
        g.claimedBy[player] = {
          idx,
          code,
          ts: Date.now(),
          ...(version ? { version } : {}),
        }
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
    if (total <= 0 || cursor >= total) {
      return 'EMPTY'
    }

    return null
  }


  const submit = async () => {
    if (!player) { onInfo('👤 ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นที่หน้าแรกเพื่อเริ่มเล่นเกม'); return }
    if (!answer.trim()) { onInfo('✏️ กรอกคำตอบก่อน', 'กรุณาพิมพ์คำตอบของคุณในช่องด้านบน'); return }
    

    setSubmitting(true)
    try {
      // เช็คว่าเคยได้โค้ดไปแล้วหรือไม่ (ไม่สนใจ version)
      const existingCode = await getExistingCode()
      if (existingCode) {
        // ถ้าเคยได้โค้ดไปแล้ว ให้แสดง popup โค้ดที่เคยได้
        initialCodeShownRef.current = true
        onCode(existingCode)
        setAnswer('')
        return
      }

      // เช็คซ้ำว่าเคยตอบแล้วไหม (เฉพาะ version ปัจจุบัน)
      const dup = await get(ref(db, `answersIndex/${gameId}/${player}`))
      if (dup.exists()) {
        const data = dup.val()
        if (
          data &&
          typeof data === 'object' &&
          'correct' in data &&
          data.correct === true &&
          (!codesVersion || Number(data?.version ?? 0) === codesVersion)
        ) {
          // ถ้ามีโค้ดใน version ปัจจุบัน ให้แสดงโค้ด
          if (data.code) {
            initialCodeShownRef.current = true
            onCode(String(data.code))
          } else {
            onInfo('⚠️ แจ้งเตือน', 'ยูสเซอร์นี้ได้ทำการตอบคำถามของวันนี้ไปแล้วค่ะ\n\nรอติดตามกิจกรรมในวันถัดไปนะคะ! 🎮')
          }
          setAnswer('')
          return
        }
      }

      const ans = answer.trim()
      const correct = clean(ans) === clean(game.puzzle?.answer || '')

      if (!correct) {
        await writeTimelineOnly({ user: player, answer: ans, correct: false })
        setAnswer('')
        onInfo('❌ คำตอบไม่ถูกต้อง', 'คำตอบที่คุณกรอกไม่ถูกต้อง\n\nลองคิดใหม่และตอบอีกครั้งนะคะ! 🤔')
        return
      }

      // ถูกต้อง → ตรวจสอบโค้ดก่อน
      const code = await claimCode()

      if (code === 'ALREADY') {
        // ถ้าเคยได้แล้ว พยายามดึง code เดิมมาโชว์ให้ (ไม่สนใจ version)
        const prevCode = await getExistingCode()
        await writeAnswer({ user: player, answer: ans, correct: true, ...(prevCode ? { code: prevCode } : {}) })
        if (prevCode) {
          initialCodeShownRef.current = true
          onCode(prevCode)
        } else {
          onInfo('🎁 คุณรับโค้ดไปแล้ว', `ยินดีด้วย! USER ${player} ได้รับโค้ดรางวัลไปก่อนหน้านี้แล้ว\n\nโค้ดของคุณถูกบันทึกไว้ในระบบแล้วค่ะ! ✨`)
        }
      } else if (code === 'EMPTY') {
        // เมื่อโค้ดเต็มแล้ว ไม่บันทึกคำตอบและไม่ให้โค้ด
        onInfo('🎉 โค้ดเต็มแล้วค่ะ', 'ขออภัยค่ะ โค้ดรางวัลในเกมนี้ได้ถูกแจกหมดแล้ว\n\nรอติดตามกิจกรรมรอบหน้าค่ะ! 🎮')
      } else if (typeof code === 'string') {
        try { await navigator.clipboard.writeText(code) } catch {}
        await writeAnswer({ user: player, answer: ans, correct: true, code })
        initialCodeShownRef.current = true
        onCode(code)            // 👉 parent เปิด popup โค้ด
      } else {
        onInfo('⚠️ เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการรับโค้ดรางวัล\n\nกรุณาลองใหม่อีกครั้งภายหลังค่ะ')
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