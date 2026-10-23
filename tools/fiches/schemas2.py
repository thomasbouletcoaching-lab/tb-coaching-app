# -*- coding: utf-8 -*-
# Schémas propres à certains exercices, quand le dessin de la famille ne correspond pas au mouvement
# (ex. back extension dessinée comme un soulevé de terre). Silhouettes construites par angles de segments
# pour garder des proportions constantes. Angles en degrés : 0 = vers la droite, 90 = vers le bas, -90 = vers le haut.
import math
from schemas import s

TR, HD, TH, SH, UA, FA, FT = 56, 16, 46, 47, 31, 29, 20
def _p(o, a, l): r = math.radians(a); return (round(o[0] + l * math.cos(r), 1), round(o[1] + l * math.sin(r), 1))

def side(hip, tr, th, sh, ua, fa, th2=None, sh2=None, ua2=None, fa2=None, ft=0, ft2=None, hd=None):
    """Silhouette de profil (regard vers la droite par défaut). ft / ft2 = angle du pied (None : pas de pied)."""
    P = dict(hip=hip); P["shoulder"] = _p(hip, tr, TR); P["head"] = _p(P["shoulder"], tr if hd is None else hd, HD)
    P["elbow"] = _p(P["shoulder"], ua, UA); P["wrist"] = _p(P["elbow"], fa, FA)
    P["knee"] = _p(hip, th, TH); P["ankle"] = _p(P["knee"], sh, SH)
    if ft is not None: P["toe"] = _p(P["ankle"], ft, FT)
    if th2 is not None:
        P["knee2"] = _p(hip, th2, TH); P["ankle2"] = _p(P["knee2"], sh2, SH)
        if ft2 is not None: P["toe2"] = _p(P["ankle2"], ft2, FT)
    if ua2 is not None: P["shoulder2"] = P["shoulder"]; P["elbow2"] = _p(P["shoulder"], ua2, UA); P["wrist2"] = _p(P["elbow2"], fa2, FA)
    return P

def front(cx, py, uaL, faL, uaR, faR, lgL=90, lgR=90, shL=None, shR=None):
    """Silhouette de face : py = hauteur du bassin ; bras gauche/droit (angles du bras et de l'avant-bras), jambes."""
    P = dict(pelvis=(cx, py), neck=(cx, py - 62), head=(cx, py - 78), shoulderL=(cx - 22, py - 58), shoulderR=(cx + 22, py - 58), hipL=(cx - 10, py + 2), hipR=(cx + 10, py + 2))
    P["elbowL"] = _p(P["shoulderL"], uaL, UA); P["wristL"] = _p(P["elbowL"], faL, FA)
    P["elbowR"] = _p(P["shoulderR"], uaR, UA); P["wristR"] = _p(P["elbowR"], faR, FA)
    P["kneeL"] = _p(P["hipL"], lgL, TH); P["ankleL"] = _p(P["kneeL"], lgL if shL is None else shL, SH)
    P["kneeR"] = _p(P["hipR"], lgR, TH); P["ankleR"] = _p(P["kneeR"], lgR if shR is None else shR, SH)
    return P

def mid(a, b, t=.5): return (round(a[0] + (b[0] - a[0]) * t, 1), round(a[1] + (b[1] - a[1]) * t, 1))
def S2(k, A, B, legend=None):
    if legend: s(k, A, B, legend)
    else: s(k, A, B)

STAND = dict(hip=(100, 105), tr=-90, th=90, sh=90)

# ---------- Chaîne postérieure
a = side((128, 108), 80, 135, 135, 240, 350, ft=45); b = side((128, 108), -45, 135, 135, 115, -30, ft=45)
S2("back_ext", dict(t="En bas : buste pendant, levier court", props=[("line", 100, 150, 140, 112), ("line", 50, 196, 80, 168)], pts=a, load=dict(at=mid(a["shoulder"], a["wrist"]), kind="db"), piv=["hip"]),
    dict(t="En haut : corps aligné, levier maximal", props=[("line", 100, 150, 140, 112), ("line", 50, 196, 80, 168)], pts=b, load=dict(at=mid(b["shoulder"], b["wrist"]), kind="db"), piv=["hip"]),
    "Le pivot est la hanche, appuyée sur le boudin : plus le buste se rapproche de l'horizontale, plus la charge fait levier")
a = side((112, 100), 0, 95, 95, 90, 120, ft=150, hd=0); b = side((112, 100), 0, 180, 180, 90, 120, ft=90, hd=0)
S2("reverse_hyper", dict(t="Jambes pendantes", props=[("rect", 104, 104, 92, 12), ("rect", 176, 116, 10, 84)], pts=a, load=dict(at=a["ankle"], r=6), piv=["hip"]),
    dict(t="Jambes à l'horizontale : levier maximal", props=[("rect", 104, 104, 92, 12), ("rect", 176, 116, 10, 84)], pts=b, load=dict(at=b["ankle"], r=6), piv=["hip"]),
    "Le buste est fixe sur le banc : ce sont les jambes qui montent, la hanche est le pivot")
