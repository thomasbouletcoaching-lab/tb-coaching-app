# Audit marché et plan 10 000 €/mois — novembre 2026

Audit réalisé le 8 novembre 2026 à partir de recherches web (sources numérotées en bas de page) et de la lecture des dépôts `tb-coaching-app` et `site-thomasboulet.coaching`. Aucun chiffre n'est inventé : tout chiffre de marché renvoie à une source ; les calculs sont faits à partir de ces chiffres ou de tes propres prix ; les **hypothèses** sont signalées comme telles et sont à remplacer par tes vrais chiffres.

---

## 1. En une minute

1. **10 000 €/mois, c'est 120 000 €/an : au-dessus du plafond de la micro-entreprise** (83 600 € pour les prestations de services en 2026-2028) [1][2]. Ce n'est pas bloquant, mais c'est un changement de régime à préparer avec un comptable.
2. **La TVA arrive bien avant** : franchise jusqu'à 37 500 €, TVA due dès le dépassement de 41 250 € [3][4]. À 10 000 €/mois, ce seuil tombe au 5ᵉ mois de l'année. Si tes prix restent affichés « TVA non applicable », chaque 1 620 € encaissé ne vaudra plus que 1 350 € HT une fois la TVA à 20 % appliquée. **Il faut décider maintenant si l'objectif est 10 000 € HT ou TTC.**
3. **Ton cycle (540 €/mois) est 3,6 fois la médiane observée** d'un échantillon de coachings en ligne facturés en euros (150 €/mois) [5]. C'est un positionnement premium, cohérent avec certaines offres 12 semaines vues à l'étranger (1 497 $, 2 544 $) [11][12], mais **il ne se vend qu'avec des preuves**. Or sur ton site, la section « Ils l'ont fait » et la vidéo de présentation sont **vides** (constaté dans `produits.js` : `RESULTATS = []`, `vsl: ""`).
4. **Ta capacité plafonne le cycle** : environ 10 clients en même temps (ce que tu m'as indiqué) × 540 € = **5 400 €/mois maximum** avec le cycle seul. Les 4 600 € restants doivent venir d'offres qui ne consomment pas ton temps à l'unité.
5. **Tes prix ne sont pas les mêmes entre le site et l'app** : Premium à 9,99 € sur le site contre « Bâtisseur » à 14,99 € dans l'app ; « coaching léger » à 89 € sur le site contre « Fraternité » 59 € / « Coaching Essentiel » 99 € dans l'app. Un prospect qui voit deux prix pour le même produit perd confiance.

## 2. Le cadre légal et fiscal (ce qui conditionne l'objectif)

| Sujet | Règle 2026 | Ce que ça change pour toi |
|---|---|---|
| Plafond micro-entreprise (services) | 83 600 € de CA annuel HT pour 2026-2028 [1][2] | À 10 000 €/mois, dépassement. On reste micro jusqu'au 31 décembre de la **2ᵉ année consécutive** de dépassement [6]. |
| Franchise de TVA (services) | 37 500 € ; seuil majoré 41 250 €. Au-delà de 41 250 €, TVA due dès le dépassement [3][4]. La réforme du seuil unique à 25 000 € a été abandonnée [7]. | À 10 000 €/mois : TVA due vers le 5ᵉ mois. Prévoir des prix TTC, des factures avec TVA, et une déclaration. |
| Cotisations sociales | 25,6 % du CA pour une activité libérale BNC non réglementée ; 21,2 % en BIC services [8][9] | Sur 10 000 € encaissés en BNC : 2 560 € de cotisations, avant impôt et frais. **Vérifie sur ton compte URSSAF si tu es déclaré en BNC ou BIC.** |
| Carte professionnelle | Obligatoire pour encadrer contre rémunération ; renouvelée tous les 5 ans ; vérifiable par le public sur le portail EAPS [10][13] | Tu as un numéro (09325ED0336, sur tes mentions légales). C'est un **argument de confiance** : il était caché en bas d'une page légale. La PR du site l'affiche près du prix. |
| Droit de rétractation | 14 jours pour un service conclu à distance ; l'exemple officiel cite un abonnement de coaching en ligne [14] | Tes CGV le traitent déjà correctement (article 4 : début anticipé sur demande expresse, paiement au prorata). Rien à changer. |

**Conséquence directe** : l'objectif réaliste à court terme se pilote avec **deux jauges** : le CA cumulé de l'année face à 37 500 € / 41 250 € (TVA), puis face à 83 600 € (régime). C'est ce que fait le nouvel écran « Objectif » de l'espace coach (voir REPORT.md).

## 3. Le marché : où se situent tes prix

### Coaching en ligne avec suivi humain (France)

| Source | Ce qu'elle mesure | Chiffres |
|---|---|---|
| ModelesDeBusinessPlan, d'après les abonnements actifs d'une plateforme (Gymkee Pay), août 2026 [5] | Abonnements réellement facturés en euros, **un seul outil, pas tout le marché** | Médiane 150 €/mois ; la moitié entre 90 et 200 € ; premium 200 à 300 €+ |
| Coachway, guide prix 2026 [15] | Offres observées en France | 30 à 60 €/mois (programme + messages), 80 à 150 €/mois (complet avec nutrition et bilans), offres premium vers 190 € |
| FitBudd, sondage de coachs (juin 2026, surtout US) [16] | Tarifs déclarés | Coaching virtuel mensuel de 59 à 500 $ |

**Lecture** : tes 540 €/mois sont au-dessus de tout ce qui est observé en France, sauf le très haut de gamme. Ce n'est pas une erreur en soi (le cycle inclut un appel de lancement, 12 bilans commentés, une séance en salle à Paris), mais ce niveau exige des **preuves visibles** et un **appel de vente** : c'est déjà ton tunnel (candidature → appel → paiement), il manque la preuve.

### Offres « 12 semaines » comparables (exemples, pas une statistique)

- Un coaching privé 12 semaines vendu 1 497 $ [11].
- Barbell Logic, « Lean in 12 », force + nutrition, 2 544 $ [12].
- Un coaching individuel 12 semaines à 573 £ [17].

### Applications de musculation (ton Premium / Bâtisseur)

| App | Mensuel | Annuel | À vie |
|---|---|---|---|
| Fitbod | 15,99 $ | 95,99 $ | — [18] |
| Strong PRO | 4,99 $ | 29,99 $ | 99,99 $ [19] |
| Hevy Pro | 2,99 $ | 23,99 $ | 74,99 $ [20] |

**Lecture** : ton app est entre les simples carnets (Hevy, Strong) et Fitbod. Les deux prix que tu affiches (9,99 € sur le site, 14,99 € dans l'app) sont défendables ; **le problème est d'en avoir deux**. Le prix réellement payé est celui des prix Stripe (`tb_premium_month`, `tb_premium_year`), qui est recopié automatiquement dans l'app quand tu cliques « Vérifier Stripe » dans l'espace coach (`supabase/functions/billing/index.ts`). Le site, lui, est écrit à la main.

### Coûts d'outillage

- Stripe : 1,5 % + 0,25 € par carte européenne standard [21] ; Stripe Billing (abonnements) ajoute 0,7 % du volume facturé [22]. Exemple sur une mensualité de 540 € par abonnement : 8,35 € + 3,78 € = **12,13 €**, soit environ 2,2 %.
- ManyChat (DM automatiques sur mot-clé) : le plan Pro est affiché à 39 $/mois (29 $ en annuel) pour 2 500 contacts actifs [23] ; son plan gratuit est passé à 25 contacts actifs par mois en août 2026 [24]. Inrō, alternative limitée à Instagram, démarre à 12,99 €/mois [24].

## 4. Le calcul pour 10 000 €/mois

### Ce qui est fixé

- Cycle : 540 €/mois par client, ~10 clients en même temps (ta limite) → **5 400 €/mois au maximum**.
- Le reste doit venir d'offres « à faible temps » : coaching léger, Premium, cycles 6 mois (179 €), programmes (29-39 €).

### Trois mélanges possibles (calculs, pas des prévisions)

| Mélange | Cycle 540 € | Coaching léger 89 € | Premium 9,99 € | Total/mois |
|---|---|---|---|---|
| A. Tout sur le cycle | 10 clients = 5 400 € | 0 | 0 | 5 400 € — **objectif impossible** |
| B. Cycle plein + léger | 10 = 5 400 € | 45 = 4 005 € | 60 = 599 € | 10 004 € |
| C. Cycle plein + app | 10 = 5 400 € | 20 = 1 780 € | 285 = 2 847 € | 10 027 € |

À noter : le mélange B demande 55 personnes suivies à des degrés divers. Si le coaching léger te prend du temps à chaque client, ta vraie limite n'est pas 10 mais un total d'heures : **mesure ton temps par client pendant 2 semaines** avant de choisir B ou C.

Si la TVA s'applique (au-delà de 41 250 €/an) et que les prix affichés restent les mêmes, chaque total ci-dessus est à diviser par 1,2 pour obtenir le HT.

### Ce qu'il faut faire rentrer chaque mois (formule, avec hypothèses à remplacer)

Pour garder 10 places de cycle pleines, sur des cycles de 3 mois, il faut en moyenne **3,3 nouveaux clients par mois** si personne ne renouvelle (10 ÷ 3). Chaque renouvellement réduit ce besoin.

Le nombre d'appels nécessaires = nouveaux clients ÷ ton taux de signature. **Hypothèse d'exemple** : si 1 appel sur 3 signe, il faut 10 appels par mois. Je n'ai trouvé aucune statistique fiable sur ce taux en France ; le tableau de bord le calcule à partir de tes vraies candidatures (clients ÷ demandes passées en « client » ou « pas pour moi » après l'appel).

## 5. Ce qui bloque la vente aujourd'hui (constats)

| N° | Constat | Preuve | Impact |
|---|---|---|---|
| M1 | Pas de preuve sociale en ligne : « Ils l'ont fait » est vide, pas de vidéo de présentation | `site/produits.js` : `RESULTATS = []`, `SITE.vsl = ""` | Fort : un prix 3,6× la médiane [5] sans preuve |
| M2 | Prix différents site / app (Premium 9,99 € vs Bâtisseur 14,99 € ; léger 89 € vs 59/99 €) | `site/produits.js`, `app/js/config.js` | Fort : perte de confiance au moment de payer |
| M3 | Impossible de savoir quel Reel ou quel mot-clé amène les candidatures : le site n'enregistre pas la source | `site/site.js` : `data` = origine, demande, page | Fort : tu ne peux pas doubler ce qui marche |
| M4 | Aucun suivi du CA face aux seuils TVA / micro ni de l'objectif mensuel | Business : CA du mois et de l'année, objectif annuel, mais ni objectif mensuel, ni seuils TVA / micro | Moyen : risque fiscal non vu venir |
| M5 | Carte professionnelle cachée dans les mentions légales | `site/mentions-legales.html` | Moyen : argument de confiance gratuit non utilisé |
| M6 | Le nom « Charpente » est encore partout (site, CGV) alors que tu veux le changer | `site/produits.js`, `coaching.html` | Faible tant que le nouveau nom n'est pas choisi |
| M7 | Offre fondateur (790 €, 10 places, jusqu'au 31/12/2026) prévue mais non configurée : le code existe (`site.js`), pas les réglages ni le bloc HTML | `site/site.js`, `produits.js` | À décider : voir DECISIONS.md |

## 6. Les leviers, par impact ÷ effort

1. **Publier 3 résultats réels** (toi + 2 clients, accord écrit) dans `RESULTATS` : la section s'affiche toute seule. Tu as déjà la matière (ton cycle : dips +85 → +100 kg, squat 125 → 150 kg ; les résultats clients listés dans tes docs).
2. **Un seul prix par produit** : faire de Stripe la référence, recopier les mêmes prix sur le site.
3. **Mesurer la source de chaque candidature** (fait dans la PR du site : `?src=reel-1rm` sur tes liens).
4. **Piloter l'objectif chaque lundi** (fait dans la PR de l'app : écran Objectif).
5. **Préparer la sortie de franchise de TVA** avec un comptable avant d'atteindre 37 500 € sur l'année.

---

## Sources

1. Bercy Infos Entreprises, plafonds micro-entreprise 2026 — https://www.economie.gouv.fr/node/34776
2. Legifiscal, nouveaux seuils micro-entreprises 2026 — https://www.legifiscal.fr/actualites-fiscales/4436-nouveaux-seuils-micro-entreprises-annee-2026.html
3. Maxcompta, seuils de TVA et franchise en base 2026 — https://www.maxcompta.com/blogs/actualites/seuils-tva-franchise-base-2026-independants
4. SparkReceipt, franchise en base de TVA 2026 — https://sparkreceipt.com/fr-fr/blog/franchise-en-base-de-tva/
5. ModelesDeBusinessPlan, chiffres du coaching sportif en ligne en France (mis à jour le 20/10/2026) — https://modelesdebusinessplan.com/blogs/infos/coach-sportif-chiffre-marche-coaching-sportif-en-ligne-france
6. Propulse by CA, plafonds de la micro-entreprise — https://propulsebyca.fr/micro-entrepreneur/plafond
7. Hayot Expertise, réforme du seuil à 25 000 € abandonnée — https://hayot-expertise.fr/blog/reforme-franchise-tva-2026-seuil-25000-euros
8. economie.gouv.fr, montant des cotisations sociales en micro-entreprise — https://www.economie.gouv.fr/micro-entreprises-quel-est-le-montant-de-vos-cotisations-sociales
9. LS Compta, devenir coach sportif (taux BNC 25,6 % en 2026, sanctions) — https://www.lscompta.fr/blog/devenir-coach-sportif/
10. Service-Public, portail de déclaration des éducateurs sportifs — https://www.service-public.gouv.fr/associations/vosdroits/R41973
11. Exemple d'offre « 12 Week Private Coaching » — https://payhip.com/b/hxSGs
12. Barbell Logic, Lean in 12 — https://store.barbell-logic.com/product/lean-in-12-transformation/
13. SDJES des Vosges, carte professionnelle et vérification sur EAPS public — https://www.ac-nancy-metz.fr/media/33177/download
14. Service-Public, droit de rétractation à distance — https://www.service-public.gouv.fr/particuliers/vosdroits/F10485
15. Coachway, combien coûte un coach sportif en ligne (2026) — https://coachway.io/fr/combien-coute-un-coach-sportif-en-ligne/
16. FitBudd, prix pratiqués par les coachs (sondage juin 2026) — https://www.fitbudd.com/insights/fitbudd-pricing-for-personal-trainers
17. Exemple d'offre « 12-Week One-to-One Online Coaching » — https://nicholassams.gumroad.com/l/jlvno
18. Garage Gym Reviews, Fitbod — https://www.garagegymreviews.com/fitbod-review
19. SensAI, Strong 2026 — https://www.sensai.fit/blog/strong-app-review-2026
20. SensAI, Hevy 2026 — https://www.sensai.fit/blog/hevy-review-2026
21. Stripe, tarifs (1,5 % + 0,25 € cartes européennes standard) — https://stripe.com/fr/lp/payments/payments-platform
22. Indy, frais Stripe et Stripe Billing 0,7 % — https://www.indy.fr/guide/comptabilite-en-ligne/commerce/stripe-comptabilite/frais-stripe/
23. Activepieces, prix ManyChat 2026 (d'après manychat.com/pricing) — https://www.activepieces.com/blog/manychat-pricing-2026-plans-and-contact-tier-costs
24. Inrō, comparatif de coût avec ManyChat (août 2026) — https://www.inro.social/tools/inro-vs-manychat-cost
