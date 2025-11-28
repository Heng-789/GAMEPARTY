# ✅ Deployment Checklist

## สถานะ: เกือบพร้อม แต่ต้องแก้ไขไฟล์เก่าบางไฟล์

---

## ✅ สิ่งที่เสร็จแล้ว

1. ✅ **Upstash Redis Migration**
   - สร้าง `cache/upstashClient.js`
   - อัพเดต `package.json` (ลบ ioredis, เพิ่ม @upstash/redis)
   - ตั้งค่า environment variables

2. ✅ **Cache Layer**
   - สร้าง `cache/cacheService.js`
   - ใช้งานใน routes และ socket

3. ✅ **Snapshot Engine**
   - สร้าง `snapshot/snapshotEngine.js`
   - Background scheduler ทำงานแล้ว

4. ✅ **Diff Engine**
   - สร้าง `socket/diffEngine.js`
   - แก้ไข import jsondiffpatch แล้ว

5. ✅ **Socket.io Integration**
   - อัพเดต `socket/index.js` ให้ใช้ snapshot + diff

6. ✅ **REST API Routes**
   - อัพเดต `routes/games.js` ให้ใช้ snapshot
   - อัพเดต `routes/users.js` ให้ใช้ cache service

7. ✅ **Syntax Errors**
   - แก้ไข syntax errors ทั้งหมดแล้ว

---

## ⚠️ สิ่งที่ต้องทำก่อน Deploy

### 1. อัพเดตไฟล์ที่ยังใช้โค้ดเก่า

#### `backend/src/services/queue.js`
- **ปัญหา:** ยังใช้ `config/redis.js` (ioredis)
- **แก้ไข:** อัพเดตให้ใช้ `cache/upstashClient.js` หรือปิดการใช้งานชั่วคราว

#### `backend/src/middleware/redis-cache.js`
- **ปัญหา:** ยังใช้ `services/redis-cache.js` และ `services/snapshot.js` (เก่า)
- **แก้ไข:** ลบหรืออัพเดตให้ใช้ `cache/cacheService.js` และ `snapshot/snapshotEngine.js`

### 2. ตรวจสอบว่าไฟล์เก่าไม่ถูกใช้

ไฟล์เหล่านี้ควรไม่ถูกใช้แล้ว:
- `backend/src/config/redis.js` (เก่า - ioredis)
- `backend/src/services/redis-cache.js` (เก่า)
- `backend/src/services/snapshot.js` (เก่า)
- `backend/src/services/diff.js` (เก่า)

**ตรวจสอบ:** ใช้ `grep` เพื่อหาการ import

### 3. ลบไฟล์เก่า (หลังจากตรวจสอบแล้ว)

```bash
# ไฟล์ที่สามารถลบได้ (ถ้าไม่ถูกใช้แล้ว)
rm backend/src/config/redis.js
rm backend/src/services/redis-cache.js
rm backend/src/services/snapshot.js
rm backend/src/services/diff.js
rm backend/src/middleware/redis-cache.js  # ถ้าไม่ถูกใช้
```

---

## ✅ ตรวจสอบก่อน Deploy

### 1. Dependencies
```bash
cd backend
npm install
npm list @upstash/redis jsondiffpatch
```

### 2. Environment Variables
ตรวจสอบว่า `.env` มี:
```env
UPSTASH_REDIS_REST_URL=https://oriented-sunfish-20537.upstash.io
UPSTASH_REDIS_REST_TOKEN=AVA5AAIncDJjOTcyMTEyNDVjYzU0YTgzOWRmMzEyMTZjNThhZGZmNnAyMjA1Mzc
DATABASE_URL_HENG36=...
DATABASE_URL_MAX56=...
DATABASE_URL_JEED24=...
```

### 3. Test Server
```bash
npm start
```

ตรวจสอบ logs:
- ✅ Upstash Redis initialized
- ✅ Upstash Redis connected
- ✅ Snapshot engine started
- ✅ Database connections: 3/3 healthy

### 4. Test API
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/utils/metrics
```

### 5. Test Upstash Connection
```bash
node test-upstash.js
```

---

## 📋 Pre-Deployment Checklist

- [ ] อัพเดต `services/queue.js` (ถ้ายังใช้)
- [ ] ตรวจสอบว่าไฟล์เก่าไม่ถูก import แล้ว
- [ ] ลบไฟล์เก่าที่ไม่ใช้แล้ว
- [ ] ทดสอบ server เริ่มต้นได้
- [ ] ทดสอบ Upstash Redis connection
- [ ] ทดสอบ API endpoints
- [ ] ทดสอบ Socket.io connections
- [ ] ตรวจสอบ environment variables ใน production
- [ ] ตรวจสอบ database migrations (`npm run migrate:indexes`)

---

## 🚀 Deployment Steps

### 1. Production Environment Variables

ตั้งค่าใน production environment:
```env
NODE_ENV=production
UPSTASH_REDIS_REST_URL=https://oriented-sunfish-20537.upstash.io
UPSTASH_REDIS_REST_TOKEN=AVA5AAIncDJjOTcyMTEyNDVjYzU0YTgzOWRmMzEyMTZjNThhZGZmNnAyMjA1Mzc
DATABASE_URL_HENG36=...
DATABASE_URL_MAX56=...
DATABASE_URL_JEED24=...
PORT=3000
FRONTEND_URL=https://your-frontend-domain.com
```

### 2. Install Dependencies
```bash
npm install --production
```

### 3. Run Migrations
```bash
npm run migrate:indexes
```

### 4. Start Server
```bash
npm start
```

---

## ⚠️ หมายเหตุ

- **Queue Service**: `services/queue.js` ยังใช้ ioredis - อาจต้องอัพเดตหรือปิดการใช้งานชั่วคราว
- **Old Files**: ไฟล์เก่ายังอยู่ แต่ไม่ถูกใช้ - สามารถลบได้หลังตรวจสอบ
- **Backward Compatibility**: API endpoints ยังคงเหมือนเดิม - frontend ไม่ต้องแก้ไข

---

*Last updated: [Current Date]*

