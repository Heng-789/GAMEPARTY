/**
 * Migration Script: RTDB Answers to PostgreSQL
 * โยกย้ายข้อมูลคำตอบ (answers) จาก Firebase Realtime Database ไป PostgreSQL
 * 
 * Usage:
 *   node scripts/migrate-answers-from-rtdb.js <theme> [batchSize]
 * 
 * Example:
 *   node scripts/migrate-answers-from-rtdb.js heng36
 *   node scripts/migrate-answers-from-rtdb.js max56 100
 *   node scripts/migrate-answers-from-rtdb.js jeed24 200
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

// Transform answer data from RTDB format to PostgreSQL format
function transformAnswerData(gameId, answerId, answerData) {
  // Extract user ID (support multiple field names)
  const userId = answerData.user || answerData.userId || answerData.username || '';
  
  // Extract answer text (support multiple field names)
  const answerText = answerData.answer || answerData.text || '';
  
  // Extract timestamp
  const ts = answerData.ts || answerData.timestamp || Date.now();
  
  // Extract additional fields
  const correct = answerData.correct !== undefined ? answerData.correct : null;
  const code = answerData.code || null;
  const won = answerData.won !== undefined ? answerData.won : null;
  const amount = answerData.amount !== undefined ? answerData.amount : null;
  
  // Extract game-specific fields
  const dayIndex = answerData.dayIndex !== undefined ? answerData.dayIndex : null;
  const action = answerData.action || null;
  const itemIndex = answerData.itemIndex !== undefined ? answerData.itemIndex : null;
  const price = answerData.price !== undefined ? answerData.price : null;
  const balanceBefore = answerData.balanceBefore !== undefined ? answerData.balanceBefore : null;
  const balanceAfter = answerData.balanceAfter !== undefined ? answerData.balanceAfter : null;
  
  // Build answer_data JSONB object for additional fields
  const answerDataJsonb = {};
  if (correct !== null) answerDataJsonb.correct = correct;
  if (code !== null) answerDataJsonb.code = code;
  if (won !== null) answerDataJsonb.won = won;
  if (amount !== null) answerDataJsonb.amount = amount;
  if (dayIndex !== null) answerDataJsonb.dayIndex = dayIndex;
  if (action !== null) answerDataJsonb.action = action;
  if (itemIndex !== null) answerDataJsonb.itemIndex = itemIndex;
  if (price !== null) answerDataJsonb.price = price;
  if (balanceBefore !== null) answerDataJsonb.balanceBefore = balanceBefore;
  if (balanceAfter !== null) answerDataJsonb.balanceAfter = balanceAfter;
  
  // If answer is an object (for checkin, coupon-redeem, etc.), store it as JSON
  let answerValue = answerText;
  if (answerData.answer && typeof answerData.answer === 'object') {
    answerValue = JSON.stringify(answerData.answer);
  } else if (Object.keys(answerDataJsonb).length > 0) {
    // If we have additional data, store answer as JSON with text field
    answerValue = JSON.stringify({
      text: answerText,
      ...answerDataJsonb
    });
  }
  
  return {
    game_id: gameId,
    user_id: userId,
    answer: answerValue,
    created_at: new Date(ts)
  };
}

// Main migration function
async function migrateAnswers(theme, batchSize = 100) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const db = initializeFirebase(theme);

  if (!pool) {
    throw new Error(`No database pool found for theme: ${theme}`);
  }

  console.log(`\n🚀 Starting answers migration for theme: ${theme}`);
  console.log(`📊 Schema: ${schema}`);
  console.log(`📦 Batch size: ${batchSize}\n`);

  try {
    // Fetch all answers from RTDB
    console.log('📥 Fetching answers from RTDB...');
    const answersRef = ref(db, 'answers');
    const snapshot = await get(answersRef);

    if (!snapshot.exists()) {
      console.log('⚠️  No answers found in RTDB');
      return {
        total: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };
    }

    const answersData = snapshot.val();
    
    // Flatten answers structure: answers/{gameId}/{dateKey}/{answerId} = answerData
    const answerList = [];
    for (const [gameId, gameAnswers] of Object.entries(answersData)) {
      if (!gameAnswers || typeof gameAnswers !== 'object') continue;
      
      // Check if it's the old structure (answers/{gameId}/{dateKey}/{answerId})
      // or new structure (answers/{gameId}/{answerId})
      for (const [key, value] of Object.entries(gameAnswers)) {
        if (!value || typeof value !== 'object') continue;
        
        // Check if key is a dateKey (format: YYYYMMDD) or answerId (timestamp)
        const isDateKey = /^\d{8}$/.test(key);
        
        if (isDateKey) {
          // Old structure: answers/{gameId}/{dateKey}/{answerId}
          for (const [answerId, answerData] of Object.entries(value)) {
            if (!answerData || typeof answerData !== 'object') continue;
            answerList.push({
              gameId,
              answerId: `${key}/${answerId}`,
              answerData
            });
          }
        } else {
          // New structure: answers/{gameId}/{answerId}
          answerList.push({
            gameId,
            answerId: key,
            answerData: value
          });
        }
      }
    }

    const totalAnswers = answerList.length;
    console.log(`✅ Found ${totalAnswers} answers in RTDB\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    // Process answers in batches
    for (let i = 0; i < answerList.length; i += batchSize) {
      const batch = answerList.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(totalAnswers / batchSize);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} answers)...`);

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const { gameId, answerId, answerData } of batch) {
          try {
            // Skip if answer data is invalid
            if (!answerData || typeof answerData !== 'object') {
              skipped++;
              continue;
            }

            // Transform answer data
            const transformed = transformAnswerData(gameId, answerId, answerData);

            // Skip if user_id or answer is missing
            if (!transformed.user_id || !transformed.answer) {
              skipped++;
              continue;
            }

            // Use UPSERT (INSERT ... ON CONFLICT DO NOTHING) to avoid duplicates
            // Note: We use (game_id, user_id, answer, created_at) as unique constraint
            // If the exact same answer exists, we skip it
            await client.query(
              `INSERT INTO ${schema}.answers (
                game_id, user_id, answer, created_at
              )
              VALUES ($1, $2, $3, $4)
              ON CONFLICT DO NOTHING`,
              [
                transformed.game_id,
                transformed.user_id,
                transformed.answer,
                transformed.created_at
              ]
            );

            migrated++;
          } catch (error) {
            failed++;
            errors.push({
              gameId,
              answerId,
              error: error.message
            });
            console.error(`  ❌ Failed to migrate answer ${gameId}/${answerId}:`, error.message);
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
    console.log(`   Total answers: ${totalAnswers}`);
    console.log(`   ✅ Migrated: ${migrated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (errors.length > 0 && errors.length <= 20) {
      console.log('\n❌ Errors (first 20):');
      errors.slice(0, 20).forEach(({ gameId, answerId, error }) => {
        console.log(`   - ${gameId}/${answerId}: ${error}`);
      });
    } else if (errors.length > 20) {
      console.log(`\n❌ Total errors: ${errors.length} (showing first 20)`);
      errors.slice(0, 20).forEach(({ gameId, answerId, error }) => {
        console.log(`   - ${gameId}/${answerId}: ${error}`);
      });
    }

    return {
      total: totalAnswers,
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
const batchSize = parseInt(process.argv[3]) || 100;

if (!theme) {
  console.error('❌ Error: Theme is required');
  console.error('Usage: node scripts/migrate-answers-from-rtdb.js <theme> [batchSize]');
  console.error('Example: node scripts/migrate-answers-from-rtdb.js heng36');
  process.exit(1);
}

if (!['heng36', 'max56', 'jeed24'].includes(theme)) {
  console.error(`❌ Error: Invalid theme "${theme}". Must be one of: heng36, max56, jeed24`);
  process.exit(1);
}

migrateAnswers(theme, batchSize)
  .then((result) => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

