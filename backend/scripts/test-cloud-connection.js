/**
 * Test Cloud PostgreSQL Connection
 * ทดสอบการเชื่อมต่อ PostgreSQL บน Cloud
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Helper function to create pool config from connection string
function createPoolConfig(connectionString) {
  // Always use SSL for Supabase (cloud database)
  const useSSL = connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode=require');
  
  return {
    connectionString: connectionString,
    ssl: useSSL ? {
      rejectUnauthorized: false // Accept self-signed certificates for Supabase
    } : false,
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
  console.log('🧪 Testing PostgreSQL Cloud Connection...\n');

  if (Object.keys(pools).length === 0) {
    console.error('❌ No database connection strings found!');
    console.error('Please set DATABASE_URL_HENG36, DATABASE_URL_MAX56, or DATABASE_URL in .env file');
    process.exit(1);
  }

  try {
    // Test each pool
    for (const [theme, pool] of Object.entries(pools)) {
      console.log(`\n📊 Testing ${theme.toUpperCase()} connection...\n`);

      // Test 1: Basic connection
      console.log(`1. Testing ${theme} basic connection...`);
      const result = await pool.query('SELECT NOW() as current_time, version() as version');
      console.log(`✅ ${theme} connected successfully!`);
      console.log(`   Current time: ${result.rows[0].current_time}`);
      console.log(`   PostgreSQL version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}\n`);

      // Test 2: Check database
      console.log(`2. Checking ${theme} database...`);
      const dbResult = await pool.query('SELECT current_database() as database');
      console.log(`✅ Database: ${dbResult.rows[0].database}\n`);

      // Test 3: Check schemas
      console.log(`3. Checking ${theme} schemas...`);
      const schemasResult = await pool.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name IN ('heng36', 'max56', 'jeed24', 'public')
        ORDER BY schema_name
      `);
      
      if (schemasResult.rows.length > 0) {
        console.log(`✅ Found ${schemasResult.rows.length} schemas:`);
        schemasResult.rows.forEach((row) => {
          console.log(`   - ${row.schema_name}`);
        });
      } else {
        console.log('⚠️  No schemas found. Run migrations first!');
      }
      console.log('');

      // Test 4: Check tables in public schema (for multiple projects)
      console.log(`4. Checking ${theme} tables in public schema...`);
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      if (tablesResult.rows.length > 0) {
        console.log(`   ✅ ${theme}: ${tablesResult.rows.length} tables found`);
        if (tablesResult.rows.length <= 10) {
          tablesResult.rows.forEach((row) => {
            console.log(`      - ${row.table_name}`);
          });
        }
      } else {
        console.log(`   ⚠️  ${theme}: No tables found (run migrations first)`);
      }
      console.log('');

      // Test 5: Performance test
      console.log(`5. Testing ${theme} performance...`);
      const startTime = Date.now();
      await pool.query('SELECT 1');
      const endTime = Date.now();
      const latency = endTime - startTime;
      console.log(`✅ Query latency: ${latency}ms`);
      
      if (latency < 50) {
        console.log('   ⭐ Excellent performance!');
      } else if (latency < 100) {
        console.log('   ✅ Good performance');
      } else if (latency < 200) {
        console.log('   ⚠️  Acceptable performance');
      } else {
        console.log('   ❌ Slow performance - check network/region');
      }
      console.log('');
    }

    console.log('✅ All tests passed! Databases are ready to use.\n');

  } catch (error) {
    console.error('❌ Connection test failed!');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DATABASE_URL_HENG36, DATABASE_URL_MAX56, or DATABASE_URL in .env');
    console.error('2. Verify database credentials');
    console.error('3. Check firewall/security group settings');
    console.error('4. Ensure SSL is configured correctly (?sslmode=require)');
    console.error('5. Verify network connectivity');
    process.exit(1);
  } finally {
    // Close all pools
    for (const pool of Object.values(pools)) {
      await pool.end();
    }
  }
}

testConnection();

