-- SÉCURITÉ PHASE 1 (a) — Fonctions internes : plus d'appel direct possible
-- À RELIRE. RIEN N'EST APPLIQUÉ. Idempotent (peut être relancé sans effet). Ne modifie aucune donnée.
--
-- 1) Schéma cxs_migration : 4 fonctions SECURITY DEFINER (food_for, history_for, measures_for, summary) renvoient
--    l'alimentation, l'historique et les mesures d'un client à partir de son identifiant, SANS aucun contrôle,
--    et sont exécutables par anon et authenticated. Elles ont servi à la migration ; l'app ne les appelle pas.
-- 2) Fonctions de déclencheur (cxs_notify_member_on_reply, messages_guard) : un déclencheur n'a pas besoin que
--    l'utilisateur ait le droit EXECUTE ; ce droit ne sert qu'à les appeler à la main par l'API.
-- 3) cxs_set_tier (change la formule d'un membre) et cxs_msgs_left : inutiles sans connexion.
--
-- NON touché volontairement : is_coach() et cxs_is_coach() restent exécutables sans connexion. Elles ne renvoient
-- qu'un booléen sur l'appelant, et des politiques de tables lisibles sans connexion (app_flags) les évaluent :
-- les retirer ferait échouer ces lectures.

revoke all on function cxs_migration.food_for(uuid)     from public, anon, authenticated;
revoke all on function cxs_migration.history_for(uuid)  from public, anon, authenticated;
revoke all on function cxs_migration.measures_for(uuid) from public, anon, authenticated;
revoke all on function cxs_migration.summary()          from public, anon, authenticated;
revoke all on function cxs_migration.dry_run()          from public, anon, authenticated;
revoke all on function cxs_migration.num(text)          from public, anon, authenticated;
revoke usage on schema cxs_migration from public, anon, authenticated;

revoke all on function public.cxs_notify_member_on_reply() from public, anon, authenticated;
revoke all on function public.messages_guard()             from public, anon, authenticated;

revoke execute on function public.cxs_set_tier(uuid, text, date) from public, anon;
revoke execute on function public.cxs_msgs_left(uuid)            from public, anon;
grant  execute on function public.cxs_set_tier(uuid, text, date) to authenticated; -- le coach est connecté ; le contrôle « coach » est dans le corps
grant  execute on function public.cxs_msgs_left(uuid)            to authenticated;

-- RETOUR ARRIÈRE :
--   grant usage on schema cxs_migration to anon, authenticated;
--   grant execute on all functions in schema cxs_migration to anon, authenticated;
--   grant execute on function public.cxs_notify_member_on_reply(), public.messages_guard(),
--     public.cxs_set_tier(uuid, text, date), public.cxs_msgs_left(uuid) to anon, authenticated;

-- TESTS (sur une branche Supabase, dans une transaction annulée) :
--   begin;
--   set local role anon;
--   select cxs_migration.summary();                                  -- attendu : ERREUR permission denied
--   select public.cxs_set_tier(gen_random_uuid(), 'premium', null);  -- attendu : ERREUR permission denied
--   select public.cxs_msgs_left(gen_random_uuid());                  -- attendu : ERREUR permission denied
--   select public.is_coach(), public.cxs_is_coach();                 -- attendu : false, false (toujours autorisé)
--   reset role; set local role authenticated;
--   select cxs_migration.history_for(gen_random_uuid());             -- attendu : ERREUR permission denied
--   select public.messages_guard();                                  -- attendu : ERREUR permission denied
--   select public.cxs_msgs_left();                                   -- attendu : réussit (null sans profil)
--   reset role;
--   -- un autorisé réussit : un message inséré par un membre déclenche toujours messages_guard et la notification,
--   -- à vérifier avec les personas de test (insertion puis mise à jour de read_at par le destinataire).
--   rollback;
