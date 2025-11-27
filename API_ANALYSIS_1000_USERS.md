# การวิเคราะห์ API Calls เมื่อผู้ใช้ 1000 คนเข้าหน้าเกมพร้อมกัน

## สรุป API Calls ที่เกิดขึ้นเมื่อผู้ใช้เข้าหน้าเกม

### 1. Authentication & Session Check (ทุกคน)
- **Supabase Auth API**: `getSession()` 
  - จำนวน: **1,000 calls**
  - ไฟล์: `src/App.tsx` (RequireAuth component)
  - หมายเหตุ: ตรวจสอบ session ทุกครั้งที่เข้าหน้า

### 2. Socket.io Connection (ทุกคน)
- **WebSocket Connection**: Socket.io connection
  - จำนวน: **1,000 connections**
  - ไฟล์: `src/services/socket-io-client.ts`
  - หมายเหตุ: แต่ละ user จะสร้าง WebSocket connection 1 ตัว

### 3. Game Data Loading (ทุกคน)
- **API**: `GET /api/games/{gameId}`
  - จำนวน: **1,000 calls** (fallback ถ้า Socket.io ยังไม่พร้อม)
  - ไฟล์: `src/hooks/useSocketIO.ts` → `useSocketIOGameData`
  - หมายเหตุ: 
    - ใช้ Socket.io เป็นหลัก (subscribe:game)
    - ถ้า Socket.io ยังไม่เชื่อมต่อภายใน 3 วินาที จะ fallback ไปเรียก API

### 4. User Data Loading (เมื่อกรอก username)
- **API**: `GET /api/users/{userId}`
  - จำนวน: **1,000 calls** (ถ้าทุกคนกรอก username)
  - ไฟล์: `src/pages/games/GamePlay.tsx` (line 728-752)
  - หมายเหตุ: 
    - เรียกเมื่อ username เปลี่ยน (debounce 800ms)
    - อาจเรียกหลายครั้งถ้า username เปลี่ยน

### 5. Answers Data (สำหรับเกมบางประเภท)
- **API**: `GET /api/answers?gameId={gameId}&limit=100`
  - จำนวน: **1,000 calls** (สำหรับเกมทายภาพปริศนา, ทายเบอร์เงิน, ทายผลบอล)
  - ไฟล์: `src/pages/games/GamePlay.tsx` (line 394, 1204, 1319)
  - หมายเหตุ: 
    - เรียกเฉพาะเกมที่ต้องการแสดงคำตอบ
    - ใช้ Socket.io subscribe:answers เป็นหลัก

### 6. Checkin Data (สำหรับเกมเช็คอิน)
- **API**: `GET /api/checkins?gameId={gameId}&userId={userId}&maxDays=30`
  - จำนวน: **1,000 calls** (เฉพาะเกมเช็คอิน)
  - ไฟล์: `src/hooks/useSocketIO.ts` → `useSocketIOCheckinData`
  - หมายเหตุ: 
    - ใช้ Socket.io subscribe:checkin เป็นหลัก
    - Fallback ถ้า Socket.io ยังไม่พร้อม

### 7. Bingo Data (สำหรับเกม BINGO)
- **API**: `GET /api/bingo/game/{gameId}/cards`
  - จำนวน: **1,000 calls** (เฉพาะเกม BINGO)
  - ไฟล์: `src/components/BingoGame.tsx`
  - หมายเหตุ: ใช้ Socket.io subscribe:bingo เป็นหลัก

## สรุป API Calls ทั้งหมด (กรณี 1000 users)

### HTTP REST API Calls:
1. **Supabase Auth API** (`getSession()`): **1,000 calls**
   - เรียกเมื่อเข้าหน้า (RequireAuth component)
   
2. **GET /api/games/{gameId}**: **1,000 calls** (fallback)
   - เรียกเมื่อ Socket.io ยังไม่พร้อม (ภายใน 3 วินาที)
   - ไฟล์: `src/hooks/useSocketIO.ts` → `useSocketIOGameData`
   
3. **GET /api/users/{userId}**: **1,000-3,000 calls** (เมื่อกรอก username)
   - เรียกเมื่อ username เปลี่ยน (debounce 800ms)
   - อาจเรียกหลายครั้งถ้า username เปลี่ยนหลายครั้ง
   - ไฟล์: `src/pages/games/GamePlay.tsx` (line 728-752)
   
4. **GET /api/answers?gameId={gameId}&limit=100**: **1,000-3,000 calls**
   - เรียกสำหรับเกมทายภาพปริศนา, ทายเบอร์เงิน, ทายผลบอล
   - เรียกหลายครั้งใน useEffects ต่างๆ
   - ไฟล์: `src/pages/games/GamePlay.tsx` (line 394, 1204, 1319)
   
