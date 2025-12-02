# Migration Instructions: Create Reward Codes Table

## วิธีรัน Migration

### วิธีที่ 1: ใช้ psql Command Line (แนะนำ)

#### สำหรับ Windows (PowerShell หรือ Command Prompt):

```powershell
# ถ้าใช้ Supabase หรือ PostgreSQL Cloud
# ใช้ connection string จาก .env file
$env:DATABASE_URL_HENG36  # หรือ DATABASE_URL_MAX56, DATABASE_URL_JEED24

# รัน migration สำหรับ HENG36
psql $env:DATABASE_URL_HENG36 -f migrations/006_create_reward_codes_table.sql

# รัน migration สำหรับ MAX56 (ถ้ามี)
psql $env:DATABASE_URL_MAX56 -f migrations/006_create_reward_codes_table.sql

# รัน migration สำหรับ JEED24 (ถ้ามี)
psql $env:DATABASE_URL_JEED24 -f migrations/006_create_reward_codes_table.sql
```

#### สำหรับ Linux/Mac:

```bash
# รัน migration สำหรับ HENG36
psql $DATABASE_URL_HENG36 -f migrations/006_create_reward_codes_table.sql

# หรือใช้ connection string โดยตรง
psql "postgresql://user:password@host:port/database" -f migrations/006_create_reward_codes_table.sql
```

### วิธีที่ 2: ใช้ pgAdmin หรือ Database GUI

1. เปิด pgAdmin หรือ database GUI tool
2. เชื่อมต่อกับ database
3. เปิด SQL Query Editor
4. Copy เนื้อหาจาก `migrations/006_create_reward_codes_table.sql`
5. Paste และรัน (Execute)

### วิธีที่ 3: ใช้ Node.js Script (สำหรับ Supabase)

สร้างไฟล์ `run-migration.js`:

```javascript
import pg from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function runMigration() {
  const themes = ['heng36', 'max56', 'jeed24'];
  
  for (const theme of themes) {
    const dbUrl = process.env[`DATABASE_URL_${theme.toUpperCase()}`] || process.env.DATABASE_URL;
    
    if (!dbUrl) {
      console.log(`⚠️  Skipping ${theme} - no DATABASE_URL found`);
      continue;
    }
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('supabase') ? { rejectUnauthorized: false } : false
    });
    
    try {
      console.log(`🔄 Running migration for ${theme}...`);
      const sql = readFileSync('migrations/006_create_reward_codes_table.sql', 'utf8');
      await pool.query(sql);
      console.log(`✅ Migration completed for ${theme}`);
    } catch (error) {
      console.error(`❌ Migration failed for ${theme}:`, error.message);
    } finally {
      await pool.end();
    }
  }
}

runMigration();
```

รันด้วย:
```bash
node run-migration.js
```

## ตรวจสอบผลลัพธ์

หลังจากรัน migration แล้ว ตรวจสอบว่า table ถูกสร้างแล้ว:

```sql
-- ตรวจสอบ table ใน schema heng36
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'heng36' 
  AND table_name = 'reward_codes';

-- ตรวจสอบ indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'heng36' 
  AND tablename = 'reward_codes';
```

## Troubleshooting

### Error: "schema does not exist"
- ตรวจสอบว่า schema ถูกสร้างแล้ว (รัน `002_create_multi_theme_schemas.sql` ก่อน)
- หรือใช้ `public` schema แทน

### Error: "permission denied"
- ตรวจสอบว่า user มีสิทธิ์ CREATE TABLE และ CREATE INDEX
- สำหรับ Supabase: ใช้ service role key

### Error: "relation already exists"
- Migration ใช้ `CREATE TABLE IF NOT EXISTS` ดังนั้นจะไม่ error
- แต่ถ้า table มีอยู่แล้วและ structure ต่างกัน อาจต้อง drop table ก่อน

## หมายเหตุ

- Migration นี้จะสร้าง table `reward_codes` ในทุก schema (heng36, max56, jeed24, public)
- Indexes จะถูกสร้างอัตโนมัติ
- Migration เป็น idempotent (รันหลายครั้งได้ ไม่มีปัญหา)

