# -*- coding: utf-8 -*-
# Schémas biomécaniques (SVG) : silhouette, ligne d'action de la charge, articulation, bras de levier
# (distance perpendiculaire entre l'articulation et la ligne d'action, calculée).
import math

SEG = [("shoulder","head"),("shoulder","hip"),("shoulder","elbow"),("elbow","wrist"),("hip","knee"),("knee","ankle"),("ankle","toe"),
       ("shoulder2","elbow2"),("elbow2","wrist2"),("hip","knee2"),("knee2","ankle2"),("ankle2","toe2"),("hipL","kneeL"),("kneeL","ankleL"),("hipR","kneeR"),("kneeR","ankleR"),("hipL","hipR"),("shoulderL","shoulderR"),("shoulderL","elbowL"),("elbowL","wristL"),("shoulderR","elbowR"),("elbowR","wristR"),("neck","head"),("neck","pelvis")]
COL = ["#e5484d", "#f5a524"]

def perp(p, a, d):
    # pied de la perpendiculaire de p sur la droite passant par a de direction d
    dx, dy = d; n = math.hypot(dx, dy); dx, dy = dx/n, dy/n
    t = (p[0]-a[0])*dx + (p[1]-a[1])*dy
    return (a[0]+t*dx, a[1]+t*dy)

def panel(P, ox, cid):
    pts = P["pts"]; o = [f'<g clip-path="url(#{cid})">']
    for sh in P.get("props", []):
        k = sh[0]
        if k == "rect": o.append(f'<rect x="{sh[1]+ox}" y="{sh[2]}" width="{sh[3]}" height="{sh[4]}" rx="3" fill="currentColor" opacity=".12"/>')
        if k == "line": o.append(f'<line x1="{sh[1]+ox}" y1="{sh[2]}" x2="{sh[3]+ox}" y2="{sh[4]}" stroke="currentColor" stroke-width="3" opacity=".35" stroke-linecap="round"/>')
    o.append(f'<line x1="{ox+6}" y1="201" x2="{ox+214}" y2="201" stroke="currentColor" stroke-width="1.5" opacity=".3"/>')
    for a, b in SEG:
        if a in pts and b in pts:
            (x1, y1), (x2, y2) = pts[a], pts[b]
            o.append(f'<line x1="{x1+ox}" y1="{y1}" x2="{x2+ox}" y2="{y2}" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>')
    if "head" in pts:
        hx, hy = pts["head"]; o.append(f'<circle cx="{hx+ox}" cy="{hy}" r="9" fill="var(--card,#fff)" stroke="currentColor" stroke-width="4"/>')
    L = P.get("load")
    if L:
        (lx, ly), kind = L["at"], L.get("kind", "bar")
        d = L.get("dir", (0, 1))
        if kind == "cable":
            ax, ay = L["anchor"]; o.append(f'<line x1="{lx+ox}" y1="{ly}" x2="{ax+ox}" y2="{ay}" stroke="#3b82f6" stroke-width="2.5"/><circle cx="{ax+ox}" cy="{ay}" r="6" fill="none" stroke="#3b82f6" stroke-width="2.5"/>')
            d = (ax-lx, ay-ly)
        else:
            n = math.hypot(*d); ux, uy = d[0]/n, d[1]/n
            far = (lx+ux*400, ly+uy*400); back = (lx-ux*400, ly-uy*400)
            o.append(f'<line x1="{back[0]+ox:.1f}" y1="{back[1]:.1f}" x2="{far[0]+ox:.1f}" y2="{far[1]:.1f}" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="5 4" opacity=".8"/>')
            ex, ey = lx+ux*30, ly+uy*30
            o.append(f'<line x1="{lx+ox}" y1="{ly}" x2="{ex+ox:.1f}" y2="{ey:.1f}" stroke="#3b82f6" stroke-width="3" marker-end="url(#ar)"/>')
        if kind == "bar": o.append(f'<circle cx="{lx+ox}" cy="{ly}" r="{L.get("r",7)}" fill="#3b82f6"/>')
        if kind == "db": o.append(f'<rect x="{lx-8+ox}" y="{ly-5}" width="16" height="10" rx="2" fill="#3b82f6"/>')
        if kind == "body": o.append(f'<circle cx="{lx+ox}" cy="{ly}" r="5" fill="#3b82f6"/><text x="{lx+ox+8}" y="{ly-6}" font-size="10" fill="#3b82f6">poids du corps</text>')
        for i, j in enumerate(P.get("piv", [])):
            jx, jy = pts[j]; fx, fy = perp((jx, jy), (lx, ly), d); c = COL[i % 2]
            o.append(f'<line x1="{jx+ox}" y1="{jy}" x2="{fx+ox:.1f}" y2="{fy:.1f}" stroke="{c}" stroke-width="3.5"/><circle cx="{jx+ox}" cy="{jy}" r="5.5" fill="{c}"/>')
    o.append('</g>')
    o.append(f'<text x="{ox+110}" y="219" font-size="11" text-anchor="middle" fill="currentColor">{P["t"]}</text>')
    return "".join(o)

