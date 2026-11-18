-- =====================================================================
-- 2026-11-18 · Partage, parrainage, amis et communauté
-- APPLIQUÉE en production le 2026-11-18 (migration Supabase « cxs_social_20261118 »), après « go » de Thomas.
--
-- CE QUE ÇA CHANGE
--   Crée 6 tables nouvelles (aucune table existante n'est modifiée) :
--     cxs_soc_profils       pseudo, avatar (emoji), code d'invitation, choix communauté et visibilité
--     cxs_soc_amis          demandes d'ami et amitiés acceptées
--     cxs_soc_activites     séances (et records) publiées : chiffres d'entraînement seulement
--     cxs_soc_reactions     encouragements (5 gestes possibles, aucun texte)
--     cxs_soc_signalements  signalements d'une publication, lus par le coach
--     cxs_parrainages       qui a invité qui, date d'inscription et de passage au Bâtisseur
--     cxs_recompenses       mois offerts au parrain (un par filleul, 6 par an au plus) et analyse vidéo au palier 3
--   Le téléphone n'écrit JAMAIS directement dans ces tables : tout passe par des fonctions qui
--   vérifient les règles (lecture directe : ses propres lignes seulement ; le coach lit tout).
--
-- RÈGLES (testées par tests/sql/social_rls.sql)
--   · anon : aucun droit, sauf rien du tout (les liens partagés se lisent sans serveur).
--   · On ne voit une séance que si : c'est la sienne ; ou elle est « amis »/« communauté » et
--     l'auteur est un ami accepté ; ou elle est « communauté », que l'auteur ET le lecteur ont
--     rejoint la communauté. Une séance masquée par le coach n'est vue que par son auteur et le coach.
--   · Aucun échange possible : pas de texte libre (hors pseudo filtré), pas d'e-mail ni d'identifiant
--     d'un autre membre renvoyé par le fil de la communauté.
--   · Encourager : seulement une séance visible, pas la sienne, 300 gestes par jour au plus.
--   · Amis : par code d'invitation uniquement (des gens qu'on connaît), acceptation obligatoire.
--   · Parrainage : un seul parrain, lié dans les 30 jours après la création du compte, jamais soi-même.
--     La récompense n'est créée que par le serveur (webhook Stripe, service_role), une fois par filleul,
--     6 mois par an au plus ; au 3e filleul abonné, une analyse vidéo « à traiter » chez le coach.
--   · RGPD : cxs_soc_effacer_mes_donnees() efface profil social, amis, publications, gestes.
--
-- DONNÉES DE SANTÉ : aucune (pas de poids, de mensurations, de douleur, de nutrition).
-- Idempotente : peut être rejouée. Retour arrière : 2026-11-18_cxs_social_retour.sql (archive).
-- =====================================================================

begin;

-- ---------- Profil social ----------
create or replace function public.cxs_soc_nouveau_code() returns text
language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from public.cxs_soc_profils p where p.code = c);
  end loop;
  return c;
end $$;

create table if not exists public.cxs_soc_profils (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  pseudo      text not null check (char_length(pseudo) between 2 and 20 and pseudo !~ '[@<>/:]'),
  avatar      text not null default '🦁' check (char_length(avatar) <= 8),
  code        text unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  communaute  boolean not null default false,
  visibilite  text not null default 'communaute' check (visibilite in ('prive', 'amis', 'communaute')),
  masque      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.cxs_soc_profils enable row level security;

-- ---------- Amis ----------
create table if not exists public.cxs_soc_amis (
  demandeur    uuid not null references auth.users (id) on delete cascade,
  destinataire uuid not null references auth.users (id) on delete cascade,
  statut       text not null default 'attente' check (statut in ('attente', 'accepte')),
  created_at   timestamptz not null default now(),
  accepte_le   timestamptz,
  primary key (demandeur, destinataire),
  check (demandeur <> destinataire)
);
create index if not exists cxs_soc_amis_dest on public.cxs_soc_amis (destinataire);
alter table public.cxs_soc_amis enable row level security;

create or replace function public.cxs_soc_sont_amis(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cxs_soc_amis f where f.statut = 'accepte'
                 and ((f.demandeur = a and f.destinataire = b) or (f.demandeur = b and f.destinataire = a)))
$$;

-- ---------- Publications ----------
create table if not exists public.cxs_soc_activites (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  cle         text not null check (char_length(cle) between 1 and 80),
  type        text not null default 'seance' check (type in ('seance', 'record', 'programme')),
  data        jsonb not null check (pg_column_size(data) <= 2048),
  visibilite  text not null check (visibilite in ('amis', 'communaute')),
  masque      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, cle)
);
create index if not exists cxs_soc_activites_fil on public.cxs_soc_activites (created_at desc);
alter table public.cxs_soc_activites enable row level security;

