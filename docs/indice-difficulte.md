# Indice de difficulté de la séance (créateur de programme, étape 4)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §5.

## Ce que c'est

Un repère unique pour dire à quel point une séance est « lourde à avaler » : **Légère, Modérée, Exigeante, Très exigeante** (4 barres), avec la durée à côté. Côté membre il s'appelle « Indice de difficulté de la séance ». Le mot INOL n'apparaît pas à l'écran du membre ; il est cité une fois dans « En savoir plus ». Le coach voit le détail INOL.

## Où il apparaît

- **Ma proposition** : sous le titre de chaque séance, avec le bouton ⓘ « En savoir plus » et le bouton **⚡ Version courte**.
- **Entraînement › Programme** : sous le titre de chaque séance de la semaine, pour **tous** les programmes (banque, programmes perso, programmes du coach, programme généré), pas seulement les nouveaux.
- **Côté coach** : le ⓘ ouvre en plus « Détail coach » : INOL total, coût nerveux, et INOL et coût nerveux par exercice, l'indice sur 100 et les coefficients.

## Calcul (tout est dans `js/indice.js`)

| Ingrédient | Calcul | Poids | Maximum de référence |
|---|---|---|---|
| Durée | échauffement 8 min + séries × (40 s d'exécution + repos) | 30 % | de 20 à 100 min |
| Charge d'intensité | par série : répétitions ÷ (100 − % du 1RM), dénominateur plancher 5 ; % estimé par Epley corrigé par les répétitions en réserve, **identique au moteur de séances** (vérifié dans les tests) | 40 % | INOL 11 |
| Coût nerveux | par série : coût de l'exercice (isolation 0,25, intermédiaire 0,6, lourd polyarticulaire 1) × effort ((RPE − 5) ÷ 5) ; × 1,5 si ≥ 85 % du 1RM ou RPE ≥ 9 sur un mouvement polyarticulaire | 30 % | 16 |

Bandes : Légère moins de 28, Modérée moins de 50, Exigeante moins de 70, Très exigeante au-delà. Les séries d'échauffement ne comptent pas. Les maintiens en secondes comptent peu (1 répétition par 10 s à 60 %). La mobilité compte pour zéro.

Exemples calibrés (tests) : séance de débutant en 40 min = Légère ; 4×5 classique = Modérée ; haut du corps de 74 min à RPE 8 = Exigeante ; squat, développé couché et soulevé de terre à RPE 9 = Très exigeante ; trois séries d'isolation à RPE 9 = Légère.

Les coefficients et les bandes sont des **points de départ** (la spec les classe « Terrain ou hypothèse ») : réglables d'un seul endroit, à ajuster avec les données des clients.

## Règles ajoutées au générateur

- **Pas deux séances « très exigeantes » à moins de 48 h** (spec §5.3) : le générateur allège la seconde (une série en moins sur le mouvement le plus lourd) jusqu'à ce que ça tienne. Contrôle visible dans « Est-ce que ça tient ? ». Vérifié pour 3 à 6 séances, 4 styles, 2 objectifs.
- **Charge de la semaine** (`prop.charge` : INOL, coût nerveux, minutes, indice moyen) : calculée et gardée. Elle sera comparée à la capacité estimée de la personne avec le score de soutenabilité (étape 6).

## Version courte (20, 30 ou 45 min)

Garde le squelette, retire l'isolation et les modules, ramène l'échauffement à 3-5 min, plafonne les repos (90, 120 ou 150 s), puis retire des séries (les patterns prioritaires et les mouvements lourds en dernier), jamais sous 2 séries tant que c'est possible ; en dernier recours, un pattern déjà présent ailleurs dans la séance. Consultation seulement : la séance du programme ne change pas. Au moment de commencer, la **Séance express** existante du moteur fait la même chose à la volée ; je ne l'ai pas modifiée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/indice.js` | Module pur : `indiceSeance()`, `chargeSemaine()`, `enchainementsLourds()`, `allegee()`. |
| `js/views/indice-ui.js` | Pastille, « En savoir plus », détail coach, adaptateur des programmes du moteur. |
| `js/generateur.js` | Indice par séance, règle des séances très exigeantes, `allegeeSeance()`. |

Aucune table Supabase, aucune migration. Les propositions enregistrées avant cette étape sont recalculées à l'affichage.

## Tests

`node --test tests/indice.test.mjs` (18 tests) et `node tests/indice-e2e.js` (26 vérifications sur iPhone 390×844 : proposition, ⓘ, version courte, onglet Entraînement sur programme de la banque et programme adopté, clair/sombre, détail coach, % du 1RM identique au moteur).
