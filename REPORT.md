# Rapport de la session autonome — 8 novembre 2026

Branche `feat/adherence-resultats`, une PR ouverte vers `main` (rien n'a été poussé sur `main`, rien n'a été modifié en production, sur Stripe ni dans les données clients). Le détail des choix est dans `DECISIONS.md`.

## ⚠️ À lire en premier : faille de sécurité critique

En lisant le schéma Supabase, j'ai trouvé que **n'importe quel membre connecté peut se donner les droits coach** (colonne `is_coach` de `cxs_profiles` modifiable par lui-même) et donc **lire les dossiers de tous tes clients** (séances, repas, poids, et désormais anamnèse santé), ou s'attribuer une formule payante sans payer. Le correctif est prêt : `supabase/migrations/2026-11-08_securite_profils.sql` (aucune donnée modifiée, retour arrière fourni). Il faut l'appliquer **avant** de mettre en ligne cette PR, puisque la PR ajoute des données de santé dans le dossier.

> ✅ **Appliqué le 8/11/2026 à 2 h 40** à ta demande (migration Supabase `securite_profils_20261108`). Vérifié dans une transaction annulée : un membre ne peut plus modifier `is_coach`, `tier` ni `tier_until` ; il peut toujours mettre à jour son profil, sa dernière visite et ses stats ; `cxs_set_tier` fonctionne toujours pour le coach. Avant application : un seul compte coach (thomasboulet.coaching@gmail.com), 15 invités, aucune donnée modifiée.

## Ce qui est fait

### Phase 1
- **`ARCHITECTURE.md`** : l'app (front local d'abord, routes, état, flux de synchronisation) et le schéma Supabase complet (tables, droits RLS, fonctions, stockage, tâches planifiées, Edge Functions), lu en métadonnées uniquement.
- **`AUDIT-APP.md`** : ce que font Trainerize, Everfit, TrueCoach, Hevy Coach et Fitbod pour l'adhérence et les résultats, avec 27 sources citées, et un tableau de comparaison avec TB my Coach. Conclusion : ton app est déjà plus complète qu'Hevy Coach et TrueCoach sur la nutrition et le suivi en direct ; il manquait la boucle bilan → score → alerte → ajustement, et le pont entre l'app gratuite et ton coaching.

### Phase 2 (par ordre d'impact)
1. **Défi 30 jours → candidature.** L'essai passe de 7 à 30 jours, guidé par 10 étapes (point de départ, mesures, photos, première séance, 4 bilans, rapport, candidature). La candidature s'ouvre au jour 21, reprend les réponses de l'anamnèse et joint automatiquement le dossier (régularité, séances, poids, tour de taille, motivation), visible dans tes candidatures et transmis à Calendly.
2. **Bilan hebdomadaire.** Pré-rempli (poids moyen sur 7 jours, sommeil, séances faites, repas notés), mensurations facultatives, moral, énergie, sommeil, stress, faim, suivi du plan, victoire, difficulté, question. Ouvert à tous. Pour les coachés, il part aussi en message (même format « 📝 Bilan », ta boîte le détecte toujours). Carte sur l'Accueil du vendredi au dimanche, historique avec courbes.
3. **Score de régularité** (0–100 sur 14 jours : séances 40 %, repas 25 %, routine 15 %, bilans 20 %), statut (Sur la bonne voie / À surveiller / Décroche), tendance semaine contre semaine, conseil sur le levier le plus faible.
4. **Alertes de décrochage côté coach.** Bloc « 🚨 Qui décroche » en tête de l'onglet Aujourd'hui : inactivité, chute de 20 points ou plus, bilan manquant, 2 séances loupées d'affilée, énergie / sommeil / stress / moral au dernier bilan, point santé. Bouton « Relancer » qui ouvre la conversation avec un message adapté à la raison et au prénom. Score affiché dans la liste des clients, qui remonte les clients qui décrochent.
5. **Anamnèse** : 7 questions santé inspirées du PAR-Q+ (reformulées), gênes par zone, antécédents, historique, mode de vie, motivation, échéance ; consentement explicite (données de santé) ; un « oui » santé affiche le conseil de voir un médecin et une alerte chez toi. L'onboarding existant n'a pas été rallongé.
6. **Rapport de progression partageable** : poids, tour de taille, hanches, bras, séances, tonnage, meilleures progressions de force, bilans, régularité, avant / après ; image PNG 1080 × 1350 aux couleurs de l'app, partage par le téléphone. **Témoignage** avec accord horodaté (prénom, initiale ou anonyme ; photos oui / non) et retrait possible ; tu le vois dans le dossier du client.
7. **Comparateur avant / après** : même vue à deux dates, côte à côte ou au curseur, écarts de jours, de poids et de tour de taille, export en image. Les photos restent sur le téléphone ; envoi à toi possible photo par photo une fois la migration Storage appliquée.
- **Dossier client, nouvel onglet « 📈 Suivi »** (ouvert par défaut) : score, alertes, résultats depuis le début, bilans avec courbes, anamnèse, témoignage, photos envoyées.

