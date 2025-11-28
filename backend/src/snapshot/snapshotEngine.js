/**
 * Snapshot Engine
 * 
 * Periodically fetches game/checkin/bingo data from DB,
 * reduces/compresses large JSON objects,
 * and stores them in cache.
 * 
 * Goal: Reduce payload size, reduce DB reads, provide snapshot for both API and Socket
 */

import { getPool, getSchema } from '../config/database.js';
import { setCache, getCache } from '../cache/cacheService.js';

// Snapshot TTLs (in seconds)
const SNAPSHOT_TTL = {
  game: 10,
  checkin: 60,
  bingo: 5,
};

/**
 * Create lightweight game snapshot
 * Filters out unnecessary fields and compresses structure
 */
export function gameSnapshot(gameRow) {
  if (!gameRow) return null;
  
  const snapshot = {
    id: gameRow.game_id || gameRow.id,
    name: gameRow.name,
    type: gameRow.type,
    unlocked: gameRow.unlocked,
    locked: gameRow.locked,
    userAccessType: gameRow.user_access_type || gameRow.userAccessType,
    selectedUsers: gameRow.selected_users || gameRow.selectedUsers,
    createdAt: gameRow.created_at || gameRow.createdAt,
    updatedAt: gameRow.updated_at || gameRow.updatedAt,
  };
  
  // Include game_data but compress large objects
  const gameData = gameRow.game_data || {};
  
  // Only include essential fields based on game type
  switch (gameRow.type) {
    case 'เกมเช็คอิน':
      snapshot.checkin = {
        startDate: gameData.checkin?.startDate,
        endDate: gameData.checkin?.endDate,
        maxDays: gameData.checkin?.maxDays,
        // Only include counts, not full arrays
        rewardCodesCount: gameData.checkin?.rewardCodes ? Object.keys(gameData.checkin.rewardCodes).length : 0,
        completeRewardCodesCount: gameData.checkin?.completeRewardCodes?.codes?.length || 0,
      };
      break;
      
    case 'เกม BINGO':
      snapshot.bingo = {
        cardSize: gameData.bingo?.cardSize,
        numbersCalled: gameData.bingo?.numbersCalled?.length || 0,
        currentNumber: gameData.bingo?.currentNumber,
        state: gameData.bingo?.state,
        winnersCount: gameData.bingo?.winners?.length || 0,
      };
      break;
      
    default:
      // For other game types, include minimal essential fields
      snapshot.codesCount = gameData.codes?.length || 0;
      snapshot.codeCursor = gameData.codeCursor;
      snapshot.claimedCount = gameData.claimedBy ? Object.keys(gameData.claimedBy).length : 0;
      break;
  }
  
  return snapshot;
}

/**
 * Create checkin snapshot
 */
export function checkinSnapshot(checkinRow) {
  if (!checkinRow) return null;
  
  return {
    gameId: checkinRow.game_id,
    userId: checkinRow.user_id,
    checkins: checkinRow.checkins || {},
    dayIndex: checkinRow.day_index,
    checkinDate: checkinRow.checkin_date,
    updatedAt: checkinRow.updated_at,
  };
}

/**
 * Create bingo snapshot
 */
export function bingoSnapshot(bingoState) {
  if (!bingoState) return null;
  
  return {
    gameId: bingoState.game_id,
    state: bingoState.state,
    currentNumber: bingoState.current_number || bingoState.currentNumber,
    numbersCalled: bingoState.numbers_called || bingoState.numbersCalled || [],
    winners: bingoState.winners || [],
    updatedAt: bingoState.updated_at || bingoState.updatedAt,
  };
}

/**
 * Fetch and cache game snapshot with retry logic
 */
