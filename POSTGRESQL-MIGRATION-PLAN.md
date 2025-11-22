# 🐘 PostgreSQL Migration Plan

## 📋 ภาพรวม

แผนการย้ายระบบจาก Firebase (Realtime Database + Firestore) ไปใช้ PostgreSQL

---

## 🏗️ สถาปัตยกรรมใหม่

### 1. **Database Layer**
- **PostgreSQL** - Relational database สำหรับข้อมูลหลัก
- **Redis** (optional) - สำหรับ caching และ real-time presence

### 2. **Backend API**
- **Node.js/Express** หรือ **FastAPI (Python)**
- RESTful API สำหรับ CRUD operations
- WebSocket สำหรับ real-time updates

### 3. **Frontend**
- เรียก API แทน Firebase SDK
- WebSocket client สำหรับ real-time updates

---

## 📊 Database Schema

### Tables

#### 1. **users**
```sql
CREATE TABLE users (
  user_id VARCHAR(255) PRIMARY KEY,
  password VARCHAR(255),
  hcoin DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_hcoin ON users(hcoin DESC);
CREATE INDEX idx_users_status ON users(status);
```

#### 2. **games**
```sql
CREATE TABLE games (
  game_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  unlocked BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  user_access_type VARCHAR(20) DEFAULT 'all',
  selected_users JSONB,
  game_data JSONB, -- เก็บ game-specific data (puzzle, bingo, checkin, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_type ON games(type);
CREATE INDEX idx_games_unlocked ON games(unlocked);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
```

#### 3. **checkins**
```sql
CREATE TABLE checkins (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  day_index INTEGER NOT NULL,
  checked BOOLEAN DEFAULT false,
  checkin_date DATE NOT NULL,
  unique_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, user_id, day_index)
);

CREATE INDEX idx_checkins_game_user ON checkins(game_id, user_id);
CREATE INDEX idx_checkins_date ON checkins(checkin_date);
CREATE INDEX idx_checkins_unique_key ON checkins(unique_key);
```

#### 4. **checkin_rewards**
```sql
CREATE TABLE checkin_rewards (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  reward_type VARCHAR(50) NOT NULL, -- 'complete', 'daily'
  claimed BOOLEAN DEFAULT false,
  unique_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, user_id, reward_type)
);

CREATE INDEX idx_checkin_rewards_game_user ON checkin_rewards(game_id, user_id);
CREATE INDEX idx_checkin_rewards_unique_key ON checkin_rewards(unique_key);
```

#### 5. **answers**
```sql
CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_answers_game ON answers(game_id);
CREATE INDEX idx_answers_user ON answers(user_id);
CREATE INDEX idx_answers_created_at ON answers(created_at DESC);
```

#### 6. **presence**
```sql
CREATE TABLE presence (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  room_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'online', -- 'online', 'away', 'offline'
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_in_room BOOLEAN DEFAULT true,
  UNIQUE(game_id, room_id, user_id)
);

CREATE INDEX idx_presence_game_room ON presence(game_id, room_id);
CREATE INDEX idx_presence_user ON presence(user_id);
CREATE INDEX idx_presence_status ON presence(status);
CREATE INDEX idx_presence_last_seen ON presence(last_seen DESC);
```

#### 7. **bingo_cards**
```sql
CREATE TABLE bingo_cards (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  card_id VARCHAR(255) NOT NULL,
  numbers JSONB NOT NULL, -- 5x5 array
  checked_numbers JSONB, -- 5x5 boolean array
  is_bingo BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, user_id, card_id)
);

CREATE INDEX idx_bingo_cards_game_user ON bingo_cards(game_id, user_id);
CREATE INDEX idx_bingo_cards_card_id ON bingo_cards(card_id);
```

#### 8. **bingo_players**
```sql
CREATE TABLE bingo_players (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  credit INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_ready BOOLEAN DEFAULT false,
  UNIQUE(game_id, user_id)
);

CREATE INDEX idx_bingo_players_game ON bingo_players(game_id);
CREATE INDEX idx_bingo_players_user ON bingo_players(user_id);
```

