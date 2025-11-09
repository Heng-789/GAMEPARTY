@echo off
echo 🚀 Setting up Development Environment...

echo.
echo 📁 Creating environment files...
if not exist "env.heng36" (
    echo VITE_THEME=heng36 > env.heng36
    echo VITE_DOMAIN=heng36.party >> env.heng36
    echo VITE_PORT=5173 >> env.heng36
    echo ✅ Created env.heng36
) else (
    echo ⚠️ env.heng36 already exists
)

if not exist "env.max56" (
    echo VITE_THEME=max56 > env.max56
    echo VITE_DOMAIN=max56.party >> env.max56
    echo VITE_PORT=5174 >> env.max56
    echo ✅ Created env.max56
) else (
    echo ⚠️ env.max56 already exists
)

if not exist "env.jeed24" (
    echo VITE_THEME=jeed24 > env.jeed24
    echo VITE_DOMAIN=jeed24.party >> env.jeed24
    echo VITE_PORT=5175 >> env.jeed24
    echo ✅ Created env.jeed24
) else (
    echo ⚠️ env.jeed24 already exists
)

echo.
echo 🌐 Setting up hosts file...
echo.
echo 📝 Please add these lines to your hosts file:
echo    C:\Windows\System32\drivers\etc\hosts
echo.
echo 127.0.0.1 heng36.party
echo 127.0.0.1 max56.party
echo 127.0.0.1 jeed24.party
echo.
echo ⚠️ You need administrator privileges to edit hosts file
echo.

echo 🎯 Development Commands:
echo.
echo HENG36 Theme:
echo   npm run dev:heng
echo   http://localhost:5173
echo   http://heng36.party:5173 (with hosts file)
echo.
echo MAX56 Theme:
echo   npm run dev:max
echo   http://localhost:5174
echo   http://max56.party:5174 (with hosts file)
echo.
echo JEED24 Theme:
echo   npm run dev:jeed
echo   http://localhost:5175
echo   http://jeed24.party:5175 (with hosts file)
echo.

echo 🚀 Ready to develop!
pause
