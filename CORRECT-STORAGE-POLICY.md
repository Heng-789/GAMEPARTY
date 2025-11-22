# ✅ Policy ที่ถูกต้องสำหรับระบบ

## ❌ Policy ปัจจุบัน (ไม่เหมาะสม)

Policy ที่คุณกำลังสร้างมีปัญหา:
- ❌ จำกัดเฉพาะไฟล์ JPG (`extension = 'jpg'`)
- ❌ จำกัดเฉพาะ folder `public` (`foldername = 'public'`)
- ❌ จำกัดเฉพาะ anonymous users (`auth.role() = 'anon'`)

**แต่ระบบของเรา:**
- ✅ ไฟล์อาจเป็น JPG, PNG, GIF, WebP
- ✅ ไฟล์ถูกอัปโหลดไปที่ `heng36/games/` ไม่ใช่ `public/`
- ✅ User อาจเป็น authenticated user

---

## ✅ Policy ที่ถูกต้อง

### วิธีที่ 1: ใช้ SQL Editor (แนะนำ - เร็วที่สุด)

**ขั้นตอน:**

1. **ปิดหน้าต่าง policy form นี้** (คลิก X)
2. ไปที่ **SQL Editor** → **New query**
3. Copy SQL นี้ไปวาง:

```sql
-- ✅ Policy 1: INSERT (อัปโหลดไฟล์) - สำหรับ authenticated users
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images');

-- ✅ Policy 2: SELECT (อ่านไฟล์) - Public access
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');

-- ✅ Policy 3: UPDATE (อัปเดตไฟล์) - สำหรับ authenticated users
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'game-images')
WITH CHECK (bucket_id = 'game-images');

-- ✅ Policy 4: DELETE (ลบไฟล์) - สำหรับ authenticated users
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'game-images');
```

4. คลิก **Run**

---

### วิธีที่ 2: สร้าง Policy ผ่าน UI (ถ้าต้องการใช้ UI)

**Policy 1: INSERT (อัปโหลดไฟล์)**

1. คลิก **New Policy** → **For full customization**
2. **Policy name:** `Allow authenticated users to upload files`
3. **Allowed operation:** ✅ **INSERT** (เลือก INSERT เท่านั้น)
4. **Target roles:** เลือก **authenticated** (ไม่ใช่ anon)
5. **Policy definition:**
   ```sql
   bucket_id = 'game-images'
   ```
   (ไม่ต้องใส่เงื่อนไข extension หรือ folder)
6. คลิก **Review** → **Save policy**

**Policy 2: SELECT (อ่านไฟล์)**

1. คลิก **New Policy** → **For full customization**
2. **Policy name:** `Public Access`
3. **Allowed operation:** ✅ **SELECT** (เลือก SELECT เท่านั้น)
4. **Target roles:** ไม่ต้องเลือก (default = public/anonymous)
5. **Policy definition:**
   ```sql
   bucket_id = 'game-images'
   ```
6. คลิก **Review** → **Save policy**

**Policy 3: UPDATE (อัปเดตไฟล์)**

1. คลิก **New Policy** → **For full customization**
2. **Policy name:** `Allow authenticated users to update files`
3. **Allowed operation:** ✅ **UPDATE** (เลือก UPDATE เท่านั้น)
4. **Target roles:** เลือก **authenticated**
5. **Policy definition:**
   ```sql
   bucket_id = 'game-images'
   ```
6. คลิก **Review** → **Save policy**

**Policy 4: DELETE (ลบไฟล์)**

1. คลิก **New Policy** → **For full customization**
2. **Policy name:** `Allow authenticated users to delete files`
3. **Allowed operation:** ✅ **DELETE** (เลือก DELETE เท่านั้น)
4. **Target roles:** เลือก **authenticated**
5. **Policy definition:**
   ```sql
   bucket_id = 'game-images'
   ```
6. คลิก **Review** → **Save policy**

---

## 🔍 เปรียบเทียบ

### Policy ปัจจุบัน (ไม่เหมาะสม):
```sql
bucket_id = 'game-images' 
AND extension = 'jpg'           ❌ จำกัดเฉพาะ JPG
AND foldername = 'public'       ❌ จำกัดเฉพาะ folder public
AND auth.role() = 'anon'        ❌ จำกัดเฉพาะ anonymous users
```

### Policy ที่ถูกต้อง:
```sql
bucket_id = 'game-images'       ✅ ครอบคลุมทุกไฟล์
                                  ✅ ครอบคลุมทุก folder
                                  ✅ ครอบคลุม authenticated users
```

---

## ✅ Checklist

- [ ] ปิดหน้าต่าง policy form ปัจจุบัน
- [ ] ใช้ SQL Editor (วิธีที่ 1) หรือสร้าง 4 policies ผ่าน UI (วิธีที่ 2)
- [ ] ตรวจสอบว่า policies ถูกสร้างแล้ว (Storage → Policies)
- [ ] ทดสอบอัปโหลดรูปภาพ

---

## 🎯 สรุป

**Policy ปัจจุบัน:** ❌ ไม่เหมาะสม (จำกัดมากเกินไป)

**Policy ที่ถูกต้อง:** ✅ ใช้ SQL Editor หรือสร้าง 4 policies แยกกัน

**เวลาที่ใช้:** ~5 นาที

---

**แนะนำให้ใช้วิธีที่ 1 (SQL Editor) เพราะเร็วกว่าและไม่ต้องสร้างทีละ policy**

