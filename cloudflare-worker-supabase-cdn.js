/**
 * Cloudflare Worker สำหรับ Supabase Storage CDN
 * 
 * วิธีใช้งาน:
 * 1. Copy code นี้ไปใส่ใน Cloudflare Workers
 * 2. แก้ไข SUPABASE_PROJECT_REF และ BUCKET_NAME ตามข้อมูลของคุณ
 * 3. Deploy Worker
 * 4. ตั้งค่า Route: img.<domain>/game-images/* → Worker นี้
 */

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

