/**
 * Security Test Page for Check-in System
 * หน้า UI สำหรับทดสอบช่องโหว่ต่างๆ
 */

import React from 'react'
import { runAllSecurityTests, TestResult } from '../utils/test-checkin-security'
import '../styles/test-security.css'

export default function TestCheckinSecurity() {
  const [gameId, setGameId] = React.useState('')
  const [userId, setUserId] = React.useState('')
  const [dayIndex, setDayIndex] = React.useState(0)
  const [coinAmount, setCoinAmount] = React.useState(50)
  const [running, setRunning] = React.useState(false)
  const [results, setResults] = React.useState<TestResult[]>([])
  const [error, setError] = React.useState<string | null>(null)

  const handleRunTests = async () => {
    if (!gameId || !userId) {
      setError('กรุณากรอก Game ID และ User ID')
      return
    }

    setRunning(true)
    setError(null)
    setResults([])

    try {
      const testResults = await runAllSecurityTests(
        gameId,
        userId,
        dayIndex,
        coinAmount
      )
      setResults(testResults)
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการทดสอบ')
      console.error('Test error:', err)
    } finally {
      setRunning(false)
    }
  }

  const passedCount = results.filter(r => r.passed).length
  const totalCount = results.length

  return (
    <div className="test-security-page">
      <div className="test-security-container">
        <h1>🔒 Security Test Suite - Check-in System</h1>
        <p className="test-description">
          ทดสอบช่องโหว่ต่างๆ ในระบบเช็คอินตามเงื่อนไขเกม
        </p>
        <div className="test-info-box">
          <h3>📋 เงื่อนไขเกมเช็คอิน:</h3>
          <ul>
            <li>✅ ต้องเช็คอินตามลำดับ (DAY 1 → DAY 2 → DAY 3 ...)</li>
            <li>✅ ต้องเช็คอินวันก่อนหน้าแล้วก่อนเช็คอินวันถัดไป</li>
            <li>✅ ใช้ server date validation (ป้องกันการแก้ไขวันที่)</li>
            <li>✅ เพิ่ม HENGCOIN ตามที่กำหนดใน rewards ของเกม</li>
            <li>✅ มี complete reward เมื่อเช็คอินครบทุกวัน</li>
            <li>✅ ป้องกันการเช็คอินซ้ำในวันเดียวกัน</li>
          </ul>
        </div>

        <div className="test-form">
          <div className="form-group">
            <label htmlFor="gameId">Game ID:</label>
            <input
              id="gameId"
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              placeholder="เช่น: game-123"
              disabled={running}
            />
          </div>

          <div className="form-group">
            <label htmlFor="userId">User ID:</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value.toUpperCase())}
              placeholder="เช่น: TESTUSER"
              disabled={running}
            />
          </div>

          <div className="form-group">
            <label htmlFor="dayIndex">Day Index (0 = DAY 1, 1 = DAY 2, ...):</label>
            <input
              id="dayIndex"
              type="number"
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              min="0"
              disabled={running}
            />
            <small className="form-hint">
              ⚠️ สำหรับ DAY 2+ ต้องเช็คอินวันก่อนหน้าแล้วก่อนทดสอบ
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="coinAmount">Coin Amount (ไม่ใช้แล้ว):</label>
            <input
              id="coinAmount"
              type="number"
              value={coinAmount}
              onChange={(e) => setCoinAmount(Number(e.target.value))}
              min="1"
              disabled={true}
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
            />
            <small className="form-hint">
              ⚠️ Test 2 จะอ่าน coin amount จาก rewards ของเกมอัตโนมัติตาม Day Index ที่เลือก
            </small>
          </div>

          <button
            className="test-button"
            onClick={handleRunTests}
            disabled={running || !gameId || !userId}
          >
            {running ? '⏳ กำลังทดสอบ...' : '🚀 เริ่มการทดสอบ'}
          </button>
        </div>

        {error && (
          <div className="test-error">
            <strong>❌ เกิดข้อผิดพลาด:</strong> {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="test-results">
            <h2>📊 ผลการทดสอบ</h2>
            <div className="test-summary">
              <div className={`summary-card ${passedCount === totalCount ? 'success' : 'warning'}`}>
                <div className="summary-number">{passedCount}/{totalCount}</div>
                <div className="summary-label">ผ่านการทดสอบ</div>
              </div>
            </div>

            <div className="test-list">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`test-item ${result.passed ? 'passed' : 'failed'}`}
                >
                  <div className="test-header">
                    <span className="test-icon">
                      {result.passed ? '✅' : '❌'}
                    </span>
                    <span className="test-name">
                      Test {index + 1}: {result.testName}
                    </span>
                  </div>
                  <div className="test-message">{result.message}</div>
                  {result.details && (
                    <details className="test-details">
                      <summary>รายละเอียด</summary>
                      <pre>{JSON.stringify(result.details, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="test-info">
          <h3>📝 หมายเหตุ</h3>
          <ul>
            <li>
              <strong>การทดสอบนี้จะไม่ทำลายข้อมูลจริง</strong> - ทุกการทดสอบจะ restore
              สถานะเดิมหลังจากทดสอบเสร็จ
            </li>
            <li>
              <strong>Test 1 (Duplicate Check-in Prevention)</strong> - ทดสอบการป้องกันการเช็คอินซ้ำในวันเดียวกัน
            </li>
            <li>
              <strong>Test 2 (Coin Transaction Validation)</strong> - ทดสอบการป้องกันการให้รางวัล HENGCOIN ซ้ำ
            </li>
            <li>
              <strong>Test 3 (Rollback on Coin Failure)</strong> - ต้องทดสอบ manual โดย simulate network error
            </li>
            <li>
              <strong>Test 4 (Complete Reward Race Condition)</strong> - ทดสอบการป้องกันการเคลม complete reward ซ้ำ
            </li>
            <li>
              <strong>Test 5 (Date Validation)</strong> - ทดสอบการตรวจสอบวันที่ (ป้องกันการแก้ไขวันที่)
            </li>
            <li>
              <strong>ควรทดสอบในสภาพแวดล้อม development</strong> เท่านั้น
            </li>
            <li>
              การทดสอบจะใช้ข้อมูลจริงจาก Firebase - ระวังอย่าใช้ User ID
              จริงที่กำลังใช้งาน
            </li>
            <li>
              <strong>⚠️ สำหรับ DAY 2+</strong> - ต้องเช็คอินวันก่อนหน้าแล้วก่อนทดสอบ (ตามเงื่อนไขเกม)
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

