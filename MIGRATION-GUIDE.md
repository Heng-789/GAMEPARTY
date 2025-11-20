# 🔄 Migration Guide: USERS_EXTRA จาก RTDB ไป Firestore

## 📋 สรุป

เอกสารนี้เป็นคู่มือสำหรับ migration ข้อมูล USERS_EXTRA (600,000+++ users) จาก Firebase Realtime Database ไป Firestore

---

## ✅ Phase 1-3 ที่ทำไปแล้ว

### ✅ Phase 1: Dual Write (เขียนทั้ง RTDB และ Firestore)
- ✅ สร้าง `src/services/users-firestore.ts` - Firestore service layer
- ✅ แก้ไข code ให้เขียนทั้ง RTDB และ Firestore
- ✅ ไฟล์ที่แก้ไข:
  - `src/pages/UploadUsersExtra.tsx` - Edit user, Upload users
  - `src/components/CheckinGame.tsx` - Add hcoin (transaction)
  - `src/components/BingoGame.tsx` - Deduct hcoin (transaction)

### ✅ Phase 2: Dual Read (อ่านจาก Firestore ก่อน, fallback RTDB)
- ✅ แก้ไข code ให้อ่านจาก Firestore ก่อน
- ✅ ไฟล์ที่แก้ไข:
  - `src/pages/CreateGame.tsx` - Load top users
  - `src/pages/UploadUsersExtra.tsx` - Search users
  - `src/pages/AdminAnswers.tsx` - Load hcoin
  - `src/pages/games/GamePlay.tsx` - Check password/status
  - `src/components/UserBar.tsx` - Load hcoin
  - `src/components/BingoGame.tsx` - Check hcoin

### ✅ Phase 3: Migration Script
- ✅ สร้าง `scripts/migrate-users-to-firestore.ts` - Migration script
- ✅ สร้าง `FIRESTORE-INDEXES-USERS.md` - Index setup guide

---

## 🚀 ขั้นตอนการ Migration

### Step 1: สร้าง Firestore Indexes

**ก่อน migration** ต้องสร้าง indexes ใน Firestore Console:

1. **Index สำหรับ `hcoin` (Descending):**
   - Collection: `users`
   - Fields: `hcoin` (Descending)
   - ใช้สำหรับ: Query top 100 users

2. **Index สำหรับ `userId` (Ascending):**
   - Collection: `users`
   - Fields: `userId` (Ascending)
   - ใช้สำหรับ: Search users by username

**ดูรายละเอียดใน:** `FIRESTORE-INDEXES-USERS.md`

---

### Step 2: Run Migration Script

**Option 1: ใช้ Node.js (แนะนำ)**

```bash
# Install dependencies (ถ้ายังไม่มี)
npm install

# Build project
npm run build

# Run migration script
node dist/scripts/migrate-users-to-firestore.js
```

**Option 2: ใช้ ts-node**

```bash
# Install ts-node (ถ้ายังไม่มี)
npm install -g ts-node

# Run migration script
npx ts-node scripts/migrate-users-to-firestore.ts
```

**Migration Process:**
- ✅ อ่าน users จาก RTDB (600,000+++ users)
- ✅ Migrate แบบ batch (500 users/batch)
- ✅ Validate และ verify
- ✅ Log progress และ errors

**Estimated Time:**
- สำหรับ 600,000 users: ~**2-4 ชั่วโมง** (ขึ้นอยู่กับ network speed)
- Batch size: 500 users/batch
- Total batches: ~1,200 batches

---

### Step 3: Verify Migration

หลังจาก migration เสร็จ ตรวจสอบ:

1. **จำนวน Users:**
   ```bash
   # ใน Firebase Console → Firestore Database
   # ตรวจสอบว่ามี users documents เท่ากับ RTDB
   ```

2. **Sample Data:**
   - เปิด Firebase Console
   - ไปที่ Firestore Database → `users` collection
   - ตรวจสอบข้อมูลตัวอย่างว่าถูกต้อง

3. **Query Test:**
   - ทดสอบ query top 100 users
   - ทดสอบ search users
   - ตรวจสอบว่า indexes ทำงาน

---

### Step 4: Monitor System (1-2 สัปดาห์)

หลังจาก migration เสร็จ ให้ monitor:

1. **Performance:**
   - ตรวจสอบ query performance
   - ตรวจสอบ download usage

2. **Errors:**
   - ตรวจสอบ error logs
   - ตรวจสอบว่า fallback RTDB ทำงาน

