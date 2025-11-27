/**
 * Socket.io Server สำหรับ Real-time Communication
 * แทนที่ WebSocket (ws) เดิมด้วย Socket.io เพื่อรองรับ features มากขึ้น
 */

import { Server } from 'socket.io';
import { getPool, getSchema } from '../config/database.js';
import { invalidateGameCache } from '../middleware/cache.js';
import { logSocketEmit } from '../middleware/bandwidthMonitor.js';

let io = null;

// Store subscriptions: { userId: Set<socketId>, gameId: Set<socketId> }
const subscriptions = {
  users: new Map(), // userId -> Set<socketId>
  games: new Map(), // gameId -> Set<socketId>
  checkins: new Map(), // `${gameId}_${userId}` -> Set<socketId>
  answers: new Map(), // gameId -> Set<socketId>
  bingo: new Map(), // gameId -> Set<socketId>
  chat: new Map(), // gameId -> Set<socketId>
};

// ✅ State cache for diff calculation (WebSocket optimization)
// Stores previous state to calculate diffs and reduce bandwidth
const stateCache = {
  games: new Map(), // gameId -> previous game data
  checkins: new Map(), // `${gameId}_${userId}` -> previous checkin data
};

/**
 * Calculate diff between two objects (shallow diff)
 * Returns object with only changed fields, or null if no changes
 */
function calculateDiff(oldObj, newObj) {
  if (!oldObj || !newObj) return null;
  if (oldObj === newObj) return null;
  
  const diff = {};
  let hasChanges = false;
  
  // Check all keys in new object
  for (const key in newObj) {
    if (newObj[key] !== oldObj[key]) {
      diff[key] = newObj[key];
      hasChanges = true;
    }
  }
  
  // Check for deleted keys
  for (const key in oldObj) {
    if (!(key in newObj)) {
      diff[key] = null; // Mark as deleted
      hasChanges = true;
    }
  }
  
  return hasChanges ? diff : null;
}

/**
 * Calculate diff for checkin data (only changed day)
 * Returns object with only changed day_index, or full data if structure changed
 */
function calculateCheckinDiff(oldCheckins, newCheckins) {
  if (!oldCheckins || !newCheckins) return null;
  
  // If structure is different (different keys), return full data
  const oldKeys = Object.keys(oldCheckins).sort();
  const newKeys = Object.keys(newCheckins).sort();
  if (oldKeys.length !== newKeys.length || oldKeys.join(',') !== newKeys.join(',')) {
    return null; // Structure changed, send full
  }
  
  // Find changed days
  const changedDays = {};
  let hasChanges = false;
  
  for (const dayIndex in newCheckins) {
    const oldDay = oldCheckins[dayIndex];
    const newDay = newCheckins[dayIndex];
    
    if (JSON.stringify(oldDay) !== JSON.stringify(newDay)) {
      changedDays[dayIndex] = newDay;
      hasChanges = true;
    }
  }
  
  return hasChanges ? changedDays : null;
}

/**
 * Initialize Socket.io server
 */
