import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

// Connection pools for each theme (multiple projects)
const pools = {};

// Helper function to create pool config from connection string
function createPoolConfig(connectionString) {
  // Always use SSL for Supabase (cloud database)
  const useSSL = connectionString.includes('supabase') || connectionString.includes('pooler') || connectionString.includes('sslmode=require');
  
  return {
    connectionString: connectionString,
    ssl: useSSL ? {
      rejectUnauthorized: false // Accept self-signed certificates for Supabase
    } : false,
    // ✅ เพิ่ม max connections เพื่อรองรับ 1000 concurrent users
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 50, // เพิ่มจาก 20 เป็น 50
    min: parseInt(process.env.DB_MIN_CONNECTIONS) || 5, // เพิ่ม min connections
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    // ✅ เพิ่ม connection timeout เป็น 15 วินาที เพื่อรองรับ network ที่ช้าและ Supabase connection pooler
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 15000,
    // ✅ เพิ่ม statement timeout เพื่อป้องกัน query ที่ใช้เวลานานเกินไป
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000, // 30 seconds
    // ✅ เพิ่ม query timeout
    query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000, // 30 seconds
    // ✅ Keep connections alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // ✅ เพิ่ม allowExitOnIdle เพื่อให้ pool ปิด connections เมื่อ idle
    allowExitOnIdle: false,
  };
}

// Initialize connection pools for each theme
function initializePools() {
  // HENG36
  if (process.env.DATABASE_URL_HENG36) {
    pools.heng36 = new Pool(createPoolConfig(process.env.DATABASE_URL_HENG36));
    console.log('✅ HENG36 PostgreSQL pool initialized');
    
    // Track first connection only
    let heng36FirstConnect = true;
    pools.heng36.on('connect', () => {
      if (heng36FirstConnect) {
        console.log('✅ HENG36 PostgreSQL database connected');
        heng36FirstConnect = false;
      }
    });
    pools.heng36.on('error', (err) => {
      // Suppress frequent connection timeout errors
      if (!err.message.includes('timeout') && !err.message.includes('Connection terminated')) {
        console.error('❌ HENG36 database error:', err.message);
      }
    });
  }

  // MAX56
  if (process.env.DATABASE_URL_MAX56) {
    pools.max56 = new Pool(createPoolConfig(process.env.DATABASE_URL_MAX56));
    console.log('✅ MAX56 PostgreSQL pool initialized');
    
    // Track first connection only
    let max56FirstConnect = true;
    pools.max56.on('connect', () => {
      if (max56FirstConnect) {
        console.log('✅ MAX56 PostgreSQL database connected');
        max56FirstConnect = false;
      }
    });
    pools.max56.on('error', (err) => {
      // Suppress frequent connection timeout errors
      if (!err.message.includes('timeout') && !err.message.includes('Connection terminated')) {
        console.error('❌ MAX56 database error:', err.message);
      }
    });
  }

  // JEED24
  if (process.env.DATABASE_URL_JEED24) {
    pools.jeed24 = new Pool(createPoolConfig(process.env.DATABASE_URL_JEED24));
    console.log('✅ JEED24 PostgreSQL pool initialized');
    
    // Track first connection only
    let jeed24FirstConnect = true;
    pools.jeed24.on('connect', () => {
      if (jeed24FirstConnect) {
        console.log('✅ JEED24 PostgreSQL database connected');
        jeed24FirstConnect = false;
      }
    });
    pools.jeed24.on('error', (err) => {
      // Suppress frequent connection timeout errors
      if (!err.message.includes('timeout') && !err.message.includes('Connection terminated')) {
        console.error('❌ JEED24 database error:', err.message);
      }
    });
  }

  // Fallback: Single DATABASE_URL (for single project with schema separation)
  if (!pools.heng36 && process.env.DATABASE_URL) {
    const poolConfig = createPoolConfig(process.env.DATABASE_URL);
    pools.default = new Pool(poolConfig);
    console.log('✅ PostgreSQL pool initialized (default)');
    
    // Track first connection only
    let defaultFirstConnect = true;
    pools.default.on('connect', () => {
      if (defaultFirstConnect) {
        console.log('✅ PostgreSQL database connected (default)');
        defaultFirstConnect = false;
      }
    });
    pools.default.on('error', (err) => {
      // Suppress frequent connection timeout errors
      if (!err.message.includes('timeout') && !err.message.includes('Connection terminated')) {
        console.error('❌ Database error:', err.message);
      }
    });
  }
}

// Initialize pools
initializePools();

// Health check function to verify database connections
export async function checkDatabaseConnections() {
  const results = {};
  
  for (const [theme, pool] of Object.entries(pools)) {
    if (!pool) continue;
    
    try {
      // Simple connection test - just check if we can query
      const result = await pool.query('SELECT NOW() as current_time');
      results[theme] = { 
        status: 'ok', 
        schema: getSchema(theme),
        connected: true,
        timestamp: result.rows[0]?.current_time
      };
      console.log(`✅ Database health check passed for theme: ${theme} (schema: ${getSchema(theme)})`);
    } catch (error) {
      results[theme] = { 
        status: 'error', 
        schema: getSchema(theme),
        connected: false,
        error: error.message,
        code: error.code
      };
      console.error(`❌ Database health check failed for theme: ${theme} (schema: ${getSchema(theme)}):`, {
        message: error.message,
        code: error.code,
        detail: error.detail
      });
    }
  }
  
  return results;
}

// Helper function to get pool based on theme
export function getPool(theme) {
  // Validate theme
  if (!theme) {
    console.warn('getPool called without theme, defaulting to heng36');
    theme = 'heng36';
  }
  
  // If using multiple projects (separate connection strings)
  if (pools[theme]) {
    return pools[theme];
  }
  
  // Fallback to default pool (for single project with schema separation)
  const fallbackPool = pools.default || pools.heng36;
  if (!fallbackPool) {
    console.error(`No database pool available for theme: ${theme} and no fallback pool found`);
    console.error('Available pools:', Object.keys(pools));
  }
  return fallbackPool;
}

// Helper function to get schema name based on theme
// For multiple projects, schema is usually 'public'
// For single project with schema separation, use theme name as schema
export const getSchema = (theme) => {
  // If using multiple projects, each project uses 'public' schema
  if (pools[theme] && pools[theme] !== pools.default) {
    return 'public';
  }
  
  // If using single project with schema separation
  const schemas = {
    heng36: 'heng36',
    max56: 'max56',
    jeed24: 'jeed24'
  };
  return schemas[theme] || 'public';
};

// Default export: use heng36 pool or default pool
export default pools.heng36 || pools.default || pools.max56;

