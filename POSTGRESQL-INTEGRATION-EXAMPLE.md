# 🔄 PostgreSQL Integration Example

ตัวอย่างการใช้งาน PostgreSQL API ใน frontend

---

## 📦 Import Services

```typescript
import {
  getUserData,
  updateUserData,
  addUserCoins,
  getGamesList,
  getGameData,
  checkin,
  getCheckins,
  getBingoCards,
  createBingoCard,
  updateBingoCard,
  getBingoGameState,
  updateBingoGameState,
} from '../services/postgresql-api';

import {
  getWebSocket,
  disconnectWebSocket,
} from '../services/postgresql-websocket';
```

---

## 👤 User Operations

### Get User Data
```typescript
const user = await getUserData('USER123');
console.log(user); // { userId: 'USER123', hcoin: 1000, status: 'active', ... }
```

### Update User Data
```typescript
const updated = await updateUserData('USER123', {
  hcoin: 1500,
  status: 'active'
});
```

### Add Coins
```typescript
const result = await addUserCoins('USER123', 100);
if (result.success) {
  console.log('New balance:', result.newBalance);
}
```

---

## 🎮 Game Operations

### Get Games List
```typescript
const games = await getGamesList();
games.forEach(game => {
  console.log(game.name, game.type);
});
```

### Get Game Data
```typescript
const game = await getGameData('GAME123');
if (game) {
  console.log('Game:', game.name);
}
```

---

## ✅ Checkin Operations

### Get Checkins
```typescript
const checkins = await getCheckins('GAME123', 'USER123', 30);
Object.entries(checkins).forEach(([dayIndex, data]) => {
  if (data.checked) {
    console.log(`Day ${dayIndex}: Checked in on ${data.date}`);
  }
});
```

### Check In
```typescript
const serverDate = new Date().toISOString().split('T')[0];
const uniqueKey = `${Date.now()}-${Math.random()}`;

const result = await checkin('GAME123', 'USER123', 0, serverDate, uniqueKey);
if (result.success) {
  console.log('Checked in successfully!');
} else {
  console.error('Error:', result.error);
}
```

### Claim Complete Reward
```typescript
const uniqueKey = `${Date.now()}-${Math.random()}`;
const result = await claimCompleteReward('GAME123', 'USER123', uniqueKey);
if (result.success) {
  console.log('Reward claimed!');
}
```

---

## 🎯 Bingo Operations

### Get Bingo Cards
```typescript
const cards = await getBingoCards('GAME123', 'USER123');
cards.forEach(card => {
  console.log('Card:', card.id, 'Numbers:', card.numbers);
});
```

### Create Bingo Card
```typescript
const numbers = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  // ... 5x5 array
];

const card = await createBingoCard('GAME123', 'USER123', numbers);
console.log('Created card:', card.id);
```

### Update Bingo Card
```typescript
const checkedNumbers = [
  [true, false, true, false, false],
  // ... 5x5 boolean array
];

const updated = await updateBingoCard('GAME123', 'CARD123', checkedNumbers);
```

### Get Game State
```typescript
const state = await getBingoGameState('GAME123');
console.log('Game phase:', state.gamePhase);
console.log('Drawn numbers:', state.drawnNumbers);
```

### Update Game State
```typescript
await updateBingoGameState('GAME123', {
  gamePhase: 'playing',
  currentNumber: 42,
  drawnNumbers: [1, 2, 3, 42]
});
```

---

## 🔌 WebSocket Operations

### Setup WebSocket
```typescript
import { getWebSocket } from '../services/postgresql-websocket';

const ws = getWebSocket();
```

### Presence
```typescript
// Join presence
ws.joinPresence('GAME123', 'ROOM1', 'USER123', 'Username');

// Update presence
ws.updatePresence('GAME123', 'ROOM1', 'USER123', 'away');

// Listen to presence updates
ws.onPresenceUpdated((data) => {
  console.log('Presence updated:', data);
});

// Leave presence
ws.leavePresence('GAME123', 'ROOM1', 'USER123');
```

