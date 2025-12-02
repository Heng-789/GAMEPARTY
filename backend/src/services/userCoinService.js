/**
 * User Coin Service
 * Handles atomic coin balance updates
 * Uses PostgreSQL atomic UPDATE with RETURNING for concurrency safety
 */

import { getPool, getSchema } from '../config/database.js';
import { broadcastUserUpdate } from '../socket/index.js';

/**
 * Atomically add coins to user balance
 * @param {string} theme - Theme name
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add (can be negative)
 * @param {string} reason - Reason for transaction
 * @param {string} uniqueKey - Unique key to prevent duplicate transactions
 * @returns {Promise<{success: boolean, newBalance: number, previousBalance?: number, error?: string}>}
 */
export async function addUserCoins(theme, userId, amount, reason, uniqueKey) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if transaction already processed
    if (uniqueKey) {
      const existingTransaction = await client.query(
        `SELECT id FROM ${schema}.coin_transactions WHERE unique_key = $1`,
        [uniqueKey]
      );

      if (existingTransaction.rows.length > 0) {
        // Transaction already processed, return current balance
        const userResult = await client.query(
          `SELECT hcoin FROM ${schema}.users WHERE user_id = $1`,
          [userId]
        );

        await client.query('COMMIT');
        return {
          success: false,
          error: 'ALREADY_PROCESSED',
          newBalance: userResult.rows[0] ? Number(userResult.rows[0].hcoin) : 0,
        };
      }
    }

    // Record transaction if uniqueKey provided
    if (uniqueKey) {
      await client.query(
        `INSERT INTO ${schema}.coin_transactions (user_id, amount, reason, unique_key, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, amount, reason, uniqueKey]
      );
    }

    // Atomically update balance and return new value
    // This prevents race conditions by doing read-modify-write in a single operation
    const updateResult = await client.query(
      `UPDATE ${schema}.users 
       SET hcoin = GREATEST(0, hcoin + $1), updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2
       RETURNING hcoin`,
      [amount, userId]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        newBalance: 0
      };
    }

    const newBalance = Number(updateResult.rows[0].hcoin);

    // Check if balance went negative (shouldn't happen due to GREATEST, but check for safety)
    if (newBalance < 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        newBalance: 0
      };
    }

    await client.query('COMMIT');

    // Broadcast WebSocket update
    broadcastUserUpdate(theme, userId, {
      hcoin: newBalance,
      status: null, // Keep existing status
    });

    return {
      success: true,
      newBalance,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    
    if (error.code === '23505') {
      // Unique constraint violation (duplicate uniqueKey)
      return {
        success: false,
        error: 'ALREADY_PROCESSED',
        newBalance: 0
      };
    }
    
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Atomically deduct coins from user balance
 * @param {string} theme - Theme name
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deduct (must be positive)
 * @param {string} reason - Reason for transaction
 * @param {string} uniqueKey - Unique key to prevent duplicate transactions
 * @returns {Promise<{success: boolean, newBalance: number, error?: string}>}
 */
export async function deductUserCoins(theme, userId, amount, reason, uniqueKey) {
  return addUserCoins(theme, userId, -Math.abs(amount), reason, uniqueKey);
}

/**
 * Get user balance
 * @param {string} theme - Theme name
 * @param {string} userId - User ID
 * @returns {Promise<number>}
 */
export async function getUserBalance(theme, userId) {
  const pool = getPool(theme);
  const schema = getSchema(theme);

  const result = await pool.query(
    `SELECT hcoin FROM ${schema}.users WHERE user_id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return 0;
  }

  return Number(result.rows[0].hcoin || 0);
}

