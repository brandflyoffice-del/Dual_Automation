#!/bin/sh
# Backup loop for the `backup` service: one compressed dump per database, every 24 h, oldest deleted after KEEP_DAYS.
# Restore example:  gunzip -c backups/fenebris-2026-11-01.sql.gz | docker compose exec -T db psql -U fenebris -d fenebris
set -u
KEEP_DAYS="${KEEP_DAYS:-14}"
while true; do
  day="$(date +%F)"
  for name in fenebris n8n; do
    out="/backups/${name}-${day}.sql.gz"
    if pg_dump -d "$name" | gzip > "${out}.tmp"; then
      mv "${out}.tmp" "$out"
      echo "$(date -Iseconds) backup ok: $out"
    else
      rm -f "${out}.tmp"
      echo "$(date -Iseconds) backup FAILED for $name" >&2
    fi
  done
  find /backups -name '*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  sleep 86400
done
