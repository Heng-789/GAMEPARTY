# สรุประบบการทำงานของโปรเจกต์ HENG36GAME

## ภาพรวมระบบ

โปรเจกต์นี้เป็นระบบจัดการเกม (Game Management System) ที่รองรับหลายธีม (Multi-theme) โดยมี:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + PostgreSQL (Supabase)
- **Real-time**: Socket.io
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (สำหรับรูปภาพ)

---

## สถาปัตยกรรมระบบ

### 1. Multi-Theme Support
ระบบรองรับ 3 ธีม:
- **heng36** (default)
- **max56**
- **jeed24**

แต่ละธีมมี:
- Database schema แยกกัน (หรือใช้ connection string แยก)
- Theme-specific assets (logo, background, favicon)
- Theme-specific branding (สี, ชื่อ, subtitle)

### 2. Database Structure

#### PostgreSQL Tables (แต่ละ theme มี schema แยก):
- **games**: เก็บข้อมูลเกมทั้งหมด
  - `game_id` (PK)
  - `name`, `type`
  - `unlocked`, `locked`
  - `user_access_type` (all/selected)
  - `selected_users` (JSON array)
  - `game_data` (JSONB - เก็บข้อมูลเกมทั้งหมด)
  - `created_at`, `updated_at`

- **users**: เก็บข้อมูลผู้ใช้
  - `user_id` (PK)
  - `password`
  - `hcoin` (เหรียญ)
  - `status`
  - `created_at`, `updated_at`

- **answers**: เก็บคำตอบจากผู้เล่น
  - `answer_id` (PK)
  - `game_id`, `user_id`
  - `answer` (JSONB)
  - `correct`, `code`
  - `created_at`

- **checkins**: เก็บข้อมูลการเช็คอิน
  - `checkin_id` (PK)
  - `game_id`, `user_id`
  - `day_index`
  - `checked`, `checkin_date`, `unique_key`
  - `created_at`, `updated_at`

- **bingo_cards**, **bingo_players**, **bingo_game_state**: สำหรับเกม BINGO
- **presence**: เก็บสถานะผู้เล่นออนไลน์
- **chat**: เก็บข้อความแชท

---

## Backend Architecture

### 1. Server Setup (`backend/src/index.js`)
- **Express Server** + **HTTP Server**
- **Socket.io** สำหรับ real-time communication
- **CORS** configuration (รองรับหลาย domain)
- **Middleware**:
  - Compression (gzip/brotli)
  - Cache headers
  - Rate limiting
  - Bandwidth monitoring
  - Theme detection

### 2. API Routes (`backend/src/routes/`)

#### `/api/games` - จัดการเกม
- `GET /` - ดึงรายการเกมทั้งหมด (รองรับ pagination)
- `GET /:gameId` - ดึงข้อมูลเกมตาม ID
- `POST /` - สร้างเกมใหม่
- `PUT /:gameId` - อัพเดตเกม
- `DELETE /:gameId` - ลบเกม (พร้อมลบรูปภาพใน Storage)
- `POST /:gameId/claim-code` - แลกโค้ดรางวัล (atomic transaction)
- `POST /:gameId/claim-code/big-prize` - แลกรางวัลใหญ่ (LoyKrathong)
- `POST /:gameId/claim-code/daily-reward/:dayIndex` - แลกรางวัลรายวัน (Checkin)
- `POST /:gameId/claim-code/complete-reward` - แลกรางวัลครบเซ็ต (Checkin)
- `POST /:gameId/claim-code/coupon/:itemIndex` - แลกคูปอง (Checkin)

#### `/api/users` - จัดการผู้ใช้
- `GET /` - ดึงรายการผู้ใช้ทั้งหมด (รองรับ pagination, search)
- `GET /top` - ดึงผู้ใช้ที่มี hcoin สูงสุด
- `GET /search/:searchTerm` - ค้นหาผู้ใช้
- `GET /:userId` - ดึงข้อมูลผู้ใช้ (รวม password สำหรับ authentication)
- `PUT /:userId` - อัพเดตผู้ใช้
- `POST /:userId/coins` - เพิ่ม/ลดเหรียญ (atomic transaction)
- `DELETE /:userId` - ลบผู้ใช้
- `POST /bulk` - สร้าง/อัพเดตผู้ใช้หลายคนพร้อมกัน (UPSERT)

