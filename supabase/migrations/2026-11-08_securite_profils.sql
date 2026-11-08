-- =====================================================================
-- APPLIQUÉE en production le 2026-11-08 (migration Supabase « securite_profils_20261108 »).
-- 2026-11-08 · Sécurité : un membre ne peut plus se donner les droits coach
-- ni changer lui-même sa formule.
--
-- CONSTAT (lecture du schéma le 8/11/2026)
--   Politique « cxs modifier son profil » : UPDATE USING (id = auth.uid())
--   WITH CHECK (id = auth.uid()). Le rôle « authenticated » a le droit
--   UPDATE sur toutes les colonnes, y compris is_coach, tier et tier_until.
--   Aucun déclencheur ne protège ces colonnes.
--   → N'importe quel membre connecté peut exécuter, depuis la console de
--     son navigateur :
--       sb.from('cxs_profiles').update({ is_coach: true }).eq('id', <son id>)
--     puis lire tous les dossiers (cxs_member_data, cxs_profiles,
--     nutri_daily, cxs_coach_store…) via cxs_is_coach().
--   → Même chose pour tier = 'surmesure' (accès complet sans payer).
--   À l'insertion, seule la colonne is_coach est contrôlée : tier est libre.
--
-- CORRECTIF
--   Un déclencheur BEFORE INSERT/UPDATE refuse toute modification de
--   is_coach / tier / tier_until (et de id) par un membre qui n'est pas
--   coach. Les chemins légitimes restent ouverts :
--     · cxs_set_tier() (réservée au coach, SECURITY DEFINER) ;
--     · le service_role (Edge Functions stripe-webhook, billing) ;
--     · le coach lui-même.
--   Aucune donnée n'est modifiée par cette migration.
--
-- À FAIRE AVANT D'APPLIQUER
--   1. Vérifier qu'aucun profil non coach n'a déjà is_coach = true :
--        select id, email from public.cxs_profiles where is_coach;
--      (doit renvoyer uniquement le compte de Thomas)
--   2. Vérifier les formules attribuées :
--        select tier, count(*) from public.cxs_profiles group by 1;
--   3. Appliquer dans l'éditeur SQL de Supabase (ou `supabase db push`).
--   4. Tester : depuis un compte membre, la commande ci-dessus doit
--      échouer avec « Modification réservée au coach ».
-- =====================================================================

begin;

create or replace function public.cxs_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_member boolean := coalesce(auth.role(), '') = 'authenticated' and not public.cxs_is_coach();
begin
  if not is_member then
    return new; -- coach, service_role, fonctions internes : rien à contrôler
  end if;

  if tg_op = 'INSERT' then
    -- Un membre crée toujours son profil en Gratuit, sans droits coach.
    new.is_coach   := false;
    new.tier       := 'free';
    new.tier_until := null;
    return new;
  end if;

  if new.id is distinct from old.id
     or new.is_coach is distinct from old.is_coach
     or new.tier is distinct from old.tier
     or new.tier_until is distinct from old.tier_until then
    raise exception 'Modification réservée au coach' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all on function public.cxs_profiles_guard() from public, anon, authenticated;

drop trigger if exists cxs_profiles_guard on public.cxs_profiles;
create trigger cxs_profiles_guard
  before insert or update on public.cxs_profiles
  for each row execute function public.cxs_profiles_guard();

commit;

-- ---------------------------------------------------------------------
-- RETOUR ARRIÈRE (si besoin) :
--   drop trigger if exists cxs_profiles_guard on public.cxs_profiles;
--   drop function if exists public.cxs_profiles_guard();
-- ---------------------------------------------------------------------
