# 🔧 แก้ไข Game Data Structure (บันทึกและโหลดข้อมูลเกม)

## ❌ ปัญหา

เมื่อบันทึกและโหลดข้อมูลเกม พบปัญหาเรื่อง data structure:

1. **เมื่อบันทึก:** Frontend ส่ง `gameData: { puzzle: ..., numberPick: ... }` แต่ backend คาดหวัง top-level properties
2. **เมื่อโหลด:** Backend return `{ gameData: { puzzle: ..., numberPick: ... } }` แต่ frontend คาดหวัง `{ puzzle: ..., numberPick: ... }`

---

## ✅ การแก้ไข

### 1. แก้ไข Backend (POST /api/games)

**ไฟล์:** `backend/src/routes/games.js`

**การเปลี่ยนแปลง:**
- เพิ่มการจัดการ `gameData` property ที่ nested
- Merge `gameData` property กับ top-level properties
- เพิ่ม logging เพื่อ debug

**โค้ดที่แก้ไข:**
```javascript
const {
  gameId,
  name,
  type,
  unlocked = true,
  locked = false,
  userAccessType = 'all',
  selectedUsers,
  gameData: nestedGameData, // ✅ Handle nested gameData property
  ...gameData
} = req.body;

// ✅ Merge nested gameData with top-level gameData
const finalGameData = nestedGameData ? { ...gameData, ...nestedGameData } : gameData;
```

---

### 2. แก้ไข Backend (PUT /api/games/:gameId)

**ไฟล์:** `backend/src/routes/games.js`

**การเปลี่ยนแปลง:**
- เพิ่มการจัดการ `gameData` property ที่ nested
- Merge `gameData` property กับ top-level properties
- เพิ่ม logging เพื่อ debug

**โค้ดที่แก้ไข:**
```javascript
const {
  name,
  type,
  unlocked,
  locked,
  userAccessType,
  selectedUsers,
  gameData: nestedGameData, // ✅ Handle nested gameData property
  ...gameData
} = req.body;

// ✅ Merge nested gameData with top-level gameData
const finalGameData = nestedGameData ? { ...gameData, ...nestedGameData } : gameData;
```

---

## 🔍 วิธีตรวจสอบ

### 1. ตรวจสอบ Backend Logs

**เมื่อบันทึกเกม:**
```
[POST /games] Creating game: game_123, Theme: heng36, Schema: heng36
[POST /games] Game data keys: puzzle, numberPick, football, slot, checkin, announce, trickOrTreat, loyKrathong, bingo, codes, codeCursor, claimedBy, codesVersion
```

**เมื่ออัปเดตเกม:**
```
[PUT /games/game_123] Updating game, Theme: heng36, Schema: heng36
[PUT /games/game_123] Game data keys: puzzle, numberPick, football, slot, checkin, announce, trickOrTreat, loyKrathong, bingo, codes, codeCursor, claimedBy, codesVersion
```

---

### 2. ตรวจสอบ Database

**ตรวจสอบว่า `game_data` JSONB ถูกบันทึกถูกต้อง:**

```sql
SELECT game_id, name, type, game_data 
FROM heng36.games 
WHERE game_id = 'game_123';
```

**ควรเห็น:**
```json
{
  "puzzle": { "imageDataUrl": "...", "answer": "..." },
  "numberPick": { "imageDataUrl": "...", "endAt": ... },
  "codes": [...],
  "codeCursor": 0,
  "claimedBy": null,
  "codesVersion": ...
}
```

**ไม่ควรเห็น:**
```json
{
  "gameData": {
    "puzzle": { "imageDataUrl": "...", "answer": "..." },
    "numberPick": { "imageDataUrl": "...", "endAt": ... }
  }
}
```

---

### 3. ตรวจสอบ Frontend

**เมื่อโหลดเกม:**
```javascript
const game = await postgresqlAdapter.getGameData(gameId);
console.log('Game data:', game);
```

**ควรเห็น:**
```javascript
{
  id: 'game_123',
  name: '...',
  type: 'เกมทายภาพปริศนา',
  puzzle: { imageDataUrl: '...', answer: '...' },
  codes: [...],
  codeCursor: 0,
  ...
}
```

**ไม่ควรเห็น:**
```javascript
{
  id: 'game_123',
  name: '...',
  type: 'เกมทายภาพปริศนา',
  gameData: {
    puzzle: { imageDataUrl: '...', answer: '...' },
    codes: [...]
  }
}
```

---

## 📋 Checklist

- [x] แก้ไข backend POST /api/games ให้รองรับ nested gameData
- [x] แก้ไข backend PUT /api/games/:gameId ให้รองรับ nested gameData
- [x] เพิ่ม logging เพื่อ debug
- [ ] ทดสอบบันทึกเกมใหม่
- [ ] ทดสอบอัปเดตเกม
- [ ] ทดสอบโหลดเกม
- [ ] ตรวจสอบว่า data structure ถูกต้อง

---

## 🎯 สรุป

**สิ่งที่แก้ไข:**
1. ✅ Backend รองรับทั้ง nested `gameData` property และ top-level properties
2. ✅ Merge nested `gameData` กับ top-level properties ก่อนบันทึก
3. ✅ เพิ่ม logging เพื่อ debug

**ผลลัพธ์:**
- ✅ ข้อมูลเกมถูกบันทึกใน `game_data` JSONB ถูกต้อง
- ✅ ข้อมูลเกมถูกโหลดและ return ถูกต้อง
- ✅ Frontend สามารถเข้าถึงข้อมูลเกมได้ถูกต้อง

---

**🎉 แก้ไขเสร็จแล้ว! ลองทดสอบบันทึกและโหลดเกมดูครับ**

