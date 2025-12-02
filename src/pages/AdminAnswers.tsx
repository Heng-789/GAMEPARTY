import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import PlayerAnswersList from '../components/PlayerAnswersList'
import { useTheme, useThemeAssets, useThemeColors } from '../contexts/ThemeContext'
import * as postgresqlAdapter from '../services/postgresql-adapter'

interface AnswerData {
  id: string
  username: string
  answer: string
  timestamp: number
  ts: number // เพิ่ม ts field เพื่อให้ตรงกับหน้าแก้ไขเกม
  gameId: string
  correct?: boolean
  code?: string
  won?: boolean
  amount?: number
  // ✅ ข้อมูลเฉพาะเกมเช็คอิน
  dayIndex?: number
  action?: string // 'checkin', 'checkin-complete', 'coupon-redeem'
  serverDate?: string
  balanceBefore?: number
  balanceAfter?: number
  itemIndex?: number // สำหรับ coupon-redeem
  price?: number // สำหรับ coupon-redeem (ราคาที่ใช้แลก)
}

interface GameData {
  id: string
  name: string
  type: string
  emoji: string
}

export default function AdminAnswers() {
  const { gameId } = useParams<{ gameId: string }>()
  const assets = useThemeAssets()
  const colors = useThemeColors()
  const { themeName } = useTheme()
  const [game, setGame] = useState<GameData | null>(null)
  const [gameData, setGameData] = useState<any>(null)
  
  // ✅ ใช้ ref เพื่อเก็บค่า gameId และ type เพื่อป้องกันการ reset state ที่ไม่จำเป็น
  const lastGameIdRef = React.useRef<string | null>(null)
  const lastGameTypeRef = React.useRef<string | null>(null)
  const [answers, setAnswers] = useState<AnswerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // สำหรับเกมประกาศรางวัล
  const [announceUsers, setAnnounceUsers] = useState<string[]>([])
  const [announceUserBonuses, setAnnounceUserBonuses] = useState<Array<{ user: string; bonus: number }>>([])
  
  // สำหรับจัดการการแก้ไขรายการ
  const [editingItems, setEditingItems] = useState<Record<string, { isEditing: boolean; inputValue: string; savedValue: string }>>({})
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set())
  
  // ✅ สำหรับเกมเช็คอิน: หมวดหมู่
  const [activeTab, setActiveTab] = useState<'alluser' | 'checkin' | 'coupon'>('alluser')
  const [allUsers, setAllUsers] = useState<Array<{ user: string; hcoin: number; lastLogin?: number }>>([])
  const [allUsersLoading, setAllUsersLoading] = useState(false)
  // ✅ Pagination สำหรับ ALLUSER
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 100 // หน้าละ 100 users
  // ✅ ใช้ ref เพื่อเก็บค่า currentPage ที่ถูกต้อง (ไม่ต้องรอ state update)
  const currentPageRef = React.useRef(1)
  
  // ✅ Sync currentPageRef กับ currentPage state
  React.useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])
  
  // ✅ Pagination สำหรับ Answers
  const [answersCurrentPage, setAnswersCurrentPage] = useState(1)
  const answersPerPage = 100 // หน้าละ 100 answers
  const [showAllAnswers, setShowAllAnswers] = useState(false) // ✅ ตัวเลือกแสดงทั้งหมด
  
  // ✅ Search state
  const [searchUsername, setSearchUsername] = useState('')
  const [searchAnswer, setSearchAnswer] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [showLatestOnly, setShowLatestOnly] = useState(false)
  
  const handleStartEdit = (key: string) => {
    setEditingItems(prev => {
      // ถ้ากำลัง edit อยู่แล้ว ไม่ต้องทำอะไร
      if (prev[key]?.isEditing) return prev
      
      return {
        ...prev,
        [key]: {
          isEditing: true,
          inputValue: prev[key]?.savedValue || '',
          savedValue: prev[key]?.savedValue || ''
        }
      }
    })
  }
  
  const handleCancelEdit = (key: string) => {
    setEditingItems(prev => {
      // ถ้าไม่มี state สำหรับ key นี้ ไม่ต้องทำอะไร
      if (!prev[key]) return prev
      
      const newState = { ...prev }
      delete newState[key]
      return newState
    })
  }
  
  // Optimize onChange handler with useCallback
  const handleInputChange = React.useCallback((key: string, value: string) => {
    setEditingItems(prev => {
      // ถ้าค่าเดิมเหมือนกัน ไม่ต้องอัปเดต
      if (prev[key]?.inputValue === value) return prev
      
      return {
        ...prev,
        [key]: {
          ...prev[key],
          inputValue: value
        }
      }
    })
  }, [])
  
  const handleConfirmEdit = async (key: string) => {
    if (!gameId || savingItems.has(key)) return
    
    const inputValue = editingItems[key]?.inputValue || ''
    if (!inputValue.trim()) {
      alert('กรุณากรอกข้อมูลก่อนยืนยัน')
      return
    }
    
    setSavingItems(prev => new Set(prev).add(key))
    
    try {
      // แยก user key จาก key (เช่น "bonus-0-YJMAX" หรือ "user-0-USERNAME")
      const parts = key.split('-')
      let user: string
      
      if (parts[0] === 'bonus') {
        // สำหรับรายการที่มี bonus: key = "bonus-{idx}-{user}"
        user = parts.slice(2).join('-') // รองรับชื่อที่มี dash
      } else {
        // สำหรับรายการธรรมดา: key = "user-{idx}-{user}"
        user = parts.slice(2).join('-') // รองรับชื่อที่มี dash
      }
      
      // Use PostgreSQL adapter (บันทึกลง game data)
      try {
        const gameData = await postgresqlAdapter.getGameData(gameId)
        if (gameData) {
          // ✅ สร้าง updatedData โดยเก็บข้อมูล announce อื่นๆ ไว้ (users, userBonuses, imageDataUrl, fileName)
          // ✅ รองรับทั้ง nested structure (gameData.announce) และ flat structure (announce)
          const existingAnnounce = (gameData as any).gameData?.announce || gameData.announce || {}
          
          const updatedData = {
            ...gameData,
            announce: {
              ...existingAnnounce,
              // ✅ Preserve users และ userBonuses
              users: existingAnnounce.users || [],
              userBonuses: existingAnnounce.userBonuses || [],
              // ✅ Preserve imageDataUrl และ fileName
              imageDataUrl: existingAnnounce.imageDataUrl,
              fileName: existingAnnounce.fileName,
              // ✅ อัปเดต processedItems โดยไม่ลบข้อมูลเดิม
              processedItems: {
                ...(existingAnnounce.processedItems || {}),
                [user]: {
                  value: inputValue.trim(),
                  timestamp: Date.now()
                }
              }
            }
          }
          
          try {
            await postgresqlAdapter.updateGame(gameId, updatedData)
          } catch (updateError) {
            console.error('[AdminAnswers] Error calling updateGame:', updateError)
            throw updateError
          }
          
          // ✅ Invalidate cache เพื่อให้ข้อมูลอัปเดต
          const { dataCache, cacheKeys } = await import('../services/cache')
          dataCache.delete(cacheKeys.game(gameId))
          
          // ✅ อัปเดต gameData state เพื่อให้ UI sync ทันที
          setGameData((prev: any) => {
            if (!prev) return prev
            const prevAnnounce = (prev as any).gameData?.announce || prev.announce || {}
            return {
              ...prev,
              announce: {
                ...prevAnnounce,
                processedItems: {
                  ...(prevAnnounce.processedItems || {}),
                  [user]: {
                    value: inputValue.trim(),
                    timestamp: Date.now()
                  }
                }
              }
            }
          })
          
          // ✅ อัปเดต editingItems state เพื่อให้ UI แสดงข้อมูลที่บันทึกไว้
          setEditingItems(prev => ({
            ...prev,
            [key]: {
              isEditing: false,
              inputValue: inputValue.trim(),
              savedValue: inputValue.trim()
            }
          }))
          
          // ✅ Reload ข้อมูลจากฐานข้อมูลเพื่อให้แน่ใจว่าข้อมูล sync (optional - ถ้าต้องการ)
          // ✅ ใช้ setTimeout เพื่อให้ UI อัปเดตก่อน
          setTimeout(async () => {
            try {
              const freshData = await postgresqlAdapter.getGameData(gameId, true)
              if (freshData) {
                const freshAnnounce = (freshData as any).gameData?.announce || freshData.announce || {}
                if (freshAnnounce.processedItems && freshAnnounce.processedItems[user]) {
                  // ✅ อัปเดต state จากข้อมูลที่โหลดมาใหม่
                  setEditingItems(prev => ({
                    ...prev,
                    [key]: {
                      isEditing: false,
                      inputValue: freshAnnounce.processedItems[user].value || '',
                      savedValue: freshAnnounce.processedItems[user].value || ''
                    }
                  }))
                  
                  // ✅ อัปเดต gameData state (แต่ไม่ reset announceUsers และ announceUserBonuses)
                  setGameData((prev: any) => {
                    if (!prev) return freshData
                    const updatedData = {
                      ...prev,
                      announce: freshAnnounce
                    }
                    // ✅ ถ้ามีข้อมูล announce ใหม่ ให้อัปเดต announceUsers และ announceUserBonuses
                    if (freshAnnounce.users || freshAnnounce.userBonuses) {
                      const freshUsers = Array.isArray(freshAnnounce.users) ? freshAnnounce.users : []
                      const freshUserBonuses = Array.isArray(freshAnnounce.userBonuses) ? freshAnnounce.userBonuses : []
                      
                      // ✅ อัปเดต state เฉพาะเมื่อมีข้อมูลใหม่
                      if (freshUsers.length > 0) {
                        setAnnounceUsers(prevUsers => {
                          // ถ้ามีข้อมูลอยู่แล้วและเหมือนเดิม ไม่ต้องอัปเดต
                          if (prevUsers.length === freshUsers.length && 
                              prevUsers.length > 0 && 
                              prevUsers.every((u, i) => u === freshUsers[i])) {
                            return prevUsers
                          }
                          return freshUsers
                        })
                      }
                      
                      if (freshUserBonuses.length > 0) {
                        setAnnounceUserBonuses(prevBonuses => {
                          // ถ้ามีข้อมูลอยู่แล้วและเหมือนเดิม ไม่ต้องอัปเดต
                          if (prevBonuses.length === freshUserBonuses.length && 
                              prevBonuses.length > 0 && 
                              prevBonuses.every((ub, i) => ub.user === freshUserBonuses[i].user && ub.bonus === freshUserBonuses[i].bonus)) {
                            return prevBonuses
                          }
                          return freshUserBonuses
                        })
                      }
                    }
                    return updatedData
                  })
                }
              }
            } catch (reloadError) {
              console.error('[AdminAnswers] Error reloading data after save:', reloadError)
            }
          }, 500)
        } else {
          throw new Error('Game data not found')
        }
      } catch (error) {
        console.error('Error updating processedItems via PostgreSQL:', error)
        throw error
      }
      
      // ✅ แสดงข้อความสำเร็จ (optional - ถ้าต้องการ)
      // alert(`บันทึกข้อมูลสำหรับ ${user} สำเร็จ`)
    } catch (error) {
      console.error('Error saving processed item:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${errorMessage}`)
    } finally {
      setSavingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }
  
  const handleEdit = React.useCallback((key: string) => {
    setEditingItems(prev => {
      // ถ้ากำลัง edit อยู่แล้ว ไม่ต้องทำอะไร
      if (prev[key]?.isEditing) return prev
      
      return {
        ...prev,
        [key]: {
          isEditing: true,
          inputValue: prev[key]?.savedValue || '',
          savedValue: prev[key]?.savedValue || ''
        }
      }
    })
  }, [])


  useEffect(() => {
    if (!gameId) return
    
    // ✅ ตรวจสอบว่า gameId เปลี่ยนหรือไม่
    const isGameIdChanged = lastGameIdRef.current !== gameId
    if (!isGameIdChanged) {
      // ถ้า gameId ไม่เปลี่ยน ไม่ต้องโหลดใหม่
      return
    }
    
    // ✅ อัปเดต ref
    lastGameIdRef.current = gameId

    let isMounted = true

    // ✅ โหลดข้อมูลเกม (ใช้ PostgreSQL adapter)
    const loadGameData = async () => {
      try {
        // ✅ Debug: Log การเรียก API
        if (process.env.NODE_ENV === 'development') {
          console.log('[AdminAnswers] Loading game data:', { gameId, isGameIdChanged })
        }
        
        // ✅ ใช้ fullData=true เพื่อบังคับให้ backend ส่ง full game data
        const data = await postgresqlAdapter.getGameData(gameId, true)
        if (!isMounted) return
        
        // ✅ Debug: Log ข้อมูลที่ได้รับ (always log to help debug)
        console.log('[AdminAnswers] Game data received:', {
          gameId,
          hasData: !!data,
          dataType: typeof data,
          isArray: Array.isArray(data),
          dataKeys: data ? Object.keys(data) : [],
          gameType: data?.type,
          hasAnnounce: !!(data as any)?.announce,
          hasGameData: !!(data as any)?.gameData,
          hasGameDataAnnounce: !!(data as any)?.gameData?.announce,
          announceKeys: (data as any)?.announce ? Object.keys((data as any).announce) : [],
          announceUsersCount: Array.isArray((data as any)?.announce?.users) ? (data as any).announce.users.length : 0,
          announceUserBonusesCount: Array.isArray((data as any)?.announce?.userBonuses) ? (data as any).announce.userBonuses.length : 0,
          fullData: data
        })
        
        if (!data) {
          setError('ไม่พบข้อมูลเกม')
          setLoading(false)
          return
        }
        
        setGameData(data)
        setGame({
          id: gameId,
          name: data.name || 'ไม่ระบุชื่อ',
          type: data.type || 'ไม่ระบุประเภท',
          emoji: data.emoji || '🎮'
        })
        
        // ✅ อัปเดต gameType ref
        const currentGameType = data.type || 'ไม่ระบุประเภท'
        const isGameTypeChanged = lastGameTypeRef.current !== currentGameType
        lastGameTypeRef.current = currentGameType
        
        // โหลดข้อมูลสำหรับเกมประกาศรางวัล
        // ✅ รองรับทั้ง nested structure (gameData.announce) และ flat structure (announce)
        if (data.type === 'เกมประกาศรางวัล') {
          // ✅ ตรวจสอบข้อมูล announce จากหลายที่
          // ✅ ตรวจสอบจาก top-level ก่อน (เพราะ backend ส่งมาในรูปแบบ { ...row.game_data })
          // ✅ ตรวจสอบจาก data.announce, data.gameData?.announce, หรือ data.gameData (ถ้า announce อยู่ใน gameData)
          let announceData = data.announce || (data as any).gameData?.announce || (data as any).announce
          
          // ✅ ถ้าไม่มี announceData แต่มี gameData ให้ตรวจสอบว่า gameData เป็น announce object หรือไม่
          if (!announceData && (data as any).gameData && typeof (data as any).gameData === 'object') {
            const gameData = (data as any).gameData
            // ถ้า gameData มี users หรือ userBonuses แสดงว่า gameData คือ announce object
            if (gameData.users || gameData.userBonuses) {
              announceData = gameData
            }
          }
          
          // ✅ ถ้ายังไม่มี announceData ให้ใช้ object ว่าง
          if (!announceData || typeof announceData !== 'object') {
            announceData = {}
          }
          
          // ✅ Debug: Log ข้อมูล announce (always log to help debug)
          console.log('[AdminAnswers] Announce data extracted:', {
            gameId,
            announceDataKeys: Object.keys(announceData),
            announceDataType: typeof announceData,
            hasUsers: !!(announceData as any)?.users,
            hasUserBonuses: !!(announceData as any)?.userBonuses,
            usersCount: Array.isArray((announceData as any)?.users) ? (announceData as any).users.length : 0,
            userBonusesCount: Array.isArray((announceData as any)?.userBonuses) ? (announceData as any).userBonuses.length : 0,
            usersValue: (announceData as any)?.users,
            userBonusesValue: (announceData as any)?.userBonuses,
            dataAnnounce: data.announce,
            dataGameDataAnnounce: (data as any).gameData?.announce,
            dataGameData: (data as any).gameData,
            fullData: data,
            announceData
          })
          
          // ✅ ตรวจสอบว่า announceData เป็น object หรือไม่
          const safeAnnounceData = announceData && typeof announceData === 'object' ? announceData : {}
          
          // ✅ Debug: Log safeAnnounceData (always log to help debug)
          console.log('[AdminAnswers] Safe announce data:', {
            safeAnnounceDataKeys: Object.keys(safeAnnounceData),
            safeAnnounceDataUsers: safeAnnounceData?.users,
            safeAnnounceDataUserBonuses: safeAnnounceData?.userBonuses,
            usersIsArray: Array.isArray(safeAnnounceData?.users),
            userBonusesIsArray: Array.isArray(safeAnnounceData?.userBonuses),
            usersType: typeof safeAnnounceData?.users,
            userBonusesType: typeof safeAnnounceData?.userBonuses,
            usersValue: safeAnnounceData?.users,
            userBonusesValue: safeAnnounceData?.userBonuses
          })
          
          // ✅ แปลง users และ userBonuses ให้เป็น array
          // ✅ รองรับทั้ง array และ object (ถ้าเป็น object ให้แปลงเป็น array)
          let users: string[] = []
          if (Array.isArray(safeAnnounceData?.users)) {
            users = safeAnnounceData.users
          } else if (safeAnnounceData?.users && typeof safeAnnounceData.users === 'object') {
            // ถ้าเป็น object ให้แปลงเป็น array โดยใช้ Object.values หรือ Object.keys
            // ตรวจสอบว่าเป็น object ที่มี numeric keys หรือไม่
            const usersObj = safeAnnounceData.users
            const keys = Object.keys(usersObj)
            const numericKeys = keys.filter(k => !isNaN(Number(k)))
            if (numericKeys.length > 0) {
              // ถ้ามี numeric keys แสดงว่าเป็น array-like object
              users = Object.values(usersObj) as string[]
            } else {
              // ถ้าไม่มี numeric keys แสดงว่าเป็น object ธรรมดา ให้ใช้ values
              users = Object.values(usersObj) as string[]
            }
          }
          
          let userBonuses: Array<{ user: string; bonus: number }> = []
          if (Array.isArray(safeAnnounceData?.userBonuses)) {
            userBonuses = safeAnnounceData.userBonuses
          } else if (safeAnnounceData?.userBonuses && typeof safeAnnounceData.userBonuses === 'object') {
            // ถ้าเป็น object ให้แปลงเป็น array
            const bonusesObj = safeAnnounceData.userBonuses
            const keys = Object.keys(bonusesObj)
            const numericKeys = keys.filter(k => !isNaN(Number(k)))
            if (numericKeys.length > 0) {
              // ถ้ามี numeric keys แสดงว่าเป็น array-like object
              userBonuses = Object.values(bonusesObj) as Array<{ user: string; bonus: number }>
            } else {
              // ถ้าไม่มี numeric keys แสดงว่าเป็น object ธรรมดา ให้ใช้ values
              userBonuses = Object.values(bonusesObj) as Array<{ user: string; bonus: number }>
            }
          }
          
          // ✅ Debug: Log ข้อมูลที่ถูก set
          if (process.env.NODE_ENV === 'development') {
            console.log('[AdminAnswers] Setting announce state:', {
              usersCount: users.length,
              userBonusesCount: userBonuses.length,
              users: users.slice(0, 5), // แสดง 5 รายการแรก
              userBonuses: userBonuses.slice(0, 5)
            })
          }
          
          // ✅ ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่ก่อน set (ป้องกันการ reset ที่ไม่จำเป็น)
          setAnnounceUsers(prev => {
            // ถ้ามีข้อมูลอยู่แล้วและข้อมูลใหม่เหมือนเดิม ไม่ต้องอัปเดต
            if (prev.length === users.length && 
                prev.length > 0 && 
                prev.every((u, i) => u === users[i])) {
              return prev
            }
            return users
          })
          
          setAnnounceUserBonuses(prev => {
            // ถ้ามีข้อมูลอยู่แล้วและข้อมูลใหม่เหมือนเดิม ไม่ต้องอัปเดต
            if (prev.length === userBonuses.length && 
                prev.length > 0 && 
                prev.every((ub, i) => ub.user === userBonuses[i].user && ub.bonus === userBonuses[i].bonus)) {
              return prev
            }
            return userBonuses
          })
          
          // โหลดข้อมูล processedItems ที่บันทึกไว้ (เฉพาะครั้งแรก ไม่ต้อง reactive)
          // ✅ เพิ่ม null check เพื่อป้องกัน error
          if (safeAnnounceData && typeof safeAnnounceData === 'object' && safeAnnounceData.processedItems) {
            const processed = safeAnnounceData.processedItems
            
            const processedState: Record<string, { isEditing: boolean; inputValue: string; savedValue: string }> = {}
            
            // สำหรับรายการที่มี bonus
            userBonuses.forEach((item, idx) => {
              const itemKey = `bonus-${idx}-${item.user}`
              if (processed[item.user]) {
                processedState[itemKey] = {
                  isEditing: false,
                  inputValue: processed[item.user].value || '',
                  savedValue: processed[item.user].value || ''
                }
              }
            })
            
            // สำหรับรายการ USER ธรรมดา
            users.forEach((user, idx) => {
              const itemKey = `user-${idx}-${user}`
              if (processed[user]) {
                processedState[itemKey] = {
                  isEditing: false,
                  inputValue: processed[user].value || '',
                  savedValue: processed[user].value || ''
                }
              }
            })
            
            // ตรวจสอบว่ามีการเปลี่ยนแปลงก่อนอัปเดต state
            setEditingItems(prev => {
              // ถ้าข้อมูลเหมือนเดิม ไม่ต้องอัปเดต
              const prevKeys = Object.keys(prev)
              const newKeys = Object.keys(processedState)
              if (prevKeys.length === newKeys.length && 
                  prevKeys.every(key => prev[key]?.savedValue === processedState[key]?.savedValue)) {
                return prev
              }
              return processedState
            })
          } else {
            // ถ้าไม่มี processedItems แต่มี users หรือ userBonuses อยู่แล้ว ไม่ต้อง reset
            setEditingItems(prev => {
              // ถ้ามีข้อมูลอยู่แล้ว ไม่ต้อง reset
              if (Object.keys(prev).length > 0 && (users.length > 0 || userBonuses.length > 0)) {
                return prev
              }
              return {}
            })
          }
        } else {
          // ✅ ถ้าไม่ใช่เกมประกาศรางวัล ให้ reset เฉพาะเมื่อเปลี่ยนเกมหรือเปลี่ยนประเภทเกมจริงๆ
          // ✅ แต่ถ้า gameId ไม่เปลี่ยน (คือเกมเดิม) ไม่ต้อง reset (ป้องกันการ reset ที่ไม่จำเป็น)
          if (isGameIdChanged || isGameTypeChanged) {
            // ✅ Reset เฉพาะเมื่อเปลี่ยนเกมจริงๆ (gameId เปลี่ยน)
            if (isGameIdChanged) {
              setAnnounceUsers([])
              setAnnounceUserBonuses([])
              setEditingItems({})
            }
            // ✅ ถ้าเปลี่ยนประเภทเกม แต่ยังเป็นเกมเดิม (gameId เดิม) ไม่ต้อง reset announce data
            // เพราะอาจเป็น false positive (เช่น component re-render)
          }
        }
      } catch (error) {
        console.error('Error loading game data from PostgreSQL:', error)
        if (isMounted) {
          setError('ไม่สามารถโหลดข้อมูลเกมได้')
          setLoading(false)
        }
      }
    }

    loadGameData()

    // Cleanup function สำหรับ game data
    return () => {
      isMounted = false
    }
  }, [gameId])

  // ✅ Function สำหรับโหลดคำตอบ (เรียกใช้เมื่อรีเฟรชหน้าและกดปุ่มรีเฟรช)
  const fetchAnswers = React.useCallback(async () => {
    if (!gameId) return
    
    try {
      setLoading(true)
      
      // Use PostgreSQL adapter - โหลดข้อมูลทั้งหมด (ใช้ limit สูงมากเพื่อให้ได้ข้อมูลทั้งหมด)
      const answersList = await postgresqlAdapter.getAnswers(gameId, 1000000) // ใช้ 1,000,000 เพื่อให้ backend ไม่ใช้ LIMIT (โหลดทั้งหมด)
      
      // แปลงเป็น AnswerData format
      const formattedAnswers: AnswerData[] = answersList.map((ans: any) => ({
        id: ans.id.toString(),
        username: ans.userId || ans.username || 'ไม่ระบุชื่อ',
        answer: ans.answer || '',
        timestamp: ans.ts || ans.createdAt ? new Date(ans.createdAt || ans.ts).getTime() : Date.now(),
        ts: ans.ts || ans.createdAt ? new Date(ans.createdAt || ans.ts).getTime() : Date.now(),
        gameId: ans.gameId || gameId,
        correct: ans.correct,
        code: ans.code,
        won: ans.won,
        amount: ans.amount,
      }))
      
      // เรียงตาม timestamp (ใหม่ไปเก่า)
      formattedAnswers.sort((a, b) => b.ts - a.ts)
      
      setAnswers(formattedAnswers)
      setLoading(false)
      setError(null)
    } catch (error) {
      console.error('Error fetching answers from PostgreSQL:', error)
      setLoading(false)
      setError('ไม่สามารถโหลดคำตอบได้')
    }
  }, [gameId])

  // ✅ โหลดคำตอบเมื่อ component mount (รีเฟรชหน้า)
  useEffect(() => {
    if (!gameId || !gameData) return
    fetchAnswers()
    
    // ✅ ถ้าเป็นเกมประกาศรางวัล และ gameData เปลี่ยน ให้ reload ข้อมูล announce
    if (gameData.type === 'เกมประกาศรางวัล') {
      const announceData = (gameData as any).announce || (gameData as any).gameData?.announce || {}
      
      // ✅ ถ้ามีข้อมูล announce ใหม่ ให้อัปเดต state
      if (announceData.users || announceData.userBonuses) {
        const users = Array.isArray(announceData.users) ? announceData.users : []
        const userBonuses = Array.isArray(announceData.userBonuses) ? announceData.userBonuses : []
        
        // ✅ อัปเดต state เฉพาะเมื่อมีข้อมูลใหม่และแตกต่างจากเดิม
        if (users.length > 0) {
          setAnnounceUsers(prevUsers => {
            // ถ้ามีข้อมูลอยู่แล้วและเหมือนเดิม ไม่ต้องอัปเดต
            if (prevUsers.length === users.length && 
                prevUsers.length > 0 && 
                prevUsers.every((u, i) => u === users[i])) {
              return prevUsers
            }
            return users
          })
        }
        
        if (userBonuses.length > 0) {
          setAnnounceUserBonuses(prevBonuses => {
            // ถ้ามีข้อมูลอยู่แล้วและเหมือนเดิม ไม่ต้องอัปเดต
            if (prevBonuses.length === userBonuses.length && 
                prevBonuses.length > 0 && 
                prevBonuses.every((ub, i) => ub.user === userBonuses[i].user && ub.bonus === userBonuses[i].bonus)) {
              return prevBonuses
            }
            return userBonuses
          })
        }
      }
    }
  }, [gameId, gameData, fetchAnswers])

  // ✅ โหลดข้อมูล ALLUSER สำหรับเกมเช็คอิน
  useEffect(() => {
    if (!gameId || !gameData || gameData.type !== 'เกมเช็คอิน') {
      setAllUsers([])
      setCurrentPage(1)
      return
    }

    let isMounted = true
    let isFirstLoad = true
    setAllUsersLoading(true)

    // ✅ โหลดข้อมูล checkins (ใช้ PostgreSQL adapter with polling)
    let intervalId: NodeJS.Timeout | null = null
    
    const fetchAllUsers = async () => {
      if (!isMounted) return
      
      try {
        // Use PostgreSQL adapter to get all checkins
        const checkinsByUser = await postgresqlAdapter.getAllCheckins(gameId, 365) // 365 วัน
        
        // แปลง checkins data เป็น users list
        const users = new Set<string>()
        const userLastLogin: Record<string, number> = {}
        
        // วน loop checkins เพื่อหา unique users
        for (const [userId, userCheckins] of Object.entries(checkinsByUser)) {
          users.add(userId)
          
          // หา lastLogin จาก checkin ล่าสุด
          let maxTimestamp = 0
          for (const [dayIndex, checkinData] of Object.entries(userCheckins)) {
            if (checkinData && typeof checkinData === 'object') {
              const cd = checkinData as any
              if (cd.createdAt) {
                const timestamp = new Date(cd.createdAt).getTime()
                if (timestamp > maxTimestamp) {
                  maxTimestamp = timestamp
                }
              }
            }
          }
          if (maxTimestamp > 0) {
            userLastLogin[userId] = maxTimestamp
          }
        }
        
        const usersArray = Array.from(users)
        const sortedUsersArray = usersArray.sort((a, b) => {
          const aLastLogin = userLastLogin[a] || 0
          const bLastLogin = userLastLogin[b] || 0
          return bLastLogin - aLastLogin
        })
        
        // ✅ โหลด hcoin สำหรับ users ทั้งหมด - ใช้ getAllUsers แทน getUserData แยก (ลดจำนวน API calls)
        // ✅ สร้าง Map เพื่อเก็บ hcoin จาก getAllUsers
        const userHcoinMap = new Map<string, number>()
        
        // ✅ ดึง users ทั้งหมดแบบ pagination (ใช้ getAllUsers ที่มี hcoin อยู่แล้ว)
        const BATCH_SIZE = 1000 // เพิ่ม batch size เพื่อลดจำนวน API calls
        let page = 1
        let hasMore = true
        
        while (hasMore && isMounted) {
          try {
            const result = await postgresqlAdapter.getAllUsers(page, BATCH_SIZE, '')
            const users = result.users || []
            
            // ✅ เก็บ hcoin ลง Map
            users.forEach(u => {
              if (u.userId) {
                const hcoin = Number(u.hcoin || 0)
                userHcoinMap.set(u.userId.toUpperCase(), Number.isFinite(hcoin) ? hcoin : 0)
              }
            })
            
            // ✅ ตรวจสอบว่ามีข้อมูลเพิ่มเติมหรือไม่
            if (users.length < BATCH_SIZE || page * BATCH_SIZE >= result.total) {
              hasMore = false
            } else {
              page++
              // ✅ หน่วงเวลาเล็กน้อยเพื่อไม่ให้ server overload
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          } catch (error) {
            console.error('Error loading users batch:', error)
            hasMore = false
          }
        }
        
        // ✅ สร้าง allUsersWithHcoin จาก sortedUsersArray โดยใช้ userHcoinMap
        const allUsersWithHcoin: Array<{ user: string; hcoin: number; lastLogin?: number }> = sortedUsersArray.map(user => ({
          user,
          hcoin: userHcoinMap.get(user.toUpperCase()) || 0,
          lastLogin: userLastLogin[user]
        }))
        
        // เรียงตาม hcoin (มากสุดก่อน) แล้วตาม user name
        allUsersWithHcoin.sort((a, b) => {
          if (b.hcoin !== a.hcoin) return b.hcoin - a.hcoin
          return a.user.localeCompare(b.user)
        })

        if (isMounted) {
          setAllUsers(prev => {
            const wasFirstLoad = prev.length === 0
            if (wasFirstLoad) {
              setCurrentPage(1)
              currentPageRef.current = 1
            } else {
              const totalPages = Math.ceil(allUsersWithHcoin.length / itemsPerPage)
              const currentPageValue = currentPageRef.current
              if (currentPageValue > totalPages && totalPages > 0) {
                setCurrentPage(totalPages)
                currentPageRef.current = totalPages
              }
            }
            return allUsersWithHcoin
          })
          setAllUsersLoading(false)
          isFirstLoad = false
        }
      } catch (error) {
        console.error('Error loading all users:', error)
        if (isMounted) {
          setAllUsers([])
          setAllUsersLoading(false)
        }
      }
    }

    // Fetch immediately
    fetchAllUsers()
    
    // ✅ เพิ่ม interval จาก 5 วินาที → 30 วินาที เพื่อลดภาระฝั่งเซิร์ฟเวอร์
    // ✅ สำหรับหน้าแอดมิน ไม่จำเป็นต้องอัพเดทบ่อยมาก
    intervalId = setInterval(fetchAllUsers, 30000) // 30 วินาที

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [gameId, gameData])

  // ✅ Handler functions สำหรับแก้ไข answers
  const handleSaveAnswer = async (answerId: string, data: { answer?: string; correct?: boolean; code?: string }) => {
    if (!gameId) return
    
    try {
      setSavingItems(prev => new Set(prev).add(answerId))
      
      // Use PostgreSQL adapter
      await postgresqlAdapter.updateAnswer(gameId, answerId, data)
      
      // Refresh answers - โหลดข้อมูลทั้งหมด
      const answersList = await postgresqlAdapter.getAnswers(gameId, 1000000) // ใช้ 1,000,000 เพื่อให้ backend ไม่ใช้ LIMIT (โหลดทั้งหมด)
      const formattedAnswers: AnswerData[] = answersList.map((ans: any) => ({
        id: ans.id.toString(),
        username: ans.userId || ans.username || 'ไม่ระบุชื่อ',
        answer: ans.answer || '',
        timestamp: ans.ts || ans.createdAt ? new Date(ans.createdAt || ans.ts).getTime() : Date.now(),
        ts: ans.ts || ans.createdAt ? new Date(ans.createdAt || ans.ts).getTime() : Date.now(),
        gameId: ans.gameId || gameId,
        correct: ans.correct,
        code: ans.code,
        won: ans.won,
        amount: ans.amount,
      }))
      formattedAnswers.sort((a, b) => b.ts - a.ts)
      setAnswers(formattedAnswers)
      
      setSavingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(answerId)
        return newSet
      })
    } catch (error) {
      console.error('Error updating answer:', error)
      setSavingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(answerId)
        return newSet
      })
    }
  }

  const handleDeleteAnswer = async (answerId: string) => {
    if (!gameId) return
    if (!confirm('ยืนยันลบคำตอบนี้?')) return
    
    try {
      // Use PostgreSQL adapter
      await postgresqlAdapter.deleteAnswer(gameId, answerId)
      
      // Refresh answers - โหลดข้อมูลทั้งหมด
      const answersList = await postgresqlAdapter.getAnswers(gameId, 1000000) // ใช้ 1,000,000 เพื่อให้ backend ไม่ใช้ LIMIT (โหลดทั้งหมด)
      const formattedAnswers: AnswerData[] = answersList.map((ans: any) => ({
        id: ans.id.toString(),
        username: ans.userId || ans.username || 'ไม่ระบุชื่อ',
        answer: ans.answer || '',
        timestamp: ans.ts || ans.createdAt ? new Date(ans.createdAt || ans.ts).getTime() : Date.now(),
        ts: ans.ts || ans.createdAt ? new Date(ans.createdAt || ans.ts).getTime() : Date.now(),
        gameId: ans.gameId || gameId,
        correct: ans.correct,
        code: ans.code,
        won: ans.won,
        amount: ans.amount,
      }))
      formattedAnswers.sort((a, b) => b.ts - a.ts)
      setAnswers(formattedAnswers)
    } catch (error) {
      console.error('Error deleting answer:', error)
      alert('เกิดข้อผิดพลาดในการลบคำตอบ')
    }
  }


  // ✅ โหลดข้อมูล ALLUSER สำหรับเกมเช็คอิน
  useEffect(() => {
    if (!gameId || !gameData || gameData.type !== 'เกมเช็คอิน') {
      setAllUsers([])
      setCurrentPage(1)
      return
    }

    let isMounted = true
    let isFirstLoad = true // ✅ ใช้ flag เพื่อตรวจสอบว่าเป็นการโหลดครั้งแรกหรือไม่
    setAllUsersLoading(true)

    // ✅ โหลดข้อมูล checkins (ใช้ PostgreSQL adapter with polling)
    let intervalId: NodeJS.Timeout | null = null
    
    const fetchAllUsers = async () => {
      if (!isMounted) return
      
      try {
        // Use PostgreSQL adapter to get all checkins
        const checkinsByUser = await postgresqlAdapter.getAllCheckins(gameId, 365) // 365 วัน
        
        // แปลง checkins data เป็น users list
        const users = new Set<string>()
        const userLastLogin: Record<string, number> = {}
        
        // วน loop checkins เพื่อหา unique users
        for (const [userId, userCheckins] of Object.entries(checkinsByUser)) {
          users.add(userId)
          
          // หา lastLogin จาก checkin ล่าสุด
          let maxTimestamp = 0
          for (const [dayIndex, checkinData] of Object.entries(userCheckins)) {
            if (checkinData && typeof checkinData === 'object') {
              const cd = checkinData as any
              if (cd.createdAt) {
                const timestamp = new Date(cd.createdAt).getTime()
                if (timestamp > maxTimestamp) {
                  maxTimestamp = timestamp
                }
              }
            }
          }
          if (maxTimestamp > 0) {
            userLastLogin[userId] = maxTimestamp
          }
        }
        
        const usersArray = Array.from(users)
        const sortedUsersArray = usersArray.sort((a, b) => {
          const aLastLogin = userLastLogin[a] || 0
          const bLastLogin = userLastLogin[b] || 0
          return bLastLogin - aLastLogin
        })
        
        // ✅ โหลด hcoin สำหรับ users ทั้งหมด - ใช้ getAllUsers แทน getUserData แยก (ลดจำนวน API calls)
        // ✅ สร้าง Map เพื่อเก็บ hcoin จาก getAllUsers
        const userHcoinMap = new Map<string, number>()
        
        // ✅ ดึง users ทั้งหมดแบบ pagination (ใช้ getAllUsers ที่มี hcoin อยู่แล้ว)
        const BATCH_SIZE = 1000 // เพิ่ม batch size เพื่อลดจำนวน API calls
        let page = 1
        let hasMore = true
        
        while (hasMore && isMounted) {
          try {
            const result = await postgresqlAdapter.getAllUsers(page, BATCH_SIZE, '')
            const users = result.users || []
            
            // ✅ เก็บ hcoin ลง Map
            users.forEach(u => {
              if (u.userId) {
                const hcoin = Number(u.hcoin || 0)
                userHcoinMap.set(u.userId.toUpperCase(), Number.isFinite(hcoin) ? hcoin : 0)
              }
            })
            
            // ✅ ตรวจสอบว่ามีข้อมูลเพิ่มเติมหรือไม่
            if (users.length < BATCH_SIZE || page * BATCH_SIZE >= result.total) {
              hasMore = false
            } else {
              page++
              // ✅ หน่วงเวลาเล็กน้อยเพื่อไม่ให้ server overload
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          } catch (error) {
            console.error('Error loading users batch:', error)
            hasMore = false
          }
        }
        
        // ✅ สร้าง allUsersWithHcoin จาก sortedUsersArray โดยใช้ userHcoinMap
        const allUsersWithHcoin: Array<{ user: string; hcoin: number; lastLogin?: number }> = sortedUsersArray.map(user => ({
          user,
          hcoin: userHcoinMap.get(user.toUpperCase()) || 0,
          lastLogin: userLastLogin[user]
        }))
        
        // เรียงตาม hcoin (มากสุดก่อน) แล้วตาม user name
        allUsersWithHcoin.sort((a, b) => {
          if (b.hcoin !== a.hcoin) return b.hcoin - a.hcoin
          return a.user.localeCompare(b.user)
        })

        if (isMounted) {
          setAllUsers(prev => {
            const wasFirstLoad = prev.length === 0
            if (wasFirstLoad) {
              setCurrentPage(1)
              currentPageRef.current = 1
            } else {
              const totalPages = Math.ceil(allUsersWithHcoin.length / itemsPerPage)
              const currentPageValue = currentPageRef.current
              if (currentPageValue > totalPages && totalPages > 0) {
                setCurrentPage(totalPages)
                currentPageRef.current = totalPages
              }
            }
            return allUsersWithHcoin
          })
          setAllUsersLoading(false)
          isFirstLoad = false
        }
      } catch (error) {
        console.error('Error loading all users:', error)
        if (isMounted) {
          setAllUsers([])
          setAllUsersLoading(false)
        }
      }
    }

    // Fetch immediately
    fetchAllUsers()
    
    // ✅ เพิ่ม interval จาก 5 วินาที → 30 วินาที เพื่อลดภาระฝั่งเซิร์ฟเวอร์
    // ✅ สำหรับหน้าแอดมิน ไม่จำเป็นต้องอัพเดทบ่อยมาก
    intervalId = setInterval(fetchAllUsers, 30000) // 30 วินาที

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [gameId, gameData])

  // ✅ Computed values สำหรับกรองข้อมูล
  const checkinAnswers = React.useMemo(() => {
    return answers.filter(a => a.action === 'checkin' || a.action === 'checkin-complete')
  }, [answers])

  const couponAnswers = React.useMemo(() => {
    return answers.filter(a => a.action === 'coupon-redeem')
  }, [answers])
  
  // ✅ Filtered answers - กรองตาม username และ answer
  const filteredAnswers = React.useMemo(() => {
    let filtered = [...answers]
    
    // กรองตาม username
    if (searchUsername.trim()) {
      const searchLower = searchUsername.trim().toLowerCase()
      filtered = filtered.filter(a => 
        a.username.toLowerCase().includes(searchLower)
      )
    }
    
    // กรองตาม answer
    if (searchAnswer.trim()) {
      const searchLower = searchAnswer.trim().toLowerCase()
      filtered = filtered.filter(a => {
        const answerText = typeof a.answer === 'string' 
          ? a.answer 
          : JSON.stringify(a.answer)
        return answerText.toLowerCase().includes(searchLower)
      })
    }
    
    // ✅ กรองตาม code (โค้ดที่ USER ได้รับ) - สำหรับเกมทายภาพ
    if (searchCode.trim()) {
      const searchLower = searchCode.trim().toLowerCase()
      filtered = filtered.filter(a => {
        const codeText = a.code ? String(a.code).toLowerCase() : ''
        return codeText.includes(searchLower)
      })
    }
    
    // ✅ กรองเฉพาะคำตอบล่าสุดของ USER เท่านั้น
    if (showLatestOnly) {
      const latestByUser = new Map<string, AnswerData>()
      // เรียงตาม timestamp (ใหม่ไปเก่า) เพื่อให้ได้คำตอบล่าสุด
      const sorted = [...filtered].sort((a, b) => b.ts - a.ts)
      for (const answer of sorted) {
        const username = answer.username.toLowerCase()
        if (!latestByUser.has(username)) {
          latestByUser.set(username, answer)
        }
      }
      filtered = Array.from(latestByUser.values())
      // เรียงใหม่ตาม timestamp (ใหม่ไปเก่า)
      filtered.sort((a, b) => b.ts - a.ts)
    }
    
    return filtered
  }, [answers, searchUsername, searchAnswer, searchCode, showLatestOnly])
  
  // ✅ Pagination สำหรับ Answers - คำนวณ answers ที่จะแสดงในหน้าปัจจุบัน
  const answersTotalPages = Math.ceil(filteredAnswers.length / answersPerPage)
  const answersStartIndex = (answersCurrentPage - 1) * answersPerPage
  const answersEndIndex = answersStartIndex + answersPerPage
  const currentPageAnswers = React.useMemo(() => {
    // ✅ ถ้าเลือกแสดงทั้งหมด ให้แสดงทั้งหมด (ไม่ pagination)
    if (showAllAnswers) {
      return filteredAnswers
    }
    return filteredAnswers.slice(answersStartIndex, answersEndIndex)
  }, [filteredAnswers, answersStartIndex, answersEndIndex, showAllAnswers])
  
  // ✅ Reset pagination เมื่อ filter เปลี่ยน
  React.useEffect(() => {
    setAnswersCurrentPage(1)
  }, [searchUsername, searchAnswer, searchCode, showLatestOnly])

  // ✅ กำหนดชื่อ coin ตามธีม
  const coinName = themeName === 'max56' ? 'MAXCOIN' : themeName === 'jeed24' ? 'JEEDCOIN' : 'HENGCOIN'

  if (loading) {
    return (
      <div className="admin-answers-container">
        <div className="loading">กำลังโหลด...</div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="admin-answers-container">
        <div className="error">ไม่พบเกมที่ระบุ</div>
      </div>
    )
  }

  return (
    <section className="create-wrap">
      <div className="create-card">
        <img 
          src={assets.logo} 
          className="create-logo" 
          alt="HENG36 PARTY" 
          style={{
            width: '250px',
            height: 'auto',
            marginBottom: '16px'
          }}
        />
    
        
        <div className="admin-answers-header">
          <h1 className="admin-answers-title" style={{
            background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 1px 2px rgba(0,0,0,0.06)'
          }}>
            {game.name}
          </h1>
          <p className="admin-answers-subtitle" style={{ color: 'var(--theme-text-secondary)' }}>
            ประเภท: {game.type}
          </p>
        </div>

        {/* ✅ ซ่อนส่วนสถิติสำหรับเกมประกาศรางวัลและเกมเช็คอิน */}
        {game.type !== 'เกมประกาศรางวัล' && game.type !== 'เกมเช็คอิน' && (
        <div className="admin-answers-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          margin: '8px 0 18px'
        }}>
          <div className="stat-item" style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--theme-border-light)',
            background: 'rgba(16, 185, 129, 0.06)'
          }}>
            <span className="stat-label" style={{ color: 'var(--theme-text-secondary)', fontWeight: 700 }}>คำตอบทั้งหมด:</span>
            <span className="stat-value" style={{ color: themeName === 'heng36' ? colors.success || colors.primary : colors.primary, fontWeight: 900, fontSize: 22 }}>{answers.length}</span>
          </div>
          <div className="stat-item" style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding: '14px 16px',
            borderRadius: 12,
            border: '1px solid var(--theme-border-light)',
            background: 'rgba(16, 185, 129, 0.06)'
          }}>
            <span className="stat-label" style={{ color: 'var(--theme-text-secondary)', fontWeight: 700 }}>ผู้เล่นทั้งหมด:</span>
            <span className="stat-value" style={{ color: themeName === 'heng36' ? colors.success || colors.primary : colors.primary, fontWeight: 900, fontSize: 22 }}>{new Set(answers.map(a => a.username)).size}</span>
          </div>
          {game.type === 'เกมลอยกระทง' && (
            <>
              <div className="stat-item" style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--theme-border-light)',
                background: 'rgba(245, 158, 11, 0.06)'
              }}>
                <span className="stat-label" style={{ color: 'var(--theme-text-secondary)', fontWeight: 700 }}>🏆 รางวัลใหญ่:</span>
                <span className="stat-value" style={{ color: '#f59e0b', fontWeight: 900, fontSize: 22 }}>{answers.filter(a => (a as any).isBigPrize === true).length}</span>
              </div>
              <div className="stat-item" style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--theme-border-light)',
                background: 'rgba(16, 185, 129, 0.06)'
              }}>
                <span className="stat-label" style={{ color: 'var(--theme-text-secondary)', fontWeight: 700 }}>🎁 รางวัลธรรมดา:</span>
                <span className="stat-value" style={{ color: themeName === 'heng36' ? colors.success || colors.primary : colors.primary, fontWeight: 900, fontSize: 22 }}>{answers.filter(a => (a as any).isBigPrize !== true).length}</span>
              </div>
            </>
          )}
        </div>
        )}

        {/* แสดงรายชื่อ USER สำหรับเกมประกาศรางวัล */}
        {game.type === 'เกมประกาศรางวัล' && (announceUserBonuses.length > 0 || announceUsers.length > 0) && (
          <div className="answers-panel" style={{ 
            border: '1px solid var(--theme-border-light)', 
            borderRadius: 12,
            marginBottom: '16px'
          }}>
            <div className="answers-head" style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'16px',
              borderBottom:'1px solid var(--theme-border-light)'
            }}>
              <div className="answers-title" style={{ 
                color: 'var(--theme-text-primary)',
                fontSize: '18px',
                fontWeight: 700
              }}>
                📋 รายชื่อผู้ได้รับรางวัล
              </div>
              <div style={{
                fontSize: '14px',
                color: 'var(--theme-text-secondary)',
                fontWeight: 600
              }}>
                ทั้งหมด {(announceUserBonuses.length || announceUsers.length || 0).toLocaleString()} รายการ
              </div>
            </div>

            <div className="announce-users-list" style={{
              maxHeight: '500px',
              overflowY: 'auto',
              padding: '16px'
            }}>
              {announceUserBonuses.length > 0 ? (
                // แสดงรายการที่มี BONUS
                announceUserBonuses.map((item, idx) => (
                  <div 
                    key={`bonus-${idx}-${item.user}`}
                    className="announce-item with-bonus"
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      borderRadius: '8px 0 0 8px',
                      background: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`
                    }} />
                    <div style={{
                      minWidth: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '13px',
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                      boxShadow: `0 2px 4px ${colors.primary}30`
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flex: 1,
                      minWidth: 0
                    }}>
                      <div className="announce-item-content" style={{
                        gap: '4px',  // ลดระยะห่างให้ใกล้กันมากขึ้น
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <div className="announce-item-user">{item.user}</div>
                        <div className="announce-item-bonus" style={{
                          fontSize: '13px',
                          color: colors.success,
                          fontWeight: 800,
                          padding: '5px 12px',
                          backgroundColor: `${colors.successLight}20`,
                          borderRadius: '6px',
                          border: `1px solid ${colors.successLight}60`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          flexShrink: 0,
                          whiteSpace: 'nowrap'
                        }}>
                          💰 {item.bonus.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const itemKey = `bonus-${idx}-${item.user}`
                      const editState = editingItems[itemKey]
                      const isEditing = editState?.isEditing || false
                      const hasSavedValue = editState?.savedValue && !isEditing
                      
                      if (isEditing) {
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0
                          }}>
                            <input
                              type="text"
                              value={editState?.inputValue || ''}
                              onChange={(e) => {
                                handleInputChange(itemKey, e.target.value)
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                border: `1px solid ${colors.borderLight}`,
                                borderRadius: '6px',
                                outline: 'none',
                                minWidth: '200px'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleConfirmEdit(itemKey)
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit(itemKey)
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleConfirmEdit(itemKey)}
                              disabled={savingItems.has(itemKey)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: colors.textInverse,
                                background: `linear-gradient(135deg, ${colors.success} 0%, ${colors.success} 100%)`,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: savingItems.has(itemKey) ? 'wait' : 'pointer',
                                boxShadow: `0 2px 4px ${colors.success}30`,
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                opacity: savingItems.has(itemKey) ? 0.6 : 1
                              }}
                            >
                              {savingItems.has(itemKey) ? 'กำลังบันทึก...' : 'ยืนยัน'}
                            </button>
                            <button
                              onClick={() => handleCancelEdit(itemKey)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: colors.textPrimary,
                                background: colors.bgSecondary,
                                border: `1px solid ${colors.borderLight}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        )
                      }
                      
                      if (hasSavedValue) {
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0
                          }}>
                            <span style={{
                              fontSize: '13px',
                              color: '#ea580c',
                              fontWeight: 600,
                              padding: '6px 12px',
                              background: '#fff7ed',
                              borderRadius: '6px',
                              border: '1px solid #fed7aa'
                            }}>
                              {editState.savedValue}
                            </span>
                            <button
                              onClick={() => handleEdit(itemKey)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: colors.textInverse,
                                background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondaryDark} 100%)`,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                boxShadow: `0 2px 4px ${colors.secondary}30`,
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = `0 4px 8px ${colors.secondary}40`
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = `0 2px 4px ${colors.secondary}30`
                              }}
                            >
                              แก้ไข
                            </button>
                          </div>
                        )
                      }
                      
                      return (
                        <button
                          onClick={() => handleStartEdit(itemKey)}
                          style={{
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: colors.textInverse,
                            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: `0 2px 4px ${colors.primary}30`,
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = `0 4px 8px ${colors.primary}40`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = `0 2px 4px ${colors.primary}30`
                          }}
                        >
                          ทำรายการ
                        </button>
                      )
                    })()}
                  </div>
                ))
              ) : announceUsers.length > 0 ? (
                // แสดงรายการ USER ธรรมดา
                announceUsers.map((user, idx) => (
                  <div 
                    key={`user-${idx}-${user}`}
                    className="announce-item"
                    style={{
                      marginBottom: '10px',
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      borderRadius: '8px 0 0 8px',
                      background: `linear-gradient(180deg, ${colors.secondary} 0%, ${colors.secondaryDark} 100%)`
                    }} />
                    <div style={{
                      minWidth: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '13px',
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondaryDark} 100%)`,
                      boxShadow: `0 2px 4px ${colors.secondary}30`
                    }}>
                      {idx + 1}
                    </div>
                    <div className="announce-item-content" style={{
                      gap: '4px',
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <div className="announce-item-user">{user}</div>
                    </div>
                    {(() => {
                      const itemKey = `user-${idx}-${user}`
                      const editState = editingItems[itemKey]
                      const isEditing = editState?.isEditing || false
                      const hasSavedValue = editState?.savedValue && !isEditing
                      
                      if (isEditing) {
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0
                          }}>
                            <input
                              type="text"
                              value={editState?.inputValue || ''}
                              onChange={(e) => {
                                handleInputChange(itemKey, e.target.value)
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                border: `1px solid ${colors.borderLight}`,
                                borderRadius: '6px',
                                outline: 'none',
                                minWidth: '200px'
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleConfirmEdit(itemKey)
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit(itemKey)
                                }
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleConfirmEdit(itemKey)}
                              disabled={savingItems.has(itemKey)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: colors.textInverse,
                                background: `linear-gradient(135deg, ${colors.success} 0%, ${colors.success} 100%)`,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: savingItems.has(itemKey) ? 'wait' : 'pointer',
                                boxShadow: `0 2px 4px ${colors.success}30`,
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                opacity: savingItems.has(itemKey) ? 0.6 : 1
                              }}
                            >
                              {savingItems.has(itemKey) ? 'กำลังบันทึก...' : 'ยืนยัน'}
                            </button>
                            <button
                              onClick={() => handleCancelEdit(itemKey)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: colors.textPrimary,
                                background: colors.bgSecondary,
                                border: `1px solid ${colors.borderLight}`,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        )
                      }
                      
                      if (hasSavedValue) {
                        return (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexShrink: 0
                          }}>
                            <span style={{
                              fontSize: '13px',
                              color: '#ea580c',
                              fontWeight: 600,
                              padding: '6px 12px',
                              background: '#fff7ed',
                              borderRadius: '6px',
                              border: '1px solid #fed7aa'
                            }}>
                              {editState.savedValue}
                            </span>
                            <button
                              onClick={() => handleEdit(itemKey)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: colors.textInverse,
                                background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondaryDark} 100%)`,
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                boxShadow: `0 2px 4px ${colors.secondary}30`,
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = `0 4px 8px ${colors.secondary}40`
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = `0 2px 4px ${colors.secondary}30`
                              }}
                            >
                              แก้ไข
                            </button>
                          </div>
                        )
                      }
                      
                      return (
                        <button
                          onClick={() => handleStartEdit(itemKey)}
                          style={{
                            padding: '6px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: colors.textInverse,
                            background: `linear-gradient(135deg, ${colors.secondary} 0%, ${colors.secondaryDark} 100%)`,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: `0 2px 4px ${colors.secondary}30`,
                            transition: 'all 0.2s ease',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = `0 4px 8px ${colors.secondary}40`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = `0 2px 4px ${colors.secondary}30`
                          }}
                        >
                          ทำรายการ
                        </button>
                      )
                    })()}
                  </div>
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'var(--theme-text-secondary)'
                }}>
                  ยังไม่มีรายชื่อผู้ได้รับรางวัล
                </div>
              )}
            </div>
          </div>
        )}

        {/* แสดงส่วนคำตอบที่ผู้เล่นทาย (ซ่อนเฉพาะเกมประกาศรางวัล) */}
        {game.type !== 'เกมประกาศรางวัล' && (
          game.type === 'เกมเช็คอิน' ? (
            // ✅ เกมเช็คอิน: แสดงแบบ tabs
            <div className="answers-panel" style={{ border: '1px solid var(--theme-border-light)', borderRadius: 12 }}>
              {/* Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '16px 16px 0',
                borderBottom: '2px solid var(--theme-border-light)'
              }}>
                <button
                  onClick={() => setActiveTab('alluser')}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: activeTab === 'alluser' ? `3px solid ${colors.primary}` : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'alluser' ? colors.primary : 'var(--theme-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  👥 ALLUSER ({allUsers.length})
                </button>
                <button
                  onClick={() => setActiveTab('checkin')}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: activeTab === 'checkin' ? `3px solid ${colors.primary}` : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'checkin' ? colors.primary : 'var(--theme-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  ✅ USER CHECKIN ({checkinAnswers.length})
                </button>
                <button
                  onClick={() => setActiveTab('coupon')}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 700,
                    border: 'none',
                    borderBottom: activeTab === 'coupon' ? `3px solid ${colors.primary}` : '3px solid transparent',
                    background: 'transparent',
                    color: activeTab === 'coupon' ? colors.primary : 'var(--theme-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🎫 COUPON SHOP ({couponAnswers.length})
                </button>
              </div>

              {/* Tab Content */}
              <div style={{ padding: '16px' }}>
                {activeTab === 'alluser' && (
                  <div>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                        👥 USER ที่เข้าร่วมกิจกรรมเช็คอิน ({allUsers.length.toLocaleString('th-TH')} คน)
                      </h3>
                      <button 
                        className="btn-ghost btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 10px'
                        }}
                        onClick={() => window.location.reload()}
                      >
                        <span className="ico">🔄</span> รีเฟรช
                      </button>
                    </div>
                    {allUsersLoading ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--theme-text-secondary)' }}>
                        กำลังโหลด... ({allUsers.length.toLocaleString('th-TH')} users โหลดแล้ว)
                      </div>
                    ) : allUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--theme-text-secondary)' }}>
                        ยังไม่มี USER ที่เข้าร่วมกิจกรรม
                      </div>
                    ) : (() => {
                      // ✅ Pagination: คำนวณ users ที่จะแสดงในหน้าปัจจุบัน
                      const totalPages = Math.ceil(allUsers.length / itemsPerPage)
                      const startIndex = (currentPage - 1) * itemsPerPage
                      const endIndex = startIndex + itemsPerPage
                      const currentPageUsers = allUsers.slice(startIndex, endIndex)
                      
                      return (
                        <>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {currentPageUsers.map((item, idx) => {
                              const globalIndex = startIndex + idx + 1
                              return (
                                <div
                                  key={item.user}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'var(--theme-bg-secondary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--theme-border-light)'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                      minWidth: '32px',
                                      height: '32px',
                                      borderRadius: '6px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                                      color: '#fff',
                                      fontWeight: 800,
                                      fontSize: '14px'
                                    }}>
                                      {globalIndex}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--theme-text-primary)' }}>
                                        {item.user}
                                      </div>
                                      {item.lastLogin && (
                                        <div style={{ fontSize: '12px', color: 'var(--theme-text-secondary)', marginTop: '2px' }}>
                                          เข้าสู่ระบบ: {new Date(item.lastLogin).toLocaleString('th-TH')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{
                                    fontWeight: 800,
                                    fontSize: '16px',
                                    color: colors.primary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}>
                                    <span>{coinName}:</span>
                                    <span>{item.hcoin.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          
                          {/* ✅ Pagination Controls */}
                          {totalPages > 1 && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: '8px',
                              marginTop: '20px',
                              padding: '16px',
                              background: 'var(--theme-bg-secondary)',
                              borderRadius: '8px',
                              border: '1px solid var(--theme-border-light)'
                            }}>
                              <button
                                onClick={() => {
                                  setCurrentPage(1)
                                  currentPageRef.current = 1
                                }}
                                disabled={currentPage === 1}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  border: `1px solid ${colors.borderLight}`,
                                  borderRadius: '6px',
                                  background: currentPage === 1 ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                                  color: currentPage === 1 ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                  opacity: currentPage === 1 ? 0.5 : 1
                                }}
                              >
                                ⏮️ หน้าแรก
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentPage(prev => {
                                    const newPage = Math.max(1, prev - 1)
                                    currentPageRef.current = newPage
                                    return newPage
                                  })
                                }}
                                disabled={currentPage === 1}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  border: `1px solid ${colors.borderLight}`,
                                  borderRadius: '6px',
                                  background: currentPage === 1 ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                                  color: currentPage === 1 ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                  opacity: currentPage === 1 ? 0.5 : 1
                                }}
                              >
                                ⬅️ ก่อนหน้า
                              </button>
                              <div style={{
                                padding: '8px 16px',
                                fontSize: '14px',
                                fontWeight: 700,
                                color: 'var(--theme-text-primary)',
                                background: 'var(--theme-bg-secondary)',
                                borderRadius: '6px',
                                border: `1px solid ${colors.borderLight}`
                              }}>
                                หน้า {currentPage} / {totalPages}
                              </div>
                              <button
                                onClick={() => {
                                  setCurrentPage(prev => {
                                    const newPage = Math.min(totalPages, prev + 1)
                                    currentPageRef.current = newPage
                                    return newPage
                                  })
                                }}
                                disabled={currentPage === totalPages}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  border: `1px solid ${colors.borderLight}`,
                                  borderRadius: '6px',
                                  background: currentPage === totalPages ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                                  color: currentPage === totalPages ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                  opacity: currentPage === totalPages ? 0.5 : 1
                                }}
                              >
                                ถัดไป ➡️
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentPage(totalPages)
                                  currentPageRef.current = totalPages
                                }}
                                disabled={currentPage === totalPages}
                                style={{
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  border: `1px solid ${colors.borderLight}`,
                                  borderRadius: '6px',
                                  background: currentPage === totalPages ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                                  color: currentPage === totalPages ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                  opacity: currentPage === totalPages ? 0.5 : 1
                                }}
                              >
                                สุดท้าย ⏭️
                              </button>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}

                {activeTab === 'checkin' && (
                  <div>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                        ✅ ประวัติการเช็คอินและรางวัลที่ได้
                      </h3>
                      <button 
                        className="btn-ghost btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 10px'
                        }}
                        onClick={fetchAnswers}
                      >
                        <span className="ico">🔄</span> รีเฟรช
                      </button>
                    </div>
                    <PlayerAnswersList 
                      answers={checkinAnswers.map(a => ({
                        ...a,
                        answer: a.action === 'checkin-complete' 
                          ? `เช็คอินครบทุกวัน - รางวัล: ${a.amount ? `${a.amount.toLocaleString()} ${coinName}` : a.code || 'CODE'}`
                          : `เช็คอิน Day ${a.dayIndex || '-'} - ได้รับ: ${a.amount ? `${a.amount.toLocaleString()} ${coinName}` : a.code || 'CODE'}`
                      }))}
                      loading={loading}
                      onRefresh={fetchAnswers}
                      showRefreshButton={false}
                    />
                  </div>
                )}

                {activeTab === 'coupon' && (
                  <div>
                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                        🎫 ประวัติการแลกคูปอง
                      </h3>
                      <button 
                        className="btn-ghost btn-sm"
                        style={{
                          background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 10px'
                        }}
                        onClick={fetchAnswers}
                      >
                        <span className="ico">🔄</span> รีเฟรช
                      </button>
                    </div>
                    <PlayerAnswersList 
                      answers={couponAnswers.map(a => {
                        // ✅ ข้อมูล coupon-redeem: ใช้ price field (จาก logAction)
                        const price = a.price || 0
                        const code = a.code || '-'
                        const itemIndex = a.itemIndex !== undefined ? a.itemIndex : -1
                        
                        // ✅ ดึงชื่อคูปองจาก gameData.checkin.coupon.items
                        let couponName = `คูปอง #${itemIndex + 1}`
                        if (gameData?.checkin?.coupon?.items && Array.isArray(gameData.checkin.coupon.items)) {
                          const couponItem = gameData.checkin.coupon.items[itemIndex]
                          if (couponItem && couponItem.title) {
                            couponName = couponItem.title
                          }
                        }
                        
                        return {
                          ...a,
                          answer: `แลก${couponName} - ใช้ ${price.toLocaleString()} ${coinName} - ได้โค้ด: ${code}`
                        }
                      })}
                      loading={loading}
                      onRefresh={fetchAnswers}
                      showRefreshButton={false}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ✅ เกมอื่น: แสดงแบบเดิม
            <div className="answers-panel" style={{ border: '1px solid var(--theme-border-light)', borderRadius: 12 }}>
              <div className="answers-head" style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 0'
              }}>
                <div className="answers-title" style={{ color: 'var(--theme-text-primary)' }}>📊 คำตอบที่ผู้เล่นทาย</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="btn-ghost btn-sm"
                    style={{
                      background: showAllAnswers 
                        ? 'linear-gradient(135deg, var(--theme-success) 0%, var(--theme-success-dark) 100%)'
                        : 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 10px',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                    onClick={() => setShowAllAnswers(!showAllAnswers)}
                    title={showAllAnswers ? 'แสดงแบบแบ่งหน้า' : 'แสดงทั้งหมด'}
                  >
                    {showAllAnswers ? '📄 แบ่งหน้า' : '📋 แสดงทั้งหมด'}
                  </button>
                  <button 
                    className="btn-ghost btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 10px'
                    }}
                    onClick={fetchAnswers}
                  >
                    <span className="ico">🔄</span> รีเฟรชคำตอบ
                  </button>
                </div>
              </div>
              
              {/* ✅ Search Section */}
              <div style={{
                padding: '16px',
                background: 'var(--theme-bg-secondary)',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid var(--theme-border-light)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: game?.type === 'เกมทายภาพปริศนา' ? '1fr 1fr 1fr' : '1fr 1fr',
                  gap: '12px',
                  marginBottom: '12px'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--theme-text-primary)',
                      marginBottom: '6px'
                    }}>
                      🔍 ค้นหา USER
                    </label>
                    <input
                      type="text"
                      placeholder="กรอกชื่อ USER ที่ต้องการค้นหา"
                      value={searchUsername}
                      onChange={(e) => setSearchUsername(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: `1px solid ${colors.borderLight}`,
                        borderRadius: '6px',
                        background: 'var(--theme-bg-primary)',
                        color: 'var(--theme-text-primary)',
                        outline: 'none'
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setAnswersCurrentPage(1)
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--theme-text-primary)',
                      marginBottom: '6px'
                    }}>
                      🔍 ค้นหาคำตอบ
                    </label>
                    <input
                      type="text"
                      placeholder="กรอกคำตอบที่ต้องการค้นหา"
                      value={searchAnswer}
                      onChange={(e) => setSearchAnswer(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '14px',
                        border: `1px solid ${colors.borderLight}`,
                        borderRadius: '6px',
                        background: 'var(--theme-bg-primary)',
                        color: 'var(--theme-text-primary)',
                        outline: 'none'
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setAnswersCurrentPage(1)
                        }
                      }}
                    />
                  </div>
                  {game?.type === 'เกมทายภาพปริศนา' && (
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--theme-text-primary)',
                        marginBottom: '6px'
                      }}>
                        🎁 ค้นหาโค้ด
                      </label>
                      <input
                        type="text"
                        placeholder="กรอกโค้ดที่ต้องการค้นหา"
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '14px',
                          border: `1px solid ${colors.borderLight}`,
                          borderRadius: '6px',
                          background: 'var(--theme-bg-primary)',
                          color: 'var(--theme-text-primary)',
                          outline: 'none'
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            setAnswersCurrentPage(1)
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--theme-text-primary)',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={showLatestOnly}
                      onChange={(e) => setShowLatestOnly(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <span>แสดงเฉพาะคำตอบล่าสุดของ USER เท่านั้น</span>
                  </label>
                  
                  <button
                    onClick={() => {
                      setSearchUsername('')
                      setSearchAnswer('')
                      setSearchCode('')
                      setShowLatestOnly(false)
                      setAnswersCurrentPage(1)
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: '6px',
                      background: 'var(--theme-bg-primary)',
                      color: 'var(--theme-text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    ล้างการค้นหา
                  </button>
                </div>
                
                <div style={{
                  marginTop: '12px',
                  padding: '10px',
                  background: (searchUsername || searchAnswer || searchCode || showLatestOnly) 
                    ? 'rgba(16, 185, 129, 0.1)' 
                    : 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: 'var(--theme-text-primary)',
                  fontWeight: 600
                }}>
                  {showAllAnswers ? (
                    <>
                      📋 แสดงทั้งหมด: {filteredAnswers.length} คำตอบ
                      {answers.length > filteredAnswers.length && ` (จาก ${answers.length} คำตอบทั้งหมด)`}
                    </>
                  ) : (
                    <>
                      📄 แสดงแบบแบ่งหน้า: {currentPageAnswers.length} คำตอบ (หน้า {answersCurrentPage}/{answersTotalPages})
                      {filteredAnswers.length !== answers.length && ` จาก ${filteredAnswers.length} คำตอบที่กรองแล้ว`}
                      {answers.length > filteredAnswers.length && ` (จาก ${answers.length} คำตอบทั้งหมด)`}
                    </>
                  )}
                  {searchUsername && ` | USER: "${searchUsername}"`}
                  {searchAnswer && ` | คำตอบ: "${searchAnswer}"`}
                  {searchCode && ` | โค้ด: "${searchCode}"`}
                  {showLatestOnly && ' | เฉพาะคำตอบล่าสุด'}
                </div>
              </div>

              <PlayerAnswersList 
                answers={currentPageAnswers}
                loading={loading}
                onRefresh={fetchAnswers}
                showRefreshButton={true}
              />
              
              {/* ✅ Pagination Controls สำหรับ Answers - แสดงเฉพาะเมื่อไม่เลือกแสดงทั้งหมด */}
              {!showAllAnswers && answersTotalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '20px',
                  padding: '16px',
                  background: 'var(--theme-bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--theme-border-light)'
                }}>
                  <button
                    onClick={() => setAnswersCurrentPage(1)}
                    disabled={answersCurrentPage === 1}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: '6px',
                      background: answersCurrentPage === 1 ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                      color: answersCurrentPage === 1 ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                      cursor: answersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: answersCurrentPage === 1 ? 0.5 : 1
                    }}
                  >
                    ⏮️ หน้าแรก
                  </button>
                  <button
                    onClick={() => setAnswersCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={answersCurrentPage === 1}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: '6px',
                      background: answersCurrentPage === 1 ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                      color: answersCurrentPage === 1 ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                      cursor: answersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: answersCurrentPage === 1 ? 0.5 : 1
                    }}
                  >
                    ⬅️ ก่อนหน้า
                  </button>
                  <div style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--theme-text-primary)',
                    background: 'var(--theme-bg-secondary)',
                    borderRadius: '6px',
                    border: `1px solid ${colors.borderLight}`
                  }}>
                    หน้า {answersCurrentPage} / {answersTotalPages} ({filteredAnswers.length} คำตอบที่กรองแล้ว จาก {answers.length} คำตอบทั้งหมด)
                  </div>
                  <button
                    onClick={() => setAnswersCurrentPage(prev => Math.min(answersTotalPages, prev + 1))}
                    disabled={answersCurrentPage === answersTotalPages}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: '6px',
                      background: answersCurrentPage === answersTotalPages ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                      color: answersCurrentPage === answersTotalPages ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                      cursor: answersCurrentPage === answersTotalPages ? 'not-allowed' : 'pointer',
                      opacity: answersCurrentPage === answersTotalPages ? 0.5 : 1
                    }}
                  >
                    ถัดไป ➡️
                  </button>
                  <button
                    onClick={() => setAnswersCurrentPage(answersTotalPages)}
                    disabled={answersCurrentPage === answersTotalPages}
                    style={{
                      padding: '8px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1px solid ${colors.borderLight}`,
                      borderRadius: '6px',
                      background: answersCurrentPage === answersTotalPages ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-primary)',
                      color: answersCurrentPage === answersTotalPages ? 'var(--theme-text-secondary)' : 'var(--theme-text-primary)',
                      cursor: answersCurrentPage === answersTotalPages ? 'not-allowed' : 'pointer',
                      opacity: answersCurrentPage === answersTotalPages ? 0.5 : 1
                    }}
                  >
                    สุดท้าย ⏭️
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </section>
  )
}
