# Rapport — travail autonome du 8 novembre 2026

Objectif : t'aider à atteindre 10 000 €/mois. Tout est sur des branches, avec une PR par dépôt. Rien n'est sur `main`, rien n'est en prod, Stripe et les données clients n'ont pas été touchés.

- App : branche `claude/objectif-10k`, PR https://github.com/thomasbouletcoaching-lab/tb-coaching-app/pull/4
- Site : branche `claude/attribution-confiance`, PR https://github.com/thomasbouletcoaching-lab/site-thomasboulet.coaching/pull/1

## Ce qui est fait

1. **Audit marché sourcé** (`docs/audit-marche-2026-11.md`, 24 sources). À retenir :
   - 10 000 €/mois, c'est 120 000 €/an : **au-dessus du plafond micro-entreprise** (83 600 €). Et la **TVA** tombe dès 41 250 € (vers le 5ᵉ mois à ce rythme).
   - Ton cycle à 540 €/mois coûte **3,6 fois la médiane** d'un échantillon de coachings en ligne en euros (150 €/mois) : c'est un positionnement premium, qui ne se vend qu'avec des preuves. Or ton site n'en montre aucune (résultats et vidéo vides).
   - Avec 10 places à 540 €, le plafond est de **5 400 €/mois**. Le reste doit venir d'offres qui ne prennent pas ton temps client par client.
   - **Les prix diffèrent entre le site et l'app** (Premium 9,99 € contre Bâtisseur 14,99 € ; coaching léger 89 € contre 59/99 €).
2. **App : nouvel onglet Espace coach → Business → Objectif**, testé en rendu iPhone, en clair et en sombre :
   - l'encaissé du mois face à 10 000 €, ce qui est attendu et ce qui est en retard ;
   - le revenu récurrent (cycles en cours + abonnements de l'app) et ce qu'il manque : combien de places de cycle remplir, puis combien d'abonnés ;
   - le nombre de nouveaux clients et d'appels nécessaires chaque mois, au taux de signature mesuré ;
   - les **seuils de TVA et de la micro-entreprise**, avec le mois prévu de dépassement ;
   - les **demandes du site par source**, et une liste « À traiter » avec leur statut. Jusqu'ici, ces demandes n'apparaissaient que dans l'ancien espace coach.
   - Réglages : objectif, nombre de places, prix du cycle, % de renouvellement.
3. **Site : la source de chaque demande est enregistrée** (`?src=reel-1rm`, UTM), sans cookie. Ta **carte professionnelle** est affichée près du prix, avec le lien officiel de vérification.
4. **Tests** : moteur de calcul 12/12 (`tests/objectif.test.mjs`), écran Objectif 18/18 (`tests/objectif-e2e.js`), site 9/9 (`tests/attribution-e2e.js`). Les nouveaux tests de l'app sont ajoutés à la CI. Le test existant « Volume de la semaine » passe toujours (25/25).
   - ⚠️ L'ancienne suite `tests/run.js` échoue **déjà sur `main`** : elle cherche des fonctions de l'ancienne app en un seul fichier (`ST`, `msgOpen`, `openClient`), que la nouvelle `index.html` ne contient plus. Ma branche ne touche ni `index.html` ni `coach/`. Il faudra la réécrire ou la retirer : sans ça, la CI restera rouge.
5. **DECISIONS.md** : les 15 décisions prises seul, et comment revenir sur chacune.

## Ce qui reste

- Relire et fusionner les deux PR. Une fois l'app fusionnée, ouvre Business → Objectif et vérifie que la carte « Demandes du site » s'affiche. Si elle indique « indisponibles », la base refuse la lecture de `leads` à ce compte : renvoie-moi le message.
- Ajouter `?src=` à tes liens : bio Instagram (`?src=bio`), lien du DM ManyChat (`?src=reel-1rm`, `?src=reel-cycle`), stories (`?src=story`).
- Choisir un **seul prix par produit** et l'aligner partout. Je n'ai rien changé : c'est ta décision, et le prix réellement payé est celui de Stripe.
- **Offre fondateur** (790 €, 10 places, jusqu'au 31/12/2026) : le code existe, mais il n'est pas réglé. Je ne l'ai pas activée, faute de connaître le nombre de places déjà prises (décision D3).
- Remplacer le nom « Charpente » quand le nouveau nom sera choisi (site, CGV, app).
- Remplir la vidéo de présentation (`SITE.vsl` dans `produits.js`).

## Les 3 actions que tu dois faire toi-même

1. **Publier 3 résultats réels, avec un accord écrit.** Le tien (dips +85 → +100 kg, squat 125 → 150 kg) et deux clients. Ajoute-les dans `RESULTATS`, dans `produits.js` du site : la section « Ils l'ont fait » s'affiche toute seule. C'est le levier le plus fort pour un prix premium.
2. **Fixer un prix unique par offre**, Stripe faisant référence (Premium, coaching léger, cycle, offre fondateur), puis me demander de le recopier sur le site et dans l'app.
3. **Prendre rendez-vous avec un comptable avant d'atteindre 37 500 € encaissés sur l'année.** Il faut préparer le passage à la TVA (prix TTC ou HT ?) et la sortie du régime micro au-delà de 83 600 €. Vérifie aussi sur ton compte URSSAF si tu es déclaré en BNC (25,6 %) ou en BIC (21,2 %).