a = side((96, 192), 0, 180, 180, 0, 0, ft=None, hd=0); b = side((96, 190), -14, 194, 190, -16, -16, ft=None, hd=-20)
S2("superman", dict(t="Allongé sur le ventre", pts=a, load=dict(at=mid(a["hip"], a["shoulder"]), kind="body"), piv=[]),
    dict(t="Buste et jambes décollés, tenus", pts=b, load=dict(at=mid(b["hip"], b["shoulder"]), kind="body"), piv=[]),
    "Travail isométrique des extenseurs du dos et des fessiers : décoller peu, tenir longtemps")
a = side((100, 105), -90, 90, 90, 120, -60); b = side((80, 105), -20, 75, 100, 120, -60)
S2("good_morning", dict(t="Debout : barre sur le haut du dos", pts=a, load=dict(at=(a["shoulder"][0] - 2, a["shoulder"][1] - 3)), piv=["hip"]),
    dict(t="Buste penché : levier maximal sur la hanche", pts=b, load=dict(at=(b["shoulder"][0] - 2, b["shoulder"][1] - 4)), piv=["hip"]),
    "La barre est sur les épaules, loin de la hanche quand le buste se penche : charges modérées")
a = side((80, 108), -30, 70, 100, 115, 115); b = side((100, 105), -90, 90, 90, 0, 0)
S2("swing", dict(t="Charnière : la cloche passe entre les jambes", pts=a, load=dict(at=a["wrist"], kind="db"), piv=["hip"]),
    dict(t="Extension explosive : la cloche flotte", pts=b, load=dict(at=b["wrist"], kind="db"), piv=["hip"]),
    "La hanche propulse la charge ; les bras ne lèvent pas la cloche, ils la guident")
a = side((80, 108), -30, 70, 100, 125, 115); b = side((100, 105), -90, 90, 90, 95, 95)
S2("pull_through", dict(t="Charnière : câble entre les jambes", pts=a, load=dict(at=a["wrist"], kind="cable", anchor=(14, 192)), piv=["hip"]),
    dict(t="Hanche verrouillée", pts=b, load=dict(at=b["wrist"], kind="cable", anchor=(14, 192)), piv=["hip"]),
    "Bleu : câble tiré depuis l'arrière et le bas. La résistance reste dans l'axe de la hanche")
a = side((90, 150), -90, 90, 180, 70, -20, ft=160); b = side((122.5, 163.5), -45, 135, 180, 60, 30, ft=160)
S2("nordic", dict(t="À genoux, buste droit : levier nul", props=[("rect", 30, 182, 30, 9)], pts=a, load=dict(at=mid(a["hip"], a["shoulder"], .3), kind="body"), piv=["knee"]),
    dict(t="Penché vers l'avant : les ischios freinent", props=[("rect", 30, 182, 30, 9)], pts=b, load=dict(at=mid(b["hip"], b["shoulder"], .3), kind="body"), piv=["knee"]),
    "Le genou est le pivot : plus le corps descend, plus le poids du corps fait levier sur les ischios")
b = dict(head=(24, 186), shoulder=(40, 190), elbow=(66, 195), wrist=(92, 197), hip=(96, 160), knee=(140, 172), ankle=(186, 190), toe=(196, 174))
a = dict(head=(24, 186), shoulder=(40, 190), elbow=(66, 195), wrist=(92, 197), hip=(96, 150), knee=(138, 140), ankle=(122, 190), toe=(134, 176))
S2("slide_curl", dict(t="Jambes tendues, bassin levé", pts=b, load=dict(at=b["ankle"], kind="body"), piv=["knee"]),
    dict(t="Talons ramenés vers les fesses", pts=a, load=dict(at=a["ankle"], kind="body"), piv=["knee"]),
    "Les talons glissent au sol, le bassin reste haut : les ischios fléchissent le genou et tendent la hanche")

# ---------- Quadriceps
a = side((84, 168), -150, -70, 10, 20, 20, ft=-135, hd=-150); b = side((84, 168), -150, -30, -40, 20, 20, ft=-135, hd=-150)
S2("leg_press", dict(t="Genoux fléchis : levier maximal", props=[("line", 20, 128, 92, 182)], pts=a, load=dict(at=a["ankle"], dir=(-.707, .707), r=6), piv=["hip", "knee"]),
    dict(t="Jambes presque tendues", props=[("line", 20, 128, 92, 182)], pts=b, load=dict(at=b["ankle"], dir=(-.707, .707), r=6), piv=["hip", "knee"]),
    "Bleu : poussée du chariot dans l'axe des rails. Le dos reste plaqué au dossier")
a = side((100, 105), -90, 90, 90, 10, 0); b = side((100.2, 147), -100, 30, 146, 10, 0)
S2("sissy", dict(t="Debout", props=[("line", 150, 70, 150, 200)], pts=a, load=dict(at=mid(a["hip"], a["shoulder"], .2), kind="body"), piv=["knee"]),
    dict(t="Genoux en avant, corps en planche", props=[("line", 150, 70, 150, 200)], pts=b, load=dict(at=mid(b["hip"], b["shoulder"], .2), kind="body"), piv=["knee"]),
    "Le corps reste aligné des genoux à la tête : le poids passe loin derrière le genou, levier maximal sur les quadriceps")
