# 🔗 สรุปการเชื่อมต่อ Backend กับ Frontend

## ✅ Backend Deploy สำเร็จ

**Backend URL:** https://gameparty-vuey.onrender.com

**Platform:** Render.com

**Status:** ✅ Deployed and Running

---

## 🔧 ขั้นตอนเชื่อมต่อ Frontend กับ Backend

### 1. ตั้งค่า Environment Variable ใน Netlify

1. **เข้า Netlify Dashboard**
   - ไปที่ https://app.netlify.com
   - เลือก site ที่ต้องการ (heng36.party, max56.party, หรือ jeed24)

2. **ไปที่ Site Settings**
   - กด "Site settings" → "Environment variables"

3. **เพิ่ม Environment Variable**
   - กด "Add a variable"
   - **Key:** `VITE_API_URL`
   - **Value:** `https://gameparty-vuey.onrender.com`
   - กด "Save"

4. **Redeploy Site**
   - ไปที่ "Deploys" tab
   - กด "Trigger deploy" → "Deploy site"
   - หรือ push code ใหม่เพื่อ trigger auto-deploy

---

## ✅ ตรวจสอบการเชื่อมต่อ

### 1. ตรวจสอบ Backend Health

เปิด browser ไปที่:
```
https://gameparty-vuey.onrender.com/health
```

ควรได้ response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. ตรวจสอบ Frontend

1. **เปิด Browser Console** (F12)
2. **ลองใช้งาน Frontend**
3. **ตรวจสอบ Network Tab**:
   - API calls ควรไปที่ `https://gameparty-vuey.onrender.com`
   - ควรมี `?theme=heng36` (หรือ max56, jeed24) ใน URL

### 3. ทดสอบ API กับ Theme ต่างๆ

```bash
# HENG36
curl "https://gameparty-vuey.onrender.com/api/games?theme=heng36"

# MAX56
curl "https://gameparty-vuey.onrender.com/api/games?theme=max56"

# JEED24
curl "https://gameparty-vuey.onrender.com/api/games?theme=jeed24"
```

---

## 📋 Checklist

- [x] Backend deployed ที่ Render
- [x] Backend URL: https://gameparty-vuey.onrender.com
- [ ] ตั้งค่า `VITE_API_URL` ใน Netlify
- [ ] Redeploy Frontend
- [ ] ทดสอบ Health Check
- [ ] ทดสอบ API calls จาก Frontend
- [ ] ตรวจสอบว่า theme ถูกส่งไปด้วย

---

## 🎯 Environment Variables Summary

### Backend (Render) - ✅ ตั้งค่าแล้ว
- `DATABASE_URL_HENG36`
- `DATABASE_URL_MAX56`
- `DATABASE_URL_JEED24`
- `SUPABASE_URL_*` (สำหรับแต่ละ theme)
- `SUPABASE_ANON_KEY_*` (สำหรับแต่ละ theme)
- `VITE_STORAGE_BUCKET_*` (สำหรับแต่ละ theme)

### Frontend (Netlify) - ⚠️ ต้องตั้งค่า
- `VITE_API_URL` = `https://gameparty-vuey.onrender.com`

---

## 🐛 Troubleshooting

### Frontend ไม่เชื่อมต่อ Backend

**ตรวจสอบ:**
1. `VITE_API_URL` ตั้งค่าถูกต้องหรือไม่
2. Redeploy frontend หลังจากตั้งค่า environment variable
3. ตรวจสอบ Browser Console สำหรับ error messages
4. ตรวจสอบ Network tab ว่า API calls ไปที่ URL ไหน

### Backend ไม่ตอบสนอง

**ตรวจสอบ:**
1. Backend ยังรันอยู่หรือไม่ (Render free tier อาจ sleep)
2. Health check endpoint: https://gameparty-vuey.onrender.com/health
3. ตรวจสอบ Render logs สำหรับ errors

### Theme ไม่ถูกต้อง

**ตรวจสอบ:**
1. Frontend ส่ง theme ไปด้วยหรือไม่ (`?theme=heng36`)
2. Backend logs แสดง theme อะไร
3. Database connection pool ถูกต้องหรือไม่

---

## 📝 หมายเหตุ

- **Render Free Tier:** อาจมี cold start (sleep หลัง 15 นาทีไม่ใช้งาน)
- **Custom Domain:** สามารถตั้งค่า custom domain ใน Render ได้
- **SSL:** Render จัดการ SSL certificate อัตโนมัติ

---

## 🎉 เสร็จสิ้น!

หลังจากตั้งค่า `VITE_API_URL` ใน Netlify และ redeploy:
- ✅ Frontend จะเชื่อมต่อกับ Backend
- ✅ API calls จะไปที่ https://gameparty-vuey.onrender.com
- ✅ รองรับ 3 ธีม (HENG36, MAX56, JEED24)

