# 🚀 คู่มือการ Deploy Production บน Netlify

## 📋 สรุป

คู่มือนี้จะช่วยคุณ deploy frontend ขึ้น Netlify สำหรับ production โดยใช้คนละโดเมน (เช่น `heng36.party`, `max56.party`, `jeed24.party`)

---

## ✅ สิ่งที่ต้องเตรียม

### 1. Backend Server (Render)
- ✅ Backend ต้อง deploy ที่ Render แล้ว
- ✅ Backend URL: `https://gameparty-vuey.onrender.com` (หรือ URL ที่คุณใช้)
- ✅ Backend ต้องรองรับ CORS สำหรับ domain ใหม่

### 2. Domain Names
- ✅ เตรียม domain ที่ต้องการ (เช่น `heng36.party`, `max56.party`)
- ✅ DNS records พร้อม (A record หรือ CNAME)

### 3. Netlify Account
- ✅ สร้าง account ที่ https://app.netlify.com
- ✅ เชื่อมต่อ GitHub repository

---

## 🔧 ขั้นตอนการ Deploy

### Step 1: เชื่อมต่อ Repository กับ Netlify

1. **เข้า Netlify Dashboard**
   - ไปที่ https://app.netlify.com
   - Sign in

2. **สร้าง Site ใหม่**
   - กด "Add new site" → "Import an existing project"
   - เลือก Git provider (GitHub/GitLab/Bitbucket)
   - เลือก repository ที่มี frontend code

3. **ตั้งค่า Build Settings**
   - **Base directory:** (เว้นว่าง - root directory)
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** `18` (หรือตามที่กำหนดใน netlify.toml)

---

### Step 2: ตั้งค่า Environment Variables

ไปที่ **Site settings** → **Environment variables** และเพิ่มตัวแปรต่อไปนี้:

#### 🔴 ตัวแปรที่ต้องตั้งค่า (Required) - **10 ตัว**

##### 1. Backend API URL (1 ตัว):
```env
# Backend API URL (ใช้ URL เดียวกันสำหรับทุก theme)
VITE_API_URL=https://gameparty.onrender.com
```

##### 2. Supabase Configuration (9 ตัว - 3 themes × 3 variables):

**HENG36:**
```env
VITE_SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
VITE_SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
VITE_STORAGE_BUCKET_HENG36=game-images
```

**MAX56:**
```env
VITE_SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
VITE_SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
VITE_STORAGE_BUCKET_MAX56=game-images
```

**JEED24:**
```env
VITE_SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
VITE_SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
VITE_STORAGE_BUCKET_JEED24=game-images
```

**หมายเหตุ:** 
- ระบบจะ detect theme จาก hostname อัตโนมัติ (เช่น `heng36.party` → theme `heng36`)
- ไม่ต้องตั้งค่า `VITE_THEME` หรือ `VITE_DOMAIN` (ระบบจะ detect อัตโนมัติ)
- Environment Variables เหล่านี้ใช้สำหรับ **Supabase Authentication** และ **Image Storage**

---

### Step 3: ตั้งค่า Domain

#### 3.1 เพิ่ม Custom Domain

1. ไปที่ **Site settings** → **Domain management**
2. กด "Add custom domain"
3. ใส่ domain ที่ต้องการ (เช่น `heng36.party`)
4. Netlify จะแสดง DNS records ที่ต้องตั้งค่า

#### 3.2 ตั้งค่า DNS

**วิธีที่ 1: ใช้ Netlify DNS (แนะนำ)**
- เปลี่ยน nameservers ของ domain ไปที่ Netlify
- Netlify จะจัดการ DNS records อัตโนมัติ

**วิธีที่ 2: ใช้ DNS Provider เดิม**
- เพิ่ม A record หรือ CNAME ตามที่ Netlify แนะนำ
- รอ DNS propagation (อาจใช้เวลา 5-60 นาที)

#### 3.3 เพิ่ม Domain Aliases (ถ้ามีหลาย domain)

ถ้าต้องการให้ site เดียวรองรับหลาย domain:

1. ไปที่ **Domain management**
2. กด "Add domain alias"
3. เพิ่ม domain เพิ่มเติม (เช่น `max56.party`, `jeed24.party`)
4. ตั้งค่า DNS สำหรับแต่ละ domain

**หมายเหตุ:** 
- ระบบจะ detect theme จาก hostname อัตโนมัติ
- ไม่ต้องสร้าง site แยกสำหรับแต่ละ domain

---

### Step 4: ตั้งค่า Backend CORS

Backend ต้องรองรับ CORS สำหรับ domain ใหม่:

1. **เข้า Render Dashboard**
   - ไปที่ https://dashboard.render.com
   - เลือก backend service

