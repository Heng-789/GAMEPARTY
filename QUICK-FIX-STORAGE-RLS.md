# ⚡ แก้ไข RLS Error เร็วที่สุด (5 นาที)

## 🎯 วิธีแก้ไข (เร็วที่สุด)

### ขั้นตอนที่ 1: รัน SQL Policies (2 นาที)

1. เข้า **Supabase Dashboard** → เลือก project `ipflzfxezdzbmoqglknu`
2. ไปที่ **SQL Editor** → **New query**
3. Copy SQL นี้ไปวาง:

```sql
-- Policy 1: INSERT (อัปโหลดไฟล์)
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images');

-- Policy 2: SELECT (อ่านไฟล์) - Public
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');

-- Policy 3: UPDATE (อัปเดตไฟล์)
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'game-images')
WITH CHECK (bucket_id = 'game-images');

-- Policy 4: DELETE (ลบไฟล์)
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'game-images');
```

4. คลิก **Run**

---

### ขั้นตอนที่ 2: ตรวจสอบ Public Bucket (1 นาที)

1. ไปที่ **Storage** → **Buckets** → `game-images`
2. ตรวจสอบว่า **Public bucket** เปิดอยู่ ✅
3. ถ้ายังไม่ได้เปิด → คลิก **Edit** → เปิด **Public bucket** → **Save**

---

### ขั้นตอนที่ 3: ตรวจสอบ Authentication (1 นาที)

**ถ้าเป็นหน้า CreateGame (Admin):**

1. ตรวจสอบว่าได้ login แล้ว:
   - เปิด Browser Console
   - ตรวจสอบว่าไม่มี error เกี่ยวกับ authentication

2. ถ้ายังไม่ได้ login:
   - ไปที่หน้า Login
   - Login ด้วย admin account

---

### ขั้นตอนที่ 4: ทดสอบ (1 นาที)

1. เปิดหน้า **CreateGame.tsx**
2. เลือกรูปภาพ
3. คลิก **อัปโหลด**
4. ตรวจสอบ Console log:
   ```
   Image uploaded successfully, CDN URL: https://img.heng36.party/...
   ```

---

## ⚠️ ถ้ายังเกิดข้อผิดพลาด

### ตรวจสอบว่า Policies ถูกสร้างแล้ว:

1. ไปที่ **Storage** → **Policies**
2. ตรวจสอบว่ามี policies 4 ตัว:
   - ✅ Allow authenticated users to upload files (INSERT)
   - ✅ Public Access (SELECT)
   - ✅ Allow authenticated users to update files (UPDATE)
   - ✅ Allow authenticated users to delete files (DELETE)

### ถ้ายังไม่มี:

1. ลบ policies เก่า (ถ้ามี)
2. รัน SQL อีกครั้ง

---

## 🎯 สรุป

**เวลาที่ใช้:** ~5 นาที

**สิ่งที่ต้องทำ:**
1. ✅ รัน SQL policies (2 นาที)
2. ✅ ตรวจสอบ Public bucket (1 นาที)
3. ✅ ตรวจสอบ Authentication (1 นาที)
4. ✅ ทดสอบอัปโหลด (1 นาที)

---

**ต้องการความช่วยเหลือเพิ่มเติมไหม?**

