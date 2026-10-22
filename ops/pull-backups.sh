#!/usr/bin/env bash
# Run this on YOUR OWN computer (not the server): copies the server's database
# dumps here, so a lost server doesn't take the backups with it, and checks the
# newest copy against its checksum. Re-running only fetches what's new.
#
#   bash ops/pull-backups.sh
#
# Defaults can be overridden with BACKUP_HOST / BACKUP_DEST / BACKUP_KEEP_DAYS.
set -euo pipefail

HOST="${BACKUP_HOST:-root@216.48.191.101}"
SRC="${BACKUP_SRC:-/var/backups/automation-studio/}"
DEST="${BACKUP_DEST:-$HOME/Backups/automation-studio}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

umask 077
mkdir -p "$DEST"

rsync -a --include='*.dump' --include='*.dump.sha256' --exclude='*' "$HOST:$SRC" "$DEST/"

NEWEST="$(ls -1t "$DEST"/*.dump 2>/dev/null | head -1 || true)"
if [ -z "$NEWEST" ]; then
  echo "no dumps found on the server yet" >&2
  exit 1
fi
(cd "$DEST" && shasum -a 256 -c "$(basename "$NEWEST").sha256")

find "$DEST" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime +"$KEEP_DAYS" -delete
echo "backups in $DEST: $(ls -1 "$DEST"/*.dump | wc -l | tr -d ' ') (newest: $(basename "$NEWEST"))"
