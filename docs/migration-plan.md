# Phase 2 : plan de migration de l'ancienne app vers la nouvelle

**État : plan rédigé, rien exécuté.** Aucune requête n'a été lancée, aucune donnée client n'a été lue, aucune écriture n'a été faite (Supabase, production, Stripe).

Source unique : `docs/audit-phase0.md`, sections 6 et 11. Le code de l'app et le schéma réel n'ont pas été relus pour ce plan. Tout ce qui en dépend est marqué **[à vérifier]** et se contrôle en lecture seule, sur la structure et non sur le contenu, avant le point d'arrêt R1.

## 0. Principes

1. **Rien n'est supprimé ni modifié dans les anciennes tables.** La migration copie. L'archivage est une autre PR (2.3 – 2.4).
2. **Rattachement par e-mail normalisé** (`lower(trim(email))`), figé une fois dans une table de correspondance `mig.client_map (client_id, user_id, statut)`. Toutes les copies passent par elle.
3. **Rejouable sans doublon.** Chaque ligne copiée porte l'identifiant de sa ligne d'origine (`legacy_id`), et chaque copie est un « insérer si absent ».
4. **Ne jamais écraser une donnée saisie dans la nouvelle app.** Si la cible existe déjà, elle gagne ; l'ancienne valeur est rangée à côté.
5. **Rien n'est perdu faute de champ cible.** Tout champ sans équivalent est conservé tel quel sous `cxs_member_data.data.tbLegacy`, par table d'origine.
6. **Tout ce qui ne passe pas va en quarantaine** (`mig.rejets : table, legacy_id, motif`), jamais à la poubelle. La réconciliation exige que copiés + en attente + rejetés = total d'origine.
7. **Ordre** : sauvegarde → R1 → colonnes ajoutées → table de correspondance → copies → réconciliation → correctif d'écriture → passe de rattrapage → réconciliation finale.

## 1. Correspondance table par table

Cas limites communs à toutes les tables rattachées à `client_id` :

| Cas | Règle |
|---|---|
| E-mail manquant | Aucun aujourd'hui (audit § 6.1), recompté au moment T. Si un cas apparaît : statut `sans_email`, rien n'est copié, Thomas tranche à la main. |
| E-mail en double | Aucun aujourd'hui. Si un cas apparaît : arrêt de la migration pour ces fiches, aucune fusion automatique. |
| E-mail changé entre les deux apps | Le rattachement automatique échoue : la fiche tombe dans les « sans compte ». Thomas peut déclarer la paire à la main dans `mig.client_map` (statut `manuel`). |
| Client sans compte (6) | Statut `en_attente`, voir § 2. |
| Compte sans ancienne fiche (6) | Rien à migrer. Exclus des contrôles d'orphelins côté ancien. |
| Date au format ancien | Les dates en texte (`d`) sont converties en `AAAA-MM-JJ`, fuseau Europe/Paris. Une date illisible envoie la ligne en quarantaine. **[à vérifier : type réel de `d`]** |

| Ancienne table | Cible | Règle | Cas limites propres |
|---|---|---|---|
| `clients` (16) | `cxs_profiles` (identité), `cxs_member_data.data.tbRaw` (programme), `data.tbNutri` puis `cxs_coach_food_plans.plan` (nutrition) | Identité : rattachement seul, aucun champ écrasé. Programme : déjà copié pour 15, conversion à l'affichage. Nutrition : copiée pour 13, à verser dans `cxs_coach_food_plans`. | `coach_id` n'a pas d'équivalent ; les 2 inscrits « en autonomie » sont les futurs abonnés autonomes (D8). `overload`, `refs`, `readj`, `tracked` ne sont pas convertis : restent lisibles dans `tbRaw`. `supp`, `cardio`, `steps`, `notes` de la nutrition : sans cible connue, restent dans `tbNutri`. **Écart à expliquer : 15 dossiers portent `tbRaw` alors que 10 clients seulement sont retrouvés par e-mail.** |
| `carnet` (98 séances, 678 séries) | `data.workouts[]`, `data.history[]`, `data.lifts` | Clés `S_s_e` : déjà importées (103 entrées), à réconcilier membre par membre. Séries `sets[{g,h,r,d}]` reprises telles quelles. | Clés `S_o_N` (hors programme) → séance marquée hors programme. `S_n_N` → note de la séance. `S_d_N`, `S_t_N`, `S_h_N`, `pp`, `nu_*` : sens à confirmer sur la structure seule ; d'ici là, copie brute dans `tbLegacy.carnet[k]`. 98 anciennes contre 103 nouvelles : l'écart doit s'expliquer par des séances saisies depuis, pas par des doublons. |
| `suivi` (18) | `data.checkins[]` | Voir § 3. | Voir § 3. |
| `nutri_log` (117 jours) | `data.food[date]`, `data.daily[date]`, `nutri_daily` | Déjà importé (139 jours). Un jour présent des deux côtés : la nouvelle app gagne. | `ph`, `pk` : photos du bucket `media`, chemins à relier (même règle que les pièces jointes, § 4.2). |
| `mesures` (29) | `data.measures[]` | Déjà importé (39). `poids→weight`, `taille→waistNav`, `hanches→hips`, `poitrine→chest`. | Membres gauche/droite (`bras_d/g`, `avbras_d/g`, `cuisse_d/g`, `mollet_d/g`) à contrôler un par un. `cou`, `epaules`, `mg` : cible **[à vérifier]**. `ph` : photos, comme ci-dessus. |
| `messages` (155) | `cxs_messages` | Voir § 4. | Voir § 4. |
| `coach_notes` (10) | `cxs_coach_store` (clé-valeur) | Une clé par membre, `tb_notes:<user_id>`, valeur = liste des notes avec `legacy_id`, date, texte, `pinned`. | Note d'un client sans compte : reste dans l'ancienne table jusqu'au rattachement. Note sans client : clé `tb_notes:_general`. Forme réelle de `cxs_coach_store` **[à vérifier]**. |
| `prog_hist` (26) | Pas d'équivalent aujourd'hui | Ne rien transformer. Copie à l'identique dans une table neuve `cxs_program_history (user_id, legacy_id, created_at, data)`, base de la phase 4.4. | Ligne d'un client sans compte : en attente. La table `cycles` (1 ligne) suit la même règle. |
| `onboarding` | `cxs_profiles.onboarding` | Les questions diffèrent : aucune conversion champ à champ. L'ancienne réponse est rangée sous `onboarding.tb`. | Si le membre a déjà rempli le nouvel onboarding, il est conservé intact et l'ancien s'ajoute seulement sous `tb`. |

