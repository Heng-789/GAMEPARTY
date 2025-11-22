/**
 * Test different SSL configurations
 * ทดสอบการตั้งค่า SSL แบบต่างๆ
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function testWithConfig(theme, connectionString, configName, sslConfig) {
  const pool = new Pool({
    connectionString: connectionString,
    ssl: sslConfig,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query('SELECT NOW() as now');
    console.log(`   ✅ ${configName}: SUCCESS`);
    console.log(`      Time: ${result.rows[0].now}`);
    await pool.end();
    return true;
  } catch (error) {
    console.log(`   ❌ ${configName}: FAILED - ${error.message.substring(0, 60)}`);
    await pool.end().catch(() => {});
    return false;
  }
}

async function testTheme(theme, connectionString) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 Testing ${theme.toUpperCase()} - SSL Configurations`);
  console.log('='.repeat(70));
  console.log(`Connection: ${connectionString.substring(0, 60)}...\n`);

  // Remove sslmode=require from URL for some tests
  const urlWithoutSSL = connectionString.replace('?sslmode=require', '');

  const configs = [
    { name: '1. With sslmode=require, rejectUnauthorized: false', url: connectionString, ssl: { rejectUnauthorized: false } },
    { name: '2. Without sslmode, rejectUnauthorized: false', url: urlWithoutSSL, ssl: { rejectUnauthorized: false } },
    { name: '3. With sslmode=require, ssl: true', url: connectionString, ssl: true },
    { name: '4. Without sslmode, ssl: true', url: urlWithoutSSL, ssl: true },
    { name: '5. With sslmode=require, ssl: false', url: connectionString, ssl: false },
    { name: '6. Without sslmode, ssl: false', url: urlWithoutSSL, ssl: false },
  ];

  let successCount = 0;
  for (const config of configs) {
    const success = await testWithConfig(theme, config.url, config.name, config.ssl);
    if (success) successCount++;
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }

  console.log(`\n📊 Result: ${successCount}/${configs.length} configurations worked`);
  return successCount > 0;
}

async function main() {
  console.log('🔍 Testing Different SSL Configurations\n');
  console.log(`Node.js version: ${process.version}\n`);

  const tests = [];

  if (process.env.DATABASE_URL_HENG36) {
    tests.push({ theme: 'HENG36', url: process.env.DATABASE_URL_HENG36 });
  }

  if (process.env.DATABASE_URL_MAX56) {
    tests.push({ theme: 'MAX56', url: process.env.DATABASE_URL_MAX56 });
  }

  if (tests.length === 0) {
    console.error('❌ No connection strings found!');
    process.exit(1);
  }

  for (const test of tests) {
    await testTheme(test.theme, test.url);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ Testing complete!');
  console.log('='.repeat(70));
}

main().catch(console.error);