create table if not exists public.cxs_soc_reactions (
  activite_id bigint not null references public.cxs_soc_activites (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  emoji       text not null check (emoji in ('muscle', 'feu', 'bravo', 'fusee', 'couronne')),
  created_at  timestamptz not null default now(),
  primary key (activite_id, user_id, emoji)
);
create index if not exists cxs_soc_reactions_user on public.cxs_soc_reactions (user_id, created_at desc);
alter table public.cxs_soc_reactions enable row level security;

create table if not exists public.cxs_soc_signalements (
  id          bigint generated always as identity primary key,
  activite_id bigint references public.cxs_soc_activites (id) on delete cascade,
  auteur      uuid not null references auth.users (id) on delete cascade,
  motif       text not null check (motif in ('contact', 'insulte', 'faux', 'autre')),
  traite_le   timestamptz,
  created_at  timestamptz not null default now(),
  unique (activite_id, auteur)
);
alter table public.cxs_soc_signalements enable row level security;

-- Le lecteur courant voit-il cette publication ?
create or replace function public.cxs_soc_peut_voir(p_auteur uuid, p_visibilite text, p_masque boolean) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
       p_auteur = auth.uid()
    or public.cxs_is_coach()
    or (not p_masque and (
          (p_visibilite in ('amis', 'communaute') and public.cxs_soc_sont_amis(p_auteur, auth.uid()))
       or (p_visibilite = 'communaute'
           and exists (select 1 from public.cxs_soc_profils m where m.user_id = auth.uid() and m.communaute and not m.masque)
           and exists (select 1 from public.cxs_soc_profils a where a.user_id = p_auteur and a.communaute and not a.masque)))))
$$;

-- ---------- Parrainage ----------
create table if not exists public.cxs_parrainages (
  filleul_id  uuid primary key references auth.users (id) on delete cascade,
  parrain_id  uuid not null references auth.users (id) on delete cascade,
  code        text not null,
  lie_le      timestamptz not null default now(),
  premium_le  timestamptz,
  check (filleul_id <> parrain_id)
);
create index if not exists cxs_parrainages_parrain on public.cxs_parrainages (parrain_id);
alter table public.cxs_parrainages enable row level security;

