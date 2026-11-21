-- Refonte coach, étape 2 (appliquée le 21/11/2026, nom MCP : cxs_refonte_etape2)
-- cxs_invites : athlète préparé avant son inscription (code coach) ; cxs_invite_claim : rattachement à l'inscription (code ou e-mail)
-- cxs_coach_public : absence, annonces, sondages, défis (lecture membres, écriture coach)
-- cxs_poll_votes + cxs_poll_results : votes ; cxs_defi_parts : classement des défis de groupe
create table if not exists public.cxs_invites (code text primary key, email text, name text, tier text, tier_until date, program jsonb, settings jsonb, note text,
  created_at timestamptz not null default now(), used_by uuid references auth.users(id) on delete set null, used_at timestamptz);
alter table public.cxs_invites enable row level security;
create policy "cxs coach gère les invitations" on public.cxs_invites for all to authenticated using ((select public.cxs_is_coach())) with check ((select public.cxs_is_coach()));
-- cxs_invite_claim(p_code text default null) returns jsonb, security definer : voir la version appliquée en base
-- (marque l'invitation utilisée, pose formule, nom, programme et réglages du coach pour auth.uid()) ; execute réservé à authenticated.
create table if not exists public.cxs_coach_public (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
alter table public.cxs_coach_public enable row level security;
-- lecture : tout membre connecté ; ajout, modif, retrait : coach (cxs_is_coach)
create table if not exists public.cxs_poll_votes (poll_id text not null, user_id uuid not null references auth.users(id) on delete cascade default auth.uid(), choice int not null, at timestamptz not null default now(), primary key (poll_id, user_id));
alter table public.cxs_poll_votes enable row level security;
-- lecture : son vote ou coach ; vote et changement : le sien ; totaux via cxs_poll_results(p_id) (security definer)
create table if not exists public.cxs_defi_parts (defi_id text not null, user_id uuid not null references auth.users(id) on delete cascade default auth.uid(), alias text not null, value numeric not null default 0, updated_at timestamptz not null default now(), primary key (defi_id, user_id));
alter table public.cxs_defi_parts enable row level security;
-- lecture : membres connectés (prénom et score) ; ajout et mise à jour : le sien ; retrait : le sien ou coach
