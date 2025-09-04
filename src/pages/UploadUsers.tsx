import React from 'react'
import Papa, { ParseStepResult } from 'papaparse' 
import { db } from '../services/firebase'
import {
  ref, get, set, update, query, orderByKey, startAt, limitToFirst, remove
} from 'firebase/database'
import { useNavigate } from 'react-router-dom';

import '../styles/upload-users.css'

const USERS_PATH = 'username'
const PREVIEW_LIMIT = 500           // แสดงพรีวิว CSV แค่เท่านี้
const PAGE_SIZE     = 200           // โหลดทีละหน้า เมื่อดูรายชื่อทั้งหมด
const SAVE_CHUNK    = 1000          // บันทึกทีละชุด (ลดภาระ RTDB)

// อักขระต้องห้ามของ Firebase RTDB key คือ . # $ / [ ]
const RTDB_FORBIDDEN = /[.#$/\[\]]/g;

// แปลงชื่อให้เป็นคีย์ที่ใช้กับ RTDB ได้แน่นอน
const sanitizeKey = (s: string) =>
  String(s)
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '')          // เอาช่องว่างทิ้ง
    .replace(RTDB_FORBIDDEN, '-') // แทนที่อักขระต้องห้ามด้วย '-'
    .replace(/-+/g, '-')          // รวมขีดซ้ำ
    .replace(/^-|-$/g, '');       // ตัดขีดหัว/ท้าย

const isValid = (s: string) => sanitizeKey(s).length > 0;


type CSVRow = [string, ...unknown[]]; // เราอ่านแค่คอลัมน์แรก


