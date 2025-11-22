/**
 * Test Backend Server Database Connection
 * ทดสอบว่า backend server เชื่อมต่อ database ได้หรือไม่
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { getPool, getSchema } from '../src/config/database.js';

dotenv.config();

const { Pool } = pg;

async function testDatabaseConnection() {
  console.log('🧪 Testing Backend Server Database Connection...\n');
  console.log(`Node.js version: ${process.version}\n`);

  const themes = ['heng36', 'max56', 'jeed24'];
  const results = {};

  for (const theme of themes) {
    console.log(`${'='.repeat(60)}`);
    console.log(`📊 Testing ${theme.toUpperCase()} Database Connection`);
    console.log('='.repeat(60));

    try {
      // Get pool using the same function as backend
      const pool = getPool(theme);
      const schema = getSchema(theme);

      if (!pool) {
        console.log(`❌ No connection pool found for ${theme}`);
        results[theme] = { success: false, error: 'No pool' };
        continue;
      }

      console.log(`\n1️⃣  Testing connection pool...`);
      console.log(`   Schema: ${schema}`);

      // Test 1: Basic query
      console.log(`\n2️⃣  Testing basic query...`);
      const result = await pool.query('SELECT NOW() as current_time, version() as version');
      console.log(`   ✅ Connected successfully!`);
      console.log(`   📅 Current time: ${result.rows[0].current_time}`);
      const version = result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1];
      console.log(`   🗄️  PostgreSQL version: ${version}`);

      // Test 2: Check if tables exist (exclude legacy tables)
      console.log(`\n3️⃣  Checking tables in ${schema} schema...`);
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_name NOT IN ('HENG36')  -- Exclude legacy table
        ORDER BY table_name
      `, [schema]);

      if (tablesResult.rows.length > 0) {
        console.log(`   ✅ Found ${tablesResult.rows.length} table(s):`);
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
        console.log(`   ⚠️  No tables found in ${schema} schema`);
      }

      // Test 3: Test a simple query on users table (if exists)
      console.log(`\n4️⃣  Testing users table query...`);
      try {
        const usersResult = await pool.query(`
          SELECT COUNT(*) as count 
          FROM ${schema}.users
        `);
        console.log(`   ✅ Users table accessible`);
        console.log(`   📊 Total users: ${usersResult.rows[0].count}`);
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log(`   ⚠️  Users table doesn't exist yet (this is OK for new databases)`);
        } else {
          console.log(`   ⚠️  Error querying users: ${error.message.substring(0, 80)}`);
        }
      }

      // Test 4: Performance test
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
        console.log(`   ❌ Slow performance`);
      }

      // Test 5: Connection pool status
      console.log(`\n6️⃣  Connection pool status...`);
      console.log(`   📊 Total connections: ${pool.totalCount}`);
      console.log(`   🔄 Idle connections: ${pool.idleCount}`);
      console.log(`   ⏳ Waiting connections: ${pool.waitingCount}`);

      results[theme] = { success: true, latency, tableCount: tablesResult.rows.length };
      console.log(`\n✅ ${theme.toUpperCase()} connection test PASSED!`);

    } catch (error) {
      console.error(`\n❌ ${theme.toUpperCase()} connection test FAILED!`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Code: ${error.code || 'N/A'}`);
      results[theme] = { success: false, error: error.message };
    }

    console.log('');
  }

  // Summary
  console.log(`${'='.repeat(60)}`);
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const [theme, result] of Object.entries(results)) {
    if (result.success) {
      successCount++;
      console.log(`✅ ${theme.toUpperCase()}: PASSED (${result.tableCount || 0} tables, ${result.latency || 0}ms)`);
    } else {
      failCount++;
      console.log(`❌ ${theme.toUpperCase()}: FAILED - ${result.error}`);
    }
  }

  console.log(`\n📈 Total: ${successCount} passed, ${failCount} failed`);

  if (successCount === themes.length) {
    console.log(`\n🎉 All database connections are working! Backend server is ready!`);
    process.exit(0);
  } else if (successCount > 0) {
    console.log(`\n⚠️  Some connections failed. Backend server may have issues.`);
    process.exit(1);
  } else {
    console.log(`\n❌ All connections failed! Backend server cannot connect to databases.`);
    process.exit(1);
  }
}

testDatabaseConnection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

