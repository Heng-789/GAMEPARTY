# 🚀 PostgreSQL Quick Start Guide

## ⚠️ สถานะปัจจุบัน

**โปรเจคยังไม่พร้อม 100%** - Frontend ยังใช้ Firebase อยู่

แต่สามารถเริ่มใช้งาน PostgreSQL ได้แล้วด้วย **Adapter Layer**

---

## ✅ สิ่งที่พร้อมแล้ว

1. ✅ **Backend API** - พร้อมใช้งาน 100%
2. ✅ **PostgreSQL Database** - Schema พร้อม
3. ✅ **Migration Scripts** - ย้ายข้อมูลได้
4. ✅ **Frontend API Services** - `postgresql-api.ts`, `postgresql-websocket.ts`
5. ✅ **Adapter Layer** - `postgresql-adapter.ts` (ใหม่!)

---

## 🎯 วิธีใช้งาน PostgreSQL (Gradual Migration)

### Step 1: Setup Backend

```bash
# 1. สร้าง database
createdb heng36game

# 2. รัน migrations
psql -d heng36game -f migrations/001_create_tables.sql

# 3. Setup backend
cd backend
npm install
cp .env.example .env
# แก้ไข .env

# 4. Start backend
npm run dev
```

### Step 2: Migrate Data

```bash
cd backend
node scripts/migrate-from-firebase.js heng36
```

### Step 3: Configure Frontend

สร้างไฟล์ `.env` ใน root directory:

```env
# ใช้ PostgreSQL API
VITE_USE_POSTGRESQL=true

# Fallback ไป Firebase ถ้า PostgreSQL error (optional)
VITE_FALLBACK_FIREBASE=false

# API URL
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Step 4: ใช้ Adapter Layer

แทนที่จะใช้ Firebase services โดยตรง ให้ใช้ adapter:

```typescript
// ❌ เดิม
import { getGameData } from './services/firebase-optimized';

// ✅ ใหม่
import { getGameData } from './services/postgresql-adapter';
```

Adapter จะ:
- ใช้ PostgreSQL API ถ้า `VITE_USE_POSTGRESQL=true`
- Fallback ไป Firebase ถ้า error และ `VITE_FALLBACK_FIREBASE=true`
- ใช้ Firebase ถ้า `VITE_USE_POSTGRESQL=false`

---

## 📝 ตัวอย่างการใช้งาน

### Users
```typescript
import { getUserData, addUserCoins } from './services/postgresql-adapter';

// Get user
const user = await getUserData('USER123');

// Add coins
const result = await addUserCoins('USER123', 100);
```

### Games
```typescript
import { getGameData, getGamesList } from './services/postgresql-adapter';

// Get game
const game = await getGameData('GAME123');

// Get games list
const games = await getGamesList();
```

### Checkins
```typescript
import { checkin, getCheckins } from './services/postgresql-adapter';

// Check in
await checkin('GAME123', 'USER123', 0, '2024-01-01', 'unique-key');

// Get checkins
const checkins = await getCheckins('GAME123', 'USER123', 30);
```

### Bingo
```typescript
import { getBingoCards, createBingoCard, updateBingoCard } from './services/postgresql-adapter';

// Get cards
const cards = await getBingoCards('GAME123', 'USER123');

// Create card
const card = await createBingoCard('GAME123', 'USER123', numbers);

// Update card
await updateBingoCard('GAME123', 'CARD123', checkedNumbers);
```

---

## 🔄 Migration Strategy

### Phase 1: Test with Adapter (ตอนนี้)
1. Setup backend
2. Migrate data
3. ใช้ adapter layer ใน components ที่ต้องการทดสอบ
4. ทดสอบว่า PostgreSQL ทำงานได้

### Phase 2: Update Components
1. อัพเดท components ให้ใช้ adapter
2. ทดสอบทีละ component
3. เมื่อมั่นใจแล้ว ปิด Firebase fallback

### Phase 3: Remove Firebase
1. ลบ Firebase dependencies
2. ลบ Firebase code
3. ใช้ PostgreSQL 100%

---

## ⚙️ Configuration Options

### Environment Variables

```env
# ใช้ PostgreSQL API (default: true)
VITE_USE_POSTGRESQL=true

# Fallback ไป Firebase ถ้า error (default: false)
VITE_FALLBACK_FIREBASE=false

# API URLs
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Switch Between Firebase and PostgreSQL

```typescript
// ใช้ PostgreSQL
VITE_USE_POSTGRESQL=true
VITE_FALLBACK_FIREBASE=false

// ใช้ Firebase
VITE_USE_POSTGRESQL=false

// ใช้ PostgreSQL แต่ fallback Firebase
VITE_USE_POSTGRESQL=true
VITE_FALLBACK_FIREBASE=true
```

---

## 🧪 Testing

### Test Backend
```bash
# Health check
curl http://localhost:3000/health

# Get games
curl http://localhost:3000/api/games

# Get user
curl http://localhost:3000/api/users/USER123
```

### Test Frontend
1. เปิด browser console
2. ดู logs ว่าใช้ PostgreSQL หรือ Firebase
3. ทดสอบ functions ต่างๆ

---

## ⚠️ Important Notes

1. **Firebase Auth**: ยังต้องใช้ Firebase Auth สำหรับ login (หรือสร้าง auth system ใหม่)
2. **Real-time Updates**: ใช้ WebSocket สำหรับ real-time (แทน Firebase listeners)
3. **Gradual Migration**: สามารถ migrate ทีละ component ได้
4. **Testing**: ทดสอบให้แน่ใจก่อนปิด Firebase

---

## 📚 Next Steps

1. ✅ Setup backend และ migrate data
2. ✅ ทดสอบ adapter layer
3. ⏳ อัพเดท components ให้ใช้ adapter
4. ⏳ ทดสอบทั้งหมด
5. ⏳ ปิด Firebase

---

## 🆘 Troubleshooting

### Backend ไม่ทำงาน
```bash
# ตรวจสอบว่า backend รันอยู่
curl http://localhost:3000/health

# ตรวจสอบ database connection
psql -d heng36game -c "SELECT 1"
```

### Frontend ยังใช้ Firebase
- ตรวจสอบ `.env` file
- ตรวจสอบว่า `VITE_USE_POSTGRESQL=true`
- Restart dev server

### Migration Errors
- ตรวจสอบ database connection
- ตรวจสอบว่า migrations รันแล้ว
- ดู logs ใน console

---

พร้อมเริ่มใช้งานแล้ว! 🚀

