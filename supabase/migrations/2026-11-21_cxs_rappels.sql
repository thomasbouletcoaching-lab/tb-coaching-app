-- Rappels de l'app (C73), calculés sur la copie envoyée par chaque téléphone (cxs_member_data.summary) :
--  · séance du jour : 1 h avant l'heure prévue, sinon à 8 h ;
--  · bilan de la semaine : le dimanche à 10 h, relance à 18 h 30 s'il n'est toujours pas fait ;
--  · journée vide : à 20 h si rien n'a été noté de la journée (repas, routine, séance), pour les membres actifs sur 14 jours.
-- Chaque rappel part au plus une fois par jour (cxs_rappels_log). Le membre peut couper chaque rappel dans l'app (summary.rappels).
create table if not exists public.cxs_rappels_log (
  user_id uuid not null, k text not null, d date not null,
  primary key (user_id, k, d)
);
alter table public.cxs_rappels_log enable row level security;
revoke all on public.cxs_rappels_log from anon, authenticated;

create or replace function public.cxs_rappels() returns integer language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := now() at time zone 'Europe/Paris';
  auj date := loc::date;
  mn int := extract(hour from loc)::int * 60 + extract(minute from loc)::int;
  dim boolean := extract(isodow from loc) = 7;
  n int := 0; r record; ag jsonb; h text; cible int; fin int; la date; lc date;
begin
  delete from cxs_rappels_log where d < auj - 7;
  for r in select m.user_id, m.summary s from cxs_member_data m
           where exists (select 1 from push_subs p where p.user_id = m.user_id)
             and m.updated_at > now() - interval '21 days' loop
    begin la := (r.s->>'lastActive')::date; exception when others then la := null; end;
    begin lc := (r.s->>'lastCheckin')::date; exception when others then lc := null; end;

    -- Séance du jour
    if coalesce((r.s->'rappels'->>'seance')::boolean, true) then
      ag := null;
      select a into ag from jsonb_array_elements(coalesce(r.s->'agenda', '[]'::jsonb)) a where a->>'d' = auj::text and a->>'st' = 'planned' limit 1;
      if ag is not null then
        h := ag->>'time';
        if h ~ '^\d{1,2}:\d{2}$' then cible := greatest(split_part(h, ':', 1)::int * 60 + split_part(h, ':', 2)::int - 60, 6 * 60); fin := cible + 60;
        else cible := 8 * 60; fin := 12 * 60; end if;
        if mn >= cible and mn < fin then
          insert into cxs_rappels_log values (r.user_id, 'seance', auj) on conflict do nothing;
          if found then n := n + 1;
            insert into cxs_push_queue (user_id, kind, title, body, url) values (r.user_id, 'rappel', '🏋️ Séance du jour',
              coalesce(nullif(ag->>'title', ''), 'Ta séance') || case when h ~ '^\d' then ' à ' || h else '' end || ' : elle t''attend dans l''app.', './#/train');
          end if;
        end if;
      end if;
    end if;

    -- Bilan du dimanche
    if dim and coalesce((r.s->'rappels'->>'bilan')::boolean, true) and (lc is null or lc < auj - 1) then
      if mn >= 10 * 60 and mn < 11 * 60 then
        insert into cxs_rappels_log values (r.user_id, 'bilan', auj) on conflict do nothing;
        if found then n := n + 1; insert into cxs_push_queue (user_id, kind, title, body, url) values (r.user_id, 'rappel', '📝 Ton bilan de la semaine', '1 minute, déjà pré-rempli : Thomas s''en sert pour ajuster ta suite.', './#/bilan'); end if;
      elsif mn >= 18 * 60 + 30 and mn < 19 * 60 + 30 then
        insert into cxs_rappels_log values (r.user_id, 'bilan2', auj) on conflict do nothing;
        if found then n := n + 1; insert into cxs_push_queue (user_id, kind, title, body, url) values (r.user_id, 'rappel', '📝 Bilan à envoyer', 'Il te reste ce soir pour remplir ton bilan de la semaine.', './#/bilan'); end if;
      end if;
    end if;

    -- Journée vide
    if coalesce((r.s->'rappels'->>'vide')::boolean, true) and mn >= 20 * 60 and mn < 21 * 60 and la is not null and la >= auj - 14 and la < auj then
      insert into cxs_rappels_log values (r.user_id, 'vide', auj) on conflict do nothing;
      if found then n := n + 1; insert into cxs_push_queue (user_id, kind, title, body, url) values (r.user_id, 'rappel', '✍️ Rien de noté aujourd''hui', 'Repas, pas, sommeil ou séance : 30 secondes suffisent pour garder le fil.', './#/home'); end if;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.cxs_rappels() from public, anon, authenticated;

select cron.unschedule('push-daily') where exists (select 1 from cron.job where jobname = 'push-daily');
select cron.unschedule('push-weekly') where exists (select 1 from cron.job where jobname = 'push-weekly');
select cron.unschedule('cxs-rappels') where exists (select 1 from cron.job where jobname = 'cxs-rappels');
select cron.schedule('cxs-rappels', '*/15 * * * *', 'select public.cxs_rappels()');
