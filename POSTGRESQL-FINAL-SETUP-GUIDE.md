# ✅ Final Setup Guide: 1 Organization + 1 Project + Schema Separation

คู่มือการตั้งค่าสุดท้ายสำหรับ 3 ธีม (heng36, max56, jeed24)

---

## 🎯 สรุป: ใช่! ใช้ 1 Organization + 1 Project + Schema Separation

**นี่คือตัวเลือกที่ดีที่สุด** ✅

---

## 🏗️ Structure

```
Supabase
└── Organization: HENG36GAME
    └── Project: heng36game-multi-theme
        └── Database: postgres
            ├── Schema: heng36
            │   ├── users
            │   ├── games
            │   ├── checkins
            │   └── ...
            ├── Schema: max56
            │   ├── users
            │   ├── games
            │   ├── checkins
            │   └── ...
            └── Schema: jeed24
                ├── users
                ├── games
                ├── checkins
                └── ...
```

---

## 🚀 Step-by-Step Setup

### Step 1: สร้าง Organization

1. ไปที่ https://supabase.com
2. Login / Sign up
3. คลิก **"New organization"**
4. ตั้งค่า:
   - **Name**: `HENG36GAME`
   - **Type**: Personal (หรือ Company ตามต้องการ)
   - **Plan**: Free - $0/month
5. คลิก **"Create organization"**

### Step 2: สร้าง Project

1. ใน Organization ที่สร้าง
2. คลิก **"New project"** (หรือ **"Create a new project"**)
3. ตั้งค่า:
   - **Name**: `heng36game-multi-theme`
   - **Database Password**: ตั้งรหัสผ่านที่แข็งแรง (จำไว้!)
   - **Region**: **Southeast Asia (Singapore)** ⭐
   - **Plan**: Free
4. คลิก **"Create new project"**
5. รอให้สร้างเสร็จ (~2 นาที)

### Step 3: รับ Connection Info

1. ไปที่ **Settings** (⚙️) → **Database**
2. คัดลอก **Connection string**:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
   
   หรือ **Direct connection**:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

3. **สำคัญ**: เพิ่ม `?sslmode=require` ที่ท้าย:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   ```

### Step 4: สร้าง Schemas

1. ไปที่ **SQL Editor** (ใน sidebar ซ้าย)
2. คลิก **"New query"**
3. Paste code นี้:
   ```sql
   -- สร้าง schemas สำหรับ 3 ธีม
   CREATE SCHEMA IF NOT EXISTS heng36;
   CREATE SCHEMA IF NOT EXISTS max56;
   CREATE SCHEMA IF NOT EXISTS jeed24;
   ```
4. คลิก **"Run"** (หรือกด Ctrl+Enter)
5. ควรเห็น: `Success. No rows returned`

### Step 5: Run Migrations

1. ไปที่ **SQL Editor** → **New query**
2. เปิดไฟล์ `migrations/002_create_multi_theme_schemas.sql`
3. Copy เนื้อหาทั้งหมด
4. Paste ใน SQL Editor
5. คลิก **"Run"**
6. รอให้เสร็จ (~10-30 วินาที)
7. ควรเห็น: `Success. No rows returned`

### Step 6: ตรวจสอบ Schemas

1. ไปที่ **Table Editor**
2. ดูว่า schemas ถูกสร้างแล้ว:
   - ควรเห็น dropdown ที่มี: `public`, `heng36`, `max56`, `jeed24`
3. หรือใช้ SQL:
   ```sql
   SELECT schema_name 
   FROM information_schema.schemata 
   WHERE schema_name IN ('heng36', 'max56', 'jeed24');
   ```

### Step 7: Setup Backend

1. ไปที่ `backend` directory
2. สร้างไฟล์ `.env`:
   ```bash
   cp .env.example .env
   ```

3. แก้ไข `.env`:
   ```env
   # ใช้ Connection String จาก Supabase
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
   
   # หรือใช้ Parameters แยก
   # DB_HOST=db.[PROJECT-REF].supabase.co
   # DB_PORT=5432
   # DB_NAME=postgres
   # DB_USER=postgres
   # DB_PASSWORD=[YOUR-PASSWORD]
   # DB_SSL=true
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

4. Test connection:
   ```bash
   npm run test:connection
   ```

   ควรเห็น:
   ```
   ✅ Connected successfully!
   ✅ Database: postgres
   ✅ Found X tables
   ```

### Step 8: Start Backend

```bash
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

### ดูจำนวน Records
```sql
-- HENG36 Users
SELECT COUNT(*) FROM heng36.users;

-- MAX56 Users
SELECT COUNT(*) FROM max56.users;

-- JEED24 Users
SELECT COUNT(*) FROM jeed24.users;
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

**Note**: ต้องแก้ไข migration script ให้รองรับ schema (จะอัพเดทให้)

---

## ✅ Checklist

- [ ] สร้าง Organization: `HENG36GAME`
- [ ] สร้าง Project: `heng36game-multi-theme`
- [ ] รับ Connection String
- [ ] สร้าง 3 Schemas (heng36, max56, jeed24)
- [ ] Run migrations (`002_create_multi_theme_schemas.sql`)
- [ ] ตรวจสอบ schemas และ tables
- [ ] Setup backend `.env`
- [ ] Test connection (`npm run test:connection`)
- [ ] Start backend (`npm run dev`)
- [ ] Test API endpoints
- [ ] Migrate data จาก Firebase

---

## 🎯 สรุป

**ใช่! ใช้ 1 Organization + 1 Project + Schema Separation**

### ข้อดี
- ✅ ง่ายที่สุด - จัดการ 1 project
- ✅ Free tier - 500 MB
- ✅ แยกข้อมูลชัดเจน - schema แยกกัน
- ✅ 1 connection string - จัดการง่าย
- ✅ Cost effective - ไม่ต้องจ่ายเพิ่ม

### Structure
```
Organization (1)
└── Project (1)
    └── Database (1)
        ├── Schema: heng36
        ├── Schema: max56
        └── Schema: jeed24
```

---

## 🆘 Troubleshooting

### Schema ไม่พบ
```sql
-- ตรวจสอบ
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('heng36', 'max56', 'jeed24');
```

### Connection Error
- ตรวจสอบ password
- ตรวจสอบ `?sslmode=require`
- ตรวจสอบ firewall/network

### Tables ไม่พบ
- ตรวจสอบว่า migrations รันแล้ว
- ตรวจสอบ schema name ใน queries

---

พร้อมใช้งานแล้ว! 🚀

