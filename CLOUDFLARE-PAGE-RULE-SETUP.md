# ⚙️ คู่มือการตั้งค่า Cloudflare Page Rule สำหรับ Supabase Storage CDN

## 📋 ภาพรวม

คู่มือนี้จะอธิบายวิธีการตั้งค่า **Cloudflare Page Rule** เพื่อ cache รูปภาพจาก Supabase Storage

**หมายเหตุ:** 
- Page Rules **ช่วย cache** แต่**ไม่สามารถ rewrite URL** ได้
- ถ้าต้องการ rewrite URL (แปลง CDN URL เป็น Supabase URL) ต้องใช้ **Cloudflare Workers** (แนะนำ)

---

## 🎯 วิธีที่ 1: ใช้ Page Rules (สำหรับ Cache เท่านั้น)

### ขั้นตอนการตั้งค่า

1. เข้า **Cloudflare Dashboard** → เลือก domain `heng36.party`
2. ไปที่ **Rules** → **Page Rules** (หรือ **Cache Rules** ในแผนใหม่)
3. คลิก **Create rule** (หรือ **Create Page Rule**)

### ตั้งค่า Page Rule

#### URL Pattern
```
cdn.heng36.party/game-images/*
```

**หรือถ้าใช้ subdomain อื่น:**
```
img.heng36.party/game-images/*
```

#### Settings

1. **Cache Level**: `Cache Everything`
2. **Edge Cache TTL**: `1 month` (หรือ `1 year` สำหรับรูปภาพ)
3. **Browser Cache TTL**: `1 month`
4. **Cache Key**: `Include query string: No`

### ตัวอย่างการตั้งค่า

```
If the URL matches:
  cdn.heng36.party/game-images/*

Then the settings are:
  Cache Level: Cache Everything
  Edge Cache TTL: 1 month
  Browser Cache TTL: 1 month
```

---

## ⚠️ ข้อจำกัดของ Page Rules

**Page Rules ไม่สามารถ:**
- Rewrite URL path (เช่น `/game-images/xxx` → `/storage/v1/object/public/game-images/xxx`)
- เปลี่ยน request headers
- เปลี่ยน response headers

**ดังนั้น:**
- ถ้าใช้ Page Rules ต้องให้ Supabase Storage URL ตรงกับ CDN URL pattern
- หรือต้องใช้ **Cloudflare Workers** เพื่อ rewrite URL

---

## 🚀 วิธีที่ 2: ใช้ Cloudflare Workers (แนะนำ)

### ทำไมต้องใช้ Workers?

1. **URL Rewriting**: แปลง CDN URL เป็น Supabase URL
   - จาก: `cdn.heng36.party/game-images/heng36/games/image.jpg`
   - เป็น: `ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/heng36/games/image.jpg`

2. **Flexibility**: ควบคุม request/response ได้เต็มที่
3. **Better Performance**: Cache และ optimize ได้ดีกว่า

### ขั้นตอนการตั้งค่า Workers

ดูรายละเอียดใน `CLOUDFLARE-CDN-SETUP-GUIDE.md` ส่วน "5. ตั้งค่า Cloudflare Workers"

---

## 🔧 การแก้ไขตามรูปภาพที่แสดง

จากรูปภาพที่คุณแสดง:
- URL pattern: `img.heng36.party/game-images/*`
- Setting: `Cache Level: Cache Everything`

### ตัวเลือกที่ 1: ใช้ `img.heng36.party` (ตามรูป)

1. **แก้ไข `env.heng36`**:
   ```env
   VITE_CDN_DOMAIN_HENG36=img.heng36.party
   ```

2. **ตั้งค่า DNS CNAME**:
   - Name: `img`
   - Target: `ipflzfxezdzbmoqglknu.supabase.co`
   - Proxy: Proxied (ส้ม)

3. **ตั้งค่า Page Rule** (ตามรูป):
   - URL: `img.heng36.party/game-images/*`
   - Cache Level: Cache Everything

### ตัวเลือกที่ 2: ใช้ `cdn.heng36.party` (ตามที่ตั้งค่าไว้)

1. **แก้ไข Page Rule URL pattern**:
   ```
   cdn.heng36.party/game-images/*
   ```

2. **ตั้งค่า DNS CNAME**:
   - Name: `cdn`
   - Target: `ipflzfxezdzbmoqglknu.supabase.co`
   - Proxy: Proxied (ส้ม)

---

## ✅ Checklist สำหรับ Page Rules

- [ ] ตั้งค่า DNS CNAME สำหรับ subdomain (`cdn` หรือ `img`)
- [ ] เปิด Proxy (Proxied) ใน DNS
- [ ] สร้าง Page Rule
- [ ] ตั้งค่า URL pattern: `{subdomain}.heng36.party/game-images/*`
- [ ] ตั้งค่า Cache Level: Cache Everything
- [ ] ตั้งค่า Edge Cache TTL: 1 month (หรือ 1 year)
- [ ] ทดสอบว่า cache ทำงาน (ตรวจสอบ `CF-Cache-Status` header)

---

## 🎯 คำแนะนำ

### ถ้าใช้ Page Rules เท่านั้น:

1. **ต้องตั้งค่า Supabase Storage ให้ตรงกับ CDN URL pattern**
   - ตัวอย่าง: ถ้า CDN URL เป็น `cdn.heng36.party/game-images/xxx`
   - Supabase Storage path ต้องเป็น `/game-images/xxx` (ไม่ใช่ `/storage/v1/object/public/game-images/xxx`)

2. **หรือใช้ Supabase Storage public URL โดยตรง**
   - ไม่ต้อง rewrite URL
   - แค่ cache ผ่าน Cloudflare

### ถ้าใช้ Workers (แนะนำ):

1. **สามารถ rewrite URL ได้**
   - CDN URL: `cdn.heng36.party/game-images/xxx`
   - Supabase URL: `ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/xxx`

2. **ยืดหยุ่นกว่า**
   - ควบคุม cache headers ได้
   - เพิ่ม CORS headers ได้
   - Error handling ได้ดีกว่า

---

## 📝 สรุป

**จากรูปภาพที่คุณแสดง:**
- ✅ Setting ถูกต้อง: `Cache Level: Cache Everything`
- ⚠️ URL pattern ควรเป็น: `cdn.heng36.party/game-images/*` (ตามที่ตั้งค่าไว้)
- ⚠️ หรือถ้าต้องการใช้ `img.heng36.party` ต้องแก้ไข `env.heng36`

**แนะนำ:**
- ใช้ **Cloudflare Workers** สำหรับ URL rewriting (ดู `CLOUDFLARE-CDN-SETUP-GUIDE.md`)
- ใช้ **Page Rules** เพิ่มเติมสำหรับ cache optimization

