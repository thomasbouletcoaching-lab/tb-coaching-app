create schema if not exists mig;
alter table public.cxs_messages
  add column if not exists media jsonb default '[]'::jsonb,
  add column if not exists reply_to bigint references public.cxs_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists ref text,
  add column if not exists legacy_id uuid;
create unique index if not exists cxs_messages_legacy_id_uq on public.cxs_messages(legacy_id) where legacy_id is not null;

create table if not exists mig.client_map (
  client_id uuid primary key, user_id uuid,
  statut text not null check (statut in ('auto','manuel','en_attente')),
  maj timestamptz not null default now());
create table if not exists mig.rejets (
  id bigint generated always as identity primary key,
  tbl text not null, legacy_id text, motif text not null, at timestamptz not null default now());

create table if not exists public.cxs_program_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.cxs_profiles(id) on delete cascade,
  kind text not null check (kind in ('prog_hist','cycle')),
  legacy_id uuid not null, payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (kind, legacy_id));
alter table public.cxs_program_history enable row level security;
create policy cxs_program_history_own_select on public.cxs_program_history
  for select to authenticated using (user_id = auth.uid());
-- Aucune politique d'écriture : seule la migration (rôle service) écrit.
