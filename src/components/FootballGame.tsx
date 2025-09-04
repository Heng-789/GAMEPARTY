import React from 'react'

type FootballGameProps = {
  image?: string
  endAtMs?: number | null
  homeName: string
  awayName: string
  disabled?: boolean
  submitting?: boolean
  onSubmit: (home: number, away: number) => void
  onExpire?: () => void            // ✅ ใหม่
}

export default function FootballGame({
  image,
  endAtMs,
  homeName,
  awayName,
  disabled,
  submitting,
  onSubmit,
  onExpire,                         // ✅ ใหม่
}: FootballGameProps) {
  const [homeScore, setHomeScore] = React.useState('')
  const [awayScore, setAwayScore] = React.useState('')

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

  const isNum = (v: string) => /^[0-9]{1,2}$/.test(v)
  const canSubmit =
    !submitting &&
    !disabled &&
    isNum(homeScore) &&
    isNum(awayScore)

  const submitNow = () => {
    onSubmit(parseInt(homeScore, 10), parseInt(awayScore, 10))
  }

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

      {/* ช่องกรอกสกอร์ */}
      <div className="score-card" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {/* ทีมเหย้า */}
        <div style={{
          display:'grid', gridTemplateColumns:'auto 1fr 88px', alignItems:'center',
          gap:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:14, padding:'12px 14px'
        }}>
          <span style={{
            padding:'6px 10px', borderRadius:999, fontWeight:700,
            background:'#e8faf0', border:'1px solid #bbf7d0', color:'#166534'
          }}>ทีมเหย้า</span>
          <div style={{fontWeight:800, color:'#0f172a'}}>{homeName}</div>
          <input
            className="score-input"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            placeholder="0"
            value={homeScore}
            onChange={(e)=>setHomeScore(e.target.value.replace(/[^\d]/g,''))}
            onKeyDown={(e)=>{ if (e.key==='Enter' && canSubmit) submitNow() }}
            disabled={disabled}
            style={{ height:44, borderRadius:12, textAlign:'center', fontWeight:900, border:'1px solid #d1d5db', outline:'none' }}
          />
        </div>

        {/* ทีมเยือน */}
        <div style={{
          display:'grid', gridTemplateColumns:'auto 1fr 88px', alignItems:'center',
          gap:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:14, padding:'12px 14px'
        }}>
          <span style={{
            padding:'6px 10px', borderRadius:999, fontWeight:700,
            background:'#eef2ff', border:'1px solid #c7d2fe', color:'#3730a3'
          }}>ทีมเยือน</span>
          <div style={{fontWeight:800, color:'#0f172a'}}>{awayName}</div>
          <input
            className="score-input"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            placeholder="0"
            value={awayScore}
            onChange={(e)=>setAwayScore(e.target.value.replace(/[^\d]/g,''))}
            onKeyDown={(e)=>{ if (e.key==='Enter' && canSubmit) submitNow() }}
            disabled={disabled}
            style={{ height:44, borderRadius:12, textAlign:'center', fontWeight:900, border:'1px solid #d1d5db', outline:'none' }}
          />
        </div>
      </div>

      <button className="btn-cta" disabled={!canSubmit} onClick={submitNow}>
        {submitting ? 'กำลังส่ง…' : 'ตอบคำถาม'}
      </button>
    </div>
  )
}
