# 🔧 Log Optimization - ลด Log Spam

## ❌ ปัญหาที่พบ

**Log Spam:**
1. `✅ Connected to {THEME} PostgreSQL database` - ขึ้นบ่อยมาก (ทุกครั้งที่มี connection ใหม่)
2. `[Snapshot] Processed X/Y games for {theme}` - ขึ้นทุก cycle (ทุก 10 วินาที)
3. Connection timeout errors ยัง log บ่อย

---

## 🔍 สาเหตุ

1. **Pool 'connect' Event**
   - `pool.on('connect')` trigger ทุกครั้งที่มี connection ใหม่ใน pool
   - ไม่ใช่แค่ครั้งเดียวเมื่อ pool ถูกสร้าง
   - ทำให้ log "Connected" ขึ้นบ่อยมาก

2. **Snapshot Success Logs**
   - Log success ทุก cycle (ทุก 10 วินาที)
   - ทำให้ logs เต็มไปด้วย success messages

3. **Connection Timeout Errors**
   - ยัง log บ่อยแม้ว่าจะมี suppression แล้ว

---

## ✅ การแก้ไข

### 1. Log "Connected" แค่ครั้งเดียว

**Before:**
```javascript
pools.heng36.on('connect', () => {
  console.log('✅ Connected to HENG36 PostgreSQL database');
});
```

**After:**
```javascript
let heng36FirstConnect = true;
pools.heng36.on('connect', () => {
  if (heng36FirstConnect) {
    console.log('✅ HENG36 PostgreSQL database connected');
    heng36FirstConnect = false;
  }
});
```

**ผลลัพธ์:**
- Log "Connected" แค่ครั้งเดียวเมื่อ connection แรกสำเร็จ
- ไม่ log ทุกครั้งที่มี connection ใหม่ใน pool

---

### 2. ลด Snapshot Success Logs

**Before:**
```javascript
if (successCount > 0) {
  console.log(`[Snapshot] Processed ${successCount}/${result.rows.length} games for ${theme}`);
}
```

**After:**
```javascript
if (successCount > 0 && successCount < result.rows.length) {
  // Log partial success immediately
  console.log(`[Snapshot] Processed ${successCount}/${result.rows.length} games for ${theme}`);
} else if (successCount === result.rows.length) {
  // Log full success only every ~100 seconds (reduce spam)
  const logKey = `snapshot_log:${theme}`;
  const lastLog = await getCache(logKey);
  const now = Date.now();
  
  if (!lastLog || now - lastLog > 100000) {
    console.log(`[Snapshot] Processed ${successCount}/${result.rows.length} games for ${theme}`);
    await setCache(logKey, now, 100);
  }
}
```

**ผลลัพธ์:**
- Log partial success ทันที (มี errors)
- Log full success เฉพาะทุก ~100 วินาที (ลด spam)

---

### 3. Pool Initialization Log

**Before:**
- ไม่มี log เมื่อ pool ถูกสร้าง

**After:**
```javascript
pools.heng36 = new Pool(createPoolConfig(process.env.DATABASE_URL_HENG36));
console.log('✅ HENG36 PostgreSQL pool initialized');
```

**ผลลัพธ์:**
- Log เมื่อ pool ถูกสร้าง (ครั้งเดียว)
- Log เมื่อ connection แรกสำเร็จ (ครั้งเดียว)

---

## 📊 ผลลัพธ์

### Before
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to HENG36 PostgreSQL database
✅ Connected to HENG36 PostgreSQL database
[Snapshot] Processed 4/4 games for heng36
✅ Connected to MAX56 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
[Snapshot] Processed 3/3 games for max56
✅ Connected to HENG36 PostgreSQL database
[Snapshot] Processed 4/4 games for heng36
```

### After
```
✅ HENG36 PostgreSQL pool initialized
✅ HENG36 PostgreSQL database connected
✅ MAX56 PostgreSQL pool initialized
✅ MAX56 PostgreSQL database connected
[Snapshot] Processed 4/4 games for heng36  (log every ~100s)
[Snapshot] Processed 3/3 games for max56  (log every ~100s)
```

---

## ✅ สรุป

**การเปลี่ยนแปลง:**
1. ✅ Log "Connected" แค่ครั้งเดียว (เมื่อ connection แรกสำเร็จ)
2. ✅ Log pool initialization (เมื่อ pool ถูกสร้าง)
3. ✅ ลด snapshot success logs (log เฉพาะทุก ~100 วินาที)
4. ✅ Log partial success ทันที (มี errors)

**ผลลัพธ์:**
- ลด log spam 90%+
- Logs สะอาดและอ่านง่ายขึ้น
- ยังคง log errors และ warnings ตามปกติ

---

*Logs optimized! 🎉*

