# Architecture de TB my Coach

Document rédigé le 8 novembre 2026 à partir de la lecture du dépôt (branche `main`, commit `88d3e9a`) et du schéma Supabase du projet « tb-coaching app » (lecture des métadonnées uniquement : tables, colonnes, politiques RLS, fonctions, tâches planifiées ; **aucune ligne de donnée client n'a été lue**).

## 1. Vue d'ensemble

```
Téléphone du membre (PWA)                     Supabase (eu-west-3, Paris)
┌───────────────────────────────┐             ┌─────────────────────────────────────┐
│ index.html  → js/app.js       │  REST/RPC   │ Postgres + RLS                      │
│  état local : localStorage    │ ──────────▶ │  cxs_profiles, cxs_member_data, ... │
│  photos : IndexedDB           │             │ Storage (bucket « media »)          │
│  service worker : sw.js       │ ◀────────── │ Edge Functions (push, billing, ...) │
└───────────────────────────────┘  pull 5 min │ pg_cron (rappels, purge)            │
Téléphone du coach : coach.html (même code,   └─────────────────────────────────────┘
  data-app="coach", autre clé de stockage)               ▲
Ancienne app coach : coach/index.html (monolithe)        │ webhooks
                                                    Stripe (Checkout, portail)
```

- **Hébergement** : GitHub Pages (fichiers statiques, aucune étape de build). Une modification poussée sur `main` est en ligne en 1 à 2 minutes.
- **Front-end** : JavaScript natif en modules ES (`js/`), sans framework. Rendu par chaînes HTML injectées dans `#app`, délégation d'événements par attributs `data-a` (actions), `data-f` (formulaires), `data-c` (changements), `data-i` (saisie).
- **Local d'abord** : toute la donnée du membre vit sur son téléphone (`localStorage`, clé `cxs.v1` ; `cxs.coach.v1` pour l'app coach). Le serveur reçoit un **instantané** (`snapshot()`) pour que le coach suive le membre.
- **Deux apps, un code** : `index.html` (membre) et `coach.html` (coach) chargent le même `js/app.js` ; `store.js` lit `document.documentElement.dataset.app`.
- **Ancienne app** : `coach/index.html` (1,4 Mo, monolithe historique) travaille sur les tables `clients`, `carnet`, `suivi`, `nutri_log`, `mesures`, `messages`. Les tests `tests/run.js` la couvrent. Elle n'est pas modifiée par ce travail.

## 2. Arborescence

| Chemin | Rôle |
|---|---|
| `index.html`, `coach.html` | Points d'entrée membre et coach (PWA) |
| `coaching.html` | Redirige vers `./?candidater=1` |
| `cgv.html`, `confidentialite.html` | Pages légales |
| `sw.js` | Service worker : cache, hors ligne, notifications (version `const C`) |
| `css/app.css` | Feuille de style unique (thème clair/sombre, variables `--red`, `--ink`, `--line`…) |
| `js/app.js` | Démarrage : charge les vues, synchronisations périodiques |
| `js/core.js` | Utilitaires d'interface : routeur (`routes`, `go`, `render`, `rerender`), en-tête, barre d'onglets, feuilles (`sheet`), graphiques SVG (`lineChart`, `barChart`, `ring`), formules et droits (`tier`, `premium`, `trialLeft`, `canMsg`) |
| `js/store.js` | État local (`S()`, `update`, `save`), photos (IndexedDB `cxs-photos`), export/import |
| `js/config.js` | Réglages publics (URL et clé **publiable** Supabase, Calendly), formules et prix affichés, durée d'essai |
| `js/cloud.js` | Toutes les requêtes Supabase (chargé à la demande) |
| `js/sync.js` | Profil → serveur, instantané pour le coach (`snapshot`, `pushData`), récupération du programme, des créneaux et du plan posés par le coach |
| `js/engine.js` | Moteur d'entraînement : programmes, agenda (fait / loupé / prévu), e1RM, charges conseillées, plateaux, alertes douleur |
| `js/nutrition.js`, `nutri-*.js`, `recipes.js`, `shop.js`, `energy.js` | Nutrition, cibles, recettes, courses, bilan énergétique, jeûne |
| `js/volume.js` | Moteur pur « Volume de la semaine » (testé par `node --test`) |
| `js/quests.js` | Quêtes, séries et trophées |
| `js/library.js` | Bibliothèque partagée par le coach (`cxs_library`) |
| `js/exercices.js`, `js/views/bibliotheque.js` | Bibliothèque d'exercices classée selon les 8 patterns (`cxs_exercices`, version embarquée `data/exercices.json`) : voir `docs/bibliotheque-exercices.md` |
| `js/views/*.js` | Écrans (voir § 4) |
| `data/*.json` | Programmes, fiches d'exercices, aliments (Ciqual, Open Food Facts, fast-food) |
| `supabase/functions/` | Sources des Edge Functions `billing` et `stripe-webhook` |
| `supabase/migrations/` | Migrations SQL versionnées (à relire avant application) |
| `tests/` | `volume.test.mjs` (unitaire), `volume-e2e.js` (Playwright, iPhone 390×844), `run.js` + `harness.js` (ancienne app) |
| `tools/` | Scripts Python de génération des bases d'aliments |
| `.github/workflows/` | `tests.yml` (syntaxe + tests sur chaque PR), `keepalive.yml`, `ciqual.yml` |

