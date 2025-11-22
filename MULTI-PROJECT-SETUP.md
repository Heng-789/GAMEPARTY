# 🎯 Multi-Project Setup Guide

## 📋 สถานการณ์: ใช้ 2 Projects แยกกัน

คุณมี **2 Supabase Projects** แยกกัน:
- **HENG36**: `ipflzfxezdzbmoqglknu`
- **MAX56**: `aunfaslgmxxdeemvtexn`

---

## ✅ Connection Strings

### HENG36
```
postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
```

### MAX56
```
postgresql://postgres:RpJk7ZpjgBPdfPxF@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require
```

⚠️ **สำคัญ**: เพิ่ม `?sslmode=require` ที่ท้าย connection string

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

## 🗄️ Database Structure

### HENG36 Project (`ipflzfxezdzbmoqglknu`)
- Schema: `public` (default)
- Tables: `users`, `games`, `checkins`, `answers`, `presence`, `bingo_*`, `coin_transactions`

### MAX56 Project (`aunfaslgmxxdeemvtexn`)
- Schema: `public` (default)
- Tables: `users`, `games`, `checkins`, `answers`, `presence`, `bingo_*`, `coin_transactions`

---

## 🚀 Backend Configuration

Backend จะ:
1. สร้าง connection pool แยกกันสำหรับแต่ละ theme
2. ใช้ `getPool(theme)` เพื่อเลือก pool ที่ถูกต้อง
3. ใช้ schema `public` สำหรับทุก theme (เพราะแยก project)

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

- [ ] Setup `.env` with `DATABASE_URL_HENG36` and `DATABASE_URL_MAX56`
- [ ] เพิ่ม `?sslmode=require` ใน connection strings
- [ ] Run migrations สำหรับ HENG36
- [ ] Run migrations สำหรับ MAX56
- [ ] Test connection
- [ ] Test API endpoints

---

## 🎯 สรุป

**ใช้ 2 Projects แยกกัน**:
- ✅ HENG36 → `ipflzfxezdzbmoqglknu`
- ✅ MAX56 → `aunfaslgmxxdeemvtexn`
- ✅ Backend รองรับ multiple pools แล้ว
- ✅ แต่ละ theme ใช้ `public` schema

**พร้อมใช้งานแล้ว!** 🚀

