# ✅ Multi-Project Setup Complete

## 📋 Connection Strings ที่ได้รับ

### HENG36
```
postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
```

### MAX56
```
postgresql://postgres:RpJk7ZpjgBPdfPxF@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require
```

⚠️ **สำคัญ**: เพิ่ม `?sslmode=require` ที่ท้าย connection string แล้ว

---

## 🔧 Setup Backend `.env`

1. ไปที่ `backend` directory
2. สร้างไฟล์ `.env`:
   ```env
   # HENG36 Theme
   DATABASE_URL_HENG36=postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
   
   # MAX56 Theme
   DATABASE_URL_MAX56=postgresql://postgres:RpJk7ZpjgBPdfPxF@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

---

## ✅ สิ่งที่อัพเดทแล้ว

### 1. Database Config (`backend/src/config/database.js`)
- ✅ รองรับ multiple connection pools
- ✅ `getPool(theme)` - เลือก pool ตาม theme
- ✅ `getSchema(theme)` - ใช้ `public` schema สำหรับ multiple projects

### 2. Routes (ทั้งหมด)
- ✅ `users.js` - ใช้ `getPool(theme)`
- ✅ `games.js` - ใช้ `getPool(theme)`
- ✅ `checkins.js` - ใช้ `getPool(theme)`
- ✅ `answers.js` - ใช้ `getPool(theme)`
- ✅ `presence.js` - ใช้ `getPool(theme)`
- ✅ `bingo.js` - ใช้ `getPool(theme)`
- ✅ `coins.js` - ใช้ `getPool(theme)`

### 3. WebSocket (`backend/src/websocket/index.js`)
- ✅ ใช้ `getPool(theme)` ในทุก handlers
- ✅ รองรับ theme จาก payload

---

## 🧪 Test Connection

```bash
cd backend
node scripts/test-cloud-connection.js
```

ควรเห็น:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
✅ Database: postgres
✅ Found X schemas
```

---

## 🚀 Start Backend

```bash
cd backend
npm install
npm run dev
```

ควรเห็น:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

---

## 📊 Migration

### Migrate HENG36
```bash
cd backend
node scripts/migrate-from-firebase.js heng36
```

### Migrate MAX56
```bash
cd backend
node scripts/migrate-from-firebase.js max56
```

---

## 🔄 API Usage

### HENG36
```bash
curl "http://localhost:3000/api/games?theme=heng36"
```

### MAX56
```bash
curl "http://localhost:3000/api/games?theme=max56"
```

---

## ✅ Checklist

- [x] อัพเดท database config
- [x] อัพเดท routes ทั้งหมด
- [x] อัพเดท WebSocket handlers
- [ ] Setup `.env` file
- [ ] Test connection
- [ ] Run migrations
- [ ] Test API endpoints

---

## 🎯 สรุป

**ใช้ 2 Projects แยกกัน**:
- ✅ HENG36 → `ipflzfxezdzbmoqglknu`
- ✅ MAX56 → `aunfaslgmxxdeemvtexn`
- ✅ Backend รองรับ multiple pools แล้ว
- ✅ แต่ละ theme ใช้ `public` schema

**พร้อมใช้งานแล้ว!** 🚀

