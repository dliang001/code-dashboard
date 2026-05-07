# Code Projects Dashboard

A local web dashboard for a developer workspace with many projects in one parent directory.
It scans `D:\code` by default, shows project status, starts and stops projects, streams logs,
opens folders/editors/terminals, and helps resolve port conflicts.

## Install Once, Click Forever

```powershell
npm install
npm run build
npm run install-shortcut
```

The installer creates a `Code Dashboard` desktop shortcut. Double-click it to start the
dashboard in the background and open `http://localhost:7420/`. If the dashboard is already
running, the launcher only opens the browser tab.

Optional shortcut setup:

```powershell
# Autostart at login + Start Menu entry
npm run install-shortcut -- -Autostart -StartMenu

# Custom dashboard port / scan root
npm run install-shortcut -- -Port 7421 -Root "D:\projects"

# Add a separate "Stop Code Dashboard" desktop shortcut
npm run install-shortcut -- -InstallStop
```

## Moving To Another Machine

This project currently ships best as a source-based local tool rather than a single `.exe`.
On a new machine:

1. Install Node.js 20+.
2. Copy or clone this repository.
3. Run `npm install`.
4. Run `npm run build`.
5. Run `npm run install-shortcut -- -Root "<your project folder>"`.

The target machine still needs the runtimes used by your projects, such as `pnpm`, Python,
Docker, or database services. The dashboard can discover and start projects, but it cannot
install each project's own stack automatically.

Dashboard state lives in `~/.code-dashboard`. Copy that folder too if you want to migrate
edited descriptions, tags, archived flags, and manually configured ports.

## Manual Usage

Production, single port:

```powershell
npm install
npm run build
node dist/index.js --root D:\code --port 7420
```

Development, hot reload:

```powershell
# Terminal 1: backend
npx tsx src/index.ts --root D:\code --port 7420

# Terminal 2: frontend
cd web
npm install
npm run dev
```

Open `http://localhost:5173/` in development. The Vite dev server proxies `/api` and `/ws`
to `http://localhost:7420`.

## CLI Options

- `--root <path>`: workspace root to scan. Persisted to `~/.code-dashboard/config.json`.
- `--port <N>`: dashboard HTTP port. Default: `7420`.
- `--scan-only`: scan and exit without starting the server.
- `--data <path>`: override the data directory. Default: `~/.code-dashboard`.

## Dashboard Controls

- `RESCAN`: rescans the workspace and refreshes the project list.
- `RESTART`: restarts the dashboard backend, waits for the new server instance, then reloads the page.
- `SHUTDOWN`: stops the dashboard backend.
- `LOGS`: opens the live log panel.
- `TWEAKS`: opens local UI preferences such as theme and density.

Restart and shutdown stop child processes that were started by the dashboard. If the UI is
unresponsive, run:

```powershell
npm run stop
```

or use the optional `Stop Code Dashboard` shortcut created with `-InstallStop`.

## Project Detection

The scanner detects project type, framework, start command, port, README summary, git branch,
last activity, and local URLs documented in README files.

Supported project signals include:

- Node projects through `package.json`.
- Python projects through `requirements.txt`, `pyproject.toml`, `app.py`, and `main.py`.
- Docker Compose projects through `docker-compose.yml` / `docker-compose.yaml`.
- Rust and Go projects through `Cargo.toml` and `go.mod`.
- Common monorepo web apps such as `apps/web`, `apps/frontend`, `packages/web`, `web`, `frontend`, and `client`.

Port detection priority:

1. Explicit script flags such as `--port 3200` or `-p 3200`.
2. Nested workspace web package scripts, for example `apps/web/package.json`.
3. `vite.config.*` `server.port`.
4. `.env.local` / `.env` `PORT`, `VITE_PORT`, or `NEXT_PUBLIC_PORT`.
5. Python app text and common framework defaults.
6. Docker Compose host port mappings.
7. Safe framework defaults:
   - Vite / SvelteKit: `5173`
   - Next / Nuxt: `3000`
   - Astro: `4321`
   - Flask: `5000`
   - FastAPI / uvicorn: `8000`

