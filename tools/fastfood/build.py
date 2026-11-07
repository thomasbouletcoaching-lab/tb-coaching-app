# -*- coding: utf-8 -*-
"""Construit data/fastfood.json : plats des chaînes de fast-food en France, avec la portion vendue.
Format compact : [nom, enseigne, kcal, protéines, glucides, lipides, fibres (pour 100 g), poids d'une portion en g ou null, source].

Sources (relevé du 7 novembre 2026) :
  - McDonald's France : catalogue officiel du site (ws.mcdonalds.fr, valeurs par produit et pour 100 g)
  - Burger King France : fiches produits du site burgerking.fr (par portion et pour 100 g)
  - Quick : « Déclaration nutritionnelle des produits Quick valable à partir du 27 octobre 2026 » (PDF officiel)
  - Five Guys France : tableau des valeurs nutritionnelles officiel (ingrédients) ; burgers et hot-dogs recomposés
    à partir des ingrédients de base, sans garnitures ni sauces
  - French tacos : analyses en laboratoire de la CLCV (O'Tacos et moyenne de 5 enseignes, poids M/L/XL pesés)
  - KFC France : fiches Open Food Facts relevées sur kfc.fr (le site de KFC n'est pas accessible ici)

Usage : python3 tools/fastfood/build.py RAW_DIR   (RAW_DIR contient mc_rows.json, bk_rows.json, quick_rows.json, kfc.json)
Les fichiers bruts se régénèrent avec tools/fastfood/fetch.py.
"""
import json, os, re, sys, unicodedata
from collections import Counter, defaultdict

RAW = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "data", "fastfood.json")

def nrm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def clean(n):
    n = re.sub(r"[®™*]+", "", n).replace("’", "'").replace("[KINGDOM] - ", "").replace("Lousiane", "Louisiane")
    n = re.sub(r"\b([A-Z]{3,})\b", lambda m: m.group(1) if m.group(1) in ("CBK", "BBQ", "XXL", "XL", "BK") else m.group(1).capitalize(), n)
    n = re.sub(r"\s+", " ", n).strip(" .,-")
    return n

def r1(x): return None if x is None else round(float(x), 1)

items = []  # dict(name, chain, kcal, p, c, f, fib (portion), g (portion) or per100 flag)
def add(chain, name, g, kcal, p, c, f, fib=None, src="", per100=False):
    items.append(dict(chain=chain, name=clean(name), g=g, kcal=kcal, p=p or 0, c=c or 0, f=f or 0, fib=fib, src=src, per100=per100))

def cl_of(name):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*cl\b", name, re.I)
    return round(float(m.group(1).replace(",", ".")) * 10) if m else None

DRINK = re.compile(r"coca|fanta|sprite|fuze|lipton|ice.?tea|oasis|eau |eau$|heineken|tropicana|nectar|jus |capri|perrier|vittel|evian|badoit|volvic|minute maid|red bull|tropico|smoothie|milkshake|milk.?shake|latte|cappuccino|espresso|caf[eé]|chocolat chaud|th[eé] |infusion|frapp|americano|boisson|shake", re.I)

# ---------- McDonald's France (officiel)
mc = json.load(open(os.path.join(RAW, "mc_rows.json")))
seen = set()
fix = {}
for r in mc:
    name = r["name"]
    if re.search(r"^NEUTRE$|^Sel$|^Sachet de \d|Boîte à partager", name): continue
    key = nrm(clean(name))
    if key in seen: continue
    seen.add(key)
    kcal, p, c, f, fib = r["kcal"], r["p"], r["c"], r["f"], r["fib"]
    if re.search(r"th[ée] |infusion", name, re.I): p, f, c = 0, 0, round(kcal / 4, 1)  # valeurs 1/1/1 du site, sans objet
    g = cl_of(name) or (r["w"] if r["k100"] and r["k100"] > 0 and not DRINK.search(name) else None)
    if g is None and r["k100"] and r["k100"] > 0 and DRINK.search(name): g = r["w"]
    if kcal == 0 and not g: g = cl_of(name)
    add("McDonald's", name, g, kcal, p, c, f, fib, "mcdonalds.fr")
