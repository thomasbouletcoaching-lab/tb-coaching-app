-- Réglages du coach pour chaque membre (refonte de l'espace coach, 21/11/2026) :
-- bilans (activés, jour, fréquence, questions en plus) et échéances (compétition, bilan, fin de cycle…).
-- Le coach écrit, le membre lit les siens. Aucune donnée de santé ici.
create table if not exists public.cxs_coach_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cxs_coach_settings enable row level security;

create policy "cxs membre lit ses réglages coach"
  on public.cxs_coach_settings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "cxs coach lit les réglages"
  on public.cxs_coach_settings for select to authenticated
  using ((select public.cxs_is_coach()));

create policy "cxs coach crée les réglages"
  on public.cxs_coach_settings for insert to authenticated
  with check ((select public.cxs_is_coach()));

create policy "cxs coach modifie les réglages"
  on public.cxs_coach_settings for update to authenticated
  using ((select public.cxs_is_coach())) with check ((select public.cxs_is_coach()));

create policy "cxs coach supprime les réglages"
  on public.cxs_coach_settings for delete to authenticated
  using ((select public.cxs_is_coach()));
