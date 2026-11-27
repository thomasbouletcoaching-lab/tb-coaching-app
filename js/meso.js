// Mésocycles : le cycle écrit à l'avance, bloc par bloc, avec courbes de volume et d'intensité semaine par semaine.
// Module pur (aucun accès à l'écran ni au stockage) : testé dans Node, tests/meso.test.mjs.
//
// Sur le programme p :
//   p.meso   = [{ id, a, b, phase, load, sets, lo, hi, rpe, pct, step }]  blocs de semaines a à b
//   p.mesoScope = "main" (force + principal) | "comp" (+ secondaires, unilatéraux) | "all"
//   p.vol    = { [semaine]: % }   volume : nombre de séries de travail de chaque exercice
//   p.int    = { [semaine]: % }   intensité : charges (kg, % du 1RM) ou, sans charge fixée, RPE
//   p.muscleSets = { [groupe]: { [semaine]: n } }  séries voulues par muscle et par semaine
// Sur un exercice (ligne de séance, x = row[5]) :
//   x.meso = undefined | true (suit le programme) · false (ignore les blocs) · [blocs] (ses propres blocs)

export const PHASES = ["Accumulation", "Intensification", "Réalisation", "Peak", "Deload", "Test"];
export const LOADS = [
  ["kg", "Poids ↑, reps fixes"],
  ["reps", "Reps ↑, poids fixe"],
  ["double", "Double progression (reps puis poids)"],
  ["pct", "% du 1RM ↑"],
  ["rpe", "RPE ↑"],
  ["fixe", "Rien ne monte (même séance)"],
];
export const SCOPES = [["main", "Force + principal"], ["comp", "Force, principal, secondaire, unilatéral"], ["all", "Tous les exercices"]];
const KINDS = { main: ["F", "P"], comp: ["F", "P", "S", "U"] };
export const inScope = (scope, kind) => scope === "all" || (KINDS[scope || "comp"] || KINDS.comp).includes(kind);

const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 4) / 4;
const work = (s) => s.t !== "W";
const clone = (s) => ({ ...s, tech: [...(s.tech || [])] });

export const blockAt = (blocks, w) => (blocks || []).find(b => w >= b.a && w <= b.b) || null;
export const isDeloadBlock = (b) => b?.phase === "Deload";
// Dernier bloc de travail (pas allègement) qui précède la semaine w : sert de base à une semaine d'allègement
export function lastWorkBlock(blocks, w) {
  return (blocks || []).filter(b => b.b < w && !isDeloadBlock(b)).sort((x, y) => y.b - x.b)[0] || null;
}
// Phase de chaque semaine (tableau de W noms) depuis les blocs ; les semaines sans bloc gardent « fallback »
export function phasesFromBlocks(blocks, W, fallback = "Accumulation") {
  return Array.from({ length: W }, (_, i) => blockAt(blocks, i + 1)?.phase || fallback);
}

// Double progression : les reps montent d'une par étape (lo → hi), puis la charge monte et on revient en bas
function doubleStep(lo, hi, n) {
  const span = Math.max(0, (hi || lo) - lo) + 1;
  return { reps: lo + (n % span), bumps: Math.floor(n / span) };
}

// Applique un bloc à une prescription (séries) pour la semaine w. Les séries d'échauffement ne bougent pas.
export function applyBlock(sets, b, w) {
  const n = Math.max(0, w - b.a);
  let out = (sets || []).map(clone);
  if (b.sets > 0) {
    const wu = out.filter(s => !work(s)); let tr = out.filter(work);
    if (!tr.length) tr = [{ t: "N", lo: b.lo || 8, hi: b.hi || b.lo || 8, rpe: b.rpe || 8, pct: null, kg: null, tech: [] }];
    while (tr.length > b.sets) tr.pop();
    while (tr.length < b.sets) tr.push(clone(tr.at(-1)));
    out = [...wu, ...tr];
  }
  const step = +b.step || 0;
  out.forEach(s => {
    if (!work(s)) return;
    const lo = b.lo ?? s.lo, hi = b.hi ?? b.lo ?? s.hi ?? lo, base = b.pct != null ? b.pct : s.pct;
    if (b.pct != null) s.kg = null;
    const sansCharge = base == null && !s.kg;
    switch (b.load) {
      case "kg":
        s.lo = s.hi = lo;
        if (base != null) s.pct = r1(base + step * n);
        else if (s.kg) s.kg = r4(s.kg + step * n);
        else s.rpe = Math.min(9.5, (b.rpe ?? s.rpe ?? 7) + 0.5 * n);
        break;
      case "reps": { const reps = Math.min(Math.max(lo, hi), lo + n); s.lo = s.hi = reps; if (base != null) s.pct = base; break; }
      case "double": {
        const { reps, bumps } = doubleStep(lo, Math.max(lo, hi), n); s.lo = s.hi = reps;
        if (base != null) s.pct = r1(base + (step || 2.5) * bumps); else if (s.kg) s.kg = r4(s.kg + (step || 2.5) * bumps);
        break;
      }
      case "pct": s.lo = lo; s.hi = hi; if (base != null) s.pct = r1(base + step * n); break;
      case "rpe": s.lo = lo; s.hi = hi; s.rpe = Math.min(10, (b.rpe ?? s.rpe ?? 7) + step * n); break;
      default: s.lo = lo; s.hi = hi; if (base != null) s.pct = base;
    }
    if (b.rpe != null && b.load !== "rpe" && !(b.load === "kg" && sansCharge)) s.rpe = b.rpe;
  });
  return out;
}

