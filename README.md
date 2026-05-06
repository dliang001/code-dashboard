# Code Projects Dashboard

A local web dashboard for the developer with too many projects in one parent directory.
Scans `D:\code` (or any root you point it at), shows project cards, lets you edit metadata,
and opens projects in VSCode/Explorer/terminal.

## Quick start

### Production (single port)

```powershell
npm install
npm run build      # builds backend + frontend
node dist/index.js --root D:\code
```

Open http://localhost:7420/ in a browser.

### Development (two ports, hot reload)

Terminal 1 — backend:
```powershell
npm install
npx tsx src/index.ts --root D:\code
```

Terminal 2 — frontend (proxies /api to localhost:7420):
```powershell
cd web
npm install
npm run dev
```

Open http://localhost:5173/.

## CLI options

- `--root <path>` — workspace to scan. Persisted to `~/.code-dashboard/config.json` for next run.
- `--port <N>` — HTTP port (default 7420).
- `--scan-only` — scan and exit (no server).
- `--data <path>` — override data dir (default `~/.code-dashboard`).

## What works today (Plan 1 + 3)

- Scan a workspace, identify projects (Node / Python / Docker / Rust / Go).
- Card grid with search, language filter, archived toggle, sort.
- Detail page with description, tags, start command (all editable), basic git/port info.
- Port conflict warnings.
- Open in Explorer / VSCode / new terminal.

## What's coming (Plan 2)

- Start/stop projects from the dashboard.
- Real-time logs via WebSocket.
- Live run-state badges (currently shown as "○ 未知").
- Parent-project "全启全停".

## Tests

```powershell
# Backend
npm test
npm run typecheck

# Frontend
cd web && npx vitest run
cd web && npm run typecheck
```