5. **GET /api/checkins?gameId={gameId}&userId={userId}&maxDays=30**: **1,000 calls** (เฉพาะเกมเช็คอิน)
   - Fallback ถ้า Socket.io ยังไม่พร้อม
   - ไฟล์: `src/hooks/useSocketIO.ts` → `useSocketIOCheckinData`
   
6. **GET /api/bingo/game/{gameId}/cards**: **1,000 calls** (เฉพาะเกม BINGO)
   - เรียกเมื่อเข้าหน้าเกม BINGO
   - ไฟล์: `src/components/BingoGame.tsx`

**รวม HTTP REST API (กรณีแย่ที่สุด)**: **7,000-9,000 calls**
- กรณีที่ดีที่สุด (มี cache, Socket.io พร้อม): **~2,000 calls**

### WebSocket Connections:
- **Socket.io Connections**: 1,000 connections
- **Socket.io Subscriptions** (per user):
  - `subscribe:game`: 1,000 subscriptions
  - `subscribe:user`: 1,000 subscriptions (เมื่อกรอก username)
  - `subscribe:checkin`: 1,000 subscriptions (เฉพาะเกมเช็คอิน)
  - `subscribe:answers`: 1,000 subscriptions (เฉพาะเกมบางประเภท)
  - `subscribe:bingo`: 1,000 subscriptions (เฉพาะเกม BINGO)
  - `subscribe:chat`: 1,000 subscriptions (ถ้ามี chat)

## การปรับปรุงที่แนะนำ

### 1. Caching
- ✅ มี caching อยู่แล้วใน `src/services/cache.ts`
- ✅ Game data cache: 2 นาที
- ✅ User data cache: 10 นาที
- ⚠️ แต่ถ้า 1000 users เข้าพร้อมกันครั้งแรก จะไม่มี cache

### 2. Socket.io Optimization
- ✅ ใช้ Socket.io แทน polling แล้ว
- ⚠️ แต่ถ้า Socket.io ยังไม่พร้อม จะ fallback ไปเรียก API
- 💡 แนะนำ: เพิ่ม connection pooling หรือ rate limiting

### 3. API Rate Limiting
- ⚠️ ควรมี rate limiting ที่ backend
- 💡 แนะนำ: จำกัดจำนวน requests ต่อ user ต่อวินาที

### 4. Database Connection Pooling
- ⚠️ ตรวจสอบว่า backend มี connection pooling หรือไม่
- 💡 แนะนำ: ใช้ connection pool สำหรับ PostgreSQL

### 5. CDN/Caching Layer
- 💡 แนะนำ: ใช้ CDN สำหรับ static assets
- 💡 แนะนำ: ใช้ Redis cache สำหรับ game data ที่ไม่เปลี่ยนบ่อย

## สรุป

### กรณีที่แย่ที่สุด (1000 users เข้าพร้อมกันครั้งแรก, ไม่มี cache, Socket.io ช้า):
- **HTTP REST API**: **7,000-9,000 calls**
  - Supabase Auth: 1,000
  - Game Data (fallback): 1,000
  - User Data: 1,000-3,000
  - Answers: 1,000-3,000
  - Checkin: 1,000 (เฉพาะเกมเช็คอิน)
  - Bingo: 1,000 (เฉพาะเกม BINGO)
- **WebSocket Connections**: **1,000 connections**
- **Socket.io Subscriptions**: **5,000-6,000 subscriptions**
  - subscribe:game: 1,000
  - subscribe:user: 1,000
  - subscribe:checkin: 1,000 (เฉพาะเกมเช็คอิน)
  - subscribe:answers: 1,000 (เฉพาะเกมบางประเภท)
  - subscribe:bingo: 1,000 (เฉพาะเกม BINGO)
  - subscribe:chat: 1,000 (ถ้ามี chat)

### กรณีที่ดีที่สุด (มี cache, Socket.io พร้อมทันที):
- **HTTP REST API**: **~2,000 calls**
  - Supabase Auth: 1,000
  - Game Data (fallback): 0-1,000 (ถ้า Socket.io พร้อมทันที)
  - User Data: 0-1,000 (ถ้ามี cache)
- **WebSocket Connections**: **1,000 connections**
- **Socket.io Subscriptions**: **5,000-6,000 subscriptions**

**หมายเหตุ**: จำนวน API calls จริงจะขึ้นอยู่กับ:
- ประเภทของเกมที่เล่น
- ว่ามี cache หรือไม่
- Socket.io connection speed
- ว่าผู้ใช้กรอก username หรือไม่

