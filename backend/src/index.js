import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
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

// WebSocket handler
import { setupWebSocket } from './websocket/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// ✅ เพิ่ม body size limit เป็น 50MB เพื่อรองรับการอัพโหลดโค้ดจำนวนมาก
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Theme middleware
import { themeMiddleware } from './middleware/theme.js';
app.use(themeMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/users', usersRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/checkins', checkinsRoutes);
app.use('/api/answers', answersRoutes);
app.use('/api/presence', presenceRoutes);
app.use('/api/bingo', bingoRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/chat', chatRoutes);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

