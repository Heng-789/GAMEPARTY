# 🆘 Troubleshooting Connection Issues

## ❌ Error: `getaddrinfo ENOTFOUND db.ipflzfxezdzbmoqglknu.supabase.co`

### สาเหตุที่เป็นไปได้:

1. **Project ยังไม่ได้สร้างหรือยังไม่พร้อม**
   - ตรวจสอบว่า Supabase project ถูกสร้างแล้ว
   - ตรวจสอบว่า project status เป็น "Active"

2. **Connection String ไม่ถูกต้อง**
   - ตรวจสอบว่า copy connection string จาก Supabase Dashboard
   - ตรวจสอบว่า project reference ถูกต้อง

3. **Network/Firewall Issue**
   - ตรวจสอบ internet connection
   - ตรวจสอบ firewall settings

---

## ✅ วิธีแก้ไข

### Step 1: ตรวจสอบ Connection String

1. ไปที่ Supabase Dashboard:
   - HENG36: `https://ipflzfxezdzbmoqglknu.supabase.co`
   - MAX56: `https://aunfaslgmxxdeemvtexn.supabase.co`

2. ไปที่ **Settings** → **Database**

3. ตรวจสอบ **Connection string**:
   - ควรเป็น: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - ตรวจสอบว่า `[PROJECT-REF]` ถูกต้อง

### Step 2: ตรวจสอบ Project Status

1. ไปที่ Supabase Dashboard
2. ตรวจสอบว่า project status เป็น **"Active"**
3. ถ้ายังเป็น "Setting up" ให้รอให้เสร็จ (~2-3 นาที)

### Step 3: ตรวจสอบ Network

```bash
# Test DNS resolution
nslookup db.ipflzfxezdzbmoqglknu.supabase.co
nslookup db.aunfaslgmxxdeemvtexn.supabase.co
```

### Step 4: ตรวจสอบ Connection String Format

Connection string ควรมีรูปแบบ:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

**สำคัญ**:
- `[PASSWORD]` = password ที่ตั้งไว้ตอนสร้าง project
- `[PROJECT-REF]` = project reference จาก Supabase
- ต้องมี `?sslmode=require` ที่ท้าย

---

## 🔍 ตรวจสอบ Connection String

### HENG36
- Project Reference: `ipflzfxezdzbmoqglknu`
- Connection String: `postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require`

### MAX56
- Project Reference: `aunfaslgmxxdeemvtexn`
- Connection String: `postgresql://postgres:RpJk7ZpjgBPdfPxF@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require`

---

## 🧪 Test Connection แบบ Manual

### ใช้ psql (ถ้ามี)
```bash
psql "postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require"
```

### ใช้ Supabase Dashboard
1. ไปที่ SQL Editor
2. Run query: `SELECT NOW();`
3. ถ้าทำงานได้ = database พร้อม

---

## ✅ Checklist

- [ ] ตรวจสอบ Supabase project status = "Active"
- [ ] ตรวจสอบ connection string จาก Settings → Database
- [ ] ตรวจสอบ password ถูกต้อง
- [ ] ตรวจสอบ project reference ถูกต้อง
- [ ] ตรวจสอบ network connection
- [ ] ตรวจสอบ `.env` file format

---

## 🎯 Next Steps

1. ตรวจสอบ connection strings ใน Supabase Dashboard
2. อัพเดท `.env` file ถ้าจำเป็น
3. Run `npm run test:connection` อีกครั้ง

---

หากยังมีปัญหา ให้ตรวจสอบ:
- Supabase project status
- Connection string จาก Dashboard
- Network connectivity

