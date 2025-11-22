# 📋 ขั้นตอนต่อไปหลังจาก Nameservers Propagate

## ⏳ สถานะปัจจุบัน

- ✅ กำลังรอ Nameservers propagate (24-48 ชั่วโมง)
- ⏳ Domain: `heng36.party` กำลังเปลี่ยน Nameservers

---

## ✅ Checklist ขั้นตอนต่อไป

### 1. ตรวจสอบ Nameservers Propagate (หลังจาก 24-48 ชั่วโมง)

- [ ] ตรวจสอบใน Cloudflare Dashboard ว่า domain status เป็น **Active** (ส้ม)
- [ ] ทดสอบ Nameservers:
  ```bash
  nslookup -type=NS heng36.party
  ```
  ควรได้: `dante.ns.cloudflare.com`, `kira.ns.cloudflare.com` (หรือ nameservers อื่นๆ ที่ Cloudflare ให้)

---

### 2. ตั้งค่า DNS CNAME Records (3 records)

หลังจาก Nameservers propagate แล้ว:

#### 2.1 CNAME สำหรับ HENG36
- [ ] เข้า Cloudflare Dashboard → DNS → Records
- [ ] คลิก **Add record**
- [ ] ตั้งค่า:
  - **Type**: `CNAME`
  - **Name**: `img`
  - **Target**: `ipflzfxezdzbmoqglknu.supabase.co`
  - **Proxy status**: ✅ **Proxied** (ส้ม)
  - **TTL**: Auto
- [ ] คลิก **Save**

#### 2.2 CNAME สำหรับ MAX56 (ถ้ามี domain max56.party)
- [ ] **Name**: `img`
  - **Target**: `aunfaslgmxxdeemvtexn.supabase.co`
  - **Proxy status**: ✅ **Proxied** (ส้ม)

#### 2.3 CNAME สำหรับ JEED24 (ถ้ามี domain jeed24.party)
- [ ] **Name**: `img`
  - **Target**: `pyrtleftkrjxvwlbvfma.supabase.co`
  - **Proxy status**: ✅ **Proxied** (ส้ม)

#### 2.4 ทดสอบ DNS
- [ ] รอ 5-15 นาที
- [ ] ทดสอบ:
  ```bash
  nslookup img.heng36.party
  ```
  ควรได้: `img.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co`

---

### 3. สร้าง Cloudflare Worker

#### 3.1 สร้าง Worker
- [ ] เข้า Cloudflare Dashboard → **Workers & Pages**
- [ ] คลิก **Create application** → **Create Worker**
- [ ] ตั้งชื่อ: `supabase-storage-cdn-multi-theme`
- [ ] คลิก **Deploy** (สร้าง Worker เปล่าก่อน)

#### 3.2 แก้ไข Worker Code
- [ ] ไปที่ Worker → **Edit code**
- [ ] **ลบ code เก่าทั้งหมด**
- [ ] เปิดไฟล์ `cloudflare-worker-advanced.js`
- [ ] **Copy code ทั้งหมด** (166 บรรทัด)
- [ ] **Paste** ลงใน Worker editor
- [ ] คลิก **Save and deploy**

#### 3.3 ตรวจสอบ Configuration
ตรวจสอบว่า config ถูกต้อง:
```javascript
const CONFIG = {
  SUPABASE_PROJECTS: {
    heng36: 'ipflzfxezdzbmoqglknu',
    max56: 'aunfaslgmxxdeemvtexn',
    jeed24: 'pyrtleftkrjxvwlbvfma',
  },
  BUCKET_NAME: 'game-images',
  CDN_DOMAINS: {
    heng36: 'img.heng36.party',
    max56: 'img.max56.party',
    jeed24: 'img.jeed24.party',
  },
};
```

---

### 4. ตั้งค่า Worker Routes (3 routes)

#### 4.1 Route สำหรับ HENG36
- [ ] ไปที่ Worker → **Triggers** → **Routes**
- [ ] คลิก **Add route**
- [ ] ตั้งค่า:
  - **Route**: `img.heng36.party/game-images/*`
  - **Zone**: เลือก `heng36.party`
- [ ] คลิก **Add route**

#### 4.2 Route สำหรับ MAX56 (ถ้ามี)
- [ ] **Route**: `img.max56.party/game-images/*`
- [ ] **Zone**: เลือก `max56.party`

#### 4.3 Route สำหรับ JEED24 (ถ้ามี)
- [ ] **Route**: `img.jeed24.party/game-images/*`
- [ ] **Zone**: เลือก `jeed24.party`

---

### 5. ตั้งค่า Supabase Storage Public Access

#### 5.1 สำหรับ HENG36 Project
- [ ] เข้า Supabase Dashboard → เลือก project `ipflzfxezdzbmoqglknu`
- [ ] ไปที่ **Storage** → **Buckets**
- [ ] ตรวจสอบว่ามี bucket `game-images` หรือไม่
- [ ] ถ้ายังไม่มี → สร้าง bucket:
  - **Name**: `game-images`
  - **Public bucket**: ✅ เปิด
- [ ] ไปที่ **SQL Editor** → **New query**
- [ ] รัน SQL:
  ```sql
  CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'game-images');
  ```
- [ ] คลิก **Run**

#### 5.2 สำหรับ MAX56 Project (ถ้ามี)
- [ ] เข้า project `aunfaslgmxxdeemvtexn`
- [ ] ทำเหมือนขั้นตอน 5.1