a = side((70, 150), -90, 0, 90, 80, -20); b = side((70, 128), -90, 25, 100, 80, -20)
S2("wall_sit", dict(t="Cuisses parallèles : levier maximal", props=[("rect", 48, 10, 10, 190)], pts=a, load=dict(at=mid(a["hip"], a["knee"], .2), kind="body"), piv=["knee"]),
    dict(t="Plus haut : plus facile", props=[("rect", 48, 10, 10, 190)], pts=b, load=dict(at=mid(b["hip"], b["knee"], .2), kind="body"), piv=["knee"]),
    "Exercice statique : la difficulté se règle avec l'angle du genou")
a = side((95, 110), -85, 25, 83, 90, 90, th2=95, sh2=115, ft2=0); b = side((142, 83), -90, 90, 90, 90, 90, th2=88, sh2=92)
S2("step_up", dict(t="Pied avant sur la box", props=[("rect", 118, 178, 86, 23)], pts=a, load=dict(at=a["wrist"], kind="db"), piv=["knee", "hip"]),
    dict(t="Debout sur la box", props=[("rect", 118, 178, 86, 23)], pts=b, load=dict(at=b["wrist"], kind="db"), piv=["knee"]),
    "Toute la poussée vient de la jambe avant : la jambe arrière ne fait que suivre")
a = side((100, 105), -90, 90, 90, 0, 0, th2=60, sh2=60, ft2=0); b = side((80, 160), -50, -10, 110, -5, 0, th2=-5, sh2=0, ft2=None, hd=-40)
S2("pistol", dict(t="Debout sur une jambe", props=[("line", 196, 20, 196, 200)], pts=a, load=dict(at=mid(a["hip"], a["shoulder"], .2), kind="body"), piv=["knee"]),
    dict(t="En bas : jambe libre tendue devant", props=[("line", 196, 20, 196, 200)], pts=b, load=dict(at=mid(b["hip"], b["shoulder"], .2), kind="body"), piv=["knee", "hip"]),
    "Une seule jambe porte tout le poids du corps : l'appui (sangle, poteau) aide l'équilibre, pas l'effort")

# ---------- Hanches
a = side((110, 150), 196, 8, 0, 100, 90, th2=20, sh2=0, ft=None, ft2=None, hd=196)
a = dict(head=a["head"], shoulder=a["shoulder"], hip=a["hip"], elbow=a["elbow"], wrist=a["wrist"], knee=(146, 150), ankle=(190, 146), knee2=(146, 166), ankle2=(186, 178))
b = dict(a); b.update(hip=(112, 162), knee=(148, 156), ankle=(190, 146), knee2=(146, 176), ankle2=(186, 192))
S2("copenhagen", dict(t="Planche latérale, jambe haute sur le banc", props=[("rect", 168, 140, 40, 12)], pts=a, load=dict(at=a["hip"], kind="body"), piv=[]),
    dict(t="Bassin qui descend : les adducteurs retiennent", props=[("rect", 168, 140, 40, 12)], pts=b, load=dict(at=b["hip"], kind="body"), piv=[]),
    "La jambe haute, posée sur le banc, porte le corps : les adducteurs travaillent pour garder le bassin aligné")
a = side((100, 105), -85, 95, 85, 10, 30, th2=95, sh2=88); b = side((100, 105), -80, 140, 110, 10, 30, th2=92, sh2=88)
S2("kickback_glute", dict(t="Jambe sous la hanche", props=[("line", 150, 70, 150, 200)], pts=a, load=dict(at=a["ankle"], kind="cable", anchor=(196, 196)), piv=["hip"]),
    dict(t="Jambe tendue vers l'arrière", props=[("line", 150, 70, 150, 200)], pts=b, load=dict(at=b["ankle"], kind="cable", anchor=(196, 196)), piv=["hip"]),
    "Bleu : câble accroché à la cheville. Le bassin reste fixe : seule la hanche s'étend")
a = side((90, 186), -150, 0, 0, -150, 0, ft=None, hd=-150); b = side((90, 140), -150, 30, 60, -150, 0, ft=None, hd=-150)
a = dict(head=(24, 186), shoulder=(40, 190), hip=(96, 192), elbow=(66, 195), wrist=(92, 197), knee=(134, 166), ankle=(142, 196), toe=(160, 198))
b = dict(head=a["head"], shoulder=a["shoulder"], hip=(100, 150), elbow=(30, 196), wrist=(52, 198), knee=(140, 152), ankle=(142, 196), toe=(160, 198))
S2("bridge", dict(t="Bassin au sol", pts=a, load=dict(at=(a["hip"][0], a["hip"][1] - 8)), piv=[]),
    dict(t="En haut : épaules, hanches et genoux alignés", pts=b, load=dict(at=(b["hip"][0], b["hip"][1] - 8)), piv=[]),
    "Appui sur le haut du dos au sol (pas sur un banc) : amplitude plus courte que le hip thrust")