### Bingo
```typescript
// Update bingo card
ws.updateBingoCard('GAME123', 'USER123', 'CARD123', checkedNumbers);

// Listen to card updates
ws.onBingoCardUpdated((data) => {
  console.log('Card updated:', data);
});

// Get game state
ws.getBingoGameState('GAME123');

// Listen to game state updates
ws.onBingoGameStateUpdated((data) => {
  console.log('Game state updated:', data);
});
```

### Cleanup
```typescript
// Disconnect when done
ws.disconnect();
```

---

## 🔄 React Hook Example

### useUserData Hook
```typescript
import { useState, useEffect } from 'react';
import { getUserData, UserData } from '../services/postgresql-api';

export function useUserData(userId: string) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        setLoading(true);
        const data = await getUserData(userId);
        if (!cancelled) {
          setUser(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (userId) {
      fetchUser();
    }

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { user, loading, error };
}
```

### useBingoGame Hook
```typescript
import { useState, useEffect } from 'react';
import { getBingoGameState, updateBingoGameState, BingoGameState } from '../services/postgresql-api';
import { getWebSocket } from '../services/postgresql-websocket';

export function useBingoGame(gameId: string) {
  const [state, setState] = useState<BingoGameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchState() {
      try {
        const data = await getBingoGameState(gameId);
        if (!cancelled) {
          setState(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching game state:', err);
          setLoading(false);
        }
      }
    }

    fetchState();

    // Listen to WebSocket updates
    const ws = getWebSocket();
    const handleUpdate = (data: any) => {
      if (data.gameId === gameId && !cancelled) {
        setState(prev => ({ ...prev, ...data }));
      }
    };

    ws.onBingoGameStateUpdated(handleUpdate);

    return () => {
      cancelled = true;
      ws.removeEventListener('bingo:game:state:updated', handleUpdate);
    };
  }, [gameId]);

  const updateState = async (updates: Partial<BingoGameState>) => {
    try {
      const newState = await updateBingoGameState(gameId, updates);
      setState(newState);
    } catch (err) {
      console.error('Error updating game state:', err);
    }
  };

  return { state, loading, updateState };
}
```

---

## 🔄 Migration from Firebase

### Before (Firebase)
```typescript
import { ref, get } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';

// Get user
const userRef = ref(db, `USERS_EXTRA/${userId}`);
const snapshot = await get(userRef);
const user = snapshot.val();

// Get game
const gameRef = ref(db, `games/${gameId}`);
const snapshot = await get(gameRef);
const game = snapshot.val();
```

### After (PostgreSQL API)
```typescript
import { getUserData, getGameData } from '../services/postgresql-api';

// Get user
const user = await getUserData(userId);

// Get game
const game = await getGameData(gameId);
```

---

## ⚠️ Error Handling

```typescript
import { ApiError } from '../services/postgresql-api';

try {
  const user = await getUserData('USER123');
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      console.log('User not found');
    } else if (error.status === 500) {
      console.error('Server error');
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## 🎯 Best Practices

1. **Error Handling**: ใช้ try-catch สำหรับทุก API call
2. **Loading States**: แสดง loading state ขณะ fetch ข้อมูล
3. **Caching**: ใช้ cache สำหรับข้อมูลที่ไม่เปลี่ยนบ่อย
4. **WebSocket Cleanup**: ลบ event listeners เมื่อ component unmount
5. **Retry Logic**: เพิ่ม retry logic สำหรับ network errors

---

## 📚 Related Documents

- `POSTGRESQL-SETUP-GUIDE.md` - คู่มือการตั้งค่า
- `POSTGRESQL-MIGRATION-PLAN.md` - แผนการ migration
- `src/services/postgresql-api.ts` - API service definitions

