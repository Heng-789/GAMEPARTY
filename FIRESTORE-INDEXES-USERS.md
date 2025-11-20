# 🔥 Firestore Indexes สำหรับ Users Collection

## 📋 Indexes ที่ต้องสร้าง

หลังจาก migrate 600,000+++ users ไป Firestore แล้ว ต้องสร้าง indexes เหล่านี้เพื่อให้ query ทำงานได้เร็ว:

---

## 1. **Index สำหรับ `hcoin` (Descending)**

### **Collection:** `users`
### **Fields:**
- `hcoin` (Descending)

### **ใช้สำหรับ:**
- Query top 100 users ตาม hcoin (ใน CreateGame, UploadUsersExtra)

### **วิธีสร้าง (Firebase Console):**
1. ไปที่ Firebase Console → Firestore Database
2. ไปที่ "Indexes" tab
3. คลิก "Create Index"
4. **Collection ID:** `users`
5. **Fields to index:**
   - Field: `hcoin`, Order: `Descending`
6. คลิก "Create"

### **Query ตัวอย่าง:**
```typescript
const q = query(
  collection(firestore, 'users'),
  orderBy('hcoin', 'desc'),
  limit(100)
)
```

---

## 2. **Index สำหรับ `username` (Ascending)**

### **Collection:** `users`
### **Fields:**
- `username` (Ascending)

### **ใช้สำหรับ:**
- Search users โดย username prefix (ใน UploadUsersExtra)

### **วิธีสร้าง (Firebase Console):**
1. ไปที่ Firebase Console → Firestore Database
2. ไปที่ "Indexes" tab
3. คลิก "Create Index"
4. **Collection ID:** `users`
5. **Fields to index:**
   - Field: `username`, Order: `Ascending`
6. คลิก "Create"

### **Query ตัวอย่าง:**
```typescript
const q = query(
  collection(firestore, 'users'),
  where('username', '>=', searchTerm),
  where('username', '<=', searchTerm + '\uf8ff'),
  orderBy('username', 'asc'),
  limit(100)
)
```

---

## 3. **Composite Index สำหรับ `username` Range Query (ถ้าจำเป็น)**

### **Collection:** `users`
### **Fields:**
- `username` (Ascending)
- `username` (Ascending) - ใช้ range query

### **ใช้สำหรับ:**
- Search users โดย username prefix พร้อม range query

### **หมายเหตุ:**
- Index นี้จะถูกสร้างอัตโนมัติเมื่อ query ที่ต้องการ index
- หรือสร้าง manual ตามขั้นตอนข้างบน

---

## 📝 สรุป Indexes

| Index | Fields | Order | Usage |
|-------|--------|-------|-------|
| `users_hcoin_desc` | `hcoin` | Descending | Top 100 users by hcoin |
| `users_username_asc` | `username` | Ascending | Search users by username |
| `users_username_range` | `username` (range) | Ascending | Search users with range query |

---

## ⚠️ หมายเหตุ

1. **Index Creation Time:**
   - Index จะใช้เวลาในการสร้างขึ้นอยู่กับจำนวน documents
   - สำหรับ 600,000+++ users อาจใช้เวลา **30-60 นาที**
   - สามารถตรวจสอบสถานะได้ใน Firebase Console

2. **Query Performance:**
   - Query จะทำงานได้เร็วหลังจาก index สร้างเสร็จ
   - ถ้ายังไม่มี index query จะล้มเหลว (Firebase จะบอกว่าต้องสร้าง index)

3. **Auto-Index Creation:**
   - Firebase จะแนะนำให้สร้าง index อัตโนมัติเมื่อ query ที่ต้องการ index
   - สามารถคลิกที่ error message เพื่อสร้าง index ได้เลย

---

## 🚀 Next Steps

1. ✅ Run migration script เพื่อ migrate 600K users
2. ✅ สร้าง indexes ตามที่ระบุข้างบน
3. ✅ รอ index creation เสร็จ (30-60 นาที)
4. ✅ ทดสอบ queries เพื่อตรวจสอบว่า indexes ทำงานถูกต้อง