Hors périmètre de cette migration, d'après l'audit : `push_subs` et `push_prefs` (à garder telles quelles), `subs` (phase 3), `gx_*` (phase 8.6), `nutri_foods` et `nutri_dishes`, les tables vides, la comptabilité.

## 2. Les six clients sans compte

**Règle absolue : aucun compte et aucun profil n'est créé à leur place.** Ni insertion dans `cxs_profiles`, ni invitation envoyée par un script, ni mot de passe défini pour eux.

1. Ils reçoivent le statut `en_attente` dans `mig.client_map` (`user_id` vide).
2. Leurs données (4 ont un carnet, 3 des messages) **restent dans les anciennes tables**, intactes. Rien n'est copié vers des lignes `cxs_*` sans propriétaire : c'est ce qui garantit zéro orphelin.
3. Les anciennes tables ne sont pas archivées tant qu'il reste un client `en_attente` (condition d'entrée de la PR 2.3 – 2.4).
4. À leur première connexion à la nouvelle app, le profil est créé par le parcours normal, par eux. Le rattachement se fait ensuite avec la même procédure que pour les dix autres, rejouée pour ce seul client : e-mail identique → `user_id` renseigné → copies → réconciliation de ce membre.
5. Le déclenchement du rattachement est une décision (voir § 7) : lancé à la main par Thomas après chaque inscription (recommandé : six cas, contrôle humain), ou automatique à la création du profil.
6. Prévenir ces six personnes est une action de Thomas, avec son message et son canal. Aucun envoi n'est fait par la migration.
7. Si un client ne revient jamais : ses données sont exportées dans la sauvegarde puis archivées avec les anciennes tables, à la date limite que Thomas fixe.

À vérifier avant R1, sans lire de contenu : ces six clients ont un identifiant de connexion. S'il s'agit du même identifiant que celui de la nouvelle app, il suffit qu'ils se connectent ; sinon ils devront s'inscrire avec le même e-mail.

## 3. Les 18 bilans de `suivi`

### 3.1 Conversion de la semaine de cycle en date

`suivi.w` est un numéro de semaine dans le cycle, pas une date. Règle, par ordre de préférence :

1. **Date d'envoi** : si `data.sent` contient une date, c'est la date du bilan (`d`). C'est la seule trace directe du jour réel. **[à vérifier : `sent` est une date ou un simple oui/non]**
2. **Calcul** : sinon `d = début du cycle + (w − 1) × 7 jours`, ramené au jour de bilan habituel. **[à vérifier : `w` commence à 1 ou à 0, et où se trouve le début du cycle]**. La table `cycles` n'a qu'une ligne ; le début de cycle des autres clients est probablement dans `clients.program` (`phases` ou `params`).
3. **Ni l'un ni l'autre** : le bilan va en quarantaine avec le motif `date_inconnue`. Aucune date n'est inventée.

Dans tous les cas, `week = w` est conservé tel quel, et l'entrée porte `dateSource: "sent" | "cycle"` pour qu'une date calculée reste reconnaissable.

### 3.2 Champs

Cible : `cxs_member_data.data.checkins[]`.

| Ancien (`suivi.data`) | Nouveau | Remarque |
|---|---|---|
| `w` | `week` | Inchangé |
| (calculé) | `d` | § 3.1 |
| `poids` | `weight` | Virgule décimale à convertir en point |
| `sommeil` | Pas `sleepH` | Vérifié : valeurs de 2 à 5, c'est une note et non des heures. Conservé sous `legacy.sommeil`, jamais versé dans un champ en heures |
| `stress` | `stress` | Échelle à comparer |
| `motiv` | `mood` | Rapprochement approximatif (motivation ≠ humeur) : décision § 7 |
| `win` | `win` | Inchangé |
| `courb`, `douleur`, `hard`, `q`, `q5`, `msg` | Pas de champ connu | Conservés sous `legacy` dans l'entrée du bilan |
| `reply` (réponse du coach) | **Aucun champ cible** | Recommandation : champ `coachReply` dans l'entrée du bilan. Alternative : un message dans `cxs_messages`. Décision § 7 |
| — | `energy` | Absent de l'ancien : laissé vide, jamais déduit |

Cas limites : le bilan déjà présent dans la nouvelle app est conservé ; un ancien bilan du même membre et de la même semaine ne le remplace pas (il va dans `tbLegacy.suivi`). Chaque entrée copiée porte `legacy_id` et `src: "tb"`. Les bilans des clients `en_attente` ne sont pas copiés.

## 4. Les messages

### 4.1 Colonnes à ajouter à `cxs_messages` avant toute copie

Ajouts seuls, sans valeur par défaut contraignante : sans effet sur l'app en service.

