// Bilans réglés par le coach pour chaque membre : activés ou non, jour, fréquence, questions en plus.
// Pur (sans DOM ni état) : testé par tests/bilan-reglages.test.mjs.
// reglage = { on: true, dow: 6 (0 = lundi … 6 = dimanche), every: 1 | 2 | 4 (semaines), from: "AAAA-MM-JJ" (début du rythme),
//             questions: ["Comment va ton genou ?"], digest: true (transit et digestion) }
export const BILAN_DEFAUT = { on: true, dow: 6, every: 1, from: null, questions: [], digest: false };
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const add = (k, n) => { const d = new Date(k + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const dow = (k) => (new Date(k + "T12:00:00").getDay() + 6) % 7;
const days = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);

// Jour du bilan le plus récent (≤ t) selon le rythme ; le premier bilan tombe le premier « dow » à partir de « from »
export function dernierJourBilan(r, t) {
  const g = { ...BILAN_DEFAUT, ...(r || {}) }, from = g.from || t;
  let first = from; while (dow(first) !== g.dow) first = add(first, 1);
  if (first > t) return null;
  const step = 7 * Math.max(1, g.every || 1), n = Math.floor(days(first, t) / step);
  return add(first, n * step);
}
export function prochainJourBilan(r, t) {
  const g = { ...BILAN_DEFAUT, ...(r || {}) }, last = dernierJourBilan(g, t);
  if (!last) { let f = g.from || t; while (dow(f) !== g.dow) f = add(f, 1); return f; }
  return last === t ? t : add(last, 7 * Math.max(1, g.every || 1));
}
// Le bilan est à faire du jour prévu jusqu'à 3 jours après, s'il n'a pas déjà été fait depuis la veille du jour prévu
export function bilanAFaire(r, t, dernierFait) {
  const g = { ...BILAN_DEFAUT, ...(r || {}) };
  if (!g.on) return { due: false, prochain: null };
  const last = dernierJourBilan(g, t), prochain = prochainJourBilan(g, t);
  if (!last || days(last, t) > 3) return { due: false, prochain };
  const fait = dernierFait && dernierFait >= add(last, -1);
  return { due: !fait, jour: last, prochain };
}
export const libelleRythme = (r) => { const g = { ...BILAN_DEFAUT, ...(r || {}) }; if (!g.on) return "Bilans désactivés"; const j = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"][g.dow]; return g.every === 1 ? `Chaque semaine · le ${j}` : g.every === 2 ? `Toutes les 2 semaines · le ${j}` : `Toutes les 4 semaines · le ${j}`; };