## 3. Modèle de données local (`S()`)

Défini dans `store.js` (`blank()`), enrichi au fil des écrans :

| Clé | Contenu |
|---|---|
| `profile` | Réponses de l'onboarding : nom, e-mail, objectif, niveau, lieu, jours, durée, records, âge/taille/poids, activité, régime, priorité, source, `startProgram`, `nutritionModel`, `createdAt` |
| `trialStart` | Date de début de l'essai (posée à la fin de l'onboarding) |
| `plan` | Programme suivi `{ programId, startedAt, week, idx, cycle }` |
| `workouts`, `current`, `lifts` | Séances terminées, séance en cours, historique e1RM par exercice |
| `food`, `dishes`, `myPlan`… | Journal alimentaire et plans |
| `daily[date]` | Routine du jour : `weight`, `steps`, `sleep`, `sleepQ`, `water`, `feel { energy, well, stress, crave }`, `ritual`, `cardio` |
| `measures[]` | Mensurations datées `{ d, weight, waistNav, hips, chest, … }` |
| `application` | Dernière candidature au coaching |
| `moves`, `skips`, `slots` | Agenda : séances déplacées, repos choisis, horaires |
| `me` | Dernier état serveur : `tier`, `isCoach`, `msgsLeft`, `until` |

Photos : IndexedDB `cxs-photos` / store `p` : `{ id, d, view: face|profil|dos|autre|repas|ticket, blob }`. **Elles restent sur le téléphone** (jamais envoyées).

## 4. Écrans (routes)

| Onglet | Routes principales | Fichier |
|---|---|---|
| Accueil | `home` (jour, semaine, mois, année), `plan` | `home.js`, `agenda.js`, `onboarding.js` |
| Entraînement | `carnet`, `train`, `workout`, `builder`, `fiche`, `simu` | `train.js`, `coachprog.js`, `volume.js`, `live.js` |
| Nutrition | `food`, `body`, `moncorps` | `food.js`, `meals.js`, `supps.js`, `nutri-*.js` |
| Récupération | `recup` (sommeil, ressenti, jeûne) | `recup.js` |
| Coaching | `coach`, `chat`, `offers`, `apply` | `coach.js` |
| Profil | `profile`, `settings`, `stats`, `account` | `more.js`, `account.js` |
| Premier lancement | `onboarding` (19 questions conversationnelles, puis `plan`) | `onboarding.js` |
| Espace coach | `admin-today`, `admin`, `admin-msg`, `admin-biz`, `admin-subs`, `admin-db`, `member/<id>`, `live/<id>` | `admin.js`, `coach.js`, `coachfood.js`, `live.js` |

