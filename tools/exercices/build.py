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
    auto(out, {r["nom"] for r in out})
    slugs = [r["slug"] for r in out]
    for s in {s for s in slugs if slugs.count(s) > 1}: errs.append(f"doublon : {s}")
    if errs: sys.exit("\n".join(errs))
    # Variantes liées : même pattern (ou même catégorie hors squelette) et même famille de fiche
    key = lambda r: (r["pattern_principal"] or r["categorie"], r["_fam"])
    for r in out: r["variantes"] = [o["slug"] for o in out if o is not r and key(o) == key(r)]
    for r in out: del r["_fam"]; pass
    return out

# ---------------------------------------------------------------------------------------------------------------
# Classement automatique de TOUS les exercices des fiches qui ne sont pas dans les listes ci-dessus.
# Les catégories sont fixes, les exercices non : chaque exercice des fiches doit pouvoir sortir dans un programme.
# Règles : famille de fiche -> pattern (ou catégorie d'isolation / de module), matériel d'après l'équipement de la fiche,
# niveau et coût nerveux d'après le mot-clé du nom. Les 120 premiers (classés à la main) ne sont jamais modifiés.
# ---------------------------------------------------------------------------------------------------------------
BARRE_TRACTION = re.compile(r"traction|muscle-up|suspension|toes to bar|front lever|back lever|skin the cat|drapeau|dragon flag|suspendu|L-sit \(parallèles\)|Pull-up|Scapular pull", re.I)
SPECIAL = re.compile(r"pendulum|belt squat|V-squat|reverse hyper|hack squat inversé|donkey|glute-ham|Jefferson|Presse horizontale|Safety bar|trap bar|traîneau|prowler", re.I)
AVANCE = re.compile(r"lesté|Larsen|Spoto|déficit|anneaux|archer|claquées|pistol|shrimp|muscle-up|snatch|à un bras|pseudo|planche|board press|pin press|élastiques\)|avec élastiques|Anderson|handstand|équilibre libre|front lever|back lever|drapeau|dragon|Swiss|prise arrachée|Épaulé|typewriter|L-sit|Skin|Reverse Nordic|Sissy|Bradford|Jefferson|Kroc|Meadows|Pendlay|JM press|Tate|Cuban|haltères neutre", re.I)
DEBUT = re.compile(r"machine|poulie|élastique|genoux|assisté|goblet|poids de corps|haltères|Chest|Leg (press|extension|curl)|Crunch|Gainage|Planche|Cat-camel|Bird dog|pont|Pompes$|Squat haltères|Fentes", re.I)
TECH = re.compile(r"pause|tempo|Spoto|Larsen|déficit|sécurités|planches|blocs|avec élastiques|prise arrachée|Anderson|pin press|board press|Swiss|claquées|archer|pseudo|à un bras|négatifs|explosi|lockout|départ bras tendus|jambes tendues|1 bras|Zercher|Safety|Landmine|landmine", re.I)

def _mat(nom, eq):
    if re.search(r"élastique", nom, re.I) or eq == "Élastique": return "E"
    if BARRE_TRACTION.search(nom): return "T"
    if eq in ("Poids de corps", "Autre") and re.search(r"^Dips|Straight bar dips|Dips buste|Dips (lestés|pause|négatifs)", nom): return "B"
    if eq == "Anneaux": return "T"
    if eq == "Trap bar": return "C"
    if eq in ("Machine", "Smith", "Poulie", "Barre", "Landmine"): return "C" if SPECIAL.search(nom) else "B"
    if eq in ("Haltères", "Kettlebell", "Lest"): return "H"
    if eq == "Autre": return "H" if re.search(r"ballon|médecine|step|disque", nom, re.I) else "B"
    return "P"

def _niv(nom, eq):
    if AVANCE.search(nom): return "A"
    if eq in ("Barre", "Trap bar") or re.search(r"pause|tempo|Smith|Zercher|sumo|Rack pull|Safety|Z-press|Push press|Thruster|kettlebell|unilatéral|Bulgarian|Fentes bulgares|Step-up|Fentes croisées|Dips|Kettlebell", nom, re.I): return "I"
    if DEBUT.search(nom) or eq in ("Machine", "Poulie", "Élastique", "Haltères"): return "D"
    return "I"

def _cn(nom, eq, niv, couche):
    if couche != "squelette": return 1
    if eq in ("Barre", "Trap bar") and re.search(r"squat|soulev|militaire|couché|Rowing|Rack|Push press|Good morning|Épaulé|Développé", nom, re.I): return 3
    if eq in ("Barre", "Trap bar", "Smith", "Landmine", "Haltères", "Kettlebell", "Lest") : return 2
    return 2 if niv == "A" else 1

