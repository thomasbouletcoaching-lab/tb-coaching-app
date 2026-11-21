-- Communauté : la séance publiée garde son détail (exercices, séries : charge, reps ou secondes, RPE). Décision C73.
create or replace function public.cxs_soc_num(j jsonb, lo numeric, hi numeric)
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(j) = 'number' and (j #>> '{}')::numeric between lo and hi then j else 'null'::jsonb end
$$;

create or replace function public.cxs_soc_publier(p_cle text, p_type text, p_data jsonb, p_visibilite text)
 returns bigint language plpgsql security definer set search_path to '' as $function$
declare me uuid := public.cxs_soc_uid(); d jsonb; t text; sp text; i bigint; f timestamptz; rx text := '(@|https?:|www\.|[0-9][0-9 .-]{7,}|insta|snap|whats|telegram|tiktok|onlyfans|\.(com|fr|net|org|io|me|bio|ly)\M)';
begin
  if not exists (select 1 from public.cxs_soc_profils where user_id = me) then raise exception 'Profil social requis' using errcode = '42501'; end if;
  if p_visibilite not in ('amis', 'communaute') then raise exception 'Visibilité inconnue' using errcode = '22023'; end if;
  if p_type not in ('seance', 'record', 'programme', 'cardio') then raise exception 'Type inconnu' using errcode = '22023'; end if;
  if (select count(*) from public.cxs_soc_activites where user_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Trop de publications aujourd''hui' using errcode = '54000';
  end if;
  t := left(coalesce(p_data->>'titre', 'Séance'), 48);
  sp := left(coalesce(p_data->>'sport', ''), 30);
  begin f := (p_data->>'fait')::timestamptz; exception when others then f := null; end;
  if f is not null and (f > now() + interval '10 minutes' or f < now() - interval '365 days') then f := null; end if;
  d := jsonb_strip_nulls(jsonb_build_object(
    'titre', case when t ~* rx then 'Séance' else t end,
    'sport', case when sp = '' or sp ~* rx then null else sp end,
    'fait', case when f is null then null else to_jsonb(f) end,
    'min', case when jsonb_typeof(p_data->'min') = 'number' and (p_data->>'min')::numeric between 0 and 600 then p_data->'min' end,
    'km', case when jsonb_typeof(p_data->'km') = 'number' and (p_data->>'km')::numeric between 0 and 400 then p_data->'km' end,
    'kcal', case when jsonb_typeof(p_data->'kcal') = 'number' and (p_data->>'kcal')::numeric between 0 and 6000 then p_data->'kcal' end,
    'series', case when jsonb_typeof(p_data->'series') = 'number' and (p_data->>'series')::numeric between 0 and 500 then p_data->'series' end,
    'exos', case when jsonb_typeof(p_data->'exos') = 'number' and (p_data->>'exos')::numeric between 0 and 60 then p_data->'exos' end,
    'tonnes', case when jsonb_typeof(p_data->'tonnes') = 'number' and (p_data->>'tonnes')::numeric between 0 and 200 then p_data->'tonnes' end,
    'medaille', case when p_data->>'medaille' in ('Fer', 'Bronze', 'Argent', 'Or', 'Platine', 'Diamant', 'Légende') then p_data->'medaille' end,
    'records', (select jsonb_agg(left(x, 40)) from (select jsonb_array_elements_text(case when jsonb_typeof(p_data->'records') = 'array' then p_data->'records' else '[]' end) x limit 3) r where x !~* rx),
    'top', (select jsonb_agg(left(x, 40)) from (select jsonb_array_elements_text(case when jsonb_typeof(p_data->'top') = 'array' then p_data->'top' else '[]' end) x limit 4) r where x !~* rx),
    'detail', (select jsonb_agg(jsonb_build_object('n', left(e->>'n', 40), 'u', case when e->>'u' in ('sec', 'm') then e->>'u' else 'reps' end,
        's', (select coalesce(jsonb_agg(jsonb_build_array(public.cxs_soc_num(z->0, 0, 1000), public.cxs_soc_num(z->1, 0, 1000), public.cxs_soc_num(z->2, 0, 10))), '[]'::jsonb)
              from (select z from jsonb_array_elements(case when jsonb_typeof(e->'s') = 'array' then e->'s' else '[]' end) z where jsonb_typeof(z) = 'array' limit 15) zz)))
      from (select e from jsonb_array_elements(case when jsonb_typeof(p_data->'detail') = 'array' then p_data->'detail' else '[]' end) e limit 20) ee
      where jsonb_typeof(e) = 'object' and coalesce(e->>'n', '') <> '' and (e->>'n') !~* rx)));
  insert into public.cxs_soc_activites (user_id, cle, type, data, visibilite) values (me, left(p_cle, 80), p_type, d, p_visibilite)
    on conflict (user_id, cle) do update set data = excluded.data, visibilite = excluded.visibilite
    returning id into i;
  return i;
end $function$;