export function setupSocketIO(server) {
  // Parse FRONTEND_URL to support multiple domains
  const allowedOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
    : '*'; // Allow all origins in development
  
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'], // Support both
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket.io client connected: ${socket.id}`);
    
    // Try to detect theme from connection headers
    const detectThemeFromSocket = () => {
      const host = socket.handshake.headers.host || '';
      if (host.includes('max56')) return 'max56';
      if (host.includes('jeed24')) return 'jeed24';
      if (host.includes('heng36')) return 'heng36';
      return 'heng36'; // default
    };

    // Handle subscriptions
    socket.on('subscribe:user', async (data) => {
      const { userId, theme } = data;
      if (!userId) {
        console.warn(`[Socket] subscribe:user missing userId for socket ${socket.id}`);
        return;
      }
      
      // Use provided theme or detect from socket, default to heng36
      const finalTheme = theme || detectThemeFromSocket() || 'heng36';
      console.log(`[Socket] subscribe:user - userId=${userId}, theme=${finalTheme}`);
      
      const key = `${finalTheme}:${userId}`;
      if (!subscriptions.users.has(key)) {
        subscriptions.users.set(key, new Set());
      }
      subscriptions.users.get(key).add(socket.id);
      
      // Send initial data
      await sendUserData(socket, userId, finalTheme);
    });

    socket.on('subscribe:game', async (data) => {
      const { gameId, theme } = data;
      if (!gameId) {
        console.warn(`[Socket] subscribe:game missing gameId for socket ${socket.id}`);
        return;
      }
      
      // Use provided theme or detect from socket, default to heng36
      const finalTheme = theme || detectThemeFromSocket() || 'heng36';
      console.log(`[Socket] subscribe:game - gameId=${gameId}, theme=${finalTheme}`);
      
      if (!subscriptions.games.has(gameId)) {
        subscriptions.games.set(gameId, new Set());
      }
      subscriptions.games.get(gameId).add(socket.id);
      
      // Join room for easier broadcasting
      socket.join(`game:${gameId}`);
      
      // Send initial data
      await sendGameData(socket, gameId, finalTheme);
    });

    socket.on('subscribe:checkin', async (data) => {
      const { gameId, userId, theme } = data;
      if (!gameId || !userId) {
        console.warn(`[Socket] subscribe:checkin missing gameId or userId for socket ${socket.id}`);
        return;
      }
      
      const finalTheme = theme || detectThemeFromSocket() || 'heng36';
      const key = `${gameId}_${userId}`;
      if (!subscriptions.checkins.has(key)) {
        subscriptions.checkins.set(key, new Set());
      }
      subscriptions.checkins.get(key).add(socket.id);
      
      // Send initial data
      await sendCheckinData(socket, gameId, userId, finalTheme);
    });

    socket.on('subscribe:answers', async (data) => {
      const { gameId, theme } = data;
      if (!gameId) {
        console.warn(`[Socket] subscribe:answers missing gameId for socket ${socket.id}`);
        return;
      }
      
      const finalTheme = theme || detectThemeFromSocket() || 'heng36';
      if (!subscriptions.answers.has(gameId)) {
        subscriptions.answers.set(gameId, new Set());
      }
      subscriptions.answers.get(gameId).add(socket.id);
      
      // Join room
      socket.join(`answers:${gameId}`);
      
      // Send initial data
      await sendAnswerData(socket, gameId, finalTheme);
    });

    socket.on('subscribe:bingo', async (data) => {
      const { gameId, theme } = data;
      if (!gameId) {
        console.warn(`[Socket] subscribe:bingo missing gameId for socket ${socket.id}`);
        return;
      }
      
      const finalTheme = theme || detectThemeFromSocket() || 'heng36';
      if (!subscriptions.bingo.has(gameId)) {
        subscriptions.bingo.set(gameId, new Set());
      }
      subscriptions.bingo.get(gameId).add(socket.id);
      
      socket.join(`bingo:${gameId}`);
    });

    socket.on('subscribe:chat', async (data) => {
      const { gameId, theme } = data;
      if (!gameId) {
        console.warn(`[Socket] subscribe:chat missing gameId for socket ${socket.id}`);
        return;
      }
      
      const finalTheme = theme || detectThemeFromSocket() || 'heng36';
      if (!subscriptions.chat.has(gameId)) {
        subscriptions.chat.set(gameId, new Set());
      }
      subscriptions.chat.get(gameId).add(socket.id);
      
      socket.join(`chat:${gameId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`❌ Socket.io client disconnected: ${socket.id}`);
      cleanupSubscriptions(socket.id);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket.io error for ${socket.id}:`, error);
      cleanupSubscriptions(socket.id);
    });
  });

  console.log('✅ Socket.io server initialized');
  return io;
}

/**
 * Clean up subscriptions when socket disconnects
 */
function cleanupSubscriptions(socketId) {
  subscriptions.users.forEach((socketSet, key) => {
    socketSet.delete(socketId);
    if (socketSet.size === 0) subscriptions.users.delete(key);
  });
  subscriptions.games.forEach((socketSet, gameId) => {
    socketSet.delete(socketId);
    if (socketSet.size === 0) subscriptions.games.delete(gameId);
  });
  subscriptions.checkins.forEach((socketSet, key) => {
    socketSet.delete(socketId);
    if (socketSet.size === 0) subscriptions.checkins.delete(key);
  });
  subscriptions.answers.forEach((socketSet, gameId) => {
    socketSet.delete(socketId);
    if (socketSet.size === 0) subscriptions.answers.delete(gameId);
  });
  subscriptions.bingo.forEach((socketSet, gameId) => {
    socketSet.delete(socketId);
    if (socketSet.size === 0) subscriptions.bingo.delete(gameId);
  });
  subscriptions.chat.forEach((socketSet, gameId) => {
    socketSet.delete(socketId);
    if (socketSet.size === 0) subscriptions.chat.delete(gameId);
  });
}

/**
 * Send user data to a specific socket
 */
async function sendUserData(socket, userId, theme = 'heng36') {
  try {
    // Validate theme
    if (!theme || !['heng36', 'max56', 'jeed24'].includes(theme)) {
      console.warn(`Invalid theme "${theme}", defaulting to heng36`);
      theme = 'heng36';
    }
    
    const pool = getPool(theme);
    if (!pool) {
      console.error(`Database pool not found for theme: ${theme}`);
      return;
    }
    
    const schema = getSchema(theme);
    console.log(`[Socket] Fetching user data: userId=${userId}, theme=${theme}, schema=${schema}`);
    
    const result = await pool.query(
      `SELECT user_id, hcoin, status FROM ${schema}.users WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      socket.emit('user:updated', {
        userId: user.user_id,
        hcoin: user.hcoin,
        status: user.status
      });
    }
  } catch (error) {
    console.error('Error sending user data:', {
      error: error.message,
      code: error.code,
      userId,
      theme,
      stack: error.stack
    });
    // Emit error to client for debugging
    socket.emit('error', {
      type: 'user_data_error',
      message: error.message,
      code: error.code
    });
  }
}

