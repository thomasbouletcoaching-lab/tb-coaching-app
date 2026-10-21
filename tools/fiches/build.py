# -*- coding: utf-8 -*-
# Construit data/fiches.json (fiches exercices) : python3 tools/fiches/build.py
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from familles import F
import exos2
from exos1 import E
from schemas import S
bad = [n for n, e in E.items() if e["fam"] not in F]
assert not bad, "famille inconnue : %s" % bad
sch = [f for f, v in F.items() if v["schema"] not in S]
assert not sch, "schéma manquant : %s" % sch
out = dict(meta=dict(v=1, published=False, note="Brouillon à valider par Thomas avant d'être visible des clients."), fam=F, ex=E, svg=S)
p = os.path.join(os.path.dirname(__file__), "..", "..", "data", "fiches.json")
json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(F), "familles,", len(E), "exercices,", len(S), "schémas,", os.path.getsize(p)//1024, "Ko")
