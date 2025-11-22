# 🔧 แก้ไขข้อผิดพลาด: "new row violates row-level security policy"

## ❌ ปัญหา

เมื่ออัปโหลดรูปภาพผ่าน Supabase Storage จะเกิดข้อผิดพลาด:
```
Failed to upload image: new row violates row-level security policy
```

## 🔍 สาเหตุ

ข้อผิดพลาดนี้เกิดจาก **Supabase Row Level Security (RLS)** policy ที่บล็อกการเขียนข้อมูลลง Storage bucket

### สาเหตุที่เป็นไปได้:

1. ❌ **Storage bucket ไม่มี INSERT policy**
   - Bucket ยังไม่ได้ตั้งค่า policy สำหรับการอัปโหลดไฟล์

2. ❌ **User ไม่ได้ authenticated**
   - Supabase client ไม่ได้ login หรือ session หมดอายุ

3. ❌ **Storage bucket ไม่ได้ตั้งค่าเป็น public**
   - Bucket ต้องเป็น public bucket เพื่อให้อัปโหลดได้

---

## ✅ วิธีแก้ไข

### 1. ตั้งค่า Storage Bucket Policies (สำคัญ!)

**ขั้นตอน:**

1. เข้า **Supabase Dashboard** → เลือก project ของคุณ
2. ไปที่ **Storage** → **Policies**
3. เลือก bucket `game-images` (หรือ bucket ที่คุณใช้)
4. คลิก **New Policy** → เลือก **For full customization**

#### Policy 1: INSERT (อัปโหลดไฟล์)

**Policy Name:** `Allow authenticated users to upload files`

**Policy Definition:**
```sql
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images');
```

**Settings:**
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **USING expression:** (ว่าง)
- **WITH CHECK expression:** `bucket_id = 'game-images'`

#### Policy 2: SELECT (อ่านไฟล์)

**Policy Name:** `Public Access`

**Policy Definition:**
```sql
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');
```

**Settings:**
- **Allowed operation:** `SELECT`
- **Target roles:** `public` (หรือ `authenticated`)
- **USING expression:** `bucket_id = 'game-images'`
- **WITH CHECK expression:** (ว่าง)

#### Policy 3: UPDATE (อัปเดตไฟล์)

**Policy Name:** `Allow authenticated users to update files`

**Policy Definition:**
```sql
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'game-images')
WITH CHECK (bucket_id = 'game-images');
```

**Settings:**
- **Allowed operation:** `UPDATE`
- **Target roles:** `authenticated`
- **USING expression:** `bucket_id = 'game-images'`
- **WITH CHECK expression:** `bucket_id = 'game-images'`

#### Policy 4: DELETE (ลบไฟล์)

**Policy Name:** `Allow authenticated users to delete files`

**Policy Definition:**
```sql
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'game-images');
```

**Settings:**
- **Allowed operation:** `DELETE`
- **Target roles:** `authenticated`
- **USING expression:** `bucket_id = 'game-images'`
- **WITH CHECK expression:** (ว่าง)

---

### 2. ตรวจสอบว่า Bucket เป็น Public

**ขั้นตอน:**

1. ไปที่ **Storage** → **Buckets**
2. คลิกที่ bucket `game-images`
3. ตรวจสอบว่า **Public bucket** ถูกเปิดอยู่ ✅
4. ถ้ายังไม่ได้เปิด → คลิก **Edit** → เปิด **Public bucket** → **Save**

---

### 3. ตรวจสอบ Authentication

**ตรวจสอบว่า user ได้ login แล้ว:**

1. เปิด Browser DevTools → **Console**
2. ตรวจสอบว่า Supabase client มี session:
   ```javascript
   // ใน Browser Console
   import { getSupabaseClient } from './src/services/supabase-auth'
   const supabase = getSupabaseClient()
   const { data: { session } } = await supabase.auth.getSession()
   console.log('Session:', session)
   ```

