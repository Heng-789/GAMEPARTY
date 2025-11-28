# PowerShell script to start backend server
# Usage: .\start-server.ps1

Write-Host "🚀 Starting HENG36GAME Backend Server..." -ForegroundColor Green
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Please run this script from the backend directory." -ForegroundColor Red
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  .env file not found. Please create it first." -ForegroundColor Yellow
    Write-Host "   See UPSTASH_SETUP.md for instructions." -ForegroundColor Yellow
    Write-Host ""
}

# Check if @upstash/redis is installed
if (-not (Test-Path "node_modules/@upstash/redis")) {
    Write-Host "⚠️  @upstash/redis not installed. Installing..." -ForegroundColor Yellow
    npm install @upstash/redis
    Write-Host ""
}

Write-Host "✅ Starting server..." -ForegroundColor Green
Write-Host "   Server will run on http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Press Ctrl+C to stop" -ForegroundColor Cyan
Write-Host ""

# Start the server
npm start

