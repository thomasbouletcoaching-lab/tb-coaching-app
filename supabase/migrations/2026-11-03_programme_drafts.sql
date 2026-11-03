-- Constructeur de programme par volume hebdomadaire (écran « Volume de la semaine »).
-- Une ligne = le brouillon d'un auteur pour un membre (member_id = l'auteur lui-même pour son propre programme),
-- ou ses seuils MV/MEV/MAV/MRV personnalisés (kind = 'seuils').
-- Additive : ne touche à aucune autre table.

create table if not exists public.programme_drafts (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  member_id  uuid not null references auth.users(id) on delete cascade,
  kind       text not null default 'draft' check (kind in ('draft', 'seuils')),
  status     text not null default 'draft' check (status in ('draft', 'publie')),
  name       text,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (owner, member_id, kind)
);

alter table public.programme_drafts enable row level security;

-- L'auteur gère ses propres lignes (coach pour ses membres, membre pour lui-même)
create policy "drafts : l'auteur lit"
  on public.programme_drafts for select to authenticated
  using (owner = (select auth.uid()));
create policy "drafts : l'auteur crée"
  on public.programme_drafts for insert to authenticated
  with check (owner = (select auth.uid()) and (member_id = (select auth.uid()) or public.cxs_is_coach()));
create policy "drafts : l'auteur modifie"
  on public.programme_drafts for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and (member_id = (select auth.uid()) or public.cxs_is_coach()));
create policy "drafts : l'auteur supprime"
  on public.programme_drafts for delete to authenticated
  using (owner = (select auth.uid()));

-- Le membre lit les seuils que son coach a réglés pour lui (affichés dans ses jauges)
create policy "drafts : le membre lit ses seuils"
  on public.programme_drafts for select to authenticated
  using (member_id = (select auth.uid()) and kind = 'seuils');

create index if not exists programme_drafts_member_idx on public.programme_drafts (member_id, kind);
