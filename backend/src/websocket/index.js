import { WebSocketServer } from 'ws';
import { getPool, getSchema } from '../config/database.js';

let wss = null;

// Store subscriptions: { userId: Set<ws>, gameId: Set<ws>, checkin: { gameId_userId: Set<ws> } }
const subscriptions = {
  users: new Map(), // userId -> Set<ws>
  games: new Map(), // gameId -> Set<ws>
  checkins: new Map(), // `${gameId}_${userId}` -> Set<ws>
  answers: new Map(), // gameId -> Set<ws>
};

export function setupWebSocket(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log('✅ WebSocket client connected');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        await handleWebSocketMessage(ws, data);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      console.log('❌ WebSocket client disconnected');
      // Clean up subscriptions
      cleanupSubscriptions(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      cleanupSubscriptions(ws);
    });
  });

  console.log('✅ WebSocket server initialized');
}

function cleanupSubscriptions(ws) {
  // Remove from all subscriptions
  subscriptions.users.forEach((wsSet, userId) => {
    wsSet.delete(ws);
    if (wsSet.size === 0) subscriptions.users.delete(userId);
  });
  subscriptions.games.forEach((wsSet, gameId) => {
    wsSet.delete(ws);
    if (wsSet.size === 0) subscriptions.games.delete(gameId);
  });
  subscriptions.checkins.forEach((wsSet, key) => {
    wsSet.delete(ws);
    if (wsSet.size === 0) subscriptions.checkins.delete(key);
  });
  subscriptions.answers.forEach((wsSet, gameId) => {
    wsSet.delete(ws);
    if (wsSet.size === 0) subscriptions.answers.delete(gameId);
  });
}

async function handleWebSocketMessage(ws, data) {
  const { type, payload } = data;

  switch (type) {
    case 'presence:join':
      await handlePresenceJoin(ws, payload);
      break;
    case 'presence:leave':
      await handlePresenceLeave(ws, payload);
      break;
    case 'presence:update':
      await handlePresenceUpdate(ws, payload);
      break;
    case 'bingo:card:update':
      await handleBingoCardUpdate(ws, payload);
      break;
    case 'bingo:game:state':
      await handleBingoGameState(ws, payload);
      break;
    case 'user:subscribe':
      await handleUserSubscribe(ws, payload);
      break;
    case 'checkin:subscribe':
      await handleCheckinSubscribe(ws, payload);
      break;
    case 'game:subscribe':
      await handleGameSubscribe(ws, payload);
      break;
    case 'answer:subscribe':
      await handleAnswerSubscribe(ws, payload);
      break;
    default:
      ws.send(JSON.stringify({ error: 'Unknown message type' }));
  }
}

async function handleUserSubscribe(ws, payload) {
  const { userId, theme } = payload;
  if (!userId) return;
  
  if (!subscriptions.users.has(userId)) {
    subscriptions.users.set(userId, new Set());
  }
  subscriptions.users.get(userId).add(ws);
  
  // Send initial data
  await sendUserData(ws, userId, theme || 'heng36');
}

async function handleCheckinSubscribe(ws, payload) {
  const { gameId, userId, theme } = payload;
  if (!gameId || !userId) return;
  
  const key = `${gameId}_${userId}`;
  if (!subscriptions.checkins.has(key)) {
    subscriptions.checkins.set(key, new Set());
  }
  subscriptions.checkins.get(key).add(ws);
  
  // Send initial data
  await sendCheckinData(ws, gameId, userId, theme || 'heng36');
}

async function handleGameSubscribe(ws, payload) {
  const { gameId, theme } = payload;
  if (!gameId) return;
  
  if (!subscriptions.games.has(gameId)) {
    subscriptions.games.set(gameId, new Set());
  }
  subscriptions.games.get(gameId).add(ws);
  
  // Send initial data
  await sendGameData(ws, gameId, theme || 'heng36');
}

async function handleAnswerSubscribe(ws, payload) {
  const { gameId, theme, limit } = payload;
  if (!gameId) return;
  
  if (!subscriptions.answers.has(gameId)) {
    subscriptions.answers.set(gameId, new Set());
  }
  subscriptions.answers.get(gameId).add(ws);
  
  // Send initial data
  await sendAnswerData(ws, gameId, theme || 'heng36', limit || 100);
}

async function sendUserData(ws, userId, theme = 'heng36') {
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT user_id, hcoin, status FROM ${schema}.users WHERE user_id = $1`,
      [userId]
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      ws.send(JSON.stringify({
        type: 'user:updated',
        payload: {
          userId: row.user_id,
          hcoin: Number(row.hcoin),
          status: row.status,
        },
      }));
    }
  } catch (error) {
    console.error('Error sending user data:', error);
  }
}

async function sendCheckinData(ws, gameId, userId, theme = 'heng36') {
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2
       ORDER BY day_index ASC`,
      [gameId, userId]
    );
    
    const checkins = {};
    result.rows.forEach((row) => {
      checkins[row.day_index] = {
        checked: row.checked,
        date: row.checkin_date,
        key: row.unique_key,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    
    ws.send(JSON.stringify({
      type: 'checkin:updated',
      payload: {
        gameId,
        userId,
        checkins,
      },
    }));
  } catch (error) {
    console.error('Error sending checkin data:', error);
  }
}

async function sendGameData(ws, gameId, theme = 'heng36') {
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT * FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      ws.send(JSON.stringify({
        type: 'game:updated',
        payload: {
          gameId: row.game_id,
          gameData: {
            id: row.game_id,
            name: row.name,
            type: row.type,
            ...row.game_data,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        },
      }));
    }
  } catch (error) {
    console.error('Error sending game data:', error);
  }
}

