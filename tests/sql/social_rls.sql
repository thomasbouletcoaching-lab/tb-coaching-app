-- Tests des règles de la migration 2026-11-18_cxs_social.sql (partage, amis, communauté, parrainage).
-- Chaque règle est testée dans les deux sens : un non-autorisé échoue ET un autorisé réussit.
-- Lancement : tests/sql/run-social.sh (Postgres local, aucune connexion à la production).
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;

create schema if not exists tst;
grant usage on schema tst to anon, authenticated, service_role;
create or replace function tst.ok(c boolean, m text) returns void language plpgsql as
  $$ begin if c is not true then raise exception 'ÉCHEC : %', m; end if; raise notice 'OK  %', m; end $$;
create or replace function tst.echoue(q text, m text) returns void language plpgsql as
  $$ begin execute q; raise exception 'ÉCHEC (aurait dû être refusé) : %', m;
     exception when insufficient_privilege or check_violation or raise_exception or invalid_parameter_value or no_data_found or program_limit_exceeded or undefined_function then
       if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'OK  refusé : % (%)', m, sqlerrm; end $$;
create or replace function tst.n(q text) returns bigint language plpgsql as
  $$ declare r bigint; begin execute 'select count(*) from (' || q || ') x' into r; return r; end $$;
create or replace function tst.qui(u text) returns void language sql as
  $$ select set_config('request.jwt.claim.role', 'authenticated', false), set_config('request.jwt.claim.sub', u, false); select null::void $$;
grant execute on all functions in schema tst to anon, authenticated, service_role;

-- Personas : A1 et A2 amis, B1 et B2 dans la communauté (sans être amis de A1), B3 hors communauté
-- a1 femme-reprise · a2 homme-avance · a3 débutante · b1 autonome · b2 autonome · b3 invité
create temp table ids (k text primary key, v uuid);
insert into ids values ('coach','00000000-0000-0000-0000-00000000c0ac'),('a1','00000000-0000-0000-0000-0000000000a1'),('a2','00000000-0000-0000-0000-0000000000a2'),
  ('a3','00000000-0000-0000-0000-0000000000a3'),('b1','00000000-0000-0000-0000-0000000000b1'),('b2','00000000-0000-0000-0000-0000000000b2'),('b3','00000000-0000-0000-0000-0000000000b3');
grant select on ids to authenticated, anon, service_role;

-- ---------- anon : rien ----------
set role anon;
select tst.echoue('select * from cxs_soc_activites', 'anon lit les publications');
select tst.echoue('select * from cxs_soc_profils', 'anon lit les profils sociaux');
select tst.echoue('select * from cxs_parrainages', 'anon lit les parrainages');
select tst.echoue($q$ select cxs_soc_fil('communaute') $q$, 'anon lit le fil');
select tst.echoue($q$ select cxs_parrainage_lier('ABCDEF') $q$, 'anon lie un code');
reset role;

