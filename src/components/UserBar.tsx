import React, { useMemo, useState, useEffect } from 'react'
import { useTheme, useThemeColors } from '../contexts/ThemeContext'
import { db } from '../services/firebase'
import { ref, onValue, off } from 'firebase/database'
import { useRealtimeData } from '../hooks/useOptimizedData'
import '../styles/userbar.css'
import * as postgresqlAdapter from '../services/postgresql-adapter'

export type UserBarProps = {
  username?: string
  credit?: number
  className?: string
  gameId?: string
  roomId?: string
  isHost?: boolean
}

function formatShort(n: number) {
  const v = Number(n || 0)
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1_000)         return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return v.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function UserBar({
  username = '-',
  credit = 0,
  className = '',
  gameId,
  roomId,
  isHost = false,
}: UserBarProps) {
  const { themeName } = useTheme()
  const colors = useThemeColors()
  const coinName = themeName === 'max56' ? 'MAXCOIN' : themeName === 'jeed24' ? 'JEEDCOIN' : 'HENGCOIN'
  const [realCredit, setRealCredit] = useState(credit)
  
  // สำหรับเกมสล็อต: ถ้ามีการส่ง credit prop มาแล้ว ให้ใช้ค่านั้น (ไม่ดึงจาก USERS_EXTRA)
  // สำหรับเกมอื่น: ดึงจาก USERS_EXTRA
  
  // ตรวจสอบว่าควรใช้ credit prop หรือดึงจาก DB
  // สำหรับเกมสล็อต: SlotGame จะส่ง credit prop มา (แม้จะเป็น 0 ก็ตาม) และจะมี gameId
  // สำหรับเกมอื่น: จะไม่ส่ง credit prop หรือส่ง undefined/null
  // ตรวจสอบว่ามี gameId หรือ credit เป็นตัวเลขที่ถูกต้อง (รวมถึง 0)
  const usePropCredit = gameId !== undefined || (credit !== undefined && credit !== null && typeof credit === 'number')
  
  // ✅ ใช้ PostgreSQL adapter สำหรับ user data
  const [userData, setUserData] = React.useState<{ hcoin?: number } | null>(null)
  
  React.useEffect(() => {
    if (usePropCredit || !username || username === '-') {
      return
    }

    // Use PostgreSQL adapter if available (with polling)
    let intervalId: NodeJS.Timeout | null = null
    let unsubscribeFirebase: (() => void) | null = null
    
    const fetchUserData = async () => {
      try {
        const data = await postgresqlAdapter.getUserData(username)
        setUserData(data)
      } catch (error) {
        console.error('Error fetching user data from PostgreSQL, falling back to Firebase:', error)
        // Fallback to Firebase (only once, not on every poll)
        if (!unsubscribeFirebase) {
          const { subscribeToUserData } = require('../services/users-firestore')
          unsubscribeFirebase = subscribeToUserData(
            username,
            (data: any) => {
              setUserData(data)
            },
            {
              preferFirestore: true,
              fallbackRTDB: false
            }
          )
        }
      }
    }

    // Fetch immediately
    fetchUserData()
    
    // Poll every 2 seconds for updates (faster for better UX)
    intervalId = setInterval(fetchUserData, 2000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (unsubscribeFirebase) {
        unsubscribeFirebase()
      }
    }
  }, [usePropCredit, username])

  // อัปเดต realCredit จาก credit prop (สำหรับเกมสล็อต)
  useEffect(() => {
    if (usePropCredit) {
      setRealCredit(credit)
    }
  }, [credit, usePropCredit])
  
  // ✅ OPTIMIZED: อัพเดท realCredit จาก userData (ใช้ useRealtimeData แทน onValue)
  useEffect(() => {
    if (usePropCredit) {
      // ใช้ credit prop ที่ส่งมาแล้ว ไม่ต้องดึงจาก DB
      return
    }
    
    if (userData && userData.hcoin !== undefined) {
      setRealCredit(userData.hcoin)
    }
  }, [userData, usePropCredit])
  
  const creditFull = useMemo(() => Number(realCredit ?? 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }), [realCredit])
  const creditShort = useMemo(() => formatShort(Number(realCredit ?? 0)), [realCredit])

  return (
    <div 
      className={`userbar userbar--brand ${className}`}
      style={{
        background: `linear-gradient(135deg, ${colors.primary || '#10B981'} 0%, ${colors.secondary || '#059669'} 100%)`,
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: `0 4px 16px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
        backdropFilter: 'blur(10px)',
        border: `1px solid ${colors.primary || '#10B981'}`,
        marginBottom: '16px'
      }}
    >
      <div className="userbar__left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="userbar__avatar" aria-hidden style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <img src="/image/user.svg" alt="User" width="20" height="20" style={{ filter: 'brightness(0) invert(1)' }} />
        </span>
        <span 
          className="userbar__name" 
          title={username}
          style={{
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '1rem',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          {isHost && (
            <span style={{ fontSize: '1.2rem' }}>👑</span>
          )}
          {username}
        </span>
      </div>

      <div
        className="userbar__credit"
        title={`${coinName} ${creditFull}`}
        aria-label={`${coinName} ${creditFull}`}
        style={{
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}
      >
        <span className="ub-lbl" style={{
          color: '#ffffff',
          fontWeight: '600',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}>
          <img src="/image/diamond.svg" alt="Diamond" width="16" height="16" style={{ filter: 'brightness(0) invert(1)' }} />
          {coinName}
        </span>
        <span className="ub-colon" style={{ color: '#ffffff', fontWeight: '600' }}>:</span>
        <span className="ub-amt ub-amt--full ub-amt--short" style={{
          color: '#ffffff',
          fontWeight: '700',
          fontSize: '0.9rem',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)'
        }}>
          {creditFull}
        </span>
      </div>
    </div>
  )
}
