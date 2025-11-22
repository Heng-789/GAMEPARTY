# 🔐 Supabase Authentication Setup Guide

## ⚠️ ปัญหาที่พบ

### 1. Invalid login credentials
```
AuthApiError: Invalid login credentials
```

**สาเหตุ:**
- ยังไม่มี user ใน Supabase Authentication
- Email/password ที่ใช้ไม่ถูกต้อง
- Supabase Auth ยังไม่ได้ตั้งค่า

## 🚀 วิธีแก้ไข

### Step 1: สร้าง User ใน Supabase Dashboard

1. ไปที่ Supabase Dashboard: https://supabase.com/dashboard
2. เลือก Project ที่ต้องการ (HENG36, MAX56, หรือ JEED24)
3. ไปที่ **Authentication** > **Users**
4. คลิก **Add user** > **Create new user**
5. ใส่:
   - **Email**: เช่น `admin@example.com`
   - **Password**: รหัสผ่านที่ต้องการ
   - **Auto Confirm User**: ✅ (เพื่อไม่ต้องยืนยันอีเมล)

### Step 2: ตรวจสอบ Supabase Auth Settings

1. ไปที่ **Authentication** > **Settings**
2. ตรวจสอบว่า:
   - **Enable Email Signup**: ✅ เปิดอยู่
   - **Enable Email Confirmations**: ⚠️ ปิดไว้ (สำหรับ development)
   - **Site URL**: ตั้งเป็น `http://localhost:5173` (หรือ port ที่ใช้)

### Step 3: ตั้งค่า Email Templates (Optional)

1. ไปที่ **Authentication** > **Email Templates**
2. ปรับแต่ง email templates ตามต้องการ

## 📝 วิธีทดสอบ

### ใช้ Supabase Dashboard
1. ไปที่ **Authentication** > **Users**
2. คลิก **Add user** > **Create new user**
3. ใส่ email และ password
4. ลอง login ในแอป

### ใช้ Supabase Client (สำหรับ Development)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// สร้าง user ใหม่
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123'
})
```

## 🔧 การตั้งค่าใน Code

### ตรวจสอบ Environment Variables

ไฟล์ `env.heng36`:
```env
VITE_SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
VITE_SUPABASE_ANON_KEY_HENG36=your-anon-key
```

### ตรวจสอบ Supabase Client

ไฟล์ `src/services/supabase-auth.ts`:
```typescript
export const signInWithPassword = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password })
}
```

## ⚠️ Troubleshooting

### 1. Invalid login credentials
- ✅ ตรวจสอบว่า user มีอยู่ใน Supabase Dashboard
- ✅ ตรวจสอบ email/password ว่าถูกต้อง
- ✅ ตรวจสอบว่า Supabase URL และ Anon Key ถูกต้อง

### 2. Email not confirmed
- ✅ ตั้งค่า **Auto Confirm User** ใน Supabase Dashboard
- ✅ หรือยืนยันอีเมลผ่าน link ที่ส่งมา

### 3. CORS Error
- ✅ ตรวจสอบว่า Site URL ใน Supabase Settings ถูกต้อง
- ✅ เพิ่ม domain ใน **Authentication** > **URL Configuration**

## 📚 Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Auth Helpers](https://supabase.com/docs/reference/javascript/auth-helpers)

