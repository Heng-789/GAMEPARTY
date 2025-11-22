# ✅ PostgreSQL + Node.js Backend Confirmation

## 🎯 สรุป

**ใช่แล้ว! Backend ใช้ PostgreSQL + Node.js อยู่แล้ว** ✅

---

## 📦 Backend Stack

### Technology Stack
- **Runtime**: Node.js (ES Modules)
- **Database**: PostgreSQL
- **Web Framework**: Express.js
- **WebSocket**: ws (native WebSocket)
- **Database Driver**: pg (node-postgres)

### Project Structure
```
backend/
├── src/
│   ├── index.js              # Main server (Express + WebSocket)
│   ├── config/
│   │   └── database.js       # PostgreSQL connection pool
│   ├── routes/               # REST API routes
│   │   ├── users.js
│   │   ├── games.js
│   │   ├── checkins.js
│   │   ├── answers.js
│   │   ├── presence.js
│   │   ├── bingo.js
│   │   └── coins.js
│   └── websocket/
│       └── index.js          # WebSocket server
├── scripts/
│   └── migrate-from-firebase.js  # Migration script
└── package.json
```

---

## 🔌 Database Connection

### PostgreSQL Connection Pool
```javascript
// backend/src/config/database.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'heng36game',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Maximum connections
});
```

### Usage in Routes
```javascript
// Example: backend/src/routes/users.js
import pool from '../config/database.js';

router.get('/:userId', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE user_id = $1',
    [userId]
  );
  // ...
});
```

---

## 🚀 Server Setup

### Main Server
```javascript
// backend/src/index.js
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import pool from './config/database.js';

const app = express();
const server = createServer(app);

// REST API routes
app.use('/api/users', usersRoutes);
app.use('/api/games', gamesRoutes);
// ...

// WebSocket server
setupWebSocket(server);

server.listen(3000, () => {
  console.log('🚀 Server running on port 3000');
});
```

---

## 📊 Database Schema

### Tables
- ✅ `users` - ข้อมูลผู้ใช้
- ✅ `games` - ข้อมูลเกม (ทุกประเภท)
- ✅ `checkins` - การเช็คอิน
- ✅ `checkin_rewards` - รางวัลการเช็คอิน
- ✅ `answers` - คำตอบในเกม
- ✅ `presence` - สถานะผู้ใช้
- ✅ `bingo_cards` - การ์ด BINGO
- ✅ `bingo_players` - ผู้เล่น BINGO
- ✅ `bingo_game_state` - สถานะเกม BINGO
- ✅ `coin_transactions` - ประวัติธุรกรรมเหรียญ

### Game Data Storage
ข้อมูลเกมทุกประเภทเก็บใน `games.game_data` (JSONB):
- เกมทายภาพปริศนา (puzzle)
- เกมทายเบอร์เงิน (numberPick)
- เกมทายผลบอล (football)
- เกมสล็อต (slot)
- เกมเช็คอิน (checkin)
- เกมประกาศรางวัล (announce)
- เกม Trick or Treat (trickOrTreat)
- เกมลอยกระทง (loyKrathong)
- เกม BINGO (bingo)

---

## 🔄 Migration

### Migration Script
```bash
# ย้ายข้อมูลจาก Firebase ไป PostgreSQL
cd backend
node scripts/migrate-from-firebase.js heng36
```

### What it migrates:
- ✅ **Users** - จาก Firestore `users` collection
- ✅ **Users** - จาก RTDB `USERS_EXTRA` path
- ✅ **Games** - จาก RTDB `games` path (ทุกประเภท)
- ✅ **Checkins** - จาก Firestore `checkins` collection
- ✅ **Answers** - จาก RTDB `answers` path

---

## 📝 API Endpoints

### REST API (Express)
- `GET /api/users/:userId` - Get user
- `GET /api/games` - List games
- `POST /api/checkins/:gameId/:userId` - Check in
- `GET /api/bingo/:gameId/cards` - Get bingo cards
- และอื่นๆ...

### WebSocket (ws)
- Real-time updates สำหรับ presence, bingo, etc.

---

## ✅ Confirmation

**Backend ใช้ PostgreSQL + Node.js อยู่แล้ว!**

- ✅ Node.js runtime
- ✅ Express.js framework
- ✅ PostgreSQL database
- ✅ pg driver
- ✅ WebSocket support
- ✅ REST API endpoints
- ✅ Migration scripts

---

## 🚀 Next Steps

1. ✅ Setup PostgreSQL database
2. ✅ Run migrations
3. ✅ Start backend server
4. ✅ Migrate data from Firebase
5. ✅ Test API endpoints
6. ✅ Integrate with frontend

---

## 📚 Related Documents

- `POSTGRESQL-SETUP-GUIDE.md` - คู่มือการตั้งค่า
- `POSTGRESQL-MIGRATION-PLAN.md` - แผนการ migration
- `backend/README.md` - Backend documentation

