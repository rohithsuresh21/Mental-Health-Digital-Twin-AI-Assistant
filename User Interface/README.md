# Mental Health Digital Twin — Frontend

React (Vite) analytics dashboard for the Mental Health Digital Twin system. Consumes the Flask backend described in the [root README](../README.md).

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide React (icons), Motion (animations)
- Express (`server.ts`) acting as a dev/serve proxy to the Flask backend

## Run locally

```bash
npm install
npm run dev
```

Serves on `http://localhost:3000`. The Express proxy forwards API calls to the Flask backend at `http://127.0.0.1:5000` (override with the `FLASK_URL` environment variable).

## Build

```bash
npm run build        # vite build → dist/
npm run lint         # tsc --noEmit
```

## Deploy

The UI ships inside the Windows desktop app: `desktop/build_installer.ps1` runs `npm run build` and the
local server (`desktop/server.py`) serves `dist/` and routes `/api/*` to the Flask backend on the same
origin. See the [root README](../README.md#install-the-desktop-app-windows-1011).
