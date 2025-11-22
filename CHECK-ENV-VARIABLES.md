# 🔍 วิธีตรวจสอบ Environment Variables

## ❌ วิธีผิด (เกิด Error)

```javascript
// ❌ ใช้ใน Browser Console โดยตรง → Error!
console.log(import.meta.env.VITE_CDN_DOMAIN_HENG36)
// Error: Cannot use 'import.meta' outside a module
```

---

## ✅ วิธีที่ถูกต้อง

### วิธีที่ 1: ตรวจสอบผ่าน Code (แนะนำ)

**เพิ่ม debug code ใน `image-upload.ts` ชั่วคราว:**

1. เปิด `src/services/image-upload.ts`
2. เพิ่มบรรทัดนี้ในฟังก์ชัน `getCDNConfig()`:

```typescript
const getCDNConfig = () => {
  const theme = getCurrentTheme()
  const domain = import.meta.env[`VITE_CDN_DOMAIN_${theme.toUpperCase()}`] || 
                 import.meta.env.VITE_CDN_DOMAIN || 
                 `cdn.${import.meta.env.VITE_DOMAIN || 'heng36.party'}`
  const bucket = import.meta.env[`VITE_STORAGE_BUCKET_${theme.toUpperCase()}`] || 
                 import.meta.env.VITE_STORAGE_BUCKET || 
                 'game-images'
  
  // ✅ Debug: แสดงค่าใน Console
  console.log('🔍 CDN Config Debug:', {
    theme,
    envVar: `VITE_CDN_DOMAIN_${theme.toUpperCase()}`,
    domain,
    bucket,
    allEnv: {
      VITE_CDN_DOMAIN_HENG36: import.meta.env.VITE_CDN_DOMAIN_HENG36,
      VITE_CDN_DOMAIN: import.meta.env.VITE_CDN_DOMAIN,
      VITE_DOMAIN: import.meta.env.VITE_DOMAIN,
      MODE: import.meta.env.MODE
    }
  })
  
  return { domain, bucket }
}
```

3. เปิด Browser Console
4. อัปโหลดรูปภาพหรือเรียกใช้ฟังก์ชันที่ใช้ `getCDNConfig()`
5. ดู Console log

---

### วิธีที่ 2: ตรวจสอบผ่าน Network Tab

**ตรวจสอบว่า URL ที่ใช้ถูกต้อง:**

1. เปิด Browser DevTools → **Network** tab
2. อัปโหลดรูปภาพ
3. ดู Request URL:
   - ✅ ถูกต้อง: `https://img.heng36.party/game-images/...`
   - ❌ ผิด: `https://cdn.heng36.party/game-images/...`

---

### วิธีที่ 3: ตรวจสอบผ่าน React Component

**เพิ่ม debug component ชั่วคราว:**

1. สร้างไฟล์ `src/components/DebugEnv.tsx`:

```typescript
import React from 'react'

export default function DebugEnv() {
  const theme = 'heng36' // หรือใช้ useTheme() hook
  const domain = import.meta.env[`VITE_CDN_DOMAIN_${theme.toUpperCase()}`] || 
                 import.meta.env.VITE_CDN_DOMAIN || 
                 `cdn.${import.meta.env.VITE_DOMAIN || 'heng36.party'}`
  
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', margin: '20px' }}>
      <h3>🔍 Environment Variables Debug</h3>
      <pre>
        {JSON.stringify({
          theme,
          domain,
          VITE_CDN_DOMAIN_HENG36: import.meta.env.VITE_CDN_DOMAIN_HENG36,
          VITE_CDN_DOMAIN: import.meta.env.VITE_CDN_DOMAIN,
          VITE_DOMAIN: import.meta.env.VITE_DOMAIN,
          MODE: import.meta.env.MODE
        }, null, 2)}
      </pre>
    </div>
  )
}
```

2. เพิ่มใน `App.tsx` หรือ `Home.tsx` ชั่วคราว:

```typescript
import DebugEnv from './components/DebugEnv'

// ใน component
{process.env.NODE_ENV === 'development' && <DebugEnv />}
```

---

### วิธีที่ 4: ตรวจสอบผ่าน Console (ใช้ window object)

**สร้าง global function สำหรับ debug:**

1. เพิ่มใน `src/main.tsx` หรือ `src/App.tsx`:

```typescript
// ใน development mode เท่านั้น
if (import.meta.env.DEV) {
  (window as any).debugEnv = () => {
    return {
      theme: 'heng36',
      domain: import.meta.env.VITE_CDN_DOMAIN_HENG36 || import.meta.env.VITE_CDN_DOMAIN,
      bucket: import.meta.env.VITE_STORAGE_BUCKET_HENG36 || import.meta.env.VITE_STORAGE_BUCKET,
      MODE: import.meta.env.MODE,
      all: {
        VITE_CDN_DOMAIN_HENG36: import.meta.env.VITE_CDN_DOMAIN_HENG36,
        VITE_CDN_DOMAIN: import.meta.env.VITE_CDN_DOMAIN,
        VITE_DOMAIN: import.meta.env.VITE_DOMAIN,
      }
    }
  }
}
```

2. ใช้ใน Browser Console:

```javascript
// ✅ ใช้ได้ใน Browser Console
debugEnv()
```

---

## 🔍 วิธีตรวจสอบที่ง่ายที่สุด

**ตรวจสอบ URL ที่ใช้จริง:**

1. เปิด Browser DevTools → **Console**
2. อัปโหลดรูปภาพ
3. ดู Console log:
   ```
   Image uploaded successfully: {
     storagePath: '...',
     supabaseUrl: '...',
     cdnUrl: 'https://img.heng36.party/...'  ✅ ถูกต้อง
   }
   ```

**ถ้าเห็น:**
- ✅ `img.heng36.party` → Environment variable ถูกโหลดแล้ว
- ❌ `cdn.heng36.party` → Environment variable ไม่ได้ถูกโหลด

---

## ✅ Checklist

- [ ] Restart dev server (สำคัญมาก!)
- [ ] ตรวจสอบ Console log เมื่ออัปโหลดรูปภาพ
- [ ] ตรวจสอบ Network tab ดู URL ที่ใช้
- [ ] ตรวจสอบ `env.heng36` มี `VITE_CDN_DOMAIN_HENG36=img.heng36.party`

---

## 🎯 สรุป

**Error:** `Cannot use 'import.meta' outside a module`

**สาเหตุ:** พยายามใช้ `import.meta.env` ใน Browser Console โดยตรง

**วิธีแก้:** ใช้วิธีที่ 1-4 ข้างต้น (แนะนำวิธีที่ 1 หรือ 2)

---

**ต้องการความช่วยเหลือเพิ่มเติมไหม?**

