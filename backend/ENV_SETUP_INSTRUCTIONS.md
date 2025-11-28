# 📝 คู่มือการตั้งค่า .env File

## ✅ ไฟล์ .env ถูกสร้างแล้ว!

ไฟล์ `backend/.env` ถูกสร้างให้แล้วพร้อมค่าพื้นฐาน

---

## ⚠️ สิ่งที่ต้องแก้ไข

### 1. Database Password สำหรับ JEED24

เปิดไฟล์ `backend/.env` และหา:

```env
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**แก้ไข:** แทนที่ `YOUR_PASSWORD` ด้วยรหัสผ่าน database จริงของ JEED24

**วิธีหา Password:**
1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. เลือก JEED24 project
3. ไปที่ **Settings** → **Database**
4. Copy **Connection string** → **URI**
5. Copy password จาก connection string

---

## 🔍 ตรวจสอบการตั้งค่า

### 1. ตรวจสอบว่าไฟล์ .env มีอยู่

```bash
cd backend
dir .env
# หรือ
ls .env
```

### 2. ตรวจสอบ Database Connection

```bash
cd backend
node scripts/test-connection.js
```

**ควรเห็น:**
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
✅ Connected to JEED24 PostgreSQL database
```

### 3. ตรวจสอบ Redis (ถ้าเปิดใช้งาน)

```bash
# ตรวจสอบว่า Redis รันอยู่
redis-cli ping
# ควรได้: PONG
```

**ถ้า Redis ไม่ได้รัน:**
- **Windows:** ดาวน์โหลด Redis จาก [redis.io](https://redis.io/download) หรือใช้ WSL
- **Linux/Mac:** `sudo apt-get install redis-server` หรือ `brew install redis`
- **หรือ:** ตั้ง `REDIS_ENABLED=false` ใน .env เพื่อใช้ in-memory cache

### 4. เริ่ม Backend และดู Logs

```bash
cd backend
npm start
```

**ดูที่ console output:**
- ✅ `Connected to HENG36 PostgreSQL database` = Database เชื่อมต่อสำเร็จ
- ✅ `Redis connected` = Redis เชื่อมต่อสำเร็จ
- ✅ `Database connections: 3/3 healthy` = ทุก database เชื่อมต่อได้

---

## 📋 Checklist

- [ ] ไฟล์ `.env` ถูกสร้างแล้ว
- [ ] แก้ไข `DATABASE_URL_JEED24` password (ถ้ายังเป็น `YOUR_PASSWORD`)
- [ ] ตรวจสอบ `DATABASE_URL_HENG36` และ `DATABASE_URL_MAX56` ว่าถูกต้อง
- [ ] ตั้งค่า Redis (หรือตั้ง `REDIS_ENABLED=false`)
- [ ] ตรวจสอบ `FRONTEND_URL` ว่าถูกต้อง
- [ ] ทดสอบ connection: `node scripts/test-connection.js`
- [ ] เริ่ม backend: `npm start` และดู logs

---

## 🔧 การตั้งค่า Redis (ถ้าต้องการ)

### Option 1: ใช้ Local Redis (Development)

```env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

**เริ่ม Redis:**
```bash
redis-server
```

### Option 2: ใช้ Redis Cloud (Production)

```env
REDIS_ENABLED=true
REDIS_HOST=your-redis-host.redis.cloud
REDIS_PORT=12345
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

### Option 3: ไม่ใช้ Redis (ใช้ In-Memory Cache)

```env
REDIS_ENABLED=false
```

**หมายเหตุ:** ถ้า `REDIS_ENABLED=false` ระบบจะใช้ in-memory cache แทน (ทำงานได้แต่ไม่สามารถ share cache ระหว่าง server instances)

---

## 🆘 Troubleshooting

### ❌ Error: "Database pool not found"

**สาเหตุ:** Connection string ไม่ถูกต้อง หรือไม่มี `?sslmode=require`

**แก้ไข:** ตรวจสอบว่า connection string มี `?sslmode=require` ที่ท้าย

---

### ❌ Error: "Redis connection failed"

**สาเหตุ:** Redis ไม่ได้รัน หรือ connection string ผิด

**แก้ไข:**
1. ตรวจสอบว่า Redis รันอยู่: `redis-cli ping`
2. หรือตั้ง `REDIS_ENABLED=false` เพื่อใช้ in-memory cache

---

### ❌ Error: "SSL required" (Supabase)

**สาเหตุ:** Connection string ไม่มี `?sslmode=require`

**แก้ไข:** เพิ่ม `?sslmode=require` ที่ท้าย connection string

---

### ❌ Error: "password authentication failed"

**สาเหตุ:** Password ไม่ถูกต้อง

**แก้ไข:** ตรวจสอบ password ใน Supabase Dashboard → Settings → Database

---

## ✅ ขั้นตอนถัดไป

หลังจากตั้งค่า .env แล้ว:

1. **รัน Database Migration:**
   ```bash
   npm run migrate:indexes
   ```

2. **เริ่ม Backend:**
   ```bash
   npm start
   ```

3. **ทดสอบ API:**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3000/api/utils/metrics
   ```

---

## 📚 เอกสารเพิ่มเติม

- `OPTIMIZATION_SUMMARY.md` - สรุปการ optimize
- `MIGRATION_GUIDE.md` - คู่มือการ migrate
- `PROJECT_STATUS.md` - สถานะโปรเจกต์

