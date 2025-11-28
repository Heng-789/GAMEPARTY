/**
 * Request Logging & Monitoring Middleware
 * 
 * Logs:
 * - Request/Response payload sizes
 * - Database query duration
 * - API latency
 * - Identifies bottlenecks
 */

// In-memory metrics (can be exported to monitoring service)
const metrics = {
  requests: {
    total: 0,
    byMethod: {},
    byPath: {},
    errors: 0,
  },
  bandwidth: {
    requestBytes: 0,
    responseBytes: 0,
  },
  latency: {
    total: 0,
    count: 0,
    min: Infinity,
    max: 0,
  },
  database: {
    queries: 0,
    totalDuration: 0,
    slowQueries: [],
  },
};

// Configuration
const LOG_THRESHOLD = parseInt(process.env.LOG_THRESHOLD) || 1000; // Log requests > 1KB
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD) || 500; // Log queries > 500ms
const ENABLE_DETAILED_LOGGING = process.env.ENABLE_DETAILED_LOGGING === 'true';

/**
 * Calculate payload size
 */
function getPayloadSize(obj) {
  if (!obj) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
  } catch (error) {
    return 0;
  }
}

/**
 * Request logger middleware
 */
export function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Calculate request size
  const requestSize = getPayloadSize(req.body) + 
                      getPayloadSize(req.query) + 
                      (req.headers['content-length'] ? parseInt(req.headers['content-length']) : 0);
  
  // Store original methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);
  
  let responseSize = 0;
  let responseData = null;
  
  // Override response methods to capture size
  res.json = function(data) {
    responseData = data;
    responseSize = getPayloadSize(data);
    return originalJson(data);
  };
  
  res.send = function(data) {
    responseSize = typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : getPayloadSize(data);
    return originalSend(data);
  };
  
  res.end = function(data) {
    if (data) {
      responseSize += Buffer.byteLength(data, 'utf8');
    }
    return originalEnd(data);
  };
  
  // Log after response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const latency = duration;
    
    // Update metrics
    metrics.requests.total++;
    metrics.requests.byMethod[req.method] = (metrics.requests.byMethod[req.method] || 0) + 1;
    metrics.requests.byPath[req.path] = (metrics.requests.byPath[req.path] || 0) + 1;
    
    if (res.statusCode >= 400) {
      metrics.requests.errors++;
    }
    
    metrics.bandwidth.requestBytes += requestSize;
    metrics.bandwidth.responseBytes += responseSize;
    
    metrics.latency.total += latency;
    metrics.latency.count++;
    if (latency < metrics.latency.min) metrics.latency.min = latency;
    if (latency > metrics.latency.max) metrics.latency.max = latency;
    
    // Log if exceeds threshold
    if (requestSize > LOG_THRESHOLD || responseSize > LOG_THRESHOLD || latency > 1000) {
      console.log(`[Request] ${req.method} ${req.path}`, {
        requestId,
        status: res.statusCode,
        requestSize: `${(requestSize / 1024).toFixed(2)}KB`,
        responseSize: `${(responseSize / 1024).toFixed(2)}KB`,
        latency: `${latency}ms`,
        cache: res.get('X-Cache') || 'N/A',
      });
    }
    
    // Detailed logging
    if (ENABLE_DETAILED_LOGGING) {
      console.log(`[Request Detail] ${req.method} ${req.path}`, {
        requestId,
        query: req.query,
        params: req.params,
        bodySize: requestSize,
        responseSize,
        latency,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
    }
  });
  
  next();
}

/**
 * Database query logger wrapper
 */
export function logDatabaseQuery(query, params, duration) {
  metrics.database.queries++;
  metrics.database.totalDuration += duration;
  
  if (duration > SLOW_QUERY_THRESHOLD) {
    metrics.database.slowQueries.push({
      query: query.substring(0, 200), // Truncate long queries
      duration,
      timestamp: Date.now(),
    });
    
    // Keep only last 100 slow queries
    if (metrics.database.slowQueries.length > 100) {
      metrics.database.slowQueries.shift();
    }
    
    console.warn(`[DB Slow Query] ${duration}ms:`, query.substring(0, 200));
  }
}

/**
 * Get metrics
 */
export function getMetrics() {
  const avgLatency = metrics.latency.count > 0 
    ? metrics.latency.total / metrics.latency.count 
    : 0;
  
  const avgQueryDuration = metrics.database.queries > 0
    ? metrics.database.totalDuration / metrics.database.queries
    : 0;
  
  return {
    requests: {
      ...metrics.requests,
      errorRate: metrics.requests.total > 0 
        ? ((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2) + '%'
        : '0%',
    },
    bandwidth: {
      ...metrics.bandwidth,
      requestMB: (metrics.bandwidth.requestBytes / 1024 / 1024).toFixed(2),
      responseMB: (metrics.bandwidth.responseBytes / 1024 / 1024).toFixed(2),
      totalMB: ((metrics.bandwidth.requestBytes + metrics.bandwidth.responseBytes) / 1024 / 1024).toFixed(2),
    },
    latency: {
      ...metrics.latency,
      avg: avgLatency.toFixed(2),
      min: metrics.latency.min === Infinity ? 0 : metrics.latency.min,
    },
    database: {
      ...metrics.database,
      avgDuration: avgQueryDuration.toFixed(2),
      slowQueriesCount: metrics.database.slowQueries.length,
    },
  };
}

/**
 * Reset metrics
 */
export function resetMetrics() {
  metrics.requests = {
    total: 0,
    byMethod: {},
    byPath: {},
    errors: 0,
  };
  metrics.bandwidth = {
    requestBytes: 0,
    responseBytes: 0,
  };
  metrics.latency = {
    total: 0,
    count: 0,
    min: Infinity,
    max: 0,
  };
  metrics.database = {
    queries: 0,
    totalDuration: 0,
    slowQueries: [],
  };
}

export { metrics };

