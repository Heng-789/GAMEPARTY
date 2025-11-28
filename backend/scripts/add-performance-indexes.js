/**
 * Add Performance Indexes Migration Script
 * 
 * This script adds performance indexes to all database schemas/themes.
 * Works with Supabase (cloud) and local PostgreSQL.
 * 
 * Usage:
 *   node scripts/add-performance-indexes.js
 * 
 * Or for specific theme:
 *   node scripts/add-performance-indexes.js heng36
 */

import { getPool, getSchema } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

// Index definitions (will be applied to each schema)
const INDEXES = [
  // Answers table indexes
  { table: 'answers', name: 'idx_answers_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_answers_game_id ON {schema}.answers(game_id)' },
  { table: 'answers', name: 'idx_answers_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_answers_user_id ON {schema}.answers(user_id)' },
  { table: 'answers', name: 'idx_answers_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_answers_created_at ON {schema}.answers(created_at DESC)' },
  { table: 'answers', name: 'idx_answers_game_user', sql: 'CREATE INDEX IF NOT EXISTS idx_answers_game_user ON {schema}.answers(game_id, user_id)' },
  { table: 'answers', name: 'idx_answers_game_created', sql: 'CREATE INDEX IF NOT EXISTS idx_answers_game_created ON {schema}.answers(game_id, created_at DESC)' },
  
  // Checkins table indexes
  { table: 'checkins', name: 'idx_checkins_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_checkins_game_id ON {schema}.checkins(game_id)' },
  { table: 'checkins', name: 'idx_checkins_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON {schema}.checkins(user_id)' },
  { table: 'checkins', name: 'idx_checkins_game_user', sql: 'CREATE INDEX IF NOT EXISTS idx_checkins_game_user ON {schema}.checkins(game_id, user_id)' },
  { table: 'checkins', name: 'idx_checkins_day_index', sql: 'CREATE INDEX IF NOT EXISTS idx_checkins_day_index ON {schema}.checkins(day_index)' },
  { table: 'checkins', name: 'idx_checkins_checkin_date', sql: 'CREATE INDEX IF NOT EXISTS idx_checkins_checkin_date ON {schema}.checkins(checkin_date)' },
  { table: 'checkins', name: 'idx_checkins_game_user_day', sql: 'CREATE INDEX IF NOT EXISTS idx_checkins_game_user_day ON {schema}.checkins(game_id, user_id, day_index)' },
  
  // Users table indexes
  { table: 'users', name: 'idx_users_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_users_user_id ON {schema}.users(user_id)' },
  { table: 'users', name: 'idx_users_hcoin', sql: 'CREATE INDEX IF NOT EXISTS idx_users_hcoin ON {schema}.users(hcoin DESC)' },
  { table: 'users', name: 'idx_users_status', sql: 'CREATE INDEX IF NOT EXISTS idx_users_status ON {schema}.users(status)' },
  { table: 'users', name: 'idx_users_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_users_created_at ON {schema}.users(created_at DESC)' },
  
  // Games table indexes
  { table: 'games', name: 'idx_games_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_games_game_id ON {schema}.games(game_id)' },
  { table: 'games', name: 'idx_games_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_games_created_at ON {schema}.games(created_at DESC)' },
  { table: 'games', name: 'idx_games_type', sql: 'CREATE INDEX IF NOT EXISTS idx_games_type ON {schema}.games(type)' },
  { table: 'games', name: 'idx_games_unlocked', sql: 'CREATE INDEX IF NOT EXISTS idx_games_unlocked ON {schema}.games(unlocked)' },
  
  // Bingo indexes
  { table: 'bingo_cards', name: 'idx_bingo_cards_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_bingo_cards_game_id ON {schema}.bingo_cards(game_id)' },
  { table: 'bingo_players', name: 'idx_bingo_players_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_bingo_players_game_id ON {schema}.bingo_players(game_id)' },
  { table: 'bingo_players', name: 'idx_bingo_players_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_bingo_players_user_id ON {schema}.bingo_players(user_id)' },
  { table: 'bingo_game_state', name: 'idx_bingo_game_state_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_bingo_game_state_game_id ON {schema}.bingo_game_state(game_id)' },
  
  // Chat indexes
  { table: 'chat', name: 'idx_chat_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_chat_game_id ON {schema}.chat(game_id)' },
  { table: 'chat', name: 'idx_chat_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_chat_created_at ON {schema}.chat(created_at DESC)' },
  
  // Presence indexes
  { table: 'presence', name: 'idx_presence_game_id', sql: 'CREATE INDEX IF NOT EXISTS idx_presence_game_id ON {schema}.presence(game_id)' },
  { table: 'presence', name: 'idx_presence_user_id', sql: 'CREATE INDEX IF NOT EXISTS idx_presence_user_id ON {schema}.presence(user_id)' },
  { table: 'presence', name: 'idx_presence_game_user', sql: 'CREATE INDEX IF NOT EXISTS idx_presence_game_user ON {schema}.presence(game_id, user_id)' },
];