def wrap(t, n=78):
    if len(t) <= n: return [t]
    cut = t.rfind(" ", 0, n); return [t[:cut], t[cut+1:]]

def svg(name, A, B, legend):
    ca, cb = f"c{name}a", f"c{name}b"
    body = panel(A, 0, ca) + panel(B, 225, cb)
    L = wrap(legend); h = 236 + 13 * len(L)
    leg = "".join(f'<text x="225" y="{240+13*i}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".75">{l}</text>' for i, l in enumerate(L))
    return (f'<svg viewBox="0 0 450 {h}" width="100%" role="img" aria-label="Schéma : {name}" style="color:var(--ink,#111)"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#3b82f6"/></marker>'
            f'<clipPath id="{ca}"><rect x="0" y="0" width="220" height="205"/></clipPath><clipPath id="{cb}"><rect x="225" y="0" width="220" height="205"/></clipPath></defs>{body}{leg}</svg>')

LEG = "Bleu : ligne d'action de la charge · Rouge / orange : bras de levier sur l'articulation"
S = {}
def s(k, A, B, legend=LEG): S[k] = svg(k, A, B, legend)

s("squat", dict(t="Debout : bras de levier faibles", pts=dict(head=(104,34),shoulder=(100,50),hip=(98,105),knee=(102,150),ankle=(100,197),toe=(120,198),elbow=(86,62),wrist=(92,48)), load=dict(at=(97,48)), piv=["hip","knee"]),
           dict(t="En bas : hanche et genou très sollicités", pts=dict(head=(118,100),shoulder=(108,114),hip=(70,155),knee=(128,160),ankle=(104,197),toe=(124,198),elbow=(94,126),wrist=(100,112)), load=dict(at=(106,112)), piv=["hip","knee"]))
s("lunge", dict(t="Debout", pts=dict(head=(102,32),shoulder=(100,48),hip=(98,104),knee=(104,150),ankle=(100,197),toe=(118,198),knee2=(92,150),ankle2=(96,197),toe2=(112,198),elbow=(100,76),wrist=(100,100)), load=dict(at=(100,104),kind="db"), piv=["knee"]),
           dict(t="En bas : genou avant et hanche", pts=dict(head=(100,90),shoulder=(98,104),hip=(96,156),knee=(140,160),ankle=(132,197),toe=(150,198),knee2=(78,192),ankle2=(48,188),toe2=(40,198),elbow=(98,130),wrist=(98,152)), load=dict(at=(98,156),kind="db"), piv=["knee","hip"]))
s("leg_ext", dict(t="Genou fléchi", props=[("rect",50,140,70,14),("rect",45,70,14,84)], pts=dict(head=(58,52),shoulder=(56,70),hip=(66,132),knee=(118,132),ankle=(124,184),toe=(140,190),elbow=(70,100),wrist=(86,130)), load=dict(at=(124,180),dir=(-0.99,-0.12),kind="bar",r=6), piv=["knee"]),
           dict(t="Jambe tendue", props=[("rect",50,140,70,14),("rect",45,70,14,84)], pts=dict(head=(58,52),shoulder=(56,70),hip=(66,132),knee=(118,132),ankle=(170,128),toe=(180,114),elbow=(70,100),wrist=(86,130)), load=dict(at=(166,128),dir=(0,1),kind="bar",r=6), piv=["knee"]), "Le boudin résiste perpendiculairement au tibia : plus il est bas sur la jambe, plus le levier est long")
