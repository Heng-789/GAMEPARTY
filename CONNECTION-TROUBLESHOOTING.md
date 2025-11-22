# 🔧 Connection Troubleshooting Guide

## ❌ Error: `getaddrinfo ENOTFOUND db.ipflzfxezdzbmoqglknu.supabase.co`

### สาเหตุที่เป็นไปได้:

1. **Supabase Project ยังไม่ได้ Setup เสร็จ**
   - Project status ยังไม่เป็น "Active"
   - Database ยังไม่พร้อมใช้งาน

2. **Connection String ไม่ถูกต้อง**
   - Project reference ผิด
   - Password ผิด

3. **Network/DNS Issue**
   - DNS ไม่สามารถ resolve hostname
   - Firewall block connection

---

## ✅ วิธีแก้ไข

### Step 1: ตรวจสอบ Supabase Project Status

1. ไปที่ Supabase Dashboard:
   - HENG36: `https://ipflzfxezdzbmoqglknu.supabase.co`
   - MAX56: `https://aunfaslgmxxdeemvtexn.supabase.co`

2. ตรวจสอบ:
   - Project status = **"Active"** ✅
   - Database status = **"Ready"** ✅

3. ถ้ายังเป็น "Setting up":
   - รอให้เสร็จ (~2-3 นาที)
   - Refresh page

### Step 2: รับ Connection String ใหม่

1. ไปที่ **Settings** → **Database**
2. Scroll ลงไปหา **"Connection string"**
3. เลือก **"URI"** tab (Connection Pooling) หรือ **"Direct connection"**
4. Copy connection string
5. อัพเดท `.env` file

### Step 3: ตรวจสอบ Connection String Format

**Connection Pooling (แนะนำ)**:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Direct Connection**:
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

### Step 4: อัพเดท `.env` File

```env
# HENG36 Theme
DATABASE_URL_HENG36=postgresql://postgres:[PASSWORD]@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require

# MAX56 Theme
DATABASE_URL_MAX56=postgresql://postgres:[PASSWORD]@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require
```

### Step 5: Test Connection

```bash
cd backend
npm run test:connection
```

---

## 🔍 Debug Steps

### 1. Test DNS Resolution
```powershell
nslookup db.ipflzfxezdzbmoqglknu.supabase.co
```

### 2. Test Network Connectivity
```powershell
Test-NetConnection -ComputerName db.ipflzfxezdzbmoqglknu.supabase.co -Port 5432
```

### 3. Test Connection String
```powershell
# ตรวจสอบ connection string format
$url = "postgresql://postgres:password@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require"
Write-Host $url
```

---

## 🆘 ถ้ายังไม่ได้

### Option 1: ใช้ Connection Pooling URL
เปลี่ยนจาก direct connection เป็น connection pooling:
```env
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Option 2: ตรวจสอบ Project Reference
- ตรวจสอบว่า project reference ถูกต้อง
- ตรวจสอบว่า project อยู่ใน region ที่ถูกต้อง (Southeast Asia)

### Option 3: ตรวจสอบ Firewall
- ตรวจสอบว่า firewall ไม่ block connection
- ตรวจสอบว่า network ไม่ block port 5432 หรือ 6543

---

## ✅ Checklist

- [ ] ตรวจสอบ Supabase project status = "Active"
- [ ] ตรวจสอบ connection string จาก Dashboard
- [ ] อัพเดท `.env` file
- [ ] Test DNS resolution
- [ ] Test network connectivity
- [ ] Test connection อีกครั้ง

---

## 📞 Support

หากยังมีปัญหา:
1. ตรวจสอบ Supabase Dashboard
2. ตรวจสอบ connection string format
3. ตรวจสอบ network connectivity
4. ติดต่อ Supabase support

