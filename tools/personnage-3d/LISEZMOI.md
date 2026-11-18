# Personnage réaliste : fabrication des calques

Les images de `assets/perso/` (corps, tenue, cheveux) sont rendues à l'avance avec Blender, à partir des modèles humains de MakeHuman.

- **Licences** : les modèles, peaux, vêtements et coiffures viennent des « asset packs » officiels MakeHuman sous licence **CC0** (makehuman_system_assets, hair01, shirts01, pants01, shoes01, skins01). Les images produites appartiennent à TB my Coach, sans attribution obligatoire. MPFB2 (le module Blender de MakeHuman, GPL) sert seulement d'outil : il n'est pas livré avec l'app.
- **Réglages** : `reglages.json` (bases, 4 niveaux de musculature, 4 niveaux de masse grasse, 6 peaux, tenues, coiffures, éclairage et cadrage fixes pour que les calques se superposent).
- **Produire** : installer `pip install bpy` (Blender 5.3) et MPFB2 comme extension, copier les asset packs dans le dossier de données de MPFB, puis `python atelier.py lot.json` (liste de corps `{base, mu, mg}`). Les fichiers déjà faits sont sautés. Compter environ 2 min 30 par corps sur 2 processeurs (15 images).
- **Convertir** : PNG vers WebP qualité 78 (environ 14 Ko par calque, 6,5 Mo pour les 480 calques).
- **Points techniques** : la pose aligne chaque bras vers une direction cible (pas d'angles bruts, sinon l'épaule part en arrière) ; le corps reste entier pour le calque « corps », mais les zones couvertes par une tenue sont masquées quand on rend cette tenue (sinon la peau perce le tissu) ; les cheveux sont rendus avec le corps en cache.
