# 🔧 Authentication Fix Guide

## ❌ ปัญหา: "Tenant or user not found"

### สาเหตุหลัก:

**Supabase Project ยังไม่ได้ Setup เสร็จ** หรือ **Connection Pooling URL format ไม่ถูกต้อง**

---

## ✅ วิธีแก้ไข (3 วิธี)

### วิธีที่ 1: รับ Connection String จาก Supabase Dashboard (แนะนำที่สุด)

1. **ไปที่ Supabase Dashboard**:
   - HENG36: `https://ipflzfxezdzbmoqglknu.supabase.co`
   - MAX56: `https://aunfaslgmxxdeemvtexn.supabase.co`

2. **ไปที่ Settings → Database**

3. **หา "Connection string"** → เลือก **"URI"** tab (Connection Pooling)

4. **Copy connection string** ที่ Supabase ให้มา (อย่าแก้ไขเอง!)

5. **อัพเดท `.env` file**:
   ```env
   DATABASE_URL_HENG36=[PASTE_FROM_SUPABASE]
   DATABASE_URL_MAX56=[PASTE_FROM_SUPABASE]
   ```

6. **Test connection**:
   ```bash
   npm run test:connection
   ```

---

### วิธีที่ 2: รอให้ Supabase Project Setup เสร็จ

1. **ตรวจสอบ Supabase Dashboard**:
   - Project status = **"Active"** ✅
   - Database status = **"Ready"** ✅

2. **ถ้ายังเป็น "Setting up"**:
   - รอให้เสร็จ (~2-3 นาที)
   - Refresh page
   - ตรวจสอบอีกครั้ง

3. **เมื่อ project พร้อมแล้ว**:
   - Port 5432 (Direct Connection) จะเปิด
   - ใช้ Direct Connection แทน Connection Pooling

---

### วิธีที่ 3: ตรวจสอบ Connection Pooling URL Format

Connection Pooling URL format ที่ถูกต้อง:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**ตรวจสอบ**:
- ✅ Username: `postgres.[PROJECT-REF]` (มีจุดระหว่าง postgres กับ project-ref)
- ✅ Password: ถูกต้อง
- ✅ Host: `aws-0-ap-southeast-1.pooler.supabase.com`
- ✅ Port: `6543`
- ✅ Database: `postgres`
- ✅ SSL: `?sslmode=require`

**ตัวอย่าง**:
```env
# HENG36
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:v519h0rDnPEMvRjp@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# MAX56
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:RpJk7ZpjgBPdfPxF@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
```

---

## 🔍 Debug Steps

### 1. ตรวจสอบ Connection String Format
```powershell
# ตรวจสอบ format
Get-Content .env | Select-String "DATABASE_URL"
```

### 2. ตรวจสอบ Supabase Project Status
- ไปที่ Dashboard
- ตรวจสอบ status = "Active"
- ตรวจสอบ database = "Ready"

### 3. Test Connection
```bash
npm run test:connection
```

---

## 📋 Checklist

- [ ] ตรวจสอบ Supabase project status = "Active"
- [ ] รับ connection string จาก Dashboard (ไม่แก้ไขเอง)
- [ ] อัพเดท `.env` file
- [ ] ตรวจสอบ connection string format
- [ ] Test connection

---

## 🎯 Recommendation

**แนะนำ**: 
1. **รับ connection string ใหม่จาก Supabase Dashboard** (วิธีที่ 1)
2. **หรือรอให้ project setup เสร็จ** แล้วใช้ Direct Connection (วิธีที่ 2)

**Connection strings ที่ใช้อยู่ตอนนี้**:
- Format: Connection Pooling (port 6543)
- Status: Port เปิด แต่ authentication ไม่ผ่าน
- Solution: รับ connection string ใหม่จาก Dashboard

---

## 🆘 ถ้ายังไม่ได้

1. **ตรวจสอบ Supabase Dashboard**:
   - Project status
   - Database status
   - Connection string format

2. **ติดต่อ Supabase Support**:
   - ถ้า project status ไม่เป็น "Active"
   - ถ้า connection string ไม่ทำงาน

3. **ลองใช้ Direct Connection**:
   - เมื่อ port 5432 เปิด
   - Format ง่ายกว่า

---

**สรุป**: ปัญหา Authentication เกิดจาก connection pooling URL format หรือ project ยังไม่พร้อม แนะนำให้รับ connection string ใหม่จาก Supabase Dashboard

