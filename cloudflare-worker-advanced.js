/**
 * Cloudflare Worker แบบ Advanced สำหรับ Supabase Storage CDN
 * 
 * Features:
 * - รองรับหลาย theme (heng36, max56, jeed24)
 * - รองรับหลาย bucket
 * - Error handling ที่ดีขึ้น
 * - Logging สำหรับ debugging
 * - Cache optimization
 */

// ⚙️ Configuration
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

// Helper: ดึง theme จาก hostname
function getThemeFromHostname(hostname) {
  for (const [theme, domain] of Object.entries(CONFIG.CDN_DOMAINS)) {
    if (hostname === domain) {
      return theme;
    }
  }
  return CONFIG.DEFAULT_THEME;
}

// Helper: แปลง CDN path เป็น Supabase path
function convertToSupabasePath(cdnPath, bucketName) {
  // จาก: /game-images/heng36/games/image.jpg
  // เป็น: /storage/v1/object/public/game-images/heng36/games/image.jpg
  if (cdnPath.startsWith(`/${bucketName}/`)) {
    return `/storage/v1/object/public${cdnPath}`;
  }
  return null;
}

// Helper: สร้าง Supabase URL
function createSupabaseUrl(theme, path) {
  const projectRef = CONFIG.SUPABASE_PROJECTS[theme] || CONFIG.SUPABASE_PROJECTS[CONFIG.DEFAULT_THEME];
  return `https://${projectRef}.supabase.co${path}`;
}

// Helper: ตั้งค่า cache headers
function setCacheHeaders(headers, contentType) {
  if (contentType && contentType.startsWith('image/')) {
    // รูปภาพ: cache 1 ปี (immutable)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (contentType && contentType.startsWith('text/')) {
    // ข้อความ: cache 1 ชั่วโมง
    headers.set('Cache-Control', 'public, max-age=3600');
  } else {
    // อื่นๆ: cache 1 วัน
    headers.set('Cache-Control', 'public, max-age=86400');
  }
  
  headers.set('X-Content-Type-Options', 'nosniff');
}

// Helper: สร้าง CORS headers
function setCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const path = url.pathname;
    
    // Handle OPTIONS request (CORS preflight)
    if (request.method === 'OPTIONS') {
      const headers = new Headers();
      setCorsHeaders(headers);
      return new Response(null, { status: 204, headers });
    }
    
    // ตรวจสอบว่าเป็น CDN subdomain
    const theme = getThemeFromHostname(hostname);
    if (!theme) {
      return new Response('Invalid CDN Domain', { status: 400 });
    }
    
    // แปลง path เป็น Supabase path
    const supabasePath = convertToSupabasePath(path, CONFIG.BUCKET_NAME);
    if (!supabasePath) {
      return new Response('Invalid Path', { status: 400 });
    }
    
    // สร้าง Supabase URL
    const supabaseUrl = createSupabaseUrl(theme, supabasePath);
    
    // Forward request ไปที่ Supabase
    const supabaseRequest = new Request(supabaseUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'Host': `${CONFIG.SUPABASE_PROJECTS[theme]}.supabase.co`,
      },
    });
    
    try {
      const response = await fetch(supabaseRequest);
      
      // Handle errors
      if (response.status === 404) {
        return new Response('File Not Found', { 
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }
      
      if (response.status >= 500) {
        console.error(`Supabase Error: ${response.status} for ${supabaseUrl}`);
        return new Response('Upstream Error', { status: 502 });
      }
      
      // สร้าง response ใหม่พร้อม headers
      const headers = new Headers(response.headers);
      const contentType = response.headers.get('content-type') || '';
      
      // ตั้งค่า cache headers
      setCacheHeaders(headers, contentType);
      
      // ตั้งค่า CORS headers
      setCorsHeaders(headers);
      
      // เพิ่ม custom headers
      headers.set('X-CDN-Provider', 'Cloudflare');
      headers.set('X-Served-By', 'Cloudflare-Worker');
      
      // Clone response body (stream)
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers,
      });
      
    } catch (error) {
      console.error('Error fetching from Supabase:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
  },
};

