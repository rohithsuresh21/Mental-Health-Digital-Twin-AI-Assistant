<#
  One-line installer for Mental Health Digital Twin (Windows 10/11 x64).
  Downloads the latest installer from GitHub Releases and runs it:

    powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/rohithsuresh21/Mental-Health-Digital-Twin-AI-Assistant/main/desktop/install.ps1 | iex"
#>
& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $repo = 'rohithsuresh21/Mental-Health-Digital-Twin-AI-Assistant'

    Write-Host 'Finding the latest Mental Health Digital Twin release...' -ForegroundColor Cyan
    $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'mhdt-installer' }
    $asset = $rel.assets | Where-Object { $_.name -like 'MentalHealthDigitalTwin-Setup-*.exe' } | Select-Object -First 1
    if (-not $asset) { throw "No installer found in release $($rel.tag_name). See https://github.com/$repo/releases" }

    $out = Join-Path $env:TEMP $asset.name
    Write-Host ("Downloading {0} ({1:N0} MB)..." -f $asset.name, ($asset.size / 1MB)) -ForegroundColor Cyan
    Invoke-WebRequest $asset.browser_download_url -OutFile $out -UseBasicParsing

    Write-Host 'Starting setup (PyTorch + AI models for your GPU are downloaded during install)...' -ForegroundColor Cyan
    Start-Process -FilePath $out -Wait
    Write-Host 'Done. Launch "Mental Health Digital Twin" from the Start menu.' -ForegroundColor Green
}
