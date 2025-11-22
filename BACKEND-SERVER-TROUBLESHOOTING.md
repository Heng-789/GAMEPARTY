# 🔧 Backend Server Troubleshooting Guide

## ⚠️ ปัญหาที่พบ

### 1. Failed to fetch (PostgreSQL API)
```
TypeError: Failed to fetch
at apiRequest (postgresql-api.ts:50:26)
```

**สาเหตุ:**
- Backend server ไม่ได้รันอยู่
- Port 3000 ไม่เปิด
- CORS error
- Network issue

## 🚀 วิธีแก้ไข

### Step 1: ตรวจสอบว่า Backend Server รันอยู่

```bash
# ตรวจสอบ port 3000
netstat -ano | findstr :3000

# หรือใช้ PowerShell
Test-NetConnection -ComputerName localhost -Port 3000
```

### Step 2: เริ่ม Backend Server

```bash
cd backend
npm run dev
```

หรือ

```bash
cd backend
node src/index.js
```

ควรเห็น:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
✅ Connected to JEED24 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

### Step 3: ตรวจสอบ Environment Variables

ไฟล์ `backend/.env`:
```env
DATABASE_URL_HENG36=postgresql://...
DATABASE_URL_MAX56=postgresql://...
DATABASE_URL_JEED24=postgresql://...
PORT=3000
```

### Step 4: ทดสอบ API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# Test API
curl http://localhost:3000/api/games?theme=max56
```

## 🔧 การตั้งค่า Frontend

### ตรวจสอบ VITE_API_URL

ไฟล์ `env.heng36`:
```env
VITE_API_URL=http://localhost:3000
```

### ตรวจสอบ PostgreSQL API Service

ไฟล์ `src/services/postgresql-api.ts`:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

## ⚠️ Troubleshooting

### 1. Failed to fetch
- ✅ ตรวจสอบว่า backend server รันอยู่ที่ port 3000
- ✅ ตรวจสอบว่า `VITE_API_URL` ถูกต้อง
- ✅ ตรวจสอบ CORS settings ใน backend

### 2. Connection refused
- ✅ ตรวจสอบว่า backend server รันอยู่
- ✅ ตรวจสอบว่า port 3000 ไม่ถูกใช้โดยโปรแกรมอื่น
- ✅ ตรวจสอบ firewall settings

### 3. CORS Error
- ✅ ตรวจสอบว่า backend มี `cors()` middleware
- ✅ ตรวจสอบว่า frontend URL ถูกต้อง

### 4. Database Connection Error
- ✅ ตรวจสอบว่า `.env` ใน backend มี connection strings
- ✅ ตรวจสอบว่า database เชื่อมต่อได้ (ใช้ `test-connection.js`)

## 📝 Quick Start Commands

```bash
# 1. เริ่ม backend server
cd backend
npm run dev

# 2. ทดสอบ connection
node scripts/test-connection.js

# 3. ทดสอบ API
node scripts/test-api-endpoints.js
```

## 🔍 Debug Steps

1. **ตรวจสอบ Backend Server**
   ```bash
   cd backend
   node src/index.js
   ```

2. **ตรวจสอบ Database Connection**
   ```bash
   cd backend
   node scripts/test-connection.js
   ```

3. **ตรวจสอบ API Endpoints**
   ```bash
   curl http://localhost:3000/health
   ```

4. **ตรวจสอบ Frontend Configuration**
   - เปิด browser console
   - ตรวจสอบ `VITE_API_URL` value
   - ตรวจสอบ network requests

