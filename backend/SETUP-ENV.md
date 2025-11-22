# 🔧 Backend Environment Setup

## 📋 สร้างไฟล์ .env

สร้างไฟล์ `.env` ใน folder `backend/` โดยคัดลอกจาก template นี้:

```bash
cd backend
copy .env.example .env  # Windows
# หรือ
cp .env.example .env    # Linux/Mac
```

## 📝 เนื้อหาที่ต้องใส่ใน backend/.env

```env
# Backend Environment Variables
# PostgreSQL Database Connections

# HENG36 Database
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require

# MAX56 Database
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require

# Server Configuration
PORT=3000

# Optional: Database Pool Configuration
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

## ✅ ตรวจสอบว่า .env ถูกสร้างแล้ว

```bash
cd backend
dir .env    # Windows
# หรือ
ls -la .env # Linux/Mac
```

## 🚀 พร้อมเทส!

หลังจากสร้างไฟล์ .env แล้ว:
```bash
cd backend
npm run dev
```

ควรเห็น:
```
✅ Connected to HENG36 PostgreSQL database
✅ Connected to MAX56 PostgreSQL database
🚀 Server running on port 3000
📡 WebSocket server ready
```