# ---------- Poussées
def pushup(hip_y, sh_y, t):
    P = dict(head=(178, sh_y - 10), shoulder=(160, sh_y), hip=(100, hip_y), knee=(60, (hip_y + 196) / 2 + 3), ankle=(18, 196), toe=(10, 200))
    if sh_y > 170: P.update(elbow=(140, 168), wrist=(160, 198))
    else: P.update(elbow=(160, sh_y + 31), wrist=(160, 198))
    return dict(t=t, pts=P, load=dict(at=(100, hip_y), kind="body"), piv=["shoulder"])
a = pushup(158, 125, "Bras tendus"); b = pushup(181, 172, "Poitrine près du sol : levier maximal")
a["piv"] = []; b["piv"] = []
S2("pushup", a, b, "Le corps reste gainé comme une planche ; pieds surélevés ou lest = plus de charge sur les bras")
a = side((128, 156), -125, 0, 90, -60, -60, hd=-125); b = side((128, 156), -125, 0, 90, -10, -100, hd=-125)
S2("incline", dict(t="Bras tendus", props=[("line", 60, 70, 128, 168), ("rect", 118, 160, 40, 10)], pts=a, load=dict(at=a["wrist"]), piv=["shoulder"]),
    dict(t="Barre au haut de la poitrine", props=[("line", 60, 70, 128, 168), ("rect", 118, 160, 40, 10)], pts=b, load=dict(at=b["wrist"]), piv=["shoulder", "elbow"]),
    "Dossier incliné : la poussée part plus vers le haut, le haut des pectoraux et l'avant d'épaule participent plus")
a = side((60, 110), -90, 0, 90, 110, 90, ft=0); b = side((60, 150), -86, 0, 90, 160, 90, ft=0)
S2("bench_dip", dict(t="Bras tendus, mains sur la chaise", props=[("rect", 28, 140, 34, 8), ("rect", 28, 148, 6, 52)], pts=a, load=dict(at=a["hip"], kind="body"), piv=["elbow"]),
    dict(t="En bas : épaule plus basse que le coude", props=[("rect", 28, 140, 34, 8), ("rect", 28, 148, 6, 52)], pts=b, load=dict(at=b["hip"], kind="body"), piv=["elbow"]),
    "Amplitude à limiter si l'avant de l'épaule tire ; jambes fléchies = plus facile")

# ---------- Tirages et épaules
a = side((100, 105), -90, 90, 90, -40, -40); b = side((100, 105), -90, 90, 90, 100, 100)
S2("straight_arm", dict(t="Bras devant, à hauteur des yeux", pts=a, load=dict(at=a["wrist"], kind="cable", anchor=(196, 14)), piv=["shoulder"]),
    dict(t="Bras le long des cuisses", pts=b, load=dict(at=b["wrist"], kind="cable", anchor=(196, 14)), piv=["shoulder"]),
    "Bras tendus du début à la fin : seul l'épaule bouge, le grand dorsal ramène les bras")
a = side((100, 105), -90, 90, 90, -100, 110); b = side((100, 105), -90, 90, 90, -100, -80)
S2("overhead_ext", dict(t="Coude fléchi derrière la tête : triceps étiré", pts=a, load=dict(at=a["wrist"], kind="db"), piv=["elbow"]),
    dict(t="Bras tendu au-dessus de la tête", pts=b, load=dict(at=b["wrist"], kind="db"), piv=["elbow"]),
    "Bras au-dessus de la tête, le long chef du triceps travaille en position étirée")
L = [("rect", 40, 148, 140, 12)]
a = side((140, 142), 180, 0, 90, -90, -90, ft=0, hd=180); b = side((140, 142), 180, 0, 90, -100, 160, ft=0, hd=180)
S2("skull", dict(t="Bras tendus au-dessus du front", props=L, pts=a, load=dict(at=a["wrist"]), piv=["elbow"]),
    dict(t="Coudes fléchis, charge près du front", props=L, pts=b, load=dict(at=b["wrist"]), piv=["elbow"]),
    "Le bras reste quasi immobile : seul le coude fléchit et s'étend")
a = side((84, 118), -30, 75, 100, 170, 90); b = side((84, 118), -30, 75, 100, 170, 170)
S2("tri_kickback", dict(t="Avant-bras vertical : levier nul", pts=a, load=dict(at=a["wrist"], kind="db"), piv=["elbow"]),
    dict(t="Bras tendu vers l'arrière : levier maximal", pts=b, load=dict(at=b["wrist"], kind="db"), piv=["elbow"]),
    "Le bras reste collé au buste ; avec un haltère, la difficulté est bras tendu")
a = dict(head=(132, 152), shoulder=(126, 136), hip=(96, 78), knee=(66, 128), ankle=(36, 178), toe=(28, 198), elbow=(132, 168), wrist=(138, 198))
b = dict(head=(146, 182), shoulder=(132, 168), hip=(96, 78), knee=(66, 128), ankle=(36, 178), toe=(28, 198), elbow=(112, 178), wrist=(138, 198))
S2("pike", dict(t="Bassin haut, bras tendus", pts=a, load=dict(at=a["hip"], kind="body"), piv=["shoulder"]),
    dict(t="Tête vers le sol, entre les mains", pts=b, load=dict(at=b["hip"], kind="body"), piv=["shoulder"]),
    "Plus le bassin est haut et les pieds proches des mains, plus la poussée devient verticale")
