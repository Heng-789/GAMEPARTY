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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io server ready`);
  console.log(`💾 Cache middleware enabled`);
  console.log(`🛡️  Rate limiting enabled`);
  console.log(`🌍 CORS enabled for: ${process.env.FRONTEND_URL || 'all origins'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

