# 🔧 Snapshot Engine Fix - Database Timeout Error

## ❌ ปัญหาที่พบ

**Error:** `timeout exceeded when trying to connect`
- เกิดขึ้นเมื่อ snapshot engine พยายามเชื่อมต่อ database
- Connection timeout ตั้งไว้ที่ 10 วินาที แต่ยัง timeout
- Snapshot engine ทำงานทุก 3 วินาที และสร้าง load มากเกินไป

---

## ✅ การแก้ไข

### 1. เพิ่ม Retry Logic
- เพิ่ม retry mechanism (2 retries) ใน `fetchAndCacheGameSnapshot`
- Exponential backoff: 1s, 2s, 3s
- ตรวจสอบ pool health ก่อน query

### 2. เพิ่ม Timeout Protection
- เพิ่ม query timeout (5 seconds) เพื่อป้องกัน query ที่ค้าง
- ใช้ `Promise.race` เพื่อ enforce timeout
- ตรวจสอบ pool connection ก่อนใช้งาน

### 3. ลด Database Load
- **เพิ่ม interval จาก 3 วินาที เป็น 10 วินาที** (ลดความถี่)
- ลด batch size จาก 5 เป็น 3 (ลด concurrent queries)
- เพิ่ม delay ระหว่าง batches จาก 100ms เป็น 200ms

### 4. ปรับปรุง Error Handling
- ใช้ `Promise.allSettled` แทน `Promise.all` (ไม่หยุดเมื่อมี error)
- Log errors เฉพาะเมื่อจำเป็น (suppress frequent timeout errors)
- Track error frequency (log ครั้งเดียวต่อนาทีต่อ game)

### 5. เพิ่ม Health Check
- ตรวจสอบ pool health ก่อน fetch games list
- Skip cycle ถ้า pool ไม่พร้อม
- Graceful degradation (ไม่ crash เมื่อมี error)

---

## 📋 การเปลี่ยนแปลง

### `fetchAndCacheGameSnapshot()`
- ✅ เพิ่ม retry logic (2 retries)
- ✅ เพิ่ม pool health check
- ✅ เพิ่ม query timeout (5s)
- ✅ Error suppression (log ครั้งเดียวต่อนาที)

### `runSnapshotEngine()`
- ✅ เพิ่ม pool health check ก่อนเริ่ม
- ✅ ใช้ `Promise.allSettled` แทน `Promise.all`
- ✅ ลด batch size (5 → 3)
- ✅ เพิ่ม delay ระหว่าง batches (100ms → 200ms)
- ✅ Track success count

### `startSnapshotEngine()`
- ✅ เพิ่ม default interval (3s → 10s)
- ✅ เพิ่ม initial delay (5s) เพื่อให้ server start เสร็จก่อน
- ✅ Error handling ใน scheduler

---

## ⚙️ Environment Variables

```env
# Snapshot Engine Configuration
SNAPSHOT_INTERVAL=10000  # 10 seconds (default, increased from 3s)

# Database Connection (existing)
DB_CONNECTION_TIMEOUT=10000  # 10 seconds
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=5
```

---

## 🎯 ผลลัพธ์ที่คาดหวัง

1. ✅ **ลด Database Load**
   - Snapshot engine ทำงานช้าลง (10s แทน 3s)
   - ลด concurrent queries (batch size 3 แทน 5)
   - เพิ่ม delay ระหว่าง batches

2. ✅ **ลด Timeout Errors**
   - Retry mechanism ช่วยให้ recover จาก temporary failures
   - Health check ป้องกัน query เมื่อ pool ไม่พร้อม
   - Query timeout ป้องกัน query ที่ค้าง

3. ✅ **Better Error Handling**
   - ไม่ crash เมื่อมี timeout
   - Log เฉพาะเมื่อจำเป็น (ไม่ spam logs)
   - Graceful degradation

4. ✅ **Better Performance**
   - Pool health check ป้องกัน wasted queries
   - `Promise.allSettled` ไม่หยุดเมื่อมี error
   - Track success rate

---

## 📊 Monitoring

### Logs to Watch
- `[Snapshot] Processed X/Y games for {theme}` - Success rate
- `[Snapshot] Pool health check failed` - Pool issues
- `[Snapshot] Error fetching game` - Individual game errors (suppressed)

### Metrics
- Success rate per theme
- Timeout frequency
- Pool health status

---

## ✅ สรุป

**สถานะ:** ✅ **แก้ไขแล้ว**

**การเปลี่ยนแปลง:**
- เพิ่ม retry logic และ timeout protection
- ลด database load (interval, batch size, delays)
- ปรับปรุง error handling และ logging
- เพิ่ม health checks

**ผลลัพธ์:**
- ลด timeout errors
- ลด database load
- Better error handling
- Better performance

---

*Fixed! 🎉*