Le routeur force `onboarding` tant qu'il n'y a pas de profil, et `workout` tant qu'une séance est en cours.

## 5. Flux de synchronisation

1. **Profil** : `syncProfile()` écrit `cxs_profiles.onboarding` (profil complet + candidature) puis `refreshMe()` relit formule et compteurs (toutes les 60 s).
2. **Instantané pour le coach** : à chaque `save()`, `pushData()` (regroupé, au plus toutes les 20 s, 4 s pendant une séance) fusionne `data` (40 dernières séances, 31 jours de repas, 60 jours de routine, 40 mesures…) et `summary` (séance du jour, kcal, poids, agenda −7/+21 j, `s7`, `lastActive`, `alerts`) dans `cxs_member_data`.
3. **Totaux nutritionnels** : `nutri_daily` (14 derniers jours) pour les alertes sucres / sodium côté coach.
4. **Descendant** : programme (`cxs_coach_plans`), créneaux (`cxs_coach_slots`), plan alimentaire (`cxs_coach_food_plans`), séance en direct (`cxs_live_sessions`, toutes les 15 s).
5. **Messagerie** : table `messages` (fiche `clients` liée par e-mail via `cxs_my_client_id()`), à défaut `cxs_messages`. Vocaux dans le bucket `media/<client_id>/audio/`.

## 6. Schéma Supabase (schéma `public`)

Toutes les tables ont la RLS activée. Nombre de lignes au 8/11/2026 indiqué pour l'ordre de grandeur.

### 6.1 Tables utilisées par la nouvelle app (`js/`)

| Table | Clé | Colonnes utiles | Droits (RLS) |
|---|---|---|---|
| `cxs_profiles` (16) | `id` = `auth.uid()` | `email, name, onboarding jsonb, stats jsonb, tier, tier_until, is_coach, created_at, last_seen` | Lecture : soi ou coach. Création : soi, `is_coach = false`. **Modification : soi, toutes colonnes** (voir § 8) |
| `cxs_member_data` (16) | `user_id` | `data jsonb, summary jsonb, updated_at` | Lecture : soi ou coach. Écriture : soi |
| `cxs_tiers` (6) | `id` | `rank, name, msgs_per_week` | Lecture publique |
| `cxs_messages` (2) | `id` | `user_id, sender, body, read_at, reactions, audio_path` | — |
| `cxs_notifications` (3) | `id` | `user_id` (nul = tous), `title, body` | Lecture : soi / tous / coach. Écriture : coach |
| `cxs_library` (3) | `id` | `kind, name, data` | Lecture : tout connecté. Écriture : coach |
| `cxs_coach_store` (1) | `key` | `value jsonb` (to-do, business, notes, candidatures traitées) | Coach uniquement |
| `cxs_coach_plans`, `cxs_coach_food_plans`, `cxs_coach_slots` | `user_id` | programme, plan alimentaire, créneaux | Écriture : coach ; lecture : le membre concerné |
| `cxs_live_sessions` (7) | `user_id` | `state jsonb` | Membre et coach |
| `nutri_daily` (44) | `user_id, d` | kcal, macros, micronutriments | Écriture : soi ; lecture : soi ou coach |
| `programme_drafts` (1) | `id` | `owner, member_id, kind, status, data` | Auteur ; le membre lit ses seuils |
| `messages` (146) | `id` | `client_id, sender, from_coach, body, media, audio_path, read_at, reactions` | Garde-fou `messages_guard`, notification `messages_push` |
| `subs` (2) | `client_id` | `plan, status, source, period_end, stripe_customer, stripe_sub, trial_used` | Mis à jour par `stripe-webhook` |
| `candidatures` (0) | `id` | `user_id, offer, goal, details, phone, status` | Envoi : soi ; lecture : soi ou coach |
| `app_flags` (4) | `k` | inscriptions ouvertes, prix, paiement prêt | — |

### 6.2 Tables de l'ancienne app et des autres projets

