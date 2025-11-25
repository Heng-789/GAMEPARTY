# Migration Guide: Answers from Firebase RTDB to PostgreSQL

## 📋 Overview

Script นี้ใช้สำหรับย้ายข้อมูลคำตอบ (answers) จาก Firebase Realtime Database ไป PostgreSQL

**⚠️ หมายเหตุ:** Script `migrate-games-from-rtdb.js` ย้ายเฉพาะข้อมูลเกม ไม่ได้ย้าย answers ดังนั้นต้องใช้ script นี้แยกต่างหาก

---

## 🚀 Prerequisites

1. **Environment Variables** (ตั้งค่าใน `.env` หรือ environment):
   ```bash
   DATABASE_URL_HENG36=postgresql://...
   DATABASE_URL_MAX56=postgresql://...
   DATABASE_URL_JEED24=postgresql://...
   ```

2. **PostgreSQL Table** ต้องมี table `answers` ที่มีโครงสร้าง:
   ```sql
   CREATE TABLE answers (
     id SERIAL PRIMARY KEY,
     game_id VARCHAR(255) NOT NULL,
     user_id VARCHAR(255) NOT NULL,
     answer TEXT NOT NULL,
     correct BOOLEAN DEFAULT false,
     code VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

---

## 📖 Usage

### Basic Usage

```bash
# ย้าย answers สำหรับ heng36
node backend/scripts/migrate-answers-from-rtdb.js heng36

# ย้าย answers สำหรับ max56
node backend/scripts/migrate-answers-from-rtdb.js max56

# ย้าย answers สำหรับ jeed24
node backend/scripts/migrate-answers-from-rtdb.js jeed24
```

### Advanced Usage (Custom Batch Size)

```bash
# ใช้ batch size 50 (default: 100)
node backend/scripts/migrate-answers-from-rtdb.js heng36 50

# ใช้ batch size 200 (สำหรับข้อมูลจำนวนมาก)
node backend/scripts/migrate-answers-from-rtdb.js heng36 200
```

---

## 📊 Data Structure

### Firebase RTDB Structure

```
answers/
  {gameId}/
    {dateKey}/          # Format: YYYYMMDD (เช่น 20240125)
      {answerId}/        # Timestamp หรือ unique ID
        user: "USERNAME"
        answer: "คำตอบ"
        ts: 1234567890
        correct: true/false
        code: "CODE123"
        # ... ข้อมูลเพิ่มเติม
```

หรือ

```
answers/
  {gameId}/
    {answerId}/         # Timestamp หรือ unique ID
      user: "USERNAME"
      answer: "คำตอบ"
      ts: 1234567890
      # ... ข้อมูลเพิ่มเติม
```

### PostgreSQL Structure

```sql
answers (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  answer TEXT NOT NULL,           # อาจเป็น JSON string สำหรับข้อมูลเพิ่มเติม
  correct BOOLEAN DEFAULT false,
  code VARCHAR(255),
  created_at TIMESTAMP
)
```

---

## 🔄 Data Transformation

### Field Mapping

| Firebase RTDB | PostgreSQL | Notes |
|--------------|------------|-------|
| `user` / `userId` / `username` | `user_id` | ใช้ค่าแรกที่พบ |
| `answer` / `text` | `answer` | อาจเป็น JSON string ถ้ามีข้อมูลเพิ่มเติม |
| `ts` / `timestamp` | `created_at` | แปลงเป็น TIMESTAMP |
| `correct` | `correct` | Optional |
| `code` | `code` | Optional |

### Additional Fields

ข้อมูลเพิ่มเติม (เช่น `action`, `itemIndex`, `price`, `balanceBefore`, `balanceAfter`, `dayIndex`) จะถูกเก็บใน `answer` field เป็น JSON string:

```json
{
  "text": "คำตอบ",
  "action": "checkin",
  "dayIndex": 1,
  "amount": 100,
  ...
}
```

---

## ⚙️ Script Workflow

1. **Connect to Firebase RTDB** - เชื่อมต่อกับ Firebase RTDB ตาม theme
2. **Connect to PostgreSQL** - เชื่อมต่อกับ PostgreSQL database
3. **Fetch Existing Games** - ดึงรายการ `game_id` ทั้งหมดจาก PostgreSQL table `games`
4. **Fetch Answers** - ดึงข้อมูล answers จาก RTDB
5. **Filter by Games** - กรอง answers เฉพาะเกมที่มีอยู่ใน PostgreSQL (ไม่ย้ายเกมที่ไม่มีในระบบ)
6. **Flatten Structure** - แปลงโครงสร้าง nested object เป็น flat list
7. **Transform Data** - แปลงข้อมูลให้ตรงกับ PostgreSQL schema
8. **Batch Insert** - Insert ข้อมูลทีละ batch (default: 100 records)
9. **Handle Duplicates** - ใช้ `ON CONFLICT DO NOTHING` เพื่อหลีกเลี่ยง duplicates
10. **Summary** - แสดงสรุปผลการ migration

**⚠️ หมายเหตุ:** Script จะย้าย answers เฉพาะเกมที่มีอยู่ใน PostgreSQL เท่านั้น หากยังไม่ได้ migrate เกม ให้รัน `migrate-games-from-rtdb.js` ก่อน

---

## 📝 Example Output

```
🚀 Starting answers migration for theme: heng36
📊 Schema: public
📦 Batch size: 100