a = front(110, 120, 95, 90, 85, 90); b = front(110, 120, 95, 90, 85, 90); b.update(elbowL=(60, 66), wristL=(104, 76), elbowR=(160, 66), wristR=(116, 76))
S2("upright_row", dict(t="Bras tendus, charge devant les cuisses", pts=a, load=dict(at=mid(a["wristL"], a["wristR"]), r=6), piv=["shoulderR"]),
    dict(t="Coudes hauts, charge sous la poitrine", pts=b, load=dict(at=mid(b["wristL"], b["wristR"]), r=6), piv=["shoulderR"]),
    "Monter les coudes sans dépasser la hauteur des épaules si l'avant de l'épaule gêne")
a = side((100, 105), -90, 90, 90, -12, -12); b = side((100, 105), -90, 90, 90, 185, -70)
S2("face_pull", dict(t="Bras tendus vers la poulie", pts=a, load=dict(at=a["wrist"], kind="cable", anchor=(198, 34)), piv=["shoulder"]),
    dict(t="Corde vers le visage, coudes hauts", pts=b, load=dict(at=b["wrist"], kind="cable", anchor=(198, 34)), piv=["shoulder"]),
    "Câble à hauteur du visage : arrière d'épaule et rotateurs externes ramènent les mains près des oreilles")
a = front(110, 120, 95, 180, 85, 0); b = front(110, 120, 95, 180, 85, 30)
a["wristR"] = (160, 92); b["wristR"] = (124, 92)
a["wristL"] = (60, 92); b["wristL"] = (60, 92)
S2("ext_rot", dict(t="Main vers le ventre (vue du dessus)", pts=dict(a, wristR=(118, 92)), load=dict(at=(118, 92), kind="cable", anchor=(20, 92)), piv=["elbowR"]),
    dict(t="Main vers l'extérieur, coude collé au corps", pts=dict(b, wristR=(166, 92)), load=dict(at=(166, 92), kind="cable", anchor=(20, 92)), piv=["elbowR"]),
    "Coude fixé contre le flanc : l'avant-bras pivote autour du bras, comme une porte sur ses gonds")
a = side((70, 168), -90, 0, 0, 0, 0, ft=-90); b = side((70, 168), -96, 0, 0, 170, -30, ft=-90)
S2("seated_row", dict(t="Bras tendus vers la poulie", props=[("rect", 40, 172, 50, 10), ("rect", 168, 140, 10, 60)], pts=a, load=dict(at=a["wrist"], kind="cable", anchor=(196, 166)), piv=["shoulder"]),
    dict(t="Poignée au ventre, omoplates serrées", props=[("rect", 40, 172, 50, 10), ("rect", 168, 140, 10, 60)], pts=b, load=dict(at=b["wrist"], kind="cable", anchor=(196, 166)), piv=["shoulder"]),
    "Câble horizontal : le buste reste stable, ce sont les coudes qui partent vers l'arrière")
a = dict(head=(176, 150), shoulder=(160, 160), hip=(100, 176), knee=(58, 184), ankle=(16, 192), toe=(10, 200), elbow=(160, 128), wrist=(160, 98))
b = dict(head=(176, 108), shoulder=(160, 120), hip=(100, 156), knee=(58, 176), ankle=(16, 192), toe=(10, 200), elbow=(136, 112), wrist=(160, 98))
S2("inverted_row", dict(t="Bras tendus sous la barre", props=[("line", 120, 98, 210, 98)], pts=a, load=dict(at=a["hip"], kind="body"), piv=["shoulder"]),
    dict(t="Poitrine à la barre, corps gainé", props=[("line", 120, 98, 210, 98)], pts=b, load=dict(at=b["hip"], kind="body"), piv=["shoulder"]),
    "Plus le corps est horizontal, plus la part du poids du corps à tirer est grande")

# ---------- Bras, prise, suspension
a = side((70, 160), -90, 0, 90, 60, 0, hd=-80); b = side((70, 160), -90, 0, 90, 60, -40, hd=-80)
a["wrist"] = (127, 141); b["wrist"] = (127, 141)
a["toe"] = (122, 207); b["toe"] = (122, 207)
S2("wrist", dict(t="Poignet en extension", props=[("rect", 30, 164, 60, 10), ("rect", 96, 144, 20, 56)], pts=dict(a, wrist=(124, 150)), load=dict(at=(134, 156), kind="db"), piv=["wrist"]),
    dict(t="Poignet fléchi : la charge monte", props=[("rect", 30, 164, 60, 10), ("rect", 96, 144, 20, 56)], pts=dict(b, wrist=(124, 150)), load=dict(at=(134, 140), kind="db"), piv=["wrist"]),
    "Avant-bras posés : seul le poignet bouge, amplitude courte et contrôlée")
