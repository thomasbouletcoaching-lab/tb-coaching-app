# Scripts de migration (BROUILLONS, NON EXÉCUTÉS)

Ne vont pas dans `supabase/migrations/` volontairement : rien ne doit s'appliquer automatiquement.
Ordre : `00_snapshot` → R1 (accord écrit) → `01` → `02` → réconciliation → `03` → `04` → `05` → `06` → réconciliation → correctif de code (PR 2.1) → rattrapage (rejouer `03`) → réconciliation finale.
Tous les scripts sont additifs et rejouables (`legacy_id`, `on conflict do nothing`). `99_retour_arriere.sql` défait tout ce qu'ils créent.
Aucun n'a été testé : à jouer d'abord sur une copie, puis étape par étape en production avec arrêt à chacune.
Étapes non couvertes par SQL : copie des fichiers du stockage (pièces jointes, vocal, photos), puis réécriture de `media`/`audio_path` vers les nouveaux chemins.
