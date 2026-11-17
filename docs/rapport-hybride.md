# Rapport final · Module « athlète hybride », quêtes et personnage (17/11/2026)

Trois sessions, trois PR empilées : #35 (fondations) → #36 (quêtes et progression) → #37 (interface). Décisions C55 à C58.

## 1. Ce qui a changé
- **Programme hybride** : `data/hybride.json` (seule source des chiffres, hypothèses en tête) et `js/hybride.js` : macrocycle de 12 semaines en 3 mésocycles, 2 qualités en développement par bloc, volume pondéré par muscle (1 / 0,5) face aux fourchettes de maintien et de développement, progression RIR 3 → 2 → 1 → décharge, gabarits 3 à 6 séances et règles d'ordre, zones en % de VMA, reprise de la course, Forme du jour, alertes d'équilibre. `js/hybride-generation.js` construit la semaine avec le générateur existant (matériel, gênes, exercices détestés du questionnaire « sur mesure »).
- **Quêtes et progression** : `js/hybride-quetes.js` : quêtes du jour, de la semaine, du bloc, de skills (paliers validés tout seuls par les séries notées) et boss ; XP dérivée des logs avec des clés déterministes ; série tolérante ; rangs Bronze → Maître ; objets qui ne sont jamais retirés ; radar des 7 qualités.
- **Serveur** : 5 tables `cxs_hyb_*` avec leurs règles d'accès (appliquées le 17/11 après « go ») ; fonction `hybride-xp`, seule à écrire l'XP (déployée le 17/11 après « go »).
- **Écrans** : « Athlète hybride » (personnage, programme du jour, quêtes, radar, frise, tests, pause, partage avec le coach), « Ton personnage », carte sur l'accueil, carte dans le Suivi coach. Service worker `cxs-v111`.

## 2. Tests et contrôles de sécurité
- Tests unitaires : 65 (`node --test` sur hybride, quêtes, génération, serveur, personnage).
- Règles d'accès SQL : 64 contrôles sur Postgres local qui imite Supabase, dans les deux sens (22 refus attendus, 42 accès ou cloisonnements attendus), droits par défaut de Supabase imités, migration rejouée, retour arrière puis réapplication. Lancés aussi par la CI.
- Production, juste après application : droits relus (RLS active, anon sans droit, aucune écriture d'XP ni de quête par un membre, séquence fermée) ; fonction : 401 sans session ou avec un jeton invalide, 405 en GET.
- Bout en bout (Playwright) : `tests/hybride-e2e.js`, 94 contrôles sur iPhone 390×844 et Android 360×740, clair et sombre, mouvement réduit, zéro erreur JavaScript, zéro débordement, état corrompu et données indisponibles ; `tests/parcours-e2e.js`, 440 contrôles, aucune régression.
- Trois relectures indépendantes (une par session) : 1 + 5 + 2 bloquants trouvés et corrigés (un script de test SQL qui masquait les échecs, plusieurs façons de gonfler l'XP, une boucle de requêtes et un écran figé sur un état corrompu).

## 3. Ce qui n'est pas couvert, et pourquoi
- Aucun test sur un vrai téléphone : seulement en émulation.
- La fonction serveur n'a pas été exécutée avec un vrai compte (aucune donnée de client lue) ; Deno n'était pas disponible ici.
- Un membre très motivé peut toujours inventer des séances dans son téléphone : le serveur empêche d'écrire l'XP directement, pas de mentir sur ses séances (plafonds par jour et fenêtres fixes en limitent l'effet).
- Le coach lit encore l'instantané complet de tous les membres dans l'ancienne partie de l'app (hors périmètre, voir `docs/reste-a-faire.md`, point 1).

## 4. Hypothèses à ajuster avec de vraies données
Toutes dans `data/hybride.json` (clé `hypotheses`, puis `xp`, `rangs`, `radar`, `generation`) : ratios d'alerte 1,3, plafonds par nombre de séances, groupes en développement (2 à 5), plafond total de séries, marge de 2 séries, part retirée par la Forme du jour (1/3, 2/3), seuil de fatigue (énergie ≤ 3), grâce (1 par semaine), absence (4 jours), pauses (1 par semaine), valeurs d'XP, seuils des rangs (Argent 300 → Maître 7000), repères du radar.

## 5. Actions manuelles pour Thomas
1. Relire puis fusionner les PR #35, #36 et #37 dans l'ordre (ou donner « go » pour que je le fasse) : c'est la mise en ligne.
2. Essayer le module sur ton téléphone (accueil › « Athlète hybride »).
3. Plus tard : décider des objets payants (le champ `prix` est prêt), et des textes de vente.

## 6. Contenu de docs/reste-a-faire.md
Voir le fichier : 11 points, dont la lecture par le coach des instantanés des abonnés en autonomie sans consentement (à corriger avant la vente de l'abonnement), l'alignement de `cxs_tiers`, les anciennes tables `gx_*`, la fusion future des deux systèmes de progression, le redéploiement de `hybride-xp` sur le dernier moteur et les tests sur un vrai téléphone.
