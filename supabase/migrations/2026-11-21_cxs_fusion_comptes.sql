-- Fusion d'un compte athlète dans le compte coach (une seule app, une seule adresse)
-- 1) Le téléphone athlète dépose une copie complète de ses données dans cxs_transferts.
-- 2) Depuis le compte coach, cxs_fusion_comptes(src) rattache au coach tout ce qui appartenait au compte athlète.
-- Chaque ligne touchée est d'abord copiée dans cxs_fusion_backup : rien n'est perdu.

create table if not exists public.cxs_transferts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.cxs_transferts enable row level security;
drop policy if exists tr_ecrire on public.cxs_transferts;
create policy tr_ecrire on public.cxs_transferts for insert to authenticated with check (user_id = auth.uid());
drop policy if exists tr_maj on public.cxs_transferts;
create policy tr_maj on public.cxs_transferts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists tr_lire on public.cxs_transferts;
create policy tr_lire on public.cxs_transferts for select to authenticated using (user_id = auth.uid() or public.cxs_is_coach());
grant select, insert, update on public.cxs_transferts to authenticated;

create table if not exists public.cxs_fusion_backup (
  id bigserial primary key,
  at timestamptz not null default now(),
  src uuid not null, dst uuid not null,
  tbl text not null,
  row jsonb not null
);
alter table public.cxs_fusion_backup enable row level security; -- aucune politique : lisible seulement côté serveur
revoke all on public.cxs_fusion_backup from anon, authenticated;

create or replace function public.cxs_fusion_deplacer(t text, col text, cles text[], src uuid, dst uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; cond text;
begin
  if to_regclass('public.' || t) is null then return 0; end if;
  execute format('insert into public.cxs_fusion_backup (src, dst, tbl, row) select $1, $2, %L, to_jsonb(x) from public.%I x where x.%I in ($1, $2)', t, t, col) using src, dst;
  if cles is not null then
    -- Conflit de clé : la donnée du compte athlète l'emporte (celle du coach reste dans la sauvegarde)
    cond := coalesce((select string_agg(format('d.%I is not distinct from s.%I', k, k), ' and ') from unnest(cles) k), 'true');
    execute format('delete from public.%I d using public.%I s where d.%I = $2 and s.%I = $1 and %s', t, t, col, col, cond) using src, dst;
  end if;
  execute format('update public.%I set %I = $2 where %I = $1', t, col, col) using src, dst;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cxs_fusion_deplacer(text, text, text[], uuid, uuid) from public, anon, authenticated;

create or replace function public.cxs_fusion_comptes(src uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare dst uuid := auth.uid(); res jsonb := '{}'::jsonb; r record;
begin
  if dst is null or not public.cxs_is_coach() then raise exception 'réservé au coach'; end if;
  if src is null or src = dst then raise exception 'compte source invalide'; end if;
  if coalesce((select is_coach from public.cxs_profiles where id = src), false) then raise exception 'le compte source est un compte coach'; end if;

  -- Copie serveur des données athlète (programme, historique migré, journal)
  insert into public.cxs_fusion_backup (src, dst, tbl, row) select src, dst, 'cxs_member_data', to_jsonb(x) from public.cxs_member_data x where x.user_id in (src, dst);
  insert into public.cxs_member_data (user_id, data, summary, updated_at)
    select dst, m.data || jsonb_build_object('fusionDe', src, 'fusionAt', now()), m.summary, now() from public.cxs_member_data m where m.user_id = src
  on conflict (user_id) do update set data = excluded.data, summary = excluded.summary, updated_at = excluded.updated_at;

  for r in select * from (values
    ('cxs_soc_activites', 'user_id', array['cle']),
    ('cxs_soc_profils', 'user_id', array[]::text[]),
    ('cxs_soc_partages', 'user_id', null),
    ('cxs_soc_commentaires', 'user_id', null),
    ('cxs_soc_reactions', 'user_id', array['activite_id', 'emoji']),
    ('cxs_notif_reads', 'user_id', array['notif_id']),
    ('cxs_notifications', 'user_id', null),
    ('cxs_messages', 'user_id', null),
    ('cxs_program_history', 'user_id', null),
    ('cxs_legacy_checkins', 'user_id', null),
    ('cxs_legacy_rows', 'user_id', array['tbl', 'k']),
    ('cxs_coach_settings', 'user_id', array[]::text[]),
    ('cxs_coach_plans', 'user_id', array[]::text[]),
    ('cxs_coach_food_plans', 'user_id', array[]::text[]),
    ('cxs_coach_slots', 'user_id', array['orig_d']),
    ('cxs_video_demandes', 'user_id', null),
    ('cxs_live_sessions', 'user_id', array[]::text[]),
    ('cxs_session_reviews', 'user_id', array['workout_id']),
    ('cxs_health_daily', 'user_id', array['d']),
    ('cxs_health_tokens', 'user_id', array[]::text[]),
    ('cxs_defi_parts', 'user_id', array['defi_id']),
    ('cxs_poll_votes', 'user_id', array['poll_id']),
    ('cxs_hyb_bloc', 'user_id', array[]::text[]),
    ('cxs_hyb_consentement', 'user_id', array[]::text[]),
    ('cxs_hyb_personnage', 'user_id', array[]::text[]),
    ('cxs_hyb_quetes', 'user_id', array['quete_id', 'periode']),
    ('cxs_hyb_xp', 'user_id', array['cle']),
    ('nutri_daily', 'user_id', array['d']),
    ('push_prefs', 'user_id', array[]::text[]),
    ('programme_drafts', 'member_id', array['owner', 'kind'])
  ) v(t, col, cles) loop
    res := res || jsonb_build_object(r.t, public.cxs_fusion_deplacer(r.t, r.col, r.cles, src, dst));
  end loop;

  -- L'ancien compte athlète ne s'affiche plus dans la liste des membres
  update public.cxs_profiles set onboarding = coalesce(onboarding, '{}'::jsonb) || jsonb_build_object('hidden', true, 'fusionneVers', dst) where id = src;
  return res;
end $$;
revoke all on function public.cxs_fusion_comptes(uuid) from public, anon;
grant execute on function public.cxs_fusion_comptes(uuid) to authenticated;

-- Le coach retrouve l'identifiant d'un compte à partir de son e-mail (pour la fusion)
create or replace function public.cxs_id_par_email(p_email text)
returns uuid language sql stable security definer set search_path = public as $$
  select case when public.cxs_is_coach() then (select id from auth.users where lower(email) = lower(trim(p_email)) limit 1) end
$$;
revoke all on function public.cxs_id_par_email(text) from public, anon;
grant execute on function public.cxs_id_par_email(text) to authenticated;
