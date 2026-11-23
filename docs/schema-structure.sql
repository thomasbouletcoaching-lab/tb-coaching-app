-- Structure PARTIELLE du projet Supabase xtapitojdvicgcaygeqj (lecture seule, 14 novembre 2026).
-- Périmètre : tables touchées par les fichiers (a) à (e), fonctions cxs_migration.* et public.* concernées,
-- politiques RLS de ces tables, extensions. Le reste du schéma public (compta_*, cpta_*, biz_*, gx_*, etc.) n'est PAS exporté.
-- Aucune donnée de table n'a été lue. Les clés étrangères vers auth.users sont omises (schéma auth absent de la base de test).
-- Les ACL des fonctions sont données en commentaires ; elles ne sont pas rejouées ici.

create schema if not exists cxs_migration;

-- ============ Tables ============

create table public.cxs_profiles (
  id uuid primary key,
  email text,
  name text,
  onboarding jsonb,
  stats jsonb,
  tier text not null,
  tier_until date,
  is_coach boolean not null,
  created_at timestamptz not null,
  last_seen timestamptz
);

create table public.cxs_tiers (
  id text primary key,
  rank integer not null,
  name text not null,
  msgs_per_week integer
);

create table public.cxs_member_data (
  user_id uuid primary key,
  data jsonb not null,
  summary jsonb not null,
  updated_at timestamptz not null
);

create table public.cxs_messages (
  id bigint primary key,
  user_id uuid not null,
  sender uuid not null,
  body text not null,
  created_at timestamptz not null,
  read_at timestamptz,
  reactions jsonb not null,
  audio_path text
);

create table public.cxs_live_sessions (
  user_id uuid primary key,
  state jsonb not null,
  updated_at timestamptz not null
);

create table public.nutri_daily (
  user_id uuid not null,
  d date not null,
  kcal numeric, prot_g numeric, gluc_g numeric, lip_g numeric, fibres_g numeric, sucres_g numeric,
  sel_g numeric, sucres_ajoutes_g numeric, sodium_mg numeric, potassium_mg numeric, magnesium_mg numeric,
  zinc_mg numeric, vit_d_ug numeric, fer_mg numeric, calcium_mg numeric, vit_c_mg numeric,
  vit_b12_ug numeric, folate_ug numeric, coverage numeric,
  sweat_day boolean not null,
  updated_at timestamptz not null,
  primary key (user_id, d),
  check (coverage >= 0 and coverage <= 1)
);

create table public.app_private (
  k text primary key,
  v text not null
);

create table public.clients (
  id uuid primary key,
  coach_id uuid not null,
  email text,
  name text not null,
  archived boolean not null,
  program jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  nutrition jsonb not null
);

create table public.carnet (
  client_id uuid not null references public.clients(id) on delete cascade,
  k text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (client_id, k)
);

create table public.mesures (
  client_id uuid not null references public.clients(id) on delete cascade,
  d date not null,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (client_id, d)
);

create table public.nutri_log (
  client_id uuid not null references public.clients(id) on delete cascade,
  d date not null,
  data jsonb not null,
  updated_at timestamptz not null,
  primary key (client_id, d)
);

alter table public.cxs_profiles enable row level security;
alter table public.cxs_tiers enable row level security;
alter table public.cxs_member_data enable row level security;
alter table public.cxs_messages enable row level security;
alter table public.cxs_live_sessions enable row level security;
alter table public.nutri_daily enable row level security;
alter table public.app_private enable row level security;
alter table public.clients enable row level security;
alter table public.carnet enable row level security;
alter table public.mesures enable row level security;
alter table public.nutri_log enable row level security;

-- ============ Fonctions ============

create or replace function public.is_coach()
 returns boolean language sql stable security definer set search_path to 'public'
as $function$ select exists(select 1 from public.coaches where uid=auth.uid()) $function$;
-- ACL : PUBLIC, anon, authenticated, service_role, postgres (appelable sans connexion)

create or replace function public.cxs_is_coach()
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select coalesce((select is_coach from public.cxs_profiles where id = auth.uid()), false)
$function$;

