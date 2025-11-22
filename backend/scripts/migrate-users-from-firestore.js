/**
 * Migration Script: Firestore Users to PostgreSQL
 * โยกย้ายข้อมูล USER จาก Firestore ไป PostgreSQL
 * เอาแค่ userId และ password (ไม่เอา hcoin)
 */

import pg from 'pg';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit, startAfter } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Firebase configurations
const firebaseConfigs = {
  heng36: {
    apiKey: "AIzaSyDU5OJNe9bF3xX3IwBAqT7v1QgxeRRzmzw",
    authDomain: "heng-15023.firebaseapp.com",
    projectId: "heng-15023",
  },
  max56: {
    apiKey: "AIzaSyCq4J3neJr1jSIzOSN8_YeBmsvSChsuIBs",
    authDomain: "max56-98e6f.firebaseapp.com",
    projectId: "max56-98e6f",
  },
  jeed24: {
    apiKey: "AIzaSyBBun3l4CW6QQLcNH4KO9mpdse6Sx-Q_fQ",
    authDomain: "jeed24-3c755.firebaseapp.com",
    projectId: "jeed24-3c755",
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

  const firestore = getFirestore(app);
  return firestore;
}

/**
 * Migrate Users from Firestore (เฉพาะ userId และ password)
 * ใช้ batch processing เพื่อความเร็ว
 */
async function migrateUsersFromFirestore(theme = 'heng36', batchSize = 500) {
  console.log(`\n📦 Migrating users from Firestore (${theme})...`);
  console.log(`   ✅ เอาเฉพาะ userId และ password (ไม่เอา hcoin)`);
  console.log(`   📊 Batch size: ${batchSize} users per batch\n`);
  
  const firestore = initFirebase(theme);
  const pool = getPool(theme);
  const schema = getSchema(theme);
  
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];
  
  // ดึงข้อมูลทั้งหมดจาก Firestore (ใช้ pagination เพื่อป้องกัน memory overflow)
  const usersRef = collection(firestore, 'users');
  let lastDoc = null;
  let totalFetched = 0;
  
  // ✅ โครงสร้างข้อมูลที่แนะนำ: Array of Objects
  // [{ userId: string, password: string }]
  // 
  // 💡 ทำไมใช้ Array of Objects?
  // - ✅ เร็วที่สุดสำหรับ batch insert/update (เร็วกว่า insert ทีละตัว 10-50 เท่า)
  // - ✅ ง่ายต่อการจัดการและตรวจสอบ
  // - ✅ ใช้ memory น้อยกว่า Map/Object
  // - ✅ รองรับการเรียงลำดับ (sort) ได้ง่าย
  // - ✅ ง่ายต่อการ filter, map, reduce
  // 
  // 📖 ดูคำแนะนำเพิ่มเติม: backend/scripts/USER-DATA-STRUCTURE-GUIDE.md
  const allUsers = [];
  
  console.log('📥 Fetching users from Firestore...');
  
  // Fetch all users with pagination
  while (true) {
    let q = query(usersRef, limit(1000));
    if (lastDoc) {
      q = query(usersRef, limit(1000), startAfter(lastDoc));
    }
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      break;
    }
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const userId = doc.id;
      const password = data.password || null;
      
      // ✅ เอาเฉพาะ userId และ password
      if (userId) {
        allUsers.push({
          userId: userId,
          password: password
        });
      }
    });
    
    totalFetched += snapshot.size;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    
    console.log(`   Fetched ${totalFetched} users...`);
    
    if (snapshot.size < 1000) {
      break;
    }
  }
  
  console.log(`\n✅ Total users fetched: ${allUsers.length}`);
  console.log(`🚀 Starting migration with batch size: ${batchSize}...\n`);
  
  // ✅ ใช้ batch processing เพื่อความเร็ว
  // แบ่ง users เป็น batches และ insert/update ทีละ batch
  // ✅ แนะนำ: ใช้ Array of Objects [{ userId, password }] เพื่อความเร็วในการ batch insert
  for (let i = 0; i < allUsers.length; i += batchSize) {
    const batch = allUsers.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allUsers.length / batchSize);
    
    try {
      // ✅ ใช้ transaction เพื่อความเร็วและความปลอดภัย
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // ✅ ใช้ Bulk UPSERT ด้วย VALUES clause เพื่อความเร็วมากกว่า insert ทีละตัว
        // วิธีนี้เร็วกว่าการ insert ทีละ user ประมาณ 10-50 เท่า
        const values = [];
        const placeholders = [];
        let paramIndex = 1;
        
        for (const user of batch) {
          if (!user.userId) continue; // Skip invalid users
          placeholders.push(`($${paramIndex++}, $${paramIndex++}, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
          values.push(user.userId);
          values.push(user.password || null);
        }
        
        if (placeholders.length > 0) {
          // ✅ Bulk UPSERT - เร็วกว่าการ insert ทีละตัวมาก
          const query = `
            INSERT INTO ${schema}.users (user_id, password, hcoin, status, created_at, updated_at)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (user_id) 
            DO UPDATE SET 
              password = COALESCE(EXCLUDED.password, ${schema}.users.password),
              updated_at = CURRENT_TIMESTAMP
            WHERE ${schema}.users.password IS NULL OR EXCLUDED.password IS NOT NULL
          `;
          
          const result = await client.query(query, values);
          migrated += placeholders.length;
        }
        
        await client.query('COMMIT');
        
        console.log(`   ✅ Batch ${batchNumber}/${totalBatches}: ${batch.length} users processed (${migrated} migrated)`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Error processing batch ${batchNumber}:`, error.message);
        // ถ้า batch fail ให้ลอง insert ทีละตัวเพื่อดูว่า user ไหนมีปัญหา
        for (const user of batch) {
          if (!user.userId) {
            skipped++;
            continue;
          }
          try {
            const client2 = await pool.connect();
            try {
              await client2.query('BEGIN');
              await client2.query(
                `INSERT INTO ${schema}.users (user_id, password, hcoin, status, created_at, updated_at)
                 VALUES ($1, $2, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) 
                 DO UPDATE SET 
                   password = COALESCE(EXCLUDED.password, ${schema}.users.password),
                   updated_at = CURRENT_TIMESTAMP
                 WHERE ${schema}.users.password IS NULL OR EXCLUDED.password IS NOT NULL`,
                [user.userId, user.password || null]
              );
              await client2.query('COMMIT');
              migrated++;
            } catch (err) {
              await client2.query('ROLLBACK');
              if (!user.password) {
                skipped++;
              } else {
                failed++;
                errors.push(`User ${user.userId}: ${err.message}`);
              }
            } finally {
              client2.release();
            }
          } catch (err) {
            failed++;
            errors.push(`User ${user.userId}: ${err.message}`);
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`   ❌ Error processing batch ${batchNumber}:`, error.message);
      failed += batch.length;
    }
  }
  
  console.log(`\n✅ Migration completed!`);
  console.log(`   📊 Migrated: ${migrated} users`);
  console.log(`   ⏭️  Skipped: ${skipped} users (no password)`);
  console.log(`   ❌ Failed: ${failed} users`);
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log(`\n⚠️  Errors:`);
    errors.forEach(err => console.log(`   - ${err}`));
  } else if (errors.length > 10) {
    console.log(`\n⚠️  ${errors.length} errors (showing first 10):`);
    errors.slice(0, 10).forEach(err => console.log(`   - ${err}`));
  }
  
  return { migrated, skipped, failed, errors, total: allUsers.length };
}

