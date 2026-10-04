# TB my Coach — application

Application de suivi coaching (programme, carnet, nutrition, messages, gestion),
hébergée **gratuitement** sur GitHub Pages.

- **Adresse de l'app** : https://thomasbouletcoaching-lab.github.io/tb-coaching-app/
- **Données et comptes** : Supabase (projet « tb-coaching app », plan gratuit, serveurs à Paris).
  Aucune donnée client n'est stockée dans ce dépôt, et il ne faut jamais en ajouter
  (pas de sauvegarde, d'export ou de capture contenant des données de clients).

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'application (interface + logique) |
| `confidentialite.html` | Politique de confidentialité présentée aux clients |
| `sw.js` | Service worker : hors ligne, installation sur téléphone, notifications |
| `manifest.webmanifest` | Nom, couleurs et icônes de l'app installée |
| `logo.png`, `icon-*.png`, `apple-touch-icon.png`, `favicon.ico` | Visuels |
| `.github/workflows/keepalive.yml` | Tâche quotidienne qui empêche la mise en pause de Supabase |
| `.nojekyll` | Indique à GitHub de servir les fichiers tels quels |

## Côté Supabase (hors de ce dépôt)

- Tables : `clients`, `carnet`, `suivi`, `nutri_*`, `mesures`, `messages`, `biz_*`,
  `onboarding` (questionnaire de démarrage), `push_subs` (abonnements aux notifications),
  `app_private` (secrets serveur, inaccessible depuis l'app).
- Fonctions serveur (Edge Functions) :
  - `push` : envoie les notifications. Appelée uniquement par la base, protégée par un secret.
  - `delete-account` : suppression de compte d'un client (droit à l'effacement). Les factures sont conservées.
- Tâches planifiées (pg_cron) : rappel « séance du jour » chaque matin (8 h 30 l'été, 7 h 30 l'hiver)
  et rappel « bilan de la semaine » le dimanche (19 h l'été, 18 h l'hiver).
- Notification immédiate à chaque nouveau message (déclencheur sur `messages`).

## Faire une modification

1. Demander à Claude, ou modifier le fichier sur GitHub (icône crayon).
2. Enregistrer (« Commit changes ») sur la branche `main`.
3. L'app en ligne est mise à jour en 1 à 2 minutes. Les utilisateurs voient un bandeau
   « Nouvelle version disponible · Mettre à jour » à leur prochaine ouverture.

Si `sw.js` est modifié, augmenter son numéro de version (`const C="tb-v17"` → `"tb-v18"`).

## Sauvegardes

Le plan gratuit de Supabase n'offre pas de sauvegarde accessible. Depuis l'espace coach,
« Télécharger toutes mes données » produit un fichier complet : à faire une fois par mois et à ranger
en lieu sûr (Drive, iCloud), **jamais dans ce dépôt**.

## Revenir en arrière

Onglet « Commits », puis choisir une version précédente : tout l'historique est conservé.
