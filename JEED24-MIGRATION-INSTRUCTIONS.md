# 🚀 JEED24 Migration Instructions

## ⚠️ Important: Create Tables First!

JEED24 database ยังไม่มี tables ต้องสร้างก่อนรัน migration

## 📋 Step 1: Create Tables in Supabase

### Option A: Using Supabase SQL Editor (Recommended)

1. ไปที่ **JEED24 Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/[JEED24-PROJECT-ID]
   
2. ไปที่ **SQL Editor** → **New query**

3. Copy และ paste เนื้อหาจาก `migrations/001_create_tables.sql`

4. **Run** query

### Option B: Using psql (if you have access)

```bash
psql "postgresql://postgres.pyrtleftkrjxvwlbvfma:nURuKYlp6XPCeO6q@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" -f migrations/001_create_tables.sql
```

## 📋 Step 2: Run Migration

หลังจากสร้าง tables แล้ว:

```bash
cd backend
node scripts/migrate-from-firebase.js jeed24
```

## 📊 Expected Results

- **Users**: ~24,901 users จาก RTDB (USERS_EXTRA)
- **Games**: All game types
- **Checkins**: All checkin data
- **Answers**: All answer data

## ✅ Verification

หลังจาก migration เสร็จ:

```bash
cd backend
node scripts/test-cloud-connection-fixed.js
```

**ควรเห็น**:
```
✅ jeed24: X tables found
```

## 🆘 Troubleshooting

### Error: "relation 'users' does not exist"
- **Solution**: ต้องสร้าง tables ก่อน (Step 1)

### Error: "Connection failed"
- **Solution**: ตรวจสอบ connection string ใน `.env`
- **Solution**: ตรวจสอบว่า Supabase project ยัง active อยู่

### Error: "Firestore connection failed"
- **Solution**: Firestore อาจไม่มีข้อมูล หรือ connection มีปัญหา
- **Note**: Migration จะใช้ RTDB เป็นหลัก ถ้า Firestore ไม่มีข้อมูลก็ไม่เป็นไร

---

**Status**: ⏳ Waiting for tables to be created

