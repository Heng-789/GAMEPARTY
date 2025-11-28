import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';

// Routes
import usersRoutes from './routes/users.js';
import gamesRoutes from './routes/games.js';
import checkinsRoutes from './routes/checkins.js';
import answersRoutes from './routes/answers.js';
import presenceRoutes from './routes/presence.js';
import bingoRoutes from './routes/bingo.js';
import coinRoutes from './routes/coins.js';
import utilsRoutes from './routes/utils.js';
import chatRoutes from './routes/chat.js';

// Socket.io handler (แทนที่ WebSocket เดิม)
import { setupSocketIO } from './socket/index.js';

// Middleware
import { cacheMiddleware } from './middleware/cache.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { compressionMiddleware } from './middleware/compression.js';
import { cacheHeadersMiddleware } from './middleware/cacheHeaders.js';
import { bandwidthMonitorMiddleware } from './middleware/bandwidthMonitor.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : '*', // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Theme']
};

// Middleware
app.use(cors(corsOptions));
// ✅ Request logging & monitoring (must be early to capture all requests)
app.use(requestLoggerMiddleware);
// ✅ Response compression (gzip/brotli) - reduces bandwidth by 60-80%
// Configure via: ENABLE_COMPRESSION, COMPRESSION_THRESHOLD, COMPRESSION_LEVEL
app.use(compressionMiddleware);
// ✅ HTTP caching headers (Cache-Control, ETag) - enables client-side caching
// Configure via: CACHE_DURATION_STATIC, CACHE_DURATION_DYNAMIC, CACHE_DURATION_USER
app.use(cacheHeadersMiddleware);
// ✅ Bandwidth monitoring - logs payload sizes for optimization analysis
// Configure via: ENABLE_BANDWIDTH_MONITORING, BANDWIDTH_LOG_THRESHOLD
app.use(bandwidthMonitorMiddleware);
// ✅ เพิ่ม body size limit เป็น 50MB เพื่อรองรับการอัพโหลดโค้ดจำนวนมาก
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Theme middleware
import { themeMiddleware } from './middleware/theme.js';
app.use(themeMiddleware);

// Rate limiting (apply before routes)
app.use(rateLimitMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/users', usersRoutes);
// ✅ Apply caching middleware to games routes (GET requests only)
app.use('/api/games', cacheMiddleware, gamesRoutes);
app.use('/api/checkins', checkinsRoutes);
app.use('/api/answers', answersRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/bingo', bingoRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/chat', chatRoutes);

// Create HTTP server
const server = createServer(app);

// Setup Socket.io (แทนที่ WebSocket เดิม)
setupSocketIO(server);

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Import database health check
import { checkDatabaseConnections } from './config/database.js';
// Import Upstash Redis initialization
import { initUpstashRedis, checkRedisHealth } from './cache/upstashClient.js';
// Import snapshot engine
import { startSnapshotEngine } from './snapshot/snapshotEngine.js';

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io server ready`);
  console.log(`💾 Cache middleware enabled`);
  console.log(`🛡️  Rate limiting enabled`);
  console.log(`🗜️  Compression enabled (threshold: ${process.env.COMPRESSION_THRESHOLD || 1024} bytes)`);
  console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || 'all origins'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize Upstash Redis
  console.log(`\n🔍 Initializing Upstash Redis...`);
  initUpstashRedis();
  
  // Wait a bit for Redis to connect
  setTimeout(async () => {
    const redisHealth = await checkRedisHealth();
    if (redisHealth.connected) {
      console.log(`✅ Upstash Redis connected (latency: ${redisHealth.latency})`);
    } else {
      console.log(`⚠️  Upstash Redis unavailable, using in-memory cache fallback`);
    }
  }, 1000);
  
  // Check database connections on startup
  console.log(`\n🔍 Checking database connections...`);
  const dbHealth = await checkDatabaseConnections();
  const healthyConnections = Object.values(dbHealth).filter(r => r.connected).length;
  const totalConnections = Object.keys(dbHealth).length;
  console.log(`✅ Database connections: ${healthyConnections}/${totalConnections} healthy\n`);
  
  // Start snapshot engine
  startSnapshotEngine();
  
  console.log(`🔄 Snapshot engine started\n`);
});