a = front(110, 140, -100, -90, -80, -90); b = front(110, 150, -100, -90, -80, -90)
a["wristL"] = (100, 18); a["wristR"] = (120, 18)
S2("hang", dict(t="Suspendu, bras tendus", props=[("line", 30, 14, 190, 14)], pts=front(110, 146, -102, -92, -78, -88), load=dict(at=(110, 146), kind="body"), piv=[]),
    dict(t="Lest à la ceinture", props=[("line", 30, 14, 190, 14)], pts=front(110, 146, -102, -92, -78, -88), load=dict(at=(110, 180), kind="db"), piv=[]),
    "Toute la charge passe par les mains : la prise et les épaules travaillent en continu")

# ---------- Abdominaux et gainage
a = side((100, 110), -90, 90, 90, -90, -90, ft=0); b = side((100, 110), -90, 0, 0, -90, -90, ft=0)
for P in (a, b): P["wrist"] = (P["shoulder"][0] + 2, 16); P["elbow"] = (P["shoulder"][0] + 1, 32)
a = side((100, 112), -90, 90, 90, -88, -90, ft=0); b = side((100, 112), -90, -5, 5, -88, -90, ft=0)
S2("hanging_raise", dict(t="Suspendu, jambes en bas", props=[("line", 40, 14, 180, 14)], pts=a, load=dict(at=mid(a["knee"], a["ankle"]), kind="body"), piv=["hip"]),
    dict(t="Jambes à l'horizontale : levier maximal", props=[("line", 40, 14, 180, 14)], pts=b, load=dict(at=mid(b["knee"], b["ankle"]), kind="body"), piv=["hip"]),
    "Enrouler le bassin en fin de mouvement pour faire travailler les abdominaux, pas seulement les fléchisseurs de hanche")
a = side((90, 120), -90, 0, 0, 90, 90, ft=0); b = side((92, 132), -94, -12, -10, 90, 90, ft=0)
a["wrist"] = (90, 126); b["wrist"] = (92, 138)
S2("l_sit", dict(t="Jambes tendues à l'horizontale", props=[("line", 74, 126, 112, 126), ("rect", 88, 128, 6, 72)], pts=a, load=dict(at=mid(a["knee"], a["ankle"]), kind="body"), piv=["hip"]),
    dict(t="Bassin plus bas, jambes plus hautes", props=[("line", 74, 138, 112, 138), ("rect", 90, 140, 6, 60)], pts=b, load=dict(at=mid(b["knee"], b["ankle"]), kind="body"), piv=["hip"]),
    "Appui sur les mains, épaules basses : les jambes tendues font un long levier sur la hanche")
def dflag(ang):
    sh = (40, 146); hip = _p(sh, ang, TR); kn = _p(hip, ang, TH); an = _p(kn, ang, SH)
    return dict(head=(26, 142), shoulder=sh, elbow=(30, 120), wrist=(18, 142), hip=hip, knee=kn, ankle=an)
a = dflag(-15); b = dflag(-72)
S2("dragon_flag", dict(t="Corps vertical, appui sur les épaules", props=[("rect", 20, 150, 120, 10)], pts=b, load=dict(at=mid(b["hip"], b["knee"]), kind="body"), piv=["shoulder"]),
    dict(t="Corps qui descend en planche", props=[("rect", 20, 150, 120, 10)], pts=a, load=dict(at=mid(a["hip"], a["knee"]), kind="body"), piv=["shoulder"]),
    "Exercice avancé : le corps reste droit des épaules aux pieds, la difficulté monte à mesure qu'il s'approche de l'horizontale")
a = side((118, 186), 180, -45, 0, -135, 0, ft=None, hd=180); b = side((118, 176), 180, -100, -10, -135, 0, ft=None, hd=180)
S2("reverse_crunch", dict(t="Genoux au-dessus des hanches", props=[("rect", 20, 190, 160, 8)], pts=a, load=dict(at=mid(a["hip"], a["knee"]), kind="body"), piv=["hip"]),
    dict(t="Bassin enroulé, décollé du banc", props=[("rect", 20, 190, 160, 8)], pts=b, load=dict(at=mid(b["hip"], b["knee"]), kind="body"), piv=["hip"]),
    "Ce n'est pas la jambe qui monte : c'est le bassin qui s'enroule vers la cage thoracique")
a = side((110, 150), -80, 90, 180, -60, 160, ft=None); b = side((110, 150), 30, 90, 180, 60, 200, ft=None, hd=70)
for P in (a, b): P["wrist"] = (P["head"][0] + 4, P["head"][1] + 2)
S2("cable_crunch", dict(t="À genoux, buste haut", pts=a, load=dict(at=a["wrist"], kind="cable", anchor=(150, 6)), piv=["hip"]),
    dict(t="Enroulé : coudes vers les genoux", pts=b, load=dict(at=b["wrist"], kind="cable", anchor=(150, 6)), piv=["hip"]),
    "Les hanches restent fixes : le dos s'enroule, la corde reste près de la tête")