create or replace function public.cxs_msgs_left(uid uuid default auth.uid())
 returns integer language sql stable security definer set search_path to 'public'
as $function$
  select case when t.msgs_per_week is null then null
    else greatest(0, t.msgs_per_week - (select count(*) from public.cxs_messages m
      where m.user_id = uid and m.sender = uid and m.created_at > now() - interval '7 days'))::int end
  from public.cxs_profiles p join public.cxs_tiers t on t.id = p.tier where p.id = uid
$function$;
-- ACL : anon, authenticated (appelable sans connexion) ; ne contrôle pas l'appelant

create or replace function public.cxs_set_tier(target uuid, new_tier text, until date default null::date)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.cxs_is_coach() then raise exception 'réservé au coach'; end if;
  update public.cxs_profiles set tier = new_tier, tier_until = until where id = target;
end $function$;
-- ACL : anon, authenticated

create or replace function public.cxs_notify_member_on_reply()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.sender <> new.user_id then
    insert into public.cxs_notifications (user_id, title, body) values (new.user_id, 'Nouveau message de Thomas', left(new.body, 140));
  end if;
  return new;
end $function$;
-- Déclencheur. Table cxs_notifications absente de ce fichier.

create or replace function public.messages_guard()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if (new.body is distinct from old.body or new.media is distinct from old.media or new.reply_to is distinct from old.reply_to
      or new.sender is distinct from old.sender or new.client_id is distinct from old.client_id or new.from_coach is distinct from old.from_coach
      or new.created_at is distinct from old.created_at or new.ref is distinct from old.ref) then
    if old.sender is distinct from auth.uid() then raise exception 'seul l''auteur peut modifier ce message'; end if;
    if new.body is distinct from old.body then new.edited_at := now(); end if;
  end if;
  return new;
end $function$;
-- Déclencheur sur la table messages (ancienne app), absente de ce fichier.

create or replace function cxs_migration.num(t text)
 returns numeric language sql immutable
as $function$
  select case when t ~ '^[0-9]+([.,][0-9]+)?$' then replace(t, ',', '.')::numeric end $function$;

create or replace function cxs_migration.food_for(p_client uuid)
 returns jsonb language sql stable security definer set search_path to 'public', 'cxs_migration'
as $function$
with meals as (
  select nl.d::text d, m.key mk, m.value mv, nl.updated_at
  from public.nutri_log nl cross join lateral jsonb_each(case when jsonb_typeof(nl.data->'m')='object' then nl.data->'m' else '{}'::jsonb end) m
  where nl.client_id = p_client
),
entries as (
  select d, (extract(epoch from updated_at)*1000)::bigint * 10 + row_number() over (partition by d order by mk::int) id,
    case mk::int when 0 then 'Petit-déjeuner' when 1 then 'Déjeuner' when 2 then 'Collation' when 3 then 'Dîner' else 'Collation' end meal,
    coalesce(nullif(mv->>'n',''), 'Repas') label,
    coalesce(mv->>'h', '') time,
    coalesce(cxs_migration.num(mv->'mac'->>'k')::int, 0) kcal,
    round(coalesce(cxs_migration.num(mv->'mac'->>'p'), 0), 1) p,
    round(coalesce(cxs_migration.num(mv->'mac'->>'g'), 0), 1) c,
    round(coalesce(cxs_migration.num(mv->'mac'->>'l'), 0), 1) f
  from meals
)
select coalesce(jsonb_object_agg(d, arr), '{}'::jsonb) from (
  select d, jsonb_agg(jsonb_build_object('id', id, 'meal', meal, 'label', label, 'time', nullif(time,''), 'kcal', kcal, 'p', p, 'c', c, 'f', f, 'g', null) order by time, id) arr
  from entries group by d
) g;
$function$;
-- ACL : PUBLIC (aucun REVOKE). Lit public.nutri_log sans contrôle du client.

create or replace function cxs_migration.history_for(p_client uuid)
 returns jsonb language sql stable security definer set search_path to 'public', 'cxs_migration'
