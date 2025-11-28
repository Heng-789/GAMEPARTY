# CDN Setup Guide

## ปัญหา: URL ที่ได้ไม่ใช่ CDN URL แต่เป็น Supabase URL

เมื่ออัปโหลดรูปภาพใน production แล้วได้ URL แบบนี้:
```
https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/heng36/backgrounds/xxx.png
```

แทนที่จะเป็น CDN URL:
```
https://img.heng36.party/game-images/heng36/backgrounds/xxx.png
```

## สาเหตุ

Environment variables สำหรับ CDN ไม่ได้ถูกตั้งค่าใน production (Netlify)

## วิธีแก้ไข

### 1. ตั้งค่า Environment Variables ใน Netlify

1. เข้า Netlify Dashboard
2. ไปที่ **Site settings** → **Environment variables**
3. เพิ่ม environment variables ตามธีมที่ใช้:

#### สำหรับ HENG36:
```
VITE_CDN_DOMAIN_HENG36=img.heng36.party
VITE_STORAGE_BUCKET_HENG36=game-images
```

#### สำหรับ MAX56:
```
VITE_CDN_DOMAIN_MAX56=img.max56.party
VITE_STORAGE_BUCKET_MAX56=game-images
```

#### สำหรับ JEED24:
```
VITE_CDN_DOMAIN_JEED24=img.jeed24.party
VITE_STORAGE_BUCKET_JEED24=game-images
```

### 2. หรือตั้งค่าใน netlify.toml

เพิ่มใน `netlify.toml`:

```toml
[build.environment]
  NODE_VERSION = "18"
  # CDN Configuration for HENG36
  VITE_CDN_DOMAIN_HENG36 = "img.heng36.party"
  VITE_STORAGE_BUCKET_HENG36 = "game-images"
  # CDN Configuration for MAX56
  VITE_CDN_DOMAIN_MAX56 = "img.max56.party"
  VITE_STORAGE_BUCKET_MAX56 = "game-images"
  # CDN Configuration for JEED24
  VITE_CDN_DOMAIN_JEED24 = "img.jeed24.party"
  VITE_STORAGE_BUCKET_JEED24 = "game-images"
```

### 3. Redeploy

หลังจากตั้งค่า environment variables แล้ว:
1. ไปที่ **Deploys** ใน Netlify Dashboard
2. คลิก **Trigger deploy** → **Deploy site**
3. หรือ push code ใหม่เพื่อ trigger auto-deploy

## ตรวจสอบว่า CDN ทำงาน

1. เปิด Browser Console (F12)
2. ดู log ที่ขึ้นว่า:
   - `[CDN Config]` - แสดงการตั้งค่า CDN
   - ถ้ามี `⚠️ CDN domain not configured` แสดงว่ายังไม่ได้ตั้งค่า
3. ตรวจสอบ URL ที่ได้หลังอัปโหลด:
   - ✅ ควรเป็น: `https://img.heng36.party/...`
   - ❌ ไม่ควรเป็น: `https://...supabase.co/...`

## หมายเหตุ

- Environment variables ที่ขึ้นต้นด้วย `VITE_` จะถูก bundle เข้าไปใน client-side code
- ต้อง rebuild/redeploy หลังจากเปลี่ยน environment variables
- CDN domain ต้องชี้ไปที่ Supabase Storage หรือ Cloudflare Worker ที่ตั้งค่าไว้

