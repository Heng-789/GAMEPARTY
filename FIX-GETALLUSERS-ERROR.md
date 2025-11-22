# 🔧 แก้ไข Error: PostgreSQL getAllUsers Internal server error

## ❌ ปัญหา

Error: `PostgreSQL getAllUsers error: ApiError: Internal server error`

**สาเหตุที่เป็นไปได้:**
1. ❌ Backend server ไม่ได้รันอยู่
2. ❌ Database connection error
3. ❌ Table `users` ไม่มีใน schema
4. ❌ Schema name ผิด

---

## ✅ วิธีแก้ไข

### ขั้นตอนที่ 1: ตรวจสอบว่า Backend Server รันอยู่

**ตรวจสอบว่า backend server รันอยู่:**

1. เปิด Terminal ใหม่
2. ไปที่ `backend` directory:
   ```bash
   cd backend
   ```
3. ตรวจสอบว่า server รันอยู่:
   ```bash
   # ดู process ที่รันอยู่
   # Windows PowerShell:
   Get-Process -Name node -ErrorAction SilentlyContinue
   ```
4. ถ้าไม่เห็น process → ต้องรัน backend server:
   ```bash
   npm start
   # หรือ
   node src/index.js
   ```

---

### ขั้นตอนที่ 2: ตรวจสอบ Backend Logs

**ดู backend logs เพื่อหาสาเหตุ:**

1. ดู Terminal ที่รัน backend server
2. ตรวจสอบ error logs:
   ```
   Error fetching all users: ...
   Theme: heng36 Schema: public
   Error details: { message: ..., code: ..., detail: ... }
   ```

**Error ที่เป็นไปได้:**
- `relation "public.users" does not exist` → Table ยังไม่ได้สร้าง
- `connection refused` → Database connection error
- `timeout` → Database connection timeout

---

### ขั้นตอนที่ 3: ตรวจสอบ Database Connection

**ทดสอบ database connection:**

1. ไปที่ `backend` directory
2. รัน test script:
   ```bash
   node scripts/test-connection.js
   ```
3. ตรวจสอบว่าเชื่อมต่อ database ได้

---

### ขั้นตอนที่ 4: ตรวจสอบ Table `users`

**ตรวจสอบว่า table `users` มีอยู่:**

1. เข้า Supabase Dashboard
2. ไปที่ **SQL Editor**
3. รัน SQL:
   ```sql
   -- ตรวจสอบ table users
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'users';
   ```

**ถ้าไม่มี table:**
- ต้องรัน migrations ก่อน

---

### ขั้นตอนที่ 5: รัน Migrations

**รัน migrations เพื่อสร้าง table:**

1. ไปที่ `backend` directory
2. รัน migration:
   ```bash
   node scripts/migrate.js
   ```
   หรือ
   ```bash
   node scripts/migrate-heng36.js
   ```

---

## 🔍 Debug Steps

### 1. ตรวจสอบ Backend Server

**ทดสอบว่า backend server รันอยู่:**

```bash
# ใน Browser หรือ Terminal
curl http://localhost:3000/health
```

**ควรได้:**
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

**ถ้าไม่ได้:**
- Backend server ไม่ได้รัน → ต้องรัน backend server ก่อน

---

### 2. ตรวจสอบ API Endpoint

**ทดสอบ API endpoint โดยตรง:**

```bash
# ใน Browser หรือ Terminal
curl "http://localhost:3000/api/users?page=1&limit=10&theme=heng36"
```

**ควรได้:**
```json
{
  "users": [...],
  "total": ...,
  "page": 1,
  "limit": 10
}
```

**ถ้าได้ error:**
- ดู error message ใน response
- ตรวจสอบ backend logs

---

### 3. ตรวจสอบ Frontend API Call

**ตรวจสอบว่า frontend เรียก API ถูกต้อง:**

1. เปิด Browser DevTools → **Network** tab
2. ดู request ไปที่ `/api/users`
3. ตรวจสอบ:
   - URL: `http://localhost:3000/api/users?page=1&limit=100&theme=heng36`
   - Headers: `X-Theme: heng36`
   - Response: ดู error message

---

## ✅ Checklist

- [ ] Backend server รันอยู่ (`http://localhost:3000/health`)
- [ ] Database connection ทำงาน
- [ ] Table `users` มีอยู่ใน schema
- [ ] Migrations รันเสร็จแล้ว
- [ ] ตรวจสอบ backend logs สำหรับ error details

---

## 🎯 สรุป

**สาเหตุหลัก:** Backend server ไม่ได้รัน หรือ database connection error

**วิธีแก้:**
1. รัน backend server
2. ตรวจสอบ database connection
3. ตรวจสอบ table `users` มีอยู่
4. ดู backend logs สำหรับ error details

---

**ลองรัน backend server แล้วทดสอบใหม่ครับ!**

