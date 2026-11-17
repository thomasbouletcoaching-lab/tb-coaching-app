# Reste à faire (hors périmètre du module hybride, noté au passage)

Liste tenue pendant les sessions « athlète hybride » (17/11/2026). Rien de ceci n'a été modifié.

1. **Abonnés en autonomie visibles par le coach sans consentement (existant).** `cxs_member_data` et `cxs_profiles` sont lisibles par le coach pour tous les membres (`cxs_is_coach()`), y compris un abonné en autonomie, alors que la règle est « seulement avec consentement ». Aujourd'hui sans effet (les 16 comptes sont « surmesure » ou « invité »), mais à corriger avant la vente de l'abonnement à 19,99 €. Les nouvelles tables `cxs_hyb_*` appliquent déjà la règle. Lié à la sécurité globale (phase 1).
2. `cxs_tiers` en production n'a pas de ligne « invite », alors que `js/config.js` en a une (rang 3). À aligner.
3. Tables `gx_events`, `gx_member`, `gx_reactions` : RLS activée sans politique (fermées, accès par fonctions `SECURITY DEFINER`). `gx_calc` lit le poids (`mesures`) pour des points : contraire à « jamais de points pour le poids ». Concerne l'ancienne app.
4. Production en Postgres 17, tests locaux en Postgres 16 : prévoir un test sur la même version.
5. Fusionner plus tard les trophées et niveaux actuels (`js/quests.js`) avec les quêtes et rangs du module hybride (décision C56, Q4).
