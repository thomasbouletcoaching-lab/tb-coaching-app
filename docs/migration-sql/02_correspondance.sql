-- Rattachement par e-mail normalisé. Ne crée AUCUN compte ni profil.
insert into mig.client_map (client_id, user_id, statut)
select c.id, p.id, case when p.id is null then 'en_attente' else 'auto' end
from public.clients c
left join public.cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
on conflict (client_id) do update set user_id = excluded.user_id, statut = excluded.statut, maj = now()
where mig.client_map.statut <> 'manuel';

-- M11 : paires confirmées une à une par Thomas (jamais de fusion automatique). Modèle :
-- insert into mig.client_map (client_id, user_id, statut) values ('<client_id>', '<user_id>', 'manuel')
-- on conflict (client_id) do update set user_id = excluded.user_id, statut = 'manuel', maj = now();
