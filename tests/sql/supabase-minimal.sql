-- Socle minimal qui imite Supabase pour tester les règles d'accès en local (Postgres 15+).
-- Rôles anon / authenticated / service_role, schéma auth avec auth.uid() et auth.role(),
-- et les objets existants de production dont dépend la migration (cxs_profiles, cxs_is_coach),
-- recopiés depuis le schéma de production lu le 17/11/2026. Aucune donnée réelle.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
grant usage on schema auth, public to anon, authenticated, service_role;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
create table if not exists public.cxs_profiles (
  id uuid primary key, email text, name text, onboarding jsonb, stats jsonb,
  tier text default 'free', tier_until date, is_coach boolean default false,
  created_at timestamptz default now(), last_seen timestamptz);
alter table public.cxs_profiles enable row level security;
create or replace function public.cxs_is_coach() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select is_coach from public.cxs_profiles where id = auth.uid()), false) $$;
grant select on public.cxs_profiles to authenticated, service_role;
