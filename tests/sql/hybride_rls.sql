-- Tests des règles d'accès de la migration 2026-11-17_cxs_hybride.sql.
-- Chaque règle est testée dans les deux sens : un non-autorisé échoue ET un autorisé réussit.
-- Lancement : tests/sql/run-hybride.sh (Postgres local, aucune connexion à la production).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;

create schema if not exists tst;
grant usage on schema tst to anon, authenticated, service_role;
create or replace function tst.ok(c boolean, m text) returns void language plpgsql as
  $$ begin if c is not true then raise exception 'ÉCHEC : %', m; end if; raise notice 'OK  %', m; end $$;
create or replace function tst.echoue(q text, m text) returns void language plpgsql as
  $$ begin execute q; raise exception 'ÉCHEC (aurait dû être refusé) : %', m;
     exception when insufficient_privilege or check_violation or raise_exception or not_null_violation or null_value_not_allowed then
       if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'OK  refusé : % (%)', m, sqlerrm; end $$;
create or replace function tst.n(q text) returns bigint language plpgsql as
  $$ declare r bigint; begin execute 'select count(*) from (' || q || ') x' into r; return r; end $$;
grant execute on all functions in schema tst to anon, authenticated, service_role;

-- Données de départ écrites par le serveur (service_role) pour chaque persona
set role service_role;
insert into cxs_hyb_xp (user_id, cle, source, xp)
  select id, 'seance:2026-12-07:1', 'regularite', 20 from public.cxs_profiles on conflict do nothing;
insert into cxs_hyb_quetes (user_id, quete_id, periode, progres)
  select id, 'seance-du-jour', '2026-12-07', '{"fait":true}' from public.cxs_profiles on conflict do nothing;
insert into cxs_hyb_bloc (user_id, macro_id, debut, nb_seances)
  select id, 'M1', '2026-11-30', 4 from public.cxs_profiles on conflict do nothing;
insert into cxs_hyb_personnage (user_id, apparence)
  select id, '{"tenue":"base"}' from public.cxs_profiles on conflict do nothing;
select tst.ok(true, 'service_role : écrit XP, quêtes, bloc, personnage pour chaque persona');
-- Idempotence des événements d'XP : rejouer la même clé ne crée pas de doublon
insert into cxs_hyb_xp (user_id, cle, source, xp)
  select id, 'seance:2026-12-07:1', 'regularite', 20 from public.cxs_profiles on conflict (user_id, cle) do nothing;
select tst.ok((select count(*) from cxs_hyb_xp) = (select count(*) from public.cxs_profiles), 'XP : une même clé ne compte qu''une fois');
select tst.echoue($q$ insert into cxs_hyb_xp (user_id, cle, source, xp) values ('00000000-0000-0000-0000-0000000000a1', 'x', 'volume', 10) $q$, 'XP pour du volume brut (source interdite)');
select tst.echoue($q$ insert into cxs_hyb_xp (user_id, cle, source, xp) values ('00000000-0000-0000-0000-0000000000a1', 'y', 'record', 9999) $q$, 'XP démesurée');
reset role;

-- ---------- anon : rien ----------
set role anon;
select tst.echoue('select * from cxs_hyb_bloc', 'anon lit les blocs');
select tst.echoue('select * from cxs_hyb_xp', 'anon lit l''XP');
select tst.echoue('select * from cxs_hyb_personnage', 'anon lit les personnages');
select tst.echoue('select * from cxs_hyb_quetes', 'anon lit les quêtes');
select tst.echoue('select * from cxs_hyb_consentement', 'anon lit les consentements');
select tst.echoue('select cxs_hyb_consentir(true)', 'anon donne un consentement');
select tst.echoue('select cxs_hyb_effacer_mes_donnees()', 'anon efface');
reset role;

