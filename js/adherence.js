// Moteur pur de régularité (adhérence) : score, statut, alertes de décrochage, bilan de progression.
// Aucun accès au DOM, au stockage ni au réseau : tout arrive en paramètres. Testé par `node --test tests/adherence.test.mjs`.
//
// Score sur une fenêtre de jours (14 par défaut), de 0 à 100, à partir de 4 piliers pondérés :
//   séances faites / prévues (40) · jours avec repas notés (25) · jours avec routine notée (15) · bilans envoyés (20).
// Un pilier sans objet (pas de séance prévue, fenêtre trop courte pour un bilan) est retiré et les poids sont redistribués.

export const WEIGHTS = { train: 40, food: 25, routine: 15, checkin: 20 };
export const LABELS = { train: "Séances", food: "Repas notés", routine: "Poids, sommeil, pas", checkin: "Bilans" };
export const STATUS = {
  new: { label: "Nouveau", tone: "n", hint: "Pas encore assez de jours pour juger." },
  ok: { label: "Sur la bonne voie", tone: "g", hint: "Régularité solide, continue." },
  watch: { label: "À surveiller", tone: "o", hint: "Ça glisse un peu : un petit ajustement suffit." },
  risk: { label: "Décroche", tone: "r", hint: "On repart cette semaine : une seule chose à remettre en place suffit." },
};

const MS = 864e5;
const toDate = (d) => new Date(String(d).slice(0, 10) + "T12:00:00Z");
export const addDays = (d, n) => { const x = toDate(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / MS);
export const mondayOf = (d) => addDays(d, -((toDate(d).getUTCDay() + 6) % 7));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const round = (x) => Math.round(x);

/**
 * Score d'une fenêtre [from, to] (dates incluses).
 * @param {Object<string,{st?:string,food?:boolean,routine?:boolean}>} days  jour → { st: done|missed|planned|rest|away, food, routine }
 * @param {string[]} checkins dates (YYYY-MM-DD) des bilans envoyés
 * @param {string} from
 * @param {string} to
 */
export function scoreWindow(days, checkins, from, to) {
  const n = daysBetween(from, to) + 1;
  if (n <= 0) return { score: null, parts: {}, n: 0 };
  let done = 0, missed = 0, food = 0, routine = 0;
  for (let i = 0; i < n; i++) {
    const k = addDays(from, i), x = days[k] || {};
    if (x.st === "done") done++; else if (x.st === "missed") missed++;
    if (x.food) food++;
    if (x.routine) routine++;
  }
  const ci = (checkins || []).filter(d => d >= from && d <= to).length;
  const expectCi = Math.floor(n / 7); // un bilan attendu par semaine complète
  const parts = {
    train: done + missed > 0 ? { pct: done / (done + missed), done, of: done + missed } : null,
    food: { pct: food / n, done: food, of: n },
    routine: { pct: routine / n, done: routine, of: n },
    checkin: expectCi > 0 ? { pct: clamp01(ci / expectCi), done: ci, of: expectCi } : (ci > 0 ? { pct: 1, done: ci, of: ci } : null),
  };
  let w = 0, s = 0;
  for (const k of Object.keys(WEIGHTS)) if (parts[k]) { w += WEIGHTS[k]; s += WEIGHTS[k] * parts[k].pct; }
  return { score: w ? round(s / w * 100) : null, parts, n };
}

export function statusOf(score, ageDays = 99) {
  if (score == null || ageDays < 3) return "new";
  return score >= 70 ? "ok" : score >= 45 ? "watch" : "risk";
}

/**
 * Régularité complète au jour `today`.
 * @param {object} p { days, checkins, today, since } — since = date de début (inscription ou début de programme)
 */
export function adherence({ days = {}, checkins = [], today, since = null, window = 14 }) {
  const start = since && since > addDays(today, -(window - 1)) ? since : addDays(today, -(window - 1));
  const age = since ? daysBetween(since, today) + 1 : window;
  const main = scoreWindow(days, checkins, start, today);
  // Tendance : 7 derniers jours contre les 7 précédents (seulement si l'historique existe)
  const cur7 = scoreWindow(days, checkins, maxDate(addDays(today, -6), since), today);
  const prevTo = addDays(today, -7), prevFrom = addDays(today, -13);
  const prev7 = since && since > prevTo ? { score: null } : scoreWindow(days, checkins, maxDate(prevFrom, since), prevTo);
  const trend = cur7.score != null && prev7.score != null ? cur7.score - prev7.score : null;
  return { score: main.score, parts: main.parts, days: main.n, week: cur7.score, prevWeek: prev7.score, trend, status: statusOf(main.score, age), age };
}
const maxDate = (a, b) => (b && b > a ? b : a);

// Série de scores hebdomadaires (pour la courbe du rapport) : un point par semaine, du plus ancien au plus récent
export function weeklyScores({ days = {}, checkins = [], today, since = null, weeks = 8 }) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const to = addDays(today, -7 * i), from = addDays(to, -6);
    if (since && to < since) continue;
    const r = scoreWindow(days, checkins, maxDate(from, since), to);
    if (r.score != null) out.push({ to, score: r.score });
  }
  return out;
}

/**
 * Alertes de décrochage pour le coach (et un rappel doux pour le membre).
 * @returns {{level:'risk'|'watch'|'info', code:string, text:string}[]} triées par gravité
 */
