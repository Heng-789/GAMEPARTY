# 🧪 Testing Guide: PostgreSQL Migration

## ✅ Checklist ก่อนเทส

### 1. ✅ Code Migration
- ✅ **Components**: 9/9 files ✅ **100%** (ทุกไฟล์อัพเดทแล้ว)
- ✅ **Pages**: 6/6 files ✅ **100%** (ทั้ง User-facing และ Admin Tools)
- ✅ **Hooks**: 1/1 file ✅ **100%**
- ✅ **Services**: ✅ พร้อม (postgresql-api, postgresql-adapter)

### 2. ✅ Environment Variables

#### ✅ Frontend (พร้อมแล้ว!)
ไฟล์ environment สำหรับ frontend ถูกตั้งค่าแล้วใน:
- ✅ `env.heng36` - HENG36 theme configuration
- ✅ `env.max56` - MAX56 theme configuration  
- ✅ `env.jeed24` - JEED24 theme configuration

**ตั้งค่าแล้ว**:
```env
VITE_USE_POSTGRESQL=true
VITE_API_URL=http://localhost:3000
VITE_FALLBACK_FIREBASE=false
```

**หมายเหตุ**: 
- `VITE_USE_POSTGRESQL` - default: `true` (ถ้าไม่ได้ตั้งค่า)
- `VITE_API_URL` - default: `http://localhost:3000` (ถ้าไม่ได้ตั้งค่า)
- `VITE_FALLBACK_FIREBASE` - default: `false` (ถ้าไม่ได้ตั้งค่า)

#### ⚠️ Backend (ต้องสร้าง)
สร้างไฟล์ `backend/.env` โดยใช้สคริปต์:

**วิธีที่ 1: ใช้สคริปต์ (แนะนำ)**
```bash
cd backend
create-env.bat    # Windows
# หรือ
./create-env.sh   # Linux/Mac
```

**วิธีที่ 2: สร้างเอง**
```bash
cd backend
# Copy จาก backend/.env.example หรือดู SETUP-ENV.md
```

**เนื้อหาที่ต้องใส่**:
```env
# Database Connections
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# Server
PORT=3000
```

**ดูรายละเอียดเพิ่มเติม**: `SETUP-ENV.md` หรือ `backend/SETUP-ENV.md`

### 3. ⚠️ Database Migrations

ตรวจสอบว่า migrations ถูกรันแล้ว:
- ✅ `001_create_tables.sql` - สร้าง tables หลัก
- ✅ `002_create_multi_theme_schemas.sql` - สร้าง schemas สำหรับแต่ละ theme
- ✅ `003_add_answers_columns.sql` - เพิ่ม columns สำหรับ answers
- ✅ `004_create_chat_table.sql` - สร้าง chat table

**รัน migrations**:
```bash
# วิธีที่ 1: ใช้ SQL Editor ใน Supabase Dashboard
# 1. ไปที่ Supabase Dashboard → SQL Editor
# 2. Copy & paste SQL จาก migrations/ และรันทีละไฟล์

# วิธีที่ 2: ใช้ psql หรือ pgAdmin
psql "your-connection-string" < migrations/001_create_tables.sql
```

### 4. ⚠️ Start Services

#### Start Backend Server
```bash
cd backend
npm install  # ถ้ายังไม่ได้ install
npm run dev  # หรือ npm start
```

**ควรเห็น**:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

#### Start Frontend Server
```bash
# สำหรับ HENG36
npm run dev -- --mode heng36

# สำหรับ MAX56
npm run dev -- --mode max56

# สำหรับ JEED24
npm run dev -- --mode jeed24
```

**ควรเห็น**:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 🧪 Testing Steps

### Step 1: Test Backend Health

```bash
curl http://localhost:3000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Step 2: Test Backend API (Games)

```bash
# Test HENG36
curl "http://localhost:3000/api/games?theme=heng36"

# Test MAX56
curl "http://localhost:3000/api/games?theme=max56"
```

**Expected Response**: Array of games (อาจเป็น `[]` ถ้ายังไม่มีเกม)

### Step 3: Test Frontend Connection

1. เปิด browser ไปที่ `http://localhost:5173`
2. เปิด **Developer Console** (F12)
3. ตรวจสอบว่าไม่มี errors เกี่ยวกับ PostgreSQL connection

**Expected**: ไม่มี errors เกี่ยวกับ `VITE_API_URL` หรือ PostgreSQL connection

### Step 4: Test User Features

#### 4.1 Create Game
1. ไปที่หน้า **Create Game**
2. สร้างเกมใหม่
3. ตรวจสอบว่าเกมถูกสร้างใน PostgreSQL (ใช้ Supabase Dashboard)

#### 4.2 View Games List
1. ไปที่หน้า **Games List**
2. ตรวจสอบว่าเกมแสดงขึ้นมา
3. ตรวจสอบว่า polling ทำงาน (ดูใน Network tab - ควรเห็น requests ทุก 5 วินาที)

#### 4.3 Play Game
1. เลือกเกม
2. ตรวจสอบว่าเกมโหลดข้อมูลจาก PostgreSQL
3. ลองเล่นเกมและส่งคำตอบ
4. ตรวจสอบว่าคำตอบถูกบันทึกใน PostgreSQL

#### 4.4 Chat Feature
1. เปิดเกมที่มี LiveChat
2. ส่งข้อความ
3. ตรวจสอบว่าข้อความถูกบันทึกใน PostgreSQL
4. ตรวจสอบว่า polling ทำงาน (ข้อความใหม่ควรแสดงภายใน 2 วินาที)

