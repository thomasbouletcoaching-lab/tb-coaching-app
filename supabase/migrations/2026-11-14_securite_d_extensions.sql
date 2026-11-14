-- SÉCURITÉ PHASE 1 (d) — Extensions hors du schéma public
-- À RELIRE. RIEN N'EST APPLIQUÉ. Ne modifie aucune donnée.
--
-- pg_walinspect : déplaçable. L'app ne l'utilise pas.
-- pg_net : NON déplaçable (ALTER EXTENSION … SET SCHEMA est refusé). Il faudrait la supprimer puis la recréer,
--   ce qui vide sa file de requêtes et coupe les notifications push le temps de l'opération. Ses fonctions vivent
--   déjà dans le schéma « net » : le risque réel de la laisser déclarée dans public est faible.
--   → À TRANCHER PAR THOMAS (voir docs/securite-phase1.md, question Q2). Le bloc correspondant reste en commentaire.

create schema if not exists extensions;
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'pg_walinspect' and n.nspname = 'public') then
    alter extension pg_walinspect set schema extensions;
  end if;
end $$;

-- pg_net (NE PAS EXÉCUTER sans décision ; à faire à une heure creuse, les rappels push s'interrompent quelques secondes) :
--   drop extension pg_net;
--   create extension pg_net with schema extensions;
--   -- puis vérifier : select public.push_test(); et les tâches cron push-*.

-- RETOUR ARRIÈRE : alter extension pg_walinspect set schema public;

-- TESTS (branche Supabase) :
--   select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_walinspect';
--   -- attendu : extensions
--   set role authenticated; select * from pg_get_wal_stats('0/0', '0/0'); -- attendu : ERREUR (fonction introuvable ou refusée)
--   reset role;