export function alerts({ adh, today, lastActive = null, lastCheckin = null, checkinExpected = true, agenda = [], health = null, lastCi = null }) {
  const out = [], push = (level, code, text) => out.push({ level, code, text });
  const idle = lastActive ? daysBetween(lastActive, today) : null;
  if (idle != null && idle >= 7) push("risk", "idle", `Aucune activité depuis ${idle} jours`);
  else if (idle != null && idle >= 4) push("watch", "idle", `Rien noté depuis ${idle} jours`);
  if (adh?.status === "risk") push("risk", "score", `Régularité à ${adh.score} / 100`);
  if (adh?.trend != null && adh.trend <= -20) push("risk", "drop", `Régularité en chute : ${adh.trend} points en une semaine`);
  const ciAge = lastCheckin ? daysBetween(lastCheckin, today) : null;
  if (checkinExpected && (adh?.age ?? 99) >= 8 && (ciAge == null || ciAge > 9)) push("watch", "checkin", ciAge == null ? "Aucun bilan envoyé" : `Pas de bilan depuis ${ciAge} jours`);
  // Deux séances loupées d'affilée sur les 10 derniers jours
  const past = (agenda || []).filter(a => a.d <= today && a.d >= addDays(today, -10) && ["done", "missed"].includes(a.st)).sort((a, b) => a.d.localeCompare(b.d));
  let run = 0, maxRun = 0; past.forEach(a => { run = a.st === "missed" ? run + 1 : 0; maxRun = Math.max(maxRun, run); });
  if (maxRun >= 2) push("watch", "missed", `${maxRun} séances loupées d'affilée`);
  if (lastCi) {
    if (lastCi.energy != null && lastCi.energy <= 4) push("watch", "energy", `Énergie basse au dernier bilan (${lastCi.energy}/10)`);
    if (lastCi.sleepH != null && lastCi.sleepH < 6) push("watch", "sleep", `Sommeil court au dernier bilan (${String(lastCi.sleepH).replace(".", ",")} h)`);
    if (lastCi.stress != null && lastCi.stress >= 8) push("watch", "stress", `Stress élevé au dernier bilan (${lastCi.stress}/10)`);
    if (lastCi.mood != null && lastCi.mood <= 2) push("watch", "mood", "Moral bas au dernier bilan");
  }
  if (health?.flags?.length) push("info", "health", `Anamnèse : ${health.flags.length} point${health.flags.length > 1 ? "s" : ""} santé à vérifier`);
  const order = { risk: 0, watch: 1, info: 2 };
  // Une seule alerte par code, la plus grave
  const seen = new Set();
  return out.sort((a, b) => order[a.level] - order[b.level]).filter(a => !seen.has(a.code) && seen.add(a.code));
}

// Moyenne glissante simple d'une série { d, v } sur les `n` derniers points jusqu'à `to`
export function avgUntil(series, to, n = 7) {
  const pts = series.filter(p => p.d <= to && p.v != null).slice(-n);
  return pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
}

/**
 * Résumé chiffré d'une période, pour le rapport de progression et la candidature.
 * @param {object} p { from, to, weights:[{d,v}], measures:[{d,...}], workouts:[{end, volume}], lifts:{ex:[{d,e1rm}]}, checkins:[...], adh }
 */
export function progressSummary({ from, to, weights = [], measures = [], workouts = [], lifts = {}, checkins = [] }) {
  const ws = weights.filter(p => p.v != null).sort((a, b) => a.d.localeCompare(b.d));
  const inW = ws.filter(p => p.d >= from && p.d <= to);
  const w0 = inW.length ? avgUntil(ws, inW[0].d, 3) : null, w1 = inW.length ? avgUntil(ws, to, 7) : null;
  const mdelta = (k) => {
    const m = measures.filter(x => x[k] != null && x.d >= from && x.d <= to).sort((a, b) => a.d.localeCompare(b.d));
    return m.length >= 2 ? { from: m[0][k], to: m.at(-1)[k], delta: m.at(-1)[k] - m[0][k], d0: m[0].d, d1: m.at(-1).d } : null;
  };
  const ws2 = workouts.filter(w => { const d = String(w.end || "").slice(0, 10); return d >= from && d <= to; });
  const best = Object.entries(lifts || {}).map(([name, h]) => {
    const hh = (h || []).filter(x => x.d >= from && x.d <= to && x.e1rm > 0);
    if (hh.length < 2) return null;
    const a = hh[0].e1rm, b = Math.max(...hh.map(x => x.e1rm));
    return { name, from: a, to: b, delta: b - a, pct: a ? (b - a) / a : 0 };
  }).filter(x => x && x.delta > 0).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const cis = checkins.filter(c => c.d >= from && c.d <= to);
  const avgOf = (k) => { const v = cis.map(c => c[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  return {
    from, to, days: daysBetween(from, to) + 1,
    weight: w0 != null && w1 != null ? { from: w0, to: w1, delta: w1 - w0 } : null,
    waist: mdelta("waistNav"), hips: mdelta("hips"), chest: mdelta("chest"), arm: mdelta("arm_r_r") || mdelta("arm_r_c"),
    sessions: ws2.length, tonnage: ws2.reduce((a, w) => a + (w.volume || 0), 0),
    lifts: best, checkins: cis.length,
    energy: avgOf("energy"), sleep: avgOf("sleepH"),
    wins: cis.map(c => c.win).filter(Boolean),
  };
}
