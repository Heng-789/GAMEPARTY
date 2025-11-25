# 🚀 ขั้นตอนการ Deploy ขึ้น Production

**วันที่อัปเดต**: 2025-01-27  
**สถานะ**: ✅ **พร้อม Deploy**

---

## 📋 สรุป

โปรเจคนี้มี:
- **Backend**: 1 service (GAMEPARTY) ที่ Render - รองรับ 3 themes
- **Frontend**: 3 domains ที่ Netlify - `heng36.party`, `max56.party`, `jeed24.party`

---

## 🎯 ขั้นตอนการ Deploy (ลำดับความสำคัญ)

### Phase 1: Deploy Backend (Render) ⚠️ **ทำก่อน Frontend**

#### 1.1 เตรียม Code
```bash
# ตรวจสอบว่า code อยู่ใน GitHub
git status
git add .
git commit -m "Ready for production deployment"
git push origin main
```

#### 1.2 สร้าง Web Service ที่ Render

1. **เข้า Render Dashboard**
   - ไปที่ https://dashboard.render.com
   - Sign in

2. **สร้าง Web Service**
   - กด "New +" → "Web Service"
   - เชื่อมต่อ GitHub repository
   - เลือก repository ที่มี backend code

3. **ตั้งค่า Web Service**
   ```
   Name: GAMEPARTY
   Region: Singapore (หรือใกล้ที่สุด)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

#### 1.3 ตั้งค่า Environment Variables (14 ตัว)

ไปที่ **Environment** tab และเพิ่ม:

**Database Connections (3 ตัว):**
```env
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

**Supabase Storage (9 ตัว):**
```env
# HENG36
SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET_HENG36=game-images

# MAX56
SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
VITE_STORAGE_BUCKET_MAX56=game-images

# JEED24
SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
VITE_STORAGE_BUCKET_JEED24=game-images
```

**Server Configuration (2 ตัว):**
```env
FRONTEND_URL=https://heng36.party,https://max56.party,https://jeed24.party
NODE_ENV=production
```

#### 1.4 Deploy และตรวจสอบ

1. **Deploy**
   - กด "Manual Deploy" → "Deploy latest commit"
   - รอ build เสร็จ (ประมาณ 2-5 นาที)

2. **ตรวจสอบ Health Check**
   - เปิด: `https://gameparty.onrender.com/health`
   - ควรเห็น: `{"status":"ok"}`
   - ตรวจสอบ Logs ใน Render Dashboard

3. **บันทึก Backend URL**
   - Backend URL: `https://gameparty.onrender.com` (หรือ URL ที่ Render ให้มา)
   - ใช้ URL นี้สำหรับ Frontend Environment Variable

---

### Phase 2: Deploy Frontend (Netlify) 🎨

#### 2.1 สร้าง Site ที่ Netlify

**วิธีที่ 1: ใช้ Site เดียว + Domain Aliases (แนะนำ) ✅**

ระบบ detect theme จาก hostname อัตโนมัติ ดังนั้นสามารถ build ตัวเดียวได้!

1. **สร้าง Site เดียว**
   - ไปที่ https://app.netlify.com
   - กด "Add new site" → "Import an existing project"
   - เลือก GitHub repository
   - ตั้งค่า:
     ```
     Site name: gameparty-frontend (หรือชื่อที่ต้องการ)
     Build command: npm run build
     Publish directory: dist
     Base directory: (เว้นว่าง)
     ```

2. **ตั้งค่า Domain Aliases**
   - ไปที่ **Site settings** → **Domain management**
   - เพิ่ม Custom Domain: `heng36.party`
   - กด "Add domain alias" → เพิ่ม: `max56.party`
   - กด "Add domain alias" → เพิ่ม: `jeed24.party`
   - ตั้งค่า DNS สำหรับแต่ละ domain

**ข้อดี:**
- ✅ Build ครั้งเดียว ใช้ได้กับทุก domain
- ✅ Deploy ง่าย (1 site แทน 3 sites)
- ✅ Environment Variables ตั้งค่าครั้งเดียว

**วิธีที่ 2: สร้าง 3 Sites แยกกัน (ถ้าต้องการแยก)**

1. **Site 1: HENG36**
   - Build command: `npm run build:heng`
   - Domain: `heng36.party`

2. **Site 2: MAX56**
   - Build command: `npm run build:max`
   - Domain: `max56.party`

3. **Site 3: JEED24**
   - Build command: `npm run build:jeed`
   - Domain: `jeed24.party`

**หมายเหตุ:** วิธีที่ 1 แนะนำเพราะง่ายกว่าและ build ครั้งเดียว

#### 2.2 ตั้งค่า Environment Variables (10 ตัว)

**สำหรับ Site เดียว (วิธีที่ 1):**
- ไปที่ **Site settings** → **Environment variables**
- ตั้งค่า Environment Variables ทั้งหมด (10 ตัว) ครั้งเดียว

**สำหรับ 3 Sites แยกกัน (วิธีที่ 2):**
- สำหรับ **แต่ละ Site** ไปที่ **Site settings** → **Environment variables**:

**Backend API URL (1 ตัว):**
```env
VITE_API_URL=https://gameparty.onrender.com
```
*(ใช้ URL จาก Phase 1.4)*

**Supabase Configuration (9 ตัว):**

**สำหรับ Site HENG36:**
```env
VITE_SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
VITE_SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET_HENG36=game-images
VITE_SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
VITE_SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
VITE_STORAGE_BUCKET_MAX56=game-images
VITE_SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
VITE_SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
VITE_STORAGE_BUCKET_JEED24=game-images
```

