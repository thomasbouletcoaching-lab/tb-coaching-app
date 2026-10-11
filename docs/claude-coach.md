# Claude intégré (version coach)

## Ce que ça fait
- Bouton ✦ (en bas à droite, compte coach uniquement) ou app dédiée **TB Coach IA** (`?app=ia`).
- Claude lit les dossiers : programme tel que l'app le calcule, carnet, nutrition, mesures, bilans, messages, questionnaire, notes privées.
- Il **propose** : modifications de programme (prescriptions, exercices, séances), cibles nutrition et pas, notes privées, brouillons de message.
- **Rien n'est appliqué ni envoyé sans un geste du coach** (bouton « Appliquer » / « Envoyer » + confirmation), conformément à la règle 6 de CLAUDE.md.

## Architecture
- `supabase/functions/coach-ai/index.ts` : fonction Edge (Claude Opus 5.5, réflexion adaptative, effort moyen, repli automatique en cas de refus `fallbacks: "default"`). Lit les données avec le jeton du coach (RLS).
- Le programme et le carnet sont lus **dans l'app** (`ai61Tool`) : seul le moteur de l'app connaît le programme effectif. La fonction renvoie `app_tools`, l'app exécute puis relance avec `resume`.
- Les conversations restent sur le téléphone du coach (localStorage), 40 derniers messages par client.

## Mise en service
1. Créer une clé API sur console.anthropic.com (facturation à l'usage, distincte d'un abonnement Claude).
2. Supabase → Edge Functions → Secrets → ajouter `ANTHROPIC_API_KEY`.
3. Installer l'app : ouvrir `https://thomasbouletcoaching-lab.github.io/tb-coaching-app/?app=ia` → Partager → Sur l'écran d'accueil.

## Coût indicatif
Opus 5.5 : 4 $ / million de jetons en entrée, 20 $ en sortie. Le coût de chaque réponse est affiché sous la réponse.