# Les milkshakes gourmands fraise « P'tit » et « Grand » sont inversés sur le site (poids incohérents) : on remet dans l'ordre
a = next((x for x in items if x["chain"] == "McDonald's" and nrm(x["name"]).startswith("p tit milkshake gourmand saveur fraise")), None)
b = next((x for x in items if x["chain"] == "McDonald's" and nrm(x["name"]).startswith("grand milkshake gourmand saveur fraise")), None)
if a and b and a["kcal"] > b["kcal"]:
    for k in ("kcal", "p", "c", "f", "fib"): a[k], b[k] = b[k], a[k]
for x in items:
    if x["chain"] == "McDonald's" and "milkshake" in nrm(x["name"]): x["g"] = cl_of(x["name"].replace(",", "."))

# ---------- Burger King France (officiel)
bk = json.load(open(os.path.join(RAW, "bk_rows.json")))
# valeurs manifestement recopiées d'un autre produit sur le site, ou doublons de nom
BK_OUT = {"pom potes peche", "sucre", "fuze tea fines bulles", "maxi sauce secrete", "classic fish", "cbk", "cbk double", "tenders 2", "tenders 5"}
SKIP_BK = re.compile(r"myst[eè]re|personnaliser|^pack|acheté|ready|^my |kingbox|kkingbox|bouteille pet|perrier|^1 ", re.I)
BURGERISH = re.compile(r"steakhouse|whopper|king|burger|cheese|bacon|chicken|fish|master|wrap|crousty|nugget|tender|cbk|l[oö]ris|savoyard|alsacien|crispy|onion|full", re.I)
by_tuple = defaultdict(set); by_name = defaultdict(list)
for r in bk:
    if not r["kcal"] or SKIP_BK.search(r["name"]) or nrm(clean(r["name"])) in BK_OUT: continue
    k = nrm(clean(r["name"])); t = (r["kcal"], r["p"], r["c"], r["f"])
    by_tuple[t].add(k); by_name[k].append((r, t))
for k, lst in by_name.items():
    burger = [x for x in lst if x[0]["type"] == "BURGER"]
    cands = burger or lst
    # valeurs recopiées d'un autre produit : on écarte les jeux de valeurs partagés par plusieurs noms
    own = [x for x in cands if len(by_tuple[x[1]]) == 1] or ([x for x in cands if len(by_tuple[x[1]]) == 2] if not burger else cands)
    if not own: continue
    r, t = Counter(x[1] for x in own).most_common(1)[0][0], None
    r = next(x[0] for x in own if x[1] == r)
    k100 = r["k100"]
    if k100 and (k100 > 900 or (BURGERISH.search(r["name"]) and not DRINK.search(r["name"]) and not (150 <= k100 <= 420))): continue
    if r["kcal"] > 60:
        est = 4 * (r["p"] or 0) + 4 * (r["c"] or 0) + 9 * (r["f"] or 0)
        if abs(est - r["kcal"]) / r["kcal"] > 0.25: continue
    g = cl_of(r["name"]) or (round(r["kcal"] / k100 * 100) if k100 else None)
    if g and k100 and r["p100"] is not None and r["p"] and abs(r["p100"] * g / 100 - r["p"]) > max(3, 0.3 * r["p"]): continue
    add("Burger King", r["name"], g, r["kcal"], r["p"], r["c"], r["f"], r.get("fib"), "burgerking.fr")

