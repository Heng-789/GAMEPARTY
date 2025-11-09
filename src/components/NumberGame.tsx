import React from 'react'
import { useThemeColors } from '../contexts/ThemeContext'

type NumberGameProps = {
  image?: string
  endAtMs?: number | null
  disabled?: boolean
  submitting?: boolean
  onSubmit: (answer: string) => void
  onExpire?: () => void            // ✅ ใหม่
}

export default function NumberGame({
  image,
  endAtMs,
  disabled,
  submitting,
  onSubmit,
  onExpire,                         // ✅ ใหม่
}: NumberGameProps) {
  const colors = useThemeColors()
  const [answer, setAnswer] = React.useState('')

  // ==== Input validation for 2-digit numbers only ====
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow digits and limit to 2 characters
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 2)
    setAnswer(numericValue)
  }

  // Check if input is valid (exactly 2 digits)
  const isValidInput = answer.length === 2 && /^\d{2}$/.test(answer)

  // ==== Countdown (อยู่ใต้รูป) ====
  const [remainText, setRemainText] = React.useState('')
  React.useEffect(() => {
    if (!endAtMs) { setRemainText(''); return }

    let fired = false
    const tick = () => {
      const diff = endAtMs - Date.now()
      if (diff <= 0) {
        setRemainText('')
        if (!fired) { fired = true; onExpire?.() }   // ✅ แจ้ง parent ครั้งเดียว
        return
      }
      const d  = Math.floor(diff / 86400000)
      const hh = Math.floor((diff % 86400000) / 3600000)
      const mm = Math.floor((diff % 3600000) / 60000)
      const ss = Math.floor((diff % 60000) / 1000)
      const pad = (n:number)=>String(n).padStart(2,'0')
      const time = `${pad(hh)}:${pad(mm)}:${pad(ss)}`
      setRemainText(d > 0 ? `เหลือเวลา ${d} วัน ${time}` : `เหลือเวลา ${time}`)
    }

    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [endAtMs, onExpire])            // ✅ ใส่ onExpire ใน deps

  const canSubmit = isValidInput && !submitting && !disabled

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {!!image && <img src={image} className="play-image" alt="game" />}

      {!!remainText && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginTop: 10,
            marginBottom: 6,
            padding: '10px 14px',
            textAlign: 'center',
            fontWeight: 700,
            borderRadius: 12,
            background: `${colors.danger}15`,
            border: `1px solid ${colors.dangerLight}`,
            color: colors.danger,
            boxShadow: '0 1px 0 rgba(0,0,0,0.02) inset',
          }}
        >
          {remainText}
        </div>
      )}

      <label className="f-label">คำตอบของคุณ (กรอกตัวเลข 2 ตัว)</label>
      <input
        className="f-control"
        placeholder="กรอกตัวเลข 2 ตัว (เช่น 12, 34, 56)"
        value={answer}
        onChange={handleInputChange}
        onKeyDown={(e)=>{ if (e.key === 'Enter' && canSubmit) onSubmit(answer) }}
        disabled={disabled}
        maxLength={2}
        inputMode="numeric"
        pattern="[0-9]{2}"
        style={{
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: '700',
          letterSpacing: '2px'
        }}
      />

      {/* Helper text */}
      {answer.length > 0 && !isValidInput && (
        <div style={{
          fontSize: '14px',
          color: colors.danger,
          textAlign: 'center',
          marginTop: '-8px',
          fontWeight: '600'
        }}>
          กรุณากรอกตัวเลข 2 ตัวเท่านั้น
        </div>
      )}

      <button
        className="btn-cta"
        disabled={!canSubmit}
        onClick={() => onSubmit(answer)}
      >
        {submitting ? 'กำลังส่ง…' : 'ตอบคำถาม'}
      </button>
    </div>
  )
}
