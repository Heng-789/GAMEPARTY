# 🔍 Debug: Environment Variable ไม่ได้ถูกโหลด

## ❌ ปัญหา

ใช้ `npm run dev:heng36` แล้ว แต่ยังใช้ `cdn.heng36.party` อยู่

---

## ✅ วิธีตรวจสอบ

### ขั้นตอนที่ 1: ตรวจสอบ Console Log

**หลังจาก restart dev server:**

1. เปิด Browser Console (F12)
2. อัปโหลดรูปภาพ
3. ดู Console log:
   ```
   🔍 CDN Config: {
     theme: 'heng36',
     domain: 'img.heng36.party',  ✅ ถูกต้อง
     envVar: 'VITE_CDN_DOMAIN_HENG36',
     envValue: 'img.heng36.party',  ✅ ถูกต้อง
     ...
   }
   ```

**ถ้าเห็น:**
- ✅ `domain: 'img.heng36.party'` → Environment variable ถูกโหลดแล้ว
- ❌ `domain: 'cdn.heng36.party'` → Environment variable ไม่ได้ถูกโหลด

---

### ขั้นตอนที่ 2: ตรวจสอบว่าไฟล์ env.heng36 ถูกโหลด

**ตรวจสอบว่า Vite โหลดไฟล์ถูกต้อง:**

1. ดู Terminal ที่รัน `npm run dev:heng36`
2. ควรเห็น log:
   ```
   VITE v7.x.x  ready in xxx ms
   ➜  Local:   http://localhost:5173/
   ➜  Mode:    heng36  ✅ ต้องเห็น Mode: heng36
   ```

**ถ้าไม่เห็น `Mode: heng36`:**
- ❌ Vite ไม่ได้โหลด mode ถูกต้อง

---

### ขั้นตอนที่ 3: Clear Browser Cache

**Browser อาจ cache URL เก่าไว้:**

1. กด `Ctrl + Shift + Delete` (Windows) หรือ `Cmd + Shift + Delete` (Mac)
2. เลือก **Cached images and files**
3. คลิก **Clear data**
4. Refresh หน้าเว็บ (`Ctrl + F5` หรือ `Cmd + Shift + R`)

---

### ขั้นตอนที่ 4: ตรวจสอบไฟล์ env.heng36

**ตรวจสอบว่าไฟล์มีค่าถูกต้อง:**

1. เปิด `env.heng36`
2. ตรวจสอบว่า:
   ```env
   VITE_CDN_DOMAIN_HENG36=img.heng36.party
   VITE_STORAGE_BUCKET_HENG36=game-images
   ```

**ถ้ายังไม่มี:**
- เพิ่มบรรทัดเหล่านี้

---

### ขั้นตอนที่ 5: Hard Restart Dev Server

**Restart แบบ hard:**

1. **ปิด dev server:** `Ctrl + C`
2. **ปิด Terminal/Command Prompt**
3. **เปิด Terminal ใหม่**
4. **cd ไปที่ project directory**
5. **รัน:** `npm run dev:heng36`
6. **รอให้ compile เสร็จ**
7. **เปิด Browser ใหม่ (ไม่ใช่แค่ refresh)**
8. **ทดสอบอัปโหลดรูปภาพ**

---

## 🔍 Debug Code เพิ่มเติม

**ถ้ายังไม่เห็น log ให้เพิ่ม debug code:**

1. เปิด `src/services/image-upload.ts`
2. เพิ่มบรรทัดนี้ที่บรรทัดแรกของ `getCDNConfig()`:

```typescript
const getCDNConfig = () => {
  // ✅ Debug: แสดง environment variables ทั้งหมด
  console.log('🔍 All Env Vars:', {
    MODE: import.meta.env.MODE,
    VITE_CDN_DOMAIN_HENG36: import.meta.env.VITE_CDN_DOMAIN_HENG36,
    VITE_CDN_DOMAIN: import.meta.env.VITE_CDN_DOMAIN,
    VITE_DOMAIN: import.meta.env.VITE_DOMAIN,
    VITE_STORAGE_BUCKET_HENG36: import.meta.env.VITE_STORAGE_BUCKET_HENG36,
  })
  
  const theme = getCurrentTheme()
  // ... rest of code
}
```

3. Restart dev server
4. ดู Console log

---

## ⚠️ ถ้ายังใช้ cdn.heng36.party อยู่

**อาจเป็นเพราะ:**

1. **Browser cache** → Clear cache และ hard refresh
2. **Service Worker cache** → Unregister service worker
3. **Environment variable ไม่ได้ถูกโหลด** → ตรวจสอบ Console log

---

## ✅ Checklist

- [ ] ใช้ `npm run dev:heng36` (ไม่ใช่ `npm run dev`)
- [ ] ตรวจสอบ Terminal log ว่าเห็น `Mode: heng36`
- [ ] ตรวจสอบ Console log ว่า domain เป็น `img.heng36.party`
- [ ] Clear browser cache
- [ ] Hard restart dev server
- [ ] เปิด Browser ใหม่ (ไม่ใช่แค่ refresh)

---

## 🎯 สรุป

**ถ้าใช้ `npm run dev:heng36` แล้วยังใช้ `cdn.heng36.party`:**
1. ตรวจสอบ Console log ว่า domain เป็นอะไร
2. Clear browser cache
3. Hard restart dev server
4. เปิด Browser ใหม่

---

**บอกผล Console log ที่เห็นมาได้ไหมครับ?**