| Colonne | Type proposé | Rôle |
|---|---|---|
| `media` | `jsonb` | Pièces jointes (16 messages) |
| `reply_to` | `bigint`, référence `cxs_messages(id)`, `on delete set null` (vérifié : `cxs_messages.id` est un `int8`, l'ancien `reply_to` un `uuid`, d'où la traduction en deux passes) | Réponse à un message |
| `edited_at` | `timestamptz` | Message modifié |
| `ref` | `text` (vérifié) | Renvoi vers un élément de l'app |
| `legacy_id` | `uuid` (vérifié), index unique partiel (`where legacy_id is not null`) | Copie rejouable sans doublon |

Règles de copie :

- `client_id → user_id` par `mig.client_map`. Messages des clients `en_attente` : non copiés (§ 2).
- `sender` : repris tel quel. Vérifié : c'est des deux côtés l'identifiant de compte de l'expéditeur (les 55 messages du coach portent l'identifiant du profil coach, les messages des clients rattachés portent leur `user_id`). `from_coach` n'a donc pas besoin de colonne.
- `created_at` : repris de l'original, jamais la date de la copie (colonne présente des deux côtés, vérifié).
- `audio_path`, `reactions`, `edited_at`, `ref` : repris tels quels. `body` : obligatoire dans `cxs_messages` alors que 15 anciens messages n'ont pas de texte (pièce jointe seule) → copiés avec un texte vide.
- `reply_to` : copie en deux passes. Passe 1 sans `reply_to` ; passe 2, traduction de l'ancien identifiant vers le nouveau via `legacy_id`. Une réponse dont le message d'origine n'est pas copié : `reply_to` vide, signalé dans la réconciliation.
- `read_at` : l'ancienne table a sa propre colonne `read_at` (vérifié) : elle est reprise telle quelle. Seuls les messages restés non lus posent question : décision § 7.
- Les 2 messages déjà dans `cxs_messages` sont conservés et comparés aux anciens (même membre, même horodatage, même empreinte du texte) pour ne pas les doubler.

### 4.2 Pièces jointes et vocal

16 messages avec pièce jointe, 1 vocal. Les fichiers sont rangés par `client_id` dans le stockage.

1. **Copier, ne pas déplacer.** Les fichiers d'origine restent en place jusqu'à l'archivage.
2. Chaque fichier est copié sous le dossier du `user_id`, puis `media` et `audio_path` de la ligne copiée pointent vers la copie. Les règles d'accès au stockage (PR 1.5) restent ainsi fondées sur « le dossier porte mon identifiant », sans exception pour l'ancien rangement.
3. Vérifié : `client_id` et `user_id` diffèrent pour les 10 clients rattachés. La copie de fichiers concerne donc tout le monde. `media` est une liste d'objets `{path, type, dur}`.
4. Contrôle : pour chaque chemin cité, l'objet existe et a la même taille que l'original (§ 5, requête R7). Un fichier introuvable n'empêche pas de copier le message : la ligne est signalée.
5. La copie de fichiers passe par l'API de stockage, pas par SQL : c'est une écriture en production, donc après R1.

### 4.3 Corriger l'écriture encore faite dans l'ancienne table

Constat de l'audit : 155 messages dans `messages` (dernier le 9/11), 2 dans `cxs_messages`. La nouvelle app écrit donc encore dans l'ancienne table.

Séquence :

1. Ajouter les colonnes (§ 4.1).
2. Première copie de `messages` vers `cxs_messages`, puis réconciliation.
3. Livrer le correctif de code (PR 2.1) : la nouvelle app lit et écrit dans `cxs_messages` seulement, y compris envoi, modification, réaction, réponse, pièce jointe, vocal, marquage lu, abonnement temps réel et notifications. Recherche à faire dans le dépôt : toute occurrence de la table `messages` hors `cxs_messages`.
4. Noter l'heure T de mise en service du correctif.
5. Passe de rattrapage : copie des messages écrits entre la première copie et T (mêmes requêtes, `legacy_id` évite les doublons), et report des modifications et réactions faites entre-temps.
6. Preuve : plus aucune ligne créée ni modifiée dans `messages` après T (requête R8), relevée à T + 24 h et T + 7 jours.
7. L'ancienne app écrit elle aussi dans `messages`. Tant qu'elle reste ouverte aux clients, un message peut partir du mauvais côté : décider si elle passe en lecture seule à T (§ 7).

## 5. Réconciliation avant / après

**Requêtes écrites, non exécutées.** Elles ne lisent que des comptages et des empreintes ; aucune n'affiche un nom, un e-mail ou un texte. Elles reposent sur les noms de colonnes cités dans l'audit ; ceux marqués **[à vérifier]** (`id`, `created_at`, `cxs_member_data.user_id`) sont à confirmer sur le schéma avant le premier lancement. R0 à R2 et R8 tournent avant R1 (lecture seule). Chaque résultat est conservé daté, avant puis après.

```sql
-- CTE commune : correspondance par e-mail, sans table (utilisable avant R1).
-- Après R1, remplacer par mig.client_map.
with map as (
  select c.id as client_id, p.id as user_id
  from clients c
  left join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
)
select 1;
```

```sql
-- R0. État du rattachement. Attendu aujourd'hui : 16 / 10 / 6 / 0 / 0.
with map as (
  select c.id as client_id, c.email, p.id as user_id
  from clients c
  left join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
)
select count(*)                                              as clients,
       count(user_id)                                        as rattaches,
       count(*) filter (where user_id is null)               as en_attente,
       count(*) filter (where email is null or trim(email) = '') as sans_email,
       count(*) - count(distinct lower(trim(email)))         as emails_en_double
from map;
```

