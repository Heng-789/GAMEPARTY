// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import React, { ReactElement, useEffect } from 'react'

import Home from './pages/Home'
import Login from './pages/Login'
import UploadUsersExtra from './pages/UploadUsersExtra'
import CreateGame from './pages/CreateGame'
import AdminAnswers from './pages/AdminAnswers'
import ThemeTest from './pages/ThemeTest'
import TestCheckinSecurity from './pages/TestCheckinSecurity'
import GameCreate from './pages/games/GameCreate'
import GameEdit from './pages/games/GameEdit'
import GamesList from './pages/games/GamesList'
import GamePlay from './pages/games/GamePlay'
import { initializePrefetching } from './services/prefetching'
import { ThemeProvider } from './contexts/ThemeContext'

function RequireAuth({ children }: { children: ReactElement }) {
  const [authed, setAuthed] = React.useState<boolean | null>(null)
  const location = useLocation()
  
  React.useEffect(() => {
    let mounted = true
    let subscription: any = null
    
    const checkAuth = async () => {
      try {
        const { getSession, onAuthStateChange } = await import('./services/supabase-auth')
        
        // Initial check
        const { data } = await getSession()
        if (mounted) {
          setAuthed(!!data.session)
        }
        
        // Listen for auth state changes
        const authSubscription = onAuthStateChange((event, session) => {
          if (mounted) {
            // ✅ Log auth events for debugging
            if (process.env.NODE_ENV === 'development') {
              console.log('[RequireAuth] Auth state change:', event, !!session)
            }
            
            // ✅ Handle different auth events
            if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
              // ✅ Only update if session actually changed
              const hasSession = !!session
              if (hasSession !== authed) {
                setAuthed(hasSession)
              }
            } else {
              setAuthed(!!session)
            }
          }
        })
        
        subscription = authSubscription
      } catch (error) {
        console.error('Error checking auth:', error)
        if (mounted) {
          setAuthed(false)
        }
      }
    }
    
    checkAuth()
    
    return () => {
      mounted = false
      if (subscription) {
        // Supabase onAuthStateChange returns { data: { subscription: { unsubscribe } } }
        try {
          if (subscription?.data?.subscription?.unsubscribe) {
            subscription.data.subscription.unsubscribe()
          } 
          // Or direct unsubscribe method
          else if (typeof subscription?.unsubscribe === 'function') {
            subscription.unsubscribe()
          }
        } catch (err) {
          console.warn('Error unsubscribing auth:', err)
        }
      }
    }
  }, [])
  
  // ยกเว้น root ที่มี ?id=... (ผู้เล่น)
  const search = new URLSearchParams(location.search)
  const isPublicPlayer = location.pathname === '/' && search.has('id')
  if (isPublicPlayer) return children
  
  // Show nothing while checking auth
  if (authed === null) return null
  
  return authed ? children : <Navigate to="/login" replace state={{ from: location }} />
}

// ประตูผู้เล่น: /?id=... → ไปเล่น, ไม่งั้นไปล็อกอิน
function PlayerGate() {
  const location = useLocation()
  const id = new URLSearchParams(location.search).get('id')
  return id ? <Navigate to={`/play/${id}`} replace /> : <Navigate to="/login" replace />
}

export default function App() {
  // Initialize prefetching system
  useEffect(() => {
    initializePrefetching()
  }, [])

  return (
    <ThemeProvider>
      <Routes>
        {/* ผู้เล่น (สาธารณะ) */}
        <Route path="/" element={<PlayerGate />} />
        <Route path="/play/:id" element={<GamePlay />} />
        {/* เผื่อผู้ใช้กดลิงก์รูปแบบอื่น → ส่งเข้า GamePlay เช่นกัน */}
        <Route path="/games/play/:id" element={<GamePlay />} />
        <Route path="/games/:id/play" element={<GamePlay />} />
        {/* HOST link สำหรับเกม BINGO */}
        <Route path="/host/:id" element={<GamePlay />} />
        
        {/* หน้าแอดมิน (ไม่ต้องล็อกอิน) */}
        <Route path="/admin/answers/:gameId" element={<AdminAnswers />} />

        {/* เข้าสู่ระบบ */}
        <Route path="/login" element={<Login />} />

        {/* Theme Test (สำหรับทดสอบ) */}
        <Route path="/theme-test" element={<ThemeTest />} />
        
        {/* Security Test (สำหรับทดสอบช่องโหว่) */}
        <Route path="/test-checkin-security" element={<TestCheckinSecurity />} />
        {/* Alias สำหรับ backward compatibility */}
        <Route path="/test-security" element={<TestCheckinSecurity />} />
        
        {/* แอดมิน (ต้องล็อกอิน) */}
        <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
        <Route path="/upload-users-extra" element={<RequireAuth><UploadUsersExtra /></RequireAuth>} />
        <Route path="/games" element={<RequireAuth><GamesList /></RequireAuth>} />
        <Route path="/games/:id" element={<RequireAuth><GameEdit /></RequireAuth>} />
        <Route path="/creategame" element={<RequireAuth><GameCreate /></RequireAuth>} />
        
        {/* อื่น ๆ → กลับหน้า root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}
