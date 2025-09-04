// src/pages/UploadUsersExtra.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { db } from '../services/firebase'
import { ref, get, update, remove } from 'firebase/database'

import '../styles/upload-users.css' // ✅ ใช้สไตล์ชุดเดียวกับหน้า UploadUsers

type Row = { user: string; password: string }
type Stats = { total: number; valid: number; dup: number; invalid: number }

const colToIndex = (s: string) => {
  const t = s.trim().toUpperCase()
  if (!/^[A-Z]+$/.test(t)) return 0
  let n = 0
  for (let i = 0; i < t.length; i++) n = n * 26 + (t.charCodeAt(i) - 64)
  return Math.max(0, n - 1)
}

const DB_PATH = 'USERS_EXTRA'
const normalizeUser = (s: string) => s.trim().replace(/\s+/g, '')

const mask = (pw: string) => (pw ? '•'.repeat(Math.min(pw.length, 6)) : '—')

export default function UploadUsersExtra() {
  const nav = useNavigate()

  const fileRef = React.useRef<HTMLInputElement>(null)

  const [busy, setBusy] = React.useState(false)
  const [toast, setToast] = React.useState<string | null>(null)

  // พรีวิว
  const [rows, setRows] = React.useState<Row[]>([])
  const [invalids, setInvalids] = React.useState<string[]>([])
  const [stats, setStats] = React.useState<Stats>({ total: 0, valid: 0, dup: 0, invalid: 0 })

  // ฟอร์มแมนนวล
  const [mUser, setMUser] = React.useState('')
  const [mPass, setMPass] = React.useState('')

  const [colUser, setColUser]   = React.useState('A')
  const [colPass, setColPass]   = React.useState('B')
  const [startRow, setStartRow] = React.useState(1)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1600)
  }

  /** ตรวจความถูกต้องพื้นฐาน */
  const isValid = (u: string, p: string) => {
    const userOk = !!u && /^[0-9a-zA-Z_]+$/.test(u)
    const passOk = !!p
    return userOk && passOk
  }

  /** คำนวณสถิติ */
  const recomputeStats = React.useCallback((list: Row[], bads: string[]) => {
    const total = list.length + bads.length
    const invalid = bads.length
    const seen = new Set<string>()
    let dup = 0
    list.forEach(r => {
      const k = r.user.toLowerCase()
      if (seen.has(k)) dup += 1
      else seen.add(k)
    })
    const valid = list.length - dup
    setStats({ total, valid, dup, invalid })
  }, [])

  /** เพิ่มแมนนวล -> ลงพรีวิว */
  // แทนที่ addManual เดิม
const addManual = async () => {
  const u = normalizeUser(mUser)
  const p = mPass
  if (!isValid(u, p)) { showToast('รูปแบบ USER/PASSWORD ไม่ถูกต้อง'); return }

  setBusy(true)
  try {
    // เขียนทับเฉพาะรหัสผ่าน (ไม่ลบฟิลด์อื่น)
    await update(ref(db, `${DB_PATH}/${u}`), { password: p })
    showToast('เพิ่มผู้ใช้สำเร็จ')
    // อัปเดตพรีวิวให้เห็นทันที
    const next = [...rows, { user: u, password: p }]
    setRows(next); recomputeStats(next, invalids)
    setMUser(''); setMPass('')
  } finally {
    setBusy(false)
  }
}


  /** เลือกไฟล์ CSV */
  const pickCSV = () => fileRef.current?.click()

  /** parse CSV -> rows */
