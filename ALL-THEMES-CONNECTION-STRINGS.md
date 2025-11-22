# 🔗 All Themes Connection Strings

## 📋 Connection Strings สำหรับทั้ง 3 Themes

### HENG36
```
postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

### MAX56
```
postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

### JEED24
```
postgresql://postgres.pyrtleftkrjxvwlbvfma:nURuKYlp6XPCeO6q@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

## 📝 Setup `.env` File

สร้างไฟล์ `backend/.env`:

```env
# HENG36
DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# MAX56
DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# JEED24
DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:nURuKYlp6XPCeO6q@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres

# Optional: Database Pool Settings
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000
```

## 🧪 Test Connection

```bash
cd backend
node scripts/test-cloud-connection-fixed.js
```

## 📊 Regions

- **HENG36**: ap-south-1 (Mumbai, India)
- **MAX56**: ap-southeast-1 (Singapore)
- **JEED24**: ap-northeast-1 (Tokyo, Japan)

## ✅ Status

- ✅ HENG36: Connected
- ✅ MAX56: Connected
- ⏳ JEED24: Pending connection test

---

**Last Updated**: After adding JEED24