s("hinge", dict(t="Départ : hanche loin de la barre", pts=dict(head=(140,92),shoulder=(126,104),hip=(78,128),knee=(122,158),ankle=(108,197),toe=(128,198),elbow=(122,140),wrist=(118,172)), load=dict(at=(116,184),r=14), piv=["hip"]),
           dict(t="Verrouillage : levier presque nul", pts=dict(head=(102,34),shoulder=(100,50),hip=(100,105),knee=(102,150),ankle=(100,197),toe=(120,198),elbow=(102,80),wrist=(104,104)), load=dict(at=(106,110),r=14), piv=["hip"]))
s("thrust", dict(t="En bas", props=[("rect",20,135,40,62)], pts=dict(head=(30,118),shoulder=(48,132),hip=(100,175),knee=(150,150),ankle=(160,197),toe=(178,198),elbow=(70,150),wrist=(92,160)), load=dict(at=(100,165)), piv=[]),
           dict(t="En haut : résistance maximale", props=[("rect",20,135,40,62)], pts=dict(head=(30,118),shoulder=(48,132),hip=(110,130),knee=(158,128),ankle=(160,197),toe=(178,198),elbow=(75,128),wrist=(100,122)), load=dict(at=(110,120)), piv=[]), "La charge pousse vers le sol : hanches tendues, elle est perpendiculaire au buste et aux cuisses")
s("leg_curl", dict(t="Jambe tendue", props=[("rect",20,150,160,12)], pts=dict(head=(30,132),shoulder=(48,140),hip=(110,142),knee=(150,142),ankle=(196,140),toe=(204,128),elbow=(60,160),wrist=(76,166)), load=dict(at=(194,134),dir=(0,1),r=6), piv=["knee"]),
           dict(t="Genou fléchi", props=[("rect",20,150,160,12)], pts=dict(head=(30,132),shoulder=(48,140),hip=(110,142),knee=(150,142),ankle=(140,94),toe=(128,88),elbow=(60,160),wrist=(76,166)), load=dict(at=(143,98),dir=(0.99,0.12),r=6), piv=["knee"]), "Le boudin résiste perpendiculairement au tibia ; leg curl assis : hanche fléchie, ischios plus étirés")
s("hip_abd", dict(t="Jambes serrées (vue de face)", pts=dict(head=(110,30),shoulderL=(88,50),shoulderR=(132,50),neck=(110,46),pelvis=(110,108),hipL=(98,110),hipR=(122,110),kneeL=(96,155),kneeR=(124,155),ankleL=(96,197),ankleR=(124,197),elbowL=(82,80),wristL=(84,106),elbowR=(138,80),wristR=(136,106)), load=dict(at=(124,155),dir=(-1,0),r=5), piv=["hipR"]),
           dict(t="Écartées : appui loin de la hanche", pts=dict(head=(110,30),shoulderL=(88,50),shoulderR=(132,50),neck=(110,46),pelvis=(110,108),hipL=(98,110),hipR=(122,110),kneeL=(80,152),kneeR=(140,152),ankleL=(66,195),ankleR=(154,195),elbowL=(82,80),wristL=(84,106),elbowR=(138,80),wristR=(136,106)), load=dict(at=(140,152),dir=(-1,0.1),r=5), piv=["hipR"]), "Bleu : résistance de la machine · Rouge : bras de levier sur la hanche")
s("calf", dict(t="Talon bas", props=[("rect",112,186,60,14)], pts=dict(head=(108,30),shoulder=(106,46),hip=(106,104),knee=(108,148),ankle=(110,184),toe=(134,182),elbow=(104,76),wrist=(104,100)), load=dict(at=(110,150),dir=(0,1),kind="body"), piv=["ankle"]),
           dict(t="Sur la pointe", props=[("rect",112,186,60,14)], pts=dict(head=(118,14),shoulder=(116,30),hip=(118,88),knee=(122,132),ankle=(124,166),toe=(138,184),elbow=(114,60),wrist=(114,84)), load=dict(at=(124,130),dir=(0,1),kind="body"), piv=["ankle"]), "Le pied est un levier : appui sur l'avant-pied, le tendon d'Achille tire sur le talon")
