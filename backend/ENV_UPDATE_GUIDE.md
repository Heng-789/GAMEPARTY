# 🔧 คู่มืออัพเดตไฟล์ .env

## ✅ ไฟล์ .env มีอยู่แล้ว!

ไฟล์ `backend/.env` มีอยู่แล้ว แต่ต้องเพิ่มตัวแปรใหม่สำหรับการ optimize

---

## 🚀 วิธีอัพเดต (เลือกวิธีใดวิธีหนึ่ง)

### วิธีที่ 1: ใช้ Script (แนะนำ) ⚡

#### Windows (PowerShell):
```powershell
cd backend
.\update-env.ps1
```

#### Linux/Mac (Bash):
```bash
cd backend
chmod +x update-env.sh
./update-env.sh
```

**Script จะ:**
- ✅ เพิ่มตัวแปร Redis, Snapshot, Logging อัตโนมัติ
- ✅ แก้ไข database URLs ให้มี `?sslmode=require`
- ✅ อัพเดต database pool settings

---

### วิธีที่ 2: แก้ไขด้วยมือ (Manual)

เปิดไฟล์ `backend/.env` และเพิ่มส่วนนี้ที่ท้ายไฟล์:

```env
# ============================================
# Redis Configuration (for caching and queues)
# ============================================
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ============================================
# Snapshot Worker Configuration
# ============================================
SNAPSHOT_INTERVAL=30000

# ============================================
# Request Logging & Monitoring
# ============================================
LOG_THRESHOLD=1024
SLOW_QUERY_THRESHOLD=500
ENABLE_DETAILED_LOGGING=false

# ============================================
# Compression Configuration
# ============================================
ENABLE_COMPRESSION=true
COMPRESSION_THRESHOLD=1024
COMPRESSION_LEVEL=6

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

# ============================================
# Cache Duration (in seconds)
# ============================================
CACHE_DURATION_STATIC=3600
CACHE_DURATION_DYNAMIC=300
CACHE_DURATION_USER=600

# ============================================
# Bandwidth Monitoring
# ============================================
ENABLE_BANDWIDTH_MONITORING=true
BANDWIDTH_LOG_THRESHOLD=10240

# ============================================
# Frontend Configuration
# ============================================
FRONTEND_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175
```

---

## ⚠️ สิ่งที่ต้องตรวจสอบ/แก้ไข

### 1. Database Connection Strings

ตรวจสอบว่ามี `?sslmode=require` ที่ท้าย:

```env
# ✅ ถูกต้อง
DATABASE_URL_HENG36=postgresql://...?sslmode=require

# ❌ ผิด (ต้องเพิ่ม ?sslmode=require)
DATABASE_URL_HENG36=postgresql://...
```

**ถ้าไม่มี:** เพิ่ม `?sslmode=require` ที่ท้าย connection string

---

### 2. Database Pool Settings

อัพเดตเป็น:

```env
DB_MAX_CONNECTIONS=50
DB_MIN_CONNECTIONS=5
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=10000
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

---

### 3. Redis Configuration

#### ถ้ามี Redis:
```env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

#### ถ้าไม่มี Redis:
```env
REDIS_ENABLED=false
```

---

## ✅ Checklist

หลังจากอัพเดต .env แล้ว:

- [ ] เพิ่ม Redis configuration (หรือตั้ง `REDIS_ENABLED=false`)
- [ ] เพิ่ม Snapshot worker config (`SNAPSHOT_INTERVAL=30000`)
- [ ] เพิ่ม Request logging config
- [ ] อัพเดต Database pool settings
- [ ] ตรวจสอบ `DATABASE_URL_*` มี `?sslmode=require`
- [ ] ตรวจสอบ `DATABASE_URL_JEED24` password ถูกต้อง
- [ ] เพิ่ม `FRONTEND_URL` (ถ้ายังไม่มี)

---

## 🔍 ตรวจสอบการตั้งค่า

### 1. ตรวจสอบ Database Connection

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

### 2. ตรวจสอบ Redis (ถ้าเปิดใช้งาน)

```bash
redis-cli ping
# ควรได้: PONG
```

### 3. เริ่ม Backend และดู Logs

```bash
cd backend
npm start
```

**ดูที่ console:**
- ✅ `Redis connected` = Redis ทำงาน
- ✅ `Database connections: 3/3 healthy` = Database เชื่อมต่อได้
- ✅ `Snapshot worker started` = Snapshot worker ทำงาน

---

## 📋 สรุปตัวแปรที่ต้องเพิ่ม

| ตัวแปร | ค่า Default | คำอธิบาย |
|--------|-------------|----------|
| `REDIS_ENABLED` | `true` | เปิด/ปิด Redis |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `SNAPSHOT_INTERVAL` | `30000` | รัน snapshot worker ทุก 30 วินาที |
| `LOG_THRESHOLD` | `1024` | Log requests > 1KB |
| `SLOW_QUERY_THRESHOLD` | `500` | Log queries > 500ms |
| `FRONTEND_URL` | `http://localhost:5173,...` | Allowed frontend URLs |

---

## 🆘 Troubleshooting

### ❌ Error: "Redis connection failed"

**แก้ไข:** ตั้ง `REDIS_ENABLED=false` ใน .env

---

### ❌ Error: "SSL required" (Supabase)

**แก้ไข:** เพิ่ม `?sslmode=require` ที่ท้าย connection string

---

## 📚 เอกสารเพิ่มเติม

- `UPDATE_ENV.md` - คู่มือละเอียด
- `env.template` - Template ไฟล์ .env
- `OPTIMIZATION_SUMMARY.md` - สรุปการ optimize

