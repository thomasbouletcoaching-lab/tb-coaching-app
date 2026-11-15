-- Défait ce que 01 à 05 ont créé. Les anciennes tables n'ont jamais été modifiées. Les fichiers copiés dans le stockage se suppriment par l'API de stockage.
delete from public.cxs_messages where legacy_id is not null;
update public.cxs_member_data d set data = jsonb_set(d.data, '{checkins}',
  coalesce((select jsonb_agg(e) from jsonb_array_elements(d.data->'checkins') e where coalesce(e->>'src','') <> 'tb'), '[]'::jsonb))
where d.data ? 'checkins' and exists (select 1 from jsonb_array_elements(d.data->'checkins') e where e->>'src' = 'tb');
delete from public.cxs_coach_store where key like 'tb\_notes:%';
drop table if exists public.cxs_program_history;
alter table public.cxs_messages drop column if exists legacy_id, drop column if exists ref,
  drop column if exists edited_at, drop column if exists reply_to, drop column if exists media;
drop schema if exists mig cascade;
-- Le schéma bak_20261114 est conservé jusqu'à décision explicite.
