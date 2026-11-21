-- Canal « vidéos à analyser » (décision C72) : le membre envoie une vidéo, le coach l'analyse dans l'app,
-- le compte rendu et la vidéo commentée sont partagés au membre quand le coach a fini.
-- Fichiers : bucket « media », dossier <client_id>/analyses/<id>/ (mêmes droits que les vocaux : membre et coach).
create table if not exists public.cxs_video_demandes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  mvt text,
  note text check (char_length(note) <= 500),
  source_path text not null,
  statut text not null default 'envoyee' check (statut in ('envoyee', 'en_cours', 'analysee')),
  compte_rendu jsonb,
  analyse_path text,
  analysed_at timestamptz,
  seen_at timestamptz
);
create index if not exists cxs_video_demandes_user on public.cxs_video_demandes(user_id, created_at desc);
alter table public.cxs_video_demandes enable row level security;
revoke all on public.cxs_video_demandes from anon;
grant select, insert, delete on public.cxs_video_demandes to authenticated;
grant update (statut, compte_rendu, analyse_path, analysed_at) on public.cxs_video_demandes to authenticated;
drop policy if exists vd_lire on public.cxs_video_demandes;
create policy vd_lire on public.cxs_video_demandes for select to authenticated using (user_id = auth.uid() or public.cxs_is_coach());
drop policy if exists vd_envoyer on public.cxs_video_demandes;
create policy vd_envoyer on public.cxs_video_demandes for insert to authenticated with check (user_id = auth.uid() and statut = 'envoyee' and compte_rendu is null and analyse_path is null);
drop policy if exists vd_analyser on public.cxs_video_demandes;
create policy vd_analyser on public.cxs_video_demandes for update to authenticated using (public.cxs_is_coach()) with check (public.cxs_is_coach());
drop policy if exists vd_retirer on public.cxs_video_demandes;
create policy vd_retirer on public.cxs_video_demandes for delete to authenticated using (user_id = auth.uid() or public.cxs_is_coach());

-- Le membre marque une analyse comme vue (seule colonne qu'il peut changer)
create or replace function public.cxs_video_vue(p_id uuid) returns void language sql security definer set search_path = public as $$
  update public.cxs_video_demandes set seen_at = coalesce(seen_at, now()) where id = p_id and user_id = auth.uid() and statut = 'analysee';
$$;
revoke all on function public.cxs_video_vue(uuid) from public, anon;
grant execute on function public.cxs_video_vue(uuid) to authenticated;

-- Purge : les vidéos de la messagerie partent après 30 jours ; celles des analyses sont gardées un an (le membre ou le coach
-- peut les supprimer avant).
create or replace function public.media_videos_a_purger(p_jours integer default 30) returns table(name text) language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
  where o.bucket_id = 'media' and o.name not like 'lib/%' and coalesce(o.metadata->>'mimetype','') like 'video/%'
    and o.created_at < now() - make_interval(days => case when o.name like '%/analyses/%' then greatest(p_jours, 365) else p_jours end)
  order by o.created_at limit 500;
$$;