export default function UploadUsers() {
  /** ---------- CSV preview & stats ---------- */
  const [preview, setPreview] = React.useState<string[]>([])
  const [invalid, setInvalid] = React.useState<string[]>([])
  const [stats, setStats]     = React.useState({ total: 0, valid: 0, invalid: 0 })

  const totalRef   = React.useRef(0)
  const validRef   = React.useRef(0)
  const invalidRef = React.useRef(0)
  // เก็บ “รายการถูกต้องทั้งหมด” เพื่อไว้บันทึกแบบ chunk
  const allValidRef = React.useRef<string[]>([])

  /** ---------- ดูรายชื่อทั้งหมด (RTDB) แบบแบ่งหน้า ---------- */
  const [rows, setRows]       = React.useState<string[]>([])
  const [cursor, setCursor]   = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(true)

  /** ---------- UI state ---------- */
  const [loading, setLoading]     = React.useState(false)
  const [saving, setSaving]       = React.useState(false)
  const [progress, setProgress]   = React.useState<number>(0)  // 0..100
  const [toast, setToast]         = React.useState<string>('')

  const [manualName, setManualName] = React.useState('')
  const nav = useNavigate();
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(()=> setToast(''), 2200)
  }

  const resetCsvPreview = () => {
    setPreview([]); setInvalid([])
    setStats({ total: 0, valid: 0, invalid: 0 })
    totalRef.current = 0; validRef.current = 0; invalidRef.current = 0
    allValidRef.current = []
    setProgress(0)
  }

  /** ---------- อ่านไฟล์ CSV แบบสตรีม ---------- */
 const onPickCsv = (file: File) => {
  resetCsvPreview();

  Papa.parse<CSVRow>(file, {
    worker: true,
    skipEmptyLines: true,
    fastMode: true,
    step: (res: ParseStepResult<CSVRow>) => {   // ← ใส่ type ตรงนี้
      const raw = String(res.data?.[0] ?? '');
      const u = sanitizeKey(raw);;
      totalRef.current += 1;

      if (isValid(u)) {
        validRef.current += 1;
        allValidRef.current.push(u);
        setPreview(prev => (prev.length < PREVIEW_LIMIT ? [...prev, u] : prev));
      } else {
        invalidRef.current += 1;
        setInvalid(prev => (prev.length < 200 ? [...prev, raw] : prev));
      }

      if (totalRef.current % 200 === 0) {
        setStats({ total: totalRef.current, valid: validRef.current, invalid: invalidRef.current });
      }
    },
    complete: () => {
      setStats({ total: totalRef.current, valid: validRef.current, invalid: invalidRef.current });
      showToast('อ่านไฟล์เสร็จแล้ว');
    },
  });
};
// คัดกรองชุดคีย์ทั้งหมดให้ปลอดภัยสำหรับ RTDB (กันรั่วทุกจุด)
const ensureSafeKeys = (arr: string[]) => {
  const invalids: string[] = [];
  const safe: string[] = [];
  const seen = new Set<string>();

  for (const raw of arr) {
    const key = sanitizeKey(raw);
    if (!key || /[.#$/\[\]]/.test(key)) {   // กันหลุดอีกชั้น
      invalids.push(raw ?? '');
      continue;
    }
    if (!seen.has(key)) {
      safe.push(key);
      seen.add(key);
    }
  }
  return { safe, invalids };
};

  /** ---------- บันทึกลง RTDB เป็นชิ้น ๆ (merge) ---------- */
/** ---------- บันทึกลง RTDB เป็นชิ้น ๆ (merge) ---------- */
const saveToDB = async () => {
  // ดึงรายการจาก CSV ที่เราเก็บไว้ แล้วคัดกรอง/ sanitize อีกรอบ
  const { safe, invalids } = ensureSafeKeys(allValidRef.current);

  if (safe.length === 0) {
    if (invalids.length) {
      setInvalid(prev => (prev.length < 200 ? [...prev, ...invalids.slice(0, 200 - prev.length)] : prev));
    }
    showToast('ยังไม่มีข้อมูลที่จะบันทึก');
    return;
  }

  setSaving(true); setProgress(0);
  try {
    const total = safe.length;
    for (let i = 0; i < total; i += SAVE_CHUNK) {
      const chunk = safe.slice(i, i + SAVE_CHUNK);
      const payload: Record<string, true> = {};
      for (const k of chunk) payload[k] = true;

      // กันหลุด: ตรวจอีกชั้นก่อนยิง update
      for (const k in payload) {
        if (/[.#$/\[\]]/.test(k)) {
          console.error('พบคีย์ต้องห้ามหลงมา:', k);
          delete payload[k];
        }
      }
      if (Object.keys(payload).length === 0) continue;

      await update(ref(db, USERS_PATH), payload);
      setProgress(Math.round(((i + chunk.length) / total) * 100));
    }

    // ถ้ามีรายการที่ถูกตัดเพราะไม่ปลอดภัย โชว์ตัวอย่างไว้ให้เห็น
    if (invalids.length) {
      setInvalid(prev => (prev.length < 200 ? [...prev, ...invalids.slice(0, 200 - prev.length)] : prev));
    }
    showToast(`บันทึกสำเร็จ ${safe.length.toLocaleString()} รายการ` + (invalids.length ? ` (ตัดทิ้ง ${invalids.length})` : ''));
  } catch (e: any) {
    console.error(e);
    showToast(`บันทึกล้มเหลว: ${e?.message || 'unknown error'}`);
  } finally {
    setSaving(false);
  }
};


  /** ---------- เพิ่มมือ 1 รายการ ---------- */
  const addManual = async () => {
    const u = sanitizeKey(manualName);
    if (!u) return
    try {
      await update(ref(db, USERS_PATH), { [u]: true })
      showToast(`เพิ่ม ${u} แล้ว`)
      setManualName('')
    } catch (e) {
      console.error(e); showToast('เพิ่มไม่สำเร็จ')
    }
  }

  /** ---------- ดูรายชื่อทั้งหมดจาก DB ---------- */
  const loadFirstPage = async () => {
    setRows([]); setCursor(null); setHasMore(true)
    await loadMore()
  }

  const loadMore = async () => {
    if (!hasMore || loading) return
    setLoading(true)
    try {
      const base = ref(db, USERS_PATH)
      const q = cursor
        ? query(base, orderByKey(), startAt(cursor), limitToFirst(PAGE_SIZE + 1))
        : query(base, orderByKey(),               limitToFirst(PAGE_SIZE))

      const snap = await get(q)
      const obj  = snap.exists() ? snap.val() as Record<string, boolean> : {}
      let keys   = Object.keys(obj)

      if (cursor) keys = keys.filter(k => k !== cursor)
      if (keys.length === 0) { setHasMore(false); return }

      setRows(prev => [...prev, ...keys])
      setCursor(keys[keys.length - 1])
      if (keys.length < PAGE_SIZE) setHasMore(false)
    } finally {
      setLoading(false)
    }
  }

  /** ---------- Export CSV (ดึงแบบแบ่งหน้าแล้วรวม) ---------- */
  const exportAll = async () => {
    setLoading(true)
    try {
      let all: string[] = []
      let cur: string | null = null
      let more = true
      while (more) {
        const base = ref(db, USERS_PATH)
        const q = cur
          ? query(base, orderByKey(), startAt(cur), limitToFirst(PAGE_SIZE + 1))
          : query(base, orderByKey(),               limitToFirst(PAGE_SIZE))
        const snap = await get(q)
        const obj  = snap.exists() ? snap.val() as Record<string, boolean> : {}
        let keys   = Object.keys(obj)
        if (cur) keys = keys.filter(k => k !== cur)
        all = all.concat(keys)
        if (keys.length < PAGE_SIZE) more = false
        cur = keys[keys.length - 1]
      }

      const csv = all.join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url  = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `users_${new Date().toISOString().slice(0,19)}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      showToast(`Export ${all.length.toLocaleString()} รายการ`)
    } catch (e) {
      console.error(e); showToast('Export ล้มเหลว')
    } finally {
      setLoading(false)
    }
  }

  /** ---------- ลบผู้ใช้ทั้งหมด (ยืนยัน) ---------- */
  const deleteAll = async () => {
    if (!confirm('ยืนยันลบผู้ใช้ทั้งหมด? (ย้อนกลับไม่ได้)')) return
    try {
      await remove(ref(db, USERS_PATH))
      showToast('ลบทั้งหมดแล้ว')
      setRows([]); setCursor(null); setHasMore(false)
    } catch (e) {
      console.error(e); showToast('ลบไม่สำเร็จ')
    }
  }

  return (
    <section className="page-wrap upload-users">
      {toast && <div className="toast">{toast}</div>}

      <h1 className="page-title">อัปโหลดรายชื่อผู้ใช้ (CSV)</h1>

      <div className="grid">
        {/* ===== แผงซ้าย ===== */}
        <div className="card left">
          <div className="box-title">เพิ่มผู้ใช้ด้วยตนเอง (Manual)</div>
          <div className="stack">
            <input
              className="ipt"
              placeholder="พิมพ์ USERNAME (ตัวอักษร/ตัวเลข, เว้นวรรคได้)"
              value={manualName}
              onChange={(e)=>setManualName(e.target.value)}
            />
            <button className="btn btn-green" onClick={addManual} disabled={!sanitizeKey(manualName)}>
              ➕ เพิ่มผู้ใช้
            </button>
          </div>

          <div className="divider" />

          <div className="box-title">นำเข้า / บันทึก</div>
          <div className="stack">
            <label className="btn btn-blue" style={{position:'relative'}}>
              <input
                type="file" accept=".csv"
                onChange={(e)=>{ const f=e.target.files?.[0]; if(f) onPickCsv(f) }}
                style={{position:'absolute', inset:0, opacity:0, cursor:'pointer'}}
              />
              📁 เลือกไฟล์ CSV
            </label>

            <button className="btn btn-green" onClick={saveToDB} disabled={saving || allValidRef.current.length===0}>
              {saving ? 'กำลังบันทึก…' : '💾 บันทึกข้อมูล (Merge)'}
            </button>

            {saving && (
              <div className="progress" aria-label="saving progress" style={{marginTop:2}}>
                <span style={{width: `${progress}%`}} />
              </div>
            )}
          </div>

          <div className="divider" />

          <div className="box-title">ดู / ส่งออก</div>
          <div className="stack">
            <button className="btn btn-yellow" onClick={loadFirstPage} disabled={loading}>
              📄 ดูรายชื่อทั้งหมด
            </button>
            <button className="btn btn-gray" onClick={exportAll} disabled={loading}>
              ⬇️ Export รายชื่อทั้งหมด (CSV)
            </button>
          </div>

          <div className="divider" />

          <div className="box-title">การจัดการ</div>
          <div className="stack">
            <button className="btn btn-red" onClick={deleteAll}>
              🗑️ ลบผู้ใช้ทั้งหมด
            </button>
             <button className="btn btn-gray" onClick={() => nav(-1)}>
              <span className="ico">↩︎</span> กลับไปหน้าแรก
            </button>            
          </div>
        </div>

        {/* ===== แผงขวา ===== */}
        <div className="card right">
          <div className="right-head">
            <span className="tag">พรีวิวรายชื่อ</span>
            <div className="meta">
              <span>ทั้งหมด: <b>{stats.total}</b></span>
              <span>ใช้ได้: <b className="ok">{stats.valid}</b></span>
              <span>ไม่ผ่าน: <b className="bad">{stats.invalid}</b></span>
            </div>
          </div>

          {/* ถ้ามีพรีวิวจาก CSV */}
          {preview.length > 0 ? (
            <>
              <div className="list" role="list" aria-label="CSV preview (limited)">
                {preview.map((u, i)=>(
                  <div className="row" key={u+i}>
                    <div className="idx">{i+1}</div>
                    <div className="name">{u}</div>
                  </div>
                ))}
              </div>

              <div style={{marginTop:8, color:'#64748b', fontWeight:700}}>
                แสดงเพียง {PREVIEW_LIMIT.toLocaleString()} แถวแรกจาก {stats.total.toLocaleString()} แถว
              </div>

              {invalid.length > 0 && (
                <div className="invalid-box">
                  <div className="invalid-title">รายการไม่ถูกต้อง (ตัวอย่าง)</div>
                  <div className="invalid-list">
                    {invalid.map((x, idx)=>(
                      <span className="chip" key={idx}>{x || '(ว่าง)'}</span>
                    ))}
                    {stats.invalid > invalid.length && (
                      <span className="chip more">+ อีก {stats.invalid - invalid.length}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            // โหมดดูรายชื่อทั้งหมดจาก DB
            <>
              <div className="list" role="list" aria-label="Users from DB">
                {rows.length === 0 ? (
                  <div className="empty">พรีวิวรายชื่อจะปรากฏที่นี่หลังเลือกไฟล์… หรือกด “ดูรายชื่อทั้งหมด”</div>
                ) : (
                  rows.map((u, i)=>(
                    <div className="row" key={u+i}>
                      <div className="idx">{i+1}</div>
                      <div className="name">{u}</div>
                    </div>
                  ))
                )}
              </div>

              {rows.length > 0 && (
                <div style={{display:'flex', justifyContent:'center', marginTop:12}}>
                  <button
                    className="btn btn-blue"
                    onClick={loadMore}
                    disabled={!hasMore || loading}
                    style={{minWidth:220}}
                  >
                    {loading ? 'กำลังโหลด…' : hasMore ? 'โหลดเพิ่ม' : 'หมดแล้ว'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
