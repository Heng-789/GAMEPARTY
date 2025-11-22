# 📋 หน้าเกมดึงข้อมูล USER จากไหน

## ✅ สรุป

**หน้าเกม (GamePlay.tsx) ดึงข้อมูล USER จาก PostgreSQL ผ่าน Backend API**

---

## 🔍 Flow การดึงข้อมูล USER

### 1. Frontend (GamePlay.tsx)

**ไฟล์:** `src/pages/games/GamePlay.tsx`

**การใช้งาน:**
```typescript
// ✅ ใช้ PostgreSQL adapter 100%
const userData = await postgresqlAdapter.getUserData(key)
```

**จุดที่ใช้:**
- **บรรทัด 749:** ดึง user status เมื่อ username เปลี่ยน
- **บรรทัด 941:** ตรวจสอบ USER สำหรับเกมเช็คอิน (ต้องมี password)
- **บรรทัด 1067:** ตรวจสอบ USER สำหรับเกมอื่นๆ (ตรวจสอบ status)
- **บรรทัด 1127:** ตรวจสอบ USER สำหรับเกมสล็อต

---

### 2. Adapter Layer (postgresql-adapter.ts)

**ไฟล์:** `src/services/postgresql-adapter.ts`

**Function:**
```typescript
export async function getUserData(userId: string) {
  if (USE_POSTGRESQL) {
    try {
      return await postgresqlApi.getUserData(userId);
    } catch (error) {
      console.error('PostgreSQL getUserData error:', error);
      if (FALLBACK_TO_FIREBASE) {
        // Fallback to Firebase (ถ้าเปิดใช้งาน)
        const { getUserData: firebaseGetUserData } = await import('./users-firestore');
        return await firebaseGetUserData(userId, { preferFirestore: true, fallbackRTDB: true });
      }
      throw error;
    }
  } else {
    // Firebase implementation
    const { getUserData: firebaseGetUserData } = await import('./users-firestore');
    return await firebaseGetUserData(userId, { preferFirestore: true, fallbackRTDB: true });
  }
}
```

**การทำงาน:**
- เรียก `postgresqlApi.getUserData(userId)` ถ้า `USE_POSTGRESQL = true`
- Fallback ไป Firebase ถ้าเกิด error และ `FALLBACK_TO_FIREBASE = true`

---

### 3. API Service Layer (postgresql-api.ts)

**ไฟล์:** `src/services/postgresql-api.ts`

**Function:**
```typescript
export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    return await apiRequest<UserData>(`/api/users/${userId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
```

**การทำงาน:**
- เรียก API endpoint: `GET /api/users/:userId`
- Return `null` ถ้า user ไม่พบ (404)
- Throw error ถ้าเกิด error อื่นๆ

---

### 4. Backend API (users.js)

**ไฟล์:** `backend/src/routes/users.js`

**Route:**
```javascript
// Get user data
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT * FROM ${schema}.users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      userId: user.user_id,
      password: user.password,
      hcoin: Number(user.hcoin),
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**การทำงาน:**
- ดึงข้อมูลจาก PostgreSQL table: `{schema}.users`
- Query: `SELECT * FROM {schema}.users WHERE user_id = $1`
- Return user data: `userId`, `password`, `hcoin`, `status`, `createdAt`, `updatedAt`

---

## 📊 Data Structure

### User Data ที่ Return จาก Backend:

```typescript
{
  userId: string;        // user_id จาก database
  password: string;      // password จาก database
  hcoin: number;         // hcoin จาก database (converted to number)
  status: string | null; // status จาก database (ACTIVE, inactive, etc.)
  createdAt: string;     // created_at timestamp
  updatedAt: string;     // updated_at timestamp
}
```

---

## 🎯 การใช้งานในหน้าเกม

### 1. ตรวจสอบ User Status

**ใช้สำหรับ:** เกมทายภาพปริศนา, เกมทายเบอร์เงิน, เกมทายผลบอล, เกมสล็อต, เกม Trick or Treat, เกมลอยกระทง, เกม BINGO

**โค้ด:**
```typescript
const userData = await postgresqlAdapter.getUserData(key)

if (!userData) {
  // ไม่พบ USER ในระบบ
  setModal({ open: true, kind: 'info', title: '👤 ไม่พบ USER ในระบบ', ... })
  return
}

// ตรวจสอบ status
if (userData.status !== undefined && userData.status !== 'ACTIVE' && userData.status !== 'active') {
  // USER ยังไม่สามารถเข้าร่วมกิจกรรมได้
  setModal({ open: true, kind: 'info', title: 'ไม่สามารถเข้าร่วมกิจกรรม', ... })
  return
}
```

---

### 2. ตรวจสอบ Password (เกมเช็คอิน)

**ใช้สำหรับ:** เกมเช็คอิน (ต้องมี password)

**โค้ด:**
```typescript
const userData = await postgresqlAdapter.getUserData(key)

if (!userData) {
  // ไม่พบ USER ในระบบ
  return
}

const passInDb = String(userData.password ?? '')
if (password !== passInDb) {
  // รหัสผ่านไม่ถูกต้อง
  setModal({ open: true, kind: 'info', title: '❌ รหัสผ่านไม่ถูกต้อง', ... })
  return
}
```

---

### 3. ดึง User Status (แสดงใน UI)

**ใช้สำหรับ:** แสดง user status ในหน้าเกม

**โค้ด:**
```typescript
React.useEffect(() => {
  if (!username.trim()) {
    setUserStatus(null)
    return
  }

  const key = normalizeUser(username)
  const fetchUserStatus = async () => {
    try {
      const userData = await postgresqlAdapter.getUserData(key)
      if (userData) {
        setUserStatus(userData.status || null)
      } else {
        setUserStatus(null)
      }
    } catch (error) {
      console.error('Error fetching user status:', error)
      setUserStatus(null)
    }
  }

  fetchUserStatus()
}, [username])
```

---

## 📋 Checklist

- [x] หน้าเกมใช้ `postgresqlAdapter.getUserData()` 100%
- [x] ไม่มี Firebase imports ใน GamePlay.tsx
- [x] Backend API ดึงข้อมูลจาก PostgreSQL table `{schema}.users`
- [x] Return user data: `userId`, `password`, `hcoin`, `status`, `createdAt`, `updatedAt`

---

## 🎯 สรุป

**หน้าเกมดึงข้อมูล USER จาก:**
1. ✅ **PostgreSQL** ผ่าน Backend API (`GET /api/users/:userId`)
2. ✅ **Table:** `{schema}.users` (เช่น `heng36.users`, `max56.users`, `jeed24.users`)
3. ✅ **Fields:** `user_id`, `password`, `hcoin`, `status`, `created_at`, `updated_at`

**ไม่ใช้:**
- ❌ Firebase Realtime Database (RTDB)
- ❌ Firebase Firestore
- ❌ Local Storage (ใช้เฉพาะเก็บ `player_name` สำหรับ username)

---

**🎉 หน้าเกมใช้ PostgreSQL 100% สำหรับข้อมูล USER แล้ว!**

