# 🔐 Firebase OAuth Domain Authorization Guide

## ⚠️ Warning Message

```
Info: The current domain is not authorized for OAuth operations. 
This will prevent signInWithPopup, signInWithRedirect, linkWithPopup and linkWithRedirect from working. 
Add your domain (heng36.party) to the OAuth redirect domains list in the Firebase console -> 
Authentication -> Settings -> Authorized domains tab.
```

## 📋 สรุปปัญหา

**Warning นี้คืออะไร:**
- Firebase แจ้งเตือนว่า domain `heng36.party` ยังไม่ได้ถูกเพิ่มในรายการ Authorized domains
- มีผลกับ OAuth operations เท่านั้น (Google Sign-In, Facebook Sign-In, etc.)
- **ไม่ส่งผลกระทบต่อ Email/Password authentication** ที่ใช้อยู่ในปัจจุบัน

**สถานะปัจจุบัน:**
- ✅ โปรเจกต์ใช้ `signInWithEmailAndPassword` เท่านั้น
- ⚠️ ยังไม่ใช้ OAuth (Google, Facebook, etc.)
- ✅ **Warning นี้ไม่กระทบการทำงานของระบบในตอนนี้**

## 🛠️ วิธีแก้ไข (ถ้าต้องการใช้ OAuth ในอนาคต)

### ขั้นตอนที่ 1: เข้า Firebase Console

1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. เลือกโปรเจกต์ที่ต้องการ:
   - **HENG36**: `heng-15023`
   - **MAX56**: `max56-98e6f`
   - **JEED24**: `jeed24-3c755`

### ขั้นตอนที่ 2: เพิ่ม Authorized Domains

1. ไปที่ **Authentication** → **Settings** → **Authorized domains** tab
2. คลิก **Add domain**
3. เพิ่ม domains ต่อไปนี้:

#### สำหรับ HENG36 (`heng-15023`):
```
heng36.party
www.heng36.party
localhost
```

#### สำหรับ MAX56 (`max56-98e6f`):
```
max56.party
www.max56.party
localhost
```

#### สำหรับ JEED24 (`jeed24-3c755`):
```
jeed24.party
www.jeed24.party
localhost
```

### ขั้นตอนที่ 3: ตรวจสอบ OAuth Providers

1. ไปที่ **Authentication** → **Sign-in method**
2. เปิดใช้งาน OAuth providers ที่ต้องการ:
   - Google
   - Facebook
   - Twitter
   - etc.

3. ตั้งค่า OAuth credentials:
   - Google: ต้องมี Client ID และ Client Secret
   - Facebook: ต้องมี App ID และ App Secret
   - etc.

### ขั้นตอนที่ 4: ตั้งค่า OAuth Redirect URIs

#### Google OAuth:
```
https://heng36.party/__/auth/handler
https://max56.party/__/auth/handler
https://jeed24.party/__/auth/handler
```

#### Facebook OAuth:
```
https://heng36.party/__/auth/handler
https://max56.party/__/auth/handler
https://jeed24.party/__/auth/handler
```

## 📝 Domain ที่ต้องเพิ่มในแต่ละ Firebase Project

### HENG36 Project (`heng-15023`):
- `heng36.party`
- `www.heng36.party`
- `localhost` (สำหรับ development)

### MAX56 Project (`max56-98e6f`):
- `max56.party`
- `www.max56.party`
- `localhost` (สำหรับ development)

### JEED24 Project (`jeed24-3c755`):
- `jeed24.party`
- `www.jeed24.party`
- `localhost` (สำหรับ development)

## ✅ ตรวจสอบว่า Domain ถูกเพิ่มแล้ว

1. ไปที่ Firebase Console → Authentication → Settings → Authorized domains
2. ตรวจสอบว่า domain ปรากฏในรายการ
3. Domain ที่ Firebase เพิ่มให้อัตโนมัติ:
   - `<project-id>.firebaseapp.com`
   - `<project-id>.web.app`

## 🔍 สรุป

### ตอนนี้ (ไม่ต้องแก้ไข):
- ✅ Warning นี้ไม่กระทบการทำงาน
- ✅ Email/Password authentication ทำงานปกติ
- ✅ ไม่ได้ใช้ OAuth ในตอนนี้

### ในอนาคต (ถ้าต้องการใช้ OAuth):
1. เพิ่ม domains ใน Firebase Console
2. เปิดใช้งาน OAuth providers
3. ตั้งค่า OAuth credentials
4. เพิ่ม OAuth redirect URIs

## 📚 Resources

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Authorized Domains](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [OAuth Configuration](https://firebase.google.com/docs/auth/web/federated-auth)

## 🎯 Quick Links

- **HENG36 Firebase Console**: https://console.firebase.google.com/project/heng-15023/authentication/settings
- **MAX56 Firebase Console**: https://console.firebase.google.com/project/max56-98e6f/authentication/settings
- **JEED24 Firebase Console**: https://console.firebase.google.com/project/jeed24-3c755/authentication/settings

