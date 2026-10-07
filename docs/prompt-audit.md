# Prompt d'audit complet — TB my Coach

À copier tel quel dans Claude Code (session ouverte sur le dépôt `tb-coaching-app`, avec l'accès Supabase). L'audit est **en lecture seule** : il examine, mesure et propose, il ne modifie rien.

---

```
Tu es à la fois product designer senior, coach sportif expérimenté et développeur full-stack.
Tu réalises un AUDIT COMPLET de l'application TB my Coach, puis tu proposes un plan d'amélioration priorisé.

## Contexte
- App de coaching de Thomas Boulet (coach diplômé STAPS, Paris). Offre : cycle de 12 semaines à 1 600 €,
  suivi personnalisé. Clients : surtout des actifs de 30 à 45 ans qui s'entraînent déjà mais stagnent, ont peu de temps,
  attendent du sérieux et pas de « hype ». Utilisation surtout sur iPhone, en app installée sur l'écran d'accueil.
- Technique : PWA en un seul fichier `index.html` (modules empilés qui enveloppent les fonctions précédentes),
  `sw.js`, Supabase (base, auth, stockage, fonctions edge, cron), hébergement GitHub Pages, tests Playwright dans `tests/`.
- Règles impératives du coaching (CLAUDE.md) : aucune promesse de résultat, aucune allégation de santé, aucune donnée de
  client réel dans le dépôt, aucune copie de contenu tiers, toute affirmation chiffrée sourcée, aucune action externe
  (publication, envoi, facture) sans validation humaine.

## Règles de l'audit
1. LECTURE SEULE : ne modifie aucun fichier, aucune donnée, aucun réglage. N'envoie rien à personne.
2. Base de données : uniquement des requêtes SELECT agrégées (comptes, taux, dates). N'affiche aucun nom, e-mail,
   mesure ou message de client réel dans ton rapport : parle de « client A, B… » ou de chiffres globaux.
3. Chaque constat doit être PROUVÉ : référence `index.html:ligne`, requête SQL et son résultat agrégé, ou capture/test
   Playwright reproductible (avec des données fictives). Distingue clairement « constaté » de « supposé ».
4. Pense comme les utilisateurs réels, pas comme le code : un coach seul qui gère 10 à 20 clients entre deux séances,
   et un client pressé, sur iPhone, à la salle avec un mauvais réseau.

## Ce que tu dois examiner

### A. Les parcours, de bout en bout (à rejouer avec Playwright, données fictives, viewport iPhone 390×844, écran tactile)
Pour chaque parcours : nombre d'étapes et de taps, temps estimé, points de blocage, messages d'erreur, ce qui manque.
Coach :
- Recevoir une candidature → appel → créer le client → lui donner accès → questionnaire → programme + plan alimentaire
  → CGV → premier paiement → démarrage.
- La routine du lundi matin : savoir qui a besoin de quoi, répondre aux messages et aux bilans, ajuster les charges.
- Le suivi d'un client sur 12 semaines : progression, adhérence, nutrition, mesures, fin de cycle, bilan, renouvellement.
- Le business : échéances, relances, factures, livre des recettes, déclarations.
Client :
- Première connexion (lien reçu par SMS, installation sur l'écran d'accueil, mot de passe, notifications, questionnaire).
- Une journée type : voir sa séance, la faire à la salle (chrono, saisie des séries, repos, vidéo technique), noter
  ses repas (plan, alternative, extra, scan), ses pas, son ressenti.
- La semaine : déplacer une séance, remplir son bilan, lire la réponse du coach, voir ses records et sa progression.
- Les cas difficiles : réseau coupé à la salle, oubli de noter, séance loupée, blessure, vacances, restaurant,
  changement de téléphone, mot de passe oublié.

### B. L'usage réel (requêtes SELECT agrégées)
Taux d'activation (compte créé, nouvelle app ouverte, notifications actives, questionnaire envoyé, CGV acceptées),
fréquence de saisie du carnet, de la nutrition, des mesures, des bilans, délai de réponse du coach aux messages,
fonctionnalités jamais utilisées, clients inactifs. Déduis-en où les gens décrochent.

### C. Les besoins non couverts
Liste les « tâches à accomplir » du coach et du client (jobs-to-be-done), puis compare avec ce que l'app permet.
Inspire-toi des pratiques des meilleurs outils de coaching, sans copier leurs textes ni leurs visuels.
Repère ce qui oblige encore à sortir de l'app (WhatsApp, Excel, papier, calculatrice, mail).

### D. La qualité
- Fiabilité : erreurs JavaScript, cas limites (pas de programme, plan vide, semaine 13, changement d'heure,
  fuseau horaire, deux appareils en même temps), saisies perdues, conflits d'écriture, mode hors ligne.
- Performance : temps de chargement sur 4G moyenne, poids de la page, nombre de requêtes à l'ouverture.
- Ergonomie mobile : taille des zones de toucher (44 px minimum), lisibilité, mode sombre, clavier qui masque les
  champs, retours visuels après une action, textes ambigus.
- Accessibilité : contrastes, libellés des boutons, navigation au lecteur d'écran.
- Sécurité et RGPD : politiques RLS de chaque table (un client peut-il lire ou modifier les données d'un autre ?),
  fonctions SECURITY DEFINER, clés exposées, conservation et suppression des données, mentions légales.
  Lance aussi les « advisors » de sécurité et de performance de Supabase.
- Conformité du contenu : textes affichés aux clients (promesses, allégations santé, chiffres non sourcés).
- Dette technique : risques de l'empilement de modules, code mort, fonctions dupliquées, couverture des tests.

## Livrable attendu (en français, clair, sans jargon inutile)
1. **Résumé exécutif** (10 lignes max) : les 5 problèmes qui coûtent le plus de temps ou de clients, et les 5 actions
   à plus fort impact.
2. **Tableau des constats** : n°, catégorie, qui est touché (coach / client), constat, preuve, gravité
   (bloquant / gênant / mineur), fréquence, impact (temps perdu, risque d'abandon, risque légal).
3. **Propositions** : pour chaque problème, une solution concrète (ce que l'utilisateur verra, en 2-3 phrases),
   l'effort estimé (S / M / L), le gain attendu, les risques et ce qu'il faut valider avec Thomas.
   Privilégie la simplification (moins d'étapes, moins de choix) plutôt que l'ajout de fonctions.
4. **Quick wins** : ce qui se fait en moins d'une heure chacun.
5. **Feuille de route** en 3 vagues (cette semaine / ce mois / plus tard), ordonnée par impact ÷ effort.
6. **Ce que Thomas doit faire lui-même** (réglages, contenus, décisions, informations manquantes).
7. **Questions ouvertes** : ce que tu n'as pas pu vérifier et pourquoi.

Termine sans rien modifier, et attends que Thomas choisisse ce qu'il faut mettre en place.
```

---

Conseil : lance-le dans une nouvelle session Claude Code pour qu'il parte d'un regard neuf, puis reviens ici avec le rapport pour choisir quoi mettre en place.