```sql
-- R1. Comptages par ancienne table, total et part rattachée. À relever avant et après.
with map as (
  select c.id as client_id, p.id as user_id
  from clients c
  left join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
)
select t.tbl, count(*) as lignes, count(m.user_id) as rattachees,
       count(*) filter (where m.client_id is null) as sans_client
from (
            select 'carnet' as tbl, client_id from carnet
  union all select 'suivi',       client_id from suivi
  union all select 'nutri_log',   client_id from nutri_log
  union all select 'mesures',     client_id from mesures
  union all select 'messages',    client_id from messages
  union all select 'coach_notes', client_id from coach_notes
  union all select 'prog_hist',   client_id from prog_hist
  union all select 'onboarding',  client_id from onboarding
) t
left join map m on m.client_id = t.client_id
group by t.tbl order by t.tbl;
-- sans_client doit valoir 0 partout : sinon l'ancienne base a déjà des orphelins.
```

```sql
-- R2. Comptages côté nouvelle app, par membre (identifiants seuls).
select d.user_id,
       jsonb_array_length(coalesce(d.data->'workouts', '[]'))  as seances,
       jsonb_array_length(coalesce(d.data->'history',  '[]'))  as historique,
       jsonb_array_length(coalesce(d.data->'measures', '[]'))  as mesures,
       jsonb_array_length(coalesce(d.data->'checkins', '[]'))  as bilans,
       (select count(*) from jsonb_object_keys(coalesce(d.data->'food', '{}'))) as jours_repas,
       (d.data ? 'tbRaw')   as a_programme,
       (d.data ? 'tbNutri') as a_nutrition,
       (select count(*) from cxs_messages m where m.user_id = d.user_id) as messages
from cxs_member_data d
order by d.user_id;
```

```sql
-- R3. Par membre, ancien contre nouveau. Après migration : nouveau >= ancien partout,
-- et égalité stricte pour messages et bilans migrés (voir R4, R5).
with map as (
  select c.id as client_id, p.id as user_id
  from clients c
  join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
)
select m.user_id,
  (select count(*) from carnet    x where x.client_id = m.client_id and x.k like 'S\_s\_%') as carnet_ancien,
  (select count(*) from nutri_log x where x.client_id = m.client_id) as repas_ancien,
  (select count(*) from mesures   x where x.client_id = m.client_id) as mesures_ancien,
  (select count(*) from suivi     x where x.client_id = m.client_id) as bilans_ancien,
  (select count(*) from messages  x where x.client_id = m.client_id) as messages_ancien,
  jsonb_array_length(coalesce(d.data->'history',  '[]'))  as carnet_nouveau,
  (select count(*) from jsonb_object_keys(coalesce(d.data->'food', '{}'))) as repas_nouveau,
  jsonb_array_length(coalesce(d.data->'measures', '[]'))  as mesures_nouveau,
  (select count(*) from jsonb_array_elements(coalesce(d.data->'checkins', '[]')) e
    where e->>'src' = 'tb')                                as bilans_migres,
  (select count(*) from cxs_messages x
    where x.user_id = m.user_id and x.legacy_id is not null) as messages_migres
from map m
left join cxs_member_data d on d.user_id = m.user_id
order by m.user_id;
```

```sql
-- R4. Messages : somme de contrôle. Les deux lignes doivent être identiques.
with map as (
  select c.id as client_id, p.id as user_id
  from clients c
  join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
)
select 'ancien' as cote, count(*) as n,
       md5(string_agg(md5(o.id::text || '|' || coalesce(o.body, '') || '|' || o.created_at::text),
                      '' order by o.id::text)) as empreinte
from messages o join map m on m.client_id = o.client_id
union all
select 'nouveau', count(*),
       md5(string_agg(md5(n.legacy_id::text || '|' || coalesce(n.body, '') || '|' || n.created_at::text),
                      '' order by n.legacy_id::text))
from cxs_messages n where n.legacy_id is not null;
```

```sql
-- R5. Bilans : nombre et somme des poids, ancien contre migré. Écart attendu : 0
-- (hors bilans en quarantaine, comptés à part dans mig.rejets).
with map as (
  select c.id as client_id, p.id as user_id
  from clients c
  join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
)
select 'ancien' as cote, count(*) as n,
       sum(replace(s.data->>'poids', ',', '.')::numeric) as somme_poids,
       sum(s.w) as somme_semaines
from suivi s join map m on m.client_id = s.client_id
union all
select 'nouveau', count(*), sum((e->>'weight')::numeric), sum((e->>'week')::int)
from cxs_member_data d,
     jsonb_array_elements(coalesce(d.data->'checkins', '[]')) e
where e->>'src' = 'tb';
```

```sql
-- R6. Zéro ligne orpheline. Chaque ligne doit renvoyer 0.
select 'cxs_messages sans profil' as controle, count(*) as n
  from cxs_messages m left join cxs_profiles p on p.id = m.user_id where p.id is null
union all
select 'cxs_member_data sans profil', count(*)
  from cxs_member_data d left join cxs_profiles p on p.id = d.user_id where p.id is null
union all
select 'cxs_program_history sans profil', count(*)
  from cxs_program_history h left join cxs_profiles p on p.id = h.user_id where p.id is null
union all
select 'reply_to vers un message absent', count(*)
  from cxs_messages m left join cxs_messages r on r.id = m.reply_to
  where m.reply_to is not null and r.id is null
union all
select 'legacy_id en double', count(*) - count(distinct legacy_id)
  from cxs_messages where legacy_id is not null
union all
select 'message ancien rattaché non copié', count(*)
  from messages o
  join clients c on c.id = o.client_id
  join cxs_profiles p on lower(trim(p.email)) = lower(trim(c.email))
  left join cxs_messages n on n.legacy_id = o.id
  where n.id is null
union all
select 'message copié sans original', count(*)
  from cxs_messages n left join messages o on o.id = n.legacy_id
  where n.legacy_id is not null and o.id is null;
```

