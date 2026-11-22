-- Communauté : seul le coach peut signaler une publication (il régule seul).
-- Le signalement reste examiné dans l'espace coach (Masquer / Garder).
create or replace function public.cxs_soc_signaler(p_activite bigint, p_motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := public.cxs_soc_uid(); a public.cxs_soc_activites;
begin
  if not public.cxs_is_coach() then raise exception 'Seul le coach peut signaler une publication' using errcode = '42501'; end if;
  select * into a from public.cxs_soc_activites where id = p_activite;
  if a.id is null or not public.cxs_soc_peut_voir(a.user_id, a.visibilite, a.masque) then raise exception 'Publication introuvable' using errcode = '42501'; end if;
  if p_motif not in ('contact', 'insulte', 'faux', 'autre') then raise exception 'Motif inconnu' using errcode = '22023'; end if;
  insert into public.cxs_soc_signalements (activite_id, auteur, motif) values (p_activite, me, p_motif) on conflict do nothing;
end $$;
