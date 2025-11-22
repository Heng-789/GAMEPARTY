/**
 * Drop Legacy Table HENG36
 * ลบ legacy table HENG36 (ถ้าไม่มีข้อมูลสำคัญ)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function dropLegacyTable() {
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

    if (existsResult.rows.length === 0) {
      console.log('✅ Legacy table HENG36 does not exist');
      await pool.end();
      return;
    }

    // Check row count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM "HENG36"');
    const rowCount = parseInt(countResult.rows[0].count);

    if (rowCount > 0) {
      console.log(`⚠️  Legacy table HENG36 has ${rowCount} rows`);
      console.log('   Skipping deletion to preserve data');
      console.log('   If you want to delete it, please backup data first');
      await pool.end();
      return;
    }

    // Drop the table
    console.log('🗑️  Dropping legacy table HENG36...');
    await pool.query('DROP TABLE IF EXISTS "HENG36"');
    console.log('✅ Legacy table HENG36 dropped successfully');

    // Verify
    const verifyResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'HENG36'
    `);

    if (verifyResult.rows.length === 0) {
      console.log('✅ Verification: Legacy table HENG36 no longer exists');
    } else {
      console.log('⚠️  Verification failed: Table still exists');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

dropLegacyTable();

