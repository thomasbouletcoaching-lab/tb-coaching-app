# Questionnaire « Mon programme sur mesure » (créateur de programme, étape 2)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §1 et §10.

## Ce que c'est

Un questionnaire d'une question par écran, dans Profil › « Mon programme sur mesure ».

- **Gratuit, 10 questions** : objectif principal et secondaire, objectif chiffré et daté (facultatif), niveau, matériel (6 options, plusieurs choix), séances voulues **et** séances tenables, durée max, gênes par zone, style de séances.
- **Premium (Bâtisseur)** : priorités musculaires (3 max), points faibles par pattern (3 max), anatomie (buste au squat, cheville, épaule), historique d'arrêts (nombre, durée avant arrêt, raisons), contexte de vie (sommeil, stress, travail, enfants), puis **exercices favoris** : « j'adore » / « je déteste » (neutre par défaut) sur les exercices du squelette que la personne peut faire avec son matériel et sans gêne.

Le générateur (étape 3) n'existe pas encore : l'écran de fin le dit.

## Où sont les données

| Élément | Rôle |
|---|---|
| `js/programme.js` | Module pur : questions, validation, contraintes, `alternativesPour()`, notes, résumé, ce qui part chez le coach. |
| `js/views/programme.js` | Écran du questionnaire et des favoris. |
| `S().programme` | `{ v, at, answers, prefs }` sur le téléphone. `prefs` : `{ slug: "love" \| "hate" }`. |
| Instantané `cxs_member_data.data.programme` | Copie pour le coach, affichée dans l'onglet Suivi du dossier du membre. |

**Aucune nouvelle table Supabase** : l'instantané existant suffit (architecture « local d'abord »). Rien à appliquer en production.

## Gênes et santé

Les zones sont une donnée de santé. Elles ne partent chez le coach que si le membre a donné son consentement dans « Mon point de départ » (anamnèse). Sinon elles restent sur le téléphone et servent seulement à filtrer les exercices. Si l'anamnèse existe déjà, ses zones sont reprises dans le questionnaire (« lombaires » devient `bas_du_dos`, « nuque » est ignorée : pas de zone équivalente dans la bibliothèque).

## `alternativesPour(exercice, programme)`

Appelle `alternatives()` de la bibliothèque avec le matériel, les gênes et les exercices détestés de la personne, puis place ses exercices adorés en premier. C'est la fonction du futur bouton « remplacer » du générateur. L'ancien bouton « Remplacer » des séances en cours n'est pas modifié.

## Tests

`node --test tests/programme.test.mjs` (12 tests) et `node tests/programme-e2e.js` (iPhone 390×844 : parcours gratuit, parcours Premium avec favoris, reprise des gênes, consentement dans l'instantané).
