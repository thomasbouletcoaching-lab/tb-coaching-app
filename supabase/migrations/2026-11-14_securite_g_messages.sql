-- SÉCURITÉ PHASE 1 (g) — Messages de la nouvelle app : seul l'auteur peut modifier le contenu d'un message
-- À RELIRE. RIEN N'EST APPLIQUÉ. Idempotent. Ne modifie ni ne supprime aucun message.
--
-- AVANT : la politique « cxs marquer lu » laisse le destinataire modifier TOUTES les colonnes d'un message,
--         y compris son texte (un membre pourrait réécrire une réponse du coach, et inversement).
-- APRÈS : même garde-fou que sur l'ancienne table « messages » (messages_guard). Le destinataire peut toujours
--         marquer un message comme lu (read_at) et y réagir (reactions) ; le reste est réservé à l'auteur.

create or replace function public.cxs_messages_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path = ''
as $function$
begin
  if (new.body is distinct from old.body                 -- le texte
      or new.audio_path is distinct from old.audio_path  -- le vocal
      or new.sender is distinct from old.sender          -- l'auteur
      or new.user_id is distinct from old.user_id        -- le fil de conversation
      or new.created_at is distinct from old.created_at) -- la date d'envoi
  then
    if old.sender is distinct from (select auth.uid()) then
      raise exception 'seul l''auteur peut modifier ce message';
    end if;
  end if;
  return new;
end
$function$;
revoke all on function public.cxs_messages_guard() from public, anon, authenticated; -- déclencheur : jamais appelé à la main

drop trigger if exists cxs_messages_guard on public.cxs_messages;
create trigger cxs_messages_guard before update on public.cxs_messages
  for each row execute function public.cxs_messages_guard();

-- RETOUR ARRIÈRE :
--   drop trigger if exists cxs_messages_guard on public.cxs_messages;
--   drop function if exists public.cxs_messages_guard();

-- TESTS (base de test, personas fictifs MEMBRE et COACH ; un message M1 écrit par COACH dans le fil de MEMBRE ; transaction annulée) :
--   begin;
--   select set_config('request.jwt.claims', json_build_object('sub', '<MEMBRE>')::text, true); set local role authenticated;
--   update cxs_messages set body = 'réécrit' where id = <M1>;        -- attendu : ERREUR « seul l'auteur peut modifier ce message »
--   update cxs_messages set sender = '<MEMBRE>' where id = <M1>;     -- attendu : ERREUR
--   update cxs_messages set read_at = now() where id = <M1>;         -- attendu : 1 ligne (marquer lu reste permis)
--   update cxs_messages set reactions = '{"👍":1}' where id = <M1>;  -- attendu : 1 ligne (réagir reste permis)
--   reset role;
--   select set_config('request.jwt.claims', json_build_object('sub', '<COACH>')::text, true); set local role authenticated;
--   update cxs_messages set body = 'corrigé' where id = <M1>;        -- attendu : 1 ligne (l'auteur corrige son message)
--   rollback;
