-- SÉCURITÉ PHASE 1 (c) — search_path figé sur cxs_migration.num
-- À RELIRE. RIEN N'EST APPLIQUÉ. Idempotent. Ne modifie aucune donnée.
-- La fonction n'utilise que des fonctions intégrées (replace, conversion en nombre) : un search_path vide suffit.

alter function cxs_migration.num(text) set search_path = '';

-- RETOUR ARRIÈRE : alter function cxs_migration.num(text) reset search_path;

-- TESTS (branche Supabase) :
--   select cxs_migration.num('12,5') = 12.5, cxs_migration.num('abc') is null;   -- attendu : true, true (en tant que postgres)
--   select proconfig from pg_proc where oid = 'cxs_migration.num(text)'::regprocedure; -- attendu : {search_path=""}
--   -- l'alerte « function_search_path_mutable » doit disparaître des advisors.
