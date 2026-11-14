# Sécurité, phase 1 — inventaire et fichiers SQL à relire

14 novembre 2026. **Rien n'a été appliqué en production.** Lecture de la structure uniquement (définition des fonctions, droits, politiques) ; aucune ligne de client lue. Les fichiers sont dans `supabase/migrations/2026-11-14_securite_*.sql`.

## 1. Ce qu'il faut retenir

1. **Un risque nouveau, plus sérieux que ceux connus** : le schéma `cxs_migration` contient 4 fonctions qui renvoient l'alimentation, l'historique de séances et les mesures d'un client à partir de son identifiant, **sans aucun contrôle**, avec le droit d'exécution donné à tout le monde, y compris sans connexion. Elles ont servi à la migration des données. Je n'ai pas pu vérifier depuis la base si ce schéma est exposé par l'API (ce réglage est dans le tableau de bord). S'il ne l'est pas, elles sont injoignables de l'extérieur ; s'il l'est, n'importe qui connaissant un identifiant de client peut lire ses données. Le fichier (a) leur retire tout droit dans les deux cas.
2. **Les autres fonctions sont mieux protégées que les alertes ne le laissaient croire** : presque toutes vérifient dans leur corps qui appelle (soi-même, son coach, ou « coach uniquement »). L'alerte Supabase signale seulement qu'elles sont *appelables*, pas qu'elles sont ouvertes.
3. **Une seule fonction exposée lisait l'information d'un autre compte** : `cxs_msgs_left` (nombre de messages restants). Corrigée dans le fichier (b).
4. Ces fichiers ne règlent **pas** deux sujets qui demandent ta décision (voir § 5) : la lecture par le coach de tous les dossiers (D8), et la modification possible du texte d'un message par son destinataire dans `cxs_messages`.

## 2. Inventaire des fonctions (60 SECURITY DEFINER et `cxs_migration.num`)

Méthode : droits lus dans le catalogue ; corps lus en entier pour 24 fonctions (les 6 sans connexion, toutes celles sans contrôle apparent, et les fonctions de lecture croisée). Pour les autres, le contrôle est constaté par la présence des appels de vérification dans le corps, **sans relecture ligne à ligne** : c'est indiqué « marqueurs ».

### 2.1 Appelables sans connexion (6)

