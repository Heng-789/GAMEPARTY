#!/bin/bash
# Bash Script to Update .env file with Optimization Variables
# Usage: ./update-env.sh

ENV_FILE="./backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ File .env not found at: $ENV_FILE"
    echo "Please create .env file first"
    exit 1
fi

echo "📝 Updating .env file with optimization variables..."
echo ""

# Check if Redis config already exists
if grep -q "REDIS_ENABLED" "$ENV_FILE"; then
    echo "⚠️  Redis configuration already exists, skipping..."
else
    echo "✅ Adding optimization variables..."
    
    cat >> "$ENV_FILE" << 'EOF'

# ============================================
# Redis Configuration (for caching and queues)
# ============================================
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ============================================
# Snapshot Worker Configuration
# ============================================
SNAPSHOT_INTERVAL=30000

# ============================================
# Request Logging & Monitoring
# ============================================
LOG_THRESHOLD=1024
SLOW_QUERY_THRESHOLD=500
ENABLE_DETAILED_LOGGING=false

# ============================================
# Compression Configuration
# ============================================
ENABLE_COMPRESSION=true
COMPRESSION_THRESHOLD=1024
COMPRESSION_LEVEL=6

# ============================================
# Rate Limiting Configuration
# ============================================
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_GAMES_LIST=60
RATE_LIMIT_GAME_DETAIL=60
RATE_LIMIT_ANSWERS=30
RATE_LIMIT_CHECKINS=20
RATE_LIMIT_USERS_TOP=30
RATE_LIMIT_USERS_SEARCH=20
RATE_LIMIT_USER_DETAIL=20
RATE_LIMIT_BINGO=30

# ============================================
# Cache Duration (in seconds)
# ============================================
CACHE_DURATION_STATIC=3600
CACHE_DURATION_DYNAMIC=300
CACHE_DURATION_USER=600

# ============================================
# Bandwidth Monitoring
# ============================================
ENABLE_BANDWIDTH_MONITORING=true
BANDWIDTH_LOG_THRESHOLD=10240
EOF
fi

# Fix database URLs to include ?sslmode=require if missing
sed -i.bak 's/\(DATABASE_URL_[^=]*\)=\([^?]*\)$/\1=\2?sslmode=require/g' "$ENV_FILE" 2>/dev/null || \
sed -i '' 's/\(DATABASE_URL_[^=]*\)=\([^?]*\)$/\1=\2?sslmode=require/g' "$ENV_FILE" 2>/dev/null

# Update database pool settings
sed -i.bak 's/DB_MAX_CONNECTIONS=20/DB_MAX_CONNECTIONS=50/g' "$ENV_FILE" 2>/dev/null || \
sed -i '' 's/DB_MAX_CONNECTIONS=20/DB_MAX_CONNECTIONS=50/g' "$ENV_FILE" 2>/dev/null

sed -i.bak 's/DB_CONNECTION_TIMEOUT=2000/DB_CONNECTION_TIMEOUT=10000/g' "$ENV_FILE" 2>/dev/null || \
sed -i '' 's/DB_CONNECTION_TIMEOUT=2000/DB_CONNECTION_TIMEOUT=10000/g' "$ENV_FILE" 2>/dev/null

# Add missing pool settings if not exist
if ! grep -q "DB_MIN_CONNECTIONS" "$ENV_FILE"; then
    echo "DB_MIN_CONNECTIONS=5" >> "$ENV_FILE"
fi
if ! grep -q "DB_STATEMENT_TIMEOUT" "$ENV_FILE"; then
    echo "DB_STATEMENT_TIMEOUT=30000" >> "$ENV_FILE"
fi
if ! grep -q "DB_QUERY_TIMEOUT" "$ENV_FILE"; then
    echo "DB_QUERY_TIMEOUT=30000" >> "$ENV_FILE"
fi

# Add Frontend URL if not exist
if ! grep -q "FRONTEND_URL" "$ENV_FILE"; then
    echo "FRONTEND_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175" >> "$ENV_FILE"
fi

# Clean up backup files
rm -f "$ENV_FILE.bak" 2>/dev/null

echo ""
echo "✅ .env file updated successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Review backend/.env file"
echo "   2. Update DATABASE_URL_JEED24 password if needed"
echo "   3. Set REDIS_ENABLED=false if you don't have Redis"
echo "   4. Test connection: node scripts/test-connection.js"
echo "   5. Start backend: npm start"
echo ""