export async function fetchAndCacheGameSnapshot(theme, gameId, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const pool = getPool(theme);
      const schema = getSchema(theme);
      
      if (!pool) {
        if (attempt === retries) {
          console.warn(`[Snapshot] Pool not found for theme: ${theme}`);
        }
        return null;
      }
      
      // Skip pool health check here (already checked in runSnapshotEngine)
      // Direct query with timeout
      const result = await Promise.race([
        pool.query(
          `SELECT * FROM ${schema}.games WHERE game_id = $1 LIMIT 1`,
          [gameId]
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 8000)
        )
      ]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const snapshot = gameSnapshot(result.rows[0]);
      if (snapshot) {
        await setCache(`snapshot:game:${gameId}`, snapshot, SNAPSHOT_TTL.game);
      }
      
      return snapshot;
    } catch (error) {
      // Suppress frequent timeout/connection errors (log only once per minute per game)
      const errorKey = `error:${theme}:${gameId}`;
      const lastError = await getCache(errorKey);
      const now = Date.now();
      
      // Only log if it's not a timeout/connection error, or if it's been more than 1 minute
      const isTimeoutError = error.message.includes('timeout') || 
                            error.message.includes('Connection terminated') ||
                            error.message.includes('connection');
      
      if (!isTimeoutError || (!lastError || now - lastError > 60000)) {
        if (attempt === retries || !isTimeoutError) {
          console.warn(`[Snapshot] Error fetching game ${gameId} (${theme}) [attempt ${attempt + 1}/${retries + 1}]:`, error.message);
          await setCache(errorKey, now, 60);
        }
      }
      
      // Retry with exponential backoff
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      return null;
    }
  }
  
  return null;
}

/**
 * Fetch and cache checkin snapshot
 */
