import { WebSocketServer } from 'ws';
import { getPool, getSchema } from '../config/database.js';

let wss = null;

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
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('✅ WebSocket server initialized');
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
    default:
      ws.send(JSON.stringify({ error: 'Unknown message type' }));
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

export { wss };

