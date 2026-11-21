// Analyse vidéo : angles articulaires à partir des points du squelette, suivi d'un point (la barre) d'une image à l'autre.
// Pur (sans DOM) : testé par tests/video-calc.test.mjs.
// Points MediaPipe Pose : 11/12 épaules, 13/14 coudes, 15/16 poignets, 23/24 hanches, 25/26 genoux, 27/28 chevilles (gauche/droite)
export const OS = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
export function angle(a, b, c) { // angle en b (degrés), points {x, y}
  if (!a || !b || !c) return null;
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y], n = Math.hypot(...v1) * Math.hypot(...v2); if (!n) return null;
  return Math.round(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / n))) * 180 / Math.PI);
}
// Côté le plus visible (filmé de profil) : 0 = gauche, 1 = droit
export const cote = (lm) => { const v = (ids) => ids.reduce((a, i) => a + (lm[i]?.visibility ?? 0), 0); return v([12, 14, 24, 26, 28]) > v([11, 13, 23, 25, 27]) ? 1 : 0; };
// lm : points normalisés (0–1) ; w, h : taille de l'image (pour des angles justes quand l'image n'est pas carrée)
export function angles(lm, w = 1, h = 1) {
  if (!lm?.length) return null; const s = cote(lm), P = (i) => lm[i] ? { x: lm[i].x * w, y: lm[i].y * h } : null, k = (g, d) => P(s ? d : g);
  return { cote: s ? "droit" : "gauche", genou: angle(k(23, 24), k(25, 26), k(27, 28)), hanche: angle(k(11, 12), k(23, 24), k(25, 26)), coude: angle(k(11, 12), k(13, 14), k(15, 16)), epaule: angle(k(13, 14), k(11, 12), k(23, 24)) };
}
// Suivi d'un motif (niveaux de gris) : cherche autour de (x, y) la position où la somme des écarts est la plus faible
// img : { w, h, d: Uint8Array } ; tpl : { w, h, d } ; r : rayon de recherche
export function suivre(img, tpl, x, y, r = 12) {
  let best = Infinity, bx = x, by = y; const hw = tpl.w >> 1, hh = tpl.h >> 1;
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    const cx = x + dx, cy = y + dy; if (cx - hw < 0 || cy - hh < 0 || cx - hw + tpl.w > img.w || cy - hh + tpl.h > img.h) continue;
    let sad = 0;
    for (let j = 0; j < tpl.h && sad < best; j += 2) { const ro = (cy - hh + j) * img.w + cx - hw, to = j * tpl.w; for (let i = 0; i < tpl.w; i += 2) sad += Math.abs(img.d[ro + i] - tpl.d[to + i]); }
    if (sad < best) { best = sad; bx = cx; by = cy; }
  }
  return { x: bx, y: by, score: best };
}
export function motif(img, x, y, t = 24) { const d = new Uint8Array(t * t), h = t >> 1; for (let j = 0; j < t; j++) for (let i = 0; i < t; i++) { const xx = Math.min(img.w - 1, Math.max(0, x - h + i)), yy = Math.min(img.h - 1, Math.max(0, y - h + j)); d[j * t + i] = img.d[yy * img.w + xx]; } return { w: t, h: t, d }; }
export function gris(rgba, w, h) { const d = new Uint8Array(w * h); for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8; return { w, h, d }; }
// Écart horizontal de la trajectoire (en % de la hauteur parcourue) : une barre bien droite reste sous 10 %
export function deriveTrajectoire(pts) { if (pts.length < 2) return null; const xs = pts.map(p => p.x), ys = pts.map(p => p.y), dy = Math.max(...ys) - Math.min(...ys); if (!dy) return null; return Math.round((Math.max(...xs) - Math.min(...xs)) / dy * 100); }
