// src/components/LoyKrathongGame.tsx
import React, { useState, useEffect } from 'react'
import { db } from '../services/firebase'
import { ref, runTransaction, set, get, onValue, off, query, orderByChild, limitToLast, remove } from 'firebase/database'
import { dataCache } from '../services/cache'
import { useTheme, useThemeAssets, useThemeColors, useThemeBranding } from '../contexts/ThemeContext'
import * as postgresqlAdapter from '../services/postgresql-adapter'

type Props = {
  gameId: string
  game: any
  username: string
  onInfo?: (title: string, message: string) => void
  onCode?: (code: string) => void
}

export default function LoyKrathongGame({ gameId, game, username, onInfo, onCode }: Props) {
  const { themeName } = useTheme()
  const branding = useThemeBranding()
  const colors = useThemeColors()
  const assets = useThemeAssets()
  
  const [otherKrathongs, setOtherKrathongs] = useState<Array<{name: string, x: number, y: number, id: number, direction: number, speed: number, image: string, isBigPrize?: boolean, userId: string}>>([])
  const [isFloating, setIsFloating] = useState(false)
  const [receivedCode, setReceivedCode] = useState<string | null>(null)
  const [isBigPrizeReceived, setIsBigPrizeReceived] = useState(false)

  // ล้างกระทงเก่าที่ไม่มี field image เมื่อ component mount
  useEffect(() => {
    setOtherKrathongs([])
  }, [])

  // ✅ OPTIMIZED: ตรวจสอบและแสดงโค้ดรางวัลที่ได้รับไว้เมื่อ USER เข้าออกแล้วกลับมา - ใช้ cache
  useEffect(() => {
    const checkPreviousCode = async () => {
      const player = String(username || localStorage.getItem('player_name') || '').trim().toUpperCase()
      if (!player || !gameId) return

      try {
        const answersIndexCacheKey = `answersIndex:${gameId}:${player}`
        let prev = dataCache.get<any>(answersIndexCacheKey)
        
        if (!prev) {
          // Use PostgreSQL adapter if available
          try {
            const answers = await postgresqlAdapter.getAnswers(gameId, 100)
            const playerAnswers = answers.filter((a: any) => 
              a.userId === player && a.correct === true && a.code
            )
            if (playerAnswers.length > 0) {
              const latestAnswer = playerAnswers.sort((a: any, b: any) => 
                (b.ts || 0) - (a.ts || 0)
              )[0]
              prev = {
                code: latestAnswer.code,
                isBigPrize: latestAnswer.isBigPrize || false,
                ts: latestAnswer.ts
              }
              // Cache ไว้ 2 นาที
              dataCache.set(answersIndexCacheKey, prev, 2 * 60 * 1000)
            }
          } catch (error) {
            console.error('Error checking previous code from PostgreSQL, falling back to Firebase:', error)
            // Fallback to Firebase
            const prevAnswerRef = ref(db, `answersIndex/${gameId}/${player}`)
            const prevAnswer = await get(prevAnswerRef)
            
            if (prevAnswer.exists()) {
              prev = prevAnswer.val() || {}
              // Cache ไว้ 2 นาที
              dataCache.set(answersIndexCacheKey, prev, 2 * 60 * 1000)
            }
          }
        }
        
        // ถ้ามีโค้ดที่ได้รับไว้ ให้แสดงโค้ดนั้น
        if (prev && prev.code) {
          setReceivedCode(prev.code)
          setIsBigPrizeReceived(prev.isBigPrize || false)
        }
      } catch (error) {
        console.error('Error checking previous code:', error)
        // ไม่แสดง error ให้ user เพื่อไม่ให้รบกวน UX
      }
    }

    checkPreviousCode()
  }, [gameId, username])


  // ✅ OPTIMIZED: ระบบ realtime สำหรับกระทงของ USER อื่นๆ - เพิ่ม throttle
  // ✅ ปรับปรุง: ใช้ flat structure และ query เพื่อลดการดาวน์โหลดข้อมูล
  useEffect(() => {
    // ใช้ flat structure สำหรับ query ที่มีประสิทธิภาพ
    // โครงสร้าง: krathongs/{gameId}/recent/{krathongId}
    const krathongsRef = query(
      ref(db, `krathongs/${gameId}/recent`),
      orderByChild('timestamp'),
      limitToLast(50) // ✅ ดาวน์โหลดแค่ 50 กระทงล่าสุดเท่านั้น
    )
    
    // ✅ เพิ่ม throttle เพื่อลด download
    let throttleTimer: NodeJS.Timeout | null = null
    let lastUpdateTime = 0
    const THROTTLE_MS = 500 // Update at most once every 500ms
    
    const updateKrathongs = (snapshot: any) => {
      const data = snapshot.val()
      if (data) {
        const krathongsList: Array<{name: string, x: number, y: number, id: number, direction: number, speed: number, image: string, isBigPrize?: boolean, userId: string, timestamp?: number}> = []
        
        // ข้อมูลจาก query จะเป็น flat structure แล้ว
        Object.keys(data).forEach(krathongId => {
          const krathong = data[krathongId]
          if (krathong && krathong.name) {
            krathongsList.push({
              ...krathong,
              userId: krathong.userId || krathong.name, // ใช้ userId จากข้อมูลหรือ fallback เป็น name
              id: krathongId
            })
          }
        })
        
        // เรียงลำดับกระทงตามเวลา (ใหม่ไปเก่า) - query ควรเรียงให้แล้ว แต่เพื่อความแน่ใจ
        krathongsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        
        setOtherKrathongs(prev => {
          // เก็บกระทงที่มีอยู่แล้วและอัปเดตเฉพาะกระทงใหม่หรือที่เปลี่ยนแปลง
          const existingKrathongs = new Map()
          prev.forEach(krathong => {
            existingKrathongs.set(`${krathong.userId}-${krathong.id}`, krathong)
          })
          
          // เพิ่มกระทงใหม่และอัปเดตกระทงที่มีอยู่แล้ว
          krathongsList.forEach(newKrathong => {
            const key = `${newKrathong.userId}-${newKrathong.id}`
            const existing = existingKrathongs.get(key)
            
            if (existing) {
              // ถ้ามีอยู่แล้ว ให้เก็บตำแหน่งปัจจุบันไว้ (ไม่รีเซ็ต)
              existingKrathongs.set(key, {
                ...newKrathong,
                x: existing.x, // เก็บตำแหน่ง X ที่เคลื่อนไหวอยู่
                y: existing.y  // เก็บตำแหน่ง Y ที่เคลื่อนไหวอยู่
              })
            } else {
              // ถ้าเป็นกระทงใหม่ ให้ใช้ตำแหน่งเริ่มต้น
              existingKrathongs.set(key, newKrathong)
            }
          })
          
          return Array.from(existingKrathongs.values())
        })
      } else {
        setOtherKrathongs([])
      }
    }
    
    const unsubscribe = onValue(krathongsRef, (snapshot) => {
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTime
      
      // If enough time has passed, update immediately
      if (timeSinceLastUpdate >= THROTTLE_MS) {
        lastUpdateTime = now
        updateKrathongs(snapshot)
      } else {
        // Otherwise, schedule an update
        if (throttleTimer) {
          clearTimeout(throttleTimer)
        }
        throttleTimer = setTimeout(() => {
          lastUpdateTime = Date.now()
          updateKrathongs(snapshot)
        }, THROTTLE_MS - timeSinceLastUpdate)
      }
    }, (error) => {
      console.error('🔥 Firebase listener error:', error)
    })

    return () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer)
      }
      off(krathongsRef, 'value', unsubscribe)
    }
  }, [gameId])

  // ฟังก์ชันลอยกระทง
  const spawnKrathong = async (playerName: string, isBigPrize: boolean = false) => {
    // สุ่มรูปกระทงจาก 3 รูป หรือใช้ krathong3.png สำหรับรางวัลใหญ่
    const krathongImages = ['krathong.png', 'krathong1.png', 'krathong2.png']
    const randomImage = isBigPrize ? 'krathong3.png' : krathongImages[Math.floor(Math.random() * krathongImages.length)]
    
    // สุ่มตำแหน่ง Y ในพื้นที่น้ำของรูปภาพ (ประมาณ 60-75% ของความสูง) เพิ่มช่วงให้กว้างขึ้น
    const waterAreaMin = 60 // เริ่มต้นพื้นที่น้ำที่ 60%
    const waterAreaMax = 75 // สิ้นสุดพื้นที่น้ำที่ 75% (เพิ่มช่วงให้กว้างขึ้น)
    const randomY = waterAreaMin + Math.random() * (waterAreaMax - waterAreaMin)
    
    // สุ่มตำแหน่ง X เริ่มต้นเพื่อให้กระทงดูธรรมชาติ (ไม่เริ่มจากตำแหน่งเดียวกันทุกครั้ง)
    const containerElement = document.querySelector('.krathong-overlay-container')
    const containerWidth = containerElement ? containerElement.clientWidth : 500
    const randomStartX = Math.random() * (containerWidth * 0.3) // สุ่มตำแหน่งเริ่มต้นใน 30% แรกของความกว้าง
    
    const krathongId = Date.now() + Math.random()
    const krathongIdSafe = String(krathongId).replace(/\./g, '_') // แทนที่จุดด้วย underscore
    const newKrathong = {
      name: playerName,
      x: randomStartX, // สุ่มตำแหน่งเริ่มต้นแทนที่จะเริ่มจาก 0
      y: randomY, // สุ่มตำแหน่ง Y ในจุดปล่อยกระทง
      id: krathongIdSafe, // ใช้ ID ที่ปลอดภัยสำหรับ Firebase
      direction: 1, // เคลื่อนที่ในแกน X เท่านั้น (1 = ขวา)
      speed: 0.2 + Math.random() * 0.8, // ความเร็วสุ่มระหว่าง 0.2-1.0
      image: randomImage, // เพิ่มรูปกระทงที่สุ่มได้
      isBigPrize: isBigPrize, // เพิ่ม flag สำหรับรางวัลใหญ่
      timestamp: Date.now()
    }
    
    // บันทึกกระทงลง Firebase เพื่อให้ USER อื่นๆ เห็น
    try {
      // ✅ ใช้ flat structure สำหรับ query ที่มีประสิทธิภาพ
      const krathongData = {
        ...newKrathong,
        userId: playerName // เพิ่ม userId ในข้อมูลเพื่อให้ query ง่ายขึ้น
      }
      
      // บันทึกใน flat structure สำหรับ query (recent)
      const recentKrathongRef = ref(db, `krathongs/${gameId}/recent/${krathongIdSafe}`)
      await set(recentKrathongRef, krathongData)
      
      // ✅ ลบกระทงเก่าที่เกิน 30 อันเพื่อป้องกันข้อมูลเติบโตเกินไป
      // ใช้ setTimeout เพื่อไม่ให้บล็อกการบันทึก
      setTimeout(async () => {
        try {
          const recentRef = ref(db, `krathongs/${gameId}/recent`)
          const snapshot = await get(query(recentRef, orderByChild('timestamp')))
          
          if (snapshot.exists()) {
            const data = snapshot.val()
            const krathongs = Object.keys(data)
              .map(id => ({ id, timestamp: data[id].timestamp || 0 }))
              .sort((a, b) => a.timestamp - b.timestamp) // เรียงจากเก่าไปใหม่
            
            // ลบกระทงเก่าที่เกิน 30 อัน (เก็บไว้ 30 อันล่าสุด)
            if (krathongs.length > 30) {
              const toDelete = krathongs.slice(0, krathongs.length - 30)
              const deletePromises = toDelete.map(k => remove(ref(db, `krathongs/${gameId}/recent/${k.id}`)))
              await Promise.all(deletePromises)
            }
          }
        } catch (cleanupError) {
          console.error('Error cleaning up old krathongs:', cleanupError)
          // ไม่ throw error เพื่อไม่ให้กระทบการบันทึกหลัก
        }
      }, 1000)
      
      // เก็บข้อมูลใน nested structure เดิมเพื่อ backward compatibility (ถ้ามีโค้ดอื่นใช้)
      const legacyKrathongRef = ref(db, `krathongs/${gameId}/${playerName}/${krathongIdSafe}`)
      await set(legacyKrathongRef, newKrathong)
    } catch (error) {
      console.error('Error saving krathong:', error)
    }
    
    // ไม่เพิ่มกระทงใน state ของตัวเอง เพราะจะแสดงจาก Firebase แทน
  }

  // ฟังก์ชันเคลื่อนไหวกระทงแบบซ้าย-ขวา
  useEffect(() => {
    if (otherKrathongs.length === 0) return

    const interval = setInterval(() => {
      // อัปเดตกระทงของ USER อื่นๆ (รวมกระทงของตัวเองด้วย)
      setOtherKrathongs(prev => prev.map(krathong => {
        // ใช้ขนาดจริงของรูปภาพแทนการกำหนดตายตัว
        const containerElement = document.querySelector('.krathong-overlay-container')
        const containerWidth = containerElement ? containerElement.clientWidth : 500
        const containerHeight = containerElement ? containerElement.clientHeight : 300
        
        // ปรับขนาดกระทงตามประเภทรางวัล
        const isBigPrize = krathong.isBigPrize || false
        const krathongWidth = isBigPrize ? 80 : 60 // ขนาดกระทงรางวัลใหญ่ใหญ่กว่า
        const krathongHeight = isBigPrize ? 80 : 60 // ขนาดกระทงรางวัลใหญ่ใหญ่กว่า
        
        // คำนวณตำแหน่งใหม่ (เคลื่อนที่ขวา)
        let newX = krathong.x + krathong.speed
        
        // ตรวจสอบขอบเขตและรีเซ็ตตำแหน่งเมื่อถึงด้านขวา
        if (newX >= containerWidth - krathongWidth) {
          newX = 0 // รีเซ็ตกลับด้านซ้าย
        }
        
        // เพิ่มการเคลื่อนไหว Y เล็กน้อยเพื่อให้ดูธรรมชาติ (คล้ายคลื่นน้ำ)
        let newY = krathong.y
        const waterAreaMin = 60 // เริ่มต้นพื้นที่น้ำที่ 60%
        const waterAreaMax = 75 // สิ้นสุดพื้นที่น้ำที่ 75% (เพิ่มช่วงให้กว้างขึ้น)
        
        // เพิ่มการเคลื่อนไหว Y เล็กน้อย (คล้ายคลื่นน้ำ) ทุกๆ 60 frames (ประมาณ 1 วินาที)
        const frameCount = Math.floor(Date.now() / 16) // คำนวณ frame count
        if (frameCount % 60 === 0) {
          const waveMovement = (Math.random() - 0.5) * 2 // สุ่มการเคลื่อนไหว ±1%
          newY = Math.max(waterAreaMin, Math.min(waterAreaMax, newY + waveMovement))
        }
        
        // ตรวจสอบให้แน่ใจว่า Y อยู่ในพื้นที่น้ำของ container
        if (newY < waterAreaMin) newY = waterAreaMin
        if (newY > waterAreaMax) newY = waterAreaMax
        
        return { ...krathong, x: newX, y: newY }
      }))
    }, 16) // 60 FPS เพื่อให้สมูท

    return () => clearInterval(interval)
  }, [otherKrathongs.length])

  const handleRelease = async () => {
    const player = String(username || localStorage.getItem('player_name') || '').trim().toUpperCase()
    if (!player) {
      onInfo?.('ต้องใส่ชื่อก่อนเล่น', 'กรุณากรอกชื่อผู้เล่นเพื่อเริ่มเล่นเกม')
      return
    }

    if (isFloating) return // ป้องกันการกดซ้ำ

    setIsFloating(true)

    try {
      // ✅ OPTIMIZED: กันเล่นซ้ำในวันเดียวกัน - ใช้ cache
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
        const prev = dupData
        if (prev && typeof prev === 'object' && 'code' in prev && prev.code) {
          // ✅ แสดงโค้ดที่ได้รับไว้ก่อนหน้านี้
          setReceivedCode(prev.code)
          setIsBigPrizeReceived(prev.isBigPrize || false)
          setIsFloating(false)
        } else {
          // ถ้าเคยเล่นแต่ไม่มีโค้ด (อาจเป็นกรณีที่โค้ดหมด)
          setTimeout(() => {
            onInfo?.('เคยเล่นแล้ว', `วันนี้ USER ${player} ได้ทำการลอยกระทงไปแล้วนะคะ\n\nรอติดตามกิจกรรมในวันถัดไปนะคะ! 🎋`)
            setIsFloating(false)
          }, 500)
        }
        return
      }

      // ตรวจสอบโค้ดธรรมดาและรางวัลใหญ่
      const codes: string[] = Array.isArray(game?.codes) ? game.codes : []
      const bigPrizeCodes: string[] = Array.isArray(game?.loyKrathong?.bigPrizeCodes) ? game.loyKrathong.bigPrizeCodes : []
      
      if (!codes.length && !bigPrizeCodes.length) { 
        setTimeout(() => {
          onInfo?.('ยังไม่ได้ตั้งค่า CODE', 'กรุณาให้แอดมินตั้งค่าโค้ดสำหรับเกมนี้ก่อน')
          setIsFloating(false)
        }, 2000)
        return 
      }

      // ✅ แก้ไข race condition: ใช้ Firebase counter แทน local state
      // คำนวณว่าผู้เล่นคนนี้ควรได้รับรางวัลใหญ่หรือไม่ (ทุกๆ 20 กระทง)
      const totalCountRef = ref(db, `games/${gameId}/loyKrathong/totalCount`)
      let totalCount = 0
      let isBigPrize = false
      
      // ใช้ transaction เพื่อเพิ่ม counter และตรวจสอบรางวัลใหญ่แบบ atomic
      // Retry มากสุด 3 ครั้งเพื่อจัดการกับ transaction contention
      let retries = 0
      let committed = false
      
      while (!committed && retries < 3) {
        try {
          const result = await runTransaction(totalCountRef, (current: number | null) => {
            const count = Number(current || 0) + 1
            return count
          })
          
          committed = result.committed
          if (committed) {
            totalCount = Number(result.snapshot.val() || 0)
            isBigPrize = totalCount % 20 === 0 && bigPrizeCodes.length > 0
          } else {
            retries++
            // รอเล็กน้อยก่อน retry เพื่อลด contention
            await new Promise(resolve => setTimeout(resolve, 100 * retries))
          }
        } catch (error) {
          console.error('Transaction error:', error)
          retries++
          if (retries >= 3) {
            // ถ้า retry 3 ครั้งแล้วยังไม่สำเร็จ ให้ใช้ค่า default
            const fallbackSnapshot = await get(totalCountRef)
            totalCount = Number(fallbackSnapshot.val() || 0) + 1
            isBigPrize = totalCount % 20 === 0 && bigPrizeCodes.length > 0
            // ยังคงบันทึก counter แม้ transaction จะล้มเหลว
            await set(totalCountRef, totalCount)
          } else {
            await new Promise(resolve => setTimeout(resolve, 100 * retries))
          }
        }
      }

      // เริ่มแอนิเมชันลอยกระทง
      await spawnKrathong(player, isBigPrize)

      // ✅ แจกโค้ด - ใช้ backend endpoints
      let awarded: string | null = null
      let isBigPrizeAwarded = false

      try {
        if (isBigPrize) {
          // แจกรางวัลใหญ่ - ใช้ backend endpoint
          const result = await postgresqlAdapter.claimBigPrizeCode(gameId, player)
          
          if (typeof result === 'string' && result !== 'ALREADY' && result !== 'EMPTY') {
            awarded = result
            isBigPrizeAwarded = true
          } else if (result === 'ALREADY') {
            // เคยได้โค้ดไปแล้ว - ดึงโค้ดเดิมมาแสดง
            const existingAnswers = await postgresqlAdapter.getAnswers(gameId, 100)
            const userAnswer = existingAnswers
              .filter((a: any) => a.userId === player && a.code)
              .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
            
            if (userAnswer?.code) {
              awarded = userAnswer.code
              isBigPrizeAwarded = true
            }
          }
        } else {
          // แจกโค้ดธรรมดา - ใช้ backend endpoint
          const result = await postgresqlAdapter.claimCode(gameId, player)
          
          if (typeof result === 'string' && result !== 'ALREADY' && result !== 'EMPTY') {
            awarded = result
          } else if (result === 'ALREADY') {
            // เคยได้โค้ดไปแล้ว - ดึงโค้ดเดิมมาแสดง
            const existingAnswers = await postgresqlAdapter.getAnswers(gameId, 100)
            const userAnswer = existingAnswers
              .filter((a: any) => a.userId === player && a.code)
              .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
            
            if (userAnswer?.code) {
              awarded = userAnswer.code
            }
          }
        }
      } catch (error) {
        console.error('Error claiming code:', error)
        // ไม่แสดง error ให้ user เพราะเป็น background operation
      }

      if (awarded) {
        // ✅ ตรวจสอบว่าโค้ดเต็มแล้วหรือไม่ก่อนแสดงโค้ด
        const checkIfCodesExhausted = async () => {
          try {
            // ตรวจสอบโค้ดธรรมดา
            const codeCursorRef = ref(db, `games/${gameId}/codeCursor`)
            const codeCursorSnap = await get(codeCursorRef)
            const codeCursor = Number(codeCursorSnap.val() || 0)
            
            // ตรวจสอบโค้ดรางวัลใหญ่
            const bigPrizeCursorRef = ref(db, `games/${gameId}/loyKrathong/bigPrizeCodeCursor`)
            const bigPrizeCursorSnap = await get(bigPrizeCursorRef)
            const bigPrizeCursor = Number(bigPrizeCursorSnap.val() || 0)
            
            // ตรวจสอบว่าโค้ดทั้งหมดถูกแจกหมดหรือไม่
            const allCodesExhausted = codeCursor >= codes.length && bigPrizeCursor >= bigPrizeCodes.length
            
            if (allCodesExhausted) {
              // โค้ดเต็มแล้ว ไม่ต้องแสดงโค้ด ให้แสดง popup ทันที
              setTimeout(() => {
                onInfo?.('โค้ดเต็มแล้วจ้า', 'รอกิจกรรมถัดไปได้เลยน้าาาา')
                setIsFloating(false)
              }, 2000)
              return true // บอกว่าควบคุมการแสดงผลแล้ว
            }
            return false // ยังไม่เต็ม ต้องแสดงโค้ด
          } catch (error) {
            console.error('Error checking if codes exhausted:', error)
            return false // ถ้าเกิด error ให้แสดงโค้ดปกติ
          }
        }
        
        const isCodesExhausted = await checkIfCodesExhausted()
        
        if (!isCodesExhausted) {
          // โค้ดยังไม่เต็ม ให้บันทึกและแสดงโค้ดตามปกติ
          // เขียน timeline + index สำหรับหน้าแอดมิน (ใช้ PostgreSQL adapter)
          try {
            await postgresqlAdapter.submitAnswer(
              gameId,
              player,
              'ปล่อยกระทง',
              true,
              awarded
            )
          } catch (error) {
            console.error('Error saving answer in PostgreSQL, falling back to Firebase:', error)
            // Fallback to Firebase
            const ts = Date.now()
            const payload: any = { 
              user: player, 
              answer: 'ปล่อยกระทง', 
              code: awarded,
              isBigPrize: isBigPrizeAwarded
            }
            await Promise.all([
              set(ref(db, `answers/${gameId}/${ts}`), payload),
              set(ref(db, `answersIndex/${gameId}/${player}`), { ...payload, ts }),
            ])
          }
          
          // แสดงโค้ดใต้ container หลังจากแอนิเมชัน
          setTimeout(() => {
            setReceivedCode(awarded!) // เก็บโค้ดที่ได้รับ
            setIsBigPrizeReceived(isBigPrizeAwarded) // เก็บข้อมูลว่าเป็นรางวัลใหญ่หรือไม่
            setIsFloating(false)
          }, 2000)
        }
        // ถ้าโค้ดเต็มแล้ว จะไม่เข้าเงื่อนไขนี้ และจะแสดง popup แทน (จัดการใน checkIfCodesExhausted แล้ว)
      } else {
        // ✅ ตรวจสอบว่าโค้ดหมดจริงๆ หรือไม่
        const checkIfCodesExhausted = async () => {
          try {
            const codeCursorRef = ref(db, `games/${gameId}/codeCursor`)
            const codeCursorSnap = await get(codeCursorRef)
            const codeCursor = Number(codeCursorSnap.val() || 0)
            
            const bigPrizeCursorRef = ref(db, `games/${gameId}/loyKrathong/bigPrizeCodeCursor`)
            const bigPrizeCursorSnap = await get(bigPrizeCursorRef)
            const bigPrizeCursor = Number(bigPrizeCursorSnap.val() || 0)
            
            const allCodesExhausted = codeCursor >= codes.length && bigPrizeCursor >= bigPrizeCodes.length
            
            if (allCodesExhausted) {
              setTimeout(() => {
                onInfo?.('โค้ดเต็มแล้วจ้า', 'รอกิจกรรมถัดไปได้เลยน้าาาา')
                setIsFloating(false)
              }, 2000)
            } else {
              setTimeout(() => {
                onInfo?.('โค้ดหมดแล้ว', 'ขออภัยค่ะ โค้ดกิจกรรมถูกแจกครบแล้ว')
                setIsFloating(false)
              }, 2000)
            }
          } catch (error) {
            console.error('Error checking codes:', error)
            setTimeout(() => {
              onInfo?.('โค้ดหมดแล้ว', 'ขออภัยค่ะ โค้ดกิจกรรมถูกแจกครบแล้ว')
              setIsFloating(false)
            }, 2000)
          }
        }
        
        checkIfCodesExhausted()
      }

    } catch (e) {
      console.error(e)
      setTimeout(() => {
        onInfo?.('เกิดข้อผิดพลาด', 'ไม่สามารถแจกโค้ดได้ กรุณาลองใหม่อีกครั้ง')
        setIsFloating(false)
      }, 2000)
    }
  }

  return (
    <div className={`loykrathong loykrathong-${themeName}`} style={{ 
      textAlign: 'center',
      position: 'relative'
    }}>
      {/* เนื้อหาหลัก */}
      <div>
        <h2 style={{
          color: colors.textPrimary,
          fontWeight: 900,
          marginBottom: 8
        }}>{branding.title} - เกมลอยกระทง</h2>
        <p style={{ 
          color: colors.textSecondary, 
          marginBottom: 16
        }}>
          สุขสันต์วันลอยกระทง! อธิษฐานแล้วกดปุ่มปล่อยกระทงเพื่อรับรางวัลพิเศษ
        </p>
        
        {/* Container สำหรับแสดงรูป loykrathong_overlay.jpg และกระทงที่ลอย */}
        <div className="krathong-overlay-container" style={{
          marginBottom: 32,
          display: 'inline-block',
          position: 'relative',
          margin: '0 auto 32px auto',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '900px', // เพิ่มขนาดสูงสุดสำหรับเดสท็อป
          height: '400px', // กำหนดความสูงคงที่
          borderRadius: '16px'
        }}>
          <img 
            src="/image/loykrathong_overlay.jpg" 
            alt="Loy Krathong Overlay"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '16px',
              boxShadow: `0 12px 32px ${colors.shadowLight || 'rgba(0,0,0,0.3)'}`,
              border: `3px solid ${colors.borderLight}`,
              display: 'block'
            }}
          />
          
          {/* จุดปล่อยกระทง (5 ไลน์แนวนอนในพื้นที่น้ำ) */}
          {[60, 62, 64, 66, 68].map((y, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: '0',
                top: `${y}%`,
                width: '100%',
                height: '2px',
                background: `linear-gradient(to right, ${colors.primary}40, transparent)`,
                opacity: 0.3,
                pointerEvents: 'none'
              }}
            />
          ))}
          
          {/* แสดงกระทงที่ลอยอยู่ภายใน container */}
        {/* แสดงกระทงของ USER อื่นๆ */}
        {otherKrathongs.map((krathong) => {
          // ปรับขนาดกระทงตามประเภทรางวัล
          const isBigPrize = krathong.isBigPrize || false
          const krathongSize = isBigPrize ? '80px' : '60px' // รางวัลใหญ่ใหญ่กว่า 20px
          const fontSize = isBigPrize ? '12px' : '10px' // ขนาดตัวอักษรใหญ่ขึ้น
          const padding = isBigPrize ? '3px 8px' : '2px 6px' // padding ใหญ่ขึ้น
          
          // ตรวจสอบว่าเป็นกระทงของตัวเองหรือไม่
          const isOwnKrathong = krathong.name === username
          
          return (
            <div
              key={`other-${krathong.userId}-${krathong.id}`}
              style={{
                position: 'absolute',
                left: `${krathong.x}px`,
                top: `${krathong.y}%`,
                width: krathongSize,
                height: krathongSize,
                transition: 'none', // ปิด transition เพื่อให้ animation ทำงานได้เต็มที่
                zIndex: isOwnKrathong ? 3 : 2, // z-index สูงกว่าสำหรับกระทงของตัวเอง
                opacity: isOwnKrathong ? 1 : 0.8 // ความชัดเจนเต็มที่สำหรับกระทงของตัวเอง
              }}
            >
              <img 
                src={`/image/${krathong.image || 'krathong.png'}`}
                alt="Krathong"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: isBigPrize 
                    ? 'drop-shadow(0 6px 12px rgba(245, 158, 11, 0.4))' // เงาสีทองสำหรับรางวัลใหญ่
                    : 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '-15px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: fontSize,
                color: '#FFFFFF',
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                backgroundColor: isBigPrize 
                  ? 'rgba(245, 158, 11, 0.9)' // พื้นหลังสีทองสำหรับรางวัลใหญ่
                  : 'rgba(0,0,0,0.8)',
                padding: padding,
                borderRadius: '4px',
                border: isBigPrize 
                  ? '1px solid rgba(245, 158, 11, 0.5)' // ขอบสีทอง
                  : '1px solid rgba(255,255,255,0.3)'
              }}>
                {krathong.name}
              </div>
            </div>
          )
        })}
          
        </div>
        
        {/* แสดงโค้ดที่ได้รับใต้ container */}
        {receivedCode && (
          <div style={{
            marginTop: '10px',
            padding: '20px',
            background: `linear-gradient(135deg, ${colors.bgSecondary}, ${colors.bgPrimary})`,
            borderRadius: '16px',
            border: `2px solid ${colors.primary}`,
            textAlign: 'center',
            boxShadow: `0 8px 24px ${colors.shadowLight || 'rgba(0,0,0,0.3)'}`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Background decoration */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '200%',
              height: '200%',
              background: `radial-gradient(circle, ${colors.primary}15 0%, transparent 70%)`,
              pointerEvents: 'none'
            }} />
            
            {/* ตรวจสอบว่าเป็นข้อความแจ้งเตือนหรือโค้ดรางวัล */}
            {receivedCode.includes('USER') && receivedCode.includes('ลอยกระทงไปแล้ว') ? (
              // แสดงข้อความแจ้งเตือน
              <div style={{
                fontSize: '16px',
                color: colors.textPrimary,
                fontWeight: 700,
                position: 'relative',
                zIndex: 1,
                lineHeight: '1.6'
              }}>
                <div style={{
                  fontSize: '18px',
                  color: colors.warning || '#f59e0b',
                  marginBottom: '12px',
                  fontWeight: 900
                }}>
                  ⚠️ แจ้งเตือน
                </div>
                <div style={{
                  fontSize: '16px',
                  color: colors.textPrimary,
                  marginBottom: '8px'
                }}>
                  วันนี้ <span style={{ color: colors.danger || '#ef4444', fontWeight: 900 }}>USER {username}</span> ได้ทำการ <span style={{ color: colors.danger || '#ef4444', fontWeight: 900 }}>ลอยกระทง</span> ไปแล้วนะคะ
                </div>
                <div style={{
                  fontSize: '14px',
                  color: colors.textSecondary,
                  marginBottom: '16px'
                }}>
                  รอติดตามกิจกรรมในวันถัดไปนะคะ! 🎋
                </div>
              </div>
            ) : (
              // แสดงโค้ดรางวัล
              <>
                <div style={{
                  fontSize: '16px',
                  color: colors.textPrimary,
                  marginBottom: '12px',
                  fontWeight: 700,
                  position: 'relative',
                  zIndex: 1
                }}>
                  {isBigPrizeReceived ? '🏆 ยินดีด้วย! คุณได้รับรางวัลใหญ่แล้ว! ✨' : '🎊 ยินดีด้วย! คุณได้รับโค้ดรางวัลแล้ว ✨'}
                </div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color: colors.textInverse,
                  background: isBigPrizeReceived 
                    ? `linear-gradient(135deg, #f59e0b, #d97706)` 
                    : `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: `2px solid ${isBigPrizeReceived ? '#f59e0b' : colors.primary}`,
                  fontFamily: 'monospace',
                  letterSpacing: '3px',
                  marginBottom: '16px',
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: isBigPrizeReceived 
                    ? `0 4px 12px #f59e0b50` 
                    : `0 4px 12px ${colors.primary}50`
                }}>
                  {receivedCode}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(receivedCode)
                      // แสดงข้อความสำเร็จชั่วคราว
                      const originalText = 'คัดลอกโค้ด'
                      const button = event?.target as HTMLButtonElement
                      if (button) {
                        button.textContent = 'คัดลอกแล้ว!'
                        setTimeout(() => {
                          button.textContent = originalText
                        }, 1500)
                      }
                    } catch (err) {
                      console.error('ไม่สามารถคัดลอกได้:', err)
                    }
                  }}
                  style={{
                    background: `linear-gradient(135deg, ${colors.secondary}, ${colors.primary})`,
                    color: colors.textInverse,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    zIndex: 1,
                    boxShadow: `0 4px 12px ${colors.secondary}40`
                  }}
                >
                  คัดลอกโค้ด
                </button>
              </>
            )}
          </div>
        )}
        
        <button
          className="btn-cta btn-cta-green"
          onClick={handleRelease}
          disabled={isFloating}
        >
          {isFloating ? 'กำลังลอยกระทง...' : 'ลอยกระทง'}
        </button>
      </div>
    </div>
  )
}