s("bench", dict(t="Bras tendus : levier faible", props=[("rect",40,148,140,12)], pts=dict(head=(58,138),shoulder=(80,140),hip=(140,142),knee=(178,140),ankle=(186,197),toe=(204,198),elbow=(80,100),wrist=(82,62)), load=dict(at=(82,60)), piv=["shoulder","elbow"]),
           dict(t="Barre sur la poitrine : levier maximal", props=[("rect",40,148,140,12)], pts=dict(head=(58,138),shoulder=(80,140),hip=(140,142),knee=(178,140),ankle=(186,197),toe=(204,198),elbow=(64,130),wrist=(92,112)), load=dict(at=(94,110)), piv=["shoulder","elbow"]))
s("dips", dict(t="Bras tendus", props=[("line",70,92,150,92)], pts=dict(head=(108,40),shoulder=(106,56),hip=(108,118),knee=(104,160),ankle=(110,196),elbow=(106,74),wrist=(108,92)), load=dict(at=(108,92),dir=(0,-1),kind="bar",r=4), piv=["shoulder"]),
           dict(t="En bas : épaule sous le coude", props=[("line",70,92,150,92)], pts=dict(head=(118,82),shoulder=(112,98),hip=(98,156),knee=(90,186),ankle=(70,190),elbow=(90,88),wrist=(108,92)), load=dict(at=(108,92),dir=(0,-1),kind="bar",r=4), piv=["shoulder","elbow"]), "Les mains poussent les barres : bras de levier = distance horizontale entre la main et l'épaule ou le coude")
s("ohp", dict(t="Départ : barre devant le menton", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(108,70),wrist=(112,52)), load=dict(at=(112,50)), piv=["shoulder","elbow"]),
           dict(t="Bras tendus : barre au-dessus", pts=dict(head=(98,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(102,28),wrist=(102,6)), load=dict(at=(102,6)), piv=["shoulder"]))
s("fly", dict(t="Bras ouverts : levier maximal (vu des pieds)", props=[("rect",80,150,60,12)], pts=dict(head=(110,128),shoulderL=(86,146),shoulderR=(134,146),neck=(110,144),elbowL=(58,150),wristL=(38,140),elbowR=(162,150),wristR=(182,140)), load=dict(at=(182,140),kind="db"), piv=["shoulderR"]),
           dict(t="Bras fermés : levier presque nul", props=[("rect",80,150,60,12)], pts=dict(head=(110,128),shoulderL=(86,146),shoulderR=(134,146),neck=(110,144),elbowL=(92,108),wristL=(104,74),elbowR=(128,108),wristR=(116,74)), load=dict(at=(116,74),kind="db"), piv=["shoulderR"]), "Avec des haltères la charge tire vers le sol ; à la poulie, la résistance suit le câble")
s("pullover", dict(t="Bras derrière la tête : levier maximal", props=[("rect",50,148,130,12)], pts=dict(head=(70,138),shoulder=(88,140),hip=(150,142),knee=(186,140),ankle=(192,197),elbow=(56,134),wrist=(24,130)), load=dict(at=(22,130),kind="db"), piv=["shoulder"]),
           dict(t="Au-dessus de la poitrine : levier nul", props=[("rect",50,148,130,12)], pts=dict(head=(70,138),shoulder=(88,140),hip=(150,142),knee=(186,140),ankle=(192,197),elbow=(88,104),wrist=(90,70)), load=dict(at=(90,68),kind="db"), piv=["shoulder"]))
