# 🚀 คู่มือการตั้งค่า Cloudflare CDN สำหรับ Supabase Storage

## 📋 ภาพรวม

คู่มือนี้จะอธิบายวิธีการตั้งค่า Cloudflare CDN ให้ชี้ไปที่ Supabase Storage เพื่อให้รูปภาพที่อัปโหลดผ่าน Supabase Storage สามารถเข้าถึงได้ผ่าน CDN URL แบบ `https://cdn.<domain>.com/<bucket>/<path>`

---

## 🎯 ขั้นตอนการตั้งค่า

### 1. เตรียมข้อมูลที่จำเป็น

ก่อนเริ่มตั้งค่า คุณต้องมีข้อมูลต่อไปนี้:

- **Supabase Project URL**: เช่น `https://ipflzfxezdzbmoqglknu.supabase.co`
- **Supabase Storage Bucket Name**: เช่น `game-images`
- **Cloudflare Domain**: เช่น `heng36.party`
- **CDN Subdomain**: เช่น `cdn.heng36.party`

**ตัวอย่าง Supabase Storage URL:**
```
https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/heng36/games/1234567890-abc123.jpg
```

**CDN URL ที่ต้องการ:**
```
https://cdn.heng36.party/game-images/heng36/games/1234567890-abc123.jpg
```

---

### 2. ตั้งค่า Cloudflare DNS

#### 2.1 สร้าง CNAME Record สำหรับ CDN Subdomain

1. เข้าสู่ **Cloudflare Dashboard** → เลือก domain ของคุณ (เช่น `heng36.party`)
2. ไปที่ **DNS** → **Records**
3. คลิก **Add record**
4. ตั้งค่าดังนี้:
   - **Type**: `CNAME`
   - **Name**: `cdn` (หรือชื่อ subdomain ที่ต้องการ)
   - **Target**: `<project-ref>.supabase.co` (เช่น `ipflzfxezdzbmoqglknu.supabase.co`)
   - **Proxy status**: ✅ **Proxied** (ส้ม) - ต้องเปิด Proxy เพื่อใช้ CDN
   - **TTL**: Auto
5. คลิก **Save**

**หมายเหตุ:** 
- ใช้ **Proxied** (ส้ม) เพื่อให้ Cloudflare เป็น CDN และ cache เนื้อหา
- ใช้ **DNS only** (เทา) ถ้าต้องการแค่ DNS redirect โดยไม่ใช้ CDN

---

### 3. ตั้งค่า Cloudflare Page Rules (Optional - สำหรับ Cache Control)

เพื่อให้ Cloudflare cache รูปภาพได้ดีขึ้น:

1. ไปที่ **Rules** → **Page Rules** (หรือ **Transform Rules** ในแผนใหม่)
2. คลิก **Create rule**
3. ตั้งค่า:
   - **URL Pattern**: `cdn.heng36.party/game-images/*`
   - **Settings**:
     - **Cache Level**: `Cache Everything`
     - **Edge Cache TTL**: `1 month` (หรือตามต้องการ)
     - **Browser Cache TTL**: `1 month`
     - **Cache Key**: `Include query string: No`
4. คลิก **Save**

---

### 4. ตั้งค่า Cloudflare Transform Rules (สำหรับ URL Rewrite)

เนื่องจาก Supabase Storage URL มี path `/storage/v1/object/public/` แต่เราต้องการให้ CDN URL เป็นแบบง่ายๆ เราต้องใช้ **Transform Rules** เพื่อ rewrite URL

#### 4.1 สร้าง Rewrite Rule

1. ไปที่ **Rules** → **Transform Rules** → **Modify Request Header**
2. คลิก **Create rule**
3. ตั้งค่า:

**Rule Name**: `Supabase Storage CDN Rewrite`

**When incoming requests match**:
- **Field**: `Hostname`
- **Operator**: `equals`
- **Value**: `cdn.heng36.party`

**Then**:
- **Action**: `Rewrite`
- **Type**: `Static`
- **Path**: 
  ```
  /storage/v1/object/public{{original_path}}
  ```

**หมายเหตุ:** 
- Cloudflare Transform Rules อาจไม่รองรับการ rewrite path แบบซับซ้อน
- **ทางเลือกที่ดีกว่า**: ใช้ **Cloudflare Workers** เพื่อ rewrite URL

---

### 5. ตั้งค่า Cloudflare Workers (แนะนำ - สำหรับ URL Rewrite)

เนื่องจาก Supabase Storage URL มีโครงสร้างที่ซับซ้อน การใช้ Workers จะยืดหยุ่นกว่า

#### 5.1 สร้าง Worker

