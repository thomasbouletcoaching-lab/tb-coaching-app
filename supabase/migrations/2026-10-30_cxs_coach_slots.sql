-- Décalages de séances faits par le coach (agenda « Aujourd'hui »).
-- Stockés à part de cxs_member_data pour que la synchronisation de l'app client
-- ne les écrase jamais. À relire puis appliquer dans le tableau de bord Supabase.

create table if not exists public.cxs_coach_slots (
  user_id   uuid not null references auth.users(id) on delete cascade,
  orig_d    date not null,              -- jour d'origine de la séance
  new_d     date not null,              -- nouveau jour
  new_time  text,                       -- nouvelle heure « HH:MM » (optionnelle)
  updated_at timestamptz not null default now(),
  primary key (user_id, orig_d)
);

alter table public.cxs_coach_slots enable row level security;

-- Le membre lit ses propres décalages
create policy "cxs membre lit ses décalages"
  on public.cxs_coach_slots for select to authenticated
  using (user_id = auth.uid());

-- Le coach lit, crée, modifie et supprime les décalages de tous les membres
create policy "cxs coach lit les décalages"
  on public.cxs_coach_slots for select to authenticated
  using (public.cxs_is_coach());

create policy "cxs coach crée des décalages"
  on public.cxs_coach_slots for insert to authenticated
  with check (public.cxs_is_coach());

create policy "cxs coach modifie des décalages"
  on public.cxs_coach_slots for update to authenticated
  using (public.cxs_is_coach()) with check (public.cxs_is_coach());

create policy "cxs coach supprime des décalages"
  on public.cxs_coach_slots for delete to authenticated
  using (public.cxs_is_coach());

-- Le membre ne peut ni écrire ni modifier ces lignes (seul le coach le fait)