s("pullup", dict(t="Suspension (vue de face)", props=[("line",30,14,190,14)], pts=dict(head=(110,74),shoulderL=(88,90),shoulderR=(132,90),neck=(110,86),pelvis=(110,146),hipL=(100,148),hipR=(120,148),kneeL=(102,176),kneeR=(118,176),ankleL=(104,198),ankleR=(116,198),elbowL=(70,52),wristL=(58,16),elbowR=(150,52),wristR=(162,16)), load=dict(at=(162,16),dir=(0,-1),kind="bar",r=4), piv=["shoulderR"]),
           dict(t="Menton à la barre", props=[("line",30,14,190,14)], pts=dict(head=(110,22),shoulderL=(88,40),shoulderR=(132,40),neck=(110,36),pelvis=(110,96),hipL=(100,98),hipR=(120,98),kneeL=(102,128),kneeR=(118,128),ankleL=(104,152),ankleR=(116,152),elbowL=(68,58),wristL=(58,16),elbowR=(152,58),wristR=(162,16)), load=dict(at=(162,16),dir=(0,-1),kind="bar",r=4), piv=["shoulderR","elbowR"]), "Les mains tirent sur la barre : bras de levier = distance horizontale entre la main et l'articulation")
s("row", dict(t="Bras tendus : le bas du dos tient le buste", pts=dict(head=(160,86),shoulder=(146,96),hip=(84,120),knee=(110,158),ankle=(100,197),toe=(120,198),elbow=(146,134),wrist=(146,166)), load=dict(at=(146,172)), piv=["hip"]),
           dict(t="Fin de tirage : épaule en extension", pts=dict(head=(160,86),shoulder=(146,96),hip=(84,120),knee=(110,158),ankle=(100,197),toe=(120,198),elbow=(116,104),wrist=(126,130)), load=dict(at=(127,134)), piv=["hip","shoulder"]))
s("shrug", dict(t="Épaules basses", pts=dict(head=(110,36),shoulderL=(86,60),shoulderR=(134,60),neck=(110,56),pelvis=(110,118),hipL=(100,120),hipR=(120,120),kneeL=(100,160),kneeR=(120,160),ankleL=(100,198),ankleR=(120,198),elbowL=(82,94),wristL=(82,124),elbowR=(138,94),wristR=(138,124)), load=dict(at=(138,128),kind="db"), piv=[]),
           dict(t="Épaules hautes", pts=dict(head=(110,36),shoulderL=(86,48),shoulderR=(134,48),neck=(110,50),pelvis=(110,118),hipL=(100,120),hipR=(120,120),kneeL=(100,160),kneeR=(120,160),ankleL=(100,198),ankleR=(120,198),elbowL=(82,82),wristL=(82,112),elbowR=(138,82),wristR=(138,112)), load=dict(at=(138,116),kind="db"), piv=[]), "Amplitude courte, résistance constante : la charge tire toujours vers le bas")
s("lateral", dict(t="Bras le long du corps : levier nul", pts=dict(head=(110,36),shoulderL=(88,56),shoulderR=(132,56),neck=(110,52),pelvis=(110,116),hipL=(100,118),hipR=(120,118),kneeL=(100,158),kneeR=(120,158),ankleL=(100,198),ankleR=(120,198),elbowL=(84,88),wristL=(84,116),elbowR=(136,88),wristR=(136,116)), load=dict(at=(136,118),kind="db"), piv=["shoulderR"]),
           dict(t="Bras à l'horizontale : levier maximal", pts=dict(head=(110,36),shoulderL=(88,56),shoulderR=(132,56),neck=(110,52),pelvis=(110,116),hipL=(100,118),hipR=(120,118),kneeL=(100,158),kneeR=(120,158),ankleL=(100,198),ankleR=(120,198),elbowL=(60,60),wristL=(36,60),elbowR=(160,60),wristR=(184,60)), load=dict(at=(186,60),kind="db"), piv=["shoulderR"]), "Avec des haltères la difficulté est en haut ; à la poulie basse, la tension existe dès le départ")
s("front_raise", dict(t="Bras le long du corps", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(102,82),wrist=(104,110)), load=dict(at=(104,112),kind="db"), piv=["shoulder"]),
           dict(t="Bras à l'horizontale", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(130,54),wrist=(158,56)), load=dict(at=(160,56),kind="db"), piv=["shoulder"]))
