# 🚀 คู่มือการ Deploy Backend ที่ Render

## 📋 สรุป

**ไม่ต้องแยก backend** - ใช้ backend เดียวรองรับ 3 ธีม (HENG36, MAX56, JEED24) ได้

Backend มี:
- ✅ Theme Middleware ที่ดึง theme จาก query/header/hostname
- ✅ Connection pools แยกสำหรับแต่ละ theme
- ✅ Schema separation สำหรับแต่ละ theme

---

## 🎯 ขั้นตอนการ Deploy ที่ Render

### 1. เตรียม Repository

1. **Push code ขึ้น GitHub/GitLab**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **ตรวจสอบว่า backend folder อยู่ใน repo**
   - ต้องมี `backend/` folder
   - ต้องมี `backend/package.json`
   - ต้องมี `backend/src/index.js`

---

### 2. สร้าง Web Service ที่ Render

1. **เข้า Render Dashboard**
   - ไปที่ https://dashboard.render.com
   - กด "New +" → "Web Service"

2. **เชื่อมต่อ Repository**
   - เลือก repository ที่มี backend code
   - กด "Connect"

3. **ตั้งค่า Web Service**

   **Basic Settings:**
   ```
   Name: GAMEPARTY
   Region: Singapore (หรือใกล้ที่สุด)
   Branch: main (หรือ branch ที่ต้องการ)
   Root Directory: backend
   ```

   **Build & Deploy:**
   ```
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

   **Environment Variables:**
   - กด "Add Environment Variable"
   - เพิ่มตัวแปรทั้งหมดด้านล่าง

---

### 3. ตั้งค่า Environment Variables

เพิ่ม Environment Variables ทั้งหมดนี้ใน Render Dashboard:

#### 📊 PostgreSQL Database Connections

```env
# HENG36 Database
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# MAX56 Database
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# JEED24 Database
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

#### 🗄️ Supabase Storage (สำหรับลบรูปภาพ)

```env
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
```

#### 🔄 Fallback (Optional)

```env
# Fallback (if theme-specific keys are not found)
SUPABASE_URL=https://ipflzfxezdzbmoqglknu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET=game-images
```

#### ⚙️ Server Configuration

```env
# Frontend URLs (comma-separated)
FRONTEND_URL=https://heng36.party,https://max56.party,https://jeed24.party

# Environment
NODE_ENV=production

# Port (Render จะ auto-assign ให้ - Optional)
PORT=3000

# Database Pool Configuration (Optional)
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

---

### 4. Deploy

1. **กด "Create Web Service"**
2. **Render จะ build และ deploy อัตโนมัติ**
3. **รอให้ deploy เสร็จ** (ประมาณ 2-5 นาที)
4. **ตรวจสอบ logs** ว่ามี error หรือไม่

---

### 5. ตรวจสอบการทำงาน

1. **Health Check**
   ```
   https://gameparty.onrender.com/health
   ```
   ควรได้ response:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z"
   }
   ```

2. **ตรวจสอบ Database Connections**
   - ดู logs ใน Render Dashboard
   - ควรเห็น:
     ```
     ✅ Connected to HENG36 PostgreSQL database
     ✅ Connected to MAX56 PostgreSQL database
     ✅ Connected to JEED24 PostgreSQL database
     ```

3. **ทดสอบ API**
   ```bash
   # ทดสอบ HENG36
   curl "https://gameparty.onrender.com/api/games?theme=heng36"
   
   # ทดสอบ MAX56
   curl "https://gameparty.onrender.com/api/games?theme=max56"
   
   # ทดสอบ JEED24
   curl "https://gameparty.onrender.com/api/games?theme=jeed24"
   ```

---

## 🔗 เชื่อมต่อ Frontend กับ Backend

### ✅ Backend URL (Production)
```
https://gameparty-vuey.onrender.com
```

### 1. ตั้งค่า Frontend Environment Variable

**ที่ Netlify Dashboard:**

1. ไปที่ Site settings → Environment variables
2. เพิ่ม:
   ```
   VITE_API_URL = https://gameparty.onrender.com
   ```

3. **Redeploy Frontend** เพื่อให้ environment variable ใหม่มีผล

---

### 2. ตรวจสอบการเชื่อมต่อ