**หมายเหตุ:** 
- ตั้งค่า **เหมือนกันทั้ง 3 Sites** (เพราะระบบจะ detect theme จาก hostname อัตโนมัติ)
- หรือตั้งค่าเฉพาะ theme ของตัวเอง (ถ้าต้องการแยก)

#### 2.3 ตั้งค่า Domain

สำหรับ **แต่ละ Site**:

1. **เพิ่ม Custom Domain**
   - ไปที่ **Site settings** → **Domain management**
   - กด "Add custom domain"
   - ใส่ domain:
     - Site HENG36: `heng36.party`
     - Site MAX56: `max56.party`
     - Site JEED24: `jeed24.party`

2. **ตั้งค่า DNS**
   
   **วิธีที่ 1: ใช้ Netlify DNS (แนะนำ)**
   - เปลี่ยน nameservers ของ domain ไปที่ Netlify
   - Netlify จะจัดการ DNS records อัตโนมัติ
   
   **วิธีที่ 2: ใช้ DNS Provider เดิม**
   - เพิ่ม A record หรือ CNAME ตามที่ Netlify แนะนำ
   - รอ DNS propagation (5-60 นาที)

#### 2.4 Deploy และตรวจสอบ

**หมายเหตุ:** Netlify จะ **auto-deploy** เมื่อคุณ push code ขึ้น GitHub อัตโนมัติ (ไม่ต้องตั้งค่าเพิ่มเติม)

1. **Trigger Deploy (ถ้าต้องการ deploy manual)**
   - ไปที่ Netlify Dashboard → เลือก Site
   - กด "Deploys" tab
   - กด "Trigger deploy" → "Deploy site"
   - เลือก branch (เช่น `main`) → กด "Deploy"
   - **หรือ** push code ใหม่เพื่อ trigger auto-deploy (แนะนำ)

2. **ตรวจสอบ Build Logs**
   - ไปที่ "Deploys" tab
   - เปิด build log
   - ตรวจสอบว่า build สำเร็จ
   - ตรวจสอบว่า environment variables ถูกโหลด

3. **ตรวจสอบ Deploy**
   - เปิด Browser Console ที่ domain (เช่น `https://heng36.party`)
   - ตรวจสอบ:
     - ✅ ไม่มี CORS errors
     - ✅ API calls ไปที่ `https://gameparty.onrender.com`
     - ✅ Socket.io เชื่อมต่อสำเร็จ
     - ✅ Theme detect ถูกต้อง

---

## ✅ Post-Deployment Checklist

### Backend (Render)
- [ ] Health check: `https://gameparty.onrender.com/health` → `{"status":"ok"}`
- [ ] API endpoints: `/api/games`, `/api/users` ทำงาน
- [ ] Socket.io connection ทำงาน
- [ ] Database queries ทำงาน
- [ ] CORS ไม่มี errors
- [ ] Logs ไม่มี errors

### Frontend (Netlify)
- [ ] Login/Logout ทำงาน
- [ ] Game List แสดงได้
- [ ] Create Game ทำงาน
- [ ] Play Game ทำงาน
- [ ] Submit Answer ทำงาน
- [ ] Real-time updates (Socket.io) ทำงาน
- [ ] ไม่มี CORS errors
- [ ] Theme detect ถูกต้อง (heng36.party → heng36)

---

## 🔧 Troubleshooting

### Backend Issues

**Problem: Health check ไม่ทำงาน**
- ตรวจสอบ Logs ใน Render Dashboard
- ตรวจสอบว่า Environment Variables ตั้งค่าถูกต้อง
- ตรวจสอบว่า Database connection strings ถูกต้อง

**Problem: CORS errors**
- ตรวจสอบว่า `FRONTEND_URL` ตั้งค่าถูกต้อง
- ตรวจสอบว่า domain ใน `FRONTEND_URL` ตรงกับ domain ที่ใช้จริง

### Frontend Issues

**Problem: Build fails**
- ตรวจสอบ Build Logs ใน Netlify
- ตรวจสอบว่า Environment Variables ตั้งค่าถูกต้อง
- ตรวจสอบว่า Build command ถูกต้อง (`build:heng`, `build:max`, `build:jeed`)

**Problem: API calls fail**
- ตรวจสอบว่า `VITE_API_URL` ตั้งค่าถูกต้อง
- ตรวจสอบว่า Backend deploy สำเร็จแล้ว
- ตรวจสอบ Browser Console สำหรับ errors

**Problem: Theme ไม่ถูกต้อง**
- ตรวจสอบว่า hostname ถูกต้อง (heng36.party, max56.party, jeed24.party)
- ตรวจสอบว่า theme detection logic ทำงาน

---

## 📚 เอกสารเพิ่มเติม

- **Backend Deployment**: ดู `RENDER-DEPLOYMENT-GUIDE.md`
- **Frontend Deployment**: ดู `NETLIFY-PRODUCTION-DEPLOYMENT.md`
- **Pre-Deployment Checklist**: ดู `PRE-DEPLOYMENT-CHECKLIST.md`
- **Deployment Readiness**: ดู `DEPLOYMENT-READINESS-REPORT.md`

---

## 🎯 สรุป

### ขั้นตอนหลัก:
1. ✅ **Deploy Backend ที่ Render** (14 environment variables)
2. ✅ **Deploy Frontend ที่ Netlify** (3 sites, 10 environment variables ต่อ site)
3. ✅ **ตั้งค่า Domain** (heng36.party, max56.party, jeed24.party)
4. ✅ **ทดสอบหลัง Deploy**

### เวลาที่ใช้:
- Backend: ~10-15 นาที
- Frontend: ~15-20 นาที (3 sites)
- DNS Propagation: 5-60 นาที
- **รวม: ~30-60 นาที**

---

**Status**: ✅ **READY FOR DEPLOYMENT**

