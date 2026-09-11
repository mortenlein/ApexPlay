#!/usr/bin/env bash
# ApexPlay production backup — consistent SQLite snapshot + uploads archive.
#
# Neither the host nor the alpine runtime image ships the `sqlite3` binary, so the snapshot is
# taken from INSIDE the running container using the app's own Prisma client:
# `VACUUM INTO` writes a fresh, fully-consistent copy of the live DB without locking writers out
# and without modifying the source. Same trick for the integrity check, run against the snapshot.
#
# Usage:   ./scripts/backup.sh
# Cron:    20 3 * * *  cd /home/mole/apps/ApexPlay && ./scripts/backup.sh >> data/backups/backup.log 2>&1
#
# Env overrides: BACKUP_DIR, BACKUP_KEEP_DAYS (default 30), APEXPLAY_CONTAINER,
#                APEXPLAY_UPLOADS_DIR, APEXPLAY_DB_IN_CONTAINER.
#
# A backup you haven't restored is not a backup — test-restore periodically.
#
# RESTORE:
#   docker compose -f docker-compose.prod.yml down          # stop the app (releases the DB)
#   cp data/prod.db data/prod.db.before-restore             # keep an escape hatch
#   cp data/backups/prod-<ts>.db data/prod.db               # drop the snapshot in place
#   rm -f data/prod.db-wal data/prod.db-shm                 # stale WAL would shadow the restore
#   docker compose -f docker-compose.prod.yml up -d          # migrations re-run, then serve
#   uploads:  tar xzf data/backups/uploads-<ts>.tar.gz -C uploads/
set -euo pipefail

CONTAINER="${APEXPLAY_CONTAINER:-apexplay}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/backups}"
UPLOADS_DIR="${APEXPLAY_UPLOADS_DIR:-$ROOT/uploads}"
DB_IN_CONTAINER="${APEXPLAY_DB_IN_CONTAINER:-/app/data/prod.db}"

log() { echo "[backup $(date -Iseconds)] $*"; }

# ./data/backups is bind-mounted into the container as /app/data/backups. Create it host-side as
# the current user (uid 1000 == the container's runtime user) so the container can write into it.
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
SNAP="$BACKUP_DIR/prod-$TS.db"
SNAP_IN_CONTAINER="/app/data/backups/prod-$TS.db"
UPLOADS_TGZ="$BACKUP_DIR/uploads-$TS.tar.gz"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  log "ERROR: container '$CONTAINER' is not running — cannot snapshot the live DB" >&2
  exit 1
fi

# --- 1. Snapshot the live DB (VACUUM INTO: consistent, read-only w.r.t. the source) -------------
log "snapshot: VACUUM INTO $(basename "$SNAP") (via $CONTAINER prisma client)"
docker exec -i \
  -e DATABASE_URL="file:$DB_IN_CONTAINER" \
  -e SNAP="$SNAP_IN_CONTAINER" \
  "$CONTAINER" node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
const target = String(process.env.SNAP).replace(/'/g, "''");
(async () => {
  const db = new PrismaClient();
  try {
    await db.$executeRawUnsafe(`VACUUM INTO '${target}'`);
  } finally {
    await db.$disconnect();
  }
})().catch((e) => { console.error(e && e.message ? e.message : String(e)); process.exit(1); });
NODE

if [ ! -s "$SNAP" ]; then
  log "ERROR: snapshot missing or empty — removing" >&2
  rm -f "$SNAP"; exit 1
fi
log "snapshot written ($(du -h "$SNAP" | cut -f1))"

# --- 2. Verify the snapshot (PRAGMA integrity_check against the COPY, not the live DB) ----------
log "verify: PRAGMA integrity_check on $(basename "$SNAP")"
CHECK="$(docker exec -i \
  -e DATABASE_URL="file:$SNAP_IN_CONTAINER" \
  "$CONTAINER" node - <<'NODE'
const { PrismaClient } = require('@prisma/client');
(async () => {
  const db = new PrismaClient();
  let out;
  try {
    const rows = await db.$queryRawUnsafe('PRAGMA integrity_check');
    out = rows.map((r) => Object.values(r)[0]).join('; ');
  } finally {
    await db.$disconnect();
  }
  console.log(out);
})().catch((e) => { console.error(e && e.message ? e.message : String(e)); process.exit(1); });
NODE
)"
if [ "$CHECK" != "ok" ]; then
  log "ERROR: integrity_check failed ($CHECK) — removing snapshot" >&2
  rm -f "$SNAP" "$SNAP-wal" "$SNAP-shm"; exit 1
fi
# Prisma may leave WAL sidecars next to the snapshot it just opened; they are not part of it.
rm -f "$SNAP-wal" "$SNAP-shm" "$SNAP-journal"
log "snapshot verified (integrity_check = ok)"

# --- 3. Uploads (player/team avatars etc. live on a bind mount, not in the DB) ------------------
if [ -d "$UPLOADS_DIR" ]; then
  tar czf "$UPLOADS_TGZ" -C "$UPLOADS_DIR" . \
    && log "uploads archived → $(basename "$UPLOADS_TGZ") ($(du -h "$UPLOADS_TGZ" | cut -f1))" \
    || { log "ERROR: uploads tar failed" >&2; exit 1; }
else
  log "uploads dir $UPLOADS_DIR missing — skipped"
fi

# --- 4. Rotation -------------------------------------------------------------------------------
PRUNED="$(find "$BACKUP_DIR" -maxdepth 1 \( -name 'prod-*.db' -o -name 'uploads-*.tar.gz' \) \
  -mtime +"$KEEP_DAYS" -print -delete 2>/dev/null | wc -l)"
log "rotation: pruned $PRUNED file(s) older than $KEEP_DAYS day(s)"

log "done. ⚠ $BACKUP_DIR is local-only — copy it OFFSITE for real durability."
