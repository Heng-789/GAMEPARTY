# Bandwidth Optimization Analysis & Plan

## STEP 1: Current Usage Analysis

### HTTP REST API Routes (Heavy JSON Responses)

#### 1. **GET /api/games**
- **Data**: Returns all games with full `game_data` JSONB field (can be very large)
- **Frequency**: Called on every page load, game list view
- **Size Estimate**: ~5-50KB per game × N games (could be 100KB-5MB total)
- **Issues**:
  - Returns entire `game_data` object which may contain large nested configs
  - No pagination
  - No field projection

#### 2. **GET /api/games/:gameId**
- **Data**: Single game with full `game_data` JSONB
- **Frequency**: Called on every game page load, Socket.io fallback
- **Size Estimate**: ~5-50KB per game
- **Issues**:
  - Returns entire `game_data` even if frontend only needs specific fields
  - No compression enabled

#### 3. **GET /api/answers/:gameId**
- **Data**: Array of answers (up to 50 by default, configurable via `limit`)
- **Frequency**: Called on game page load, polling fallback
- **Size Estimate**: ~1-5KB per answer × 50 = 50-250KB
- **Issues**:
  - Default limit of 50 may be too high
  - Returns full answer objects with parsed JSON fields
  - No pagination (only limit)

#### 4. **GET /api/checkins/:gameId/:userId**
- **Data**: Object mapping day_index to checkin data (up to 30 days by default)
- **Frequency**: Called on checkin game page load, Socket.io fallback
- **Size Estimate**: ~200 bytes per day × 30 = ~6KB
- **Issues**: Relatively small, but called frequently

#### 5. **GET /api/bingo/:gameId/cards**
- **Data**: Array of bingo cards with full `numbers` and `checked_numbers` arrays
- **Frequency**: Called on bingo game page load
- **Size Estimate**: ~500 bytes per card × N cards = variable
- **Issues**: Returns full card data even if only status needed

#### 6. **GET /api/users/top**
- **Data**: Array of top users (up to 100 by default)
- **Frequency**: Called on leaderboard page load
- **Size Estimate**: ~100 bytes per user × 100 = ~10KB
- **Issues**: Returns password field (security + bandwidth concern)

#### 7. **GET /api/users/search/:searchTerm**
- **Data**: Array of matching users (up to 100 by default)
- **Frequency**: Called on user search
- **Size Estimate**: ~100 bytes per user × 100 = ~10KB
- **Issues**: Returns password field

### WebSocket / Socket.io Events (Server → Client)

#### 1. **game:updated**
- **Event**: `game:updated`
- **Data**: Full game object with entire `game_data` JSONB
- **Frequency**: Emitted on game create/update, subscribed by all clients viewing that game
- **Size Estimate**: ~5-50KB per emit
- **Issues**:
  - Sends full game object even for small changes
  - No diff/patch mechanism
  - Broadcasts to all subscribers even if only one field changed

#### 2. **checkin:updated**
- **Event**: `checkin:updated`
- **Data**: Full checkins object (all days for a user)
- **Frequency**: Emitted on checkin POST, subscribed by user viewing checkin game
- **Size Estimate**: ~6KB per emit
- **Issues**:
  - Sends all checkin days even if only one day changed
  - Could send only the changed day

#### 3. **answer:updated**
- **Event**: `answer:updated`
- **Data**: Array with single new answer (or full array on subscribe)
- **Frequency**: Emitted on answer POST, subscribed by all clients viewing that game
- **Size Estimate**: ~1-5KB per emit
- **Issues**: Relatively efficient (only sends new answer), but could be optimized further

#### 4. **user:updated**
- **Event**: `user:updated`
- **Data**: User object (userId, hcoin, status)
- **Frequency**: Emitted on user data change, subscribed by user
- **Size Estimate**: ~100 bytes per emit
- **Issues**: Small, but could add caching hints

