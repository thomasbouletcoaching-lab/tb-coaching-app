-- 16 bilans de clients rattachés. M12 date = envoi, sinon dernière modification ; M13 sommeil→sleepQ ; M14 stress/motiv/etc. sous legacy ; M3 reply→coachReply.
with src as (
  select m.user_id, s.w, s.client_id::text || ':' || s.w as legacy_id,
    jsonb_strip_nulls(jsonb_build_object(
      'd', to_char(coalesce(((s.data->>'sent')::timestamptz at time zone 'Europe/Paris')::date,
                            (s.updated_at at time zone 'Europe/Paris')::date), 'YYYY-MM-DD'),
      'dateSource', case when s.data ? 'sent' then 'sent' else 'updated_at' end,
      'week', s.w,
      'weight', nullif(replace(s.data->>'poids', ',', '.'), '')::numeric,
      'sleepQ', case when jsonb_typeof(s.data->'sommeil') = 'number' then (s.data->>'sommeil')::numeric end,
      'win', s.data->>'win',
      'coachReply', s.data->>'reply',
      'legacy', s.data - 'poids' - 'sommeil' - 'win' - 'reply' - 'sent',
      'src', 'tb', 'legacy_id', s.client_id::text || ':' || s.w)) as entry
  from public.suivi s join mig.client_map m on m.client_id = s.client_id and m.user_id is not null),
neuf as (
  select src.user_id, jsonb_agg(src.entry order by src.w) as entries
  from src join public.cxs_member_data d on d.user_id = src.user_id
  where not exists (select 1 from jsonb_array_elements(coalesce(d.data->'checkins', '[]'::jsonb)) e
                    where e->>'legacy_id' = src.legacy_id)
  group by src.user_id)
update public.cxs_member_data d
set data = jsonb_set(d.data, '{checkins}', coalesce(d.data->'checkins', '[]'::jsonb) || n.entries, true), updated_at = now()
from neuf n where n.user_id = d.user_id;
-- Limites connues : un membre sans ligne cxs_member_data est ignoré (à lister avant) ; la règle « même semaine déjà présente » n'est pas codée ;
-- vérifier en répétition que la synchro de l'app (js/cloud.js) ne supprime pas ces entrées à la prochaine sauvegarde du membre.
