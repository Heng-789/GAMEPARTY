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

// Cache duration configuration (in seconds)
const CACHE_DURATIONS = {
  // Static/semi-static data (game list, user data)
  STATIC: parseInt(process.env.CACHE_DURATION_STATIC) || 300, // 5 minutes
  // Dynamic data (answers, checkins)
  DYNAMIC: parseInt(process.env.CACHE_DURATION_DYNAMIC) || 60, // 1 minute
  // User-specific data
  USER: parseInt(process.env.CACHE_DURATION_USER) || 30, // 30 seconds
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
 */
function getCacheStrategy(req) {
  const path = req.path;
  const method = req.method;
  
  // No cache for write operations
  if (method !== 'GET') {
    return { duration: CACHE_DURATIONS.NONE, strategy: 'no-cache' };
  }
  
  // Static/semi-static endpoints
  if (path.startsWith('/api/games') && !path.includes('/:gameId')) {
    // Game list - changes infrequently
    return { duration: CACHE_DURATIONS.STATIC, strategy: 'public' };
  }
  
  if (path.startsWith('/api/games/:gameId') || path.match(/^\/api\/games\/[^/]+$/)) {
    // Individual game - changes infrequently but may have updates
    return { duration: CACHE_DURATIONS.STATIC, strategy: 'public' };
  }
  
  if (path.startsWith('/api/users/top') || path.startsWith('/api/users/search')) {
    // User lists - semi-static
    return { duration: CACHE_DURATIONS.DYNAMIC, strategy: 'public' };
  }
  
  // Dynamic endpoints
  if (path.startsWith('/api/answers')) {
    // Answers - changes frequently
    return { duration: CACHE_DURATIONS.DYNAMIC, strategy: 'public' };
  }
  
  if (path.startsWith('/api/checkins')) {
    // Checkins - user-specific, changes frequently
    return { duration: CACHE_DURATIONS.USER, strategy: 'private' };
  }
  
  // Default: short cache for safety
  return { duration: CACHE_DURATIONS.DYNAMIC, strategy: 'public' };
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
    
    // Set Cache-Control header
    if (strategy.duration > 0) {
      const cacheControl = [
        strategy.strategy,
        `max-age=${strategy.duration}`,
        'must-revalidate'
      ].join(', ');
      res.set('Cache-Control', cacheControl);
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

