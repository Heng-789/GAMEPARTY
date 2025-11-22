# 🔧 คู่มือการตั้งค่า Environment Variables สำหรับ Backend

## 📋 วิธีสร้างไฟล์ `.env`

### วิธีที่ 1: ใช้สคริปต์ (แนะนำสำหรับ Windows)

```bash
# จาก root directory
backend\create-env-with-supabase.bat
```

### วิธีที่ 2: สร้างด้วยมือ

1. สร้างไฟล์ `backend/.env`
2. คัดลอกเนื้อหาด้านล่างไปใส่ในไฟล์

---

## 📝 เนื้อหาที่ต้องใส่ใน `backend/.env`

```env
# Backend Environment Variables
# PostgreSQL Database Connections

# HENG36 Database
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# MAX56 Database
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# JEED24 Database
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# Server Configuration
PORT=3000

# Optional: Database Pool Configuration
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# ============================================
# Supabase Storage Configuration (สำหรับลบรูปภาพ)
# ============================================

# HENG36 Supabase Storage
SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET_HENG36=game-images

# MAX56 Supabase Storage
SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
VITE_STORAGE_BUCKET_MAX56=game-images

# JEED24 Supabase Storage
SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
VITE_STORAGE_BUCKET_JEED24=game-images

# Fallback (if theme-specific keys are not found)
SUPABASE_URL=https://ipflzfxezdzbmoqglknu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET=game-images
```

---

## ✅ ตรวจสอบการตั้งค่า

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
- ✅ ไม่ควรเห็น error: `Supabase credentials not found for theme: ...`
- ✅ ควรเห็น logs เมื่อลบเกม: `[heng36] Deleting X image(s) from storage for game ...`

---

## 🧪 ทดสอบการลบรูปภาพ

1. **สร้างเกมที่มีรูปภาพ**
   - สร้างเกมใหม่และอัปโหลดรูปภาพ
   - ตรวจสอบว่ารูปภาพถูกอัปโหลดไปที่ Supabase Storage

2. **ลบเกม**
   - ลบเกมจากหน้า Home หรือ CreateGame

3. **ตรวจสอบ Backend Logs**
   ```
   [heng36] Deleting 2 image(s) from storage for game game123
   [heng36] Deleting image from storage: {
     bucket: 'game-images',
     storagePath: 'heng36/games/123.jpg',
     originalUrl: 'https://img.heng36.party/game-images/heng36/games/123.jpg'
   }
   [heng36] Successfully deleted image: heng36/games/123.jpg
   [heng36] Successfully deleted all 2 image(s) from storage.
   ```

4. **ตรวจสอบใน Supabase Dashboard**
   - เข้า Supabase Dashboard → Storage → Buckets → `game-images`
   - ตรวจสอบว่าไฟล์ถูกลบแล้ว

---

## 📊 Environment Variables ที่ตั้งค่า

### ✅ PostgreSQL Database URLs
- `DATABASE_URL_HENG36`
- `DATABASE_URL_MAX56`
- `DATABASE_URL_JEED24`

### ✅ Supabase Storage (สำหรับลบรูปภาพ)
- `SUPABASE_URL_HENG36` / `SUPABASE_ANON_KEY_HENG36` / `VITE_STORAGE_BUCKET_HENG36`
- `SUPABASE_URL_MAX56` / `SUPABASE_ANON_KEY_MAX56` / `VITE_STORAGE_BUCKET_MAX56`
- `SUPABASE_URL_JEED24` / `SUPABASE_ANON_KEY_JEED24` / `VITE_STORAGE_BUCKET_JEED24`

### ✅ Fallback
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `VITE_STORAGE_BUCKET`

---

## ⚠️ หมายเหตุ

- ✅ Supabase credentials ถูกคัดลอกจาก frontend env files (`env.heng36`, `env.max56`, `env.jeed24`)
- ✅ Storage bucket ตั้งค่าเป็น `game-images` สำหรับทุก theme
- ✅ มี fallback credentials สำหรับกรณีที่ theme-specific keys ไม่พบ
- ⚠️ ต้องแก้ไข `DATABASE_URL_JEED24` password ถ้ายังไม่ได้ตั้งค่า

---

## 🔧 ถ้าต้องการแก้ไข

แก้ไขไฟล์ `backend/.env` โดยตรง:

```bash
cd backend
notepad .env    # Windows
# หรือ
nano .env       # Linux/Mac
```

**📌 หมายเหตุ:** หลังจากแก้ไข `.env` ต้อง restart backend server