# ---------- Quick (PDF officiel du 27/10/2026)
qk = json.load(open(os.path.join(RAW, "quick_rows.json")))
for r in qk:
    sec, name = r["sec"] or "", r["name"]
    if re.search(r"Boissons Chaudes", sec) or re.search(r"SQUEEZE|Sucre sachet", name): continue
    name = re.sub(r"\s*\(\*+\)", "", name)
    if "(" in name and re.search(r"(?:\b\w\b\s+){3,}", name[name.index("("):]): name = name[:name.index("(")]  # texte superposé dans le PDF
    name = re.sub(r"\((Crème glacée|Milkshake)[^)]*\).*$", "", name).strip()
    m = re.search(r"Softs.*?\((\d+) ml\)", sec)
    if m: name = f"{name} {int(m.group(1)) // 10} cl"
    add("Quick", name, r["g"], r["kcal"], r["p"], r["c"], r["f"], r["fib"], "quick.fr (27/10/2026)")

# ---------- Five Guys France (tableau officiel des ingrédients) : burgers recomposés
FG = {  # portion : kcal, P, G, L, fibres ; poids déduit des valeurs pour 100 g
    "pain": (238, 6.0, 38, 7.5, 1.4, 77), "steak": (195, 18, 0, 14, 0, 67), "fromage": (64, 3.6, 1.1, 4.9, 0, 19),
    "bacon": (78, 6.4, 0.7, 5.5, 0, 14), "hotdog": (192, 11, 2.1, 15, 0, 76), "painhd": (215, 5.3, 34, 6.7, 1.2, 70),
}
def fg(name, parts):
    t = [sum(FG[k][i] * n for k, n in parts) for i in range(6)]
    add("Five Guys", name + " (sans garniture ni sauce)", round(t[5]), round(t[0]), round(t[1], 1), round(t[2], 1), round(t[3], 1), round(t[4], 1), "fiveguys.fr")
fg("Hamburger", [("pain", 1), ("steak", 2)]); fg("Cheeseburger", [("pain", 1), ("steak", 2), ("fromage", 2)])
fg("Bacon Burger", [("pain", 1), ("steak", 2), ("bacon", 2)]); fg("Bacon Cheeseburger", [("pain", 1), ("steak", 2), ("fromage", 2), ("bacon", 2)])
fg("Little Hamburger", [("pain", 1), ("steak", 1)]); fg("Little Cheeseburger", [("pain", 1), ("steak", 1), ("fromage", 1)])
fg("Little Bacon Burger", [("pain", 1), ("steak", 1), ("bacon", 1)]); fg("Little Bacon Cheeseburger", [("pain", 1), ("steak", 1), ("fromage", 1), ("bacon", 1)])
fg("Hot Dog", [("painhd", 1), ("hotdog", 1)]); fg("Cheese Dog", [("painhd", 1), ("hotdog", 1), ("fromage", 1)])
fg("Bacon Dog", [("painhd", 1), ("hotdog", 1), ("bacon", 1)]); fg("Bacon Cheese Dog", [("painhd", 1), ("hotdog", 1), ("fromage", 1), ("bacon", 1)])
for n, k, p, c, f, fib in [("Frites petite portion", 659, 10, 70, 39, 6.3), ("Frites moyenne portion", 1073, 16, 115, 63, 10), ("Frites grande portion", 1509, 23, 162, 89, 14)]:
    add("Five Guys", n, round(k / 271 * 100), k, p, c, f, fib, "fiveguys.fr")
for n, g, k, p, c, f, fib in [("Milkshake (base, sans parfum)", 355, 625, 7.8, 75, 33, 0), ("Crème fouettée (milkshake)", 20, 68, 0, 0.6, 7.0, 0),
                              ("Grilled Cheese", 200, 652, 22, 45, 41, 3.6), ("Veggie Sandwich", 256, 330, 10, 52, 7.4, 5.4),
                              ("Cheese Veggie Sandwich", 118, 434, 12, 42, 24, 2.2), ("Mayonnaise", 15, 113, 0, 0, 12, 0), ("Ketchup", 14, 14, 0, 3.2, 0, 0)]:
    add("Five Guys", n, g, k, p, c, f, fib, "fiveguys.fr")

