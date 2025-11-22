# 🔧 Fix Connection Issue

## ❌ ปัญหา: `getaddrinfo ENOTFOUND`

DNS resolution ทำงานได้ (ได้ IPv6 address) แต่ Node.js อาจมีปัญหาเชื่อมต่อ IPv6

---

## ✅ วิธีแก้ไข: ใช้ Connection Pooling URL

Supabase แนะนำให้ใช้ **Connection Pooling** (port 6543) แทน Direct Connection (port 5432)

### Connection Pooling URL Format:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 🔄 อัพเดท `.env` File

### HENG36 (Connection Pooling)
```env
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:v519h0rDnPEMvRjp@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### MAX56 (Connection Pooling)
```env
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:RpJk7ZpjgBPdfPxF@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**หรือ** ใช้ Direct Connection (ถ้า Pooling ไม่ได้):
```env
DATABASE_URL_HENG36=postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require
DATABASE_URL_MAX56=postgresql://postgres:RpJk7ZpjgBPdfPxF@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require
```

---

## 📋 วิธีรับ Connection Pooling URL

1. ไปที่ Supabase Dashboard
2. Settings → Database
3. หา **"Connection string"**
4. เลือก **"URI"** tab (Connection Pooling)
5. Copy connection string

---

## 🧪 Test Connection

```bash
cd backend
npm run test:connection
```

---

## 🆘 ถ้ายังไม่ได้

### Option 1: ใช้ IPv4 แทน IPv6
เพิ่มใน connection string:
```
?sslmode=require&ipv4=true
```

### Option 2: ตรวจสอบ Supabase Project Status
- ตรวจสอบว่า project status เป็น "Active"
- ตรวจสอบว่า database พร้อมใช้งาน

### Option 3: ใช้ Connection Pooling
- ใช้ port 6543 แทน 5432
- ใช้ `postgres.[PROJECT-REF]` แทน `postgres`

---

## ✅ Checklist

- [ ] ตรวจสอบ Connection String ใน Supabase Dashboard
- [ ] ใช้ Connection Pooling URL (port 6543)
- [ ] อัพเดท `.env` file
- [ ] Test connection อีกครั้ง

