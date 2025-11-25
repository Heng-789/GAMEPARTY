# 📋 สรุปการจัดระเบียบโปรเจกต์ทั้งหมด

## 🎯 เป้าหมาย

- ✅ ย้ายจาก API polling → Socket.io แบบ Real-time
- ✅ ใช้ REST เฉพาะ load ครั้งแรก + บันทึกข้อมูล
- ✅ ลดภาระ Server + Supabase ด้วย Caching
- ✅ ป้องกันยิงถี่ด้วย Rate Limiting
- ✅ รองรับหลายธีม (heng36, max56, jeed24)

---

## 📝 รายการไฟล์ที่แก้ไข

### Backend (15 ไฟล์)

#### ไฟล์ใหม่
1. **`backend/src/socket/index.js`** (ใหม่)
   - Socket.io server แทน WebSocket (ws)
   - รองรับ subscriptions: user/game/checkin/answers/bingo/chat
   - Broadcast functions สำหรับทุก event type

2. **`backend/src/middleware/cache.js`** (ใหม่)
   - In-memory cache สำหรับ GET /games
   - TTL: 30 วินาที
   - Auto-invalidate เมื่อ update/delete

3. **`backend/src/middleware/rateLimit.js`** (ใหม่)
   - Rate limiting middleware
   - จำกัดตาม endpoint:
     - `/api/games/:gameId`: 30 requests / 30 seconds
     - `/api/games`: 50 requests / 60 seconds
     - `/api/answers`: 20 requests / 10 seconds
     - `/api/checkins`: 10 requests / 10 seconds
     - Default: 100 requests / 60 seconds

#### ไฟล์ที่แก้ไข
4. **`backend/src/index.js`**
   - เปลี่ยนจาก `ws` → `socket.io`
   - เพิ่ม `cacheMiddleware` และ `rateLimitMiddleware`
   - ลบ `setupWebSocket`, เพิ่ม `setupSocketIO`

5. **`backend/src/routes/games.js`**
   - เพิ่ม `invalidateGameCache()` เมื่อ create/update/delete
   - เพิ่ม `broadcastGameUpdate()` เมื่อ update
   - เปลี่ยน import จาก `websocket/index.js` → `socket/index.js`

6. **`backend/src/routes/users.js`**
   - เปลี่ยน import จาก `websocket/index.js` → `socket/index.js`
   - แก้ `broadcastUserUpdate(theme, userId, userData)`

7. **`backend/src/routes/coins.js`**
   - เปลี่ยน import จาก `websocket/index.js` → `socket/index.js`
   - แก้ `broadcastUserUpdate(theme, userId, userData)`

8. **`backend/src/routes/checkins.js`**
   - เปลี่ยน import จาก `websocket/index.js` → `socket/index.js`
   - แก้ `broadcastCheckinUpdate(theme, gameId, userId, checkinData)`

9. **`backend/src/routes/answers.js`**
   - เปลี่ยน import จาก `websocket/index.js` → `socket/index.js`
   - แก้ `broadcastAnswerUpdate(theme, gameId, answerData)`

10. **`backend/src/routes/bingo.js`**
    - เพิ่ม `broadcastBingoUpdate()` เมื่อ create/update cards, players, gameState
    - Import `broadcastBingoUpdate` จาก `socket/index.js`

11. **`backend/src/routes/chat.js`**
    - เพิ่ม `broadcastChatMessage()` เมื่อส่ง message
    - Import `broadcastChatMessage` จาก `socket/index.js`

12. **`backend/package.json`**
    - เพิ่ม `socket.io` และ `express-rate-limit`

#### ไฟล์ที่ควรลบ (ไม่ใช้แล้ว)
13. **`backend/src/websocket/index.js`** (ควรลบหรือเก็บไว้เป็น backup)

### Frontend (10 ไฟล์)

#### ไฟล์ใหม่
1. **`src/services/socket-io-client.ts`** (ใหม่)
   - Socket.io client service
   - Auto-reconnect, error handling
   - Subscribe functions: user/game/checkin/answers/bingo/chat

2. **`src/hooks/useSocketIO.ts`** (ใหม่)
   - React hooks สำหรับ Socket.io:
     - `useSocketIOUserData(userId)`
     - `useSocketIOGameData(gameId)`
     - `useSocketIOCheckinData(gameId, userId)`
     - `useSocketIOAnswers(gameId, limit)`

3. **`src/hooks/useSocketIO-bingo-chat.ts`** (ใหม่)
   - Hooks สำหรับ Bingo และ Chat:
     - `useSocketIOBingoPlayers(gameId)`
     - `useSocketIOBingoCards(gameId, userId)`
     - `useSocketIOBingoGameState(gameId)`
     - `useSocketIOChat(gameId, maxMessages)`

#### ไฟล์ที่แก้ไข
4. **`src/pages/games/GamePlay.tsx`**
   - เปลี่ยนจาก `useWebSocketGameData` → `useSocketIOGameData`
   - ยกเลิก polling ทุก 3 วินาที

5. **`src/components/CheckinGame.tsx`**
   - เปลี่ยนจาก `useWebSocket*` → `useSocketIO*`
   - ยกเลิก polling ทั้งหมด (ยกเว้น server time update)

6. **`src/components/UserBar.tsx`**
   - เปลี่ยนจาก `useWebSocketUserData` → `useSocketIOUserData`

7. **`src/components/BingoGame.tsx`** (ต้องแก้)
   - เปลี่ยนจาก polling → `useSocketIOBingo*` hooks
   - ลบ `setInterval` สำหรับ players, cards, gameState

