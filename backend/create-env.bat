@echo off
REM Create backend/.env file from template

echo 🔧 Creating backend/.env file...

if exist .env (
    echo ⚠️  .env file already exists!
    echo Do you want to overwrite it? (Y/N)
    set /p overwrite=
    if /i not "%overwrite%"=="Y" (
        echo ❌ Cancelled. .env file not created.
        exit /b 1
    )
)

echo.
echo Creating .env file with database connections...

(
echo # Backend Environment Variables
echo # PostgreSQL Database Connections
echo.
echo # HENG36 Database
echo DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
echo.
echo # MAX56 Database
echo DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
echo.
echo # Server Configuration
echo PORT=3000
echo.
echo # Optional: Database Pool Configuration
echo DB_MAX_CONNECTIONS=20
echo DB_IDLE_TIMEOUT=30000
echo DB_CONNECTION_TIMEOUT=2000
) > .env

echo.
echo ✅ .env file created successfully!
echo.
echo 📋 Next steps:
echo    1. Review .env file
echo    2. Run: npm run dev
echo.

