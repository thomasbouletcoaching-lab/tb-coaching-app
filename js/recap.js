// Récap de séance : pour chaque exercice, le schéma prévu, les séries de la dernière fois et l'écart série par série.
// Pur (sans DOM ni état) : testé par tests/recap.test.mjs.
const work = (e) => (e.sets || []).filter(s => s.done && s.type !== "W");
const f = (x) => String(Math.round(x * 100) / 100).replace(".", ",");

// Dernière séance (finie, avant w) qui contient le même exercice avec au moins une série faite
export function precedent(w, workouts, name) {
  const t = new Date(w.start).getTime();
  return (workouts || []).filter(x => x.id !== w.id && x.end && new Date(x.start).getTime() < t)
    .sort((a, b) => new Date(b.start) - new Date(a.start))
    .map(x => ({ w: x, e: (x.exercises || []).find(e => e.name === name && work(e).length) })).find(x => x.e) || null;
}
// Écart d'une série par rapport à la série de même rang la dernière fois
export function ecart(s, p) {
  if (!p) return { txt: "nouveau", sens: 0 };
  const dk = (s.kg || 0) - (p.kg || 0), dr = (s.reps || 0) - (p.reps || 0);
  const parts = [];
  if (Math.abs(dk) >= 0.01) parts.push(`${dk > 0 ? "+" : "−"}${f(Math.abs(dk))} kg`);
  if (dr) parts.push(`${dr > 0 ? "+" : "−"}${Math.abs(dr)} rep${Math.abs(dr) > 1 ? "s" : ""}`);
  if (!parts.length) return { txt: "=", sens: 0 };
  const sens = dk > 0 || (dk === 0 && dr > 0) ? 1 : dk < 0 || dr < 0 ? -1 : 0;
  return { txt: parts.join(" "), sens };
}
export function recapExercice(w, e, workouts) {
  const prev = precedent(w, workouts, e.name), ps = prev ? work(prev.e) : [];
  const series = work(e).map((s, i) => ({ s, avant: ps[i] || null, ecart: ecart(s, ps[i]) }));
  const vol = (l) => l.reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0);
  return { prevu: e.scheme || null, avantLe: prev ? prev.w.start : null, avant: ps, series, dVol: prev ? vol(work(e)) - vol(ps) : null };
}
export const serieTxt = (s) => s ? `${s.kg ? f(s.kg) + " × " : ""}${s.reps ?? "–"}` : "–";
