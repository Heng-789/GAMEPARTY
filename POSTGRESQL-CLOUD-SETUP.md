# ☁️ PostgreSQL Cloud Setup Guide

คู่มือการตั้งค่า PostgreSQL บน Cloud และข้อมูลที่ต้องใช้เพื่อเชื่อมต่อ

---

## 📋 ข้อมูลที่ต้องใช้เพื่อเชื่อมต่อ PostgreSQL

### Connection Parameters

```env
DB_HOST=your-db-host.cloud-provider.com
DB_PORT=5432
DB_NAME=heng36game
DB_USER=your_username
DB_PASSWORD=your_secure_password
DB_SSL=true
DB_SSL_MODE=require
```

### Connection String Format

```
postgresql://username:password@host:port/database?sslmode=require
```

---

## ☁️ Cloud Providers ที่แนะนำ

### 1. **Supabase** (แนะนำสำหรับเริ่มต้น) ⭐
- ✅ Free tier ดี
- ✅ Setup ง่าย
- ✅ มี dashboard
- ✅ Auto-scaling

### 2. **Neon** (Serverless PostgreSQL)
- ✅ Serverless (ปิดได้เมื่อไม่ใช้)
- ✅ Free tier
- ✅ Branching (เหมือน Git)

### 3. **AWS RDS PostgreSQL**
- ✅ Enterprise-grade
- ✅ High availability
- ⚠️ ต้องมี AWS account

### 4. **Google Cloud SQL**
- ✅ Integrated with GCP
- ✅ Auto backups
- ⚠️ ต้องมี GCP account

### 5. **Azure Database for PostgreSQL**
- ✅ Integrated with Azure
- ✅ Flexible pricing
- ⚠️ ต้องมี Azure account

### 6. **DigitalOcean Managed Databases**
- ✅ Simple pricing
- ✅ Good performance
- ✅ Easy setup

### 7. **Railway**
- ✅ Simple deployment
- ✅ Free tier
- ✅ Auto-scaling

---

## 🚀 Setup Guides

### Option 1: Supabase (แนะนำ)

#### Step 1: สร้าง Project
1. ไปที่ https://supabase.com
2. สร้าง account (free)
3. สร้าง project ใหม่
4. เลือก region (แนะนำ: Southeast Asia)

#### Step 2: รับ Connection Info
1. ไปที่ **Settings** → **Database**
2. คัดลอกข้อมูลต่อไปนี้:

```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-project-password
DB_SSL=true
DB_SSL_MODE=require
```

#### Step 3: Run Migrations
```bash
# ใช้ connection string จาก Supabase
psql "postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres" -f migrations/001_create_tables.sql
```

#### Step 4: Update Backend .env
```env
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-project-password
DB_SSL=true
```

**Free Tier:**
- 500 MB database
- 2 GB bandwidth/month
- Unlimited API requests

---

### Option 2: Neon (Serverless)

#### Step 1: สร้าง Project
1. ไปที่ https://neon.tech
2. สร้าง account (free)
3. สร้าง project ใหม่
4. เลือก region (แนะนำ: Singapore)

#### Step 2: รับ Connection Info
1. ไปที่ **Dashboard** → **Connection Details**
2. คัดลอกข้อมูล:

```env
DB_HOST=ep-xxxxx.us-east-2.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASSWORD=your-password
DB_SSL=true
DB_SSL_MODE=require
```

#### Step 3: Run Migrations
```bash
psql "postgresql://neondb_owner:[PASSWORD]@ep-xxxxx.us-east-2.aws.neon.tech:5432/neondb?sslmode=require" -f migrations/001_create_tables.sql
```

**Free Tier:**
- 0.5 GB storage
- Unlimited projects
- Auto-suspend after 5 minutes inactivity

---

### Option 3: AWS RDS PostgreSQL

#### Step 1: สร้าง RDS Instance
1. ไปที่ AWS Console → RDS
2. สร้าง database → PostgreSQL
3. เลือก:
   - **Instance class**: db.t3.micro (free tier)
   - **Storage**: 20 GB
   - **Database name**: heng36game
   - **Master username**: postgres
   - **Master password**: (ตั้งเอง)

#### Step 2: Configure Security
1. **VPC**: เลือก default VPC
2. **Public access**: Yes (ถ้าต้องการเชื่อมจากนอก AWS)
3. **Security group**: เปิด port 5432

#### Step 3: รับ Connection Info
```env
DB_HOST=heng36game.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=heng36game
DB_USER=postgres
DB_PASSWORD=your-master-password
DB_SSL=true
DB_SSL_MODE=require
```

**Free Tier:**
- 750 hours/month
- 20 GB storage
- 20 GB backup storage

---

### Option 4: Google Cloud SQL

#### Step 1: สร้าง Cloud SQL Instance
1. ไปที่ GCP Console → SQL
2. สร้าง instance → PostgreSQL
3. เลือก:
   - **Instance ID**: heng36game
   - **Password**: (ตั้งเอง)
   - **Region**: asia-southeast1 (Singapore)

#### Step 2: Configure
1. **Authorized networks**: เพิ่ม IP ของคุณ (หรือ 0.0.0.0/0 สำหรับ testing)
2. **Database flags**: ใช้ default

#### Step 3: รับ Connection Info
```env
DB_HOST=xxx.xxx.xxx.xxx (Public IP)
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password
DB_SSL=true
DB_SSL_MODE=require
```

---

### Option 5: DigitalOcean Managed Database