create table if not exists public.cxs_recompenses (
  id          bigint generated always as identity primary key,
  parrain_id  uuid not null references auth.users (id) on delete cascade,
  filleul_id  uuid not null references auth.users (id) on delete cascade,
  type        text not null default 'mois_offert' check (type in ('mois_offert', 'bonus_palier')),
  mode        text check (mode in ('prolongation', 'credit_stripe', 'coach')),
  statut      text not null default 'a_appliquer' check (statut in ('a_appliquer', 'accordee', 'a_traiter', 'refusee')),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  applique_le timestamptz
);
create index if not exists cxs_recompenses_parrain on public.cxs_recompenses (parrain_id);
-- Une récompense de chaque type par filleul (le mois offert ; l'analyse vidéo du palier 3 est rattachée au 3e filleul)
create unique index if not exists cxs_recompenses_unique on public.cxs_recompenses (filleul_id, type);
alter table public.cxs_recompenses enable row level security;

-- ---------- Droits : rien par défaut, lecture de ses lignes, le coach lit tout ----------
revoke all on public.cxs_soc_profils, public.cxs_soc_amis, public.cxs_soc_activites, public.cxs_soc_reactions,
  public.cxs_soc_signalements, public.cxs_parrainages, public.cxs_recompenses from anon, authenticated;
grant select on public.cxs_soc_profils, public.cxs_soc_amis, public.cxs_soc_activites, public.cxs_soc_reactions,
  public.cxs_soc_signalements, public.cxs_parrainages, public.cxs_recompenses to authenticated;
grant all on public.cxs_soc_profils, public.cxs_soc_amis, public.cxs_soc_activites, public.cxs_soc_reactions,
  public.cxs_soc_signalements, public.cxs_parrainages, public.cxs_recompenses to service_role;

drop policy if exists "soc profil : soi ou coach" on public.cxs_soc_profils;
create policy "soc profil : soi ou coach" on public.cxs_soc_profils for select to authenticated using (user_id = auth.uid() or public.cxs_is_coach());
drop policy if exists "soc amis : les deux ou coach" on public.cxs_soc_amis;
create policy "soc amis : les deux ou coach" on public.cxs_soc_amis for select to authenticated using (demandeur = auth.uid() or destinataire = auth.uid() or public.cxs_is_coach());
drop policy if exists "soc activites : soi ou coach" on public.cxs_soc_activites;
create policy "soc activites : soi ou coach" on public.cxs_soc_activites for select to authenticated using (user_id = auth.uid() or public.cxs_is_coach());
drop policy if exists "soc reactions : soi ou coach" on public.cxs_soc_reactions;
create policy "soc reactions : soi ou coach" on public.cxs_soc_reactions for select to authenticated using (user_id = auth.uid() or public.cxs_is_coach());
drop policy if exists "soc signalements : coach" on public.cxs_soc_signalements;
create policy "soc signalements : coach" on public.cxs_soc_signalements for select to authenticated using (public.cxs_is_coach());
drop policy if exists "parrainages : parrain, filleul ou coach" on public.cxs_parrainages;
create policy "parrainages : parrain, filleul ou coach" on public.cxs_parrainages for select to authenticated using (parrain_id = auth.uid() or filleul_id = auth.uid() or public.cxs_is_coach());
drop policy if exists "recompenses : parrain ou coach" on public.cxs_recompenses;
create policy "recompenses : parrain ou coach" on public.cxs_recompenses for select to authenticated using (parrain_id = auth.uid() or public.cxs_is_coach());

-- =====================================================================
-- Fonctions appelées par le téléphone (toutes vérifient auth.uid())
-- =====================================================================
create or replace function public.cxs_soc_uid() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise' using errcode = '42501'; end if;
  return auth.uid();
end $$;

-- Créer ou modifier son profil social. Le code d'invitation est créé une fois et ne change plus.
create or replace function public.cxs_soc_profil_enregistrer(p_pseudo text, p_avatar text, p_communaute boolean, p_visibilite text)
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); ps text := btrim(coalesce(p_pseudo, '')); r public.cxs_soc_profils;
begin
  if ps !~ '^[[:alnum:] ._-]{2,20}$' or ps ~* '(insta|snap|tiktok|whats|telegram|discord|onlyfans|http|www)' or regexp_replace(ps, '[ ._-]', '', 'g') ~ '[0-9]{5,}' then
    raise exception 'Pseudo refusé' using errcode = '22023';
  end if;
  if p_visibilite not in ('prive', 'amis', 'communaute') then raise exception 'Visibilité inconnue' using errcode = '22023'; end if;
  insert into public.cxs_soc_profils (user_id, pseudo, avatar, code, communaute, visibilite)
    values (me, ps, left(coalesce(nullif(p_avatar, ''), '🦁'), 8), public.cxs_soc_nouveau_code(), coalesce(p_communaute, false), p_visibilite)
  on conflict (user_id) do update set pseudo = excluded.pseudo, avatar = excluded.avatar, communaute = excluded.communaute,
    visibilite = excluded.visibilite, updated_at = now()
  returning * into r;
  return json_build_object('pseudo', r.pseudo, 'avatar', r.avatar, 'code', r.code, 'communaute', r.communaute, 'visibilite', r.visibilite);
end $$;

-- Code d'invitation seul (créé à la demande, avec un pseudo provisoire, pour pouvoir inviter avant d'avoir rejoint la communauté)
create or replace function public.cxs_soc_mon_code(p_pseudo text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); c text; ps text := btrim(coalesce(p_pseudo, ''));
begin
  select code into c from public.cxs_soc_profils where user_id = me;
  if c is not null then return c; end if;
  if ps !~ '^[[:alnum:] ._-]{2,20}$' then ps := 'Membre'; end if;
  insert into public.cxs_soc_profils (user_id, pseudo, code) values (me, ps, public.cxs_soc_nouveau_code())
    on conflict (user_id) do update set code = coalesce(public.cxs_soc_profils.code, excluded.code)
    returning code into c;
  return c;
end $$;

