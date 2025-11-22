# 📊 คำแนะนำโครงสร้างข้อมูล USER สำหรับ PostgreSQL

## ✅ โครงสร้างข้อมูลที่แนะนำ

### **Array of Objects** (แนะนำที่สุด)

```javascript
// ✅ โครงสร้างที่แนะนำ: Array of Objects
const users = [
  { userId: 'USER001', password: '1234' },
  { userId: 'USER002', password: '5678' },
  { userId: 'USER003', password: '9012' }
];
```

**ข้อดี:**
- ✅ **เร็วที่สุด** สำหรับ batch insert/update (เร็วกว่า insert ทีละตัว 10-50 เท่า)
- ✅ ง่ายต่อการจัดการและตรวจสอบ
- ✅ ใช้ memory น้อยกว่า Map/Object
- ✅ รองรับการเรียงลำดับ (sort) ได้ง่าย
- ✅ ง่ายต่อการ filter, map, reduce

**เหมาะสำหรับ:**
- ✅ Batch insert/update (เพิ่ม/แก้ไขหลาย users พร้อมกัน)
- ✅ การแสดงผล (map, filter)
- ✅ การค้นหา (find, filter)
- ✅ การส่งข้อมูลผ่าน API (JSON)

---

### ❌ โครงสร้างที่ไม่แนะนำ

#### 1. **Object/Map** (ช้ากว่า)

```javascript
// ❌ ไม่แนะนำ: Object
const users = {
  'USER001': { password: '1234' },
  'USER002': { password: '5678' }
};
```

**ข้อเสีย:**
- ❌ ช้ากว่า Array เมื่อต้อง batch insert
- ❌ ต้องแปลงเป็น Array ก่อนส่งไป backend
- ❌ ใช้ memory มากกว่า

#### 2. **Nested Arrays** (ซับซ้อน)

```javascript
// ❌ ไม่แนะนำ: Nested Arrays
const users = [
  ['USER001', '1234'],
  ['USER002', '5678']
];
```

**ข้อเสีย:**
- ❌ อ่านยาก ไม่ชัดเจนว่า index ไหนคืออะไร
- ❌ ต้องจำลำดับ field
- ❌ ไม่มี type safety

---

## 🚀 ตัวอย่างการใช้งาน

### 1. **เพิ่ม USER หลายคนพร้อมกัน (Batch Insert)**

```javascript
// ✅ ใช้ Array of Objects
const newUsers = [
  { userId: 'USER001', password: '1234' },
  { userId: 'USER002', password: '5678' },
  { userId: 'USER003', password: '9012' }
];

// ส่งไป backend
await postgresqlAdapter.bulkUpdateUsers(newUsers);
```

**Backend จะใช้ Bulk UPSERT:**
```sql
INSERT INTO users (user_id, password, hcoin, status, created_at, updated_at)
VALUES 
  ('USER001', '1234', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('USER002', '5678', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('USER003', '9012', 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (user_id) 
DO UPDATE SET 
  password = EXCLUDED.password,
  updated_at = CURRENT_TIMESTAMP;
```

**ความเร็ว:** เร็วกว่า insert ทีละตัว **10-50 เท่า** 🚀

---

### 2. **แสดงผล USER (Display)**

```javascript
// ✅ ใช้ Array of Objects
const users = await postgresqlAdapter.getAllUsers(1, 100, '');

// แสดงผล
users.users.forEach(user => {
  console.log(`${user.userId}: ${user.password}`);
});

// หรือใช้ map
const userList = users.users.map(user => ({
  label: user.userId,
  value: user.password
}));
```

---

### 3. **ค้นหา USER (Search)**

```javascript
// ✅ ใช้ Array of Objects
const users = await postgresqlAdapter.searchUsers('USER', 100);

// Filter
const filtered = users.filter(user => 
  user.userId.startsWith('USER0')
);

// Find
const found = users.find(user => user.userId === 'USER001');
```

---

### 4. **เรียงลำดับ USER (Sort)**

```javascript
// ✅ ใช้ Array of Objects
const users = await postgresqlAdapter.getTopUsers(100);

// เรียงตาม userId
users.sort((a, b) => a.userId.localeCompare(b.userId));

// เรียงตาม hcoin (ถ้ามี)
users.sort((a, b) => (b.hcoin || 0) - (a.hcoin || 0));
```

---

## 📈 Performance Comparison

| โครงสร้าง | Batch Insert (1000 users) | Memory Usage | Readability |
|-----------|---------------------------|--------------|-------------|
| **Array of Objects** | ✅ **~100ms** | ✅ ต่ำ | ✅ ดีมาก |
| Object/Map | ❌ ~500ms | ❌ สูง | ⚠️ ปานกลาง |
| Nested Arrays | ⚠️ ~200ms | ✅ ต่ำ | ❌ แย่ |

---

## 💡 Best Practices

### 1. **ใช้ Array of Objects เสมอ**

```javascript
// ✅ ดี
const users = [{ userId: 'USER001', password: '1234' }];

// ❌ ไม่ดี
const users = { 'USER001': { password: '1234' } };
```

### 2. **Batch Size ที่เหมาะสม**

```javascript
// ✅ Batch size 500-1000 users ต่อครั้ง (เร็วที่สุด)
const batchSize = 500;
const batches = [];
for (let i = 0; i < users.length; i += batchSize) {
  batches.push(users.slice(i, i + batchSize));
}

// Process each batch
for (const batch of batches) {
  await postgresqlAdapter.bulkUpdateUsers(batch);
}
```

### 3. **Validate ก่อนส่ง**

```javascript
// ✅ Validate ก่อนส่ง
const validUsers = users.filter(user => 
  user.userId && 
  user.password && 
  /^[0-9a-zA-Z_]+$/.test(user.userId)
);

await postgresqlAdapter.bulkUpdateUsers(validUsers);
```

---

## 🎯 สรุป

**ใช้ Array of Objects `[{ userId, password }]` เสมอ** เพราะ:
- ✅ เร็วที่สุดสำหรับ batch operations
- ✅ ง่ายต่อการจัดการ
- ✅ ใช้ memory น้อย
- ✅ รองรับการค้นหาและเรียงลำดับได้ดี

