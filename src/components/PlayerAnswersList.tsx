import React, { useState, useCallback, useMemo } from 'react'
import { useThemeColors } from '../contexts/ThemeContext'

interface AnswerData {
  id: string
  username: string
  answer: string
  timestamp: number
  ts: number
  gameId: string
  correct?: boolean
  code?: string
  won?: boolean
  amount?: number
}

interface PlayerAnswersListProps {
  answers: AnswerData[]
  loading?: boolean
  onRefresh?: () => void
  showRefreshButton?: boolean
}

export default function PlayerAnswersList({ 
  answers, 
  loading = false, 
  onRefresh, 
  showRefreshButton = true 
}: PlayerAnswersListProps) {
  const colors = useThemeColors()
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  // เวลาไทยแบบมีวินาที
  const fmtThai = useCallback((ts: number) => {
    // Firebase ใช้ milliseconds timestamp โดยตรง
    return new Date(ts).toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }, [])

  // ✅ OPTIMIZED: ใช้ useMemo เพื่อ cache การ sort/reduce (ลดการคำนวณซ้ำ)
  const { sortedAnswers, latestAnswers, groupedAnswers, sortedUsers } = useMemo(() => {
    // เรียงลำดับคำตอบตามเวลา (ใหม่ไปเก่า)
    const sorted = [...answers].sort((a, b) => b.ts - a.ts)

    // จัดกลุ่มคำตอบตาม USER และเก็บแค่คำตอบล่าสุด
    const latest: Record<string, AnswerData> = {}
    const grouped: Record<string, AnswerData[]> = {}
    
    // ✅ ใช้ for loop แทน reduce (เร็วกว่า)
    for (let i = 0; i < sorted.length; i++) {
      const answer = sorted[i]
      const username = answer.username || 'ไม่ระบุชื่อ'
      
      // เก็บคำตอบล่าสุด (เพราะ sorted เรียงใหม่ไปเก่า)
      if (!latest[username]) {
        latest[username] = answer
      }
      
      // จัดกลุ่มคำตอบทั้งหมด
      if (!grouped[username]) {
        grouped[username] = []
      }
      grouped[username].push(answer)
    }

    // ✅ เรียงลำดับ USER ตามเวลาของคำตอบล่าสุด (ใหม่ไปเก่า)
    const sortedUsers = Object.keys(latest).sort((a, b) => {
      const timeA = latest[a].ts || 0
      const timeB = latest[b].ts || 0
      return timeB - timeA // ใหม่ไปเก่า
    })

    return {
      sortedAnswers: sorted,
      latestAnswers: latest,
      groupedAnswers: grouped,
      sortedUsers
    }
  }, [answers])

  // ฟังก์ชันสำหรับ toggle การแสดงประวัติ
  const toggleUserExpansion = useCallback((username: string) => {
    setExpandedUsers(prevExpanded => {
      const newExpanded = new Set(prevExpanded)
      if (newExpanded.has(username)) {
        newExpanded.delete(username)
      } else {
        newExpanded.add(username)
      }
      return newExpanded
    })
  }, [])

  if (loading) {
    return (
      <div className="muted" style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{display:'inline-block', width:'20px', height:'20px', border:'2px solid #f3f3f3', borderTop:'2px solid #3498db', borderRadius:'50%', animation:'spin 1s linear infinite'}}></div>
        <div style={{marginTop:'8px'}}>กำลังโหลดคำตอบที่ผู้เล่นทาย...</div>
      </div>
    )
  }

  if (sortedUsers.length === 0) {
    return (
      <div className="muted" style={{ textAlign: 'center', padding: '8px 0' }}>
        ยังไม่มีคำตอบ
      </div>
    )
  }

  return (
    <div className="answers-list">
      {sortedUsers.map((username, idx) => {
        const answer = latestAnswers[username]
        const hasCode = typeof answer.code === 'string' && answer.code.length > 0
        const isCorrect = (answer.correct === true) || hasCode
        const isWrong = answer.correct === false
        const userAnswers = groupedAnswers[username] || []
        const hasHistory = userAnswers.length > 1
        const isExpanded = expandedUsers.has(username)

        return (
          <div key={`${username}-${idx}`} className="answer-group">
            {/* คำตอบล่าสุดเหมือนเดิม */}
            <div 
              className={`answer-item ${isWrong ? 'is-wrong' : ''} ${isCorrect && hasCode ? 'is-correct' : ''} clickable`}
              onClick={() => toggleUserExpansion(username)}
              style={isCorrect && hasCode ? {
                border: `2px solid ${colors.success}`,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${colors.successLight}15 0%, ${colors.successLight}08 100%)`,
                boxShadow: `0 2px 8px ${colors.success}20`,
                marginBottom: '4px'
              } : undefined}
            >
              <div className="ai-left">
                <div className="ai-time">🕒 {fmtThai(answer.ts)}</div>
                <div className="ai-user">USER : <b>{username}</b></div>
                <div>
                  <span className="ai-label">คำตอบ: </span>
                  <span 
                    className="ai-value"
                    style={isCorrect && hasCode ? {
                      color: colors.success,
                      fontWeight: '800'
                    } : undefined}
                  >
                    {answer.answer ?? '-'}
                  </span>
                </div>
              </div>

              <div className="ai-right">
                <div className="expand-icon" style={{ color: colors.primary }}>
                  {isExpanded ? '▼' : '▶'}
                </div>
                {/* ซ่อนป้าย "ถูกต้อง" ตามที่ร้องขอ */}
                {hasCode && (
                  <div style={{ 
                    marginTop: '4px',
                    padding: '6px 12px',
                    background: `linear-gradient(135deg, ${colors.successLight} 0%, ${colors.success} 100%)`,
                    border: `1px solid ${colors.successLight}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: colors.textInverse
                  }}>
                    🎁 โค้ดที่ได้: <span className="mono" style={{ 
                      background: '#ffffff',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: `1px solid ${colors.successLight}`,
                      color: colors.success,
                      fontWeight: '700'
                    }}>{answer.code}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ประวัติคำตอบเก่า (แสดงเมื่อ expand และมีประวัติ) */}
            {hasHistory && isExpanded && (
              <div className="history-section">
                <div className="history-header">
                  📚 ประวัติคำตอบเก่าของ {username} ({userAnswers.length - 1} รายการ)
                </div>
                <div className="history-list">
                  {userAnswers.slice(1).map((historyAnswer, historyIdx) => {
                    const historyIsCorrect = historyAnswer.correct === true
                    const historyIsWrong = historyAnswer.correct === false

                    return (
                      <div
                        className={`history-item ${historyIsWrong ? 'is-wrong' : ''}`}
                        key={`${username}-history-${historyIdx}`}
                      >
                        <div className="history-left">
                          <div className="history-time">🕒 {fmtThai(historyAnswer.ts)}</div>
                          <div className="history-answer">คำตอบ: {historyAnswer.answer ?? '-'}</div>
                        </div>
                        <div className="history-right">
                          {/* ซ่อนป้าย "ถูกต้อง" ในประวัติ */}
                          {historyIsWrong && <span className="status-wrong">✗ ไม่ถูกต้อง</span>}
                          {(typeof historyAnswer.code === 'string' && historyAnswer.code.length > 0) && (
                    <div className="code-badge" style={{
                      background: colors.successLight,
                      color: colors.success,
                      border: `1px solid ${colors.success}`,
                      borderRadius: 6,
                      padding: '2px 8px',
                      fontWeight: 700
                    }}>🎁 {historyAnswer.code}</div>
                  )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* แสดงข้อความเมื่อไม่มีประวัติ (แสดงเมื่อ expand และไม่มีประวัติ) */}
            {!hasHistory && isExpanded && (
              <div className="no-history">
                <div className="no-history-text">
                  📝 ไม่มีประวัติคำตอบที่เคยทายไว้
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
