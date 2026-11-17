#!/usr/bin/env bash
# Teste la migration hybride sur un Postgres local jetable : aller, rejouer (idempotence), règles d'accès, retour, aller.
# Usage : PGHOST=/tmp/pg PGPORT=54329 PGUSER=postgres tests/sql/run-hybride.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=hybride_test_$$
export PGOPTIONS="-c client_min_messages=warning"
P="psql -X -q -v ON_ERROR_STOP=1 -d $DB"
createdb "$DB"; trap 'dropdb --if-exists "$DB"' EXIT
$P -f tests/sql/supabase-minimal.sql
$P -f supabase/migrations/2026-11-17_cxs_hybride.sql
$P -f supabase/migrations/2026-11-17_cxs_hybride.sql          # rejouée : idempotente
$P -f tests/sql/personas.sql
OUT=$(mktemp)
if ! PGOPTIONS="-c client_min_messages=notice" $P -tA -f tests/sql/hybride_rls.sql >"$OUT" 2>&1; then
  sed 's/^psql:[^ ]* NOTICE:  //' "$OUT" | grep -E '^(OK|ÉCHEC)|ERROR|ÉCHEC'; echo "ÉCHEC : un contrôle d'accès n'est pas passé"; exit 1
fi
sed 's/^psql:[^ ]* NOTICE:  //' "$OUT" | grep -E '^(OK|ÉCHEC)|ERROR'
if grep -qE 'ÉCHEC|ERROR' "$OUT"; then echo "ÉCHEC : erreur dans les contrôles d'accès"; exit 1; fi
echo "--- retour arrière"
$P -f supabase/migrations/2026-11-17_cxs_hybride_retour.sql
$P -tAc "select count(*) from information_schema.tables where table_schema='public' and table_name like 'cxs_hyb_%'" | grep -qx 0
$P -tAc "select count(*) from information_schema.tables where table_schema='archive_hybride'" | grep -qx 5
T=$($P -tAc "select tablename from pg_tables where schemaname='archive_hybride' and tablename like 'cxs_hyb_xp_%'")
$P -tAc "select count(*) from archive_hybride.$T" | grep -qx 5
echo "OK  retour arrière : 5 tables archivées avec leurs lignes, rien de supprimé"
$P -f supabase/migrations/2026-11-17_cxs_hybride.sql
$P -tAc "select count(*) from information_schema.tables where table_schema='public' and table_name like 'cxs_hyb_%'" | grep -qx 5
echo "OK  migration rejouée après le retour arrière"
echo "TOUS LES TESTS SQL SONT PASSÉS"
