// Réseau privé du coach : absence, annonces, sondages, défis de groupe. Pur (sans DOM ni état) : testé par tests/reseau.test.mjs.
export const METRIQUES = { seances: ["🏋️ Séances faites", "séances"], nutri: ["🍽️ Jours de repas notés", "jours"], cardio: ["🏃 Minutes de cardio", "min"] };
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
export const dayOf = (s) => iso(new Date(s));

// Absence en cours ou à venir (dans les 7 jours) : { now, from, to, msg } ou null
export function absenceActive(a, t) {
  if (!a?.on || !a.to || a.to < t) return null;
  const soon = a.from && a.from > t; if (soon && (new Date(a.from) - new Date(t)) / 864e5 > 7) return null;
  return { now: !soon, from: a.from, to: a.to, msg: a.msg || "" };
}
// Score d'un membre pour un défi, calculé sur ses propres données
export function scoreDefi(defi, st) {
  const from = defi.from, to = defi.to, inR = (d) => d >= from && d <= to;
  if (defi.metric === "seances") return (st.workouts || []).filter(w => w.end && inR(dayOf(w.end))).length;
  if (defi.metric === "nutri") return Object.entries(st.food || {}).filter(([d, l]) => inR(d) && (l || []).length).length;
  if (defi.metric === "cardio") return Object.entries(st.daily || {}).filter(([d]) => inR(d)).reduce((a, [, x]) => a + (x.cardio || []).reduce((b, c) => b + (+c.min || 0), 0), 0);
  return 0;
}
export const defiEtat = (defi, t) => t < defi.from ? "avenir" : t > defi.to ? "fini" : "encours";
// Totaux d'un sondage : pourcentages arrondis, total
export function resultats(opts, counts) {
  const tot = opts.reduce((a, _, i) => a + (counts[i] || 0), 0);
  return { tot, pct: opts.map((_, i) => tot ? Math.round((counts[i] || 0) / tot * 100) : 0) };
}
// Code d'invitation lisible (sans 0/O/1/I) : TB-XXXX
export function codeInvitation(rand = Math.random) { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = ""; for (let i = 0; i < 5; i++) c += A[Math.floor(rand() * A.length)]; return "TB-" + c; }
// Annonces visibles : épinglées d'abord, puis les plus récentes ; on garde 60 jours
export const annoncesVisibles = (items, t) => (items || []).filter(a => a.pin || a.d >= iso(new Date(new Date(t + "T12:00:00") - 60 * 864e5))).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.d.localeCompare(a.d));
