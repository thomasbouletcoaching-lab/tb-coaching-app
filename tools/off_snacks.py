# -*- coding: utf-8 -*-
"""Complète data/off-fr.json avec les produits transformés les plus scannés en France (Open Food Facts, ODbL) :
bonbons, chocolats, biscuits, gâteaux, chips et apéritifs, barres, viennoiseries, glaces, pâtisseries, pâtes à tartiner, sodas.

Format d'une ligne : [nom, marque, kcal, protéines, glucides, lipides, fibres, code-barres, sucres, sodium (mg), portion (g) ou absent]
Usage : python3 tools/off_snacks.py [cache.json]   (sans cache : interroge search.openfoodfacts.org, ~25 min)
Seuls les produits aux valeurs complètes et cohérentes (énergie ≈ 4 P + 4 G + 9 L + 2 F) sont ajoutés.
"""
import json, os, re, sys, time, unicodedata, urllib.request, urllib.parse

UA = "tb-coaching-app/1.0 (thomasboulet.coaching@gmail.com)"
F = "code,product_name,product_name_fr,brands,categories_tags,serving_size,serving_quantity,nutriments,unique_scans_n,quantity"
CATS = [("en:candies", 3000), ("en:chocolates", 3000), ("en:biscuits", 3000), ("en:cakes", 2500), ("en:salty-snacks", 3500), ("en:bars", 1500),
        ("en:viennoiseries", 2000), ("en:ice-creams-and-sorbets", 2000), ("en:pastries", 1500), ("en:sweet-spreads", 600), ("en:sodas", 1200), ("en:snacks", 4000)]
DB = os.path.join(os.path.dirname(__file__), "..", "data", "off-fr.json")

def fetch():
    res = {}
    for cat, n in CATS:
        for page in range(1, n // 100 + 1):
            u = "https://search.openfoodfacts.org/search?" + urllib.parse.urlencode({"q": f'categories_tags:"{cat}" AND countries_tags:"en:france"', "page_size": 100, "page": page, "sort_by": "-unique_scans_n", "fields": F})
            j = None
            for a in range(5):
                try: j = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=90).read()); break
                except Exception: time.sleep(6 * (a + 1))
            if not j or not j.get("hits"): break
            for p in j["hits"]:
                if p.get("code") and p["code"] not in res: res[p["code"]] = p
            time.sleep(1.2)
    return res

def nrm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def row(p):
    n = p.get("nutriments") or {}
    k, pr, gl, li = (num(n.get(x)) for x in ("energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"))
    if None in (k, pr, gl, li) or not (0 <= k <= 900) or min(pr, gl, li) < 0 or pr + gl + li > 105: return None
    fib = num(n.get("fiber_100g"))
    off = lambda kg: abs(4 * pr + kg * gl + 9 * li + 2 * (fib or 0) - k) / k > 0.25
    if k > 40 and off(4) and off(2.4): return None  # 2,4 kcal/g : bonbons aux polyols (sans sucres)
    name = (p.get("product_name_fr") or p.get("product_name") or "").strip()
    name = re.sub(r"\s+", " ", name)
    if len(name) < 2 or len(name) > 90 or name.lower() in ("none", "null"): return None
    if re.search(r"[^\x00-\u017f\u2019\u2018\u201c\u201d\u2013\u2014\u00b0\u20ac®™&]", name) or re.search(r"[šõžćčęłąřůğşđŠŽČ]", name): return None  # alphabets et langues non lus en France
    b = p.get("brands"); b = (b[0] if isinstance(b, list) and b else str(b or "").split(",")[0]).strip()
    sug, na = num(n.get("sugars_100g")), num(n.get("sodium_100g"))
    sq, ss = num(p.get("serving_quantity")), str(p.get("serving_size") or "")
    ug = round(sq) if sq and 5 <= sq <= 500 and re.search(r"\d\s*(g|ml|cl)\b", ss, re.I) else None
    r = [name, b, round(k), round(pr, 1), round(gl, 1), round(li, 1), None if fib is None else round(fib, 1), p["code"],
         None if sug is None else round(sug, 1), None if na is None else round(na * 1000)]
    if ug: r.append(ug)
    return r

def main():
    raw = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else fetch()
    db = json.load(open(DB))
    codes = {f[7] for f in db["foods"]}; keys = {(nrm(f[0]), nrm(f[1])) for f in db["foods"]}
    add = []
    for p in sorted(raw.values(), key=lambda p: -(p.get("unique_scans_n") or 0)):
        if p.get("code") in codes: continue
        r = row(p)
        if not r: continue
        key = (nrm(r[0]), nrm(r[1]))
        if key in keys: continue
        keys.add(key); codes.add(r[7]); add.append(r)
    db["foods"] += add
    db["src"] = "Open Food Facts (ODbL), produits vendus en France"
    json.dump(db, open(DB, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(add), "produits ajoutés ·", len(db["foods"]), "au total ·", os.path.getsize(DB) // 1024, "Ko")

if __name__ == "__main__":
    main()
