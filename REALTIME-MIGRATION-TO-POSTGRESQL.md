# 🔄 Real-time Migration to PostgreSQL

## 📋 สรุปการ Migrate Real-time Features จาก Firebase ไป PostgreSQL

### ✅ สิ่งที่ทำเสร็จแล้ว

#### 1. PostgreSQL Adapter Functions
- ✅ BINGO: `getBingoCards`, `createBingoCard`, `updateBingoCard`, `getBingoPlayers`, `joinBingoGame`, `updateBingoPlayerReady`, `getBingoGameState`, `updateBingoGameState`
- ✅ Chat: `getChatMessages`, `sendChatMessage`
- ✅ Presence: `getRoomPresence`, `updatePresence`, `removePresence`

#### 2. Components ที่ Migrate แล้ว
- ✅ **LiveChat.tsx** - ใช้ PostgreSQL 100% (ลบ Firebase fallback แล้ว)
- ✅ **BingoGame.tsx** - Migrate listeners แล้ว:
  - ✅ Game state listener → PostgreSQL polling (ทุก 2 วินาที)
  - ✅ Players listener → PostgreSQL polling (ทุก 2 วินาที)
  - ✅ Cards listener → PostgreSQL polling (ทุก 2 วินาที)

### ⏳ สิ่งที่ต้องทำต่อ

#### 1. BingoGame.tsx
**สถานะปัจจุบัน:**
- ✅ ใช้ PostgreSQL adapter สำหรับ `joinBingoGame`, `updateBingoPlayerReady`, `createBingoCard`
- ✅ Migrate listeners แล้ว:
  - ✅ Game state listener → PostgreSQL polling (ทุก 2 วินาที)
  - ✅ Players listener → PostgreSQL polling (ทุก 2 วินาที)
  - ✅ Cards listener → PostgreSQL polling (ทุก 2 วินาที)
- ⏳ ยังใช้ Firebase transactions สำหรับ:
  - `startGame()` - ต้อง migrate
  - `startDrawingNumbers()` - ต้อง migrate
  - `handleGenerateCard()` - ต้อง migrate

**ต้องแก้ไข:**
1. ✅ แทนที่ Firebase listeners ด้วย PostgreSQL polling (ทุก 2 วินาที) - **เสร็จแล้ว**
2. ⏳ แทนที่ Firebase transactions ด้วย PostgreSQL API calls - **ยังต้องทำ**
3. ⏳ ใช้ WebSocket สำหรับ real-time updates (ถ้ามี) - **ยังต้องทำ**

#### 2. LoyKrathongGame.tsx
**สถานะปัจจุบัน:**
- ✅ ใช้ PostgreSQL adapter สำหรับ `claimCode`, `claimBigPrizeCode`
- ❌ ยังใช้ Firebase สำหรับ:
  - Real-time krathong positions (`krathongs/${gameId}/recent`) - Line 97
  - Total count transaction - Line 371

**ต้องแก้ไข:**
1. สร้าง backend API สำหรับ krathong positions (ถ้ายังไม่มี)
2. แทนที่ Firebase listener ด้วย PostgreSQL polling
3. แทนที่ Firebase transaction ด้วย PostgreSQL API

#### 3. realtime-presence.ts
**สถานะปัจจุบัน:**
- ❌ ยังใช้ Firebase 100% สำหรับ presence system

**ต้องแก้ไข:**
1. แทนที่ Firebase functions ด้วย PostgreSQL adapter
2. ใช้ WebSocket สำหรับ real-time presence updates

---

## 🔧 แนวทางการแก้ไข

### 1. BingoGame.tsx - Game State Listener

**เดิม (Firebase):**
```typescript
const gameStateRef = ref(db, `games/${gameId}/bingo/gameState`)
const unsubscribe = onValue(gameStateRef, (snapshot) => {
  // Update game state
})
```

**ใหม่ (PostgreSQL):**
```typescript
useEffect(() => {
  let intervalId: NodeJS.Timeout | null = null
  
  const fetchGameState = async () => {
    try {
      const state = await postgresqlAdapter.getBingoGameState(gameId)
      // Update game state
    } catch (error) {
      console.error('Error fetching game state:', error)
    }
  }
  
  fetchGameState()
  intervalId = setInterval(fetchGameState, 2000) // Poll every 2 seconds
  
  return () => {
    if (intervalId) clearInterval(intervalId)
  }
}, [gameId])
```

### 2. BingoGame.tsx - Players Listener

**เดิม (Firebase):**
```typescript
const playersRef = ref(db, `games/${gameId}/bingo/players`)
const unsubscribe = onValue(playersRef, (snapshot) => {
  // Update players
})
```

**ใหม่ (PostgreSQL):**
```typescript
useEffect(() => {
  let intervalId: NodeJS.Timeout | null = null
  
  const fetchPlayers = async () => {
    try {
      const players = await postgresqlAdapter.getBingoPlayers(gameId)
      // Update players
    } catch (error) {
      console.error('Error fetching players:', error)
    }
  }
  
  fetchPlayers()
  intervalId = setInterval(fetchPlayers, 2000) // Poll every 2 seconds
  
  return () => {
    if (intervalId) clearInterval(intervalId)
  }
}, [gameId])
```

### 3. BingoGame.tsx - Cards Listener

**เดิม (Firebase):**
```typescript
const cardsRef = ref(db, `games/${gameId}/bingo/cards`)
const unsubscribe = onValue(cardsQuery, (snapshot) => {
  // Update cards
})
```

**ใหม่ (PostgreSQL):**
```typescript
useEffect(() => {
  if (!gameId || !currentUser) return
  
  let intervalId: NodeJS.Timeout | null = null
  
  const fetchCards = async () => {
    try {
      const cards = await postgresqlAdapter.getBingoCards(gameId, currentUser.userId)
      // Update cards
    } catch (error) {
      console.error('Error fetching cards:', error)
    }
  }
  
  fetchCards()
  intervalId = setInterval(fetchCards, 2000) // Poll every 2 seconds
  
  return () => {
    if (intervalId) clearInterval(intervalId)
  }
}, [gameId, currentUser])
```

### 4. BingoGame.tsx - Game State Transactions

**เดิม (Firebase):**
```typescript
await runTransaction(gameStateRef, (currentData) => {
  // Update game state
  return newGameState
})
```

**ใหม่ (PostgreSQL):**
```typescript
const currentState = await postgresqlAdapter.getBingoGameState(gameId)
const newState = { ...currentState, ...updates }
await postgresqlAdapter.updateBingoGameState(gameId, newState)
```

---

## 📊 สรุป

### ✅ Completed
- PostgreSQL adapter functions สำหรับ BINGO, Chat, Presence
- LiveChat component migrated

### ⏳ In Progress
- BingoGame.tsx - ต้อง migrate listeners และ transactions
- LoyKrathongGame.tsx - ต้อง migrate real-time positions
- realtime-presence.ts - ต้อง migrate ทั้งหมด

### 🎯 Next Steps
1. Migrate BingoGame.tsx listeners → PostgreSQL polling
2. Migrate BingoGame.tsx transactions → PostgreSQL API
3. Migrate LoyKrathongGame.tsx real-time positions
4. Migrate realtime-presence.ts
5. Test all real-time features
6. Remove Firebase fallback code

