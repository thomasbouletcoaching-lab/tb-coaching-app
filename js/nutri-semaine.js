// Semaine nutrition façon « anneaux » : chaque jour entouré selon l'objectif calorique, et flamme de série.
// Pur (sans DOM ni état) : testé par tests/nutri-semaine.test.mjs.
//   vert   : à ± 10 % de l'objectif
//   orange : entre 10 et 20 % d'écart
//   rouge  : plus de 20 % d'écart
//   jaune  : aujourd'hui, journée en cours (pas encore jugée)
//   vide   : rien de noté (ou jour à venir)
export const SEUIL_OK = 0.10, SEUIL_PROCHE = 0.20, SEUIL_NOTE = 0.30;

// Un jour est « noté » quand au moins 30 % de l'objectif a été saisi (un café seul ne compte pas)
export const estNote = (kcal, cible) => cible > 0 && kcal >= cible * SEUIL_NOTE;

export function statutJour(kcal, cible, { aujourdhui = false, futur = false } = {}) {
  if (futur || !(cible > 0)) return { st: "vide", pct: 0 };
  const pct = kcal / cible;
  if (!estNote(kcal, cible)) return { st: aujourdhui && kcal > 0 ? "encours" : "vide", pct };
  const ecart = Math.abs(pct - 1);
  if (aujourdhui && pct < 1 - SEUIL_OK) return { st: "encours", pct };
  return { st: ecart <= SEUIL_OK ? "ok" : ecart <= SEUIL_PROCHE ? "proche" : "loin", pct };
}

// Séries : jours notés d'affilée, et jours dans l'objectif d'affilée. jours = du plus ancien au plus récent,
// le dernier étant aujourd'hui ; aujourd'hui pas encore noté ne casse pas la série (la journée n'est pas finie).
export function series(jours) {
  const l = jours.slice();
  if (l.length && !l.at(-1).note) l.pop();
  let notes = 0, ok = 0, i = l.length - 1;
  while (i >= 0 && l[i].note) { notes++; i--; }
  i = l.length - 1; while (i >= 0 && l[i].st === "ok") { ok++; i--; }
  let rec = 0, run = 0; jours.forEach(j => { run = j.note ? run + 1 : 0; rec = Math.max(rec, run); });
  return { notes, ok, record: Math.max(rec, notes) };
}