#### Step 1: สร้าง Database
1. ไปที่ DigitalOcean → Databases
2. สร้าง PostgreSQL database
3. เลือก:
   - **Plan**: Basic ($15/month)
   - **Region**: Singapore
   - **Database name**: heng36game

#### Step 2: รับ Connection Info
```env
DB_HOST=db-postgresql-xxxxx-do-user-xxxxx-0.db.ondigitalocean.com
DB_PORT=25060
DB_NAME=heng36game
DB_USER=doadmin
DB_PASSWORD=your-password
DB_SSL=true
DB_SSL_MODE=require
```

**Note:** DigitalOcean ใช้ port 25060 สำหรับ SSL

---

### Option 6: Railway

#### Step 1: สร้าง Database
1. ไปที่ https://railway.app
2. สร้าง project
3. Add → Database → PostgreSQL

#### Step 2: รับ Connection Info
1. ไปที่ database → **Variables**
2. คัดลอก `DATABASE_URL`:

```env
# Railway ให้ connection string มาเลย
DATABASE_URL=postgresql://postgres:password@containers-us-xxx.railway.app:5432/railway
```

#### Step 3: Parse Connection String
```env
DB_HOST=containers-us-xxx.railway.app
DB_PORT=5432
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=true
```

**Free Tier:**
- $5 credit/month
- Pay as you go

---

## 🔧 Backend Configuration

### Update `backend/.env`

```env
# Database Configuration
DB_HOST=your-cloud-host.com
DB_PORT=5432
DB_NAME=heng36game
DB_USER=your_username
DB_PASSWORD=your_secure_password

# SSL Configuration (สำคัญสำหรับ cloud)
DB_SSL=true
DB_SSL_MODE=require

# Connection Pool
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Server Configuration
PORT=3000
NODE_ENV=production
```

### Update `backend/src/config/database.js`

```javascript
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false // สำหรับ cloud providers บางตัว
  } : false,
  max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  process.exit(-1);
});

export default pool;
```

---

## 🔐 Security Best Practices

### 1. **ใช้ Environment Variables**
```env
# ❌ อย่า hardcode ใน code
DB_PASSWORD=my_password

# ✅ ใช้ environment variables
DB_PASSWORD=${DB_PASSWORD}
```

### 2. **ใช้ SSL/TLS**
```env
DB_SSL=true
DB_SSL_MODE=require
```

### 3. **Restrict IP Access**
- ตั้งค่า firewall ใน cloud provider
- อนุญาตเฉพาะ IP ที่จำเป็น

### 4. **ใช้ Strong Passwords**
- อย่างน้อย 16 characters
- รวมตัวอักษร, ตัวเลข, สัญลักษณ์

### 5. **Rotate Passwords**
- เปลี่ยน password เป็นประจำ
- ใช้ secrets management (AWS Secrets Manager, etc.)

---

## 🧪 Testing Connection

### Test from Local Machine
```bash
# ใช้ psql
psql "postgresql://username:password@host:port/database?sslmode=require"

# หรือใช้ connection string
psql $DATABASE_URL
```

### Test from Backend
```bash
cd backend
node -e "
import('./src/config/database.js').then(({ default: pool }) => {
  pool.query('SELECT NOW()').then(res => {
    console.log('✅ Connected:', res.rows[0]);
    process.exit(0);
  }).catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
});
"
```

---

## 📊 Comparison Table

| Provider | Free Tier | Setup | Performance | Best For |
|----------|-----------|-------|-------------|----------|
| **Supabase** | ✅ 500 MB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Startups, Small apps |
| **Neon** | ✅ 0.5 GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Development, Testing |
| **AWS RDS** | ✅ 750 hrs | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Enterprise, Production |
| **Google Cloud SQL** | ❌ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | GCP users |
| **Azure Database** | ❌ | ⭐⭐⭐ | ⭐⭐⭐⭐ | Azure users |
| **DigitalOcean** | ❌ $15/mo | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Simple pricing |
| **Railway** | ✅ $5 credit | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Quick setup |

---

## 🚀 Recommended Setup

### สำหรับ Development/Testing
**Neon** หรือ **Supabase** (Free tier)

### สำหรับ Production
**Supabase** (ถ้า traffic ไม่สูง) หรือ **AWS RDS** (ถ้าต้องการ enterprise features)

---

## 📝 Migration Script สำหรับ Cloud

### Update Migration Script
```bash
# ใช้ connection string จาก cloud provider
DATABASE_URL="postgresql://user:pass@host:port/db?sslmode=require" node backend/scripts/migrate-from-firebase.js heng36
```

หรือแก้ไข `backend/scripts/migrate-from-firebase.js`:
```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ใช้ connection string
  ssl: {
    rejectUnauthorized: false
  }
});
```

---

## ⚠️ Important Notes

1. **SSL Required**: Cloud providers ส่วนใหญ่ต้องการ SSL
2. **IP Whitelisting**: อาจต้อง whitelist IP ของ backend server
3. **Connection Limits**: ตรวจสอบ connection limits ของ plan
4. **Backup**: ตั้งค่า automatic backups
5. **Monitoring**: ใช้ monitoring tools ที่ cloud provider ให้มา

---

## 🆘 Troubleshooting

### Connection Timeout
- ตรวจสอบ firewall rules
- ตรวจสอบ security groups
- ตรวจสอบ IP whitelist

### SSL Error
```javascript
ssl: {
  rejectUnauthorized: false // สำหรับ cloud providers บางตัว
}
```

### Authentication Failed
- ตรวจสอบ username/password
- ตรวจสอบ database name
- ตรวจสอบ user permissions

---

พร้อมใช้งาน PostgreSQL บน Cloud แล้ว! 🚀

