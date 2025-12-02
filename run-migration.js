/**
 * Run Migration Script for Reward Codes Table
 * Usage: node run-migration.js
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

async function runMigration() {
  const themes = ['heng36', 'max56', 'jeed24'];
  const migrationFile = join(__dirname, 'migrations', '006_create_reward_codes_table.sql');
  
  console.log('🚀 Starting migration...\n');
  
  for (const theme of themes) {
    const dbUrl = process.env[`DATABASE_URL_${theme.toUpperCase()}`] || 
                  (theme === 'heng36' ? process.env.DATABASE_URL : null);
    
    if (!dbUrl) {
      console.log(`⚠️  Skipping ${theme} - no DATABASE_URL found`);
      continue;
    }
    
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: dbUrl.includes('supabase') || dbUrl.includes('pooler') || dbUrl.includes('sslmode=require') 
        ? { rejectUnauthorized: false } 
        : false
    });
    
    try {
      console.log(`🔄 Running migration for ${theme}...`);
      const sql = readFileSync(migrationFile, 'utf8');
      await pool.query(sql);
      console.log(`✅ Migration completed for ${theme}\n`);
    } catch (error) {
      console.error(`❌ Migration failed for ${theme}:`, error.message);
      if (error.code) {
        console.error(`   Error code: ${error.code}`);
      }
      console.error('');
    } finally {
      await pool.end();
    }
  }
  
  console.log('✨ Migration process completed!');
}

runMigration().catch(console.error);

