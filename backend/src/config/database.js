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

// Helper function to get pool based on theme
export function getPool(theme) {
  // If using multiple projects (separate connection strings)
  if (pools[theme]) {
    return pools[theme];
  }
  
  // Fallback to default pool (for single project with schema separation)
  return pools.default || pools.heng36;
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

