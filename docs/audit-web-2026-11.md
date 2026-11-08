# Audit web et conformité — novembre 2026

Complément à [l'audit produit du 7 octobre 2026](audit-2026-10-07.md). Ce document ne traite que de ce qui peut être **sourcé**. Chaque affirmation renvoie à une source consultée le 8 novembre 2026. Quand une source est contradictoire, secondaire ou non vérifiée, c'est indiqué. Aucun prix, montant ou chiffre n'a été inventé : ce qui n'a pas pu être confirmé est marqué « à vérifier ».

Ce document n'est pas un avis juridique ni comptable. Il sert à savoir quoi faire vérifier, et par qui.

## 1. Objectif 10 000 €/mois face au plafond micro-entreprise

- **Calcul** : 10 000 € × 12 = **120 000 € de chiffre d'affaires par an**.
- **Plafond 2026 des prestations de services** : **83 600 €** (2026-2028), contre 77 700 € en 2025. Source : [Bercy, Infos Entreprises](https://www.economie.gouv.fr/node/34776) ; [CCI Paris Île-de-France](https://www.entreprises.cci-paris-idf.fr/actualites/micro-entrepreneur-revalorisation-des-seuils-pour-2026-2028) ; [TPE Actu, 25/02/2026](https://tpeactu.fr/2026/02/25/micro-entrepreneurs-plafonds-chiffre-affaires-2026/).
- **Les professions libérales (BNC) sont soumises au même plafond** que les prestations de services, soit 83 600 € en 2026. Source : [Propulse by CA](https://propulsebyca.fr/actualites/nouveaux-plafonds-chiffre-affaires-2026-micro-entreprise).
- **Conclusion** : 120 000 € dépassent le plafond de 83 600 € de **36 400 €**. Un objectif de 10 000 €/mois ne peut pas être atteint en micro-entreprise sur l'année. Ce point doit être étudié avec un expert-comptable avant de fixer une stratégie de revenus.
- **Sources contradictoires** : [Keobiz (calculateur)](https://www.keobiz.fr/outils/calculateur-plafond-micro-entreprise/) affiche encore 77 700 €. Ce chiffre correspond à 2025 et doit être écarté pour 2026.
- **Sortie du régime** : une source indique que le régime est perdu après deux années consécutives de dépassement. Source : [Propulse by CA](https://propulsebyca.fr/actualites/nouveaux-plafonds-chiffre-affaires-2026-micro-entreprise). **À vérifier** sur [service-public.fr](https://www.service-public.fr) ou auprès du comptable, car je n'ai pas pu consulter la fiche officielle.
- **Plafond proratisé** : une activité créée en cours d'année a un plafond réduit au prorata. Source : [TPE Actu](https://tpeactu.fr/2026/02/25/micro-entrepreneurs-plafonds-chiffre-affaires-2026/).

## 2. Carte professionnelle d'éducateur sportif

- Un éducateur qui encadre **contre rémunération** doit déclarer son activité. Il peut obtenir une carte professionnelle d'éducateur sportif (valable 5 ans selon une source) ou une attestation de stagiaire. Sources : [Ministère des Sports, éducateurs sportifs](https://www.sports.gouv.fr/en/educateurs-sportifs) ; [Bpifrance Création](https://bpifrance-creation.fr/activites-reglementees/educateur-sportif) ; [FFME, obligations réglementaires (PDF)](https://www.ffme.fr/wp-content/uploads/2023/09/Obligations-reglementaires-educateur-sportif-1.pdf).
- La carte est délivrée après vérification du diplôme, de l'honorabilité et de l'absence d'interdiction. Source : fiches DDCS citées dans les résultats de [Nord](https://www.nord.gouv.fr/contenu/telechargement/78630/481534/file/Réglementation%20applicable%20aux%20éducateurs%20sportifs.pdf) et [Savoie](https://www.savoie.gouv.fr/index.php/contenu/telechargement/24876/191750/file/Fiche%20info%20éducateur%20sportif.pdf).
- **Action pour l'app** : les CGV et la page « à propos » doivent afficher le numéro de carte (ou de déclaration) de Thomas. Ce numéro ne doit pas être inventé ni déduit : il doit venir de Thomas.
- Références de texte citées par les sources : articles L212-1, L212-9, L212-11, L212-13, R212-85 du Code du sport. **À vérifier** sur [Légifrance](https://www.legifrance.gouv.fr).

## 3. Médiation de la consommation (obligation pour un professionnel)

- Le professionnel doit garantir au consommateur un recours effectif à un médiateur de la consommation, gratuit pour le consommateur. Source : [Médiation de la consommation, economie.gouv.fr](https://www.economie.gouv.fr/mediation-conso/vous-etes-mediateur-de-la-consommation/vos-principales-obligations) ; [Copeps, auto-entrepreneurs](https://copeps.fr/actualites/mediateur-consommation-auto-entrepreneur/).
- Les coordonnées du médiateur doivent figurer dans les CGV et sur le site. Source : [Swim Legal](https://www.swim.legal/blog/mediation-a-la-consommation-obligations-cadre-legal-entreprise).
- Le montant de l'amende administrative cité par un résumé (3 000 € personne physique, 15 000 € personne morale, article L641-1) **n'a pas été confirmé sur Légifrance** : à vérifier avant tout usage.
- **Constat sur le dépôt** : le brouillon de CGV (`docs/cgv-abonnements-brouillon.md`) et `cgv.html` doivent être contrôlés pour la présence de ce médiateur. Le brouillon le laisse à compléter (voir audit du 7 octobre, action 3).

## 4. Données de santé (RGPD, article 9)

- L'app traite des données qui relèvent de la santé : poids, mesures, douleurs (questionnaire PAR-Q), nutrition, séances. Une source indique qu'une application qui enregistre des données de santé relève de l'article 9. Source : [Donnée sensible RGPD, donneespersonnelles.fr](https://donneespersonnelles.fr/donnee-sensible-rgpd).
- Le traitement est interdit par principe sauf exception. Pour une application grand public hors soin, le consentement explicite est la base réaliste. Il doit être recueilli par une case dédiée et être révocable. Sources : [Swim Legal, données de santé](https://www.swim.legal/blog/donnees-de-sante-rgpd-entreprise-securiser) ; [CNIL, question pratique](https://www.cnil.fr/fr/cnil-direct/question/1823?visiteur=pro) (contenu non lu directement).
- La réglementation HDS (hébergement de données de santé) est mentionnée par plusieurs sources, sans détails pour une app fitness. **À vérifier** auprès de la CNIL, car l'hébergement actuel est Supabase (plan gratuit, Paris).
- **Constat sur le dépôt** : le consentement RGPD existe (`rgpd_ok` dans les métadonnées de test). Il faut vérifier qu'il est explicite pour les données de santé, et qu'il est révocable.

## 5. Supabase : mise en pause du plan gratuit

- Un projet gratuit est mis en pause après une période d'inactivité de **7 jours**. Une alerte est envoyée environ une semaine avant. La restauration reste possible jusqu'à un an. Sources : [Supabase, Project Pausing (docs)](https://supabase.com/docs/guides/platform/free-plan-pausing) ; [Supabase KB, FAQ](https://supabase.com/kb/faqs/platform/free-project-pausing).
- Le dépôt contient déjà `.github/workflows/keepalive.yml`, une tâche quotidienne de maintien. C'est une solution communautaire, non officielle. Source : [travisvn/supabase-pause-prevention](https://github.com/travisvn/supabase-pause-prevention).
- **Risque métier** : un projet mis en pause coupe l'accès de tous les clients. Passer au plan Pro est la seule solution officielle. Le coût n'a pas été vérifié sur la page tarifaire : **à vérifier** sur [supabase.com/pricing](https://supabase.com/pricing).

## 6. Stripe : frais en zone européenne

- Tarif standard cartes européennes annoncé par Stripe : **1,5 % + 0,25 € par transaction** (cartes premium 1,9 % + 0,25 €). Source : [Stripe, mises à jour tarifaires EEE](https://support.stripe.com/questions/pricing-updates-for-businesses-based-in-the-european-economic-area-(eea)) ; [Stripe, avril 2023 (Europe)](https://support.stripe.com/questions/april-2023-pricing-updates-for-businesses-based-in-europe).
- Les calculateurs tiers sont cohérents sur 1,5 % + 0,25 € mais datent de 2025-2026. Les tarifs prélèvement SEPA sont **contradictoires** selon les sources (1 % + 0,25 € contre 0,35 € forfaitaire) : **non retenus**.
- Le tarif de la page officielle est daté d'avril 2023 : **à vérifier** sur [stripe.com/fr/pricing](https://stripe.com/fr/pricing) avant de chiffrer un abonnement.
- Stripe live n'a pas été touché pendant cet audit, conformément aux règles.

## 7. État de la CI

- Le workflow `Tests` (`.github/workflows/tests.yml`) échoue sur **les 5 derniers runs de `main`** (runs n° 196, 197, 198, 199, 201). Source : [GitHub Actions, run 42360617824](https://github.com/thomasbouletcoaching-lab/tb-coaching-app/actions/runs/42360617824) (et runs précédents, même workflow).
- Cause identifiée localement : le harnais de test est en retard sur l'app (voir `DECISIONS.md` et `REPORT.md`). Le test de démarrage client ne peut pas aboutir sans profil local.

## 8. Suivi des points de l'audit du 7 octobre

| Point | Statut au 8 novembre |
|---|---|
| S1 : « Confirm email » Supabase | Non vérifié par cet audit (accès dashboard non disponible). Reste à faire par Thomas. |
| S2 : modification des messages | Non traité. Nécessite la définition réelle de la politique `messages_update`, absente du dépôt. |
| S3, S4, D1 : durcissement base | Non traité. Mêmes limites : définitions absentes du dépôt. |
| M1 : cibles tactiles 44 px | Non traité. La mesure n'a pas pu atteindre les vues connectées (voir REPORT). |
| « environ 5 minutes » | Sans objet : la version active dans `js/` ne contient pas ce texte. L'ancien `coach/index.html` dit déjà « Environ 2 minutes ». |
| P1 : premier lancement | Non traité (décision produit à prendre avec Thomas : liste des 12 questions). |

## Sources consultées

- [Bercy, Infos Entreprises](https://www.economie.gouv.fr/node/34776)
- [CCI Paris Île-de-France, revalorisation des seuils 2026-2028](https://www.entreprises.cci-paris-idf.fr/actualites/micro-entrepreneur-revalorisation-des-seuils-pour-2026-2028)
- [TPE Actu, plafonds 2026](https://tpeactu.fr/2026/02/25/micro-entrepreneurs-plafonds-chiffre-affaires-2026/)
- [Propulse by CA, plafonds 2026](https://propulsebyca.fr/actualites/nouveaux-plafonds-chiffre-affaires-2026-micro-entreprise)
- [Keobiz, calculateur (chiffre contradictoire)](https://www.keobiz.fr/outils/calculateur-plafond-micro-entreprise/)
- [Ministère des Sports, éducateurs sportifs](https://www.sports.gouv.fr/en/educateurs-sportifs)
- [Bpifrance Création, éducateur sportif](https://bpifrance-creation.fr/activites-reglementees/educateur-sportif)
- [FFME, obligations réglementaires (PDF)](https://www.ffme.fr/wp-content/uploads/2023/09/Obligations-reglementaires-educateur-sportif-1.pdf)
- [Médiation de la consommation, economie.gouv.fr](https://www.economie.gouv.fr/mediation-conso/vous-etes-mediateur-de-la-consommation/vos-principales-obligations)
- [Copeps, médiateur pour auto-entrepreneurs](https://copeps.fr/actualites/mediateur-consommation-auto-entrepreneur/)
- [Swim Legal, médiation à la consommation](https://www.swim.legal/blog/mediation-a-la-consommation-obligations-cadre-legal-entreprise)
- [donneespersonnelles.fr, données sensibles](https://donneespersonnelles.fr/donnee-sensible-rgpd)
- [Swim Legal, données de santé et RGPD](https://www.swim.legal/blog/donnees-de-sante-rgpd-entreprise-securiser)
- [CNIL, question pratique (non lue directement)](https://www.cnil.fr/fr/cnil-direct/question/1823?visiteur=pro)
- [Supabase, Project Pausing](https://supabase.com/docs/guides/platform/free-plan-pausing)
- [Supabase KB, free project pausing](https://supabase.com/kb/faqs/platform/free-project-pausing)
- [Stripe, tarifs EEE](https://support.stripe.com/questions/pricing-updates-for-businesses-based-in-the-european-economic-area-(eea))
- [Stripe, avril 2023 (Europe)](https://support.stripe.com/questions/april-2023-pricing-updates-for-businesses-based-in-europe)
- [GitHub Actions, run CI en échec](https://github.com/thomasbouletcoaching-lab/tb-coaching-app/actions/runs/42360617824)
