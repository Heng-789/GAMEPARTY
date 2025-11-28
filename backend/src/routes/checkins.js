import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { broadcastCheckinUpdate } from '../socket/index.js';

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
    const schema = getSchema(theme);

    const pool = getPool(theme);
    
    // ✅ Validate pool
    if (!pool) {
      console.error(`[GET /checkins/${gameId}/${userId}] Database pool not found for theme: ${theme}`);
      return res.status(503).json({
        error: 'Database unavailable',
        message: `Database pool not available for theme: ${theme}`
      });
    }

    // ✅ Add timeout protection
    const result = await Promise.race([
      pool.query(
        `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
         FROM ${schema}.checkins
         WHERE game_id = $1 AND user_id = $2 AND day_index < $3
         ORDER BY day_index ASC`,
        [gameId, userId, maxDays]
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
      )
    ]);

    const checkins = {};
    result.rows.forEach((row) => {
      try {
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
      } catch (rowError) {
        console.warn(`[GET /checkins/${gameId}/${userId}] Error processing row:`, rowError.message);
      }
    });

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
    // ✅ ป้องกันการเช็คอินล่วงหน้า: serverDate ต้องไม่มากกว่าวันปัจจุบัน
    const currentDate = new Date().toISOString().split('T')[0];
    const serverDateObj = new Date(serverDate + 'T00:00:00');
    const currentDateObj = new Date(currentDate + 'T00:00:00');
    const daysDiff = Math.abs(Math.floor((serverDateObj.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24)));
    const isFutureDate = serverDateObj.getTime() > currentDateObj.getTime();
    
    console.log(`[POST /checkins/${gameId}/${userId}] Date validation:`, {
      serverDate,
      currentDate,
      daysDiff,
      isFutureDate
    });
    
    // ✅ ป้องกันการเช็คอินล่วงหน้า: serverDate ต้องไม่มากกว่าวันปัจจุบัน
    if (isFutureDate) {
      console.warn(`[POST /checkins/${gameId}/${userId}] Cannot checkin in future date:`, { serverDate, currentDate });
      return res.status(400).json({ error: 'FUTURE_DATE_NOT_ALLOWED' });
    }
    
    // ✅ อนุญาตให้เช็คอินได้ถ้าเป็นวันเดียวกันหรือต่างกันไม่เกิน 1 วัน (รองรับ timezone)
    if (daysDiff > 1) {
      console.warn(`[POST /checkins/${gameId}/${userId}] Server date mismatch:`, { serverDate, currentDate, daysDiff });
      return res.status(400).json({ error: 'INVALID_DATE' });
    }

    await client.query('BEGIN');

    // ✅ ตรวจสอบเงื่อนไขเช็คอิน Day ถัดไป
    // ✅ ถ้า dayIndex > 0 (Day 2, 3, ...) ต้องเช็คว่าเช็คอินวันก่อนหน้าไปแล้วในวันอื่น (ไม่ใช่วันนี้)
    if (dayIndex > 0) {
      const prevDayResult = await client.query(
        `SELECT checked, checkin_date
         FROM ${schema}.checkins
         WHERE game_id = $1 AND user_id = $2 AND day_index = $3
         FOR UPDATE`,
        [gameId, userId, dayIndex - 1]
      );

      if (prevDayResult.rows.length === 0 || !prevDayResult.rows[0].checked) {
        // ✅ ยังไม่เช็คอินวันก่อนหน้า
        console.log(`[POST /checkins/${gameId}/${userId}] Previous day (${dayIndex - 1}) not checked in yet`);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'PREVIOUS_DAY_NOT_CHECKED' });
      }

      const prevDayCheckinDate = prevDayResult.rows[0].checkin_date;
      // ✅ ตรวจสอบว่าเช็คอินวันก่อนหน้าไปแล้วในวันอื่น (ไม่ใช่วันนี้)
      if (prevDayCheckinDate && prevDayCheckinDate >= serverDate) {
        // ✅ เช็คอินวันก่อนหน้าในวันนี้ (หรืออนาคต) → ไม่สามารถเช็คอิน Day ถัดไปได้
        console.log(`[POST /checkins/${gameId}/${userId}] Previous day (${dayIndex - 1}) checked in today or future:`, {
          prevDayCheckinDate,
          serverDate
        });
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'PREVIOUS_DAY_CHECKED_IN_TODAY' });
      }
    }

    // ✅ ตรวจสอบว่าเช็คอินวันนี้แล้วหรือไม่ (สำหรับ dayIndex นี้)
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

    // ✅ ตรวจสอบว่า user เช็คอินวันไหนในวันนี้แล้วหรือไม่ (ป้องกันการเช็คอินหลายวันในวันเดียวกัน)
    // ✅ ถ้า dayIndex === 0 (Day 1) และ user เช็คอินวันอื่นในวันนี้แล้ว → ไม่ให้เช็คอิน Day 1
    // ✅ ถ้า dayIndex > 0 (Day 2, 3, ...) และ user เช็คอินวันอื่นในวันนี้แล้ว → ไม่ให้เช็คอิน Day ถัดไป
    const todayCheckinsResult = await client.query(
      `SELECT day_index, checked, checkin_date
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2 AND checkin_date = $3 AND checked = true
       FOR UPDATE`,
      [gameId, userId, serverDate]
    );

    if (todayCheckinsResult.rows.length > 0) {
      // ✅ user เช็คอินวันอื่นในวันนี้แล้ว → ไม่ให้เช็คอินวันใหม่ในวันเดียวกัน
      const checkedDays = todayCheckinsResult.rows.map(row => row.day_index).sort((a, b) => a - b);
      console.log(`[POST /checkins/${gameId}/${userId}] Already checked in other day(s) today:`, {
        checkedDays,
        requestedDay: dayIndex,
        serverDate
      });
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'ALREADY_CHECKED_IN_TODAY' });
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

    // ✅ Fetch updated checkins and broadcast WebSocket update
    const checkinsResult = await client.query(
      `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2
       ORDER BY day_index ASC`,
      [gameId, userId]
    );
    
    const checkins = {};
    checkinsResult.rows.forEach((row) => {
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
    
    broadcastCheckinUpdate(theme, gameId, userId, { checkins });

    console.log(`[POST /checkins/${gameId}/${userId}] Checkin successful:`, {
      dayIndex,
      serverDate,
      uniqueKey: uniqueKey?.substring(0, 20) + '...'
    });

    res.json({ success: true });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error(`[POST /checkins/${req.params.gameId}/${req.params.userId}] Rollback error:`, rollbackError.message);
    }
    
    console.error(`[POST /checkins/${req.params.gameId}/${req.params.userId}] Error checking in:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    if (error.code === '23505') {
      // Unique constraint violation (unique_key)
      return res.status(400).json({ error: 'ALREADY_CHECKED_IN' });
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

