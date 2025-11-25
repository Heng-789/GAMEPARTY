import React from 'react'
import { dataCache } from '../services/cache'
import { getAnswers, submitAnswer, claimCode } from '../services/postgresql-adapter'
import { getImageUrl } from '../services/image-upload'

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
      // 1. ตรวจสอบจาก claimedBy (ใน game data)
      const claimed = (game as any)?.claimedBy
      const claimedEntry = claimed && typeof claimed === 'object' ? claimed[player] : undefined
      if (
        claimedEntry &&
        typeof claimedEntry === 'object' &&
        claimedEntry.code
      ) {
        return String(claimedEntry.code)
      }

      // 2. ตรวจสอบจาก answers (PostgreSQL) - หาล่าสุดที่ถูกต้องและมี code
      const answersCacheKey = `answers:${gameId}:${player}`
      let answersData = dataCache.get<any[]>(answersCacheKey)
      
      if (!answersData) {
        try {
          const answers = await getAnswers(gameId, 100) // Get last 100 answers
          // Filter for this player's correct answers with codes
          answersData = answers
            .filter((a: any) => 
              a.userId === player && 
              a.correct === true && 
              a.code
            )
            .sort((a: any, b: any) => 
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            )
          // Cache ไว้ 2 นาที
          dataCache.set(answersCacheKey, answersData, 2 * 60 * 1000)
        } catch (error) {
          console.error('Error fetching answers:', error)
          answersData = []
        }
      }
      
      // Return the most recent code
      if (answersData && answersData.length > 0) {
        const latestAnswer = answersData[0]
        if (latestAnswer.code) {
          return String(latestAnswer.code)
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
    try {
      await submitAnswer(gameId, player, payload.answer || '', payload.correct || false, payload.code)
      // Invalidate cache after submitting
      dataCache.delete(`answers:${gameId}:${player}`)
      dataCache.delete(`answers:${gameId}`)
    } catch (error) {
      console.error('Error writing answer:', error)
      throw error
    }
  }

  /** บันทึกเฉพาะ timeline (ตอนตอบผิด) */
  const writeTimelineOnly = async (payload: Record<string, any>) => {
    try {
      await submitAnswer(gameId, player, payload.answer || '', false)
      // Invalidate cache after submitting
      dataCache.delete(`answers:${gameId}:${player}`)
      dataCache.delete(`answers:${gameId}`)
    } catch (error) {
      console.error('Error writing timeline only:', error)
      throw error
    }
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

      // เช็คซ้ำว่าเคยตอบแล้วไหม (เฉพาะ version ปัจจุบัน) - ใช้ PostgreSQL
      const answersCacheKey = `answers:${gameId}:${player}`
      let answersData = dataCache.get<any[]>(answersCacheKey)
      
      if (!answersData) {
        try {
          const answers = await getAnswers(gameId, 100)
          // Filter for this player's answers
          answersData = answers
            .filter((a: any) => a.userId === player)
            .sort((a: any, b: any) => 
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            )
          // Cache ไว้ 2 นาที
          dataCache.set(answersCacheKey, answersData, 2 * 60 * 1000)
        } catch (error) {
          console.error('Error fetching answers:', error)
          answersData = []
        }
      }
      
      // Check if user already answered correctly (with code in current version)
      const latestCorrectAnswer = answersData?.find((a: any) => 
        a.correct === true && 
        a.code &&
        (!codesVersion || true) // For now, don't check version
      )
      
      if (latestCorrectAnswer && latestCorrectAnswer.code) {
        // ถ้ามีโค้ดใน version ปัจจุบัน ให้แสดงโค้ด
        initialCodeShownRef.current = true
        onCode(String(latestCorrectAnswer.code))
        setAnswer('')
        return
      } else if (latestCorrectAnswer) {
        onInfo('⚠️ แจ้งเตือน', 'ยูสเซอร์นี้ได้ทำการตอบคำถามของวันนี้ไปแล้วค่ะ\n\nรอติดตามกิจกรรมในวันถัดไปนะคะ! 🎮')
        setAnswer('')
        return
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
      const code = await claimCode(gameId, player)

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
      {!!img && <img src={getImageUrl(img)} className="play-image" alt="puzzle" />}

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