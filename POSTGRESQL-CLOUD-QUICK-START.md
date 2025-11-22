# ⚡ PostgreSQL Cloud Quick Start

คู่มือเริ่มต้นใช้งาน PostgreSQL บน Cloud อย่างรวดเร็ว

---

## 🎯 เลือก Cloud Provider

### สำหรับเริ่มต้น (แนะนำ)
**Supabase** หรือ **Neon** - Free tier ดี, Setup ง่าย

---

## 🚀 Supabase Setup (5 นาที)

### Step 1: สร้าง Project
1. ไปที่ https://supabase.com
2. Sign up / Login
3. New Project
4. ตั้งชื่อ project: `heng36game`
5. เลือก region: **Southeast Asia (Singapore)**
6. ตั้ง database password (จำไว้!)
7. รอให้สร้างเสร็จ (~2 นาที)

### Step 2: รับ Connection Info
1. ไปที่ **Settings** → **Database**
2. คัดลอกข้อมูล:

```env
# Connection string (แนะนำ)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require

# หรือแยกเป็น parameters
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=[YOUR-PASSWORD]
DB_SSL=true
```

### Step 3: Setup Backend
```bash
cd backend
cp .env.example .env
```

แก้ไข `.env`:
```env
# ใช้ connection string (ง่ายที่สุด)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require

# หรือใช้ parameters
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=[YOUR-PASSWORD]
DB_SSL=true
```

### Step 4: Test Connection
```bash
npm run test:connection
```

ควรเห็น:
```
✅ Connected successfully!
✅ Database: postgres
✅ All tests passed!
```

### Step 5: Run Migrations
```bash
# ใช้ Supabase SQL Editor
# ไปที่ SQL Editor → New Query
# Copy เนื้อหาจาก migrations/001_create_tables.sql
# Run query

# หรือใช้ psql
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require" -f ../migrations/001_create_tables.sql
```

### Step 6: Start Backend
```bash
npm run dev
```

---

## 🚀 Neon Setup (5 นาที)

### Step 1: สร้าง Project
1. ไปที่ https://neon.tech
2. Sign up / Login
3. New Project
4. ตั้งชื่อ: `heng36game`
5. เลือก region: **Singapore**
6. รอให้สร้างเสร็จ (~30 วินาที)

### Step 2: รับ Connection Info
1. ไปที่ **Connection Details**
2. คัดลอก **Connection string**:

```env
DATABASE_URL=postgresql://neondb_owner:[PASSWORD]@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 3: Setup Backend
```bash
cd backend
cp .env.example .env
```

แก้ไข `.env`:
```env
DATABASE_URL=postgresql://neondb_owner:[PASSWORD]@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 4: Test & Migrate
```bash
# Test connection
npm run test:connection

# Run migrations (ใช้ Neon SQL Editor หรือ psql)
```

---

## 🔧 Backend Configuration

### Update `backend/.env`

**Option 1: ใช้ Connection String (แนะนำ)**
```env
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
```

**Option 2: ใช้ Parameters**
```env
DB_HOST=your-host.com
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
DB_SSL=true
```

### Test Connection
```bash
cd backend
npm run test:connection
```

---

## 📊 Connection Info ที่ต้องมี

### ข้อมูลพื้นฐาน
- ✅ **Host** - ที่อยู่ของ database server
- ✅ **Port** - Port (ปกติ 5432)
- ✅ **Database** - ชื่อ database
- ✅ **Username** - ชื่อผู้ใช้
- ✅ **Password** - รหัสผ่าน

### ข้อมูลเพิ่มเติม (สำหรับ cloud)
- ✅ **SSL** - ต้องใช้ SSL (true)
- ✅ **SSL Mode** - require หรือ verify-full

---

## 🔐 Security Checklist

- [ ] ใช้ strong password (16+ characters)
- [ ] เปิด SSL/TLS
- [ ] ตั้งค่า firewall (whitelist IP)
- [ ] ใช้ environment variables (ไม่ hardcode)
- [ ] ตั้งค่า automatic backups
- [ ] ตรวจสอบ connection limits

---

## 🧪 Testing

### Test Connection
```bash
cd backend
npm run test:connection
```

### Test from psql
```bash
psql "postgresql://user:pass@host:port/db?sslmode=require"
```

### Test from Backend
```bash
cd backend
npm run dev
# ดู logs ว่าเชื่อมต่อได้หรือไม่
```

---

## ⚠️ Common Issues

### Connection Timeout
- ตรวจสอบ firewall rules
- ตรวจสอบ security groups
- ตรวจสอบ IP whitelist

### SSL Error
```javascript
// ใน database.js
ssl: {
  rejectUnauthorized: false
}
```

### Authentication Failed
- ตรวจสอบ username/password
- ตรวจสอบ database name
- ตรวจสอบ user permissions

---

## 📝 Next Steps

1. ✅ Setup cloud database
2. ✅ Test connection
3. ✅ Run migrations
4. ✅ Start backend
5. ✅ Migrate data from Firebase
6. ✅ Update frontend to use PostgreSQL

---

## 🆘 Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Neon Docs**: https://neon.tech/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

พร้อมใช้งาน PostgreSQL บน Cloud แล้ว! 🚀

