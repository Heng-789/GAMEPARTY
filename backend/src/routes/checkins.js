import express from 'express';
import { getPool, getSchema } from '../config/database.js';

const router = express.Router();

// Admin: Get all checkins for a game
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const maxDays = parseInt(req.query.maxDays) || 365;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    const result = await pool.query(
      `SELECT user_id, day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins
       WHERE game_id = $1 AND day_index < $2
       ORDER BY created_at DESC`,
      [gameId, maxDays]
    );

    const checkins = {};
    result.rows.forEach((row) => {
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
    });

    res.json(checkins);
  } catch (error) {
    console.error('Error fetching all checkins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get checkin status
router.get('/:gameId/:userId', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const maxDays = parseInt(req.query.maxDays) || 30;
    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);

    const pool = getPool(theme);
    const result = await pool.query(
      `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2 AND day_index < $3
       ORDER BY day_index ASC`,
      [gameId, userId, maxDays]
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

    res.json(checkins);
  } catch (error) {
    console.error('Error fetching checkins:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check in
router.post('/:gameId/:userId', async (req, res) => {
  const theme = req.theme || 'heng36';
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();
  try {
    const { gameId, userId } = req.params;
    const { dayIndex, serverDate, uniqueKey } = req.body;

    console.log(`[POST /checkins/${gameId}/${userId}] Checkin request:`, {
      dayIndex,
      serverDate,
      uniqueKey: uniqueKey?.substring(0, 20) + '...',
      theme,
      schema
    });

    if (dayIndex === undefined || dayIndex === null || !serverDate || !uniqueKey) {
      console.error(`[POST /checkins/${gameId}/${userId}] Missing required fields:`, {
        dayIndex,
        serverDate,
        uniqueKey: uniqueKey ? 'present' : 'missing'
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ ตรวจสอบวันที่: อนุญาตให้เช็คอินได้ถ้าเป็นวันเดียวกันหรือใกล้เคียงกัน (ยืดหยุ่นสำหรับ timezone)
    const currentDate = new Date().toISOString().split('T')[0];
    const serverDateObj = new Date(serverDate + 'T00:00:00');
    const currentDateObj = new Date(currentDate + 'T00:00:00');
    const daysDiff = Math.abs(Math.floor((serverDateObj.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24)));
    
    console.log(`[POST /checkins/${gameId}/${userId}] Date validation:`, {
      serverDate,
      currentDate,
      daysDiff
    });
    
    // ✅ อนุญาตให้เช็คอินได้ถ้าเป็นวันเดียวกันหรือต่างกันไม่เกิน 1 วัน (รองรับ timezone)
    if (daysDiff > 1) {
      console.warn(`[POST /checkins/${gameId}/${userId}] Server date mismatch:`, { serverDate, currentDate, daysDiff });
      return res.status(400).json({ error: 'INVALID_DATE' });
    }

    await client.query('BEGIN');

    // Check if already checked in today
    const existingResult = await client.query(
      `SELECT checked, checkin_date, unique_key
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2 AND day_index = $3
       FOR UPDATE`,
      [gameId, userId, dayIndex]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      // ✅ ตรวจสอบว่าเช็คอินวันนี้แล้วหรือไม่ (checked === true และ checkin_date === serverDate)
      if (existing.checked && existing.checkin_date === serverDate) {
        console.log(`[POST /checkins/${gameId}/${userId}] Already checked in today for day ${dayIndex}:`, {
          checked: existing.checked,
          checkin_date: existing.checkin_date,
          serverDate,
          unique_key: existing.unique_key?.substring(0, 20) + '...'
        });
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ALREADY_CHECKED_IN_TODAY' });
      }
      // ✅ ตรวจสอบว่าเช็คอินไปแล้วด้วย unique_key อื่น (ป้องกัน duplicate)
      if (existing.unique_key && existing.unique_key !== uniqueKey && existing.checked) {
        console.log(`[POST /checkins/${gameId}/${userId}] Already checked in with different unique_key for day ${dayIndex}:`, {
          existing_key: existing.unique_key?.substring(0, 20) + '...',
          new_key: uniqueKey?.substring(0, 20) + '...',
          checked: existing.checked
        });
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ALREADY_CHECKED_IN' });
      }
    }

    // Insert or update checkin
    await client.query(
      `INSERT INTO ${schema}.checkins (game_id, user_id, day_index, checked, checkin_date, unique_key, created_at, updated_at)
       VALUES ($1, $2, $3, true, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (game_id, user_id, day_index)
       DO UPDATE SET
         checked = true,
         checkin_date = $4,
         unique_key = $5,
         updated_at = CURRENT_TIMESTAMP`,
      [gameId, userId, dayIndex, serverDate, uniqueKey]
    );

    await client.query('COMMIT');

    console.log(`[POST /checkins/${gameId}/${userId}] Checkin successful:`, {
      dayIndex,
      serverDate,
      uniqueKey: uniqueKey?.substring(0, 20) + '...'
    });

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[POST /checkins/${gameId}/${userId}] Error checking in:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    if (error.code === '23505') {
      // Unique constraint violation (unique_key)
      return res.status(400).json({ error: 'ALREADY_CHECKED_IN' });
    }
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// Claim complete reward
router.post('/:gameId/:userId/rewards/complete', async (req, res) => {
  const theme = req.theme || 'heng36';
  const pool = getPool(theme);
  const schema = getSchema(theme);
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
    await client.query('ROLLBACK');
    console.error('Error claiming reward:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'ALREADY_CLAIMED' });
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get complete reward status
router.get('/:gameId/:userId/rewards/complete', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT claimed, unique_key, created_at, updated_at
       FROM ${schema}.checkin_rewards
       WHERE game_id = $1 AND user_id = $2 AND reward_type = 'complete'`,
      [gameId, userId]
    );

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
    console.error('Error fetching reward status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

