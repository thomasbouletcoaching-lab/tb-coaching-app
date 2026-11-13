# Journal de session — TB my Coach

Fil de reprise. Une entrée par lot de travail. Branche de travail : `claude/modest-rubin-9ywahk` (jamais `main`).

## Consignes en vigueur (Thomas, 13/11/2026)

- **Ne plus toucher à la production ni à Stripe.** Lecture de structure seulement (tables, colonnes, fonctions, comptages). Aucune écriture, aucune migration, aucun déploiement.
- Rester sur une branche, pas sur `main`.
- Terminer la phase 0 en lecture seule, puis s'arrêter et attendre.

## Lot 0.1 — État réel des tests (13/11/2026)

Fait :
- Lecture de ARCHITECTURE.md, DECISIONS.md (C1 à C51), REPORT.md, AUDIT-APP.md.
- Tests unitaires : 192 / 192 verts (`node --test tests/*.test.mjs`).
- Syntaxe (esbuild sur `js/app.js`) : OK.
- E2E nouvelle app : 8 suites vertes, 5 rouges (programme, semaine, soutenabilite, fatigue, atelier).
  Cause : PR #25 (fin de la formule gratuite, `locked()` dans `js/core.js`) ; ces suites testent encore un parcours « gratuit, essai terminé » qui n'existe plus.
- E2E ancienne app (`tests/run.js` sur `coach/`) : 277 / 277 verts en local. Elle n'est donc plus la cause de la CI rouge.
- CI GitHub : rouge sur `main` (exécutions 252 à 256), à cause des 5 suites ci-dessus.

Écritures effectuées : aucune en production, aucune sur Stripe, aucune sur GitHub. En local : `tests/node_modules/` (ignoré par git) et fichiers temporaires.

## Lot 0.2 — Lecture de la base (structure uniquement)

Fait : liste des migrations (56), des tables (56), des fonctions (55) avec leurs droits, alertes de sécurité.
Comptages d'intégrité par agrégats faits. Code des fonctions `billing` et `stripe-webhook` lu en production (plus récent que le dépôt).

## Lot 0.3 — Parcours, inventaires, audit de design, suggestions (13/11/2026)

Fait : 223 écrans mesurés (membre et coach, iPhone 390×844 et Android 360×740, clair et sombre, mouvement réduit), données fictives (Camille, coach de test). Livrable : `docs/audit-phase0.md` (bugs B1 à B16, dérive, doublons et correspondances, parité, design, suggestions S1 à S15, plan de PR, questions Q1 à Q9).

Constats clés pour la suite :
- La migration des données est déjà largement faite (schéma `cxs_migration` en production, `tbRaw` dans 15 dossiers). Restent : messages, bilans (`suivi`), notes, 6 clients sans profil.
- La nouvelle app écrit encore dans l'ancienne table `messages`.
- Dépôt en retard sur la production pour `billing` et `stripe-webhook` : NE PAS redéployer depuis le dépôt avant rattrapage.
- PR #3 obsolète (son correctif casserait `tests/run.js`, aujourd'hui verte).

Non vérifié : séance en cours, onboarding complet, vrai téléphone, performance, hors ligne, Stripe, alertes de performance de la base.

**Phase 0 terminée.** Thomas a répondu « on lance la suite » le 13/11 : enchaîner sur les lots qui ne touchent ni la production ni Stripe. La consigne « ne plus toucher à la production ni à Stripe » reste en vigueur (lecture de structure seulement).

## Lot 0.1 — Tests à jour, CI au vert (PR #28, branche `claude/phase0-audit-tests`)

Fait : 5 suites alignées sur la fin de la formule gratuite ; « Ma semaine » fixée sur un mardi ; `tests/parcours-e2e.js` (35 écrans, iPhone et Android, clair et sombre, police plus large) ; `tests/sw.test.mjs` ; débordement des offres corrigé ; tuiles du Profil corrigées (défaut trouvé par la CI, invisible en local : police de secours plus large). Relecture indépendante intégrée. Décision C52.
À vérifier à la reprise : que la CI de la PR #28 est verte après le commit df5ab95.

## Lot 6.6 — « Je craque » (PR #29, branche `claude/je-craque`, contient #28)

Fait : `js/crise.js` (règles pures), `js/views/crise.js`, partage au coach sur accord (`criseShare`), bloc coach dans `js/views/suivi-coach.js`, tests unitaires et E2E. Relecture indépendante intégrée (11 points). Décision C53.
En attente de Thomas : confirmer le numéro 09 69 325 900 ; relire les textes des réponses.

## Lot 8.1 — Genre choisi et paliers (branche `claude/genre-paliers`, contient #29)

Fait : `js/genre.js`, `js/paliers.js`, onboarding sans présélection, Profil › Mes infos, question sur Trophées, textes neutralisés, tests. Relecture indépendante intégrée (1 bloquant, 8 à corriger). Décision C54.
En attente de Thomas : valider les noms de paliers ; les trois choix par défaut sans sexe déclaré ; les textes de vente non touchés (`js/config.js`).

## Méthode retenue pour les branches

Branche de travail : `claude/modest-rubin-9ywahk` (tout y est, dans l'ordre). Une branche par PR, empilées : `claude/phase0-audit-tests` → `claude/je-craque` → `claude/genre-paliers`. Un correctif sur une PR du bas se propage vers le haut par fusion (jamais de réécriture d'historique).

## Pièges rencontrés (à ne pas refaire)

- Un commentaire `//` ajouté au milieu d'une ligne de code longue désactive la fin de la ligne (deux fois).
- En émulation mobile, `innerWidth` s'élargit avec le contenu : comparer la largeur de page à la largeur réelle du téléphone.
- `\b` ne fonctionne pas à côté d'une lettre accentuée en JavaScript : utiliser `(?<![\p{L}])…(?![\p{L}])` avec le drapeau `u`.
- Le serveur local de test (port 8765) peut être arrêté par un relecteur : vérifier qu'il tourne avant de conclure qu'un test échoue.

## Reste à faire dans la série sans production

- Lot 0.2 : rapatrier dans le dépôt le code des 9 fonctions serveur et un instantané du schéma (lecture seule en production).
- Puis préparer la phase 1 (sécurité) en fichiers SQL à relire, sans rien appliquer.

