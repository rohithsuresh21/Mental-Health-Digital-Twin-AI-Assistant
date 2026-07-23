$ErrorActionPreference = "SilentlyContinue"
$ROOT = "E:\Mental-Health-Digital-Twin-AI"
$UI = "$ROOT\User Interface"
$CF = "$ROOT\cloudflared\cloudflared-windows-amd64.exe"
$TUNNEL_ERR = "$ROOT\cloudflared\tunnel_err.log"

Write-Host ""
Write-Host "=== Mental Health Digital Twin AI ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Kill old processes ──
Write-Host "[0/5] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Remove-Item $TUNNEL_ERR -Force -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Gray

# ── Step 1: Start Flask backend ──
Write-Host "[1/5] Starting Flask backend..." -ForegroundColor Yellow
Start-Process -FilePath "cmd" -ArgumentList "/c", "cd /d $ROOT && venv\Scripts\python.exe app.py" -WindowStyle Hidden

$flaskOk = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 2
    try { $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -UseBasicParsing -TimeoutSec 3; $flaskOk = $resp.StatusCode -eq 200 } catch {}
    if ($flaskOk) { break }
}

if ($flaskOk) {
    Write-Host "  Flask running on http://127.0.0.1:5000" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Flask may not be ready yet" -ForegroundColor DarkYellow
}

# ── Step 2: Start cloudflared tunnel ──
Write-Host "[2/5] Starting cloudflared tunnel..." -ForegroundColor Yellow
Start-Process -FilePath $CF -ArgumentList "tunnel --url http://127.0.0.1:5000" -NoNewWindow -RedirectStandardError $TUNNEL_ERR

$tunnelUrl = ""
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 2
    $lines = Get-Content $TUNNEL_ERR -ErrorAction SilentlyContinue
    foreach ($line in $lines) {
        if ($line -match "https://[a-z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $Matches[0]
            break
        }
    }
    if ($tunnelUrl) { break }
    Write-Host "  Waiting for tunnel... ($($i+1)/15)" -ForegroundColor Gray
}

if (-not $tunnelUrl) {
    Write-Host "  ERROR: Could not detect tunnel URL after 30s" -ForegroundColor Red
    Write-Host "  Check: $TUNNEL_ERR" -ForegroundColor Red
    exit 1
}
Write-Host "  Tunnel: $tunnelUrl" -ForegroundColor Green

# ── Step 3: Update vercel.json ──
Write-Host "[3/5] Updating vercel.json..." -ForegroundColor Yellow
$vercelPath = "$UI\vercel.json"
$vercelContent = Get-Content $vercelPath -Raw
$vercelContent = $vercelContent -replace '"destination":\s*"https://[a-z0-9-]+\.trycloudflare\.com/\$1"', "`"destination`": `"$tunnelUrl/`$1`""
Set-Content $vercelPath -Value $vercelContent -Encoding UTF8
Write-Host "  Updated to: $tunnelUrl" -ForegroundColor Gray

# ── Step 4: Deploy to Vercel ──
Write-Host "[4/5] Deploying to Vercel..." -ForegroundColor Yellow
Set-Location $ROOT
$deployOutput = npx vercel --prod --yes 2>&1
$deployOutput | ForEach-Object {
    $line = $_.ToString()
    if ($line -match "Ready") { Write-Host "  Deployed!" -ForegroundColor Green }
    elseif ($line -match "Error|error") { Write-Host "  $line" -ForegroundColor Red }
}

# ── Step 5: Commit & push ──
Write-Host "[5/5] Committing & pushing..." -ForegroundColor Yellow
Set-Location $ROOT
git add "User Interface/vercel.json" 2>&1 | Out-Null
$ts = Get-Date -Format "yyyy-MM-dd HH:mm"
$commitMsg = "chore: tunnel URL update $ts"
git diff --cached --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
    git commit -m $commitMsg 2>&1 | Out-Null
    git push origin main 2>&1 | Out-Null
    Write-Host "  Committed & pushed: $commitMsg" -ForegroundColor Gray
} else {
    Write-Host "  No changes to commit." -ForegroundColor Gray
}

# ── Done ──
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SERVER IS LIVE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Frontend:  https://mental-health-digital-twin-ai-assis.vercel.app" -ForegroundColor White
Write-Host "  Tunnel:    $tunnelUrl" -ForegroundColor White
Write-Host "  Backend:   http://127.0.0.1:5000" -ForegroundColor White
Write-Host "  Excel log: $ROOT\data\user_activity.xlsx" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ready for demo!" -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
