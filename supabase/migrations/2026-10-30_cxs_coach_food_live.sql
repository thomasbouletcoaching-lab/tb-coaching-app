-- Plan alimentaire écrit par le coach (un par membre) et séance en direct partagée coach / membre.
-- Le coach lit et écrit tout ; le membre lit son plan (et, pour la séance en direct, écrit aussi).

create table if not exists public.cxs_coach_food_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cxs_coach_food_plans enable row level security;
create policy "cxs coach lit les plans alimentaires" on public.cxs_coach_food_plans for select to authenticated using (public.cxs_is_coach());
create policy "cxs coach crée un plan alimentaire" on public.cxs_coach_food_plans for insert to authenticated with check (public.cxs_is_coach());
create policy "cxs coach modifie un plan alimentaire" on public.cxs_coach_food_plans for update to authenticated using (public.cxs_is_coach()) with check (public.cxs_is_coach());
create policy "cxs coach supprime un plan alimentaire" on public.cxs_coach_food_plans for delete to authenticated using (public.cxs_is_coach());
create policy "cxs membre lit son plan alimentaire" on public.cxs_coach_food_plans for select to authenticated using (user_id = auth.uid());

create table if not exists public.cxs_live_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cxs_live_sessions enable row level security;
create policy "cxs séance en direct : membre ou coach" on public.cxs_live_sessions for all to authenticated
  using (user_id = auth.uid() or public.cxs_is_coach()) with check (user_id = auth.uid() or public.cxs_is_coach());
