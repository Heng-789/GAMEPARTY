# 🔧 แก้ไข Error: DNS_PROBE_FINISHED_NXDOMAIN (cdn.heng36.party)

## ❌ ปัญหา

Error: `DNS_PROBE_FINISHED_NXDOMAIN` สำหรับ `cdn.heng36.party`

**สาเหตุ:**
- ระบบใช้ `cdn.heng36.party` แทน `img.heng36.party`
- Environment variable `VITE_CDN_DOMAIN_HENG36` ไม่ได้ถูกโหลด
- Fallback ใช้ `cdn.heng36.party` (ซึ่งไม่มี DNS record)

---

## ✅ วิธีแก้ไข

### ขั้นตอนที่ 1: Restart Dev Server (สำคัญมาก!)

**Environment variables จะถูกโหลดเมื่อเริ่ม dev server เท่านั้น**

1. **ปิด dev server:**
   - กด `Ctrl + C` ใน terminal ที่รัน dev server

2. **เปิด dev server ใหม่:**
   ```bash
   npm run dev
   ```

3. **ตรวจสอบ Console log:**
   - ควรเห็นว่า environment variables ถูกโหลดแล้ว

---

### ขั้นตอนที่ 2: ตรวจสอบ Environment Variable

**ตรวจสอบว่า `VITE_CDN_DOMAIN_HENG36` ถูกโหลด:**

1. เปิด Browser DevTools → **Console**
2. พิมพ์:
   ```javascript
   console.log('CDN Domain:', import.meta.env.VITE_CDN_DOMAIN_HENG36)
   ```
3. **ควรได้:** `img.heng36.party`
4. **ถ้าได้:** `undefined` → Environment variable ไม่ได้ถูกโหลด

---

### ขั้นตอนที่ 3: ตรวจสอบไฟล์ env.heng36

**ตรวจสอบว่าไฟล์ `env.heng36` มีค่า:**

```env
VITE_CDN_DOMAIN_HENG36=img.heng36.party
VITE_STORAGE_BUCKET_HENG36=game-images
```

**ถ้ายังไม่มี:**
1. สร้างไฟล์ `env.heng36` ใน root directory
2. เพิ่มบรรทัด:
   ```
   VITE_CDN_DOMAIN_HENG36=img.heng36.party
   VITE_STORAGE_BUCKET_HENG36=game-images
   ```
3. Restart dev server

---

### ขั้นตอนที่ 4: ตรวจสอบว่าใช้ Mode ถูกต้อง

**Vite จะโหลด env file ตาม MODE:**

- `npm run dev` → โหลด `.env.heng36` (ถ้า MODE=heng36)
- `npm run dev:heng36` → โหลด `.env.heng36`

**ตรวจสอบ package.json:**
```json
{
  "scripts": {
    "dev": "vite --mode heng36",
    "dev:heng36": "vite --mode heng36"
  }
}
```

---

## 🔍 Debug Steps

### 1. ตรวจสอบ Environment Variables

```javascript
// ใน Browser Console
console.log('All env vars:', {
  CDN_DOMAIN: import.meta.env.VITE_CDN_DOMAIN_HENG36,
  STORAGE_BUCKET: import.meta.env.VITE_STORAGE_BUCKET_HENG36,
  MODE: import.meta.env.MODE
})
```

### 2. ตรวจสอบ CDN Config

```javascript
// ใน Browser Console
import { getCDNConfig } from './src/services/image-upload'
const config = getCDNConfig()
console.log('CDN Config:', config)
// ควรได้: { domain: 'img.heng36.party', bucket: 'game-images' }
```

### 3. ตรวจสอบ DNS

```powershell
nslookup img.heng36.party
```

**ควรได้:**
```
img.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co
```

---

## ⚠️ ถ้ายังใช้ cdn.heng36.party อยู่

### วิธีแก้ไขชั่วคราว (ไม่แนะนำ):

แก้ไข `image-upload.ts` ให้ใช้ `img.heng36.party` โดยตรง:

```typescript
const getCDNConfig = () => {
  const theme = getCurrentTheme()
  const domain = 'img.heng36.party' // ใช้โดยตรง
  const bucket = 'game-images'
  
  return { domain, bucket }
}
```

**แต่แนะนำให้แก้ไขที่ root cause (env variable ไม่ได้ถูกโหลด)**

---

## ✅ Checklist

- [ ] Restart dev server (สำคัญมาก!)
- [ ] ตรวจสอบ `env.heng36` มี `VITE_CDN_DOMAIN_HENG36=img.heng36.party`
- [ ] ตรวจสอบ environment variable ถูกโหลด (Browser Console)
- [ ] ตรวจสอบ DNS: `nslookup img.heng36.party`
- [ ] ทดสอบอัปโหลดรูปภาพใหม่

---

## 🎯 สรุป

**สาเหตุหลัก:** Environment variable ไม่ได้ถูกโหลด → ใช้ fallback `cdn.heng36.party`

**วิธีแก้:** Restart dev server เพื่อโหลด environment variables ใหม่

**เวลาที่ใช้:** ~2 นาที

---

**ต้องการความช่วยเหลือเพิ่มเติมไหม?**