| Fonction | Rôle | Classe | Contrôle dans le corps | Action |
|---|---|---|---|---|
| `is_coach()` | Dit si l'appelant est coach | Publique voulue | Ne parle que de l'appelant | Aucune (des politiques lisibles sans connexion l'évaluent) |
| `cxs_is_coach()` | Idem, nouvelle app | Publique voulue | Ne parle que de l'appelant | Aucune |
| `cxs_set_tier(target, tier, until)` | Change la formule d'un membre | Coach | Oui : « réservé au coach » | (a) retirée aux non-connectés |
| `cxs_msgs_left(uid)` | Messages restants | Membre | **Non** : valable pour n'importe quel compte | (a) retirée aux non-connectés, (b) contrôle ajouté |
| `messages_guard()` | Déclencheur : seul l'auteur modifie son message | Interne | Sans objet | (a) plus d'appel direct |
| `cxs_notify_member_on_reply()` | Déclencheur : notification de réponse | Interne | Sans objet | (a) plus d'appel direct |

### 2.2 Schéma `cxs_migration` (5 fonctions SECURITY DEFINER + `num`)

| Fonction | Droits actuels | Contrôle | Classe | Action |
|---|---|---|---|---|
| `food_for(client)`, `history_for(client)`, `measures_for(client)` | Tout le monde, même sans connexion | **Aucun** | Interne | (a) tous droits retirés, schéma fermé |
| `summary()` | Tout le monde | Aucun (agrégats) | Interne | (a) |
| `dry_run()` | Personne | — | Interne | (a) confirmé |
| `num(texte)` | — | Pas SECURITY DEFINER | Interne | (c) `search_path` figé |

### 2.3 Appelables par tout compte connecté (40, dont 4 déjà listées en 2.1)

| Fonction | Classe | Contrôle dans le corps | Action |
|---|---|---|---|
| `can_access`, `is_coach_of_client`, `is_client_of`, `my_email`, `cxs_my_client_id`, `gx_my_client` | Membre (aides des politiques) | Oui : ne répondent que pour l'appelant | Aucune |
| `me_info`, `my_payments`, `push_register`, `push_public_key`, `push_test` | Membre | Oui : appelant uniquement ; `push_test` limité à un essai par minute | Aucune |
| `client_activation`, `client_app_status`, `push_clients` | Coach | Oui : seulement les clients dont l'appelant est le coach | Aucune |
| `coach_subscribers`, `cxs_inbox`, `cxs_client_id_of` | Coach | Oui : « coach uniquement » | Aucune |
| `coach_set_plan`, `food_price_set` | Coach | Oui (marqueurs) | Aucune |
| `cycle_archive`, `msg_react`, `self_start`, `nutri_food_add` | Membre | Oui (marqueurs) | Aucune ; `self_start` et `nutri_food_add` **à trancher** (§ 5, Q3) |
| `gx_me`, `gx_join`, `gx_post_record`, `gx_react`, `gx_board`, `gx_feed` | Membre (communauté de l'ancienne app) | Oui : passent par le client de l'appelant | Aucune avant la phase 8.6 |
| `compta_claim`, `compta_coaching_payments`, `cpta_coaching_payments`, `cpta_create_foyer`, `cpta_session` | Comptabilité | Oui : appartenance au foyer | **Non touchées** (§ 4) |
| `compta_private.cpta_role`, `is_member`, `is_owner`, `member_role` | Comptabilité (aides des politiques) | Oui | **Non touchées** |

### 2.4 Déjà fermées à l'API (12) — rien à faire

`cxs_profiles_guard`, `leads_push`, `messages_push_trg`, `subs_owner_sync` (déclencheurs) ; `gx_calc`, `gx_coach_of`, `gx_sync`, `push_fire`, `push_targets`, `purge_fire`, `media_videos_a_purger`, `rls_auto_enable` (internes).

## 3. Les fichiers

| Fichier | Ce qu'il fait | Effet pour un membre | Risque |
|---|---|---|---|
| (a) `…_a_fonctions_internes.sql` | Retire les droits d'appel direct : schéma `cxs_migration`, 2 déclencheurs, `cxs_set_tier` et `cxs_msgs_left` sans connexion | Aucun | Faible. L'app n'appelle aucune de ces fonctions sans connexion |
| (b) `…_b_controle_de_role.sql` | `cxs_msgs_left` : soi-même ou le coach | Aucun | Faible. Même signature, même résultat pour l'appelant |
| (c) `…_c_search_path.sql` | Fige le `search_path` de `cxs_migration.num` | Aucun | Nul |
| (d) `…_d_extensions.sql` | Déplace `pg_walinspect` hors de `public` ; `pg_net` laissé en commentaire | Aucun | Faible pour `pg_walinspect` ; `pg_net` à décider (Q2) |
| (e) `…_e_rls.sql` | 23 politiques : `auth.uid()` évalué une fois par requête ; intention écrite sur les 7 tables sans politique | Aucun (mêmes règles) | Faible. Le bloc ne change que la forme du texte |

Chaque fichier porte en commentaire son retour arrière et ses tests « un non-autorisé échoue » / « un autorisé réussit », à exécuter sur une branche Supabase dans une transaction annulée.

## 4. Non touché, comme demandé

- **Comptabilité** : tables `compta_*` et `cpta_*`, leurs 5 fonctions publiques, les 4 fonctions de `compta_private`, le bucket `cpta-receipts` et leurs politiques. Aucune ligne de ces fichiers ne les modifie.
- **Remise à zéro** : aucune fonction de remise à zéro n'existe en base ; celle de l'app (« Effacer toutes tes données ») agit sur le téléphone et n'est pas concernée.
- **Stockage** : les 3 politiques du bucket `media` appellent aussi `auth.uid()` à chaque ligne ; laissées telles quelles (le schéma `storage` appartient à Supabase, à traiter avec un test dédié).

## 5. Questions pour Thomas

**Q1. Lecture par le coach de tous les dossiers (décision D8).** Aujourd'hui, le coach lit `cxs_member_data`, `cxs_profiles`, `nutri_daily`, `cxs_messages` et `cxs_live_sessions` de **tous** les comptes. Sans effet aujourd'hui (15 invités, aucun abonné autonome), mais à corriger avant le premier abonné payant.
A) Je prépare maintenant la règle « le coach ne lit que les coachés et les abonnés qui ont consenti » (nouvelle colonne de consentement, texte à valider).
B) On attend la phase 9.2, où le consentement des abonnés est défini.
Recommandation : A pour la règle technique, le texte du consentement restant un point d'arrêt séparé.

**Q2. Extension `pg_net`.** La sortir de `public` oblige à la supprimer puis la recréer : quelques secondes sans notifications push.
A) La laisser (l'alerte reste, le risque réel est faible).
B) La déplacer à une heure creuse.
Recommandation : A.

**Q3. `self_start` et `nutri_food_add` (ancienne app).** La première crée une fiche client « en autonomie », la seconde ajoute un aliment à la base commune. Toutes deux contrôlent l'appelant, mais restent ouvertes à tout compte connecté.
A) Les laisser jusqu'au retrait de l'ancienne app (phase 2).
B) Les fermer dès maintenant.
Recommandation : A, les fermer casserait l'ancienne app encore en ligne.