-- ---------- Profils ----------
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a1');
select tst.echoue($q$ select cxs_soc_publier('w1', 'seance', '{"titre":"x"}', 'amis') $q$, 'publier sans profil social');
select tst.echoue($q$ select cxs_soc_profil_enregistrer('insta tomfit', '🦁', true, 'amis') $q$, 'pseudo avec un réseau social');
select tst.echoue($q$ select cxs_soc_profil_enregistrer('tom@mail', '🦁', true, 'amis') $q$, 'pseudo avec un e-mail');
select tst.echoue($q$ select cxs_soc_profil_enregistrer('Tom 0612345678', '🦁', true, 'amis') $q$, 'pseudo avec un numéro');
select tst.echoue($q$ select cxs_soc_profil_enregistrer('Tom', '🦁', true, 'public') $q$, 'visibilité inconnue');
select tst.ok((cxs_soc_profil_enregistrer('Camille R.', '🦊', true, 'amis')->>'code') ~ '^[A-Z2-9]{6}$', 'a1 crée son profil (pseudo accentué possible, code créé)');
select tst.ok((cxs_soc_profil_enregistrer('Éloïse', '🦊', true, 'amis')->>'pseudo') = 'Éloïse', 'pseudo accentué accepté');
select cxs_soc_profil_enregistrer('Camille R.', '🦊', true, 'amis');
select tst.ok(cxs_soc_mon_code() = (select code from cxs_soc_profils where user_id = auth.uid()), 'le code ne change pas');
select tst.ok(tst.n('select * from cxs_soc_profils') = 1, 'a1 ne lit que son profil en direct');
select tst.echoue($q$ insert into cxs_soc_profils (user_id, pseudo) values ('00000000-0000-0000-0000-0000000000a1', 'X') $q$, 'écriture directe dans la table');
select tst.echoue($q$ update cxs_soc_profils set masque = false $q$, 'a1 se démasque lui-même');
select tst.qui('00000000-0000-0000-0000-0000000000a2'); select cxs_soc_profil_enregistrer('Sam', '🐺', false, 'amis');
select tst.qui('00000000-0000-0000-0000-0000000000b1'); select cxs_soc_profil_enregistrer('Bo', '🐻', true, 'communaute');
select tst.qui('00000000-0000-0000-0000-0000000000b2'); select cxs_soc_profil_enregistrer('Lina', '🐯', true, 'communaute');
select tst.qui('00000000-0000-0000-0000-0000000000b3'); select cxs_soc_profil_enregistrer('Noa', '🐢', false, 'amis');
reset role;

-- ---------- Amis par code ----------
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a1');
select tst.echoue($q$ select cxs_soc_ami_demander('ZZZZZZ') $q$, 'code inconnu');
select tst.echoue($q$ select cxs_soc_ami_demander((select code from cxs_soc_profils where user_id = auth.uid())) $q$, 'se demander soi-même');
reset role;
-- a1 ne peut pas lire le code de a2 en direct : on le passe par la table de test (comme un lien reçu)
create temp table codes as select user_id, code from cxs_soc_profils; grant select on codes to authenticated;
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a1');
select tst.ok(cxs_soc_ami_demander((select code from codes where user_id = '00000000-0000-0000-0000-0000000000a2')) = 'envoye', 'a1 demande a2 en ami');
select tst.ok(tst.n($q$ select * from cxs_soc_amis_liste() where statut = 'attente' and sens = 'envoyee' $q$) = 1, 'a1 voit sa demande envoyée');
select tst.qui('00000000-0000-0000-0000-0000000000b1');
select cxs_soc_ami_repondre('00000000-0000-0000-0000-0000000000a1', true);
reset role;
select tst.ok((select statut from cxs_soc_amis where demandeur = '00000000-0000-0000-0000-0000000000a1') = 'attente', 'b1 ne peut pas accepter une demande qui ne lui est pas adressée');
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a2');
select tst.ok(tst.n($q$ select * from cxs_soc_amis_liste() where sens = 'recue' $q$) = 1, 'a2 voit la demande reçue');
select cxs_soc_ami_repondre('00000000-0000-0000-0000-0000000000a1', true);
select tst.ok(cxs_soc_sont_amis('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2'), 'a2 accepte : amis');
-- b3 demande a2, puis a2 demande b3 : acceptation croisée
select tst.qui('00000000-0000-0000-0000-0000000000b3');
select cxs_soc_ami_demander((select code from codes where user_id = '00000000-0000-0000-0000-0000000000a2'));
select tst.qui('00000000-0000-0000-0000-0000000000a2');
select tst.ok(cxs_soc_ami_demander((select code from codes where user_id = '00000000-0000-0000-0000-0000000000b3')) = 'accepte', 'demandes croisées : acceptées d''office');
reset role;