2. **เพิ่ม Environment Variable**
   ```env
   FRONTEND_URL=https://heng36.party,https://max56.party,https://jeed24.party
   ```
   หรือ
   ```env
   FRONTEND_URL=*
   ```
   (ถ้าต้องการให้รองรับทุก domain - ไม่แนะนำสำหรับ production)

3. **ตรวจสอบ CORS Configuration ใน Backend**
   - ตรวจสอบว่า backend รองรับ CORS สำหรับ domain ใหม่
   - ตรวจสอบไฟล์ `backend/src/index.js` หรือ middleware ที่จัดการ CORS

---

### Step 5: ตั้งค่า Socket.io (WebSocket)

Socket.io จะใช้ URL เดียวกับ API URL:

- **API URL:** `https://gameparty-vuey.onrender.com`
- **Socket.io URL:** `wss://gameparty-vuey.onrender.com` (อัตโนมัติ)

**ไม่ต้องตั้งค่าเพิ่มเติม** - ระบบจะแปลง `https://` เป็น `wss://` อัตโนมัติ

---

### Step 6: Deploy

1. **Trigger Deploy**
   - กด "Trigger deploy" → "Deploy site"
   - หรือ push code ใหม่เพื่อ trigger auto-deploy

2. **ตรวจสอบ Build Logs**
   - ไปที่ "Deploys" tab
   - เปิด build log
   - ตรวจสอบว่า build สำเร็จ
   - ตรวจสอบว่า environment variables ถูกโหลด

3. **ตรวจสอบ Deploy**
   - ตรวจสอบว่า site deploy สำเร็จ
   - ตรวจสอบ URL ที่ Netlify ให้มา (เช่น `https://random-name-123.netlify.app`)

---

## 🔍 ตรวจสอบการ Deploy

### 1. ตรวจสอบ Environment Variables

1. ไปที่ **Site settings** → **Environment variables**
2. ตรวจสอบว่ามี `VITE_API_URL` อยู่
3. ตรวจสอบว่า Value ถูกต้อง

### 2. ตรวจสอบ Build Logs

1. ไปที่ "Deploys" tab
2. เปิด build log ล่าสุด
3. ตรวจสอบว่า environment variable ถูกโหลด:
   ```
   VITE_API_URL=https://gameparty-vuey.onrender.com
   ```

### 3. ตรวจสอบใน Browser

1. เปิด Frontend ที่ deploy แล้ว
2. เปิด Browser Console (F12)
3. ตรวจสอบ Network tab:
   - API calls ควรไปที่ `https://gameparty-vuey.onrender.com`
   - Socket.io ควรเชื่อมต่อที่ `wss://gameparty-vuey.onrender.com`
   - ควรมี `X-Theme` header ใน requests

### 4. ตรวจสอบ Theme Detection

1. เปิด Browser Console
2. ตรวจสอบว่า theme ถูก detect ถูกต้อง:
   ```javascript
   // ควรแสดง theme ที่ถูกต้องตาม domain
   console.log('Current theme:', /* theme จาก context */)
   ```

### 5. ตรวจสอบ Backend Connection

1. เปิด Browser Console → Network tab
2. ตรวจสอบ API calls:
   - ควรมี status 200 (ไม่ใช่ 404 หรือ CORS error)
   - ควรมี `X-Theme` header ใน requests

---

## 📝 สำหรับหลาย Sites (Multiple Domains)

### วิธีที่ 1: Site เดียว + Domain Aliases (แนะนำ)

**ข้อดี:**
- ✅ Deploy ครั้งเดียว
- ✅ ใช้ codebase เดียวกัน
- ✅ ง่ายต่อการ maintain

**ขั้นตอน:**
1. สร้าง site เดียวใน Netlify
2. เพิ่ม domain aliases ทั้งหมด (heng36.party, max56.party, jeed24.party)
3. ตั้งค่า `VITE_API_URL` เดียวกัน
4. ระบบจะ detect theme จาก hostname อัตโนมัติ

### วิธีที่ 2: แยก Site สำหรับแต่ละ Domain

**ข้อดี:**
- ✅ แยก environment variables ได้
- ✅ แยก deploy ได้

**ข้อเสีย:**
- ❌ ต้อง deploy หลายครั้ง
- ❌ ต้อง maintain หลาย sites

**ขั้นตอน:**
1. สร้าง site แยกสำหรับแต่ละ domain
2. ตั้งค่า environment variables แยกกัน:
   - **heng36.party site:**
     ```env
     VITE_API_URL=https://gameparty-vuey.onrender.com
     VITE_DOMAIN=heng36.party
     VITE_THEME=heng36
     ```
   - **max56.party site:**
     ```env
     VITE_API_URL=https://gameparty-vuey.onrender.com
     VITE_DOMAIN=max56.party
     VITE_THEME=max56
     ```