#### `/api/checkins` - จัดการเช็คอิน
- `GET /?gameId=...&userId=...&maxDays=30` - ดึงข้อมูลเช็คอิน
- `POST /` - เช็คอิน (atomic transaction, ป้องกันซ้ำ)

#### `/api/answers` - จัดการคำตอบ
- `GET /?gameId=...&limit=100` - ดึงคำตอบทั้งหมด
- `POST /` - ส่งคำตอบ

#### `/api/bingo` - จัดการเกม BINGO
- `GET /game/:gameId/cards` - ดึงบัตร BINGO
- `POST /game/:gameId/cards` - สร้างบัตร BINGO
- `POST /game/:gameId/players` - เพิ่มผู้เล่น
- `GET /game/:gameId/state` - ดึงสถานะเกม

#### `/api/coins` - จัดการเหรียญ
- `POST /add` - เพิ่มเหรียญ
- `POST /deduct` - ลดเหรียญ

#### `/api/chat` - จัดการแชท
- `GET /?gameId=...` - ดึงข้อความ
- `POST /` - ส่งข้อความ

#### `/api/utils` - Utilities
- `GET /health` - Health check

### 3. Socket.io Real-time Communication (`backend/src/socket/index.js`)

#### Subscriptions:
- `subscribe:game` - สมัครรับข้อมูลเกม
- `subscribe:user` - สมัครรับข้อมูลผู้ใช้
- `subscribe:checkin` - สมัครรับข้อมูลเช็คอิน
- `subscribe:answers` - สมัครรับคำตอบ
- `subscribe:bingo` - สมัครรับข้อมูล BINGO
- `subscribe:chat` - สมัครรับข้อความแชท

#### Events (Emit to clients):
- `game:updated` - อัพเดตข้อมูลเกม (รองรับ diff format)
- `user:updated` - อัพเดตข้อมูลผู้ใช้
- `checkin:updated` - อัพเดตข้อมูลเช็คอิน (รองรับ diff format)
- `answer:updated` - อัพเดตคำตอบ
- `bingo:*` - อัพเดตข้อมูล BINGO
- `chat:message` - ข้อความแชทใหม่

#### Optimization Features:
- **Diff calculation**: ส่งเฉพาะข้อมูลที่เปลี่ยน (ลด bandwidth)
- **State cache**: เก็บสถานะก่อนหน้าเพื่อคำนวณ diff
- **Room-based broadcasting**: ใช้ Socket.io rooms เพื่อประสิทธิภาพ

### 4. Database Connection (`backend/src/config/database.js`)
- **Connection Pooling**: แต่ละ theme มี pool แยก
- **Health Check**: ตรวจสอบการเชื่อมต่อ database
- **SSL Support**: รองรับ Supabase (cloud database)
- **Connection Limits**: Max 50 connections per pool

### 5. Middleware

#### Cache Middleware (`backend/src/middleware/cache.js`)
- Cache game data (2 นาที)
- Cache user data (10 นาที)
- Invalidate cache เมื่อมีการอัพเดต

#### Rate Limiting (`backend/src/middleware/rateLimit.js`)
- จำกัดจำนวน requests ต่อ IP
- ป้องกัน DDoS

#### Compression (`backend/src/middleware/compression.js`)
- Gzip/Brotli compression
- ลด bandwidth 60-80%

#### Bandwidth Monitoring (`backend/src/middleware/bandwidthMonitor.js`)
- Log payload sizes
- วิเคราะห์การใช้งาน bandwidth

---

## Frontend Architecture

### 1. Routing (`src/App.tsx`)

#### Public Routes (ไม่ต้องล็อกอิน):
- `/` - Player gate (redirect ไป `/play/:id` ถ้ามี `?id=...`)
- `/play/:id` - หน้าเล่นเกม (ผู้เล่น)
- `/admin/answers/:gameId` - หน้าแอดมินดูคำตอบ (ไม่ต้องล็อกอิน)

#### Auth Routes (ต้องล็อกอิน):
- `/login` - หน้าเข้าสู่ระบบ
- `/home` - หน้าหลักแอดมิน (รายการเกม)
- `/games` - รายการเกม
- `/games/:id` - แก้ไขเกม
- `/creategame` - สร้างเกมใหม่
- `/upload-users-extra` - จัดการผู้ใช้
- `/image-settings` - ตั้งค่ารูปภาพ