/**
 * Send game data to a specific socket
 */
async function sendGameData(socket, gameId, theme = 'heng36') {
  try {
    // Validate theme
    if (!theme || !['heng36', 'max56', 'jeed24'].includes(theme)) {
      console.warn(`Invalid theme "${theme}", defaulting to heng36`);
      theme = 'heng36';
    }
    
    const pool = getPool(theme);
    if (!pool) {
      console.error(`Database pool not found for theme: ${theme}`);
      return;
    }
    
    const schema = getSchema(theme);
    console.log(`[Socket] Fetching game data: gameId=${gameId}, theme=${theme}, schema=${schema}`);
    
    const result = await pool.query(
      `SELECT * FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const game = {
        id: row.game_id,
        name: row.name,
        type: row.type,
        unlocked: row.unlocked,
        locked: row.locked,
        userAccessType: row.user_access_type,
        selectedUsers: row.selected_users,
        ...row.game_data,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      socket.emit('game:updated', game);
    }
  } catch (error) {
    console.error('Error sending game data:', {
      error: error.message,
      code: error.code,
      gameId,
      theme,
      stack: error.stack
    });
    // Emit error to client for debugging
    socket.emit('error', {
      type: 'game_data_error',
      message: error.message,
      code: error.code
    });
  }
}

/**
 * Send checkin data to a specific socket
 */
async function sendCheckinData(socket, gameId, userId, theme = 'heng36') {
  try {
    // Validate theme
    if (!theme || !['heng36', 'max56', 'jeed24'].includes(theme)) {
      console.warn(`Invalid theme "${theme}", defaulting to heng36`);
      theme = 'heng36';
    }
    
    const pool = getPool(theme);
    if (!pool) {
      console.error(`Database pool not found for theme: ${theme}`);
      return;
    }
    
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins 
       WHERE game_id = $1 AND user_id = $2 
       ORDER BY day_index ASC`,
      [gameId, userId]
    );
    
    // ✅ ส่งข้อมูลเป็น object โดยใช้ day_index เป็น key (เหมือน API)
    const checkins = {};
    result.rows.forEach((row) => {
      // ✅ ใช้ checkin_date ถ้ามี ถ้าไม่มีให้ใช้ created_at แปลงเป็น date key
      let checkinDate = row.checkin_date;
      if (!checkinDate && row.created_at) {
        // ✅ แปลง created_at เป็น date key (YYYY-MM-DD)
        const createdDate = new Date(row.created_at);
        const year = createdDate.getFullYear();
        const month = String(createdDate.getMonth() + 1).padStart(2, '0');
        const day = String(createdDate.getDate()).padStart(2, '0');
        checkinDate = `${year}-${month}-${day}`;
      }
      
      checkins[row.day_index] = {
        checked: row.checked,
        date: checkinDate,
        key: row.unique_key,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    
    socket.emit('checkin:updated', {
      gameId,
      userId,
      checkins
    });
  } catch (error) {
    console.error('Error sending checkin data:', {
      error: error.message,
      code: error.code,
      gameId,
      userId,
      theme,
      stack: error.stack
    });
  }
}

/**
 * Send answer data to a specific socket
 */
async function sendAnswerData(socket, gameId, theme = 'heng36', limit = 100) {
  try {
    // Validate theme
    if (!theme || !['heng36', 'max56', 'jeed24'].includes(theme)) {
      console.warn(`Invalid theme "${theme}", defaulting to heng36`);
      theme = 'heng36';
    }
    
    const pool = getPool(theme);
    if (!pool) {
      console.error(`Database pool not found for theme: ${theme}`);
      return;
    }
    
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT * FROM ${schema}.answers WHERE game_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [gameId, limit]
    );
    
    const answers = result.rows.map(row => {
      let answerData = row.answer;
      try {
        if (typeof answerData === 'string') {
          answerData = JSON.parse(answerData);
        }
      } catch (e) {
        // Keep as string if not JSON
      }
      
      return {
        id: row.answer_id,
        userId: row.user_id,
        answer: answerData,
        correct: row.correct,
        code: row.code,
        createdAt: row.created_at,
        action: answerData?.action,
        itemIndex: answerData?.itemIndex,
        price: answerData?.price,
        balanceBefore: answerData?.balanceBefore,
        balanceAfter: answerData?.balanceAfter,
      };
    });
    
    socket.emit('answer:updated', {
      gameId,
      answers
    });
  } catch (error) {
    console.error('Error sending answer data:', {
      error: error.message,
      code: error.code,
      gameId,
      theme,
      stack: error.stack
    });
  }
}

/**
 * Broadcast user update to all subscribed clients
 */
export function broadcastUserUpdate(theme, userId, userData) {
  if (!io) return;
  
  const key = `${theme || 'heng36'}:${userId}`;
  const socketSet = subscriptions.users.get(key);
  if (!socketSet) return;
  
  socketSet.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('user:updated', {
        userId,
        ...userData
      });
    }
  });
}

