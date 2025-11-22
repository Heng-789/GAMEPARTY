# HENG36GAME Backend API

Backend API server สำหรับ HENG36GAME ที่ใช้ PostgreSQL

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# สร้าง database
createdb heng36game

# รัน migrations
psql -d heng36game -f ../migrations/001_create_tables.sql
```

### 3. Configure Environment
```bash
cp .env.example .env
# แก้ไข .env ตามการตั้งค่าของคุณ
```

### 4. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## 📡 API Endpoints

### Users
- `GET /api/users/:userId` - Get user data
- `PUT /api/users/:userId` - Update user data
- `POST /api/users/:userId/coins` - Add coins (with transaction)
- `GET /api/users/top` - Get top users by hcoin
- `GET /api/users/search/:searchTerm` - Search users

### Games
- `GET /api/games` - Get all games
- `GET /api/games/:gameId` - Get game data
- `POST /api/games` - Create game
- `PUT /api/games/:gameId` - Update game

### Checkins
- `GET /api/checkins/:gameId/:userId` - Get checkin status
- `POST /api/checkins/:gameId/:userId` - Check in
- `POST /api/checkins/:gameId/:userId/rewards/complete` - Claim complete reward
- `GET /api/checkins/:gameId/:userId/rewards/complete` - Get complete reward status

### Answers
- `GET /api/answers/:gameId` - Get answers
- `POST /api/answers/:gameId` - Submit answer

### Presence
- `GET /api/presence/:gameId/:roomId` - Get room presence
- `POST /api/presence/:gameId/:roomId` - Update presence
- `DELETE /api/presence/:gameId/:roomId/:userId` - Remove presence

### Bingo
- `GET /api/bingo/:gameId/cards` - Get bingo cards
- `POST /api/bingo/:gameId/cards` - Create bingo card
- `PUT /api/bingo/:gameId/cards/:cardId` - Update bingo card
- `GET /api/bingo/:gameId/players` - Get players
- `POST /api/bingo/:gameId/players` - Join game
- `GET /api/bingo/:gameId/state` - Get game state
- `PUT /api/bingo/:gameId/state` - Update game state

## 🔌 WebSocket

WebSocket server ทำงานบน port เดียวกับ HTTP server

### Client → Server Events
- `presence:join` - Join room
- `presence:leave` - Leave room
- `presence:update` - Update status
- `bingo:card:update` - Update bingo card
- `bingo:game:state` - Get/update game state

### Server → Client Events
- `presence:updated` - Presence updated
- `bingo:card:updated` - Bingo card updated
- `bingo:game:state:updated` - Game state updated

## 📝 Example WebSocket Usage

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Join presence
  ws.send(JSON.stringify({
    type: 'presence:join',
    payload: {
      gameId: 'game123',
      roomId: 'room1',
      userId: 'user123',
      username: 'TestUser'
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## 🗄️ Database Schema

ดูรายละเอียดใน `../migrations/001_create_tables.sql`

## 🔧 Development

### Project Structure
```
backend/
├── src/
│   ├── config/
│   │   └── database.js      # PostgreSQL connection
│   ├── routes/
│   │   ├── users.js
│   │   ├── games.js
│   │   ├── checkins.js
│   │   └── ...
│   ├── websocket/
│   │   └── index.js          # WebSocket handler
│   └── index.js               # Main server file
├── .env.example
└── package.json
```

## 📚 Migration

### Migrate from Firebase
```bash
npm run migrate:firebase
```

## ⚠️ Notes

- ใช้ PostgreSQL transactions สำหรับ critical operations
- WebSocket ใช้สำหรับ real-time updates
- ควรใช้ Redis สำหรับ caching และ scaling (optional)

