# Windows desktop build (runs 100% on the user's PC / GPU)

Replaces Vercel + Render + cloudflared. One local server (waitress) serves the React UI
and the Flask API on `http://127.0.0.1:47821`, opened in its own Edge app window.

## Install (end users)
```powershell
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/rohithsuresh21/Mental-Health-Digital-Twin-AI-Assistant/main/desktop/install.ps1 | iex"
```

## Release (CI)
`git tag v1.0.0 && git push origin v1.0.0` -> GitHub Actions builds the installer and attaches it to the release.

## Build the installer (on your Windows PC)
```powershell
cd E:\Mental-Health-Digital-Twin-AI
powershell -ExecutionPolicy Bypass -File desktop\build_installer.ps1 -Version 1.0.0
```
Output: `build\desktop\output\MentalHealthDigitalTwin-Setup-1.0.0.exe` (~100 MB).
Needs Node.js + internet; Inno Setup 6 is installed via winget if missing.

## What the installer does on the user's PC
1. Installs per-user to `%LOCALAPPDATA%\Programs\MentalHealthDigitalTwin` (no admin).
2. Runs `setup_runtime.ps1`: detects NVIDIA driver -> installs PyTorch 2.6 `cu126/cu124/cu118`
   (or CPU), then app deps, then caches all models (RoBERTa emotions, MiniLM, wav2vec2, Whisper base, NLTK).
3. After that the app works offline. Start menu: app, "Repair runtime", "Stop", "Logs".

## Run from source (dev)
```powershell
venv\Scripts\pip install waitress
venv\Scripts\python desktop\launcher.py
```
Force CPU: `set MHDT_DEVICE=cpu`. Logs: `.desktop_logs\app.log` (dev) or `<install>\logs\`.