#### 4.5 User Credit
1. ตรวจสอบว่า UserBar แสดง hcoin
2. ตรวจสอบว่า polling ทำงาน (ดูใน Network tab)

### Step 5: Test Admin Tools

#### 5.1 AdminAnswers
1. ไปที่หน้า **AdminAnswers**
2. เลือกเกม
3. ตรวจสอบว่าคำตอบแสดงขึ้นมา
4. ลองแก้ไขคำตอบ
5. ลองลบคำตอบ
6. ตรวจสอบว่าการเปลี่ยนแปลงถูกบันทึกใน PostgreSQL

#### 5.2 UploadUsersExtra
1. ไปที่หน้า **UploadUsersExtra**
2. ลองอัพโหลด/แก้ไข user data
3. ตรวจสอบว่าข้อมูลถูกบันทึกใน PostgreSQL

### Step 6: Test Real-time Features

#### 6.1 Polling
- ตรวจสอบว่า polling ทำงานสำหรับ:
  - Games List (ทุก 5 วินาที)
  - User Credit (ทุก 5 วินาที)
  - Chat Messages (ทุก 2 วินาที)
  - Admin Answers (ทุก 5 วินาที)

#### 6.2 WebSocket (ถ้ามี)
- ตรวจสอบว่า WebSocket connection ทำงาน
- ตรวจสอบว่า real-time updates มาทาง WebSocket

---

## 🐛 Troubleshooting

### Problem 1: Backend ไม่สามารถเชื่อมต่อ Database

**อาการ**: 
```
❌ HENG36 database error: ...
```

**แก้ไข**:
1. ตรวจสอบว่า `.env` ใน backend/ มี `DATABASE_URL_HENG36` และ `DATABASE_URL_MAX56`
2. ตรวจสอบว่า connection strings ถูกต้อง
3. ตรวจสอบว่า Supabase database ทำงานอยู่

### Problem 2: Frontend ไม่สามารถเรียก API

**อาการ**:
- Console แสดง error: `Failed to fetch` หรือ `Network error`
- API calls ไม่ทำงาน

**แก้ไข**:
1. ตรวจสอบว่า backend server ทำงานอยู่ (`http://localhost:3000/health`)
2. ตรวจสอบว่า `VITE_API_URL` ถูกตั้งค่าเป็น `http://localhost:3000`
3. ตรวจสอบ CORS settings ใน backend (ควรอนุญาต `http://localhost:5173`)

### Problem 3: Database Tables ไม่มี

**อาการ**:
- API returns 500 error
- Database queries fail

**แก้ไข**:
1. รัน migrations ทั้งหมดใน Supabase SQL Editor
2. ตรวจสอบว่า tables ถูกสร้างแล้ว (ใช้ Supabase Dashboard → Table Editor)

### Problem 4: Data ไม่แสดง

**อาการ**:
- หน้าเว็บว่างเปล่า
- ไม่มีข้อมูลแสดง

**แก้ไข**:
1. ตรวจสอบว่า database มีข้อมูล (ใช้ Supabase Dashboard)
2. ตรวจสอบว่า API endpoints return ข้อมูล (ใช้ curl หรือ Postman)
3. ตรวจสอบว่า frontend polling ทำงาน (ดูใน Network tab)

### Problem 5: Real-time Updates ไม่ทำงาน

**อาการ**:
- ข้อมูลไม่อัพเดทอัตโนมัติ
- ต้อง refresh หน้าเว็บ

**แก้ไข**:
1. ตรวจสอบว่า polling intervals ทำงาน (ดูใน Network tab)
2. ตรวจสอบว่า `setInterval` ไม่ถูก clear
3. ตรวจสอบ console errors

---

## ✅ Success Criteria

### Backend
- ✅ Server เริ่มต้นสำเร็จ
- ✅ Database connections สำเร็จ
- ✅ API endpoints ทำงาน (ทดสอบด้วย curl)
- ✅ WebSocket server พร้อม

### Frontend
- ✅ ไม่มี console errors
- ✅ API calls สำเร็จ
- ✅ ข้อมูลแสดงถูกต้อง
- ✅ Real-time updates ทำงาน (polling)
- ✅ User features ทำงาน (create game, play game, chat, etc.)
- ✅ Admin tools ทำงาน (AdminAnswers, UploadUsersExtra)

### Database
- ✅ Tables ถูกสร้างแล้ว
- ✅ Migrations รันสำเร็จ
- ✅ Data ถูกบันทึกและอ่านได้

---

## 🎯 Next Steps

หลังจากเทสสำเร็จ:
1. ✅ Deploy backend ไป production server
2. ✅ Deploy frontend ไป production (Netlify/Vercel)
3. ✅ Update environment variables ใน production
4. ✅ Monitor performance และ errors
5. ✅ Disable Firebase fallback (ถ้าต้องการ)

---

## 📝 Notes

- **Polling Intervals**:
  - Games List: 5 seconds
  - User Credit: 5 seconds
  - Chat Messages: 2 seconds
  - Admin Answers: 5 seconds
  - Admin Checkins: 5 seconds

- **Firebase Fallback**: 
  - Default: `false` (ไม่ใช้ Firebase fallback)
  - ถ้าต้องการใช้ fallback ตั้ง `VITE_FALLBACK_FIREBASE=true`

- **API Base URL**:
  - Development: `http://localhost:3000`
  - Production: ตั้งค่าตาม production backend URL

---

**พร้อมเทสแล้ว!** 🚀

