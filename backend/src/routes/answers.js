import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { broadcastAnswerUpdate } from '../socket/index.js';

const router = express.Router();

// Get answers for a game
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    console.log(`[GET /answers/${gameId}] Theme: ${theme}, Schema: ${schema}, Limit: ${limit}`);

    const result = await pool.query(
      `SELECT id, game_id, user_id, answer, correct, code, created_at
       FROM ${schema}.answers
       WHERE game_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [gameId, limit]
    );

    const answers = result.rows.map((row) => {
      // ✅ Parse answer field ถ้าเป็น JSON string (สำหรับ coupon-redeem, checkin, etc.)
      let answerData = row.answer;
      let action;
      let itemIndex;
      let price;
      let balanceBefore;
      let balanceAfter;
      
      try {
        const parsed = JSON.parse(row.answer);
        if (parsed && typeof parsed === 'object') {
          answerData = parsed.text || parsed.answer || row.answer;
          action = parsed.action;
          itemIndex = parsed.itemIndex;
          price = parsed.price;
          balanceBefore = parsed.balanceBefore;
          balanceAfter = parsed.balanceAfter;
        }
      } catch (e) {
        // ไม่ใช่ JSON string - ใช้ค่าเดิม
        answerData = row.answer;
      }
      
      return {
        id: row.id.toString(),
        gameId: row.game_id,
        userId: row.user_id,
        answer: answerData,
        correct: row.correct || false,
        code: row.code || null,
        action: action,
        itemIndex: itemIndex,
        price: price,
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        createdAt: row.created_at,
      };
    });

    res.json(answers);
  } catch (error) {
    console.error('[GET /answers/:gameId] Error fetching answers:', error);
    console.error('Error details:', {
      theme: req.theme || 'heng36',
      schema: getSchema(req.theme || 'heng36'),
      gameId: req.params.gameId,
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      code: error.code
    });
  }
});

// Submit answer
router.post('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId, answer, correct, code, action, itemIndex, price, balanceBefore, balanceAfter, ...extraFields } = req.body;

    console.log(`[POST /answers/${gameId}] Submitting answer:`, {
      theme: req.theme || 'heng36',
      gameId,
      userId,
      answerLength: answer?.length || 0,
      hasExtraFields: Object.keys(extraFields).length > 0
    });

    if (!userId || answer === undefined) {
      console.error(`[POST /answers/${gameId}] Missing required fields:`, { userId: !!userId, answer: answer !== undefined });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    // ✅ สร้าง answer text ที่รวมข้อมูลเพิ่มเติม (action, itemIndex, price, etc.)
    // ถ้า answer เป็น JSON string อยู่แล้ว หรือเป็น plain text
    let answerText = answer;
    if (action || itemIndex !== undefined || price !== undefined || balanceBefore !== undefined || balanceAfter !== undefined || Object.keys(extraFields).length > 0) {
      // ✅ สร้าง object ที่รวมข้อมูลทั้งหมด
      const answerData = {
        text: answer || '',
        action: action || null,
        itemIndex: itemIndex !== undefined ? itemIndex : null,
        price: price !== undefined ? price : null,
        balanceBefore: balanceBefore !== undefined ? balanceBefore : null,
        balanceAfter: balanceAfter !== undefined ? balanceAfter : null,
        ...extraFields
      };
      // ✅ เก็บเป็น JSON string ใน answer field
      answerText = JSON.stringify(answerData);
    }
    
    // Check if correct and code columns exist, if not use default values
    const result = await pool.query(
      `INSERT INTO ${schema}.answers (game_id, user_id, answer, correct, code, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [gameId, userId, answerText, correct || false, code || null]
    );

    const row = result.rows[0];
    
    if (!row) {
      throw new Error('Failed to insert answer: no row returned');
    }
    
    // ✅ Broadcast Socket.io update
    let answerData = row.answer;
    try {
      if (typeof answerData === 'string') {
        answerData = JSON.parse(answerData);
      }
    } catch (e) {
      // Keep as string if not JSON
    }
    
    const answerPayload = {
      id: row.id.toString(),
      userId: row.user_id,
      answer: answerData,
      correct: row.correct,
      code: row.code,
      createdAt: row.created_at,
      action: answerData?.action,
      itemIndex: answerData?.itemIndex,
      price: answerData?.price,
      balanceBefore: answerData?.balanceBefore,
      balanceAfter: answerData?.balanceAfter,
    };
    broadcastAnswerUpdate(theme, gameId, answerPayload);
    
    console.log(`[POST /answers/${gameId}] Answer submitted successfully:`, {
      id: row.id.toString(),
      userId: row.user_id,
      gameId
    });
    
    res.status(201).json({
      id: row.id.toString(),
      gameId: row.game_id,
      userId: row.user_id,
      answer: row.answer,
      correct: row.correct || false,
      code: row.code || null,
      ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error(`[POST /answers/${req.params.gameId}] Error submitting answer:`, error);
    console.error('Error details:', {
      theme: req.theme || 'heng36',
      schema: getSchema(req.theme || 'heng36'),
      gameId: req.params.gameId,
      userId: req.body?.userId,
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    // If column doesn't exist, try without correct/code
    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
      try {
        const theme = req.theme || 'heng36';
        const pool = getPool(theme);
        const schema = getSchema(theme);
        const { gameId } = req.params;
        const { userId, answer } = req.body;
        
        const result = await pool.query(
          `INSERT INTO ${schema}.answers (game_id, user_id, answer, created_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           RETURNING *`,
          [gameId, userId, answer]
        );

        const row = result.rows[0];
        res.status(201).json({
          id: row.id.toString(),
          gameId: row.game_id,
          userId: row.user_id,
          answer: row.answer,
          correct: false,
          code: null,
          ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
          createdAt: row.created_at,
        });
        return;
      } catch (fallbackError) {
        console.error('Fallback insert also failed:', fallbackError);
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Update answer
router.put('/:gameId/:answerId', async (req, res) => {
  try {
    const { gameId, answerId } = req.params;
    const { answer, correct, code } = req.body;

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (answer !== undefined) {
      updates.push(`answer = $${paramIndex++}`);
      values.push(answer);
    }
    if (correct !== undefined) {
      updates.push(`correct = $${paramIndex++}`);
      values.push(correct);
    }
    if (code !== undefined) {
      updates.push(`code = $${paramIndex++}`);
      values.push(code);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(answerId, gameId);
    const query = `
      UPDATE ${schema}.answers 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex++} AND game_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    const row = result.rows[0];
    res.json({
      id: row.id.toString(),
      gameId: row.game_id,
      userId: row.user_id,
      answer: row.answer,
      correct: row.correct || false,
      code: row.code || null,
      ts: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Error updating answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Delete answer
router.delete('/:gameId/:answerId', async (req, res) => {
  try {
    const { gameId, answerId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    const result = await pool.query(
      `DELETE FROM ${schema}.answers WHERE id = $1 AND game_id = $2 RETURNING id`,
      [answerId, gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Answer not found' });
    }

    res.json({ success: true, answerId });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