export async function fetchAndCacheCheckinSnapshot(theme, gameId, userId) {
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    if (!pool) return null;
    
    // ✅ Query all checkins for this user (not just one row)
    const result = await pool.query(
      `SELECT day_index, checked, checkin_date, unique_key, created_at, updated_at
       FROM ${schema}.checkins 
       WHERE game_id = $1 AND user_id = $2 
       ORDER BY day_index ASC`,
      [gameId, userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // ✅ Build checkins object with day_index as key
    const checkins = {};
    result.rows.forEach((row) => {
      let checkinDate = row.checkin_date;
      if (!checkinDate && row.created_at) {
        // ✅ Convert created_at to date key (YYYY-MM-DD)
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
    
    // ✅ Return snapshot in the format expected by frontend
    const snapshot = {
      gameId,
      userId,
      checkins
    };
    
    if (snapshot) {
      await setCache(`snapshot:checkin:${gameId}:${userId}`, snapshot, SNAPSHOT_TTL.checkin);
    }
    
    return snapshot;
  } catch (error) {
    console.error(`[Snapshot] Error fetching checkin ${gameId}:${userId}:`, error);
    return null;
  }
}

/**
 * Fetch and cache bingo snapshot
 */
export async function fetchAndCacheBingoSnapshot(theme, gameId) {
  try {
    const pool = getPool(theme);
    const schema = getSchema(theme);
    
    if (!pool) return null;
    
    // Try bingo_game_state table first
    let result = await pool.query(
      `SELECT * FROM ${schema}.bingo_game_state WHERE game_id = $1 LIMIT 1`,
      [gameId]
    );
    
    // If not found, try to get from games table game_data
    if (result.rows.length === 0) {
      const gameResult = await pool.query(
        `SELECT game_data->'bingo' as bingo FROM ${schema}.games WHERE game_id = $1 LIMIT 1`,
        [gameId]
      );
      
      if (gameResult.rows.length > 0 && gameResult.rows[0].bingo) {
        const snapshot = bingoSnapshot({
          game_id: gameId,
          ...gameResult.rows[0].bingo,
        });
        if (snapshot) {
          await setCache(`snapshot:bingo:${gameId}`, snapshot, SNAPSHOT_TTL.bingo);
        }
        return snapshot;
      }
      
      return null;
    }
    
    const snapshot = bingoSnapshot(result.rows[0]);
    if (snapshot) {
      await setCache(`snapshot:bingo:${gameId}`, snapshot, SNAPSHOT_TTL.bingo);
    }
    
    return snapshot;
  } catch (error) {
    console.error(`[Snapshot] Error fetching bingo ${gameId}:`, error);
    return null;
  }
}

/**
 * Get snapshot from cache or fetch from DB
 */
export async function getGameSnapshot(theme, gameId) {
  const cacheKey = `snapshot:game:${gameId}`;
  
  // Try cache first
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch and cache
  return await fetchAndCacheGameSnapshot(theme, gameId);
}

export async function getCheckinSnapshot(theme, gameId, userId) {
  const cacheKey = `snapshot:checkin:${gameId}:${userId}`;
  
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  return await fetchAndCacheCheckinSnapshot(theme, gameId, userId);
}

export async function getBingoSnapshot(theme, gameId) {
  const cacheKey = `snapshot:bingo:${gameId}`;
  
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  return await fetchAndCacheBingoSnapshot(theme, gameId);
}

/**
 * Run snapshot engine for all active games
 */
export async function runSnapshotEngine() {
  const themes = ['heng36', 'max56', 'jeed24'];
  
  for (const theme of themes) {
    try {
      const pool = getPool(theme);
      const schema = getSchema(theme);
      
      if (!pool) {
        continue;
      }
      
      // Check pool health first with retry
      let poolHealthy = false;
      for (let retry = 0; retry < 2; retry++) {
        try {
          await Promise.race([
            pool.query('SELECT 1'),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Pool health check timeout')), 5000)
            )
          ]);
          poolHealthy = true;
          break;
        } catch (healthError) {
          if (retry === 1) {
            // Only log on final retry, and suppress frequent errors
            const errorKey = `pool_error:${theme}`;
            const lastError = await getCache(errorKey);
            const now = Date.now();
            
            if (!lastError || now - lastError > 60000) {
              console.warn(`[Snapshot] Pool health check failed for ${theme} after retries:`, healthError.message);
              await setCache(errorKey, now, 60);
            }
          } else {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (!poolHealthy) {
        continue;
      }
      
      // Fetch all active games with timeout
      let result;
      try {
        result = await Promise.race([
          pool.query(
            `SELECT game_id FROM ${schema}.games WHERE name IS NOT NULL AND name != '' LIMIT 50`
          ),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), 5000)
          )
        ]);
      } catch (queryError) {
        console.warn(`[Snapshot] Failed to fetch games list for ${theme}:`, queryError.message);
        continue;
      }
      
      if (!result || result.rows.length === 0) {
        continue;
      }
      
      // Process in smaller batches to reduce connection pressure
      const batchSize = 3; // Reduced from 5 to 3
      let successCount = 0;
      
      for (let i = 0; i < result.rows.length; i += batchSize) {
        const batch = result.rows.slice(i, i + batchSize);
        
        // Process with error handling per batch
        const results = await Promise.allSettled(
          batch.map(row => fetchAndCacheGameSnapshot(theme, row.game_id))
        );
        
        successCount += results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        
        // Delay between batches to avoid overwhelming the connection pool
        if (i + batchSize < result.rows.length) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms to 200ms
        }
      }
      
      // Only log if there are games processed (suppress if all failed)
      if (successCount > 0 && successCount < result.rows.length) {
        console.log(`[Snapshot] Processed ${successCount}/${result.rows.length} games for ${theme}`);
      } else if (successCount === result.rows.length) {
        // Only log success if all games processed successfully (reduce log spam)
        // Log every 10th cycle to reduce noise
        const logKey = `snapshot_log:${theme}`;
        const lastLog = await getCache(logKey);
        const now = Date.now();
        
        if (!lastLog || now - lastLog > 100000) { // Log every ~100 seconds
          console.log(`[Snapshot] Processed ${successCount}/${result.rows.length} games for ${theme}`);
          await setCache(logKey, now, 100);
        }
      }
    } catch (error) {
      // Only log non-timeout errors
      if (!error.message.includes('timeout')) {
        console.error(`[Snapshot] Error running engine for ${theme}:`, error.message);
      }
    }
  }
}

/**
 * Start snapshot engine scheduler
 */
export function startSnapshotEngine() {
  // Increase default interval to reduce database load
  const interval = parseInt(process.env.SNAPSHOT_INTERVAL) || 10000; // 10 seconds default (increased from 3s)
  
  console.log(`[Snapshot] Starting snapshot engine (interval: ${interval}ms)`);
  
  // Run immediately with delay to let server fully start
  setTimeout(() => {
    runSnapshotEngine().catch(err => {
      console.warn('[Snapshot] Initial run error:', err.message);
    });
  }, 5000);
  
  // Then run periodically
  setInterval(() => {
    runSnapshotEngine().catch(err => {
      // Errors are already handled in runSnapshotEngine
    });
  }, interval);
}

