# Spécification — Constructeur de programme par volume hebdomadaire

Application : TB my Coach (éditeur coach + vue client)
Statut : livré le 3 novembre 2026 (écran « Volume de la semaine », `js/volume.js` + `js/views/volume.js`)

---

## 1. Objectif

Permettre de construire un programme en partant du **travail total de la semaine**, puis de le répartir sur les jours.

Trois niveaux de pilotage coexistent :

1. **Par exercice** : séries cibles, plage de reps, intensité (RPE, % ou charge absolue). Pensé pour la force (bench, squat, traction, dips, soulevé de terre).
2. **Par faisceau musculaire** : volume calculé automatiquement à partir des exercices.
3. **Par muscle** : somme des faisceaux, comparée aux repères MV / MEV / MAV / MRV.

Le programme se construit en **deux temps** : le **brouillon hebdomadaire** (quoi faire dans la semaine), puis l'**assignation aux jours** (quand le faire).

---

## 2. Modèle de données

### 2.1 Bibliothèque d'exercices

| Champ | Type | Exemple |
|---|---|---|
| `id` | uuid | |
| `nom` | texte | Développé couché |
| `muscle_principal` | enum | pectoraux |
| `faisceaux` | liste de {faisceau, coefficient} | pectoral sup (1), triceps (0,5), deltoïde ant (0,5) |
| `type_charge` | enum | `barre`, `lest`, `poids_du_corps`, `machine` |
| `est_force` | booléen | true pour bench, squat, traction, dips, SDT |

Coefficients par défaut : **principal = 1**, **secondaire = 0,5**. Modifiables par exercice par le coach.

### 2.2 Brouillon hebdomadaire

Objet distinct du programme publié (statut `draft`), pour ne jamais exposer un plan incomplet au client. Stocké dans Supabase, table `programme_drafts`, accessible depuis tous les appareils.

| Champ | Type |
|---|---|
| `id` | uuid |
| `programme_id` | uuid |
| `bloc_id` | uuid (optionnel, un bloc = plusieurs semaines) |
| `statut` | `draft` / `publie` |
| `lignes` | liste de LigneExercice |

### 2.3 LigneExercice

| Champ | Type | Obligatoire |
|---|---|---|
| `exercice_id` | uuid | oui |
| `series_cibles` | entier | oui |
| `reps_min` / `reps_max` | entier | oui |
| `intensite` | {type: `rpe` \| `pourcentage` \| `charge`, valeur} | non |
| `jour` | entier (1 à 7) ou `null` | non (non assigné tant que null) |
| `lest_kg` | décimal | si `type_charge = lest` |

Une ligne sans `jour` est dans le brouillon. Une ligne avec `jour` apparaît dans la séance correspondante.

### 2.4 Repères de volume

| Champ | Type |
|---|---|
| `muscle` | enum |
| `mv`, `mev`, `mav`, `mrv` | entiers (séries / semaine) |
| `surcharge_coach` | objet optionnel (par client, par bloc) |

Valeurs par défaut (indicatives, source Israetel/RP) :

| Muscle | MV | MEV | MAV | MRV |
|---|---|---|---|---|
| Quadriceps | 6 | 8 | 12-16 | 20 |
| Ischio-jambiers | 4 | 6 | 10-14 | 20 |
| Pectoraux | 6 | 8-10 | 12-20 | 22 |
| Dos | 6 | 10 | 14-22 | 25 |
| Deltoïde latéral | 0-8 | 8 | 16-22 | 26 |
| Biceps | 6 | 8 | 14-17 | 26 |
| Triceps | 4 | 6 | 10-14 | 18-22 |

---

## 3. Calculs

### 3.1 Volume par faisceau

```
volume_faisceau(f) = Σ over lignes L où f ∈ faisceaux(L.exercice) :
                       L.series_cibles × coefficient(L.exercice, f)
```

Résultat décimal, arrondi à 0,5 pour l'affichage.

### 3.2 Volume par muscle

```
volume_muscle(m) = Σ over faisceaux f appartenant à m : volume_faisceau(f)
```

Un faisceau appartient à un seul muscle. Pas de double comptage.

### 3.3 Statut par muscle

| Plage (séries / semaine) | Statut | Couleur |
|---|---|---|
| < MV | Insuffisant | rouge |
| MV → MEV | Maintien | orange |
| MEV → MAV | Progression | vert |
| MAV → MRV | À surveiller | jaune |
| > MRV | Excessif | rouge |

Pour les faisceaux, le statut est **indicatif** : le repère est celui du muscle parent, réparti selon la part du faisceau dans le muscle. Affiché avec la mention « indicatif ».

### 3.4 Volume par exercice (force)

Deux modes de pilotage possibles :
- **Par séries** : `series_cibles` est saisi (ex. 4 × 5).
- **Par tonnage** : `tonnage_cible` saisi (ex. 10 000 kg/semaine), le nombre de séries est déduit de la charge prévue.

Les deux modes sont livrés dès la V1. Mode par défaut : séries. Le mode tonnage s'active par exercice.

### 3.5 Contrôle de cohérence (non bloquant)

Signaler, sans bloquer :
- un muscle au-dessus de MRV alors qu'un exercice cible n'est pas atteint ;
- plus de X séries d'un même muscle dans une séance (seuil configurable, défaut 10) ;
- une fréquence hebdomadaire d'un muscle supérieure à 3 jours sans justification.

---

## 4. Interface

### 4.1 Éditeur coach