as $function$
with prog as (
  select c.program->'sessions' sessions from public.clients c where c.id = p_client
),
rows_ as (
  select split_part(ca.k,'_',1)::int w, split_part(ca.k,'_',2)::int si, split_part(ca.k,'_',3)::int ei, ca.data, ca.updated_at
  from public.carnet ca
  where ca.client_id = p_client and ca.k ~ '^[0-9]+_[0-9]+_[0-9]+$'
),
ok as (
  select r.* from rows_ r, prog
  where r.w >= 1 and r.si < jsonb_array_length(prog.sessions)
    and r.ei < jsonb_array_length(coalesce(prog.sessions->r.si->'ex','[]'::jsonb))
    and jsonb_typeof(r.data->'sets') = 'array'
),
ex_rows as (
  select o.w, o.si, o.ei, o.updated_at,
    coalesce(o.data->>'ex', (p.sessions->o.si->'ex'->o.ei->>'name')) name,
    (select coalesce(jsonb_agg(jsonb_build_object(
        'kg', cxs_migration.num(x->>'g'), 'pkg', cxs_migration.num(x->>'g'),
        'reps', cxs_migration.num(x->>'h'), 'lo', cxs_migration.num(x->>'h'), 'hi', cxs_migration.num(x->>'h'),
        'rpe', cxs_migration.num(x->>'r'), 'trpe', coalesce(cxs_migration.num(x->>'r'), 8),
        'type', 'N', 'g', 0, 'done', ((x->>'d') in ('1','true')), 'tech', '[]'::jsonb, 'note', ''
      ) order by n), '[]'::jsonb)
      from jsonb_array_elements(o.data->'sets') with ordinality as t(x, n)
      where (x->>'d') in ('1','true') or cxs_migration.num(x->>'g') is not null or cxs_migration.num(x->>'h') is not null
    ) sets
  from ok o cross join prog p
  where o.si = o.si
),
workouts as (
  select w, si, max(updated_at) end_at,
    jsonb_agg(jsonb_build_object('name', name, 'kind', 'P', 'orig', name, 'sets', sets, 'note', '', 'tempo', null, 'rest', 90, 'unit', 'reps', 'bw', false) order by ei) exs,
    (select sessions->si->>'name' from prog) title
  from ex_rows
  group by w, si
)
select coalesce(jsonb_agg(jsonb_build_object(
  'id', (extract(epoch from end_at)*1000)::bigint + si,
  'week', w, 'idx', si, 'title', coalesce(title,''), 'free', false,
  'start', end_at, 'end', end_at, 'exercises', exs
) order by end_at), '[]'::jsonb)
from workouts;
$function$;
-- ACL : PUBLIC (aucun REVOKE).

create or replace function cxs_migration.measures_for(p_client uuid)
 returns jsonb language sql stable security definer set search_path to 'public', 'cxs_migration'
as $function$
select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'd', ms.d::text,
  'weight', cxs_migration.num(ms.data->>'poids'),
  'waist', cxs_migration.num(ms.data->>'taille'),
  'hips', cxs_migration.num(ms.data->>'hanches'),
  'chest', cxs_migration.num(ms.data->>'poitrine'),
  'arm', (select round(avg(v),1) from (values (cxs_migration.num(ms.data->>'bras_d')),(cxs_migration.num(ms.data->>'bras_g'))) t(v) where v is not null),
  'thigh', (select round(avg(v),1) from (values (cxs_migration.num(ms.data->>'cuisse_d')),(cxs_migration.num(ms.data->>'cuisse_g'))) t(v) where v is not null),
  'fat', cxs_migration.num(ms.data->>'mg')
)) order by ms.d), '[]'::jsonb)
from public.mesures ms where ms.client_id = p_client;
$function$;
-- ACL : PUBLIC (aucun REVOKE).

create or replace function cxs_migration.summary()
 returns table(client_no integer, workouts integer, exercises integer, sets_done integer)
 language sql stable security definer set search_path to 'public', 'cxs_migration'
as $function$
with c as (select row_number() over (order by created_at)::int n, id from public.clients where coalesce(archived,false)=false)
select c.n, jsonb_array_length(h.j),
  (select coalesce(sum(jsonb_array_length(e->'sets')),0) from jsonb_array_elements(h.j) w, jsonb_array_elements(w->'exercises') e)::int,
  (select coalesce(sum((select count(*) from jsonb_array_elements(e->'sets') s where (s->>'done')='true')),0) from jsonb_array_elements(h.j) w, jsonb_array_elements(w->'exercises') e)::int
