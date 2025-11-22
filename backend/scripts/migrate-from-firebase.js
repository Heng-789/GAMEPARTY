/**
 * Migration Script: Firebase to PostgreSQL
 * ย้ายข้อมูลจาก Firebase (RTDB + Firestore) ไป PostgreSQL
 */

import pg from 'pg';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
  };
}

// Connection pools for each theme (multiple projects)
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

  // Fallback: Single DATABASE_URL (for single project with schema separation)
  if (Object.keys(pools).length === 0 && process.env.DATABASE_URL) {
    pools.default = new Pool(createPoolConfig(process.env.DATABASE_URL));
  }
}

// Initialize pools
initializePools();

// Helper function to get pool based on theme
function getPool(theme) {
  // If using multiple projects (separate connection strings)
  if (pools[theme]) {
    return pools[theme];
  }
  
  // Fallback to default pool (for single project with schema separation)
  return pools.default || pools.heng36;
}

// Helper function to get schema name
// For multiple projects, schema is usually 'public'
// For single project with schema separation, use theme name as schema
function getSchema(theme) {
  // If using multiple projects, each project uses 'public' schema
  if (pools[theme] && pools[theme] !== pools.default) {
    return 'public';
  }
  
  // If using single project with schema separation
  const schemas = {
    heng36: 'heng36',
    max56: 'max56',
    jeed24: 'jeed24'
  };
  return schemas[theme] || 'public';
}

// Initialize Firebase
function initFirebase(theme = 'heng36') {
  const config = firebaseConfigs[theme];
  if (!config) {
    throw new Error(`Unknown theme: ${theme}`);
  }

  let app;
  try {
    app = getApps().find(a => a.name === theme) || initializeApp(config, theme);
  } catch (error) {
    app = initializeApp(config, theme);
  }

  const db = getDatabase(app);
  const firestore = getFirestore(app);
  
  return { db, firestore };
}

/**
 * Migrate Users from Firestore
 */
async function migrateUsersFromFirestore(theme = 'heng36', batchSize = 100) {
  console.log(`\n📦 Migrating users from Firestore (${theme})...`);
  
  const { firestore } = initFirebase(theme);
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const usersRef = collection(firestore, 'users');
  const snapshot = await getDocs(usersRef);
  
  let migrated = 0;
  let failed = 0;
  const errors = [];

  const users = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    users.push({
      userId: doc.id,
      source: 'firestore',
      ...data
    });
  });

  console.log(`Found ${users.length} users in Firestore`);

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    for (const user of batch) {
      try {
        await pool.query(
          `INSERT INTO ${schema}.users (user_id, password, hcoin, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             password = COALESCE(EXCLUDED.password, ${schema}.users.password),
             hcoin = GREATEST(EXCLUDED.hcoin, ${schema}.users.hcoin),
             status = COALESCE(EXCLUDED.status, ${schema}.users.status),
             updated_at = GREATEST(EXCLUDED.updated_at, ${schema}.users.updated_at)`,
          [
            user.userId,
            user.password || null,
            Number(user.hcoin || 0),
            user.status || null,
            user.createdAt ? (user.createdAt.toMillis ? new Date(user.createdAt.toMillis()) : new Date(user.createdAt)) : new Date(),
            user.updatedAt ? (user.updatedAt.toMillis ? new Date(user.updatedAt.toMillis()) : new Date(user.updatedAt)) : new Date()
          ]
        );
        migrated++;
      } catch (error) {
        failed++;
        errors.push(`User ${user.userId} (Firestore): ${error.message}`);
        console.error(`Error migrating user ${user.userId}:`, error.message);
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, users.length)}/${users.length} users`);
  }

  console.log(`✅ Migrated ${migrated} users from Firestore, ${failed} failed`);
  return { migrated, failed, errors };
}

/**
 * Migrate Users from RTDB (USERS_EXTRA)
 */
async function migrateUsersFromRTDB(theme = 'heng36', batchSize = 100) {
  console.log(`\n📦 Migrating users from RTDB (USERS_EXTRA) (${theme})...`);
  
  const { db } = initFirebase(theme);
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const usersRef = ref(db, 'USERS_EXTRA');
  const snapshot = await get(usersRef);

  if (!snapshot.exists()) {
    console.log('No users found in RTDB');
    return { migrated: 0, failed: 0, errors: [] };
  }

  const usersData = snapshot.val();
  let migrated = 0;
  let failed = 0;
  const errors = [];

  const users = [];
  for (const [userId, userData] of Object.entries(usersData)) {
    if (!userData) continue;
    users.push({
      userId,
      source: 'rtdb',
      ...userData
    });
  }

  console.log(`Found ${users.length} users in RTDB`);

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    for (const user of batch) {
      try {
        await pool.query(
          `INSERT INTO users (user_id, password, hcoin, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE SET
             password = COALESCE(EXCLUDED.password, users.password),
             hcoin = GREATEST(EXCLUDED.hcoin, users.hcoin),
             status = COALESCE(EXCLUDED.status, users.status),
             updated_at = GREATEST(EXCLUDED.updated_at, users.updated_at)`,
          [
            user.userId,
            user.password || null,
            Number(user.hcoin || 0),
            user.status || null,
            user.createdAt ? new Date(user.createdAt) : new Date(),
            user.updatedAt ? new Date(user.updatedAt) : (user.createdAt ? new Date(user.createdAt) : new Date())
          ]
        );
        migrated++;
      } catch (error) {
        failed++;
        errors.push(`User ${user.userId} (RTDB): ${error.message}`);
        console.error(`Error migrating user ${user.userId}:`, error.message);
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, users.length)}/${users.length} users`);
  }

  console.log(`✅ Migrated ${migrated} users from RTDB, ${failed} failed`);
  return { migrated, failed, errors };
}

