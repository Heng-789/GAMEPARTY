# 🚀 คู่มือการตั้งค่า Custom CDN URL + Cloudflare Workers

## 📋 ภาพรวม

คู่มือนี้จะสอนวิธีการตั้งค่า **Custom CDN URL + Cloudflare Workers** สำหรับ Supabase Storage

**ผลลัพธ์:**
- ✅ URL สั้น: `img.heng36.party/game-images/xxx`
- ✅ ดูเป็นมืออาชีพ
- ✅ รองรับ Multi-theme

---

## ✅ Checklist

- [ ] ตั้งค่า DNS CNAME
- [ ] สร้าง Cloudflare Worker
- [ ] ตั้งค่า Worker Route
- [ ] ตั้งค่า Supabase Storage Public Access
- [ ] ทดสอบการทำงาน

---

## 📝 ขั้นตอนที่ 1: ตั้งค่า DNS CNAME

### 1.1 เข้า Cloudflare Dashboard

1. เข้า https://dash.cloudflare.com
2. เลือก domain `heng36.party`

### 1.2 สร้าง CNAME Record

1. ไปที่ **DNS** → **Records**
2. คลิก **Add record**
3. ตั้งค่าดังนี้:
   - **Type**: `CNAME`
   - **Name**: `img`
   - **Target**: `ipflzfxezdzbmoqglknu.supabase.co`
   - **Proxy status**: ✅ **Proxied** (ส้ม) - **สำคัญมาก!**
   - **TTL**: Auto
4. คลิก **Save**

### 1.3 ทดสอบ DNS

รอ 5-15 นาที แล้วทดสอบ:

```bash
nslookup img.heng36.party
```

**ผลลัพธ์ที่ควรได้:**
```
img.heng36.party canonical name = ipflzfxezdzbmoqglknu.supabase.co
```

---

## 📝 ขั้นตอนที่ 2: สร้าง Cloudflare Worker

### 2.1 เข้า Workers Dashboard

1. ใน Cloudflare Dashboard → **Workers & Pages**
2. คลิก **Create application**
3. คลิก **Create Worker**

### 2.2 ตั้งชื่อ Worker

- **Name**: `supabase-storage-cdn`
- คลิก **Deploy** (จะสร้าง Worker เปล่าก่อน)

### 2.3 แก้ไข Worker Code

1. ไปที่ Worker ที่สร้างไว้ → **Edit code**
2. **ลบ code เก่าทั้งหมด**
3. **Copy code จาก `cloudflare-worker-supabase-cdn.js`** ไปใส่

**Code ที่ต้องใช้:**