```sql
-- R7. Pièces jointes et vocal : chaque chemin cité existe dans le stockage.
-- Attendu avant : 16 avec pièce jointe, 1 vocal. Attendu après : fichiers_absents = 0.
select count(*) filter (where n.media is not null)      as avec_piece_jointe,
       count(*) filter (where n.audio_path is not null) as vocaux,
       count(*) filter (where n.audio_path is not null and not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'media' and o.name = n.audio_path)) as vocaux_absents
from cxs_messages n where n.legacy_id is not null;
-- La forme exacte de media (liste de chemins ou d'objets) est à vérifier ;
-- le même contrôle s'écrit alors avec jsonb_array_elements sur media.
```

```sql
-- R8. Preuve que plus rien ne s'écrit dans l'ancienne table après T.
select count(*) filter (where created_at > :t) as crees_apres_t,
       count(*) filter (where edited_at  > :t) as modifies_apres_t,
       max(created_at)                         as dernier_message
from messages;
```

```sql
-- R9. Bilan comptable de la migration : copiés + en attente + rejetés = total.
select r.tbl, r.motif, count(*) from mig.rejets r group by r.tbl, r.motif order by 1, 2;
```

Critères de réussite : R0 conforme, R1 identique avant et après (les anciennes tables n'ont pas bougé, hors nouveaux messages avant T), R3 sans régression pour aucun membre, R4 et R5 identiques des deux côtés, R6 à zéro partout, R7 sans fichier absent, R8 à zéro, R9 expliqué ligne par ligne. Un seul critère en échec : on s'arrête, on ne corrige pas à la main en production.

## 6. Point d'arrêt R1 : avant toute écriture en production

**Rien de ce qui suit R1 ne démarre sans l'accord écrit de Thomas.** Avant R1 : lecture seule uniquement.

### 6.1 La sauvegarde exportée, à prendre d'abord

1. **Export complet de la base** (schéma et données) au format `pg_dump`, plus un export séparé des tables touchées : les neuf anciennes tables, `cycles`, `cxs_profiles`, `cxs_member_data`, `cxs_messages`, `cxs_coach_store`, `cxs_coach_food_plans`.
2. **Export des fichiers** du stockage concernés (bucket `media` : pièces jointes, vocal, photos), avec la liste des objets et leur taille.
3. **Hors de Supabase et hors du dépôt Git** : la sauvegarde contient des données de santé de clients. Stockage chiffré, à un endroit que Thomas choisit, jamais poussé sur GitHub.
4. **Empreinte et date** : somme SHA-256 de chaque fichier, heure de l'export, notées dans le compte rendu.
5. **Restauration essayée** : l'export est rechargé dans une base vide (ou une branche Supabase) et les requêtes R0 à R2 y donnent les mêmes chiffres qu'en production. Une sauvegarde qui n'a pas été restaurée ne compte pas.
6. La sauvegarde automatique de Supabase ne remplace pas cet export : elle ne se garde pas hors de la plateforme et ne se restaure pas table par table.

### 6.2 Liste de contrôle R1

- [ ] Sauvegarde prise, empreintes notées, restauration essayée (§ 6.1)
- [ ] Points **[à vérifier]** de ce plan levés sur le schéma, sans lecture de contenu
- [ ] R0, R1, R2, R8 exécutées en lecture seule, résultats « avant » archivés
- [ ] Écart 15 `tbRaw` / 10 rattachés expliqué
- [ ] Scripts de migration relus, joués en entier sur une copie (branche ou base restaurée), réconciliation verte sur la copie
- [ ] Retour arrière écrit : suppression des lignes où `legacy_id` n'est pas vide ou `src = "tb"`, retrait des colonnes ajoutées ; les anciennes tables n'ayant pas bougé, il n'y a rien d'autre à défaire
- [ ] Décisions du § 7 prises
- [ ] Créneau choisi (peu d'activité), sécurité 1.1 à 1.6 déjà en place
- [ ] **Accord écrit de Thomas**

Après R1, un arrêt à chaque étape : colonnes → correspondance → copies → réconciliation → correctif d'écriture → rattrapage → réconciliation finale.

## 7. Décisions à prendre par Thomas

| # | Question | Recommandation |
|---|---|---|
| M1 | Rattachement des six clients à leur première connexion : à la main ou automatique ? | À la main, six cas |
| M2 | Date limite après laquelle les données d'un client jamais revenu sont archivées | À fixer avant la PR 2.3 |
| M3 | Réponse du coach aux bilans (`reply`) : champ `coachReply` dans le bilan, ou message dans la messagerie ? | `coachReply` |
| M4 | `motiv` versé dans `mood`, ou gardé à part ? | Gardé à part si les échelles diffèrent |
| M5 | Anciens messages restés non lus : marqués lus à la copie ? | Oui |
| M6 | Ancienne app en lecture seule à l'heure T ? | Oui, pour la messagerie au minimum |
| M7 | `prog_hist` et `cycles` : nouvelle table `cxs_program_history` maintenant, ou attendre la phase 4.4 ? | Maintenant, copie à l'identique |
| M8 | `coach_id` et les 2 inscrits en autonomie : statut dans la nouvelle app (D8) | À trancher avec D8 |
| M9 | Répétition sur une branche Supabase (payante) ou sur une base restaurée en local ? | Base restaurée : elle sert aussi de preuve de restauration |
| M10 | Lieu de stockage de la sauvegarde | Hors Supabase, hors GitHub, chiffré |
| M11 | Cinq comptes de la nouvelle app portent le programme d'un client « sans compte » (§ 8) : sont-ce les mêmes personnes sous un autre e-mail ? | Thomas confirme chaque paire à la main ; aucune fusion automatique |
| M12 | Bilans sans date d'envoi et sans début de cycle (5 chez les rattachés) : date de dernière modification, date donnée par Thomas, ou quarantaine ? | Date de dernière modification, marquée `dateSource: "updated_at"` |

## 8. Vérifications faites en lecture seule (14/11)

Requêtes de structure et de comptage uniquement : types de colonnes, nombres de lignes, formes de valeurs. Aucun nom, e-mail ni texte affiché, aucune écriture.

| Point | Résultat | Conséquence |
|---|---|---|
| Identifiants | `clients.id` ≠ `cxs_profiles.id` pour les 10 rattachés | La table de correspondance est indispensable ; les fichiers sont à copier pour tous |
| Les 6 clients « sans compte » | Tous ont un compte de connexion au même e-mail, mais pas de profil | Il leur suffit de se connecter à la nouvelle app ; rien à créer |
| **15 `tbRaw` pour 10 rattachés** | Les 5 autres sont sur des comptes sans ancienne fiche, et chacun porte un programme identique à celui d'un client « en attente » (une correspondance est faible : programme vide) ; 2 ont aussi le même nom | **Plusieurs des 6 « sans compte » ont probablement déjà un compte sous un autre e-mail.** Décision M11 avant toute copie ; le § 2 ne s'applique qu'à ceux qui restent |
| Dates (`d`) de `nutri_log` et `mesures` | Type `date` | Pas de format ancien à convertir |
| `suivi.data.sent` | Horodatage ISO pour 12 bilans sur 18, absent pour 6 | Règle 1 du § 3.1 pour 12 |
| Début de cycle | Aucun client ayant des bilans n'a de ligne dans `cycles` ; `program.params` ne le porte pas | La règle 2 du § 3.1 est inapplicable aujourd'hui : décision M12 (`suivi.updated_at` existe) |
| `suivi.w` | De 1 à 10 | Commence à 1 |
| Bilans | 16 chez les rattachés (5 sans date d'envoi), 2 chez les clients en attente | 16 à copier, 2 en attente |
| Messages | 134 chez les rattachés, 21 chez les clients en attente ; 16 avec pièce jointe ; 5 avec `ref` ; aucune réponse, aucun message modifié | `reply_to` et `edited_at` restent à ajouter pour la parité, mais rien à traduire à la copie |
| `coach_notes` | 10, toutes sur des clients rattachés ; colonnes `body`, `pinned`, `created_at` | Aucune note en attente |
| `prog_hist` | 4 lignes sur 26 chez les clients en attente ; colonnes `program`, `hash`, `source`, `saved_at`, `created_by` | À reprendre telles quelles dans la table cible |
| `cxs_coach_store` | `key text`, `value jsonb` | La clé `tb_notes:<user_id>` convient |
| `cxs_member_data` | Une ligne par `user_id`, aucune sans profil | R2, R3 et R6 valables telles qu'écrites |

Restent à vérifier avant R1 : le sens des clés `S_d_N`, `S_t_N`, `S_h_N` et `pp` du carnet, la cible de `cou`, `epaules`, `mg`, et les échelles de `stress` et `motiv`. Ces points demandent de lire le code de l'app, exclu de cette étape.

## 9. Vérifications dans le code et sur les valeurs (lecture seule, 14/11)

Recherche dans `js/` (aucun fichier de données lu) et agrégats min/max sur les anciennes valeurs (aucun contenu affiché).

| Point | Résultat | Conséquence |
|---|---|---|
| Clés du carnet `S_d_N`, `S_t_N`, `S_h_N`, `nu_*`, `pp` | Aucune construction de ces clés dans le code actuel | Ce sont des restes de l'ancienne app : copie brute dans `tbLegacy.carnet[k]`, aucun mapping |
| `suivi.sommeil` (valeurs 2 à 5, 7 bilans) | Le nouveau bilan a `sleepQ` (qualité 1 à 5) à côté de `sleepH` (heures) | **Recommandation : `sommeil` → `sleepQ`**, plus proche que les heures. Décision M13 |
| `suivi.stress` (valeurs 1 à 3, 6 bilans) | Le bilan actuel est noté sur 10 (0 à 10 dans `checkin.js`, 1 à 10 dans l'anamnèse) | **Pas de conversion linéaire** : l'échelle ancienne est inconnue. Copie sous `legacy.stress`, champ `stress` laissé vide. Décision M14 |
| `suivi.motiv` (valeurs 4 à 5, 6 bilans) | Échelle actuelle variable selon l'écran (1 à 5 emoji dans `fatigue.js`, 1 à 10 dans `recuperation.js`) | Même traitement que `stress` : copie sous `legacy.motiv`. Décision M14 |
| `mesures.mg` (3 valeurs, 15,1 à 88) | Aucun champ `mg` dans le code. Le champ de masse grasse est `fat` (`energy.js`, borné à 3–60) | **Pas de correspondance sûre** : 88 est hors de l'échelle `fat`. `mg` reste sous `tbLegacy`. Décision M15 |
| `cou`, `epaules` (mesures) | Pas de champ correspondant dans `store.js` ni `checkin.js` (`CI_MEASURES`) | Restent sous `tbLegacy` |

Décisions nouvelles :

| # | Question | Recommandation |
|---|---|---|
| M13 | Ancien `sommeil` (2 à 5) versé dans `sleepQ` ? | Oui |
| M14 | `stress` et `motiv` de l'ancien `suivi` : copie brute sous `legacy`, sans conversion ? | Oui, tant que l'échelle n'est pas confirmée par Thomas |
| M15 | `mg` des mesures : vraiment de la masse grasse, et dans quelle unité ? | Thomas confirme ; sans réponse, `tbLegacy` |

## 10. Décisions prises par Thomas (QCM du 14/11)

| # | Décision |
|---|---|
| M1 | Rattachement des clients sans compte : à la main, un par un |
| M2 | Pas d'archivage automatique ; rien n'est archivé sans décision explicite |
| M3 | Réponse du coach : champ `coachReply` dans le bilan |
| M4 | `motiv` gardé à part, pas versé dans `mood` |
| M5 | Anciens messages non lus marqués lus à la copie |
| M6 | Ancienne app en lecture seule à T, au moins pour la messagerie |
| M7 | Table `cxs_program_history` créée maintenant, copie à l'identique (`prog_hist` et `cycles`) |
| M8 | Statut des `coach_id` et des 2 inscrits en autonomie : à trancher avec D8 plus tard, rien d'écrit d'ici là |
| M9 | Répétition sur base restaurée en local |
| M10 | Sauvegarde : stockage chiffré hors Supabase et hors GitHub (lieu exact à préciser) |
| M11 | Cinq comptes possiblement doublons : confirmation paire par paire à la main |
| M12 | Bilans sans date : date de dernière modification (`dateSource: "updated_at"`) |
| M13 | `sommeil` versé dans `sleepQ` |
| M14 | `stress` et `motiv` de l'ancien suivi : copie brute sous `legacy`, sans conversion |
| M15 | `mg` des mesures gardé sous `tbLegacy` |

Rien de ce qui suit n'est exécuté tant que le lieu de sauvegarde (M10) et l'accord écrit de Thomas au point R1 ne sont pas donnés.

## 11. Sauvegarde : procédure retenue (QCM du 14/11)

Exécutée par Thomas, sur son poste. Je n'accède à aucune donnée exportée.

1. **Export** depuis le tableau de bord Supabase : base complète (schéma et données) et bucket `media` (pièces jointes, vocal, photos), avec la liste des objets et leur taille.
2. **Stockage** : disque chiffré de Thomas, jamais sur GitHub, jamais dans Supabase, jamais dans le bac à sable de cette session.
3. **Empreintes** : SHA-256 de chaque fichier, date et heure de l'export, notées dans un fichier sans donnée client. Seules ces empreintes et les comptages (§ 5, R0 à R2) me sont transmis.
4. **Restauration de test** sur le poste de Thomas, dans une base locale. Les requêtes R0 à R2 doivent y donner les mêmes chiffres qu'en production.
5. Ensuite, et seulement ensuite : point d'arrêt R1 (§ 6.2), avec l'accord écrit de Thomas.

Ce que je vérifierai à réception : les empreintes correspondent, les comptages sont identiques entre la production et la restauration, et la liste de contrôle R1 (§ 6.2) est complète.

## 12. Journal d'exécution (14/11, accord de Thomas : ajouts seuls, contrôle à chaque étape)

| Étape | Résultat | Contrôle |
|---|---|---|
| `00_snapshot` | Schéma privé `bak_20261114`, 15 tables | Comptages et empreintes identiques à la source. **Ne remplace pas l'export hors Supabase (§ 11), toujours à faire** |
| `01_structure` | 5 colonnes ajoutées à `cxs_messages` (8 → 13), schéma `mig`, `cxs_program_history` (RLS : lecture de ses propres lignes) | 2 messages existants intacts |
| `02_correspondance` | 16 lignes : 10 `auto`, 6 `en_attente`, 0 doublon | Identique à R0 ; 16 profils inchangés, aucun compte créé |
| `03_messages` | 119 copiés, 2 messages natifs conservés (121) | Empreinte source = copie, 0 orphelin, ancienne table intacte (155) |
| `05` notes et historique | 10 notes, 22 `prog_hist`, 1 cycle | Comptages attendus = copiés, 0 orphelin |

Écarts au plan, et pourquoi :

- **Déclencheur `cxs_notify_on_reply`** : chaque insertion d'un message dont l'expéditeur n'est pas le membre crée une notification « Nouveau message de Thomas ». La copie a donc été faite dans une transaction où les déclencheurs sont suspendus (`session_replication_role = replica`), avec annulation automatique si le nombre de notifications changait. Il n'a pas changé. Aucun déclencheur n'a été modifié ni désactivé de façon durable.
- **17 messages avec pièce jointe ou vocal non copiés** : l'app n'affiche pas `media` ; ils apparaîtraient comme des bulles vides. À copier après la copie des fichiers du stockage et le support de `media` dans l'app (PR 2.1).
- **Étape 04 (bilans) suspendue** : `js/sync.js` renvoie à chaque synchronisation les 26 derniers bilans de l'appareil du membre, ce qui écraserait toute entrée ajoutée côté serveur. Les 16 bilans ne doivent pas être écrits dans `cxs_member_data.data.checkins` depuis le serveur. Options : (a) table dédiée en lecture seule affichée par l'app ; (b) fusion côté appareil à la prochaine connexion, dans la PR 2.1. `04_bilans.sql` reste un brouillon à ne pas jouer en l'état.

Reste à faire : fichiers du stockage et réécriture de `media`, bilans (décision ci-dessus), correctif d'écriture de la messagerie (§ 4.3) puis rattrapage, paires M11, export hors Supabase, réconciliation finale (R8 après T).

## 13. Journal d'exécution, suite (15/11)

| Étape | Résultat | Contrôle |
|---|---|---|
| Bilans | Table `cxs_legacy_checkins` (RLS : le membre lit les siens, le coach lit tout), 16 bilans copiés ; 5 dates tirées de la dernière modification | 16 sur 16, somme des poids 719,7 = 719,7, somme des semaines 62 = 62 ; 2 bilans de clients en attente non copiés |
| Messages restants | 15 messages à pièce jointe et 1 vocal copiés, déclencheurs suspendus dans la transaction | 134 sur 134 pour les clients rattachés, empreinte identique (texte, date, `media`, vocal), 0 orphelin, ancienne table intacte (155) |
| Code (sur la branche, non déployé) | `js/cloud.js` : messagerie uniquement sur `cxs_messages` ; `js/views/coach.js` : affichage des pièces jointes ; `stripe-webhook` (source seulement, non déployée) écrit dans `cxs_messages` ; test de garde `tests/messagerie.test.mjs` ajouté à la CI | Syntaxe OK, 16 suites unitaires + garde : 0 échec |

Décision de fait : les pièces jointes et vocaux **gardent leur chemin d'origine** (dossier de la fiche client), aucun fichier n'est copié. Les chemins restent valides tant que les fiches `clients` existent. La copie vers un dossier par compte relève de la PR 1.5 (stockage).

À faire avant la mise en ligne du code : déployer la source de `stripe-webhook` (écriture de production, hors de ce plan), relire la politique d'insertion de `cxs_messages` (quota par palier) puisque les membres qui écrivaient dans l'ancienne table y seront soumis, puis noter l'heure T, rejouer la copie des messages écrits entre-temps (§ 4.3, requête R8 ensuite).

## 14. Paires M11 tranchées par Thomas (15/11)

Les cinq comptes candidats avaient été créés le 30/10 sans e-mail, ce qui explique l'échec du rattachement par e-mail ; chacun correspondait à un seul client, avec un programme identique.

| Paire | Décision | Résultat |
|---|---|---|
| Diana, Marie-France | Confirmées | `mig.client_map` : statut `manuel`, données copiées (14 messages) |
| Antoine, Dylan, Emmanuel | Non confirmées | Restent `en_attente` ; leurs 7 messages (dont Emmanuel) restent dans l'ancienne table |
| TestThomas | Compte de test, ignoré | Reste `en_attente` |

Réconciliation après copie : 148 messages attendus = 148 copiés (empreinte identique, pièces jointes et vocal compris), 16 bilans, 23 `prog_hist`, 10 notes, 0 orphelin, 16 profils inchangés, ancienne table à 155. Statuts : 10 `auto`, 2 `manuel`, 4 `en_attente`.

Reste, pour ces deux membres comme pour les dix autres : le carnet, le journal alimentaire et les mesures de leur ancienne fiche n'ont pas fait l'objet d'une réconciliation membre par membre (§ 1, lignes `carnet`, `nutri_log`, `mesures`).

## 15. Journal d'exécution, fin de la copie des données (15/11)

| Point | Résultat |
|---|---|
| Réconciliation carnet, journal, mesures par membre | Mesures : aucune manquante. **7 jours de journal alimentaire** absents de `food`/`daily` chez 6 membres ; séances : la clé `S_s_` n'a pas pu être comptée avec le motif testé |
| Archive brute `cxs_legacy_rows` | 924 lignes de carnet, 96 jours de journal, 27 mesures, 11 onboardings des 12 clients rattachés, empreintes identiques à la source. Aucun champ ne se perd, même sans cible |
| Bilans | Affichés dans « Mes bilans » (bloc « Bilans de l'ancienne app », chargé à part) ; côté coach, pas encore d'écran dédié |
| Quota de messagerie | Palier Invité : 2 messages par semaine ; les 15 membres sont Invité sauf Thomas (illimité). Aucun membre n'est sur quota après la copie |
| `stripe-webhook` | Fichiers du dépôt conformes à la version déployée (v5) sur tous les repères ; seule la ligne du message change |

## 16. Mise en ligne (15/11)

| Étape | Heure (UTC) | Résultat |
|---|---|---|
| PR #32 fusionnée | 01:08 | CI verte (`e2e`), commit `e346685`. **T = 01:08** |
| `stripe-webhook` déployé | juste après | Version 6, `verify_jwt` désactivé comme la version 5 ; seul changement : le message d'abonnement va dans `cxs_messages` |

À faire : rejouer la copie des messages (`docs/migration-sql/03_messages.sql`) pour ceux écrits dans l'ancienne table depuis la dernière copie, puis relever R8 (aucune ligne créée ou modifiée dans `messages` après T) à T + 24 h et T + 7 jours. Les téléphones qui ont encore l'ancienne version en cache peuvent écrire dans l'ancienne table jusqu'à leur prochain rechargement : d'où ces relevés. Ne passer l'ancienne table en lecture seule (M6) qu'une fois R8 à zéro.

Relevé de référence à T + 6 min (01:14 UTC) : 148 messages attendus = 148 copiés, 0 orphelin, dernier message de l'ancienne table le 9/11, **R8 = 0** (rien créé ni modifié après T). Relevés suivants programmés : T + 24 h (16/11, 01:15 UTC) et T + 7 jours (22/11, 01:15 UTC).

## 17. Décisions du 15/11 (par téléphone)

| Point | Décision | Conséquence |
|---|---|---|
| Sauvegarde | Confiance aux sauvegardes automatiques de Supabase ; pas d'export hors plateforme | Risque accepté par Thomas : pas de copie hors Supabase. L'instantané `bak_20261114` reste en base. À reconsidérer si un ordinateur est disponible |
| Mise en ligne publique | Après les correctifs de sécurité (audit § 5 et § 11, points 1.1 à 1.6) | Pas d'ouverture publique avant ces correctifs |
| Ancienne app du coach | Retirée maintenant | `coach/index.html` redirige vers `coach.html`, retire l'ancien service worker et son cache. Le code précédent reste dans l'historique git. **Les anciennes tables ne sont pas archivées** : la condition du § 2 (plus de client en attente) n'est pas remplie (4 clients en attente) |
