# 🚀 Deployment Ready Checklist

## ✅ สรุปสถานะก่อน Deploy

### 🎉 Migration Status: **99% Complete**

ไฟล์หลักทั้งหมดใช้ **PostgreSQL 100%** แล้ว:
- ✅ `BingoGame.tsx` - PostgreSQL 100%
- ✅ `TrickOrTreatGame.tsx` - PostgreSQL 100%
- ✅ `LoyKrathongGame.tsx` - PostgreSQL 100% (เก็บ krathongs visual effects ไว้ชั่วคราว)
- ✅ `GamesList.tsx` - PostgreSQL 100%
- ✅ `SlotGame.tsx` - PostgreSQL 100% (เก็บ stateRef ไว้ชั่วคราว)
- ✅ `realtime-presence.ts` - PostgreSQL 100% + Polling

---

## 📋 ขั้นตอนที่ต้องทำก่อน Deploy (เรียงตามลำดับความสำคัญ)

### 🔴 **ขั้นตอนที่ 1: ทดสอบ Backend Connection** (สำคัญที่สุด)

```bash
# 1. ทดสอบการเชื่อมต่อ database
cd backend
node scripts/test-connection.js

# 2. ทดสอบ API endpoints
node scripts/test-api-endpoints.js
```

**สิ่งที่ต้องตรวจสอบ:**
- [ ] Database connection สำเร็จสำหรับทุก theme (heng36, max56, jeed24)
- [ ] API endpoints ตอบสนองถูกต้อง
- [ ] Socket.io connection ทำงาน

---

### 🔴 **ขั้นตอนที่ 2: ตั้งค่า Environment Variables (Backend)**

**ใน Render Dashboard → Environment Variables:**

```env
# Database URLs
DATABASE_URL_HENG36=postgresql://...
DATABASE_URL_MAX56=postgresql://...
DATABASE_URL_JEED24=postgresql://...

# Supabase (สำหรับ Storage)
SUPABASE_URL_HENG36=https://...
SUPABASE_ANON_KEY_HENG36=...
SUPABASE_URL_MAX56=https://...
SUPABASE_ANON_KEY_MAX56=...
SUPABASE_URL_JEED24=https://...
SUPABASE_ANON_KEY_JEED24=...

# Frontend URLs (comma-separated)
FRONTEND_URL=https://heng36.example.com,https://max56.example.com,https://jeed24.example.com

# Server
NODE_ENV=production
PORT=3000
```

**ตรวจสอบ:**
- [ ] Environment variables ครบถ้วน
- [ ] Connection strings ถูกต้อง
- [ ] FRONTEND_URL ระบุทุก domain ที่จะใช้

---

### 🔴 **ขั้นตอนที่ 3: Deploy Backend ที่ Render**

1. [ ] Push code ขึ้น GitHub
2. [ ] สร้าง Web Service ที่ Render
3. [ ] ตั้งค่า Environment Variables (จากขั้นตอนที่ 2)
4. [ ] Deploy และรอให้สำเร็จ
5. [ ] ตรวจสอบ logs ว่าไม่มี errors
6. [ ] ทดสอบ API endpoint: `https://your-backend.onrender.com/api/health` (ถ้ามี)

**ดูคู่มือ:** `RENDER-DEPLOYMENT-GUIDE.md`

---

### 🔴 **ขั้นตอนที่ 4: ตั้งค่า Environment Variables (Frontend)**

**ใน Netlify Dashboard → Site Settings → Environment Variables:**

สำหรับแต่ละ theme (HENG36, MAX56, JEED24):

```env
# Backend API URL
VITE_API_URL=https://your-backend.onrender.com

# Supabase (สำหรับ Auth และ Storage)
VITE_SUPABASE_URL_HENG36=https://...
VITE_SUPABASE_ANON_KEY_HENG36=...
VITE_STORAGE_BUCKET_HENG36=...

VITE_SUPABASE_URL_MAX56=https://...
VITE_SUPABASE_ANON_KEY_MAX56=...
VITE_STORAGE_BUCKET_MAX56=...

VITE_SUPABASE_URL_JEED24=https://...
VITE_SUPABASE_ANON_KEY_JEED24=...
VITE_STORAGE_BUCKET_JEED24=...
```

**ตรวจสอบ:**
- [ ] Environment variables ครบถ้วนสำหรับทุก theme
- [ ] VITE_API_URL ชี้ไปที่ backend URL ที่ถูกต้อง

---

### 🔴 **ขั้นตอนที่ 5: Deploy Frontend ที่ Netlify**

1. [ ] สร้าง Site ที่ Netlify (สำหรับแต่ละ theme หรือใช้ branch-based deployment)
2. [ ] ตั้งค่า Environment Variables (จากขั้นตอนที่ 4)
3. [ ] ตั้งค่า Build Command:
   ```bash
   # สำหรับ HENG36
   npm run build:heng
   
   # สำหรับ MAX56
   npm run build:max
   
   # สำหรับ JEED24
   npm run build:jeed
   ```