-- Tableau de bord social : profil, compteurs, série du supporter, parrainage
create or replace function public.cxs_soc_moi(p_depuis timestamptz default null) returns json
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); p public.cxs_soc_profils;
begin
  select * into p from public.cxs_soc_profils where user_id = me;
  return json_build_object(
    'profil', case when p.user_id is null then null else json_build_object('pseudo', p.pseudo, 'avatar', p.avatar, 'code', p.code, 'communaute', p.communaute, 'visibilite', p.visibilite, 'masque', p.masque) end,
    'donnes', (select count(*) from public.cxs_soc_reactions where user_id = me),
    'recus', (select count(*) from public.cxs_soc_reactions r join public.cxs_soc_activites a on a.id = r.activite_id where a.user_id = me),
    'recus_depuis', (select count(*) from public.cxs_soc_reactions r join public.cxs_soc_activites a on a.id = r.activite_id where a.user_id = me and r.created_at > coalesce(p_depuis, now())),
    'publies', (select count(*) from public.cxs_soc_activites where user_id = me),
    'par_jour', (select coalesce(json_object_agg(j, n), '{}'::json) from (select to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM-DD') j, count(*) n
                   from public.cxs_soc_reactions where user_id = me and created_at > now() - interval '60 days' group by 1) x),
    'amis', (select count(*) from public.cxs_soc_amis where statut = 'accepte' and (demandeur = me or destinataire = me)),
    'demandes', (select count(*) from public.cxs_soc_amis where statut = 'attente' and destinataire = me),
    'filleuls', (select count(*) from public.cxs_parrainages where parrain_id = me),
    'filleuls_premium', (select count(*) from public.cxs_parrainages where parrain_id = me and premium_le is not null),
    'recompenses', (select coalesce(json_agg(json_build_object('statut', statut, 'mode', mode, 'le', created_at) order by created_at desc), '[]'::json) from public.cxs_recompenses where parrain_id = me),
    'parrain', exists (select 1 from public.cxs_parrainages where filleul_id = me));
end $$;

