-- SÉCURITÉ PHASE 1 (e) — Politiques RLS : (select auth.uid()) et intention documentée des tables sans politique
-- À RELIRE. RIEN N'EST APPLIQUÉ. Idempotent. Ne modifie aucune donnée, ne supprime aucune politique.
--
-- 1) Réécriture à l'identique des politiques de la nouvelle app qui appellent auth.uid() à chaque ligne :
--    auth.uid() → (select auth.uid()), évalué une seule fois par requête. Le SENS des politiques ne change pas.
--    Tables concernées (23 politiques) : cxs_profiles, cxs_member_data, cxs_messages, cxs_notifications,
--    cxs_coach_plans, cxs_coach_food_plans, cxs_coach_slots, cxs_live_sessions, nutri_daily, candidatures.
--    Les tables de comptabilité (compta_*, cpta_*) et le stockage (storage.objects) ne sont PAS touchés.
do $$
declare p record; q text; c text; stmt text;
begin
  for p in
    select pol.polname, pol.polrelid::regclass as tbl,
           pg_get_expr(pol.polqual, pol.polrelid) as qual, pg_get_expr(pol.polwithcheck, pol.polrelid) as chk
    from pg_policy pol join pg_class cl on cl.oid = pol.polrelid join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname = 'public'
      and cl.relname in ('cxs_profiles','cxs_member_data','cxs_messages','cxs_notifications','cxs_coach_plans',
                         'cxs_coach_food_plans','cxs_coach_slots','cxs_live_sessions','nutri_daily','candidatures')
  loop
    q := regexp_replace(p.qual, '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    c := regexp_replace(p.chk,  '(?<!SELECT )auth\.uid\(\)', '(select auth.uid())', 'g');
    if q is distinct from p.qual or c is distinct from p.chk then
      stmt := format('alter policy %I on %s', p.polname, p.tbl);
      if q is not null then stmt := stmt || format(' using (%s)', q); end if;
      if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
      execute stmt;
    end if;
  end loop;
end $$;

-- 2) Tables avec RLS activée et AUCUNE politique : c'est voulu. Sans politique, aucun rôle de l'API (anon,
--    authenticated) ne peut ni lire ni écrire ; seuls le rôle de service et les fonctions SECURITY DEFINER y accèdent.
comment on table public.app_private        is 'Interne : secrets serveur (clés push). RLS sans politique = fermée à l''API, lue par les fonctions push_* uniquement.';
comment on table public.app_private_log    is 'Interne : journal anti-abus (push_test). RLS sans politique = fermée à l''API.';
comment on table public.coaches            is 'Interne : liste des comptes coach, lue par is_coach(). RLS sans politique = fermée à l''API.';
comment on table public.gx_member          is 'Communauté (ancienne app) : accès uniquement par les fonctions gx_*. RLS sans politique = fermée à l''API.';
comment on table public.gx_events          is 'Communauté (ancienne app) : accès uniquement par les fonctions gx_*. RLS sans politique = fermée à l''API.';
comment on table public.gx_reactions       is 'Communauté (ancienne app) : accès uniquement par les fonctions gx_*. RLS sans politique = fermée à l''API.';
comment on table public.backup_oe_20261019 is 'Sauvegarde ponctuelle du 19/10/2026. RLS sans politique = fermée à l''API. À archiver (renommer) en phase 10, jamais supprimée sans accord.';

-- RETOUR ARRIÈRE : aucun effet fonctionnel à annuler (mêmes règles, mêmes résultats). Pour revenir au texte d'origine,
--   relancer le même bloc en inversant le remplacement : '\( SELECT auth\.uid\(\) AS uid\)' → 'auth.uid()'.
--   Avant application, exporter les définitions : select polname, polrelid::regclass, pg_get_expr(polqual, polrelid),
--   pg_get_expr(polwithcheck, polrelid) from pg_policy; (structure seulement, aucune donnée).

-- TESTS (branche Supabase, personas fictifs ; transaction annulée) :
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub', '<uuid MEMBRE_A>', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select count(*) from cxs_member_data where user_id = '<uuid MEMBRE_B>';        -- attendu : 0 (non autorisé)
--   select count(*) from cxs_member_data where user_id = '<uuid MEMBRE_A>';        -- attendu : 1 (autorisé)
--   update cxs_member_data set updated_at = now() where user_id = '<uuid MEMBRE_B>'; -- attendu : 0 ligne modifiée
--   select count(*) from nutri_daily where user_id = '<uuid MEMBRE_B>';            -- attendu : 0
--   select count(*) from app_private; select count(*) from coaches; select count(*) from gx_events; -- attendu : 0 ou ERREUR, jamais de lignes
--   reset role;
--   -- plus aucune politique non enveloppée sur ces tables :
--   select count(*) from pg_policy where polrelid::regclass::text like 'cxs_%'
--     and (pg_get_expr(polqual, polrelid) ~ '(?<!SELECT )auth\.uid\(\)' or pg_get_expr(polwithcheck, polrelid) ~ '(?<!SELECT )auth\.uid\(\)'); -- attendu : 0
--   rollback;
