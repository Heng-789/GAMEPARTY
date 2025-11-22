# 🔧 Troubleshooting Backend Internal Server Error

## ⚠️ ปัญหา

Error: `Internal server error` จาก `/api/games` endpoint

## 🔍 วิธีตรวจสอบ

### 1. ตรวจสอบ Backend Server ทำงานอยู่หรือไม่

```bash
# ตรวจสอบ port 3000
netstat -ano | findstr :3000

# หรือ
Test-NetConnection -ComputerName localhost -Port 3000
```

**ถ้าไม่มี process ใช้ port 3000:**
- Backend server ไม่ได้ทำงาน
- ต้องรัน `npm run dev` ในโฟลเดอร์ `backend`

### 2. ตรวจสอบ Database Connection

ตรวจสอบว่า `backend/.env` มี DATABASE_URL หรือไม่:

```env
DATABASE_URL_HENG36=postgresql://...
DATABASE_URL_MAX56=postgresql://...
DATABASE_URL_JEED24=postgresql://...
```

**ถ้าไม่มี:**
- สร้างไฟล์ `backend/.env` (ดู `backend/SETUP-ENV.md`)
- ใช้ `backend/create-env.bat` (Windows) หรือ `backend/create-env.sh` (Linux/Mac)

### 3. ตรวจสอบ Database Tables ถูกสร้างแล้วหรือไม่

**สำหรับ Multiple Projects (Supabase):**
- ใช้ schema `public`
- ต้องรัน migrations ใน Supabase Dashboard:
  - `001_create_tables.sql` - สร้าง tables ใน schema `public`

**สำหรับ Single Project with Schema Separation:**
- ใช้ schema `heng36`, `max56`, `jeed24`
- ต้องรัน migrations:
  - `001_create_tables.sql` - สร้าง tables ใน schema `public`
  - `002_create_multi_theme_schemas.sql` - สร้าง schemas และ tables

### 4. ตรวจสอบ Error Logs ใน Backend

**ดู backend console output:**
- ควรเห็น error message ที่แท้จริง (หลังจากอัพเดท error logging แล้ว)
- Error อาจจะเป็น:
  - `relation "public.games" does not exist` - Table ยังไม่ได้สร้าง
  - `Connection error` - Database connection ไม่ได้
  - `Schema "heng36" does not exist` - Schema ยังไม่ได้สร้าง

## 🔧 วิธีแก้ไข

### Solution 1: ตรวจสอบว่า Backend Server ทำงานอยู่

```bash
cd backend
npm run dev
```

**Expected output:**
```
✅ Connected to HENG36 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

### Solution 2: รัน Database Migrations

#### สำหรับ Supabase (Multiple Projects):

1. ไปที่ Supabase Dashboard:
   - HENG36: https://ipflzfxezdzbmoqglknu.supabase.co
   - MAX56: https://aunfaslgmxxdeemvtexn.supabase.co
   - JEED24: https://pyrtleftkrjxvwlbvfma.supabase.co

2. ไปที่ SQL Editor

3. รัน `001_create_tables.sql` (ใน schema `public`)

#### สำหรับ Single Project:

รัน migrations ทั้งหมด:
- `001_create_tables.sql`
- `002_create_multi_theme_schemas.sql`
- `003_add_answers_columns.sql`
- `004_create_chat_table.sql`

### Solution 3: ตรวจสอบ Schema Name

**Multiple Projects (Supabase):**
- Schema: `public`
- `getSchema('heng36')` จะ return `public`

**Single Project:**
- Schema: `heng36`, `max56`, `jeed24`
- `getSchema('heng36')` จะ return `heng36`

ตรวจสอบว่า tables ถูกสร้างใน schema ที่ถูกต้อง

### Solution 4: ตรวจสอบ Database Connection String

ตรวจสอบว่า `backend/.env` มี connection strings ถูกต้อง:

```env
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:...@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**ถ้าไม่มีหรือผิด:**
- รับ connection string ใหม่จาก Supabase Dashboard
- ใส่ใน `backend/.env`

## 📋 Checklist

- [ ] Backend server ทำงานอยู่ (port 3000)
- [ ] `backend/.env` มี DATABASE_URL_* ทั้งหมด
- [ ] Database connection สำเร็จ (เห็น log "✅ Connected to ...")
- [ ] Tables ถูกสร้างแล้ว (ใน schema `public` หรือ `heng36`/`max56`/`jeed24`)
- [ ] Schema name ถูกต้อง (ตาม getSchema logic)

## 🚀 Quick Fix

1. **Start Backend Server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **ตรวจสอบ Backend Logs:**
   - ดู error message ที่แท้จริง
   - อาจจะเป็น "table does not exist" หรือ "connection error"

3. **รัน Migrations:**
   - ไปที่ Supabase Dashboard → SQL Editor
   - รัน `001_create_tables.sql`

4. **Restart Backend Server:**
   ```bash
   # Stop (Ctrl+C)
   # Start again
   npm run dev
   ```

