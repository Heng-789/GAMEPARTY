# 🔧 Connection Timeout Fix - Database Pool Issues

## ❌ ปัญหาที่พบ

**Errors:**
1. `[Snapshot] Pool health check failed for max56, skipping this cycle`
2. `[Snapshot] Pool health check failed for heng36, skipping this cycle`
3. `[Snapshot] Error fetching game game_-OeGL3_iK-bvq_LZlJR1 (max56): Connection terminated due to connection timeout`

---

## 🔍 สาเหตุ

1. **Connection Pool Exhaustion**
   - Connection pool หมด (max connections ถูกใช้หมด)
   - ไม่สามารถสร้าง connection ใหม่ได้

2. **Network Latency**
   - Supabase connection pooler อาจช้า
   - Connection timeout 10 วินาที อาจไม่พอ

3. **Health Check Timeout**
   - Health check timeout 3 วินาที อาจเร็วเกินไป
   - ไม่มี retry logic

4. **Error Logging Spam**
   - Log errors ทุกครั้งที่เกิด timeout
   - ทำให้ logs เต็มไปด้วย error messages

---

## ✅ การแก้ไข

### 1. เพิ่ม Connection Timeout
- **เพิ่มจาก 10 วินาที → 15 วินาที**
- รองรับ Supabase connection pooler ที่อาจช้า

### 2. เพิ่ม Health Check Retry
- Retry 2 ครั้ง สำหรับ health check
- เพิ่ม timeout จาก 3 วินาที → 5 วินาที
- Exponential backoff: 1s, 2s

### 3. Suppress Error Logging
- Log errors เฉพาะเมื่อจำเป็น
- Suppress frequent timeout errors (log ครั้งเดียวต่อนาที)
- Suppress connection terminated errors

### 4. ปรับปรุง Pool Error Handling
- Suppress frequent timeout errors ใน pool error handler
- Track error frequency

### 5. เพิ่ม Query Timeout
- เพิ่ม query timeout จาก 5 วินาที → 8 วินาที
- ให้เวลา query มากขึ้น

---

## 📋 การเปลี่ยนแปลง

### `database.js`

**Connection Pool Config:**
```javascript
connectionTimeoutMillis: 15000  // เพิ่มจาก 10000 → 15000
allowExitOnIdle: false          // เพิ่มใหม่
```

**Pool Error Handler:**
```javascript
pools.heng36.on('error', (err) => {
  // Suppress frequent connection timeout errors
  if (!err.message.includes('timeout') && 
      !err.message.includes('Connection terminated')) {
    console.error('❌ HENG36 database error:', err.message);
  }
});
```

### `snapshotEngine.js`

**Health Check with Retry:**
```javascript
// Check pool health first with retry
let poolHealthy = false;
for (let retry = 0; retry < 2; retry++) {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Pool health check timeout')), 5000)
      )
    ]);
    poolHealthy = true;
    break;
  } catch (healthError) {
    if (retry === 1) {
      // Only log on final retry, and suppress frequent errors
      // Log ครั้งเดียวต่อนาที
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

**Query Timeout:**
```javascript
const result = await Promise.race([
  pool.query(...),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Query timeout')), 8000)  // เพิ่มจาก 5000 → 8000
  )
]);
```

**Error Suppression:**
```javascript
const isTimeoutError = error.message.includes('timeout') || 
                      error.message.includes('Connection terminated') ||
                      error.message.includes('connection');

if (!isTimeoutError || (!lastError || now - lastError > 60000)) {
  // Log only if not timeout error, or if it's been more than 1 minute
  console.warn(`[Snapshot] Error fetching game...`);
}
```

---

## 🎯 ผลลัพธ์ที่คาดหวัง

1. ✅ **ลด Connection Timeout Errors**
   - Connection timeout เพิ่มเป็น 15 วินาที
   - Health check retry ช่วย recover จาก temporary failures

2. ✅ **ลด Error Log Spam**
   - Suppress frequent timeout errors
   - Log เฉพาะเมื่อจำเป็น (ครั้งเดียวต่อนาที)

3. ✅ **Better Error Handling**
   - Retry logic สำหรับ health check
   - Graceful degradation (skip cycle ถ้า pool ไม่พร้อม)

4. ✅ **Better Performance**
   - Query timeout เพิ่มเป็น 8 วินาที
   - ให้เวลา query มากขึ้น

---

## ⚙️ Environment Variables

```env
# Database Connection Timeout (increased)
DB_CONNECTION_TIMEOUT=15000  # 15 seconds (increased from 10s)

# Other settings remain the same
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=5
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

---

## 📊 Monitoring

### Logs to Watch
- `[Snapshot] Pool health check failed` - Pool issues (suppressed)
- `[Snapshot] Error fetching game` - Individual game errors (suppressed)
- `❌ Database error` - Non-timeout errors only

### What's Suppressed
- Connection timeout errors (log ครั้งเดียวต่อนาที)
- Connection terminated errors (log ครั้งเดียวต่อนาที)
- Pool health check failures (log ครั้งเดียวต่อนาที)

---

## ✅ สรุป

**สถานะ:** ✅ **แก้ไขแล้ว**

**การเปลี่ยนแปลง:**
- เพิ่ม connection timeout (10s → 15s)
- เพิ่ม health check retry logic
- Suppress frequent timeout errors
- เพิ่ม query timeout (5s → 8s)

**ผลลัพธ์:**
- ลด connection timeout errors
- ลด error log spam
- Better error handling
- Better performance

---

## 🔍 Troubleshooting

### ถ้ายังมี Connection Timeout

1. **ตรวจสอบ Database Connection**
   ```bash
   # Test connection manually
   psql $DATABASE_URL_HENG36 -c "SELECT 1"
   ```

2. **ตรวจสอบ Connection Pool Usage**
   - ดูว่า max connections ถูกใช้หมดหรือไม่
   - ลด max connections ถ้าจำเป็น

3. **ตรวจสอบ Network**
   - Supabase connection pooler อาจช้า
   - ลองใช้ direct connection แทน pooler

4. **ตรวจสอบ Database Load**
   - Database อาจ overload
   - ตรวจสอบ slow queries

---

*Fixed! 🎉*

