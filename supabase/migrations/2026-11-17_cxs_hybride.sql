-- =====================================================================
-- 2026-11-17 · Programme « athlète hybride », quêtes, personnage
-- APPLIQUÉE en production le 2026-11-17 à 19 h 31 (migration Supabase « cxs_hybride_20261117 »), après « go » de Thomas.
--
-- CE QUE ÇA CHANGE
--   Crée 5 tables nouvelles (aucune table existante n'est modifiée) :
--     cxs_hyb_bloc          bloc en cours (macro, date de début, nombre de séances) : écrit par le membre
--     cxs_hyb_personnage    apparence (écrite par le membre) et objets débloqués (écrits par le serveur)
--     cxs_hyb_quetes        progression des quêtes : écrite par le serveur seulement
--     cxs_hyb_xp            événements d'XP, une clé unique par événement (idempotent) : serveur seulement
--     cxs_hyb_consentement  consentement d'un abonné en autonomie au suivi par le coach : séparé, révocable
--   Et 4 fonctions : cxs_hyb_coache(uid), cxs_hyb_coach_peut_lire(uid), cxs_hyb_consentir(bool),
--   cxs_hyb_effacer_mes_donnees().
--
-- RÈGLES D'ACCÈS (testées par tests/sql/hybride_rls.sql)
--   · Un membre ne lit que ses lignes.
--   · Le coach lit un client coaché (formule avance, surmesure ou invité,
--     non échue : tier_until vide ou à venir).
--   · Le coach lit un abonné en autonomie seulement si son consentement est actif.
--   · Personne d'autre ne lit rien (anon : aucun droit).
--   · XP, quêtes et objets débloqués : jamais écrits par le téléphone (aucun droit d'écriture
--     pour « authenticated »). Écriture par le service_role (fonction serveur, session 2).
--   · Le membre peut tout effacer (RGPD) avec cxs_hyb_effacer_mes_donnees().
--
-- DONNÉES DE SANTÉ : aucune. La forme du matin et le sommeil restent dans la routine existante.
-- Idempotente : peut être rejouée sans erreur ni doublon.
-- Retour arrière : supabase/migrations/2026-11-17_cxs_hybride_retour.sql (archive, ne supprime rien).
-- =====================================================================

begin;

-- ---------- Qui est coaché ? ----------
-- Décision de Thomas (17/11/2026, Q2) : Coaching personnalisé (avance), Élite (surmesure) et Invité.
create or replace function public.cxs_hyb_coache(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.tier in ('avance', 'surmesure', 'invite')
                       and (p.tier_until is null or p.tier_until >= current_date)
                   from public.cxs_profiles p where p.id = p_uid), false)
$$;

