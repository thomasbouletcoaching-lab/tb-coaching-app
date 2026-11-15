-- EXÉCUTÉ le 15/11 (rejouable). Archive brute des anciennes lignes des clients rattachés : rien n'est perdu faute de champ cible.
-- Table hors du bloc `cxs_member_data.data`, que l'app resynchronise en entier à chaque envoi. Lecture : le membre ses lignes, le coach tout.
create table if not exists public.cxs_legacy_rows (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.cxs_profiles(id) on delete cascade,
  tbl text not null check (tbl in ('carnet','nutri_log','mesures','onboarding')),
  k text not null, data jsonb not null, src_updated_at timestamptz,
  created_at timestamptz not null default now(), unique (user_id, tbl, k));
alter table public.cxs_legacy_rows enable row level security;
create policy cxs_legacy_rows_own_select on public.cxs_legacy_rows for select to authenticated using (user_id = auth.uid() or public.cxs_is_coach());
-- puis, pour carnet (k), nutri_log et mesures (d::text), onboarding ('onboarding') : insert ... join mig.client_map ... on conflict do nothing
