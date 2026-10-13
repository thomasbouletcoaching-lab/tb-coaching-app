"""Convertit la Table Ciqual 2020 (ANSES, Licence Ouverte Etalab 2.0) en data/ciqual.json pour l'app.
Format compact : [nom, catégorie, kcal, protéines, glucides, lipides, fibres] pour 100 g."""
import json, os, re, sys, unicodedata, urllib.request, xlrd

URL = "https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_FR_2020%2007%2007.xls"

def nrm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()

def val(v):
    s = str(v if v is not None else "").strip().replace(",", ".")
    if not s or s == "-": return None
    if re.match(r"^traces?$", s, re.I) or s.startswith("<"): return 0.0
    try: return float(s)
    except ValueError: return None

def cat_of(g, sg, name):
    G, S, N = nrm(g), nrm(sg), nrm(name)
    if "infantile" in G: return None
    if re.search(r"plats? compos|entrees", G):
        return "Fast-food & restaurant" if re.search(r"sandwich|pizza|hamburger|burger|kebab|tacos|hot.?dog|nugget|frites|wrap|panini|croque", N + " " + S) else "Plats préparés"
    if "cereal" in G:
        if re.search(r"pain|biscott|viennois", S): return "Pains & viennoiseries"
        if re.search(r"biscuit|gateau|patisser", S): return "Produits sucrés & desserts"
        return "Féculents & céréales"
    if re.search(r"viande|oeuf|poisson", G):
        if "oeuf" in S: return "Œufs"
        if re.search(r"poisson|mollusque|crustac", S): return "Poissons & fruits de mer"
        if "charcut" in S: return "Charcuterie"
        if re.search(r"substitut|alternativ", S): return "Protéines végétales & légumineuses"
        return "Volailles & viandes"
    if re.search(r"fruits|legume", G):
        if "legumineuse" in S: return "Protéines végétales & légumineuses"
        if re.search(r"coque|oleagineu|graine", S): return "Fruits secs & oléagineux"
        if re.search(r"pomme de terre|tubercule", S): return "Féculents & céréales"
        if "fruit" in S: return "Fruits"
        return "Légumes"
    if "lait" in G: return "Fromages" if "fromage" in S else "Produits laitiers"
    if re.search(r"glace|sorbet|sucre", G): return "Produits sucrés & desserts"
    if re.search(r"boisson|eau", G): return "Boissons"
    if re.search(r"matiere.? grasse", G): return "Matières grasses"
    if re.search(r"aide|ingredient|condiment|sauce", G): return "Sauces & condiments"
    return "Plats préparés"

def main():
    raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "tb-coaching-app"}), timeout=120).read()
    sh = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)
    head = [str(h) for h in sh.row_values(0)]
    def col(rx):
        for i, h in enumerate(head):
            if re.search(rx, h, re.I): return i
        sys.exit("colonne introuvable : " + rx)
    kcols = [i for i, h in enumerate(head) if re.search(r"^Energie.*kcal", h, re.I)]  # règlement UE d'abord, puis les autres méthodes
    kcols.sort(key=lambda i: 0 if re.search(r"R.glement UE", head[i]) else 1)
    C = dict(g=col(r"^alim_grp_nom_fr"), sg=col(r"^alim_ssgrp_nom_fr"), n=col(r"^alim_nom_fr"), k=col(r"^Energie, R.glement UE.*kcal"),
             p=col(r"^Prot.ines, N x facteur de Jones"), gl=col(r"^Glucides \(g"), l=col(r"^Lipides \(g"), f=col(r"^Fibres alimentaires"))
    out, seen = [], set()
    for r in range(1, sh.nrows):
        row = sh.row_values(r); name = str(row[C["n"]]).strip()
        if not name or nrm(name) in seen: continue
        cat = cat_of(row[C["g"]], row[C["sg"]], name)
        k = next((val(row[i]) for i in kcols if val(row[i]) is not None), None)
        if k is None:  # énergie absente : calculée avec les coefficients du règlement UE 1169/2011 (4/4/9/2 kcal par g)
            p_, g_, l_, f_ = (val(row[C[x]]) for x in ("p", "gl", "l", "f"))
            if None not in (p_, g_, l_): k = 4 * p_ + 4 * g_ + 9 * l_ + 2 * (f_ or 0)
        if not cat or k is None: continue
        seen.add(nrm(name)); r1 = lambda x: round(x or 0, 1)
        out.append([name, cat, round(k), r1(val(row[C["p"]])), r1(val(row[C["gl"]])), r1(val(row[C["l"]])), r1(val(row[C["f"]]))])
    os.makedirs("data", exist_ok=True)
    # alias usuels pointant vers un aliment Ciqual existant (mêmes valeurs, nom que les clients cherchent)
    ALIAS = [("Sashimi de saumon", "Saumon, cru"), ("Sashimi de thon", "Thon, cru"), ("Sashimi de daurade", "Daurade, crue"),
             ("Tartare de saumon (cru, nature)", "Saumon, cru"), ("Poke bowl : saumon cru (ingrédient)", "Saumon, cru")]
    by = {nrm(f[0]): f for f in out}
    for a_, src in ALIAS:
        f = by.get(nrm(src))
        if f and nrm(a_) not in seen: seen.add(nrm(a_)); out.append([a_ + " – valeurs Ciqual « " + f[0] + " »", f[1]] + f[2:])
    json.dump({"source": "Table de composition nutritionnelle des aliments Ciqual 2020, ANSES (Licence Ouverte Etalab 2.0)", "url": "https://ciqual.anses.fr/", "foods": out},
              open("data/ciqual.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "aliments")

main()