```javascript
// ⚙️ Configuration - แก้ไขตามข้อมูลของคุณ
const SUPABASE_PROJECT_REF = 'ipflzfxezdzbmoqglknu'; // เปลี่ยนเป็น project ref ของคุณ
const BUCKET_NAME = 'game-images'; // เปลี่ยนเป็น bucket name ของคุณ
const CDN_DOMAIN = 'img.heng36.party'; // เปลี่ยนเป็น CDN domain ของคุณ

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // ตรวจสอบว่าเป็น CDN subdomain
    if (url.hostname !== CDN_DOMAIN) {
      return new Response('Not Found', { status: 404 });
    }
    
    // แปลง path จาก CDN format เป็น Supabase format
    // จาก: /game-images/heng36/games/image.jpg
    // เป็น: /storage/v1/object/public/game-images/heng36/games/image.jpg
    const path = url.pathname;
    
    // ถ้า path เริ่มด้วย /<bucket>/ ให้แปลงเป็น Supabase path
    if (path.startsWith(`/${BUCKET_NAME}/`)) {
      const supabasePath = `/storage/v1/object/public${path}`;
      const supabaseUrl = `https://${SUPABASE_PROJECT_REF}.supabase.co${supabasePath}`;
      
      // Forward request ไปที่ Supabase
      const supabaseRequest = new Request(supabaseUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers),
          'Host': `${SUPABASE_PROJECT_REF}.supabase.co`,
        },
      });
      
      try {
        const response = await fetch(supabaseRequest);
        
        // ถ้า Supabase return 404, return 404
        if (response.status === 404) {
          return new Response('File Not Found', { status: 404 });
        }
        
        // ถ้าไม่ใช่ 200, forward response ตามเดิม
        if (response.status !== 200) {
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
        
        // สร้าง response ใหม่พร้อม cache headers
        const headers = new Headers(response.headers);
        
        // ตั้งค่า cache headers สำหรับรูปภาพ
        const contentType = response.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          // Cache รูปภาพเป็นเวลา 1 ปี (immutable)
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          headers.set('X-Content-Type-Options', 'nosniff');
        }
        
        // เพิ่ม CORS headers
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        // เพิ่ม Cloudflare cache headers
        headers.set('CF-Cache-Status', 'MISS'); // จะเปลี่ยนเป็น HIT เมื่อ cache แล้ว
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers,
        });
      } catch (error) {
        console.error('Error fetching from Supabase:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    // ถ้า path ไม่ตรงกับ pattern ที่ต้องการ
    return new Response('Not Found', { status: 404 });
  },
};
```

### 2.4 Deploy Worker

1. คลิก **Save and deploy**
2. รอให้ deploy เสร็จ (ประมาณ 10-30 วินาที)

---

## 📝 ขั้นตอนที่ 3: ตั้งค่า Worker Route

### 3.1 เข้า Worker Settings

1. ไปที่ Worker `supabase-storage-cdn`
2. ไปที่แท็บ **Triggers**
3. คลิก **Add route** ในส่วน **Routes**

### 3.2 ตั้งค่า Route

1. **Route**: `img.heng36.party/game-images/*`
2. **Zone**: เลือก `heng36.party`
3. คลิก **Add route**

**หมายเหตุ:** 
- Route pattern ใช้ `*` เพื่อ match ทุก path ภายใต้ `/game-images/`
- ตัวอย่าง: `img.heng36.party/game-images/heng36/games/image.jpg` ✅

---

## 📝 ขั้นตอนที่ 4: ตั้งค่า Supabase Storage Public Access

### 4.1 เข้า Supabase Dashboard

1. เข้า https://supabase.com/dashboard
2. เลือก project `ipflzfxezdzbmoqglknu`

### 4.2 ตรวจสอบ Storage Bucket

1. ไปที่ **Storage** → **Buckets**
2. ตรวจสอบว่ามี bucket `game-images` หรือไม่
3. ถ้ายังไม่มี → สร้าง bucket ใหม่:
   - **Name**: `game-images`
   - **Public bucket**: ✅ เปิด (สำคัญ!)

### 4.3 ตั้งค่า Public Access Policy

#### วิธีที่ 1: ใช้ SQL Editor (แนะนำ)

1. ไปที่ **SQL Editor** → **New query**
2. รัน SQL นี้:

```sql
-- สร้าง policy สำหรับ public read access
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'game-images');
```

3. คลิก **Run**

#### วิธีที่ 2: ใช้ Dashboard

1. ไปที่ **Storage** → **Policies**
2. คลิก **New Policy**
3. ตั้งค่า:
   - **Policy Name**: `Public Read Access`
   - **Allowed Operations**: `SELECT`
   - **Target Roles**: `public`
   - **USING Expression**: `bucket_id = 'game-images'`
   - **WITH CHECK Expression**: `true`
4. คลิก **Save**

---

## 📝 ขั้นตอนที่ 5: ทดสอบการทำงาน

### 5.1 ทดสอบ Supabase Storage โดยตรง

เปิด URL ใน browser:
```
https://ipflzfxezdzbmoqglknu.supabase.co/storage/v1/object/public/game-images/test.jpg
```

**ถ้าได้ 404** → ต้องอัปโหลดไฟล์ทดสอบก่อน

### 5.2 ทดสอบ CDN URL (หลังตั้งค่า Workers)

เปิด URL ใน browser:
```
https://img.heng36.party/game-images/test.jpg
```

**ควรเห็นรูปภาพโหลดได้** ✅

### 5.3 ทดสอบผ่านระบบ

1. เปิดหน้า **CreateGame.tsx**
2. อัปโหลดรูปภาพ
3. ตรวจสอบ CDN URL ที่ได้จากระบบ
4. เปิด URL ใน browser
5. **ควรเห็นรูปภาพโหลดได้** ✅

### 5.4 ตรวจสอบ Cache Headers

เปิด Browser DevTools → Network tab:
- ตรวจสอบ Response Headers:
  - `CF-Cache-Status: HIT` (ถ้า cache แล้ว)
  - `Cache-Control: public, max-age=31536000, immutable`

---

## 🔧 การแก้ไขปัญหา

### ปัญหา: CDN URL ไม่ทำงาน (404 Not Found)

**สาเหตุที่เป็นไปได้:**
1. ❌ DNS ยังไม่ propagate → รอ 5-15 นาที
2. ❌ Worker route ไม่ถูกต้อง → ตรวจสอบ route
3. ❌ Supabase Storage path ไม่ถูกต้อง → ตรวจสอบ path
4. ❌ Supabase Storage ไม่มี public access → ตั้งค่า policy

**วิธีแก้:**
1. ตรวจสอบ DNS: `nslookup img.heng36.party`
2. ตรวจสอบ Worker logs ใน Cloudflare Dashboard
3. ทดสอบ Supabase URL โดยตรง
4. ตรวจสอบ Supabase Storage policy

### ปัญหา: CORS Error

**วิธีแก้:**
1. ตรวจสอบว่า Worker response มี CORS headers
2. ตรวจสอบ Supabase Storage CORS settings

### ปัญหา: รูปภาพไม่ cache

**วิธีแก้:**
1. ตรวจสอบ Page Rule ว่าตั้งค่าถูกต้อง
2. ตรวจสอบ `Cache-Control` headers ใน Worker response
3. ตรวจสอบ `CF-Cache-Status` header

---

## 📝 สรุป

### ✅ สิ่งที่ต้องทำ:

1. **DNS CNAME** → `img` → `ipflzfxezdzbmoqglknu.supabase.co` (Proxied)
2. **Cloudflare Worker** → URL rewriting
3. **Worker Route** → `img.heng36.party/game-images/*`
4. **Supabase Storage Policy** → Public read access

### ⏱️ เวลาที่ใช้:

- DNS: 5-15 นาที
- Workers: 5-10 นาที
- Storage Policy: 2 นาที

**รวม: ~15-20 นาที**

---

## 🎯 หลังจากตั้งค่าเสร็จ

1. ✅ ทดสอบอัปโหลดรูปภาพผ่านระบบ
2. ✅ ตรวจสอบ CDN URL ว่าทำงานได้
3. ✅ ตรวจสอบ cache headers (`CF-Cache-Status: HIT`)
4. ✅ ทดสอบความเร็วในการโหลดรูปภาพ

---

## 📚 เอกสารอ้างอิง

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)

---

**หมายเหตุ:** 
- Cloudflare Workers มี free tier 100,000 requests/วัน
- ถ้ามีหลาย theme (max56, jeed24) ต้องตั้งค่า Workers แยกสำหรับแต่ละ theme

