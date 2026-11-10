#!/usr/bin/env python3
"""Bibliothèque d'exercices classée selon les 8 patterns (modèle de Sebastian Oreb).

Ce script est la source unique de la bibliothèque de départ. Il produit :
  - data/exercices.json                                  (version embarquée, hors ligne)
  - supabase/migrations/2026-11-10_cxs_exercices_seed.sql (remplissage de la table)

Lancement, depuis la racine du dépôt :  python3 tools/exercices/build.py

Les noms sont ceux de data/fiches.json : chaque exercice garde ainsi sa fiche, son schéma et sa vidéo.
Les muscles viennent de la fiche. Les variantes liées sont calculées : même pattern et même famille de fiche.
"""
import json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FICHES = json.loads((ROOT / "data/fiches.json").read_text(encoding="utf-8"))["ex"]

# Matériel : on note le MINIMUM nécessaire, la liste des lieux possibles en découle.
#   C = salle complète (machines spécialisées) ; B = salle basique (type Basic-Fit : machines courantes, poulies, haltères, barres, Smith)
#   H = maison avec haltères, banc et petit matériel (ballon) ; E = élastique seul ; P = poids du corps ; T = barre de traction
LIEUX = {
    "C": ["salle_complete"],
    "B": ["salle_complete", "salle_basique"],
    "H": ["salle_complete", "salle_basique", "halteres_maison"],
    "P": ["salle_complete", "salle_basique", "halteres_maison", "poids_du_corps"],
    "T": ["salle_complete", "salle_basique", "barre_traction"],
    "CT": ["salle_complete", "barre_traction"],  # anneaux accrochés à une barre
    "E": ["elastique"],  # élastique seul : un membre qui n'a que cela ne voit que ces exercices
}
NIV = {"D": "debutant", "I": "intermediaire", "A": "avance"}
ZONES = {"ep": "epaule", "co": "coude", "po": "poignet", "dos": "bas_du_dos", "ge": "genou", "ha": "hanche", "ch": "cheville"}

# Exercices absents de data/fiches.json (solutions maison pour la flexion de genou) : (muscles, famille)
NOUVEAUX = {
    "Nordic excentrique assisté (mains au sol)": (["Ischios"], "knee_flex"),
    "Leg curl glissé unilatéral (serviette)": (["Ischios", "Fessiers"], "knee_flex"),
    "Pont ischios marché (walkout)": (["Ischios", "Fessiers"], "knee_flex"),
}

