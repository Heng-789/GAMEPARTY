# 🔧 คู่มืออัพเดตไฟล์ .env

## ✅ ไฟล์ .env มีอยู่แล้ว!

ไฟล์ `backend/.env` ถูกสร้างไว้แล้ว แต่ต้องเพิ่มตัวแปรใหม่สำหรับการ optimize

---

## 📝 สิ่งที่ต้องเพิ่มใน .env

เปิดไฟล์ `backend/.env` และเพิ่มตัวแปรเหล่านี้ (ถ้ายังไม่มี):

### 1. Redis Configuration (เพิ่มใหม่)

```env
# ============================================
# Redis Configuration (for caching and queues)
# ============================================
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

**ถ้าไม่มี Redis:** ตั้ง `REDIS_ENABLED=false`

---

### 2. Snapshot Worker (เพิ่มใหม่)

```env
# ============================================
# Snapshot Worker Configuration
# ============================================
SNAPSHOT_INTERVAL=30000
```

---

### 3. Request Logging (เพิ่มใหม่)

```env
# ============================================
# Request Logging & Monitoring
# ============================================
LOG_THRESHOLD=1024
SLOW_QUERY_THRESHOLD=500
ENABLE_DETAILED_LOGGING=false
```

---

### 4. Database Pool Settings (อัพเดต)

ถ้ามีอยู่แล้ว ให้อัพเดตเป็น:

```env
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

---

### 5. Rate Limiting (เพิ่มใหม่ - Optional)

```env
# ============================================
# Rate Limiting Configuration
# ============================================
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_GAMES_LIST=60
RATE_LIMIT_GAME_DETAIL=60
RATE_LIMIT_ANSWERS=30
RATE_LIMIT_CHECKINS=20
RATE_LIMIT_USERS_TOP=30
RATE_LIMIT_USERS_SEARCH=20
RATE_LIMIT_USER_DETAIL=20
RATE_LIMIT_BINGO=30
```

---

### 6. Cache Duration (เพิ่มใหม่ - Optional)

```env
# ============================================
# Cache Duration (in seconds)
# ============================================
CACHE_DURATION_STATIC=3600
CACHE_DURATION_DYNAMIC=300
CACHE_DURATION_USER=600
```

---

### 7. Bandwidth Monitoring (เพิ่มใหม่ - Optional)

```env
# ============================================
# Bandwidth Monitoring
# ============================================
ENABLE_BANDWIDTH_MONITORING=true
BANDWIDTH_LOG_THRESHOLD=10240
```

---

## ⚠️ สิ่งที่ต้องตรวจสอบ

### 1. Database Connection Strings

ตรวจสอบว่ามี `?sslmode=require` ที่ท้าย:

```env
# ✅ ถูกต้อง
DATABASE_URL_HENG36=postgresql://...?sslmode=require

# ❌ ผิด (ไม่มี ?sslmode=require)
DATABASE_URL_HENG36=postgresql://...
```

### 2. JEED24 Password

ตรวจสอบว่า `DATABASE_URL_JEED24` ไม่ใช่ `YOUR_PASSWORD`:

```env
# ❌ ต้องแก้ไข
DATABASE_URL_JEED24=postgresql://...:YOUR_PASSWORD@...

# ✅ ถูกต้อง
DATABASE_URL_JEED24=postgresql://...:actual_password@...
```

---

## 🚀 วิธีอัพเดตแบบรวดเร็ว

### Option 1: Copy จาก Template

```bash
cd backend
# ดู template
cat env.template

# Copy ส่วนที่ต้องการไปใส่ใน .env
```

### Option 2: ใช้ Script

```bash
cd backend
# ดูไฟล์ .env ปัจจุบัน
notepad .env
# หรือ
code .env
```

แล้วเพิ่มตัวแปรใหม่ตามด้านบน

---

## ✅ Checklist

หลังจากอัพเดต .env แล้ว:

- [ ] เพิ่ม Redis configuration
- [ ] เพิ่ม Snapshot worker config
- [ ] เพิ่ม Request logging config
- [ ] อัพเดต Database pool settings
- [ ] ตรวจสอบ `DATABASE_URL_*` มี `?sslmode=require`
- [ ] ตรวจสอบ `DATABASE_URL_JEED24` password ไม่ใช่ `YOUR_PASSWORD`
- [ ] ตั้งค่า `REDIS_ENABLED` (true/false)
- [ ] ตั้งค่า `FRONTEND_URL` ให้ถูกต้อง

---

## 🔍 ตรวจสอบการตั้งค่า

### 1. ตรวจสอบ Database

```bash
cd backend
node scripts/test-connection.js
```

### 2. ตรวจสอบ Redis

```bash
redis-cli ping
# ควรได้: PONG
```

### 3. เริ่ม Backend

```bash
cd backend
npm start
```

**ดูที่ console:**
- ✅ `Redis connected` = Redis ทำงาน
- ✅ `Database connections: 3/3 healthy` = Database เชื่อมต่อได้

---

## 📚 เอกสารเพิ่มเติม

- `ENV_SETUP_INSTRUCTIONS.md` - คู่มือละเอียด
- `env.template` - Template ไฟล์ .env
- `OPTIMIZATION_SUMMARY.md` - สรุปการ optimize

