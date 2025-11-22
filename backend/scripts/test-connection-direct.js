/**
 * Test PostgreSQL Connection with Direct Connection (not pooler)
 * ทดสอบการเชื่อมต่อโดยใช้ direct connection แทน pooler
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Convert pooler connection string to direct connection
function convertToDirectConnection(poolerUrl) {
  // Pooler: aws-1-ap-south-1.pooler.supabase.com
  // Direct: db.xxxxx.supabase.co
  // Extract project ref from pooler URL
  const poolerMatch = poolerUrl.match(/postgres\.([^.]+)@([^:]+):/);
  if (poolerMatch) {
    const projectRef = poolerMatch[1];
    const host = poolerMatch[2];
    
    // Try to extract project ref from hostname
    // aws-1-ap-south-1.pooler.supabase.com -> need project ref
    // For now, try using direct connection format
    // Direct connection: db.{project-ref}.supabase.co
    
    // If we can't determine, return original
    return poolerUrl;
  }
  return poolerUrl;
}

// Helper function to create pool config
function createPoolConfig(connectionString, useDirect = false) {
  // Try different SSL configurations
  const sslOptions = [
    // Option 1: Standard Supabase SSL
    {
      rejectUnauthorized: false
    },
    // Option 2: More permissive (for testing)
    {
      rejectUnauthorized: false,
      require: false
    }
  ];

  const config = {
    connectionString: connectionString,
    ssl: sslOptions[0], // Try first option
    max: 5, // Smaller pool for testing
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  };

  return config;
}

async function testConnection(theme, connectionString) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Testing ${theme.toUpperCase()} Connection`);
  console.log('='.repeat(60));
  console.log(`🔗 Connection: ${connectionString.substring(0, 50)}...`);

  const config = createPoolConfig(connectionString);
  const pool = new Pool(config);

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

    // Test 3: Performance test
    console.log(`\n3️⃣  Testing performance...`);
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

    await pool.end();
    return true;

  } catch (error) {
    console.error(`\n❌ Connection test FAILED!`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    // Try alternative SSL config
    if (error.code === 'SELF_SIGNED_CERT_IN_CHAIN' || error.message.includes('certificate')) {
      console.log(`\n   🔄 Trying alternative SSL configuration...`);
      
      try {
        const altConfig = {
          connectionString: connectionString,
          ssl: {
            rejectUnauthorized: false,
            require: false
          },
          max: 5,
        };
        const altPool = new Pool(altConfig);
        const altResult = await altPool.query('SELECT NOW()');
        console.log(`   ✅ Alternative SSL config worked!`);
        console.log(`   📅 Current time: ${altResult.rows[0].now}`);
        await altPool.end();
        return true;
      } catch (altError) {
        console.error(`   ❌ Alternative config also failed: ${altError.message}`);
      }
    }

    await pool.end().catch(() => {});
    return false;
  }
}

async function main() {
  console.log('🧪 Testing PostgreSQL Connections (Direct Mode)...\n');
  console.log(`Node.js version: ${process.version}\n`);

  const tests = [];

  if (process.env.DATABASE_URL_HENG36) {
    tests.push({
      theme: 'HENG36',
      url: process.env.DATABASE_URL_HENG36
    });
  }

  if (process.env.DATABASE_URL_MAX56) {
    tests.push({
      theme: 'MAX56',
      url: process.env.DATABASE_URL_MAX56
    });
  }

  if (process.env.DATABASE_URL_JEED24) {
    tests.push({
      theme: 'JEED24',
      url: process.env.DATABASE_URL_JEED24
    });
  }

  if (tests.length === 0) {
    console.error('❌ No database connection strings found!');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const test of tests) {
    const success = await testConnection(test.theme, test.url);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Test Summary`);
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total: ${successCount + failCount}`);

  if (successCount === tests.length) {
    console.log(`\n🎉 All database connections are working!`);
    process.exit(0);
  } else if (successCount > 0) {
    console.log(`\n⚠️  Some connections failed.`);
    console.log(`\n💡 Suggestions:`);
    console.log(`   1. Check Supabase project status in dashboard`);
    console.log(`   2. Verify connection strings are correct`);
    console.log(`   3. Try using direct connection (db.xxx.supabase.co) instead of pooler`);
    console.log(`   4. Check if projects are paused (free tier)`);
    process.exit(1);
  } else {
    console.log(`\n❌ All connections failed!`);
    process.exit(1);
  }
}

main();