s("rear", dict(t="Buste penché, bras pendants (vue de face)", pts=dict(head=(110,56),shoulderL=(88,70),shoulderR=(132,70),neck=(110,66),elbowL=(86,100),wristL=(86,128),elbowR=(134,100),wristR=(134,128)), load=dict(at=(134,130),kind="db"), piv=["shoulderR"]),
           dict(t="Bras ouverts : levier maximal", pts=dict(head=(110,56),shoulderL=(88,70),shoulderR=(132,70),neck=(110,66),elbowL=(60,74),wristL=(34,72),elbowR=(160,74),wristR=(186,72)), load=dict(at=(188,72),kind="db"), piv=["shoulderR"]), "Poulie ou pec deck inversé : la résistance suit le câble ou la came, plus régulière")
s("curl", dict(t="Avant-bras vertical : levier nul", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(100,82),wrist=(100,112)), load=dict(at=(100,114),kind="db"), piv=["elbow"]),
           dict(t="Avant-bras horizontal : levier maximal", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(100,82),wrist=(130,82)), load=dict(at=(132,82),kind="db"), piv=["elbow"]), "Debout avec une charge libre, le plus dur est au milieu ; incliné ou au pupitre, la zone difficile change")
s("pushdown", dict(t="Coude fléchi", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(98,84),wrist=(124,72)), load=dict(at=(124,72),kind="cable",anchor=(140,6)), piv=["elbow"]),
           dict(t="Coude tendu", pts=dict(head=(102,34),shoulder=(100,52),hip=(98,108),knee=(100,152),ankle=(100,197),toe=(120,198),elbow=(98,84),wrist=(110,112)), load=dict(at=(110,112),kind="cable",anchor=(140,6)), piv=["elbow"]), "Bleu : câble. Le bras de levier est la distance perpendiculaire entre le coude et le câble")
s("carry", dict(t="Charges lourdes tenues", pts=dict(head=(110,36),shoulderL=(88,56),shoulderR=(132,56),neck=(110,52),pelvis=(110,116),hipL=(100,118),hipR=(120,118),kneeL=(100,158),kneeR=(120,158),ankleL=(100,198),ankleR=(120,198),elbowL=(84,88),wristL=(84,118),elbowR=(136,88),wristR=(136,118)), load=dict(at=(136,122),kind="db"), piv=[]),
           dict(t="Une seule charge : les obliques travaillent", pts=dict(head=(110,36),shoulderL=(88,56),shoulderR=(132,56),neck=(110,52),pelvis=(110,116),hipL=(100,118),hipR=(120,118),kneeL=(100,158),kneeR=(120,158),ankleL=(100,198),ankleR=(120,198),elbowL=(80,84),wristL=(70,104),elbowR=(136,88),wristR=(136,118)), load=dict(at=(136,122),kind="db"), piv=["pelvis"]), "Garder le buste droit malgré la charge : gainage, prise, trapèzes")
s("crunch", dict(t="Allongé", pts=dict(head=(40,180),shoulder=(56,186),hip=(120,188),knee=(150,150),ankle=(178,196),toe=(194,198),elbow=(48,170),wrist=(42,176)), load=dict(at=(84,187),kind="body"), piv=["hip"]),
           dict(t="Enroulé : cage thoracique vers le bassin", pts=dict(head=(70,132),shoulder=(82,146),hip=(120,188),knee=(150,150),ankle=(178,196),toe=(194,198),elbow=(76,128),wrist=(70,134)), load=dict(at=(100,168),kind="body"), piv=["hip"]), "Le poids du buste crée la résistance ; à la poulie, la charge s'ajoute dans la direction du câble")
s("plank", dict(t="Planche : levier long", pts=dict(head=(40,140),shoulder=(56,152),hip=(122,158),knee=(160,164),ankle=(196,170),toe=(204,198),elbow=(56,196),wrist=(80,198)), load=dict(at=(120,160),kind="body"), piv=["elbow"]),
           dict(t="Sur les genoux : levier plus court", pts=dict(head=(40,140),shoulder=(56,152),hip=(110,170),knee=(150,196),ankle=(186,192),elbow=(56,196),wrist=(80,198)), load=dict(at=(100,172),kind="body"), piv=["elbow"]), "Plus les appuis sont éloignés, plus le poids du corps fait levier : la difficulté augmente sans charge")
