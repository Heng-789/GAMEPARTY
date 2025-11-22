# 🔐 Supabase Authentication Setup

## ✅ สรุปการเปลี่ยนแปลง

หน้า Login ถูกเปลี่ยนจาก Firebase Authentication ไปใช้ **Supabase Authentication** แล้ว

## 📁 ไฟล์ที่เปลี่ยนแปลง

### 1. `src/services/supabase-auth.ts` (ใหม่)
- สร้าง Supabase client configuration
- รองรับ multi-theme (HENG36, MAX56, JEED24)
- Export helper functions สำหรับ authentication

### 2. `src/pages/Login.tsx`
- เปลี่ยนจาก `signInWithEmailAndPassword` (Firebase) 
- ไปใช้ `signInWithPassword` (Supabase)
- Session จะถูกเก็บโดย Supabase client อัตโนมัติ

### 3. `src/App.tsx`
- `RequireAuth` component เปลี่ยนจากตรวจสอบ `localStorage.getItem('auth')`
- ไปใช้ Supabase session (`getSession()`)
- มีการ listen auth state changes แบบ real-time

### 4. Environment Files
- `env.heng36`, `env.max56`, `env.jeed24`
- เพิ่ม environment variables สำหรับ Supabase URL และ anon key

## 🔧 Configuration

### Environment Variables

#### HENG36 (`env.heng36`)
```env
VITE_SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
VITE_SUPABASE_ANON_KEY_HENG36=YOUR_ANON_KEY_HERE
```

#### MAX56 (`env.max56`)
```env
VITE_SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
VITE_SUPABASE_ANON_KEY_MAX56=YOUR_ANON_KEY_HERE
```

#### JEED24 (`env.jeed24`)
```env
VITE_SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
VITE_SUPABASE_ANON_KEY_JEED24=YOUR_ANON_KEY_HERE
```

## 📝 ขั้นตอนการ Setup

### 1. ติดตั้ง Package
```bash
npm install @supabase/supabase-js
```

### 2. ตั้งค่า Supabase Anon Keys

1. ไปที่ Supabase Dashboard:
   - HENG36: https://ipflzfxezdzbmoqglknu.supabase.co
   - MAX56: https://aunfaslgmxxdeemvtexn.supabase.co
   - JEED24: https://pyrtleftkrjxvwlbvfma.supabase.co

2. ไปที่ Settings → API
3. Copy "anon/public" key
4. ใส่ลงใน environment files (`env.heng36`, `env.max56`, `env.jeed24`)

### 3. สร้าง Users ใน Supabase

1. ไปที่ Authentication → Users
2. สร้าง user ใหม่ด้วย email/password
   - หรือใช้ Sign Up form ใน Supabase Dashboard

## 🔄 การใช้งาน

### Login Flow
1. User กรอก email/password
2. เรียก `signInWithPassword(email, password)` 
3. Supabase สร้าง session และเก็บใน localStorage อัตโนมัติ
4. Redirect ไปหน้า `/home`

### Protected Routes
- `RequireAuth` component ตรวจสอบ Supabase session
- ถ้าไม่มี session → redirect ไปหน้า `/login`
- มีการ listen auth state changes แบบ real-time

### Session Management
- Session ถูกเก็บโดย Supabase client ใน localStorage
- Auto-refresh token เมื่อใกล้หมดอายุ
- Auto-detect session จาก URL (สำหรับ email confirmation)

## 🚀 Features

### ✅ Advantages
- Session management อัตโนมัติ
- Auto token refresh
- Real-time auth state updates
- Multi-theme support
- Type-safe (TypeScript)

### 📋 Next Steps

1. **ตั้งค่า Supabase Anon Keys** ใน environment files
2. **สร้าง Users** ใน Supabase Dashboard
3. **ทดสอบ Login flow**
4. **ทดสอบ Protected Routes**

## 🔍 Debugging

### ตรวจสอบ Session
```typescript
import { getSession } from './services/supabase-auth'

const { data } = await getSession()
console.log('Session:', data.session)
```

### ตรวจสอบ User
```typescript
import { getUser } from './services/supabase-auth'

const { data } = await getUser()
console.log('User:', data.user)
```

### Sign Out
```typescript
import { signOut } from './services/supabase-auth'

await signOut()
```

## ⚠️ Important Notes

- Supabase anon keys ควรเก็บใน environment variables เท่านั้น
- อย่า commit anon keys ลง git (ใส่ใน `.gitignore`)
- Session จะถูกเก็บใน localStorage โดย Supabase client
- Auto-refresh token ทำงานอัตโนมัติ