### 2. Authentication (`src/services/supabase-auth.ts`)
- ใช้ **Supabase Auth**
- `getSession()` - ตรวจสอบ session
- `signInWithPassword()` - ล็อกอิน
- `signOut()` - ล็อกเอาท์
- `onAuthStateChange()` - ฟังการเปลี่ยนแปลง auth state

### 3. Data Fetching

#### PostgreSQL Adapter (`src/services/postgresql-adapter.ts`)
- `getGamesList()` - ดึงรายการเกม
- `getGameData(gameId)` - ดึงข้อมูลเกม
- `createGame()`, `updateGame()`, `deleteGame()` - จัดการเกม
- `getUserData()`, `updateUserData()`, `deleteUser()` - จัดการผู้ใช้
- `bulkUpdateUsers()` - อัพเดตผู้ใช้หลายคน
- `getAllUsers()`, `getTopUsers()`, `searchUsers()` - ค้นหาผู้ใช้

#### Socket.io Client (`src/services/socket-io-client.ts`)
- เชื่อมต่อ Socket.io server
- Subscribe/Unsubscribe events
- รับ real-time updates

#### Hooks (`src/hooks/`)
- `useSocketIO.ts` - Hook สำหรับ Socket.io
  - `useSocketIOGameData()` - ดึงข้อมูลเกมแบบ real-time
  - `useSocketIOCheckinData()` - ดึงข้อมูลเช็คอินแบบ real-time
- `useOptimizedData.ts` - Hook สำหรับดึงข้อมูลแบบ optimize
- `useWebSocketData.ts` - Hook สำหรับ WebSocket (legacy)

### 4. Pages

#### Admin Pages:

**Home (`src/pages/Home.tsx`)**
- แสดงรายการเกมทั้งหมด
- สร้างเกมใหม่
- จัดการผู้ใช้
- ตั้งค่ารูปภาพ
- ลบเกม
- คัดลอกลิงก์สำหรับลูกค้า/แอดมิน

**GamesList (`src/pages/games/GamesList.tsx`)**
- แสดงรายการเกม (polling ทุก 5 วินาที)
- ลบเกม (ต้องยืนยันรหัสผ่านถ้าเกมถูกล็อก)

**GameEdit (`src/pages/games/GameEdit.tsx`)**
- ใช้หน้า CreateGame ภายใน
- แก้ไขเกมที่มีอยู่

**GameCreate (`src/pages/games/GameCreate.tsx`)**
- สร้างเกมใหม่
- รองรับหลายประเภทเกม:
  - เกมทายภาพปริศนา
  - เกมทายเบอร์เงิน
  - เกมทายผลบอล
  - เกมสล็อต
  - เกมเช็คอิน
  - เกม Trick or Treat
  - เกมลอยกระทง
  - เกม BINGO

**UploadUsersExtra (`src/pages/UploadUsersExtra.tsx`)**
- อัพโหลดผู้ใช้จาก CSV
- เพิ่มผู้ใช้ด้วยตนเอง (Manual)
- ค้นหาผู้ใช้
- แก้ไขข้อมูลผู้ใช้ (password, hcoin)
- ลบผู้ใช้
- Export เป็น CSV
- แสดงประวัติการอัพโหลด
- Real-time update hcoin (polling ทุก 2 วินาที)

**ImageSettings (`src/pages/ImageSettings.tsx`)**
- อัพโหลดพื้นหลัง
- อัพโหลด Logo
- อัพโหลด Favicon
- ใช้ Supabase Storage

**AdminAnswers (`src/pages/AdminAnswers.tsx`)**
- ดูคำตอบทั้งหมด (ไม่ต้องล็อกอิน)
- กรองตาม userId
- Real-time updates

#### Player Pages:

**GamePlay (`src/pages/games/GamePlay.tsx`)**
- หน้าเล่นเกมสำหรับผู้เล่น
- รองรับทุกประเภทเกม
- Authentication ด้วย username/password
- Real-time updates ผ่าน Socket.io
- Fallback ไป REST API ถ้า Socket.io ไม่พร้อม

### 5. Services