# famille -> (pattern, couche, catégorie) ; None = règle spéciale dans _classe
FAM = {
    "squat": ("SG", "squelette", None), "presse": ("SG", "squelette", None), "squat_bw": ("SG", "squelette", None),
    "bench": ("PH", "squelette", None), "incline": ("PH", "squelette", None), "dips": ("PH", "squelette", None),
    "ohp": ("PV", "squelette", None), "row": ("TH", "squelette", None), "vpull": ("TV", "squelette", None), "pullover": ("TV", "squelette", None),
    "hinge": ("CH", "squelette", None), "bridge": None, "swing": None, "back_ext": ("CH", "squelette", None), "knee_flex": ("FG", "squelette", None),
    "unilateral": None, "knee_ext": (None, "isolation", "quadriceps"), "hip_abd": None,
    "fly": (None, "isolation", "pectoraux"), "triceps": (None, "isolation", "triceps"), "curl": (None, "isolation", "biceps"),
    "forearm": (None, "isolation", "avant_bras"), "lateral": (None, "isolation", "elevations_laterales"), "rear": (None, "isolation", "deltoides_posterieurs"),
    "cuff": (None, "isolation", "coiffe"), "front_raise": (None, "isolation", "epaules_avant"), "shrug": (None, "isolation", "trapezes"),
    "calf": (None, "isolation", "mollets"), "abs_flex": (None, "isolation", "abdos"), "anti": (None, "isolation", "abdos"),
    "rotation": (None, "module", "rotation"), "carry": (None, "module", "portes"), "mob": (None, "module", "mobilite"), "cond": (None, "module", "cardio"),
    "muscleup": (None, "module", "skills"), "skill": (None, "module", "skills"),
}

def _classe(nom, fam):
    """(pattern, secondaire, couche, catégorie)"""
    if fam == "presse": return ("SH" if re.search(r"inversé", nom) else "SG", None, "squelette", None)
    if fam == "squat": return ("SH" if re.search(r"Anderson|sumo", nom) else "SG", "PV" if re.search(r"Thruster", nom) else None, "squelette", None)
    if fam == "incline": return ("PH", "PV", "squelette", None)
    if fam == "bridge":
        if re.search(r"Kickback", nom): return (None, None, "isolation", "fessiers")
        return ("CH", None, "squelette", None)
    if fam == "swing":
        if re.search(r"swing|pull-through", nom): return ("CH", None, "squelette", None)
        return (None, None, "module", "puissance")
    if fam == "unilateral":
        if re.search(r"arrière|croisées|curtsy|marchées", nom): return ("SH", None, "squelette", None)
        return ("SG", None, "squelette", None)
    if fam == "hip_abd":
        return (None, None, "isolation", "adducteurs" if re.search(r"Adduction|Copenhagen", nom) else "fessiers")
    if fam == "anti" and re.search(r"rotation", nom, re.I): return (None, None, "module", "rotation")
    if fam == "shrug" and re.search(r"cou", nom, re.I): return (None, None, "isolation", "trapezes")
    p, c, k = FAM[fam]
    return (p, None, c, k)

def auto(out, deja):
    ci_famille = {}
    from collections import Counter, defaultdict
    cnt = defaultdict(Counter)
    for r in out: cnt[r["_fam"]][tuple(r["contre_indications"])] += 1
    for fam, c in cnt.items(): ci_famille[fam] = list(c.most_common(1)[0][0])
    CI_DEF = {"knee_ext": ["genou"], "hip_abd": [], "swing": ["bas_du_dos"], "fly": ["epaule"], "shrug": [], "cuff": [], "front_raise": ["epaule"],
              "muscleup": ["epaule", "coude"], "skill": ["epaule", "poignet"], "pullover": ["epaule"], "unilateral": ["genou"], "mob": [], "cond": []}
    for nom, f in FICHES.items():
        if nom in deja: continue
        fam = f["fam"]
        if fam not in FAM: continue
        pp, ps, couche, cat = _classe(nom, fam)
        eq = f.get("eq") or ""
        mat = _mat(nom, eq); niv = _niv(nom, eq)
        ci = list(ci_famille.get(fam, CI_DEF.get(fam, [])))
        if fam in ("squat", "presse", "squat_bw", "unilateral", "knee_ext") and "genou" not in ci: ci.append("genou")
        if re.search(r"sauté|saut |box jump|Burpees|Sprints", nom, re.I) and "cheville" not in ci: ci.append("cheville")
        if re.match(r"Pompes|Planche|Gainage|Body saw|Mountain|Burpees", nom) and "poignet" not in ci: ci.append("poignet")
        if re.match(r"Pompes|Dips|Straight bar dips", nom) and "epaule" not in ci: ci.append("epaule")
        if fam == "dips" and "coude" not in ci: ci.append("coude")
        if fam == "hinge" and eq in ("Barre", "Trap bar") and "bas_du_dos" not in ci: ci.append("bas_du_dos")
        if re.search(r"Jefferson|Good morning", nom) and "bas_du_dos" not in ci: ci.append("bas_du_dos")
        if fam == "forearm" and "poignet" not in ci: ci.append("poignet")
        out.append({
            "slug": slug(nom), "nom": nom, "pattern_principal": pp, "pattern_secondaire": ps, "couche": couche, "categorie": cat,
            "muscles": f.get("mus") or [], "materiel": LIEUX[mat], "niveau": NIV[niv], "cout_nerveux": _cn(nom, eq, niv, couche), "variantes": [],
            "contre_indications": sorted(set(ci)), "video_url": None, "note": None, "actif": True, "_fam": fam,
            "_auto": True,
        })