a = side((80, 140), 0, 90, 180, 90, 90, ft=None, hd=-10); b = side((80, 140), 0, 180, 180, 0, 0, th2=90, sh2=180, ua2=90, fa2=90, ft=None, hd=-10)
a.update(knee2=a["knee"], ankle2=a["ankle"]); a["ankle"] = (32, 186)
S2("bird_dog", dict(t="À quatre pattes, dos plat", pts=a, load=dict(at=mid(a["hip"], a["shoulder"]), kind="body"), piv=[]),
    dict(t="Bras et jambe opposés tendus", pts=b, load=dict(at=mid(b["hip"], b["shoulder"]), kind="body"), piv=[]),
    "Le bassin et le dos ne bougent pas pendant que le bras et la jambe s'allongent : c'est un exercice anti-rotation")
a = side((110, 186), 180, -90, 0, -90, -90, ft=None, hd=180); b = side((110, 186), 180, -90, 0, -170, -170, th2=-5, sh2=-5, ua2=-90, fa2=-90, ft=None, hd=180)
S2("dead_bug", dict(t="Dos au sol, bras et genoux en l'air", pts=a, load=dict(at=mid(a["hip"], a["shoulder"]), kind="body"), piv=[]),
    dict(t="Bras et jambe opposés allongés", pts=b, load=dict(at=mid(b["hip"], b["shoulder"]), kind="body"), piv=["hip"]),
    "Le bas du dos reste plaqué au sol : plus les membres s'allongent, plus le levier est long")
a = side((110, 188), 180, 0, 0, -150, 180, ft=None, hd=180); b = side((110, 186), 190, -12, 0, 190, 190, ft=None, hd=190)
S2("hollow", dict(t="Version facile : bras près du corps", pts=a, load=dict(at=mid(a["hip"], a["shoulder"]), kind="body"), piv=[]),
    dict(t="Bras et jambes allongés, épaules décollées", pts=b, load=dict(at=mid(b["hip"], b["shoulder"]), kind="body"), piv=["hip"]),
    "Bas du dos collé au sol, corps en banane : plus les bras et les jambes s'éloignent, plus c'est difficile")
a = side((90, 140), -40, 90, 180, 80, 90, ft=None, hd=-20); b = side((60, 168), -8, 135, 180, 2, 2, ft=None, hd=-8)
a["ankle"] = (44, 190); b["ankle"] = (12, 192)
S2("ab_wheel", dict(t="À genoux, roue sous les épaules", pts=a, load=dict(at=mid(a["hip"], a["shoulder"]), kind="body"), piv=["knee"]),
    dict(t="Roue loin devant : levier maximal", pts=b, load=dict(at=mid(b["hip"], b["shoulder"]), kind="body"), piv=["knee"]),
    "Le corps s'allonge comme une planche : ne pas laisser le bas du dos se creuser")
a = pushup(158, 125, "Planche bras tendus"); b = pushup(158, 125, "Genou ramené vers la poitrine")
b["pts"] = dict(b["pts"], knee2=(138, 166), ankle2=(96, 186), toe2=(88, 199)); b["pts"]["hip"] = (100, 152)
a["piv"] = []; b["piv"] = []
S2("mountain", a, b, "Les hanches restent basses et stables pendant que les genoux alternent rapidement")
def pallof(wy, ey, t):
    P = dict(neck=(110, 96), head=(110, 96), shoulderL=(86, 96), shoulderR=(134, 96), elbowL=(96, ey), elbowR=(124, ey), wristL=(110, wy), wristR=(110, wy))
    return dict(t=t, props=[("rect", 92, 86, 36, 20)], pts=P, load=dict(at=(110, wy), kind="cable", anchor=(206, wy)), piv=["neck"])
S2("pallof", pallof(126, 120, "Vue de dessus : mains contre la poitrine"), pallof(156, 126, "Bras tendus devant : levier maximal"),
    "Le câble tire sur le côté : le tronc résiste à la rotation, plus les mains sont loin du buste, plus c'est dur")
a = side((96, 176), -120, -35, 35, 20, -20, ft=None, hd=-105); b = side((96, 176), -120, -35, 35, 60, 10, ft=None, hd=-105)
S2("twist", dict(t="Assis, buste incliné, pieds décollés", pts=a, load=dict(at=a["wrist"], kind="db"), piv=[]),
    dict(t="Rotation : la charge passe d'un côté à l'autre", pts=b, load=dict(at=b["wrist"], kind="db"), piv=[]),
    "La rotation vient du tronc, pas des bras : amplitude contrôlée")
a = front(110, 120, -30, -30, -30, -30, 100, 80); b = front(110, 120, 130, 120, 130, 120, 100, 80)
for P, w in ((a, (168, 30)), (b, (64, 140))): P["wristL"] = w; P["wristR"] = w
a["elbowL"] = (122, 52); a["elbowR"] = (150, 48); b["elbowL"] = (78, 106); b["elbowR"] = (104, 112)
S2("woodchop", dict(t="Mains en haut, côté poulie (vue de face)", pts=a, load=dict(at=(168, 30), kind="cable", anchor=(206, 8)), piv=["pelvis"]),
    dict(t="Mains en bas, en diagonale", pts=b, load=dict(at=(64, 140), kind="cable", anchor=(206, 8)), piv=["pelvis"]),
    "Mouvement diagonal du haut vers le bas : le tronc et les hanches tournent ensemble")

