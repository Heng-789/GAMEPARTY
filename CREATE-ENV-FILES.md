# 📝 สร้างไฟล์ .env สำหรับ Supabase Authentication

## ⚠️ ปัญหา

Vite ต้องการไฟล์ `.env.{mode}` (มี dot นำหน้า) แต่ตอนนี้มีไฟล์ `env.{mode}` (ไม่มี dot)

## ✅ วิธีแก้ไข

### วิธีที่ 1: สร้างไฟล์ `.env.{mode}` ใหม่ (แนะนำ)

สร้างไฟล์ต่อไปนี้ใน root directory ของโปรเจค:

#### `.env.heng36`
```env
# HENG36 Theme Environment
VITE_THEME=heng36
VITE_DOMAIN=heng36.party
VITE_PORT=5173

# PostgreSQL Configuration
VITE_USE_POSTGRESQL=true
VITE_API_URL=http://localhost:3000
VITE_FALLBACK_FIREBASE=false

# Supabase Authentication Configuration
VITE_SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
VITE_SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
```

#### `.env.max56`
```env
# MAX56 Theme Environment
VITE_THEME=max56
VITE_DOMAIN=max56.party
VITE_PORT=5174

# PostgreSQL Configuration
VITE_USE_POSTGRESQL=true
VITE_API_URL=http://localhost:3000
VITE_FALLBACK_FIREBASE=false

# Supabase Authentication Configuration
VITE_SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
VITE_SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
```

#### `.env.jeed24`
```env
# JEED24 Theme Environment
VITE_THEME=jeed24
VITE_DOMAIN=jeed24.party
VITE_PORT=5175

# PostgreSQL Configuration
VITE_USE_POSTGRESQL=true
VITE_API_URL=http://localhost:3000
VITE_FALLBACK_FIREBASE=false

# Supabase Authentication Configuration
VITE_SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
VITE_SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
```

### วิธีที่ 2: ใช้ Command Line (Windows PowerShell)

```powershell
# Copy จาก env.heng36
Copy-Item "env.heng36" ".env.heng36" -Force

# Copy จาก env.max56
Copy-Item "env.max56" ".env.max56" -Force

# Copy จาก env.jeed24
Copy-Item "env.jeed24" ".env.jeed24" -Force
```

### วิธีที่ 3: ใช้ Command Line (Linux/Mac)

```bash
# Copy จาก env.heng36
cp env.heng36 .env.heng36

# Copy จาก env.max56
cp env.max56 .env.max56

# Copy จาก env.jeed24
cp env.jeed24 .env.jeed24
```

## 🔄 หลังจากสร้างไฟล์

1. **Restart Dev Server:**
   ```bash
   # หยุด dev server (Ctrl+C)
   # แล้วรันใหม่
   npm run dev:heng36
   ```

2. **ตรวจสอบ Environment Variables:**
   - เปิด Browser Console
   - ตรวจสอบว่า `import.meta.env.VITE_SUPABASE_ANON_KEY_HENG36` มีค่าหรือไม่

## 📋 หมายเหตุ

- Vite จะโหลดไฟล์ `.env.{mode}` อัตโนมัติเมื่อรัน `npm run dev:{mode}`
- ไฟล์ `.env.*` ควรอยู่ใน `.gitignore` เพื่อไม่ให้ commit keys ลง git
- ถ้ายังมีปัญหา ให้ลองลบ `node_modules/.vite` และ restart dev server

