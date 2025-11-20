import React, { useState } from 'react'
import { db } from '../services/firebase'
import { ref, get, set, runTransaction } from 'firebase/database'
import { dataCache } from '../services/cache'
import '../styles/trickortreat.css'
import { useThemeImages } from '../hooks/useThemeAssets'
import GhostFullscreen from './GhostFullscreen'

type GameType =
  | 'เกมทายภาพปริศนา'
  | 'เกมทายเบอร์เงิน'
  | 'เกมทายผลบอล'
  | 'เกมสล็อต'
  | 'เกมเช็คอิน'
  | 'เกม Trick or Treat'

type GameData = {
  id: string
  type: GameType
  name: string
  codes?: string[] | Record<string, string>
  codeCursor?: number
  claimedBy?: Record<string, { idx: number; code: string; ts: number } | any>
  trickOrTreat?: { 
    winChance?: number
    ghostImage?: string
  }
}

type Props = {
  gameId: string
  game: GameData
  username: string
  onInfo: (title: string, message: string) => void
  onCode: (code: string) => void
}

const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '').toUpperCase()

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

export default function TrickOrTreatGame({ gameId, game, username, onInfo, onCode }: Props) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [won, setWon] = useState(false)
  const themeImages = useThemeImages()
  const [submitting, setSubmitting] = useState(false)
  const [showGhost, setShowGhost] = useState(false)

  const player = normalizeUser(username)
  
  /** บันทึก timeline + index */
  const writeGameResult = async (payload: Record<string, any>) => {
    const ts = Date.now()
    await Promise.all([
      set(ref(db, `answers/${gameId}/${ts}`), payload),
      set(ref(db, `answersIndex/${gameId}/${player}`), { ...payload, ts }),
    ])
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
    if (total <= 0 || cursor >= total) {
      return 'EMPTY'
    }

    return null
  }


  const selectCard = async (cardIndex: number) => {
    if (!player) { 
      onInfo('👤 ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นที่หน้าแรกเพื่อเริ่มเล่นเกม')
      return 
    }
    

    setSubmitting(true)
    
    try {
      // ✅ OPTIMIZED: เช็คซ้ำว่าเคยเล่นแล้วไหม - ใช้ cache
      const answersIndexCacheKey = `answersIndex:${gameId}:${player}`
      let dupData = dataCache.get<any>(answersIndexCacheKey)
      
      if (!dupData) {
        const dup = await get(ref(db, `answersIndex/${gameId}/${player}`))
        if (dup.exists()) {
          dupData = dup.val()
          // Cache ไว้ 2 นาที
          dataCache.set(answersIndexCacheKey, dupData, 2 * 60 * 1000)
        }
      }
      
      if (dupData) {
        onInfo('⚠️ แจ้งเตือน', 'ยูสเซอร์นี้ได้ทำการเล่นเกมของวันนี้ไปแล้วค่ะ\n\nรอติดตามกิจกรรมในวันถัดไปนะคะ! 🎮')
        return
      }

      setSelectedCard(cardIndex)
      setIsPlaying(true)

      // รอให้ animation card flip เสร็จ
      setTimeout(async () => {
        const winChance = game.trickOrTreat?.winChance ?? 50 // default 50%
        const randomNum = Math.random() * 100
        const isWin = randomNum < winChance
        
        setWon(isWin)
        setShowResult(true)
        setIsPlaying(false) // หยุด animation

        if (isWin) {
          // ชนะ - ได้โค้ด
          const code = await claimCode()
          
          if (code === 'ALREADY') {
            // ✅ OPTIMIZED: ถ้าเคยได้แล้ว ดึงโค้ดเดิมมา - ใช้ cache
            let prevCode: string | undefined
            try {
              const answersCacheKey = `answers:${gameId}`
              let answers = dataCache.get<Record<string, any>>(answersCacheKey)
              
              if (!answers) {
                const answersSnap = await get(ref(db, `answers/${gameId}`))
                if (answersSnap.exists()) {
                  answers = answersSnap.val() || {}
                  // Cache ไว้ 1 นาที (ข้อมูล answers เปลี่ยนบ่อย)
                  dataCache.set(answersCacheKey, answers, 60 * 1000)
                } else {
                  answers = {}
                }
              }
              
              if (answers && typeof answers === 'object') {
                for (const [timestamp, data] of Object.entries(answers)) {
                  if (
                    data &&
                    typeof data === 'object' &&
                    'user' in data &&
                    (data as any).user === player &&
                    'won' in data &&
                    (data as any).won === true &&
                    'code' in data &&
                    (data as any).code
                  ) {
                    prevCode = String((data as any).code)
                    break
                  }
                }
              }
            } catch {}
            
            await writeGameResult({ user: player, cardSelected: cardIndex, won: true, ...(prevCode ? { code: prevCode } : {}) })
            if (prevCode) {
              onCode(prevCode)
            } else {
              onInfo('🎁 คุณรับโค้ดไปแล้ว', `ยินดีด้วย! USER ${player} ได้รับโค้ดรางวัลไปก่อนหน้านี้แล้ว\n\nโค้ดของคุณถูกบันทึกไว้ในระบบแล้วค่ะ! ✨`)
            }
          } else if (code === 'EMPTY') {
            await writeGameResult({ user: player, cardSelected: cardIndex, won: true })
            onInfo('🎉 โค้ดเต็มแล้วค่ะ', 'ขออภัยค่ะ โค้ดรางวัลในเกมนี้ได้ถูกแจกหมดแล้ว\n\nรอติดตามกิจกรรมรอบหน้าค่ะ! 🎮')
          } else if (typeof code === 'string') {
            try { await navigator.clipboard.writeText(code) } catch {}
            await writeGameResult({ user: player, cardSelected: cardIndex, won: true, code })
            onCode(code)
          } else {
            onInfo('⚠️ เกิดข้อผิดพลาด', 'เกิดข้อผิดพลาดในการรับโค้ดรางวัล\n\nกรุณาลองใหม่อีกครั้งภายหลังค่ะ')
          }
        } else {
          // แพ้ - ไม่ได้โค้ด
          await writeGameResult({ user: player, cardSelected: cardIndex, won: false })
          // แสดงผีเต็มหน้าจอ
          setShowGhost(true)
        }
      }, 1500) // รอ 1.5 วินาทีให้การ์ดพลิก
      
    } finally {
      setSubmitting(false)
    }
  }

  const resetGame = () => {
    setSelectedCard(null)
    setIsPlaying(false)
    setShowResult(false)
    setWon(false)
  }

  return (
    <div className="trickortreat-container">
      {/* แสดงผีเต็มหน้าจอ */}
      <GhostFullscreen 
        isVisible={showGhost}
        onClose={() => setShowGhost(false)}
        duration={3000}
        ghostImage={themeImages.ghost}
      />

      <div>
        <h2 className="trickortreat-title">🎃 Trick or Treat! 🎃</h2>
        <p className="trickortreat-description">
          เลือกการ์ด 1 ใบจาก 2 ใบ มีโอกาสได้โค้ดรางวัล!
        </p>
      </div>

      <div className="trickortreat-cards-container">
        {[0, 1].map(index => (
          <div
            key={index}
            className={`trick-card ${selectedCard === index ? 'selected' : ''} ${isPlaying && selectedCard === index ? 'flipping' : ''}`}
            onClick={() => !isPlaying && !submitting && selectCard(index)}
          >
            {selectedCard === index && isPlaying ? (
              <div className="trick-card-content">
                <img 
                  src={themeImages.card1} 
                  alt="Card" 
                  className="trick-card-image"
                />
              </div>
            ) : selectedCard === index && showResult ? (
              <div className="trick-card-content">
                <img 
                  src={won ? themeImages.card2 : themeImages.card3} 
                  alt={won ? "Win Card" : "Lose Card"} 
                  className="trick-card-image"
                />
              </div>
            ) : (
              <div className="trick-card-content">
                <img 
                  src={themeImages.card1} 
                  alt="Card" 
                  className="trick-card-image"
                />
              </div>
            )}
            
            {!isPlaying && (
              <div className="trick-card-number">
                การ์ดที่ {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      {submitting && (
        <p className="trickortreat-submitting">
          กำลังเปิดการ์ด... 🎴
        </p>
      )}

      {!isPlaying && !submitting && (
        <p className="trickortreat-instruction">
          คลิกที่การ์ดที่คุณต้องการเลือก
        </p>
      )}
    </div>
  )
}
