# 🎨 JEED24 Theme Setup

## ✅ Connection String

```
postgresql://postgres.pyrtleftkrjxvwlbvfma:nURuKYlp6XPCeO6q@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

## 📋 Setup Instructions

### 1. Add to `.env` file

เพิ่มใน `backend/.env`:

```env
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:nURuKYlp6XPCeO6q@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### 2. Test Connection

```bash
cd backend
node scripts/test-cloud-connection-fixed.js
```

### 3. Run Migrations

```bash
cd backend
node scripts/migrate-from-firebase.js jeed24
```

## 🔧 Configuration

- **Region**: ap-northeast-1 (Tokyo)
- **Pooler**: Session Pooler (port 5432)
- **Schema**: public (multiple projects setup)

## ✅ Status

- ✅ Backend: รองรับ JEED24 แล้ว
- ✅ Database Config: รองรับแล้ว
- ⏳ Connection: ต้องทดสอบ
- ⏳ Migrations: ต้องรัน

---

**Last Updated**: After adding JEED24 connection string

