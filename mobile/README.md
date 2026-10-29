# TB my Coach (application mobile, React Native / Expo)

Version en cours de construction. L'app web (`index.html`) reste la version en production.

## Lancer

1. `cd mobile && npm install`
2. Créer `mobile/.env` avec :
   - `EXPO_PUBLIC_SUPABASE_URL=https://xtapitojdvicgcaygeqj.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé publique anon du tableau de bord Supabase>`
3. `npm start`, puis ouvrir l'app avec l'application Expo Go sur téléphone.

## État

- Navigation en six onglets, couleurs de TB my Coach : fait.
- Connexion Supabase (sans clé dans le code) : fait.
- Écrans : à porter depuis CalXsthenos (Accueil, Entraînement, Nutrition, Récupération, Coaching, Profil).
- Calculs (énergie, nutrition, moteur de séances) : à porter depuis CalXsthenos.
- Publication sur les stores : plus tard, avec compte développeur.