def q(v):
    if v is None: return "null"
    if isinstance(v, bool): return "true" if v else "false"
    if isinstance(v, int): return str(v)
    if isinstance(v, list): return "array[" + ", ".join(q(x) for x in v) + "]::text[]"
    return "'" + str(v).replace("'", "''") + "'"


CATS_SQL = ['biceps', 'triceps', 'elevations_laterales', 'deltoides_posterieurs', 'mollets', 'abdos', 'avant_bras', 'pectoraux', 'quadriceps', 'fessiers', 'adducteurs', 'trapezes', 'epaules_avant', 'coiffe',
            'unilateral', 'portes', 'rotation', 'cardio', 'mobilite', 'puissance', 'skills']
COLS = ["slug", "nom", "pattern_principal", "pattern_secondaire", "couche", "categorie", "muscles", "materiel", "niveau", "cout_nerveux", "variantes", "contre_indications", "video_url", "note", "actif"]

if __name__ == "__main__":
    R = rows()
    auto_slugs = {r["slug"] for r in R if r.pop("_auto", False)}
    (ROOT / "data/exercices.json").write_text(json.dumps({"v": 2, "ex": R}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    def inserts(lst):
        return ",\n".join("  (" + ", ".join(q(r[c]) for c in COLS) + ")" for r in lst)
    base = [r for r in R if r["slug"] not in auto_slugs]
    sql = [
        "-- Bibliothèque de départ : exercices classés selon les 8 patterns.",
        "-- Fichier généré par tools/exercices/build.py : ne pas le modifier à la main.",
        "-- Sans danger à relancer : un exercice déjà présent (même slug) n'est ni modifié ni dupliqué,",
        "-- donc les réglages faits ensuite par le coach (vidéo, actif) ne sont jamais écrasés.",
        "",
        f"insert into public.cxs_exercices ({', '.join(COLS)}) values",
        inserts(base),
        "on conflict (slug) do nothing;",
        "",
    ]
    (ROOT / "supabase/migrations/2026-11-10_cxs_exercices_seed.sql").write_text("\n".join(sql), encoding="utf-8")
    cats = ", ".join(f"'{c}'" for c in CATS_SQL)
    sql2 = [
        "-- Bibliothèque complète : tous les exercices des fiches sont rattachés à une catégorie (squelette, isolation ou module).",
        "-- Fichier généré par tools/exercices/build.py : ne pas le modifier à la main.",
        "-- 1) élargit la liste des catégories d'isolation et de modules autorisées (aucune ligne existante n'est touchée) ;",
        "-- 2) ajoute les exercices manquants. Sans danger à relancer : un slug déjà présent n'est ni modifié ni dupliqué.",
        "",
        "alter table public.cxs_exercices drop constraint if exists cxs_exercices_categorie_check;",
        f"alter table public.cxs_exercices add constraint cxs_exercices_categorie_check check (categorie is null or categorie in ({cats}));",
        "",
        f"insert into public.cxs_exercices ({', '.join(COLS)}) values",
        inserts([r for r in R if r["slug"] in auto_slugs]),
        "on conflict (slug) do nothing;",
        "",
    ]
    (ROOT / "supabase/migrations/2026-11-11_cxs_exercices_complet.sql").write_text("\n".join(sql2), encoding="utf-8")
    # Liste des exercices « de base » (classés à la main) : le générateur les propose avant les variantes plus rares
    bs = sorted(r["slug"] for r in R if r["slug"] not in auto_slugs)
    (ROOT / "js/exercices-base.js").write_text("// Fichier généré par tools/exercices/build.py : ne pas le modifier à la main.\n// Exercices de base (classés à la main) ; les autres sont des variantes, disponibles mais proposées après.\nexport const BASE = new Set(" + json.dumps(bs, ensure_ascii=False) + ");\n", encoding="utf-8")
    from collections import Counter
    print(len(R), "exercices dont", len(auto_slugs), "classés automatiquement")
    print(dict(Counter(r["pattern_principal"] or r["couche"] for r in R)))
    print(dict(Counter(r["categorie"] for r in R if r["categorie"])))
