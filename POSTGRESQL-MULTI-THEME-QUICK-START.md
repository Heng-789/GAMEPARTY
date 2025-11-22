# ⚡ Multi-Theme PostgreSQL Quick Start (Supabase)

คู่มือเริ่มต้นใช้งาน PostgreSQL สำหรับ 3 ธีมบน Supabase 1 project

---

## 🎯 คำตอบ: ไม่ต้องสมัคร 3 Supabase projects!

**ใช้ Supabase 1 project + Schema Separation**

---

## 🚀 Setup (5 นาที)

### Step 1: สร้าง 1 Supabase Project
1. ไปที่ https://supabase.com
2. สร้าง project: `heng36game-multi-theme`
3. Region: Southeast Asia (Singapore)
4. ตั้ง database password

### Step 2: รับ Connection Info
ไปที่ **Settings** → **Database**:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

### Step 3: สร้าง Schemas
ไปที่ **SQL Editor** → **New Query**:

```sql
-- สร้าง schemas สำหรับ 3 ธีม
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;
```

### Step 4: Run Multi-Theme Migration
```sql
-- Copy เนื้อหาจาก migrations/002_create_multi_theme_schemas.sql
-- Paste ใน SQL Editor
-- Run query
```

หรือใช้ psql:
```bash
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require" -f migrations/002_create_multi_theme_schemas.sql
```

### Step 5: Setup Backend
```bash
cd backend
cp .env.example .env
```

แก้ไข `.env`:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

### Step 6: Test
```bash
npm run test:connection
```

---

## 📝 วิธีใช้งาน

### API Calls

#### ระบุ Theme จาก Query
```bash
# HENG36
curl http://localhost:3000/api/users/USER123?theme=heng36

# MAX56
curl http://localhost:3000/api/users/USER123?theme=max56

# JEED24
curl http://localhost:3000/api/users/USER123?theme=jeed24
```

#### ระบุ Theme จาก Header
```bash
curl -H "X-Theme: max56" http://localhost:3000/api/users/USER123
```

#### ระบุ Theme จาก Body
```bash
curl -X POST http://localhost:3000/api/users/USER123 \
  -H "Content-Type: application/json" \
  -d '{"theme": "jeed24", "hcoin": 1000}'
```

---

## 🔍 ตรวจสอบ Schemas

```sql
-- ดู schemas ทั้งหมด
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('heng36', 'max56', 'jeed24');

-- ดู tables ในแต่ละ schema
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('heng36', 'max56', 'jeed24')
ORDER BY table_schema, table_name;
```

---

## 📊 Database Structure

```
postgres (database)
├── heng36 (schema)
│   ├── users
│   ├── games
│   ├── checkins
│   └── ...
├── max56 (schema)
│   ├── users
│   ├── games
│   ├── checkins
│   └── ...
└── jeed24 (schema)
    ├── users
    ├── games
    ├── checkins
    └── ...
```

---

## 🎯 Migration Data

### Migrate สำหรับแต่ละ Theme

```bash
# HENG36
node scripts/migrate-from-firebase.js heng36

# MAX56
node scripts/migrate-from-firebase.js max56

# JEED24
node scripts/migrate-from-firebase.js jeed24
```

**Note:** ต้องแก้ไข migration script ให้รองรับ schema (จะอัพเดทให้)

---

## ✅ สรุป

- ✅ **ใช้ Supabase 1 project เท่านั้น**
- ✅ **แยกข้อมูลด้วย schema** (heng36, max56, jeed24)
- ✅ **ง่ายต่อการจัดการ**
- ✅ **ใช้ free tier ได้** (500 MB รวมกัน)

---

## 🆘 Troubleshooting

### Schema ไม่พบ
```sql
-- ตรวจสอบว่า schema มีอยู่
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('heng36', 'max56', 'jeed24');
```

### Table ไม่พบ
```sql
-- ตรวจสอบว่า tables ถูกสร้างใน schema
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema = 'heng36';
```

---

พร้อมใช้งาน Multi-Theme PostgreSQL แล้ว! 🚀