📥 Fetching existing games from PostgreSQL...
✅ Found 6 games in PostgreSQL

📥 Fetching answers from RTDB (filtering by existing games)...
✅ Found 15234 answers in RTDB
   📊 Games with answers: 5
   ⏭️  Games skipped (not in PostgreSQL): 12

📦 Processing batch 1/153 (100 answers)...
  ✅ Batch 1 completed: 100 migrated, 0 skipped, 0 failed

📦 Processing batch 2/153 (100 answers)...
  ✅ Batch 2 completed: 200 migrated, 0 skipped, 0 failed

...

📊 Migration Summary:
   Total games in PostgreSQL: 6
   Games with answers in RTDB: 5
   Games skipped (not in PostgreSQL): 12
   Total answers found: 15234
   ✅ Migrated: 15234
   ⏭️  Skipped: 0
   ❌ Failed: 0

✅ Migration completed successfully!
```

---

## ⚠️ Important Notes

1. **Duplicate Prevention**: Script ใช้ `ON CONFLICT DO NOTHING` เพื่อหลีกเลี่ยง duplicates แต่ต้องมี unique constraint ใน PostgreSQL table

2. **Batch Size**: 
   - Default: 100 records per batch
   - สำหรับข้อมูลจำนวนมาก (100,000+) แนะนำให้ใช้ batch size 200-500
   - สำหรับข้อมูลน้อย (< 1,000) สามารถใช้ batch size 50

3. **Error Handling**: 
   - Script จะข้าม records ที่มี error และบันทึกไว้ใน summary
   - สามารถรัน script ซ้ำได้ (จะ skip duplicates)

4. **Performance**: 
   - ใช้ transactions สำหรับแต่ละ batch
   - ใช้ connection pooling เพื่อประสิทธิภาพที่ดีขึ้น

---

## 🔧 Troubleshooting

### Error: "No database pool found for theme"

**Solution**: ตรวจสอบว่า environment variable ถูกตั้งค่าถูกต้อง:
```bash
echo $DATABASE_URL_HENG36
```

### Error: "No Firebase config found for theme"

**Solution**: ตรวจสอบว่า theme ที่ระบุถูกต้อง (`heng36`, `max56`, `jeed24`)

### Error: "Failed to insert answer"

**Possible Causes**:
- Table structure ไม่ตรงกับที่คาดหวัง
- Missing required fields (`game_id`, `user_id`, `answer`)
- Database connection issues

**Solution**: ตรวจสอบ table structure และ connection string

---

## 📚 Related Scripts

- `migrate-games-from-rtdb.js` - ย้ายข้อมูลเกม (ไม่รวม answers)
- `migrate-users-from-firestore.js` - ย้ายข้อมูล users
- `migrate-from-firebase.js` - ย้ายข้อมูลทั้งหมด (users, games, checkins, answers)

---

## ✅ Checklist

- [ ] Environment variables ถูกตั้งค่าแล้ว
- [ ] PostgreSQL table `games` มีข้อมูลเกมแล้ว (รัน `migrate-games-from-rtdb.js` ก่อน)
- [ ] PostgreSQL table `answers` ถูกสร้างแล้ว
- [ ] Firebase RTDB มีข้อมูล answers
- [ ] รัน script และตรวจสอบผลลัพธ์
- [ ] ตรวจสอบข้อมูลใน PostgreSQL ว่าถูกต้อง

---

## 🎯 Next Steps

หลังจาก migration เสร็จแล้ว:

1. **Verify Data**: ตรวจสอบข้อมูลใน PostgreSQL ว่าถูกต้อง
2. **Test API**: ทดสอบ API endpoints ที่ใช้ answers
3. **Update Frontend**: อัปเดต frontend ให้ใช้ PostgreSQL แทน Firebase RTDB
4. **Monitor**: ตรวจสอบ logs และ performance หลัง migration

