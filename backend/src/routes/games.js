import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { deleteImageFromStorage, extractImageUrlsFromGameData } from '../utils/storage.js';
import { broadcastGameUpdate } from '../socket/index.js';
import { invalidateGameCache } from '../middleware/cache.js';

const router = express.Router();

// Get all games
router.get('/', async (req, res) => {
  try {
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const result = await pool.query(
      `SELECT * FROM ${schema}.games ORDER BY created_at DESC`
    );

    const games = result.rows.map((row) => ({
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...row.game_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Filter out games with empty names
    const filteredGames = games.filter((game) => game.name && game.name.trim().length > 0);

    res.json(filteredGames);
  } catch (error) {
    console.error('Error fetching games:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get game by ID
router.get('/:gameId', async (req, res) => {
  try {
    // ✅ Decode gameId เพื่อรองรับ URL encoding (เช่น %2D สำหรับ -)
    let { gameId } = req.params;
    if (gameId) {
      try {
        gameId = decodeURIComponent(gameId);
      } catch (e) {
        // ถ้า decode ไม่ได้ ให้ใช้ค่าเดิม
      }
    }
    
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    console.log(`[GET /games/${gameId}] Theme: ${theme}, Schema: ${schema}, Requested gameId: ${gameId}, Raw params: ${JSON.stringify(req.params)}`);
    
    // ✅ Validate gameId
    if (!gameId || typeof gameId !== 'string' || gameId.trim().length === 0) {
      console.error(`[GET /games/${gameId}] Invalid gameId: ${gameId}`);
      return res.status(400).json({ error: 'Invalid game ID' });
    }
    
    const trimmedGameId = gameId.trim();
    
    // ✅ ใช้ parameterized query เพื่อป้องกัน SQL injection และให้แน่ใจว่า query ถูกต้อง
    const result = await pool.query(
      `SELECT * FROM ${schema}.games WHERE game_id = $1 LIMIT 1`,
      [trimmedGameId]
    );

    if (result.rows.length === 0) {
      console.log(`[GET /games/${trimmedGameId}] Game not found in database`);
      return res.status(404).json({ error: 'Game not found' });
    }

    const row = result.rows[0];
    
    // ✅ Validate that the returned game_id matches the requested gameId (case-sensitive)
    if (row.game_id !== trimmedGameId) {
      console.error(`[GET /games/${trimmedGameId}] ❌ Game ID mismatch!`, {
        requested: trimmedGameId,
        requestedLength: trimmedGameId.length,
        returned: row.game_id,
        returnedLength: row.game_id?.length,
        requestedBytes: Buffer.from(trimmedGameId).toString('hex'),
        returnedBytes: Buffer.from(row.game_id || '').toString('hex'),
        query: `SELECT * FROM ${schema}.games WHERE game_id = $1`,
        queryParam: trimmedGameId
      });
      return res.status(500).json({ 
        error: 'Internal server error: Game ID mismatch',
        requested: trimmedGameId,
        returned: row.game_id
      });
    }
    
    const game = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...row.game_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    console.log(`[GET /games/${gameId}] ✅ Returning game: ${game.id}, name: ${game.name}`);
    res.json(game);
  } catch (error) {
    console.error('[GET /games/:gameId] Error fetching game:', error);
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

// Create game
router.post('/', async (req, res) => {
  try {
    const {
      gameId,
      name,
      type,
      unlocked = true,
      locked = false,
      userAccessType = 'all',
      selectedUsers,
      gameData: nestedGameData, // Handle nested gameData property
      ...gameData
    } = req.body;

    if (!gameId || !name || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Merge nested gameData with top-level gameData
    const finalGameData = nestedGameData ? { ...gameData, ...nestedGameData } : gameData;

    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    console.log(`[POST /games] Creating game: ${gameId}, Theme: ${theme}, Schema: ${schema}`);
    console.log(`[POST /games] Game data keys: ${Object.keys(finalGameData).join(', ')}`);
    
    const result = await pool.query(
      `INSERT INTO ${schema}.games (game_id, name, type, unlocked, locked, user_access_type, selected_users, game_data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [gameId, name, type, unlocked, locked, userAccessType, selectedUsers ? JSON.stringify(selectedUsers) : null, JSON.stringify(finalGameData)]
    );

    const row = result.rows[0];
    const game = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...row.game_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // ✅ Invalidate cache and broadcast update
    invalidateGameCache(theme, gameId);
    broadcastGameUpdate(theme, gameId, game);

    res.status(201).json(game);
  } catch (error) {
    if (error.code === '23505') {
      // Unique violation
      return res.status(409).json({ error: 'Game already exists' });
    }
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update game
router.put('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const {
      name,
      type,
      unlocked,
      locked,
      userAccessType,
      selectedUsers,
      gameData: nestedGameData, // Handle nested gameData property
      ...gameData
    } = req.body;

    // Merge nested gameData with top-level gameData
    const finalGameData = nestedGameData ? { ...gameData, ...nestedGameData } : gameData;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    if (unlocked !== undefined) {
      updates.push(`unlocked = $${paramIndex++}`);
      values.push(unlocked);
    }
    if (locked !== undefined) {
      updates.push(`locked = $${paramIndex++}`);
      values.push(locked);
    }
    if (userAccessType !== undefined) {
      updates.push(`user_access_type = $${paramIndex++}`);
      values.push(userAccessType);
    }
    if (selectedUsers !== undefined) {
      updates.push(`selected_users = $${paramIndex++}`);
      values.push(selectedUsers ? JSON.stringify(selectedUsers) : null);
    }
    if (Object.keys(finalGameData).length > 0) {
      // Merge with existing game_data
      const theme = req.theme || 'heng36';
      const pool = getPool(theme);
      const schema = getSchema(theme);
      
      console.log(`[PUT /games/${gameId}] Updating game, Theme: ${theme}, Schema: ${schema}`);
      console.log(`[PUT /games/${gameId}] Game data keys: ${Object.keys(finalGameData).join(', ')}`);
      
      const existingResult = await pool.query(
        `SELECT game_data FROM ${schema}.games WHERE game_id = $1`,
        [gameId]
      );
      
      const existingData = existingResult.rows[0]?.game_data || {};
      
      // ✅ Deep merge สำหรับ checkin, bingo, loyKrathong เพื่อไม่ให้ข้อมูลหาย
      let mergedData = { ...existingData };
      
      // Deep merge checkin object
      if (finalGameData.checkin && existingData.checkin) {
        mergedData.checkin = {
          ...existingData.checkin,
          ...finalGameData.checkin,
          // Deep merge rewardCodes
          rewardCodes: {
            ...existingData.checkin.rewardCodes,
            ...finalGameData.checkin.rewardCodes
          },
          // Deep merge completeRewardCodes
          completeRewardCodes: finalGameData.checkin.completeRewardCodes || existingData.checkin.completeRewardCodes,
          // Deep merge coupon.items
          coupon: finalGameData.checkin.coupon ? {
            ...existingData.checkin.coupon,
            ...finalGameData.checkin.coupon,
            items: finalGameData.checkin.coupon.items ? 
              finalGameData.checkin.coupon.items.map((item, index) => ({
                ...(existingData.checkin.coupon?.items?.[index] || {}),
                ...item
              })) : 
              existingData.checkin.coupon?.items
          } : existingData.checkin.coupon
        };
      } else if (finalGameData.checkin) {
        mergedData.checkin = finalGameData.checkin;
      }
      
      // Deep merge bingo object
      if (finalGameData.bingo && existingData.bingo) {
        mergedData.bingo = {
          ...existingData.bingo,
          ...finalGameData.bingo
        };
      } else if (finalGameData.bingo) {
        mergedData.bingo = finalGameData.bingo;
      }
      
      // Deep merge loyKrathong object
      if (finalGameData.loyKrathong && existingData.loyKrathong) {
        mergedData.loyKrathong = {
          ...existingData.loyKrathong,
          ...finalGameData.loyKrathong
        };
      } else if (finalGameData.loyKrathong) {
        mergedData.loyKrathong = finalGameData.loyKrathong;
      }
      
      // Merge properties อื่นๆ แบบปกติ
      Object.keys(finalGameData).forEach(key => {
        if (key !== 'checkin' && key !== 'bingo' && key !== 'loyKrathong') {
          mergedData[key] = finalGameData[key];
        }
      });
      
      updates.push(`game_data = $${paramIndex++}`);
      values.push(JSON.stringify(mergedData));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(gameId);
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    const query = `
      UPDATE ${schema}.games 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE game_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const row = result.rows[0];
    const game = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...row.game_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // ✅ Invalidate cache and broadcast update
    invalidateGameCache(theme, gameId);
    broadcastGameUpdate(theme, gameId, game);

    res.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete game
router.delete('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    // ✅ Get game data first to extract image URLs
    const gameResult = await pool.query(
      `SELECT game_data FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );
    
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const gameData = gameResult.rows[0].game_data || {};
    
    // ✅ Extract and delete images from Supabase Storage
    const imageUrls = extractImageUrlsFromGameData(gameData);
    if (imageUrls.length > 0) {
      console.log(`[${theme}] Deleting ${imageUrls.length} image(s) from storage for game ${gameId}`);
      const deletePromises = imageUrls.map(async (url) => {
        const result = await deleteImageFromStorage(url, theme);
        if (!result) {
          console.warn(`[${theme}] Failed to delete image:`, url);
        }
        return result;
      });
      const results = await Promise.allSettled(deletePromises);
      
      // Log summary
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      const failCount = results.length - successCount;
      if (failCount > 0) {
        console.warn(`[${theme}] Deleted ${successCount}/${imageUrls.length} images successfully. ${failCount} failed.`);
      } else {
        console.log(`[${theme}] Successfully deleted all ${imageUrls.length} image(s) from storage.`);
      }
    } else {
      console.log(`[${theme}] No images to delete for game ${gameId}`);
    }
    
    // Delete related data first (cascade delete)
    // Delete answers
    await pool.query(
      `DELETE FROM ${schema}.answers WHERE game_id = $1`,
      [gameId]
    );
    
    // Delete checkins
    await pool.query(
      `DELETE FROM ${schema}.checkins WHERE game_id = $1`,
      [gameId]
    );
    
    // Delete presence
    await pool.query(
      `DELETE FROM ${schema}.presence WHERE game_id = $1`,
      [gameId]
    );
    
    // Delete bingo data
    await pool.query(
      `DELETE FROM ${schema}.bingo_cards WHERE game_id = $1`,
      [gameId]
    );
    await pool.query(
      `DELETE FROM ${schema}.bingo_players WHERE game_id = $1`,
      [gameId]
    );
    await pool.query(
      `DELETE FROM ${schema}.bingo_game_state WHERE game_id = $1`,
      [gameId]
    );
    
    // Delete the game
    const result = await pool.query(
      `DELETE FROM ${schema}.games WHERE game_id = $1 RETURNING *`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // ✅ Invalidate cache and broadcast deletion
    invalidateGameCache(theme, gameId);
    broadcastGameUpdate(theme, gameId, null); // null indicates deletion

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim code endpoint (atomic transaction)
router.post('/:gameId/claim-code', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get game with FOR UPDATE lock (prevents concurrent claims)
      const gameResult = await client.query(
        `SELECT game_id, game_data FROM ${schema}.games 
         WHERE game_id = $1 FOR UPDATE`,
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];
      const gameData = game.game_data || {};
      
      // Helper function to convert codes to array
      const codesToArray = (codes) => {
        if (Array.isArray(codes)) return codes;
        if (codes && typeof codes === 'object') {
          return Object.keys(codes)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => String(codes[k] || ''));
        }
        return [];
      };

      const codes = codesToArray(gameData.codes);
      const codesVersion = Number(gameData.codesVersion || 0);
      const codeCursor = Number(gameData.codeCursor || 0);
      const claimedBy = gameData.claimedBy || {};

      // Check if user already claimed
      const existing = claimedBy[userId];
      if (existing) {
        const existingVersion = Number(existing.version || 0);
        // If same version, user already claimed
        if (!codesVersion || existingVersion === codesVersion) {
          await client.query('COMMIT');
          return res.json({ 
            status: 'ALREADY',
            code: existing.code || null
          });
        }
        // Different version, remove old claim
        delete claimedBy[userId];
      }

      const total = codes.length;

      // Check if codes are empty or sold out
      if (total <= 0 || codeCursor >= total) {
        await client.query('COMMIT');
        return res.json({ status: 'EMPTY' });
      }

      // ✅ Claim next code - ตรวจสอบโค้ดซ้ำระหว่าง USER
      let idx = codeCursor;
      let code = codes[idx] || '';
      let newCodeCursor = codeCursor + 1;

      // ✅ ตรวจสอบว่าโค้ดนี้เคยถูกแจกให้ USER อื่นแล้วหรือยัง
      const codeAlreadyClaimed = Object.values(claimedBy).some(
        (claim) => claim && claim.code === code
      );

      // ✅ ถ้าโค้ดนี้เคยถูกแจกไปแล้ว ให้หาโค้ดถัดไปที่ยังไม่เคยถูกแจก
      if (codeAlreadyClaimed) {
        let nextIndex = codeCursor + 1;
        let found = false;
        
        while (nextIndex < codes.length) {
          const nextCode = codes[nextIndex];
          const nextCodeClaimed = Object.values(claimedBy).some(
            (claim) => claim && claim.code === nextCode
          );
          
          if (!nextCodeClaimed) {
            // ✅ พบโค้ดที่ยังไม่เคยถูกแจก
            code = nextCode;
            idx = nextIndex;
            newCodeCursor = nextIndex + 1;
            found = true;
            break;
          }
          nextIndex++;
        }
        
        // ✅ ถ้าไม่พบโค้ดที่ยังไม่เคยถูกแจก → โค้ดหมด
        if (!found) {
          await client.query('COMMIT');
          return res.json({ status: 'EMPTY' });
        }
      }

      // Update claimedBy
      claimedBy[userId] = {
        idx,
        code,
        ts: Date.now(),
        ...(codesVersion ? { version: codesVersion } : {})
      };

      // Update game_data
      const updatedGameData = {
        ...gameData,
        codeCursor: newCodeCursor,
        claimedBy
      };

      // Update game in database
      await client.query(
        `UPDATE ${schema}.games 
         SET game_data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE game_id = $2`,
        [JSON.stringify(updatedGameData), gameId]
      );

      await client.query('COMMIT');

      return res.json({
        status: 'SUCCESS',
        code: code,
        index: idx
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error claiming code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim big prize code (for LoyKrathong game)
router.post('/:gameId/claim-code/big-prize', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const gameResult = await client.query(
        `SELECT game_id, game_data FROM ${schema}.games 
         WHERE game_id = $1 FOR UPDATE`,
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];
      const gameData = game.game_data || {};
      const loyKrathong = gameData.loyKrathong || {};
      
      const codesToArray = (codes) => {
        if (Array.isArray(codes)) return codes;
        if (codes && typeof codes === 'object') {
          return Object.keys(codes)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => String(codes[k] || ''));
        }
        return [];
      };

      const bigPrizeCodes = codesToArray(loyKrathong.bigPrizeCodes);
      const bigPrizeCodeCursor = Number(loyKrathong.bigPrizeCodeCursor || 0);
      const bigPrizeClaimedBy = loyKrathong.bigPrizeClaimedBy || {};

      // Check if user already claimed
      if (bigPrizeClaimedBy[userId]) {
        await client.query('COMMIT');
        return res.json({ 
          status: 'ALREADY',
          code: bigPrizeClaimedBy[userId].code || null
        });
      }

      const total = bigPrizeCodes.length;

      if (total <= 0 || bigPrizeCodeCursor >= total) {
        await client.query('COMMIT');
        return res.json({ status: 'EMPTY' });
      }

      // Claim next code - ตรวจสอบโค้ดซ้ำระหว่าง USER
      let idx = bigPrizeCodeCursor;
      let code = bigPrizeCodes[idx] || '';
      let newCodeCursor = bigPrizeCodeCursor + 1;

      const codeAlreadyClaimed = Object.values(bigPrizeClaimedBy).some(
        (claim) => claim && claim.code === code
      );

      if (codeAlreadyClaimed) {
        let nextIndex = bigPrizeCodeCursor + 1;
        let found = false;
        
        while (nextIndex < bigPrizeCodes.length) {
          const nextCode = bigPrizeCodes[nextIndex];
          const nextCodeClaimed = Object.values(bigPrizeClaimedBy).some(
            (claim) => claim && claim.code === nextCode
          );
          
          if (!nextCodeClaimed) {
            code = nextCode;
            idx = nextIndex;
            newCodeCursor = nextIndex + 1;
            found = true;
            break;
          }
          nextIndex++;
        }
        
        if (!found) {
          await client.query('COMMIT');
          return res.json({ status: 'EMPTY' });
        }
      }

      bigPrizeClaimedBy[userId] = {
        idx,
        code,
        ts: Date.now()
      };

      const updatedGameData = {
        ...gameData,
        loyKrathong: {
          ...loyKrathong,
          bigPrizeCodeCursor: newCodeCursor,
          bigPrizeClaimedBy
        }
      };

      await client.query(
        `UPDATE ${schema}.games 
         SET game_data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE game_id = $2`,
        [JSON.stringify(updatedGameData), gameId]
      );

      await client.query('COMMIT');

      return res.json({
        status: 'SUCCESS',
        code: code,
        index: idx
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error claiming big prize code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim daily reward code (for Checkin game)
router.post('/:gameId/claim-code/daily-reward/:dayIndex', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { dayIndex } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const dayIdx = parseInt(dayIndex);
    if (isNaN(dayIdx) || dayIdx < 0) {
      return res.status(400).json({ error: 'Invalid dayIndex' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const gameResult = await client.query(
        `SELECT game_id, game_data FROM ${schema}.games 
         WHERE game_id = $1 FOR UPDATE`,
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }

    const game = gameResult.rows[0];
    const gameData = game.game_data || {};
    const checkin = gameData.checkin || {};
    const rewardCodes = checkin.rewardCodes || {};
    const rewardCodesData = rewardCodes[dayIdx] || {};
    
    console.log(`[POST /games/${gameId}/claim-code/daily-reward/${dayIndex}] Day index: ${dayIdx}, Reward codes keys: ${Object.keys(rewardCodes).join(', ')}, Data exists: ${!!rewardCodesData.codes}`);

      const codesToArray = (codes) => {
        if (Array.isArray(codes)) return codes;
        if (codes && typeof codes === 'object') {
          return Object.keys(codes)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => String(codes[k] || ''));
        }
        return [];
      };

      const codes = codesToArray(rewardCodesData.codes || []);
      const cursor = Number(rewardCodesData.cursor || 0);
      const claimedBy = rewardCodesData.claimedBy || {};

      // Check if user already claimed
      if (claimedBy[userId] && claimedBy[userId].code) {
        await client.query('COMMIT');
        return res.json({ 
          status: 'ALREADY',
          code: claimedBy[userId].code
        });
      }

      const total = codes.length;

      if (total <= 0 || cursor >= total) {
        await client.query('COMMIT');
        return res.json({ status: 'EMPTY' });
      }

      // Claim next code - ตรวจสอบโค้ดซ้ำระหว่าง USER
      let idx = cursor;
      let code = codes[idx] || '';
      let newCursor = cursor + 1;

      const codeAlreadyClaimed = Object.values(claimedBy).some(
        (claim) => claim && claim.code === code
      );

      if (codeAlreadyClaimed) {
        let nextIndex = cursor + 1;
        let found = false;
        
        while (nextIndex < codes.length) {
          const nextCode = codes[nextIndex];
          const nextCodeClaimed = Object.values(claimedBy).some(
            (claim) => claim && claim.code === nextCode
          );
          
          if (!nextCodeClaimed) {
            code = nextCode;
            idx = nextIndex;
            newCursor = nextIndex + 1;
            found = true;
            break;
          }
          nextIndex++;
        }
        
        if (!found) {
          await client.query('COMMIT');
          return res.json({ status: 'EMPTY' });
        }
      }

      claimedBy[userId] = {
        code,
        ts: Date.now()
      };

      const updatedGameData = {
        ...gameData,
        checkin: {
          ...checkin,
          rewardCodes: {
            ...rewardCodes,
            [dayIdx]: {
              ...rewardCodesData,
              cursor: newCursor,
              codes: codes,
              claimedBy
            }
          }
        }
      };

      await client.query(
        `UPDATE ${schema}.games 
         SET game_data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE game_id = $2`,
        [JSON.stringify(updatedGameData), gameId]
      );

      await client.query('COMMIT');

      return res.json({
        status: 'SUCCESS',
        code: code,
        index: idx
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error claiming daily reward code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim complete reward code (for Checkin game)
router.post('/:gameId/claim-code/complete-reward', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const gameResult = await client.query(
        `SELECT game_id, game_data FROM ${schema}.games 
         WHERE game_id = $1 FOR UPDATE`,
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];
      const gameData = game.game_data || {};
      const checkin = gameData.checkin || {};
      const completeRewardCodes = checkin.completeRewardCodes || {};

      const codesToArray = (codes) => {
        if (Array.isArray(codes)) return codes;
        if (codes && typeof codes === 'object') {
          return Object.keys(codes)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => String(codes[k] || ''));
        }
        return [];
      };

      const codes = codesToArray(completeRewardCodes.codes || []);
      const cursor = Number(completeRewardCodes.cursor || 0);
      const claimedBy = completeRewardCodes.claimedBy || {};

      // Check if user already claimed
      if (claimedBy[userId] && claimedBy[userId].code) {
        await client.query('COMMIT');
        return res.json({ 
          status: 'ALREADY',
          code: claimedBy[userId].code
        });
      }

      const total = codes.length;

      if (total <= 0 || cursor >= total) {
        await client.query('COMMIT');
        return res.json({ status: 'EMPTY' });
      }

      // Claim next code - ตรวจสอบโค้ดซ้ำระหว่าง USER
      let idx = cursor;
      let code = codes[idx] || '';
      let newCursor = cursor + 1;

      const codeAlreadyClaimed = Object.values(claimedBy).some(
        (claim) => claim && claim.code === code
      );

      if (codeAlreadyClaimed) {
        let nextIndex = cursor + 1;
        let found = false;
        
        while (nextIndex < codes.length) {
          const nextCode = codes[nextIndex];
          const nextCodeClaimed = Object.values(claimedBy).some(
            (claim) => claim && claim.code === nextCode
          );
          
          if (!nextCodeClaimed) {
            code = nextCode;
            idx = nextIndex;
            newCursor = nextIndex + 1;
            found = true;
            break;
          }
          nextIndex++;
        }
        
        if (!found) {
          await client.query('COMMIT');
          return res.json({ status: 'EMPTY' });
        }
      }

      claimedBy[userId] = {
        code,
        ts: Date.now()
      };

      const updatedGameData = {
        ...gameData,
        checkin: {
          ...checkin,
          completeRewardCodes: {
            ...completeRewardCodes,
            cursor: newCursor,
            codes: codes,
            claimedBy
          }
        }
      };

      await client.query(
        `UPDATE ${schema}.games 
         SET game_data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE game_id = $2`,
        [JSON.stringify(updatedGameData), gameId]
      );

      await client.query('COMMIT');

      return res.json({
        status: 'SUCCESS',
        code: code,
        index: idx
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error claiming complete reward code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim coupon code (for Checkin game)
router.post('/:gameId/claim-code/coupon/:itemIndex', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { itemIndex } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const itemIdx = parseInt(itemIndex);
    if (isNaN(itemIdx) || itemIdx < 0) {
      return res.status(400).json({ error: 'Invalid itemIndex' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const gameResult = await client.query(
        `SELECT game_id, game_data FROM ${schema}.games 
         WHERE game_id = $1 FOR UPDATE`,
        [gameId]
      );

      if (gameResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Game not found' });
      }

      const game = gameResult.rows[0];
      const gameData = game.game_data || {};
      const checkin = gameData.checkin || {};
      const coupon = checkin.coupon || {};
      const items = coupon.items || [];
      const item = items[itemIdx];

      if (!item) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Coupon item not found' });
      }

      // ✅ ลบ debug logs เพื่อเพิ่มความเร็ว (เปิดได้เมื่อต้องการ debug)
      // console.log(`[claimCouponCode] Game: ${gameId}, ItemIndex: ${itemIdx}, User: ${userId}`);

      const codesToArray = (codes) => {
        if (Array.isArray(codes)) return codes;
        if (codes && typeof codes === 'object') {
          return Object.keys(codes)
            .sort((a, b) => Number(a) - Number(b))
            .map(k => String(codes[k] || ''))
            .filter(Boolean); // ✅ กรองโค้ดว่างออก
        }
        return [];
      };

      const codes = codesToArray(item.codes || []);
      const cursor = Number(item.cursor || 0);
      const claimedBy = item.claimedBy || {};

      // ✅ ลบ debug logs เพื่อเพิ่มความเร็ว (เปิดได้เมื่อต้องการ debug)
      // console.log(`[claimCouponCode] After codesToArray:`, {...});

      const total = codes.length;

      if (total <= 0) {
        await client.query('COMMIT');
        // console.log(`[claimCouponCode] Codes empty: total=${total}`);
        return res.json({ status: 'EMPTY' });
      }

      // ✅ สร้าง Set ของโค้ดที่ถูกแจกไปแล้วทั้งหมด (จาก claimedBy)
      const claimedCodesSet = new Set();
      Object.values(claimedBy || {}).forEach((claim) => {
        if (claim) {
          // ✅ รองรับทั้งรูปแบบเก่า (claim.code) และรูปแบบใหม่ (claim เป็น array)
          if (Array.isArray(claim)) {
            claim.forEach((c) => {
              if (c && c.code) claimedCodesSet.add(String(c.code));
            });
          } else if (claim.code) {
            claimedCodesSet.add(String(claim.code));
          }
        }
      });

      // ✅ หาโค้ดถัดไปที่ยังไม่ถูกแจก (เริ่มจาก cursor)
      let idx = cursor;
      let code = null;
      let newCursor = cursor;

      // ✅ หาโค้ดถัดไปที่ยังไม่ถูกแจก (FIFO - First In First Out)
      while (idx < codes.length) {
        const candidateCode = String(codes[idx] || '').trim();
        if (candidateCode && !claimedCodesSet.has(candidateCode)) {
          code = candidateCode;
          newCursor = idx + 1;
          break;
        }
        idx++;
      }

      // ✅ ถ้าไม่พบโค้ดที่ยังไม่ถูกแจก
      if (!code) {
        await client.query('COMMIT');
        // console.log(`[claimCouponCode] All codes claimed: total=${total}, claimed=${claimedCodesSet.size}`);
        return res.json({ status: 'EMPTY' });
      }

      // ✅ บันทึกโค้ดที่ user ได้ไป (เก็บเป็น array เพื่อให้ user แลกได้หลายครั้ง)
      if (!claimedBy[userId]) {
        claimedBy[userId] = [];
      }
      // ✅ ตรวจสอบว่าเป็น array หรือไม่ (รองรับรูปแบบเก่า)
      if (!Array.isArray(claimedBy[userId])) {
        // ✅ แปลงจากรูปแบบเก่า (object) เป็น array
        const oldClaim = claimedBy[userId];
        claimedBy[userId] = oldClaim.code ? [{ code: oldClaim.code, ts: oldClaim.ts || Date.now() }] : [];
      }
      // ✅ เพิ่มโค้ดใหม่เข้าไป
      claimedBy[userId].push({
        code,
        ts: Date.now()
      });

      const updatedItems = [...items];
      updatedItems[itemIdx] = {
        ...item,
        cursor: newCursor,
        codes: codes,
        claimedBy
      };

      const updatedGameData = {
        ...gameData,
        checkin: {
          ...checkin,
          coupon: {
            ...coupon,
            items: updatedItems
          }
        }
      };

      await client.query(
        `UPDATE ${schema}.games 
         SET game_data = $1, updated_at = CURRENT_TIMESTAMP
         WHERE game_id = $2`,
        [JSON.stringify(updatedGameData), gameId]
      );

      await client.query('COMMIT');

      return res.json({
        status: 'SUCCESS',
        code: code,
        index: idx
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error claiming coupon code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