-- ---------- Publications et visibilité ----------
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a2');
select cxs_soc_publier('w-a2-amis', 'seance', '{"titre":"Push A","min":62,"series":18,"tonnes":8.4,"records":["Développé couché"]}', 'amis');
select cxs_soc_publier('w-a2-com', 'seance', '{"titre":"Legs","min":50}', 'communaute');
select cxs_soc_publier('w-a2-com', 'seance', '{"titre":"Legs","min":55}', 'communaute');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('moi') $q$) = 2, 'republier la même séance ne fait pas de doublon');
select cxs_soc_publier('w-a2-contact', 'seance', '{"titre":"Écris-moi sur insta @sam.fit","series":3,"poids":82,"notes":"genou","records":["www.sam.fr","Squat"]}', 'amis');
reset role;
select tst.ok((select data->>'titre' from cxs_soc_activites where cle = 'w-a2-contact') = 'Séance', 'titre avec contact remplacé par « Séance »');
select tst.ok((select data from cxs_soc_activites where cle = 'w-a2-contact') ?| array['poids', 'notes'] is false, 'champs hors liste (poids, notes) jamais enregistrés');
select tst.ok((select data->'records' from cxs_soc_activites where cle = 'w-a2-contact') = '["Squat"]', 'record contenant un lien retiré');
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000b1');
select cxs_soc_publier('w-b1', 'seance', '{"titre":"Full body","series":12}', 'communaute');
select tst.echoue($q$ select cxs_soc_publier('w-b1-x', 'seance', '{}', 'prive') $q$, 'visibilité « privé » ne se publie pas');
-- a1 (amie de a2, dans la communauté)
select tst.qui('00000000-0000-0000-0000-0000000000a1');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('amis') $q$) = 3, 'a1 voit les 3 séances de son amie a2 (amis et communauté)');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') where pseudo = 'Bo' $q$) = 1, 'a1 (communauté) voit la séance communauté de b1');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') where pseudo = 'Sam' $q$) = 1, 'fil communauté : seulement la séance « communauté » de a2');
-- b2 (communauté, pas amie de a2)
select tst.qui('00000000-0000-0000-0000-0000000000b2');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') where pseudo = 'Sam' $q$) = 0, 'b2 ne voit pas a2 : a2 n''a pas rejoint la communauté');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('amis') $q$) = 0, 'b2 sans ami : fil amis vide');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') where pseudo = 'Bo' $q$) = 1, 'b2 voit b1 (tous deux dans la communauté)');
select tst.ok(tst.n($q$ select * from cxs_soc_activites $q$) = 0, 'b2 ne lit aucune publication en direct');
-- b3 (hors communauté, ami de a2)
select tst.qui('00000000-0000-0000-0000-0000000000b3');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') where pseudo = 'Bo' $q$) = 0, 'b3 hors communauté ne voit pas la communauté');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('amis') $q$) = 3, 'b3 voit les séances de son ami a2');
-- a3 sans profil
select tst.qui('00000000-0000-0000-0000-0000000000a3');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') $q$) = 0, 'sans profil social : rien');
-- Le fil ne renvoie aucun identifiant ni e-mail
select tst.ok(not exists (select 1 from information_schema.routines r join information_schema.parameters p on p.specific_name = r.specific_name
  where r.routine_name = 'cxs_soc_fil' and p.parameter_mode = 'OUT' and p.parameter_name in ('user_id', 'email', 'name')), 'le fil ne renvoie ni identifiant, ni e-mail, ni nom');
reset role;

-- ---------- Encouragements ----------
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000b2');
select tst.ok((cxs_soc_reagir((select id from cxs_soc_fil('communaute') where pseudo = 'Bo' limit 1), 'feu')->>'feu')::int = 1, 'b2 encourage b1');
select cxs_soc_reagir((select id from cxs_soc_fil('communaute') where pseudo = 'Bo' limit 1), 'feu');
select tst.ok((cxs_soc_reagir((select id from cxs_soc_fil('communaute') where pseudo = 'Bo' limit 1), 'muscle')->>'feu')::int = 1, 'un même geste ne compte qu''une fois');
reset role;
create temp table act as select id, cle from cxs_soc_activites; grant select on act to authenticated;
set role authenticated;
select tst.echoue($q$ select cxs_soc_reagir((select id from act where cle = 'w-a2-amis'), 'feu') $q$, 'b2 encourage une séance qu''il ne voit pas');
select tst.echoue($q$ select cxs_soc_reagir((select id from act where cle = 'w-b1'), 'coeur') $q$, 'geste hors liste');
select tst.qui('00000000-0000-0000-0000-0000000000b1');
select tst.echoue($q$ select cxs_soc_reagir((select id from act where cle = 'w-b1'), 'feu') $q$, 'b1 encourage sa propre séance');
select tst.ok((cxs_soc_moi()->>'recus')::int = 2, 'b1 voit 2 encouragements reçus');
select tst.qui('00000000-0000-0000-0000-0000000000b2');
select tst.ok((cxs_soc_moi()->>'donnes')::int = 2, 'b2 a donné 2 encouragements');
select tst.ok((select mes_reactions from cxs_soc_fil('communaute') where pseudo = 'Bo' limit 1) @> array['feu', 'muscle'], 'b2 voit ses propres gestes');
select cxs_soc_reagir((select id from act where cle = 'w-b1'), 'muscle', false);
select tst.ok((cxs_soc_moi()->>'donnes')::int = 1, 'geste retiré');
reset role;