- Ancienne app coach : `clients` (16), `carnet` (954), `suivi` (18), `nutri_foods` (690), `nutri_dishes`, `nutri_log`, `mesures` (29), `onboarding` (14), `coach_notes`, `video_lib`, `cycles`, `prog_hist`, `push_subs`, `push_prefs`, `leads`, `cgv_accept`, `biz_*`, `gx_*` (gamification).
- Comptabilité (projet distinct hébergé sur la même base) : `compta_*`, `cpta_*`.
- Divers : `coaches`, `app_private` (secrets serveur), `app_private_log`, `backup_oe_20261019`.

### 6.3 Fonctions (RPC, toutes `SECURITY DEFINER` sauf utilitaires)

`cxs_is_coach()`, `cxs_my_client_id()`, `cxs_client_id_of(uid)`, `cxs_msgs_left(uid)`, `cxs_set_tier(target, tier, until)`, `cxs_inbox()`, `cxs_notify_member_on_reply()` ; ancienne app : `can_access`, `is_coach`, `is_coach_of_client`, `self_start`, `coach_set_plan`, `coach_subscribers`, `me_info`, `push_*`, `gx_*`, `cycle_archive`, `nutri_food_add`, `media_videos_a_purger`…

### 6.4 Stockage

Bucket `media` : lecture et dépôt si `can_access(<1er dossier = client_id>)` ; dossier `lib/<coach_uid>/` pour la bibliothèque vidéo. Bucket `cpta-receipts` pour la comptabilité.

### 6.5 Tâches planifiées (pg_cron)

`push-daily` (6 h 30 UTC), `push-weekly` (dimanche 17 h UTC, rappel du bilan), `push-tick` (toutes les 15 min), `push-pay` (7 h UTC), `purge-videos` (3 h 20 UTC).

### 6.6 Edge Functions

`push`, `delete-account`, `billing` (Checkout et portail Stripe, pas d'essai Stripe : l'essai est le Défi 30 jours dans l'app, sans carte), `stripe-webhook` (signature vérifiée, met à jour `subs`), `purge-media`. Secrets dans Supabase (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), jamais dans le dépôt.

## 7. Formules et droits

`config.js` : `free` (0), `premium` « Bâtisseur » (1), `essentiel` « Fraternité » (2), `suivi` (3), `avance` « Coaching personnalisé, sur candidature » (4), `invite` (3), `surmesure` « Élite » (5). Vendues dans l'app : Gratuit, Bâtisseur, Coaching sur candidature. `tier()` vaut `premium` pendant l'essai (`trialLeft() > 0`). La messagerie est réservée au rang ≥ 2.

## 8. Points d'attention relevés pendant la lecture

1. **Faille critique d'élévation de droits** : la politique « cxs modifier son profil » (`UPDATE … USING id = auth.uid()`) et les droits de colonnes laissent un membre connecté modifier **ses propres colonnes `is_coach`, `tier` et `tier_until`**. Aucun déclencheur ne l'empêche. Un membre peut donc se déclarer coach et lire tous les dossiers (`cxs_member_data`, `cxs_profiles`, `nutri_daily`, `cxs_coach_store`). Correctif proposé : `supabase/migrations/2026-11-08_securite_profils.sql` (à relire et appliquer).
2. Les photos de progrès ne quittent pas le téléphone : le coach ne les voit pas, et elles sont perdues si le téléphone change.
3. Le bilan existant est un simple message texte : rien n'est structuré ni historisé, donc pas de courbe d'énergie, de sommeil ou de ressenti, ni de comparaison semaine à semaine.
4. L'instantané envoyé au coach contient déjà presque tout ce qu'il faut pour mesurer l'adhérence (agenda fait/loupé, journal, routine) : c'est la base choisie pour le score (aucune nouvelle table nécessaire).
5. Deux familles de tables coexistent (ancienne app / nouvelle app) : toute nouveauté de ce travail passe par les tables `cxs_*` de la nouvelle app.