8. **`src/components/LiveChat.tsx`** (ต้องแก้)
   - เปลี่ยนจาก polling → `useSocketIOChat` hook
   - ลบ `setInterval` สำหรับ messages

9. **`package.json`**
   - เพิ่ม `socket.io-client`

#### ไฟล์ที่ควรลบ (ไม่ใช้แล้ว)
10. **`src/services/postgresql-websocket.ts`** (ควรลบ)
11. **`src/hooks/useWebSocketData.ts`** (ควรลบ)

---

## 🔄 โครงสร้าง Socket.io Events

### Backend Events (emit)

```javascript
// User updates
socket.emit('user:updated', { userId, hcoin, status })

// Game updates
socket.emit('game:updated', gameData)

// Checkin updates
socket.emit('checkin:updated', { gameId, userId, checkins })

// Answer updates
socket.emit('answer:updated', { gameId, answers: [...] })

// Bingo updates
socket.emit('bingo:players', { gameId, players: [...] })
socket.emit('bingo:cards', { gameId, cards: [...] })
socket.emit('bingo:gameState', { gameId, gameState: {...} })

// Chat updates
socket.emit('chat:message', { gameId, message: {...} })
```

### Frontend Subscriptions (emit)

```typescript
// Subscribe to updates
socket.emit('subscribe:user', { userId, theme })
socket.emit('subscribe:game', { gameId, theme })
socket.emit('subscribe:checkin', { gameId, userId, theme })
socket.emit('subscribe:answers', { gameId, theme })
socket.emit('subscribe:bingo', { gameId, theme })
socket.emit('subscribe:chat', { gameId, theme })
```

---

## 📊 Broadcast Format Standard

### User Update
```javascript
{
  userId: string,
  hcoin?: number,
  status?: string
}
```

### Game Update
```javascript
{
  id: string,
  name: string,
  type: string,
  ...gameData,
  createdAt: Date,
  updatedAt: Date
}
```

### Checkin Update
```javascript
{
  gameId: string,
  userId: string,
  checkins: Array<{
    dayIndex: number,
    checked: boolean,
    date: string
  }>
}
```

### Answer Update
```javascript
{
  gameId: string,
  answers: Array<{
    id: string,
    userId: string,
    answer: any,
    correct: boolean,
    code: string | null,
    createdAt: Date,
    action?: string,
    itemIndex?: number,
    price?: number,
    balanceBefore?: number,
    balanceAfter?: number
  }>
}
```

### Bingo Update
```javascript
// Players
{
  gameId: string,
  players: Array<{
    userId: string,
    username: string,
    credit: number,
    joinedAt: number,
    isReady: boolean
  }>
}

// Cards
{
  gameId: string,
  cards: Array<{
    id: string,
    numbers: number[][],
    userId: string,
    checkedNumbers: boolean[][],
    isBingo: boolean,
    createdAt: number
  }>
}

// Game State
{
  gameId: string,
  gameState: {
    gamePhase: string,
    drawnNumbers: number[],
    currentNumber: number | null,
    gameStarted: boolean,
    readyCountdown: number | null,
    readyCountdownEnd: number | null,
    readyPlayers: object,
    autoDrawInterval: number | null
  }
}
```

### Chat Update
```javascript
{
  gameId: string,
  message: {
    id: string,
    username: string,
    message: string,
    timestamp: number
  }
}
```

---

## 🗑️ ไฟล์ที่ควรลบ

### Backend
- `backend/src/websocket/index.js` (ไม่ใช้แล้ว)

### Frontend
- `src/services/postgresql-websocket.ts` (ไม่ใช้แล้ว)
- `src/hooks/useWebSocketData.ts` (ไม่ใช้แล้ว)

---

## ✅ สถานะการทำงาน

### ✅ เสร็จสมบูรณ์
1. ✅ Socket.io server และ client
2. ✅ Caching middleware
3. ✅ Rate limiting middleware
4. ✅ Broadcast functions ทั้งหมด
5. ✅ GamePlay, CheckinGame, UserBar ใช้ Socket.io
6. ✅ Routes ทั้งหมดใช้ Socket.io broadcast

### 🔄 กำลังดำเนินการ
1. 🔄 BingoGame.tsx - ต้องแก้ให้ใช้ Socket.io hooks
2. 🔄 LiveChat.tsx - ต้องแก้ให้ใช้ Socket.io hooks
3. 🔄 postgresql-adapter.ts - ต้องลบ getWebSocket()

### ⏳ ยังไม่ทำ
1. ⏳ ลบไฟล์ที่ไม่ใช้แล้ว
2. ⏳ เพิ่ม broadcast ใน gameState update (bingo)
3. ⏳ ตรวจสอบ multi-theme routing
4. ⏳ สร้างแผนผังสถาปัตยกรรม

---

## 📈 ผลลัพธ์ที่คาดหวัง

### ก่อนแก้ไข
- API Calls: ~20 ครั้ง/นาที/ผู้ใช้ (polling)
- Database Queries: สูงมาก
- Server Load: สูง

### หลังแก้ไข
- API Calls: 1 ครั้ง/ผู้ใช้ (initial load)
- Database Queries: ลดลง 95% (cache)
- Server Load: ต่ำมาก (real-time)

---

**อัปเดตล่าสุด**: 2025-01-22  
**สถานะ**: 🔄 กำลังดำเนินการ (80% เสร็จ)

