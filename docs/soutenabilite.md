# Score de soutenabilité (créateur de programme, étape 6)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §8.1, §8.2 et §8.3. **Le score est Premium** (Bâtisseur) ; l'adéquation à l'objectif (§8.1) reste gratuite, dans « Est-ce que ça tient ? » de la proposition.

## Ce que c'est

« Est-ce que ça tient dans ta vie ? » : un score de 0 à 100 et un niveau, **Tenable / Ambitieux / Trop ambitieux**, pour le plan proposé. Il s'ouvre depuis la carte de « Ma proposition ».

Chaque ingrédient est expliqué en une phrase, toujours formulée comme un constat sur le plan, jamais sur la personne.

| Ingrédient | Poids | Ce qu'il mesure |
|---|---|---|
| ⏱️ Le temps | 25 % | Part du **temps libre utile** consommée par les séances (durée + trajets). Mesuré avec « Ma semaine » ; sinon estimé, et l'écran le dit. |
| 🏋️ La charge | 25 % | Charge de la semaine (somme des indices de séance) face à la **capacité** : niveau, sommeil, stress, travail physique, enfants en bas âge. |
| 📈 Le saut | 20 % | Séances du plan moins séances par semaine d'aujourd'hui (moyenne mesurée des dernières semaines, sinon estimée selon le niveau). 0 → 5 séances est le pire cas. |
| 🔁 L'historique | 15 % | Nombre d'arrêts passés et durée avant l'arrêt (questionnaire avancé). Inconnu : neutre, et signalé. |
| 🎯 Ce que tu tiens | 15 % | Séances du plan face aux séances que la personne juge réalistes. |

Niveaux : **Tenable** à partir de 72, **Ambitieux** à partir de 50, **Trop ambitieux** en dessous. Garde-fous : un point très faible *du plan* (temps, charge, saut, écart) empêche « Tenable » ; deux gros risques cumulés donnent « Trop ambitieux » ; un temps libre mesuré impossible aussi. L'historique pèse dans le score mais ne bloque jamais « Tenable » : il décrit la personne, pas le plan, sinon aucune version tenable n'existerait pour quelqu'un qui a déjà arrêté.

Message quand c'est trop haut : « Ce plan vise trop haut pour ta vie actuelle. Mieux vaut 3 séances tenues 12 semaines que 5 pendant 3 semaines. » (nombres réels).

**Temps libre utile** : on ne compte pas plus de 5 h libres par jour (le reste, c'est la vie) et seulement 60 % de ce temps. Sans « Ma semaine », on estime 21 h par semaine, réduites par la capacité de vie.

## Version tenable

Si le plan n'est pas « Tenable », l'écran propose **moins de séances, plus courtes** : on essaie de 5 séances à 2 séances et plusieurs durées, et on garde **le plus gros volume qui reste tenable**. Les 8 patterns restent couverts (le même squelette). Le membre la voit dans « Ma proposition » en un geste, et « Revenir à mon plan de départ » la défait. **Les réponses du questionnaire ne sont jamais modifiées.** Si rien n'est tenable, on propose la plus légère et on l'écrit.

## Montée progressive

« Démarrer sous la cible, ajouter une séance quand la régularité est prouvée. » Quand la marche est grande (3 séances de plus que d'aujourd'hui), après 3 arrêts ou plus, ou si l'écart voulu/réaliste atteint 2, l'écran propose de **démarrer à un cran en dessous** avec la liste des paliers. « Démarrer à N séances » place N jours dans la semaine type (planificateur de l'étape 5). Quand **3 semaines de suite sont à 90 % des séances prévues**, une carte sur l'accueil propose d'ajouter une séance : un geste, jours replacés. Seules les semaines complètes depuis le début du palier comptent.

## Adéquation à l'objectif (gratuit)

Trois messages au plus dans « Est-ce que ça tient ? » : force (si le mouvement visé dans l'objectif chiffré n'est fait qu'une fois par semaine : « Tu vises la force au développé couché mais tu ne fais qu'une séance de PH par semaine »), muscle (volume renforcé sur les priorités, isolation), perte de gras (squelette gardé, lien avec le déficit calorique), santé, sport (unilatéral, anti-rotation), reprise.

## Données et vie privée

Tout est calculé sur le téléphone. `S().montee` et la version choisie (`S().monplan.ajust`) restent sur le téléphone, rien ne part chez le coach. Aucune table Supabase, aucune migration.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/soutenabilite.js` | Module pur : `ingredients()`, `evaluer()`, `versionTenable()`, `depart()`, `paliers()`, `regulariteProuvee()`, `controlesObjectif()`. |
| `js/views/soutenabilite.js` | Carte, écran, actions, carte de montée de l'accueil. |
| `js/views/semaine.js` | `planType(k)` et `appliquerSemaineType(k)` : la semaine type pour k séances. |

## Tests

`node --test tests/soutenabilite.test.mjs` (18 tests : poids, capacité de vie, temps libre, chaque ingrédient, profils types, garde-fous, version tenable, montée, régularité, objectifs) et `node tests/soutenabilite-e2e.js` (41 vérifications sur iPhone 390×844 : écran verrouillé en gratuit, plan trop ambitieux, version tenable appliquée puis défaite, montée progressive, régularité prouvée simulée sur 3 semaines, temps libre mesuré, clair et sombre).

## Calibrage

Les coefficients et seuils sont des **points de départ** (la spec les classe « Terrain ou hypothèse »), réunis en tête de `js/soutenabilite.js`. Profils types vérifiés : débutant à la maison 3 × 45 min = Tenable (92) ; régulier 4 séances alors qu'il en fait 3 = Tenable (87) ; débutant 0 → 5 séances en forme = Ambitieux (75) ; débutant fatigué, avec enfants et plusieurs arrêts, 0 → 5 séances = Trop ambitieux (55), version tenable : 3 séances de 60 min.

## Pas encore fait

Récupération et fatigue nerveuse (étape 7 : check-in, feux, décharges) et détection des profils (étape 8, qui s'appuiera sur l'historique d'abandon et le comportement).
