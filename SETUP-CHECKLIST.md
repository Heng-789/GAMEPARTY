# ✅ Checklist การตั้งค่า Cloudflare CDN สำหรับ Supabase Storage

## 📋 สถานะการตั้งค่า

### ✅ ที่ทำแล้ว
- [x] ตั้งค่า Page Rule: `img.heng36.party/game-images/*` → Cache Everything
- [x] แก้ไข `env.heng36` ให้ใช้ `img.heng36.party`

### ⚠️ ที่ยังต้องทำ (สำคัญ!)

#### 1. ตั้งค่า DNS CNAME (จำเป็น)
- [ ] เข้า Cloudflare Dashboard → DNS → Records
- [ ] สร้าง CNAME record:
  - **Type**: `CNAME`
  - **Name**: `img`
  - **Target**: `ipflzfxezdzbmoqglknu.supabase.co`
  - **Proxy status**: ✅ **Proxied** (ส้ม) - **สำคัญมาก!**
  - **TTL**: Auto
- [ ] คลิก **Save**
- [ ] รอ DNS propagate (5-15 นาที)

**ทดสอบ DNS:**
```bash
nslookup img.heng36.party
# ควรได้: img.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co
```

---

#### 2. ตั้งค่า Cloudflare Workers (จำเป็นมาก!)

**ทำไมต้องใช้ Workers?**
- Page Rules **ไม่สามารถ rewrite URL** ได้
- ต้องแปลง `img.heng36.party/game-images/xxx` → `ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/xxx`

**ขั้นตอน:**

1. **เข้า Cloudflare Dashboard** → **Workers & Pages** → **Create application** → **Create Worker**

2. **ตั้งชื่อ Worker**: `supabase-storage-cdn`

3. **Copy code จาก `cloudflare-worker-supabase-cdn.js`** ไปใส่ใน Worker editor

4. **แก้ไข Configuration** (ถ้ายังไม่ได้แก้):
   ```javascript
   const SUPABASE_PROJECT_REF = 'ipflzfxezdzbmoqglknu';
   const BUCKET_NAME = 'game-images';
   const CDN_DOMAIN = 'img.heng36.party';
   ```

5. **คลิก Save and deploy**

6. **ตั้งค่า Route**:
   - ไปที่ Worker → **Triggers** → **Routes**
   - คลิก **Add route**
   - **Route**: `img.heng36.party/game-images/*`
   - **Zone**: เลือก `heng36.party`
   - คลิก **Add route**

---

#### 3. ตั้งค่า Supabase Storage Public Access (จำเป็น!)

**ตรวจสอบว่า bucket มี public access policy:**

1. **เข้า Supabase Dashboard** → **Storage** → **Policies**

2. **ตรวจสอบ bucket `game-images`**:
   - ต้องมี policy สำหรับ `SELECT` operation
   - Target roles: `public`

3. **ถ้ายังไม่มี สร้าง policy ใหม่**:

   **วิธีที่ 1: ใช้ SQL Editor**
   ```sql
   -- สร้าง policy สำหรับ public read access
   CREATE POLICY "Public Access" ON storage.objects
   FOR SELECT
   USING (bucket_id = 'game-images');
   ```

   **วิธีที่ 2: ใช้ Dashboard**
   - ไปที่ **Storage** → **Policies** → **New Policy**
   - **Policy Name**: `Public Read Access`
   - **Allowed Operations**: `SELECT`
   - **Target Roles**: `public`
   - **USING Expression**: `true`
   - **WITH CHECK Expression**: `true`

---

## 🧪 ทดสอบการตั้งค่า

### 1. ทดสอบ DNS
```bash
nslookup img.heng36.party
# ควรได้: img.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co
```

### 2. ทดสอบ Supabase Storage โดยตรง
เปิด URL ใน browser:
```
https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/test.jpg
```

### 3. ทดสอบ CDN URL (หลังตั้งค่า Workers แล้ว)
เปิด URL ใน browser:
```
https://img.heng36.party/game-images/test.jpg
```

### 4. ทดสอบผ่านระบบ
1. อัปโหลดรูปภาพผ่าน **CreateGame.tsx**
2. ตรวจสอบ CDN URL ที่ได้จากระบบ
3. เปิด URL ใน browser
4. ควรเห็นรูปภาพโหลดได้

---

## ⚠️ ปัญหาที่พบบ่อย

### ปัญหา: CDN URL ไม่ทำงาน (404 Not Found)

**สาเหตุ:**
1. ❌ DNS ยังไม่ propagate → รอ 5-15 นาที
2. ❌ Worker route ไม่ถูกต้อง → ตรวจสอบ route ใน Workers
3. ❌ Supabase Storage path ไม่ถูกต้อง → ตรวจสอบ path ใน Worker
4. ❌ Supabase Storage ไม่มี public access → ตั้งค่า policy

**วิธีแก้:**
1. ตรวจสอบ DNS: `nslookup img.heng36.party`
2. ตรวจสอบ Worker logs ใน Cloudflare Dashboard
3. ทดสอบ Supabase URL โดยตรง
4. ตรวจสอบ Supabase Storage policy

### ปัญหา: CORS Error

**วิธีแก้:**
1. ตั้งค่า CORS policy ใน Supabase Storage
2. ตรวจสอบว่า Worker response มี CORS headers

### ปัญหา: รูปภาพไม่ cache

**วิธีแก้:**
1. ตรวจสอบ Page Rule ว่าตั้งค่าถูกต้อง
2. ตรวจสอบ `Cache-Control` headers ใน Worker response
3. ตรวจสอบ `CF-Cache-Status` header ใน response

---

## 📝 สรุป

### ✅ ต้องทำทั้งหมด 3 อย่าง:

1. **DNS CNAME** → `img` → `ipflzfxezdzbmoqglknu.supabase.co` (Proxied)
2. **Cloudflare Workers** → URL rewriting (`img.heng36.party/game-images/*`)
3. **Supabase Storage Policy** → Public read access

### ⏱️ เวลาที่ใช้:
- DNS: 5-15 นาที
- Workers: 5 นาที
- Storage Policy: 2 นาที

**รวม: ~15-20 นาที**

---

## 🎯 หลังจากตั้งค่าเสร็จ

1. ✅ ทดสอบอัปโหลดรูปภาพผ่านระบบ
2. ✅ ตรวจสอบ CDN URL ว่าทำงานได้
3. ✅ ตรวจสอบ cache headers (`CF-Cache-Status: HIT`)
4. ✅ ทดสอบความเร็วในการโหลดรูปภาพ

---

**หมายเหตุ:** 
- ถ้ายังไม่ตั้งค่า Workers ระบบจะไม่ทำงาน เพราะ Page Rules ไม่สามารถ rewrite URL ได้
- ต้องตั้งค่า Workers ก่อนจึงจะใช้งานได้

