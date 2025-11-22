import express from 'express';
import { getPool, getSchema } from '../config/database.js';

const router = express.Router();

// Get chat messages for a game
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 50 } = req.query;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    // Note: We'll need to create a chat_messages table
    // For now, return empty array if table doesn't exist
    try {
      const result = await pool.query(
        `SELECT id, game_id, username, message, timestamp, created_at
         FROM ${schema}.chat_messages
         WHERE game_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [gameId, parseInt(limit)]
      );

      const messages = result.rows.map((row) => ({
        id: row.id.toString(),
        username: row.username,
        message: row.message,
        timestamp: row.timestamp || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      })).reverse(); // Reverse to show oldest first

      res.json(messages);
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error.message && error.message.includes('does not exist')) {
        res.json([]);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a chat message
router.post('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { username, message } = req.body;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!username || !message || !message.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const timestamp = Date.now();

    // Note: We'll need to create a chat_messages table
    try {
      const result = await pool.query(
        `INSERT INTO ${schema}.chat_messages (game_id, username, message, timestamp, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING *`,
        [gameId, username, message.trim(), timestamp]
      );

      const row = result.rows[0];
      res.status(201).json({
        id: row.id.toString(),
        username: row.username,
        message: row.message,
        timestamp: row.timestamp || (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
      });
    } catch (error) {
      // If table doesn't exist, return error
      if (error.message && error.message.includes('does not exist')) {
        res.status(503).json({ error: 'Chat service not available. Table not created yet.' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

