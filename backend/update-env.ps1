# PowerShell Script to Update .env file with Optimization Variables
# Usage: .\update-env.ps1

$envFile = ".\backend\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ File .env not found at: $envFile"
    Write-Host "Please create .env file first using create-env-with-supabase.bat"
    exit 1
}

Write-Host "📝 Updating .env file with optimization variables..."
Write-Host ""

# Read current .env file
$content = Get-Content $envFile -Raw

# Variables to add (if not exist)
$newVars = @"
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
"@

# Check if Redis config already exists
if ($content -match "REDIS_ENABLED") {
    Write-Host "⚠️  Redis configuration already exists, skipping..."
} else {
    Write-Host "✅ Adding Redis configuration..."
    $content += "`n$newVars"
}

# Fix database URLs to include ?sslmode=require if missing
$content = $content -replace '(DATABASE_URL_\w+)=([^?]+)(?!\?sslmode=require)', '$1=$2?sslmode=require'

# Update database pool settings
$content = $content -replace 'DB_MAX_CONNECTIONS=20', 'DB_MAX_CONNECTIONS=50'
$content = $content -replace 'DB_CONNECTION_TIMEOUT=2000', 'DB_CONNECTION_TIMEOUT=10000'

# Add missing pool settings if not exist
if ($content -notmatch "DB_MIN_CONNECTIONS") {
    $content += "`nDB_MIN_CONNECTIONS=5"
}
if ($content -notmatch "DB_STATEMENT_TIMEOUT") {
    $content += "`nDB_STATEMENT_TIMEOUT=30000"
}
if ($content -notmatch "DB_QUERY_TIMEOUT") {
    $content += "`nDB_QUERY_TIMEOUT=30000"
}

# Add Frontend URL if not exist
if ($content -notmatch "FRONTEND_URL") {
    $content += "`nFRONTEND_URL=http://localhost:5173,http://localhost:5174,http://localhost:5175"
}

# Write updated content
$content | Set-Content $envFile -Encoding UTF8

Write-Host ""
Write-Host "✅ .env file updated successfully!"
Write-Host ""
Write-Host "📋 Next steps:"
Write-Host "   1. Review backend\.env file"
Write-Host "   2. Update DATABASE_URL_JEED24 password if needed"
Write-Host "   3. Set REDIS_ENABLED=false if you don't have Redis"
Write-Host "   4. Test connection: node scripts/test-connection.js"
Write-Host "   5. Start backend: npm start"
Write-Host ""

