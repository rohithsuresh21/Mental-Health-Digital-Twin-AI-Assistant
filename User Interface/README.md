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

`vercel.json` rewrites `/api/(.*)` to the backend (via a Cloudflare tunnel in local demos); all other routes fall back to `index.html` for client-side routing.
