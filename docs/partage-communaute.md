# Partage, parrainage, amis et communauté

Travail du 18 novembre 2026, branche `claude/sharing-community-features-jr179m`.

## Ce que fait chaque membre

| Fonction | Où | Sans compte | Sans migration SQL |
|---|---|---|---|
| **Story de séance** (image 1080 × 1920 : titre, minutes, séries, tonnes, grade, records) | Écran « Séance terminée » → 📸 Story | ✓ | ✓ |
| **Envoyer sa séance à un ami** (texte + lien) | « Séance terminée » → 💬 À un ami | ✓ | ✓ |
| **Montrer son programme** (story + lien ; la personne peut le suivre) | Entraînement › Carnet → 📤 Montrer mon programme | ✓ | ✓ |
| **Page d'arrivée** de la personne qui reçoit le lien (séance ou programme, puis « Commencer mes 30 jours offerts ») | Lien reçu | ✓ | ✓ |
| **Inviter et gagner** (code, lien, paliers, compteurs) | Profil › Communauté › Inviter et gagner | lien sans code | lien avec code, compteurs « bientôt » |
| **Amis** (par code, acceptation, podium de la semaine) | Profil › Mes amis | — | « bientôt disponible » |
| **Communauté** (fil, 5 gestes d'encouragement, quête du jour, série, niveaux) | Profil › Communauté | — | « bientôt disponible » |
| **Coach** : signalements, récompenses à traiter, meilleurs parrains | Business › 🤝 Parrainage et communauté | — | message « migration à appliquer » |

Chaque lien partagé porte le code d'invitation du membre (`?r=CODE`). La personne qui l'ouvre garde ce code sur son téléphone, a les 30 jours d'essai comme tout le monde, et le code est lié à son compte dès qu'elle en crée un : parrain et filleul deviennent amis d'office.

## Récompense du parrain

- **1 mois de Bâtisseur offert par filleul qui passe Bâtisseur** (premier paiement), 6 mois au plus par an.
- Parrain abonné sur Stripe : **crédit de 19,99 € sur sa prochaine facture** (solde client Stripe), posé une seule fois même si Stripe rejoue l'événement.
- Parrain sans abonnement (essai en cours, essai fini) : **30 jours de Bâtisseur en plus**, après la fin de son essai s'il court encore.
- Parrain coaché ou Invité : rien d'automatique, la récompense arrive dans « à traiter » chez Thomas, qui choisit un geste équivalent.
- Paliers : badges Recruteur (1), Ambassadeur (3), Mentor (5), Légende (10). Au palier Ambassadeur, une **analyse vidéo de la technique sur un exercice** (arrive dans « à traiter » chez Thomas). Décision de Thomas : pas de cadeau qui lui prend du temps, peu de mois gratuits.

## Règles de la communauté

- **Aucun échange** : pas de messages, pas de commentaires, pas de profil consultable. On ne voit que le pseudo, l'avatar (emoji) et des chiffres d'entraînement.
- **Filtre anti-contacts** côté téléphone et côté serveur : liens, e-mails, @comptes, numéros de téléphone et noms de réseaux sont retirés des titres, des records et des pseudos.
- **Rien de sensible n'est publié** : ni poids, ni mensurations, ni nutrition, ni santé, ni notes de séance.
- Visibilité au choix : moi seul, mes amis, toute la communauté (par défaut : toute la communauté, choix de Thomas). La communauté est **à rejoindre** (opt-in) et on la voit seulement si on en fait partie.
- **Amis seulement par code** (des gens qu'on connaît) avec acceptation.
- Signalement en un geste ; masquage automatique à 3 signalements, en attendant Thomas.
- On ne peut pas encourager sa propre séance ; 300 gestes par jour au plus, 20 publications par jour au plus.
- RGPD : « Effacer mes données de la communauté » efface profil, amis, publications et gestes.

## Ce qui rend ça ludique

- **Quête du jour** : encourager 3 séances. La remplir allume la **flamme du supporter** (série de jours) ; l'accueil prévient le soir si la série va s'éteindre.
- **Niveaux de supporter** selon les encouragements donnés : Nouveau venu → Allumeur (10) → Moteur (50) → Pilier (150) → Phare (400) → Légende du vestiaire (1 000), avec barre de progression.
- **Podium de la semaine** entre amis.
- Retour immédiat : vibration, petite gerbe d'emoji (coupée si « réduire les animations »), message quand une quête ou un niveau est atteint.
- Accueil : « 🔥 N encouragements reçus » depuis la dernière visite, demandes d'ami.

Pas de mécanique d'argent, pas de classement public de tous les membres (seulement entre amis) : l'idée est d'encourager à revenir s'entraîner, pas de faire scroller.

## Décisions prises sans toi (toutes réversibles)

| # | Décision | Pourquoi |
|---|---|---|
| S1 | Les liens de séance et de programme **portent leurs données** (encodées dans l'adresse) au lieu d'être stockés sur le serveur. Un programme du catalogue voyage par son identifiant. | Partage instantané, même hors connexion ou sans compte ; aucune page publique hébergée. |
| S2 | ~~Bonus du filleul +7 jours~~ retiré le 19/11 à la demande de Thomas : 30 jours pour tous. | Raison concrète de passer par le lien ; ne coûte rien. |
| S3 | Récompense du parrain au **premier paiement** du filleul (pas à l'inscription). | Ne récompense que ce qui rapporte ; évite les faux comptes. |
| S4 | Paliers : badges + analyse vidéo au 3e ami abonné ; plafond 6 mois offerts par an. | Choix de Thomas (18/11) : récompenser l'apport de valeur, pas la gratuité. Réglable dans `js/social.js` et la migration. |
| S5 | Un Bâtisseur offert jusqu'à une date (parrainage, accès donné par toi) se ferme **3 jours après** cette date côté app. | Rien ne faisait expirer `tier_until` jusqu'ici. Les abonnés Stripe ne sont pas touchés : chaque renouvellement repousse la date. |
| S6 | Amis par code seulement, pas depuis la communauté. | Ta règle « pas d'échange de contacts » ; on ne peut pas aborder un inconnu. |
| S7 | Le partage ne publie rien dans la communauté tant que le membre n'a pas choisi un pseudo et une visibilité ; ensuite, publication automatique (désactivable). | Consentement explicite avant toute publication. |

## Ce qu'il te reste à faire (rien n'est en production)

1. **Relire et appliquer** `supabase/migrations/2026-11-18_cxs_social.sql` (7 tables nouvelles, aucune table existante modifiée). Retour arrière : `2026-11-18_cxs_social_retour.sql` (archive, ne supprime rien).
2. **Redéployer** l'Edge Function `stripe-webhook` (nouveau fichier `parrainage.js`, appel ajouté dans `cxs.ts`).
3. Vérifier que les liens de paiement Stripe posent bien `metadata.app = tb-my-coach` sur l'abonnement (c'est déjà ce que le webhook attend) : la recherche du parrain sur Stripe s'en sert.
4. ~~Mettre à jour les CGV~~ : fait le 19/11 (articles 13 Parrainage et 14 Communauté de `cgv.html`).

## Fichiers

- `js/social.js` : règles pures (liens, filtre, paliers, jeu), testées par `tests/social.test.mjs`.
- `js/views/social.js` : écrans, image story, partage, espace coach.
- `supabase/migrations/2026-11-18_cxs_social.sql` (+ `_retour.sql`), testée par `tests/sql/run-social.sh` (Postgres local).
- `supabase/functions/stripe-webhook/parrainage.js`, testé par `tests/parrainage-webhook.test.mjs`.
- `tests/social-e2e.js` : parcours complets, iPhone et Android, clair et sombre.

## Liens courts (19 novembre 2026)

Les liens partagés ne portent plus toute la séance ou tout le programme : le partage est enregistré dans `cxs_soc_partages` et le lien ne contient que son identifiant (`…/tb-coaching-app/?p=K7m2Qx9a`). La personne qui l'ouvre lit le partage sans compte (`cxs_soc_partage_lire`), avec le code d'invitation de l'auteur. Sans connexion ou sans compte, l'app retombe sur l'ancien lien long, qui marche toujours. Message raccourci : « 💪 Dos + épaules : 150 min · 46 séries · 11,4 t / 🏆 Record : … / Viens t'entraîner avec moi 👉 lien ». Migration : `supabase/migrations/2026-11-19_cxs_partages.sql`.
