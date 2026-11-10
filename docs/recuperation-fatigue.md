# Récupération et fatigue nerveuse (créateur de programme, étape 7)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §6. **Fonction Premium** (Bâtisseur), comme décidé le 10/11. L'onglet Récupération existant (sommeil, ressenti, glycogène, jeûne, insuline) reste **gratuit et inchangé**.

## Ce que le membre Premium voit

Dans l'onglet **Récupération** (aujourd'hui) et sur l'**accueil** :

- **Check-in de 10 secondes** : sommeil (heures et qualité), énergie, stress, courbatures, motivation, par des réponses à toucher. Trois réponses au moins.
- **Feu du jour** : 🟢 vert (séance comme prévue), 🟠 orange (version allégée conseillée), 🔴 rouge (repos actif ou séance courte), avec au plus trois raisons concrètes et un conseil. Les conseils nutrition de l'ancienne carte (glycogène) y sont intégrés, pas dupliqués.
- **Fatigue nerveuse** (faible, modérée, élevée) : charge des 7 derniers jours comparée à la moyenne des 4 semaines d'avant, séries lourdes, patterns très sollicités ces 3 jours.
- **Séance allégée au démarrage** : si le feu est orange ou rouge, la feuille de démarrage propose une version allégée (**préselectionnée**, mais « Telle que prévue » est à un tap). Jamais imposée.
- **Semaine de décharge** : proposée après **3 jours rouges sur 5**, ou 2 de suite avec une fatigue élevée. 7 jours, séances allégées, arrêt en un geste. Le membre décide ; un refus fait taire la proposition jusqu'au lendemain.
- **Rappel de coucher** (le soir) lié à la séance du lendemain : « Demain, séance à 06:30 : lève-toi à 05:15 et couche-toi avant 21:15 pour garder 8 h de sommeil. » Il utilise le lever, le coucher et le trajet de « Ma semaine ».

## Comment le feu est calculé (`js/recuperation.js`)

**Disponibilité (0 à 100) = check-in − 0,45 × fatigue nerveuse.** Vert à partir de 70, orange à partir de 45, rouge en dessous.

| Check-in | Poids | Remarque |
|---|---|---|
| Sommeil | 25 % | 7 h 30 et plus = 100 ; la qualité module. |
| Énergie | 25 % | |
| Motivation | 20 % | |
| Stress | 15 % | inversé |
| Courbatures | 15 % | inversées |

Sans check-in, le calcul part de 78 : seuls les signaux des séances font bouger le feu, et l'écran le dit.

| Signal de fatigue nerveuse (points) | Déclenchement |
|---|---|
| Ratio charge récente / habituelle (jusqu'à 45) | à partir de 1,25 ; il faut 2 semaines passées avec séances. Même calcul que l'indice de difficulté. |
| Séries lourdes (jusqu'à 20) | ≥ 85 % du 1RM ou RPE ≥ 9 sur un mouvement polyarticulaire : 8 puis 12 séries sur 7 jours. |
| Baisse de performance (jusqu'à 35) | la dernière charge maximale estimée d'un mouvement baisse d'au moins 5 % face au meilleur des 28 jours. |
| RPE plus élevé que prévu (jusqu'à 30) | écart moyen ressenti − prévu à partir de 0,4 point sur 14 jours (8 séries notées minimum). |
| Séries manquées (jusqu'à 15) | à partir de 10 % des séries prévues non faites. |
| Sommeil et motivation en baisse (18) | 3 derniers jours contre les 7 d'avant. |

Garde-fous : une nuit sous 5 h avec une énergie à 3 sur 10 ou moins n'est jamais verte. Un bon check-in ne masque pas une semaine très chargée (testé).

## Séance allégée (`adapterSeance`)

| Mode | Séries retirées | Effort plafonné | Plancher |
|---|---|---|---|
| Orange | environ 25 % | RPE 7,5 | 2 séries par exercice |
| Rouge | environ 40 % | RPE 7 | 2 |
| Décharge | environ 40 % | RPE 6,5 | 2 |

L'échauffement est gardé, les séries en dropset ou à l'échec deviennent des séries normales, les charges sont recalculées pour l'effort plafonné et arrondies au pas de charge. La séance d'origine n'est jamais modifiée. Si le programme est déjà léger, l'allègement l'est aussi : l'écran dit simplement « 12 séries au lieu de 13 ».

## Données et vie privée

- Le check-in réutilise les champs existants du journal du jour (`sleep`, `sleepQ`, `feel.energy`, `feel.stress`) et en ajoute deux (`feel.sore`, `feel.motiv`) plus `feu`. **Rien n'est dupliqué** : les curseurs de l'onglet sont les mêmes (Courbatures et Motivation s'y ajoutent, pour tout le monde).
- Ces champs font partie du journal `daily`, **déjà envoyé au coach** dans l'instantané (comme le sommeil et le ressenti jusqu'ici). En plus, le coach reçoit `summary.recup` (dernier feu, jours rouges) et **l'alerte « Fatigue : 3 jours rouges sur 5 »** quand elle s'applique. Un membre qui ne fait pas de check-in n'envoie rien de nouveau.
- La décharge choisie (`S().decharge`) reste sur le téléphone.
- Aucune table Supabase, aucune migration.

## Décharge planifiée

Elle existe déjà dans les programmes (toutes les 4 ou 6 semaines pour les programmes générés). L'écran indique la prochaine semaine de décharge du programme ; sinon il rappelle la cadence selon le niveau (débutant 8 semaines, régulier 6, avancé 4, soit « toutes les 4 à 8 semaines » de la spec). Je n'ai rien changé au moteur de programmes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/recuperation.js` | Module pur : check-in, signaux, fatigue nerveuse, `etat()`, décharge, `adapterSeance()`, `rappelCoucher()`, `resume()` pour le coach. |
| `js/views/fatigue.js` | Check-in, bloc du feu, bloc de démarrage, carte d'accueil, décharge. |
| `js/views/recup.js` | Insertion du bloc ; curseurs Courbatures et Motivation. |
| `js/views/train.js` | La feuille de démarrage affiche le bloc et applique l'allègement choisi. |
| `js/sync.js` | `summary.recup` et l'alerte de fatigue pour le coach. |

## Tests

`node --test tests/recuperation.test.mjs` (23 tests : check-in, charge et ratio, séries lourdes, dérive du RPE, performance, feu, décharge, séance allégée, rappel de coucher) et `node tests/fatigue-e2e.js` (45 vérifications sur iPhone 390×844 : écran verrouillé en gratuit, check-in, feu vert et rouge, séance allégée orange et « telle que prévue », fatigue détectée sans check-in, décharge proposée, refusée, lancée, arrêtée, rappel de coucher avec date simulée, instantané du coach, clair et sombre).

## Pas encore fait

Fréquence cardiaque au repos et variabilité cardiaque (la spec les marque facultatives) ; détection des profils (étape 8).
