# 🚀 Supabase Setup Guide - Step by Step

## ❓ คำถาม: ต้องติดตั้ง Supabase ก่อนไหม?

**คำตอบ: ไม่ต้องติดตั้ง!** Supabase เป็น **Cloud Service** (เหมือน Firebase) ไม่ต้องติดตั้งอะไรในเครื่อง

---

## ✅ สิ่งที่ต้องทำ

1. ✅ **สร้าง Account** (Sign up)
2. ✅ **สร้าง Organization**
3. ✅ **สร้าง Project**
4. ✅ **รับ Connection String**
5. ✅ **สร้าง Schemas** (heng36, max56, jeed24)
6. ✅ **Run Migrations**
7. ✅ **Setup Backend** (.env)

---

## 📋 Step-by-Step Setup

### Step 1: สร้าง Supabase Account

1. ไปที่ **https://supabase.com**
2. คลิก **"Start your project"** หรือ **"Sign up"**
3. เลือกวิธี Sign up:
   - **GitHub** (แนะนำ)
   - **Google**
   - **Email**
4. ใส่ข้อมูล:
   - Email
   - Password
   - Organization name (ถ้ามี)
5. คลิก **"Create account"**
6. ตรวจสอบ Email (ถ้าใช้ Email)

---

### Step 2: สร้าง Organization

1. หลังจาก Login
2. คลิก **"New organization"** (หรือ **"Create organization"**)
3. ตั้งค่า:
   - **Name**: `HENG36GAME`
   - **Type**: Personal (หรือ Company)
   - **Plan**: Free - $0/month
4. คลิก **"Create organization"**

---

### Step 3: สร้าง Project

1. ใน Organization ที่สร้าง
2. คลิก **"New project"** (หรือ **"Create a new project"**)
3. ตั้งค่า:
   - **Name**: `heng36game-multi-theme`
   - **Database Password**: 
     - ⚠️ **สำคัญ**: ตั้งรหัสผ่านที่แข็งแรง
     - ⚠️ **จำไว้**: จะใช้ต่อไม่ได้ถ้าลืม!
     - ตัวอย่าง: `MySecurePassword123!@#`
   - **Region**: **Southeast Asia (Singapore)** ⭐
     - เลือกใกล้ที่สุดเพื่อความเร็ว
   - **Plan**: **Free**
     - 500 MB storage
     - 2 GB bandwidth/month
     - Unlimited API requests
4. คลิก **"Create new project"**
5. ⏳ **รอให้สร้างเสร็จ** (~2-3 นาที)
   - จะเห็น progress bar
   - รอจนกว่า status เป็น "Active"

---

### Step 4: รับ Connection String

1. ไปที่ **Settings** (⚙️) → **Database**
2. Scroll ลงไปหา **"Connection string"**
3. เลือก **"URI"** tab
4. คัดลอก **Connection string**:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
   
   หรือ **"Direct connection"**:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

5. ⚠️ **สำคัญ**: แทนที่ `[YOUR-PASSWORD]` ด้วย password ที่ตั้งไว้
6. ⚠️ **สำคัญ**: เพิ่ม `?sslmode=require` ที่ท้าย:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```

7. **บันทึกไว้**: จะใช้ใน backend `.env`

---

### Step 5: สร้าง Schemas

1. ไปที่ **SQL Editor** (ใน sidebar ซ้าย)
2. คลิก **"New query"**
3. Paste code นี้:
   ```sql
   -- สร้าง schemas สำหรับ 3 ธีม
   CREATE SCHEMA IF NOT EXISTS heng36;
   CREATE SCHEMA IF NOT EXISTS max56;
   CREATE SCHEMA IF NOT EXISTS jeed24;
   ```
4. คลิก **"Run"** (หรือกด `Ctrl+Enter`)
5. ✅ ควรเห็น: `Success. No rows returned`

---

### Step 6: Run Migrations

1. ไปที่ **SQL Editor** → **New query**
2. เปิดไฟล์ `migrations/002_create_multi_theme_schemas.sql` ในโปรเจค
3. Copy เนื้อหาทั้งหมด
4. Paste ใน SQL Editor
5. ⚠️ **ตรวจสอบ**: ต้องมี function `update_updated_at_column()` ใน script
6. คลิก **"Run"** (หรือกด `Ctrl+Enter`)
7. ⏳ รอให้เสร็จ (~10-30 วินาที)
8. ✅ ควรเห็น: `Success. No rows returned`

---

### Step 7: ตรวจสอบ Schemas

1. ไปที่ **Table Editor**
2. ดู dropdown ที่มี schema selector
3. ควรเห็น: `public`, `heng36`, `max56`, `jeed24`

หรือใช้ SQL:
```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('heng36', 'max56', 'jeed24');
```

ควรเห็น:
```
schema_name
-----------
heng36
max56
jeed24
```

---

### Step 8: Setup Backend

1. ไปที่ `backend` directory
2. สร้างไฟล์ `.env`:
   ```bash
   cd backend
   ```
   
   สร้างไฟล์ `.env`:
   ```env
   # ใช้ Connection String จาก Supabase
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

