# 🚀 คู่มือการโยกย้ายข้อมูลเกมจาก Firebase ไป PostgreSQL (แบบง่าย)

## 📋 สรุป

คู่มือนี้จะช่วยคุณดึงข้อมูลเกมทั้งหมดจาก Firebase Realtime Database ไปยัง PostgreSQL

---

## ✅ ข้อกำหนดเบื้องต้น

1. **Environment Variables** ต้องตั้งค่าแล้ว:
   - `DATABASE_URL_HENG36` (สำหรับ heng36)
   - `DATABASE_URL_MAX56` (สำหรับ max56)
   - `DATABASE_URL_JEED24` (สำหรับ jeed24)

2. **Database Tables** ต้องสร้างแล้ว:
   - ตาราง `games` ใน PostgreSQL

---

## 🚀 วิธีใช้งาน (3 ขั้นตอน)

### Step 1: ตรวจสอบ Environment Variables

ตรวจสอบว่าไฟล์ `backend/.env` มี environment variables ครบถ้วน:

```bash
# ตัวอย่าง backend/.env
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### Step 2: เข้าไปที่ backend directory

```bash
cd backend
```

### Step 3: รัน Migration Script

#### สำหรับ HENG36:
```bash
node scripts/migrate-games-from-rtdb.js heng36
```

#### สำหรับ MAX56:
```bash
node scripts/migrate-games-from-rtdb.js max56
```

#### สำหรับ JEED24:
```bash
node scripts/migrate-games-from-rtdb.js jeed24
```

---

## 📊 ตัวอย่าง Output

```
🚀 Starting migration for theme: heng36
📊 Schema: public
📦 Batch size: 50

📥 Fetching games from RTDB...
✅ Found 25 games in RTDB

📦 Processing batch 1/1 (25 games)...
  ✅ Batch 1 completed: 25 migrated, 0 skipped, 0 failed

📊 Migration Summary:
   Total games: 25
   ✅ Migrated: 25
   ⏭️  Skipped: 0
   ❌ Failed: 0

✅ Migration completed successfully!
```

---

## ⚙️ ตัวเลือกเพิ่มเติม

### กำหนด Batch Size (ถ้ามีเกมจำนวนมาก)

```bash
# ใช้ batch size = 10 (default = 50)
node scripts/migrate-games-from-rtdb.js heng36 10
```

### Migrate ทุก Theme พร้อมกัน

```bash
# HENG36
node scripts/migrate-games-from-rtdb.js heng36

# MAX56
node scripts/migrate-games-from-rtdb.js max56

# JEED24
node scripts/migrate-games-from-rtdb.js jeed24
```

---

## 🔍 ตรวจสอบผลลัพธ์

### ตรวจสอบจำนวนเกมใน PostgreSQL

```sql
-- เชื่อมต่อ PostgreSQL และรันคำสั่งนี้
SELECT COUNT(*) FROM games;
```

### ตรวจสอบข้อมูลเกม

```sql
-- ดูรายการเกมทั้งหมด
SELECT game_id, name, type, created_at FROM games ORDER BY created_at DESC;
```

---

## ⚠️ หมายเหตุสำคัญ

1. **UPSERT Behavior**:
   - ถ้าเกมมีอยู่แล้วใน PostgreSQL จะถูก **อัพเดต** (ไม่สร้างซ้ำ)
   - ถ้าเกมยังไม่มีจะถูก **สร้างใหม่**

2. **ข้อมูลที่ถูก Migrate**:
   - ✅ ชื่อเกม (`name`)
   - ✅ ประเภทเกม (`type`)
   - ✅ สถานะ (`unlocked`, `locked`)
   - ✅ การเข้าถึง (`userAccessType`, `selectedUsers`)
   - ✅ ข้อมูลเกมทั้งหมด (`puzzle`, `slot`, `bingo`, etc.)
   - ✅ โค้ด (`codes`, `codeCursor`, `claimedBy`)
   - ✅ Timestamps (`createdAt`, `updatedAt`)

3. **ข้อมูลที่ถูก Skip**:
   - เกมที่ไม่มี `name` หรือ `type`
   - เกมที่ข้อมูลไม่ถูกต้อง

---

## 🐛 Troubleshooting

### Error: "No database pool found for theme"
**แก้ไข**: ตรวจสอบว่า environment variable ถูกตั้งค่าแล้ว
```bash
# ตรวจสอบ .env file
cat backend/.env | grep DATABASE_URL
```

### Error: "No Firebase config found for theme"
**แก้ไข**: ตรวจสอบว่า theme ที่ระบุถูกต้อง (heng36, max56, jeed24)

### Error: "relation does not exist"
**แก้ไข**: ตรวจสอบว่า migration scripts ถูก run แล้ว
```bash
# รัน migration เพื่อสร้างตาราง
cd backend
node scripts/migrate.js
```

### ไม่มีเกมถูก migrate
**แก้ไข**: 
1. ตรวจสอบว่า Firebase มีข้อมูลเกมอยู่จริง
2. ตรวจสอบ console logs เพื่อดู errors
3. ตรวจสอบว่าเกมมี `name` และ `type`

---

## 📝 Checklist

ก่อน Migration:
- [ ] Environment variables ถูกตั้งค่าแล้ว (`DATABASE_URL_*`)
- [ ] ตาราง `games` ถูกสร้างแล้ว
- [ ] Backup ข้อมูล PostgreSQL (ถ้าต้องการ)

หลัง Migration:
- [ ] ตรวจสอบจำนวนเกมที่ migrate
- [ ] ตรวจสอบ errors (ถ้ามี)
- [ ] ทดสอบการโหลดเกมจาก PostgreSQL
- [ ] ตรวจสอบข้อมูลเกมว่าถูกต้อง

---

## 🎯 สรุป

1. **เข้า backend directory**: `cd backend`
2. **รัน migration**: `node scripts/migrate-games-from-rtdb.js <theme>`
3. **ตรวจสอบผลลัพธ์**: ดู console output

**🎉 เสร็จแล้ว! ข้อมูลเกมทั้งหมดจะถูกโยกย้ายไป PostgreSQL**

---

## 📚 เอกสารเพิ่มเติม

- คู่มือละเอียด: `backend/scripts/MIGRATE-GAMES-GUIDE.md`
- Migration script: `backend/scripts/migrate-games-from-rtdb.js`

