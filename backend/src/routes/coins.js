import express from 'express';
import { addUserCoins } from '../services/userCoinService.js';

const router = express.Router();

// Add coins with transaction
router.post('/transactions', async (req, res) => {
  try {
    const { userId, amount, reason, uniqueKey } = req.body;
    const theme = req.theme || 'heng36';

    if (!userId || !Number.isFinite(amount) || !reason || !uniqueKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use service for atomic coin update
    const result = await addUserCoins(theme, userId, amount, reason, uniqueKey);

    if (!result.success) {
      if (result.error === 'ALREADY_PROCESSED') {
        return res.json({
          success: false,
          error: 'ALREADY_PROCESSED',
          newBalance: result.newBalance,
        });
      }
      if (result.error === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
      }
      if (result.error === 'USER_NOT_FOUND') {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('Error processing coin transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
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