-- ---------- Membre coaché (femme en reprise, a1) ----------
set role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select tst.ok(tst.n('select * from cxs_hyb_bloc') = 1, 'a1 lit son bloc, et seulement le sien');
select tst.ok(tst.n('select * from cxs_hyb_xp') = 1, 'a1 lit son XP, et seulement la sienne');
select tst.ok(tst.n($q$ select * from cxs_hyb_personnage where user_id = '00000000-0000-0000-0000-0000000000b1' $q$) = 0, 'a1 ne lit pas le personnage d''un autre');
select tst.ok(tst.n('select * from cxs_hyb_quetes') = 1, 'a1 lit ses quêtes');
update cxs_hyb_bloc set nb_seances = 3 where user_id = '00000000-0000-0000-0000-0000000000a1';
select tst.ok((select nb_seances from cxs_hyb_bloc) = 3, 'a1 modifie son bloc');
update cxs_hyb_bloc set nb_seances = 6 where user_id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select tst.ok((select nb_seances from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000b1') = 4, 'a1 ne peut pas modifier le bloc d''un autre (0 ligne touchée)');
set role authenticated;
select tst.echoue($q$ insert into cxs_hyb_bloc (user_id, macro_id, debut, nb_seances) values ('00000000-0000-0000-0000-0000000000a3', 'M1', '2026-12-01', 3) $q$, 'a1 crée un bloc pour quelqu''un d''autre');
select tst.echoue($q$ update cxs_hyb_bloc set nb_seances = 9 $q$, 'bloc à 9 séances (hors 3 à 6)');
update cxs_hyb_personnage set apparence = '{"tenue":"sport","coiffure":"courte"}';
select tst.ok((select apparence->>'coiffure' from cxs_hyb_personnage) = 'courte', 'a1 change l''apparence de son personnage');
select tst.echoue($q$ update cxs_hyb_personnage set debloques = '["cape-doree"]' $q$, 'a1 se débloque un objet lui-même');
select tst.echoue($q$ insert into cxs_hyb_personnage (user_id, apparence, debloques) values ('00000000-0000-0000-0000-0000000000a1', '{}', '["cape-doree"]') on conflict (user_id) do update set debloques = excluded.debloques $q$, 'a1 se débloque un objet par un insert ou un upsert');
delete from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000b1';
select tst.ok(cxs_hyb_coach_peut_lire('00000000-0000-0000-0000-0000000000a1') = false, 'a1 n''a pas les droits du coach sur elle-même');
select tst.echoue($q$ insert into cxs_hyb_xp (user_id, cle, source, xp) values ('00000000-0000-0000-0000-0000000000a1', 'triche', 'record', 500) $q$, 'a1 s''écrit de l''XP');
select tst.echoue($q$ update cxs_hyb_xp set xp = 500 $q$, 'a1 modifie son XP');
select tst.echoue($q$ delete from cxs_hyb_xp $q$, 'a1 supprime son XP en direct (passe par la fonction d''effacement)');
select tst.echoue($q$ insert into cxs_hyb_quetes (user_id, quete_id, periode) values ('00000000-0000-0000-0000-0000000000a1', 'boss', 'M1') $q$, 'a1 valide une quête lui-même');
select tst.ok(not cxs_hyb_coach_peut_lire('00000000-0000-0000-0000-0000000000a2'), 'cxs_hyb_coach_peut_lire : faux pour un membre');
select tst.echoue($q$ select cxs_hyb_coache('00000000-0000-0000-0000-0000000000a2') $q$, 'un membre interroge la formule d''un autre');

-- ---------- Abonné en autonomie avec consentement (b2) ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select cxs_hyb_consentir(true);
select tst.ok(tst.n('select * from cxs_hyb_consentement') = 1, 'b2 donne son consentement et le lit');
select tst.echoue('select cxs_hyb_consentir(null)', 'consentement sans réponse (null)');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select tst.ok(tst.n('select * from cxs_hyb_consentement') = 0, 'b1 ne lit pas le consentement de b2');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);

-- ---------- Coach ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0ac', false);
select tst.ok(tst.n($q$ select * from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000a1' $q$) = 1, 'coach lit le bloc d''une cliente coachée');
select tst.ok(tst.n($q$ select * from cxs_hyb_xp where user_id = '00000000-0000-0000-0000-0000000000a2' $q$) = 1, 'coach lit l''XP d''un client coaché');
select tst.ok(tst.n($q$ select * from cxs_hyb_quetes where user_id = '00000000-0000-0000-0000-0000000000b3' $q$) = 1, 'coach lit les quêtes d''un invité');
select tst.ok(tst.n($q$ select * from cxs_hyb_personnage where user_id = '00000000-0000-0000-0000-0000000000b2' $q$) = 1, 'coach lit un abonné en autonomie qui a consenti');
select tst.ok(tst.n($q$ select * from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000b1' $q$) = 0, 'coach NE lit PAS le bloc d''un abonné en autonomie sans consentement');
select tst.ok(tst.n($q$ select * from cxs_hyb_xp where user_id = '00000000-0000-0000-0000-0000000000b1' $q$) = 0, 'coach NE lit PAS l''XP sans consentement');
select tst.ok(tst.n($q$ select * from cxs_hyb_quetes where user_id = '00000000-0000-0000-0000-0000000000b1' $q$) = 0, 'coach NE lit PAS les quêtes sans consentement');
select tst.ok(tst.n($q$ select * from cxs_hyb_personnage where user_id = '00000000-0000-0000-0000-0000000000b1' $q$) = 0, 'coach NE lit PAS le personnage sans consentement');
select tst.echoue($q$ insert into cxs_hyb_xp (user_id, cle, source, xp) values ('00000000-0000-0000-0000-0000000000a1', 'cadeau', 'record', 100) $q$, 'le coach écrit de l''XP à la main');
update cxs_hyb_bloc set nb_seances = 6 where user_id = '00000000-0000-0000-0000-0000000000a1';
update cxs_hyb_personnage set apparence = '{"tenue":"imposee"}' where user_id = '00000000-0000-0000-0000-0000000000a1';
delete from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000a2';
select tst.echoue($q$ update cxs_hyb_quetes set reussie_le = now() $q$, 'le coach valide une quête à la main');
select cxs_hyb_effacer_mes_donnees();
reset role;
select tst.ok((select nb_seances from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000a1') = 3, 'le coach ne modifie pas le bloc d''un client (lecture seule, 0 ligne)');
select tst.ok((select apparence->>'tenue' from cxs_hyb_personnage where user_id = '00000000-0000-0000-0000-0000000000a1') = 'sport', 'le coach ne modifie pas le personnage d''un client');
select tst.ok((select count(*) from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000a2') = 1, 'le coach ne supprime pas le bloc d''un client');
select tst.ok((select count(*) from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000b1') = 1, 'a1 n''a pas supprimé le bloc de b1');
select tst.ok((select count(*) from cxs_hyb_xp where user_id <> '00000000-0000-0000-0000-00000000c0ac') = 6, 'l''effacement lancé par le coach n''a touché que ses propres lignes');
set role authenticated;

-- ---------- Retrait du consentement : le coach ne voit plus rien ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select cxs_hyb_consentir(false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0ac', false);
select tst.ok(tst.n($q$ select * from cxs_hyb_personnage where user_id = '00000000-0000-0000-0000-0000000000b2' $q$) = 0, 'consentement retiré : le coach ne lit plus');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select cxs_hyb_consentir(true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0ac', false);
select tst.ok(tst.n($q$ select * from cxs_hyb_personnage where user_id = '00000000-0000-0000-0000-0000000000b2' $q$) = 1, 'consentement redonné : le coach lit à nouveau');

-- ---------- Un abonné en autonomie ne se donne pas les droits du coach ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select tst.ok(tst.n('select * from cxs_hyb_bloc') = 1, 'b1 lit son seul bloc');
select tst.echoue($q$ insert into cxs_hyb_consentement (user_id, accorde_le) values ('00000000-0000-0000-0000-0000000000b1', now()) $q$, 'b1 écrit le consentement en direct (passe par la fonction)');

-- ---------- Effacement RGPD ----------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
select cxs_hyb_effacer_mes_donnees();
select tst.ok(tst.n('select * from cxs_hyb_bloc') + tst.n('select * from cxs_hyb_xp') + tst.n('select * from cxs_hyb_quetes') + tst.n('select * from cxs_hyb_personnage') = 0, 'a3 a effacé toutes ses données hybrides');
reset role;
select tst.ok((select count(*) from cxs_hyb_xp) = 5, 'l''effacement de a3 n''a touché personne d''autre');
select tst.ok((select count(*) from cxs_hyb_xp where user_id = '00000000-0000-0000-0000-0000000000a3') = 0, 'plus aucune XP pour a3');

-- ---------- Changements de formule et horodatages ----------
reset role;
update cxs_profiles set tier = 'premium' where id = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c0ac', false);
select tst.ok(tst.n($q$ select * from cxs_hyb_xp where user_id = '00000000-0000-0000-0000-0000000000a2' $q$) = 0, 'client repassé en autonomie sans consentement : le coach ne lit plus');
reset role;
update cxs_profiles set tier = 'avance', tier_until = current_date - 1 where id = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
select tst.ok(tst.n($q$ select * from cxs_hyb_xp where user_id = '00000000-0000-0000-0000-0000000000a2' $q$) = 0, 'formule coachée échue : le coach ne lit plus');
reset role;
update cxs_profiles set tier_until = current_date + 30 where id = '00000000-0000-0000-0000-0000000000a2';
set role authenticated;
select tst.ok(tst.n($q$ select * from cxs_hyb_xp where user_id = '00000000-0000-0000-0000-0000000000a2' $q$) = 1, 'formule coachée en cours : le coach lit');
reset role;
insert into cxs_hyb_consentement (user_id, accorde_le, revoque_le) values ('00000000-0000-0000-0000-0000000000b1', '2026-12-01 10:00', '2026-12-01 10:00')
  on conflict (user_id) do update set accorde_le = excluded.accorde_le, revoque_le = excluded.revoque_le;
set role authenticated;
select tst.ok(tst.n($q$ select * from cxs_hyb_bloc where user_id = '00000000-0000-0000-0000-0000000000b1' $q$) = 0, 'accord et retrait au même instant : consentement inactif');
reset role;
select tst.ok(not has_sequence_privilege('authenticated', 'public.cxs_hyb_xp_id_seq', 'USAGE') and not has_sequence_privilege('anon', 'public.cxs_hyb_xp_id_seq', 'USAGE'), 'séquence de l''XP fermée à anon et authenticated');
select tst.ok(not has_function_privilege('anon', 'public.cxs_hyb_coach_peut_lire(uuid)', 'EXECUTE'), 'anon n''exécute pas cxs_hyb_coach_peut_lire');
select tst.ok(not has_table_privilege('authenticated', 'public.cxs_hyb_bloc', 'TRUNCATE'), 'aucun TRUNCATE pour authenticated');
