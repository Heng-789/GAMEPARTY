# 📋 วิธีดู Backend Logs เพื่อ Debug Internal Server Error

## ✅ สถานะปัจจุบัน

**Backend server รันอยู่แล้ว!**
- Port: 3000
- Process ID: 21612
- Status: LISTENING

---

## 🔍 วิธีดู Backend Logs

### วิธีที่ 1: ดู Terminal ที่รัน Backend Server

**ขั้นตอน:**
1. หา Terminal/PowerShell window ที่รัน `node src/index.js` หรือ `npm start`
2. ดู logs ที่แสดงใน terminal นั้น

**ตัวอย่าง logs ที่ควรเห็น:**
```
✅ Connected to HENG36 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

**เมื่อเกิด error:**
```
[GET /games/123] Theme: heng36, Schema: heng36
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

### วิธีที่ 2: รัน Backend Server ใหม่ใน Terminal ใหม่

**ถ้าหา Terminal ที่รัน backend ไม่เจอ:**

**ขั้นตอน:**
1. เปิด Terminal/PowerShell ใหม่
2. ไปที่ backend directory:
   ```powershell
   cd backend
   ```
3. รัน backend server:
   ```powershell
   node src/index.js
   ```
4. ดู logs ที่แสดงใน terminal นี้

---

### วิธีที่ 3: ใช้ Script ทดสอบ API

**สร้างไฟล์ `test-api.js` ใน root directory:**

```javascript
// test-api.js
const API_BASE_URL = 'http://localhost:3000';
const theme = 'heng36';

async function testEndpoint(name, endpoint) {
  try {
    const url = `${API_BASE_URL}${endpoint}?theme=${theme}`;
    console.log(`\n🧪 Testing ${name}: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'X-Theme': theme,
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success:`, data);
    } else {
      console.log(`❌ Error (${response.status}):`, data);
    }
  } catch (error) {
    console.log(`❌ Network Error:`, error.message);
  }
}

// Test endpoints
testEndpoint('Get All Games', '/api/games');
testEndpoint('Get All Users', '/api/users');
```

**รัน script:**
```powershell
node test-api.js
```

---

## 🎯 สิ่งที่ต้องดูใน Backend Logs

### 1. Request Logs

**ควรเห็น:**
```
[GET /games/123] Theme: heng36, Schema: heng36
[GET /answers/123] Theme: heng36, Schema: heng36, Limit: 50
[GET /users] Theme: heng36, Schema: heng36
```

**ถ้าไม่เห็น →** แสดงว่า request ไม่ถึง backend (อาจเป็น CORS หรือ network issue)

---

### 2. Error Logs

**ควรเห็น:**
```
[GET /games/:gameId] Error fetching game: Error: ...
Error details: {
  theme: 'heng36',
  schema: 'heng36',
  gameId: '123',
  message: 'relation "heng36.games" does not exist',
  code: '42P01',
  detail: undefined,
  hint: undefined,
  stack: '...'
}
```

**Error codes ที่พบบ่อย:**
- `42P01` = relation (table) does not exist
- `3D000` = schema does not exist
- `28P01` = authentication failed
- `ECONNREFUSED` = connection refused

---

## 🔧 วิธีแก้ไขตาม Error Message

### Error: "relation 'schema.table' does not exist"

**สาเหตุ:** Table ยังไม่ได้สร้าง

**วิธีแก้:**
```powershell
cd backend
node scripts/migrate-heng36.js
```

---

### Error: "schema 'schema' does not exist"

**สาเหตุ:** Schema ยังไม่ได้สร้าง

**วิธีแก้:**
```powershell
cd backend
node scripts/migrate-heng36.js
```

---

### Error: "connection refused" หรือ "ECONNREFUSED"

**สาเหตุ:** Database connection string ไม่ถูกต้อง

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

### Error: "permission denied"

**สาเหตุ:** Database user ไม่มีสิทธิ์

**วิธีแก้:**
1. ตรวจสอบ database user permissions
2. ตรวจสอบ schema ownership

---

## 📝 Checklist

- [ ] Backend server รันอยู่ (port 3000)
- [ ] ดู backend logs ใน terminal
- [ ] ตรวจสอบ error message ที่แท้จริง
- [ ] แก้ไขตาม error message
- [ ] ทดสอบอีกครั้ง

---

## 🎯 ขั้นตอนต่อไป

1. **ดู backend logs** ใน terminal ที่รัน backend server
2. **คัดลอก error message** ที่เห็น
3. **บอก error message** มาให้ฉันดู
4. **ฉันจะช่วยแก้ไข** ตาม error message

---

**🎉 ตอนนี้ backend มี detailed error logging แล้ว!**

**ลองดู backend logs แล้วบอก error message ที่เห็นมาครับ**

