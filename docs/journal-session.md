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

**Phase 0 terminée. En attente de Thomas** : réponses aux questions Q1 à Q9 de l'audit, et levée (ou non) de la consigne « ne plus toucher à la production ni à Stripe ». Aucune PR ouverte.

Prochaine étape proposée (sans production) : PR 0.1 (tests à jour, CI verte), 0.2 (rapatrier le code serveur), 6.6 (« Je craque »), 8.1 (paliers et genre).
