# 🎯 คู่มือการตั้งชื่อและจัดการ Cloudflare Workers สำหรับ Multi-Theme

## 📋 ภาพรวม

โปรเจคนี้มี **3 themes**: heng36, max56, jeed24
แต่ละ theme มี:
- Supabase project แยกกัน
- CDN domain แยกกัน (`img.heng36.party`, `img.max56.party`, `img.jeed24.party`)

---

## 🎯 ตัวเลือกการตั้งค่า Workers

### ตัวเลือก 1: Worker เดียวที่รองรับหลาย Theme (แนะนำ) ⭐

**ชื่อ Worker:** `supabase-storage-cdn-multi-theme`

**ข้อดี:**
- ✅ Maintain ง่าย (code เดียว)
- ✅ Deploy ครั้งเดียว
- ✅ Update ครั้งเดียวใช้ได้ทุก theme
- ✅ ใช้ Worker quota ร่วมกัน

**ข้อเสีย:**
- ⚠️ ถ้า Worker มีปัญหา กระทบทุก theme
- ⚠️ Config ซับซ้อนกว่าเล็กน้อย

**เหมาะกับ:**
- โปรเจคที่ต้องการ maintain ง่าย
- Themes ที่มี logic เหมือนกัน

---

### ตัวเลือก 2: Worker แยกตาม Theme

**ชื่อ Workers:**
- `supabase-storage-cdn-heng36`
- `supabase-storage-cdn-max56`
- `supabase-storage-cdn-jeed24`

**ข้อดี:**
- ✅ แยก deploy ได้
- ✅ Config ชัดเจน
- ✅ ถ้า theme หนึ่งมีปัญหา ไม่กระทบ theme อื่น
- ✅ ง่ายต่อการ debug

**ข้อเสีย:**
- ⚠️ ต้อง maintain 3 Workers
- ⚠️ Update ต้องทำ 3 ครั้ง
- ⚠️ ใช้ Worker quota แยกกัน

**เหมาะกับ:**
- โปรเจคที่ต้องการแยก theme ชัดเจน
- Themes ที่อาจมี logic ต่างกันในอนาคต

---

## 🏆 คำแนะนำ: **ตัวเลือก 1 (Worker เดียว)**

### เหตุผล:
1. **Maintain ง่าย** - Code เดียว update ครั้งเดียว
2. **Logic เหมือนกัน** - ทุก theme ทำงานเหมือนกัน
3. **ประหยัด Quota** - ใช้ Worker quota ร่วมกัน
4. **Config อยู่ที่เดียว** - แก้ไขง่าย

---

## 📝 วิธีตั้งค่า: ตัวเลือก 1 (Worker เดียว)

### 1. สร้าง Worker

**ชื่อ:** `supabase-storage-cdn-multi-theme`

### 2. ใช้ Code จาก `cloudflare-worker-advanced.js`

Code นี้รองรับหลาย theme อัตโนมัติ:

```javascript
const CONFIG = {
  SUPABASE_PROJECTS: {
    heng36: 'ipflzfxezdzbmoqglknu',
    max56: 'aunfaslgmxxdeemvtexn',
    jeed24: 'pyrtleftkrjxvwlbvfma',
  },
  BUCKET_NAME: 'game-images',
  CDN_DOMAINS: {
    heng36: 'img.heng36.party',
    max56: 'img.max56.party',
    jeed24: 'img.jeed24.party',
  },
  DEFAULT_THEME: 'heng36',
};
```

### 3. ตั้งค่า Routes (3 routes)

1. `img.heng36.party/game-images/*`
2. `img.max56.party/game-images/*`
3. `img.jeed24.party/game-images/*`

**วิธีตั้งค่า:**
- ไปที่ Worker → **Triggers** → **Routes**
- คลิก **Add route** 3 ครั้ง
- ตั้งค่าแต่ละ route ตามด้านบน

---

## 📝 วิธีตั้งค่า: ตัวเลือก 2 (Worker แยก)

### 1. สร้าง Workers 3 ตัว

#### Worker 1: `supabase-storage-cdn-heng36`
- **Code**: ใช้จาก `cloudflare-worker-supabase-cdn.js`
- **Config**:
  ```javascript
  const SUPABASE_PROJECT_REF = 'ipflzfxezdzbmoqglknu';
  const CDN_DOMAIN = 'img.heng36.party';
  ```
- **Route**: `img.heng36.party/game-images/*`

