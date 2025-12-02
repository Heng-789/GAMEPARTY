import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { performCheckin, getCheckinStatus } from '../services/checkinService.js';

const router = express.Router();

// Admin: Get all checkins for a game
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const maxDays = parseInt(req.query.maxDays) || 365;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    // ✅ Validate pool
    if (!pool) {
      console.error(`[GET /checkins/${gameId}] Database pool not found for theme: ${theme}`);
      return res.status(503).json({
        error: 'Database unavailable',
        message: `Database pool not available for theme: ${theme}`
      });
    }

    // ✅ Add timeout protection
    const result = await Promise.race([
      pool.query(
        `SELECT user_id, day_index, checked, checkin_date, unique_key, created_at, updated_at
         FROM ${schema}.checkins
         WHERE game_id = $1 AND day_index < $2
         ORDER BY created_at DESC`,
        [gameId, maxDays]
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
      )
    ]);

    const checkins = {};
    result.rows.forEach((row) => {
      try {
        const userId = row.user_id;
        if (!checkins[userId]) {
          checkins[userId] = {};
        }
        checkins[userId][row.day_index] = {
          checked: row.checked,
          date: row.checkin_date,
          key: row.unique_key,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      } catch (rowError) {
        console.warn(`[GET /checkins/${gameId}] Error processing row:`, rowError.message);
      }
    });

    res.json(checkins);
  } catch (error) {
    console.error(`[GET /checkins/${req.params.gameId}] Error fetching all checkins:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // ✅ Return empty object instead of error to prevent frontend crash
    res.status(200).json({});
  }
});

// Get checkin status
router.get('/:gameId/:userId', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const maxDays = parseInt(req.query.maxDays) || 30;
    const theme = req.theme || 'heng36';

    // Use service to get check-in status
    const checkins = await getCheckinStatus(theme, gameId, userId, maxDays);

    res.json(checkins);
  } catch (error) {
    console.error(`[GET /checkins/${req.params.gameId}/${req.params.userId}] Error fetching checkins:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // ✅ Return empty object instead of error to prevent frontend crash
    res.status(200).json({});
  }
});

// Check in
router.post('/:gameId/:userId', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const { dayIndex, serverDate, uniqueKey } = req.body;
    const theme = req.theme || 'heng36';

    console.log(`[POST /checkins/${gameId}/${userId}] Checkin request:`, {
      dayIndex,
      serverDate,
      uniqueKey: uniqueKey?.substring(0, 20) + '...',
      theme
    });

    if (dayIndex === undefined || dayIndex === null || !serverDate || !uniqueKey) {
      console.error(`[POST /checkins/${gameId}/${userId}] Missing required fields:`, {
        dayIndex,
        serverDate,
        uniqueKey: uniqueKey ? 'present' : 'missing'
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use service for check-in operation
    const result = await performCheckin(theme, gameId, userId, dayIndex, serverDate, uniqueKey);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    console.log(`[POST /checkins/${gameId}/${userId}] Checkin successful:`, {
      dayIndex,
      serverDate,
      uniqueKey: uniqueKey?.substring(0, 20) + '...'
    });

    res.json({ success: true });
  } catch (error) {
    console.error(`[POST /checkins/${req.params.gameId}/${req.params.userId}] Error checking in:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // ✅ Return more specific error messages
    if (error.message.includes('timeout') || error.message.includes('Connection terminated')) {
      return res.status(503).json({ 
        error: 'Database timeout',
        message: 'Database connection timeout. Please try again.'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Claim complete reward
router.post('/:gameId/:userId/rewards/complete', async (req, res) => {
  const theme = req.theme || 'heng36';
  const pool = getPool(theme);
  const schema = getSchema(theme);
  
  // ✅ Validate pool
  if (!pool) {
    console.error(`[POST /checkins/${req.params.gameId}/${req.params.userId}/rewards/complete] Database pool not found for theme: ${theme}`);
    return res.status(503).json({
      error: 'Database unavailable',
      message: `Database pool not available for theme: ${theme}`
    });
  }
  
  const client = await pool.connect();
  try {
    const { gameId, userId } = req.params;
    const { uniqueKey } = req.body;

    if (!uniqueKey) {
      return res.status(400).json({ error: 'Missing uniqueKey' });
    }

    await client.query('BEGIN');

    // Check if already claimed
    const existingResult = await client.query(
      `SELECT claimed, unique_key
       FROM ${schema}.checkin_rewards
       WHERE game_id = $1 AND user_id = $2 AND reward_type = 'complete'
       FOR UPDATE`,
      [gameId, userId]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      if (existing.claimed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ALREADY_CLAIMED' });
      }
      if (existing.unique_key && existing.unique_key !== uniqueKey) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ALREADY_CLAIMED' });
      }
    }

    // Insert or update reward
    await client.query(
      `INSERT INTO ${schema}.checkin_rewards (game_id, user_id, reward_type, claimed, unique_key, created_at, updated_at)
       VALUES ($1, $2, 'complete', true, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (game_id, user_id, reward_type)
       DO UPDATE SET
         claimed = true,
         unique_key = $3,
         updated_at = CURRENT_TIMESTAMP`,
      [gameId, userId, uniqueKey]
    );

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`[POST /checkins/${req.params.gameId}/${req.params.userId}/rewards/complete] Rollback error:`, rollbackError.message);
    }
    
    console.error(`[POST /checkins/${req.params.gameId}/${req.params.userId}/rewards/complete] Error claiming reward:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    if (error.code === '23505') {
      return res.status(400).json({ error: 'ALREADY_CLAIMED' });
    }
    
    // ✅ Return more specific error messages
    if (error.message.includes('timeout') || error.message.includes('Connection terminated')) {
      return res.status(503).json({ 
        error: 'Database timeout',
        message: 'Database connection timeout. Please try again.'
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// Get complete reward status
router.get('/:gameId/:userId/rewards/complete', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    // ✅ Validate pool
    if (!pool) {
      console.error(`[GET /checkins/${gameId}/${userId}/rewards/complete] Database pool not found for theme: ${theme}`);
      return res.status(503).json({
        error: 'Database unavailable',
        message: `Database pool not available for theme: ${theme}`
      });
    }
    
    // ✅ Add timeout protection
    const result = await Promise.race([
      pool.query(
        `SELECT claimed, unique_key, created_at, updated_at
         FROM ${schema}.checkin_rewards
         WHERE game_id = $1 AND user_id = $2 AND reward_type = 'complete'`,
        [gameId, userId]
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
      )
    ]);

    if (result.rows.length === 0) {
      return res.json({ claimed: false });
    }

    const row = result.rows[0];
    res.json({
      claimed: row.claimed,
      key: row.unique_key,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error(`[GET /checkins/${req.params.gameId}/${req.params.userId}/rewards/complete] Error fetching reward status:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // ✅ Return default value instead of error
    res.status(200).json({ claimed: false });
  }
});

export default router;

