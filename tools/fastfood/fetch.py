# -*- coding: utf-8 -*-
"""Relève les données brutes des enseignes pour tools/fastfood/build.py.
Usage : python3 tools/fastfood/fetch.py RAW_DIR   (puis python3 tools/fastfood/build.py RAW_DIR)
  - McDonald's : catalogue du site (ws.mcdonalds.fr), une requête par produit, à rythme lent
  - Burger King : page « La carte » de burgerking.fr (fiches et valeurs incluses dans la page)
  - Quick : PDF « Déclaration nutritionnelle » lié en bas de quick.fr (mettre à jour QUICK_PDF à chaque nouvelle carte)
  - KFC : Open Food Facts (marque kfc, France)
Five Guys et les tacos (CLCV) sont saisis dans build.py à partir des tableaux publiés.
"""
import json, os, re, sys, time, urllib.request, urllib.parse
RAW = sys.argv[1] if len(sys.argv) > 1 else "."
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
QUICK_PDF = "https://assets.quick.fr/Declaration_Nutritionnelle_des_produits_Quick_valable_a_partir_du_27_octobre_2026_02c92e76ab.pdf"

def get(u, ref=None, raw=False):
    h = {"User-Agent": UA}
    if ref: h["Referer"] = ref
    for a in range(4):
        try:
            b = urllib.request.urlopen(urllib.request.Request(u, headers=h), timeout=60).read()
            return b if raw else json.loads(b)
        except Exception as e:
            err = e; time.sleep(3 * (a + 1))
    raise err

def mcdonalds():
    cat = get("https://ws.mcdonalds.fr/api/catalog/gomcdo?eatType=EAT_IN&responseGroups=RG.CATEGORY.PICTURES&responseGroups=RG.CATEGORY.PRODUCTS", "https://www.mcdonalds.fr/")
    refs = []
    def walk(c):
        for p in c.get("products") or []:
            if p.get("type") == "finished" and p["ref"] not in refs: refs.append(p["ref"])
        for ch in c.get("children") or []: walk(ch)
    walk(cat)
    rows, i = [], 0
    while i < len(refs):
        r = refs[i]; i += 1
        p = get(f"https://ws.mcdonalds.fr/api/product/{r}?eatType=EAT_IN&responseGroups=RG.PRODUCT.NUTRITIONAL_VALUES&responseGroups=RG.PRODUCT.CHOICES", "https://www.mcdonalds.fr/")
        time.sleep(0.6)
        for ch in p.get("choices") or []:
            for q in ch.get("products") or ch.get("items") or []:
                if isinstance(q, dict) and q.get("ref") and q["ref"] not in refs and q.get("type", "finished") == "finished": refs.append(q["ref"])
        nv = {x["ref"]: x for x in p.get("nutritionalValues") or []}
        if "CAL" not in nv: continue
        g = lambda k, f="value": (nv.get(k) or {}).get(f)
        w = round(g("CAL") / g("CAL", "value100g") * 100) if g("CAL", "value100g") else None
        rows.append(dict(ref=r, name=p.get("label"), kcal=g("CAL"), k100=g("CAL", "value100g"), p=g("PRO"), c=g("GLU"), f=g("LIP"), fib=g("FIB"), w=w))
    json.dump(rows, open(os.path.join(RAW, "mc_rows.json"), "w"), ensure_ascii=False)
    print("McDonald's", len(rows))

def burgerking():
    s = get("https://www.burgerking.fr/carte", raw=True).decode("utf-8")
    big = "".join(json.loads('"' + c + '"') for c in re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', s))
    dec, rows = json.JSONDecoder(), []
    for m in re.finditer(r'"(\d{15,20})":\{"id":"\1"', big):
        try: o, _ = dec.raw_decode(big, m.start() + len(m.group(1)) + 3)
        except Exception: continue
        if not o.get("nutrition"): continue
        n = {x["item"].split(".")[-1]: x for x in o["nutrition"]}
        def v(k, f):
            try: return float(str(n[k][f]).replace(",", "."))
            except Exception: return None
        rows.append(dict(name=o["name"], type=o.get("type"), kcal=v("energy", "portion"), k100=v("energy", "share"), p=v("protein", "portion"), c=v("carbs", "portion"),
                         f=v("fat", "portion"), p100=v("protein", "share"), fib=v("fibre", "portion")))
    json.dump(rows, open(os.path.join(RAW, "bk_rows.json"), "w"), ensure_ascii=False)
    print("Burger King", len(rows))

def quick():
    import io, pdfplumber
    pdf = pdfplumber.open(io.BytesIO(get(QUICK_PDF, raw=True))); rows, sec = [], None
    n = lambda x: (lambda y: float(y) if re.fullmatch(r"-?\d+(\.\d+)?", y) else None)((x or "").replace(" ", "").replace(",", ".").replace("<", "").strip())
    for pg in pdf.pages:
        for tb in pg.extract_tables():
            for r in tb:
                if not r or not r[0]: continue
                name = r[0].replace("\n", " ").strip(); vals = [n(x) for x in r[1:]]
                if len(r) >= 20 and vals[0] and vals[2] is not None:
                    g, kj, kcal, f, sat, c, sug, p, salt, fib = vals[:10]
                    rows.append(dict(name=name, sec=sec, g=g, kcal=kcal, p=p, c=c, f=f, fib=fib))
                elif all(v is None for v in vals): sec = name
    json.dump(rows, open(os.path.join(RAW, "quick_rows.json"), "w"), ensure_ascii=False)
    print("Quick", len(rows))

def kfc():
    F = "code,product_name,product_name_fr,brands_tags,countries_tags,nutriments,last_modified_t"
    u = "https://search.openfoodfacts.org/search?" + urllib.parse.urlencode({"q": "brands:kfc", "page_size": 200, "langs": "fr", "fields": F})
    hits = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "tb-coaching-app/1.0"}), timeout=60)
    hits = json.loads(hits.read()).get("hits", [])
    json.dump(hits, open(os.path.join(RAW, "kfc.json"), "w"), ensure_ascii=False)
    print("KFC", len(hits))

if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    for f in (burgerking, quick, kfc, mcdonalds): f()
