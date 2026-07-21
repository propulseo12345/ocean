#!/usr/bin/env bash
# Rejoue les migrations 001->0NN sur une base vierge du conteneur ocean_rev2,
# puis lance le(s) test(s) pgTAP passés en argument.
# Usage (depuis Git Bash, Docker dans le PATH) :
#   MSYS_NO_PATHCONV=1 bash scripts/run-pgtap.sh 011
set -euo pipefail

CTN=ocean_rev2
UPTO="${1:-011}"

# 1. Base vierge (sans détruire le schéma auth appartenant à supabase_admin).
docker exec -i "$CTN" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
drop schema if exists public cascade;
drop schema if exists private cascade;
create schema public;
grant usage on schema public to authenticated, anon, service_role;
delete from auth.users;
create extension if not exists pgtap with schema extensions;
grant anon, authenticated, service_role to postgres;
SQL

# 2. Migrations dans l'ordre, jusqu'à UPTO.
for f in $(docker exec "$CTN" bash -c "ls /tmp/migrations/*.sql | sort"); do
  num=$(basename "$f" | cut -c1-3)
  if [[ "$num" > "$UPTO" ]]; then continue; fi
  echo ">>> migration $(basename "$f")"
  docker exec -i "$CTN" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "$f"
done

# 3. Tests passés en argument (à partir du 2e).
shift || true
for t in "$@"; do
  echo ">>> test $t"
  docker exec -i "$CTN" psql -U postgres -d postgres -f "/tmp/tests/${t}"
done
