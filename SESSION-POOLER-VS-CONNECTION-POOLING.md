# 🔄 Session Pooler vs Connection Pooling

## 📊 เปรียบเทียบ

### Session Pooler (Port 5432) - ✅ แนะนำ

**Connection String Format**:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

**ข้อดี**:
- ✅ **รองรับ Prepared Statements** - ใช้ได้กับ prepared statements
- ✅ **รองรับ Transactions** - รองรับ transaction features ครบถ้วน
- ✅ **รองรับ Session Variables** - ใช้ session variables ได้
- ✅ **Port 5432** - ใช้ port เดียวกับ Direct Connection (ง่ายกว่า)
- ✅ **Session-level features** - รองรับ features แบบ session

**เหมาะสำหรับ**:
- Applications ที่ใช้ transactions
- Applications ที่ใช้ prepared statements
- Applications ที่ต้องการ session features

---

### Connection Pooling (Port 6543) - Transaction Mode Only

**Connection String Format**:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**ข้อดี**:
- ✅ **Transaction Mode** - รองรับ transactions
- ✅ **Connection Pooling** - แชร์ connections ได้

**ข้อจำกัด**:
- ❌ **ไม่รองรับ Prepared Statements** - ใช้ prepared statements ไม่ได้
- ❌ **ไม่รองรับ Session Variables** - ใช้ session variables ไม่ได้
- ❌ **Transaction Mode Only** - รองรับแค่ transaction mode

**เหมาะสำหรับ**:
- Simple queries
- Applications ที่ไม่ใช้ prepared statements
- Applications ที่ไม่ต้องการ session features

---

### Direct Connection (Port 5432)

**Connection String Format**:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

**ข้อดี**:
- ✅ **Full Features** - รองรับทุก features
- ✅ **No Pooling Overhead** - ไม่มี overhead จาก pooling

**ข้อจำกัด**:
- ❌ **Connection Limit** - มี connection limit
- ❌ **No Connection Sharing** - ไม่แชร์ connections

---

## 🎯 Recommendation: ใช้ Session Pooler

**Session Pooler (Port 5432) ดีที่สุด** เพราะ:

1. ✅ **รองรับทุก features** ที่ backend ต้องการ:
   - Transactions (ใช้ใน routes/coins.js, routes/users.js)
   - Prepared statements (ถ้าใช้ในอนาคต)
   - Session variables (ถ้าใช้ในอนาคต)

2. ✅ **Port 5432** - ใช้ port เดียวกับ Direct Connection (ง่ายกว่า)

3. ✅ **Connection Pooling** - แชร์ connections ได้ (ประหยัด resources)

4. ✅ **ไม่มีข้อจำกัด** - ไม่มีข้อจำกัดเหมือน Connection Pooling (port 6543)

---

## ✅ Connection Strings ที่ใช้

### HENG36
```env
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### MAX56
```env
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

---

## 🧪 Test Connection

```bash
cd backend
npm run test:connection
```

---

## 📋 Summary

| Feature | Session Pooler (5432) | Connection Pooling (6543) | Direct (5432) |
|---------|----------------------|--------------------------|---------------|
| Prepared Statements | ✅ | ❌ | ✅ |
| Transactions | ✅ | ✅ | ✅ |
| Session Variables | ✅ | ❌ | ✅ |
| Connection Pooling | ✅ | ✅ | ❌ |
| Port | 5432 | 6543 | 5432 |
| **Recommended** | ✅ **YES** | ⚠️ | ⚠️ |

---

## 🎯 สรุป

**ใช้ Session Pooler (Port 5432) ได้เลย!** ✅

**ข้อดี**:
- ✅ รองรับทุก features ที่ backend ต้องการ
- ✅ Connection pooling (ประหยัด resources)
- ✅ Port 5432 (ง่ายกว่า)
- ✅ ไม่มีข้อจำกัด

**ไม่มีปัญหา!** 🚀