Express and generic Python projects do not receive a guessed port unless a script or config
declares one. This avoids showing clickable but wrong URLs.

Python detection is intentionally conservative. The dashboard only suggests a start command
when it can find a real entry file such as `app.py`, `main.py`, or a Flask file that creates
`Flask(...)` and calls `app.run(...)`. It will not invent `python -m main` when no `main.py`
exists. For Flask ports, code/config values like `PORT`, `assistant_port`, or `app.run(port=...)`
win over framework defaults; `requirements.txt` alone is not enough to claim port `5000`.

Docker Compose port detection favors services named like `web`, `frontend`, `app`, `api`, or
`server`, and deprioritizes common database/cache ports such as `5432`, `3306`, and `6379`.

The scanner also looks through README files up to a few levels inside each project and extracts
local URLs such as `http://localhost:3000/api/automation-lab/ui/`. This is meant for internal
tool pages mounted inside a main app. These URLs appear in the project detail page as
`扫描发现`; they do not create a separate project row unless that tool has its own runnable
project directory.

## Running Projects

The dashboard can start and stop projects from list rows or detail pages. Managed processes get:

- PID and uptime.
- Live stdout/stderr log streaming over WebSocket.
- URLs extracted from logs such as `http://localhost:5173`.
- Fallback URL discovery from the process listening port when logs do not print a URL.
- README-discovered local tool URLs mounted under the project.
- Port conflict handling: if the desired port is occupied, the dashboard can allocate the next free port and pass it through `PORT`.

### Editing Default Ports

Open a project detail page and use the `Default port` panel to override the detected port.
This is useful when:

- The scanner could not infer a port.
- Two projects share a detected default, such as many Vite apps on `5173`.
- A project has a configurable port but does not declare it in scripts or config.

The manually configured port is preserved across rescans and is used for URL display, conflict
detection, and the `PORT` environment variable when the dashboard starts the project. Clear the
override to return to the scanner's detected value.

External processes are detected through port probes and process command lines. These show as
`EXTERNAL` because the dashboard did not start them and should not stop them.

Parent projects can start or stop all detected descendants from the detail page.

## Troubleshooting

### The page looks stale after updating code

Run `npm run build`, then restart the dashboard. The current UI restart flow waits for the
backend `serverStartedAt` value to change before reloading, so it should not mistake the old
process for a new one.

If the old process is stuck, run:

```powershell
npm run stop
npm run launch
```

### RESCAN ran but ports are still missing

Check whether the project declares a port. The scanner intentionally avoids guessing for
frameworks without stable defaults, such as Express. Add an explicit `--port`, `PORT=`,
framework config, or set a manual default port in the project detail page if you want the
dashboard to show a stable URL.

### A project is RUNNING but URL is empty

Managed projects should expose a URL from logs or from PID-to-listening-port discovery.
If it is still empty, open `LOGS` and check whether the child process actually bound a local TCP port.

### Windows permissions

Some diagnostics use Windows process and TCP listening data. If a terminal command fails with
permission errors, restart the dashboard from the normal desktop shortcut or an elevated terminal.

## Things Users Should Know

- Restarting or shutting down the dashboard stops child processes that the dashboard started.
- External processes are shown as `EXTERNAL`; the dashboard will not stop them.
- Multiple projects may legitimately share a default port when they are not meant to run together.
  Use manual port overrides for projects you often run side by side.
- Rescan updates auto-detected fields, but preserves user-edited description, tags, archived
  state, start command, and manual port.
- For best URL detection, make dev servers print their local URL on startup or bind to a local TCP port.

## Tests

```powershell
# Backend
npm test
npm run typecheck

# Frontend
cd web
npm run test
npm run typecheck
```

Useful focused tests:

```powershell
npm run test -- scanner.ports
npm run test -- api.runstate
cd web && npm run test -- ProjectCard
```