# (nom, pattern secondaire, matériel minimum, niveau, coût nerveux 1-3, contre-indications, note)
SQUELETTE = {
    "PH": [
        ("Développé couché barre", None, "B", "I", 3, "ep po", ""),
        ("Développé couché haltères", None, "H", "D", 2, "ep", ""),
        ("Développé incliné haltères", "PV", "H", "D", 2, "ep", "Banc à 30° : en dessous de 45°, la poussée reste horizontale."),
        ("Chest press machine", None, "B", "D", 1, "", ""),
        ("Développé machine convergente", None, "B", "D", 1, "", ""),
        ("Floor press haltères", None, "H", "D", 1, "", "Sans banc : allongé au sol, amplitude réduite, épaules ménagées."),
        ("Pompes", None, "P", "D", 1, "po", ""),
        ("Pompes sur les genoux", None, "P", "D", 1, "po", ""),
        ("Dips (poids de corps)", None, "B", "I", 2, "ep co", "Classé en poussée horizontale (décision du 10/11/2026)."),
        ("Dips machine assistée", None, "B", "D", 1, "ep", ""),
        ("Développé pectoraux élastique", None, "H", "D", 1, "", ""),
    ],
    "PV": [
        ("Développé militaire barre (OHP)", None, "B", "I", 3, "ep dos po", ""),
        ("Développé militaire assis haltères", None, "H", "D", 2, "ep", ""),
        ("Développé Arnold", None, "H", "I", 2, "ep", ""),
        ("Développé épaules machine", None, "B", "D", 1, "ep", ""),
        ("Développé landmine unilatéral", "PH", "C", "D", 1, "", "Trajectoire en arc : souvent bien tolérée par les épaules sensibles."),
        ("Développé épaules élastique", None, "H", "D", 1, "", ""),
        ("Pompes pike (épaules)", None, "P", "I", 1, "ep po", ""),
        ("Pompes pike pieds surélevés", None, "P", "I", 2, "ep po", ""),
        ("Pompes en équilibre (handstand push-up)", None, "P", "A", 3, "ep po co", ""),
    ],
    "TH": [
        ("Rowing penché debout à la barre", "CH", "B", "I", 3, "dos", ""),
        ("Rowing haltère unilatéral", None, "H", "D", 1, "", ""),
        ("Chest supported row (haltères)", None, "H", "D", 1, "", "Buste calé sur un banc incliné : le bas du dos ne travaille pas."),
        ("Chest supported row machine", None, "B", "D", 1, "", ""),
        ("Rowing assis machine", None, "B", "D", 1, "", ""),
        ("Tirage horizontal poulie prise serrée", None, "B", "D", 1, "", ""),
        ("Rowing australien (barre basse)", None, "B", "D", 1, "", "Inverted row : barre de Smith ou barre posée bas dans un rack."),
        ("Rowing inversé sous une table", None, "P", "D", 1, "", "Solution maison sans matériel : une table solide suffit."),
        ("Rowing aux anneaux", None, "CT", "I", 1, "", "Anneaux ou sangles accrochés à une barre de traction."),
        ("Rowing élastique", None, "H", "D", 1, "", ""),
    ],
    "TV": [
        ("Tractions pronation (poids de corps)", None, "T", "I", 2, "ep co", ""),
        ("Tractions supination (chin-up)", None, "T", "I", 2, "co po", ""),
        ("Tractions lestées (pronation)", None, "B", "A", 3, "ep co", ""),
        ("Tractions assistées élastique", None, "T", "D", 1, "", ""),
        ("Tractions négatives 3-5 s", None, "T", "D", 2, "co", "Monter en sautant, descendre lentement : la voie vers la première traction."),
        ("Tractions machine assistée", None, "B", "D", 1, "", ""),
        ("Tirage vertical poulie", None, "B", "D", 1, "", ""),
        ("Tirage vertical élastique", None, "H", "D", 1, "", "Solution maison sans barre de traction : élastique fixé en hauteur."),
        ("Pull-over poulie haute", None, "B", "I", 1, "ep", "Classé en tirage vertical (décision du 10/11/2026)."),
        ("Pull-over haltère", None, "H", "I", 1, "ep", "Classé en tirage vertical (décision du 10/11/2026)."),
    ],
    "SG": [
        ("Hack squat machine", None, "C", "I", 2, "ge", ""),
        ("Front squat", None, "B", "A", 3, "ge po dos", ""),
        ("Squat barre haute (high bar)", None, "B", "I", 3, "ge dos", ""),
        ("Squat talons surélevés haltères", None, "H", "D", 1, "ge", "Talons surélevés : buste plus droit, genoux qui avancent. Utile si les chevilles sont raides."),
        ("Goblet squat", None, "H", "D", 1, "ge", ""),
        ("Leg press pieds bas (focus quadriceps)", None, "B", "D", 2, "ge", ""),
        ("Bulgarian split squat haltères", None, "H", "I", 2, "ge", "Split squat : pied avant proche, buste droit."),
        ("Fentes avant haltères", None, "H", "D", 2, "ge", "Fente courte : petite foulée, genou qui avance."),
        ("Squat poids de corps", None, "P", "D", 1, "", ""),
        ("Fentes bulgares poids de corps", None, "P", "D", 1, "ge", ""),
        ("Pistol squat assisté", None, "P", "I", 2, "ge ch", ""),
    ],
    "SH": [
        ("Squat barre basse (low bar)", None, "B", "A", 3, "dos ep ha", ""),
        ("Box squat barre", None, "B", "I", 3, "dos ha", ""),
        ("Leg press pieds hauts (focus fessiers)", None, "B", "D", 2, "ha", ""),
        ("Squat Smith pieds avancés", None, "B", "D", 2, "", ""),
        ("Fentes inversées haltères", None, "H", "D", 2, "", "Fente longue : grande foulée arrière, buste penché vers l'avant."),
        ("Fentes marchées haltères", None, "H", "I", 2, "ge", "Fente longue : grande foulée, buste penché vers l'avant."),
        ("Squat sumo haltère", None, "H", "D", 1, "ha", ""),
        ("Fentes arrière poids de corps", None, "P", "D", 1, "", "Grande foulée arrière, buste penché vers l'avant."),
        ("Squat sumo poids de corps", None, "P", "D", 1, "ha", ""),
    ],
    "CH": [
        ("Soulevé de terre", None, "B", "A", 3, "dos", ""),
        ("Soulevé de terre trap bar", None, "C", "I", 3, "dos", ""),
        ("Soulevé de terre roumain barre", None, "B", "I", 3, "dos", ""),
        ("Soulevé de terre roumain haltères", None, "H", "D", 2, "dos", ""),
        ("Soulevé de terre roumain unilatéral poids de corps", None, "P", "D", 1, "", ""),
        ("Good morning", None, "B", "A", 3, "dos", ""),
        ("Hip thrust barre", None, "B", "I", 2, "", "Classé en charnière de hanche (décision du 10/11/2026)."),
        ("Hip thrust haltère", None, "H", "D", 1, "", ""),
        ("Hip thrust unilatéral", None, "P", "D", 1, "", ""),
        ("Pont fessier au sol", None, "P", "D", 1, "", ""),
        ("45° back extension (focus ischios)", None, "B", "D", 1, "", ""),
    ],
    "FG": [
        ("Leg curl assis", None, "B", "D", 1, "", ""),
        ("Leg curl allongé", None, "B", "D", 1, "", ""),
        ("Glute-ham raise", None, "C", "A", 2, "", ""),
        ("Nordic hamstring curl", None, "P", "A", 2, "ge", "Maison : pieds calés sous un canapé ou tenus par un partenaire."),
        ("Nordic excentrique assisté (mains au sol)", None, "P", "I", 2, "ge", "Descente lente, les mains amortissent en bas et aident à remonter."),
        ("Leg curl glissé au sol (serviette)", None, "P", "D", 1, "", "Maison : talons sur une serviette (sol lisse) ou des patins."),
        ("Leg curl glissé unilatéral (serviette)", None, "P", "A", 1, "", "Même mouvement sur une jambe quand la version à deux jambes devient facile."),
        ("Pont ischios marché (walkout)", None, "P", "D", 1, "", "En pont fessier, éloigner les talons à petits pas puis revenir."),
        ("Leg curl ballon suisse", None, "H", "I", 1, "", ""),
        ("Leg curl haltère allongé", None, "H", "I", 1, "", "Haltère serré entre les pieds, à plat ventre sur un banc ou au sol."),
        ("Leg curl élastique", None, "H", "D", 1, "", ""),
    ],
}
# (nom, pattern secondaire, matériel minimum, niveau, coût nerveux, contre-indications, note)
ISOLATION = {
    "biceps": [
        ("Curl barre EZ", None, "B", "D", 1, "co po", ""),
        ("Curl incliné assis haltères", None, "H", "D", 1, "ep", ""),
        ("Curl marteau haltères", None, "H", "D", 1, "", ""),
    ],
    "triceps": [
        ("Extension triceps corde poulie", None, "B", "D", 1, "", ""),
        ("Skullcrusher haltères", None, "H", "I", 1, "co", ""),
        ("Extension nuque haltère à deux mains", None, "H", "D", 1, "co ep", ""),
        ("Pompes diamant", "PH", "P", "I", 1, "po co", ""),
    ],
    "elevations_laterales": [
        ("Élévation latérale haltères", None, "H", "D", 1, "", ""),
        ("Élévation latérale unilatérale poulie", None, "B", "D", 1, "", ""),
        ("Élévation latérale élastique", None, "H", "D", 1, "", ""),
    ],
    "deltoides_posterieurs": [
        ("Face pull", None, "B", "D", 1, "", ""),
        ("Oiseau haltères buste penché", None, "H", "D", 1, "", ""),
        ("Reverse pec deck", None, "B", "D", 1, "", ""),
        ("Band pull-apart", None, "H", "D", 1, "", ""),
    ],
    "mollets": [
        ("Mollets debout machine", None, "B", "D", 1, "ch", ""),
        ("Mollets assis machine (soléaire)", None, "B", "D", 1, "ch", ""),
        ("Mollets debout unilatéral (poids de corps)", None, "P", "D", 1, "ch", ""),
    ],
    "abdos": [
        ("Gainage planche", None, "P", "D", 1, "", ""),
        ("Dead bug", None, "P", "D", 1, "", ""),
        ("Crunch poulie", None, "B", "D", 1, "", ""),
        ("Relevé de jambes suspendu", None, "T", "I", 1, "ep", ""),
    ],
    "avant_bras": [
        ("Curl inversé barre", None, "B", "D", 1, "po", ""),
        ("Flexion poignet haltères", None, "H", "D", 1, "po", ""),
        ("Suspension à la barre (dead hang)", None, "T", "D", 1, "ep", ""),
    ],
}
MODULES = {
    "unilateral": [
        ("Step-up haltères", "SG", "H", "D", 1, "ge", ""),
        ("Fentes latérales haltère", "SH", "H", "I", 1, "ha ge", ""),
        ("Squat cosaque", "SH", "P", "I", 1, "ha ge", ""),
    ],
    "portes": [
        ("Farmers walk", None, "H", "D", 2, "", ""),
        ("Suitcase carry (porté unilatéral)", None, "H", "D", 1, "", ""),
    ],
    "rotation": [
        ("Pallof press poulie", None, "B", "D", 1, "", "Anti-rotation."),
        ("Pallof press élastique", None, "H", "D", 1, "", "Anti-rotation."),
        ("Woodchopper poulie", None, "B", "I", 1, "dos", "Rotation."),
    ],
    "cardio": [
        ("Marche inclinée tapis", None, "B", "D", 1, "", ""),
        ("Vélo zone 2", None, "B", "D", 1, "", ""),
        ("Corde à sauter", None, "H", "D", 1, "ch ge", ""),
    ],
    "mobilite": [
        ("Mobilité de cheville genou au mur", None, "P", "D", 1, "", ""),
        ("Mobilité 90/90 des hanches", None, "P", "D", 1, "", ""),
        ("World's greatest stretch", None, "P", "D", 1, "", ""),
    ],
}


