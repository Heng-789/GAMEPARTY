/**
 * Migration Script: RTDB Games to PostgreSQL
 * โยกย้ายข้อมูลเกมจาก Firebase Realtime Database ไป PostgreSQL
 * 
 * Usage:
 *   node scripts/migrate-games-from-rtdb.js <theme> [batchSize]
 * 
 * Example:
 *   node scripts/migrate-games-from-rtdb.js heng36
 *   node scripts/migrate-games-from-rtdb.js max56 10
 *   node scripts/migrate-games-from-rtdb.js jeed24 20
 */

import pg from 'pg';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Firebase configurations
const firebaseConfigs = {
  heng36: {
    apiKey: "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
    authDomain: "heng-15023.firebaseapp.com",
    projectId: "heng-15023",
    databaseURL: "https://heng-15023-default-rtdb.asia-southeast1.firebasedatabase.app"
  },
  max56: {
    apiKey: "AIzaSyCq4J3neJr1jSIzOSN8_YeBmsvSChsuIBs",
    authDomain: "max56-98e6f.firebaseapp.com",
    projectId: "max56-98e6f",
    databaseURL: "https://max56-98e6f-default-rtdb.asia-southeast1.firebasedatabase.app"
  },
  jeed24: {
    apiKey: "AIzaSyBBun3l4CW6QQLcNH4KO9mpdse6Sx-Q_fQ",
    authDomain: "jeed24-3c755.firebaseapp.com",
    projectId: "jeed24-3c755",
    databaseURL: "https://jeed24-3c755-default-rtdb.asia-southeast1.firebasedatabase.app"
  }
};