/**
 * Main migration function
 */
async function migrateUsers(theme = 'heng36', batchSize = 500) {
  console.log(`\n🚀 Starting user migration from Firestore to PostgreSQL...`);
  console.log(`   Theme: ${theme}`);
  console.log(`   Batch size: ${batchSize}\n`);
  
  try {
    // Test PostgreSQL connection
    const pool = getPool(theme);
    const schema = getSchema(theme);
    await pool.query('SELECT 1');
    console.log(`✅ Connected to PostgreSQL (${theme}, schema: ${schema})\n`);
    
    const result = await migrateUsersFromFirestore(theme, batchSize);
    
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total users in Firestore: ${result.total}`);
    console.log(`✅ Migrated: ${result.migrated}`);
    console.log(`⏭️  Skipped: ${result.skipped} (no password)`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (result.failed > 0) {
      console.log('⚠️  Some migrations failed. Check errors above.');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    // Close all pools
    await Promise.all(Object.values(pools).map(pool => pool.end()));
  }
}

// Run migration
const theme = process.argv[2] || 'heng36';
const batchSize = parseInt(process.argv[3]) || 500;

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Firestore Users Migration to PostgreSQL                  ║
║  โยกย้ายข้อมูล USER จาก Firestore ไป PostgreSQL          ║
╚════════════════════════════════════════════════════════════╝

Usage: node migrate-users-from-firestore.js [theme] [batchSize]
  theme: heng36 | max56 | jeed24 (default: heng36)
  batchSize: จำนวน users ต่อ batch (default: 500)

Example:
  node migrate-users-from-firestore.js heng36 500
  node migrate-users-from-firestore.js max56 1000
`);

migrateUsers(theme, batchSize)
  .then(() => {
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

