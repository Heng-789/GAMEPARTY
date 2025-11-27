/**
 * Rate Limiting Middleware
 * ป้องกันการเรียก API มากเกินไป
 */

const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP

// Different limits for different endpoints
// ✅ Optimized for bandwidth: Lower limits on heavy endpoints to reduce server load
// All limits configurable via environment variables
const ENDPOINT_LIMITS = {
  '/api/games': {
    window: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_GAMES_LIST) || 60 // Reduced from 100 to 60
  },
  '/api/games/:gameId': {
    window: 30 * 1000, // 30 seconds
    max: parseInt(process.env.RATE_LIMIT_GAME_DETAIL) || 60
  },
  '/api/answers': {
    window: 10 * 1000, // 10 seconds
    max: parseInt(process.env.RATE_LIMIT_ANSWERS) || 30 // Reduced from 50 to 30
  },
  '/api/checkins': {
    window: 10 * 1000, // 10 seconds
    max: parseInt(process.env.RATE_LIMIT_CHECKINS) || 20 // Reduced from 30 to 20
  },
  '/api/users/top': {
    window: 60 * 1000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_USERS_TOP) || 30 // New limit for leaderboard
  },
  '/api/users/search': {
    window: 10 * 1000, // 10 seconds
    max: parseInt(process.env.RATE_LIMIT_USERS_SEARCH) || 20 // New limit for search
  },
  '/api/users/:userId': {
    window: 10 * 1000, // 10 seconds
    max: parseInt(process.env.RATE_LIMIT_USER_DETAIL) || 20
  },
  '/api/bingo': {
    window: 10 * 1000, // 10 seconds
    max: parseInt(process.env.RATE_LIMIT_BINGO) || 30 // New limit for bingo
  },
  default: {
    window: parseInt(process.env.RATE_LIMIT_WINDOW) || RATE_LIMIT_WINDOW,
    max: parseInt(process.env.RATE_LIMIT_MAX) || RATE_LIMIT_MAX_REQUESTS
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
    // ✅ Structured error response for rate limiting
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      details: {
        limit: limit.max,
        window: limit.window / 1000,
        retryAfter: Math.ceil((limit.window - (now - entry.firstRequest)) / 1000)
      }
    });
  }
  
  next();
}

