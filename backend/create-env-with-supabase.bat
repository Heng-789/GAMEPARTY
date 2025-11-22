@echo off
echo ============================================
echo Creating backend/.env file with Supabase credentials
echo ============================================
echo.

if exist "backend\.env" (
    echo ⚠️  File backend\.env already exists
    echo.
    echo Do you want to overwrite it? (Y/N)
    set /p overwrite=
    if /i not "%overwrite%"=="Y" (
        echo Cancelled.
        exit /b
    )
)

echo Creating backend\.env file...
(
echo # Backend Environment Variables
echo # PostgreSQL Database Connections
echo.
echo # HENG36 Database
echo DATABASE_URL_HENG36=postgresql://postgres.ipflzfxezdzbmoqglknu:2gg0nj4k9N59aOly@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
echo.
echo # MAX56 Database
echo DATABASE_URL_MAX56=postgresql://postgres.aunfaslgmxxdeemvtexn:MlmH1jKzFwEpqks8@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
echo.
echo # JEED24 Database
echo DATABASE_URL_JEED24=postgresql://postgres.pyrtleftkrjxvwlbvfma:YOUR_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
echo.
echo # Server Configuration
echo PORT=3000
echo.
echo # Optional: Database Pool Configuration
echo DB_MAX_CONNECTIONS=20
echo DB_IDLE_TIMEOUT=30000
echo DB_CONNECTION_TIMEOUT=2000
echo.
echo # ============================================
echo # Supabase Storage Configuration
echo # ============================================
echo.
echo # HENG36 Supabase Storage
echo SUPABASE_URL_HENG36=https://ipflzfxezdzbmoqglknu.supabase.co
echo SUPABASE_ANON_KEY_HENG36=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
echo VITE_STORAGE_BUCKET_HENG36=game-images
echo.
echo # MAX56 Supabase Storage
echo SUPABASE_URL_MAX56=https://aunfaslgmxxdeemvtexn.supabase.co
echo SUPABASE_ANON_KEY_MAX56=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1bmZhc2xnbXh4ZGVlbXZ0ZXhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mzg2NjEsImV4cCI6MjA3OTIxNDY2MX0.nDXRfJHkF84hsI748apMFMpiWTNsQ4b9Uq3Kr_9-LXk
echo VITE_STORAGE_BUCKET_MAX56=game-images
echo.
echo # JEED24 Supabase Storage
echo SUPABASE_URL_JEED24=https://pyrtleftkrjxvwlbvfma.supabase.co
echo SUPABASE_ANON_KEY_JEED24=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cnRsZWZ0a3JqeHZ3bGJ2Zm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDc1NDIsImV4cCI6MjA3OTIyMzU0Mn0.bCJyNlHw7nWue_jQGs7_4sgpbLDTcR8YARA3kr790Js
echo VITE_STORAGE_BUCKET_JEED24=game-images
echo.
echo # Fallback (if theme-specific keys are not found)
echo SUPABASE_URL=https://ipflzfxezdzbmoqglknu.supabase.co
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwZmx6ZnhlemR6Ym1vcWdsa251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTAyMTgsImV4cCI6MjA3OTE4NjIxOH0.Jvq2bDs9GMZbw77KtoesdtwF9AWFhdPiu7RMU0wh-pQ
echo VITE_STORAGE_BUCKET=game-images
) > backend\.env

if exist "backend\.env" (
    echo.
    echo ✅ File backend\.env created successfully!
    echo.
    echo 📝 Next steps:
    echo    1. Edit backend\.env and update DATABASE_URL_JEED24 password if needed
    echo    2. Restart backend server: cd backend ^&^& npm run dev
    echo.
) else (
    echo.
    echo ❌ Failed to create backend\.env file
    echo    Please create it manually using the template in CREATE-ENV-FOR-IMAGE-DELETION.md
    echo.
)

pause

