# Migration Scripts

## migrate-from-firebase.js

Script สำหรับย้ายข้อมูลจาก Firebase (RTDB + Firestore) ไป PostgreSQL

### Usage

```bash
# Migrate from heng36 theme (default)
node scripts/migrate-from-firebase.js

# Migrate from specific theme
node scripts/migrate-from-firebase.js heng36
node scripts/migrate-from-firebase.js max56
node scripts/migrate-from-firebase.js jeed24
```

### Prerequisites

1. PostgreSQL database ต้องถูกสร้างและรัน migrations แล้ว
2. Environment variables ใน `.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=heng36game
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

### What it migrates

- ✅ **Users** - จาก Firestore `users` collection
- ✅ **Games** - จาก RTDB `games` path
- ✅ **Checkins** - จาก Firestore `checkins` collection
- ✅ **Answers** - จาก RTDB `answers` path

### Notes

- Script จะใช้ `ON CONFLICT` เพื่อ update ข้อมูลที่มีอยู่แล้ว
- Migration จะทำแบบ batch เพื่อประสิทธิภาพ
- Errors จะถูก log แต่ไม่หยุดการ migration

### Example Output

```
🚀 Starting migration from heng36 to PostgreSQL...

✅ Connected to PostgreSQL

📦 Migrating users from heng36...
Found 1000 users to migrate
Progress: 100/1000 users
Progress: 200/1000 users
...
✅ Migrated 1000 users, 0 failed

📦 Migrating games from heng36...
✅ Migrated 50 games, 0 failed

📦 Migrating checkins from heng36...
Found 5000 checkins to migrate
Progress: 100/5000 checkins
...
✅ Migrated 5000 checkins, 0 failed

📦 Migrating answers from heng36...
Found 2000 answers to migrate
...
✅ Migrated 2000 answers, 0 failed

📊 Migration Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Users:    1000 migrated, 0 failed
Games:    50 migrated, 0 failed
Checkins: 5000 migrated, 0 failed
Answers:  2000 migrated, 0 failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Total: 8050 migrated, 0 failed
```

