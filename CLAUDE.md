# Automation Studio v2

FastAPI (Python) backend + Next.js (TypeScript) frontend. Branch-report email
campaign automation tool (upload Excel/CSV branch data, map branches to
recipients, send/schedule personalized emails, track history).

## Run locally

Both processes read `backend/.env` (already configured, points at a local
Postgres DB - separate from production's) - no setup needed, just start them.

**Backend** (FastAPI on :8000):
```bash
cd backend && source venv/bin/activate && nohup uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/backend_dev.log 2>&1 &
```

**Frontend** (Next.js on :3000):
```bash
cd frontend && nohup npm run dev > /tmp/frontend_dev.log 2>&1 &
```

**Health check both:**
```bash
curl -s http://127.0.0.1:8000/docs -o /dev/null -w "backend: %{http_code}\n"
curl -s http://127.0.0.1:3000 -o /dev/null -w "frontend: %{http_code}\n"
```

**Check if already running** (before starting, to avoid duplicate processes):
```bash
lsof -iTCP:8000 -sTCP:LISTEN -Pn 2>/dev/null; lsof -iTCP:3000 -sTCP:LISTEN -Pn 2>/dev/null
```

**Stop both:**
```bash
pkill -f "uvicorn app.main:app"; pkill -f "npm run dev"
```

**After changing a backend file**, uvicorn was started without `--reload`, so
it must be restarted (pkill + rerun the start command above) for the change
to take effect - it will NOT pick up edits automatically.

**Local test logins** (passwords reset during development to a known value;
not real production credentials):
- `admin@automation.studio` / `TestPass123!` (admin role)
- `manager@automation.studio` / `TestPass123!` (manager role)

## Deploy to production

Server: `root@216.48.191.101`, domain `reporting.evolvebrands.tech`, app at
`/opt/automation-studio-v2`, with its own Postgres DB - **not** the same one
local dev uses. Data created against the local backend (a test user, an
announcement, etc.) will not appear on production and vice versa; anything
that needs to exist on production (like an announcement for real users) has
to be created against the production API/DB directly.

```bash
ssh root@216.48.191.101 "cd /opt/automation-studio-v2 && git pull origin main"
# If this push added a backend/scripts/migrate_*.py, run it now:
ssh root@216.48.191.101 "cd /opt/automation-studio-v2/backend && PYTHONPATH=. venv/bin/python3 scripts/migrate_xxx.py"
ssh root@216.48.191.101 "systemctl restart automation-studio-backend"
ssh root@216.48.191.101 "cd /opt/automation-studio-v2/frontend && npm run build"
ssh root@216.48.191.101 "systemctl restart automation-studio-frontend"
curl -s -o /dev/null -w "%{http_code}\n" https://reporting.evolvebrands.tech
```

This app has no migration tool - a schema change means writing a one-off
`backend/scripts/migrate_*.py` (see existing ones for the pattern) and running
it by hand, locally and again on the server, before restarting the backend.

## Access control

SMTP profiles, mappings, and similar resources are **owner-or-admin-only** by
design: a non-admin sees only what they personally created, admin sees
everything. Do not widen this to "everyone sees everything" - it was tried
once and reverted (see `access-control-is-per-user-not-shared` memory).