def slug(s):
    s = unicodedata.normalize("NFD", s.lower().replace("°", ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def rows():
    out, errs = [], []
    def add(nom, pp, ps, couche, cat, mat, niv, cn, ci, note):
        f = FICHES.get(nom)
        if not f and nom not in NOUVEAUX:
            errs.append(f"nom absent de data/fiches.json : {nom}")
            return
        if mat == "H" and ("élastique" in nom.lower() or nom == "Band pull-apart"):
            mat = "E"  # les exercices à l'élastique ont leur propre option de matériel
        mus, fam = (f.get("mus") or [], f["fam"]) if f else NOUVEAUX[nom]
        out.append({
            "slug": slug(nom), "nom": nom, "pattern_principal": pp, "pattern_secondaire": ps, "couche": couche, "categorie": cat,
            "muscles": mus, "materiel": LIEUX[mat], "niveau": NIV[niv], "cout_nerveux": cn, "variantes": [],
            "contre_indications": [ZONES[z] for z in ci.split()], "video_url": None, "note": note or None, "actif": True, "_fam": fam,
        })
    for pp, l in SQUELETTE.items():
        for (nom, ps, mat, niv, cn, ci, note) in l: add(nom, pp, ps, "squelette", None, mat, niv, cn, ci, note)
    for cat, l in ISOLATION.items():
        for (nom, ps, mat, niv, cn, ci, note) in l: add(nom, None, ps, "isolation", cat, mat, niv, cn, ci, note)
    for cat, l in MODULES.items():
        for (nom, ps, mat, niv, cn, ci, note) in l: add(nom, None, ps, "module", cat, mat, niv, cn, ci, note)
    slugs = [r["slug"] for r in out]
    for s in {s for s in slugs if slugs.count(s) > 1}: errs.append(f"doublon : {s}")
    if errs: sys.exit("\n".join(errs))
    # Variantes liées : même pattern (ou même catégorie hors squelette) et même famille de fiche
    key = lambda r: (r["pattern_principal"] or r["categorie"], r["_fam"])
    for r in out: r["variantes"] = [o["slug"] for o in out if o is not r and key(o) == key(r)]
    for r in out: del r["_fam"]
    return out


def q(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, int): return str(v)
    if isinstance(v, list): return "array[" + ", ".join(q(x) for x in v) + "]::text[]"
    return "'" + str(v).replace("'", "''") + "'"


COLS = ["slug", "nom", "pattern_principal", "pattern_secondaire", "couche", "categorie", "muscles", "materiel", "niveau", "cout_nerveux", "variantes", "contre_indications", "video_url", "note", "actif"]

if __name__ == "__main__":
    R = rows()
    (ROOT / "data/exercices.json").write_text(json.dumps({"v": 1, "ex": R}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    sql = [
        "-- Bibliothèque de départ : exercices classés selon les 8 patterns.",
        "-- Fichier généré par tools/exercices/build.py : ne pas le modifier à la main.",
        "-- Sans danger à relancer : un exercice déjà présent (même slug) n'est ni modifié ni dupliqué,",
        "-- donc les réglages faits ensuite par le coach (vidéo, actif) ne sont jamais écrasés.",
        "",
        f"insert into public.cxs_exercices ({', '.join(COLS)}) values",
        ",\n".join("  (" + ", ".join(q(r[c]) for c in COLS) + ")" for r in R),
        "on conflict (slug) do nothing;",
        "",
    ]
    (ROOT / "supabase/migrations/2026-11-10_cxs_exercices_seed.sql").write_text("\n".join(sql), encoding="utf-8")
    from collections import Counter
    print(len(R), "exercices")
    print(dict(Counter(r["pattern_principal"] or r["couche"] for r in R)))
