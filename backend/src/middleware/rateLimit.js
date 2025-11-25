/**
 * Rate Limiting Middleware
 * ป้องกันการเรียก API มากเกินไป
 */

const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

// Different limits for different endpoints
const ENDPOINT_LIMITS = {
  '/api/games/:gameId': {
    window: 30 * 1000, // 30 seconds
    max: 30 // 30 requests per 30 seconds
  },
  '/api/games': {
    window: 60 * 1000,
    max: 50
  },
  '/api/answers': {
    window: 10 * 1000,
    max: 20
  },
  '/api/checkins': {
    window: 10 * 1000,
    max: 10
  },
  default: {
    window: RATE_LIMIT_WINDOW,
    max: RATE_LIMIT_MAX_REQUESTS
  }
};

/**
 * Get client IP address
 */
function getClientIP(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         'unknown';
}

/**
 * Clean up old entries
 */
function cleanup() {
  const now = Date.now();
  requestCounts.forEach((entry, key) => {
    if (now - entry.firstRequest > entry.window) {
      requestCounts.delete(key);
    }
  });
}

// Cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

/**
 * Rate limit middleware
 */
export function rateLimitMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const path = req.path;
  
  // Find matching endpoint limit
  let limit = ENDPOINT_LIMITS.default;
  for (const [pattern, config] of Object.entries(ENDPOINT_LIMITS)) {
    if (pattern === 'default') continue;
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
    if (regex.test(path)) {
      limit = config;
      break;
    }
  }
  
  const key = `${ip}:${path}`;
  const now = Date.now();
  
  let entry = requestCounts.get(key);
  
  if (!entry || now - entry.firstRequest > limit.window) {
    // New window
    entry = {
      count: 1,
      firstRequest: now,
      window: limit.window
    };
    requestCounts.set(key, entry);
    return next();
  }
  
  entry.count++;
  
  if (entry.count > limit.max) {
    return res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded: ${limit.max} requests per ${limit.window / 1000} seconds`,
      retryAfter: Math.ceil((limit.window - (now - entry.firstRequest)) / 1000)
    });
  }
  
  next();
}

