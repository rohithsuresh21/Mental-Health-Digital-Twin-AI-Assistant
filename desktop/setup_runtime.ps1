<#
  Installs the AI runtime into the embedded Python on the USER's machine:
    1. pip (into <install>\python)
    2. PyTorch matching the user's NVIDIA driver (cu126 / cu124 / cu118) or CPU
    3. app dependencies (requirements-desktop.txt)
    4. pre-downloads all models (HF, Whisper, NLTK) so the app works offline
  Run automatically by the installer; also available as Start menu > "Repair runtime".
  Usage: setup_runtime.ps1 [-Device auto|cuda|cpu] [-Force]
#>
param(
    [ValidateSet('auto', 'cuda', 'cpu')] [string]$Device = 'auto',
    [switch]$Force
)
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$AppDir  = Split-Path -Parent $PSScriptRoot          # <install>\app
$Root    = Split-Path -Parent $AppDir                # <install>
$PyDir   = Join-Path $Root 'python'
$Py      = Join-Path $PyDir 'python.exe'
$LogDir  = Join-Path $Root 'logs'
$Marker  = Join-Path $Root 'runtime_ready.json'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
try { Start-Transcript -Path (Join-Path $LogDir 'setup.log') -Append | Out-Null } catch {}

$Host.UI.RawUI.WindowTitle = 'Mental Health Digital Twin - installing AI runtime'
function Say($m, $c = 'Cyan') { Write-Host $m -ForegroundColor $c }
function Fail($m) {
    Say "`nERROR: $m" 'Red'
    Say "Log: $LogDir\setup.log" 'Yellow'
    Say "You can retry later from Start menu > 'Mental Health Digital Twin - Repair runtime'." 'Yellow'
    try { Stop-Transcript | Out-Null } catch {}
    Read-Host 'Press Enter to close'
    exit 1
}
function Pip([string[]]$a) {
    & $Py -m pip @a --disable-pip-version-check --no-warn-script-location --retries 5 --timeout 120
    return $LASTEXITCODE
}

if (-not (Test-Path $Py)) { Fail "Embedded Python not found at $Py" }
if ((Test-Path $Marker) -and -not $Force) { Say 'Runtime already installed (use -Force to reinstall).' 'Green'; exit 0 }

Say "`n=== Mental Health Digital Twin: AI runtime setup ===`n"
Say 'This downloads PyTorch and the AI models (about 3-4 GB with GPU support). Keep this window open.' 'Gray'

# ---- 1. pip --------------------------------------------------------------
Say "`n[1/4] Preparing Python..."
& $Py -c "import pip" 2>$null
if ($LASTEXITCODE -ne 0) {
    & $Py (Join-Path $PyDir 'get-pip.py') --no-warn-script-location
    if ($LASTEXITCODE -ne 0) { Fail 'Could not install pip (check your internet connection).' }
}
if ((Pip @('install', '--upgrade', 'pip', 'setuptools<81', 'wheel')) -ne 0) { Fail 'pip/setuptools install failed.' }

# ---- 2. PyTorch for this machine's GPU -----------------------------------
Say "`n[2/4] Detecting GPU..."
$tag = 'cpu'
if ($Device -ne 'cpu') {
    $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    $smiPath = if ($smi) { $smi.Source } elseif (Test-Path "$env:WINDIR\System32\nvidia-smi.exe") { "$env:WINDIR\System32\nvidia-smi.exe" } else { $null }
    if ($smiPath) {
        $out = (& $smiPath 2>$null) -join "`n"
        $gpu = (& $smiPath --query-gpu=name --format=csv,noheader 2>$null | Select-Object -First 1)
        if ($out -match 'CUDA Version:\s*(\d+)\.(\d+)') {
            $cv = [int]$Matches[1] * 100 + [int]$Matches[2]
            if ($cv -ge 1206) { $tag = 'cu126' } elseif ($cv -ge 1204) { $tag = 'cu124' } elseif ($cv -ge 1108) { $tag = 'cu118' }
            Say "  NVIDIA GPU: $gpu (driver supports CUDA $($Matches[1]).$($Matches[2]))" 'Green'
            if ($tag -eq 'cpu') { Say '  Driver too old for CUDA 11.8+ - update your NVIDIA driver for GPU speed. Using CPU.' 'Yellow' }
        }
    } else {
        Say '  No NVIDIA GPU detected - installing CPU build (works, just slower).' 'Yellow'
    }
    if ($Device -eq 'cuda' -and $tag -eq 'cpu') { $tag = 'cu126' }
}
Say "  Installing PyTorch 2.6.0 ($tag)..."
$torchArgs = @('install', 'torch==2.6.0', 'torchvision==0.21.0', 'torchaudio==2.6.0', '--index-url', "https://download.pytorch.org/whl/$tag")
if ($Force) { $torchArgs += '--force-reinstall' }
if ((Pip $torchArgs) -ne 0) {
    if ($tag -ne 'cpu') {
        Say '  GPU build failed to install, falling back to CPU build.' 'Yellow'
        $tag = 'cpu'
        if ((Pip @('install', 'torch==2.6.0', 'torchvision==0.21.0', 'torchaudio==2.6.0', '--index-url', 'https://download.pytorch.org/whl/cpu')) -ne 0) { Fail 'PyTorch install failed.' }
    } else { Fail 'PyTorch install failed.' }
}

# ---- 3. App dependencies -------------------------------------------------
Say "`n[3/4] Installing app libraries..."
$req = Join-Path $PSScriptRoot 'requirements-desktop.txt'
$cons = Join-Path $env:TEMP 'mhdt-torch-constraints.txt'
"torch==2.6.0`ntorchvision==0.21.0`ntorchaudio==2.6.0" | Set-Content -Encoding ASCII $cons
$depArgs = @('install', '--no-build-isolation', '-r', $req, '-c', $cons)
$wheels = Join-Path $Root 'wheelhouse'
if (Test-Path $wheels) { $depArgs += @('--find-links', $wheels) }
if ((Pip $depArgs) -ne 0) { Fail 'Dependency install failed.' }

& $Py -c "import torch,sys; print('  torch', torch.__version__, '| CUDA available:', torch.cuda.is_available(), '|', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
if ($LASTEXITCODE -ne 0) { Fail 'PyTorch does not import correctly.' }

# ---- 4. Models -----------------------------------------------------------
Say "`n[4/4] Downloading AI models (one time)..."
& $Py (Join-Path $PSScriptRoot 'prefetch_models.py')
if ($LASTEXITCODE -ne 0) { Fail 'Model download failed.' }

@{ torch = $tag; installed = (Get-Date).ToString('s') } | ConvertTo-Json | Set-Content -Encoding UTF8 $Marker
Say "`nDone! Launch 'Mental Health Digital Twin' from the Start menu or desktop." 'Green'
try { Stop-Transcript | Out-Null } catch {}
Start-Sleep -Seconds 4
exit 0