#### Image Upload (`src/services/image-upload.ts`)
- อัพโหลดรูปภาพไป Supabase Storage
- รองรับหลาย folder (backgrounds, logos, favicons)
- Return CDN URL

#### Cache (`src/services/cache.ts`)
- Client-side caching
- Cache game data (2 นาที)
- Cache user data (10 นาที)
- Invalidate cache

#### Prefetching (`src/services/prefetching.ts`)
- Prefetch ข้อมูลเกมเมื่อ hover
- เพิ่มประสิทธิภาพ UX

---

## การสื่อสารระหว่าง Backend และ Frontend

### 1. REST API
- **Base URL**: `http://localhost:3000` (development)
- **Headers**:
  - `Content-Type: application/json`
  - `X-Theme: heng36|max56|jeed24` (optional, detect จาก domain)

### 2. Socket.io
- **Connection**: `http://localhost:3000` (same as API)
- **Events**:
  - Client → Server: `subscribe:game`, `subscribe:user`, etc.
  - Server → Client: `game:updated`, `user:updated`, etc.

### 3. Data Flow

#### Game Data:
1. Frontend: `useSocketIOGameData(gameId)` → Subscribe Socket.io
2. Socket.io: ส่งข้อมูลเกมทันที (initial data)
3. Backend: เมื่อมีการอัพเดต → `broadcastGameUpdate()` → ส่ง diff
4. Frontend: รับ diff → merge กับ state ปัจจุบัน

#### User Data:
1. Frontend: `useSocketIOUserData(userId)` → Subscribe Socket.io
2. Socket.io: ส่งข้อมูลผู้ใช้ทันที
3. Backend: เมื่อมีการอัพเดต → `broadcastUserUpdate()` → ส่งข้อมูลใหม่
4. Frontend: อัพเดต state

#### Fallback Mechanism:
- ถ้า Socket.io ไม่พร้อมภายใน 3 วินาที → Fallback ไป REST API
- ใช้ REST API เป็น backup

---

## ระบบการจัดการ (Management Features)

### 1. Game Management

#### สร้างเกม:
- เลือกประเภทเกม
- ตั้งชื่อเกม
- ตั้งค่าการเข้าถึง (all/selected users)
- อัพโหลดรูปภาพ (ถ้าต้องการ)
- ตั้งค่าเกม (ตามประเภท)

#### แก้ไขเกม:
- แก้ไขข้อมูลเกมทั้งหมด
- Deep merge สำหรับ nested objects (checkin, bingo, loyKrathong)
- Real-time updates ผ่าน Socket.io

#### ลบเกม:
- ลบเกมพร้อมข้อมูลที่เกี่ยวข้อง (answers, checkins, bingo, etc.)
- ลบรูปภาพใน Storage อัตโนมัติ
- ต้องยืนยันรหัสผ่านถ้าเกมถูกล็อก

#### Lock/Unlock:
- ล็อกเกมเพื่อป้องกันการแก้ไข
- ต้องยืนยันรหัสผ่านก่อนลบเกมที่ถูกล็อก

### 2. User Management

#### อัพโหลดผู้ใช้:
- **CSV Upload**: รองรับไฟล์ขนาดใหญ่ (600,000+ รายการ)
  - กำหนดคอลัมน์ USER/PASSWORD
  - กำหนดแถวเริ่มต้น
  - ตรวจสอบซ้ำ (ในไฟล์ + ในฐานข้อมูล)
  - Batch upload (100 รายการต่อ batch)
  - Progress tracking
- **Manual Add**: เพิ่มผู้ใช้ทีละคน
- **Bulk Update**: อัพเดตผู้ใช้หลายคนพร้อมกัน

#### จัดการผู้ใช้:
- ค้นหาผู้ใช้ (ตาม username)
- แก้ไข password, hcoin
- ลบผู้ใช้
- Export เป็น CSV
- Real-time update hcoin (polling ทุก 2 วินาที)

#### ประวัติการอัพโหลด:
- เก็บประวัติการอัพโหลดทั้งหมด
- แสดงรายการ USER ในแต่ละครั้ง
- ลบประวัติพร้อม USER ที่เกี่ยวข้อง

### 3. Image Management

