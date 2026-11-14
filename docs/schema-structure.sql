-- Structure des objets référencés par les fichiers de sécurité (a) à (e).
-- Source : lecture du catalogue Supabase le 14/11/2026 (pg_attribute, pg_constraint). AUCUNE ligne de donnée.
-- Sert uniquement de stub pour les tests sur base locale tb_test. Ne pas appliquer en production.

create table if not exists public.app_private (k text primary key, v text not null);
create table if not exists public.app_private_log (id bigint primary key, k text not null, created_at timestamptz not null);
create table if not exists public.coaches (uid uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.gx_member (
  client_id uuid primary key references public.clients(id) on delete cascade,
  alias text not null, opt_in boolean not null, last_level integer not null,
  lvl_start date, updated_at timestamptz not null);
create table if not exists public.gx_events (
  id uuid primary key, client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null, label text not null, key text not null, created_at timestamptz not null,
  unique (client_id, key));
create table if not exists public.gx_reactions (
  event_id uuid not null references public.gx_events(id) on delete cascade,
  reactor_uid uuid not null, reactor_client uuid references public.clients(id) on delete cascade,
  emoji text not null, created_at timestamptz not null,
  primary key (event_id, reactor_uid, emoji));

alter table public.app_private enable row level security;
alter table public.app_private_log enable row level security;
alter table public.coaches enable row level security;
alter table public.gx_member enable row level security;
alter table public.gx_events enable row level security;
alter table public.gx_reactions enable row level security;
