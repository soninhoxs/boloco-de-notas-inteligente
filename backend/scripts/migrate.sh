#!/bin/sh
set -e

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-${DB_USER:-megabrain}}"
DB_NAME="${POSTGRES_DB:-${DB_NAME:-megabrain}}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}"

psql_q() {
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

echo "waiting for postgres..."
TRIES=0
MAX_TRIES=90
until psql_q -c "SELECT 1" >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -ge "$MAX_TRIES" ]; then
    echo "postgres connection timed out after ${MAX_TRIES}s"
    exit 1
  fi
  sleep 1
done

psql_q <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
SQL

# Bancos criados antes do schema_migrations (initdb antigo)
has_users=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')")
migration_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT COUNT(*) FROM schema_migrations")

if [ "$has_users" = "t" ] && [ "$migration_count" = "0" ]; then
  echo "bootstrap: marking legacy migrations as applied"
  psql_q -c "INSERT INTO schema_migrations (version) VALUES ('001_initial_schema'), ('002_oauth_lgpd') ON CONFLICT DO NOTHING"
fi

for file in $(ls "$MIGRATIONS_DIR"/*.up.sql 2>/dev/null | sort); do
  version=$(basename "$file" .up.sql)
  applied=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM schema_migrations WHERE version = '$version' LIMIT 1")

  if [ "$applied" = "1" ]; then
    echo "skip: $version"
    continue
  fi

  echo "apply: $version"
  psql_q -f "$file"
  psql_q -c "INSERT INTO schema_migrations (version) VALUES ('$version')"
done

echo "migrations complete"
