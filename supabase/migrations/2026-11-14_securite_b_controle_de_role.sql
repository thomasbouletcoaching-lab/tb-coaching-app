-- SÉCURITÉ PHASE 1 (b) — Contrôle de rôle dans le corps des fonctions qui n'en avaient pas
-- À RELIRE. RIEN N'EST APPLIQUÉ. Idempotent. Ne modifie aucune donnée.
--
-- Une seule fonction exposée lisait une information sur un AUTRE compte sans contrôle : cxs_msgs_left(uid)
-- renvoyait le nombre de messages restants de n'importe quel membre. Désormais : soi-même, ou le coach.
-- Signature, valeur par défaut et options inchangées (la politique d'écriture des messages l'appelle sans argument).

create or replace function public.cxs_msgs_left(uid uuid default auth.uid())
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when t.msgs_per_week is null then null
    else greatest(0, t.msgs_per_week - (select count(*) from public.cxs_messages m
      where m.user_id = uid and m.sender = uid and m.created_at > now() - interval '7 days'))::int end
  from public.cxs_profiles p join public.cxs_tiers t on t.id = p.tier
  where p.id = uid
    and (uid = (select auth.uid()) or public.cxs_is_coach())
$function$;

-- RETOUR ARRIÈRE : recréer la fonction sans la dernière ligne « and (uid = … or public.cxs_is_coach()) ».

-- TESTS (branche Supabase, personas fictifs : MEMBRE_A, MEMBRE_B, COACH ; transaction annulée) :
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub', '<uuid MEMBRE_A>', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select public.cxs_msgs_left('<uuid MEMBRE_B>');  -- attendu : aucune ligne / null (non autorisé)
--   select public.cxs_msgs_left();                   -- attendu : le compteur de MEMBRE_A (autorisé)
--   reset role;
--   select set_config('request.jwt.claims', json_build_object('sub', '<uuid COACH>', 'role', 'authenticated')::text, true);
--   set local role authenticated;
--   select public.cxs_msgs_left('<uuid MEMBRE_B>');  -- attendu : le compteur de MEMBRE_B (le coach est autorisé)
--   rollback;
