# 🔧 คู่มือตั้งค่า VITE_API_URL ใน Netlify

## ✅ Environment Variable ที่ต้องตั้งค่า

```
VITE_API_URL = https://gameparty-vuey.onrender.com
```

---

## 📋 ขั้นตอนการตั้งค่า

### วิธีที่ 1: ผ่าน Netlify Dashboard (แนะนำ)

1. **เข้า Netlify Dashboard**
   - ไปที่ https://app.netlify.com
   - Sign in ด้วย account ของคุณ

2. **เลือก Site**
   - เลือก site ที่ต้องการ (heng36.party, max56.party, หรือ jeed24)
   - หรือถ้ามีหลาย sites ต้องตั้งค่าทั้งหมด

3. **ไปที่ Site Settings**
   - กด "Site settings" (หรือ "Site configuration")
   - เลือก "Environment variables" ในเมนูด้านซ้าย

4. **เพิ่ม Environment Variable**
   - กดปุ่ม "Add a variable" หรือ "Add variable"
   - **Key:** `VITE_API_URL`
   - **Value:** `https://gameparty-vuey.onrender.com`
   - **Scopes:** เลือก "All scopes" (หรือเฉพาะ "Production" และ "Deploy previews" ตามต้องการ)
   - กด "Save"

5. **Redeploy Site**
   - ไปที่ "Deploys" tab
   - กด "Trigger deploy" → "Deploy site"
   - หรือ push code ใหม่เพื่อ trigger auto-deploy

---

### วิธีที่ 2: ผ่าน Netlify CLI

1. **ติดตั้ง Netlify CLI** (ถ้ายังไม่มี)
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**
   ```bash
   netlify login
   ```

3. **Link Site** (ถ้ายังไม่ได้ link)
   ```bash
   netlify link
   ```

4. **ตั้งค่า Environment Variable**
   ```bash
   netlify env:set VITE_API_URL "https://gameparty-vuey.onrender.com"
   ```

5. **Redeploy**
   ```bash
   netlify deploy --prod
   ```

---

## 🔍 ตรวจสอบการตั้งค่า

### 1. ตรวจสอบใน Dashboard

1. ไปที่ Site settings → Environment variables
2. ตรวจสอบว่ามี `VITE_API_URL` อยู่
3. ตรวจสอบว่า Value ถูกต้อง: `https://gameparty-vuey.onrender.com`

### 2. ตรวจสอบใน Build Logs

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
   - ควรมี `?theme=heng36` (หรือ max56, jeed24) ใน URL

---

## 📝 สำหรับหลาย Sites

ถ้ามีหลาย sites (heng36.party, max56.party, jeed24.party):

**ต้องตั้งค่า `VITE_API_URL` ในทุก site:**

1. **heng36.party**
   - `VITE_API_URL` = `https://gameparty-vuey.onrender.com`

2. **max56.party**
   - `VITE_API_URL` = `https://gameparty-vuey.onrender.com`

3. **jeed24.party** (ถ้ามี)
   - `VITE_API_URL` = `https://gameparty-vuey.onrender.com`

---

## ⚠️ หมายเหตุสำคัญ

1. **ต้อง Redeploy** หลังจากตั้งค่า environment variable
   - Environment variables จะมีผลเมื่อ build ใหม่เท่านั้น
   - ไม่มีผลกับ build ที่มีอยู่แล้ว

2. **Scopes**
   - **All scopes:** ใช้ได้ทั้ง Production, Deploy previews, Branch deploys
   - **Production only:** ใช้ได้เฉพาะ Production
   - แนะนำ: เลือก "All scopes"

3. **Case Sensitive**
   - Key ต้องเป็น `VITE_API_URL` (ตัวพิมพ์ใหญ่)
   - Value ต้องเป็น `https://gameparty-vuey.onrender.com` (ไม่มี trailing slash)

---

## 🐛 Troubleshooting

### Environment Variable ไม่มีผล

**ตรวจสอบ:**
1. Redeploy site หลังจากตั้งค่าแล้วหรือยัง
2. Key ถูกต้องหรือไม่ (`VITE_API_URL` ไม่ใช่ `VITE_API_URL_` หรืออื่นๆ)
3. Value ถูกต้องหรือไม่ (ไม่มี space หรือ typo)
4. ตรวจสอบ build logs ว่า environment variable ถูกโหลด

### Frontend ยังใช้ localhost:3000

**ตรวจสอบ:**
1. Environment variable ตั้งค่าแล้วหรือยัง
2. Redeploy site แล้วหรือยัง
3. ตรวจสอบ Browser Console → Network tab ว่า API calls ไปที่ URL ไหน

### API Calls 404 หรือ Error

**ตรวจสอบ:**
1. Backend URL ถูกต้องหรือไม่: `https://gameparty-vuey.onrender.com`
2. Backend ยังรันอยู่หรือไม่ (Render free tier อาจ sleep)
3. Health check: `https://gameparty-vuey.onrender.com/health`

---

## ✅ Checklist

- [ ] เข้า Netlify Dashboard
- [ ] เลือก site ที่ต้องการ
- [ ] ไปที่ Site settings → Environment variables
- [ ] เพิ่ม `VITE_API_URL` = `https://gameparty-vuey.onrender.com`
- [ ] ตั้งค่า Scopes (แนะนำ: All scopes)
- [ ] Save
- [ ] Redeploy site
- [ ] ตรวจสอบ build logs
- [ ] ทดสอบ Frontend เชื่อมต่อ Backend
- [ ] ตรวจสอบ Browser Console → Network tab

---

## 🎉 เสร็จสิ้น!

หลังจากตั้งค่าและ redeploy:
- ✅ Frontend จะเชื่อมต่อกับ Backend ที่ `https://gameparty-vuey.onrender.com`
- ✅ API calls จะไปที่ production backend
- ✅ รองรับ 3 ธีม (HENG36, MAX56, JEED24)

