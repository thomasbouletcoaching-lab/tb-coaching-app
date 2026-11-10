# Agenda « Ma semaine » (créateur de programme, étape 5)

Rédigé le 10 novembre 2026. Spécification : page Notion « SPEC : Créateur de programme individualisé », §7 et §8.2. **Fonction Premium** (Bâtisseur), comme décidé le 10/11.

## Ce que c'est

Profil › **Ma semaine**. Le membre dit ce qui revient chaque semaine et ce qui change ; l'app place ses séances dans les créneaux libres comme des rendez-vous, et replanifie en un geste quand un imprévu arrive.

- **Le fixe** : travail, famille et enfants, trajets, repas, autre sport, culte ou engagement, autre. Jours, de-à, précision libre. Plus lever, coucher, trajet jusqu'à la salle et moment préféré (matin, midi, soir).
- **Le variable** : « Qu'est-ce qui change cette semaine ? » avec des choix rapides (déplacement, réunion tardive, enfant malade, soirée, autre). Pour la semaine en cours ou la suivante.
- **Revue du dimanche** : le dimanche, une carte sur l'accueil (Premium) ouvre la semaine suivante.
- **Grille** : 7 jours de 6 h à 23 h, avec le sommeil, le fixe, le variable, le calendrier importé et les séances.
- **Mes rendez-vous** : chaque séance avec jour, heure, durée, lieu, et un bouton **🙅 Je ne peux pas**.
- **Calendrier** : « Les ajouter à mon calendrier » (export `.ics` existant) ajoute maintenant un **rappel 30 minutes avant** chaque séance.

## Comment les séances sont placées (`js/semaine.js`)

| Règle | Détail |
|---|---|
| Fenêtre d'entraînement | Après le lever (+30 min) et jamais dans l'heure qui précède le coucher. |
| Créneau | Durée de la séance (estimée par l'indice de difficulté) + trajet aller et retour (0 à la maison). Heure au plus près du moment préféré, par pas de 5 min. |
| Récupération | 48 h entre deux séances d'un même pattern, 72 h pour une charnière lourde (mêmes règles que le générateur), pour tous les programmes dont les exercices sont dans la bibliothèque. Les séances déjà faites ces derniers jours comptent. |
| Rechange | Au moins un créneau de rechange libre dans la semaine, sinon alerte. |
| Sommeil | Alerte si une séance finit moins d'1 h 30 avant le coucher, ou si le sommeil visé est court. |
| Stabilité | Un plan déjà en place n'est pas bougé sans raison. |
| Trop de séances | Les dernières sont reportées à la semaine suivante, et c'est dit. |
| Calendrier importé | Il compte, sauf les événements « toute la journée » (anniversaire, férié) qui ne bloquent pas. |

Deux modes : **« Proposer mes jours et heures »** écrit la semaine type dans l'agenda existant (`S().schedule`), à partir du fixe seulement ; **« Replacer mes séances »** ne touche que la période choisie (`moves` et `slots`) en tenant compte du variable.

## Je ne peux pas

Jusqu'à 3 créneaux, du plus tôt au plus tard, récupération respectée, jamais deux séances le même jour. Chaque proposition dit pourquoi (« 72 h après ta séance du 09/11 »). Si rien ne tient : **version de 20 minutes** dans les 3 prochains jours, sinon **fusion** avec la prochaine séance (mouvements en double regroupés). Ton volontairement bienveillant : « une séance décalée n'est pas un échec ». Un décalage s'affiche « déplacée », jamais « loupée », donc la régularité n'en souffre pas.

## Données et vie privée

Tout reste **sur le téléphone** (`S().semaine`). Rien ne part chez le coach : le fixe décrit la vie privée (travail, enfants, culte). Le coach voit déjà les séances prévues, comme avant. Aucune table Supabase, aucune migration.

## Ce qui n'a pas été touché

Le mois et la semaine de l'agenda, le déplacement manuel, le repos choisi, la semaine type existante (« jours et heures »), l'import et l'export `.ics`, la **Séance express**. Ces fonctions restent gratuites. Seul le planificateur est Premium.

## Fichiers

| Fichier | Rôle |
|---|---|
| `js/semaine.js` | Module pur : blocs, créneaux libres, `planifier()`, `jeNePeuxPas()`, contrôles, `versSchedule()`. |
| `js/views/semaine.js` | Écran, feuilles, carte de revue du dimanche. |
| `js/views/agenda.js` | Bouton « Je ne peux pas » dans la séance du jour ; rappel 30 min dans l'export. |
| `js/generateur.js` | Exporte `ecartExige` (règle 48 h / 72 h) pour un seul point de vérité. |

## Tests

`node --test tests/semaine.test.mjs` (19 tests : créneaux, trajet, récupération, placement, replacement, imprévus, format de la semaine type) et `node tests/semaine-e2e.js` (39 vérifications sur iPhone 390×844 : écran verrouillé en gratuit, fixe, imprévu, semaine type écrite dans l'agenda existant, replacement, « Je ne peux pas » jusqu'au décalage, rappel dans le `.ics`, revue du dimanche avec une date simulée, clair et sombre).

## Pas encore fait

Score de soutenabilité (étape 6, qui comparera la charge de la semaine au temps libre réel), récupération et fatigue nerveuse (7), profils (8). Pas de notification push du rappel : le rappel passe par le calendrier du téléphone.