#### 5.3 สำหรับ JEED24 Project (ถ้ามี)
- [ ] เข้า project `pyrtleftkrjxvwlbvfma`
- [ ] ทำเหมือนขั้นตอน 5.1

---

### 6. ทดสอบการทำงาน

#### 6.1 ทดสอบ DNS
- [ ] รอ 5-15 นาที หลังจากตั้งค่า CNAME
- [ ] ทดสอบ:
  ```bash
  nslookup img.heng36.party
  ```
  ควรได้: `img.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co`

#### 6.2 ทดสอบ Supabase Storage โดยตรง
- [ ] อัปโหลดไฟล์ทดสอบไปที่ Supabase Storage
- [ ] เปิด URL ใน browser:
  ```
  https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/test.jpg
  ```
- [ ] ควรเห็นไฟล์โหลดได้

#### 6.3 ทดสอบ CDN URL (หลังตั้งค่า Workers)
- [ ] เปิด URL ใน browser:
  ```
  https://img.heng36.party/game-images/test.jpg
  ```
- [ ] ควรเห็นไฟล์โหลดได้ (ผ่าน Workers)

#### 6.4 ทดสอบผ่านระบบ
- [ ] เปิดหน้า **CreateGame.tsx**
- [ ] อัปโหลดรูปภาพ
- [ ] ตรวจสอบ CDN URL ที่ได้จากระบบ
- [ ] เปิด URL ใน browser
- [ ] ควรเห็นรูปภาพโหลดได้ ✅

#### 6.5 ตรวจสอบ Cache Headers
- [ ] เปิด Browser DevTools → **Network** tab
- [ ] เปิดรูปภาพจาก CDN URL
- [ ] ตรวจสอบ Response Headers:
  - `CF-Cache-Status: HIT` (ถ้า cache แล้ว)
  - `Cache-Control: public, max-age=31536000, immutable`

---

## 📝 สรุปลำดับขั้นตอน

### หลังจาก Nameservers Propagate:

1. ✅ **ตรวจสอบ Nameservers** → ต้องเป็น Cloudflare nameservers
2. ✅ **ตั้งค่า DNS CNAME** → `img` → `ipflzfxezdzbmoqglknu.supabase.co` (Proxied)
3. ✅ **สร้าง Cloudflare Worker** → `supabase-storage-cdn-multi-theme`
4. ✅ **ตั้งค่า Worker Routes** → `img.heng36.party/game-images/*`
5. ✅ **ตั้งค่า Supabase Storage** → Public access policy
6. ✅ **ทดสอบ** → อัปโหลดรูปภาพและตรวจสอบ CDN URL

---

## ⏱️ เวลาที่ใช้

- **Nameservers propagate**: 24-48 ชั่วโมง (กำลังรอ)
- **DNS CNAME**: 5-15 นาที
- **Workers setup**: 10-15 นาที
- **Supabase Storage**: 5 นาที
- **Testing**: 10 นาที

**รวมหลังจาก Nameservers propagate: ~30-45 นาที**

---

## 📚 เอกสารอ้างอิง

- `SETUP-CDN-WORKERS-GUIDE.md` - คู่มือการตั้งค่า Workers
- `CLOUDFLARE-DNS-SETUP.md` - คู่มือการตั้งค่า DNS
- `cloudflare-worker-advanced.js` - Worker code

---

## 🎯 สิ่งที่ต้องเตรียมตอนนี้ (ระหว่างรอ Nameservers)

### 1. เตรียม Worker Code
- [ ] เปิดไฟล์ `cloudflare-worker-advanced.js`
- [ ] ตรวจสอบว่า config ถูกต้อง
- [ ] เตรียม copy code ไว้

### 2. เตรียม Supabase Storage
- [ ] เข้า Supabase Dashboard
- [ ] ตรวจสอบว่าแต่ละ project มี bucket `game-images` หรือไม่
- [ ] เตรียม SQL query สำหรับสร้าง public access policy

### 3. เตรียมข้อมูล
- [ ] เขียนรายการ Supabase project refs:
  - HENG36: `ipflzfxezdzbmoqglknu`
  - MAX56: `aunfaslgmxxdeemvtexn`
  - JEED24: `pyrtleftkrjxvwlbvfma`
- [ ] เขียนรายการ CDN domains:
  - HENG36: `img.heng36.party`
  - MAX56: `img.max56.party`
  - JEED24: `img.jeed24.party`

---

## ✅ Checklist สรุป

### ตอนนี้ (ระหว่างรอ Nameservers):
- [ ] เตรียม Worker code
- [ ] เตรียม Supabase Storage
- [ ] เตรียมข้อมูล configuration

### หลังจาก Nameservers Propagate:
- [ ] ตรวจสอบ Nameservers
- [ ] ตั้งค่า DNS CNAME
- [ ] สร้าง Cloudflare Worker
- [ ] ตั้งค่า Worker Routes
- [ ] ตั้งค่า Supabase Storage Public Access
- [ ] ทดสอบการทำงาน

---

**หมายเหตุ:** 
- รอ Nameservers propagate ก่อน (24-48 ชั่วโมง)
- หลังจากนั้นทำตาม checklist ด้านบน
- ใช้เวลา ~30-45 นาที หลังจาก Nameservers propagate

