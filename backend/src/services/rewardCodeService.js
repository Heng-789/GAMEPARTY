/**
 * Reward Code Service
 * Handles atomic code distribution for check-in games
 * Uses PostgreSQL SKIP LOCKED for high-concurrency safety
 */

import { getPool, getSchema } from '../config/database.js';

/**
 * Claim a daily reward code atomically
 * @param {string} theme - Theme name (heng36, max56, jeed24)
 * @param {string} gameId - Game ID
 * @param {string} userId - User ID
 * @param {number} dayIndex - Day index (0-based)
 * @returns {Promise<{status: string, code?: string}>}
 */
export async function claimDailyRewardCode(theme, gameId, userId, dayIndex) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user already claimed for this day
    const existingClaim = await client.query(
      `SELECT code FROM ${schema}.reward_codes 
       WHERE game_id = $1 AND day_index = $2 AND code_type = 'daily' AND claimed_by = $3
       LIMIT 1`,
      [gameId, dayIndex, userId]
    );

    if (existingClaim.rows.length > 0) {
      await client.query('COMMIT');
      return {
        status: 'ALREADY',
        code: existingClaim.rows[0].code
      };
    }

    // Atomically claim next available code using SKIP LOCKED
    const claimResult = await client.query(
      `UPDATE ${schema}.reward_codes
       SET claimed_by = $1, claimed_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM ${schema}.reward_codes 
         WHERE game_id = $2 
           AND day_index = $3 
           AND code_type = 'daily'
           AND claimed_by IS NULL
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING code`,
      [userId, gameId, dayIndex]
    );

    if (claimResult.rows.length === 0) {
      await client.query('COMMIT');
      return { status: 'EMPTY' };
    }

    await client.query('COMMIT');
    return {
      status: 'SUCCESS',
      code: claimResult.rows[0].code
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Claim a complete reward code atomically
 * @param {string} theme - Theme name
 * @param {string} gameId - Game ID
 * @param {string} userId - User ID
 * @returns {Promise<{status: string, code?: string}>}
 */
export async function claimCompleteRewardCode(theme, gameId, userId) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user already claimed
    const existingClaim = await client.query(
      `SELECT code FROM ${schema}.reward_codes 
       WHERE game_id = $1 AND day_index IS NULL AND code_type = 'complete' AND claimed_by = $2
       LIMIT 1`,
      [gameId, userId]
    );

    if (existingClaim.rows.length > 0) {
      await client.query('COMMIT');
      return {
        status: 'ALREADY',
        code: existingClaim.rows[0].code
      };
    }

    // Atomically claim next available code
    const claimResult = await client.query(
      `UPDATE ${schema}.reward_codes
       SET claimed_by = $1, claimed_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM ${schema}.reward_codes 
         WHERE game_id = $2 
           AND day_index IS NULL
           AND code_type = 'complete'
           AND claimed_by IS NULL
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING code`,
      [userId, gameId]
    );

    if (claimResult.rows.length === 0) {
      await client.query('COMMIT');
      return { status: 'EMPTY' };
    }

    await client.query('COMMIT');
    return {
      status: 'SUCCESS',
      code: claimResult.rows[0].code
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Claim a coupon code atomically
 * Note: Coupon codes allow multiple claims per user (unlike daily/complete rewards)
 * @param {string} theme - Theme name
 * @param {string} gameId - Game ID
 * @param {string} userId - User ID
 * @param {number} itemIndex - Coupon item index
 * @returns {Promise<{status: string, code?: string}>}
 */
export async function claimCouponCode(theme, gameId, userId, itemIndex) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Note: Coupon codes allow multiple claims per user, so we don't check for existing claims
    // Each claim is a separate row in reward_codes table

    // Atomically claim next available code
    const claimResult = await client.query(
      `UPDATE ${schema}.reward_codes
       SET claimed_by = $1, claimed_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM ${schema}.reward_codes 
         WHERE game_id = $2 
           AND code_type = 'coupon'
           AND coupon_item_index = $3
           AND claimed_by IS NULL
         ORDER BY id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING code`,
      [userId, gameId, itemIndex]
    );

    if (claimResult.rows.length === 0) {
      await client.query('COMMIT');
      return { status: 'EMPTY' };
    }

    await client.query('COMMIT');
    return {
      status: 'SUCCESS',
      code: claimResult.rows[0].code
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Bulk insert reward codes
 * @param {string} theme - Theme name
 * @param {string} gameId - Game ID
 * @param {Array<string>} codes - Array of codes
 * @param {Object} options - Options { dayIndex, codeType, couponItemIndex }
 * @returns {Promise<number>} Number of codes inserted
 */
export async function bulkInsertRewardCodes(theme, gameId, codes, options = {}) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const { dayIndex = null, codeType = 'daily', couponItemIndex = null } = options;

  if (!codes || codes.length === 0) {
    return 0;
  }

  const values = codes.map((code, index) => {
    const valueIndex = index * 5;
    return `($${valueIndex + 1}, $${valueIndex + 2}, $${valueIndex + 3}, $${valueIndex + 4}, $${valueIndex + 5})`;
  }).join(', ');

  const params = codes.flatMap(code => [gameId, dayIndex, code, codeType, couponItemIndex]);

  const result = await pool.query(
    `INSERT INTO ${schema}.reward_codes (game_id, day_index, code, code_type, coupon_item_index)
     VALUES ${values}
     ON CONFLICT DO NOTHING`,
    params
  );

  return result.rowCount || 0;
}

/**
 * Get claimed code for a user
 * @param {string} theme - Theme name
 * @param {string} gameId - Game ID
 * @param {string} userId - User ID
 * @param {Object} options - Options { dayIndex, codeType, couponItemIndex }
 * @returns {Promise<string|null>}
 */
export async function getClaimedCode(theme, gameId, userId, options = {}) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const { dayIndex = null, codeType = 'daily', couponItemIndex = null } = options;

  const conditions = ['game_id = $1', 'code_type = $2', 'claimed_by = $3'];
  const params = [gameId, codeType, userId];

  if (dayIndex !== null) {
    conditions.push('day_index = $4');
    params.push(dayIndex);
  } else {
    conditions.push('day_index IS NULL');
  }

  if (codeType === 'coupon' && couponItemIndex !== null) {
    const paramIndex = params.length + 1;
    conditions.push(`coupon_item_index = $${paramIndex}`);
    params.push(couponItemIndex);
  }

  const result = await pool.query(
    `SELECT code FROM ${schema}.reward_codes 
     WHERE ${conditions.join(' AND ')}
     LIMIT 1`,
    params
  );

  return result.rows.length > 0 ? result.rows[0].code : null;
}

