import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { broadcastUserUpdate } from '../socket/index.js';

const router = express.Router();

// Get top users by hcoin (ต้องอยู่ก่อน /:userId เพื่อไม่ให้ match "top" เป็น userId)
router.get('/top', async (req, res) => {
  try {
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const limit = parseInt(req.query.limit) || 100;
    const result = await pool.query(
      `SELECT user_id, password, hcoin, status, created_at FROM ${schema}.users ORDER BY hcoin DESC LIMIT $1`,
      [limit]
    );

    const users = result.rows.map((row) => ({
      userId: row.user_id,
      password: row.password,
      hcoin: Number(row.hcoin),
      status: row.status,
      createdAt: row.created_at,
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching top users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users by username (ต้องอยู่ก่อน /:userId)
router.get('/search/:searchTerm', async (req, res) => {
  try {
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const { searchTerm } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const result = await pool.query(
      `SELECT user_id, password, hcoin, status, created_at FROM ${schema}.users WHERE user_id ILIKE $1 ORDER BY user_id ASC LIMIT $2`,
      [`${searchTerm}%`, limit]
    );

    const users = result.rows.map((row) => ({
      userId: row.user_id,
      password: row.password,
      hcoin: Number(row.hcoin),
      status: row.status,
      createdAt: row.created_at,
    }));

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all users (with pagination) - ต้องอยู่ก่อน /:userId
router.get('/', async (req, res) => {
  try {
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    
    let query, params;
    if (search) {
      query = `SELECT user_id, password, hcoin, status, created_at, updated_at 
               FROM ${schema}.users 
               WHERE user_id ILIKE $1 
               ORDER BY user_id ASC 
               LIMIT $2 OFFSET $3`;
      params = [`%${search}%`, limit, offset];
    } else {
      query = `SELECT user_id, password, hcoin, status, created_at, updated_at 
               FROM ${schema}.users 
               ORDER BY user_id ASC 
               LIMIT $1 OFFSET $2`;
      params = [limit, offset];
    }
    
    const result = await pool.query(query, params);
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM ${schema}.users`);

    const users = result.rows.map((row) => ({
      userId: row.user_id,
      password: row.password,
      hcoin: Number(row.hcoin),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({
      users,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    console.error('Theme:', req.theme, 'Schema:', getSchema(req.theme || 'heng36'));
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      code: error.code
    });
  }
});

// Get user data
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT * FROM ${schema}.users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      userId: user.user_id,
      password: user.password,
      hcoin: Number(user.hcoin),
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user data
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password, hcoin, status } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (password !== undefined) {
      updates.push(`password = $${paramIndex++}`);
      values.push(password);
    }
    if (hcoin !== undefined) {
      updates.push(`hcoin = $${paramIndex++}`);
      values.push(hcoin);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    values.push(userId);
    const query = `
      UPDATE ${schema}.users 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // ✅ Broadcast Socket.io update
    broadcastUserUpdate(theme, userId, {
      hcoin: Number(user.hcoin),
      status: user.status,
    });
    res.json({
      userId: user.user_id,
      hcoin: Number(user.hcoin),
      status: user.status,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add coins with transaction
router.post('/:userId/coins', async (req, res) => {
  const theme = req.theme || 'heng36';
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const { amount, allowNegative = false } = req.body;

    if (!Number.isFinite(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!allowNegative && amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    await client.query('BEGIN');

    // Get current balance
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

    // Update balance
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
    console.error('Error adding coins:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Admin: Delete user
router.delete('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    const result = await pool.query(
      `DELETE FROM ${schema}.users WHERE user_id = $1 RETURNING user_id`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, userId });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Bulk create/update users
router.post('/bulk', async (req, res) => {
  try {
    const { users } = req.body; // Array of { userId, password, hcoin, status }
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'Users must be an array' });
    }

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const results = [];
      for (const user of users) {
        const { userId, password, hcoin = 0, status } = user;
        if (!userId) continue;

        // Use UPSERT (INSERT ... ON CONFLICT UPDATE)
        const result = await client.query(
          `INSERT INTO ${schema}.users (user_id, password, hcoin, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             password = EXCLUDED.password,
             hcoin = EXCLUDED.hcoin,
             status = EXCLUDED.status,
             updated_at = CURRENT_TIMESTAMP
           RETURNING user_id, password, hcoin, status`,
          [userId, password || null, hcoin, status || null]
        );

        results.push(result.rows[0]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        count: results.length,
        users: results.map((row) => ({
          userId: row.user_id,
          password: row.password,
          hcoin: Number(row.hcoin),
          status: row.status,
        })),
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error bulk updating users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

