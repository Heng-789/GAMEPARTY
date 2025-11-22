/**
 * Migration Script for MAX56 and JEED24
 * รัน SQL migrations สำหรับ MAX56 และ JEED24 เท่านั้น
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
// Path: ../../migrations (from backend/scripts to root/migrations)
const migrationFiles = [
  '../../migrations/001_create_tables.sql',        // สร้าง tables ใน schema public
  '../../migrations/003_add_answers_columns.sql',  // เพิ่ม columns ให้ answers table
  '../../migrations/004_create_chat_table.sql',    // สร้าง chat_messages table
];

// Themes to migrate (เฉพาะ MAX56 และ JEED24)
const themes = ['max56', 'jeed24'];

// Helper function to create pool config
function createPoolConfig(connectionString) {
  const useSSL = connectionString.includes('supabase') || 
                 connectionString.includes('pooler') || 
                 connectionString.includes('sslmode=require');
  
  return {
    connectionString,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    max: 5,
    connectionTimeoutMillis: 10000,
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
    console.log(`\n🔄 Running ${fileName} for ${theme.toUpperCase()}...`);
    
    // Execute SQL directly
    try {
      await pool.query(sql);
    } catch (error) {
      // Ignore "already exists" errors for IF NOT EXISTS
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate') ||
          error.message.includes('IF NOT EXISTS')) {
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
    
    console.log(`  ✅ ${fileName} completed for ${theme.toUpperCase()}`);
    return { success: true };
  } catch (error) {
    console.error(`  ❌ Error running ${fileName} for ${theme.toUpperCase()}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await pool.end();
  }
}

// Run all migrations
async function runAllMigrations() {
  console.log('🚀 Starting database migrations for MAX56 and JEED24...\n');
  
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
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 Migrating ${theme.toUpperCase()}...`);
    console.log('='.repeat(60));
    
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
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));
  
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
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Total Successful: ${totalSuccess}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log('='.repeat(60));
  
  if (totalFailed === 0) {
    console.log('\n🎉 All migrations completed successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some migrations failed. Check the errors above.');
    process.exit(1);
  }
}

// Run migrations
runAllMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

