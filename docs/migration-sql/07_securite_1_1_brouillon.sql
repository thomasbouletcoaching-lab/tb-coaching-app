-- BROUILLON, NON EXÉCUTÉ. Correctifs de sécurité (audit § 5, point 1.1) à valider par Thomas avant application.
-- Constat (conseiller Supabase, 15/11) : des fonctions SECURITY DEFINER sont appelables sans connexion (rôle anon).
-- Choix minimal et sûr :
--  * On ne touche PAS à cxs_is_coach ni is_coach : les règles d'accès les utilisent ; leur retirer l'accès casserait des lectures.
--  * Les fonctions de déclencheur ne sont pas des API : aucun droit d'exécution n'est nécessaire pour qu'un déclencheur s'exécute.
--  * L'app n'appelle que cxs_msgs_left et cxs_set_tier, toujours connectée (js/cloud.js).

-- 1. Déclencheurs exposés comme API : plus appelables par RPC.
revoke execute on function public.messages_guard() from anon, authenticated, public;
revoke execute on function public.cxs_notify_member_on_reply() from anon, authenticated, public;

-- 2. Droits modifiant les formules : réservés aux connectés (la fonction vérifie déjà le rôle coach).
revoke execute on function public.cxs_set_tier(uuid, text, date) from anon, public;

-- 3. Quota de messages : utilisé seulement par les membres connectés.
revoke execute on function public.cxs_msgs_left(uuid) from anon, public;

-- 4. Chemin de recherche figé sur une fonction du schéma de migration.
alter function cxs_migration.num() set search_path = '';

-- Hors de ce fichier (à traiter ensuite, avec accord) :
--  * 40 fonctions exécutables par les connectés : à examiner une par une (certaines sont voulues).
--  * 7 tables avec RLS sans politique (refus total) : vérifier qu'aucune n'est lue par l'app.
--  * Extensions pg_net et pg_walinspect dans le schéma public : à déplacer.
--  * Protection des mots de passe compromis : à activer dans le tableau de bord Supabase (Auth), par Thomas.
