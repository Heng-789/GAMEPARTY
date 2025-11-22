# 🔧 Environment Setup Guide

## ✅ Frontend Environment (พร้อมแล้ว!)

ไฟล์ environment สำหรับ frontend ถูกตั้งค่าแล้วใน:
- ✅ `env.heng36` - HENG36 theme configuration
- ✅ `env.max56` - MAX56 theme configuration  
- ✅ `env.jeed24` - JEED24 theme configuration

**หมายเหตุ**: Vite จะโหลดไฟล์เหล่านี้อัตโนมัติเมื่อรันด้วย mode ที่ตรงกัน:
```bash
npm run dev:heng36  # โหลด env.heng36
npm run dev:max56   # โหลด env.max56
npm run dev:jeed24  # โหลด env.jeed24
```

### Frontend Environment Variables ที่ตั้งค่าแล้ว:
```env
VITE_USE_POSTGRESQL=true
VITE_API_URL=http://localhost:3000
VITE_FALLBACK_FIREBASE=false
```

**Default Values** (ถ้าไม่ได้ตั้งค่า):
- `VITE_USE_POSTGRESQL`: default `true`
- `VITE_API_URL`: default `http://localhost:3000`
- `VITE_FALLBACK_FIREBASE`: default `false`

---

## ⚠️ Backend Environment (ต้องสร้าง)

### Step 1: สร้างไฟล์ backend/.env

```bash
cd backend

# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

### Step 2: อัพเดทเนื้อหาใน backend/.env

```env
# Backend Environment Variables
# PostgreSQL Database Connections

# HENG36 Database
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require

# MAX56 Database
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# Server Configuration
PORT=3000

# Optional: Database Pool Configuration
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

### Step 3: ตรวจสอบว่า .env ถูกสร้างแล้ว

```bash
cd backend
dir .env    # Windows
# หรือ
ls -la .env # Linux/Mac
```

---

## 🚀 Quick Start

### 1. Setup Backend Environment
```bash
cd backend
# สร้างไฟล์ .env ตามขั้นตอนด้านบน
```

### 2. Start Backend Server
```bash
cd backend
npm install  # ถ้ายังไม่ได้ install
npm run dev
```

**ควรเห็น**:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

### 3. Start Frontend Server
```bash
# สำหรับ HENG36
npm run dev:heng36

# สำหรับ MAX56
npm run dev:max56

# สำหรับ JEED24
npm run dev:jeed24
```

---

## 📋 Checklist

- ✅ Frontend Environment: พร้อมแล้ว (env.heng36, env.max56, env.jeed24)
- ⚠️ Backend Environment: ต้องสร้าง backend/.env (ดู `backend/SETUP-ENV.md`)
- ⚠️ Database Migrations: ต้องรัน migrations (ดู `TESTING-GUIDE.md`)

---

## 📖 เอกสารเพิ่มเติม

- `backend/SETUP-ENV.md` - คู่มือตั้งค่า backend environment
- `TESTING-GUIDE.md` - คู่มือการเทสระบบ
- `CONNECTION-SUCCESS.md` - ข้อมูล database connection strings

---

**พร้อมเทสแล้ว!** 🚀