async function sendAnswerData(ws, gameId, theme = 'heng36', limit = 100) {
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT id, game_id, user_id, answer, correct, code, created_at
       FROM ${schema}.answers
       WHERE game_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [gameId, limit]
    );
    
    const answers = result.rows.map((row) => {
      let answerData = row.answer;
      let action;
      let itemIndex;
      let price;
      let balanceBefore;
      let balanceAfter;
      
      try {
        const parsed = JSON.parse(row.answer);
        if (parsed && typeof parsed === 'object') {
          answerData = parsed.text || parsed.answer || row.answer;
          action = parsed.action;
          itemIndex = parsed.itemIndex;
          price = parsed.price;
          balanceBefore = parsed.balanceBefore;
          balanceAfter = parsed.balanceAfter;
        }
      } catch (e) {
        answerData = row.answer;
      }
      
      return {
        id: row.id.toString(),
        gameId: row.game_id,
        userId: row.user_id,
        answer: answerData,
        correct: row.correct || false,
        code: row.code || null,
        ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        createdAt: row.created_at,
        action,
        itemIndex,
        price,
        balanceBefore,
        balanceAfter,
      };
    });
    
    ws.send(JSON.stringify({
      type: 'answer:updated',
      payload: {
        gameId,
        answers,
      },
    }));
  } catch (error) {
    console.error('Error sending answer data:', error);
  }
}

async function handlePresenceJoin(ws, payload) {
  const { gameId, roomId, userId, username, theme } = payload;
  const themeName = theme || 'heng36';
  const pool = getPool(themeName);
  const schema = getSchema(themeName);
  
  try {
    await pool.query(
      `INSERT INTO ${schema}.presence (game_id, room_id, user_id, username, status, last_seen, joined_at, is_in_room)
       VALUES ($1, $2, $3, $4, 'online', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)
       ON CONFLICT (game_id, room_id, user_id)
       DO UPDATE SET
         status = 'online',
         last_seen = CURRENT_TIMESTAMP,
         is_in_room = true,
         joined_at = CURRENT_TIMESTAMP`,
      [gameId, roomId, userId, username]
    );

    // Broadcast to all clients in the room
    broadcastToRoom(gameId, roomId, {
      type: 'presence:updated',
      payload: { gameId, roomId, userId, username, status: 'online' },
    });

    ws.send(JSON.stringify({ type: 'presence:joined', success: true }));
  } catch (error) {
    console.error('Error joining presence:', error);
    ws.send(JSON.stringify({ type: 'presence:error', error: error.message }));
  }
}

async function handlePresenceLeave(ws, payload) {
  const { gameId, roomId, userId, theme } = payload;
  const themeName = theme || 'heng36';
  const pool = getPool(themeName);
  const schema = getSchema(themeName);
  
  try {
    await pool.query(
      `UPDATE ${schema}.presence
       SET status = 'offline', is_in_room = false, last_seen = CURRENT_TIMESTAMP
       WHERE game_id = $1 AND room_id = $2 AND user_id = $3`,
      [gameId, roomId, userId]
    );

    broadcastToRoom(gameId, roomId, {
      type: 'presence:updated',
      payload: { gameId, roomId, userId, status: 'offline' },
    });

    ws.send(JSON.stringify({ type: 'presence:left', success: true }));
  } catch (error) {
    console.error('Error leaving presence:', error);
    ws.send(JSON.stringify({ type: 'presence:error', error: error.message }));
  }
}

async function handlePresenceUpdate(ws, payload) {
  const { gameId, roomId, userId, status, theme } = payload;
  const themeName = theme || 'heng36';
  const pool = getPool(themeName);
  const schema = getSchema(themeName);
  
  try {
    await pool.query(
      `UPDATE ${schema}.presence
       SET status = $1, last_seen = CURRENT_TIMESTAMP
       WHERE game_id = $2 AND room_id = $3 AND user_id = $4`,
      [status, gameId, roomId, userId]
    );

    broadcastToRoom(gameId, roomId, {
      type: 'presence:updated',
      payload: { gameId, roomId, userId, status },
    });

    ws.send(JSON.stringify({ type: 'presence:updated', success: true }));
  } catch (error) {
    console.error('Error updating presence:', error);
    ws.send(JSON.stringify({ type: 'presence:error', error: error.message }));
  }
}