/**
 * Migrate Users from both Firestore and RTDB
 */
async function migrateUsers(theme = 'heng36', batchSize = 100) {
  console.log(`\n📦 Migrating ALL users from ${theme}...`);
  
  const firestoreResult = await migrateUsersFromFirestore(theme, batchSize);
  const rtdbResult = await migrateUsersFromRTDB(theme, batchSize);

  const totalMigrated = firestoreResult.migrated + rtdbResult.migrated;
  const totalFailed = firestoreResult.failed + rtdbResult.failed;
  const allErrors = [...firestoreResult.errors, ...rtdbResult.errors];

  console.log(`\n✅ Total users migrated: ${totalMigrated} (Firestore: ${firestoreResult.migrated}, RTDB: ${rtdbResult.migrated})`);
  console.log(`❌ Total failed: ${totalFailed}`);

  return {
    migrated: totalMigrated,
    failed: totalFailed,
    errors: allErrors,
    firestore: firestoreResult,
    rtdb: rtdbResult
  };
}

/**
 * Migrate Games from RTDB
 * รองรับเกมทุกประเภท: เกมทายภาพปริศนา, เกมทายเบอร์เงิน, เกมทายผลบอล, 
 * เกมสล็อต, เกมเช็คอิน, เกมประกาศรางวัล, เกม Trick or Treat, เกมลอยกระทง, เกม BINGO
 */