#### Worker 2: `supabase-storage-cdn-max56`
- **Code**: ใช้จาก `cloudflare-worker-supabase-cdn.js`
- **Config**:
  ```javascript
  const SUPABASE_PROJECT_REF = 'aunfaslgmxxdeemvtexn';
  const CDN_DOMAIN = 'img.max56.party';
  ```
- **Route**: `img.max56.party/game-images/*`

#### Worker 3: `supabase-storage-cdn-jeed24`
- **Code**: ใช้จาก `cloudflare-worker-supabase-cdn.js`
- **Config**:
  ```javascript
  const SUPABASE_PROJECT_REF = 'pyrtleftkrjxvwlbvfma';
  const CDN_DOMAIN = 'img.jeed24.party';
  ```
- **Route**: `img.jeed24.party/game-images/*`

---

## 📊 เปรียบเทียบ

| ข้อพิจารณา | Worker เดียว | Worker แยก |
|-----------|-------------|------------|
| **จำนวน Workers** | 1 | 3 |
| **Maintain** | ✅ ง่าย (1 ครั้ง) | ⚠️ ต้องทำ 3 ครั้ง |
| **Deploy** | ✅ 1 ครั้ง | ⚠️ 3 ครั้ง |
| **Config** | ⚠️ ซับซ้อนกว่า | ✅ ชัดเจน |
| **Isolation** | ⚠️ ถ้ามีปัญหา กระทบทุก theme | ✅ แยกกัน |
| **Quota** | ✅ ใช้ร่วมกัน | ⚠️ แยกกัน |
| **Debug** | ⚠️ ต้องระบุ theme | ✅ ชัดเจน |

---

## ✅ Checklist สำหรับตัวเลือก 1 (Worker เดียว)

### Setup:
- [ ] สร้าง Worker: `supabase-storage-cdn-multi-theme`
- [ ] Copy code จาก `cloudflare-worker-advanced.js`
- [ ] Deploy Worker
- [ ] ตั้งค่า Route: `img.heng36.party/game-images/*`
- [ ] ตั้งค่า Route: `img.max56.party/game-images/*`
- [ ] ตั้งค่า Route: `img.jeed24.party/game-images/*`

### DNS:
- [ ] CNAME: `img.heng36.party` → `ipflzfxezdzbmoqglknu.supabase.co`
- [ ] CNAME: `img.max56.party` → `aunfaslgmxxdeemvtexn.supabase.co`
- [ ] CNAME: `img.jeed24.party` → `pyrtleftkrjxvwlbvfma.supabase.co`

### Supabase Storage:
- [ ] ตั้งค่า public access policy สำหรับ `game-images` bucket ในแต่ละ Supabase project

---

## ✅ Checklist สำหรับตัวเลือก 2 (Worker แยก)

### Setup:
- [ ] สร้าง Worker: `supabase-storage-cdn-heng36`
- [ ] สร้าง Worker: `supabase-storage-cdn-max56`
- [ ] สร้าง Worker: `supabase-storage-cdn-jeed24`
- [ ] Deploy แต่ละ Worker
- [ ] ตั้งค่า Route สำหรับแต่ละ Worker

### DNS:
- [ ] CNAME: `img.heng36.party` → `ipflzfxezdzbmoqglknu.supabase.co`
- [ ] CNAME: `img.max56.party` → `aunfaslgmxxdeemvtexn.supabase.co`
- [ ] CNAME: `img.jeed24.party` → `pyrtleftkrjxvwlbvfma.supabase.co`

### Supabase Storage:
- [ ] ตั้งค่า public access policy สำหรับ `game-images` bucket ในแต่ละ Supabase project

---

## 🎯 สรุป

### แนะนำ: **ตัวเลือก 1 (Worker เดียว)**

**ชื่อ Worker:** `supabase-storage-cdn-multi-theme`

**เหตุผล:**
- ✅ Maintain ง่าย
- ✅ Deploy ครั้งเดียว
- ✅ Update ครั้งเดียวใช้ได้ทุก theme
- ✅ เหมาะกับโปรเจค multi-theme

**ถ้าต้องการแยก theme ชัดเจน:** ใช้ตัวเลือก 2

---

## 📚 ไฟล์ที่เกี่ยวข้อง

- `cloudflare-worker-advanced.js` - Worker code สำหรับหลาย theme
- `cloudflare-worker-supabase-cdn.js` - Worker code สำหรับ theme เดียว
- `SETUP-CDN-WORKERS-GUIDE.md` - คู่มือการตั้งค่า

