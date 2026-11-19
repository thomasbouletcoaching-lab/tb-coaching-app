-- =====================================================================
-- 2026-11-19 · Liens de partage courts
-- Une séance ou un programme partagé est enregistré ici ; le lien ne porte plus que son identifiant
-- (…/tb-coaching-app/?p=K7m2Qx9a) au lieu de toute la séance encodée dans l'adresse.
--
-- CE QUE ÇA CHANGE
--   1 table nouvelle : cxs_soc_partages (aucune table existante modifiée).
--   2 fonctions : cxs_soc_partage_creer (membre connecté), cxs_soc_partage_lire (tout le monde, y compris
--   une personne sans compte qui ouvre le lien).
--
-- RÈGLES (testées par tests/sql/social_rls.sql)
--   · Personne ne lit la table directement ; on ne lit un partage qu'en connaissant son identifiant
--     (8 caractères aléatoires, 218 000 milliards de possibilités).
--   · Données en liste blanche : chiffres d'entraînement, noms d'exercices, pseudo ; jamais d'e-mail ni d'identifiant.
--   · 50 partages par jour et par membre au plus ; 16 Ko au plus par partage.
--   · Le partage est effacé avec le compte ou par cxs_soc_effacer_mes_donnees().
-- Idempotente. Retour arrière : drop function cxs_soc_partage_lire(text), cxs_soc_partage_creer(text, jsonb) ;
-- alter table cxs_soc_partages set schema archive_social (rien n'est supprimé).
-- =====================================================================

begin;

create table if not exists public.cxs_soc_partages (
  id          text primary key check (id ~ '^[A-Za-z0-9]{8}$'),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('seance', 'programme')),
  data        jsonb not null check (pg_column_size(data) <= 16384),
  created_at  timestamptz not null default now()
);
create index if not exists cxs_soc_partages_user on public.cxs_soc_partages (user_id, created_at desc);
alter table public.cxs_soc_partages enable row level security;
revoke all on public.cxs_soc_partages from anon, authenticated;
grant all on public.cxs_soc_partages to service_role;

create or replace function public.cxs_soc_partage_creer(p_type text, p_data jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); a text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; i text; k int;
begin
  if p_type not in ('seance', 'programme') then raise exception 'Type inconnu' using errcode = '22023'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 16384 then raise exception 'Partage trop gros' using errcode = '22023'; end if;
  if (select count(*) from public.cxs_soc_partages where user_id = me and created_at > now() - interval '1 day') >= 50 then
    raise exception 'Trop de partages aujourd''hui' using errcode = '54000';
  end if;
  loop
    i := '';
    for k in 1..8 loop i := i || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.cxs_soc_partages where id = i);
  end loop;
  insert into public.cxs_soc_partages (id, user_id, type, data) values (i, me, p_type, p_data - 'email' - 'user_id');
  return i;
end $$;

-- Lecture par l'identifiant : type, données et code d'invitation de l'auteur (pour l'essai de 37 jours et le parrainage)
create or replace function public.cxs_soc_partage_lire(p_id text) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('type', s.type, 'data', s.data, 'code', p.code)
  from public.cxs_soc_partages s left join public.cxs_soc_profils p on p.user_id = s.user_id
  where s.id = p_id and p_id ~ '^[A-Za-z0-9]{8}$'
$$;

-- L'effacement RGPD de la communauté efface aussi les partages
create or replace function public.cxs_soc_effacer_mes_donnees() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid();
begin
  delete from public.cxs_soc_reactions where user_id = me;
  delete from public.cxs_soc_activites where user_id = me;
  delete from public.cxs_soc_amis where demandeur = me or destinataire = me;
  delete from public.cxs_soc_signalements where auteur = me;
  delete from public.cxs_soc_partages where user_id = me;
  delete from public.cxs_soc_profils where user_id = me;
end $$;

revoke all on function public.cxs_soc_partage_creer(text, jsonb), public.cxs_soc_partage_lire(text), public.cxs_soc_effacer_mes_donnees() from public, anon, authenticated;
grant execute on function public.cxs_soc_partage_creer(text, jsonb), public.cxs_soc_effacer_mes_donnees() to authenticated;
grant execute on function public.cxs_soc_partage_lire(text) to anon, authenticated;

commit;
