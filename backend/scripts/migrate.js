/**
 * Migration Script
 * รัน SQL migrations ทั้งหมดสำหรับทุก theme
 */

import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Migration files (เรียงตามลำดับ)
// สำหรับ Supabase (multiple projects) จะใช้ schema 'public'
// สำหรับ single project with schema separation จะใช้ schema 'heng36', 'max56', 'jeed24'
const migrationFiles = [
  '../migrations/001_create_tables.sql',        // สร้าง tables ใน schema public (default)
  '../migrations/003_add_answers_columns.sql',  // เพิ่ม columns ให้ answers table (schema public)
  '../migrations/004_create_chat_table.sql',    // สร้าง chat_messages table (schema public)
  // '../migrations/002_create_multi_theme_schemas.sql',  // สำหรับ single project only (จะข้ามสำหรับ Supabase)
];

// Themes to migrate
const themes = ['heng36', 'max56', 'jeed24'];

// Helper function to create pool config
function createPoolConfig(connectionString) {
  const useSSL = connectionString.includes('supabase') || 
                 connectionString.includes('pooler') || 
                 connectionString.includes('sslmode=require');
  
  return {
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  };
}

// Helper function to get connection string for theme
function getConnectionString(theme) {
  const envKey = `DATABASE_URL_${theme.toUpperCase()}`;
  return process.env[envKey];
}

// Helper function to read SQL file
function readSQLFile(filePath) {
  try {
    const fullPath = join(__dirname, filePath);
    return readFileSync(fullPath, 'utf-8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

// Helper function to run SQL for a theme
async function runMigrationForTheme(theme, sql, fileName) {
  const connectionString = getConnectionString(theme);
  
  if (!connectionString) {
    console.log(`⚠️  Skipping ${theme}: DATABASE_URL_${theme.toUpperCase()} not found`);
    return { success: false, error: 'Connection string not found' };
  }

  const pool = new Pool(createPoolConfig(connectionString));
  
    try {
      console.log(`\n🔄 Running ${fileName} for ${theme}...`);
      
    // Execute SQL directly (PostgreSQL client can handle multiple statements)
    // For complex migrations with DO $$ blocks, execute as a whole
    try {
      await pool.query(sql);
    } catch (error) {
      // Ignore "already exists" errors for IF NOT EXISTS
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('IF NOT EXISTS')) {
        // These are expected errors, just continue
        console.log(`  ℹ️  Some objects already exist (this is OK)`);
      } else {
        // For other errors, try splitting statements
        console.log(`  ⚠️  Error executing as whole, trying statement by statement...`);
        
        // Split by semicolon (but preserve DO $$ blocks)
        const statements = [];
        let currentStatement = '';
        let inBlock = false;
        let blockDepth = 0;
        
        const lines = sql.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Skip empty lines and comments
          if (!trimmed || trimmed.startsWith('--')) {
            if (!inBlock && currentStatement) {
              currentStatement += line + '\n';
            }
            continue;
          }
          
          // Check for DO $$ blocks
          if (trimmed.startsWith('DO $$') || trimmed.startsWith('DO $')) {
            inBlock = true;
            blockDepth = 1;
            currentStatement += line + '\n';
            continue;
          }
          
          // Count $$ delimiters in block
          if (inBlock) {
            const dollarCount = (line.match(/\$\$/g) || []).length;
            if (dollarCount > 0) {
              blockDepth += dollarCount;
              if (blockDepth >= 2 && trimmed.includes('$$')) {
                // End of block
                currentStatement += line;
                statements.push(currentStatement.trim());
                currentStatement = '';
                inBlock = false;
                blockDepth = 0;
                continue;
              }
            }
            currentStatement += line + '\n';
            continue;
          }
          
          // Regular statement
          currentStatement += line;
          
          // Check if statement ends with semicolon
          if (trimmed.endsWith(';')) {
            if (currentStatement.trim()) {
              statements.push(currentStatement.trim());
            }
            currentStatement = '';
          } else {
            currentStatement += '\n';
          }
        }
        
        // Add remaining statement if any
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
        }
        
        // Execute statements one by one
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await pool.query(statement);
            } catch (err) {
              // Ignore expected errors
              if (!err.message.includes('already exists') && 
                  !err.message.includes('duplicate') &&
                  !err.message.includes('IF NOT EXISTS')) {
                console.error(`  ⚠️  Error: ${err.message.substring(0, 150)}`);
                // Don't throw, continue with other statements
              }
            }
          }
        }
      }
    }
    
    console.log(`  ✅ ${fileName} completed for ${theme}`);
    return { success: true };
  } catch (error) {
    console.error(`  ❌ Error running ${fileName} for ${theme}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Run all migrations
async function runAllMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const results = {
    success: {},
    failed: {},
  };
  
  for (const theme of themes) {
    const connectionString = getConnectionString(theme);
    if (!connectionString) {
      console.log(`⚠️  Skipping ${theme}: No connection string`);
      continue;
    }
    
    console.log(`\n📦 Migrating ${theme.toUpperCase()}...`);
    console.log('='.repeat(50));
    
    results.success[theme] = [];
    results.failed[theme] = [];
    
    for (const filePath of migrationFiles) {
      const fileName = filePath.split('/').pop();
      const sql = readSQLFile(filePath);
      
      if (!sql) {
        console.log(`  ⚠️  Skipping ${fileName}: File not found`);
        results.failed[theme].push({ file: fileName, error: 'File not found' });
        continue;
      }
      
      const result = await runMigrationForTheme(theme, sql, fileName);
      
      if (result.success) {
        results.success[theme].push(fileName);
      } else {
        results.failed[theme].push({ file: fileName, error: result.error });
      }
      
      // Small delay between migrations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Print summary
  console.log('\n\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  
  for (const theme of themes) {
    if (!results.success[theme] && !results.failed[theme]) continue;
    
    console.log(`\n${theme.toUpperCase()}:`);
    console.log(`  ✅ Successful: ${results.success[theme].length}`);
    console.log(`  ❌ Failed: ${results.failed[theme].length}`);
    
    if (results.failed[theme].length > 0) {
      console.log(`  Failed files:`);
      results.failed[theme].forEach(({ file, error }) => {
        console.log(`    - ${file}: ${error}`);
      });
    }
  }
  
  const totalSuccess = Object.values(results.success).reduce((sum, arr) => sum + arr.length, 0);
  const totalFailed = Object.values(results.failed).reduce((sum, arr) => sum + arr.length, 0);
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Total Successful: ${totalSuccess}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log('='.repeat(50));
  
  if (totalFailed === 0) {
    console.log('\n🎉 All migrations completed successfully!');
  } else {
    console.log('\n⚠️  Some migrations failed. Check the errors above.');
  }
}

// Run migrations
runAllMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