/** parse CSV -> rows (รองรับไฟล์ไม่มี header, map จากคอลัมน์ A/B และแถวเริ่มต้น) */
const onPickCSV: React.ChangeEventHandler<HTMLInputElement> = (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  setBusy(true)

  const userIdx = colToIndex(colUser || 'A')
  const passIdx = colToIndex(colPass || 'B')
  const start   = Math.max(0, (Number(startRow) || 1) - 1)

  Papa.parse(file, {
    header: false,                 // ← อ่านเป็นแถวๆ ไม่มีชื่อคอลัมน์
    skipEmptyLines: true,
    complete: (res) => {
      const good: Row[] = []
      const bad: string[] = []

      const data = (res.data as any[]) || []
      for (let i = start; i < data.length; i++) {
        const row = data[i]
        if (!row) continue
        const u = normalizeUser(String(row[userIdx] ?? ''))
        const p = String(row[passIdx] ?? '')
        if (isValid(u, p)) good.push({ user: u, password: p })
        else bad.push(`แถวที่ ${i + 1}`)
      }

      setRows(good)
      setInvalids(bad)
      recomputeStats(good, bad)
      setBusy(false)
      showToast(`โหลดไฟล์แล้ว: ใช้คอลัมน์ ${colUser}/${colPass}, เริ่มแถว ${start + 1} (${good.length} แถว OK)`)

      if (fileRef.current) fileRef.current.value = '' // เลือกไฟล์เดิมซ้ำได้
    },
    error: () => {
      setBusy(false)
      showToast('อ่านไฟล์ไม่สำเร็จ')
    },
  })
}


  /** ดึงทั้งหมดจาก DB -> ลงพรีวิว */
  const loadAll = async () => {
    setBusy(true)
    try {
      const snap = await get(ref(db, DB_PATH))
      const val = (snap.exists() ? snap.val() : {}) as Record<string, { password: string }>
      const list: Row[] = Object.keys(val).map((k) => ({ user: k, password: val[k]?.password || '' }))
      setRows(list)
      setInvalids([])
      recomputeStats(list, [])
      showToast(`ดึงทั้งหมดแล้ว (${list.length})`)
    } finally {
      setBusy(false)
    }
  }

  /** บันทึก (อัปเดตทับ) — ใช้ update ทีละก้อนแบบ merge */
  const saveAll = async () => {
    if (rows.length === 0) { showToast('ยังไม่มีข้อมูลพรีวิว'); return }
    // กำจัดซ้ำในพรีวิวเองก่อน
    const map = new Map<string, Row>()
    rows.forEach(r => map.set(r.user.toLowerCase(), r))
    const unique = Array.from(map.values())

    const updates: Record<string, any> = {}
    unique.forEach(r => { updates[r.user] = { password: r.password } })

    setBusy(true)
    try {
      await update(ref(db, DB_PATH), updates)
      showToast('บันทึกสำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  /** Export USERS_EXTRA ทั้งหมดเป็น CSV */
  const exportAll = async () => {
    setBusy(true)
    try {
      const snap = await get(ref(db, DB_PATH))
      const val = (snap.exists() ? snap.val() : {}) as Record<string, { password: string }>
      const data = Object.keys(val).map(u => ({ user: u, password: val[u]?.password ?? '' }))
      const csv = Papa.unparse(data, { header: true })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'USERS_EXTRA.csv'
      a.click()
      URL.revokeObjectURL(url)
      showToast(`Export ${data.length} รายการแล้ว`)
    } finally {
      setBusy(false)
    }
  }

  /** ลบทั้งหมด */
  const wipeAll = async () => {
    if (!confirm('ยืนยันลบ USERS_EXTRA ทั้งหมด?')) return
    setBusy(true)
    try {
      await remove(ref(db, DB_PATH))
      setRows([]); setInvalids([]); recomputeStats([], [])
      showToast('ลบเรียบร้อย')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-wrap upload-users">
      {!!toast && <div className="toast">{toast}</div>}

      <h1 className="page-title">อัปโหลด <b>USERS_EXTRA</b> (USER + PASSWORD)</h1>

      <div className="grid">
        {/* ============ LEFT ============ */}
        <div className="card left">
          <div className="box-title">เพิ่มผู้ใช้ด้วยตนเอง (Manual)</div>

          <div className="stack">
            <input
              className="ipt"
              placeholder="USER (อักษร/ตัวเลข, เว้นวรรคไม่ได้)"
              value={mUser}
              onChange={(e)=>setMUser(e.target.value)}
              disabled={busy}
            />
            <input
              className="ipt"
              placeholder="PASSWORD (เก็บตามที่กรอก ไม่แปลงตัวพิมพ์)"
              value={mPass}
              onChange={(e)=>setMPass(e.target.value)}
              disabled={busy}
            />
            <button className="btn btn-green" onClick={addManual} disabled={busy || !mUser || !mPass}>
              <span className="ico">➕</span> เพิ่มผู้ใช้ (USER + PASSWORD)
            </button>
          </div>

          <div className="divider" />

          <div className="box-title">นำเข้า / บันทึก</div>
          <div className="stack">
            <button className="btn btn-blue" onClick={pickCSV} disabled={busy}>
              <span className="ico">📂</span> เลือกไฟล์ CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickCSV} hidden />

            <button className="btn btn-green" onClick={saveAll} disabled={busy || rows.length === 0}>
              <span className="ico">💾</span> บันทึกข้อมูล (อัปเดตได้)
            </button>
          </div>

          <div className="divider" />

          <div className="box-title">ดู / ส่งออก</div>
          <div className="stack">
            <button className="btn btn-yellow" onClick={loadAll} disabled={busy}>
              <span className="ico">👁️</span> ดูรายการทั้งหมด
            </button>
            <button className="btn btn-yellow" onClick={exportAll} disabled={busy}>
              <span className="ico">📤</span> Export USERS_EXTRA (CSV)
            </button>
          </div>

          <div className="divider" />

          <div className="box-title">การจัดการ</div>
          <div className="stack">
            <button className="btn btn-red" onClick={wipeAll} disabled={busy}>
              <span className="ico">🗑️</span> ลบ USERS_EXTRA ทั้งหมด
            </button>
            <button className="btn btn-gray" onClick={()=>nav(-1)} disabled={busy}>
              <span className="ico">↩︎</span> กลับไปหน้าแรก
            </button>
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        <div className="card right">
          <div className="right-head">
            <span className="tag">พรีวิว USER + PASSWORD </span>
            <div className="meta">
              <span>ทั้งหมด: <b>{stats.total}</b></span>
              <span>ใช้ได้: <b className="ok">{stats.valid}</b></span>
              <span>ซ้ำถูกตัด: <b>{stats.dup}</b></span>
              <span>ไม่ผ่าน: <b className="bad">{stats.invalid}</b></span>
            </div>
          </div>

          {rows.length === 0 && invalids.length === 0 ? (
            <div className="empty">พรีวิวรายชื่อจะปรากฏที่นี่หลังเลือกไฟล์…</div>
          ) : (
            <>
              <div className="list" role="table" aria-label="พรีวิวรายการ">
                {rows.map((r, i) => (
                  <div className="row" key={`${r.user}-${i}`}>
                    <div className="idx">{i + 1}</div>
                    <div className="name">
                      <b>{r.user}</b> &nbsp; <span style={{color:'#64748b'}}>— {mask(r.password)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {invalids.length > 0 && (
                <div className="invalid-box">
                  <div className="invalid-title">แถวที่ไม่ผ่าน ({invalids.length})</div>
                  <div className="invalid-list">
                    {invalids.slice(0, 30).map((u, i) => (
                      <span className="chip" key={`${u}-${i}`}>{u || '(ว่าง)'}</span>
                    ))}
                    {invalids.length > 30 && (
                      <span className="chip more">+{invalids.length - 30} รายการ</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
