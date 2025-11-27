/**
 * In-Memory Cache Middleware สำหรับลด Database Query
 * ใช้สำหรับ /games endpoint ที่ถูกเรียกบ่อย
 */

const cache = new Map();
// ✅ เพิ่ม Cache TTL เพื่อลด API calls เมื่อมี users มาก
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes (เพิ่มจาก 30 วินาที)
const USER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes สำหรับ user data

/**
 * Cache entry structure: { data, timestamp, ttl }
 */
function getCacheKey(req) {
  const theme = req.theme || 'heng36';
  // ✅ ใช้ req.params.gameId ถ้ามี (route handler parse แล้ว)
  // ✅ ถ้าไม่มี ให้ใช้ req.path หรือ req.url
  let gameId = req.params?.gameId;
  
  if (!gameId) {
    const path = req.path || req.url || '';
    if (path.includes('/') && path !== '/') {
      gameId = path.split('/').pop() || 'list';
      // ✅ Decode URL encoding
      try {
        gameId = decodeURIComponent(gameId);
      } catch (e) {
        // ถ้า decode ไม่ได้ ให้ใช้ค่าเดิม
      }
    } else {
      gameId = 'list';
    }
  } else {
    // ✅ Decode URL encoding สำหรับ gameId จาก params
    try {
      gameId = decodeURIComponent(gameId);
    } catch (e) {
      // ถ้า decode ไม่ได้ ให้ใช้ค่าเดิม
    }
  }
  
  return `${theme}:games:${gameId}`;
}

/**
 * Get cached data
 */
export function getCachedData(req) {
  const key = getCacheKey(req);
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

/**
 * Set cached data
 */
export function setCachedData(req, data, ttl = CACHE_TTL) {
  const key = getCacheKey(req);
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Invalidate cache for a specific game
 */
export function invalidateGameCache(theme, gameId) {
  const key = `${theme}:games:${gameId}`;
  cache.delete(key);
  // Also invalidate list cache
  cache.delete(`${theme}:games:list`);
}

/**
 * Invalidate all cache for a theme
 */
export function invalidateThemeCache(theme) {
  const keysToDelete = [];
  cache.forEach((value, key) => {
    if (key.startsWith(`${theme}:games:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Cache middleware สำหรับ GET /games/:gameId
 */
export function cacheMiddleware(req, res, next) {
  // Only cache GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  const cached = getCachedData(req);
  if (cached) {
    return res.json(cached);
  }
  
  // Store original json function
  const originalJson = res.json.bind(res);
  
  // Override json to cache the response
  res.json = function(data) {
    setCachedData(req, data);
    return originalJson(data);
  };
  
  next();
}

/**
 * Get cache stats (for monitoring)
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