/**
 * Broadcast game update to all subscribed clients
 * ✅ Optimized: Sends only changed fields (diff) instead of full object when possible
 */
export function broadcastGameUpdate(theme, gameId, gameData) {
  if (!io) return;
  
  // Invalidate cache
  invalidateGameCache(theme, gameId);
  
  // ✅ Calculate diff to reduce bandwidth
  const previousData = stateCache.games.get(gameId);
  let payload = gameData;
  
  if (previousData && gameData && typeof gameData === 'object') {
    const diff = calculateDiff(previousData, gameData);
    if (diff) {
      // ✅ Send diff format: { gameId, changes: { field: value } }
      // Frontend can merge with existing state, or fall back to full object
      payload = {
        gameId,
        _diff: true, // Flag to indicate this is a diff
        changes: diff,
        // Include id for identification
        id: gameData.id || gameId
      };
    } else {
      // No changes, skip broadcast
      return;
    }
  }
  
  // Update cache
  if (gameData && typeof gameData === 'object') {
    stateCache.games.set(gameId, { ...gameData });
  }
  
  // ✅ Log bandwidth usage
  logSocketEmit('game:updated', payload);
  
  // Broadcast to room (more efficient)
  io.to(`game:${gameId}`).emit('game:updated', payload);
  
  // Also notify individual subscriptions
  const socketSet = subscriptions.games.get(gameId);
  if (socketSet) {
    socketSet.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('game:updated', payload);
      }
    });
  }
}

/**
 * Broadcast checkin update
 * ✅ Optimized: Sends only changed day(s) instead of full checkins object when possible
 */
export function broadcastCheckinUpdate(theme, gameId, userId, checkinData) {
  if (!io) return;
  
  const key = `${gameId}_${userId}`;
  const socketSet = subscriptions.checkins.get(key);
  if (!socketSet) return;
  
  // ✅ Calculate diff to reduce bandwidth
  const previousCheckins = stateCache.checkins.get(key);
  const newCheckins = checkinData.checkins;
  let payload = checkinData;
  
  if (previousCheckins && newCheckins && typeof newCheckins === 'object') {
    const diff = calculateCheckinDiff(previousCheckins, newCheckins);
    if (diff) {
      // ✅ Send diff format: { gameId, userId, changedDays: { dayIndex: checkin } }
      // Frontend can merge with existing state, or fall back to full object
      payload = {
        gameId,
        userId,
        _diff: true, // Flag to indicate this is a diff
        changedDays: diff
      };
    } else {
      // No changes, skip broadcast
      return;
    }
  }
  
  // Update cache
  if (newCheckins && typeof newCheckins === 'object') {
    stateCache.checkins.set(key, { ...newCheckins });
  }
  
  // ✅ Log bandwidth usage
  logSocketEmit('checkin:updated', payload);
  
  socketSet.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('checkin:updated', payload);
    }
  });
}

/**
 * Broadcast answer update
 */
export function broadcastAnswerUpdate(theme, gameId, answerData) {
  if (!io) return;
  
  const payload = {
    gameId,
    answers: [answerData]
  };
  
  // ✅ Log bandwidth usage
  logSocketEmit('answer:updated', payload);
  
  // Broadcast to room
  io.to(`answers:${gameId}`).emit('answer:updated', payload);
}

/**
 * Broadcast bingo update
 */
export function broadcastBingoUpdate(theme, gameId, event, data) {
  if (!io) return;
  
  io.to(`bingo:${gameId}`).emit(`bingo:${event}`, {
    gameId,
    ...data
  });
}

/**
 * Broadcast chat message
 */
export function broadcastChatMessage(theme, gameId, message) {
  if (!io) return;
  
  io.to(`chat:${gameId}`).emit('chat:message', {
    gameId,
    message
  });
}

/**
 * Get Socket.io instance
 */
export function getIO() {
  return io;
}

