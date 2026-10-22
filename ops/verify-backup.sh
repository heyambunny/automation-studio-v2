#!/usr/bin/env bash
# Proves the newest dump is actually restorable: restores it into a throwaway
# database, prints live vs restored row counts, then drops the throwaway DB.
# Run on the server as root, e.g. monthly. Never touches the live database.
set -euo pipefail

DB="${BACKUP_DB:-automation_studio}"
DIR="${BACKUP_DIR:-/var/backups/automation-studio}"

LATEST="$(ls -1t "$DIR/${DB}"-*.dump | head -1)"
TMPDB="restore_verify_$$"
echo "restoring $(basename "$LATEST") into temporary database $TMPDB"

runuser -u postgres -- createdb "$TMPDB"
trap 'runuser -u postgres -- dropdb --if-exists "$TMPDB"' EXIT
runuser -u postgres -- pg_restore --no-owner --no-acl --dbname "$TMPDB" < "$LATEST"

printf '%-18s %8s %8s\n' table live restored
for t in users smtp_profiles mappings mapping_entries executions email_logs schedules audit_logs; do
  live="$(runuser -u postgres -- psql -Atq -d "$DB" -c "select count(*) from $t")"
  back="$(runuser -u postgres -- psql -Atq -d "$TMPDB" -c "select count(*) from $t")"
  printf '%-18s %8s %8s\n' "$t" "$live" "$back"
done
echo "restore verified - temporary database dropped"
