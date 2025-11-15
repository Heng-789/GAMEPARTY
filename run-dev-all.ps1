# Run all 3 dev servers in separate PowerShell windows
# Usage: .\run-dev-all.ps1

$projectPath = $PSScriptRoot
if (-not $projectPath) {
    $projectPath = Get-Location
}

Write-Host "Starting all 3 dev servers..." -ForegroundColor Green
Write-Host ""

# Start heng36 dev server
Write-Host "Starting HENG36 dev server on port 5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectPath'; npm run dev:heng36"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# Start max56 dev server
Write-Host "Starting MAX56 dev server on port 5174..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectPath'; npm run dev:max56"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# Start jeed24 dev server
Write-Host "Starting JEED24 dev server on port 5175..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$projectPath'; npm run dev:jeed24"
) -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "All dev servers started!" -ForegroundColor Green
Write-Host ""
Write-Host "Dev Server URLs:" -ForegroundColor Yellow
Write-Host "   - HENG36: http://localhost:5173" -ForegroundColor White
Write-Host "   - MAX56:  http://localhost:5174" -ForegroundColor White
Write-Host "   - JEED24: http://localhost:5175" -ForegroundColor White
Write-Host ""
Write-Host "Each server runs in a separate PowerShell window" -ForegroundColor Gray
Write-Host "Close the windows to stop the servers" -ForegroundColor Gray

