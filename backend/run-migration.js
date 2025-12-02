/**
 * Run Migration Script for Reward Codes Table
 * Usage: node run-migration.js
 * Run from backend directory
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function runMigration() {
  const themes = ['heng36', 'max56', 'jeed24'];
  const migrationFile = join(projectRoot, 'migrations', '006_create_reward_codes_table.sql');
  
  console.log('🚀 Starting migration for reward_codes table...\n');
  
  let successCount = 0;
  let skippedCount = 0;
  
  for (const theme of themes) {
    const dbUrl = process.env[`DATABASE_URL_${theme.toUpperCase()}`] || 
                  (theme === 'heng36' ? process.env.DATABASE_URL : null);
    
    if (!dbUrl) {
      console.log(`⚠️  Skipping ${theme} - no DATABASE_URL found\n`);
      skippedCount++;
      continue;
    }
    
    let pool = null;
    
    try {
      console.log(`🔄 Running migration for ${theme}...`);
      
      pool = new Pool({
        connectionString: dbUrl,
        ssl: dbUrl.includes('supabase') || dbUrl.includes('pooler') || dbUrl.includes('sslmode=require') 
          ? { rejectUnauthorized: false } 
          : false,
        // Add connection timeout to prevent hanging
        connectionTimeoutMillis: 10000,
        // Add query timeout
        query_timeout: 30000
      });
      
      // Add error handler to prevent unhandled errors
      pool.on('error', (err) => {
        // Silently handle pool errors - we'll catch them in try-catch
        if (process.env.NODE_ENV === 'development') {
          console.log(`   [Pool error for ${theme}]:`, err.message);
        }
      });
      
      // Test connection first with timeout
      await Promise.race([
        pool.query('SELECT NOW()'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);
      
      const sql = readFileSync(migrationFile, 'utf8');
      
      // Run migration with timeout
      await Promise.race([
        pool.query(sql),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Migration timeout')), 30000)
        )
      ]);
      
      console.log(`✅ Migration completed for ${theme}\n`);
      successCount++;
    } catch (error) {
      // Handle connection errors gracefully
      const errorMessage = error.message || String(error);
      const errorCode = error.code || '';
      
      if (errorCode === 'XX000' || errorMessage.includes('shutdown') || errorMessage.includes('termination') || errorMessage.includes('db_termination')) {
        console.log(`⚠️  ${theme}: Database connection terminated`);
        console.log(`   This is OK if ${theme} database is unavailable or not configured.`);
        console.log(`   You can run migration later via Supabase Dashboard.\n`);
        skippedCount++;
      } else if (errorCode === '3F000' || errorMessage.includes('does not exist')) {
        console.log(`⚠️  ${theme}: Schema not found, using public schema (this is OK for Supabase)`);
        // Try again with public schema only
        try {
          if (pool) {
            const publicSql = sql.replace(/create_reward_codes_table\('(heng36|max56|jeed24)'\)/g, '');
            if (publicSql.includes("create_reward_codes_table('public')")) {
              await pool.query(publicSql);
              console.log(`✅ Migration completed for ${theme} (public schema)\n`);
              successCount++;
            }
          }
        } catch (retryError) {
          console.error(`❌ Migration failed for ${theme}:`, retryError.message);
          console.log('');
        }
      } else if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout') || errorMessage.includes('Connection timeout') || errorMessage.includes('Migration timeout')) {
        console.log(`⚠️  ${theme}: Connection or migration timeout`);
        console.log(`   Database may be slow or unavailable.`);
        console.log(`   You can try running migration again later or via Supabase Dashboard.\n`);
        skippedCount++;
      } else {
        console.error(`❌ Migration failed for ${theme}:`, errorMessage);
        if (errorCode) {
          console.error(`   Error code: ${errorCode}`);
        }
        if (error.detail) {
          console.error(`   Detail: ${error.detail}`);
        }
        console.log('');
      }
    } finally {
      // Safely close pool
      if (pool) {
        try {
          await pool.end();
        } catch (closeError) {
          // Ignore close errors
        }
      }
    }
  }
  
  console.log('='.repeat(50));
  if (successCount > 0) {
    console.log(`✨ Migration Summary:`);
    console.log(`   ✅ Success: ${successCount} theme(s)`);
    if (skippedCount > 0) {
      console.log(`   ⚠️  Skipped: ${skippedCount} theme(s)`);
    }
    console.log('\n📝 Next steps:');
    console.log('   1. Verify tables were created: Check Supabase Dashboard > Table Editor');
    console.log('   2. Look for "reward_codes" table in public schema');
    console.log('   3. Test code claims: Try claiming a daily reward code');
    console.log('   4. Monitor performance: Check query execution times');
    if (skippedCount > 0) {
      console.log('\n💡 Tip: For skipped themes, you can:');
      console.log('   - Run migration again later when database is available');
      console.log('   - Or run migration manually via Supabase Dashboard > SQL Editor');
    }
  } else {
    console.log('❌ No migrations were successful.');
    console.log('   Please check your DATABASE_URL settings in .env file.');
  }
}

runMigration().catch(console.error);