#### อัพโหลดรูปภาพ:
- **Background**: พื้นหลังของระบบ
- **Logo**: Logo หลัก
- **Favicon**: Favicon
- ใช้ Supabase Storage
- Preview ก่อนอัพโหลด
- เก็บ URL ใน localStorage (per theme)

### 4. Answer Management

#### ดูคำตอบ:
- ดูคำตอบทั้งหมด (ไม่ต้องล็อกอิน)
- กรองตาม userId
- Real-time updates
- แสดงข้อมูล: userId, answer, correct, code, timestamp

---

## Security Features

### 1. Authentication
- **Supabase Auth** สำหรับแอดมิน
- **Username/Password** สำหรับผู้เล่น (เก็บใน database)

### 2. Authorization
- **RequireAuth** component: ป้องกันหน้าแอดมิน
- **Player Gate**: ตรวจสอบ `?id=...` สำหรับผู้เล่น
- **Game Lock**: ป้องกันการแก้ไข/ลบเกมที่ถูกล็อก

### 3. Data Protection
- **Password**: ไม่ส่งใน API responses (ยกเว้น `/api/users/:userId` สำหรับ authentication)
- **SQL Injection**: ใช้ parameterized queries
- **Rate Limiting**: ป้องกัน DDoS
- **CORS**: จำกัด origins

### 4. Transaction Safety
- **Atomic Transactions**: ใช้ database transactions สำหรับ operations ที่สำคัญ
  - Claim code (ป้องกันโค้ดซ้ำ)
  - Add/deduct coins (ป้องกัน balance ผิดพลาด)
  - Checkin (ป้องกันเช็คอินซ้ำ)

---

## Performance Optimizations

### 1. Backend
- **Connection Pooling**: 50 connections per pool
- **Compression**: Gzip/Brotli (ลด bandwidth 60-80%)
- **Cache Headers**: HTTP caching
- **Diff Calculation**: ส่งเฉพาะข้อมูลที่เปลี่ยน
- **Pagination**: รองรับ pagination สำหรับรายการใหญ่

### 2. Frontend
- **Client-side Caching**: Cache game/user data
- **Prefetching**: Prefetch ข้อมูลเมื่อ hover
- **Request Deduplication**: ป้องกัน duplicate requests
- **Optimized Hooks**: ใช้ hooks ที่ optimize แล้ว

### 3. Database
- **Indexes**: มี indexes สำหรับ queries ที่ใช้บ่อย
- **Connection Pooling**: Reuse connections
- **Query Timeout**: 30 seconds timeout

---

## Deployment

### 1. Environment Variables

#### Backend:
- `DATABASE_URL_HENG36` - Connection string สำหรับ heng36
- `DATABASE_URL_MAX56` - Connection string สำหรับ max56
- `DATABASE_URL_JEED24` - Connection string สำหรับ jeed24
- `FRONTEND_URL` - Allowed CORS origins (comma-separated)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

#### Frontend:
- `VITE_API_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase URL
- `VITE_SUPABASE_ANON_KEY` - Supabase Anon Key

### 2. Build
- **Frontend**: `npm run build` → `dist/` folder
- **Backend**: `npm start` → Run server

### 3. Hosting
- **Frontend**: Netlify (static hosting)
- **Backend**: Node.js server (VPS/Cloud)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage

---

## สรุป

ระบบนี้เป็น **Game Management System** ที่:
- รองรับหลายธีม (Multi-theme)
- มี Real-time updates ผ่าน Socket.io
- มีระบบจัดการเกม/ผู้ใช้/รูปภาพที่ครบถ้วน
- มี Security features ที่ดี
- มี Performance optimizations หลายจุด
- รองรับผู้ใช้จำนวนมาก (1000+ concurrent users)

---

## ไฟล์สำคัญ

### Backend:
- `backend/src/index.js` - Server entry point
- `backend/src/routes/*.js` - API routes
- `backend/src/socket/index.js` - Socket.io setup
- `backend/src/config/database.js` - Database configuration

### Frontend:
- `src/App.tsx` - Routing
- `src/pages/Home.tsx` - Admin home
- `src/pages/games/GamePlay.tsx` - Player game page
- `src/services/postgresql-adapter.ts` - API client
- `src/services/socket-io-client.ts` - Socket.io client

---

*เอกสารนี้สรุปการทำงานของระบบทั้งหมด ณ วันที่สร้างเอกสาร*

