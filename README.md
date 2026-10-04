# TB my Coach — application

Application de suivi coaching (programme, carnet, nutrition, messages, gestion),
hébergée **gratuitement** sur GitHub Pages.

- **Adresse de l'app** : https://thomasbouletcoaching-lab.github.io/tb-coaching-app/
- **Données et comptes** : Supabase (projet « tb-coaching app », plan gratuit).
  Aucune donnée client n'est stockée dans ce dépôt — et il ne faut jamais en ajouter.

## Contenu

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'application (interface + logique) |
| `sw.js` | Service worker : fonctionnement hors ligne / installation sur téléphone |
| `manifest.webmanifest` | Nom, couleurs et icônes de l'app installée |
| `logo.png`, `icon-*.png`, `apple-touch-icon.png`, `favicon.ico` | Visuels |
| `.nojekyll` | Indique à GitHub de servir les fichiers tels quels |

## Faire une modification

1. Modifier le fichier sur GitHub (icône crayon) ou demander à Claude.
2. Enregistrer (« Commit changes ») sur la branche `main`.
3. L'app en ligne est mise à jour automatiquement en 1 à 2 minutes.

**Important** : après une modification de `index.html`, augmenter le numéro de
version dans `sw.js` (`const C="tb-v16"` → `"tb-v17"`, etc.) pour que les
téléphones de tes clients récupèrent bien la nouvelle version.

## Revenir en arrière

Onglet « Commits » → choisir une version précédente → tout l'historique est conservé.
