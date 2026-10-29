# CalXsthenos

Entraînement, nutrition et progression personnalisés qui édifient corps, âme et esprit, pour cette vie et l'éternité. Fondée sur 1 Timothée 4:8.
PWA hébergée gratuitement sur GitHub Pages, avec un serveur Supabase dédié (projet `calxsthenos`, Paris),
séparé de TB my Coach. Le serveur garde : profils (e-mail, réponses de l'onboarding), formules, messages, notifications.
Le détail des séances, le journal alimentaire et les photos restent sur le téléphone.

## Formules

Définies dans `js/config.js` (prix, contenu, quota de messages). Le quota est aussi appliqué par le serveur (table `tiers`).
Le coach change la formule d'un membre depuis l'espace coach. Les liens de paiement Stripe se collent dans `OFFERS[].pay`.

## Devenir coach dans l'app

Après avoir fait l'onboarding avec son e-mail, exécuter dans Supabase :
`update profiles set is_coach = true where email = 'ton@email';`

## Principe des formules

- **Gratuit pour toujours** : la Bible complète (Louis Segond 1910), surlignages, notes, favoris, affirmations ; carnet de séance, agenda, routine du jour, eau, jeûne, journal alimentaire.
- **Premium** : outils et connaissances avancés (tous les programmes, programme perso, stats, plan alimentaire, recettes, batch cooking, dépense MB/NEAT/EAT/TEF/TDEE, projection, mensurations, photos).
- **Suivi (59 € et plus)** : connaissances version experte, module maillons faibles, accompagnement par Thomas.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille de l'app |
| `css/app.css` | Charte graphique rouge en dégradé, clair et sombre (Figtree, Fraunces) |
| `js/app.js` | Point d'entrée : charge les écrans, démarre |
| `js/core.js` | Routeur, en-tête, barre d'onglets, feuilles, graphiques, formules |
| `js/views/home.js` | Accueil : routine du jour (poids, pas, sommeil, eau, nutrition), roue des calories, séance du jour |
| `js/views/agenda.js` | Agenda mois/semaine, séances faites/loupées/prévues, déplacer, vue du cycle |
| `js/views/train.js` | Programme, banque, programme perso, carnet (types de séries, techniques, notes, minuteur), stats, records, simulateur 1RM, fiches |
| `js/views/food.js` | Journal (heures), favoris, repas enregistrés, plan écrit, recettes, batch cooking, jeûne, dépense, corps |
| `js/views/parole.js` | Parole du jour, Bible complète, surlignages, notes, affirmations, « Et après ? » |
| `js/views/coach.js` | Messagerie avec réactions, offres et démos, candidature, bilans, notifications, espace coach |
| `js/views/more.js` | Profil, réglages, connaissances, sauvegarde |
| `js/engine.js` | Programmes, charges calculées (e1RM), suggestions selon le RPE, agenda, volume, alertes |
| `js/energy.js` | MB, NEAT, EAT, TEF, TDEE, étapes du jeûne |
| `js/nutrition.js` / `js/recipes.js` | Cibles, aliments, plan, 49 recettes, liste de courses |
| `js/word.js` | Versets et affirmations (texte LSG 1910 vérifié) |
| `js/config.js` | **À personnaliser** : liens, formules et prix |
| `js/cloud.js` | Lien avec le serveur |
| `data/bible/` | Bible Louis Segond 1910, domaine public (UBS, via eBible.org / BibleCorps) |
| `data/programs.json`, `data/fiches.json`, `data/lib.json`, `data/kb.json` | Programmes, 280 fiches, bibliothèque d'exercices et connaissances (repris de TB my Coach) |
| `data/ciqual.json` | Table Ciqual 2020, ANSES (Licence Ouverte Etalab 2.0) |
| `sw.js` | Hors ligne (salle sans réseau) |

## Mettre en ligne

1. Settings → Pages → Source : branche `main`, dossier `/ (root)`.
2. L'app est servie à `https://thomasbouletcoaching-lab.github.io/calxsthenos/`.
3. Après chaque modification, augmenter la version dans `sw.js` (`cxs-v5` → `cxs-v6`).

## À faire avant le lancement

- Remplir `js/config.js` (Instagram, e-mail de réception des candidatures).
- Créer le logo définitif.
- Valider les fiches d'exercices (`data/fiches.json`, marquées « brouillon »).
