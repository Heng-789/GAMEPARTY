# 🏢 Supabase Organization Setup สำหรับ 3 ธีม

คู่มือการตั้งค่า Supabase Organization และ Projects สำหรับ 3 ธีม (heng36, max56, jeed24)

---

## 🎯 ตัวเลือกการตั้งค่า

### Option 1: 1 Organization + 1 Project + Schema Separation (แนะนำ) ⭐⭐⭐
**รวมกัน - ใช้ schema แยกข้อมูล**

### Option 2: 1 Organization + 3 Projects (แยก Projects)
**แยก Projects แต่ละธีม**

### Option 3: 3 Organizations (แยก Organizations)
**แยก Organizations แต่ละธีม - ไม่แนะนำ**

---

## 🚀 Option 1: 1 Organization + 1 Project (แนะนำ)

### ข้อดี
- ✅ **ง่ายที่สุด** - จัดการ 1 project เท่านั้น
- ✅ **ใช้ free tier ได้** - 500 MB รวมกัน
- ✅ **แยกข้อมูลชัดเจน** - ใช้ schema (heng36, max56, jeed24)
- ✅ **จัดการง่าย** - 1 connection string
- ✅ **Cost effective** - ไม่ต้องจ่ายเพิ่ม

### ข้อเสีย
- ⚠️ ต้องระวัง schema naming
- ⚠️ ต้องแก้ไข migration scripts

### Setup

#### Step 1: สร้าง Organization
1. ไปที่ https://supabase.com
2. สร้าง Organization:
   - **Name**: `HENG36GAME` (หรือชื่อที่ต้องการ)
   - **Type**: Personal หรือ Company (ตามต้องการ)
   - **Plan**: Free - $0/month

#### Step 2: สร้าง 1 Project
1. ใน Organization ที่สร้าง
2. **New Project**:
   - **Name**: `heng36game-multi-theme`
   - **Database Password**: ตั้งรหัสผ่านที่แข็งแรง
   - **Region**: Southeast Asia (Singapore)
   - **Plan**: Free

#### Step 3: สร้าง Schemas
ไปที่ **SQL Editor** → **New Query**:
```sql
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;
```

#### Step 4: Run Migration
```sql
-- Run migrations/002_create_multi_theme_schemas.sql
```

#### Step 5: Connection Info
```env
# ใช้ connection string เดียวกันสำหรับทั้ง 3 ธีม
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

---

## 🚀 Option 2: 1 Organization + 3 Projects

### ข้อดี
- ✅ **แยกข้อมูลชัดเจน 100%** - แต่ละ project แยกกัน
- ✅ **แต่ละ project มี quota แยก** - 500 MB × 3 = 1.5 GB
- ✅ **ไม่ต้องกังวล schema** - ใช้ public schema
- ✅ **ง่ายต่อการ backup/restore** - แยก project

### ข้อเสีย
- ⚠️ ต้องจัดการ 3 projects
- ⚠️ ต้อง migrate 3 ครั้ง
- ⚠️ ต้องมี 3 connection strings

### Setup

#### Step 1: สร้าง Organization
1. สร้าง Organization: `HENG36GAME`
2. **Type**: Personal หรือ Company
3. **Plan**: Free

#### Step 2: สร้าง 3 Projects
1. **Project 1: HENG36**
   - Name: `heng36-game`
   - Region: Southeast Asia
   - Plan: Free

2. **Project 2: MAX56**
   - Name: `max56-game`
   - Region: Southeast Asia
   - Plan: Free

3. **Project 3: JEED24**
   - Name: `jeed24-game`
   - Region: Southeast Asia
   - Plan: Free

#### Step 3: Connection Info
```env
# HENG36
HENG36_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.abc123.supabase.co:5432/postgres?sslmode=require

# MAX56
MAX56_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.def456.supabase.co:5432/postgres?sslmode=require

# JEED24
JEED24_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.ghi789.supabase.co:5432/postgres?sslmode=require
```

#### Step 4: Run Migrations
```bash
# HENG36
DATABASE_URL=$HENG36_DATABASE_URL psql -f migrations/001_create_tables.sql

# MAX56
DATABASE_URL=$MAX56_DATABASE_URL psql -f migrations/001_create_tables.sql

