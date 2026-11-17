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
