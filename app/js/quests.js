// Régularité récompensée : points, niveaux, avatar, quêtes du jour, trophées et récompenses.
// Tout est calculé à partir des données déjà présentes sur le téléphone (aucune donnée nouvelle, aucun serveur).
// Principe : on récompense le fait de revenir (reprises, plan minimum, « Je craque » assumé), jamais le poids ni le corps.
import { S, today } from "./store.js";
import * as E from "./engine.js";
import * as N from "./nutrition.js";
import { esc } from "./core.js";

const MAX_DAYS = 800;
const shift = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

// Avatar : la personne telle qu'elle se construit, par stades de niveau (représentation, pas un corps idéalisé)
export const STAGES = [
  { from: 1, name: "Le Commençant", icon: "🌱", line: "Chaque début compte. Le premier pas est déjà une décision." },
  { from: 3, name: "L'Homme de la reprise", icon: "🔥", line: "Tu reviens après les écarts. C'est ça, la force." },
  { from: 5, name: "L'Homme de discipline", icon: "🛡️", line: "Ta régularité se voit : elle devient ton caractère." },
  { from: 8, name: "L'Homme de fer", icon: "🏛️", line: "Corps, régularité et méthode tiennent ensemble. Continue." },
];
export const stageOf = (level) => [...STAGES].reverse().find(s => level >= s.from);

// Trophées : débloqués par la régularité et les bons comportements, jamais par le poids
export const TROPHIES = [
  { id: "premiere", icon: "🪨", name: "Première pierre", desc: "Une séance faite", ok: c => c.sessions >= 1 },
  { id: "dix", icon: "🏋️", name: "Dix fois debout", desc: "10 séances faites", ok: c => c.sessions >= 10 },
  { id: "semaine", icon: "🔥", name: "Une semaine tenue", desc: "7 jours de série", ok: c => c.streak >= 7 },
  { id: "mois", icon: "☀️", name: "Un mois de feu", desc: "30 jours de série", ok: c => c.streak >= 30 },
  { id: "reprise", icon: "🔁", name: "Le relevé", desc: "3 reprises après un écart", ok: c => c.comebacks >= 3 },
  { id: "craque", icon: "🕊️", name: "Honnête avec soi", desc: "Un « Je craque » traité sans jugement", ok: c => c.crises >= 1 },
  { id: "bouclier", icon: "🛡️", name: "Bouclier de maîtrise", desc: "14 jours avec protéines atteintes", ok: c => c.proteinDays >= 14 },
  { id: "niveau5", icon: "⭐", name: "Niveau 5", desc: "Atteindre le niveau 5", ok: c => c.level >= 5 },
];

// Récompenses : débloquées par le niveau. Réclamées dans la conversation avec Thomas.
export const REWARDS = [
  { id: "r3", lvl: 3, icon: "🎟️", name: "−5 % sur ta candidature coaching" },
  { id: "r5", lvl: 5, icon: "🎟️", name: "−10 % sur ta candidature coaching" },
  { id: "r8", lvl: 8, icon: "🎁", name: "Une séance de 15 min offerte avec Thomas" },
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

export const unlockedTrophies = (c) => TROPHIES.filter(t => t.ok(c));
export const unlockedRewards = (c) => REWARDS.filter(r => c.level >= r.lvl);

// Quêtes du jour : les gestes qui comptent, avec leur valeur en points
export function dailyQuests(c) {
  const t = c.today || { corps: false, nutri: false, routine: false };
  return [
    { n: "Séance faite, ou plan minimum de 10 min", ok: t.corps, p: 10 },
    { n: "Protéines à 90 % de ta cible", ok: t.nutri, p: 10 },
    { n: "Trois cases de ta routine remplies", ok: t.routine, p: 10 },
  ];
}

// Carte affichée sur le Temple : niveau, avatar, quêtes du jour, accès aux trophées
export function gamCard() {
  const c = gather();
  const st = stageOf(c.level);
  const q = dailyQuests(c);
  const got = unlockedTrophies(c).length;
  return `<div class="card"><div class="row between"><div class="lbl">🎮 Ta progression</div><span class="xs muted">${c.points} pts</span></div>
    <div class="row mt8" style="gap:12px"><span style="font-size:34px;line-height:1">${st.icon}</span><div class="grow"><b>${esc(st.name)}</b> · niveau ${c.level}<div class="gauge mt4"><i style="width:${c.levelPct}%"></i></div><div class="xs muted mt4">${c.nextAt - c.points} pts avant le niveau ${c.level + 1}</div></div></div>
    <p class="small muted mt8" style="margin:8px 0 0">${esc(st.line)}</p>
    <div class="mt8">${q.map(x => `<div class="row between small" style="padding:4px 0"><span>${x.ok ? "✅" : "⬜"} ${esc(x.n)}</span><span class="xs muted">+${x.p}</span></div>`).join("")}</div>
    <div class="row between mt8"><span class="xs muted">${c.streak ? `🔥 Série : ${c.streak} jour${c.streak > 1 ? "s" : ""}` : "Série à démarrer"} · ${got}/${TROPHIES.length} trophées</span><button class="btn btn-line btn-sm" data-a="go" data-r="trophees">Trophées</button></div></div>`;
}