### Qualité
- Moteur pur `js/adherence.js` + 13 tests unitaires ; test de bout en bout **iPhone 390 × 844 tactile** (`tests/adherence-e2e.js`, 55 vérifications : membre, nouvel inscrit, coach, mode sombre vérifié à part), rien ne dépasse de l'écran, aucune erreur JavaScript. Les tests existants « Volume » passent toujours (25/25). Les deux nouveaux tests sont ajoutés à la CI.
- Service worker passé en `cxs-v86` avec les nouveaux fichiers dans la liste hors ligne.
- Aucun secret ajouté ; aucune nouvelle table : tout passe par l'instantané existant (`cxs_member_data`).

## Ce qui reste

- **Appliquer les 2 migrations** (voir plus bas). Sans `2026-11-08_suivi_photos.sql`, tout fonctionne sauf l'envoi de photos au coach (message clair côté membre).
- **Essai Stripe** : l'Edge Function `billing` offre encore 7 jours d'essai Stripe sur Bâtisseur. Après le défi de 30 jours, un membre qui s'abonne a donc 7 jours de plus. À toi de décider : garder (geste commercial) ou mettre `trial` à 0 dans `supabase/functions/billing/index.ts` puis redéployer.
- **CI déjà rouge sur `main`** : la vieille suite `tests/run.js` échoue depuis au moins le 7/11 (avant ce travail). Les nouveaux tests passent, mais la CI de la PR restera rouge tant que `run.js` n'est pas corrigé. Une autre PR ouverte (`claude/relaxed-brown-5tl5pb`) dit corriger ce harnais : à fusionner d'abord, puis celle-ci.
- **Rappels** : le rappel push du dimanche existe déjà ; il pourrait renvoyer directement vers `#/bilan` et une relance automatique pourrait partir quand un membre passe en « Décroche » (aujourd'hui, c'est toi qui relances en un geste).
- **Hors ligne** : quelques modules existants (`live.js`, `account.js`, `coachprog.js`, `vocal.js`…) manquent à la liste du service worker ; à ajouter.
- **Page de vente du défi** : le lien à mettre en bio Instagram est simplement l'adresse de l'app ; une page d'atterrissage dédiée « Défi 30 jours » sur ton site augmenterait la conversion.
- **Mentions légales** : ajouter à `confidentialite.html` la finalité des données de santé de l'anamnèse et des témoignages (je n'ai pas modifié tes textes juridiques).

## Les 3 actions que tu dois faire toi-même

1. ~~Appliquer le correctif de sécurité~~ ✅ fait. Reste, si tu veux l'envoi de photos au coach : relire et exécuter `2026-11-08_suivi_photos.sql`.
2. **Relire et fusionner la PR** après avoir testé sur ton téléphone le parcours d'un nouveau compte (Défi → point de départ → bilan → rapport → candidature) et ton onglet Aujourd'hui. Décider pour l'essai Stripe de 7 jours (ci-dessus).
3. **Envoyer ton audience dans le défi** : un post et une story « Défi 30 jours offert, avec ton rapport avant / après à la fin » avec le lien de l'app, et compléter ta politique de confidentialité (données de santé, témoignages) avant la diffusion.