# ---------- Mollets
a = side((80, 128), -90, 0, 90, 30, 60, ft=0); b = side((80, 120), -90, 0, 80, 30, 60, ft=-15)
S2("calf_seated", dict(t="Talon bas", props=[("rect", 44, 132, 50, 10), ("rect", 110, 112, 40, 8), ("rect", 110, 182, 40, 10)], pts=a, load=dict(at=a["knee"], r=6), piv=["ankle"]),
    dict(t="Sur la pointe", props=[("rect", 44, 132, 50, 10), ("rect", 110, 104, 40, 8), ("rect", 110, 182, 40, 10)], pts=b, load=dict(at=b["knee"], r=6), piv=["ankle"]),
    "Genou fléchi : le gastrocnémien est relâché, le soléaire fait l'essentiel du travail")

# exercice -> schéma propre ; famille -> schéma (remplace celui de familles.py)
EXSCH = {
    "45° back extension (focus ischios)": "back_ext", "Extension lombaire lestée (banc 45°)": "back_ext", "Hyperextension horizontale lestée": "back_ext",
    "Reverse hyper": "reverse_hyper", "Superman": "superman", "Good morning": "good_morning", "Good morning élastique": "good_morning",
    "Kettlebell swing": "swing", "Cable pull-through": "pull_through", "Glute-ham raise": "nordic", "Nordic hamstring curl": "nordic",
    "Leg curl glissé au sol (serviette)": "slide_curl", "Leg press": "leg_press", "Leg press pieds bas (focus quadriceps)": "leg_press",
    "Sissy squat": "sissy", "Chaise contre le mur": "wall_sit", "Step-up haltères": "step_up", "Pistol squat assisté": "pistol",
    "Copenhagen plank": "copenhagen", "Kickback fessier machine": "kickback_glute", "Kickback fessier poulie": "kickback_glute",
    "Glute bridge barre": "bridge", "Pont fessier au sol": "bridge", "Pont fessier haltère": "bridge", "Pont fessier unilatéral": "bridge",
    "Pompes": "pushup", "Pompes lestées": "pushup", "Pompes surélevées pieds": "pushup", "Pompes archer": "pushup", "Pompes diamant": "pushup",
    "Dips entre deux chaises": "bench_dip", "Tirage bras tendu poulie": "straight_arm", "Pull-over poulie haute": "straight_arm",
    "Extension triceps overhead unilatérale poulie": "overhead_ext", "Overhead extension corde poulie basse": "overhead_ext",
    "Overhead extension triceps poulie (barre)": "overhead_ext", "Extension nuque haltère à deux mains": "overhead_ext",
    "Skullcrusher barre": "skull", "Skullcrusher haltères": "skull", "JM press": "skull", "Tate press": "skull",
    "Kickback haltère": "tri_kickback", "Kickback poulie": "tri_kickback", "Pompes pike (épaules)": "pike",
    "Tirage menton poulie corde": "upright_row", "Tirage menton": "upright_row",
    "Face pull": "face_pull", "Face pull élastique": "face_pull", "Rowing corde poulie haute (rear delt row)": "face_pull",
    "Tirage horizontal poulie (prise serrée focus grand dorsal)": "seated_row", "Tirage horizontal poulie prise serrée": "seated_row",
    "Tirage horizontal poulie (prise large focus trapèzes)": "seated_row", "Tirage horizontal unilatéral poulie": "seated_row",
    "Rowing assis machine": "seated_row", "Rowing élastique": "seated_row",
    "Rowing australien (barre basse)": "inverted_row", "Rowing australien sous une table": "inverted_row", "Rowing inversé sous une table": "inverted_row", "Inverted row lesté": "inverted_row",
    "Flexion poignet barre": "wrist", "Flexion poignet haltères": "wrist", "Extension poignet barre": "wrist", "Rouleau de poignet (wrist roller)": "wrist",
    "Pince grip / pinch hold": "carry", "Suspension à la barre (dead hang) lestée": "hang",
    "Relevé de jambes suspendu": "hanging_raise", "Relevé de jambes suspendu lesté": "hanging_raise", "L-sit (parallèles)": "l_sit", "Dragon flag": "dragon_flag",
    "Crunch inversé sur banc": "reverse_crunch", "Crunch poulie": "cable_crunch", "Crunch machine": "cable_crunch",
    "Bird dog lesté": "bird_dog", "Dead bug": "dead_bug", "Hollow body hold": "hollow", "Roue abdominale (ab wheel)": "ab_wheel",
    "Mountain climbers": "mountain", "Pallof press poulie": "pallof", "Pallof press élastique": "pallof", "Rotation russe lestée": "twist", "Woodchopper poulie": "woodchop",
    "Mollets assis machine (soléaire)": "calf_seated",
}
FAMSCH = {"incline": "incline", "cuff": "ext_rot"}