1. ไปที่ **Workers & Pages** → **Create application** → **Create Worker**
2. ตั้งชื่อ Worker: `supabase-storage-cdn`
3. แก้ไขโค้ด:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // ตรวจสอบว่าเป็น CDN subdomain
    if (url.hostname !== 'cdn.heng36.party') {
      return new Response('Not Found', { status: 404 });
    }
    
    // แปลง path จาก CDN format เป็น Supabase format
    // จาก: /game-images/heng36/games/image.jpg
    // เป็น: /storage/v1/object/public/game-images/heng36/games/image.jpg
    const path = url.pathname;
    
    // ถ้า path เริ่มด้วย /game-images/ ให้แปลงเป็น Supabase path
    if (path.startsWith('/game-images/')) {
      const supabasePath = `/storage/v1/object/public${path}`;
      const supabaseUrl = `https://ipflzfxezdzbmoqglknu.supabase.co${supabasePath}`;
      
      // Forward request ไปที่ Supabase
      const response = await fetch(supabaseUrl, {
        method: request.method,
        headers: request.headers,
      });
      
      // ส่ง response กลับพร้อม cache headers
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
```

4. คลิก **Save and deploy**

#### 5.2 ตั้งค่า Route สำหรับ Worker

1. ไปที่ Worker ที่สร้างไว้ → **Triggers** → **Routes**
2. คลิก **Add route**
3. ตั้งค่า:
   - **Route**: `cdn.heng36.party/game-images/*`
   - **Zone**: เลือก domain ของคุณ
4. คลิก **Add route**

---

### 6. ตั้งค่า CORS (ถ้าจำเป็น)

ถ้ามีปัญหา CORS เมื่อโหลดรูปภาพจาก CDN:

1. ไปที่ **Supabase Dashboard** → **Storage** → **Policies**
2. สร้าง Policy ใหม่สำหรับ bucket `game-images`:
   - **Policy Name**: `Public Read Access`
   - **Allowed Operations**: `SELECT`
   - **Target Roles**: `public`
   - **USING Expression**: `true`
   - **WITH CHECK Expression**: `true`

หรือใช้ SQL:

```sql
-- สร้าง policy สำหรับ public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');
```

---

### 7. ทดสอบการตั้งค่า

#### 7.1 ทดสอบ DNS

```bash
# ทดสอบว่า DNS ชี้ไปที่ Supabase ถูกต้อง
nslookup cdn.heng36.party

# ควรได้ผลลัพธ์ประมาณ:
# cdn.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co
```

#### 7.2 ทดสอบ CDN URL

1. อัปโหลดรูปภาพผ่านระบบ (CreateGame.tsx)
2. ตรวจสอบ CDN URL ที่ได้จากระบบ
3. เปิด URL ใน browser: `https://cdn.heng36.party/game-images/heng36/games/xxx.jpg`
4. ควรเห็นรูปภาพโหลดได้

#### 7.3 ทดสอบ Cache

1. เปิดรูปภาพจาก CDN URL
2. ตรวจสอบ Response Headers ใน Browser DevTools:
   - ควรมี `CF-Cache-Status: HIT` (ถ้า cache แล้ว)
   - ควรมี `Cache-Control` header

---

## 🔧 การแก้ไขปัญหา

### ปัญหา: CDN URL ไม่ทำงาน (404 Not Found)

**สาเหตุที่เป็นไปได้:**
1. DNS ยังไม่ propagate (รอ 5-15 นาที)
2. Worker route ไม่ถูกต้อง
3. Supabase Storage path ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบ DNS: `nslookup cdn.heng36.party`
2. ตรวจสอบ Worker logs ใน Cloudflare Dashboard
3. ทดสอบ Supabase URL โดยตรง: `https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/...`

### ปัญหา: CORS Error

**วิธีแก้:**
1. ตั้งค่า CORS policy ใน Supabase Storage (ดูขั้นตอนที่ 6)
2. เพิ่ม CORS headers ใน Worker response

### ปัญหา: รูปภาพไม่ cache

**วิธีแก้:**
1. ตั้งค่า Page Rules หรือ Cache Rules
2. ตรวจสอบ `Cache-Control` headers ใน Worker response

---

## 📝 ตัวอย่าง Configuration

### Environment Variables ที่ใช้ในระบบ

```env
# env.heng36
VITE_CDN_DOMAIN_HENG36=cdn.heng36.party
VITE_STORAGE_BUCKET_HENG36=game-images
```

### Supabase Storage Path Structure

```
game-images/
├── heng36/
│   ├── games/
│   │   ├── 1234567890-abc123.jpg
│   │   └── 1234567891-def456.jpg
│   ├── checkin/
│   │   └── 1234567892-ghi789.jpg
│   └── announce/
│       └── 1234567893-jkl012.jpg
├── max56/
│   └── ...
└── jeed24/
    └── ...
```

### CDN URL Mapping

| Supabase URL | CDN URL |
|-------------|---------|
| `https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/heng36/games/image.jpg` | `https://cdn.heng36.party/game-images/heng36/games/image.jpg` |

---

## 🎯 Best Practices

1. **ใช้ Cloudflare Workers** สำหรับ URL rewriting (ยืดหยุ่นกว่า Transform Rules)
2. **ตั้งค่า Cache Rules** เพื่อ cache รูปภาพเป็นเวลานาน (1 เดือนขึ้นไป)
3. **ใช้ Immutable Cache** สำหรับรูปภาพที่ไม่อัปเดต
4. **ตั้งค่า CORS** ให้ถูกต้องเพื่อรองรับการโหลดจากหลาย domain
5. **Monitor CDN Performance** ผ่าน Cloudflare Analytics

---

## 📚 เอกสารอ้างอิง

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)

---

## ✅ Checklist

- [ ] สร้าง CNAME record สำหรับ `cdn.heng36.party`
- [ ] เปิด Proxy (Proxied) ใน Cloudflare DNS
- [ ] สร้าง Cloudflare Worker สำหรับ URL rewriting
- [ ] ตั้งค่า Route สำหรับ Worker
- [ ] ตั้งค่า CORS policy ใน Supabase Storage
- [ ] ทดสอบ CDN URL ว่าทำงานได้
- [ ] ตั้งค่า Cache Rules (optional)
- [ ] อัปเดต environment variables ในระบบ

---

**หมายเหตุ:** 
- การตั้งค่า DNS อาจใช้เวลา 5-15 นาทีในการ propagate
- ตรวจสอบว่า Supabase Storage bucket มี public access policy
- Cloudflare Workers มี free tier 100,000 requests/วัน