3. **Data Consistency:**
   - ตรวจสอบว่าข้อมูลใน Firestore และ RTDB สอดคล้องกัน

---

### Step 5: Phase 4 - Firestore Only (Optional)

**หลังจากมั่นใจว่าระบบทำงานได้ดีแล้ว:**

1. **แก้ไข code ให้ใช้ Firestore เท่านั้น:**
   ```typescript
   // เปลี่ยนจาก:
   preferFirestore: true, fallbackRTDB: true
   
   // เป็น:
   preferFirestore: true, fallbackRTDB: false
   ```

2. **ลบการเขียน RTDB:**
   ```typescript
   // เปลี่ยนจาก:
   useDualWrite: true
   
   // เป็น:
   useDualWrite: false, preferFirestore: true
   ```

3. **Archive RTDB Data:**
   - Export ข้อมูล RTDB เป็น backup
   - ลบข้อมูล RTDB (optional)

---

## 📊 ผลลัพธ์ที่คาดหวัง

### Before Migration (RTDB):
- **CreateGame**: ~2.4 GB download (600K users)
- **UploadUsersExtra**: ~2.4 GB download (600K users)
- **AdminAnswers**: ~2.4 GB download (600K users)
- **Total**: ~7.2 GB download

### After Migration (Firestore):
- **CreateGame**: ~400 KB download (100 users query)
- **UploadUsersExtra**: ~400 KB download (100 users query)
- **AdminAnswers**: ~400 KB download (100 users query)
- **Total**: ~1.2 MB download

### Reduction:
- **99.98%** download reduction ✅

---

## ⚠️ หมายเหตุสำคัญ

1. **Migration Time:**
   - 600,000 users = ~2-4 ชั่วโมง
   - ต้องรอให้ migration เสร็จก่อนใช้งาน

2. **Index Creation:**
   - Indexes ใช้เวลา 30-60 นาทีในการสร้าง
   - Query จะไม่ทำงานถ้ายังไม่มี index

3. **Dual Write/Read:**
   - Phase 1-2: ใช้ทั้ง RTDB และ Firestore
   - Phase 3+: ใช้ Firestore เป็นหลัก (fallback RTDB)

4. **Backup:**
   - สำรองข้อมูล RTDB ก่อน migration
   - Export เป็น JSON backup

---

## 🐛 Troubleshooting

### Migration Script Fails:

1. **Rate Limit:**
   - ลด batch size (500 → 250)
   - เพิ่ม delay ระหว่าง batches

2. **Memory Issues:**
   - Process แบบ smaller batches
   - Restart script ถ้าจำเป็น

### Query Fails (Missing Index):

1. **Check Index Status:**
   - ไปที่ Firebase Console → Indexes
   - ตรวจสอบว่า index สร้างเสร็จหรือยัง

2. **Create Index Manually:**
   - ดูใน `FIRESTORE-INDEXES-USERS.md`
   - สร้าง index ใน Firebase Console

### Data Mismatch:

1. **Compare RTDB vs Firestore:**
   - สร้าง comparison script
   - ตรวจสอบว่าข้อมูลตรงกัน

2. **Re-run Migration:**
   - Re-run สำหรับ users ที่ mismatch
   - หรือ migrate เฉพาะ users ที่ขาด

---

## 📝 Checklist

### Before Migration:
- [ ] สร้าง Firestore indexes
- [ ] สำรองข้อมูล RTDB
- [ ] Review migration script
- [ ] Prepare rollback plan

### During Migration:
- [ ] Run migration script
- [ ] Monitor progress
- [ ] Handle errors

### After Migration:
- [ ] Verify data correctness
- [ ] Test queries
- [ ] Monitor performance
- [ ] Update documentation

---

## 🎯 สรุป

**Phase 1-3 เสร็จแล้ว:**
- ✅ Service layer (`users-firestore.ts`)
- ✅ Dual Write/Read implementation
- ✅ Migration script
- ✅ Index documentation

**Next Steps:**
1. สร้าง Firestore indexes
2. Run migration script (2-4 ชั่วโมง)
3. Verify migration
4. Monitor system (1-2 สัปดาห์)
5. Phase 4 - Firestore Only (optional)

**Expected Results:**
- ✅ ลด download 99.98% (7.2 GB → 1.2 MB)
- ✅ Query performance ดีขึ้น
- ✅ Scalable สำหรับอนาคต

