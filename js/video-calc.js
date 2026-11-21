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

// ---------- Analyse v2 : critères par mouvement, inclinaison d'une ligne, phases et vitesse de la barre ----------
export const MOUVEMENTS = [
  { id: "squat", n: "Squat", crit: ["Profondeur : pli de hanche sous le genou (ou profondeur visée)", "Barre au-dessus du milieu du pied tout le long", "Genoux dans l'axe des pieds (pas de valgus)", "Dos neutre, pas d'arrondi en bas (butt wink)", "Talons au sol", "Remontée : hanches et épaules montent ensemble", "Tempo contrôlé à la descente"] },
  { id: "bench", n: "Développé couché", crit: ["5 points d'appui (tête, épaules, fessiers, 2 pieds)", "Omoplates serrées et basses", "Barre touche le bas du sternum", "Avant-bras verticaux en bas", "Trajectoire en J (vers les yeux en remontant)", "Pas de rebond sur la poitrine", "Fessiers sur le banc"] },
  { id: "deadlift", n: "Soulevé de terre", crit: ["Barre au-dessus du milieu du pied au départ", "Barre collée au corps tout le long", "Dos neutre (pas d'arrondi lombaire)", "Hanches ne montent pas avant les épaules", "Épaules légèrement devant la barre au départ", "Verrouillage hanches et genoux en haut, sans hyperextension", "Descente contrôlée, barre près du corps"] },
  { id: "traction", n: "Traction", crit: ["Départ bras tendus", "Menton au-dessus de la barre", "Omoplates qui descendent avant de tirer", "Pas de balancier (kipping) sauf voulu", "Coudes vers les hanches", "Descente contrôlée"] },
  { id: "dips", n: "Dips", crit: ["Épaule descend au niveau du coude (ou amplitude visée)", "Épaules basses, loin des oreilles", "Coudes vers l'arrière, pas écartés", "Buste légèrement penché", "Verrouillage bras tendus en haut", "Pas de rebond en bas"] },
  { id: "muscleup", n: "Muscle-up", crit: ["Tirage haut vers la poitrine ou le nombril", "Transition rapide, poignets par-dessus la barre", "Pas de « poulet » (un bras après l'autre)", "Corps gainé, balancier contrôlé", "Verrouillage complet en haut", "Descente contrôlée"] },
  { id: "militaire", n: "Développé militaire", crit: ["Gainage : fessiers et abdos serrés", "Pas de cambrure excessive", "Barre passe près du visage", "Tête qui passe sous la barre en haut", "Barre au-dessus du milieu du pied en haut", "Avant-bras verticaux"] },
  { id: "rowing", n: "Rowing barre", crit: ["Buste stable (angle tenu toute la série)", "Dos neutre", "Barre tirée vers le nombril", "Omoplates serrées en haut", "Pas d'élan des jambes ou du buste", "Descente contrôlée bras tendus"] },
  { id: "fentes", n: "Fentes", crit: ["Genou avant dans l'axe du pied", "Buste droit", "Genou arrière proche du sol", "Poids sur le talon avant", "Bassin stable (ne bascule pas)", "Pas assez grand"] },
  { id: "epaule-jete", n: "Épaulé-jeté", crit: ["Position de départ : épaules devant la barre", "Barre près du corps à la 1re et 2e tirée", "Extension complète (chevilles, genoux, hanches)", "Réception rapide, coudes hauts", "Jeté : appel vertical, réception en fente stable", "Pieds alignés au retour"] },
  { id: "arrache", n: "Arraché", crit: ["Prise large, dos neutre au départ", "Barre près du corps, contact hanche", "Extension complète avant de tirer sous la barre", "Réception bras verrouillés, barre au-dessus de la nuque", "Squat de réception profond et stable", "Barre au-dessus du milieu du pied"] },
  { id: "hipthrust", n: "Hip thrust", crit: ["Haut du dos sur le banc, sous les omoplates", "Tibias verticaux en haut", "Bassin en rétroversion en haut (pas de cambrure)", "Menton rentré", "Pause en haut", "Poussée par les talons"] },
  { id: "rdl", n: "Soulevé de terre roumain", crit: ["Genoux légèrement fléchis et fixes", "Hanches qui reculent", "Dos neutre", "Barre collée aux cuisses", "Descente jusqu'à l'étirement des ischios", "Remontée par la poussée des hanches"] },
  { id: "frontsquat", n: "Front squat", crit: ["Coudes hauts tout le long", "Buste droit", "Profondeur", "Genoux dans l'axe des pieds", "Talons au sol", "Barre au-dessus du milieu du pied"] },
  { id: "autre", n: "Autre mouvement", crit: ["Amplitude complète", "Trajectoire maîtrisée", "Posture stable", "Tempo contrôlé"] },
];
export const mouvement = (id) => MOUVEMENTS.find(m => m.id === id) || MOUVEMENTS.at(-1);
export function scoreCriteres(mvt, notes = {}) { const c = mouvement(mvt).crit, v = c.map((_, i) => notes[i]).filter(Boolean); if (!v.length) return null; return Math.round(v.reduce((a, x) => a + (x === "ok" ? 1 : x === "moyen" ? 0.5 : 0), 0) / v.length * 100); }
// Inclinaison d'une ligne par rapport à la verticale (0° = verticale, 90° = horizontale), en tenant compte des proportions de l'image
export function inclinaison(a, b, w = 1, h = 1) { const dx = (b.x - a.x) * w, dy = (b.y - a.y) * h; if (!dx && !dy) return null; return Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI); }
// Valeur d'un outil de mesure (angle à 3 points ou ligne) pour comparer deux arrêts sur image
export function valeurOutil(it, w = 1, h = 1) { if (it.k === "angle") return angle({ x: it.a.x * w, y: it.a.y * h }, { x: it.b.x * w, y: it.b.y * h }, { x: it.c.x * w, y: it.c.y * h }); if (it.k === "ligne") return inclinaison(it.a, it.b, w, h); return null; }
export function comparer(k1, k2, w = 1, h = 1) {
  const m1 = (k1.items || []).filter(i => i.k === "angle" || i.k === "ligne"), m2 = (k2.items || []).filter(i => i.k === "angle" || i.k === "ligne");
  return m1.map((it, i) => { const o = m2.filter(x => x.k === it.k)[m1.filter(x => x.k === it.k).indexOf(it)]; const a = valeurOutil(it, w, h), b = o ? valeurOutil(o, w, h) : null; return { k: it.k, n: m1.filter(x => x.k === it.k).indexOf(it) + 1, a, b, delta: a != null && b != null ? b - a : null }; });
}
// Lissage (moyenne glissante) puis vitesse verticale ; y en mètres (vers le bas positif dans l'image) → vitesse positive = la barre monte
export function lisser(pts, k = 2) { return pts.map((p, i) => { const s = pts.slice(Math.max(0, i - k), i + k + 1); return { ...p, x: s.reduce((a, q) => a + q.x, 0) / s.length, y: s.reduce((a, q) => a + q.y, 0) / s.length }; }); }
export function vitesses(pts) { const out = []; for (let i = 1; i < pts.length; i++) { const dt = pts[i].t - pts[i - 1].t; if (dt > 0) out.push({ t: (pts[i].t + pts[i - 1].t) / 2, v: -(pts[i].y - pts[i - 1].y) / dt }); } return out; }
// Phases : excentrique (la barre descend) et concentrique (elle monte). seuil : vitesse minimale pour compter un mouvement ; amp : déplacement minimal
export function phases(pts, { seuil = 0.05, amp = 0.05 } = {}) {
  const P = lisser(pts), V = vitesses(P), out = []; let cur = null;
  for (let i = 0; i < V.length; i++) { const s = V[i].v > seuil ? "con" : V[i].v < -seuil ? "exc" : null;
    if (s && (!cur || cur.type !== s)) { if (cur) out.push(cur); cur = { type: s, i0: i, i1: i }; } else if (s && cur) cur.i1 = i; else if (!s && cur && V[i].t - V[cur.i1].t > 0.25) { out.push(cur); cur = null; } }
  if (cur) out.push(cur);
  return out.map(p => { const vs = V.slice(p.i0, p.i1 + 1), t0 = P[p.i0].t, t1 = P[p.i1 + 1].t, disp = Math.abs(P[p.i1 + 1].y - P[p.i0].y);
    return { type: p.type, t0, t1, dur: Math.round((t1 - t0) * 100) / 100, disp: Math.round(disp * 1000) / 1000, vMoy: Math.round(disp / Math.max(0.01, t1 - t0) * 100) / 100, vMax: Math.round(Math.max(...vs.map(x => Math.abs(x.v))) * 100) / 100 }; })
    .filter(p => p.disp >= amp);
}
// Répétitions : une excentrique suivie d'une concentrique (squat, bench) ou concentrique seule (soulevé de terre, traction)
export function reps(ph) { const r = []; for (let i = 0; i < ph.length; i++) { if (ph[i].type === "exc" && ph[i + 1]?.type === "con") { r.push({ exc: ph[i], con: ph[i + 1] }); i++; } else if (ph[i].type === "con") r.push({ exc: null, con: ph[i] }); } return r; }
// Écart horizontal maximal de la barre (en mètres si l'échelle est donnée) et son sens (vers l'avant = vers la droite de l'image si l'athlète regarde à droite)
export function ecartHorizontal(pts) { if (pts.length < 2) return null; const x0 = pts[0].x, xs = pts.map(p => p.x - x0); const mx = Math.max(...xs), mn = Math.min(...xs); return { max: Math.round((mx - mn) * 1000) / 1000, droite: Math.round(mx * 1000) / 1000, gauche: Math.round(-mn * 1000) / 1000 }; }
