import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ref, onValue, get, set } from 'firebase/database'
import { db } from '../services/firebase'
import PlayerAnswersList from '../components/PlayerAnswersList'
import { useTheme, useThemeAssets, useThemeColors } from '../contexts/ThemeContext'

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
      
      // บันทึกข้อมูลลง Firebase
      await set(ref(db, `games/${gameId}/announce/processedItems/${user}`), {
        value: inputValue.trim(),
        timestamp: Date.now()
      })
      
      // อัปเดต state
      setEditingItems(prev => ({
        ...prev,
        [key]: {
          isEditing: false,
          inputValue: inputValue.trim(),
          savedValue: inputValue.trim()
        }
      }))
    } catch (error) {
      console.error('Error saving processed item:', error)
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล')
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

    let isMounted = true

    // โหลดข้อมูลเกม (ใช้ get แทน onValue เพื่อป้องกัน infinite loop)
    const gameRef = ref(db, `games/${gameId}`)
    get(gameRef).then((snapshot) => {
      if (!isMounted) return
      
      if (snapshot.exists()) {
        const data = snapshot.val()
        setGameData(data)
        setGame({
          id: gameId,
          name: data.name || 'ไม่ระบุชื่อ',
          type: data.type || 'ไม่ระบุประเภท',
          emoji: data.emoji || '🎮'
        })
        
        // โหลดข้อมูลสำหรับเกมประกาศรางวัล
        if (data.type === 'เกมประกาศรางวัล' && data.announce) {
          const users: string[] = Array.isArray(data.announce.users) ? data.announce.users : []
          const userBonuses: Array<{ user: string; bonus: number }> = Array.isArray(data.announce.userBonuses) ? data.announce.userBonuses : []
          setAnnounceUsers(users)
          setAnnounceUserBonuses(userBonuses)
          
          // โหลดข้อมูล processedItems ที่บันทึกไว้ (เฉพาะครั้งแรก ไม่ต้อง reactive)
          if (data.announce.processedItems) {
            const processed = data.announce.processedItems
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
            // ถ้าไม่มี processedItems ให้ reset
            setEditingItems({})
          }
        } else {
          // ถ้าไม่ใช่เกมประกาศรางวัล ให้ reset
          setEditingItems({})
          setAnnounceUsers([])
          setAnnounceUserBonuses([])
        }
      }
    })

    // Cleanup function สำหรับ game data
    return () => {
      isMounted = false
    }
  }, [gameId])

  // ✅ แยก useEffect สำหรับโหลดคำตอบ (ต้องรอ gameData โหลดเสร็จก่อน)
  useEffect(() => {
    if (!gameId || !gameData) return

    let isMounted = true

    // โหลดคำตอบ (ใช้ onValue สำหรับ real-time updates)
    // ✅ สำหรับเกมเช็คอิน: ใช้ sharding ตามวันที่ (answers/{gameId}/{dateKey}/{ts})
    // ✅ สำหรับเกมอื่น: ใช้รูปแบบเดิม (answers/{gameId}/{ts})
    const isCheckinGame = gameData.type === 'เกมเช็คอิน'
    
    if (isCheckinGame) {
      // ✅ เกมเช็คอิน: โหลดจาก answers/{gameId} (มี dateKey เป็น child)
      const answersRef = ref(db, `answers/${gameId}`)
      const unsubscribeAnswers = onValue(answersRef, (snapshot) => {
        if (!isMounted) return
        
        if (snapshot.exists()) {
          const answersData = snapshot.val()
          const answersList: AnswerData[] = []
          
          // ✅ วนลูปผ่าน dateKey (เช่น 20241113, 20241114, ...)
          Object.entries(answersData).forEach(([dateKey, dateData]: [string, any]) => {
            if (dateData && typeof dateData === 'object') {
              // ✅ วนลูปผ่าน timestamp ในแต่ละ dateKey
              Object.entries(dateData).forEach(([tsKey, value]: [string, any]) => {
                if (value && typeof value === 'object') {
                  const timestamp = Number(tsKey) || 0
                  
                  answersList.push({
                    id: `${dateKey}-${tsKey}`, // ใช้ dateKey-tsKey เป็น id
                    username: value.username || value.user || 'ไม่ระบุชื่อ',
                    answer: value.answer || value.action || '', // ✅ รองรับ action field
                    timestamp: timestamp,
                    ts: timestamp,
                    gameId: gameId,
                    correct: value.correct,
                    code: value.code,
                    won: value.won,
                    amount: value.amount,
                    // ✅ เพิ่มข้อมูลเฉพาะเกมเช็คอิน
                    dayIndex: value.dayIndex,
                    action: value.action, // 'checkin', 'checkin-complete', 'coupon-redeem'
                    serverDate: value.serverDate,
                    balanceBefore: value.balanceBefore,
                    balanceAfter: value.balanceAfter,
                    itemIndex: value.itemIndex, // สำหรับ coupon-redeem
                    price: value.price // สำหรับ coupon-redeem (ราคาที่ใช้แลก)
                  })
                }
              })
            }
          })
          
          // ✅ เรียงตาม timestamp (ใหม่สุดก่อน)
          answersList.sort((a, b) => b.ts - a.ts)
          setAnswers(answersList)
        } else {
          setAnswers([])
        }
        setLoading(false)
      }, (error) => {
        console.error('Error loading checkin answers:', error)
        if (isMounted) {
          setLoading(false)
        }
      })
      
      return () => {
        isMounted = false
        unsubscribeAnswers()
      }
    } else {
      // ✅ เกมอื่น: ใช้รูปแบบเดิม
      const answersRef = ref(db, `answers/${gameId}`)
      const unsubscribeAnswers = onValue(answersRef, (snapshot) => {
        if (!isMounted) return
        
        if (snapshot.exists()) {
          const answersData = snapshot.val()
          const answersList: AnswerData[] = []
          
          Object.entries(answersData).forEach(([key, value]: [string, any]) => {
            if (value) {
              // ใช้รูปแบบเดียวกับหน้าแก้ไขเกม - ใช้ key เป็น timestamp
              const timestamp = Number(key) || 0
              
              answersList.push({
                id: key,
                username: value.username || value.user || 'ไม่ระบุชื่อ',
                answer: value.answer || '',
                timestamp: timestamp,
                ts: timestamp, // ใช้ key เป็น timestamp เหมือนหน้าแก้ไขเกม
                gameId: gameId,
                correct: value.correct,
                code: value.code,
                won: value.won,
                amount: value.amount
              })
            }
          })
          
          setAnswers(answersList)
        } else {
          setAnswers([])
        }
        setLoading(false)
      }, (error) => {
        console.error('Error loading answers:', error)
        if (isMounted) {
          setLoading(false)
        }
      })
      
      return () => {
        isMounted = false
        unsubscribeAnswers()
      }
    }
  }, [gameId, gameData])

  // ✅ โหลดข้อมูล ALLUSER สำหรับเกมเช็คอิน
  useEffect(() => {
    if (!gameId || !gameData || gameData.type !== 'เกมเช็คอิน') {
      setAllUsers([])
      return
    }

    let isMounted = true
    setAllUsersLoading(true)

    // โหลดข้อมูล checkins/{gameId} เพื่อดูว่าใครเช็คอินบ้าง
    const checkinsRef = ref(db, `checkins/${gameId}`)
    const unsubscribeCheckins = onValue(checkinsRef, async (snapshot) => {
      if (!isMounted) return

      if (snapshot.exists()) {
        const checkinsData = snapshot.val()
        const users = new Set<string>()
        const userLastLogin: Record<string, number> = {}

        // วนลูปผ่าน users ที่เช็คอิน
        Object.entries(checkinsData).forEach(([user, userData]: [string, any]) => {
          if (userData && typeof userData === 'object') {
            users.add(user)
            // อ่าน lastLogin ถ้ามี
            if (userData.lastLogin) {
              userLastLogin[user] = userData.lastLogin
            }
          }
        })

        // โหลด hcoin จาก USERS_EXTRA สำหรับแต่ละ user
        const usersArray = Array.from(users)
        const usersWithHcoin = await Promise.all(
          usersArray.map(async (user) => {
            try {
              const hcoinRef = ref(db, `USERS_EXTRA/${user}/hcoin`)
              const hcoinSnap = await get(hcoinRef)
              const hcoin = Number(hcoinSnap.val() || 0)
              return {
                user,
                hcoin: Number.isFinite(hcoin) ? hcoin : 0,
                lastLogin: userLastLogin[user]
              }
            } catch (error) {
              console.error(`Error loading hcoin for ${user}:`, error)
              return {
                user,
                hcoin: 0,
                lastLogin: userLastLogin[user]
              }
            }
          })
        )

        // เรียงตาม hcoin (มากสุดก่อน) แล้วตาม user name
        usersWithHcoin.sort((a, b) => {
          if (b.hcoin !== a.hcoin) return b.hcoin - a.hcoin
          return a.user.localeCompare(b.user)
        })

        if (isMounted) {
          setAllUsers(usersWithHcoin)
          setAllUsersLoading(false)
        }
      } else {
        if (isMounted) {
          setAllUsers([])
          setAllUsersLoading(false)
        }
      }
    }, (error) => {
      console.error('Error loading checkins:', error)
      if (isMounted) {
        setAllUsersLoading(false)
      }
    })

    return () => {
      isMounted = false
      unsubscribeCheckins()
    }
  }, [gameId, gameData])

  // ✅ Computed values สำหรับกรองข้อมูล
  const checkinAnswers = React.useMemo(() => {
    return answers.filter(a => a.action === 'checkin' || a.action === 'checkin-complete')
  }, [answers])

  const couponAnswers = React.useMemo(() => {
    return answers.filter(a => a.action === 'coupon-redeem')
  }, [answers])

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

        {/* ซ่อนส่วนสถิติสำหรับเกมประกาศรางวัล */}
        {game.type !== 'เกมประกาศรางวัล' && (
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
                        👥 USER ที่เข้าร่วมกิจกรรมเช็คอิน
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
                        กำลังโหลด...
                      </div>
                    ) : allUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--theme-text-secondary)' }}>
                        ยังไม่มี USER ที่เข้าร่วมกิจกรรม
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {allUsers.map((item, idx) => (
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
                                {idx + 1}
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
                        ))}
                      </div>
                    )}
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
                        onClick={() => window.location.reload()}
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
                      onRefresh={() => window.location.reload()}
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
                        onClick={() => window.location.reload()}
                      >
                        <span className="ico">🔄</span> รีเฟรช
                      </button>
                    </div>
                    <PlayerAnswersList 
                      answers={couponAnswers.map(a => {
                        // ✅ ข้อมูล coupon-redeem: ใช้ price field (จาก logAction)
                        const price = a.price || 0
                        const code = a.code || '-'
                        const itemIndex = a.itemIndex !== undefined ? a.itemIndex + 1 : '-'
                        return {
                          ...a,
                          answer: `แลกคูปอง #${itemIndex} - ใช้ ${price.toLocaleString()} ${coinName} - ได้โค้ด: ${code}`
                        }
                      })}
                      loading={loading}
                      onRefresh={() => window.location.reload()}
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
                  <span className="ico">🔄</span> รีเฟรชคำตอบ
                </button>
              </div>

              <PlayerAnswersList 
                answers={answers}
                loading={loading}
                onRefresh={() => window.location.reload()}
                showRefreshButton={true}
              />
            </div>
          )
        )}
      </div>
    </section>
  )
}
