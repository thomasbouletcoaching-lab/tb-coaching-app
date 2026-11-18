// Lecture d'un selfie SUR LE TÉLÉPHONE pour proposer un teint et une couleur de cheveux au personnage.
// Module pur (pixels en entrée, proposition en sortie), testé par `node --test tests/selfie.test.mjs`.
//
// Règles (décision C60) : la photo ne quitte jamais l'appareil, n'est ni envoyée ni enregistrée ; on ne garde que
// deux choix d'apparence (un numéro de teint, une couleur de cheveux), que la personne peut corriger ou refuser.
// Aucune reconnaissance du visage, aucune mesure du corps : on lit seulement des couleurs dans des zones fixes,
// la personne ayant placé son visage dans l'ovale.

// Ovale guide, en fractions de la largeur et de la hauteur de l'image cadrée (format 3:4)
export const GUIDE = { cx: 0.5, cy: 0.52, rx: 0.27, ry: 0.3 };
export const LARGEUR = 300, HAUTEUR = 400;
const EXPO = 5; // compensation d'exposition, en points de luminosité L*

// Repères de teint réels (échelle de Monk, Google, CC BY 4.0), dans l'ordre des 10 teints du personnage
export const MONK = ["#F6EDE4", "#F3E7DB", "#F7EAD0", "#EADABA", "#D7BD96", "#A07E56", "#825C43", "#604134", "#3A312A", "#292420"];
// Couleurs réelles de cheveux → couleur de la palette du personnage (js/personnage.js, R3D.cheveux)
export const CHEVEUX_REELS = [
  ["#231F1C", "#2A2622"], ["#3C2A1E", "#4A3020"], ["#5F4129", "#7A5030"], ["#8A6440", "#A27648"],
  ["#BE9E6E", "#E2C690"], ["#93492A", "#C05A30"], ["#8C8C8A", "#B8B8B8"], ["#D6D4CE", "#FFFFFF"],
];

const hexRgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
export function lab([r, g, b]) {
  const f = (c) => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089;
  const t = (v) => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
const dist = (a, b, kL = 1) => Math.hypot((a[0] - b[0]) * kL, a[1] - b[1], a[2] - b[2]);
// Peau probable (règle classique sur YCbCr, volontairement large pour tous les teints)
export function peauProbable([r, g, b]) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b, cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b, cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b;
  return y > 25 && y < 250 && cr >= 133 && cr <= 180 && cb >= 77 && cb <= 135;
}
const mediane = (px) => [0, 1, 2].map(k => { const v = px.map(p => p[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; });

// Pixels d'un rectangle (fractions de l'image)
function zone(data, w, h, x0, y0, x1, y1) {
  const out = [];
  const xa = Math.max(0, Math.floor(x0 * w)), xb = Math.min(w, Math.ceil(x1 * w)), ya = Math.max(0, Math.floor(y0 * h)), yb = Math.min(h, Math.ceil(y1 * h));
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const i = (y * w + x) * 4; if (data[i + 3] > 200) out.push([data[i], data[i + 1], data[i + 2]]); }
  return out;
}

// data : pixels RGBA (Uint8ClampedArray ou tableau) d'une image w × h cadrée sur l'ovale
// → { ok, raison?, teint (0 à 9), teintMesure, cheveux (couleur de palette ou null), cheveuxMesure }
export function analyser(data, w, h) {
  if (!data || !w || !h || data.length < w * h * 4) return { ok: false, raison: "Image illisible." };
  const { cx, cy, rx, ry } = GUIDE;
  const joues = [...zone(data, w, h, cx - 0.62 * rx, cy + 0.05 * ry, cx - 0.3 * rx, cy + 0.3 * ry), ...zone(data, w, h, cx + 0.3 * rx, cy + 0.05 * ry, cx + 0.62 * rx, cy + 0.3 * ry)];
  const front = zone(data, w, h, cx - 0.35 * rx, cy - 0.62 * ry, cx + 0.35 * rx, cy - 0.45 * ry);
  if (!joues.length) return { ok: false, raison: "Image illisible." };
  const peauJoues = joues.filter(peauProbable);
  if (peauJoues.length < joues.length * 0.5) return { ok: false, raison: "Visage introuvable dans l'ovale. Essaie avec plus de lumière, de face, le visage bien dans l'ovale." };
  const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
  const echantillon = [...peauJoues, ...front.filter(peauProbable)];
  // On écarte les reflets et les ombres (10 % les plus clairs et les plus sombres)
  const tri = echantillon.slice().sort((a, b) => lum(a) - lum(b)), coupe = Math.floor(tri.length * 0.1);
  const peau = mediane(tri.slice(coupe, tri.length - coupe || undefined)), Lp = lab(peau);
  // Une photo de visage est presque toujours un peu sous-exposée : on compense légèrement avant de comparer
  const Lc = [Lp[0] + EXPO, Lp[1], Lp[2]];
  let teint = 0, best = Infinity;
  MONK.forEach((m, i) => { const d = dist(Lc, lab(hexRgb(m)), 1.6); if (d < best) { best = d; teint = i; } });

  // Cheveux : bande au-dessus de l'ovale et tempes ; on garde ce qui n'est pas de la peau
  const haut = zone(data, w, h, cx - 0.55 * rx, cy - ry - 0.07, cx + 0.55 * rx, cy - ry + 0.01);
  const tempes = [...zone(data, w, h, cx - rx - 0.04, cy - 0.7 * ry, cx - rx + 0.02, cy - 0.2 * ry), ...zone(data, w, h, cx + rx - 0.02, cy - 0.7 * ry, cx + rx + 0.04, cy - 0.2 * ry)];
  const nonPeau = (px) => px.filter(p => !peauProbable(p) || dist(lab(p), Lp) > 18);
  const hHaut = nonPeau(haut), hTempes = nonPeau(tempes);
  let cheveux = null, cheveuxMesure = null;
  if (hHaut.length >= haut.length * 0.4) {
    const m = mediane(hHaut), Lm = lab(m);
    const proches = hHaut.filter(p => dist(lab(p), Lm) < 22).length / hHaut.length;
    // Les tempes doivent confirmer (même couleur) : sinon c'est sans doute le fond, pas des cheveux
    const confirme = hTempes.length >= tempes.length * 0.3 && dist(lab(mediane(hTempes)), Lm) < 25;
    if (proches >= 0.45 && confirme) {
      cheveuxMesure = rgbHex(m);
      let bd = Infinity; CHEVEUX_REELS.forEach(([reel, pal]) => { const d = dist(Lm, lab(hexRgb(reel)), 1.3); if (d < bd) { bd = d; cheveux = pal; } });
    }
  }
  return { ok: true, teint, teintMesure: rgbHex(peau), cheveux, cheveuxMesure };
}
