# Audit de la phase 0 — état réel de TB my Coach

13 novembre 2026. Branche `claude/modest-rubin-9ywahk`. **Lecture seule** : rien n'a été modifié en production, sur Stripe ni sur GitHub. En base, seules la structure (tables, colonnes, fonctions, droits) et des comptages ont été lus. Aucune ligne de client, aucun contenu de santé.

## 1. L'essentiel en une page

1. **La migration vers la nouvelle app est déjà faite aux trois quarts.** Les 16 membres actifs utilisent la nouvelle app ; l'ancienne ne reçoit plus de séances depuis le 27 octobre. L'historique (séances, repas, mesures) a déjà été copié dans les dossiers de la nouvelle app pour 10 membres. Il reste à migrer : la messagerie (encore dans l'ancienne table), 6 anciens clients qui n'ont jamais ouvert la nouvelle app, les bilans hebdomadaires de l'ancienne app, les notes de coach et les paiements.
2. **La CI est rouge pour une raison simple** : la fin de la formule gratuite (PR #25) a rendu obsolètes 5 suites de tests qui testent encore un parcours « gratuit ». La vieille suite `tests/run.js`, elle, est verte.
3. **Le dépôt était en retard sur la production.** La fonction de paiement `billing` déployée n'offre plus d'essai Stripe, alors que son code dans le dépôt disait encore 7 jours : un redéploiement depuis le dépôt l'aurait fait revenir (corrigé dans cette PR, voir § 4). Sept fonctions serveur sur neuf n'ont aucune source dans le dépôt, et un schéma `cxs_migration` existe en base sans trace.
4. **Sécurité** : aucune alerte de niveau ERROR. 6 fonctions sensibles sont appelables sans connexion, 40 par tout membre connecté. Le coach voit aujourd'hui tous les dossiers de tous les comptes, sans distinction entre coachés et abonnés autonomes (contraire à la décision D8, sans conséquence aujourd'hui car il n'y a pas encore d'abonné autonome).
5. **Bugs confirmés à fort impact** : « L'Homme de la reprise » affiché à toute personne dont le genre n'est pas enregistré comme féminin (dont tous les comptes venus de l'ancienne app) ; mention du 3114 et de « prier » dans « Je craque » ; la page des offres déborde de l'écran ; boutons trop petits dans les éditeurs du coach.

## 2. Tests (phase 0a)

| Suite | Résultat | Cause |
|---|---|---|
| Unitaires (`node --test`, 12 fichiers) | 192 / 192 | — |
| Syntaxe (esbuild sur `js/app.js`) | OK | — |
| E2E volume, adherence, exercices, monplan, indice, profils, onboarding-sur-mesure, roadmap | verts (205 vérifications) | — |
| E2E programme, atelier | rouges (bloqués dès le 1er écran) | Le scénario démarre avec un essai terminé : l'app est maintenant verrouillée sur les offres |
| E2E semaine, soutenabilite, fatigue | rouges (2 à 3 vérifications chacun) | Vérifient un écran « verrouillé, passe au Bâtisseur » qui n'existe plus |
| Ancienne app (`tests/run.js` sur `coach/`) | 277 / 277 | Verte depuis la PR #17 |
| CI GitHub sur `main` | rouge (exécutions 252 à 256) | Les 5 suites ci-dessus |

**PR #3 (`claude/relaxed-brown-5tl5pb`)** : elle modifie `tests/harness.js` pour un problème réglé autrement depuis (PR #17) ; sa correction casserait la suite aujourd'hui verte. Elle contient aussi un audit juridique (`docs/audit-web-2026-11.md`) qui reste utile. Recommandation : fermer la PR, récupérer seulement le document.

Non couvert par les tests existants : thème sombre (une seule suite), Android 360×740, mouvement réduit, mode hors ligne, liste du service worker, sécurité de la base, payloads XSS.

## 3. Bugs relevés en parcourant l'app (phase 0b)

Méthode : 223 écrans mesurés automatiquement avec la persona fictive Camille (membre) et un coach de test, en iPhone 390×844 et Android 360×740, clair et sombre, mouvement réduit. Captures conservées hors dépôt (dossier temporaire de session). Aucune erreur JavaScript sur l'ensemble du parcours.

| # | Gravité | Bug | Étapes | Phase |
|---|---|---|---|---|
| B1 | Bloquant | Palier « L'Homme de la reprise » affiché si le genre n'est pas exactement « f » : genre absent (comptes venus de l'ancienne app), ou neutre. Le mot « reprise » est affiché à tous au niveau 3, quel que soit le profil. | Trophées ou Accueil > Ta progression, profil sans `sex` | 8.1 |
| B2 | Bloquant | « Je craque » mentionne le 3114 et la prévention du suicide, et propose « prier » comme action. | Nutrition > Je craque | 6.6 |
| B3 | Bloquant | L'onboarding présélectionne « Homme » : une personne qui ne touche pas au choix est enregistrée comme homme. Pas d'option neutre. | Premier lancement, écran « corps » | 8.1 |
| B4 | Gênant | La page des offres déborde horizontalement (418 px sur un écran de 390 ou 360) : le prix « Sur candidature » sort de sa carte. Touche aussi l'écran de fin d'essai, donc l'écran de vente principal. | Offres | 3 |
| B5 | Gênant | Textes qui ne visent que les hommes : « aider d'autres hommes à se lancer » (rapport), « Avancer avec d'autres hommes », « 5 hommes à la fois » (formules), « Perte de ventre · homme actif » (modèle nutrition). | Rapport, formules, plan alimentaire | 8.1 |
| B6 | Gênant | Les offres promettent « Corrections vidéo illimitées » et « Groupe, live, corrections vidéo » : contraire à la décision D3 si cela désigne l'analyse de technique, et le groupe n'existe pas dans la nouvelle app. | Offres | 3 (question Q4) |
| B7 | Gênant | Cibles tactiles sous 40 px : éditeur de programme du coach (48 sur 90), plan alimentaire du coach (38 sur 47), anamnèse (36 sur 64), nutrition (15 sur 50), mesures (15 sur 46), récupération (13 sur 32). | Écrans cités | 4 et 10 |
| B8 | Gênant | Boutons icônes sans libellé pour lecteur d'écran : atelier (7), ancien éditeur (7), éditeur coach (7), plan alimentaire coach (7), anamnèse (5). | Écrans cités | 4 et 10 |
| B9 | Gênant | Le coach envoie un programme qui « remplace celui du client » sans que le membre accepte. | Coach > fiche > Programme > Envoyer | 4.4 |
| B10 | Gênant | La route « Candidater » renvoie vers les offres tant qu'aucune offre n'est choisie, y compris depuis le Défi au jour 21 : un tap de plus et un détour par l'écran de vente. | Défi > Candidater | 3 |
| B11 | Cosmétique | Dans l'app coach, les onglets membre affichent « NaN g de protéines » et « undefined ans · undefined cm » (le coach n'a pas de profil corporel). | coach.html > Nutrition, Profil | 2.4 |
| B12 | Cosmétique | Fiche membre côté coach : valeurs manquantes affichées « –/100 », « –/7 », « qualité –/10 » ; boutons d'action de tailles inégales. | Coach > fiche > Suivi | 9 |
| B13 | Cosmétique | Contraste insuffisant (3,1) de l'étiquette « ● Prévue » en sombre. | Coach > Aujourd'hui, thème sombre | 10 |
| B14 | Cosmétique | La description de `coach.html` parle encore d'« âme et esprit, pour cette vie et l'éternité » ; un bloc « Corps, âme et esprit » désactivé reste dans le code. | Source | 10 |
| B15 | Gênant | Un message « Gratuit : un seul programme personnel » subsiste alors qu'il n'y a plus de formule gratuite ; le brouillon de CGV décrit encore une « formule Gratuit ». | Éditeur de programme ; `docs/cgv-abonnements-brouillon.md` | 3 |
| B16 | Gênant | 5 fichiers de données (aliments Ciqual, Open Food Facts, fast-food, connaissances) absents de la liste hors ligne : la saisie d'un repas hors ligne ne trouve pas les aliments s'ils n'ont jamais été chargés. | `sw.js` | 7 (Q6, Q7) |

**Non vérifié** : la séance en cours (minuteur, saisie série par série) n'a pas été parcourue automatiquement, le bouton de démarrage ouvrant une étape intermédiaire que mon script n'a pas franchie. L'onboarding n'a été parcouru que jusqu'au premier écran. La séance en direct coach-membre n'a été vue qu'à vide. Aucun test sur un vrai téléphone : tout est en émulation.

## 4. Dérive entre la production et le dépôt (phase 0c)

| Élément | En production | Dans le dépôt | Risque |
|---|---|---|---|
| Fonction `billing` | Version 5, sans essai Stripe | Disait encore `trial = 7` ; **aligné sur la production dans cette PR** (la ligne d'essai, recopiée d'une lecture de la production du 13/11 ; le reste du fichier n'a pas été comparé octet par octet) | Sans cet alignement, un redéploiement depuis le dépôt aurait fait revenir l'essai de 7 jours |
| Fonction `stripe-webhook` | Version 5, avec `cxs.ts` (abonnements de la nouvelle app) | Présent, avec `cxs.ts` (rectification : une première version de cet audit le disait absent, à tort) | Aucun écart relevé à la lecture |
| Fonctions `push`, `delete-account`, `coach-access`, `purge-media`, `coach-ai`, `tel-probe`, `import-ciqual` | Actives | Aucune source | Code non relu, non versionné |
| Schéma `cxs_migration` (6 fonctions : `dry_run`, `summary`, `history_for`, `food_for`, `measures_for`, `num`) | Présent | Aucune trace | Outil d'une migration déjà faite, à documenter ou retirer |
| Table `cxs_exercices` (120 lignes) | Présente | Fichier `2026-11-10_cxs_exercices.sql`, absent de l'historique des migrations | Historique incomplet |
| `2026-10-30_cxs_coach_slots.sql` | Table présente | Absent de l'historique | Idem |
| `2026-11-08_suivi_photos.sql` | Non appliquée | Présente | Envoi de photos au coach inactif |
| `2026-11-11_cxs_exercices_complet.sql`, `2026-11-10_cxs_exercices_seed.sql` | Non appliquées (120 exercices au lieu de 485) | Présentes | Sans effet visible : le téléphone fusionne avec la liste embarquée |
| 53 migrations antérieures au 30/10 | Appliquées | Aucun fichier | Impossible de reconstruire la base depuis le dépôt |

Recommandation : première PR de la phase 1 = rapatrier dans le dépôt le code des 7 fonctions sans source (`push`, `delete-account`, `coach-access`, `purge-media`, `coach-ai`, `tel-probe`, `import-ciqual`) et un instantané du schéma (lecture seule en production, écriture seulement dans le dépôt).

## 5. Sécurité : constat (détail en phase 1)

- Aucune alerte ERROR. Alertes WARN : 6 fonctions `SECURITY DEFINER` appelables sans connexion (`cxs_set_tier`, `cxs_is_coach`, `is_coach`, `cxs_msgs_left`, `messages_guard`, `cxs_notify_member_on_reply`), 40 par tout connecté, 2 extensions dans `public`, `cxs_migration.num` sans `search_path`, protection des mots de passe compromis désactivée. 7 tables avec RLS sans politique (`app_private`, `app_private_log`, `backup_oe_20261019`, `coaches`, `gx_events`, `gx_member`, `gx_reactions`) : fermées à tous, ce qui est le comportement voulu pour des tables internes, à documenter.
- **D8 non respectée dans les droits** : `cxs_member_data`, `cxs_profiles`, `nutri_daily`, `cxs_messages`, `cxs_live_sessions` sont lisibles par le coach pour **tous** les comptes. Sans impact aujourd'hui (15 invités, 0 abonné autonome), à corriger avant le premier abonné payant.
- `cxs_messages` : la politique « marquer lu » laisse un membre modifier n'importe quelle colonne de ses messages (y compris le texte d'une réponse du coach).
- Toutes les fonctions Edge sauf trois ont la vérification du jeton désactivée à l'entrée (elles vérifient elles-mêmes) : à relire une par une quand leur code sera dans le dépôt.
- 128 usages de `innerHTML` dans `js/`, une fonction d'échappement `esc` existe ; revue complète à faire en phase 1.
- Le stockage `media` est privé, avec accès par dossier client. Bucket `cpta-receipts` privé.

## 6. Inventaire des doublons de données (phase 0e)

### 6.1 Où en est la bascule (comptages)

| Mesure | Valeur |
|---|---|
| Anciens clients (`clients`) | 16, aucun archivé, aucun sans e-mail, aucun e-mail en double |
| Comptes de la nouvelle app (`cxs_profiles`) | 16 (15 Invité, 1 coach) |
| Anciens clients retrouvés dans la nouvelle app par e-mail | 10 |
| Anciens clients sans compte dans la nouvelle app | 6 (tous ont un identifiant de connexion ; 4 ont un carnet, 3 des messages) |
| Comptes de la nouvelle app sans fiche d'ancien client | 6 |
| Dossiers de la nouvelle app qui portent l'ancien programme (`tbRaw`) | 15 ; ancien plan alimentaire (`tbNutri`) : 13 |
| Séances : ancien carnet / nouvel historique importé | 98 séances (678 séries) / 103 entrées |
| Jours de repas : ancien / nouveau | 117 / 139 |
| Mesures : ancien / nouveau | 29 / 39 |
| Bilans hebdomadaires : ancien `suivi` / nouveau `checkins` | 18 / 1 → **non migrés** |
| Messages | 155 dans l'ancienne table `messages` (dernier le 9/11), 2 dans `cxs_messages` → **la nouvelle app écrit encore dans l'ancienne table** |
| Dernière écriture dans l'ancien carnet / l'ancien journal alimentaire | 27/10 / 28/10 |
| Abonnements (`subs`) | 2 lignes (1 essai Stripe en cours, 1 sans accès) |
| Anciens clients dont le « coach » est eux-mêmes (inscrits en autonomie) | 2 ; 3 valeurs distinctes de `coach_id` |

Les comptages montrent que l'import a eu lieu ; ils ne prouvent pas qu'il est complet membre par membre. La réconciliation fine (par membre, avec sommes de contrôle) est à faire en phase 2.2.

### 6.2 Correspondance colonne par colonne

| Ancien | Nouveau | État | Cas limites |
|---|---|---|---|
| `clients.id, email, name` | `cxs_profiles.id (= compte), email, name` | Rattachement par e-mail | 6 clients sans profil : créer le profil à la première connexion ; ne jamais créer de compte à leur place |
| `clients.coach_id` | Pas d'équivalent (un seul coach, `is_coach`) | À décider | 2 inscrits « en autonomie » : ce sont les futurs abonnés autonomes au sens de D8 |
| `clients.program` (`sessions, phases, params, overload, refs, tracked, customEx, plan, profile, readj, diag, inter, bank110, gen88`) | `cxs_member_data.data.tbRaw` puis `customPrograms` via `js/tbconvert.js` | Fait pour 15, converti à l'affichage | `overload`, `refs`, `readj`, `tracked` (surcharge par phase, références, réajustements de 1RM) ne sont pas repris par le convertisseur |
| `clients.nutrition` (`tgt, types, week, prof, model, supp, cardio, steps, notes, active`) | `data.tbNutri` ; cible : `cxs_coach_food_plans.plan` | Copié pour 13, table cible vide | `supp`, `cardio`, `steps`, `notes` à faire correspondre |
| `carnet (client_id, k, data)` clés `S_s_e` (séries : `sets[{g,h,r,d}]`) | `data.workouts[]` / `data.history[]` / `data.lifts` | Importé (103) | Autres formes de clé : `S_o_N` (hors programme, 103), `S_t_N` (74), `S_d_N` (déplacements, 48), `S_h_N`, `S_n_N` (notes), `nu_*` (favoris, plans, prix), `pp` : à faire correspondre une par une |
| `nutri_log (client_id, d, data{m,x,act,steps,c,cy,ph,pk,pre,r,t})` | `data.food[date]`, `data.daily[date]` (pas, cardio), `nutri_daily` (totaux) | Importé (139 jours) | `ph`, `pk` (photos de repas) : fichiers du bucket `media` à relier |
| `mesures (client_id, d, data{poids, taille, hanches, poitrine, bras_d/g, avbras_d/g, cuisse_d/g, mollet_d/g, cou, epaules, mg, ph})` | `data.measures[] {d, weight, waistNav, hips, chest, …}` | Importé (39) | `ph` (photos) ; vérifier chaque membre gauche/droite |
| `suivi (client_id, w, data{poids, sommeil, stress, motiv, courb, douleur, hard, win, q, q5, msg, reply, sent})` | `data.checkins[] {d, week, weight, energy, sleepH, stress, mood, win, …}` | **À migrer** | `w` est un numéro de semaine de cycle : à convertir en date avec le début du cycle ; `reply` (réponse du coach) n'a pas de champ cible |
| `messages (client_id, sender, from_coach, body, media, audio_path, reply_to, edited_at, reactions, ref)` | `cxs_messages (user_id, sender, body, audio_path, reactions, read_at)` | **À migrer**, et la nouvelle app doit cesser d'écrire dans l'ancienne | `cxs_messages` n'a ni `media`, ni `reply_to`, ni `edited_at`, ni `ref` : colonnes à ajouter avant la copie. 16 messages avec pièce jointe, 1 vocal. Les fichiers sont rangés par `client_id` dans le stockage |
| `onboarding (client_id, data)` | `cxs_profiles.onboarding` | À vérifier membre par membre | Questions différentes entre les deux apps |
| `coach_notes` (10) | `cxs_coach_store` (clé-valeur) | **À migrer** | Notes épinglées |
| `cycles` (1), `prog_hist` (26) | Pas d'équivalent ; `prog_hist` est la base prévue pour l'historique de la phase 4.4 | À porter | — |
| `video_lib` (0), `leads` (0), `cgv_accept` (0), `biz_contracts` (0), `biz_payments` (0) | — | Vides : rien à migrer, structure à reprendre si la fonction est gardée | L'acceptation des CGV n'a jamais été enregistrée |
| `push_subs` (12, 11 personnes), `push_prefs` (14) | Mêmes tables, utilisées par les deux apps | À conserver telles quelles | Ne pas renommer : les notifications existantes en dépendent |
| `subs` | `cxs_profiles.tier, tier_until` | Deux systèmes de droits en parallèle | Voir § 8 |
| `gx_member` (3), `gx_events` (9), `gx_reactions` (4) | Rien dans la nouvelle app | Base de la phase 8.6 | Rattachées à `client_id` |
| `nutri_foods` (690), `nutri_dishes` (73) | Fichiers `data/*.json` embarqués + recettes | Pas un doublon strict | Aliments ajoutés à la main par le coach à conserver |

### 6.3 Comptabilité : `compta_*` ↔ `cpta_*`

| Ancien | Nouveau | Constat |
|---|---|---|
| `compta_tx` (246, dernière écriture le 14/10) | `cpta_tx` (314, un seul foyer, dernière le 9/11) | 153 lignes de l'ancien se retrouvent à l'identique (date, montant, libellé) ; **93 ne se retrouvent pas** par cette comparaison |
| `compta_accounts` (4) | `cpta_accounts` (6) + `foyer_id`, `opening_date` | Même forme, plus le foyer |
| `compta_members` (1) | `cpta_members` (2) + `foyer_id` | Idem |
| `compta_settings` (1) | `cpta_settings` (2) + `persons` | Idem |
| — | `cpta_foyers` (2), `cpta_recurring` (39), `cpta_items` (0) | Nouveautés |

Les 93 lignes non retrouvées peuvent avoir été corrigées après copie (libellé ou montant modifié) ou ne jamais avoir été copiées : à trancher par une comparaison plus fine, sans lire les libellés à l'écran. Le code de l'app de comptabilité n'est pas dans ce dépôt (question Q8).

## 7. Parité avec l'ancienne app (phase 0d)

Méthode : titres d'écran et appels serveur de `coach/index.html` comparés aux routes de la nouvelle app. Ce n'est pas une lecture ligne à ligne du fichier de 1,4 Mo ; les détails fins de chaque écran restent à vérifier au moment du portage.

| Fonction de l'ancienne app | Nouvelle app | Proposition |
|---|---|---|
| Carnet de séance, records, simulateur de RM, e1RM | Couverte | — |
| Banque de programmes, créer mon programme | Couverte (et plus riche) | — |
| Surcharge progressive par phase, « mes principes », réajustements du 1RM, mouvements suivis, INOL par mouvement, verdict fatigue par semaine | Partielle (surcharge automatique, indice de difficulté) | Porter en phase 5.3 (calculateur) |
| Séries par muscle, volume par semaine, graphiques par exercice | Couverte (Volume, Statistiques) | — |
| Plan alimentaire, recettes, courses, budget, code-barres, repas à l'avance, repas en photo à compléter | Couverte, sauf « repas en photo à compléter » | Reprendre en phase 6.3 |
| Banque de plans alimentaires, « importer le plan proposé par Claude » | Partielle (modèles) / absente | Abandon de l'import manuel proposé (remplacé par le questionnaire 6.1) |
| Mesures, photos, avant/après, projection de poids | Couverte | — |
| Bilan de la semaine | Couverte (plus complète) | Migrer les 18 anciens bilans |
| Bilan de cycle, fins de cycle, récompenses de fin de cycle, archive de cycle | **Absente** | Porter en phase 5.1 (planification annuelle) |
| Messagerie : réponse à un message, modification, pièces jointes, vocaux, réactions | Partielle : vocaux et réactions oui ; réponse, modification et pièces jointes à vérifier | Porter (phase 2.1) |
| Quêtes de la semaine, niveaux « Athlète », classement | Couverte (quêtes, trophées) ; classement côté coach | — |
| Communauté (rejoindre, fil, réactions, records partagés) | **Absente** | Phase 8.6, après décision |
| Notifications push, rappels réglables | Infrastructure commune ; réglage des rappels à vérifier dans la nouvelle app | Porter si manquant |
| Compte : mot de passe, suppression, sauvegarde des données | Couverte | — |
| Acceptation des CGV enregistrée | **Absente** (et jamais utilisée : 0 ligne) | Porter : nécessaire avant de vendre (phase 3) |
| Coach : liste, fiche, programme, plan alimentaire, to-do par client, alertes | Couverte | — |
| Coach : notes par client avec historique et épinglage | Partielle (notes dans l'espace coach) | Porter + migrer les 10 notes |
| Coach : bibliothèque vidéo par exercice | Partielle (`video_url` par exercice) ; ancienne table vide | Garder le lien par exercice, abandonner l'ancienne table |
| Coach : business (contrats, échéances, factures numérotées, encaissement ponctuel, CA) | Partielle (tableau de bord Business) ; factures non vérifiées | Porter : obligation légale de facturation |
| Coach : « mes paiements » côté client | À vérifier | Porter avec les factures |
| Coach : abonnés, inscriptions publiques ouvertes ou fermées, configuration Stripe | Couverte (Abonnés) ; interrupteur d'inscriptions à vérifier | — |
| Coach : accès de secours au compte d'un client (`coach-access`) | **Absente** | Abandon proposé (question Q5) |
| Coach : demandes venues du site (`leads`) | Remplacé par `candidatures` | Abandon de `leads` proposé (0 ligne) |
| Coach : modèles de programme, historique des versions (`prog_hist`) | Partielle (bibliothèque) / absente | Phase 4.4 |
| Assistant IA du coach (`coach-ai`) | Non vérifié (pas de source) | À relire quand le code sera rapatrié |

## 8. Paiement : ce que la lecture montre (pour la phase 3)

- L'essai Stripe est déjà retiré **en production** ; le code du dépôt est aligné par cette PR (§ 4).
- La nouvelle app paie par liens de paiement Stripe ; le webhook met `cxs_profiles.tier = premium` et `tier_until` = fin de période. Deux points à vérifier en mode test avant de vendre, non vérifiés ici (Stripe non consulté) :
  1. les événements de renouvellement et de résiliation ne sont reconnus que si l'abonnement Stripe porte bien la marque « tb-my-coach » et l'identifiant du membre ; si le lien de paiement ne les transmet pas, un renouvellement peut ne pas prolonger l'accès ;
  2. si le membre paie avec un autre e-mail et sans identifiant, il paie sans obtenir l'accès (le webhook écrit seulement une erreur dans le journal).
- Deux systèmes de droits coexistent (`subs` pour l'ancienne app, `cxs_profiles.tier` pour la nouvelle). À fusionner en phase 2.
- `TRIAL_DAYS = 30` et `ALL_FREE = false` sont en place dans `js/config.js`. La décision D2 est appliquée dans l'app ; il reste des textes (B15) et les prix du coaching (790 € fondateur, 1 600 €) qui n'apparaissent nulle part dans l'app.

## 9. Audit de design (phase 0f)

### 9.1 Constat

| Critère | Constat |
|---|---|
| Hiérarchie | L'Accueil empile 14 blocs sur 3 800 px de haut (défi, bilan, reprise, feu, cycle, séance, quêtes, routine, progrès). La séance du jour, action principale, arrive en 6ᵉ position. La Nutrition fait 3 500 px avec trois niveaux d'onglets. |
| Cohérence des composants | 1 195 styles écrits directement dans le code JavaScript, donc non réutilisables. 14 rayons d'angle différents, 30 tailles de texte (dont 12,5 / 13 / 13,5 / 14 / 14,5 px), 49 couleurs en dur dans le code. |
| Typographie | La feuille de style demande la police Barlow, son en-tête parle de Figtree et de « CalXsthenos » : trace de l'ancien nom du projet. |
| Couleurs | La couleur principale s'appelle `--red` alors qu'elle est bleue ; les couleurs d'état (vert, orange, rouge) sont utilisées avec un texte la plupart du temps, à vérifier écran par écran (feux, pastilles de calendrier). |
| Espacements | Pas d'échelle : marges posées au cas par cas (`mt4`, `mt8`, `mt12` + valeurs en ligne). |
| États vides et d'erreur | Bons côté membre (« Réponds d'abord au questionnaire »). Côté coach : « –/100 », « NaN », « undefined ». Aucun état d'erreur réseau visible, aucune file d'attente hors ligne affichée. |
| Barre d'onglets | Flottante en bas d'écran (sur mes captures pleine page elle apparaît au milieu : c'est un effet de la capture, pas un bug). 6 onglets, libellés très petits. |
| Membre et coach | Mêmes cartes et mêmes boutons, mais l'éditeur de programme et le plan alimentaire du coach sont des écrans à part, plus denses, avec des flèches de 28 px. C'est le sujet de la phase 4. |
| Accessibilité | Voir B7, B8, B13. Contraste correct partout ailleurs en clair et en sombre (mesure automatique indicative). |
| Mouvement | Le réglage « réduire les animations » est pris en compte dans la feuille de style (2 règles), mais pas dans `js/fx.js` (animations lancées par le code) : à compléter en phase 8.2. |

### 9.2 Système de design proposé

Principe : garder l'identité actuelle (bleu, verre dépoli, cartes arrondies), mais la réduire à peu de valeurs nommées, écrites une fois dans `css/app.css`.

| Jeton | Valeurs proposées |
|---|---|
| Couleurs de marque | `--brand` (ex-`--red`), `--brand-strong`, `--brand-tint`, `--brand-ink` |
| Surfaces | `--bg`, `--surface`, `--surface-raised`, `--line` |
| Texte | `--text`, `--text-soft`, `--text-on-brand` |
| États | `--ok`, `--warn`, `--danger`, chacun avec sa teinte de fond et toujours accompagné d'un mot ou d'une icône |
| Typographie | Une famille, 6 tailles : 12, 14, 16 (corps), 18, 22, 30 px ; 3 graisses : 400, 600, 800 |
| Espacements | Échelle 4, 8, 12, 16, 24, 32 px |
| Rayons | 8 (champ), 14 (bouton), 20 (carte), 999 (pastille) |
| Ombres | 2 niveaux en clair, aucune en sombre (bordure à la place) |
| Cibles tactiles | 44 px minimum, écrit dans les composants `.btn`, `.chip`, `.icon-btn`, `.field` |
| Mouvement | 120 ms (retour tactile), 240 ms (transition d'écran), courbe unique, tout coupé si « réduire les animations » |

### 9.3 Lot de corrections proposé

1. Jetons + renommage `--red` → `--brand` avec alias, sans changement visuel (S).
2. Composants de base avec cible de 44 px et libellé obligatoire pour les boutons icônes ; corrige B7, B8 (M).
3. Offres : débordement B4 (S).
4. Accueil : séance du jour en premier, blocs secondaires repliés, à valider avec toi sur maquette (M).
5. Remplacement progressif des styles en ligne, écran par écran, au fil des phases (L, étalé).

## 10. Suggestions (phase 0g)

| # | Idée | Bénéfice client | Bénéfice business | Effort | Risque | Priorité |
|---|---|---|---|---|---|---|
| S1 | Journal d'erreurs consultable (porte Q10) dès maintenant, sans donnée de santé | Bugs corrigés avant qu'il s'en plaigne | Moins de désabonnements silencieux | S | Faible | Haute |
| S2 | Tableau de bord « santé de l'app » pour toi : comptes actifs, essais en cours, fins d'essai à 7 jours, paiements échoués | — | Tu vois le chiffre d'affaires à venir | S | Faible | Haute |
| S3 | Rappel de fin d'essai à J-7, J-3, J-1 avec le bilan de ce qui a été accompli | Pas de coupure surprise | Conversion de l'essai | S | Faible, texte de vente à valider | Haute |
| S4 | Mode « semaine difficile » : un tap pour passer à un plancher (2 séances courtes, repas simples) sans casser la série | Tient dans les périodes chargées | Rétention | M | Faible | Haute |
| S5 | Export complet de ses données en un fichier (droit d'accès RGPD) | Confiance | Conformité | S | Faible | Haute |
| S6 | Résumé hebdomadaire par e-mail ou notification le dimanche soir (3 chiffres, 1 conseil) | Reste connecté sans ouvrir l'app | Réactivation | M | Envoi d'e-mails = consentement | Moyenne |
| S7 | Liste de courses partageable avec le foyer (lien ou texte) | Gain de temps réel | Bouche-à-oreille | S | Faible | Moyenne |
| S8 | « Refaire la semaine dernière » en nutrition : toute la semaine recopiée en un tap | Friction quasi nulle | Régularité, donc rétention | S | Faible | Haute |
| S9 | Page publique « Défi 30 jours » avec inscription directe | Comprend l'offre avant d'installer | Acquisition depuis Instagram | M | Texte de vente à valider | Moyenne |
| S10 | Pause d'abonnement d'un mois (vacances, blessure) au lieu de la résiliation | Souplesse | Moins de résiliations | M | Règles Stripe à tester | Moyenne |
| S11 | Mode blessure : déclarer une zone, l'app remplace les exercices concernés et rappelle de consulter | Continue malgré une gêne | Rétention | M | Prudence médicale | Moyenne |
| S12 | Bibliothèque de réponses types pour toi (messages fréquents, validés par toi) | Réponses plus rapides | Tu gagnes du temps par client | S | Faible | Moyenne |
| S13 | Bilan de fin de cycle de 12 semaines, partageable (reprend l'ancien « bilan de cycle ») | Voit son chemin | Témoignages, renouvellement du coaching | M | Faible | Haute |
| S14 | Widget ou raccourci d'écran d'accueil « noter mon poids / mon repas » | 1 tap | Régularité | M | Limité en web-app, mieux en natif | Basse |
| S15 | Journal des modifications visible (« Quoi de neuf ») après chaque mise à jour | Comprend les changements | Perçoit la valeur de l'abonnement | S | Faible | Basse |

## 11. Plan de travail en PR distinctes

Effort : S = moins d'une demi-journée, M = une à deux journées, L = plus.

| Ordre | PR | Contenu | Effort | Touche la production ? |
|---|---|---|---|---|
| 0.1 | Tests à jour | Les 5 suites E2E alignées sur « plus de formule gratuite » ; CI verte ; test automatique de la liste hors ligne | S | Non |
| 0.2 | Dépôt = production | `billing` aligné (fait dans cette PR) ; reste : code des 7 fonctions sans source et instantané du schéma | S | Non (lecture) |
| 6.6 | « Je craque » | Retrait du 3114, du mot « suicide » et de « prier » ; nouveau parcours | M | Non |
| 8.1 | Paliers et genre | B1, B3, B5 ; question de genre au profil | M | Non |
| 1.1 à 1.6 | Sécurité | Un fichier SQL par sujet : fonctions sans connexion ; fonctions des membres ; RLS et D8 ; extensions ; stockage ; XSS | L | Oui, point d'arrêt à chaque fichier |
| 2.1 | Portage | Messagerie complète, notes, CGV acceptées, factures, bilan de cycle | L | Non |
| 2.2 | Migration | Messages, bilans, notes, 6 clients restants ; réconciliation | L | Oui, point d'arrêt |
| 2.3 – 2.4 | Retrait de l'ancienne app | Redirection de `coach/`, archivage des tables | M | Oui, point d'arrêt |
| 3 | Facturation | Vérification de bout en bout en mode test ; textes ; B4, B10, B15 | M | Oui, point d'arrêt |
| 4 → 10 | Phases suivantes | Selon le cahier des charges | L chacune | Selon la phase |

## 12. Questions à trancher

**Q1. PR #3 (ancien correctif du harnais de test).**
A) La fermer et récupérer seulement son document juridique. B) La garder ouverte.
Recommandation : A, son correctif casserait une suite aujourd'hui verte.

**Q2. Les 6 anciens clients qui n'ont jamais ouvert la nouvelle app.**
A) Leur dossier est préparé et les attend à leur première connexion. B) On les considère partis et on archive leurs données sans les migrer.
Recommandation : A, aucun client ne doit perdre son historique.

**Q3. Les 2 personnes inscrites « en autonomie » dans l'ancienne app.**
A) Elles deviennent des abonnés autonomes (tu ne vois leurs données qu'avec leur accord). B) Elles restent Invitées, tu vois tout.
Recommandation : A si elles ne sont pas des proches, c'est la règle D8.

**Q4. « Corrections vidéo » dans les offres.**
A) Retirer toute mention de vidéo de technique des offres. B) Garder « corrections vidéo par Thomas » (c'est toi qui regardes, pas une analyse automatique).
Recommandation : A tant que la fonction n'existe pas dans l'app ; c'est un texte de vente, donc ta décision.

**Q5. Accès de secours du coach au compte d'un client (ancienne app).**
A) Abandonner. B) Porter.
Recommandation : A, se connecter à la place d'un client est difficile à justifier en matière de vie privée.

