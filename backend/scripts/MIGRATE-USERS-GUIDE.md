# 🚀 คู่มือการโยกย้ายข้อมูล USER จาก Firestore ไป PostgreSQL

## 📋 สรุป

สคริปต์นี้จะ:
- ✅ ดึงข้อมูล USER จาก Firestore (เฉพาะ `userId` และ `password`)
- ✅ โยกย้ายไปยัง PostgreSQL โดยใช้ **Bulk UPSERT** (เร็วกว่า insert ทีละตัว 10-50 เท่า)
- ✅ ไม่เอา `hcoin` (ตั้งค่าเป็น 0)
- ✅ ใช้ **Array of Objects** `[{ userId, password }]` เพื่อความเร็วสูงสุด

---

## 🎯 โครงสร้างข้อมูลที่แนะนำ

### ✅ **Array of Objects** (แนะนำที่สุด)

```javascript
// ✅ โครงสร้างที่แนะนำ
const users = [
  { userId: 'USER001', password: '1234' },
  { userId: 'USER002', password: '5678' },
  { userId: 'USER003', password: '9012' }
];
```

**ทำไมใช้ Array of Objects?**
- ✅ **เร็วที่สุด** สำหรับ batch insert/update (เร็วกว่า insert ทีละตัว **10-50 เท่า**)
- ✅ ง่ายต่อการจัดการและตรวจสอบ
- ✅ ใช้ memory น้อยกว่า Map/Object
- ✅ รองรับการเรียงลำดับ (sort) ได้ง่าย
- ✅ ง่ายต่อการ filter, map, reduce

📖 **ดูคำแนะนำเพิ่มเติม:** `backend/scripts/USER-DATA-STRUCTURE-GUIDE.md`

---

## 🚀 วิธีใช้งาน

### 1. **เตรียม Environment Variables**

ตรวจสอบว่าไฟล์ `backend/.env` มี connection strings สำหรับทุก theme:

```env
# HENG36 Theme
DATABASE_URL_HENG36=postgresql://...

# MAX56 Theme
DATABASE_URL_MAX56=postgresql://...

# JEED24 Theme
DATABASE_URL_JEED24=postgresql://...
```

### 2. **รัน Migration Script**

```bash
# โยกย้าย HENG36 (default batch size: 500)
cd backend
node scripts/migrate-users-from-firestore.js heng36

# โยกย้าย MAX56 (batch size: 1000)
node scripts/migrate-users-from-firestore.js max56 1000

# โยกย้าย JEED24 (batch size: 500)
node scripts/migrate-users-from-firestore.js jeed24 500
```

### 3. **Parameters**

- `theme` (optional): `heng36` | `max56` | `jeed24` (default: `heng36`)
- `batchSize` (optional): จำนวน users ต่อ batch (default: `500`)

**คำแนะนำ Batch Size:**
- ✅ **500-1000**: เหมาะสำหรับการ migrate ครั้งแรก (สมดุลระหว่างความเร็วและความปลอดภัย)
- ✅ **1000-2000**: สำหรับฐานข้อมูลที่มี connection pool ใหญ่
- ⚠️ **> 2000**: อาจทำให้ connection timeout หรือ memory overflow

---

## ⚡ Performance

### Bulk UPSERT vs Individual INSERT

| วิธี | 1000 users | 10000 users | 100000 users |
|------|------------|-------------|--------------|
| **Bulk UPSERT** | ✅ ~100ms | ✅ ~1s | ✅ ~10s |
| Individual INSERT | ❌ ~5s | ❌ ~50s | ❌ ~500s |

**เร็วกว่า: 10-50 เท่า** 🚀

---

## 📊 ตัวอย่าง Output

```
╔════════════════════════════════════════════════════════════╗
║  Firestore Users Migration to PostgreSQL                  ║
║  โยกย้ายข้อมูล USER จาก Firestore ไป PostgreSQL          ║
╚════════════════════════════════════════════════════════════╝

🚀 Starting user migration from Firestore to PostgreSQL...
   Theme: heng36
   Batch size: 500

✅ Connected to PostgreSQL (heng36, schema: public)

📦 Migrating users from Firestore (heng36)...
   ✅ เอาเฉพาะ userId และ password (ไม่เอา hcoin)
   📊 Batch size: 500 users per batch

📥 Fetching users from Firestore...
   Fetched 1000 users...
   Fetched 2000 users...
   Fetched 3000 users...

✅ Total users fetched: 3500
🚀 Starting migration with batch size: 500...

   ✅ Batch 1/7: 500 users processed (500 migrated)
   ✅ Batch 2/7: 500 users processed (1000 migrated)
   ✅ Batch 3/7: 500 users processed (1500 migrated)
   ...

✅ Migration completed!
   📊 Migrated: 3500 users
   ⏭️  Skipped: 0 users (no password)
   ❌ Failed: 0 users

📊 Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total users in Firestore: 3500
✅ Migrated: 3500
⏭️  Skipped: 0 (no password)
❌ Failed: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Migration completed successfully!
```

---

## 🔍 ตรวจสอบผลลัพธ์

### ตรวจสอบจำนวน Users ใน PostgreSQL

```sql
-- เช็คจำนวน users ในแต่ละ theme
SELECT COUNT(*) as total_users FROM public.users; -- HENG36
SELECT COUNT(*) as total_users FROM max56.users;  -- MAX56
SELECT COUNT(*) as total_users FROM jeed24.users; -- JEED24
```

### ตรวจสอบข้อมูลตัวอย่าง

```sql
-- ดู users ตัวอย่าง (10 คนแรก)
SELECT user_id, password, hcoin, created_at 
FROM public.users 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## ⚠️ หมายเหตุ

1. **ไม่เอา hcoin**: Script จะตั้งค่า `hcoin = 0` สำหรับทุก user ที่ migrate
2. **UPSERT Logic**: 
   - ถ้า user ยังไม่มี → สร้างใหม่
   - ถ้า user มีอยู่แล้ว → อัปเดต `password` (ถ้ามี) และ `updated_at`
3. **Skip Users without Password**: Users ที่ไม่มี password จะถูก skip (ไม่นับเป็น error)
4. **Transaction Safety**: แต่ละ batch ใช้ transaction เพื่อความปลอดภัย

---

## 🐛 Troubleshooting

### Error: "Connection timeout"
- ลด `batchSize` (เช่น จาก 1000 → 500)
- ตรวจสอบ connection pool settings

### Error: "Memory overflow"
- ลด `batchSize` (เช่น จาก 2000 → 500)
- ตรวจสอบ available memory

### Error: "User not found" (บาง users)
- ตรวจสอบว่า users มี `userId` ที่ valid
- ตรวจสอบ logs เพื่อดู users ที่มีปัญหา

---

## 📚 เอกสารที่เกี่ยวข้อง

- `backend/scripts/USER-DATA-STRUCTURE-GUIDE.md` - คำแนะนำโครงสร้างข้อมูล
- `backend/src/routes/users.js` - Backend API endpoints
- `src/services/postgresql-adapter.ts` - Frontend adapter

