-- Rejouable. M5 : un message resté non lu est marqué lu à sa date d'envoi.
-- Pièces jointes : `media` et `audio_path` gardent d'abord les chemins d'origine ; les fichiers sont copiés puis les chemins réécrits (étape stockage).
insert into public.cxs_messages (user_id, sender, body, created_at, read_at, reactions, audio_path, media, edited_at, ref, legacy_id)
select m.user_id, o.sender, coalesce(o.body, ''), o.created_at, coalesce(o.read_at, o.created_at),
       o.reactions, o.audio_path, o.media, o.edited_at, o.ref, o.id
from public.messages o
join mig.client_map m on m.client_id = o.client_id and m.user_id is not null
where not exists (  -- ne pas doubler les 2 messages déjà présents
  select 1 from public.cxs_messages n
  where n.user_id = m.user_id and n.sender = o.sender and n.created_at = o.created_at and n.body = coalesce(o.body, ''))
on conflict (legacy_id) where legacy_id is not null do nothing;
-- reply_to : aucune réponse dans l'ancienne table (vérifié) ; à traduire via legacy_id si cela change avant la copie.
