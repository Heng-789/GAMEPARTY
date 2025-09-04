import React from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../services/firebase'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPass, setShowPass] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      localStorage.setItem('auth', '1')     // ให้ RequireAuth ผ่าน
      nav('/home', { replace: true })
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-hero">
      <div className="auth-card">
        <h1 className="auth-title">เข้าสู่ระบบ <b>Admin</b></h1>

        <form onSubmit={onSubmit} className="auth-form">
          <label className="field">
            <span>อีเมล</span>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>รหัสผ่าน</span>
            <div className="password-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-pass"
                aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                onClick={() => setShowPass((s) => !s)}
              >
                {/* ไอคอนตาแบบ inline svg เพื่อไม่ต้องลงไลบรารีเพิ่ม */}
                {showPass ? (
                  <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="m3 3 18 18-1.41 1.41L17.73 20A11.49 11.49 0 0 1 12 22C5 22 1 15 1 15a19.6 19.6 0 0 1 6.86-6.86L1.59 4.41 3 3Zm8.73 8.73 3.54 3.54A5 5 0 0 0 11 7a5 5 0 0 0 .73 4.73ZM12 2c7 0 11 7 11 7a19.57 19.57 0 0 1-5.05 5.9l-1.44-1.44A17.29 17.29 0 0 0 21 9.05S17 3 12 3a9.86 9.86 0 0 0-2.38.29L8.16 2.83A11.53 11.53 0 0 1 12 2Z"/></svg>
                )}
              </button>
            </div>
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </section>
  )
}