**Colonne gauche** : bibliothèque, filtrable par muscle, faisceau, type (force / accessoire).
Action : cocher ou ajouter un exercice, puis saisir séries, reps, intensité.

**Colonne centrale** : brouillon de la semaine. Liste des lignes, édition en place.

**Colonne droite** : jauges.
- une jauge par muscle (volume total, repère MV/MEV/MAV/MRV en arrière-plan) ;
- détail repliable par faisceau ;
- total de séries de la semaine.

**Étape suivante** : bouton « Répartir sur les jours » qui ouvre la vue assignation.

### 4.2 Vue assignation

- Grille : lignes = exercices, colonnes = jours (1 à 7).
- Glisser-déposer, ou menu sur mobile.
- Garde-fous affichés (pas bloquants) : séries par muscle par séance, fréquence hebdo, enchaînement de polyarticulaires lourds.
- **Suggestion automatique : optionnelle**, jamais appliquée par défaut. Elle propose une répartition, le coach valide.

### 4.3 Vue client

Deux usages :
- **Guidé** : le client voit le programme assigné par le coach, ses jauges, et peut ajuster les séries et les charges. Ne peut pas supprimer une ligne créée par le coach.
- **Libre** : le client part d'un brouillon vide, avec les mêmes jauges et les mêmes garde-fous. Bibliothèque d'exercices identique. Ouvert à tous les clients.

Dans les deux cas, le client voit son volume par muscle et son statut. Il ne voit pas les coefficients internes.

---

## 5. Règles de validation

- Un exercice doit avoir au moins un faisceau avec coefficient 1.
- `series_cibles` ≥ 1.
- `reps_min` ≤ `reps_max`.
- Un jour ne peut contenir qu'une seule ligne pour un même exercice (pour éviter les doublons), sauf si le coach active une exception.
- Passage en `publie` : le brouillon doit avoir au moins une ligne assignée à un jour.

---

## 6. Décisions validées

1. **Coefficient secondaire** : 0,5. Fixé par défaut, modifiable par exercice dans l'éditeur coach.
2. **Granularité des faisceaux** : 1 à 3 faisceaux par exercice en V1. Taxonomie étendue plus tard.
3. **Seuils MV/MEV/MAV/MRV** : valeurs par défaut globales, surchargeables par client et par bloc.
4. **Mode tonnage** : livré dès la V1, en plus du mode séries.
5. **Persistance du brouillon** : Supabase, table `programme_drafts`.
6. **Client libre** : ouvert à tous les clients.

---

## 7. Hors périmètre V1

- Suggestion automatique de programme complète.
- Progression automatique de charge (suggestion +2 %) : à traiter en V2.
- Analyse de la récupération (sommeil, fatigue) pour ajuster les repères.

---

## 8. Mise en œuvre (V1)

- **Accès** : éditeur de programme → « 🧮 Construire par volume hebdo » (coach pour un membre, ou client pour lui-même). Client : onglet Programme → « 📊 Volume de la semaine par muscle » (lecture, avec les seuils réglés par le coach).
- **Faisceaux** : muscles de la bibliothèque (`Dos-largeur`, `Épaules-latéral`…) ; les pectoraux sont découpés en haut / milieu / bas d'après le nom de l'exercice (incliné, décliné, dips). Réglables par exercice (⚙️).
- **Deltoïdes** : chaque chef a ses propres repères (antérieur, latéral, postérieur), comme dans les repères RP.
- **Répartition proposée** : 4 séries max par exercice et par séance, là où le muscle principal est le moins chargé. Jamais appliquée sans le bouton.
- **Création des séances** : une séance par jour, force en premier. Les règles de surcharge déjà écrites pour un exercice (progression, repos, tempo, consigne) sont gardées. Le plan de volume est rangé dans le programme (`vplan`) et revient à la réouverture.
- **Stockage** : téléphone (`cxs.vol.<membre>`) + Supabase `programme_drafts` (migration `supabase/migrations/2026-11-03_programme_drafts.sql`, déjà appliquée).
- **Tests** : `node --test tests/volume.test.mjs` (moteur) et `node tests/volume-e2e.js` (écran).

## 9. Split de la semaine (ajout du 5 novembre 2026)

Onglet **3 · Split** (l'onglet Jours devient le 4) :
- **Semaines types** : Full body 3 j, Push / Pull / Legs 3 j, Upper / Lower 4 j, Antérieure / Postérieure 4 j, Upper / Lower + PPL 5 j, PPL × 2 6 j.
- **Par jour** : un modèle (Push, Pull, Legs, Upper, Lower, Chaîne antérieure, Chaîne postérieure, Full body, Personnalisé),
  les muscles ou faisceaux du jour (ex. mardi : triceps, ischios, dos épaisseur), et les **mouvements imposés** (📌, ex. bench lourd le lundi).
- **Variantes** : un même exercice peut avoir plusieurs lignes (⧉), par exemple « lourd » et « volume ».
- **Répartir selon le split** : chaque ligne va sur ses jours imposés, sinon sur les jours qui contiennent son faisceau principal,
  sinon son muscle principal, sinon un muscle secondaire ; séries partagées à parts égales (jours espacés s'il y a moins de séries que de jours).
- **Fréquence par muscle** : tableau muscle × jour (aperçu de la répartition), fréquence hebdomadaire, alertes non bloquantes :
  même muscle deux jours de suite (≥ 3 séries chaque fois), muscle prévu sans exercice, exercice hors split, tout le volume d'un muscle en une séance.
- Les séances créées prennent le nom du split (« Séance A · Upper »). Le split est rangé avec le plan de volume du programme.
