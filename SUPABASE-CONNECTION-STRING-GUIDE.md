# 🔗 Supabase Connection String Guide

## ❓ คำถาม: URL `https://ipflzfxezdzbmoqglknu.supabase.co` ใช้แค่นี้ใช่ไหม?

**คำตอบ: ไม่ใช่!** URL นี้เป็น **Dashboard URL** (สำหรับเปิดเว็บ) ไม่ใช่ Database Connection String

---

## 📋 ความแตกต่าง

### 1. **Dashboard URL** (สำหรับเปิดเว็บ)
```
https://ipflzfxezdzbmoqglknu.supabase.co
```
- ✅ ใช้เปิด Supabase Dashboard
- ✅ ใช้จัดการ project
- ❌ **ไม่ใช่** สำหรับเชื่อมต่อ database

### 2. **Database Connection String** (สำหรับเชื่อมต่อ database)
```
postgresql://postgres:[PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
```
- ✅ ใช้เชื่อมต่อ PostgreSQL database
- ✅ ใช้ใน backend `.env`
- ✅ ต้องมี password

---

## 🔍 วิธีรับ Connection String

### Step 1: เปิด Supabase Dashboard
1. ไปที่: `https://ipflzfxezdzbmoqglknu.supabase.co`
2. Login เข้า account

### Step 2: ไปที่ Settings
1. คลิก **Settings** (⚙️) ใน sidebar ซ้าย
2. คลิก **Database**

### Step 3: หา Connection String
1. Scroll ลงไปหา **"Connection string"**
2. จะเห็น 2 แบบ:
   - **URI** (Connection Pooling) - แนะนำ
   - **Direct connection** - สำหรับ direct connection

### Step 4: Copy Connection String

#### แบบ URI (Connection Pooling) - แนะนำ
```
postgresql://postgres.ipflzfxezdzbmoqglknu:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

#### แบบ Direct Connection
```
postgresql://postgres:[YOUR-PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres
```

### Step 5: แทนที่ Password
⚠️ **สำคัญ**: แทนที่ `[YOUR-PASSWORD]` ด้วย password ที่ตั้งไว้ตอนสร้าง project

### Step 6: เพิ่ม SSL Mode
⚠️ **สำคัญ**: เพิ่ม `?sslmode=require` ที่ท้าย connection string

**ตัวอย่าง**:
```
postgresql://postgres:[YOUR-PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
```

---

## 📝 ตัวอย่าง Connection String สำหรับ Project ของคุณ

### Project Reference: `ipflzfxezdzbmoqglknu`

#### แบบ Direct Connection (แนะนำสำหรับ development)
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
```

#### แบบ Connection Pooling (แนะนำสำหรับ production)
```env
DATABASE_URL=postgresql://postgres.ipflzfxezdzbmoqglknu:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 🔧 Setup Backend `.env`

1. ไปที่ `backend` directory
2. สร้างไฟล์ `.env`:
   ```env
   # Database Connection
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

3. ⚠️ **แทนที่** `[YOUR-PASSWORD]` ด้วย password ที่ตั้งไว้

---

## 🧪 Test Connection

```bash
cd backend
node scripts/test-cloud-connection.js
```

หรือถ้ามี script:
```bash
npm run test:connection
```

ควรเห็น:
```
✅ Connected successfully!
✅ Database: postgres
✅ Found X schemas
```

---

## 📊 ข้อมูลที่ต้องมี

### จาก Supabase Dashboard:
- ✅ **Project Reference**: `ipflzfxezdzbmoqglknu` (จาก URL)
- ✅ **Database Password**: password ที่ตั้งไว้ตอนสร้าง project
- ✅ **Connection String**: จาก Settings → Database

### Connection String Components:
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?sslmode=require
```

สำหรับ project ของคุณ:
- **USER**: `postgres`
- **PASSWORD**: `[YOUR-PASSWORD]` (ที่ตั้งไว้)
- **HOST**: `db.ipflzfxezdzbmoqglknu.supabase.co`
- **PORT**: `5432` (direct) หรือ `6543` (pooling)
- **DATABASE**: `postgres`
- **SSL**: `?sslmode=require`

---

## 🆘 Troubleshooting

### Connection Error: "password authentication failed"
**ปัญหา**: Password ผิด

**แก้ไข**:
1. ตรวจสอบ password ใน `.env`
2. ไปที่ Settings → Database → Reset database password (ถ้าจำไม่ได้)

### Connection Error: "connection refused"
**ปัญหา**: Host หรือ Port ผิด

**แก้ไข**:
1. ตรวจสอบ host: `db.ipflzfxezdzbmoqglknu.supabase.co`
2. ตรวจสอบ port: `5432` (direct) หรือ `6543` (pooling)
3. ตรวจสอบ `?sslmode=require`

### Connection Error: "SSL required"
**ปัญหา**: ไม่มี SSL mode

**แก้ไข**:
1. เพิ่ม `?sslmode=require` ที่ท้าย connection string
2. หรือตั้ง `DB_SSL=true` ใน `.env`

---

## ✅ Checklist

- [ ] เปิด Supabase Dashboard: `https://ipflzfxezdzbmoqglknu.supabase.co`
- [ ] ไปที่ Settings → Database
- [ ] Copy Connection String
- [ ] แทนที่ `[YOUR-PASSWORD]` ด้วย password จริง
- [ ] เพิ่ม `?sslmode=require` ที่ท้าย
- [ ] ใส่ใน `backend/.env`
- [ ] Test connection

---

## 🎯 สรุป

**URL ที่ให้มา**: `https://ipflzfxezdzbmoqglknu.supabase.co`
- ✅ ใช้เปิด Dashboard
- ❌ **ไม่ใช่** Connection String

**Connection String ที่ต้องใช้**:
```
postgresql://postgres:[PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
```

**วิธีรับ**:
1. ไปที่ Dashboard
2. Settings → Database
3. Copy Connection String
4. แทนที่ password
5. เพิ่ม `?sslmode=require`

---

พร้อมใช้งานแล้ว! 🚀

