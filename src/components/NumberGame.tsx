import React from 'react'

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
  const [answer, setAnswer] = React.useState('')

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

  const canSubmit = !!answer.trim() && !submitting && !disabled

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
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            boxShadow: '0 1px 0 rgba(0,0,0,0.02) inset',
          }}
        >
          {remainText}
        </div>
      )}

      <label className="f-label">คำตอบของคุณ</label>
      <input
        className="f-control"
        placeholder="พิมพ์คำตอบที่นี่…"
        value={answer}
        onChange={(e)=>setAnswer(e.target.value)}
        onKeyDown={(e)=>{ if (e.key === 'Enter' && canSubmit) onSubmit(answer.trim()) }}
        disabled={disabled}
      />

      <button
        className="btn-cta"
        disabled={!canSubmit}
        onClick={() => onSubmit(answer.trim())}
      >
        {submitting ? 'กำลังส่ง…' : 'ตอบคำถาม'}
      </button>
    </div>
  )
}
