import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// Get bingo cards
router.get('/:gameId/cards', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.query;
    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);

    let query = `SELECT * FROM ${schema}.bingo_cards WHERE game_id = $1`;
    const params = [gameId];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const cards = result.rows.map((row) => ({
      id: row.card_id,
      numbers: row.numbers,
      userId: row.user_id,
      checkedNumbers: row.checked_numbers,
      isBingo: row.is_bingo,
      createdAt: new Date(row.created_at).getTime(),
    }));

    res.json(cards);
  } catch (error) {
    console.error('Error fetching bingo cards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create bingo card
router.post('/:gameId/cards', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId, numbers } = req.body;

    if (!userId || !numbers) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const cardId = randomUUID();
    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);

    const result = await pool.query(
      `INSERT INTO ${schema}.bingo_cards (game_id, user_id, card_id, numbers, checked_numbers, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [gameId, userId, cardId, JSON.stringify(numbers), JSON.stringify(Array(5).fill(null).map(() => Array(5).fill(false)))]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.card_id,
      numbers: row.numbers,
      userId: row.user_id,
      checkedNumbers: row.checked_numbers,
      isBingo: row.is_bingo,
      createdAt: new Date(row.created_at).getTime(),
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Card already exists' });
    }
    console.error('Error creating bingo card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update bingo card
router.put('/:gameId/cards/:cardId', async (req, res) => {
  try {
    const { gameId, cardId } = req.params;
    const { checkedNumbers, isBingo } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (checkedNumbers !== undefined) {
      updates.push(`checked_numbers = $${paramIndex++}`);
      values.push(JSON.stringify(checkedNumbers));
    }
    if (isBingo !== undefined) {
      updates.push(`is_bingo = $${paramIndex++}`);
      values.push(isBingo);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(gameId, cardId);
    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);
    const query = `
      UPDATE ${schema}.bingo_cards
      SET ${updates.join(', ')}
      WHERE game_id = $${paramIndex} AND card_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.card_id,
      numbers: row.numbers,
      userId: row.user_id,
      checkedNumbers: row.checked_numbers,
      isBingo: row.is_bingo,
      createdAt: new Date(row.created_at).getTime(),
    });
  } catch (error) {
    console.error('Error updating bingo card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get players
router.get('/:gameId/players', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT user_id, username, credit, joined_at, is_ready
       FROM ${schema}.bingo_players
       WHERE game_id = $1
       ORDER BY joined_at ASC`,
      [gameId]
    );

    const players = result.rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      credit: row.credit,
      joinedAt: new Date(row.joined_at).getTime(),
      isReady: row.is_ready,
    }));

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join game
router.post('/:gameId/players', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId, username, credit = 0 } = req.body;

    if (!userId || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `INSERT INTO ${schema}.bingo_players (game_id, user_id, username, credit, joined_at, is_ready)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, false)
       ON CONFLICT (game_id, user_id)
       DO UPDATE SET
         username = $3,
         credit = $4
       RETURNING *`,
      [gameId, userId, username, credit]
    );

    const row = result.rows[0];
    res.status(201).json({
      userId: row.user_id,
      username: row.username,
      credit: row.credit,
      joinedAt: new Date(row.joined_at).getTime(),
      isReady: row.is_ready,
    });
  } catch (error) {
    console.error('Error joining game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update player ready status
router.put('/:gameId/players/:userId/ready', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const { isReady } = req.body;

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `UPDATE ${schema}.bingo_players
       SET is_ready = $1
       WHERE game_id = $2 AND user_id = $3
       RETURNING *`,
      [isReady, gameId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const row = result.rows[0];
    res.json({
      userId: row.user_id,
      username: row.username,
      credit: row.credit,
      joinedAt: new Date(row.joined_at).getTime(),
      isReady: row.is_ready,
    });
  } catch (error) {
    console.error('Error updating player ready status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get game state
router.get('/:gameId/state', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT * FROM ${schema}.bingo_game_state WHERE game_id = $1`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.json({
        gameId,
        gamePhase: 'waiting',
        drawnNumbers: [],
        currentNumber: null,
        gameStarted: false,
        readyCountdown: null,
        readyCountdownEnd: null,
        readyPlayers: {},
        autoDrawInterval: null,
      });
    }

    const row = result.rows[0];
    res.json({
      gameId: row.game_id,
      gamePhase: row.game_phase,
      drawnNumbers: row.drawn_numbers,
      currentNumber: row.current_number,
      gameStarted: row.game_started,
      readyCountdown: row.ready_countdown,
      readyCountdownEnd: row.ready_countdown_end ? new Date(row.ready_countdown_end).getTime() : null,
      readyPlayers: row.ready_players,
      autoDrawInterval: row.auto_draw_interval,
      updatedAt: new Date(row.updated_at).getTime(),
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update game state
router.put('/:gameId/state', async (req, res) => {
  try {
    const { gameId } = req.params;
    const {
      gamePhase,
      drawnNumbers,
      currentNumber,
      gameStarted,
      readyCountdown,
      readyCountdownEnd,
      readyPlayers,
      autoDrawInterval,
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (gamePhase !== undefined) {
      updates.push(`game_phase = $${paramIndex++}`);
      values.push(gamePhase);
    }
    if (drawnNumbers !== undefined) {
      updates.push(`drawn_numbers = $${paramIndex++}`);
      values.push(JSON.stringify(drawnNumbers));
    }
    if (currentNumber !== undefined) {
      updates.push(`current_number = $${paramIndex++}`);
      values.push(currentNumber);
    }
    if (gameStarted !== undefined) {
      updates.push(`game_started = $${paramIndex++}`);
      values.push(gameStarted);
    }
    if (readyCountdown !== undefined) {
      updates.push(`ready_countdown = $${paramIndex++}`);
      values.push(readyCountdown);
    }
    if (readyCountdownEnd !== undefined) {
      updates.push(`ready_countdown_end = $${paramIndex++}`);
      values.push(readyCountdownEnd ? new Date(readyCountdownEnd) : null);
    }
    if (readyPlayers !== undefined) {
      updates.push(`ready_players = $${paramIndex++}`);
      values.push(JSON.stringify(readyPlayers));
    }
    if (autoDrawInterval !== undefined) {
      updates.push(`auto_draw_interval = $${paramIndex++}`);
      values.push(autoDrawInterval);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(gameId);
    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);
    const query = `
      INSERT INTO ${schema}.bingo_game_state (game_id, ${updates.map((_, i) => {
        const field = updates[i].split(' = ')[0];
        return field;
      }).join(', ')}, updated_at)
      VALUES ($${paramIndex}, ${updates.map((_, i) => `$${i + 1}`).join(', ')}, CURRENT_TIMESTAMP)
      ON CONFLICT (game_id)
      DO UPDATE SET ${updates.map((update, i) => `${update.split(' = ')[0]} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(query, values);

    const row = result.rows[0];
    res.json({
      gameId: row.game_id,
      gamePhase: row.game_phase,
      drawnNumbers: row.drawn_numbers,
      currentNumber: row.current_number,
      gameStarted: row.game_started,
      readyCountdown: row.ready_countdown,
      readyCountdownEnd: row.ready_countdown_end ? new Date(row.ready_countdown_end).getTime() : null,
      readyPlayers: row.ready_players,
      autoDrawInterval: row.auto_draw_interval,
      updatedAt: new Date(row.updated_at).getTime(),
    });
  } catch (error) {
    console.error('Error updating game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

