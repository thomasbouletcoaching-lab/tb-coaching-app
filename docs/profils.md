# Détection des profils et parcours « reprise durable » (créateur de programme, étape 8)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §9. **Gratuit** : c'est le parcours de reprise, il ne doit jamais être payant.

## Ce que le membre voit

- **Mon profil** (Profil › Mon profil, et depuis la fin du questionnaire) : les profils qui le décrivent, chacun avec une phrase **toujours formulée en positif** (« Reprise durable » et non « yoyo »).
- **Son minimum** : quand le profil le demande, « Deux séances de 20 minutes : c'est le minimum qui compte, même les semaines difficiles. »
- **Son total de séances** : il ne baisse jamais, même si une séance est corrigée ou retirée de l'historique.
- **Ses plans « si… alors… »** : trois défauts rédigés à l'avance (« Si je finis tard, alors je fais la version de 20 minutes, à la maison »), qu'il peut retirer ou compléter.
- **On reprend** : après **deux séances manquées sur les 14 derniers jours**, et sans séance faite aujourd'hui, une carte sur l'accueil propose une séance de 20 minutes, sans rattraper ce qui a manqué. Elle disparaît dès qu'une séance est faite. Le bouton est aussi dans Mon profil.

## Les profils détectés

| Profil (nom affiché) | Repéré par |
|---|---|
| Départ en confiance | niveau débutant |
| Reprise en douceur | retour après une pause (remplacé par « Reprise durable » s'il y a des arrêts répétés) |
| **Reprise durable** | deux arrêts ou plus, ou un arrêt rapide après une reprise |
| Progression méthodique | un ou plusieurs mouvements qui stagnent (historique de charges) |
| Précision et maîtrise | plus de deux ans d'entraînement |
| Objectif compétition | objectif de force avec un chiffre ou une discipline de force |
| Silhouette en vue | perte de gras ou recomposition |
| Forme durable | 40 ans et plus avec un objectif santé, ou objectif énergie |
| Organisé et efficace | enfants et séances de 45 min ou moins |
| Rythme changeant | au moins trois blocs variables cette semaine ou la précédente |
| Équilibre de vie | stress élevé ou sommeil de 5,5 h ou moins |
| Corps déjà sollicité | travail physique |
| Régularité d'abord | arrêts après une séance ratée (perfectionnisme) |
| Sportif polyvalent | objectif sport |

Au plus **quatre** profils sont affichés. Un profil cumule les autres : un parent pressé en reprise peut être « Reprise durable », « Organisé et efficace » et « Équilibre de vie ».

**Non encore détectés** (spec §9, à faire ensuite) : le zappeur de programmes et le sur-motivé (il faut l'historique des changements de programme et des charges, pas encore relu), le voyageur, le sédentaire de bureau et le tout-ou-rien au sens strict. Ils ne sont pas inventés.

## Ce que les profils changent (et seulement ça)

- **Plancher** : deux séances de 20 minutes pour « Reprise durable » et « Reprise en douceur » ; deux séances de 30 minutes pour « Organisé et efficace », « Équilibre de vie » et « Régularité d'abord ».
- **Mode « On reprend »** : séance courte (20 minutes, moteur d'entraînement existant) marquée `crise`.
- **Plan de départ** : le démarrage sous la cible et la version tenable de l'étape 6 restent la référence ; les profils ne les modifient pas.

Un profil ne change jamais les données, ne bloque aucune fonction et n'impose rien.

## Données et vie privée

- Les profils sont calculés à la volée à partir des réponses du questionnaire, du calendrier et des séances. `S().profil` garde seulement le total et les plans « si… alors… ».
- **Le coach reçoit les identifiants des profils** (`summary.profils`), jamais les réponses de santé : zones et notes d'anamnèse restent hors de l'instantané de profils (testé).
- Aucune table Supabase, aucune migration.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/profils.js` | Module pur : catalogue, `detecter()`, `plancher()`, `enReprise()`, `totalSeances()`, `siAlorsDe()`, `pourCoach()`. |
| `js/views/profil.js` | Écran Mon profil, carte « On reprend », action de démarrage. |
| `js/sync.js` | `summary.profils` (identifiants). |

## Tests

`node --test tests/profils.test.mjs` (16 tests : chaque profil, plancher, mode « On reprend », total qui ne recule pas, plans « si… alors… », formulation positive, aucune donnée de santé vers le coach) et `node tests/profils-e2e.js` (20 vérifications sur iPhone 390×844 : carte « On reprend » et séance de 20 minutes, écran Mon profil en positif, minimum, plans ajoutés et retirés, total gardé à 12 alors que l'historique n'en compte que 5, pas de carte sans séance manquée, lien depuis le questionnaire, instantané du coach, thème sombre).

## Calibrage

Les seuils (deux séances manquées sur 14 jours, deux arrêts pour la reprise durable, trois blocs variables, sommeil de 5,5 h) sont des points de départ réunis dans `js/profils.js`, à ajuster avec les données des clients.
