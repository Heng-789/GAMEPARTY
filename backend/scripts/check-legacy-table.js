/**
 * Check Legacy Table HENG36
 * ตรวจสอบ legacy table HENG36
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function checkLegacyTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_HENG36,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Check if legacy table exists
    const existsResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'HENG36'
    `);

    if (existsResult.rows.length > 0) {
      console.log('⚠️  Legacy table HENG36 exists');
      
      // Check row count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM "HENG36"');
      console.log(`   Rows in legacy table: ${countResult.rows[0].count}`);
      
      // Check structure
      const structureResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'HENG36'
        ORDER BY ordinal_position
      `);
      
      console.log('   Columns:');
      structureResult.rows.forEach(row => {
        console.log(`     - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('✅ Legacy table HENG36 does not exist');
    }

    // Check PostgreSQL tables
    const pgTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name NOT IN ('HENG36')
      ORDER BY table_name
    `);

    console.log(`\n✅ PostgreSQL tables (${pgTablesResult.rows.length}):`);
    pgTablesResult.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLegacyTable();