# JEED24
DATABASE_URL=$JEED24_DATABASE_URL psql -f migrations/001_create_tables.sql
```

---

## 🚀 Option 3: 3 Organizations (ไม่แนะนำ)

### ข้อดี
- ✅ แยกชัดเจนที่สุด

### ข้อเสีย
- ❌ **ซับซ้อนเกินไป** - จัดการ 3 organizations
- ❌ **ไม่จำเป็น** - ไม่มีประโยชน์เพิ่มเติม
- ❌ **ยากต่อการจัดการ** - ต้อง login หลาย accounts

### ไม่แนะนำ
ใช้ Option 1 หรือ Option 2 แทน

---

## 📊 Comparison Table

| Method | Organization | Projects | Complexity | Free Tier | Recommended |
|--------|--------------|----------|------------|-----------|-------------|
| **Option 1: Schema Separation** | 1 | 1 | ⭐⭐ | 500 MB | ✅ **Best** |
| **Option 2: 3 Projects** | 1 | 3 | ⭐⭐⭐ | 1.5 GB | ✅ Good |
| **Option 3: 3 Organizations** | 3 | 3 | ⭐⭐⭐⭐⭐ | 1.5 GB | ❌ Not recommended |

---

## 🎯 แนะนำ: Option 1 (1 Organization + 1 Project)

### ทำไม?
- ✅ **ง่ายที่สุด** - จัดการ 1 project
- ✅ **ใช้ free tier ได้** - 500 MB
- ✅ **แยกข้อมูลชัดเจน** - ใช้ schema
- ✅ **Cost effective** - ไม่ต้องจ่ายเพิ่ม
- ✅ **จัดการง่าย** - 1 connection string

### Database Structure
```
Organization: HENG36GAME
└── Project: heng36game-multi-theme
    └── Database: postgres
        ├── Schema: heng36
        │   ├── users
        │   ├── games
        │   └── ...
        ├── Schema: max56
        │   ├── users
        │   ├── games
        │   └── ...
        └── Schema: jeed24
            ├── users
            ├── games
            └── ...
```

---

## 🔧 Setup Guide (Option 1 - แนะนำ)

### Step 1: สร้าง Organization
1. ไปที่ https://supabase.com
2. คลิก **"New organization"**
3. ตั้งค่า:
   - **Name**: `HENG36GAME`
   - **Type**: Personal (หรือ Company)
   - **Plan**: Free - $0/month
4. คลิก **"Create organization"**

### Step 2: สร้าง Project
1. ใน Organization ที่สร้าง
2. คลิก **"New project"**
3. ตั้งค่า:
   - **Name**: `heng36game-multi-theme`
   - **Database Password**: ตั้งรหัสผ่าน (จำไว้!)
   - **Region**: Southeast Asia (Singapore)
   - **Plan**: Free
4. คลิก **"Create new project"**
5. รอให้สร้างเสร็จ (~2 นาที)

### Step 3: รับ Connection Info
1. ไปที่ **Settings** → **Database**
2. คัดลอก **Connection string**:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
   หรือ **Connection pooling**:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### Step 4: สร้าง Schemas
1. ไปที่ **SQL Editor** → **New Query**
2. Paste:
   ```sql
   CREATE SCHEMA IF NOT EXISTS heng36;
   CREATE SCHEMA IF NOT EXISTS max56;
   CREATE SCHEMA IF NOT EXISTS jeed24;
   ```
3. คลิก **"Run"**

### Step 5: Run Migrations
1. ไปที่ **SQL Editor** → **New Query**
2. Copy เนื้อหาจาก `migrations/002_create_multi_theme_schemas.sql`
3. Paste และ Run

### Step 6: Setup Backend
```env
# backend/.env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

---

## 📝 เมื่อไหร่ควรใช้ Option 2?

ใช้ **Option 2 (3 Projects)** ถ้า:
- ✅ ต้องการแยกข้อมูล 100% (ไม่มีโอกาสปนกัน)
- ✅ ต้องการ quota แยกกัน (1.5 GB แทน 500 MB)
- ✅ ต้องการ backup/restore แยกกัน
- ✅ ต้องการให้ทีมต่างกันจัดการแต่ละ theme

---

## ✅ สรุปคำแนะนำ

### สำหรับกรณีนี้: **Option 1 (1 Organization + 1 Project)**

**ทำไม?**
- ✅ ง่ายที่สุด
- ✅ ใช้ free tier ได้
- ✅ แยกข้อมูลชัดเจนด้วย schema
- ✅ จัดการง่าย

**Setup:**
1. สร้าง 1 Organization
2. สร้าง 1 Project
3. สร้าง 3 Schemas (heng36, max56, jeed24)
4. Run migrations
5. ใช้ connection string เดียว

---

## 🎯 Next Steps

1. ✅ สร้าง Organization บน Supabase
2. ✅ สร้าง 1 Project
3. ✅ สร้าง 3 Schemas
4. ✅ Run migrations
5. ✅ Setup backend
6. ✅ Test connection

พร้อมเริ่มใช้งานแล้ว! 🚀

