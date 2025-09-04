// src/components/AnnounceGame.tsx
import React from 'react'

type Props = {
  game: any
  username: string // normalize แล้ว
  openInfo?: (title: string, message: string) => void
}

const normalize = (s: string) => (s || '').trim().replace(/\s+/g, '')

export default function AnnounceGame({ game, username, openInfo }: Props) {
  const users: string[] = Array.isArray(game?.announce?.users) ? game.announce.users : []
  const me = normalize(username)
  const isWinner = React.useMemo(() => {
    const set = new Set(users.map(u => normalize(u)))
    return me && set.has(me)
  }, [users, me])

  return (
    <div className="announce-game">
      <div className="ag-title"><b>รายชื่อผู้ได้รับรางวัล</b></div>

      {/* แถบเลื่อนรายชื่อ */}
      <div className="ag-strip" style={{display:'flex',gap:8,overflowX:'auto',padding:'8px 4px'}}>
        {users.length ? users.map((u,i)=>(
          <div key={`${u}-${i}`} className="ag-chip" style={{
            flex:'0 0 auto', padding:'8px 12px', borderRadius:999,
            border:'1px solid #ddd', background:'#fff'
          }}>
            {u}
          </div>
        )) : (
          <div style={{opacity:.7}}>ยังไม่มีรายชื่อ</div>
        )}
      </div>

      {/* สถานะของฉัน */}
      <div style={{marginTop:12}}>
        {isWinner ? (
          <div className="ag-ok" style={{padding:'8px 12px',borderRadius:8,background:'#e8fff1',border:'1px solid #b9f0cf'}}>
            ✅ USER ของคุณอยู่ในรายชื่อผู้ได้รับรางวัล
          </div>
        ) : (
          <div className="ag-warn" style={{padding:'8px 12px',borderRadius:8,background:'#fff8e6',border:'1px solid #ffe0a3'}}>
            ℹ️ กรอก USER ให้ตรงกับที่ส่งเข้าร่วม เพื่อเช็คสิทธิ์
          </div>
        )}
      </div>
    </div>
  )
}
