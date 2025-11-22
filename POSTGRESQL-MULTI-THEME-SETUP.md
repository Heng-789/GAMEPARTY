# 🎨 Multi-Theme PostgreSQL Setup (Supabase)

คู่มือการตั้งค่า PostgreSQL สำหรับ 3 ธีม (heng36, max56, jeed24) บน Supabase

---

## 🎯 ตัวเลือกการจัดการ 3 ธีม

### Option 1: 1 Database + Schema Separation (แนะนำ) ⭐
**ใช้ 1 Supabase project, 1 database, แยกด้วย schema**

### Option 2: 1 Database + Table Prefix
**ใช้ 1 Supabase project, 1 database, แยกด้วย table prefix**

### Option 3: 3 Separate Projects
**ใช้ 3 Supabase projects (ถ้าต้องการแยกจริงๆ)**

---

## 🚀 Option 1: Schema Separation (แนะนำ)

### ข้อดี
- ✅ ใช้ Supabase 1 project เท่านั้น
- ✅ แยกข้อมูลชัดเจน (schema แยกกัน)
- ✅ ง่ายต่อการจัดการ
- ✅ ใช้ free tier ได้

### ข้อเสีย
- ⚠️ ต้องแก้ไข migration scripts

### Setup

#### Step 1: สร้าง Schemas
```sql
-- สร้าง schemas สำหรับแต่ละธีม
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;
```

#### Step 2: Update Migration Script
แก้ไข `migrations/001_create_tables.sql` ให้รองรับ schema:

```sql
-- แทนที่
CREATE TABLE users (...)

-- เป็น
CREATE TABLE heng36.users (...)
CREATE TABLE max56.users (...)
CREATE TABLE jeed24.users (...)
```

#### Step 3: Update Backend
แก้ไข `backend/src/config/database.js` ให้รองรับ schema:

```javascript
// ใช้ schema ตาม theme
const getSchema = (theme) => {
  const schemas = {
    heng36: 'heng36',
    max56: 'max56',
    jeed24: 'jeed24'
  };
  return schemas[theme] || 'public';
};

// ใน queries
pool.query(`SELECT * FROM ${getSchema(theme)}.users WHERE user_id = $1`, [userId]);
```

---

## 🚀 Option 2: Table Prefix (ง่ายที่สุด)

### ข้อดี
- ✅ ใช้ Supabase 1 project เท่านั้น
- ✅ ไม่ต้องแก้ไข migration scripts มาก
- ✅ ง่ายต่อการ migrate

### ข้อเสีย
- ⚠️ Table names ยาวขึ้น
- ⚠️ ต้องระวัง naming conflicts

### Setup

#### Step 1: Update Migration Script
แก้ไข table names ให้มี prefix:

```sql
-- แทนที่
CREATE TABLE users (...)
CREATE TABLE games (...)

-- เป็น
CREATE TABLE heng36_users (...)
CREATE TABLE heng36_games (...)
CREATE TABLE max56_users (...)
CREATE TABLE max56_games (...)
CREATE TABLE jeed24_users (...)
CREATE TABLE jeed24_games (...)
```

#### Step 2: Update Backend Routes
```javascript
// ใช้ table prefix ตาม theme
const getTablePrefix = (theme) => {
  const prefixes = {
    heng36: 'heng36',
    max56: 'max56',
    jeed24: 'jeed24'
  };
  return prefixes[theme] || 'heng36';
};

// ใน queries
const prefix = getTablePrefix(theme);
pool.query(`SELECT * FROM ${prefix}_users WHERE user_id = $1`, [userId]);
```

---

## 🚀 Option 3: 3 Separate Projects

### ข้อดี
- ✅ แยกข้อมูลชัดเจน 100%
- ✅ ไม่ต้องกังวล naming conflicts
- ✅ แต่ละ project มี quota แยกกัน

### ข้อเสีย
- ⚠️ ต้องจัดการ 3 projects
- ⚠️ ต้อง migrate 3 ครั้ง
- ⚠️ ใช้ free tier ได้ (แต่ละ project 500 MB)

### Setup

#### Step 1: สร้าง 3 Projects
1. **HENG36 Project**
   - Name: `heng36-game`
   - Region: Southeast Asia

2. **MAX56 Project**
   - Name: `max56-game`
   - Region: Southeast Asia

3. **JEED24 Project**
   - Name: `jeed24-game`
   - Region: Southeast Asia

#### Step 2: รับ Connection Info
แต่ละ project จะมี connection string แยกกัน:

```env
# HENG36
HENG36_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.abc123.supabase.co:5432/postgres?sslmode=require

# MAX56
MAX56_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.def456.supabase.co:5432/postgres?sslmode=require

# JEED24
JEED24_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.ghi789.supabase.co:5432/postgres?sslmode=require
```

#### Step 3: Update Backend Config
```javascript
// backend/src/config/database.js
const getDatabaseUrl = (theme) => {
  const urls = {
    heng36: process.env.HENG36_DATABASE_URL,
    max56: process.env.MAX56_DATABASE_URL,
    jeed24: process.env.JEED24_DATABASE_URL
  };
  return urls[theme] || urls.heng36;
};

// Create separate pools for each theme
const pools = {
  heng36: new Pool({ connectionString: getDatabaseUrl('heng36'), ssl: { rejectUnauthorized: false } }),
  max56: new Pool({ connectionString: getDatabaseUrl('max56'), ssl: { rejectUnauthorized: false } }),
  jeed24: new Pool({ connectionString: getDatabaseUrl('jeed24'), ssl: { rejectUnauthorized: false } })
};

export const getPool = (theme) => pools[theme] || pools.heng36;
export default pools.heng36; // default
```