// Volume : nombre de séries de travail × f (au moins 1). Moins : on retire les dernières ; plus : on clone la dernière.
export function scaleVolume(sets, f) {
  if (!f || Math.abs(f - 1) < 0.005) return sets;
  const wu = sets.filter(s => !work(s)), tr = sets.filter(work); if (!tr.length) return sets;
  const n = Math.max(1, Math.round(tr.length * f)), out = tr.slice(0, n);
  while (out.length < n) { const l = clone(out.at(-1)); if (l.t === "T") l.t = "B"; out.push(l); }
  return [...wu, ...out];
}
// Intensité : charges × f ; sans charge fixée, le RPE bouge de 1 point pour 10 %
export function scaleIntensity(sets, f) {
  if (!f || Math.abs(f - 1) < 0.005) return sets;
  return sets.map(s => {
    if (!work(s)) return s; const o = clone(s);
    if (o.pct) o.pct = r1(o.pct * f); else if (o.kg) o.kg = r4(o.kg * f);
    else if (o.rpe) o.rpe = Math.max(5, Math.min(10, Math.round((o.rpe + (f - 1) * 10) * 2) / 2));
    return o;
  });
}
export const curveAt = (curve, w) => { const v = curve?.[w]; return v == null || v === "" ? 1 : Math.max(0.1, +v / 100); };
export const hasCurves = (p) => !!(p && ((p.vol && Object.keys(p.vol).length) || (p.int && Object.keys(p.int).length)));

// Séries par muscle : écart entre le voulu (p.muscleSets[groupe][w]) et le prévu, réparti sur les exercices du muscle.
// rows : [{ key, n, fx: [{ g: id du groupe, c: coefficient }] }] ; renvoie { key: nouveau n } pour les lignes à modifier.
export function muscleAdjust(targets, w, rows) {
  const out = {}, N = new Map(rows.map(r => [r.key, r.n]));
  Object.entries(targets || {}).forEach(([g, byW]) => {
    const T = byW?.[w]; if (T == null || T === "") return;
    let cur = 0; const direct = [];
    rows.forEach(r => r.fx.forEach(f => { if (f.g !== g) return; cur += N.get(r.key) * f.c; if (f.c >= 1) direct.push(r.key); }));
    let delta = Math.round(+T - cur), guard = 200; if (!direct.length || !delta) return;
    while (delta !== 0 && guard--) {
      const cand = delta > 0 ? direct.filter(k => N.get(k) < 8) : direct.filter(k => N.get(k) > 1); if (!cand.length) break;
      const k = cand.sort((a, b) => delta > 0 ? N.get(a) - N.get(b) : N.get(b) - N.get(a))[0];
      N.set(k, N.get(k) + Math.sign(delta)); delta -= Math.sign(delta);
    }
  });
  rows.forEach(r => { if (N.get(r.key) !== r.n) out[r.key] = N.get(r.key); });
  return out;
}

// Séries de travail ramenées à n (les dernières sautent, ou on clone la dernière)
export function resizeSets(sets, n) {
  const wu = sets.filter(s => !work(s)), tr = sets.filter(work); if (!tr.length || tr.length === n) return sets;
  const out = tr.slice(0, n); while (out.length < n) { const l = clone(out.at(-1)); if (l.t === "T") l.t = "B"; out.push(l); }
  return [...wu, ...out];
}

// Un cycle d'exemple (16 semaines) : 3×8, 3×4, 3×6, singles/doubles/triples, chaque fois suivi d'un allègement
export function exemple16() {
  const b = (a, bb, phase, load, o) => ({ id: "b" + a, a, b: bb, phase, load, ...o });
  return {
    meso: [
      b(1, 3, "Accumulation", "kg", { sets: 3, lo: 8, hi: 8, pct: 70, step: 2.5, rpe: null }),
      b(4, 4, "Deload", "fixe", {}),
      b(5, 7, "Intensification", "kg", { sets: 3, lo: 4, hi: 4, pct: 80, step: 2.5, rpe: null }),
      b(8, 8, "Deload", "fixe", {}),
      b(9, 11, "Accumulation", "double", { sets: 3, lo: 6, hi: 8, pct: 75, step: 2.5, rpe: null }),
      b(12, 12, "Deload", "fixe", {}),
      b(13, 15, "Réalisation", "pct", { sets: 4, lo: 1, hi: 3, pct: 88, step: 2, rpe: null }),
      b(16, 16, "Deload", "fixe", {}),
    ],
    vol: { 1: 100, 2: 110, 3: 120, 4: 60, 5: 100, 6: 100, 7: 90, 8: 60, 9: 110, 10: 120, 11: 130, 12: 60, 13: 80, 14: 70, 15: 60, 16: 50 },
    int: { 1: 100, 2: 100, 3: 100, 4: 90, 5: 100, 6: 100, 7: 100, 8: 90, 9: 100, 10: 100, 11: 100, 12: 90, 13: 100, 14: 100, 15: 100, 16: 90 },
  };
}
