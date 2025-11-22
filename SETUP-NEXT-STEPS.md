# 🚀 Setup Next Steps - ขั้นตอนต่อไป

## ✅ สิ่งที่ทำเสร็จแล้ว

1. ✅ อัพเดท database config รองรับ multiple pools
2. ✅ อัพเดท routes ทั้งหมดให้ใช้ `getPool(theme)`
3. ✅ อัพเดท WebSocket handlers
4. ✅ อัพเดท test script รองรับ multiple pools

---

## 📝 Step 1: สร้างไฟล์ `.env`

**⚠️ ไฟล์ `.env` ถูก block โดยระบบ** คุณต้องสร้างเอง:

1. ไปที่ `backend` directory
2. สร้างไฟล์ `.env`:
   ```env
   # HENG36 Theme
   DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
   
   # MAX56 Theme
   DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
   
   # JEED24 Theme
   DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:nURuKYlp6XPCeO6q@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
   
   # Server
   PORT=3000
   NODE_ENV=development
   ```

---

## 🧪 Step 2: Test Connection

```bash
cd backend
npm install
npm run test:connection
```

**ควรเห็น**:
```
🧪 Testing PostgreSQL Cloud Connection...

📊 Testing HENG36 connection...
✅ HENG36 connected successfully!
✅ Database: postgres
✅ Found X schemas
✅ HENG36: X tables found

📊 Testing MAX56 connection...
✅ MAX56 connected successfully!
✅ Database: postgres
✅ Found X schemas
✅ MAX56: X tables found

✅ All tests passed! Databases are ready to use.
```

---

## 🗄️ Step 3: Run Migrations (ถ้ายังไม่มี tables)

### สำหรับ HENG36
```bash
cd backend
node scripts/migrate-from-firebase.js heng36
```

### สำหรับ MAX56
```bash
cd backend
node scripts/migrate-from-firebase.js max56
```

### สำหรับ JEED24
```bash
cd backend
node scripts/migrate-from-firebase.js jeed24
```

**หรือ** ใช้ SQL Editor ใน Supabase:
1. ไปที่ Supabase Dashboard
2. SQL Editor → New query
3. Run `migrations/001_create_tables.sql` (สำหรับแต่ละ project)

---

## 🚀 Step 4: Start Backend

```bash
cd backend
npm run dev
```

**ควรเห็น**:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
✅ Connected to JEED24 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

---

## 🧪 Step 5: Test API Endpoints

### Test Health
```bash
curl http://localhost:3000/health
```

### Test HENG36 Games
```bash
curl "http://localhost:3000/api/games?theme=heng36"
```

### Test MAX56 Games
```bash
curl "http://localhost:3000/api/games?theme=max56"
```

### Test JEED24 Games
```bash
curl "http://localhost:3000/api/games?theme=jeed24"
```

---

## ✅ Checklist

- [ ] สร้างไฟล์ `backend/.env` ด้วย connection strings
- [ ] Run `npm install` ใน backend directory
- [ ] Run `npm run test:connection` เพื่อทดสอบ
- [ ] Run migrations (ถ้ายังไม่มี tables)
- [ ] Start backend: `npm run dev`
- [ ] Test API endpoints

---

## 🆘 Troubleshooting

### Connection Error
- ตรวจสอบ connection strings ใน `.env`
- ตรวจสอบว่าเพิ่ม `?sslmode=require` แล้ว
- ตรวจสอบ password

### No Tables Found
- Run migrations: `node scripts/migrate-from-firebase.js [theme]`
- หรือใช้ SQL Editor ใน Supabase

### Port Already in Use
- เปลี่ยน PORT ใน `.env`
- หรือ kill process ที่ใช้ port 3000

---

พร้อมใช้งานแล้ว! 🚀

