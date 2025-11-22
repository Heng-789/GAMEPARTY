# 📋 คู่มือการ Migration ข้อมูลเกมจาก RTDB ไป PostgreSQL

## 🎯 วัตถุประสงค์

Migration script นี้ใช้สำหรับย้ายข้อมูลเกมทั้งหมดจาก Firebase Realtime Database (RTDB) ไปยัง PostgreSQL

---

## 📋 ข้อกำหนดเบื้องต้น

1. ✅ ตาราง `games` ใน PostgreSQL ต้องถูกสร้างแล้ว (ผ่าน migration)
2. ✅ Environment variables ต้องถูกตั้งค่าแล้ว:
   - `DATABASE_URL_HENG36` (สำหรับ heng36)
   - `DATABASE_URL_MAX56` (สำหรับ max56)
   - `DATABASE_URL_JEED24` (สำหรับ jeed24)
3. ✅ Firebase configuration ถูกต้อง

---

## 🚀 วิธีใช้งาน

### 1. Migration สำหรับ HENG36

```bash
cd backend
node scripts/migrate-games-from-rtdb.js heng36
```

### 2. Migration สำหรับ MAX56

```bash
cd backend
node scripts/migrate-games-from-rtdb.js max56
```

### 3. Migration สำหรับ JEED24

```bash
cd backend
node scripts/migrate-games-from-rtdb.js jeed24
```

### 4. กำหนด Batch Size (ถ้าต้องการ)

```bash
# ใช้ batch size = 10 (default = 50)
node scripts/migrate-games-from-rtdb.js heng36 10
```

---

## 📊 โครงสร้างข้อมูล

### RTDB Structure
```
games/
  {gameId}/
    name: string
    type: string
    unlocked: boolean
    locked: boolean
    userAccessType: string
    selectedUsers: string[]
    codes: string[]
    codeCursor: number
    claimedBy: object
    puzzle: object
    numberPick: object
    football: object
    slot: object
    announce: object
    checkin: object
    trickOrTreat: object
    loyKrathong: object
    bingo: object
    createdAt: timestamp
    updatedAt: timestamp
```

### PostgreSQL Structure
```sql
games (
  game_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  unlocked BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  user_access_type VARCHAR(20) DEFAULT 'all',
  selected_users JSONB,
  game_data JSONB,  -- เก็บ game-specific data ทั้งหมด
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## 🔄 การ Transform ข้อมูล

### Top-level Properties → PostgreSQL Columns
- `name` → `name`
- `type` → `type`
- `unlocked` → `unlocked`
- `locked` → `locked`
- `userAccessType` → `user_access_type`
- `selectedUsers` → `selected_users` (JSONB)

### Game-specific Data → `game_data` JSONB
ข้อมูลต่อไปนี้จะถูกเก็บใน `game_data` JSONB:
- `puzzle`
- `numberPick`
- `football`
- `slot`
- `announce`
- `checkin`
- `trickOrTreat`
- `loyKrathong`
- `bingo`
- `codes`
- `codeCursor`
- `claimedBy`
- และ properties อื่นๆ ที่เหลือ

---

## ✅ การทำงาน

1. **Fetch Games จาก RTDB**
   - ดึงข้อมูลเกมทั้งหมดจาก `games/` path
   - ตรวจสอบว่ามีข้อมูลหรือไม่

2. **Transform ข้อมูล**
   - แปลงโครงสร้างข้อมูลจาก RTDB format เป็น PostgreSQL format
   - แยก top-level properties และ game-specific data

3. **Batch Processing**
   - แบ่งข้อมูลเป็น batch (default: 50 games ต่อ batch)
   - ใช้ transaction เพื่อความปลอดภัย

4. **UPSERT**
   - ใช้ `INSERT ... ON CONFLICT UPDATE` เพื่อ:
     - สร้างเกมใหม่ถ้ายังไม่มี
     - อัพเดตเกมที่มีอยู่แล้ว

5. **Summary**
   - แสดงสรุปผลการ migration
   - แสดง errors (ถ้ามี)

---

## 📊 Output ตัวอย่าง

```
🚀 Starting migration for theme: heng36
📊 Schema: heng36
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

## ⚠️ หมายเหตุ

1. **UPSERT Behavior**
   - ถ้าเกมมีอยู่แล้วใน PostgreSQL จะถูกอัพเดต
   - ถ้าเกมยังไม่มีจะถูกสร้างใหม่

2. **Validation**
   - เกมที่ไม่มี `name` หรือ `type` จะถูก skip
   - เกมที่ข้อมูลไม่ถูกต้องจะถูก skip

3. **Error Handling**
   - ถ้า batch ใดล้มเหลว จะ rollback transaction
   - Errors จะถูกเก็บและแสดงใน summary

4. **Performance**
   - ใช้ batch processing เพื่อประสิทธิภาพ
   - Default batch size = 50 (ปรับได้)

---

## 🔍 Troubleshooting

### Error: "No database pool found for theme"
- ตรวจสอบว่า environment variable ถูกตั้งค่าแล้ว
- ตรวจสอบว่า `.env` file มี `DATABASE_URL_<THEME>`

### Error: "No Firebase config found for theme"
- ตรวจสอบว่า theme ที่ระบุถูกต้อง (heng36, max56, jeed24)

### Error: "relation does not exist"
- ตรวจสอบว่า migration scripts ถูก run แล้ว
- ตรวจสอบว่า schema ถูกต้อง

### Games ไม่ถูก migrate
- ตรวจสอบว่า games มี `name` และ `type`
- ตรวจสอบ console logs เพื่อดู errors

---

## 📝 Checklist

ก่อน Migration:
- [ ] ตาราง `games` ถูกสร้างแล้ว
- [ ] Environment variables ถูกตั้งค่าแล้ว
- [ ] Firebase configuration ถูกต้อง
- [ ] Backup ข้อมูล PostgreSQL (ถ้าต้องการ)

หลัง Migration:
- [ ] ตรวจสอบจำนวนเกมที่ migrate
- [ ] ตรวจสอบ errors (ถ้ามี)
- [ ] ทดสอบการโหลดเกมจาก PostgreSQL
- [ ] ตรวจสอบข้อมูลเกมว่าถูกต้อง

---

**🎉 Migration script พร้อมใช้งานแล้ว!**

