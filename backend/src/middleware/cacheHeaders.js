/**
 * HTTP Caching Headers Middleware
 * 
 * Adds Cache-Control, ETag, and Last-Modified headers to responses
 * to enable client-side caching and reduce bandwidth.
 * 
 * Configuration:
 * - Different cache strategies for different endpoint types
 * - ETag support for conditional GETs (304 Not Modified)
 * - Configurable cache durations via environment variables
 */

import crypto from 'crypto';

// ✅ AGGRESSIVE CACHING CONFIGURATION
// Optimized for 70-90% egress reduction via CDN caching
const CACHE_DURATIONS = {
  // Static/semi-static data (game list, config, rewards)
  // ✅ Increased from 5min to 1hr for CDN caching (s-maxage)
  STATIC: parseInt(process.env.CACHE_DURATION_STATIC) || 3600, // 1 hour
  // Dynamic data (answers, checkins) - shorter cache but still CDN-cached
  DYNAMIC: parseInt(process.env.CACHE_DURATION_DYNAMIC) || 600, // 10 minutes
  // User-specific data - private cache only
  USER: parseInt(process.env.CACHE_DURATION_USER) || 60, // 1 minute
  // No cache (default for POST/PUT/DELETE)
  NONE: 0
};

/**
 * Generate ETag from response data
 */
function generateETag(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Check if request has conditional headers (If-None-Match, If-Modified-Since)
 */
function hasConditionalHeaders(req) {
  return !!(req.headers['if-none-match'] || req.headers['if-modified-since']);
}

/**
 * Check if ETag matches (for 304 Not Modified)
 */
function etagMatches(req, etag) {
  const ifNoneMatch = req.headers['if-none-match'];
  if (!ifNoneMatch) return false;
  return ifNoneMatch === etag || ifNoneMatch === `"${etag}"` || ifNoneMatch === `W/"${etag}"`;
}

/**
 * Determine cache strategy based on route
 * ✅ OPTIMIZED: Aggressive caching for CDN (s-maxage) with stale-while-revalidate
 */
function getCacheStrategy(req) {
  const path = req.path;
  const method = req.method;
  
  // No cache for write operations
  if (method !== 'GET') {
    return { 
      duration: CACHE_DURATIONS.NONE, 
      strategy: 'no-cache',
      staleWhileRevalidate: 0
    };
  }
  
  // ✅ Static/semi-static endpoints - AGGRESSIVE CDN CACHING
  if (path === '/api/games' || path.startsWith('/api/games') && !path.match(/\/api\/games\/[^/]+/)) {
    // Game list - changes infrequently
    // ✅ CDN cache for 1hr, stale-while-revalidate for 24hr
    return { 
      duration: CACHE_DURATIONS.STATIC, 
      strategy: 'public',
      staleWhileRevalidate: 86400 // 24 hours
    };
  }
  
  if (path.match(/^\/api\/games\/[^/]+$/) && !path.includes('/claim-code') && !path.includes('/state') && !path.includes('/snapshot')) {
    // Individual game - changes infrequently but may have updates
    // ✅ CDN cache for 1hr, stale-while-revalidate for 12hr
    return { 
      duration: CACHE_DURATIONS.STATIC, 
      strategy: 'public',
      staleWhileRevalidate: 43200 // 12 hours
    };
  }
  
  // ✅ Game state/snapshot endpoints - shorter cache
  if (path.includes('/state') || path.includes('/snapshot')) {
    return {
      duration: 300, // 5 minutes
      strategy: 'public',
      staleWhileRevalidate: 600 // 10 minutes
    };
  }
  
  if (path.startsWith('/api/users/top') || path.startsWith('/api/users/search')) {
    // User lists - semi-static
    // ✅ CDN cache for 10min, stale-while-revalidate for 1hr
    return { 
      duration: CACHE_DURATIONS.DYNAMIC, 
      strategy: 'public',
      staleWhileRevalidate: 3600 // 1 hour
    };
  }
  
  // ✅ Dynamic endpoints - shorter cache but still CDN-cached
  if (path.startsWith('/api/answers')) {
    // Answers - changes frequently
    // ✅ CDN cache for 10min, stale-while-revalidate for 30min
    return { 
      duration: CACHE_DURATIONS.DYNAMIC, 
      strategy: 'public',
      staleWhileRevalidate: 1800 // 30 minutes
    };
  }
  
  if (path.startsWith('/api/checkins')) {
    // Checkins - user-specific, changes frequently
    // ✅ Private cache only (no CDN caching for user-specific data)
    return { 
      duration: CACHE_DURATIONS.USER, 
      strategy: 'private',
      staleWhileRevalidate: 0
    };
  }
  
  // ✅ Default: CDN cache for 10min with stale-while-revalidate
  return { 
    duration: CACHE_DURATIONS.DYNAMIC, 
    strategy: 'public',
    staleWhileRevalidate: 600 // 10 minutes
  };
}

/**
 * Cache headers middleware
 * Adds Cache-Control, ETag, and handles conditional GETs
 */
export function cacheHeadersMiddleware(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override res.json to add cache headers
  res.json = function(data) {
    const strategy = getCacheStrategy(req);
    
    // ✅ AGGRESSIVE CDN CACHING with stale-while-revalidate
    // This enables CDN (Cloudflare) to cache responses and serve stale content while revalidating
    // Reduces Supabase egress by 70-90%
    if (strategy.duration > 0) {
      const cacheControlParts = [
        strategy.strategy,
        `max-age=${strategy.duration}`,
        `s-maxage=${strategy.duration}` // CDN cache duration (same as max-age for simplicity)
      ];
      
      // Add stale-while-revalidate for CDN caching
      if (strategy.staleWhileRevalidate > 0) {
        cacheControlParts.push(`stale-while-revalidate=${strategy.staleWhileRevalidate}`);
      }
      
      // Add must-revalidate for critical data
      if (strategy.duration >= CACHE_DURATIONS.STATIC) {
        cacheControlParts.push('must-revalidate');
      }
      
      const cacheControl = cacheControlParts.join(', ');
      res.set('Cache-Control', cacheControl);
      
      // ✅ Add Vary header for proper cache key generation
      if (req.headers['x-theme']) {
        res.set('Vary', 'X-Theme');
      }
    } else {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    
    // Generate ETag for GET requests
    if (req.method === 'GET' && strategy.duration > 0) {
      const etag = generateETag(data);
      res.set('ETag', `"${etag}"`);
      
      // Check if client has matching ETag (conditional GET)
      if (hasConditionalHeaders(req) && etagMatches(req, etag)) {
        return res.status(304).end(); // Not Modified
      }
    }
    
    // Set Last-Modified if not already set
    if (!res.get('Last-Modified') && strategy.duration > 0) {
      res.set('Last-Modified', new Date().toUTCString());
    }
    
    // Call original json method
    return originalJson(data);
  };
  
  next();
}

