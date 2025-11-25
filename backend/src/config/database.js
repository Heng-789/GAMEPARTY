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
    max: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
  };
}

// Initialize connection pools for each theme
function initializePools() {
  // HENG36
  if (process.env.DATABASE_URL_HENG36) {
    pools.heng36 = new Pool(createPoolConfig(process.env.DATABASE_URL_HENG36));
    pools.heng36.on('connect', () => {
      console.log('✅ Connected to HENG36 PostgreSQL database');
    });
    pools.heng36.on('error', (err) => {
      console.error('❌ HENG36 database error:', err);
    });
  }

  // MAX56
  if (process.env.DATABASE_URL_MAX56) {
    pools.max56 = new Pool(createPoolConfig(process.env.DATABASE_URL_MAX56));
    pools.max56.on('connect', () => {
      console.log('✅ Connected to MAX56 PostgreSQL database');
    });
    pools.max56.on('error', (err) => {
      console.error('❌ MAX56 database error:', err);
    });
  }

  // JEED24
  if (process.env.DATABASE_URL_JEED24) {
    pools.jeed24 = new Pool(createPoolConfig(process.env.DATABASE_URL_JEED24));
    pools.jeed24.on('connect', () => {
      console.log('✅ Connected to JEED24 PostgreSQL database');
    });
    pools.jeed24.on('error', (err) => {
      console.error('❌ JEED24 database error:', err);
    });
  }

  // Fallback: Single DATABASE_URL (for single project with schema separation)
  if (!pools.heng36 && process.env.DATABASE_URL) {
    const poolConfig = createPoolConfig(process.env.DATABASE_URL);
    pools.default = new Pool(poolConfig);
    pools.default.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database (default)');
    });
    pools.default.on('error', (err) => {
      console.error('❌ Database error:', err);
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

