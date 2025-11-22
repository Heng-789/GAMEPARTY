/**
 * Test PostgreSQL Connection
 * ทดสอบการเชื่อมต่อ PostgreSQL - ใช้การตั้งค่าเดียวกับ database.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Helper function to create pool config from connection string (same as database.js)
function createPoolConfig(connectionString) {
  // Always use SSL for Supabase (cloud database)
  const useSSL = connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode=require');
  
  return {
    connectionString: connectionString,
    ssl: useSSL ? {
      rejectUnauthorized: false // Accept self-signed certificates for Supabase
    } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
  };
}

// Test multiple pools
const pools = {};

if (process.env.DATABASE_URL_HENG36) {
  pools.heng36 = new Pool(createPoolConfig(process.env.DATABASE_URL_HENG36));
}

if (process.env.DATABASE_URL_MAX56) {
  pools.max56 = new Pool(createPoolConfig(process.env.DATABASE_URL_MAX56));
}

if (process.env.DATABASE_URL_JEED24) {
  pools.jeed24 = new Pool(createPoolConfig(process.env.DATABASE_URL_JEED24));
}

// Fallback to single DATABASE_URL
if (Object.keys(pools).length === 0 && process.env.DATABASE_URL) {
  pools.default = new Pool(createPoolConfig(process.env.DATABASE_URL));
}

async function testConnection() {
  console.log('🧪 Testing PostgreSQL Connection...\n');

  if (Object.keys(pools).length === 0) {
    console.error('❌ No database connection strings found!');
    console.error('Please set DATABASE_URL_HENG36, DATABASE_URL_MAX56, or DATABASE_URL in .env file');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  try {
    // Test each pool
    for (const [theme, pool] of Object.entries(pools)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 Testing ${theme.toUpperCase()} Connection`);
      console.log('='.repeat(60));

      try {
        // Test 1: Basic connection
        console.log(`\n1️⃣  Testing basic connection...`);
        const result = await pool.query('SELECT NOW() as current_time, version() as version');
        console.log(`   ✅ Connected successfully!`);
        console.log(`   📅 Current time: ${result.rows[0].current_time}`);
        const version = result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1];
        console.log(`   🗄️  PostgreSQL version: ${version}`);

        // Test 2: Check database
        console.log(`\n2️⃣  Checking database...`);
        const dbResult = await pool.query('SELECT current_database() as database');
        console.log(`   ✅ Database: ${dbResult.rows[0].database}`);

        // Test 3: Check schemas
        console.log(`\n3️⃣  Checking schemas...`);
        const schemasResult = await pool.query(`
          SELECT schema_name 
          FROM information_schema.schemata 
          WHERE schema_name IN ('heng36', 'max56', 'jeed24', 'public')
          ORDER BY schema_name
        `);
        
        if (schemasResult.rows.length > 0) {
          console.log(`   ✅ Found ${schemasResult.rows.length} schema(s):`);
          schemasResult.rows.forEach((row) => {
            console.log(`      - ${row.schema_name}`);
          });
        } else {
          console.log(`   ⚠️  No schemas found. Run migrations first!`);
        }

        // Test 4: Check tables in public schema (exclude legacy tables)
        console.log(`\n4️⃣  Checking tables in public schema...`);
        const tablesResult = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name NOT IN ('HENG36')  -- Exclude legacy table
          ORDER BY table_name
        `);
        
        if (tablesResult.rows.length > 0) {
          console.log(`   ✅ Found ${tablesResult.rows.length} PostgreSQL table(s):`);
          if (tablesResult.rows.length <= 15) {
            tablesResult.rows.forEach((row) => {
              console.log(`      - ${row.table_name}`);
            });
          } else {
            tablesResult.rows.slice(0, 10).forEach((row) => {
              console.log(`      - ${row.table_name}`);
            });
            console.log(`      ... and ${tablesResult.rows.length - 10} more`);
          }
        } else {
          console.log(`   ⚠️  No tables found (run migrations first)`);
        }

        // Test 5: Performance test
        console.log(`\n5️⃣  Testing performance...`);
        const startTime = Date.now();
        await pool.query('SELECT 1');
        const endTime = Date.now();
        const latency = endTime - startTime;
        console.log(`   ⏱️  Query latency: ${latency}ms`);
        
        if (latency < 50) {
          console.log(`   ⭐ Excellent performance!`);
        } else if (latency < 100) {
          console.log(`   ✅ Good performance`);
        } else if (latency < 200) {
          console.log(`   ⚠️  Acceptable performance`);
        } else {
          console.log(`   ❌ Slow performance - check network/region`);
        }

        // Test 6: Check connection pool status
        console.log(`\n6️⃣  Connection pool status...`);
        console.log(`   📊 Total connections: ${pool.totalCount}`);
        console.log(`   🔄 Idle connections: ${pool.idleCount}`);
        console.log(`   ⏳ Waiting connections: ${pool.waitingCount}`);

        successCount++;
        console.log(`\n✅ ${theme.toUpperCase()} connection test PASSED!`);

      } catch (error) {
        failCount++;
        console.error(`\n❌ ${theme.toUpperCase()} connection test FAILED!`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code || 'N/A'}`);
        if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
          console.error(`\n   💡 SSL Certificate Issue:`);
          console.error(`      - This might be a Node.js version issue`);
          console.error(`      - Try updating Node.js to latest LTS version`);
          console.error(`      - Or check Supabase project status`);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Test Summary`);
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Total: ${successCount + failCount}`);

    if (successCount > 0 && failCount === 0) {
      console.log(`\n🎉 All database connections are working perfectly!`);
      process.exit(0);
    } else if (successCount > 0) {
      console.log(`\n⚠️  Some connections failed. Check errors above.`);
      process.exit(1);
    } else {
      console.log(`\n❌ All connections failed!`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Unexpected error during testing!');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    // Close all pools
    console.log(`\n🔌 Closing all connections...`);
    for (const [theme, pool] of Object.entries(pools)) {
      try {
        await pool.end();
        console.log(`   ✅ ${theme} pool closed`);
      } catch (error) {
        console.error(`   ❌ Error closing ${theme} pool: ${error.message}`);
      }
    }
  }
}

testConnection();