#### 9. **bingo_game_state**
```sql
CREATE TABLE bingo_game_state (
  game_id VARCHAR(255) PRIMARY KEY,
  game_phase VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'countdown', 'playing', 'finished'
  drawn_numbers JSONB DEFAULT '[]'::jsonb,
  current_number INTEGER,
  game_started BOOLEAN DEFAULT false,
  ready_countdown INTEGER,
  ready_countdown_end TIMESTAMP,
  ready_players JSONB DEFAULT '{}'::jsonb,
  auto_draw_interval INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 10. **coin_transactions**
```sql
CREATE TABLE coin_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason VARCHAR(255),
  unique_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_unique_key ON coin_transactions(unique_key);
CREATE INDEX idx_coin_transactions_created_at ON coin_transactions(created_at DESC);
```

---

## 🔄 Migration Strategy

### Phase 1: Setup Infrastructure
1. ✅ สร้าง PostgreSQL database
2. ✅ สร้าง database schema
3. ✅ Setup backend API server
4. ✅ Setup WebSocket server

### Phase 2: Dual Write (Parallel)
1. ✅ เขียนข้อมูลไปทั้ง Firebase และ PostgreSQL
2. ✅ อ่านจาก Firebase (ยังใช้ Firebase เป็น source of truth)
3. ✅ ทดสอบ PostgreSQL operations

### Phase 3: Dual Read
1. ✅ อ่านจาก PostgreSQL ก่อน, fallback Firebase
2. ✅ ตรวจสอบความถูกต้องของข้อมูล
3. ✅ แก้ไข bugs และ inconsistencies

### Phase 4: Full Migration
1. ✅ อ่านจาก PostgreSQL เท่านั้น
2. ✅ ย้ายข้อมูลทั้งหมดจาก Firebase ไป PostgreSQL
3. ✅ ปิดการใช้งาน Firebase

---

## 🚀 Implementation Steps

### Step 1: Database Setup
```bash
# สร้าง PostgreSQL database
createdb heng36game

# รัน migration scripts
psql -d heng36game -f migrations/001_create_tables.sql
```

### Step 2: Backend API
- สร้าง RESTful API endpoints
- สร้าง WebSocket server
- Implement authentication

### Step 3: Frontend Integration
- สร้าง PostgreSQL service layer
- แก้ไข services ให้เรียก API
- Implement WebSocket client

### Step 4: Data Migration
- สร้าง migration scripts
- ย้ายข้อมูลจาก Firebase
- ตรวจสอบความถูกต้อง

---

## 📝 API Endpoints

### Users
- `GET /api/users/:userId` - Get user data
- `PUT /api/users/:userId` - Update user data
- `POST /api/users/:userId/coins` - Add coins (with transaction)
- `GET /api/users/top` - Get top users by hcoin

### Games
- `GET /api/games` - Get all games
- `GET /api/games/:gameId` - Get game data
- `POST /api/games` - Create game
- `PUT /api/games/:gameId` - Update game

### Checkins
- `GET /api/checkins/:gameId/:userId` - Get checkin status
- `POST /api/checkins/:gameId/:userId` - Check in
- `POST /api/checkins/:gameId/:userId/rewards/complete` - Claim complete reward

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

---

## 🔌 WebSocket Events

### Client → Server
- `presence:join` - Join room
- `presence:leave` - Leave room
- `presence:update` - Update status
- `bingo:card:update` - Update bingo card
- `bingo:game:state` - Get/update game state

### Server → Client
- `presence:updated` - Presence updated
- `bingo:card:updated` - Bingo card updated
- `bingo:game:state:updated` - Game state updated
- `checkin:updated` - Checkin updated

---

## ⚠️ Considerations

### 1. **Real-time Updates**
- ใช้ WebSocket สำหรับ real-time updates
- ใช้ Redis pub/sub สำหรับ multi-server scaling

### 2. **Transactions**
- ใช้ PostgreSQL transactions สำหรับ critical operations
- Implement retry logic สำหรับ race conditions

### 3. **Caching**
- ใช้ Redis สำหรับ caching
- Cache game data, user data, etc.

### 4. **Performance**
- ใช้ database indexes
- Optimize queries
- Use connection pooling

### 5. **Security**
- Implement authentication/authorization
- Use prepared statements (ป้องกัน SQL injection)
- Validate input data

---

## 📚 Next Steps

1. ✅ สร้าง PostgreSQL schema
2. ✅ สร้าง backend API server
3. ✅ สร้าง WebSocket server
4. ✅ สร้าง migration scripts
5. ✅ สร้าง frontend service layer
6. ✅ ทดสอบระบบ
7. ✅ Deploy และ migrate

