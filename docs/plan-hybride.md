# Plan · Module « athlète hybride », quêtes et personnage (3 sessions, 17/11/2026)

Référence métier : page Notion « Programme Athlète Hybride — Thomas Boulet » (17/11/2026). Elle n'est **pas copiée** dans `docs/` : sa section 1 contient des données personnelles (records, poids, situation familiale) et ce dépôt est public. Seules les règles génériques (sections 2 à 9) sont reprises, dans `data/hybride.json`.

## Principe
On ajoute, on ne refond pas. L'app reste « local d'abord » : le programme et les logs vivent sur le téléphone ; le serveur garde une copie pour le coach et calcule ce qui ne doit pas être falsifiable (XP, quêtes, objets débloqués).

## Ce qui est réutilisé
| Besoin | Existant réutilisé |
|---|---|
| Classement des exercices, muscles, patterns | `data/exercices.json`, `js/exercices.js` (8 patterns) |
| Volume pondéré 1 / 0,5 | même convention que `js/volume.js` (`SEC_COEF`) |
| Séances concrètes | `js/generateur.js` et `js/atelier.js` (session 2 : on leur passe les cibles du bloc) |
| Forme du jour (feu vert / orange / rouge) | `js/recuperation.js` (le feu), `js/hybride.js` (ce qu'on retire) |
| Logs de séance | `S().workouts` (format de `js/engine.js`) |
| Points, série, trophées | `js/quests.js` (mécaniques reprises si Thomas choisit de les unifier, question Q4) |
| Personas de test, harnais E2E | `tests/harness.js`, `tests/parcours-e2e.js` |

## Session 1 · Fondations (cette PR)
- `data/hybride.json` : qualités, fourchettes par groupe, progression du méso, 4 macrocycles, zones en % de VMA, blocs d'une séance, gabarits 3 à 6 séances, paliers de skills. Hypothèses isolées en tête (`hypotheses`).
- `js/hybride.js` (pur) : calendrier 12 semaines, cibles de volume, volume pondéré, alertes d'équilibre, règles d'ordre, allures, forme du jour, remplacement de programme avec accord et copie. Tests : `tests/hybride.test.mjs`.
- `supabase/migrations/2026-11-17_cxs_hybride.sql` + retour arrière + `tests/sql/` (règles d'accès testées sur Postgres local, dans les deux sens). **Non appliquée** (R1).

## Session 2 · Quêtes et progression
Catalogue de quêtes dans `data/hybride.json` ; moteur XP / séries / rangs / déblocages pur et testé ; événements d'XP dérivés des logs avec clé déterministe (idempotents) ; écriture côté serveur selon la réponse à Q1 ; génération du mésocycle via le générateur existant ; alertes branchées sur les vraies séances.

## Session 3 · Interface
Écrans (programme du jour, quêtes, radar des 7 qualités, frise du bloc, personnage), prototype de 2 personnages → arrêt R6, tests Playwright (390×844 et 360×740, clair et sombre, mouvement réduit), service worker, rapport, déploiement après « go ».

## Points d'arrêt
R1 : migration en production. R6 : style du personnage, objets payants, accès par formule, textes de vente.
