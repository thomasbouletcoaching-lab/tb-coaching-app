# Cheveux en niveaux de gris clairs : l'app les colore ensuite à la couleur choisie (multiplication).
# Usage : python neutraliser-cheveux.py dossier_entree dossier_sortie   (PNG ou WebP en entrée, WebP qualité 78 en sortie)
# Chaque image est ramenée à une luminosité médiane de 185 sur 255 : toutes les coiffures prennent la même couleur.
import sys, os
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for f in sorted(os.listdir(src)):
    if not f.endswith((".png", ".webp")): continue
    im = np.array(Image.open(os.path.join(src, f)).convert("RGBA")).astype(float)
    L = im[..., :3] @ [0.299, 0.587, 0.114]; vis = im[..., 3] > 128
    med = np.median(L[vis]) if vis.any() else 128
    L = np.clip(L * (185 / max(med, 1)), 0, 255)
    out = Image.fromarray(np.dstack([L, L, L, im[..., 3]]).astype(np.uint8))
    out.save(os.path.join(dst, os.path.splitext(f)[0] + ".webp"), "WEBP", quality=78, method=4)
print("fait")
