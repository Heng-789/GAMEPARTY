import express from 'express';
import { getPool, getSchema } from '../config/database.js';

const router = express.Router();

// Add coins with transaction
router.post('/transactions', async (req, res) => {
  const theme = req.theme || 'heng36';
  const pool = getPool(theme);
  const client = await pool.connect();
  try {
    const { userId, amount, reason, uniqueKey } = req.body;

    if (!userId || !Number.isFinite(amount) || !reason || !uniqueKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    const theme = req.theme || 'heng36';
    const schema = getSchema(theme);

    // Check if transaction already processed
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
      return res.json({
        success: false,
        error: 'ALREADY_PROCESSED',
        newBalance: userResult.rows[0] ? Number(userResult.rows[0].hcoin) : 0,
      });
    }

    // Record transaction
    await client.query(
      `INSERT INTO ${schema}.coin_transactions (user_id, amount, reason, unique_key, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [userId, amount, reason, uniqueKey]
    );

    // Update user balance
    const userResult = await client.query(
      `SELECT hcoin FROM ${schema}.users WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBalance = Number(userResult.rows[0].hcoin || 0);
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
    }

    await client.query(
      `UPDATE ${schema}.users SET hcoin = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [newBalance, userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      newBalance,
      previousBalance: currentBalance,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing coin transaction:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(400).json({ error: 'ALREADY_PROCESSED' });
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get transaction history
router.get('/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    const result = await pool.query(
      `SELECT id, amount, reason, unique_key, created_at
       FROM ${schema}.coin_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const transactions = result.rows.map((row) => ({
      id: row.id,
      userId,
      amount: Number(row.amount),
      reason: row.reason,
      uniqueKey: row.unique_key,
      createdAt: row.created_at,
    }));

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