**Q6. Fichiers d'aliments hors ligne (5,5 Mo au total).**
A) Les télécharger en arrière-plan après la première ouverture. B) Les laisser se charger à la demande.
Recommandation : A, sinon la saisie de repas hors ligne ne tient pas la promesse.

**Q7. Accueil réorganisé (séance du jour en premier).**
A) Je te montre une maquette avant de coder. B) Je garde l'ordre actuel.
Recommandation : A.

**Q8. Comptabilité.**
A) Tu m'indiques où est le code de l'app de comptabilité pour que je l'ajoute à la session. B) On sort la comptabilité du périmètre et on se limite à archiver `compta_*` après vérification des 93 lignes.
Recommandation : B pour l'instant, la comptabilité n'apporte rien aux clients.

**Q9. Reprise du travail.**
A) J'enchaîne sur les PR sans production (0.1, 0.2, 6.6, 8.1) et je prépare la phase 1 en fichiers à relire. B) J'attends ton retour sur cet audit avant toute chose.
Recommandation : A, rien de tout cela ne touche la production ni Stripe.

## 13. Ce qui n'a pas été vérifié, et pourquoi

- Séance en cours, onboarding complet, séance en direct : non parcourus de bout en bout (§ 3).
- Vrai téléphone : aucun. iPhone et Android sont émulés dans Chromium, donc ni Safari ni les particularités d'iOS.
- Performance (2 secondes sur réseau mobile) et hors ligne : non mesurés à cette phase.
- Stripe : non consulté (consigne du 13/11).
- Alertes de performance de la base : non relues à cette phase.
- Parité : inventaire par titres d'écran et appels serveur, pas par lecture intégrale de l'ancienne app.
- Corps des 55 fonctions de la base : droits lus, corps non relus (phase 1).
- Contenu des 7 fonctions serveur sans source : non lu.
