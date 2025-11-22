# 📋 การปรับปรุงระบบลบรูปภาพ

## ✅ สิ่งที่ปรับปรุงแล้ว

### 1. ปรับปรุง `extractStoragePathFromCDN()` Function

รองรับรูปแบบ URL หลายแบบ:

#### ✅ Format 1: CDN URL
```
https://img.heng36.party/game-images/heng36/games/123.jpg
→ Storage Path: heng36/games/123.jpg
```

#### ✅ Format 2: Supabase Storage URL
```
https://xxxxx.supabase.co/storage/v1/object/public/game-images/heng36/games/123.jpg
→ Storage Path: heng36/games/123.jpg
```

#### ✅ Format 3: Direct Path
```
/heng36/games/123.jpg
→ Storage Path: heng36/games/123.jpg
```

#### ✅ Format 4: Auto-detect Theme
- หา theme ใน path อัตโนมัติ
- ถ้าเจอ theme จะใช้ path ตั้งแต่ theme เป็นต้นไป

---

### 2. ปรับปรุง `deleteImageFromStorage()` Function

- ✅ เพิ่ม logging ที่ละเอียดขึ้น
- ✅ แสดง theme, bucket, storagePath, originalUrl
- ✅ แสดง error details (message, code)
- ✅ Return `true` ถ้าลบสำเร็จ, `false` ถ้าล้มเหลว

---

### 3. ปรับปรุง DELETE Endpoint

- ✅ เพิ่ม logging summary
- ✅ แสดงจำนวนรูปภาพที่ลบสำเร็จ/ล้มเหลว
- ✅ ใช้ `Promise.allSettled` เพื่อให้ลบเกมต่อได้แม้บางรูปลบไม่สำเร็จ

---

## 🔍 ตัวอย่าง Log Output

```
[heng36] Deleting 2 image(s) from storage for game game123
[heng36] Deleting image from storage: {
  bucket: 'game-images',
  storagePath: 'heng36/games/123.jpg',
  originalUrl: 'https://img.heng36.party/game-images/heng36/games/123.jpg'
}
[heng36] Successfully deleted image: heng36/games/123.jpg
[heng36] Successfully deleted all 2 image(s) from storage.
```

---

## ⚠️ Error Handling

### ถ้าลบรูปภาพไม่สำเร็จ:
```
[heng36] Error deleting image from Supabase Storage: {
  error: 'Object not found',
  code: 404,
  bucket: 'game-images',
  storagePath: 'heng36/games/123.jpg',
  originalUrl: 'https://img.heng36.party/game-images/heng36/games/123.jpg'
}
[heng36] Deleted 1/2 images successfully. 1 failed.
```

**หมายเหตุ:** ระบบจะลบเกมต่อได้แม้บางรูปลบไม่สำเร็จ

---

## 🎯 รูปภาพที่รองรับการลบ

1. ✅ `puzzle.imageDataUrl` (เกมทายภาพปริศนา)
2. ✅ `numberPick.imageDataUrl` (เกมทายเบอร์เงิน)
3. ✅ `football.imageDataUrl` (เกมทายผลบอล)
4. ✅ `checkin.image` (เกมเช็คอิน - รูปภาพหลัก)
5. ✅ `checkin.announceImage` (เกมเช็คอิน - รูปภาพประกาศ)
6. ✅ `loyKrathong.image` (เกมลอยกระทง)
7. ✅ `bingo.image` (เกม BINGO)
8. ✅ `trickOrTreat.ghostImage` (เกม Trick or Treat)

---

## 📝 การตั้งค่า Environment Variables

ต้องตั้งค่าใน backend `.env`:

```env
# สำหรับ HENG36
SUPABASE_URL_HENG36=https://xxxxx.supabase.co
SUPABASE_ANON_KEY_HENG36=your_anon_key
VITE_STORAGE_BUCKET_HENG36=game-images

# สำหรับ MAX56
SUPABASE_URL_MAX56=https://xxxxx.supabase.co
SUPABASE_ANON_KEY_MAX56=your_anon_key
VITE_STORAGE_BUCKET_MAX56=game-images

# สำหรับ JEED24
SUPABASE_URL_JEED24=https://xxxxx.supabase.co
SUPABASE_ANON_KEY_JEED24=your_anon_key
VITE_STORAGE_BUCKET_JEED24=game-images
```

---

**📌 หมายเหตุ:** ระบบจะลบรูปภาพจาก Supabase Storage อัตโนมัติเมื่อลบเกม

