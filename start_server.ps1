$ErrorActionPreference = "SilentlyContinue"
$ROOT = "E:\Mental-Health-Digital-Twin-AI"
$UI = "$ROOT\User Interface"
$CF = "$ROOT\cloudflared\cloudflared-windows-amd64.exe"
$TUNNEL_LOG = "$ROOT\cloudflared\tunnel_new.log"
$FLASK_LOG = "$ROOT\cloudflared\flask.log"
$VERCEL = "$ROOT\node_modules\.bin\vercel.cmd"

function Start-Detached {
    param([string]$CommandLine)
    Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $CommandLine } | Out-Null
}

function Get-TunnelUrl {
    param([int]$TimeoutSeconds = 60)
    $url = ""
    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        Start-Sleep -Seconds 2
        $lines = Get-Content $TUNNEL_LOG -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match "https://[a-z0-9-]+\.trycloudflare\.com") { $url = $Matches[0] }
        }
        if ($url) { return $url }
        $elapsed += 2
    }
    return ""
}

function Update-Vercel {
    param([string]$tunnelUrl)
    $vercelPath = "$UI\vercel.json"
    $vercelContent = Get-Content $vercelPath -Raw
    $vercelContent = $vercelContent -replace '"destination":\s*"https://[a-z0-9-]+\.trycloudflare\.com', "`"destination`": `"$tunnelUrl"
    [System.IO.File]::WriteAllText($vercelPath, $vercelContent)
}

function Deploy-Vercel {
    Push-Location $ROOT
    & $VERCEL --prod --yes 2>&1 | ForEach-Object {
        $line = $_.ToString()
        if ($line -match "Ready") { Write-Host "  Deployed!" -ForegroundColor Green }
        elseif ($line -match "Error|error") { Write-Host "  $line" -ForegroundColor Red }
    }
    Pop-Location
}

function Commit-Vercel {
    Push-Location $ROOT
    git add "User Interface/vercel.json" 2>&1 | Out-Null
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm"
    $commitMsg = "chore: tunnel URL update $ts"
    git diff --cached --quiet 2>$null
    if ($LASTEXITCODE -ne 0) {
        git commit -m $commitMsg 2>&1 | Out-Null
        git push origin main 2>&1 | Out-Null
        Write-Host "  Committed & pushed: $commitMsg" -ForegroundColor Gray
    }
    Pop-Location
}

function Start-Tunnel {
    Remove-Item $TUNNEL_LOG -Force -ErrorAction SilentlyContinue
    Start-Detached "cmd.exe /c `"$ROOT\cloudflared\start_tunnel.bat`""
    $url = Get-TunnelUrl
    return $url
}

Write-Host ""
Write-Host "=== Mental Health Digital Twin AI ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Kill old processes ──
Write-Host "[0/5] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process python* -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process cloudflared* -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
Remove-Item $TUNNEL_LOG -Force -ErrorAction SilentlyContinue
Write-Host "  Done." -ForegroundColor Gray

# ── Step 1: Start Flask backend (detached, survives window close) ──
Write-Host "[1/5] Starting Flask backend (detached)..." -ForegroundColor Yellow
Start-Detached "cmd.exe /c `"$ROOT\cloudflared\start_flask.bat`""

$flaskOk = $false
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    try { $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5000/" -UseBasicParsing -TimeoutSec 3; $flaskOk = $resp.StatusCode -eq 200 } catch {}
    if ($flaskOk) { break }
}

if ($flaskOk) {
    Write-Host "  Flask running on http://127.0.0.1:5000" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Flask may not be ready yet (check $FLASK_LOG)" -ForegroundColor DarkYellow
}

# ── Step 2: Start cloudflared tunnel (detached) ──
Write-Host "[2/5] Starting cloudflared tunnel (detached)..." -ForegroundColor Yellow
$tunnelUrl = Start-Tunnel

if (-not $tunnelUrl) {
    Write-Host "  ERROR: Could not detect tunnel URL after 60s" -ForegroundColor Red
    Write-Host "  Check: $TUNNEL_LOG" -ForegroundColor Red
    exit 1
}
Write-Host "  Tunnel: $tunnelUrl" -ForegroundColor Green

# ── Step 3: Update vercel.json (all destination rules get the new host) ──
Write-Host "[3/5] Updating vercel.json..." -ForegroundColor Yellow
Update-Vercel $tunnelUrl
Write-Host "  Updated to: $tunnelUrl" -ForegroundColor Gray

# ── Step 4: Deploy to Vercel ──
Write-Host "[4/5] Deploying to Vercel..." -ForegroundColor Yellow
Deploy-Vercel

# ── Step 5: Commit & push ──
Write-Host "[5/5] Committing & pushing..." -ForegroundColor Yellow
Commit-Vercel

# ── Done ──
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SERVER IS LIVE (Flask + tunnel are DETACHED)" -ForegroundColor Green
Write-Host "  You can close this window; they keep running." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Frontend:  https://mental-health-digital-twin-ai-assis.vercel.app" -ForegroundColor White
Write-Host "  Tunnel:    $tunnelUrl" -ForegroundColor White
Write-Host "  Backend:   http://127.0.0.1:5000" -ForegroundColor White
Write-Host "  Flask log: $FLASK_LOG" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# ── Monitor: self-heal if the tunnel drops ──
Write-Host "Monitoring tunnel every 15s (auto-restarts + redeploys if it drops)." -ForegroundColor Cyan
Write-Host "Press Q and Enter to stop monitoring (services keep running)." -ForegroundColor Gray
while ($true) {
    Start-Sleep -Seconds 15
    if (-not (Get-Process cloudflared* -ErrorAction SilentlyContinue)) {
        Write-Host "  Tunnel died — restarting..." -ForegroundColor Yellow
        $newUrl = Start-Tunnel
        if ($newUrl) {
            Update-Vercel $newUrl
            Deploy-Vercel
            Commit-Vercel
            Write-Host "  Tunnel back up: $newUrl" -ForegroundColor Green
        } else {
            Write-Host "  Tunnel restart failed." -ForegroundColor Red
        }
    }
    if ($Host.UI.RawUI.KeyAvailable) {
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        if ($key.Character -eq 'q' -or $key.Character -eq 'Q') { break }
    }
}