async function migrateGames(theme = 'heng36') {
  console.log(`\n📦 Migrating ALL games from ${theme}...`);
  console.log(`   (เกมทายภาพปริศนา, เกมทายเบอร์เงิน, เกมทายผลบอล, เกมสล็อต,`);
  console.log(`    เกมเช็คอิน, เกมประกาศรางวัล, เกม Trick or Treat, เกมลอยกระทง, เกม BINGO)`);
  
  const { db } = initFirebase(theme);
  const pool = getPool(theme);
  const gamesRef = ref(db, 'games');
  const snapshot = await get(gamesRef);

  if (!snapshot.exists()) {
    console.log('No games found');
    return { migrated: 0, failed: 0, errors: [] };
  }

  const games = snapshot.val();
  let migrated = 0;
  let failed = 0;
  const errors = [];
  const gameTypes = {};

  for (const [gameId, gameData] of Object.entries(games)) {
    if (!gameData) continue;

    try {
      const gameName = (gameData.name || gameData.title || '').trim();
      if (!gameName || gameName.length === 0) {
        continue; // Skip games without names
      }

      const gameType = gameData.type || 'เกมทายภาพปริศนา';
      gameTypes[gameType] = (gameTypes[gameType] || 0) + 1;

      // Extract game-specific data (เก็บทุกอย่างไว้ใน game_data JSONB)
      // รวมถึง: puzzle, numberPick, football, slot, announce, trickOrTreat, loyKrathong, bingo, checkin
      const {
        name,
        type,
        unlocked,
        locked,
        userAccessType,
        selectedUsers,
        id, // Exclude id because we use game_id
        ...gameSpecificData
      } = gameData;

      // เก็บข้อมูลเกมทั้งหมดไว้ใน game_data JSONB
      // ซึ่งจะครอบคลุมข้อมูลเกมทุกประเภท:
      // - puzzle: { imageDataUrl, answer }
      // - numberPick: { imageDataUrl, endAt }
      // - football: { imageDataUrl, homeTeam, awayTeam, endAt }
      // - slot: { ... }
      // - announce: { users, userBonuses }
      // - trickOrTreat: { winChance, ghostImage }
      // - loyKrathong: { image, endAt, codes, codeCursor, claimedBy, bigPrizeCodes, ... }
      // - bingo: { image, endAt, codes, codeCursor, claimedBy, numbers, currentNumber, ... }
      // - checkin: { rewards, days, slot, ... }
      // - codes, codeCursor, claimedBy (สำหรับเกมทั่วไป)

      const schema = getSchema(theme);
      await pool.query(
        `INSERT INTO ${schema}.games (game_id, name, type, unlocked, locked, user_access_type, selected_users, game_data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (game_id) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           unlocked = EXCLUDED.unlocked,
           locked = EXCLUDED.locked,
           user_access_type = EXCLUDED.user_access_type,
           selected_users = EXCLUDED.selected_users,
           game_data = EXCLUDED.game_data,
           updated_at = EXCLUDED.updated_at`,
        [
          gameId,
          gameName,
          gameType,
          unlocked !== undefined ? unlocked : (locked === false),
          locked !== undefined ? locked : (unlocked === false),
          userAccessType || 'all',
          selectedUsers ? JSON.stringify(selectedUsers) : null,
          JSON.stringify(gameSpecificData), // เก็บข้อมูลเกมทุกประเภทไว้ใน JSONB
          new Date(gameData.createdAt || gameData.updatedAt || Date.now()),
          new Date(gameData.updatedAt || Date.now())
        ]
      );
      migrated++;
    } catch (error) {
      failed++;
      errors.push(`Game ${gameId}: ${error.message}`);
      console.error(`Error migrating game ${gameId}:`, error.message);
    }
  }

  console.log(`\n📊 Games by type:`);
  Object.entries(gameTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count} games`);
  });

  console.log(`\n✅ Migrated ${migrated} games (all types), ${failed} failed`);
  return { migrated, failed, errors, gameTypes };
}

/**
 * Migrate Checkins from Firestore
 */
async function migrateCheckins(theme = 'heng36', batchSize = 100) {
  console.log(`\n📦 Migrating checkins from ${theme}...`);
  
  const { firestore } = initFirebase(theme);
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const checkinsRef = collection(firestore, 'checkins');
  const snapshot = await getDocs(checkinsRef);

  let migrated = 0;
  let failed = 0;
  const errors = [];

  const checkins = [];
  snapshot.forEach((gameDoc) => {
    const gameId = gameDoc.id;
    const gameData = gameDoc.data();
    
    if (gameData.users) {
      Object.entries(gameData.users).forEach(([userId, userData]) => {
        if (userData.days) {
          Object.entries(userData.days).forEach(([dayIndex, dayData]) => {
            if (dayData.checked) {
              checkins.push({
                gameId,
                userId,
                dayIndex: parseInt(dayIndex),
                checked: dayData.checked,
                checkinDate: dayData.date,
                uniqueKey: dayData.key,
                createdAt: dayData.createdAt,
                updatedAt: dayData.updatedAt || dayData.createdAt
              });
            }
          });
        }
      });
    }
  });

  console.log(`Found ${checkins.length} checkins to migrate`);

  for (let i = 0; i < checkins.length; i += batchSize) {
    const batch = checkins.slice(i, i + batchSize);
    
    for (const checkin of batch) {
      try {
        await pool.query(
          `INSERT INTO ${schema}.checkins (game_id, user_id, day_index, checked, checkin_date, unique_key, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (game_id, user_id, day_index) DO UPDATE SET
             checked = EXCLUDED.checked,
             checkin_date = EXCLUDED.checkin_date,
             unique_key = EXCLUDED.unique_key,
             updated_at = EXCLUDED.updated_at`,
          [
            checkin.gameId,
            checkin.userId,
            checkin.dayIndex,
            checkin.checked,
            checkin.checkinDate,
            checkin.uniqueKey || null,
            checkin.createdAt ? (checkin.createdAt.toMillis ? new Date(checkin.createdAt.toMillis()) : new Date(checkin.createdAt)) : new Date(),
            checkin.updatedAt ? (checkin.updatedAt.toMillis ? new Date(checkin.updatedAt.toMillis()) : new Date(checkin.updatedAt)) : new Date()
          ]
        );
        migrated++;
      } catch (error) {
        failed++;
        errors.push(`Checkin ${checkin.gameId}/${checkin.userId}/${checkin.dayIndex}: ${error.message}`);
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, checkins.length)}/${checkins.length} checkins`);
  }

  console.log(`✅ Migrated ${migrated} checkins, ${failed} failed`);
  return { migrated, failed, errors };
}

