// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import React, { ReactElement } from 'react'

import Home from './pages/Home'
import Login from './pages/Login'
import UploadUsers from './pages/UploadUsers'
import UploadUsersExtra from './pages/UploadUsersExtra'
import CreateGame from './pages/CreateGame'
import GamesList from './pages/games/GamesList'
import GamePlay from './pages/games/GamePlay'  // ✅ ใช้หน้าเล่น

function RequireAuth({ children }: { children: ReactElement }) {
  const authed = !!localStorage.getItem('auth')
  const location = useLocation()
  // ยกเว้น root ที่มี ?id=... (ผู้เล่น)
  const search = new URLSearchParams(location.search)
  const isPublicPlayer = location.pathname === '/' && search.has('id')
  if (isPublicPlayer) return children
  return authed ? children : <Navigate to="/login" replace state={{ from: location }} />
}

// ประตูผู้เล่น: /?id=... → ไปเล่น, ไม่งั้นไปล็อกอิน
function PlayerGate() {
  const location = useLocation()
  const id = new URLSearchParams(location.search).get('id')
  return id ? <Navigate to={`/play/${id}`} replace /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* ผู้เล่น (สาธารณะ) */}
      <Route path="/" element={<PlayerGate />} />
      <Route path="/play/:id" element={<GamePlay />} />

      {/* เข้าสู่ระบบ */}
      <Route path="/login" element={<Login />} />

      {/* แอดมิน (ต้องล็อกอิน) */}
      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/upload-users" element={<RequireAuth><UploadUsers /></RequireAuth>} />
      <Route path="/upload-users-extra" element={<RequireAuth><UploadUsersExtra /></RequireAuth>} />
      <Route path="/games" element={<RequireAuth><GamesList /></RequireAuth>} />
      <Route path="/games/:id" element={<RequireAuth><CreateGame /></RequireAuth>} />
      <Route path="/creategame" element={<RequireAuth><CreateGame /></RequireAuth>} />

      {/* อื่น ๆ → กลับหน้า root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
