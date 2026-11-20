// Semaine d'entraînement en anneaux, comme la semaine nutrition : un anneau par jour selon la séance.
// Pur (sans DOM ni état) : testé par tests/anneaux-seances.test.mjs.
//   « complete » (vert)  : 90 % des séries de travail prévues validées, ou plus
//   « partielle » (orange) : séance faite mais moins de 90 % des séries
//   « loupee » (rouge)   : séance prévue, jour passé, rien de fait
//   « prevue »           : séance à venir (ou aujourd'hui pas encore faite)
//   « repos »            : pas de séance prévue
export const SEUIL_COMPLETE = 0.9;
const travail = (s) => s && s.type !== "W";
export function remplissage(ws) {
  let faites = 0, total = 0;
  (ws || []).forEach(w => (w.exercises || []).forEach(e => (e.sets || []).forEach(s => { if (!travail(s)) return; total++; if (s.done) faites++; })));
  return total ? faites / total : (ws || []).length ? 1 : 0;
}
export function statutSeance(a) {
  if (!a) return { st: "repos", pct: 0 };
  if (a.st === "done") { const pct = remplissage(a.w); return { st: pct >= SEUIL_COMPLETE ? "complete" : "partielle", pct }; }
  if (a.st === "missed") return { st: "loupee", pct: 1 };
  if (a.st === "planned") return { st: "prevue", pct: 0 };
  return { st: "repos", pct: 0 };
}
