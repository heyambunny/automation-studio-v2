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
# Take a backup first if the push touches the database: bash /opt/automation-studio-v2/ops/backup-db.sh
# If this push added a backend/scripts/migrate_*.py, run it now:
ssh root@216.48.191.101 "cd /opt/automation-studio-v2/backend && PYTHONPATH=. venv/bin/python3 scripts/migrate_xxx.py"
ssh root@216.48.191.101 "systemctl restart automation-studio-backend"
ssh root@216.48.191.101 "cd /opt/automation-studio-v2/frontend && npm run build"
ssh root@216.48.191.101 "systemctl restart automation-studio-frontend"
curl -s -o /dev/null -w "%{http_code}\n" https://reporting.evolvebrands.tech
```

Production `backend/.env` sets `FRONTEND_URL=https://reporting.evolvebrands.tech`
(links in every outgoing email) and `PASSWORD_RESET_SMTP_PROFILE_ID` (the
`smtp_profiles.id` whose mailbox sends forgot-password emails - currently 1,
himanshub@evolvebrands.com). To change the reset sender, edit that ID and
restart the backend. Unset, forgot-password returns 503.

Production `frontend/.env.production` (server only, not in git) sets
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-8TJBJ2XDKL`
(Google Analytics 4). Both are baked in at `npm run build`, so changing either
needs a rebuild + frontend restart. Locally GA is off because the ID is unset.

## Production safety nets (set up 2026-10-22)

- **Database backups**: `/etc/cron.d/automation-studio-backup` runs `ops/backup-db.sh` nightly
  at 02:30 -> `/var/backups/automation-studio/*.dump` (pg_dump, this app's DB only; 14 days
  kept, each dump checked with pg_restore). `bash ops/verify-backup.sh` on the server proves
  the newest dump restores into a throwaway DB. `bash ops/pull-backups.sh` (run on your own
  computer) copies dumps off the server to `~/Backups/automation-studio`. The VM also runs an
  E2E R1Soft backup agent - check its policy in the E2E dashboard. The weekly digest flags a
  missing/stale (>36h) backup.
- **Memory**: 4 GB swap file (`/swapfile`, swappiness 10) and a systemd drop-in
  `/etc/systemd/system/automation-studio-backend.service.d/memory.conf` capping the backend at
  `MemoryHigh=2200M / MemoryMax=2800M / MemorySwapMax=0` - a runaway job restarts only this
  service (Restart=always) instead of freezing the shared box. Laboratory uploads are limited
  by `LAB_MAX_UPLOAD_MB` (40) and `LAB_MAX_CELLS` (2,000,000; ~450-830 bytes of RAM per cell).
- **SMTP passwords are encrypted at rest** with `SMTP_ENCRYPTION_KEY` in `backend/.env` (Fernet).
  **Keep a copy of that key somewhere safe outside the server**: without it the stored passwords
  cannot be decrypted (profiles would have to be re-entered). A fresh environment needs
  `scripts/migrate_encrypt_smtp_passwords.py` run once after the key is set; reads also accept
  legacy plain text, so it is safe to roll out in either order.
- **Login lockout** (`app/core/login_guard.py`): 5 wrong passwords per account+IP, 20 per
  account, or 30 per IP -> 15-minute lock (in memory; a backend restart clears it).
- **Weekly admin digest**: Mondays 09:00 server time, sent from the system mail profile
  (`PASSWORD_RESET_SMTP_PROFILE_ID`); `WEEKLY_DIGEST_ENABLED=false` turns it off. Audit Log has a
  "Email me the weekly digest" button that mails only the calling admin.
- **Old uploads** are never deleted automatically: Settings -> Storage (admin) lists campaign
  upload folders untouched for `UPLOAD_RETENTION_DAYS` (30) and deletes only what an admin
  ticks and confirms; folders needed by a schedule or running campaign are protected.
- Sends/schedules are checked first by `app/services/recipient_check.py` (warn-only dialog in the
  wizard; failures of the check never block a send). Non-admins are compared only with their own
  history, per the access-control rule below.

This app has no migration tool - a schema change means writing a one-off
`backend/scripts/migrate_*.py` (see existing ones for the pattern) and running
it by hand, locally and again on the server, before restarting the backend.

## Access control

SMTP profiles, mappings, and similar resources are **owner-or-admin-only** by
design: a non-admin sees only what they personally created, admin sees
everything. Do not widen this to "everyone sees everything" - it was tried
once and reverted (see `access-control-is-per-user-not-shared` memory).
