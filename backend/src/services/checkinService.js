/**
 * Check-in Service
 * Handles check-in operations with full transaction safety and row-level locking
 * Ensures sequential day enforcement and prevents duplicate check-ins
 */

import { getPool, getSchema } from '../config/database.js';
import { broadcastCheckinUpdate } from '../socket/index.js';

/**
 * Perform a check-in with full concurrency safety
 * @param {string} theme - Theme name
 * @param {string} gameId - Game ID
 * @param {string} userId - User ID
 * @param {number} dayIndex - Day index (0-based)
 * @param {string} serverDate - Server date (YYYY-MM-DD)
 * @param {string} uniqueKey - Unique key for this check-in
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function performCheckin(theme, gameId, userId, dayIndex, serverDate, uniqueKey) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validate server date (must not be in future)
    const currentDate = new Date().toISOString().split('T')[0];
    const serverDateObj = new Date(serverDate + 'T00:00:00');
    const currentDateObj = new Date(currentDate + 'T00:00:00');
    const daysDiff = Math.abs(Math.floor((serverDateObj.getTime() - currentDateObj.getTime()) / (1000 * 60 * 60 * 24)));
    const isFutureDate = serverDateObj.getTime() > currentDateObj.getTime();

    if (isFutureDate) {
      await client.query('ROLLBACK');
      return { success: false, error: 'FUTURE_DATE_NOT_ALLOWED' };
    }

    if (daysDiff > 1) {
      await client.query('ROLLBACK');
      return { success: false, error: 'INVALID_DATE' };
    }

    // Check sequential day requirement (Day 1 → Day 2 → Day 3)
    if (dayIndex > 0) {
      const prevDayResult = await client.query(
        `SELECT checked, checkin_date
         FROM ${schema}.checkins
         WHERE game_id = $1 AND user_id = $2 AND day_index = $3
         FOR UPDATE`,
        [gameId, userId, dayIndex - 1]
      );

      if (prevDayResult.rows.length === 0 || !prevDayResult.rows[0].checked) {
        await client.query('ROLLBACK');
        return { success: false, error: 'PREVIOUS_DAY_NOT_CHECKED' };
      }

      const prevDayCheckinDate = prevDayResult.rows[0].checkin_date;
      // Previous day must be checked in on a different day (not today)
      if (prevDayCheckinDate && prevDayCheckinDate >= serverDate) {
        await client.query('ROLLBACK');
        return { success: false, error: 'PREVIOUS_DAY_CHECKED_IN_TODAY' };
      }
    }

    // Check if already checked in today for this dayIndex
    const existingResult = await client.query(
      `SELECT checked, checkin_date, unique_key
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2 AND day_index = $3
       FOR UPDATE`,
      [gameId, userId, dayIndex]
    );

    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      // Already checked in today
      if (existing.checked && existing.checkin_date === serverDate) {
        await client.query('ROLLBACK');
        return { success: false, error: 'ALREADY_CHECKED_IN_TODAY' };
      }
      // Already checked in with different unique key
      if (existing.unique_key && existing.unique_key !== uniqueKey && existing.checked) {
        await client.query('ROLLBACK');
        return { success: false, error: 'ALREADY_CHECKED_IN' };
      }
    }

    // Check if user checked in any other day today (prevent multiple check-ins in same day)
    const todayCheckinsResult = await client.query(
      `SELECT day_index, checked, checkin_date
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2 AND checkin_date = $3 AND checked = true
       FOR UPDATE`,
      [gameId, userId, serverDate]
    );

    if (todayCheckinsResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'ALREADY_CHECKED_IN_TODAY' };
    }

    // Insert or update check-in
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

    // Fetch updated check-ins for WebSocket broadcast
    const checkinsResult = await client.query(
      `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins
       WHERE game_id = $1 AND user_id = $2
       ORDER BY day_index ASC`,
      [gameId, userId]
    );

    const checkins = {};
    checkinsResult.rows.forEach((row) => {
      let checkinDate = row.checkin_date;
      if (!checkinDate && row.created_at) {
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

    // Broadcast minimal diff update (WebSocket will handle room-based broadcasting)
    broadcastCheckinUpdate(theme, gameId, userId, {
      update: {
        dayIndex,
        checked: true,
        checkin_date: serverDate
      }
    });

    return { success: true };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback error:', rollbackError.message);
    }

    if (error.code === '23505') {
      // Unique constraint violation (unique_key)
      return { success: false, error: 'ALREADY_CHECKED_IN' };
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get check-in status for a user
 * @param {string} theme - Theme name
 * @param {string} gameId - Game ID
 * @param {string} userId - User ID
 * @param {number} maxDays - Maximum days to fetch
 * @returns {Promise<Object>}
 */
export async function getCheckinStatus(theme, gameId, userId, maxDays = 30) {
  const pool = getPool(theme);
  const schema = getSchema(theme);

  const result = await pool.query(
    `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
     FROM ${schema}.checkins
     WHERE game_id = $1 AND user_id = $2 AND day_index < $3
     ORDER BY day_index ASC`,
    [gameId, userId, maxDays]
  );

  const checkins = {};
  result.rows.forEach((row) => {
    let checkinDate = row.checkin_date;
    if (!checkinDate && row.created_at) {
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

  return checkins;
}

