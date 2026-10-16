<#
  Builds the Windows installer:  build\desktop\output\MentalHealthDigitalTwin-Setup-<ver>.exe
  Run from the repo root in PowerShell:
      powershell -ExecutionPolicy Bypass -File desktop\build_installer.ps1 [-Version 1.0.0] [-SkipFrontend]
  Needs: Node.js (npm), internet, Inno Setup 6 (auto-installed with winget if missing).
  The installer is small (~100 MB); PyTorch + models are downloaded on the user's PC
  for THEIR GPU during install.
#>
param(
    [string]$Version = '1.0.0',
    [switch]$SkipFrontend
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo  = Split-Path -Parent $PSScriptRoot
$Build = Join-Path $Repo 'build\desktop'
$Cache = Join-Path $Build 'cache'
$Stage = Join-Path $Build 'stage'
$Out   = Join-Path $Build 'output'
$PyVer = '3.12.10'

function Say($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Exec([scriptblock]$b, [string]$what) { & $b; if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" } }

New-Item -ItemType Directory -Force -Path $Cache, $Out | Out-Null
if (Test-Path $Stage) { Remove-Item -Recurse -Force $Stage }
New-Item -ItemType Directory -Force -Path "$Stage\python", "$Stage\app" | Out-Null

# 1. Frontend -----------------------------------------------------------------
$UI = Join-Path $Repo 'User Interface'
if (-not $SkipFrontend) {
    Say 'Building React frontend'
    Push-Location $UI
    try {
        if (Test-Path 'package-lock.json') { Exec { npm ci --no-audit --no-fund } 'npm ci' } else { Exec { npm install --no-audit --no-fund } 'npm install' }
        Exec { npm run build } 'npm run build'
    } finally { Pop-Location }
}
if (-not (Test-Path "$UI\dist\index.html")) { throw 'Frontend build missing (User Interface\dist\index.html).' }

# 2. Embedded Python ---------------------------------------------------------
Say "Embedded Python $PyVer"
$zip = Join-Path $Cache "python-$PyVer-embed-amd64.zip"
if (-not (Test-Path $zip)) {
    Invoke-WebRequest "https://www.python.org/ftp/python/$PyVer/python-$PyVer-embed-amd64.zip" -OutFile $zip
}
Expand-Archive -Path $zip -DestinationPath "$Stage\python" -Force
$getpip = Join-Path $Cache 'get-pip.py'
if (-not (Test-Path $getpip)) { Invoke-WebRequest 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getpip }
Copy-Item $getpip "$Stage\python\get-pip.py"
# enable site-packages + make the app folder importable
$pth = Get-ChildItem "$Stage\python" -Filter 'python3*._pth' | Select-Object -First 1
$zipName = (Get-ChildItem "$Stage\python" -Filter 'python3*.zip' | Select-Object -First 1).Name
@($zipName, '.', 'Lib\site-packages', '..\app', 'import site') | Set-Content -Encoding ASCII $pth.FullName
New-Item -ItemType Directory -Force -Path "$Stage\python\Lib\site-packages" | Out-Null

# 3. App files ---------------------------------------------------------------
Say 'Copying app'
$dirs  = 'Stage_1', 'stage_2', 'stage_3', 'stage_4', 'Stage_5', 'XAI', 'daily_portal', 'data_parser', 'desktop', 'pipeline_outputs'
$files = 'app.py', 'unified_pipeline.py', 'pipeline_runner.py', 'pdf_generator.py', 'device_util.py', 'tft_checkpoint.ckpt', 'LICENSE', 'README.md'
foreach ($d in $dirs) {
    if (Test-Path "$Repo\$d") {
        robocopy "$Repo\$d" "$Stage\app\$d" /E /NFL /NDL /NJH /NJS /NP /XD __pycache__ .ipynb_checkpoints /XF *.ipynb *.pyc | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy $d failed" }
    }
}
foreach ($f in $files) { if (Test-Path "$Repo\$f") { Copy-Item "$Repo\$f" "$Stage\app\$f" } else { Write-Warning "missing $f" } }
robocopy "$UI\dist" "$Stage\app\frontend" /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'robocopy frontend failed' }
New-Item -ItemType Directory -Force -Path "$Stage\app\data" | Out-Null   # fresh, empty user data
$global:LASTEXITCODE = 0

# 4. Inno Setup --------------------------------------------------------------
Say 'Compiling installer'
$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
    Write-Host 'Inno Setup 6 not found - installing with winget...' -ForegroundColor Yellow
    winget install --id JRSoftware.InnoSetup -e --silent --accept-package-agreements --accept-source-agreements | Out-Host
    $iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") |
            Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $iscc) { throw 'Install Inno Setup 6 from https://jrsoftware.org/isdl.php and re-run.' }
}
Exec { & $iscc "/DAppVersion=$Version" "/DStageDir=$Stage" "/DOutputDir=$Out" (Join-Path $PSScriptRoot 'installer.iss') } 'ISCC'

$exe = Join-Path $Out "MentalHealthDigitalTwin-Setup-$Version.exe"
Write-Host "`nInstaller ready: $exe" -ForegroundColor Green
Write-Host ("Size: {0:N0} MB" -f ((Get-Item $exe).Length / 1MB))