**Q4. Messages de la nouvelle app (`cxs_messages`).** La politique « marquer lu » laisse le destinataire modifier toutes les colonnes d'un message, y compris son texte. L'ancienne table a un garde-fou (`messages_guard`), pas la nouvelle. Seulement 2 messages y vivent aujourd'hui.
A) J'ajoute le même garde-fou dans un fichier (f).
B) On le traite avec la migration de la messagerie (phase 2).
Recommandation : A.

## 6. Risques restants après ces fichiers

- Exposition du schéma `cxs_migration` par l'API : à vérifier par Thomas dans le tableau de bord (Settings → API → Exposed schemas). Si `cxs_migration` y figure, le retirer.
- Protection contre les mots de passe compromis : toujours désactivée (réglage du tableau de bord, Authentication → Passwords).
- D8 (Q1) et `cxs_messages` (Q4) : ouverts.
- Sept fonctions serveur (Edge Functions) n'ont pas de code dans le dépôt : non relues.
- Les 128 usages de `innerHTML` de l'app : revue XSS non faite à cette étape.
- 14 fonctions dont le contrôle est constaté par marqueurs, sans relecture ligne à ligne.

## 7. Prochaine étape

Tester les cinq fichiers sur une **branche Supabase** (copie de la structure, sans données réelles) avec les personas fictifs, puis te présenter chaque fichier avec son résultat. L'application en production reste un point d'arrêt : ton « go », fichier par fichier.

## 8. Réponses de Thomas (14/11/2026) et fichiers (f) et (g)

Q1 : préparer la règle maintenant. Q2 : laisser `pg_net`. Q3 : laisser `self_start` et `nutri_food_add` jusqu'au retrait de l'ancienne app. Q4 : ajouter le garde-fou maintenant.

| Fichier | Ce qu'il fait | Effet |
|---|---|---|
| (f) `…_f_coach_lecture.sql` | Le coach ne lit le dossier (`cxs_member_data`, `nutri_daily`, `cxs_live_sessions`) que des comptes coachés ou Invités, des fiches de l'ancienne app dont il est le coach, et des personnes qui ont consenti (`cxs_profiles.consent_suivi`, faux par défaut) | Voir « conséquences » ci-dessous |
| (g) `…_g_messages.sql` | Sur `cxs_messages`, seul l'auteur modifie le texte, le vocal, l'auteur, le fil et la date ; marquer lu et réagir restent permis au destinataire | Aucun pour un usage normal |

**Écart assumé avec la demande** : `cxs_profiles` et `cxs_messages` ne sont pas restreints. Le coach a besoin du nom, de l'e-mail et de la formule de chaque compte pour gérer les abonnés, et il est l'interlocuteur de chaque conversation. Limite : `cxs_profiles.onboarding` contient aussi les réponses du profil (âge, poids, objectif) ; les séparer du compte demande de déplacer ces colonnes, à faire avec la phase 9.2.

**Conséquences de (f) à connaître avant d'appliquer** :
- Les membres **en essai** ont la formule `free` en base (l'essai est compté sur le téléphone). Sans consentement, tu ne verras plus leur dossier : plus d'alerte « Qui décroche » ni de suivi du Défi 30 jours pour eux. C'est l'application stricte de D8.
- Tant que l'app ne propose pas la case de consentement (texte à valider, point d'arrêt R6), personne ne peut consentir : appliquer (f) avant cette case revient à masquer tous les comptes non coachés.
- Les 15 comptes Invité actuels restent visibles.

**À décider par Thomas** :
1. La liste des formules « coachées » : `essentiel`, `suivi`, `avance`, `invite`, `surmesure`. À confirmer.
2. Les membres en essai : masqués sans consentement (D8 strict, recommandé), ou visibles pendant l'essai (il faudrait alors l'écrire dans la politique de confidentialité).
3. Ordre d'application : (g) dès que possible ; (f) seulement quand la case de consentement existe dans l'app.

### Vérification ajoutée (14/11, lecture du catalogue de production)

- Le rôle `authenticated` a le droit de modifier `cxs_profiles` colonne par colonne (`created_at, email, id, is_coach, last_seen, name, onboarding, stats, tier, tier_until`). `consent_suivi` n'existe pas encore en production.
- La fonction de garde `cxs_profiles_guard` protège `id`, `is_coach`, `tier` et `tier_until`. Elle ne protège pas `consent_suivi`, ce qui est voulu.
- Ajouté dans (f) : `grant update (consent_suivi, consent_suivi_at) on public.cxs_profiles to authenticated`. Sans ce droit, la case de consentement échouerait en silence.
