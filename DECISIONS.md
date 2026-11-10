# Décisions prises en autonomie

Travail autonome du 8 novembre 2026, branche `feat/adherence-resultats`. Chaque décision est celle qui m'a paru la plus raisonnable sans pouvoir te poser la question ; toutes sont réversibles.

## Cadre

| # | Décision | Pourquoi |
|---|---|---|
| D1 | Travail sur la nouvelle app (`index.html`, `coach.html`, `js/`), pas sur l'ancienne `coach/index.html`. | C'est l'app que tes clients et toi utilisez aujourd'hui ; l'ancienne n'est plus qu'en héritage. |
| D2 | Lecture du schéma Supabase de production **en métadonnées seulement** (tables, colonnes, politiques, fonctions, tâches). Aucune requête sur des lignes de clients, aucune écriture. | Règle « ne touche pas à la prod ni aux données clients ». Les comptages de lignes viennent des statistiques Postgres, pas d'une lecture des données. |
| D3 | Toute évolution de base est livrée en **fichier SQL à relire** dans `supabase/migrations/`, jamais appliquée. L'app fonctionne **sans** ces migrations (les nouveautés passent par les tables existantes) ; les migrations ajoutent sécurité et confort. | Règle « migrations uniquement sous forme de fichiers ». Tu peux fusionner la PR sans attendre d'appliquer le SQL. |
| D4 | Pas de nouvelle table pour le bilan, le score ou les alertes : ils voyagent dans l'instantané déjà envoyé au coach (`cxs_member_data.data` et `.summary`). | « Pars de l'existant » : la synchronisation, la fusion et les droits existent déjà et sont éprouvés. |
| D5 | Correctif de sécurité prioritaire proposé (`2026-11-08_securite_profils.sql`) : un membre pouvait se donner `is_coach = true` ou une formule payante. | Faille critique trouvée pendant la lecture du schéma ; le correctif ne modifie aucune donnée. |

## Fonctionnalités

| # | Décision | Pourquoi |
|---|---|---|
| F1 | **Ordre d'impact retenu** : 1) essai 30 jours qui mène à la candidature, 2) bilan hebdomadaire, 3) score d'adhérence, 4) alertes de décrochage côté coach, 5) anamnèse, 6) rapport partageable / témoignage, 7) comparateur photos. Le score est codé en premier car le bilan, les alertes, le rapport et l'essai s'appuient dessus. | L'essai et le bilan touchent directement le chiffre d'affaires (candidatures) et la rétention ; l'audit du 7/10 notait déjà « 0 bilan envoyé ». |
| F2 | L'**onboarding existant (19 questions) n'est pas rallongé**. L'anamnèse (santé, historique, motivation, mode de vie) est un questionnaire séparé, proposé juste après, sur l'Accueil et dans l'essai (jour 1), et obligatoire avant la candidature. | L'audit du 7/10 montrait qu'un premier lancement long fait fuir ; on garde la conversion du premier écran. |
| F3 | Questions santé **inspirées du PAR-Q+ 2023, reformulées**, sans reproduire le questionnaire officiel. Toute réponse « oui » affiche un message « parles-en à ton médecin avant d'augmenter ton activité » et une alerte côté coach. | Le PAR-Q+ demande d'être utilisé en entier et sans modification ; une version reformulée sert de tri, pas de certificat. |
| F4 | Consentement explicite (case à cocher) avant d'enregistrer les réponses santé, avec rappel de la finalité. | Données de santé = données sensibles (RGPD art. 9). |
| F5 | Score d'adhérence sur **14 jours glissants**, 0 à 100, composé de 4 piliers pondérés : séances faites / prévues (40 %), jours avec repas notés (25 %), jours avec routine notée — poids, sommeil ou pas (15 %), bilan hebdomadaire envoyé (20 %). Un pilier sans objet (ex. pas de programme) est retiré et les poids sont redistribués. Tendance = score des 7 derniers jours contre les 7 précédents. | Proche de ce que font TrueCoach (taux réalisé / prévu) et Everfit (entraînement, nutrition, tâches, formulaires) ; 14 jours lissent une mauvaise semaine. |
| F6 | Statut du membre : **Sur la bonne voie** (≥ 70), **À surveiller** (45–69), **Décroche** (< 45). Alerte aussi si le score baisse de 20 points ou plus d'une semaine à l'autre. | Seuil de 20 points repris de TrueCoach (signalement quand le taux chute de 20 %). |
| F7 | Le membre voit son score (à la différence de TrueCoach), présenté comme une « régularité », jamais comme une note de valeur. | Ton positionnement « tenir dans la durée » ; le score devient un levier de motivation. |
| F8 | Le bilan hebdomadaire est ouvert **à tous** (gratuit compris) et stocké sur le téléphone + dans l'instantané. Pour les coachés, il part aussi en message à Thomas (même format « 📝 Bilan » qu'aujourd'hui, donc la détection côté coach continue de fonctionner). | Le bilan nourrit le score, le rapport et la candidature, même pour les non-coachés. |
| F9 | Le bilan pré-remplit tout ce que l'app connaît déjà (moyenne de poids sur 7 jours, séances faites, sommeil et énergie moyens) : le membre corrige au lieu de saisir. | Objectif « bilan en moins d'une minute ». |
| F10 | Photos : comparateur avant/après **sur le téléphone** (côte à côte ou curseur), image exportable avec écarts de poids et de tour de taille. Envoi au coach **facultatif, photo par photo**, seulement si la migration Storage est appliquée ; sinon le bouton explique qu'il faut l'activer. | Les photos sont intimes : rien ne part sans geste explicite. |
| F11 | Rapport de progression généré **sur le téléphone** (image PNG 1080 × 1350 + texte), partage par la feuille de partage du téléphone. Option « Autoriser Thomas à l'utiliser comme témoignage » avec choix prénom / initiale / anonyme et photos oui / non ; le consentement est horodaté et visible côté coach. | Pas de page publique hébergée avec des données de santé ; le membre garde la main. |
| F12 | **Essai : 30 jours** (au lieu de 7) avec l'app complète, sous forme de « Défi 30 jours » guidé : jour 1 (anamnèse, mesures, photos), bilans aux jours 7, 14, 21, 28, rapport au jour 30, puis candidature au coaching (bouton aussi visible dès le jour 21). À la fin, le membre garde le Gratuit, peut prendre Bâtisseur ou candidater. | Ta demande ; la candidature arrive au moment où le membre a des résultats à montrer. |
| F13 | La candidature reprend automatiquement le score, les résultats du défi et l'anamnèse (le membre n'a plus à tout réécrire) et ajoute ces éléments au lien Calendly. | Moins de friction, et tu arrives à l'appel avec le dossier. |
| F14 | L'essai Stripe de 7 jours dans l'Edge Function `billing` **n'est pas modifié** (Edge Function = prod). Conséquence : un membre qui prend Bâtisseur après le défi a encore 7 jours d'essai Stripe. | À trancher par toi (voir REPORT.md). |
| F15 | Le texte « 7 jours d'essai » est remplacé partout par la valeur de `TRIAL_DAYS`, pour ne plus avoir à le changer à la main. | Cohérence des prix et promesses affichés. |