3. ถ้า `session` เป็น `null` → ต้อง login ก่อน

---

### 4. ใช้ SQL Editor (วิธีเร็วที่สุด)

**ขั้นตอน:**

1. เข้า **Supabase Dashboard** → **SQL Editor**
2. คลิก **New query**
3. รัน SQL นี้ (แก้ไข `game-images` เป็นชื่อ bucket ของคุณ):

```sql
-- ✅ Policy 1: INSERT (อัปโหลดไฟล์)
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images');

-- ✅ Policy 2: SELECT (อ่านไฟล์ - Public)
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');

-- ✅ Policy 3: UPDATE (อัปเดตไฟล์)
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'game-images')
WITH CHECK (bucket_id = 'game-images');

-- ✅ Policy 4: DELETE (ลบไฟล์)
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'game-images');
```

4. คลิก **Run**

---

## 🔍 ตรวจสอบว่าแก้ไขแล้ว

### 1. ทดสอบอัปโหลดรูปภาพ

1. เปิดหน้า **CreateGame.tsx**
2. เลือกรูปภาพ
3. คลิก **อัปโหลด**
4. ตรวจสอบ Console log:
   ```
   Image uploaded successfully: { storagePath: '...', supabaseUrl: '...', cdnUrl: '...' }
   ```

### 2. ตรวจสอบ Policies

1. ไปที่ **Storage** → **Policies**
2. ตรวจสอบว่ามี policies 4 ตัว:
   - ✅ Allow authenticated users to upload files (INSERT)
   - ✅ Public Access (SELECT)
   - ✅ Allow authenticated users to update files (UPDATE)
   - ✅ Allow authenticated users to delete files (DELETE)

---

## 🚨 Troubleshooting

### ปัญหา: ยังเกิดข้อผิดพลาดหลังจากตั้งค่า policies แล้ว

**วิธีแก้:**

1. **ตรวจสอบว่า bucket name ถูกต้อง:**
   - ตรวจสอบใน `env.heng36`: `VITE_STORAGE_BUCKET_HENG36=game-images`
   - ตรวจสอบใน Supabase Dashboard: bucket name ตรงกันหรือไม่

2. **ตรวจสอบว่า user authenticated:**
   ```javascript
   const supabase = getSupabaseClient()
   const { data: { session } } = await supabase.auth.getSession()
   if (!session) {
     console.error('User not authenticated!')
   }
   ```

3. **ลบ policies เก่าและสร้างใหม่:**
   - ไปที่ **Storage** → **Policies**
   - ลบ policies เก่าทั้งหมด
   - สร้าง policies ใหม่ตามขั้นตอนที่ 4

### ปัญหา: อัปโหลดได้แต่ไม่เห็นรูปภาพ

**วิธีแก้:**

1. ตรวจสอบว่า **Public bucket** เปิดอยู่
2. ตรวจสอบว่า **SELECT policy** ตั้งค่าเป็น `public` (ไม่ใช่ `authenticated`)
3. ทดสอบ URL โดยตรง:
   ```
   https://<project-ref>.supabase.co/storage/v1/object/public/game-images/<path>
   ```

---

## 📋 Checklist

- [ ] ตั้งค่า Storage Bucket Policies (INSERT, SELECT, UPDATE, DELETE)
- [ ] เปิด Public bucket
- [ ] ตรวจสอบว่า user authenticated
- [ ] ทดสอบอัปโหลดรูปภาพ
- [ ] ตรวจสอบ Console log ไม่มี errors

---

## 🎯 สรุป

**สาเหตุหลัก:** Supabase Storage RLS policy ไม่ได้ตั้งค่าให้อนุญาตการอัปโหลดไฟล์

**วิธีแก้:** ตั้งค่า policies สำหรับ INSERT, SELECT, UPDATE, DELETE

**เวลาที่ใช้:** ~5-10 นาที

---

**ต้องการความช่วยเหลือเพิ่มเติมไหม?**