4. [ ] ตั้งค่า Publish Directory: `dist`
5. [ ] ตั้งค่า Domain Aliases (ถ้ามีหลาย domain)
6. [ ] Deploy และรอให้สำเร็จ
7. [ ] ตรวจสอบ build logs ว่าไม่มี errors

**ดูคู่มือ:** `NETLIFY-PRODUCTION-DEPLOYMENT.md`

---

### 🟡 **ขั้นตอนที่ 6: ทดสอบ Basic Features**

หลังจาก deploy แล้ว ให้ทดสอบ:

- [ ] **Login/Logout**: ทดสอบ Supabase Auth
- [ ] **Game List**: ดูรายการเกมได้
- [ ] **Create Game**: สร้างเกมใหม่ได้
- [ ] **Play Game**: เล่นเกมได้ (Puzzle, Checkin, Bingo, Slot, etc.)
- [ ] **Submit Answer**: ส่งคำตอบได้
- [ ] **Real-time Updates**: Socket.io ทำงาน (UserBar, LiveChat)
- [ ] **Upload Users**: อัพโหลด user ได้

---

### 🟡 **ขั้นตอนที่ 7: ตรวจสอบ CORS และ API Connection**

1. [ ] เปิด Browser Console
2. [ ] ตรวจสอบว่าไม่มี CORS errors
3. [ ] ตรวจสอบว่า Socket.io เชื่อมต่อสำเร็จ
4. [ ] ตรวจสอบว่า API calls ทำงานถูกต้อง

---

### 🟢 **ขั้นตอนที่ 8: ตั้งค่า Monitoring (Optional แต่แนะนำ)**

- [ ] ตั้งค่า Error Logging (Sentry, LogRocket, etc.)
- [ ] ตั้งค่า Uptime Monitoring (UptimeRobot, Pingdom, etc.)
- [ ] ตรวจสอบ Database Performance

---

## ⚠️ สิ่งที่ต้องระวัง

### 1. **Database Connection**
- ตรวจสอบว่า connection strings ถูกต้อง
- ตรวจสอบว่า SSL connection ทำงาน (สำหรับ Supabase)

### 2. **CORS Configuration**
- ตรวจสอบว่า `FRONTEND_URL` ใน backend ระบุทุก domain ที่จะใช้
- ตรวจสอบว่า CORS errors ไม่เกิดขึ้น

### 3. **Environment Variables**
- **อย่า hardcode** credentials ใน code
- ใช้ environment variables เท่านั้น
- ตรวจสอบว่า production และ development แยกกัน

### 4. **Build Commands**
- ตรวจสอบว่า build commands ถูกต้องสำหรับแต่ละ theme
- ตรวจสอบว่า build สำเร็จโดยไม่มี errors

---

## 🎯 Quick Start Guide

### สำหรับ Backend:
```bash
# 1. ทดสอบ connection
cd backend
node scripts/test-connection.js

# 2. Push ขึ้น GitHub
git add .
git commit -m "Ready for production deployment"
git push origin main

# 3. Deploy ที่ Render (ดู RENDER-DEPLOYMENT-GUIDE.md)
```

### สำหรับ Frontend:
```bash
# 1. Build ทดสอบ
npm run build:heng  # หรือ build:max, build:jeed

# 2. ตรวจสอบว่า build สำเร็จ
ls -la dist/

# 3. Deploy ที่ Netlify (ดู NETLIFY-PRODUCTION-DEPLOYMENT.md)
```

---

## ✅ Final Checklist ก่อนกด Deploy

- [ ] Backend environment variables ครบถ้วน
- [ ] Frontend environment variables ครบถ้วน
- [ ] Database connections ทดสอบผ่าน
- [ ] Backend deploy สำเร็จ
- [ ] Frontend build สำเร็จ
- [ ] CORS configuration ถูกต้อง
- [ ] Basic testing ผ่าน (login, create game, play game)

---

## 🆘 ถ้ามีปัญหา

1. **ตรวจสอบ Logs**:
   - Render: Dashboard → Logs
   - Netlify: Site → Deploys → View logs

2. **ตรวจสอบ Environment Variables**:
   - ตรวจสอบว่าครบถ้วนและถูกต้อง

3. **ตรวจสอบ Database**:
   - ทดสอบ connection อีกครั้ง
   - ตรวจสอบว่า schema ถูกสร้างแล้ว

4. **ดูคู่มือ**:
   - `RENDER-DEPLOYMENT-GUIDE.md`
   - `NETLIFY-PRODUCTION-DEPLOYMENT.md`
   - `BACKEND-SERVER-TROUBLESHOOTING.md`

---

**Status**: ✅ **Ready for Deployment**

**Last Updated**: 2025-01-27

