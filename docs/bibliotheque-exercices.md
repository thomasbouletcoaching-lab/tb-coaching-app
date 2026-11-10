# Bibliothèque d'exercices par pattern (créateur de programme, étape 1)

Rédigé le 10 novembre 2026. Spécification d'origine : page Notion « SPEC : Créateur de programme individualisé ».

## Ce que c'est

120 exercices classés selon le modèle des 8 catégories de Sebastian Oreb :

- **Couche 1, squelette** (82 exercices) : PH, PV, TH, TV, SG, SH, CH, FG. Chaque exercice porte un pattern principal, parfois un secondaire.
- **Couche 2, isolation** (24) : biceps, triceps, élévations latérales, deltoïdes postérieurs, mollets, abdos, avant-bras.
- **Couche 3, modules** (14) : unilatéral, portés, rotation / anti-rotation, cardio, mobilité.

Décisions du 10/11/2026 appliquées : dips = PH, hip thrust = CH, pull-over = TV.

## Où sont les données

| Élément | Rôle |
|---|---|
| `tools/exercices/build.py` | **Source unique** de la bibliothèque de départ. Pour ajouter ou corriger un exercice de base : modifier ce fichier puis le relancer. |
| `data/exercices.json` | Version embarquée dans l'app (généré). Sert hors ligne et tant que la table n'existe pas. |
| `supabase/migrations/2026-11-10_cxs_exercices.sql` | Crée la table `cxs_exercices` et ses droits. Additive : ne touche aucune table existante. |
| `supabase/migrations/2026-11-10_cxs_exercices_seed.sql` | Remplit la table (généré). Relançable : ne modifie jamais une ligne déjà présente. |
| `js/exercices.js` | Module pur : constantes, `filtrer()`, `alternatives()`, chargement. |
| `js/views/bibliotheque.js` | Vue coach : Base de données › 8 patterns. |

Quand la table est joignable, elle fait foi (le coach y règle la vidéo et l'état actif). Sinon l'app lit la version embarquée, en lecture seule.

## Champs d'un exercice

`slug` (identifiant stable), `nom` (identique au nom de la fiche dans `data/fiches.json`), `pattern_principal`, `pattern_secondaire`, `couche`, `categorie` (isolation et modules), `muscles`, `materiel`, `niveau`, `cout_nerveux` (1 à 3), `variantes` (slugs), `contre_indications`, `video_url`, `note`, `actif`.

- **Matériel** : liste des contextes où l'exercice est faisable (`salle_complete`, `salle_basique`, `halteres_maison`, `poids_du_corps`, `barre_traction`). « Haltères maison » suppose des haltères, un banc et du petit matériel (élastique, ballon).
- **Contre-indications** : zones pour lesquelles l'exercice est écarté si la personne signale une gêne (`epaule`, `coude`, `poignet`, `bas_du_dos`, `genou`, `hanche`, `cheville`). C'est un filtre de prudence, pas un diagnostic.
- **Variantes liées** : calculées, même pattern et même famille de fiche.
- **Niveau, coût nerveux, contre-indications** : estimations de départ, à relire par Thomas.

## `alternatives(exercice, { materiel, contreIndications, exclure })`

Renvoie les exercices actifs du même pattern principal (ou de la même catégorie pour l'isolation et les modules), faisables avec le matériel donné, sans contre-indication pour les zones données. Les variantes liées sortent en premier, puis le niveau le plus proche. Destinée au bouton « remplacer » du futur générateur. L'ancienne fonction `E.alternatives(nom)` (par famille et par muscle) reste en place pour les programmes actuels.

## Droits (RLS)

Sans connexion : aucun accès. Membre connecté : lecture des exercices actifs. Coach : lecture de tout, écriture.

## Tests

`node --test tests/exercices.test.mjs` (données et fonctions) et `node tests/exercices-e2e.js` (vue coach sur iPhone 390×844, clair et sombre, table absente puis présente). La migration a été jouée deux fois sur un Postgres local jetable, avec vérification des droits.
