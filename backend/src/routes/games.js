import express from 'express';
import { getPool, getSchema } from '../config/database.js';
import { deleteImageFromStorage, extractImageUrlsFromGameData } from '../utils/storage.js';
import { broadcastGameUpdate, getIO } from '../socket/index.js';
import { getGameSnapshot } from '../snapshot/snapshotEngine.js';
import { delCache } from '../cache/cacheService.js';
import { mergeGameData, extractChangedFields } from '../utils/gameMerge.js';
import { processImageFields } from '../utils/imageProcessor.js';
import { claimDailyRewardCode, claimCompleteRewardCode, claimCouponCode } from '../services/rewardCodeService.js';
import { addUserCoins, deductUserCoins } from '../services/userCoinService.js';
// ✅ OPTIMIZATION: Import CDN utilities to ensure all image URLs use CDN
import { processImageUrlsInObject, convertToCDNUrl } from '../utils/cdnUtils.js';

const router = express.Router();

// Get all games
router.get('/', async (req, res) => {
  try {
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    
    // ✅ ตรวจสอบว่า pool พร้อมใช้งาน
    if (!pool) {
      console.error(`[GET /games] Database pool not found for theme: ${theme}`);
      return res.status(503).json({
        error: 'Database unavailable',
        message: `Database pool not available for theme: ${theme}`
      });
    }
    
    const schema = getSchema(theme);
    
    // ✅ Add pagination to reduce bandwidth for large game lists
    // Backward compatible: if no pagination params, return array (old format)
    const usePagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100, default 50
    const offset = (page - 1) * limit;
    
    let result;
    let total = null;
    
    // ✅ เพิ่ม timeout protection สำหรับทุก query
    const queryTimeout = 30000; // 30 seconds
    
    if (usePagination) {
      // ✅ Get total count for pagination metadata
      try {
        const [countResult, queryResult] = await Promise.all([
          Promise.race([
            pool.query(
              `SELECT COUNT(*) as total FROM ${schema}.games WHERE name IS NOT NULL AND name != ''`
            ),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Count query timeout')), queryTimeout)
            )
          ]),
          Promise.race([
            pool.query(
              `SELECT * FROM ${schema}.games 
               WHERE name IS NOT NULL AND name != ''
               ORDER BY created_at DESC 
               LIMIT $1 OFFSET $2`,
              [limit, offset]
            ),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), queryTimeout)
            )
          ])
        ]);
        total = parseInt(countResult.rows[0].total);
        result = queryResult;
      } catch (queryError) {
        console.error(`[GET /games] Query error for theme ${theme}:`, {
          message: queryError.message,
          code: queryError.code,
          detail: queryError.detail
        });
        throw queryError;
      }
    } else {
      // ✅ Backward compatible: return all games as array (old behavior)
      // ✅ เพิ่ม error handling และ timeout protection
      try {
        // ✅ Debug: Query ทั้งหมดก่อน filter เพื่อดูว่ามีเกมอะไรบ้าง
        const allGamesResult = await pool.query(
          `SELECT game_id, name, type, created_at FROM ${schema}.games ORDER BY created_at DESC`
        );
        console.log(`[GET /games] Total games in database (${theme}):`, allGamesResult.rows.length);
        console.log(`[GET /games] All games:`, allGamesResult.rows.map(r => ({
          id: r.game_id,
          name: r.name,
          nameIsNull: r.name === null,
          nameIsEmpty: r.name === '',
          nameLength: r.name?.length || 0
        })));
        
        result = await Promise.race([
          pool.query(
            `SELECT * FROM ${schema}.games 
             WHERE name IS NOT NULL AND name != ''
             ORDER BY created_at DESC`
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout after 30 seconds')), queryTimeout)
          )
        ]);
        
        console.log(`[GET /games] Games after filter (${theme}):`, result.rows.length);
      } catch (queryError) {
        console.error(`[GET /games] Query error for theme ${theme}:`, {
          message: queryError.message,
          code: queryError.code,
          detail: queryError.detail
        });
        throw queryError;
      }
    }

    // ✅ Map games with error handling for each row
    const games = result.rows.map((row) => {
      try {
        // ✅ Validate game_data is valid JSON
        let gameData = row.game_data;
        if (gameData && typeof gameData === 'string') {
          try {
            gameData = JSON.parse(gameData);
          } catch (parseError) {
            console.warn(`[GET /games] Invalid JSON in game_data for game ${row.game_id}:`, parseError.message);
            gameData = {};
          }
        }
        
        return {
          id: row.game_id,
          name: row.name || '',
          type: row.type || '',
          unlocked: row.unlocked || false,
          locked: row.locked || false,
          userAccessType: row.user_access_type || 'all',
          selectedUsers: row.selected_users || [],
          ...(gameData || {}),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      } catch (rowError) {
        console.error(`[GET /games] Error mapping game ${row.game_id}:`, rowError.message);
        // ✅ Return minimal game object if mapping fails
        return {
          id: row.game_id,
          name: row.name || '',
          type: row.type || '',
          unlocked: row.unlocked || false,
          locked: row.locked || false,
          userAccessType: row.user_access_type || 'all',
          selectedUsers: row.selected_users || [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }
    });

    // ✅ Return paginated response if pagination requested, otherwise array (backward compatible)
    if (usePagination) {
      res.json({
        games,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } else {
      // ✅ OPTIMIZATION: Convert all image URLs to CDN before sending
      const gamesWithCDN = games.map(game => processImageUrlsInObject(game, theme));
      res.json(gamesWithCDN);
    }
  } catch (error) {
    console.error('[GET /games] Error fetching games:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    
    // ✅ Return empty array instead of error to prevent frontend crash
    // Frontend can handle empty array gracefully
    res.status(200).json([]);
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
    
    // ✅ Debug: Log การเรียก API
    console.log(`[GET /games/${gameId}] Request received:`, {
      gameId,
      theme,
      query: req.query,
      fullData: req.query.full === 'true' || req.query.full === '1'
    });
    
    // ✅ Validate gameId
    if (!gameId || typeof gameId !== 'string' || gameId.trim().length === 0) {
      console.error(`[GET /games/${gameId}] Invalid gameId: ${gameId}`);
      return res.status(400).json({ error: 'Invalid game ID' });
    }
    
    const trimmedGameId = gameId.trim();
    
    // ✅ Check if full data is requested (for edit mode)
    const requestFullData = req.query.full === 'true' || req.query.full === '1';
    
    // ✅ If full data is requested, skip snapshot and fetch from DB directly
    if (!requestFullData) {
      // ✅ Try to get snapshot from cache first (optimized path)
      const snapshot = await getGameSnapshot(theme, trimmedGameId);
      
      if (snapshot) {
        // ✅ Field projection: allow clients to request only needed fields
        const requestedFields = req.query.fields 
          ? req.query.fields.split(',').map(f => f.trim()).filter(Boolean)
          : null;
        
        let game = snapshot;
        if (requestedFields && requestedFields.length > 0) {
          game = {};
          requestedFields.forEach(field => {
            if (field.includes('.')) {
              const [parent, child] = field.split('.');
              if (snapshot[parent] && typeof snapshot[parent] === 'object') {
                if (!game[parent]) game[parent] = {};
                game[parent][child] = snapshot[parent][child];
              }
            } else if (snapshot.hasOwnProperty(field)) {
              game[field] = snapshot[field];
            }
          });
          if (!game.id) game.id = snapshot.id;
        }
        
        // ✅ OPTIMIZATION: Convert all image URLs to CDN before sending
        const gameWithCDN = processImageUrlsInObject(game, theme);
        
        res.set('X-Cache', 'HIT');
        return res.json(gameWithCDN);
      }
    }
    
    // ✅ Fallback to database if snapshot not available
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    if (!pool) {
      console.error(`[GET /games] Database pool not found for theme: ${theme}`);
      return res.status(503).json({
        error: 'Database unavailable',
        message: `Database pool not available for theme: ${theme}`
      });
    }
    
    const requestedFields = req.query.fields 
      ? req.query.fields.split(',').map(f => f.trim()).filter(Boolean)
      : null;
    
    // ✅ Debug: Log requested fields (always log to help debug)
    console.log(`[GET /games/${trimmedGameId}] Requested fields:`, {
      gameId: trimmedGameId,
      hasRequestedFields: !!requestedFields,
      requestedFields: requestedFields,
      queryParams: req.query
    });
    
    // ✅ ใช้ parameterized query เพื่อป้องกัน SQL injection
    const result = await pool.query(
      `SELECT game_id, name, type, unlocked, locked, user_access_type, selected_users, game_data, created_at, updated_at FROM ${schema}.games WHERE game_id = $1 LIMIT 1`,
      [trimmedGameId]
    );

    if (result.rows.length === 0) {
      console.log(`[GET /games/${trimmedGameId}] Game not found in database`);
      return res.status(404).json({ error: 'Game not found' });
    }

    const row = result.rows[0];
    
    // ✅ Parse game_data if it's a string (PostgreSQL JSONB should be auto-parsed, but check anyway)
    let gameData = row.game_data;
    if (gameData && typeof gameData === 'string') {
      try {
        gameData = JSON.parse(gameData);
      } catch (parseError) {
        console.error(`[GET /games/${trimmedGameId}] Error parsing game_data:`, parseError);
        gameData = {};
      }
    }
    
    // ✅ Debug: Log raw game_data from database (always log to help debug)
    console.log(`[GET /games/${trimmedGameId}] Raw game_data from DB:`, {
      gameId: trimmedGameId,
      hasGameData: !!gameData,
      gameDataType: typeof gameData,
      gameDataIsString: typeof row.game_data === 'string',
      gameDataKeys: gameData ? Object.keys(gameData) : [],
      hasAnnounce: !!(gameData?.announce),
      announceKeys: gameData?.announce ? Object.keys(gameData.announce) : [],
      announceUsersCount: Array.isArray(gameData?.announce?.users) ? gameData.announce.users.length : (gameData?.announce?.users ? 'not-array' : 0),
      announceUserBonusesCount: Array.isArray(gameData?.announce?.userBonuses) ? gameData.announce.userBonuses.length : (gameData?.announce?.userBonuses ? 'not-array' : 0),
      // ✅ เพิ่ม logging สำหรับ game types อื่นๆ
      hasNumberPick: !!(gameData?.numberPick),
      numberPickKeys: gameData?.numberPick ? Object.keys(gameData.numberPick) : [],
      numberPickImageDataUrl: gameData?.numberPick?.imageDataUrl ? gameData.numberPick.imageDataUrl.substring(0, 50) + '...' : null,
      numberPickEndAt: gameData?.numberPick?.endAt,
      hasPuzzle: !!(gameData?.puzzle),
      hasFootball: !!(gameData?.football),
      hasSlot: !!(gameData?.slot),
      hasCheckin: !!(gameData?.checkin),
      hasBingo: !!(gameData?.bingo),
      hasLoyKrathong: !!(gameData?.loyKrathong),
      hasTrickOrTreat: !!(gameData?.trickOrTreat),
      // ✅ Log full game_data structure for debugging
      fullGameData: gameData
    });
    
    // ✅ Debug: Log ข้อมูลที่โหลดมาจากฐานข้อมูล
    if (process.env.NODE_ENV === 'development') {
      const announceData = row.game_data?.announce || {}
      console.log(`[GET /games/${trimmedGameId}] Raw game data from DB:`, {
        gameId: trimmedGameId,
        theme,
        hasGameData: !!row.game_data,
        gameDataType: typeof row.game_data,
        gameDataKeys: row.game_data ? Object.keys(row.game_data) : [],
        hasAnnounce: !!(row.game_data?.announce),
        announceKeys: row.game_data?.announce ? Object.keys(row.game_data.announce) : [],
        announceUsersType: typeof announceData?.users,
        announceUsersIsArray: Array.isArray(announceData?.users),
        announceUsersCount: Array.isArray(announceData?.users) ? announceData.users.length : (announceData?.users ? 'not-array' : 0),
        announceUserBonusesType: typeof announceData?.userBonuses,
        announceUserBonusesIsArray: Array.isArray(announceData?.userBonuses),
        announceUserBonusesCount: Array.isArray(announceData?.userBonuses) ? announceData.userBonuses.length : (announceData?.userBonuses ? 'not-array' : 0),
        hasImageDataUrl: !!announceData?.imageDataUrl,
        hasFileName: !!announceData?.fileName,
        fullGameData: row.game_data
      });
    }
    
    // ✅ Build game object
    // ✅ Use parsed gameData instead of row.game_data
    const fullGame = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...(gameData || {}), // ✅ Spread parsed gameData
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    
    // ✅ Debug: Log ข้อมูลที่ส่งกลับไป (always log to help debug)
    console.log(`[GET /games/${trimmedGameId}] Sending game data:`, {
      gameId: trimmedGameId,
      type: fullGame.type,
      hasAnnounce: !!fullGame.announce,
      announceKeys: fullGame.announce ? Object.keys(fullGame.announce) : [],
      announceUsersCount: Array.isArray(fullGame.announce?.users) ? fullGame.announce.users.length : (fullGame.announce?.users ? 'not-array' : 0),
      announceUserBonusesCount: Array.isArray(fullGame.announce?.userBonuses) ? fullGame.announce.userBonuses.length : (fullGame.announce?.userBonuses ? 'not-array' : 0),
      // ✅ เพิ่ม logging สำหรับ numberPick
      hasNumberPick: !!fullGame.numberPick,
      numberPickKeys: fullGame.numberPick ? Object.keys(fullGame.numberPick) : [],
      numberPickImageDataUrl: fullGame.numberPick?.imageDataUrl ? fullGame.numberPick.imageDataUrl.substring(0, 50) + '...' : null,
      numberPickEndAt: fullGame.numberPick?.endAt,
      // ✅ เพิ่ม logging สำหรับ game types อื่นๆ
      hasPuzzle: !!fullGame.puzzle,
      hasFootball: !!fullGame.football,
      hasSlot: !!fullGame.slot,
      hasCheckin: !!fullGame.checkin,
      requestFullData,
      fullGameKeys: Object.keys(fullGame),
      gameDataKeys: gameData ? Object.keys(gameData) : [],
      // ✅ Log fullGame structure to see what's being sent
      fullGameStructure: fullGame
    });
    
    // ✅ Precompute snapshot for next time
    // Snapshot will be updated by background engine
    
    // ✅ Apply field projection if requested
    let game = fullGame;
    if (requestedFields && requestedFields.length > 0) {
      console.log(`[GET /games/${trimmedGameId}] Applying field projection:`, {
        gameId: trimmedGameId,
        requestedFields: requestedFields,
        fullGameKeys: Object.keys(fullGame),
        hasAnnounceInFullGame: !!fullGame.announce
      });
      
      game = {};
      requestedFields.forEach(field => {
        if (field.includes('.')) {
          const [parent, child] = field.split('.');
          if (fullGame[parent] && typeof fullGame[parent] === 'object') {
            if (!game[parent]) game[parent] = {};
            game[parent][child] = fullGame[parent][child];
          }
        } else if (fullGame.hasOwnProperty(field)) {
          game[field] = fullGame[field];
        }
      });
      if (!game.id) game.id = fullGame.id;
      
      // ✅ Debug: Log after field projection
      console.log(`[GET /games/${trimmedGameId}] After field projection:`, {
        gameId: trimmedGameId,
        gameKeys: Object.keys(game),
        hasAnnounce: !!game.announce
      });
    }

    // ✅ OPTIMIZATION: Convert all image URLs to CDN before sending
    // ✅ Debug: Log before CDN processing
    if (process.env.NODE_ENV === 'development') {
      console.log(`[GET /games/${trimmedGameId}] Before CDN processing:`, {
        hasAnnounce: !!game.announce,
        announceUsersCount: Array.isArray(game.announce?.users) ? game.announce.users.length : (game.announce?.users ? 'not-array' : 0),
        announceUserBonusesCount: Array.isArray(game.announce?.userBonuses) ? game.announce.userBonuses.length : (game.announce?.userBonuses ? 'not-array' : 0)
      });
    }
    
    const gameWithCDN = processImageUrlsInObject(game, theme);
    
    // ✅ Debug: Log after CDN processing (always log in production for troubleshooting)
    console.log(`[GET /games/${trimmedGameId}] After CDN processing:`, {
      hasAnnounce: !!gameWithCDN.announce,
      announceKeys: gameWithCDN.announce ? Object.keys(gameWithCDN.announce) : [],
      announceUsersCount: Array.isArray(gameWithCDN.announce?.users) ? gameWithCDN.announce.users.length : (gameWithCDN.announce?.users ? 'not-array' : 0),
      announceUserBonusesCount: Array.isArray(gameWithCDN.announce?.userBonuses) ? gameWithCDN.announce.userBonuses.length : (gameWithCDN.announce?.userBonuses ? 'not-array' : 0),
      // ✅ เพิ่ม logging สำหรับ game types อื่นๆ
      hasNumberPick: !!gameWithCDN.numberPick,
      numberPickKeys: gameWithCDN.numberPick ? Object.keys(gameWithCDN.numberPick) : [],
      numberPickImageDataUrl: gameWithCDN.numberPick?.imageDataUrl ? gameWithCDN.numberPick.imageDataUrl.substring(0, 50) + '...' : null,
      numberPickEndAt: gameWithCDN.numberPick?.endAt,
      hasPuzzle: !!gameWithCDN.puzzle,
      hasFootball: !!gameWithCDN.football,
      hasSlot: !!gameWithCDN.slot,
      hasCheckin: !!gameWithCDN.checkin,
      hasBingo: !!gameWithCDN.bingo,
      hasLoyKrathong: !!gameWithCDN.loyKrathong,
      hasTrickOrTreat: !!gameWithCDN.trickOrTreat,
      gameWithCDNKeys: Object.keys(gameWithCDN),
      // ✅ เปรียบเทียบก่อนและหลัง CDN processing
      beforeCDNKeys: Object.keys(game),
      afterCDNKeys: Object.keys(gameWithCDN),
      // ✅ ตรวจสอบว่า keys หายไปหรือไม่
      missingKeys: Object.keys(game).filter(key => !Object.keys(gameWithCDN).includes(key)),
      extraKeys: Object.keys(gameWithCDN).filter(key => !Object.keys(game).includes(key))
    });
    
    res.set('X-Cache', 'MISS');
    res.json(gameWithCDN);
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
    
    // ✅ Debug: Log ข้อมูลที่บันทึกในฐานข้อมูล (always log to help debug)
    const insertedRow = result.rows[0];
    console.log(`[POST /games] Data saved to database:`, {
      gameId,
      hasGameData: !!insertedRow.game_data,
      gameDataKeys: insertedRow.game_data ? Object.keys(insertedRow.game_data) : [],
      hasAnnounce: !!(insertedRow.game_data?.announce),
      announceKeys: insertedRow.game_data?.announce ? Object.keys(insertedRow.game_data.announce) : [],
      announceUsersCount: Array.isArray(insertedRow.game_data?.announce?.users) ? insertedRow.game_data.announce.users.length : (insertedRow.game_data?.announce?.users ? 'not-array' : 0),
      announceUserBonusesCount: Array.isArray(insertedRow.game_data?.announce?.userBonuses) ? insertedRow.game_data.announce.userBonuses.length : (insertedRow.game_data?.announce?.userBonuses ? 'not-array' : 0),
      hasImageDataUrl: !!insertedRow.game_data?.announce?.imageDataUrl,
      hasFileName: !!insertedRow.game_data?.announce?.fileName
    });

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
    // Invalidate cache
    await delCache(`snapshot:game:${gameId}`);
    await delCache(`diff:game:${gameId}`);
    // Snapshot will be updated by background engine
    broadcastGameUpdate(theme, gameId, game);
    
    // ✅ Broadcast games list update to all clients
    const io = getIO();
    if (io) {
      io.emit('games:list:updated', { gameId, action: 'created', game });
    }

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
      
      const existingResult = await pool.query(
        `SELECT game_data FROM ${schema}.games WHERE game_id = $1`,
        [gameId]
      );
      
      const existingData = existingResult.rows[0]?.game_data || {};
      
      // ✅ Process base64 images to URLs
      const processedData = await processImageFields(finalGameData, theme, 'games');
      
      // ✅ Use helper function for merging (consistent with PATCH)
      const mergedData = mergeGameData(existingData, processedData);
      
      // ✅ Debug: Log merge operation
      console.log(`[PUT /games/${gameId}] Merging game data:`, {
        gameId,
        hasFinalAnnounce: !!processedData.announce,
        hasExistingAnnounce: !!existingData.announce,
        finalAnnounceKeys: processedData.announce ? Object.keys(processedData.announce) : [],
        existingAnnounceKeys: existingData.announce ? Object.keys(existingData.announce) : [],
        finalUsersCount: Array.isArray(processedData.announce?.users) ? processedData.announce.users.length : 0,
        existingUsersCount: Array.isArray(existingData.announce?.users) ? existingData.announce.users.length : 0,
        finalUserBonusesCount: Array.isArray(processedData.announce?.userBonuses) ? processedData.announce.userBonuses.length : 0,
        existingUserBonusesCount: Array.isArray(existingData.announce?.userBonuses) ? existingData.announce.userBonuses.length : 0
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
    
    // ✅ Debug: Log ข้อมูลที่บันทึกในฐานข้อมูล (always log to help debug)
    console.log(`[PUT /games/${gameId}] Data saved to database:`, {
      gameId,
      hasGameData: !!row.game_data,
      gameDataKeys: row.game_data ? Object.keys(row.game_data) : [],
      hasAnnounce: !!(row.game_data?.announce),
      announceKeys: row.game_data?.announce ? Object.keys(row.game_data.announce) : [],
      announceUsersCount: Array.isArray(row.game_data?.announce?.users) ? row.game_data.announce.users.length : (row.game_data?.announce?.users ? 'not-array' : 0),
      announceUserBonusesCount: Array.isArray(row.game_data?.announce?.userBonuses) ? row.game_data.announce.userBonuses.length : (row.game_data?.announce?.userBonuses ? 'not-array' : 0),
      hasImageDataUrl: !!row.game_data?.announce?.imageDataUrl,
      hasFileName: !!row.game_data?.announce?.fileName,
      hasProcessedItems: !!row.game_data?.announce?.processedItems
    });
    
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
    // Invalidate cache
    await delCache(`snapshot:game:${gameId}`);
    await delCache(`diff:game:${gameId}`);
    // Snapshot will be updated by background engine
    broadcastGameUpdate(theme, gameId, game);

    // ✅ OPTIMIZATION: Convert all image URLs to CDN before sending
    const gameWithCDN = processImageUrlsInObject(game, theme);
    res.json(gameWithCDN);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ PATCH /games/:gameId - Partial update (minimal payload)
router.patch('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Get existing game data
    const existingResult = await pool.query(
      `SELECT game_id, name, type, unlocked, locked, user_access_type, selected_users, game_data 
       FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const existing = existingResult.rows[0];
    const existingGameData = existing.game_data || {};

    // Extract only top-level fields that can be updated directly
    const {
      name,
      type,
      unlocked,
      locked,
      userAccessType,
      selectedUsers,
      gameData: nestedGameData,
      ...incomingGameData
    } = req.body;

    // Merge nested gameData with top-level gameData
    const finalIncomingData = nestedGameData ? { ...incomingGameData, ...nestedGameData } : incomingGameData;

    // Process base64 images to URLs
    const processedData = await processImageFields(finalIncomingData, theme, 'games');

    // Extract only changed fields
    const changedGameData = extractChangedFields(existingGameData, processedData);

    // Merge with existing data (preserving announce arrays)
    const mergedGameData = Object.keys(changedGameData).length > 0
      ? mergeGameData(existingGameData, changedGameData)
      : existingGameData;

    // Build update query
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
    if (Object.keys(changedGameData).length > 0) {
      updates.push(`game_data = $${paramIndex++}`);
      values.push(JSON.stringify(mergedGameData));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(gameId);
    const query = `
      UPDATE ${schema}.games 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE game_id = $${paramIndex}
      RETURNING game_id, name, type, unlocked, locked, user_access_type, selected_users, updated_at
    `;

    const result = await pool.query(query, values);
    const row = result.rows[0];

    // Return minimal response (only changed fields + metadata)
    const response = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      updatedAt: row.updated_at,
      changedFields: Object.keys(changedGameData),
      gameDataSize: JSON.stringify(mergedGameData).length
    };

    // Invalidate cache
    await delCache(`snapshot:game:${gameId}`);
    await delCache(`diff:game:${gameId}`);

    // Broadcast minimal update
    const fullGame = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...mergedGameData,
      updatedAt: row.updated_at
    };
    broadcastGameUpdate(theme, gameId, fullGame);

    console.log(`[PATCH /games/${gameId}] Updated:`, {
      changedFields: Object.keys(changedGameData),
      payloadSize: JSON.stringify(req.body).length,
      responseSize: JSON.stringify(response).length,
      gameDataSize: JSON.stringify(mergedGameData).length
    });

    res.json(response);
  } catch (error) {
    console.error('Error patching game:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET /games/:gameId/state - Lightweight state endpoint (no heavy data)
router.get('/:gameId/state', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const result = await pool.query(
      `SELECT game_id, name, type, unlocked, locked, user_access_type, selected_users, 
              code_cursor, codes_count, claimed_count, created_at, updated_at
       FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const row = result.rows[0];
    const state = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      codeCursor: row.code_cursor,
      codesCount: row.codes_count,
      claimedCount: row.claimed_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.json(state);
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ GET /games/:gameId/snapshot - Full game data (heavy endpoint)
router.get('/:gameId/snapshot', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const result = await pool.query(
      `SELECT * FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const row = result.rows[0];
    const snapshot = {
      id: row.game_id,
      name: row.name,
      type: row.type,
      unlocked: row.unlocked,
      locked: row.locked,
      userAccessType: row.user_access_type,
      selectedUsers: row.selected_users,
      ...row.game_data,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching game snapshot:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ PATCH /games/:gameId/announce - Update only announce data
router.patch('/:gameId/announce', async (req, res) => {
  try {
    const { gameId } = req.params;
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);

    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    // Get existing game data
    const existingResult = await pool.query(
      `SELECT game_data FROM ${schema}.games WHERE game_id = $1`,
      [gameId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const existingGameData = existingResult.rows[0].game_data || {};
    const incomingAnnounce = req.body;

    // Process base64 images
    const processedAnnounce = await processImageFields(
      { announce: incomingAnnounce },
      theme,
      'announce'
    ).then(data => data.announce);

    // Merge announce data
    const mergedAnnounce = mergeGameData(
      { announce: existingGameData.announce || {} },
      { announce: processedAnnounce }
    ).announce;

    // Update only announce in game_data
    const updatedGameData = {
      ...existingGameData,
      announce: mergedAnnounce
    };

    await pool.query(
      `UPDATE ${schema}.games 
       SET game_data = $1, updated_at = CURRENT_TIMESTAMP
       WHERE game_id = $2`,
      [JSON.stringify(updatedGameData), gameId]
    );

    // Invalidate cache
    await delCache(`snapshot:game:${gameId}`);
    await delCache(`diff:game:${gameId}`);

    // Return minimal response
    res.json({
      success: true,
      announceKeys: Object.keys(mergedAnnounce),
      usersCount: Array.isArray(mergedAnnounce.users) ? mergedAnnounce.users.length : 0,
      userBonusesCount: Array.isArray(mergedAnnounce.userBonuses) ? mergedAnnounce.userBonuses.length : 0
    });
  } catch (error) {
    console.error('Error patching announce data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete game
router.delete('/:gameId', async (req, res) => {
  try {
    // ✅ Decode gameId เพื่อรองรับ URL encoding
    let { gameId } = req.params;
    try {
      gameId = decodeURIComponent(gameId);
    } catch (e) {
      // ถ้า decode ไม่ได้ ใช้ค่าเดิม
      console.warn(`[DELETE /games] Failed to decode gameId: ${req.params.gameId}`);
    }
    
    // ✅ Trim gameId เหมือนกับ GET route
    const trimmedGameId = gameId.trim();
    
    const theme = req.theme || 'heng36';
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    // ✅ Debug logging
    console.log(`[DELETE /games/${trimmedGameId}] Theme: ${theme}, Schema: ${schema}, GameId: "${trimmedGameId}", Raw: "${req.params.gameId}", Original: "${gameId}"`);
    
    if (!pool) {
      console.error(`[DELETE /games/${trimmedGameId}] Database pool not found for theme: ${theme}`);
      return res.status(500).json({ error: 'Database connection error' });
    }
    
    // ✅ Get game data first to extract image URLs - ใช้ trimmedGameId
    let gameResult = await pool.query(
      `SELECT game_id, game_data FROM ${schema}.games WHERE game_id = $1`,
      [trimmedGameId]
    );
    
    // ✅ ถ้าไม่พบ ลองค้นหาแบบอื่น
    if (gameResult.rows.length === 0) {
      // ลองค้นหาโดยใช้ case-insensitive
      gameResult = await pool.query(
        `SELECT game_id, game_data FROM ${schema}.games WHERE LOWER(game_id) = LOWER($1)`,
        [trimmedGameId]
      );
    }
    
    if (gameResult.rows.length === 0) {
      // ✅ Debug: ตรวจสอบว่ามีเกมอะไรบ้างใน database
      const allGamesResult = await pool.query(
        `SELECT game_id, name, created_at FROM ${schema}.games ORDER BY created_at DESC LIMIT 20`
      );
      const allGameIds = allGamesResult.rows.map(r => r.game_id);
      console.warn(`[DELETE /games/${trimmedGameId}] Game not found.`);
      console.warn(`[DELETE /games/${trimmedGameId}] Available games (last 20):`, allGameIds);
      console.warn(`[DELETE /games/${trimmedGameId}] Searching for: "${trimmedGameId}" (length: ${trimmedGameId.length})`);
      console.warn(`[DELETE /games/${trimmedGameId}] Available game lengths:`, allGameIds.map(id => ({ id, length: id?.length || 0 })));
      
      // ✅ ตรวจสอบว่า gameId ตรงกับเกมไหนบ้าง (case-insensitive, partial match)
      const similarGamesResult = await pool.query(
        `SELECT game_id FROM ${schema}.games WHERE game_id ILIKE $1 OR game_id LIKE $2 LIMIT 10`,
        [`%${trimmedGameId}%`, `%${trimmedGameId.split('_').pop()}%`]
      );
      if (similarGamesResult.rows.length > 0) {
        console.warn(`[DELETE /games/${trimmedGameId}] Similar games found:`, 
          similarGamesResult.rows.map(r => r.game_id));
      }
      
      // ✅ ตรวจสอบ exact match โดยไม่สนใจ case
      const exactMatchResult = await pool.query(
        `SELECT game_id FROM ${schema}.games WHERE game_id = $1 OR LOWER(game_id) = LOWER($1)`,
        [trimmedGameId]
      );
      if (exactMatchResult.rows.length > 0) {
        console.warn(`[DELETE /games/${trimmedGameId}] Found with case-insensitive match:`, 
          exactMatchResult.rows.map(r => r.game_id));
      }
      
      return res.status(404).json({ 
        error: 'Game not found',
        searchedGameId: trimmedGameId,
        availableGames: allGameIds.length
      });
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
    // Invalidate cache
    await delCache(`snapshot:game:${gameId}`);
    await delCache(`diff:game:${gameId}`);
    broadcastGameUpdate(theme, gameId, null); // null indicates deletion
    
    // ✅ Broadcast games list update to all clients
    const io = getIO();
    if (io) {
      io.emit('games:list:updated', { gameId, action: 'deleted' });
    }

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
    const { gameId, dayIndex } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const dayIdx = parseInt(dayIndex);
    if (isNaN(dayIdx) || dayIdx < 0) {
      return res.status(400).json({ error: 'Invalid dayIndex' });
    }

    // Use service for atomic code claim
    const result = await claimDailyRewardCode(theme, gameId, userId, dayIdx);

    return res.json(result);
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

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Use service for atomic code claim
    const result = await claimCompleteRewardCode(theme, gameId, userId);

    return res.json(result);
  } catch (error) {
    console.error('Error claiming complete reward code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim coupon code (for Checkin game)
// Note: Coupon codes allow multiple claims per user, so we use the reward_codes table
// which supports this via the service (users can claim multiple codes for same item)
router.post('/:gameId/claim-code/coupon/:itemIndex', async (req, res) => {
  try {
    const { gameId, itemIndex } = req.params;
    const { userId } = req.body;
    const theme = req.theme || 'heng36';

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const itemIdx = parseInt(itemIndex);
    if (isNaN(itemIdx) || itemIdx < 0) {
      return res.status(400).json({ error: 'Invalid itemIndex' });
    }

    // Use service for atomic coupon code claim
    // Note: Service allows multiple claims per user (unlike daily/complete rewards)
    const result = await claimCouponCode(theme, gameId, userId, itemIdx);

    return res.json(result);
  } catch (error) {
    console.error('Error claiming coupon code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

