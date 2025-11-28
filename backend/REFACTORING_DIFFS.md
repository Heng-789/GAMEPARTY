# Git Diffs Summary

## Summary of Changes

All changes maintain backward compatibility. No breaking API changes.

---

## STEP 1: Replace Redis with Upstash

### package.json
```diff
- "ioredis": "^5.3.2",
+ "@upstash/redis": "^1.29.0",
```

### New File: backend/src/cache/upstashClient.js
- Upstash Redis client initialization
- Health check functions
- Graceful fallback handling

---

## STEP 2: Add Cache Layer

### New File: backend/src/cache/cacheService.js
- Clean cache abstraction
- `getCache(key)`, `setCache(key, value, ttl)`, `delCache(key)`
- `wrapCache(key, ttl, fetcher)` helper
- Automatic JSON handling
- In-memory fallback

---

## STEP 3: Add Snapshot Engine

### New File: backend/src/snapshot/snapshotEngine.js
- `gameSnapshot()`, `checkinSnapshot()`, `bingoSnapshot()` builders
- `getGameSnapshot()`, `getCheckinSnapshot()`, `getBingoSnapshot()` getters
- `startSnapshotEngine()` scheduler (runs every 3 seconds)
- Automatic snapshot precomputation

---

## STEP 4: Add Diff Engine

### New File: backend/src/socket/diffEngine.js
- `computeDiff()`, `mergeState()` core functions
- `getGameDiff()`, `getCheckinDiff()`, `getBingoDiff()` helpers
- Uses jsondiffpatch for deep diffing
- Stores last state in cache for comparison

---

## STEP 5: Update Socket.io

### backend/src/socket/index.js
```diff
- import { getGameDiff, getCheckinDiff, getBingoDiff } from '../services/diff.js';
+ import { getGameDiff, getCheckinDiff, getBingoDiff } from '../socket/diffEngine.js';
+ import { getGameSnapshot, getCheckinSnapshot, getBingoSnapshot } from '../snapshot/snapshotEngine.js';
+ import { delCache } from '../cache/cacheService.js';

- // Old state cache code removed
+ // State cache removed - now using cache service via diff engine

  // On subscribe: send snapshot immediately
+ const snapshot = await getGameSnapshot(finalTheme, gameId);
+ if (snapshot) {
+   socket.emit('game:updated', snapshot);
+ }

  // Broadcast functions updated to use snapshot + diff
+ export async function broadcastGameUpdate(theme, gameId, gameData) {
+   // Invalidate snapshot cache
+   await delCache(`snapshot:game:${gameId}`);
+   // Get snapshot for diff comparison
+   const snapshot = await getGameSnapshot(theme, gameId);
+   // Calculate diff and emit patch
+ }
```

---

## STEP 6: Update REST API Routes

### backend/src/routes/games.js
```diff
- import { getGameSnapshot, precomputeGameSnapshot } from '../services/snapshot.js';
- import { invalidateGameCache as invalidateRedisGameCache } from '../services/redis-cache.js';
+ import { getGameSnapshot } from '../snapshot/snapshotEngine.js';
+ import { delCache } from '../cache/cacheService.js';

  // GET /api/games/:id
  const snapshot = await getGameSnapshot(theme, trimmedGameId);
  if (snapshot) {
    res.set('X-Cache', 'HIT');
    return res.json(snapshot);
  }

  // POST/PUT/DELETE - invalidate cache
- invalidateGameCache(theme, gameId);
- await invalidateRedisGameCache(theme, gameId);
+ await delCache(`snapshot:game:${gameId}`);
+ await delCache(`diff:game:${gameId}`);
```

### backend/src/routes/users.js
```diff
- import { getCache, setCache, invalidateUserCache, DEFAULT_TTL } from '../services/redis-cache.js';
+ import { getCache, setCache, delCache } from '../cache/cacheService.js';

- await setCache('user', theme, userId, userData, DEFAULT_TTL.user);
+ await setCache(`user:${userId}`, userData, 120);

- await invalidateUserCache(theme, userId);
+ await delCache(`user:${userId}`);
```

### backend/src/routes/utils.js
```diff
- import { getCacheStats } from '../services/redis-cache.js';
- import { checkRedisHealth } from '../config/redis.js';
+ import { getCacheStats } from '../cache/cacheService.js';
+ import { checkRedisHealth } from '../cache/upstashClient.js';
```

---

## STEP 7: Update index.js

### backend/src/index.js
```diff
- import { initRedis, checkRedisHealth, isRedisAvailable } from './config/redis.js';
- import { precomputeAllGameSnapshots } from './services/snapshot.js';
+ import { initUpstashRedis, checkRedisHealth } from './cache/upstashClient.js';
+ import { startSnapshotEngine } from './snapshot/snapshotEngine.js';

- initRedis();
+ initUpstashRedis();

- // Old snapshot worker code removed
+ startSnapshotEngine();
```

---

## Files to Remove (After Verification)

These old files can be safely deleted:
- `backend/src/config/redis.js`
- `backend/src/services/redis-cache.js`
- `backend/src/services/snapshot.js`
- `backend/src/services/diff.js`
- `backend/src/middleware/redis-cache.js`

---

## Environment Variables

Add to `.env`:
```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
SNAPSHOT_INTERVAL=3000  # Optional, default: 3000ms
```

---

## Testing

1. Install dependencies: `npm install`
2. Set environment variables
3. Start server: `npm start`
4. Verify logs show "Upstash Redis initialized" and "Snapshot engine started"
5. Test API endpoints
6. Test Socket.io connections

---

*All changes are backward compatible. No frontend changes required.*