from c cross join lateral (select cxs_migration.history_for(c.id) j) h
order by c.n;
$function$;
-- ACL : PUBLIC (aucun REVOKE).

create or replace function cxs_migration.dry_run()
 returns table(client_no integer, sessions integer, weeks integer, carnet_rows integer, valid_rows integer, invalid_rows integer, sets_total integer, sets_done integer, sets_with_load integer, est_workouts integer)
 language sql stable security definer set search_path to 'public', 'cxs_migration'
as $function$
-- Corps complet non recopié ici : voir pg_get_functiondef sur cxs_migration.dry_run (lu le 14/11/2026).
select null::int, null::int, null::int, null::int, null::int, null::int, null::int, null::int, null::int, null::int where false;
$function$;
-- ACL : postgres uniquement (fonction non appelable par l'API). Corps tronqué volontairement : stub à compléter si besoin.

-- ============ Politiques RLS ============

create policy "cxs séance en direct : membre ou coach" on public.cxs_live_sessions as permissive for all to authenticated
  using ((user_id = auth.uid()) or public.cxs_is_coach()) with check ((user_id = auth.uid()) or public.cxs_is_coach());

create policy "cxs lire ses données ou coach" on public.cxs_member_data as permissive for select to authenticated
  using ((user_id = auth.uid()) or public.cxs_is_coach());
create policy "cxs membre met à jour ses données" on public.cxs_member_data as permissive for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cxs membre supprime ses données" on public.cxs_member_data as permissive for delete to authenticated
  using (user_id = auth.uid());
create policy "cxs membre écrit ses données" on public.cxs_member_data as permissive for insert to authenticated
  with check (user_id = auth.uid());

create policy "cxs lire ses messages ou coach" on public.cxs_messages as permissive for select to authenticated
  using ((user_id = auth.uid()) or public.cxs_is_coach());
create policy "cxs marquer lu" on public.cxs_messages as permissive for update to authenticated
  using ((user_id = auth.uid()) or public.cxs_is_coach());
create policy "cxs membre écrit dans son fil (quota)" on public.cxs_messages as permissive for insert to authenticated
  with check ((sender = auth.uid()) and (public.cxs_is_coach() or ((user_id = auth.uid()) and (exists (
    select 1 from (public.cxs_profiles p join public.cxs_tiers t on ((t.id = p.tier)))
    where ((p.id = auth.uid()) and ((t.msgs_per_week is null) or (public.cxs_msgs_left() > 0))))))));

create policy "cxs lire son profil ou coach" on public.cxs_profiles as permissive for select to authenticated
  using ((id = auth.uid()) or public.cxs_is_coach());
create policy "cxs membre crée son profil" on public.cxs_profiles as permissive for insert to authenticated
  with check ((id = auth.uid()) and (is_coach = false));
create policy "cxs modifier son profil" on public.cxs_profiles as permissive for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "cxs paliers lisibles" on public.cxs_tiers as permissive for select to anon, authenticated
  using (true);

create policy "nutri lit ses totaux ou coach" on public.nutri_daily as permissive for select to authenticated
  using ((user_id = auth.uid()) or public.cxs_is_coach());
create policy "nutri met à jour ses totaux" on public.nutri_daily as permissive for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "nutri écrit ses totaux" on public.nutri_daily as permissive for insert to authenticated
  with check (user_id = auth.uid());

-- app_private : RLS activée, aucune politique (accès refusé aux rôles API).
-- clients, carnet, mesures, nutri_log : RLS activée ; politiques non exportées dans cette version.

-- ============ Extensions (projet, 14/11/2026) ============
-- pg_cron 1.6.4 (pg_catalog), pg_net 0.20.4 (public), pg_stat_statements 1.11 (extensions),
-- pg_walinspect 1.1 (public), pgcrypto 1.3 (extensions), plpgsql 1.0 (pg_catalog),
-- supabase_vault 0.3.1 (vault), uuid-ossp 1.1 (extensions)