/**
 * Migrate Answers from RTDB
 */
async function migrateAnswers(theme = 'heng36', batchSize = 100) {
  console.log(`\n📦 Migrating answers from ${theme}...`);
  
  const { db } = initFirebase(theme);
  const pool = getPool(theme);
  const schema = getSchema(theme);
  const answersRef = ref(db, 'answers');
  const snapshot = await get(answersRef);

  if (!snapshot.exists()) {
    console.log('No answers found');
    return { migrated: 0, failed: 0, errors: [] };
  }

  const answers = snapshot.val();
  let migrated = 0;
  let failed = 0;
  const errors = [];

  const answerList = [];
  for (const [gameId, gameAnswers] of Object.entries(answers)) {
    if (!gameAnswers) continue;
    
    for (const [dateKey, dateAnswers] of Object.entries(gameAnswers)) {
      if (!dateAnswers) continue;
      
      for (const [answerId, answerData] of Object.entries(dateAnswers)) {
        answerList.push({
          gameId,
          answerId,
          userId: answerData.user || answerData.userId,
          answer: answerData.answer || answerData.text,
          ts: answerData.ts || Date.now()
        });
      }
    }
  }

  console.log(`Found ${answerList.length} answers to migrate`);

  for (let i = 0; i < answerList.length; i += batchSize) {
    const batch = answerList.slice(i, i + batchSize);
    
    for (const answer of batch) {
      try {
        await pool.query(
          `INSERT INTO ${schema}.answers (game_id, user_id, answer, created_at)
           VALUES ($1, $2, $3, $4)`,
          [
            answer.gameId,
            answer.userId,
            answer.answer,
            new Date(answer.ts)
          ]
        );
        migrated++;
      } catch (error) {
        failed++;
        errors.push(`Answer ${answer.gameId}/${answer.answerId}: ${error.message}`);
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, answerList.length)}/${answerList.length} answers`);
  }

  console.log(`✅ Migrated ${migrated} answers, ${failed} failed`);
  return { migrated, failed, errors };
}

/**
 * Main migration function
 */
async function migrateAll(theme = 'heng36') {
  console.log(`\n🚀 Starting migration from ${theme} to PostgreSQL...\n`);

  try {
    // Test PostgreSQL connection
    const pool = getPool(theme);
    const schema = getSchema(theme);
    await pool.query('SELECT 1');
    console.log(`✅ Connected to PostgreSQL (${theme}, schema: ${schema})`);

    const results = {
      users: { migrated: 0, failed: 0, errors: [] },
      games: { migrated: 0, failed: 0, errors: [] },
      checkins: { migrated: 0, failed: 0, errors: [] },
      answers: { migrated: 0, failed: 0, errors: [] }
    };

    // Migrate in order
    results.users = await migrateUsers(theme);
    results.games = await migrateGames(theme);
    results.checkins = await migrateCheckins(theme);
    results.answers = await migrateAnswers(theme);

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Users:    ${results.users.migrated} migrated (Firestore: ${results.users.firestore?.migrated || 0}, RTDB: ${results.users.rtdb?.migrated || 0}), ${results.users.failed} failed`);
    console.log(`Games:    ${results.games.migrated} migrated (all types), ${results.games.failed} failed`);
    if (results.games.gameTypes) {
      console.log(`   Game types:`);
      Object.entries(results.games.gameTypes).forEach(([type, count]) => {
        console.log(`     - ${type}: ${count}`);
      });
    }
    console.log(`Checkins: ${results.checkins.migrated} migrated, ${results.checkins.failed} failed`);
    console.log(`Answers:  ${results.answers.migrated} migrated, ${results.answers.failed} failed`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const totalMigrated = Object.values(results).reduce((sum, r) => sum + r.migrated, 0);
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);
    
    console.log(`\n✅ Total: ${totalMigrated} migrated, ${totalFailed} failed`);

    if (totalFailed > 0) {
      console.log('\n⚠️  Some migrations failed. Check errors above.');
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
const theme = process.argv[2] || 'heng36';
migrateAll(theme).catch(console.error);

