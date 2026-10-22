#!/usr/bin/env bash
# Nightly logical backup of this app's Postgres database (and only this one -
# the VM also hosts other projects). Run as root from /etc/cron.d.
#
# Each run writes <db>-<timestamp>.dump (pg_dump custom format) plus a .sha256,
# refuses to keep a dump that pg_restore can't read back, and deletes dumps
# older than BACKUP_KEEP_DAYS.
set -euo pipefail

DB="${BACKUP_DB:-automation_studio}"
DIR="${BACKUP_DIR:-/var/backups/automation-studio}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/${DB}-${STAMP}.dump"
TMP="${OUT}.partial"
trap 'rm -f "$TMP"' EXIT

runuser -u postgres -- pg_dump --format=custom --no-owner --no-acl "$DB" > "$TMP"
runuser -u postgres -- pg_restore --list < "$TMP" > /dev/null

mv "$TMP" "$OUT"
(cd "$DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256")

find "$DIR" -maxdepth 1 -type f \( -name "${DB}-*.dump" -o -name "${DB}-*.dump.sha256" \) -mtime +"$KEEP_DAYS" -delete

echo "$(date -Is) ok $(basename "$OUT") $(stat -c %s "$OUT") bytes"
