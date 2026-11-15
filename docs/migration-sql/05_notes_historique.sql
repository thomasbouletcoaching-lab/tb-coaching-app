-- Notes du coach : une clé par membre, rejouable (do nothing).
insert into public.cxs_coach_store (key, value, updated_at)
select 'tb_notes:' || m.user_id,
       jsonb_agg(jsonb_build_object('legacy_id', n.id, 'd', n.created_at, 'texte', n.body, 'pinned', n.pinned) order by n.created_at),
       now()
from public.coach_notes n join mig.client_map m on m.client_id = n.client_id and m.user_id is not null
group by m.user_id
on conflict (key) do nothing;

-- M7 : prog_hist et cycles, copie à l'identique (pour les clients rattachés).
insert into public.cxs_program_history (user_id, kind, legacy_id, payload, created_at)
select m.user_id, 'prog_hist', h.id, to_jsonb(h) - 'client_id', h.created_at
from public.prog_hist h join mig.client_map m on m.client_id = h.client_id and m.user_id is not null
on conflict (kind, legacy_id) do nothing;
insert into public.cxs_program_history (user_id, kind, legacy_id, payload, created_at)
select m.user_id, 'cycle', c.id, to_jsonb(c) - 'client_id', c.created_at
from public.cycles c join mig.client_map m on m.client_id = c.client_id and m.user_id is not null
on conflict (kind, legacy_id) do nothing;
