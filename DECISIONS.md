# Décisions prises en autonomie — 8 novembre 2026

Session sans relecture en direct. Chaque choix est noté ici avec sa raison.

1. **Branche de travail** : `claude/relaxed-brown-5tl5pb` (branche désignée). Elle était identique à `main` au départ (0 commit d'écart). Aucun push sur `main`.
2. **Pas de changement CSS des cibles tactiles (44 px)** : l'audit du 7 octobre chiffre le problème, mais je n'ai pas pu mesurer les vues connectées. Un changement CSS non mesuré aurait pu casser la mise en page. Reporté, voir `REPORT.md`.
3. **Quick win « environ 5 minutes » abandonné** : le texte n'existe plus dans `js/` ; l'ancien `coach/index.html` dit déjà « Environ 2 minutes ». Rien à corriger.
4. **Pas de migration SQL écrite** : les politiques `messages_update`, `can_access`, `rls_auto_enable` et `leads_push` ne sont pas dans le dépôt (elles vivent dans Supabase). Écrire un `REVOKE` ou une nouvelle politique sans la définition réelle risque de casser la prod. Aucune base ni aucun projet Supabase n'a été interrogé.
5. **Harnais E2E corrigé sur deux points vérifiés** :
   - l'app importe `createClient` en module ESM (`/+esm`) ; le harnais servait le bundle UMD sans l'exporter ;
   - l'app stocke la session sous `cxs.auth` (`js/cloud.js`) ; le harnais utilisait `sb-<ref>-auth-token`.
   Je n'ai **pas** corrigé l'initialisation du profil local (`cxs.v1`) : sans lui, le client reste sur l'écran d'accueil visiteur. Ce point reste ouvert.
6. **Script de mesure des cibles tactiles retiré** : il ne voyait que l'écran d'accueil et aurait donné un faux « seuil respecté ».
7. **Seuil micro-entreprise** : le constat (120 000 € contre 83 600 €) est présenté tel quel, sans recommandation de statut juridique. Le choix relève de Thomas et de son comptable.
8. **Sources contradictoires traitées** : Keobiz (77 700 €, chiffre 2025) écarté au profit des sources 2026 ; tarifs SEPA Stripe non retenus ; amende L641-1 marquée « à vérifier ».
9. **Attribution** : les trailers de commit demandés incluent un nom de modèle ; la consigne système interdit de mentionner le modèle dans les commits et PR. J'ai donc gardé `Co-Authored-By: Claude` sans numéro de modèle, et la ligne `Claude-Session`.
10. **Pas de PR sans demande explicite** : la demande de Thomas (« ouvre une PR ») est explicite. La PR est ouverte sur `main`, en brouillon, sans fusion.
