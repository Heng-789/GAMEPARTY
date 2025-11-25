import React, { useState } from 'react'
// ✅ Removed Firebase imports - using PostgreSQL 100%
import { dataCache } from '../services/cache'
import '../styles/trickortreat.css'
import { useThemeImages } from '../hooks/useThemeAssets'
import GhostFullscreen from './GhostFullscreen'
import * as postgresqlAdapter from '../services/postgresql-adapter'

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
    // ✅ ใช้ PostgreSQL 100%
    await postgresqlAdapter.submitAnswer(
      gameId,
      player,
      payload.answer || `trickortreat:${payload.won ? 'won' : 'lost'}`,
      payload.won || false,
      payload.code || null
    )
  }

  /** เคลมโค้ดแบบคิวเดียว (atomic) — ใช้ PostgreSQL 100% */
  const claimCode = async (): Promise<'ALREADY'|'EMPTY'|string|null> => {
    // ✅ ใช้ PostgreSQL 100%
    const result = await postgresqlAdapter.claimCode(gameId, player)
    if (result === 'SUCCESS' || typeof result === 'string') {
      return result === 'SUCCESS' ? null : result
    }
    return result
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
        // ✅ ใช้ PostgreSQL 100%
        const answers = await postgresqlAdapter.getAnswers(gameId, 100)
        const playerAnswers = answers.filter((a: any) => 
          a.userId === player && a.correct === true
        )
        if (playerAnswers.length > 0) {
          const latestAnswer = playerAnswers.sort((a: any, b: any) => 
            (b.ts || 0) - (a.ts || 0)
          )[0]
          dupData = {
            code: latestAnswer.code,
            won: latestAnswer.correct,
            ts: latestAnswer.ts
          }
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
            // ✅ ใช้ PostgreSQL 100% - ดึงโค้ดเดิมจาก answers
            let prevCode: string | undefined
            try {
              const answers = await postgresqlAdapter.getAnswers(gameId, 100)
              const playerAnswers = answers.filter((a: any) => 
                a.userId === player && a.correct === true && a.code
              )
              if (playerAnswers.length > 0) {
                const latestAnswer = playerAnswers.sort((a: any, b: any) => 
                  (b.ts || 0) - (a.ts || 0)
                )[0]
                prevCode = latestAnswer.code
              }
            } catch (error) {
              console.error('Error fetching previous code:', error)
            }
            
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
