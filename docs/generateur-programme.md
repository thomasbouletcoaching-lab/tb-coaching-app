# Générateur de programme (créateur de programme, étape 3)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §2, §3, §4 et §8.1.

## Ce que c'est

À partir des réponses du questionnaire (étape 2) et de la bibliothèque (étape 1), l'app propose un programme de 12 semaines. L'écran s'appelle « Ma proposition » (Profil › Mon programme sur mesure › Voir mon programme proposé).

**C'est une proposition.** Elle n'est jamais appliquée toute seule : le programme en cours ne change que si le membre touche « Adopter ». Tout est gratuit, comme prévu dans la spec (squelette, isolation, répartition, règles de récupération, remplacer).

## Ce que l'écran montre

- **Squelette** : les 8 patterns (4 haut, 4 bas) avec leurs séries par semaine en barres, et les raisons d'un écart (priorité, point faible).
- **Ta semaine** : grille jours × patterns, plus la case est foncée, plus il y a de séries.
- **Tes séances** : exercices, séries × répétitions, RPE, durée estimée, bouton 🔄 « remplacer ».
- **Est-ce que ça tient ?** : couverture des 8 patterns, équilibre, récupération 48 h (72 h charnière lourde), durée des séances, écart séances voulues / tenables.
- Bouton « Autre variante » : d'autres exercices avec les mêmes règles.

## Règles (points de départ, tous réunis en tête de `js/generateur.js`)

| Sujet | Règle |
|---|---|
| Séances | La plus petite valeur entre « voulues » et « tenables ». |
| Structure | 2 : corps entier A/B · 3 : corps entier ×3 · 4 : haut/bas ×2 · 5 : haut/bas ×2 + séance « priorités » · 6 : pousser/tirer/jambes ×2. Le style choisi (corps entier, haut/bas, PPL) est respecté quand c'est possible. |
| Séries par pattern et par semaine | Débutant ou reprise 4 (3 à 6) · régulier 8 (6 à 10) · avancé 10 (8 à 14) · moins de 2 h par semaine 4 (3 à 5). |
| Écarts voulus | +2 par priorité et par point faible, affichés et justifiés. −1 si travail physique (bas du corps), sommeil court ou stress élevé, ou départ « sous capacité ». |
| Départ sous capacité | Si 3 arrêts ou plus, ou si l'écart voulues/tenables est de 2 ou plus : −1 série et RPE plafonné à 7,5. |
| Exercices | Faisables avec le matériel, sans zone gênée, jamais un détesté, un adoré en premier. Débutant : exercices débutants. Anatomie : talons surélevés/hack/presse si le buste penche ou la cheville bloque. |
| Récupération | 48 h entre deux séances d'un même pattern, 72 h pour une charnière lourde. Vérifié pour 2 à 6 séances et les 4 styles. |
| Temps | On retire d'abord des séries aux patterns les moins prioritaires, jamais un pattern de la semaine. L'isolation n'entre que s'il reste du temps. |
| Isolation | Selon l'objectif (muscle : biceps, triceps, élévations latérales) et les priorités (bras, épaules, mollets, abdos). Pas de biceps ni d'élévations pour la force. |
| Modules | Mobilité de cheville/épaule/hanche selon les tests, unilatéral et anti-rotation pour le sport. Le cardio reste une suggestion, hors séances. |

Un pattern sans exercice possible (par exemple le tirage vertical sans barre de traction ni élastique) est dit clairement : alerte rouge et case « Aucun exercice possible », sans rien inventer.

## Adoption

« Adopter » ajoute le programme (format du moteur de séances) aux programmes perso, le suit dès la semaine 1 et garde séances, charges, journal et profil. Une seule version générée est conservée (`gen-…`). Refusé si une séance est en cours.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/generateur.js` | Module pur : `generer()`, `controles()`, `remplacerLigne()`, `alternativesLigne()`, `versProgramme()`. |
| `js/views/monplan.js` | Écran « Ma proposition ». |
| `S().monplan` | `{ at, progAt, seed, prop, adopte }` sur le téléphone. Refait si les réponses changent. |

Aucune table Supabase, aucune migration.

## Tests

`node --test tests/generateur.test.mjs` (19 tests : de 2 à 6 séances et 4 styles, fourchettes de volume, récupération, temps, gênes, favoris, matériel, format du moteur) et `node tests/monplan-e2e.js` (iPhone 390×844 : proposition, remplacer, autre variante, adoption, le moteur construit la première séance, garde-fous).

## Pas encore fait (étapes suivantes)

Indice de difficulté de la séance et versions courtes (étape 4), placement dans l'agenda (5), score de soutenabilité (6), récupération et fatigue nerveuse (7), profils (8). La répartition sur les jours (lundi, mercredi…) est un défaut raisonnable, pas encore celle de l'agenda personnel.