1. **เปิด Browser Console**
2. **ลองใช้งาน Frontend**
3. **ตรวจสอบ Network tab** ว่า API calls ไปที่ backend URL ที่ถูกต้อง
4. **ตรวจสอบว่า theme ถูกส่งไปด้วย** (`?theme=heng36`)

---

## 📝 สรุป Environment Variables

### Backend (Render) - ต้องตั้งค่าทั้งหมด:

#### Database (3 ตัว)
- `DATABASE_URL_HENG36`
- `DATABASE_URL_MAX56`
- `DATABASE_URL_JEED24`

#### Supabase Storage (9 ตัว - 3 ธีม × 3 ตัวแปร)
- `SUPABASE_URL_HENG36` / `SUPABASE_ANON_KEY_HENG36` / `VITE_STORAGE_BUCKET_HENG36`
- `SUPABASE_URL_MAX56` / `SUPABASE_ANON_KEY_MAX56` / `VITE_STORAGE_BUCKET_MAX56`
- `SUPABASE_URL_JEED24` / `SUPABASE_ANON_KEY_JEED24` / `VITE_STORAGE_BUCKET_JEED24`

#### Server Config (Optional)
- `PORT` (auto-assigned by Render)
- `DB_MAX_CONNECTIONS`
- `DB_IDLE_TIMEOUT`
- `DB_CONNECTION_TIMEOUT`

### Frontend (Netlify) - ต้องตั้งค่า:

- `VITE_API_URL` = `https://gameparty.onrender.com`

---

## ⚠️ หมายเหตุสำคัญ

1. **ไม่ต้องแยก backend** - ใช้ backend เดียวรองรับ 3 ธีมได้
2. **Theme Detection** - Backend จะดึง theme จาก:
   - Query parameter: `?theme=heng36`
   - Header: `X-Theme: heng36`
   - Hostname: `heng36.party` → `heng36`
3. **Database Connection** - แต่ละ theme ใช้ database connection แยกกัน
4. **Render Free Tier** - อาจมี cold start (sleep หลัง 15 นาทีไม่ใช้งาน)
5. **Custom Domain** - สามารถตั้งค่า custom domain ใน Render ได้

---

## 🐛 Troubleshooting

### Backend ไม่เชื่อมต่อ Database

**ตรวจสอบ:**
1. Environment variables ตั้งค่าถูกต้องหรือไม่
2. Connection string ถูกต้องหรือไม่ (มี password ครบ)
3. Supabase database เปิดให้เชื่อมต่อจากภายนอกหรือไม่

### Frontend ไม่เชื่อมต่อ Backend

**ตรวจสอบ:**
1. `VITE_API_URL` ตั้งค่าถูกต้องหรือไม่
2. Backend URL ถูกต้องหรือไม่ (https://gameparty.onrender.com)
3. Redeploy frontend หลังจากตั้งค่า environment variable

### Theme ไม่ถูกต้อง

**ตรวจสอบ:**
1. Frontend ส่ง theme ไปด้วยหรือไม่ (`?theme=heng36`)
2. Backend logs แสดง theme อะไร
3. Database connection pool ถูกต้องหรือไม่

---

## ✅ Checklist

- [ ] Push code ขึ้น GitHub/GitLab
- [ ] สร้าง Web Service ที่ Render
- [ ] ตั้งค่า Root Directory = `backend`
- [ ] ตั้งค่า Build Command = `npm install`
- [ ] ตั้งค่า Start Command = `npm start`
- [ ] เพิ่ม Environment Variables ทั้งหมด (12+ ตัว)
- [ ] Deploy และตรวจสอบ logs
- [ ] ทดสอบ Health Check
- [ ] ทดสอบ API กับ theme ต่างๆ
- [ ] ตั้งค่า `VITE_API_URL` ใน Netlify
- [ ] Redeploy Frontend
- [ ] ทดสอบ Frontend เชื่อมต่อ Backend

---

## 🎉 เสร็จสิ้น!

หลังจากทำตามขั้นตอนทั้งหมด:
- ✅ Backend จะทำงานที่ Render
- ✅ Frontend จะเชื่อมต่อกับ Backend
- ✅ รองรับ 3 ธีม (HENG36, MAX56, JEED24)
- ✅ ใช้ backend เดียว ไม่ต้องแยก