async function handleBingoCardUpdate(ws, payload) {
  const { gameId, userId, cardId, checkedNumbers, theme } = payload;
  const themeName = theme || 'heng36';
  const pool = getPool(themeName);
  const schema = getSchema(themeName);
  
  try {
    await pool.query(
      `UPDATE ${schema}.bingo_cards
       SET checked_numbers = $1
       WHERE game_id = $2 AND user_id = $3 AND card_id = $4`,
      [JSON.stringify(checkedNumbers), gameId, userId, cardId]
    );

    broadcastToGame(gameId, {
      type: 'bingo:card:updated',
      payload: { gameId, userId, cardId, checkedNumbers },
    });

    ws.send(JSON.stringify({ type: 'bingo:card:updated', success: true }));
  } catch (error) {
    console.error('Error updating bingo card:', error);
    ws.send(JSON.stringify({ type: 'bingo:error', error: error.message }));
  }
}

async function handleBingoGameState(ws, payload) {
  const { gameId, action, data, theme } = payload;
  const themeName = theme || 'heng36';
  const pool = getPool(themeName);
  const schema = getSchema(themeName);
  
  try {
    if (action === 'get') {
      const result = await pool.query(
        `SELECT * FROM ${schema}.bingo_game_state WHERE game_id = $1`,
        [gameId]
      );

      if (result.rows.length > 0) {
        const state = result.rows[0];
        ws.send(JSON.stringify({
          type: 'bingo:game:state',
          payload: {
            gameId,
            gamePhase: state.game_phase,
            drawnNumbers: state.drawn_numbers,
            currentNumber: state.current_number,
            gameStarted: state.game_started,
            readyCountdown: state.ready_countdown,
            readyCountdownEnd: state.ready_countdown_end,
            readyPlayers: state.ready_players,
            autoDrawInterval: state.auto_draw_interval,
          },
        }));
      }
    } else if (action === 'update') {
      // Update game state logic here
      broadcastToGame(gameId, {
        type: 'bingo:game:state:updated',
        payload: { gameId, ...data },
      });
    }
  } catch (error) {
    console.error('Error handling bingo game state:', error);
    ws.send(JSON.stringify({ type: 'bingo:error', error: error.message }));
  }
}

function broadcastToRoom(gameId, roomId, message) {
  if (!wss) return;
  
  const messageStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
    }
  });
}

function broadcastToGame(gameId, message) {
  if (!wss) return;
  
  const messageStr = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(messageStr);
    }
  });
}

// Broadcast user update to all subscribers
export function broadcastUserUpdate(userId, userData, theme = 'heng36') {
  const wsSet = subscriptions.users.get(userId);
  if (!wsSet) return;
  
  const message = JSON.stringify({
    type: 'user:updated',
    payload: {
      userId,
      hcoin: userData.hcoin,
      status: userData.status,
    },
  });
  
  wsSet.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  });
}

// Broadcast checkin update to all subscribers
export function broadcastCheckinUpdate(gameId, userId, checkins, theme = 'heng36') {
  const key = `${gameId}_${userId}`;
  const wsSet = subscriptions.checkins.get(key);
  if (!wsSet) return;
  
  const message = JSON.stringify({
    type: 'checkin:updated',
    payload: {
      gameId,
      userId,
      checkins,
    },
  });
  
  wsSet.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  });
}

// Broadcast game update to all subscribers
export function broadcastGameUpdate(gameId, gameData, theme = 'heng36') {
  const wsSet = subscriptions.games.get(gameId);
  if (!wsSet) return;
  
  const message = JSON.stringify({
    type: 'game:updated',
    payload: {
      gameId,
      gameData,
    },
  });
  
  wsSet.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(message);
    }
  });
}

// Broadcast answer update to all subscribers
export async function broadcastAnswerUpdate(gameId, theme = 'heng36', limit = 100) {
  const wsSet = subscriptions.answers.get(gameId);
  if (!wsSet) return;
  
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT id, game_id, user_id, answer, correct, code, created_at
       FROM ${schema}.answers
       WHERE game_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [gameId, limit]
    );
    
    const answers = result.rows.map((row) => {
      let answerData = row.answer;
      let action;
      let itemIndex;
      let price;
      let balanceBefore;
      let balanceAfter;
      
      try {
        const parsed = JSON.parse(row.answer);
        if (parsed && typeof parsed === 'object') {
          answerData = parsed.text || parsed.answer || row.answer;
          action = parsed.action;
          itemIndex = parsed.itemIndex;
          price = parsed.price;
          balanceBefore = parsed.balanceBefore;
          balanceAfter = parsed.balanceAfter;
        }
      } catch (e) {
        answerData = row.answer;
      }
      
      return {
        id: row.id.toString(),
        gameId: row.game_id,
        userId: row.user_id,
        answer: answerData,
        correct: row.correct || false,
        code: row.code || null,
        ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        createdAt: row.created_at,
        action,
        itemIndex,
        price,
        balanceBefore,
        balanceAfter,
      };
    });
    
    const message = JSON.stringify({
      type: 'answer:updated',
      payload: {
        gameId,
        answers,
      },
    });
    
    wsSet.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    });
  } catch (error) {
    console.error('Error broadcasting answer update:', error);
  }
}

export { wss };

