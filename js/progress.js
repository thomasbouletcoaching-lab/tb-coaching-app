// Données de régularité tirées de l'état local (membre, ou membre affiché par le coach via withState).
// Le calcul lui-même est dans adherence.js (pur, testé) ; ce fichier ne fait que préparer les entrées.
import { S, today } from "./store.js";
import * as E from "./engine.js";
import { TRIAL_DAYS } from "./config.js";
import { adherence, alerts, weeklyScores, progressSummary, addDays, daysBetween, mondayOf } from "./adherence.js";

export { addDays, daysBetween, mondayOf };

// Date de départ du suivi : inscription, sinon début de programme
export const since = () => S().profile?.createdAt || S().trialStart || S().plan?.startedAt || null;

// Faits du jour pour le score : séance faite / loupée / prévue, repas notés, routine notée
export function dayFacts(from, to) {
  let ag = {}; try { ag = E.agenda(from, to); } catch { }
  const food = S().food || {}, daily = S().daily || {}, out = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const x = daily[d] || {};
    out[d] = { st: ag[d]?.st || null, food: (food[d] || []).length > 0, routine: !!(x.weight || x.sleep || x.steps) };
  }
  return out;
}

export const checkins = () => (S().checkins || []).slice().sort((a, b) => a.d.localeCompare(b.d));
export const lastCheckin = () => checkins().at(-1) || null;
export const checkinThisWeek = (t = today()) => checkins().find(c => c.d >= mondayOf(t)) || null;

export function myAdherence(t = today()) {
  const from = addDays(t, -27);
  return adherence({ days: dayFacts(from, t), checkins: checkins().map(c => c.d), today: t, since: since() });
}
export function myWeekly(t = today(), weeks = 8) {
  const from = addDays(t, -(7 * weeks));
  return weeklyScores({ days: dayFacts(from, t), checkins: checkins().map(c => c.d), today: t, since: since(), weeks });
}
export function lastActive() {
  const st = S(), lw = st.workouts?.at(-1)?.end?.slice(0, 10);
  const acts = [lw, ...Object.keys(st.food || {}).filter(k => (st.food[k] || []).length), ...Object.keys(st.daily || {}).filter(k => Object.keys(st.daily[k] || {}).length), ...checkins().map(c => c.d)].filter(Boolean).sort();
  return acts.at(-1) || null;
}
export function myAlerts(t = today(), checkinExpected = true) {
  const adh = myAdherence(t); let ag = [];
  try { ag = Object.entries(E.agenda(addDays(t, -10), t)).map(([d, a]) => ({ d, st: a.st })); } catch { }
  return alerts({ adh, today: t, lastActive: lastActive(), lastCheckin: lastCheckin()?.d, checkinExpected, agenda: ag, lastCi: lastCheckin(), health: S().anamnese });
}

// Poids : moyenne des pesées (routine du jour, à défaut mesures)
export function weightSeries() {
  const m = new Map();
  (S().measures || []).forEach(x => { if (x.weight) m.set(x.d, x.weight); });
  Object.entries(S().daily || {}).forEach(([d, x]) => { if (x.weight) m.set(d, x.weight); });
  return [...m.entries()].sort().map(([d, v]) => ({ d, v }));
}
export function weightAvg7(t = today()) {
  const pts = weightSeries().filter(p => p.d <= t && p.d >= addDays(t, -6));
  return pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : null;
}
export function summaryBetween(from, to = today()) {
  return progressSummary({ from, to, weights: weightSeries(), measures: S().measures || [], workouts: S().workouts || [], lifts: S().lifts || {}, checkins: checkins() });
}

// ---------- Défi 30 jours (essai guidé) ----------
export const DEFI_DAYS = TRIAL_DAYS;
export function defiDay(t = today()) { const s = S().trialStart; return s ? Math.max(1, daysBetween(s, t) + 1) : null; }
export function defiOn() { const d = defiDay(); return d != null && !S().me?.isCoach && d <= DEFI_DAYS + 7 && !(S().me?.tier && S().me.tier !== "free") && !S().defi?.closed; }
// Étapes : id, jour où elle s'ouvre, titre, sous-titre, faite ?, route
export function defiSteps(photosStart = !!S().defi?.photos) {
  const s = S().trialStart || today(), ci = checkins().map(c => c.d), wk = (n) => ci.some(d => d >= addDays(s, 7 * (n - 1)) && d <= addDays(s, 7 * n + 2));
  const hasMeasure = (S().measures || []).some(m => m.waistNav != null || m.hips != null || m.chest != null);
  return [
    { id: "anam", day: 1, t: "Mon point de départ", s: "Santé, historique, motivation : 3 minutes", ok: !!S().anamnese?.at, r: "anamnese" },
    { id: "mes", day: 1, t: "Mes mesures de départ", s: "Poids et tour de taille", ok: hasMeasure, r: "body" },
    { id: "pho", day: 1, t: "Mes photos de départ", s: "Face, profil, dos : même lumière à chaque fois", ok: photosStart, r: "body" },
    { id: "s1", day: 1, t: "Ma première séance", s: "Elle est prête dans Entraînement", ok: (S().workouts || []).length > 0, r: "carnet" },
    { id: "b1", day: 7, t: "Bilan de la semaine 1", s: "Moins d'une minute, pré-rempli", ok: wk(1), r: "bilan" },
    { id: "b2", day: 14, t: "Bilan de la semaine 2", s: "Et on compare avec la semaine 1", ok: wk(2), r: "bilan" },
    { id: "b3", day: 21, t: "Bilan de la semaine 3", s: "Mi-parcours : tes premiers chiffres", ok: wk(3), r: "bilan" },
    { id: "b4", day: 28, t: "Bilan de la semaine 4", s: "Dernière ligne droite", ok: wk(4), r: "bilan" },
    { id: "rap", day: 28, t: "Mon rapport de 30 jours", s: "Avant / après, chiffres, régularité", ok: !!S().defi?.report, r: "rapport" },
    { id: "cand", day: 21, t: "Passer à la suite avec Thomas", s: "Candidater au coaching personnalisé", ok: !!S().application, r: "apply-defi" },
  ];
}