-- Publier (ou republier sans doublon : même clé) une séance. Données filtrées : chiffres et noms seulement.
create or replace function public.cxs_soc_publier(p_cle text, p_type text, p_data jsonb, p_visibilite text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); d jsonb; t text; i bigint; rx text := '(@|https?:|www\.|[0-9][0-9 .-]{7,}|insta|snap|whats|telegram|tiktok|onlyfans|\.(com|fr|net|org|io|me|bio|ly)\M)';
begin
  if not exists (select 1 from public.cxs_soc_profils where user_id = me) then raise exception 'Profil social requis' using errcode = '42501'; end if;
  if p_visibilite not in ('amis', 'communaute') then raise exception 'Visibilité inconnue' using errcode = '22023'; end if;
  if p_type not in ('seance', 'record', 'programme') then raise exception 'Type inconnu' using errcode = '22023'; end if;
  if (select count(*) from public.cxs_soc_activites where user_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Trop de publications aujourd''hui' using errcode = '54000';
  end if;
  t := left(coalesce(p_data->>'titre', 'Séance'), 48);
  -- Liste blanche des champs, textes revérifiés (aucun contact)
  d := jsonb_strip_nulls(jsonb_build_object(
    'titre', case when t ~* rx then 'Séance' else t end,
    'min', case when jsonb_typeof(p_data->'min') = 'number' and (p_data->>'min')::numeric between 0 and 600 then p_data->'min' end,
    'series', case when jsonb_typeof(p_data->'series') = 'number' and (p_data->>'series')::numeric between 0 and 500 then p_data->'series' end,
    'exos', case when jsonb_typeof(p_data->'exos') = 'number' and (p_data->>'exos')::numeric between 0 and 60 then p_data->'exos' end,
    'tonnes', case when jsonb_typeof(p_data->'tonnes') = 'number' and (p_data->>'tonnes')::numeric between 0 and 200 then p_data->'tonnes' end,
    'medaille', case when p_data->>'medaille' in ('Fer', 'Bronze', 'Argent', 'Or', 'Platine', 'Diamant', 'Légende') then p_data->'medaille' end,
    'records', (select jsonb_agg(left(x, 40)) from (select jsonb_array_elements_text(case when jsonb_typeof(p_data->'records') = 'array' then p_data->'records' else '[]' end) x limit 3) r where x !~* rx),
    'top', (select jsonb_agg(left(x, 40)) from (select jsonb_array_elements_text(case when jsonb_typeof(p_data->'top') = 'array' then p_data->'top' else '[]' end) x limit 4) r where x !~* rx)));
  insert into public.cxs_soc_activites (user_id, cle, type, data, visibilite) values (me, left(p_cle, 80), p_type, d, p_visibilite)
    on conflict (user_id, cle) do update set data = excluded.data, visibilite = excluded.visibilite
    returning id into i;
  return i;
end $$;

create or replace function public.cxs_soc_retirer(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin delete from public.cxs_soc_activites where id = p_id and user_id = public.cxs_soc_uid(); end $$;

-- Fil : 'amis' (amis et moi), 'communaute' (tous les membres qui l'ont rejointe), 'moi'.
-- Ne renvoie ni e-mail, ni nom, ni identifiant d'un autre membre : pseudo et avatar seulement.
create or replace function public.cxs_soc_fil(p_portee text default 'communaute', p_avant timestamptz default null, p_limite int default 30)
returns table (id bigint, pseudo text, avatar text, type text, data jsonb, created_at timestamptz, moi boolean, ami boolean, reactions jsonb, mes_reactions text[])
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid();
begin
  return query
  select a.id, p.pseudo, p.avatar, a.type, a.data, a.created_at, a.user_id = me, public.cxs_soc_sont_amis(a.user_id, me),
    coalesce((select jsonb_object_agg(e, n) from (select r.emoji e, count(*) n from public.cxs_soc_reactions r where r.activite_id = a.id group by 1) x), '{}'::jsonb),
    coalesce((select array_agg(r.emoji) from public.cxs_soc_reactions r where r.activite_id = a.id and r.user_id = me), '{}')
  from public.cxs_soc_activites a join public.cxs_soc_profils p on p.user_id = a.user_id
  where (p_avant is null or a.created_at < p_avant)
    and public.cxs_soc_peut_voir(a.user_id, a.visibilite, a.masque or p.masque)
    and case p_portee when 'moi' then a.user_id = me
                      when 'amis' then a.user_id = me or public.cxs_soc_sont_amis(a.user_id, me)
                      else a.visibilite = 'communaute' or a.user_id = me end
  order by a.created_at desc
  limit least(greatest(coalesce(p_limite, 30), 1), 50);
end $$;

-- Encourager (p_on = true) ou retirer son geste
create or replace function public.cxs_soc_reagir(p_activite bigint, p_emoji text, p_on boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); a public.cxs_soc_activites; pm boolean;
begin
  select * into a from public.cxs_soc_activites where id = p_activite;
  select masque into pm from public.cxs_soc_profils where user_id = a.user_id;
  if a.id is null or not public.cxs_soc_peut_voir(a.user_id, a.visibilite, a.masque or coalesce(pm, false)) then raise exception 'Publication introuvable' using errcode = '42501'; end if;
  if a.user_id = me then raise exception 'On n''encourage pas sa propre séance' using errcode = '42501'; end if;
  if not exists (select 1 from public.cxs_soc_profils where user_id = me) then raise exception 'Profil social requis' using errcode = '42501'; end if;
  if p_emoji not in ('muscle', 'feu', 'bravo', 'fusee', 'couronne') then raise exception 'Geste inconnu' using errcode = '22023'; end if;
  if p_on then
    if (select count(*) from public.cxs_soc_reactions where user_id = me and created_at > now() - interval '1 day') >= 300 then
      raise exception 'Assez d''encouragements pour aujourd''hui' using errcode = '54000';
    end if;
    insert into public.cxs_soc_reactions (activite_id, user_id, emoji) values (p_activite, me, p_emoji) on conflict do nothing;
  else
    delete from public.cxs_soc_reactions where activite_id = p_activite and user_id = me and emoji = p_emoji;
  end if;
  return coalesce((select jsonb_object_agg(e, n) from (select r.emoji e, count(*) n from public.cxs_soc_reactions r where r.activite_id = p_activite group by 1) x), '{}'::jsonb);
end $$;

create or replace function public.cxs_soc_signaler(p_activite bigint, p_motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); a public.cxs_soc_activites;
begin
  select * into a from public.cxs_soc_activites where id = p_activite;
  if a.id is null or not public.cxs_soc_peut_voir(a.user_id, a.visibilite, a.masque) then raise exception 'Publication introuvable' using errcode = '42501'; end if;
  if p_motif not in ('contact', 'insulte', 'faux', 'autre') then raise exception 'Motif inconnu' using errcode = '22023'; end if;
  insert into public.cxs_soc_signalements (activite_id, auteur, motif) values (p_activite, me, p_motif) on conflict do nothing;
  -- 3 signalements : la publication est masquée en attendant que le coach regarde
  update public.cxs_soc_activites set masque = true where id = p_activite
    and (select count(*) from public.cxs_soc_signalements s where s.activite_id = p_activite and s.traite_le is null) >= 3;
end $$;

-- ---------- Amis ----------
create or replace function public.cxs_soc_ami_demander(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); cible uuid;
begin
  if not exists (select 1 from public.cxs_soc_profils where user_id = me) then raise exception 'Profil social requis' using errcode = '42501'; end if;
  select user_id into cible from public.cxs_soc_profils where code = upper(btrim(p_code));
  if cible is null then raise exception 'Code inconnu' using errcode = 'P0002'; end if;
  if cible = me then raise exception 'C''est ton propre code' using errcode = '22023'; end if;
  if public.cxs_soc_sont_amis(me, cible) then return 'deja'; end if;
  -- L'autre m'avait déjà demandé : on accepte directement
  if exists (select 1 from public.cxs_soc_amis where demandeur = cible and destinataire = me) then
    update public.cxs_soc_amis set statut = 'accepte', accepte_le = now() where demandeur = cible and destinataire = me;
    return 'accepte';
  end if;
  if (select count(*) from public.cxs_soc_amis where demandeur = me and statut = 'attente') >= 50 then
    raise exception 'Trop de demandes en attente' using errcode = '54000';
  end if;
  insert into public.cxs_soc_amis (demandeur, destinataire) values (me, cible) on conflict do nothing;
  return 'envoye';
end $$;

create or replace function public.cxs_soc_ami_repondre(p_demandeur uuid, p_accepte boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid();
begin
  if p_accepte then update public.cxs_soc_amis set statut = 'accepte', accepte_le = now() where demandeur = p_demandeur and destinataire = me and statut = 'attente';
  else delete from public.cxs_soc_amis where demandeur = p_demandeur and destinataire = me and statut = 'attente'; end if;
end $$;

create or replace function public.cxs_soc_ami_retirer(p_autre uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid();
begin delete from public.cxs_soc_amis where (demandeur = me and destinataire = p_autre) or (demandeur = p_autre and destinataire = me); end $$;

-- Mes amis et demandes, avec la semaine de chacun (podium entre amis)
create or replace function public.cxs_soc_amis_liste() returns table (autre uuid, pseudo text, avatar text, statut text, sens text, seances_7j bigint, donnes_7j bigint, derniere timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid();
begin
  return query
  select o.uid, p.pseudo, p.avatar, f.statut, case when f.demandeur = me then 'envoyee' else 'recue' end,
    case when f.statut = 'accepte' then (select count(*) from public.cxs_soc_activites a where a.user_id = o.uid and a.created_at > now() - interval '7 days') else 0 end,
    case when f.statut = 'accepte' then (select count(*) from public.cxs_soc_reactions r where r.user_id = o.uid and r.created_at > now() - interval '7 days') else 0 end,
    case when f.statut = 'accepte' then (select max(a.created_at) from public.cxs_soc_activites a where a.user_id = o.uid) end
  from public.cxs_soc_amis f
  cross join lateral (select case when f.demandeur = me then f.destinataire else f.demandeur end uid) o
  join public.cxs_soc_profils p on p.user_id = o.uid
  where f.demandeur = me or f.destinataire = me
  order by f.statut desc, p.pseudo;
end $$;

-- ---------- Parrainage ----------
-- Le filleul lie le code reçu (une seule fois, dans les 30 jours après la création du compte)
create or replace function public.cxs_parrainage_lier(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); parrain uuid; cree timestamptz; t text;
begin
  if exists (select 1 from public.cxs_parrainages where filleul_id = me) then return 'deja'; end if;
  select user_id into parrain from public.cxs_soc_profils where code = upper(btrim(p_code));
  if parrain is null then return 'inconnu'; end if;
  if parrain = me then return 'soi'; end if;
  -- pas de boucle : on ne parraine pas son propre parrain
  if exists (select 1 from public.cxs_parrainages where filleul_id = parrain and parrain_id = me) then return 'boucle'; end if;
  select created_at, tier into cree, t from public.cxs_profiles where id = me;
  if cree is not null and cree < now() - interval '30 days' then return 'trop_tard'; end if;
  if coalesce(t, 'free') <> 'free' then return 'deja_abonne'; end if;
  insert into public.cxs_parrainages (filleul_id, parrain_id, code) values (me, parrain, upper(btrim(p_code))) on conflict do nothing;
  -- Parrain et filleul deviennent amis (demande acceptée d'office : ils se connaissent)
  insert into public.cxs_soc_profils (user_id, pseudo, code)
    select me, 'Membre', public.cxs_soc_nouveau_code() where not exists (select 1 from public.cxs_soc_profils where user_id = me);
  insert into public.cxs_soc_amis (demandeur, destinataire, statut, accepte_le) values (parrain, me, 'accepte', now()) on conflict do nothing;
  return 'lie';
end $$;

-- Appelée par le webhook Stripe (service_role) quand un filleul passe Bâtisseur pour la première fois.
-- Crée au plus un mois offert par filleul, 6 par an et par parrain. Renvoie ce qu'il faut appliquer.
create or replace function public.cxs_parrainage_premium(p_filleul uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare pr public.cxs_parrainages; par public.cxs_profiles; rid bigint;
begin
  select * into pr from public.cxs_parrainages where filleul_id = p_filleul for update;
  if pr.filleul_id is null then return json_build_object('recompense', false, 'raison', 'sans_parrain'); end if;
  update public.cxs_parrainages set premium_le = coalesce(premium_le, now()) where filleul_id = p_filleul;
  if exists (select 1 from public.cxs_recompenses where filleul_id = p_filleul and type = 'mois_offert') then return json_build_object('recompense', false, 'raison', 'deja'); end if;
  -- Palier Ambassadeur : au 3e filleul abonné, une analyse vidéo de la technique, à traiter par le coach (une seule fois)
  if (select count(*) from public.cxs_parrainages where parrain_id = pr.parrain_id and premium_le is not null) >= 3
     and not exists (select 1 from public.cxs_recompenses where parrain_id = pr.parrain_id and type = 'bonus_palier') then
    insert into public.cxs_recompenses (parrain_id, filleul_id, type, mode, statut, note)
      values (pr.parrain_id, p_filleul, 'bonus_palier', 'coach', 'a_traiter', 'Palier Ambassadeur : analyse vidéo de la technique sur un exercice');
  end if;
  if (select count(*) from public.cxs_recompenses where parrain_id = pr.parrain_id and type = 'mois_offert' and created_at > now() - interval '365 days' and statut <> 'refusee') >= 6 then
    insert into public.cxs_recompenses (parrain_id, filleul_id, statut, note) values (pr.parrain_id, p_filleul, 'refusee', 'Plafond de 6 mois offerts par an atteint');
    return json_build_object('recompense', false, 'raison', 'plafond');
  end if;
  select * into par from public.cxs_profiles where id = pr.parrain_id;
  insert into public.cxs_recompenses (parrain_id, filleul_id, mode, statut)
    values (pr.parrain_id, p_filleul, case when par.is_coach or coalesce(par.tier, 'free') not in ('free', 'premium') then 'coach' end,
            case when par.is_coach or coalesce(par.tier, 'free') not in ('free', 'premium') then 'a_traiter' else 'a_appliquer' end)
    returning id into rid;
  return json_build_object('recompense', true, 'id', rid, 'parrain', pr.parrain_id, 'tier', coalesce(par.tier, 'free'), 'tier_until', par.tier_until,
                           'cree', par.created_at, 'coach', par.is_coach or coalesce(par.tier, 'free') not in ('free', 'premium'));
end $$;

-- Applique une récompense « a_appliquer » (service_role). mode = 'credit_stripe' (le webhook a crédité 1 mois sur
-- la prochaine facture) ou 'prolongation' (Bâtisseur ouvert 30 jours de plus, après l'essai s'il court encore).
create or replace function public.cxs_recompense_appliquer(p_id bigint, p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.cxs_recompenses; par public.cxs_profiles; base date;
begin
  if p_mode not in ('credit_stripe', 'prolongation') then raise exception 'Mode inconnu' using errcode = '22023'; end if;
  select * into r from public.cxs_recompenses where id = p_id and statut = 'a_appliquer' and type = 'mois_offert' for update;
  if r.id is null then return; end if;
  if p_mode = 'prolongation' then
    select * into par from public.cxs_profiles where id = r.parrain_id;
    if par.is_coach or coalesce(par.tier, 'free') not in ('free', 'premium') then
      update public.cxs_recompenses set mode = 'coach', statut = 'a_traiter' where id = p_id; return;
    end if;
    base := greatest(current_date, coalesce(par.tier_until, current_date), coalesce(par.created_at::date + 30, current_date));
    update public.cxs_profiles set tier = 'premium', tier_until = base + 30 where id = r.parrain_id;
  end if;
  update public.cxs_recompenses set mode = p_mode, statut = 'accordee', applique_le = now() where id = p_id;
end $$;

-- ---------- Coach : modération et récompenses ----------
create or replace function public.cxs_soc_moderer(p_activite bigint, p_masque boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.cxs_is_coach() then raise exception 'Réservé au coach' using errcode = '42501'; end if;
  update public.cxs_soc_activites set masque = p_masque where id = p_activite;
  update public.cxs_soc_signalements set traite_le = now() where activite_id = p_activite and traite_le is null;
end $$;
create or replace function public.cxs_soc_masquer_profil(p_user uuid, p_masque boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.cxs_is_coach() then raise exception 'Réservé au coach' using errcode = '42501'; end if;
  update public.cxs_soc_profils set masque = p_masque, updated_at = now() where user_id = p_user;
end $$;
create or replace function public.cxs_recompense_traiter(p_id bigint, p_accorde boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.cxs_is_coach() then raise exception 'Réservé au coach' using errcode = '42501'; end if;
  update public.cxs_recompenses set statut = case when p_accorde then 'accordee' else 'refusee' end, applique_le = now(), note = left(p_note, 200)
   where id = p_id and statut = 'a_traiter';
end $$;

-- ---------- RGPD ----------
create or replace function public.cxs_soc_effacer_mes_donnees() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid();
begin
  delete from public.cxs_soc_reactions where user_id = me;
  delete from public.cxs_soc_activites where user_id = me;
  delete from public.cxs_soc_amis where demandeur = me or destinataire = me;
  delete from public.cxs_soc_signalements where auteur = me;
  delete from public.cxs_soc_profils where user_id = me;
  -- Le lien de parrainage est gardé (il ouvre droit à la récompense du parrain), sans aucune donnée sociale.
end $$;

-- ---------- Droits d'exécution ----------
revoke all on function public.cxs_soc_nouveau_code(), public.cxs_soc_sont_amis(uuid, uuid), public.cxs_soc_peut_voir(uuid, text, boolean),
  public.cxs_soc_uid(), public.cxs_soc_profil_enregistrer(text, text, boolean, text), public.cxs_soc_mon_code(text), public.cxs_soc_moi(timestamptz),
  public.cxs_soc_publier(text, text, jsonb, text), public.cxs_soc_retirer(bigint), public.cxs_soc_fil(text, timestamptz, int),
  public.cxs_soc_reagir(bigint, text, boolean), public.cxs_soc_signaler(bigint, text), public.cxs_soc_ami_demander(text),
  public.cxs_soc_ami_repondre(uuid, boolean), public.cxs_soc_ami_retirer(uuid), public.cxs_soc_amis_liste(),
  public.cxs_parrainage_lier(text), public.cxs_parrainage_premium(uuid), public.cxs_recompense_appliquer(bigint, text),
  public.cxs_soc_moderer(bigint, boolean), public.cxs_soc_masquer_profil(uuid, boolean), public.cxs_recompense_traiter(bigint, boolean, text),
  public.cxs_soc_effacer_mes_donnees() from public, anon, authenticated;
grant execute on function public.cxs_soc_sont_amis(uuid, uuid), public.cxs_soc_peut_voir(uuid, text, boolean), public.cxs_soc_uid(),
  public.cxs_soc_profil_enregistrer(text, text, boolean, text), public.cxs_soc_mon_code(text), public.cxs_soc_moi(timestamptz),
  public.cxs_soc_publier(text, text, jsonb, text), public.cxs_soc_retirer(bigint), public.cxs_soc_fil(text, timestamptz, int),
  public.cxs_soc_reagir(bigint, text, boolean), public.cxs_soc_signaler(bigint, text), public.cxs_soc_ami_demander(text),
  public.cxs_soc_ami_repondre(uuid, boolean), public.cxs_soc_ami_retirer(uuid), public.cxs_soc_amis_liste(),
  public.cxs_parrainage_lier(text), public.cxs_soc_moderer(bigint, boolean), public.cxs_soc_masquer_profil(uuid, boolean),
  public.cxs_recompense_traiter(bigint, boolean, text), public.cxs_soc_effacer_mes_donnees() to authenticated;
grant execute on function public.cxs_soc_nouveau_code(), public.cxs_parrainage_premium(uuid), public.cxs_recompense_appliquer(bigint, text),
  public.cxs_soc_sont_amis(uuid, uuid) to service_role;

commit;