// Helper function to create pool config from connection string
function createPoolConfig(connectionString) {
  const useSSL = connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode=require');
  
  return {
    connectionString: connectionString,
    ssl: useSSL ? {
      rejectUnauthorized: false // Accept self-signed certificates for Supabase
    } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

// Connection pools for each theme
const pools = {};

// Initialize connection pools for each theme
function initializePools() {
  // HENG36
  if (process.env.DATABASE_URL_HENG36) {
    pools.heng36 = new Pool(createPoolConfig(process.env.DATABASE_URL_HENG36));
  }

  // MAX56
  if (process.env.DATABASE_URL_MAX56) {
    pools.max56 = new Pool(createPoolConfig(process.env.DATABASE_URL_MAX56));
  }

  // JEED24
  if (process.env.DATABASE_URL_JEED24) {
    pools.jeed24 = new Pool(createPoolConfig(process.env.DATABASE_URL_JEED24));
  }

  // Fallback: Single DATABASE_URL
  if (Object.keys(pools).length === 0 && process.env.DATABASE_URL) {
    pools.default = new Pool(createPoolConfig(process.env.DATABASE_URL));
  }
}

// Initialize pools
initializePools();

// Helper function to get pool based on theme
function getPool(theme) {
  if (pools[theme]) {
    return pools[theme];
  }
  return pools.default || pools.heng36;
}

// Helper function to get schema name
function getSchema(theme) {
  if (pools[theme] && pools[theme] !== pools.default) {
    return 'public';
  }
  const schemas = {
    heng36: 'heng36',
    max56: 'max56',
    jeed24: 'jeed24'
  };
  return schemas[theme] || 'public';
}

// Initialize Firebase
function initializeFirebase(theme) {
  const config = firebaseConfigs[theme];
  if (!config) {
    throw new Error(`No Firebase config found for theme: ${theme}`);
  }

  // Check if app already exists
  const existingApp = getApps().find(app => app.name === theme);
  if (existingApp) {
    return getDatabase(existingApp);
  }

  const app = initializeApp(config, theme);
  return getDatabase(app);
}

// Transform game data from RTDB format to PostgreSQL format
function transformGameData(gameId, gameData) {
  // Extract top-level properties
  const {
    name,
    type,
    unlocked,
    locked,
    userAccessType,
    selectedUsers,
    codes,
    codeCursor,
    claimedBy,
    createdAt,
    updatedAt,
    // Game-specific data
    puzzle,
    numberPick,
    football,
    slot,
    announce,
    checkin,
    trickOrTreat,
    loyKrathong,
    bingo,
    // Any other properties
    ...rest
  } = gameData;

  // Build game_data JSONB object with all game-specific data
  const gameDataJsonb = {
    ...(puzzle && { puzzle }),
    ...(numberPick && { numberPick }),
    ...(football && { football }),
    ...(slot && { slot }),
    ...(announce && { announce }),
    ...(checkin && { checkin }),
    ...(trickOrTreat && { trickOrTreat }),
    ...(loyKrathong && { loyKrathong }),
    ...(bingo && { bingo }),
    // Include codes, codeCursor, claimedBy in game_data if they exist
    ...(codes && { codes }),
    ...(codeCursor !== undefined && { codeCursor }),
    ...(claimedBy && { claimedBy }),
    // Include any other properties
    ...rest
  };

  return {
    game_id: gameId,
    name: name || '',
    type: type || '',
    unlocked: unlocked !== undefined ? unlocked : true,
    locked: locked !== undefined ? locked : false,
    user_access_type: userAccessType || 'all',
    selected_users: selectedUsers ? JSON.stringify(selectedUsers) : null,
    game_data: Object.keys(gameDataJsonb).length > 0 ? JSON.stringify(gameDataJsonb) : null,
    created_at: createdAt ? new Date(createdAt) : new Date(),
    updated_at: updatedAt ? new Date(updatedAt) : new Date()
  };
}

// Main migration function
async function migrateGames(theme, batchSize = 50) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const db = initializeFirebase(theme);

  if (!pool) {
    throw new Error(`No database pool found for theme: ${theme}`);
  }

  console.log(`\n🚀 Starting migration for theme: ${theme}`);
  console.log(`📊 Schema: ${schema}`);
  console.log(`📦 Batch size: ${batchSize}\n`);

  try {
    // Fetch all games from RTDB
    console.log('📥 Fetching games from RTDB...');
    const gamesRef = ref(db, 'games');
    const snapshot = await get(gamesRef);

    if (!snapshot.exists()) {
      console.log('⚠️  No games found in RTDB');
      return {
        total: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };
    }

    const gamesData = snapshot.val();
    const gameIds = Object.keys(gamesData);
    const totalGames = gameIds.length;

    console.log(`✅ Found ${totalGames} games in RTDB\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    // Process games in batches
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(totalGames / batchSize);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} games)...`);

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const gameId of batch) {
          try {
            const gameData = gamesData[gameId];

            // Skip if game data is invalid
            if (!gameData || typeof gameData !== 'object') {
              skipped++;
              continue;
            }

            // Transform game data
            const transformed = transformGameData(gameId, gameData);

            // Skip if name or type is missing
            if (!transformed.name || !transformed.type) {
              skipped++;
              continue;
            }

            // Use UPSERT (INSERT ... ON CONFLICT UPDATE)
            await client.query(
              `INSERT INTO ${schema}.games (
                game_id, name, type, unlocked, locked, 
                user_access_type, selected_users, game_data, 
                created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
              ON CONFLICT (game_id) 
              DO UPDATE SET 
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                unlocked = EXCLUDED.unlocked,
                locked = EXCLUDED.locked,
                user_access_type = EXCLUDED.user_access_type,
                selected_users = EXCLUDED.selected_users,
                game_data = EXCLUDED.game_data,
                updated_at = EXCLUDED.updated_at`,
              [
                transformed.game_id,
                transformed.name,
                transformed.type,
                transformed.unlocked,
                transformed.locked,
                transformed.user_access_type,
                transformed.selected_users,
                transformed.game_data,
                transformed.created_at,
                transformed.updated_at
              ]
            );

            migrated++;
          } catch (error) {
            failed++;
            errors.push({
              gameId,
              error: error.message
            });
            console.error(`  ❌ Failed to migrate game ${gameId}:`, error.message);
          }
        }

        await client.query('COMMIT');
        console.log(`  ✅ Batch ${batchNumber} completed: ${migrated} migrated, ${skipped} skipped, ${failed} failed\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total games: ${totalGames}`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ gameId, error }) => {
        console.log(`   - ${gameId}: ${error}`);
      });
    }

    return {
      total: totalGames,
      migrated,
      skipped,
      failed,
      errors
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Main execution
const theme = process.argv[2];
const batchSize = parseInt(process.argv[3]) || 50;

if (!theme) {
  console.error('❌ Error: Theme is required');
  console.error('Usage: node scripts/migrate-games-from-rtdb.js <theme> [batchSize]');
  console.error('Example: node scripts/migrate-games-from-rtdb.js heng36');
  process.exit(1);
}

if (!['heng36', 'max56', 'jeed24'].includes(theme)) {
  console.error(`❌ Error: Invalid theme "${theme}". Must be one of: heng36, max56, jeed24`);
  process.exit(1);
}

migrateGames(theme, batchSize)
  .then((result) => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