#### Step 4: Update Routes
```javascript
// backend/src/routes/users.js
import { getPool } from '../config/database.js';

router.get('/:userId', async (req, res) => {
  const theme = req.headers['x-theme'] || 'heng36'; // หรือจาก query/body
  const pool = getPool(theme);
  
  const result = await pool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
  );
  // ...
});
```

---

## 📊 Comparison

| Method | Supabase Projects | Complexity | Separation | Recommended |
|--------|------------------|------------|------------|-------------|
| **Schema Separation** | 1 | ⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Best |
| **Table Prefix** | 1 | ⭐⭐ | ⭐⭐⭐ | ✅ Good |
| **3 Projects** | 3 | ⭐ | ⭐⭐⭐⭐⭐ | ⚠️ If needed |

---

## 🎯 แนะนำ: Option 1 (Schema Separation)

### ทำไม?
- ✅ ใช้ Supabase 1 project เท่านั้น
- ✅ แยกข้อมูลชัดเจน
- ✅ ง่ายต่อการจัดการ
- ✅ ใช้ free tier ได้

### Implementation

#### 1. Update Migration Script
```sql
-- migrations/001_create_tables.sql
-- สร้าง schemas
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;

-- สร้าง tables ในแต่ละ schema
CREATE TABLE heng36.users (
  user_id VARCHAR(255) PRIMARY KEY,
  -- ...
);

CREATE TABLE max56.users (
  user_id VARCHAR(255) PRIMARY KEY,
  -- ...
);

CREATE TABLE jeed24.users (
  user_id VARCHAR(255) PRIMARY KEY,
  -- ...
);
```

#### 2. Update Backend Config
```javascript
// backend/src/config/database.js
export const getSchema = (theme) => {
  const schemas = {
    heng36: 'heng36',
    max56: 'max56',
    jeed24: 'jeed24'
  };
  return schemas[theme] || 'heng36';
};

// Helper function for queries
export const queryWithSchema = async (theme, query, params) => {
  const schema = getSchema(theme);
  const schemaQuery = query.replace(/FROM (\w+)/g, `FROM ${schema}.$1`);
  return pool.query(schemaQuery, params);
};
```

#### 3. Update Routes
```javascript
// backend/src/routes/users.js
import { getSchema } from '../config/database.js';

router.get('/:userId', async (req, res) => {
  const theme = req.query.theme || req.headers['x-theme'] || 'heng36';
  const schema = getSchema(theme);
  
  const result = await pool.query(
    `SELECT * FROM ${schema}.users WHERE user_id = $1`,
    [userId]
  );
  // ...
});
```

---

## 🔧 Quick Setup (Schema Separation)

### Step 1: สร้าง 1 Supabase Project
1. ไปที่ https://supabase.com
2. สร้าง project: `heng36game-multi-theme`
3. เลือก region: Southeast Asia

### Step 2: สร้าง Schemas
```sql
-- ไปที่ SQL Editor → New Query
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;
```

### Step 3: Run Migrations สำหรับแต่ละ Schema
```sql
-- Run migrations 3 ครั้ง (เปลี่ยน schema name)
-- ครั้งที่ 1: heng36
-- ครั้งที่ 2: max56  
-- ครั้งที่ 3: jeed24
```

### Step 4: Update Backend
```env
# backend/.env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

---

## 📝 Migration Script สำหรับ Multi-Theme

สร้าง script ใหม่: `migrations/002_create_multi_theme_schemas.sql`

```sql
-- สร้าง schemas
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;

-- สร้าง tables ในแต่ละ schema (ใช้ function)
DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN SELECT unnest(ARRAY['heng36', 'max56', 'jeed24']) LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I.users (
      user_id VARCHAR(255) PRIMARY KEY,
      password VARCHAR(255),
      hcoin DECIMAL(15,2) DEFAULT 0,
      status VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )', schema_name);
    
    -- สร้าง tables อื่นๆ ในแต่ละ schema
    -- ...
  END LOOP;
END $$;
```

---

## 🎯 สรุป

### คำตอบ: ไม่ต้องสมัคร 3 Supabase projects

**แนะนำ: ใช้ 1 Supabase project + Schema Separation**

- ✅ ใช้ Supabase 1 project เท่านั้น
- ✅ แยกข้อมูลด้วย schema (heng36, max56, jeed24)
- ✅ ง่ายต่อการจัดการ
- ✅ ใช้ free tier ได้

---

## 🚀 Next Steps

1. ✅ สร้าง 1 Supabase project
2. ✅ สร้าง 3 schemas
3. ✅ Run migrations สำหรับแต่ละ schema
4. ✅ Update backend ให้รองรับ multi-theme
5. ✅ Test ทุก theme

ต้องการให้ฉันสร้าง migration scripts และอัพเดท backend ให้รองรับ multi-theme ไหม?