## Technique

| # | Décision | Pourquoi |
|---|---|---|
| T1 | Calculs (score, statut, alertes, résumé du rapport) dans un module **pur** `js/adherence.js`, sans accès au DOM ni au stockage, testé par `node --test`. | Même approche que `js/volume.js` ; testable en CI. |
| T2 | Tests de bout en bout Playwright en **iPhone 390 × 844, tactile** (`tests/adherence-e2e.js`), Supabase simulé, données fictives. Ajoutés à la CI. | Règle « teste tout en rendu mobile ». |
| T3 | Version du service worker incrémentée pour que les téléphones prennent la nouvelle version. | Procédure du README. |

## Constats et choix faits pendant la construction

| # | Décision | Pourquoi |
|---|---|---|
| C1 | Les membres dont l'essai de 7 jours avait expiré mais qui ont moins de 30 jours d'ancienneté retrouvent l'app complète jusqu'au jour 30. | Conséquence directe du passage à 30 jours (l'essai est calculé à partir de `trialStart`) ; un cadeau plutôt qu'un bug, cohérent avec le défi. |
| C2 | Le bilan d'une semaine se corrige au lieu de se dupliquer (un bilan par semaine du lundi au dimanche). Dans le défi, le bilan n compte s'il est fait entre les jours 7n−3 et 7n+3. | Évite qu'un même bilan valide deux étapes. |
| C3 | La carte « Ton bilan de la semaine » apparaît sur l'Accueil du vendredi au dimanche, en plus du rappel push du dimanche déjà en place. | Fenêtre où le bilan a du sens, sans encombrer le reste de la semaine. |
| C4 | Les alertes de décrochage d'un membre resté sur une ancienne version de l'app (sans score dans son instantané) ne sont pas inventées : on garde l'ancien « relancer après 4 jours ». | Pas de faux positif. |
| C5 | La suite de tests historique `tests/run.js` échoue déjà sur `main` (CI rouge depuis au moins le 7/11, avant ce travail). Je ne l'ai pas réparée ; les nouveaux tests passent avant elle dans la CI pour que leur résultat soit lisible. | Hors périmètre, et la corriger sans toi risquait de masquer un vrai problème. |
| C6 | Une autre PR ouverte par une session précédente (`claude/relaxed-brown-5tl5pb`, « Audit web sourcé et correction du harnais E2E ») touche aux tests : conflit possible sur `tests/`, à fusionner l'une après l'autre. | Information pour la fusion. |
| C7 | Plusieurs modules existants (`js/views/live.js`, `account.js`, `coachprog.js`…) manquent à la liste hors ligne de `sw.js` : constat, non corrigé. J'y ai ajouté les 6 nouveaux modules. | Hors périmètre ; signalé dans REPORT.md. |
| C8 | Bibliothèque par pattern (10/11) : nouvelle table `cxs_exercices` plutôt qu'une extension de `cxs_library`. | `cxs_library` range tout dans un champ libre (`data`) : impossible d'y garantir un pattern valide ou de filtrer proprement. Une table dédiée est contrôlée par la base, et sa création ne touche à rien d'existant. |
| C9 | Les noms de la bibliothèque sont ceux de `data/fiches.json` ; 3 exercices seulement sont nouveaux (flexion de genou à la maison). | Chaque exercice garde sa fiche, son schéma, sa vidéo et l'historique de charges des membres. |
| C10 | L'ancienne fonction de remplacement `E.alternatives` n'est pas remplacée à cette étape. | Elle sert aux programmes en cours ; la nouvelle sera branchée avec le générateur (étape 3). |
