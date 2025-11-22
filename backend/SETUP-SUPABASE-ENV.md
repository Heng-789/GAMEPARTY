# 🔧 ตั้งค่า Supabase Environment Variables สำหรับ Backend

## ✅ สิ่งที่ทำเสร็จแล้ว

ไฟล์ `backend/.env` ถูกสร้างแล้วพร้อม Supabase credentials สำหรับทุก theme

---

## 📋 Environment Variables ที่ตั้งค่าแล้ว

### HENG36 Theme
```env
SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET_HENG36=game-images
```

### MAX56 Theme
```env
SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
VITE_STORAGE_BUCKET_MAX56=game-images
```

### JEED24 Theme
```env
SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
VITE_STORAGE_BUCKET_JEED24=game-images
```

---

## 🔍 ตรวจสอบการตั้งค่า

### 1. ตรวจสอบว่าไฟล์ `.env` มีอยู่

```bash
cd backend
dir .env    # Windows
# หรือ
ls -la .env # Linux/Mac
```

### 2. ตรวจสอบว่า Environment Variables ถูกโหลด

รัน backend server:
```bash
cd backend
npm run dev
```

ตรวจสอบ logs:
- ไม่ควรเห็น error: `Supabase credentials not found for theme: ...`
- ควรเห็น logs เมื่อลบเกม: `[heng36] Deleting X image(s) from storage for game ...`

---

## 🧪 ทดสอบการลบรูปภาพ

1. สร้างเกมที่มีรูปภาพ
2. ตรวจสอบว่ารูปภาพถูกอัปโหลดไปที่ Supabase Storage
3. ลบเกม
4. ตรวจสอบ backend logs:
   ```
   [heng36] Deleting 2 image(s) from storage for game game123
   [heng36] Deleting image from storage: { bucket: 'game-images', storagePath: '...', originalUrl: '...' }
   [heng36] Successfully deleted image: heng36/games/123.jpg
   [heng36] Successfully deleted all 2 image(s) from storage.
   ```
5. ตรวจสอบใน Supabase Dashboard ว่าไฟล์ถูกลบแล้ว

---

## ⚠️ หมายเหตุ

- ✅ ไฟล์ `.env` ถูกสร้างแล้วใน `backend/.env`
- ✅ Supabase credentials ถูกคัดลอกจาก frontend env files
- ✅ Storage bucket ตั้งค่าเป็น `game-images` สำหรับทุก theme
- ✅ มี fallback credentials สำหรับกรณีที่ theme-specific keys ไม่พบ

---

## 🔧 ถ้าต้องการแก้ไข

แก้ไขไฟล์ `backend/.env` โดยตรง:

```bash
cd backend
notepad .env    # Windows
# หรือ
nano .env       # Linux/Mac
```

---

**📌 หมายเหตุ:** หลังจากแก้ไข `.env` ต้อง restart backend server