// Tables to analyze
const TABLES_TO_ANALYZE = [
  'answers',
  'checkins',
  'users',
  'games',
  'bingo_cards',
  'bingo_players',
  'bingo_game_state',
  'chat',
  'presence',
];

/**
 * Apply indexes to a specific theme/schema
 */
async function applyIndexes(theme) {
  const pool = getPool(theme);
  const schema = getSchema(theme);
  
  if (!pool) {
    console.error(`❌ No database pool found for theme: ${theme}`);
    return { success: false, theme, error: 'No pool' };
  }
  
  console.log(`\n📊 Applying indexes to theme: ${theme} (schema: ${schema})`);
  console.log('─'.repeat(60));
  
  const results = {
    theme,
    schema,
    success: true,
    created: [],
    errors: [],
  };
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log(`✅ Connected to ${theme} database`);
    
    // Apply each index
    for (const index of INDEXES) {
      try {
        const sql = index.sql.replace(/{schema}/g, schema);
        const startTime = Date.now();
        
        await pool.query(sql);
        
        const duration = Date.now() - startTime;
        console.log(`  ✅ ${index.name} (${duration}ms)`);
        results.created.push(index.name);
      } catch (error) {
        // Check if index already exists or table doesn't exist
        if (error.message.includes('already exists') || error.code === '42P07') {
          console.log(`  ⚠️  ${index.name} (already exists)`);
          results.created.push(index.name);
        } else if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log(`  ⚠️  ${index.name} (table ${index.table} does not exist - skipping)`);
        } else {
          console.error(`  ❌ ${index.name}:`, error.message);
          results.errors.push({ index: index.name, error: error.message });
          results.success = false;
        }
      }
    }
    
    // Analyze tables
    console.log(`\n📈 Analyzing tables...`);
    for (const table of TABLES_TO_ANALYZE) {
      try {
        const sql = `ANALYZE ${schema}.${table}`;
        await pool.query(sql);
        console.log(`  ✅ Analyzed ${table}`);
      } catch (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          console.log(`  ⚠️  Table ${table} does not exist - skipping`);
        } else {
          console.error(`  ❌ Error analyzing ${table}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Completed for ${theme}: ${results.created.length} indexes created`);
    if (results.errors.length > 0) {
      console.log(`⚠️  ${results.errors.length} errors occurred`);
    }
    
  } catch (error) {
    console.error(`❌ Error applying indexes to ${theme}:`, error.message);
    results.success = false;
    results.error = error.message;
  }
  
  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Performance Indexes Migration');
  console.log('='.repeat(60));
  
  // Get theme from command line argument or apply to all
  const targetTheme = process.argv[2];
  const themes = targetTheme ? [targetTheme] : ['heng36', 'max56', 'jeed24'];
  
  const allResults = [];
  
  for (const theme of themes) {
    const result = await applyIndexes(theme);
    allResults.push(result);
    
    // Small delay between themes
    if (themes.indexOf(theme) < themes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  
  const successful = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;
  
  allResults.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.theme} (schema: ${result.schema}): ${result.created.length} indexes`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
    }
  });
  
  console.log(`\n✅ Successful: ${successful}/${allResults.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${allResults.length}`);
    process.exit(1);
  } else {
    console.log('\n🎉 All migrations completed successfully!');
    process.exit(0);
  }
}

// Run migration
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