#### 5. **bingo:***
- **Event**: `bingo:cards`, `bingo:numbers`, etc.
- **Data**: Full bingo game state or card arrays
- **Frequency**: Emitted on bingo actions
- **Size Estimate**: Variable, could be large
- **Issues**: Sends full state instead of diffs

#### 6. **chat:message**
- **Event**: `chat:message`
- **Data**: Single chat message
- **Frequency**: Emitted on message send
- **Size Estimate**: ~200 bytes per message
- **Issues**: Relatively efficient

---

## Optimization Plan

### HTTP (REST) Optimizations

1. **Response Compression**
   - ✅ Add `compression` middleware with gzip/brotli
   - ✅ Enable for all JSON responses
   - ✅ Exclude already-compressed types (images, videos)
   - ✅ Configurable via environment variables

2. **Reduce JSON Size**
   - ✅ Remove unused fields (e.g., `password` from user responses)
   - ✅ Add pagination to list endpoints (`/api/games`, `/api/answers`)
   - ✅ Add field projection for game data (query param `?fields=id,name,type`)
   - ✅ Reduce default limits (e.g., answers from 50 to 20)
   - ✅ Cache static config data, send only what's needed

3. **HTTP Caching**
   - ✅ Add `Cache-Control` headers for static/semi-static data
   - ✅ Add `ETag` support for conditional GETs
   - ✅ Use `Last-Modified` where appropriate
   - ✅ Cache game list (changes infrequently)

### WebSocket / Socket.io Optimizations

1. **Send Diffs Instead of Full Objects**
   - ✅ `game:updated`: Send only changed fields (`{ gameId, changes: { field: value } }`)
   - ✅ `checkin:updated`: Send only changed day (`{ gameId, userId, dayIndex, checkin }`)
   - ✅ `answer:updated`: Already efficient (only new answer), keep as-is
   - ✅ `bingo:*`: Send only changed card/state instead of full arrays

2. **Throttle High-Frequency Emits**
   - ✅ Debounce rapid game updates (max once per 100ms per game)
   - ✅ Batch multiple checkin updates if they happen quickly

3. **Conditional Emits**
   - ✅ Only emit if data actually changed (compare with previous state)
   - ✅ Skip emit if no subscribers

### Rate Limiting

1. **Heavy Endpoints**
   - ✅ `/api/games` - 60 req/min per IP
   - ✅ `/api/answers/:gameId` - 120 req/min per IP
   - ✅ `/api/users/search/:searchTerm` - 30 req/min per IP
   - ✅ `/api/users/top` - 60 req/min per IP
   - ✅ All limits configurable via environment variables

### Instrumentation

1. **Response Size Logging**
   - ✅ Wrap `res.json()` to log approximate payload size
   - ✅ Log Socket.io emit sizes
   - ✅ Add metrics for top bandwidth consumers

---

## Expected Bandwidth Reduction

- **Compression**: 60-80% reduction for JSON responses
- **Field Projection**: 30-50% reduction for game endpoints
- **Pagination**: 50-90% reduction for list endpoints
- **Socket Diffs**: 70-90% reduction for game/checkin updates
- **Overall**: **50-70% total bandwidth reduction** expected

---

## Implementation Order

1. ✅ **STEP 2**: HTTP Compression + JSON Size Reduction
2. ✅ **STEP 3**: HTTP Caching Headers
3. ✅ **STEP 4**: WebSocket Diffs
4. ✅ **STEP 5**: Rate Limiting (already partially implemented, enhance)
5. ✅ **STEP 6**: Instrumentation

---

## Frontend Impact

- **Breaking Changes**: None (backward compatible)
- **New Features**: 
  - Pagination support for list endpoints
  - Field projection query params
  - Socket.io diff handling (optional, falls back to full object)
- **Required Updates**: 
  - Handle pagination in list views
  - Use field projection for game data if needed
  - Handle Socket.io diff format (optional)

