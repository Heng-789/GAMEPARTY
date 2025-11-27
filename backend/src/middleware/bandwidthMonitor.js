/**
 * Bandwidth Monitoring Middleware
 * 
 * Logs approximate payload sizes for HTTP responses and Socket.io emits
 * to help identify bandwidth-heavy endpoints and events.
 * 
 * Configuration:
 * - ENABLE_BANDWIDTH_MONITORING: Enable/disable monitoring (default: true in dev, false in prod)
 * - BANDWIDTH_LOG_THRESHOLD: Only log responses larger than this (bytes, default: 1024)
 */

const ENABLE_MONITORING = process.env.ENABLE_BANDWIDTH_MONITORING !== 'false' && 
                          (process.env.NODE_ENV === 'development' || process.env.ENABLE_BANDWIDTH_MONITORING === 'true');
const LOG_THRESHOLD = parseInt(process.env.BANDWIDTH_LOG_THRESHOLD) || 1024; // 1KB

// Statistics storage (in-memory, resets on restart)
const stats = {
  http: new Map(), // path -> { count, totalBytes, avgBytes }
  socket: new Map(), // event -> { count, totalBytes, avgBytes }
};

/**
 * Calculate approximate JSON size in bytes
 */
function estimateJsonSize(data) {
  if (!data) return 0;
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch (e) {
    return 0;
  }
}

/**
 * Update HTTP statistics
 */
function updateHttpStats(path, size) {
  if (!stats.http.has(path)) {
    stats.http.set(path, { count: 0, totalBytes: 0, avgBytes: 0 });
  }
  const stat = stats.http.get(path);
  stat.count++;
  stat.totalBytes += size;
  stat.avgBytes = Math.round(stat.totalBytes / stat.count);
}

/**
 * Update Socket.io statistics
 */
function updateSocketStats(event, size) {
  if (!stats.socket.has(event)) {
    stats.socket.set(event, { count: 0, totalBytes: 0, avgBytes: 0 });
  }
  const stat = stats.socket.get(event);
  stat.count++;
  stat.totalBytes += size;
  stat.avgBytes = Math.round(stat.totalBytes / stat.count);
}

/**
 * HTTP bandwidth monitoring middleware
 */
export function bandwidthMonitorMiddleware(req, res, next) {
  if (!ENABLE_MONITORING) {
    return next();
  }
  
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override res.json to measure size
  res.json = function(data) {
    const size = estimateJsonSize(data);
    const path = req.path;
    
    // Update statistics
    updateHttpStats(path, size);
    
    // Log if above threshold
    if (size >= LOG_THRESHOLD) {
      console.log(`[Bandwidth] ${req.method} ${path}: ~${(size / 1024).toFixed(2)} KB`);
    }
    
    // Call original json method
    return originalJson(data);
  };
  
  next();
}

/**
 * Log Socket.io emit size
 */
export function logSocketEmit(event, data) {
  if (!ENABLE_MONITORING) {
    return;
  }
  
  const size = estimateJsonSize(data);
  
  // Update statistics
  updateSocketStats(event, size);
  
  // Log if above threshold
  if (size >= LOG_THRESHOLD) {
    console.log(`[Bandwidth] Socket.io ${event}: ~${(size / 1024).toFixed(2)} KB`);
  }
}

/**
 * Get bandwidth statistics
 */
export function getBandwidthStats() {
  return {
    http: Object.fromEntries(stats.http),
    socket: Object.fromEntries(stats.socket),
    timestamp: new Date().toISOString()
  };
}

/**
 * Print top bandwidth consumers
 */
export function printTopBandwidthConsumers() {
  if (!ENABLE_MONITORING) return;
  
  console.log('\n📊 Top HTTP Bandwidth Consumers:');
  const httpEntries = Array.from(stats.http.entries())
    .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
    .slice(0, 10);
  
  httpEntries.forEach(([path, stat]) => {
    console.log(`  ${path}: ${(stat.totalBytes / 1024).toFixed(2)} KB (${stat.count} requests, avg: ${(stat.avgBytes / 1024).toFixed(2)} KB)`);
  });
  
  console.log('\n📊 Top Socket.io Bandwidth Consumers:');
  const socketEntries = Array.from(stats.socket.entries())
    .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
    .slice(0, 10);
  
  socketEntries.forEach(([event, stat]) => {
    console.log(`  ${event}: ${(stat.totalBytes / 1024).toFixed(2)} KB (${stat.count} emits, avg: ${(stat.avgBytes / 1024).toFixed(2)} KB)`);
  });
  console.log('');
}

// Print stats every 5 minutes in development
if (ENABLE_MONITORING && process.env.NODE_ENV === 'development') {
  setInterval(printTopBandwidthConsumers, 5 * 60 * 1000);
}

