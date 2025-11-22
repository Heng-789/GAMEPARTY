# 🔄 Frontend Migration Progress

## ✅ Completed

### Backend:
- ✅ Added DELETE endpoint for games (`/api/games/:gameId`)
- ✅ All routes support PostgreSQL with multi-theme

### Frontend Services:
- ✅ `postgresql-api.ts` - Added `deleteGame()` function
- ✅ `postgresql-adapter.ts` - Added `deleteGame()` function

### Frontend Components:
- ✅ **`useOptimizedData.ts`** - Updated to use PostgreSQL adapter
  - Changed from `firebase-optimized` to `postgresql-adapter`
  - Updated `useGameData`, `useGamesList`, `useUserData`, `useCheckinData`
  - Updated `useRealtimeData` to use polling (WebSocket support needed later)

- ✅ **`Home.tsx`** - Updated to use PostgreSQL adapter
  - Changed from Firebase `remove()` to `deleteGame()` from adapter
  - Removed Firebase imports

---

## ⏳ In Progress / Pending

### Components ที่ต้องอัพเดท:

1. **`PuzzleGame.tsx`** - ต้องอัพเดท:
   - ✅ Change imports from Firebase to PostgreSQL adapter
   - ❌ Update `getExistingCode()` to use `getAnswers()` from adapter
   - ❌ Update `writeAnswer()` to use `submitAnswer()` from adapter
   - ❌ Update `claimCode()` - ต้องสร้าง API endpoint สำหรับ claim code transaction
   - ❌ Remove Firebase imports

2. **`CheckinGame.tsx`** - ซับซ้อนมาก ต้องอัพเดท:
   - ❌ Change imports from Firebase to PostgreSQL adapter
   - ❌ Update `checkin()` to use `checkin()` from adapter
   - ❌ Update `claimCompleteReward()` to use `claimCompleteReward()` from adapter
   - ❌ Update `getServerTime()` - ต้องสร้าง API endpoint สำหรับ server time
   - ❌ Update user data fetching to use `getUserData()` from adapter
   - ❌ Remove Firebase imports

3. **`BingoGame.tsx`** - ต้องอัพเดท:
   - ❌ Change imports from Firebase to PostgreSQL adapter
   - ❌ Update bingo card operations to use adapter
   - ❌ Update presence operations to use WebSocket
   - ❌ Remove Firebase imports

4. **`CreateGame.tsx`** - ต้องอัพเดท:
   - ❌ Change imports from Firebase to PostgreSQL adapter
   - ❌ Update `createGame()` to use `createGame()` from adapter
   - ❌ Update `updateGame()` to use `updateGame()` from adapter
   - ❌ Remove Firebase imports

5. **Other Components**:
   - ❌ `SlotGame.tsx`
   - ❌ `CouponGame.tsx`
   - ❌ `LoyKrathongGame.tsx`
   - ❌ `TrickOrTreatGame.tsx`
   - ❌ `UserBar.tsx`
   - ❌ `LiveChat.tsx`

---

## 🔧 Required Backend Changes

### 1. Claim Code API Endpoint

ต้องสร้าง API endpoint สำหรับ claim code transaction:

```javascript
// backend/src/routes/games.js
router.post('/:gameId/claim-code', async (req, res) => {
  // Transaction logic for claiming code
  // Similar to runTransaction in Firebase
});
```

### 2. Server Time API Endpoint

ต้องสร้าง API endpoint สำหรับดึง server time:

```javascript
// backend/src/routes/utils.js (new file)
router.get('/server-time', async (req, res) => {
  res.json({ serverTime: Date.now() });
});
```

---

## 📋 Migration Checklist

### Backend:
- [x] DELETE endpoint for games
- [ ] Claim code endpoint
- [ ] Server time endpoint

### Frontend Services:
- [x] `postgresql-api.ts` - deleteGame
- [x] `postgresql-adapter.ts` - deleteGame
- [ ] `postgresql-api.ts` - claimCode
- [ ] `postgresql-adapter.ts` - claimCode

### Frontend Components:
- [x] `useOptimizedData.ts`
- [x] `Home.tsx`
- [ ] `PuzzleGame.tsx`
- [ ] `CheckinGame.tsx`
- [ ] `BingoGame.tsx`
- [ ] `CreateGame.tsx`
- [ ] Other game components

### Environment:
- [ ] Setup `.env` with `VITE_USE_POSTGRESQL=true`
- [ ] Setup `VITE_API_URL=http://localhost:3000`

---

## 🎯 Next Steps

1. **สร้าง Backend API endpoints**:
   - Claim code endpoint
   - Server time endpoint

2. **อัพเดท Frontend Components**:
   - Start with simpler components (PuzzleGame, CreateGame)
   - Then move to complex components (CheckinGame, BingoGame)

3. **Test & Verify**:
   - Test each component after migration
   - Verify data consistency
   - Check error handling

---

## 📊 Progress Summary

- **Backend**: ✅ 100% (except new endpoints needed)
- **Frontend Services**: ✅ ~90% (need claimCode)
- **Frontend Components**: ✅ ~15% (2/14 files done)

**Overall**: ~40% Complete

---

## ⚠️ Important Notes

1. **CheckinGame.tsx** is very complex - needs careful migration
2. **Server Time** - Need API endpoint for security (prevent time manipulation)
3. **Claim Code Transaction** - Need atomic transaction support in backend
4. **Real-time Updates** - Currently using polling, WebSocket support needed for better UX

---

**Last Updated**: After initial migration of useOptimizedData.ts and Home.tsx

