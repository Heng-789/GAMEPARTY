# 🔧 Fix Authentication Issue

## ❌ ปัญหา: "Tenant or user not found"

### สาเหตุที่เป็นไปได้:

1. **Connection Pooling URL Format ไม่ถูกต้อง**
   - Username format สำหรับ connection pooling อาจผิด
   - Supabase connection pooling ต้องการ format พิเศษ

2. **Supabase Project ยังไม่ได้ Setup เสร็จ**
   - Project status อาจยังไม่เป็น "Active"
   - Database อาจยังไม่พร้อม

3. **Password หรือ Credentials ผิด**
   - Password อาจไม่ถูกต้อง
   - Username format อาจผิด

---

## ✅ วิธีแก้ไข

### Solution 1: ใช้ Direct Connection (แนะนำ)

ถ้า Supabase project พร้อมแล้ว ใช้ Direct Connection แทน Connection Pooling:

```env
# HENG36 Theme - Direct Connection
DATABASE_URL_HENG36=postgresql://postgres:v519h0rDnPEMvRjp@db.ipflzfxezdzbmoqglknu.supabase.co:5432/postgres?sslmode=require

# MAX56 Theme - Direct Connection
DATABASE_URL_MAX56=postgresql://postgres:RpJk7ZpjgBPdfPxF@db.aunfaslgmxxdeemvtexn.supabase.co:5432/postgres?sslmode=require
```

**ข้อดี**:
- Format ง่ายกว่า
- ไม่ต้องใช้ username format พิเศษ
- ทำงานได้ทันทีถ้า project พร้อม

### Solution 2: รับ Connection String ใหม่จาก Supabase Dashboard

1. ไปที่ Supabase Dashboard:
   - HENG36: `https://ipflzfxezdzbmoqglknu.supabase.co`
   - MAX56: `https://aunfaslgmxxdeemvtexn.supabase.co`

2. ไปที่ **Settings** → **Database**

3. หา **"Connection string"** → เลือก **"URI"** tab (Connection Pooling)

4. **Copy connection string** ที่ Supabase ให้มา (อย่าแก้ไขเอง)

5. อัพเดท `.env` file

### Solution 3: ตรวจสอบ Supabase Project Status

1. ตรวจสอบว่า project status เป็น **"Active"**
2. ตรวจสอบว่า database status เป็น **"Ready"**
3. ถ้ายังเป็น "Setting up" → รอให้เสร็จ (~2-3 นาที)

---

## 🔄 ลองใช้ Direct Connection

ให้ฉันลองเปลี่ยนเป็น Direct Connection ก่อน:

