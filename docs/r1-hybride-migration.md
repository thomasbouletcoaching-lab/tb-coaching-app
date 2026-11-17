# Dossier R1 · Migration « hybride » (à valider par Thomas avant toute application)

**Statut : APPLIQUÉE le 17/11/2026 à 19 h 31** après « go » de Thomas (migration Supabase `cxs_hybride_20261117`).

Vérifié juste après, en production (lecture des droits, aucune ligne de client lue) : RLS active sur les 5 tables ; anon ne lit rien ; authenticated n'a aucun droit d'écriture sur XP, quêtes et consentement, et seulement les colonnes prévues sur bloc et personnage ; pas de TRUNCATE ; séquence de l'XP fermée ; `cxs_hyb_coache` non exécutable par un membre. L'outil de conseils de sécurité Supabase signale les 3 fonctions appelables par un membre connecté (`cxs_hyb_coach_peut_lire`, `cxs_hyb_consentir`, `cxs_hyb_effacer_mes_donnees`) : c'est voulu, chacune n'agit que sur la personne connectée.

## Fichier exact
`supabase/migrations/2026-11-17_cxs_hybride.sql`

## Ce qu'il change
- Crée 5 tables nouvelles : `cxs_hyb_bloc`, `cxs_hyb_personnage`, `cxs_hyb_quetes`, `cxs_hyb_xp`, `cxs_hyb_consentement`.
- Crée 4 fonctions : `cxs_hyb_coache`, `cxs_hyb_coach_peut_lire`, `cxs_hyb_consentir`, `cxs_hyb_effacer_mes_donnees` (aucune fonction existante n'est modifiée).
- **Ne modifie aucune table ni aucune fonction existante.** Ne lit ni ne modifie aucune ligne de client.
- Vérifié en lecture seule le 17/11/2026 : aucun objet de ce nom n'existe déjà en production.

## Règles d'accès (en une phrase chacune)
- Un membre ne voit que ses propres lignes.
- Le coach voit un client coaché (formule non échue) ; un abonné en autonomie seulement s'il a donné son accord (séparé, révocable à tout moment).
- Le téléphone ne peut jamais écrire d'XP, de quête réussie ni d'objet débloqué : seul le serveur le peut.
- Un membre peut tout effacer d'un geste.

## Test sur branche
Pas de branche Supabase payante : la migration est testée sur un Postgres local qui imite Supabase (`tests/sql/run-hybride.sh`), aussi lancé par la CI sur chaque PR. Résultat le 17/11/2026 : 64 contrôles passés (22 refus attendus, 42 accès ou cloisonnements attendus), avec les droits par défaut de Supabase imités, migration rejouée deux fois sans erreur, retour arrière puis réapplication réussis. Limite : Postgres 16 en local, 17 en production (aucune fonction propre à une version n'est utilisée).

## Sauvegarde
La migration ne touche que des objets nouveaux. Avant application : (1) je relance en lecture seule la vérification « aucun objet `cxs_hyb_*` » ; (2) je note l'heure de la dernière sauvegarde quotidienne du plan Pro (Supabase › Database › Backups) ; (3) j'exporte la liste des politiques et fonctions existantes dans `docs/migration-sql/` pour comparaison après coup.

## Retour arrière (testé)
`supabase/migrations/2026-11-17_cxs_hybride_retour.sql` : retire les fonctions et les politiques, déplace les 5 tables dans un schéma `archive_hybride` invisible de l'app. **Aucune donnée supprimée.** Après un retour arrière, une demande d'effacement RGPD se traite à la main dans `archive_hybride`.

## Impact clients
Aucun tant que l'app n'utilise pas ces tables (session 3). Les 16 comptes actuels sont en formule « surmesure » ou « invité » : tous comptent comme coachés (décision C56), le coach les voit comme aujourd'hui.

## R1 bis · Fonction serveur `hybride-xp`

**Déployée le 17/11/2026** après « go » de Thomas (version 1, `verify_jwt` désactivé comme `billing` : la fonction vérifie elle-même la session par `auth.getUser`).
- Source : `supabase/functions/hybride-xp/index.ts`. Version déployée identique, sauf l'import du moteur, épinglé sur le commit `7a08c4f` : `https://raw.githubusercontent.com/thomasbouletcoaching-lab/tb-coaching-app/7a08c4f86a9f49d5cedb8294b169f5d55ea1049a/supabase/functions/hybride-xp/moteur.js` (fichier figé : les règles ne changent qu'à un nouveau déploiement).
- Vérifié juste après : appel sans jeton → 401 ; jeton invalide → 401 avec message générique ; GET → 405. Aucun appel avec un vrai compte (aucune donnée de client lue).
- N'agit que sur la personne connectée (identifiant tiré du jeton, jamais de la requête). Écrit `cxs_hyb_xp` et `cxs_hyb_quetes` sans jamais écraser (« on conflict do nothing »), et `cxs_hyb_personnage.debloques` (union, jamais de retrait ; l'apparence n'est pas touchée).
- Retour arrière : supprimer la fonction dans Supabase › Edge Functions. Aucune donnée n'est perdue.
- Pour redéployer après une modification : `node tools/build-fonction-hybride.mjs`, commit et push, puis déployer `index.ts` en remplaçant `./moteur.js` par l'adresse brute du nouveau commit.