---

## ⚙️ Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://gameparty-vuey.onrender.com` |

### Optional Variables

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `VITE_DOMAIN` | Domain สำหรับ player links | `heng36.party` | `window.location.hostname` |
| `VITE_THEME` | Theme (ถ้าไม่ตั้งจะ detect จาก hostname) | `heng36`, `max56`, `jeed24` | Auto-detect from hostname |

---

## 🔒 Security Checklist

- [ ] ตั้งค่า `VITE_API_URL` เป็น production backend URL
- [ ] ตรวจสอบว่า backend รองรับ CORS สำหรับ domain ใหม่
- [ ] ตรวจสอบว่า backend มี rate limiting
- [ ] ตรวจสอบว่า backend มี authentication (ถ้าจำเป็น)
- [ ] ตรวจสอบว่า SSL certificate ทำงานถูกต้อง (Netlify จะจัดการอัตโนมัติ)

---

## 🐛 Troubleshooting

### Problem: Environment Variable ไม่มีผล

**Solution:**
1. ตรวจสอบว่า redeploy site หลังจากตั้งค่าแล้ว
2. ตรวจสอบว่า Key ถูกต้อง (`VITE_API_URL` ไม่ใช่ `VITE_API_URL_`)
3. ตรวจสอบ build logs ว่า environment variable ถูกโหลด

### Problem: Frontend ยังใช้ localhost:3000

**Solution:**
1. ตรวจสอบว่า `VITE_API_URL` ตั้งค่าแล้ว
2. Redeploy site
3. Clear browser cache
4. ตรวจสอบ Browser Console → Network tab

### Problem: CORS Error

**Solution:**
1. ตรวจสอบว่า backend มี `FRONTEND_URL` environment variable
2. ตรวจสอบว่า domain ใหม่อยู่ใน `FRONTEND_URL`
3. ตรวจสอบ CORS configuration ใน backend

### Problem: Socket.io ไม่เชื่อมต่อ

**Solution:**
1. ตรวจสอบว่า `VITE_API_URL` ตั้งค่าแล้ว
2. ตรวจสอบว่า backend รองรับ Socket.io
3. ตรวจสอบว่า backend URL ถูกต้อง
4. ตรวจสอบ Browser Console → Network tab → WS

### Problem: Theme ไม่ถูกต้อง

**Solution:**
1. ตรวจสอบว่า hostname ถูกต้อง (เช่น `heng36.party`)
2. ตรวจสอบ Browser Console → Application → Local Storage
3. ตรวจสอบ theme detection logic

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Backend deploy ที่ Render แล้ว
- [ ] Backend URL พร้อมใช้งาน
- [ ] Domain names พร้อม
- [ ] DNS records ตั้งค่าแล้ว

### Netlify Setup
- [ ] เชื่อมต่อ repository กับ Netlify
- [ ] ตั้งค่า build settings
- [ ] เพิ่ม `VITE_API_URL` environment variable
- [ ] เพิ่ม custom domain
- [ ] ตั้งค่า DNS

### Backend Setup
- [ ] ตั้งค่า `FRONTEND_URL` ใน backend
- [ ] ตรวจสอบ CORS configuration
- [ ] ตรวจสอบ Socket.io configuration

### Post-Deployment
- [ ] Trigger deploy
- [ ] ตรวจสอบ build logs
- [ ] ตรวจสอบ site ทำงาน
- [ ] ตรวจสอบ API connection
- [ ] ตรวจสอบ Socket.io connection
- [ ] ตรวจสอบ theme detection
- [ ] ทดสอบฟีเจอร์หลัก

---

## 📚 เอกสารเพิ่มเติม

- [NETLIFY-ENV-SETUP.md](./NETLIFY-ENV-SETUP.md) - คู่มือตั้งค่า Environment Variables
- [RENDER-DEPLOYMENT-GUIDE.md](./RENDER-DEPLOYMENT-GUIDE.md) - คู่มือ Deploy Backend ที่ Render
- [BACKEND-SERVER-TROUBLESHOOTING.md](./BACKEND-SERVER-TROUBLESHOOTING.md) - แก้ไขปัญหา Backend

---

## 🎉 เสร็จสิ้น!

หลังจาก deploy สำเร็จ:
- ✅ Frontend จะทำงานที่ domain ใหม่
- ✅ Frontend จะเชื่อมต่อกับ Backend ที่ Render
- ✅ Theme จะถูก detect อัตโนมัติจาก hostname
- ✅ Socket.io จะเชื่อมต่ออัตโนมัติ
- ✅ SSL certificate จะทำงานอัตโนมัติ (Netlify)

