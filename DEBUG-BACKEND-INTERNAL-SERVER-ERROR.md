# 🔍 Debug Backend Internal Server Error

## ❌ ปัญหา

พบ error "Internal server error" จากหลาย API endpoints:
- `getGameData` - Internal server error
- `getAllUsers` - Internal server error
- `getAnswers` - Internal server error

---

## ✅ การแก้ไข

### 1. เพิ่ม Detailed Error Logging

**ไฟล์ที่แก้ไข:**
- `backend/src/routes/games.js` - เพิ่ม error logging ใน `GET /games/:gameId`
- `backend/src/routes/answers.js` - เพิ่ม error logging ใน `GET /answers/:gameId`
- `backend/src/routes/users.js` - มี error logging อยู่แล้ว

**การเปลี่ยนแปลง:**
- เพิ่ม console.log สำหรับ request details (theme, schema, gameId)
- เพิ่ม detailed error logging (message, code, detail, hint, stack)
- Return error message และ code ใน response (สำหรับ development)

---

## 🔍 วิธี Debug

### 1. ตรวจสอบ Backend Server รันอยู่หรือไม่

```powershell
# ตรวจสอบว่า port 3000 ถูกใช้งานอยู่หรือไม่
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# ถ้าไม่มี → รัน backend server
cd backend
node src/index.js
```

**ควรเห็น:**
```
✅ Connected to HENG36 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

---

### 2. ตรวจสอบ Backend Logs

**หลังจากรัน backend server แล้ว:**
1. เปิด Terminal ที่รัน backend server
2. ลองเรียก API จาก frontend
3. ตรวจสอบ logs ใน backend terminal

**ตัวอย่าง logs ที่ควรเห็น:**
```
[GET /games/123] Theme: heng36, Schema: heng36
[GET /answers/123] Theme: heng36, Schema: heng36, Limit: 50
[GET /users] Theme: heng36, Schema: heng36
```

**ถ้าเกิด error:**
```
[GET /games/:gameId] Error fetching game: Error: ...
Error details: {
  theme: 'heng36',
  schema: 'heng36',
  gameId: '123',
  message: '...',
  code: '...',
  detail: '...',
  hint: '...',
  stack: '...'
}
```

---

### 3. ตรวจสอบ Database Connection

**ทดสอบ database connection:**
```powershell
cd backend
node scripts/test-connection.js
```

**ควรเห็น:**
```
✅ Connected to HENG36 PostgreSQL database
✅ Schema 'heng36' exists
✅ Table 'games' exists
✅ Table 'users' exists
✅ Table 'answers' exists
```

---

### 4. ตรวจสอบ Schema และ Tables

**ถ้า backend logs แสดง error เกี่ยวกับ schema หรือ table:**

**ตัวอย่าง error:**
```
relation "heng36.games" does not exist
```

**วิธีแก้:**
```powershell
# Run migrations
cd backend
node scripts/migrate-heng36.js
```

---

## 📋 Common Errors และวิธีแก้ไข

### Error 1: "relation 'schema.table' does not exist"

**สาเหตุ:** Table ยังไม่ได้สร้าง หรือ schema ไม่ถูกต้อง

**วิธีแก้:**
```powershell
# Run migrations
cd backend
node scripts/migrate-heng36.js
```

---

### Error 2: "connection refused" หรือ "ECONNREFUSED"

**สาเหตุ:** Database connection string ไม่ถูกต้อง หรือ database ไม่สามารถเข้าถึงได้

**วิธีแก้:**
1. ตรวจสอบ `backend/.env`:
   ```env
   DATABASE_URL_HENG36=postgresql://...
   ```

2. ทดสอบ connection:
   ```powershell
   cd backend
   node scripts/test-connection.js
   ```

---

### Error 3: "permission denied" หรือ "access denied"

**สาเหตุ:** Database user ไม่มีสิทธิ์เข้าถึง schema หรือ table

**วิธีแก้:**
1. ตรวจสอบ database user permissions
2. ตรวจสอบ schema ownership
3. ตรวจสอบ RLS (Row Level Security) policies

---

### Error 4: "column does not exist"

**สาเหตุ:** Table structure ไม่ตรงกับที่ code คาดหวัง

**วิธีแก้:**
1. ตรวจสอบ migration files
2. Run migrations ใหม่
3. ตรวจสอบว่า migration ทำงานสำเร็จ

---

## 🎯 ขั้นตอนการ Debug

### Step 1: ตรวจสอบ Backend Server

```powershell
# ตรวจสอบว่า backend server รันอยู่
Get-NetTCPConnection -LocalPort 3000

# ถ้าไม่มี → รัน backend server
cd backend
node src/index.js
```

---

### Step 2: ตรวจสอบ Backend Logs

1. เปิด Terminal ที่รัน backend server
2. ลองเรียก API จาก frontend
3. ดู error message ใน backend logs

**ตัวอย่าง:**
```
[GET /games/123] Theme: heng36, Schema: heng36
[GET /games/:gameId] Error fetching game: Error: relation "heng36.games" does not exist
Error details: {
  theme: 'heng36',
  schema: 'heng36',
  gameId: '123',
  message: 'relation "heng36.games" does not exist',
  code: '42P01',
  ...
}
```

---

### Step 3: แก้ไขตาม Error Message

**ถ้า error เป็น "relation does not exist":**
```powershell
cd backend
node scripts/migrate-heng36.js
```

**ถ้า error เป็น "connection refused":**
```powershell
cd backend
node scripts/test-connection.js
```

---

### Step 4: ทดสอบอีกครั้ง

1. Refresh frontend
2. ตรวจสอบ backend logs อีกครั้ง
3. ตรวจสอบว่า error หายไปหรือไม่

---

## 📝 Checklist

- [ ] Backend server รันอยู่ (port 3000)
- [ ] Database connection ทำงานได้
- [ ] Schema และ tables มีอยู่
- [ ] Backend logs แสดง detailed error messages
- [ ] Error หายไปหลังจากแก้ไข

---

## 🔍 ตัวอย่าง Backend Logs

### Success Case:
```
[GET /games/123] Theme: heng36, Schema: heng36
✅ Game found: 123
```

### Error Case:
```
[GET /games/123] Theme: heng36, Schema: heng36
[GET /games/:gameId] Error fetching game: Error: relation "heng36.games" does not exist
Error details: {
  theme: 'heng36',
  schema: 'heng36',
  gameId: '123',
  message: 'relation "heng36.games" does not exist',
  code: '42P01',
  detail: undefined,
  hint: undefined,
  stack: 'Error: relation "heng36.games" does not exist\n    at ...'
}
```

---

## 🎯 สรุป

**สิ่งที่แก้ไข:**
1. ✅ เพิ่ม detailed error logging ใน `games.js`
2. ✅ เพิ่ม detailed error logging ใน `answers.js`
3. ✅ Error messages ตอนนี้แสดง theme, schema, และ error details

**ขั้นตอนต่อไป:**
1. รัน backend server
2. ตรวจสอบ backend logs เมื่อเกิด error
3. แก้ไขตาม error message ที่เห็น

---

**🎉 ตอนนี้ backend logs จะแสดง detailed error messages แล้ว!**

**ลองรัน backend server แล้วดู logs ว่าเกิด error อะไรครับ**