-- ---------- Signalement et modération ----------
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a1'); select cxs_soc_signaler((select id from act where cle = 'w-b1'), 'contact');
select tst.echoue($q$ select cxs_soc_moderer((select id from act where cle = 'w-b1'), true) $q$, 'un membre masque une publication');
select tst.qui('00000000-0000-0000-0000-00000000c0ac');
select tst.ok(tst.n('select * from cxs_soc_signalements') = 1, 'le coach lit les signalements');
select cxs_soc_moderer((select id from act where cle = 'w-b1'), true);
select tst.qui('00000000-0000-0000-0000-0000000000b2');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('communaute') where pseudo = 'Bo' $q$) = 0, 'publication masquée par le coach : plus visible');
select tst.qui('00000000-0000-0000-0000-0000000000b1');
select tst.ok(tst.n($q$ select * from cxs_soc_fil('moi') $q$) = 1, 'l''auteur voit encore sa publication masquée');
reset role;

-- ---------- Parrainage ----------
-- a3 : nouveau compte sans formule (cas normal d'une personne invitée)
update cxs_profiles set tier = 'free' where id = '00000000-0000-0000-0000-0000000000a3';
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000a3');
select tst.ok(cxs_parrainage_lier('ZZZZZZ') = 'inconnu', 'code inconnu : rien n''est lié');
select tst.ok(cxs_parrainage_lier((select code from codes where user_id = '00000000-0000-0000-0000-0000000000b1')) = 'lie', 'a3 lie le code de b1');
select tst.ok(cxs_parrainage_lier((select code from codes where user_id = '00000000-0000-0000-0000-0000000000b2')) = 'deja', 'un seul parrain');
select tst.ok(cxs_soc_sont_amis('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1'), 'parrain et filleul deviennent amis');
reset role; truncate codes; insert into codes select user_id, code from cxs_soc_profils; set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000b1');
select tst.ok(cxs_parrainage_lier((select code from codes where user_id = '00000000-0000-0000-0000-0000000000b1')) = 'soi', 'pas de parrainage de soi-même');
select tst.ok(cxs_parrainage_lier((select code from codes where user_id = '00000000-0000-0000-0000-0000000000a3')) = 'boucle', 'pas de boucle filleul → parrain');
select tst.ok((cxs_soc_moi()->>'filleuls')::int = 1, 'b1 voit 1 filleul inscrit');
select tst.echoue($q$ select cxs_parrainage_premium('00000000-0000-0000-0000-0000000000a3') $q$, 'un membre déclenche sa propre récompense');
select tst.echoue($q$ select cxs_recompense_appliquer(1, 'prolongation') $q$, 'un membre applique une récompense');
reset role;
-- Compte trop ancien ou déjà abonné
update cxs_profiles set created_at = now() - interval '40 days' where id = '00000000-0000-0000-0000-0000000000b2';
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000b2');
select tst.ok(cxs_parrainage_lier((select code from codes where user_id = '00000000-0000-0000-0000-0000000000a1')) = 'trop_tard', 'code lié plus de 30 jours après l''inscription : refusé');
select tst.qui('00000000-0000-0000-0000-0000000000a2');
select tst.ok(cxs_parrainage_lier((select code from codes where user_id = '00000000-0000-0000-0000-0000000000a1')) = 'deja_abonne', 'déjà abonné : pas de parrainage');
reset role;

-- Webhook (service_role) : a3 passe Bâtisseur → b1 (Bâtisseur) reçoit un mois
set role service_role;
select set_config('request.jwt.claim.role', 'service_role', false), set_config('request.jwt.claim.sub', '', false);
select tst.ok((cxs_parrainage_premium('00000000-0000-0000-0000-0000000000a3')->>'recompense')::boolean, 'service_role : récompense créée au premier paiement du filleul');
select tst.ok((cxs_parrainage_premium('00000000-0000-0000-0000-0000000000a3')->>'raison') = 'deja', 'une seule récompense par filleul (webhook rejoué)');
select tst.ok((cxs_parrainage_premium('00000000-0000-0000-0000-0000000000b2')->>'raison') = 'sans_parrain', 'sans parrain : rien');
select cxs_recompense_appliquer((select id from cxs_recompenses where filleul_id = '00000000-0000-0000-0000-0000000000a3'), 'prolongation');
reset role;
select tst.ok((select tier = 'premium' and tier_until >= current_date + 29 from cxs_profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'prolongation : Bâtisseur ouvert 30 jours de plus');
select tst.ok((select statut from cxs_recompenses where filleul_id = '00000000-0000-0000-0000-0000000000a3') = 'accordee', 'récompense marquée accordée');
-- Parrain coaché : la récompense part chez le coach (pas de prolongation automatique)
insert into cxs_parrainages (filleul_id, parrain_id, code) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'XXXXXX');
set role service_role;
select tst.ok((cxs_parrainage_premium('00000000-0000-0000-0000-0000000000b2')->>'coach')::boolean, 'parrain coaché : récompense à traiter par le coach');
reset role;
select tst.ok((select statut from cxs_recompenses where filleul_id = '00000000-0000-0000-0000-0000000000b2') = 'a_traiter', 'statut « à traiter »');
select tst.ok((select tier from cxs_profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'avance', 'formule du coaché inchangée');
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000b1');
select tst.ok(tst.n('select * from cxs_recompenses') = 1, 'b1 ne voit que ses récompenses');
select tst.ok((cxs_soc_moi()->>'filleuls_premium')::int = 1, 'b1 : 1 filleul passé Bâtisseur');
reset role;

-- Plafond : 12 récompenses par an
delete from cxs_recompenses where parrain_id = '00000000-0000-0000-0000-0000000000b1';
insert into auth.users (id, email) select ('00000000-0000-0000-0000-0000000010' || lpad(i::text, 2, '0'))::uuid, 'f' || i || '@exemple.invalid' from generate_series(1, 13) i on conflict do nothing;
insert into cxs_parrainages (filleul_id, parrain_id, code) select ('00000000-0000-0000-0000-0000000010' || lpad(i::text, 2, '0'))::uuid, '00000000-0000-0000-0000-0000000000b1', 'XXXXXX' from generate_series(1, 13) i on conflict do nothing;
set role service_role;
select cxs_parrainage_premium(('00000000-0000-0000-0000-0000000010' || lpad(i::text, 2, '0'))::uuid) from generate_series(1, 12) i;
select tst.ok((cxs_parrainage_premium('00000000-0000-0000-0000-000000001013')->>'raison') = 'plafond', '13e filleul de l''année : plafond de 12 mois');
reset role;

-- ---------- RGPD ----------
set role authenticated;
select tst.qui('00000000-0000-0000-0000-0000000000b2');
select cxs_soc_effacer_mes_donnees();
reset role;
select tst.ok(not exists (select 1 from cxs_soc_profils where user_id = '00000000-0000-0000-0000-0000000000b2')
  and not exists (select 1 from cxs_soc_reactions where user_id = '00000000-0000-0000-0000-0000000000b2'), 'effacement : profil et gestes de b2 supprimés');
select tst.ok((select count(*) from cxs_soc_profils) = 5, 'les autres membres ne sont pas touchés');
