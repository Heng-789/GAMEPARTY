
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
// ✅ Removed Firebase imports - using PostgreSQL 100%
import { useTheme, useThemeColors } from '../contexts/ThemeContext'
import UserBar from './UserBar'
import LiveChat from './LiveChat'
import * as postgresqlAdapter from '../services/postgresql-adapter'
import { getWebSocket } from '../services/postgresql-websocket'

type BingoGameProps = {
  gameId: string
  game: any
  username: string
  onInfo: (title: string, message: string) => void
  onCode: (code: string) => void
  isHost?: boolean
}

type Player = {
  userId: string
  username: string
  credit: number
  joinedAt: number
  isReady: boolean
}

type BingoCard = {
  id: string
  numbers: number[][]
  userId: string
  createdAt: number
  isBingo?: boolean
  checkedNumbers?: boolean[][]
}

/** แปลงชื่อให้เป็นรูปแบบคีย์ใน DB (ตัดช่องว่างและอักขระพิเศษ) */
const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '').replace(/[.#$[\]@]/g, '_').toUpperCase()

/** แปลง hex เป็น rgba */
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function BingoGame({ gameId, game, username, onInfo, onCode, isHost = false }: BingoGameProps) {
  const { themeName, theme } = useTheme()
  const colors = useThemeColors()
  
  // Helper function to get theme display name (ลบคำว่า PARTY ออก)
  const getThemeDisplayName = () => {
    return theme.branding.title.replace(' PARTY', '').replace(' party', '')
  }
  
  // Helper function to get host username based on theme
  const getHostUsername = () => {
    if (themeName === 'max56') return 'MAX56'
    if (themeName === 'jeed24') return 'JEED24'
    return 'HENG36'
  }
  
  const [players, setPlayers] = useState<Player[]>([])
  const [currentUser, setCurrentUser] = useState<Player | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isUpdatingReady, setIsUpdatingReady] = useState(false)
  const [bingoCards, setBingoCards] = useState<BingoCard[]>([])
  const [isGeneratingCard, setIsGeneratingCard] = useState(false)
  
  // เก็บ debounce timers สำหรับแต่ละการ์ด เพื่อจำกัดการ write ลง Firebase
  const cardUpdateTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // เก็บ local checkedNumbers ที่ยังไม่ได้บันทึกลง Firebase เพื่อไม่ให้ถูกเขียนทับ
  const pendingCheckedNumbersRef = useRef<Map<string, boolean[][]>>(new Map())
  
  // เก็บ latest checkedNumbers สำหรับแต่ละการ์ด - เป็น source of truth
  // เพื่อป้องกันการเขียนทับจาก Firebase update
  const latestCheckedNumbersRef = useRef<Map<string, boolean[][]>>(new Map())
  
  // ระบบเกม BINGO
  const [gameStatus, setGameStatus] = useState<'waiting' | 'countdown' | 'playing' | 'finished'>('waiting')
  const [countdown, setCountdown] = useState(3)
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([])
  
  // สำหรับ HOST: โหลดสถานะเกม
  const [bingoGameStatus, setBingoGameStatus] = useState<'waiting' | 'countdown' | 'playing' | 'finished' | null>(null)
  const [currentNumber, setCurrentNumber] = useState<number | null>(null)
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [winner, setWinner] = useState<{username: string, cardId: string} | null>(null)
  const [winnerCode, setWinnerCode] = useState<string | null>(null)
  const [showGameStartedPopup, setShowGameStartedPopup] = useState(false)
  const [showNotReadyPopup, setShowNotReadyPopup] = useState(false)

  const userKey = normalizeUser(username)

  // ตรวจสอบเมื่อ USER เข้าระบบใหม่ในขณะที่เกมเริ่มแล้ว (ไม่แสดงสำหรับ HOST)
  useEffect(() => {
    // ✅ สำหรับ HOST: ไม่แสดง popup นี้
    if (isHost) {
      setShowGameStartedPopup(false)
      return
    }
    
    if (!gameId || !currentUser) return

    // ✅ ปิด popup ทันทีถ้า gameStatus ไม่ใช่ 'playing' หรือ 'countdown'
    if (gameStatus !== 'playing' && gameStatus !== 'countdown') {
      setShowGameStartedPopup(false)
      return
    }

    // ตรวจสอบว่าเกมเริ่มแล้วหรือไม่
    if (gameStatus === 'playing' || gameStatus === 'countdown') {
      // ตรวจสอบว่า USER เข้าระบบใหม่หรือไม่ (ไม่มีการ์ด BINGO)
      if (bingoCards.length === 0) {
        setShowGameStartedPopup(true)
      } else {
        setShowGameStartedPopup(false)
      }
    }
  }, [gameId, currentUser, gameStatus, bingoCards.length, isHost])

  // ฟังก์ชันปิด popup
  const handleCloseGameStartedPopup = () => {
    setShowGameStartedPopup(false)
  }

  // ฟังก์ชันเด้งไปลิงก์ตามธีม
  const handleGoToThemeLink = () => {
    const targetUrl = theme.url || 'https://heng-36z.com/'
    
    // ✅ เปิดในแท็บใหม่แทนการ redirect ทั้งหน้า เพื่อไม่ให้ auth state เปลี่ยน
    try {
      // ใช้ window.open เพื่อเปิดในแท็บใหม่
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      // Fallback: สร้าง link element และคลิก
      const link = document.createElement('a')
      link.href = targetUrl
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
    setShowGameStartedPopup(false)
  }

  // Improved seeded random number generator (Linear Congruential Generator)
  const seededRandom = (seed: number): number => {
    // LCG parameters (used by glibc)
    const a = 1103515245
    const c = 12345
    const m = 2147483647
    
    // Use seeded hash for better distribution
    // ✅ แก้ไข: ใช้ modulo (%) แทน bitwise AND (&)
    let s = seed
    s = (s * a + c) % m
    // รับประกันว่าเป็นจำนวนบวก
    if (s < 0) s += m
    return s / m
  }

  // ฟังก์ชันสุ่มตัวเลข BINGO (1-75) โดยไม่ซ้ำกับตัวเลขที่ออกไปแล้ว
  // ใช้ seed จาก Firebase เพื่อให้ทุกคนได้ตัวเลขเดียวกัน
  const generateRandomNumber = (excludeNumbers: number[], seed?: number, drawnCount?: number): number => {
    // สร้าง available numbers list
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(num => !excludeNumbers.includes(num))
    
    if (availableNumbers.length === 0) {
      // ถ้าตัวเลขครบ 75 ตัวแล้ว
      return 1 // fallback (ไม่ควรเกิดขึ้น)
    }
    
    // ถ้าไม่มี seed หรือ excludeNumbers ครบ 75 ตัวแล้ว
    if (seed === undefined) {
      // ใช้ random แบบปกติ
      const randomIndex = Math.floor(Math.random() * availableNumbers.length)
      return availableNumbers[randomIndex]
    }
    
    // ✅ แก้ไข: ใช้ drawnCount เป็น seed โดยตรง และใช้ modulo เพื่อให้ได้ seed ที่แตกต่างกัน
    // ใช้ prime number 73 เพื่อให้การกระจายตัวดีขึ้น
    const currentSeed = seed + (drawnCount || 0) * 73
    
    // สุ่มเลือกตัวเลขจาก available numbers โดยใช้ seeded random
    const randomValue = seededRandom(currentSeed)
    const randomIndex = Math.floor(randomValue * availableNumbers.length)
    
    // ตรวจสอบว่า index อยู่ในช่วงที่ถูกต้อง
    if (randomIndex < 0 || randomIndex >= availableNumbers.length) {
      // fallback: ใช้ตัวเลขแรกที่ available
      return availableNumbers[0]
    }
    
    const selectedNumber = availableNumbers[randomIndex]
    
    // Double check เพื่อป้องกันการซ้ำ (ไม่ควรเกิดขึ้น แต่เพิ่มความปลอดภัย)
    if (excludeNumbers.includes(selectedNumber)) {
      // ถ้าซ้ำ ให้หาเลขแรกที่ available
      return availableNumbers[0] || 1
    }
    
    return selectedNumber
  }

  // ✅ ฟังก์ชันเริ่มเกม - ใช้ PostgreSQL 100%
  const startGame = async () => {
    try {
      // ✅ ใช้ PostgreSQL 100% - ตรวจสอบว่าเกมเริ่มแล้วหรือยัง
      const currentState = await postgresqlAdapter.getBingoGameState(gameId)
      
      // ถ้าเกมเริ่มแล้ว (status ไม่เป็น waiting หรือ undefined) ให้หยุด
      if (currentState && currentState.gamePhase && currentState.gamePhase !== 'waiting') {
        return
      }
      
      // สร้าง gameState เริ่มต้นถ้าไม่มี หรืออัปเดตเป็น countdown
      const gameStateData = {
        gamePhase: 'countdown',
        drawnNumbers: [],
        currentNumber: null,
        gameStarted: false,
        gameEnded: false,
        timerStarted: false,
        gameStartedBy: username,
        gameStartedAt: null,
        randomSeed: null
      }
      
      // ✅ อัปเดต PostgreSQL
      await postgresqlAdapter.updateBingoGameState(gameId, gameStateData)
      
      setGameStatus('countdown')
      setCountdown(3)
      setDrawnNumbers([])
      setCurrentNumber(null)
      setWinner(null)
      setWinnerCode(null)
      
      // นับถอยหลัง 3 -> 2 -> 1 -> READY
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval)
            startDrawingNumbers()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  // ✅ ฟังก์ชันเริ่มสุ่มตัวเลข - ใช้ PostgreSQL 100%
  const startDrawingNumbers = useCallback(async () => {
    try {
      // ✅ ใช้ PostgreSQL 100% - ตรวจสอบว่าเกมเริ่มแล้วหรือยัง
      const currentState = await postgresqlAdapter.getBingoGameState(gameId)
      
      // ถ้าเกมเริ่มแล้ว (status เป็น playing) ให้หยุด
      if (currentState && currentState.gamePhase === 'playing') {
        // ตั้ง timer ถ้ายังไม่มี
        if (!gameTimerRef.current) {
          setupDrawingTimer()
        }
        return
      }
      
      // สุ่ม seed ใหม่สำหรับเกมนี้
      const seed = Math.floor(Math.random() * 1000000)
      
      // สุ่มตัวเลขแรกทันที (ใช้ seed เพื่อให้ทุกคนได้ตัวเลขเดียวกัน)
      const firstNumber = generateRandomNumber([], seed, 0)
      
      // สร้างข้อมูลเกมใหม่
      const newGameState = {
        gamePhase: 'playing',
        drawnNumbers: [firstNumber],
        currentNumber: firstNumber,
        gameStartedBy: username,
        gameStartedAt: Date.now(),
        randomSeed: seed // บันทึก seed เพื่อให้ทุกคนใช้เดียวกัน
      }
      
      // ✅ อัปเดต PostgreSQL
      await postgresqlAdapter.updateBingoGameState(gameId, newGameState)
      
      setGameStatus('playing')
      setCurrentNumber(firstNumber)
      setDrawnNumbers([firstNumber])
      
      // ✅ ตรวจสอบว่า timer กำลังทำงานอยู่แล้วหรือไม่ (ป้องกันหลาย timer)
      if (gameTimerRef.current) {
        return
      }
      
      // ตั้ง timer เพื่อสุ่มตัวเลขต่อไป
      setupDrawingTimer()
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }, [gameId, username])
  
  // ✅ ฟังก์ชันตั้ง timer สำหรับสุ่มตัวเลข - ใช้ PostgreSQL 100%
  const setupDrawingTimer = useCallback(() => {
    // ตั้งเวลาเพื่อสุ่มตัวเลขต่อไปทุก 8 วินาที
    const timer = setInterval(async () => {
      try {
        // เพิ่ม delay เล็กน้อยเพื่อป้องกัน race condition
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // ✅ ใช้ PostgreSQL 100% - ดึง game state ล่าสุด
        const currentState = await postgresqlAdapter.getBingoGameState(gameId)
        
        if (!currentState) return
        
        // ตรวจสอบว่าเกมจบหรือไม่ (ตัวเลขครบ 75 ตัว)
        const drawnNumbers = currentState.drawnNumbers || []
        if (drawnNumbers.length >= 75) {
          await postgresqlAdapter.updateBingoGameState(gameId, { gamePhase: 'finished' })
          clearInterval(timer)
          gameTimerRef.current = null
          setGameStatus('finished')
          return
        }
        
        // ตรวจสอบว่าเกมยังอยู่ในการเล่นหรือไม่
        if (currentState.gamePhase !== 'playing') {
          return
        }
        
        // ✅ ตรวจสอบว่า timer กำลังทำงานโดยตัวอื่นอยู่หรือไม่
        const lastDrawTime = currentState.lastDrawTime || 0
        const now = Date.now()
        // ถ้าสุ่มล่าสุดไม่เกิน 4 วินาที แสดงว่ามีคนอื่นสุ่มแล้ว
        if (now - lastDrawTime < 4000) {
          return
        }
        
        const drawnCount = drawnNumbers.length
        
        // ใช้ seed ที่บันทึกไว้ใน gameState
        const seed = currentState.randomSeed
        
        if (!seed) {
          return
        }
        
        // ✅ สุ่มตัวเลขใหม่ที่ไม่ซ้ำกับตัวเลขที่ออกไปแล้ว
        let newNumber = generateRandomNumber(drawnNumbers, seed, drawnCount)
        
        // ✅ ตรวจสอบว่าตัวเลขซ้ำหรือไม่ (ไม่ควรเกิดขึ้น แต่เพิ่มความปลอดภัย)
        if (drawnNumbers.includes(newNumber)) {
          // ถ้าซ้ำ ให้หาตัวเลขที่ยังไม่ได้ออกจาก available numbers
          const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
            .filter(num => !drawnNumbers.includes(num))
          
          if (availableNumbers.length > 0) {
            // ใช้ seeded random เพื่อเลือกจาก available numbers
            const fallbackSeed = seed + drawnCount * 73 + 1000
            const randomValue = seededRandom(fallbackSeed)
            const randomIndex = Math.floor(randomValue * availableNumbers.length)
            newNumber = availableNumbers[randomIndex] || availableNumbers[0]
          } else {
            // ถ้าตัวเลขครบ 75 ตัวแล้ว ให้จบเกม
            await postgresqlAdapter.updateBingoGameState(gameId, { gamePhase: 'finished' })
            clearInterval(timer)
            gameTimerRef.current = null
            setGameStatus('finished')
            return
          }
        }
        
        const updatedNumbers = [...drawnNumbers, newNumber]
        
        // ตรวจสอบความ unique อีกครั้งใน array
        const uniqueNumbers = [...new Set(updatedNumbers)]
        if (uniqueNumbers.length !== updatedNumbers.length) {
          // ข้ามรอบนี้
          return
        }
        
        // ✅ อัปเดต PostgreSQL
        await postgresqlAdapter.updateBingoGameState(gameId, {
          drawnNumbers: updatedNumbers,
          currentNumber: newNumber,
          randomSeed: seed,
          lastDrawTime: Date.now()
        })
        
        // อัปเดต state
        setCurrentNumber(newNumber)
        setDrawnNumbers(updatedNumbers)
      } catch (error) {
        console.error('Error drawing number:', error)
      }
    }, 8000) // ทุก 8 วินาที
    
    gameTimerRef.current = timer
  }, [gameId])

  // ✅ ฟังก์ชันบันทึก checkedNumbers ลง PostgreSQL (ใช้ debounce เพื่อลดจำนวน write)
  const saveCardToFirebase = useCallback(async (cardId: string, checkedNumbers: boolean[][]) => {
    if (!gameId) return
    
    try {
      // ✅ ใช้ PostgreSQL 100%
      await postgresqlAdapter.updateBingoCard(gameId, cardId, checkedNumbers)
      // Also send via WebSocket for real-time updates
      const ws = getWebSocket()
      if (ws.isConnected()) {
        ws.updateBingoCard(gameId, userKey, cardId, checkedNumbers)
      }
      
      // ✅ อย่าลบ pendingCheckedNumbersRef ทันที - ให้ useEffect ลบเมื่อ update มาและยืนยันว่าใช้ค่าจาก database แล้ว
      // เพราะถ้าลบทันทีและ update มาจากการ์ดอื่น useEffect อาจใช้ prevCard.checkedNumbers ที่ไม่ใช่ค่าล่าสุด
    } catch (error) {
      console.error('Error updating card in PostgreSQL:', error)
    }
  }, [gameId, userKey])

  // Cleanup timer เมื่อ component unmount หรือ game status/ID เปลี่ยน
  useEffect(() => {
    return () => {
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current)
        gameTimerRef.current = null
      }
    }
  }, [gameId, gameStatus])

  // Clear timer เมื่อ game status ไม่ใช่ 'playing'
  useEffect(() => {
    if (gameStatus !== 'playing' && gameTimerRef.current) {
      clearInterval(gameTimerRef.current)
      gameTimerRef.current = null
    }
  }, [gameStatus])

  // Cleanup debounce timers และบันทึกข้อมูลที่รออยู่เมื่อเกมจบหรือ component unmount
  useEffect(() => {
    return () => {
      // บันทึกข้อมูลที่รออยู่ทั้งหมดก่อน component unmount
      cardUpdateTimersRef.current.forEach((timer, cardId) => {
        clearTimeout(timer)
        // หา card จาก state ปัจจุบัน
        const card = bingoCards.find(c => c.id === cardId)
        if (card && card.checkedNumbers) {
          saveCardToFirebase(cardId, card.checkedNumbers)
        }
      })
      cardUpdateTimersRef.current.clear()
    }
  }, [bingoCards, saveCardToFirebase])

  // บันทึกทันทีเมื่อเกมจบ เพื่อไม่ให้ข้อมูลหาย
  useEffect(() => {
    if (gameStatus === 'finished') {
      // บันทึกข้อมูลที่รออยู่ทั้งหมด
      cardUpdateTimersRef.current.forEach((timer, cardId) => {
        clearTimeout(timer)
        const card = bingoCards.find(c => c.id === cardId)
        if (card && card.checkedNumbers) {
          saveCardToFirebase(cardId, card.checkedNumbers)
        }
      })
      cardUpdateTimersRef.current.clear()
    }
  }, [gameStatus, bingoCards, saveCardToFirebase])

  // ✅ Migrated to PostgreSQL: Poll players every 2 seconds
  useEffect(() => {
    if (!gameId) return

    let intervalId: NodeJS.Timeout | null = null
    
    const fetchPlayers = async () => {
      try {
        // ✅ Use PostgreSQL adapter
        const playersList = await postgresqlAdapter.getBingoPlayers(gameId)
        
        // ✅ CRITICAL FIX: จำกัดจำนวน players ที่แสดง (100 players ล่าสุด)
        const MAX_PLAYERS_DISPLAY = 100
        
        // ✅ Process และ sort players
        const playersWithTimestamp: Array<[Player, number]> = []
        let currentPlayerData: Player | null = null
        
        for (const playerData of playersList) {
          const player: Player = {
            userId: playerData.userId,
            username: playerData.username,
            credit: playerData.credit || 0,
            joinedAt: playerData.joinedAt || 0,
            isReady: playerData.isReady || false
          }
          const timestamp = player.joinedAt || 0
          playersWithTimestamp.push([player, timestamp])
          
          // ✅ เก็บ current user ไว้ทันที
          if (player.userId === userKey) {
            currentPlayerData = player
          }
        }
        
        // ✅ เรียงตาม timestamp (ล่าสุดก่อน) และเลือกเฉพาะ MAX_PLAYERS_DISPLAY แรก
        playersWithTimestamp.sort((a, b) => b[1] - a[1])
        
        const limitedPlayersArray: Player[] = []
        const addedUserIds = new Set<string>()
        
        // ✅ เพิ่ม players ล่าสุด (ไม่เกิน MAX_PLAYERS_DISPLAY)
        for (let i = 0; i < Math.min(playersWithTimestamp.length, MAX_PLAYERS_DISPLAY); i++) {
          const [player] = playersWithTimestamp[i]
          limitedPlayersArray.push(player)
          addedUserIds.add(player.userId)
        }
        
        // ✅ ถ้า current user ไม่อยู่ใน limited array ให้เพิ่มเข้าไป
        if (currentPlayerData && !addedUserIds.has(userKey)) {
          limitedPlayersArray.push(currentPlayerData)
        }
        
        setPlayers(limitedPlayersArray)
        setCurrentUser(currentPlayerData)
      } catch (error) {
        console.error('Error fetching players from PostgreSQL:', error)
      }
    }

    // Fetch immediately
    fetchPlayers()
    
    // Poll every 2 seconds
    intervalId = setInterval(fetchPlayers, 2000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [gameId, userKey])

  // Auto-join when component mounts
  useEffect(() => {
    if (!currentUser && !isJoining && gameId) {
      handleJoinGame()
    }
  }, [currentUser, isJoining, gameId])

  // ✅ สร้าง gameState เริ่มต้นถ้าไม่มี - ใช้ PostgreSQL 100%
  useEffect(() => {
    if (!gameId) return

    const initializeGameState = async () => {
      try {
        // ✅ ใช้ PostgreSQL 100%
        const gameState = await postgresqlAdapter.getBingoGameState(gameId)
        
        // ถ้าไม่มี gameState หรือ status เป็น undefined ให้สร้างใหม่
        if (!gameState || !gameState.gamePhase) {
          await postgresqlAdapter.updateBingoGameState(gameId, {
            gamePhase: 'waiting',
            drawnNumbers: [],
            currentNumber: null,
            gameStarted: false,
            gameEnded: false
          })
        }
      } catch (error) {
        console.error('Error initializing game state:', error)
      }
    }

    initializeGameState()
  }, [gameId])

  // ✅ Migrated to PostgreSQL: Poll cards every 2 seconds
  useEffect(() => {
    if (!gameId || !currentUser) return

    let intervalId: NodeJS.Timeout | null = null
    
    const fetchCards = async () => {
      try {
        // ✅ Use PostgreSQL adapter - get cards for current user
        const cardsList = await postgresqlAdapter.getBingoCards(gameId, currentUser.userId)
        
        // ✅ Process cards with pendingCheckedNumbers logic
        const userCards: BingoCard[] = cardsList.map((cardData: any) => {
          const cardId = cardData.id
          // สร้าง checkedNumbers ถ้ายังไม่มี
          const postgresqlCheckedNumbers = cardData.checkedNumbers || Array(5).fill(null).map(() => Array(5).fill(false))
          
          // ✅ ใช้ pending checkedNumbers ถ้ามีและยังไม่ได้บันทึกลง PostgreSQL (มี timer อยู่)
          // เพื่อไม่ให้ local changes ถูกเขียนทับ
          const hasPendingTimer = cardUpdateTimersRef.current.has(cardId)
          const pendingCheckedNumbers = pendingCheckedNumbersRef.current.get(cardId)
          const finalCheckedNumbers = (hasPendingTimer && pendingCheckedNumbers) ? pendingCheckedNumbers : postgresqlCheckedNumbers
          
          return {
            id: cardId,
            ...cardData,
            checkedNumbers: finalCheckedNumbers
          }
        })
        
        // ✅ ใช้ functional update เพื่อ merge กับ state เดิม แทนการเขียนทับทั้งหมด
        // เพื่อป้องกันไม่ให้ checkedNumbers ที่ยังไม่ได้บันทึกลง PostgreSQL ถูกเขียนทับ
        setBingoCards(prevCards => {
          // สร้าง Map จาก prevCards เพื่อค้นหาได้เร็ว
          const prevCardsMap = new Map(prevCards.map(card => [card.id, card]))
          
          // อัปเดต cards ใหม่ โดยเก็บ checkedNumbers จาก prevCards เป็นหลัก
          return userCards.map(newCard => {
            const prevCard = prevCardsMap.get(newCard.id)
            
            // ✅ สำหรับการ์ดที่มี prevCard อยู่แล้ว (การ์ดเดิม)
            if (prevCard) {
              // ✅ ใช้ pendingCheckedNumbers เป็นหลัก ถ้ามี
              const pendingCheckedNumbers = pendingCheckedNumbersRef.current.get(newCard.id)
              if (pendingCheckedNumbers) {
                // ตรวจสอบว่า PostgreSQL ตรงกับ pendingCheckedNumbers หรือไม่
                const pendingStr = JSON.stringify(pendingCheckedNumbers)
                const newStr = JSON.stringify(newCard.checkedNumbers)
                
                if (pendingStr === newStr) {
                  // บันทึกสำเร็จแล้ว - ลบ pending และอัปเดต latestCheckedNumbersRef
                  pendingCheckedNumbersRef.current.delete(newCard.id)
                  if (newCard.checkedNumbers) {
                    latestCheckedNumbersRef.current.set(newCard.id, newCard.checkedNumbers)
                  }
                  return newCard
                }
                
                // ยังไม่บันทึกสำเร็จ - ใช้ pending
                latestCheckedNumbersRef.current.set(newCard.id, pendingCheckedNumbers)
                return {
                  ...newCard,
                  checkedNumbers: pendingCheckedNumbers
                }
              }
              
              // ✅ ถ้าไม่มี pendingCheckedNumbers ให้ใช้ latestCheckedNumbersRef เป็นหลัก
              const latestCheckedNumbers = latestCheckedNumbersRef.current.get(newCard.id)
              if (latestCheckedNumbers && 
                  Array.isArray(latestCheckedNumbers) && 
                  latestCheckedNumbers.length === 5 &&
                  latestCheckedNumbers.every(row => Array.isArray(row) && row.length === 5)) {
                return {
                  ...newCard,
                  checkedNumbers: latestCheckedNumbers
                }
              }
              
              // ถ้าไม่มี latestCheckedNumbers ให้ใช้ prevCard.checkedNumbers
              if (prevCard.checkedNumbers && 
                  Array.isArray(prevCard.checkedNumbers) && 
                  prevCard.checkedNumbers.length === 5 &&
                  prevCard.checkedNumbers.every(row => Array.isArray(row) && row.length === 5)) {
                latestCheckedNumbersRef.current.set(newCard.id, prevCard.checkedNumbers)
                return {
                  ...newCard,
                  checkedNumbers: prevCard.checkedNumbers
                }
              }
              
              // ถ้า prevCard ไม่มี checkedNumbers ให้ใช้จาก PostgreSQL หรือสร้างใหม่
              const finalCheckedNumbers = newCard.checkedNumbers || Array(5).fill(null).map(() => Array(5).fill(false))
              if (finalCheckedNumbers && Array.isArray(finalCheckedNumbers)) {
                latestCheckedNumbersRef.current.set(newCard.id, finalCheckedNumbers)
              }
              return {
                ...newCard,
                checkedNumbers: finalCheckedNumbers
              }
            }
            
            // ✅ สำหรับการ์ดใหม่ (ไม่มี prevCard)
            if (newCard.checkedNumbers && Array.isArray(newCard.checkedNumbers)) {
              latestCheckedNumbersRef.current.set(newCard.id, newCard.checkedNumbers)
            }
            return newCard
          })
        })
      } catch (error) {
        console.error('Error fetching cards from PostgreSQL:', error)
      }
    }

    // Fetch immediately
    fetchCards()
    
    // Poll every 2 seconds
    intervalId = setInterval(fetchCards, 2000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [gameId, currentUser])

  // ✅ ลบ auto-start logic ออกแล้ว - แอดมินต้องกดปุ่มเริ่มเกมเอง

  // ✅ ตรวจสอบว่า USER ไม่ได้ READY เมื่อเกมเริ่ม (ไม่แสดงสำหรับ HOST)
  useEffect(() => {
    // ✅ สำหรับ HOST: ไม่แสดง popup นี้
    if (isHost) {
      setShowNotReadyPopup(false)
      return
    }
    
    if (!gameId || !currentUser || gameStatus !== 'countdown' && gameStatus !== 'playing') {
      setShowNotReadyPopup(false)
      return
    }

    // ถ้าเกมเริ่มแล้ว (countdown หรือ playing) และ USER ไม่ได้ READY
    if (gameStatus === 'countdown' || gameStatus === 'playing') {
      if (!currentUser.isReady) {
        setShowNotReadyPopup(true)
      } else {
        setShowNotReadyPopup(false)
      }
    }
  }, [gameId, currentUser, gameStatus, currentUser?.isReady, isHost])

  // ✅ เพิ่ม logic สำหรับการเริ่มเกมเมื่อ status เป็น countdown (สำหรับการเริ่มจากแอดมิน)
  useEffect(() => {
    if (!gameId || gameStatus !== 'countdown') return
    
    // ตั้ง countdown เริ่มต้นที่ 3
    setCountdown(3)
    
    // นับถอยหลัง 3 -> 2 -> 1 -> START
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          
          // เริ่มเกมหลัง countdown จบ
          startDrawingNumbers()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval)
      }
    }
  }, [gameId, gameStatus, startDrawingNumbers])

  // ✅ Migrated to PostgreSQL: Poll game state every 2 seconds
  useEffect(() => {
    if (!gameId) return

    let intervalId: NodeJS.Timeout | null = null
    
    const fetchGameState = async () => {
      try {
        // ✅ Use PostgreSQL adapter
        const gameState = await postgresqlAdapter.getBingoGameState(gameId)
        
        if (gameState) {
          const newStatus = gameState.gamePhase || gameState.status || 'waiting'
          const newDrawnNumbers = gameState.drawnNumbers || []
          const newCurrentNumber = gameState.currentNumber || null
          
          // ✅ รีเซ็ตทุกอย่างถ้า status เป็น 'waiting'
          if (newStatus === 'waiting') {
            setGameStatus('waiting')
            setDrawnNumbers([])
            setCurrentNumber(null)
            setWinner(null)
            setWinnerCode(null)
          } else {
            setGameStatus(newStatus)
            setDrawnNumbers(newDrawnNumbers)
            setCurrentNumber(newCurrentNumber)
            
            // อัปเดต winner จาก gameState
            if (newStatus === 'finished' && gameState.winner) {
              setWinner({ username: gameState.winner, cardId: gameState.winnerCardId || '' })
            } else {
              // รีเซ็ต winner เมื่อ status ไม่ใช่ 'finished'
              setWinner(null)
              setWinnerCode(null)
            }
          }
          
          // ✅ สำหรับ HOST: อัพเดท bingoGameStatus ด้วย
          if (isHost) {
            setBingoGameStatus(newStatus)
          }
        } else {
          // ถ้าไม่มี gameState ให้รีเซ็ตเป็น waiting
          setGameStatus('waiting')
          setDrawnNumbers([])
          setCurrentNumber(null)
          setWinner(null)
          setWinnerCode(null)
          
          // ✅ สำหรับ HOST: อัพเดท bingoGameStatus ด้วย
          if (isHost) {
            setBingoGameStatus('waiting')
          }
        }
      } catch (error) {
        console.error('Error fetching game state from PostgreSQL:', error)
      }
    }

    // Fetch immediately
    fetchGameState()
    
    // Poll every 2 seconds
    intervalId = setInterval(fetchGameState, 2000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [gameId, isHost])
  
  // ✅ REMOVED: ลบ listener ที่ซ้ำซ้อน (รวมเข้ากับ listener ด้านบนแล้ว)
  // ✅ bingoGameStatus จะถูกอัพเดทจาก gameStatus ใน listener ด้านบน

  // ตรวจสอบ BINGO cards และหยุดเกมเมื่อมีผู้ชนะ - ลบออกเพราะใช้ gameState เป็น single source of truth
  // useEffect(() => {
  //   if (!gameId || gameStatus !== 'playing') return

  //   const cardsRef = ref(db, `games/${gameId}/bingo/cards`)
    
  //   const unsubscribe = onValue(cardsRef, (snapshot) => {
  //     const cardsData = snapshot.val() || {}
      
  //     // หาการ์ดที่มี BINGO
  //     const bingoCards = Object.entries(cardsData)
  //       .filter(([cardId, cardData]: [string, any]) => cardData.isBingo === true)
      
  //     if (bingoCards.length > 0 && !winner) {
  //       // หยุดเกม
  //       if (gameTimer) {
  //         clearInterval(gameTimer)
  //         setGameTimer(null)
  //       }
        
  //       // หาผู้ชนะคนแรก
  //       const [winnerCardId, winnerCardData] = bingoCards[0]
  //       const winnerUsername = (winnerCardData as any).username
        
  //       setWinner({ username: winnerUsername, cardId: winnerCardId })
  //       setGameStatus('finished')
  //     }
  //   })

  //   return () => {
  //     off(cardsRef, 'value', unsubscribe)
  //   }
  // }, [gameId, gameStatus, gameTimer, winner])

  const handleJoinGame = async () => {
    if (!game.bingo) return

    // Check if room is full
    if (players.length >= (game.bingo.maxUsers || 50)) {
      // ห้องเต็มแล้ว - ไม่แสดง popup
      return
    }

    setIsJoining(true)
    try {
      // Use normalized username as userId for consistency
      const userId = userKey
      
      // ✅ ใช้ PostgreSQL 100%
      await postgresqlAdapter.joinBingoGame(gameId, userId, username, 1000)

      // เข้าร่วมเกมสำเร็จ - ไม่แสดง popup
    } catch (error) {
      onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถเข้าร่วมเกมได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsJoining(false)
    }
  }

  const handleToggleReady = async () => {
    if (!currentUser || !gameId) return

    setIsUpdatingReady(true)
    try {
      const newReadyStatus = !currentUser.isReady
      // ✅ ใช้ PostgreSQL 100%
      await postgresqlAdapter.updateBingoPlayerReady(gameId, currentUser.userId, newReadyStatus)
    } catch (error) {
      onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตสถานะได้')
    } finally {
      setIsUpdatingReady(false)
    }
  }

  const handleLeaveGame = async () => {
    if (!currentUser || !gameId) return

    try {
      // ✅ ใช้ PostgreSQL 100% - ลบ player (backend อาจจะต้องมี API สำหรับลบ player)
      // สำหรับตอนนี้จะ refresh หน้าไปก่อน (backend จะจัดการ cleanup เอง)
      
      // Refresh the page to go back to home
      window.location.href = '/home'
    } catch (error) {
      onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถออกจากเกมได้ กรุณาลองใหม่อีกครั้ง')
    }
  }

  // สร้างการ์ด BINGO ตามมาตรฐาน
  const generateBingoCard = (): number[][] => {
    const card: number[][] = []
    
    // สร้าง 5 คอลัมน์ (B-I-N-G-O)
    for (let col = 0; col < 5; col++) {
      const column: number[] = []
      const usedNumbers = new Set<number>()
      
      // แต่ละคอลัมน์มี 5 ตัวเลข
      for (let row = 0; row < 5; row++) {
        let number: number
        
        // คอลัมน์ B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
        const min = col * 15 + 1
        const max = (col + 1) * 15
        
        do {
          number = Math.floor(Math.random() * (max - min + 1)) + min
        } while (usedNumbers.has(number))
        
        usedNumbers.add(number)
        column.push(number)
      }
      
      card.push(column)
    }
    
    // ตรงกลาง (N) เป็น FREE
    card[2][2] = 0 // 0 = FREE
    
    return card
  }

  const handleGenerateBingoCard = async () => {
    if (!currentUser || !gameId) return

    // ตรวจสอบจำนวนการ์ดปัจจุบัน
    const currentCardCount = bingoCards.length
    const isFirstCard = currentCardCount === 0
    const cardCost = isFirstCard ? 0 : 100

    // ตรวจสอบเครดิตถ้าไม่ใช่การ์ดแรก - ดึงจาก USERS_EXTRA ใน RTDB
    if (!isFirstCard) {
      // ✅ PHASE 3: ใช้ Firestore service 100% (ไม่ใช้ RTDB)
      const { getUserData, addUserHcoinWithTransaction } = await import('../services/users-firestore')
      const userData = await getUserData(userKey, {
        preferFirestore: true, // Phase 3: อ่าน Firestore
        fallbackRTDB: false // Phase 3: ไม่ fallback RTDB (ใช้ Firestore 100%)
      })
      
      const hcoin = userData ? Number(userData.hcoin || 0) : 0
      
      if (hcoin < cardCost) {
        onInfo('เครดิตไม่เพียงพอ', `ต้องการ HCOIN ${cardCost} แต่คุณมีเพียง ${hcoin.toFixed(2)}`)
        return
      }
      
      // ✅ PHASE 3: หักเงินด้วย Firestore Transaction (ใช้ Firestore 100%)
      try {
        const result = await addUserHcoinWithTransaction(userKey, -cardCost, {
          useDualWrite: false, // Phase 3: ไม่ใช้ RTDB
          preferFirestore: true, // Phase 3: ใช้ Firestore 100%
          allowNegative: true // ✅ อนุญาตให้หักเหรียญได้ (ส่งค่าลบ)
        })
        
        if (!result.success) {
          onInfo('เกิดข้อผิดพลาด', `ไม่สามารถหักเงินได้: ${result.error}`)
          return
        }
        
        // ✅ ใช้ balance ใหม่จาก result
        const newHcoin = result.newBalance || (hcoin - cardCost)
        
        // ✅ ตรวจสอบ balance อีกครั้ง
        if (newHcoin < 0) {
          onInfo('เกิดข้อผิดพลาด', 'เครดิตไม่เพียงพอหลังหักเงิน')
          return
        }
      } catch (error: any) {
        onInfo('เกิดข้อผิดพลาด', `ไม่สามารถหักเครดิตได้: ${error.message || error}`)
        return
      }
      
      // ✅ ใช้ PostgreSQL 100% - อัพเดต credit ผ่าน updateBingoPlayerReady หรือ API endpoint แยก
      // หมายเหตุ: credit ใน bingo game อาจจะต้องใช้ API endpoint แยก
      // สำหรับตอนนี้จะอัพเดต currentUser state จาก players state ที่มีอยู่แล้ว
      const updatedPlayer = players.find(p => p.userId === currentUser.userId)
      if (updatedPlayer) {
        const newCredit = (updatedPlayer.credit || 0) - cardCost
        setCurrentUser(prev => prev ? { ...prev, credit: newCredit } : null)
      }
    }

    setIsGeneratingCard(true)
    try {
      const newCard = generateBingoCard()
      const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const cardData: BingoCard = {
        id: cardId,
        numbers: newCard,
        userId: currentUser.userId,
        createdAt: Date.now(),
        isBingo: false,
        checkedNumbers: Array(5).fill(null).map(() => Array(5).fill(false))
      }

      // ✅ ใช้ PostgreSQL 100%
      await postgresqlAdapter.createBingoCard(gameId, currentUser.userId, newCard)
      
      // สร้างการ์ดสำเร็จ - ไม่แสดง popup
      
    } catch (error) {
      onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างการ์ด BINGO ได้')
    } finally {
      setIsGeneratingCard(false)
    }
  }

  // เช็ค BINGO
  const checkBingo = (card: BingoCard): boolean => {
    if (!card.checkedNumbers) return false
    
    // เช็คแถวแนวนอน (5 แถว)
    for (let row = 0; row < 5; row++) {
      let count = 0
      for (let col = 0; col < 5; col++) {
        if (card.checkedNumbers[row][col] || (row === 2 && col === 2)) { // FREE space
          count++
        }
      }
      if (count === 5) return true
    }
    
    // เช็คแถวแนวตั้ง (5 คอลัมน์)
    for (let col = 0; col < 5; col++) {
      let count = 0
      for (let row = 0; row < 5; row++) {
        if (card.checkedNumbers[row][col] || (row === 2 && col === 2)) { // FREE space
          count++
        }
      }
      if (count === 5) return true
    }
    
    // เช็คเส้นทแยงซ้ายบน-ขวาล่าง
    let diagonal1 = 0
    for (let i = 0; i < 5; i++) {
      if (card.checkedNumbers[i][i] || (i === 2)) { // FREE space
        diagonal1++
      }
    }
    if (diagonal1 === 5) return true
    
    // เช็คเส้นทแยงขวาบน-ซ้ายล่าง
    let diagonal2 = 0
    for (let i = 0; i < 5; i++) {
      if (card.checkedNumbers[i][4-i] || (i === 2)) { // FREE space
        diagonal2++
      }
    }
    if (diagonal2 === 5) return true
    
    // ✅ เช็คสี่มุมใหญ่ (4 Big Corners): มุมบนซ้าย, บนขวา, ล่างซ้าย, ล่างขวา
    const bigCorners = [
      { row: 0, col: 0 }, // มุมบนซ้าย
      { row: 0, col: 4 }, // มุมบนขวา
      { row: 4, col: 0 }, // มุมล่างซ้าย
      { row: 4, col: 4 }  // มุมล่างขวา
    ]
    
    let bigCornersCount = 0
    for (const corner of bigCorners) {
      if (card.checkedNumbers[corner.row]?.[corner.col]) {
        bigCornersCount++
      }
    }
    if (bigCornersCount === 4) return true
    
    // ✅ เช็คสี่มุมเล็ก (4 Small Corners): มุมรอบช่อง FREE (ถัดจากกลาง 1 ช่อง)
    const smallCorners = [
      { row: 1, col: 1 }, // มุมบนซ้าย (ถัดจากกลาง)
      { row: 1, col: 3 }, // มุมบนขวา (ถัดจากกลาง)
      { row: 3, col: 1 }, // มุมล่างซ้าย (ถัดจากกลาง)
      { row: 3, col: 3 }  // มุมล่างขวา (ถัดจากกลาง)
    ]
    
    let smallCornersCount = 0
    for (const corner of smallCorners) {
      if (card.checkedNumbers[corner.row]?.[corner.col]) {
        smallCornersCount++
      }
    }
    if (smallCornersCount === 4) return true
    
    return false
  }

  const handleClaimBingo = async (card: BingoCard) => {
    if (!currentUser || !gameId) return

    try {
      // ✅ บันทึก checkedNumbers ทันทีก่อนเช็ค BINGO (เพื่อให้ข้อมูลถูกบันทึกแน่นอน)
      if (card.checkedNumbers) {
        // ยกเลิก timer ที่รออยู่ถ้ามี
        const existingTimer = cardUpdateTimersRef.current.get(card.id)
        if (existingTimer) {
          clearTimeout(existingTimer)
          cardUpdateTimersRef.current.delete(card.id)
        }
        // บันทึกทันที
        await saveCardToFirebase(card.id, card.checkedNumbers)
      }
      
      const isBingo = checkBingo(card)
      
      if (isBingo) {
        // อัปเดตสถานะ BINGO (ใช้ PostgreSQL adapter)
        try {
          // ✅ ใช้ PostgreSQL 100%
          await postgresqlAdapter.updateBingoCard(gameId, card.id, undefined, true)
        
          // อัปเดต local state
          setBingoCards(prevCards => 
            prevCards.map(prevCard => 
              prevCard.id === card.id 
                ? { ...prevCard, isBingo: true }
                : prevCard
            )
          )
        
          // ✅ แจกโค้ดให้ผู้ชนะ - ใช้ backend endpoint
          try {
          const result = await postgresqlAdapter.claimCode(gameId, userKey)
          
          if (typeof result === 'string' && result !== 'ALREADY' && result !== 'EMPTY') {
            // ได้โค้ดสำเร็จ
            const awardedCode = result
            setWinnerCode(awardedCode)
            
            // บันทึกลง answers
            await postgresqlAdapter.submitAnswer(gameId, userKey, 'bingo-winner', true, awardedCode)
          } else if (result === 'ALREADY') {
            // เคยได้โค้ดไปแล้ว - ดึงโค้ดเดิมมาแสดง
            const existingAnswers = await postgresqlAdapter.getAnswers(gameId, 100)
            const userAnswer = existingAnswers
              .filter((a: any) => a.userId === userKey && a.code)
              .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))[0]
            
            if (userAnswer?.code) {
              setWinnerCode(userAnswer.code)
            }
          } else if (result === 'EMPTY') {
            // โค้ดหมดแล้ว
            onInfo?.('โค้ดเต็มแล้ว', 'โค้ดรางวัลในเกมนี้ได้ถูกแจกหมดแล้ว')
          }
          } catch (codeError) {
            console.error('Error claiming code:', codeError)
            // ไม่แสดง error ให้ user เพราะเป็น background operation
          }
        
          // หยุดเกมทันทีเมื่อมี USER ชนะ (ใช้ PostgreSQL adapter)
          try {
            await postgresqlAdapter.updateBingoGameState(gameId, {
              gamePhase: 'finished',
              gameStarted: true
            })
            // Also send via WebSocket for real-time updates
            const ws = getWebSocket()
            if (ws.isConnected()) {
              ws.updateBingoGameState(gameId, {
                gamePhase: 'finished',
                winner: username,
                winnerCardId: card.id
              })
            }
          } catch (error) {
            console.error('Error updating game state in PostgreSQL:', error)
          }
        
          // หยุด timer
          if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current)
            gameTimerRef.current = null
          }
        
          setGameStatus('finished')
        
          // ไม่แสดง onInfo เพราะจะแสดง popup โค้ดแทน
        } catch (error) {
          console.error('Error updating bingo card:', error)
          // ไม่แสดง error ให้ user เพราะเป็น background operation
        }
      } else {
        onInfo('ยังไม่ใช่ BINGO', 'กรุณาเช็คตัวเลขให้ครบก่อน')
      }
    } catch (error) {
      onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถเช็ค BINGO ได้')
    }
  }

  // ฟังก์ชันจัดการการคลิกที่ช่องตัวเลข (ใช้ debounce เพื่อลดการ write ลง Firebase)
  const handleCellClick = (card: BingoCard, rowIndex: number, colIndex: number) => {
    if (!currentUser || !gameId || gameStatus !== 'playing') return
    
    const number = card.numbers[colIndex][rowIndex]
    
    // ไม่สามารถคลิกที่ช่อง FREE ได้
    if (number === 0) return
    
    // ตรวจสอบว่าตัวเลขนี้ถูกออกแล้วหรือไม่
    if (!drawnNumbers.includes(number)) {
      onInfo('ตัวเลขยังไม่ออก', `ตัวเลข ${number} ยังไม่ออกในเกม`)
      return
    }
    
    // ✅ ตรวจสอบว่าช่องนี้ถูก check แล้วหรือยัง - ถ้าถูก check แล้วให้หยุด (ไม่ให้กดซ้ำ)
    const currentCheckedNumbers = card.checkedNumbers || Array(5).fill(null).map(() => Array(5).fill(false))
    const isCurrentlyChecked = currentCheckedNumbers[rowIndex]?.[colIndex] || false
    
    if (isCurrentlyChecked) {
      // ช่องถูก check แล้ว ไม่สามารถกดซ้ำได้
      return
    }
    
    // สร้าง checkedNumbers ใหม่ - เปลี่ยนเป็น true (check เท่านั้น ไม่ให้ uncheck)
    const newCheckedNumbers = currentCheckedNumbers.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        return row.map((checked, cIdx) => cIdx === colIndex ? true : checked)
      }
      return row
    })
    
    // ✅ เก็บ pending changes ไว้ใน ref เพื่อไม่ให้ถูกเขียนทับเมื่อ Firebase update
    pendingCheckedNumbersRef.current.set(card.id, newCheckedNumbers)
    
    // ✅ เก็บ latest checkedNumbers ใน ref - เป็น source of truth
    latestCheckedNumbersRef.current.set(card.id, newCheckedNumbers)
    
    // ✅ อัปเดต local state ทันทีเพื่อให้ UX ดี (ไม่ต้องรอ)
    setBingoCards(prevCards => 
      prevCards.map(prevCard => {
        if (prevCard.id === card.id) {
          return {
            ...prevCard,
            checkedNumbers: newCheckedNumbers
          }
        }
        return prevCard
      })
    )
    
    // ✅ ใช้ debounce เพื่อบันทึกลง Firebase หลังจากผู้ใช้หยุดคลิก 800ms
    // เพื่อลดจำนวน write และค่าใช้จ่าย Firebase
    const existingTimer = cardUpdateTimersRef.current.get(card.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    const timer = setTimeout(() => {
      saveCardToFirebase(card.id, newCheckedNumbers)
      cardUpdateTimersRef.current.delete(card.id)
    }, 800) // รอ 800ms หลังจากหยุดคลิก
    
    cardUpdateTimersRef.current.set(card.id, timer)
  }

  // ✅ OPTIMIZED: ใช้ useMemo เพื่อ cache readyPlayersCount (ลดการคำนวณซ้ำ)
  const readyPlayersCount = useMemo(() => {
    return players.filter(p => p.isReady).length
  }, [players])
  
  // ✅ ปุ่มเริ่มเกมจะแสดงเมื่อมีผู้เล่นอย่างน้อย 2 คนและอย่างน้อย 1 คน READY
  const canStartGame = useMemo(() => {
    return players.length >= 2 && readyPlayersCount >= 1
  }, [players.length, readyPlayersCount])

  return (
    <div className="bingo-game">
      
      {/* แสดง UserBar ในทุกสถานะของเกม */}
      {/* ✅ สำหรับเกม BINGO: ไม่ส่ง credit prop และ gameId เพื่อให้ UserBar ดึงจาก USERS_EXTRA โดยตรง */}
      <UserBar 
        isHost={isHost}
        username={username}
      />


      {/* ส่วนแสดงตัวเลขปัจจุบันและตัวเลขที่ออกไปแล้ว - แสดงเฉพาะเมื่อเกมกำลังเล่นและมีตัวเลขที่ออก */}
      {gameStatus === 'playing' && drawnNumbers.length > 0 && (
        <div className="current-number-display">
          {/* ส่วนแสดงตัวเลขปัจจุบัน */}
          {currentNumber && (
            <div className="current-number">
              <span className="number-value">
                <span style={{ position: 'relative', zIndex: 10 }}>{currentNumber}</span>
              </span>
            </div>
          )}

          {/* ส่วนแสดงตัวเลขที่ออกไปแล้ว */}
          {drawnNumbers.length > 0 && (
            <div className="drawn-numbers-list">
              {drawnNumbers.slice(0, -1).map((number, index) => (
                <span key={index} className="drawn-number">
                  <span style={{ position: 'relative', zIndex: 10 }}>{number}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ส่วนแสดงผลเมื่อเกมจบ */}
      {gameStatus === 'finished' && (
        <div 
          className={`game-finished-display ${winner && winner.username === username ? 'winner' : winner ? 'loser' : ''}`}
          style={{
            background: winner && winner.username === username 
              ? `linear-gradient(135deg, ${hexToRgba(colors.warning, 0.2)} 0%, ${hexToRgba(colors.warning, 0.4)} 100%)`
              : winner 
                ? `linear-gradient(135deg, ${colors.gray100} 0%, ${colors.gray200} 100%)`
                : `linear-gradient(135deg, ${colors.gray100} 0%, ${colors.gray200} 100%)`,
            borderColor: winner && winner.username === username 
              ? colors.warning
              : winner 
                ? colors.danger
                : colors.gray400,
            boxShadow: winner && winner.username === username 
              ? `0 8px 32px ${hexToRgba(colors.warning, 0.3)}, inset 0 1px 0 rgba(255, 255, 255, 0.5)`
              : winner 
                ? `0 8px 32px ${hexToRgba(colors.danger, 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.5)`
                : `0 8px 32px ${hexToRgba(colors.gray400, 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.5)`
          }}
        >
          <div className="game-finished-content">
            {winner && winner.username === username ? (
              // ผู้ชนะ
              <>
                <div className="game-finished-icon">🎉</div>
                <h3 
                  className="game-finished-title"
                  style={{
                    color: colors.warning,
                    textShadow: `0 2px 4px ${hexToRgba(colors.warning, 0.3)}`
                  }}
                >
                  ยินดีด้วย!
                </h3>
                <p 
                  className="game-finished-message"
                  style={{
                    color: colors.warning,
                    background: `linear-gradient(135deg, ${hexToRgba(colors.warning, 0.2)} 0%, ${hexToRgba(colors.warning, 0.3)} 100%)`,
                    borderColor: colors.warning,
                    boxShadow: `0 4px 12px ${hexToRgba(colors.warning, 0.3)}`
                  }}
                >
                  คุณเป็นผู้ชนะ! BINGO เรียบร้อยแล้ว!
                </p>
                {winnerCode && (
                  <div className={`winner-code-container theme-${themeName}`}>
                    <div className={`winner-code-label theme-${themeName}`}>
                      🎁 โค้ดรางวัลของคุณ
                    </div>
                    <div className="winner-code-value-wrapper">
                      <div className={`winner-code-value theme-${themeName}`}>
                        {winnerCode}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(winnerCode)
                          onInfo('คัดลอกแล้ว', 'โค้ดถูกคัดลอกไปที่ clipboard แล้ว')
                        } catch (error) {
                          onInfo('เกิดข้อผิดพลาด', 'ไม่สามารถคัดลอกโค้ดได้')
                        }
                      }}
                      className={`copy-button theme-${themeName}`}
                      style={{
                        background: `linear-gradient(135deg, ${colors.info} 0%, ${colors.accentLight || colors.info} 100%)`,
                        color: colors.textInverse,
                        boxShadow: `0 6px 20px ${hexToRgba(colors.info, 0.4)}`
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primary || colors.info} 0%, ${colors.primaryDark || colors.accentDark || colors.info} 100%)`
                        e.currentTarget.style.boxShadow = `0 8px 25px ${hexToRgba(colors.info, 0.5)}`
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = `linear-gradient(135deg, ${colors.info} 0%, ${colors.accentLight || colors.info} 100%)`
                        e.currentTarget.style.boxShadow = `0 6px 20px ${hexToRgba(colors.info, 0.4)}`
                      }}
                    >
                      📋 คัดลอก
                    </button>
                  </div>
                )}
                <button
                  onClick={handleGoToThemeLink}
                  className={`go-to-site-button theme-${themeName}`}
                  style={{
                    background: theme.gradients.primary || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                    color: colors.textInverse,
                    boxShadow: `0 6px 20px ${hexToRgba(colors.primary, 0.4)}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`
                    e.currentTarget.style.boxShadow = `0 8px 25px ${hexToRgba(colors.primary, 0.5)}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.gradients.primary || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`
                    e.currentTarget.style.boxShadow = `0 6px 20px ${hexToRgba(colors.primary, 0.4)}`
                  }}
                >
                  🎮 ไปที่ {getThemeDisplayName()}
                </button>
              </>
            ) : winner ? (
              // ผู้แพ้
              <>
                <div className="game-finished-icon">😔</div>
                <h3 
                  className="game-finished-title"
                  style={{
                    color: colors.gray500,
                    textShadow: `0 2px 4px ${hexToRgba(colors.gray500, 0.3)}`
                  }}
                >
                  เกมจบแล้ว
                </h3>
                <p 
                  className="game-finished-message"
                  style={{
                    color: colors.gray500,
                    background: `linear-gradient(135deg, ${colors.gray100} 0%, ${colors.gray200} 100%)`,
                    borderColor: colors.gray400,
                    boxShadow: `0 4px 12px ${hexToRgba(colors.gray400, 0.2)}`
                  }}
                >
                  มี USER ท่านอื่น BINGO เรียบร้อยแล้ว
                </p>
                <p 
                  className="winner-info"
                  style={{
                    color: colors.success,
                    background: `linear-gradient(135deg, ${hexToRgba(colors.success, 0.15)} 0%, ${hexToRgba(colors.success, 0.25)} 100%)`,
                    borderColor: colors.success,
                    boxShadow: `0 2px 8px ${hexToRgba(colors.success, 0.2)}`
                  }}
                >
                  ผู้ชนะ: {winner.username}
                </p>
                <button
                  onClick={handleGoToThemeLink}
                  className={`go-to-site-button theme-${themeName}`}
                  style={{
                    background: theme.gradients.primary || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                    color: colors.textInverse,
                    boxShadow: `0 6px 20px ${hexToRgba(colors.primary, 0.4)}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`
                    e.currentTarget.style.boxShadow = `0 8px 25px ${hexToRgba(colors.primary, 0.5)}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.gradients.primary || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`
                    e.currentTarget.style.boxShadow = `0 6px 20px ${hexToRgba(colors.primary, 0.4)}`
                  }}
                >
                  🎮 ไปที่ {getThemeDisplayName()}
                </button>
              </>
            ) : (
              // ไม่มีผู้ชนะ
              <>
                <div className="game-finished-icon">🏁</div>
                <h3 className="game-finished-title">เกมจบแล้ว</h3>
                <p className="game-finished-message">ตัวเลขครบ 75 ตัวแล้ว ไม่มีผู้ชนะ</p>
                <button
                  onClick={handleGoToThemeLink}
                  className={`go-to-site-button theme-${themeName}`}
                  style={{
                    background: theme.gradients.primary || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                    color: colors.textInverse,
                    boxShadow: `0 6px 20px ${hexToRgba(colors.primary, 0.4)}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(135deg, ${colors.primaryDark || colors.primary} 0%, ${colors.primary} 100%)`
                    e.currentTarget.style.boxShadow = `0 8px 25px ${hexToRgba(colors.primary, 0.5)}`
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.gradients.primary || `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`
                    e.currentTarget.style.boxShadow = `0 6px 20px ${hexToRgba(colors.primary, 0.4)}`
                  }}
                >
                  🎮 ไปที่ {getThemeDisplayName()}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ส่วนแสดงสถานะเกม - ย้ายมาอยู่ใต้ UserBar */}
      {gameStatus === 'countdown' && (
        <div className="game-countdown">
          <div className="countdown-display">
            {countdown > 0 ? countdown : 'READY'}
          </div>
          <p>เกมจะเริ่มในอีก {countdown > 0 ? countdown : 'READY'} วินาที</p>
        </div>
      )}

      {/* ส่วนแสดงรายการ USER และปุ่มพร้อมเล่น - ซ่อนเมื่อนับถอยหลัง เกมเริ่มแล้ว หรือเกมจบแล้ว */}
        {gameStatus !== 'countdown' && gameStatus !== 'playing' && gameStatus !== 'finished' && (
        <div className="bingo-players">
        <h4>ผู้เล่นในเกม: {players.length} | พร้อม: {readyPlayersCount}</h4>
        
        {players.length > 0 && (
          <div className="players-list">
            {players
              .filter((player) => {
                // ✅ ซ่อน HOST user จากรายการผู้เล่นเสมอ (ทั้งหน้า HOST และ user ปกติ)
                const playerKey = normalizeUser(player.username)
                const hostUsername = getHostUsername()
                const hostKey = normalizeUser(hostUsername)
                return playerKey !== hostKey
              })
              .map((player) => (
              <div 
                key={player.userId} 
                className={`player-item ${player.userId === userKey ? 'current-user' : ''} ${player.isReady ? 'ready-item' : 'waiting-item'}`}
              >
                <div className="player-name">{player.username}</div>
                <div className={`player-status ${player.isReady ? 'ready' : 'waiting'}`}>
                  {player.isReady ? '✅ พร้อม' : '⏳ รอ'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ส่วนปุ่มพร้อมเล่น - ซ่อนเมื่อนับถอยหลัง เกมเริ่มแล้ว หรือเกมจบแล้ว และซ่อนสำหรับ HOST */}
      {gameStatus !== 'countdown' && gameStatus !== 'playing' && gameStatus !== 'finished' && !isHost && (
        <div className="bingo-actions">
          {currentUser && (
            <div className="player-controls">
            <button 
              className={`btn ${currentUser.isReady ? 'btn-secondary' : 'btn-success'}`}
              onClick={handleToggleReady}
              disabled={isUpdatingReady || bingoCards.length === 0}
            >
              {isUpdatingReady ? 'กำลังอัปเดต...' : (currentUser.isReady ? 'ยกเลิกพร้อม' : 'พร้อมเล่น')}
            </button>
            
            {bingoCards.length === 0 && !currentUser.isReady && (
              <div className="no-cards-warning">
                <p className="text-warning">⚠️ กรุณาเพิ่มการ์ด BINGO ก่อนกดปุ่ม "พร้อมเล่น"</p>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* ส่วนเริ่มเกมและรีเกมสำหรับ HOST */}
      {isHost && (
        <div className="host-game-controls" style={{
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(196, 181, 253, 0.1) 100%)',
          border: '2px solid rgba(168, 85, 247, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          marginTop: '20px',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.15)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
            }}>
              <span style={{ fontSize: '20px' }}>👑</span>
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '700',
                color: '#1f2937'
              }}>
                {bingoGameStatus === 'waiting' ? 'เริ่มเกม BINGO' : 
                 bingoGameStatus === 'countdown' ? '⏳ เกมกำลังนับถอยหลัง' :
                 bingoGameStatus === 'playing' ? '🎮 เกมกำลังเล่นอยู่' :
                 bingoGameStatus === 'finished' ? '🏁 เกมจบแล้ว' :
                 'เริ่มเกม BINGO'}
              </h3>
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                {bingoGameStatus === 'waiting' ? 'คลิกเพื่อเริ่มเกม BINGO' :
                 bingoGameStatus === 'countdown' ? 'รอเกมเริ่มในอีกไม่กี่วินาที' :
                 bingoGameStatus === 'playing' ? 'เกมกำลังเล่นอยู่' :
                 bingoGameStatus === 'finished' ? 'เกมนี้จบแล้ว' :
                 'คลิกเพื่อเริ่มเกม BINGO'}
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                // ✅ ใช้ PostgreSQL 100% - ตรวจสอบสถานะปัจจุบัน
                const currentState = await postgresqlAdapter.getBingoGameState(gameId)
                
                // ถ้าเกมเริ่มแล้ว ให้แจ้งเตือน
                if (currentState && currentState.gamePhase && currentState.gamePhase !== 'waiting') {
                  alert(`⚠️ เกมได้เริ่มแล้ว (สถานะ: ${currentState.gamePhase})`)
                  return
                }
                
                // ✅ ใช้ players state ที่มีอยู่แล้ว
                const readyPlayers = players.filter(p => p.isReady)
                const waitingPlayers = players.filter(p => !p.isReady)
                
                if (readyPlayers.length === 0) {
                  alert('⚠️ ยังไม่มีผู้เล่นที่พร้อม (READY) กรุณารอให้ผู้เล่นกดปุ่ม "พร้อมเล่น" ก่อน')
                  return
                }
                
                // บันทึกรายชื่อผู้เล่นที่ไม่ได้ READY เพื่อให้แสดง popup
                const waitingUserIds = waitingPlayers.map((p: any) => p.userId || p.username)
                
                // เริ่มเกมโดยตั้ง status เป็น countdown
                const gameStateData = {
                  gamePhase: 'countdown',
                  drawnNumbers: [],
                  currentNumber: null,
                  gameStarted: false,
                  gameEnded: false,
                  startedBy: 'host',
                  startedAt: Date.now(),
                  readyPlayers: readyPlayers.length,
                  waitingPlayers: waitingUserIds
                }
                
                // ✅ ใช้ PostgreSQL 100%
                await postgresqlAdapter.updateBingoGameState(gameId, gameStateData)
                
                alert(`✅ เริ่มเกม BINGO สำเร็จ! มีผู้เล่นที่พร้อม ${readyPlayers.length} คน${waitingPlayers.length > 0 ? ` (ผู้ที่ไม่ได้พร้อม ${waitingPlayers.length} คน)` : ''}`)
              } catch (error) {
                console.error('Error starting game:', error)
                alert('❌ เกิดข้อผิดพลาดในการเริ่มเกม กรุณาลองใหม่อีกครั้ง')
              }
            }}
            disabled={bingoGameStatus !== 'waiting'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '16px 24px',
              background: bingoGameStatus === 'waiting' 
                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                : bingoGameStatus === 'countdown'
                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                : bingoGameStatus === 'playing'
                ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                : bingoGameStatus === 'finished'
                ? 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)'
                : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white',
              fontSize: '16px',
              fontWeight: '700',
              borderRadius: '12px',
              border: 'none',
              boxShadow: bingoGameStatus === 'waiting' 
                ? '0 4px 16px rgba(16, 185, 129, 0.3)'
                : bingoGameStatus === 'countdown'
                ? '0 4px 16px rgba(245, 158, 11, 0.3)'
                : bingoGameStatus === 'playing'
                ? '0 4px 16px rgba(59, 130, 246, 0.3)'
                : bingoGameStatus === 'finished'
                ? '0 4px 16px rgba(107, 114, 128, 0.3)'
                : '0 4px 16px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.3s ease',
              cursor: bingoGameStatus === 'waiting' ? 'pointer' : 'not-allowed',
              opacity: bingoGameStatus !== 'waiting' ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (bingoGameStatus === 'waiting') {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (bingoGameStatus === 'waiting') {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.3)'
              }
            }}
          >
            {bingoGameStatus === 'waiting' ? '🎮 เริ่มเกม BINGO เลย' :
             bingoGameStatus === 'countdown' ? '⏳ กำลังนับถอยหลัง...' :
             bingoGameStatus === 'playing' ? '🎮 เกมกำลังเล่นอยู่' :
             bingoGameStatus === 'finished' ? '🏁 เกมจบแล้ว' :
             '🎮 เริ่มเกม BINGO เลย'}
          </button>
          
          {/* ปุ่มรีเกม BINGO */}
          <button
            onClick={async () => {
              if (!confirm('คุณแน่ใจว่าต้องการรีเกม BINGO นี้หรือไม่?\n\nการรีเกมจะลบผู้เล่น ข้อมูลเกม และข้อความแชททั้งหมด\nและตั้งค่าเกมกลับเป็นสถานะเริ่มต้น')) {
                return
              }

              try {
                // ✅ ใช้ PostgreSQL 100% - รีเซ็ต game state
                await postgresqlAdapter.updateBingoGameState(gameId, {
                  gamePhase: 'waiting',
                  drawnNumbers: [],
                  currentNumber: null,
                  gameStarted: false,
                  gameEnded: false
                })
                
                // ✅ หมายเหตุ: การลบ players และ cards อาจจะต้องใช้ API endpoint แยก
                // สำหรับตอนนี้จะรีเซ็ตแค่ game state ก่อน
                
                alert('รีเกม BINGO เรียบร้อยแล้ว\n\nเกมถูกรีเซ็ตเป็นสถานะเริ่มต้นแล้ว\nกรุณารีเฟรชหน้าเกมเพื่อดูผลลัพธ์')
              } catch (error) {
                console.error('Error resetting BINGO game:', error)
                alert('เกิดข้อผิดพลาดในการรีเกม\nกรุณาลองใหม่อีกครั้ง')
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              marginTop: '12px',
              padding: '14px 24px',
              background: `linear-gradient(135deg, ${colors.danger} 0%, ${colors.dangerLight} 100%)`,
              color: 'white',
              fontSize: '15px',
              fontWeight: '700',
              borderRadius: '12px',
              border: 'none',
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              opacity: 1
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.3)'
            }}
          >
            🔄 รีเกม BINGO
          </button>
        </div>
      )}

      {/* ส่วนการ์ด BINGO - ซ่อนเมื่อเกมจบแล้ว และซ่อนสำหรับ HOST */}
      {currentUser && gameStatus !== 'finished' && !isHost && (
        <div className="bingo-cards-section">
          <div className="bingo-cards-header">
            <h4>🎯 การ์ด BINGO ของฉัน</h4>
                    {!currentUser.isReady && (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={handleGenerateBingoCard}
                        disabled={isGeneratingCard || (bingoCards.length > 0 && currentUser.credit < 100)}
                      >
                        {isGeneratingCard 
                          ? 'กำลังสร้าง...' 
                          : bingoCards.length === 0 
                            ? '+ เพิ่มการ์ดฟรี' 
                            : '+ เพิ่มการ์ดเสีย 100 HCOIN'
                        }
                      </button>
                    )}
          </div>
          
          {bingoCards.length > 0 && (
            <div className="bingo-cards-grid">
              {bingoCards.map((card) => (
                <div key={card.id} className="bingo-card">
                  <div className="bingo-card-header">
                    <span className="bingo-card-title">BINGO</span>
                    <span className="bingo-card-id">#{card.id.slice(-6)}</span>
                  </div>
                  
                  <div className="bingo-card-grid">
                    {/* Header B-I-N-G-O */}
                    <div className="bingo-header">
                      <div className="bingo-cell bingo-header-cell">B</div>
                      <div className="bingo-cell bingo-header-cell">I</div>
                      <div className="bingo-cell bingo-header-cell">N</div>
                      <div className="bingo-cell bingo-header-cell">G</div>
                      <div className="bingo-cell bingo-header-cell">O</div>
                    </div>
                    
                    {/* ตัวเลขในตาราง - เรียงแนวตั้งก่อน */}
                      {Array.from({ length: 5 }, (_, rowIndex) => 
                      Array.from({ length: 5 }, (_, colIndex) => {
                        const number = card.numbers[colIndex][rowIndex]
                        const isChecked = card.checkedNumbers?.[rowIndex]?.[colIndex] || false
                        const isDrawn = drawnNumbers.includes(number)
                        // ✅ ช่องที่ถูก check แล้วไม่สามารถคลิกได้อีก (เฉพาะช่องที่ UI แสดงว่าถูก)
                        const canClick = gameStatus === 'playing' && number !== 0 && isDrawn && !isChecked
                        
                        return (
                          <div 
                            key={`${card.id}-${rowIndex}-${colIndex}`}
                            className={`bingo-cell ${number === 0 ? 'bingo-free' : ''} ${isChecked ? 'bingo-checked' : ''} ${canClick ? 'bingo-clickable' : ''}`}
                            onClick={() => canClick && handleCellClick(card, rowIndex, colIndex)}
                            style={{ cursor: canClick ? 'pointer' : 'default' }}
                          >
                            {number === 0 ? 'FREE' : number}
                          </div>
                        )
                      })
                    )}
                  </div>
                  
                  {/* ปุ่ม BINGO */}
                  <div className="bingo-card-footer">
                    <button 
                      className={`btn btn-bingo ${card.isBingo ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => handleClaimBingo(card)}
                      disabled={card.isBingo}
                    >
                      {card.isBingo ? 'BINGO!' : 'BINGO'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
                  {bingoCards.length === 0 && !currentUser.isReady && (
                    <div className="no-cards-message">
                      <p>ยังไม่มีการ์ด BINGO คลิกปุ่ม "เพิ่มการ์ด" เพื่อสร้างการ์ดใหม่</p>
                    </div>
                  )}
        </div>
      )}

      {/* Popup เมื่อเกมเริ่มแล้วและ USER เข้าระบบใหม่ (ไม่แสดงสำหรับ HOST) */}
      {showGameStartedPopup && !isHost && (
        <div className="modal-overlay">
          <div 
            className={`notification-popup ${themeName === 'heng36' ? 'heng-theme' : ''}`}
          >
            <div className="notification-header">
              <div className="notification-title">
                🎮 เกมได้เริ่มต้นแล้ว
              </div>
            </div>
            
            <div className="notification-content">
              <div className="notification-message">
                รอติดตามรอบต่อไปได้เลยค่ะ
              </div>
              
              <div className="notification-actions">
                <button 
                  className="notification-btn"
                  onClick={handleGoToThemeLink}
                >
                  ไปที่ {getThemeDisplayName()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup สำหรับ USER ที่ไม่ได้ READY (ไม่แสดงสำหรับ HOST) */}
      {showNotReadyPopup && !isHost && (
        <div className="modal-overlay">
          <div 
            className={`notification-popup theme-${themeName}`}
          >
            <div className="notification-header">
              <div className="notification-title">
                ⚠️ USER ไม่ได้กดพร้อมในเวลาที่กำหนด
              </div>
            </div>
            
            <div className="notification-content">
              <div className="notification-message">
                รอติดตามกิจกรรมรอบต่อไปได้เลยค่ะ
              </div>
              
              <div className="notification-actions">
                <button 
                  className="notification-btn"
                  onClick={() => setShowNotReadyPopup(false)}
                >
                  ปิด
                </button>
                <button 
                  className="notification-btn"
                  onClick={handleGoToThemeLink}
                >
                  ไปที่ {getThemeDisplayName()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Chat Component */}
      <LiveChat gameId={gameId} username={username} isHost={isHost} />

    </div>
  )
}