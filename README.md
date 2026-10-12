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
| `logo.png`, `logo-complet.png` (avec « My Coach »), `icon-*.png`, `apple-touch-icon.png`, `favicon.ico` | Visuels |
| `.github/workflows/keepalive.yml` | Tâche quotidienne qui empêche la mise en pause de Supabase |
| `.nojekyll` | Indique à GitHub de servir les fichiers tels quels |

## Côté Supabase (hors de ce dépôt)

- Tables : `clients`, `carnet`, `suivi`, `nutri_*`, `mesures`, `messages`, `biz_*`,
  `onboarding` (questionnaire de démarrage), `push_subs` (abonnements aux notifications),
  `app_private` (secrets serveur, inaccessible depuis l'app).
- Programme perso du client : stocké dans `carnet` (clé `pp` = ses séances, `pl-<séance>-<date>` = une séance faite).
  Aucune table supplémentaire.
- Fonctions serveur (Edge Functions) :
  - `push` : envoie les notifications. Appelée uniquement par la base, protégée par un secret.
  - `delete-account` : suppression de compte d'un client (droit à l'effacement). Les factures sont conservées.
  - `purge-media` : supprime chaque nuit (3 h 20 UTC) les vidéos de la messagerie de plus de 30 jours.
    Les photos, vocaux et la bibliothèque d'exercices (`lib/`) ne sont jamais touchés. Appelée par la base, protégée par le même secret que `push`.
- Tâches planifiées (pg_cron) : rappel « séance du jour » chaque matin (8 h 30 l'été, 7 h 30 l'hiver)
  et rappel « bilan de la semaine » le dimanche (19 h l'été, 18 h l'hiver).
- Notification immédiate à chaque nouveau message (déclencheur sur `messages`).

## Méthode TB (programmes, charge conseillée, nutrition, théorie)

- **Banque de programmes → « Méthode TB »** : 6 programmes par profil (reprise/ventre 2 ou 3 j, recomposition 3 j,
  hypertrophie 4 j, hypertrophie avancée 5 j, powerbuilding 4 j), progression écrite semaine par semaine sur 12 semaines.
  Les règles du programme s'affichent au client (Semaine → « Ma méthode de progression ») et au coach (Programme).
  Le questionnaire propose automatiquement le bon programme.
- **Charge conseillée** dans le Carnet : double progression calculée depuis la dernière séance (hors exercices en %).
- **Suivi → Nutrition → « Modèles par profil »** : 10 modèles (objectif, protéines, lipides, repas, pas),
  individualisés avec le questionnaire du client. Le client voit « Pourquoi ce plan ».
- **📘 Méthode** : base de connaissances, version coach (théorie complète, sources) et version client (principes).
  Accès : Plus (coach), Accueil et Compte (client).
- Le contenu est dans `index.html`, module 66 (`TBP66`, `NM66`, `KB66`).

## Vidéos de la messagerie

- Une seule série, 90 secondes maximum.
- Toute vidéo de plus de 4 Mo est compressée sur le téléphone avant l'envoi (640p, environ 1 Mo par 10 secondes).
- Supprimées automatiquement 30 jours après l'envoi : bouton « Enregistrer » sous chaque vidéo pour la garder sur son téléphone.

## Faire une modification

1. Demander à Claude, ou modifier le fichier sur GitHub (icône crayon).
2. Enregistrer (« Commit changes ») sur la branche `main`.
3. L'app en ligne est mise à jour en 1 à 2 minutes. Les utilisateurs voient un bandeau
   « Nouvelle version disponible · Mettre à jour » à leur prochaine ouverture.

Si `sw.js` est modifié, augmenter son numéro de version (par exemple `const C="tb-v30"` → `"tb-v31"`).

## Sauvegardes

Le plan gratuit de Supabase n'offre pas de sauvegarde accessible. Depuis l'espace coach,
« Télécharger toutes mes données » produit un fichier complet : à faire une fois par mois et à ranger
en lieu sûr (Drive, iCloud), **jamais dans ce dépôt**.

## Revenir en arrière

Onglet « Commits », puis choisir une version précédente : tout l'historique est conservé.
