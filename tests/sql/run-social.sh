#!/usr/bin/env bash
# Teste la migration sociale sur un Postgres local jetable : aller, rejouer (idempotence), règles d'accès, retour, aller.
# Usage : PGHOST=/tmp/pg PGPORT=54329 PGUSER=postgres tests/sql/run-social.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=social_test_$$
export PGOPTIONS="-c client_min_messages=warning"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
createdb "$DB"; trap 'dropdb --if-exists "$DB"' EXIT
$P -f tests/sql/supabase-minimal.sql
$P -f supabase/migrations/2026-11-18_cxs_social.sql
$P -f supabase/migrations/2026-11-18_cxs_social.sql          # rejouée : idempotente
$P -f supabase/migrations/2026-11-19_cxs_partages.sql
$P -f supabase/migrations/2026-11-19_cxs_partages.sql        # rejouée : idempotente
$P -f tests/sql/personas.sql
OUT=$(mktemp)
if ! PGOPTIONS="-c client_min_messages=notice" $P -tA -f tests/sql/social_rls.sql >"$OUT" 2>&1; then
  sed 's/^psql:[^ ]* NOTICE:  //' "$OUT" | grep -E '^(OK|ÉCHEC)|ERROR|ÉCHEC'; echo "ÉCHEC : un contrôle d'accès n'est pas passé"; exit 1
fi
sed 's/^psql:[^ ]* NOTICE:  //' "$OUT" | grep -E '^(OK|ÉCHEC)|ERROR'
if grep -qE 'ÉCHEC|ERROR' "$OUT"; then echo "ÉCHEC : erreur dans les contrôles d'accès"; exit 1; fi
echo "--- retour arrière"
$P -f supabase/migrations/2026-11-18_cxs_social_retour.sql
$P -tAc "select count(*) from information_schema.tables where table_schema='public' and (table_name like 'cxs_soc_%' or table_name in ('cxs_parrainages','cxs_recompenses'))" | grep -qx 0
$P -tAc "select count(*) from information_schema.tables where table_schema='archive_social'" | grep -qx 8
T=$($P -tAc "select tablename from pg_tables where schemaname='archive_social' and tablename like 'cxs_parrainages_%'")
test "$($P -tAc "select count(*) from archive_social.$T")" -gt 0
echo "OK  retour arrière : 8 tables archivées avec leurs lignes, rien de supprimé"
$P -f supabase/migrations/2026-11-18_cxs_social.sql
$P -f supabase/migrations/2026-11-19_cxs_partages.sql
$P -tAc "select count(*) from information_schema.tables where table_schema='public' and (table_name like 'cxs_soc_%' or table_name in ('cxs_parrainages','cxs_recompenses'))" | grep -qx 8
echo "OK  migration rejouée après le retour arrière"
echo "TOUS LES TESTS SQL SONT PASSÉS"
