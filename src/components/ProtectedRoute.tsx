import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // ✅ อนุญาตลิงก์ผู้เล่นแบบสาธารณะ:
  // - root พร้อมพารามิเตอร์ ?id=game_xxx  (เช่น https://heng36.party/?id=game_123)
  // - หรือเส้นทาง /play/:id (ถ้าโปรเจกต์คุณมีหน้าเล่นแยก)
  const search = new URLSearchParams(location.search)
  const isPublicPlayer =
    (location.pathname === '/' && search.has('id')) ||
    /^\/play\/[^/]+$/.test(location.pathname)

  if (isPublicPlayer) return <>{children}</>

  if (loading) return <div style={{ padding: 16 }}>กำลังตรวจสอบสิทธิ์...</div>

  if (!user) {
    // เก็บปลายทางไว้ เผื่อให้เด้งกลับหลังล็อกอิน
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
