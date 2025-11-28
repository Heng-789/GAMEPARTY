# Migration Guide: Performance Indexes

## ปัญหาที่พบ

คำสั่ง `psql -d your_database -f migrations/005_add_performance_indexes.sql` ไม่สามารถรันได้เพราะ:

1. **ระบบใช้ Supabase (cloud database)** ไม่ใช่ local PostgreSQL
2. **มีหลาย schema/theme** (heng36, max56, jeed24) ต้องรันแยก
3. **ต้องใช้ connection string** จาก environment variables
4. **ต้องรองรับ SSL** สำหรับ Supabase

## วิธีแก้ไข

### วิธีที่ 1: ใช้ Migration Script (แนะนำ) ✅

เราได้สร้าง migration script ที่รันผ่าน Node.js แล้ว:

```bash
# รันสำหรับทุก theme
cd backend
npm run migrate:indexes

# หรือรันสำหรับ theme เดียว
node scripts/add-performance-indexes.js heng36
node scripts/add-performance-indexes.js max56
node scripts/add-performance-indexes.js jeed24
```

**ข้อดี:**
- ✅ ใช้ connection pool ที่มีอยู่แล้ว
- ✅ รองรับ Supabase SSL อัตโนมัติ
- ✅ รองรับหลาย schema/theme
- ✅ มี error handling ที่ดี
- ✅ แสดง progress และ summary

### วิธีที่ 2: ใช้ Supabase Dashboard

1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. เลือก project ของคุณ
3. ไปที่ **SQL Editor**
4. Copy SQL จาก `migrations/005_add_performance_indexes.sql`
5. แก้ไข `{schema}` เป็น schema จริง (เช่น `public`, `heng36`, `max56`, `jeed24`)
6. รัน SQL

**ตัวอย่าง:**
```sql
-- ถ้าใช้ schema 'public'
CREATE INDEX IF NOT EXISTS idx_answers_game_id ON public.answers(game_id);

-- ถ้าใช้ schema 'heng36'
CREATE INDEX IF NOT EXISTS idx_answers_game_id ON heng36.answers(game_id);
```

### วิธีที่ 3: ใช้ psql กับ Connection String

ถ้าคุณต้องการใช้ `psql` โดยตรง:

```bash
# ใช้ connection string จาก .env
psql "postgresql://user:password@host:port/database?sslmode=require" -f migrations/005_add_performance_indexes.sql
```

**แต่ต้องแก้ไข SQL file ก่อน:**
- เปลี่ยน `{schema}` เป็น schema จริง
- หรือรันแยกตาม schema

## ตรวจสอบว่า Indexes ถูกสร้างแล้ว

### ผ่าน Migration Script:
Script จะแสดง summary เมื่อเสร็จ

### ผ่าน SQL Query:
```sql
-- ดู indexes ทั้งหมดใน schema
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'  -- หรือ 'heng36', 'max56', 'jeed24'
ORDER BY tablename, indexname;
```

### ผ่าน Backend API:
```bash
# ตรวจสอบ metrics (จะแสดง database health)
curl http://localhost:3000/api/utils/metrics
```

## Troubleshooting

### Error: "relation does not exist"
- **สาเหตุ**: Table ยังไม่มีใน database
- **แก้ไข**: สร้าง tables ก่อน (รัน migrations อื่นๆ ก่อน)

### Error: "index already exists"
- **สาเหตุ**: Index ถูกสร้างไว้แล้ว
- **แก้ไข**: ไม่เป็นไร, script จะข้ามไปอัตโนมัติ (ใช้ `IF NOT EXISTS`)

### Error: "permission denied"
- **สาเหตุ**: User ไม่มีสิทธิ์สร้าง index
- **แก้ไข**: ใช้ database user ที่มีสิทธิ์ `CREATE INDEX`

### Error: "connection refused" หรือ "SSL required"
- **สาเหตุ**: Connection string ไม่ถูกต้อง หรือไม่ได้เปิด SSL
- **แก้ไข**: ตรวจสอบ `DATABASE_URL_*` ใน `.env` file

## ตัวอย่าง Output

เมื่อรัน migration script สำเร็จ:

```
🚀 Starting Performance Indexes Migration
============================================================

📊 Applying indexes to theme: heng36 (schema: public)
------------------------------------------------------------
✅ Connected to heng36 database
  ✅ idx_answers_game_id (45ms)
  ✅ idx_answers_user_id (32ms)
  ✅ idx_checkins_game_id (38ms)
  ...

📈 Analyzing tables...
  ✅ Analyzed answers
  ✅ Analyzed checkins
  ...

✅ Completed for heng36: 25 indexes created

============================================================
📊 Migration Summary
============================================================
✅ heng36 (schema: public): 25 indexes
✅ max56 (schema: public): 25 indexes
✅ jeed24 (schema: public): 25 indexes

✅ Successful: 3/3

🎉 All migrations completed successfully!
```

## สรุป

**แนะนำให้ใช้:**
```bash
npm run migrate:indexes
```

วิธีนี้จะ:
- ✅ ทำงานกับ Supabase อัตโนมัติ
- ✅ รองรับหลาย theme
- ✅ มี error handling
- ✅ แสดง progress ชัดเจน

