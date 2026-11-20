// Régularité récompensée : points, niveaux, avatar, quêtes du jour, trophées et récompenses.
// Tout est calculé à partir des données déjà présentes sur le téléphone (aucune donnée nouvelle, aucun serveur).
// Principe : on récompense le fait de revenir (reprises, plan minimum, « Je craque » assumé), jamais le poids ni le corps.
import { S, today } from "./store.js";
import * as E from "./engine.js";
import * as N from "./nutrition.js";
import { esc } from "./core.js";
import { palier } from "./paliers.js";

const MAX_DAYS = 800;
const shift = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

// Paliers : la personne telle qu'elle se construit. Le nom dépend du genre CHOISI et du profil réel (js/paliers.js).
export const stageOf = (level, profile = S().profile) => palier(level, profile);

// Les anciens trophées sont devenus des badges de l'armoire (js/armoire.js, décision C61).
export const REWARDS = [
  { id: "r3", lvl: 3, icon: "🎟️", name: "−5 % sur ta candidature coaching", discount: true },
  { id: "r5", lvl: 5, icon: "🎟️", name: "−10 % sur ta candidature coaching", discount: true },
  { id: "r10", lvl: 10, icon: "🎟️", name: "−15 % sur ta candidature coaching", discount: true },
];

// Score d'une journée : 1 point par geste juste, plus un bonus quand les trois piliers tiennent
export function dayScore(d, ag) {
  const st = ag[d]?.st;
  const done = st === "done";
  const corps = done || st === "rest" || st === "away";
  const t = N.targets();
  const p = t?.prot ? (N.dayTotals(d).p || 0) : 0;
  const nutri = !!t?.prot && p / t.prot >= 0.9;
  const D = S().daily[d] || {};
  const routine = [D.weight, D.steps, D.sleep, D.water, N.dayLog(d).length].filter(Boolean).length >= 3;
  const crise = (S().crises || []).some(c => c.d === d);
  const score = [corps, nutri, routine].filter(Boolean).length;
  const points = (done ? 40 : 0) + (corps ? 10 : 0) + (nutri ? 10 : 0) + (routine ? 10 : 0) + (score === 3 ? 20 : 0) + (crise ? 10 : 0);
  return { d, done, corps, nutri, routine, crise, score, points };
}

// Chiffres de la personne : points, niveau, série, reprises, trophées
export function gather(today_ = today()) {
  const keys = new Set([...Object.keys(S().daily), ...Object.keys(S().food || {}), ...(S().crises || []).map(c => c.d)]);
  const empty = { points: 0, level: 1, nextAt: 40, levelPct: 0, sessions: 0, weekSessions: 0, streak: 0, comebacks: 0, crises: 0, proteinDays: 0, today: null, byDay: {} };
  if (!keys.size) return empty;
  const start = [...keys].sort()[0];
  const ag = E.agenda(start, today_);
  const byDay = {};
  let d = start;
  for (let i = 0; d <= today_ && i < MAX_DAYS; i++, d = shift(d, 1)) byDay[d] = dayScore(d, ag);
  const days = Object.keys(byDay).sort();
  const points = days.reduce((a, k) => a + byDay[k].points, 0);
  const level = Math.floor(Math.sqrt(points / 40)) + 1;
  const floorAt = 40 * (level - 1) ** 2, nextAt = 40 * level ** 2;
  let streak = 0, k = today_;
  if ((byDay[k]?.score || 0) < 2) k = shift(k, -1);
  while (byDay[k] && byDay[k].score >= 2 && streak < 400) { streak++; k = shift(k, -1); }
  let comebacks = 0;
  for (let i = 1; i < days.length; i++) if (byDay[days[i - 1]].score < 2 && byDay[days[i]].score >= 2 && byDay[days[i - 1]].score !== undefined) comebacks++;
  const weekStart = shift(today_, -6);
  const sessions = days.filter(x => byDay[x].done).length;
  const weekSessions = days.filter(x => x >= weekStart && byDay[x].done).length;
  return {
    points, level, nextAt, levelPct: Math.round((points - floorAt) / (nextAt - floorAt) * 100), sessions, weekSessions, streak, comebacks,
    crises: days.filter(x => byDay[x].crise).length, proteinDays: days.filter(x => byDay[x].nutri).length,
    today: byDay[today_] || null, byDay,
  };
}

// Réductions réservées aux abonnés en autonomie (pas aux personnes déjà coachées ni aux invités) ; aucune récompense
// ne prend du temps de coaching (décision C61)
export const ABONNES_AUTONOMIE = ["premium", "essentiel"];
export const rewardsFor = (tier = S().me?.tier) => REWARDS.filter(r => !r.discount || ABONNES_AUTONOMIE.includes(tier));

// Quêtes du jour : les gestes qui comptent, avec leur valeur en points
export function dailyQuests(c) {
  const t = c.today || { corps: false, nutri: false, routine: false };
  return [
    { n: "Séance faite, ou plan minimum de 10 min", ok: t.corps, p: 10 },
    { n: "Protéines à 90 % de ta cible", ok: t.nutri, p: 10 },
    { n: "Trois cases de ta routine remplies", ok: t.routine, p: 10 },
  ];
}
// La carte de l'accueil est désormais dans js/views/trophees.js (carteProgression, décision C61).
