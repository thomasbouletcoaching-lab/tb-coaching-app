-- =====================================================================
-- RETOUR ARRIÈRE de 2026-11-18_cxs_social.sql
-- Ne supprime aucune donnée : les 7 tables sont déplacées dans le schéma « archive_social »
-- (invisible pour l'app et pour l'API), les fonctions sont retirées. L'app continue de marcher :
-- les écrans Communauté et Parrainage affichent « bientôt disponible », le partage en story reste.
-- Pour revenir en avant : rejouer 2026-11-18_cxs_social.sql (crée des tables vides), puis recopier
-- si besoin les lignes depuis archive_social. Testé par tests/sql/run-social.sh (aller, retour, aller).
-- =====================================================================
begin;

create schema if not exists archive_social;
revoke all on schema archive_social from public, anon, authenticated;

do $$
declare t text; pol record; suffixe text := to_char(clock_timestamp(), 'YYYYMMDD_HH24MISS');
begin
  -- Ordre : les tables qui en référencent d'autres d'abord (les clés étrangères suivent la table déplacée)
  foreach t in array array['cxs_soc_reactions', 'cxs_soc_signalements', 'cxs_soc_activites', 'cxs_soc_amis', 'cxs_recompenses', 'cxs_parrainages', 'cxs_soc_profils'] loop
    if to_regclass('public.' || t) is not null then
      for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
        execute format('drop policy %I on public.%I', pol.policyname, t);
      end loop;
      execute format('revoke all on public.%I from anon, authenticated, service_role', t);
      execute format('alter table public.%I set schema archive_social', t);
      execute format('alter table archive_social.%I rename to %I', t, t || '_' || suffixe);
    end if;
  end loop;
end $$;

drop function if exists public.cxs_soc_effacer_mes_donnees();
drop function if exists public.cxs_recompense_traiter(bigint, boolean, text);
drop function if exists public.cxs_soc_masquer_profil(uuid, boolean);
drop function if exists public.cxs_soc_moderer(bigint, boolean);
drop function if exists public.cxs_recompense_appliquer(bigint, text);
drop function if exists public.cxs_parrainage_premium(uuid);
drop function if exists public.cxs_parrainage_lier(text);
drop function if exists public.cxs_soc_amis_liste();
drop function if exists public.cxs_soc_ami_retirer(uuid);
drop function if exists public.cxs_soc_ami_repondre(uuid, boolean);
drop function if exists public.cxs_soc_ami_demander(text);
drop function if exists public.cxs_soc_signaler(bigint, text);
drop function if exists public.cxs_soc_reagir(bigint, text, boolean);
drop function if exists public.cxs_soc_fil(text, timestamptz, int);
drop function if exists public.cxs_soc_retirer(bigint);
drop function if exists public.cxs_soc_publier(text, text, jsonb, text);
drop function if exists public.cxs_soc_moi(timestamptz);
drop function if exists public.cxs_soc_mon_code(text);
drop function if exists public.cxs_soc_profil_enregistrer(text, text, boolean, text);
drop function if exists public.cxs_soc_uid();
drop function if exists public.cxs_soc_peut_voir(uuid, text, boolean);
drop function if exists public.cxs_soc_sont_amis(uuid, uuid);
drop function if exists public.cxs_soc_nouveau_code();

commit;
