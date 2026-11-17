-- =====================================================================
-- RETOUR ARRIÈRE de 2026-11-17_cxs_hybride.sql
-- Ne supprime aucune donnée : les 5 tables sont déplacées dans le schéma « archive_hybride »
-- (invisible pour l'app et pour l'API), les fonctions sont retirées.
-- Pour revenir en avant : rejouer 2026-11-17_cxs_hybride.sql (crée des tables vides), puis
-- recopier si besoin les lignes depuis archive_hybride.
-- Testé par tests/sql/run-hybride.sh (aller, retour, aller).
-- RGPD : après un retour arrière, cxs_hyb_effacer_mes_donnees() n'existe plus. Une demande d'effacement
-- se traite alors à la main dans archive_hybride (la suppression d'un compte efface en cascade).
-- =====================================================================
begin;

create schema if not exists archive_hybride;
revoke all on schema archive_hybride from public, anon, authenticated;

do $$
declare t text; pol record; suffixe text := to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
begin
  foreach t in array array['cxs_hyb_xp', 'cxs_hyb_quetes', 'cxs_hyb_personnage', 'cxs_hyb_bloc', 'cxs_hyb_consentement'] loop
    if to_regclass('public.' || t) is not null then
      -- Les politiques sont retirées : la table archivée n'est plus lisible que par le propriétaire
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', pol.policyname, t);
      end loop;
      execute format('revoke all on public.%I from anon, authenticated, service_role', t);
      execute format('alter table public.%I set schema archive_hybride', t);
      execute format('alter table archive_hybride.%I rename to %I', t, t || '_' || suffixe);
    end if;
  end loop;
end $$;

drop function if exists public.cxs_hyb_effacer_mes_donnees();
drop function if exists public.cxs_hyb_consentir(boolean);
drop function if exists public.cxs_hyb_coach_peut_lire(uuid);
drop function if exists public.cxs_hyb_coache(uuid);

commit;
