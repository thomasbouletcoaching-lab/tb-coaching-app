# Friction de la saisie quotidienne

Mesure faite à la main sur le code (handlers `data-a`, `data-c`, formulaires), pas à l'écran.
Un « tap » = un toucher sur un bouton ou un champ. Un « champ » = une valeur à taper au clavier.
Le défilement n'est pas compté comme un tap ; il est noté à part quand il change.
Branche `claude/ux-coeur`, comparée à `main` (aca16e0).

| Action | Avant : taps | Avant : champs | Après : taps | Après : champs | Comment |
|---|---|---|---|---|---|
| Refaire un repas d'hier (2 aliments) | 6 | 0 | **1** | 0 | Avant : « + Ajouter », puis pour chaque aliment récent : aliment, « Ajouter », puis « Terminé ». Après : puce « Déjeuner d'hier » dans le journal (`food-copy`). |
| Refaire toute la journée d'hier | 6 par repas | 0 | **1** | 0 | Bouton « Copier mes repas d'hier » sur l'accueil (action du jour) ou puce « Toute la journée d'hier » dans le journal. 2 taps si une séance est l'action du jour (ouvrir « Ma journée », puis copier). |
| Ajouter un repas type (« Mes repas ») | 4 | 0 | **1** | 0 | Avant : « + Ajouter », onglet « Mes repas », le repas, « Terminé ». Après : puce du repas dans « En un tap » (`dish-now`), rangé dans le repas de l'heure. |
| Valider un repas du plan | 1 | 0 | 1 | 0 | Inchangé (« ✅ Mangé »). |
| Ajouter un aliment récent ou favori | 3 | 0 (quantité pré-remplie) | **2** | 0 | Avant : « + Ajouter », aliment, « Ajouter ». Après : « + Ajouter », « + 150 g » (dernière quantité, `quick-food`). La feuille reste ouverte pour enchaîner ; « Terminé » la ferme (non compté, avant comme après). |
| Ajouter un aliment jamais noté | 3 | 1 (recherche) | 3 | 1 | Inchangé : « + Ajouter », recherche, aliment, « Ajouter ». |
| Poids | 1 | 1 | **1** | **0** | Avant : toucher le champ et taper la valeur. Après : valeur de la dernière pesée pré-remplie, « ✓ » la confirme (`routine-same`). Autre valeur : 1 tap + 1 champ, comme avant. |
| Sommeil (accueil) | 1 | 1 | **1** | **0** | Idem poids, avec la dernière nuit notée. |
| Sommeil (Récupération) | 2 | 1 | **1** | **0** | Avant : champ « Heures dormies », puis « Enregistrer ma nuit ». Après : bouton « ✓ 7,5 h, comme la dernière nuit notée » (`sleep-same`). |
| Pas | 1 | 1 | **1** | **0** | Idem poids, avec le dernier nombre de pas noté. |
| Eau (un verre) | 1 | 0 | 1 | 0 | Inchangé. |
| Démarrer la séance du jour | 2 | 0 | 2 | 0 | Mêmes taps (« Commencer la séance », « C'est parti »). Avant : la carte était sous les cartes de suivi et le cycle. Après : première carte de l'écran, visible sans défiler. |
| Valider une série (charge reprise) | 1 | 0 | 1 | 0 | Inchangé. |
| Saisir puis valider une série | 3 | 2 | 3 | 2 | Inchangé (charge, répétitions, ✓). La charge se recopie toujours sur les séries suivantes. |
| Passer à l'exercice suivant | 0 + défilement d'un exercice entier | 0 | **0, sans défilement** | 0 | L'exercice terminé se replie, le suivant s'ouvre à la même place. |
| Terminer la séance | 2 | 0 | 2 | 0 | Inchangé (« Terminer », confirmation). |

## Position sur l'accueil

| Élément | Avant (rang dans la page) | Après |
|---|---|---|
| Séance du jour | 4e à 10e carte selon les cartes de suivi affichées | 1re carte |
| Saisie de la journée (routine) | après 12 cartes environ | 1re carte s'il n'y a pas de séance, sinon repliée dans « Ma journée » |
| Forme du jour (feu) | parmi les cartes de suivi, en 3e position | 2e, juste sous l'action du jour |
| Série et quêtes du jour | après le récap du jour | 3e |