# ---------- French tacos : analyses CLCV (pour 100 g) et poids pesés
def tacos(chain, name, per100, g):
    k, p, c, f, fib = per100
    add(chain, name, g, round(k * g / 100), round(p * g / 100, 1), round(c * g / 100, 1), round(f * g / 100, 1), round(fib * g / 100, 1), "CLCV, analyses en laboratoire")
OT = (267, 8.5, 23.4, 15.1, 1.7); AVG = (277, 9, 23, 16, 2)
tacos("O'Tacos", "Tacos M (1 viande, frites et sauce fromagère)", OT, 442)
tacos("O'Tacos", "Tacos L (2 viandes, frites et sauce fromagère)", OT, 454)
tacos("O'Tacos", "Tacos XL (3 viandes, frites et sauce fromagère)", OT, 784)
tacos("Tacos", "French tacos M (moyenne de 5 enseignes)", AVG, 409)
tacos("Tacos", "French tacos L (moyenne de 5 enseignes)", AVG, 487)
tacos("Tacos", "French tacos XL (moyenne de 5 enseignes)", AVG, 830)

# ---------- KFC France (Open Food Facts, pour 100 g)
KFC_G = {"TENDERS": 40, "BOXMASTER ORIGINAL": 275, "BOXMASTER MAXX ORIGINAL": 376}  # 5 Tenders = 200 g ; poids des Boxmaster relevés
try:
    kf = json.load(open(os.path.join(RAW, "kfc.json")))
except FileNotFoundError:
    kf = []
ks = set()
for p in kf:
    if "kfc" not in (p.get("brands_tags") or []) or "en:france" not in (p.get("countries_tags") or []): continue
    n = p.get("nutriments") or {}
    v = [n.get(x) for x in ("energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g")]
    if any(x is None for x in v) or (p.get("last_modified_t") or 0) < 1600000000: continue
    name = clean(p.get("product_name_fr") or p.get("product_name") or "")
    if not name or re.search(r"pomme gala|fruits by|bucket 10", name, re.I): continue
    key = nrm(name)
    if key in ks: continue
    ks.add(key)
    if abs(4 * v[1] + 4 * v[2] + 9 * v[3] - v[0]) / v[0] > 0.25: continue
    nice = name.title() if name.isupper() else name
    g = KFC_G.get(name.upper())
    if name.upper() == "TENDERS": nice = "Tender (1 pièce)"
    add("KFC", nice, None, v[0], v[1], v[2], v[3], n.get("fiber_100g"), "Open Food Facts (d'après kfc.fr)", per100=True)
    items[-1]["g"] = g

# ---------- Sortie : valeurs pour 100 g + poids de la portion
out, names = [], set()
for x in items:
    g = x["g"]
    if x["per100"]: k100 = [x["kcal"], x["p"], x["c"], x["f"], x["fib"]]
    elif g: k100 = [v * 100 / g if v is not None else None for v in (x["kcal"], x["p"], x["c"], x["f"], x["fib"])]
    else:
        if x["kcal"] > 5: continue  # sans poids ni valeurs pour 100 g : inutilisable en grammes
        k100 = [0, 0, 0, 0, None]; g = None
    key = (x["chain"], nrm(x["name"]))
    if key in names: continue
    names.add(key)
    r2 = lambda v: None if v is None else round(float(v), 2)
    out.append([x["name"], x["chain"], round(k100[0], 1), r2(k100[1]), r2(k100[2]), r2(k100[3]), r2(k100[4]), round(g) if g else None, x["src"]])
out.sort(key=lambda r: (r[1], r[0]))
json.dump({"src": "Valeurs des enseignes (sites et tableaux officiels), CLCV pour les tacos, Open Food Facts pour KFC. Relevé du 7/11/2026.",
           "foods": out}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "plats ·", dict(Counter(r[1] for r in out)), "·", os.path.getsize(OUT) // 1024, "Ko")
