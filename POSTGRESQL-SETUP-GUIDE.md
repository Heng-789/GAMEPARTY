# 🐘 PostgreSQL Setup Guide

คู่มือการตั้งค่าและใช้งาน PostgreSQL สำหรับ HENG36GAME

---

## 📋 Prerequisites

- PostgreSQL 12+ installed
- Node.js 18+ installed
- npm หรือ yarn

---

## 🚀 Quick Start

### 1. Setup Database

```bash
# สร้าง database
createdb heng36game

# รัน migrations
psql -d heng36game -f migrations/001_create_tables.sql
```

### 2. Setup Backend

```bash
cd backend
npm install

# สร้าง .env file
cp .env.example .env

# แก้ไข .env ตามการตั้งค่า
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=heng36game
# DB_USER=postgres
# DB_PASSWORD=your_password

# Start backend server
npm run dev
```

### 3. Migrate Data (Optional)

```bash
# ย้ายข้อมูลจาก Firebase ไป PostgreSQL
cd backend
node scripts/migrate-from-firebase.js heng36
```

### 4. Setup Frontend

```bash
# สร้าง .env file ใน root directory
# VITE_API_URL=http://localhost:3000
# VITE_WS_URL=ws://localhost:3000

# Start frontend
npm run dev
```

---

## 📊 Database Schema

### Tables Overview

| Table | Description |
|-------|-------------|
| `users` | ข้อมูลผู้ใช้ (hcoin, status) |
| `games` | ข้อมูลเกม |
| `checkins` | การเช็คอิน |
| `checkin_rewards` | รางวัลการเช็คอิน |
| `answers` | คำตอบในเกม |
| `presence` | สถานะผู้ใช้ในห้อง |
| `bingo_cards` | การ์ด BINGO |
| `bingo_players` | ผู้เล่น BINGO |
| `bingo_game_state` | สถานะเกม BINGO |
| `coin_transactions` | ประวัติการทำธุรกรรมเหรียญ |

### Indexes

ทุก table มี indexes สำหรับ performance:
- Primary keys
- Foreign keys
- Frequently queried columns
- Timestamps สำหรับ sorting

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3000
```

### Health Check
```bash
curl http://localhost:3000/health
```

### Example: Get Games
```bash
curl http://localhost:3000/api/games
```

### Example: Get User
```bash
curl http://localhost:3000/api/users/USER123
```

---

## 🔌 WebSocket

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Events

#### Client → Server
- `presence:join` - Join room
- `presence:leave` - Leave room
- `presence:update` - Update status
- `bingo:card:update` - Update bingo card
- `bingo:game:state` - Get/update game state

#### Server → Client
- `presence:updated` - Presence updated
- `bingo:card:updated` - Bingo card updated
- `bingo:game:state:updated` - Game state updated

---

## 🔧 Configuration

### Backend (.env)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=heng36game
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## 📝 Migration

### Migrate from Firebase

```bash
cd backend
node scripts/migrate-from-firebase.js heng36
```

### Verify Migration

```sql
-- Check users count
SELECT COUNT(*) FROM users;

-- Check games count
SELECT COUNT(*) FROM games;

-- Check checkins count
SELECT COUNT(*) FROM checkins;
```

---

## 🧪 Testing

### Test Database Connection
```bash
psql -d heng36game -c "SELECT 1"
```

### Test API
```bash
# Health check
curl http://localhost:3000/health

# Get games
curl http://localhost:3000/api/games

# Get user
curl http://localhost:3000/api/users/USER123
```

### Test WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => console.log('Connected');
ws.onmessage = (msg) => console.log('Received:', msg.data);
```

---

## ⚠️ Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** ตรวจสอบว่า PostgreSQL กำลังรันอยู่

### Migration Errors
```
Error: relation "users" does not exist
```
**Solution:** รัน migrations ก่อน:
```bash
psql -d heng36game -f migrations/001_create_tables.sql
```

### WebSocket Connection Failed
```
WebSocket connection failed
```
**Solution:** ตรวจสอบว่า backend server กำลังรันอยู่

---

## 📚 Next Steps

1. ✅ Setup database และ backend
2. ✅ Migrate data จาก Firebase
3. ✅ Test API endpoints
4. ✅ Integrate frontend
5. ✅ Deploy to production

---

## 🔗 Related Documents

- `POSTGRESQL-MIGRATION-PLAN.md` - แผนการ migration
- `POSTGRESQL-MIGRATION-SUMMARY.md` - สรุปสิ่งที่สร้าง
- `backend/README.md` - Backend API documentation

