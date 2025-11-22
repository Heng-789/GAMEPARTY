-- ✅ แก้ไขข้อผิดพลาด: "new row violates row-level security policy"
-- รัน SQL นี้ใน Supabase SQL Editor
-- Script นี้จะลบ policies เก่าก่อนสร้างใหม่ (ป้องกัน duplicate policy error)

-- ลบ policies เก่า (ถ้ามี)
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;

-- Policy 1: INSERT (อัปโหลดไฟล์) - สำคัญมาก!
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'game-images');

-- Policy 2: SELECT (อ่านไฟล์) - Public access
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