3. ⚠️ **แทนที่**:
   - `[YOUR-PASSWORD]` → password ที่ตั้งไว้
   - `[PROJECT-REF]` → project reference จาก Supabase

---

### Step 9: Test Connection

1. ไปที่ `backend` directory
2. Run:
   ```bash
   npm install
   ```
3. Test connection:
   ```bash
   node scripts/test-cloud-connection.js
   ```
   
   หรือถ้ามี script:
   ```bash
   npm run test:connection
   ```

4. ✅ ควรเห็น:
   ```
   ✅ Connected successfully!
   ✅ Database: postgres
   ✅ Found X schemas
   ```

---

### Step 10: Start Backend

```bash
cd backend
npm run dev
```

ควรเห็น:
```
✅ Connected to PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

---

## 🧪 Test API

### Test Health
```bash
curl http://localhost:3000/health
```

ควรเห็น:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test Get Games (HENG36)
```bash
curl "http://localhost:3000/api/games?theme=heng36"
```

### Test Get Games (MAX56)
```bash
curl "http://localhost:3000/api/games?theme=max56"
```

### Test Get Games (JEED24)
```bash
curl "http://localhost:3000/api/games?theme=jeed24"
```

---

## 📊 ตรวจสอบ Database

### ดู Schemas
```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('heng36', 'max56', 'jeed24');
```

### ดู Tables ในแต่ละ Schema
```sql
-- HENG36
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'heng36'
ORDER BY table_name;

-- MAX56
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'max56'
ORDER BY table_name;

-- JEED24
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'jeed24'
ORDER BY table_name;
```

---

## 🔄 Migration Data

### Migrate จาก Firebase

```bash
cd backend

# HENG36
node scripts/migrate-from-firebase.js heng36

# MAX56
node scripts/migrate-from-firebase.js max56

# JEED24
node scripts/migrate-from-firebase.js jeed24
```

---

## ✅ Checklist

- [ ] สร้าง Supabase Account
- [ ] สร้าง Organization: `HENG36GAME`
- [ ] สร้าง Project: `heng36game-multi-theme`
- [ ] รับ Connection String
- [ ] สร้าง 3 Schemas (heng36, max56, jeed24)
- [ ] Run migrations (`002_create_multi_theme_schemas.sql`)
- [ ] ตรวจสอบ schemas และ tables
- [ ] Setup backend `.env`
- [ ] Test connection
- [ ] Start backend (`npm run dev`)
- [ ] Test API endpoints
- [ ] Migrate data จาก Firebase

---

## 🆘 Troubleshooting

### Connection Error

**ปัญหา**: ไม่สามารถเชื่อมต่อได้

**แก้ไข**:
1. ตรวจสอบ password ใน `.env`
2. ตรวจสอบ `?sslmode=require` ใน connection string
3. ตรวจสอบ firewall/network
4. ตรวจสอบ project status (ต้องเป็น "Active")

### Schema ไม่พบ

**ปัญหา**: Query ไม่เจอ schema

**แก้ไข**:
```sql
-- ตรวจสอบ
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('heng36', 'max56', 'jeed24');
```

ถ้าไม่มี → Run migrations อีกครั้ง

### Tables ไม่พบ

**ปัญหา**: Query ไม่เจอ tables

**แก้ไข**:
1. ตรวจสอบว่า migrations รันแล้ว
2. ตรวจสอบ schema name ใน queries
3. ตรวจสอบว่าใช้ schema prefix: `heng36.users` ไม่ใช่ `users`

### Password ลืม

**ปัญหา**: ลืม database password

**แก้ไข**:
1. ไปที่ **Settings** → **Database**
2. คลิก **"Reset database password"**
3. ตั้ง password ใหม่
4. อัพเดท `.env` file

---

## 📚 Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Connection Pooling**: https://supabase.com/docs/guides/database/connecting-to-postgres

---

## 🎯 สรุป

**ไม่ต้องติดตั้ง Supabase!** 

**สิ่งที่ต้องทำ**:
1. ✅ สร้าง Account
2. ✅ สร้าง Project
3. ✅ Setup Connection
4. ✅ Run Migrations
5. ✅ Start Backend

**พร้อมใช้งานแล้ว!** 🚀

