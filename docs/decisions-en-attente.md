# Décisions en attente (branche `claude/ux-coeur`)

Rien de ce qui suit n'est tranché. Chaque point attend une validation de Thomas.

## 1. Textes nouveaux à valider

Tous sont neutres (aucun accord au masculin présumé). Ils sont dans le code, faciles à changer.

| Où | Texte | Fichier |
|---|---|---|
| Accueil, action du jour | « Aujourd'hui · jour de repos », « Aujourd'hui · séance faite ✅ » | `js/views/home.js` |
| Accueil, action du jour | « Note ta journée », « Journée notée ✅ » | `js/views/home.js` |
| Accueil, action du jour | « Copier mes repas d'hier », « Noter un repas » | `js/views/home.js` |
| Routine | « comme la dernière fois ? » (sous Poids, Sommeil, Pas) | `js/views/home.js` |
| Message après copie | « 2 aliments copiés depuis hier », « Déjeuner copié », « Rien à copier ce jour-là » | `js/views/home.js` |
| Accueil, sections repliées | « 📋 Ma journée · 2/5 », « 🗓️ Ma semaine et mon cycle », « 📈 Régularité et progrès » | `js/views/home.js` |
| Journal | « ⚡ En un tap », « Toute la journée d'hier · 820 kcal », « Déjeuner d'hier · 520 kcal » | `js/views/food.js` |
| Récupération | « ✓ 7,5 h, comme la dernière nuit notée » | `js/views/recup.js` |
| Progression | « 🔥 3 jours de série », « Quêtes du jour », « Trophées 2/8 » | `js/quests.js` |
| Progression | « Un jour de repos prévu ne casse pas ta série. » | `js/quests.js`, `js/views/trophees.js` |
| Retour après 3 jours sans rien noter | « 👋 On reprend. Un seul geste aujourd'hui suffit pour relancer ta série. » | `js/serie.js` |
| Retour, journée déjà active | « 👋 On reprend : ta série est relancée. » | `js/serie.js` |
| Accueil, salutation | « Bonjour, Alex » sur une ligne (avant : sur deux lignes, en très grand) | `js/views/home.js` |

Textes existants laissés tels quels, à relire à l'occasion : « Reprendre la séance » (séance en cours), « Reprise après une pause : charges allégées de 10 % » (séance), trophée « 3 reprises après un écart ».

## 2. Décisions de produit

1. **Cartes de suivi sur l'accueil** (défi, bilan de la semaine, « Je craque », revue, montée en charge, point de départ, régularité). Elles restent visibles, sous la progression, quand elles ont quelque chose à dire. Les replier aussi rendrait l'écran plus court mais cacherait des rappels datés (bilan du vendredi). À trancher : visibles (choix actuel) ou repliées avec un compteur.
2. **Définition du « repos prévu »** qui ne casse pas la série : repos choisi, absence annoncée, ou jour sans séance dans un programme en cours. Un jour de séance manquée casse toujours la série. Sans programme en cours, aucun jour n'est « prévu » en repos. À confirmer.
3. **Un repos prévu ne compte pas** dans la série : il est traversé, il n'ajoute pas un jour. Alternative : le compter comme un jour actif. Les points ne changent pas.
4. **Message de retour** affiché après 3 jours pleins sans rien noter. Seuil à confirmer (3, 5 ou 7 jours).
5. **Pas pré-remplis** avec le dernier nombre noté : cohérent avec la demande, mais les pas varient plus que le poids. Alternative : pré-remplir avec l'objectif, ou ne rien pré-remplir.
6. **Ajout direct d'un aliment** (« + 150 g ») : reprend la dernière quantité, sinon la portion habituelle, sinon 100 g. À confirmer.
7. **Séance, un exercice à la fois** : l'exercice en cours est déplié (avec son partenaire de superset), les autres tiennent sur une ligne et s'ouvrent d'un tap. À confirmer, ou ajouter un réglage « tout déplier ».
8. **Bouton « + Ajouter » des cartes de repas** : il fait 34 px de haut (fichier `js/views/meals.js`, hors périmètre). À passer à 44 px.

## 3. Textes de vente, CGV, consentement

Aucun texte de vente, de CGV ni de consentement n'a été écrit ou modifié. Deux éléments de vente existants ont seulement changé de place sur l'accueil, mot pour mot :

- la carte « Accélère avec le Bâtisseur » (comptes gratuits), maintenant sous les sections repliées ;
- la pastille « Passer au coaching » en haut de l'écran, inchangée.

Proposition à valider, non appliquée : retirer la carte de vente de l'accueil les jours où une séance est prévue, pour ne garder qu'une seule sollicitation (la pastille). Le texte éventuel est à écrire par Thomas.
