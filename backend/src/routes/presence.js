import express from 'express';
import { getPool, getSchema } from '../config/database.js';

const router = express.Router();

// Get room presence
router.get('/:gameId/:roomId', async (req, res) => {
  try {
    const { gameId, roomId } = req.params;
    const maxUsers = parseInt(req.query.maxUsers) || 100;
    const offlineThreshold = parseInt(req.query.offlineThreshold) || 30000; // 30 seconds
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    const result = await pool.query(
      `SELECT user_id, username, status, last_seen, joined_at, is_in_room
       FROM ${schema}.presence
       WHERE game_id = $1 AND room_id = $2
       ORDER BY last_seen DESC
       LIMIT $3`,
      [gameId, roomId, maxUsers]
    );

    const now = Date.now();
    const presence = {};

    result.rows.forEach((row) => {
      const lastSeen = new Date(row.last_seen).getTime();
      const timeSinceLastSeen = now - lastSeen;

      // Filter out offline users (older than threshold)
      if (row.status === 'online' || timeSinceLastSeen < offlineThreshold) {
        presence[row.user_id] = {
          userId: row.user_id,
          username: row.username,
          status: row.status,
          lastSeen: lastSeen,
          joinedAt: new Date(row.joined_at).getTime(),
          isInRoom: row.is_in_room,
          roomId,
          gameId,
        };
      }
    });

    res.json(presence);
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update presence
router.post('/:gameId/:roomId', async (req, res) => {
  try {
    const { gameId, roomId } = req.params;
    const { userId, username, status } = req.body;

    if (!userId || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    await pool.query(
      `INSERT INTO ${schema}.presence (game_id, room_id, user_id, username, status, last_seen, joined_at, is_in_room)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)
       ON CONFLICT (game_id, room_id, user_id)
       DO UPDATE SET
         username = $4,
         status = COALESCE($5, ${schema}.presence.status),
         last_seen = CURRENT_TIMESTAMP,
         is_in_room = true`,
      [gameId, roomId, userId, username, status || 'online']
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove presence
router.delete('/:gameId/:roomId/:userId', async (req, res) => {
  try {
    const { gameId, roomId, userId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    await pool.query(
      `UPDATE ${schema}.presence
       SET status = 'offline', is_in_room = false, last_seen = CURRENT_TIMESTAMP
       WHERE game_id = $1 AND room_id = $2 AND user_id = $3`,
      [gameId, roomId, userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing presence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