-- ---------- Consentement d'un abonné en autonomie ----------
create table if not exists public.cxs_hyb_consentement (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  accorde_le  timestamptz,
  revoque_le  timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.cxs_hyb_consentement enable row level security;

-- Le coach peut-il lire les données hybrides de ce membre ?
create or replace function public.cxs_hyb_coach_peut_lire(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.cxs_is_coach()
     and (public.cxs_hyb_coache(p_uid)
          or exists (select 1 from public.cxs_hyb_consentement c
                     where c.user_id = p_uid and c.accorde_le is not null
                       and (c.revoque_le is null or c.revoque_le < c.accorde_le)))
$$;

-- Donner ou retirer son consentement (le membre lui-même uniquement)
create or replace function public.cxs_hyb_consentir(p_accord boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  if p_accord is null then raise exception 'Réponse attendue : oui ou non' using errcode = '22004'; end if;
  insert into public.cxs_hyb_consentement (user_id, accorde_le, revoque_le)
  values (uid, case when p_accord then clock_timestamp() end, case when not p_accord then clock_timestamp() end)
  on conflict (user_id) do update
    set accorde_le = case when p_accord then clock_timestamp() else cxs_hyb_consentement.accorde_le end,
        revoque_le = case when not p_accord then clock_timestamp() else cxs_hyb_consentement.revoque_le end,
        updated_at = clock_timestamp();
end
$$;

-- ---------- Bloc en cours ----------
create table if not exists public.cxs_hyb_bloc (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  macro_id    text not null check (macro_id in ('M1', 'M2', 'M3', 'M4')),
  debut       date not null,
  nb_seances  smallint not null check (nb_seances between 3 and 6),
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 65536),
  updated_at  timestamptz not null default now()
);
alter table public.cxs_hyb_bloc enable row level security;

-- ---------- Personnage ----------
create table if not exists public.cxs_hyb_personnage (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  apparence   jsonb not null default '{}'::jsonb check (pg_column_size(apparence) < 8192),
  debloques   jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.cxs_hyb_personnage enable row level security;

-- ---------- Quêtes ----------
create table if not exists public.cxs_hyb_quetes (
  user_id     uuid not null references auth.users (id) on delete cascade,
  quete_id    text not null,
  periode     text not null,              -- ex. 2026-12-07 (jour), 2026-S50 (semaine), M1-meso1 (bloc)
  progres     jsonb not null default '{}'::jsonb,
  reussie_le  timestamptz,
  primary key (user_id, quete_id, periode)
);
alter table public.cxs_hyb_quetes enable row level security;

-- ---------- Événements d'XP ----------
create table if not exists public.cxs_hyb_xp (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  cle         text not null,              -- clé déterministe dérivée du log (ex. seance:2026-12-07:<id>)
  source      text not null check (source in ('regularite', 'technique', 'recuperation', 'decharge', 'test', 'record', 'quete')),
  xp          integer not null check (xp between 0 and 500),
  cree_le     timestamptz not null default now(),
  unique (user_id, cle)
);
alter table public.cxs_hyb_xp enable row level security;
create index if not exists cxs_hyb_xp_user on public.cxs_hyb_xp (user_id, cree_le);

-- ---------- Droits de base : rien pour anon, lecture pour authenticated ----------
revoke all on public.cxs_hyb_consentement, public.cxs_hyb_bloc, public.cxs_hyb_personnage,
              public.cxs_hyb_quetes, public.cxs_hyb_xp from anon, authenticated;
grant select on public.cxs_hyb_consentement, public.cxs_hyb_bloc, public.cxs_hyb_personnage,
               public.cxs_hyb_quetes, public.cxs_hyb_xp to authenticated;
-- Le membre écrit son bloc et l'apparence de son personnage, rien d'autre
grant insert (user_id, macro_id, debut, nb_seances, data), update (macro_id, debut, nb_seances, data, updated_at), delete
  on public.cxs_hyb_bloc to authenticated;
grant insert (user_id, apparence), update (apparence, updated_at) on public.cxs_hyb_personnage to authenticated;
grant all on public.cxs_hyb_consentement, public.cxs_hyb_bloc, public.cxs_hyb_personnage,
             public.cxs_hyb_quetes, public.cxs_hyb_xp to service_role;
revoke all on sequence public.cxs_hyb_xp_id_seq from anon, authenticated;

-- ---------- Politiques ----------
drop policy if exists "hyb consentement : soi ou coach lit" on public.cxs_hyb_consentement;
create policy "hyb consentement : soi ou coach lit" on public.cxs_hyb_consentement
  for select to authenticated using (user_id = (select auth.uid()) or (select public.cxs_is_coach()));

drop policy if exists "hyb bloc : lire" on public.cxs_hyb_bloc;
create policy "hyb bloc : lire" on public.cxs_hyb_bloc
  for select to authenticated using (user_id = (select auth.uid()) or public.cxs_hyb_coach_peut_lire(user_id));
drop policy if exists "hyb bloc : créer le sien" on public.cxs_hyb_bloc;
create policy "hyb bloc : créer le sien" on public.cxs_hyb_bloc
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "hyb bloc : modifier le sien" on public.cxs_hyb_bloc;
create policy "hyb bloc : modifier le sien" on public.cxs_hyb_bloc
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "hyb bloc : supprimer le sien" on public.cxs_hyb_bloc;
create policy "hyb bloc : supprimer le sien" on public.cxs_hyb_bloc
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "hyb personnage : lire" on public.cxs_hyb_personnage;
create policy "hyb personnage : lire" on public.cxs_hyb_personnage
  for select to authenticated using (user_id = (select auth.uid()) or public.cxs_hyb_coach_peut_lire(user_id));
drop policy if exists "hyb personnage : créer le sien" on public.cxs_hyb_personnage;
create policy "hyb personnage : créer le sien" on public.cxs_hyb_personnage
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "hyb personnage : modifier le sien" on public.cxs_hyb_personnage;
create policy "hyb personnage : modifier le sien" on public.cxs_hyb_personnage
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "hyb quêtes : lire" on public.cxs_hyb_quetes;
create policy "hyb quêtes : lire" on public.cxs_hyb_quetes
  for select to authenticated using (user_id = (select auth.uid()) or public.cxs_hyb_coach_peut_lire(user_id));

drop policy if exists "hyb xp : lire" on public.cxs_hyb_xp;
create policy "hyb xp : lire" on public.cxs_hyb_xp
  for select to authenticated using (user_id = (select auth.uid()) or public.cxs_hyb_coach_peut_lire(user_id));

-- ---------- Effacer toutes ses données hybrides (RGPD) ----------
create or replace function public.cxs_hyb_effacer_mes_donnees()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  delete from public.cxs_hyb_xp where user_id = uid;
  delete from public.cxs_hyb_quetes where user_id = uid;
  delete from public.cxs_hyb_personnage where user_id = uid;
  delete from public.cxs_hyb_bloc where user_id = uid;
  delete from public.cxs_hyb_consentement where user_id = uid;
end
$$;

-- ---------- Droits d'exécution des fonctions ----------
revoke all on function public.cxs_hyb_coache(uuid) from public, anon, authenticated;
grant execute on function public.cxs_hyb_coache(uuid) to service_role;
revoke all on function public.cxs_hyb_coach_peut_lire(uuid) from public, anon;
grant execute on function public.cxs_hyb_coach_peut_lire(uuid) to authenticated;
revoke all on function public.cxs_hyb_consentir(boolean) from public, anon;
grant execute on function public.cxs_hyb_consentir(boolean) to authenticated;
revoke all on function public.cxs_hyb_effacer_mes_donnees() from public, anon;
grant execute on function public.cxs_hyb_effacer_mes_donnees() to authenticated;

commit;
