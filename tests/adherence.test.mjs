// Tests du moteur de régularité : node --test tests/adherence.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { scoreWindow, adherence, statusOf, alerts, progressSummary, weeklyScores, addDays, mondayOf, WEIGHTS } from "../js/adherence.js";

const T = "2026-11-08"; // dimanche
const fill = (n, fn) => { const o = {}; for (let i = 0; i < n; i++) { const d = addDays(T, -i); o[d] = fn(i, d); } return o; };

test("dates : ajout de jours et lundi de la semaine", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30"); // passage à l'heure d'été sans décalage
  assert.equal(mondayOf(T), "2026-11-02");
  assert.equal(mondayOf("2026-11-02"), "2026-11-02");
});

test("poids des piliers = 100", () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test("membre parfait sur 14 jours : 100", () => {
  const days = fill(14, (i) => ({ st: i % 2 ? "done" : "rest", food: true, routine: true }));
  const r = scoreWindow(days, [addDays(T, -1), addDays(T, -8)], addDays(T, -13), T);
  assert.equal(r.score, 100);
  assert.equal(r.parts.train.of, 7);
  assert.equal(r.parts.checkin.of, 2);
});

test("membre inactif : 0 et statut Décroche", () => {
  const days = fill(14, (i) => ({ st: i % 2 ? "missed" : "rest" }));
  const a = adherence({ days, checkins: [], today: T, since: "2026-09-01" });
  assert.equal(a.score, 0);
  assert.equal(a.status, "risk");
});

test("pilier séances retiré quand rien n'est prévu, poids redistribués", () => {
  const days = fill(14, () => ({ food: true, routine: false }));
  const r = scoreWindow(days, [], addDays(T, -13), T);
  assert.equal(r.parts.train, null);
  // food 25×1 + routine 15×0 + checkin 20×0 sur 60 → 42
  assert.equal(r.score, 42);
});

test("fenêtre courte (nouvel inscrit) : pas de bilan attendu, statut Nouveau", () => {
  const since = addDays(T, -1);
  const days = { [since]: { st: "done", food: true }, [T]: { food: true } };
  const a = adherence({ days, checkins: [], today: T, since });
  assert.equal(a.parts.checkin, null);
  assert.equal(a.status, "new");
  assert.ok(a.score > 0);
});

test("tendance : chute d'une semaine à l'autre", () => {
  const days = fill(14, (i) => i >= 7 ? { st: i % 2 ? "done" : "rest", food: true, routine: true } : { st: i % 2 ? "missed" : "rest" });
  const a = adherence({ days, checkins: [addDays(T, -9)], today: T, since: "2026-09-01" });
  assert.ok(a.prevWeek >= 90, "semaine précédente bonne : " + a.prevWeek);
  assert.ok(a.week <= 10, "semaine en cours mauvaise : " + a.week);
  assert.ok(a.trend <= -80);
});

test("seuils de statut", () => {
  assert.equal(statusOf(70), "ok");
  assert.equal(statusOf(69), "watch");
  assert.equal(statusOf(45), "watch");
  assert.equal(statusOf(44), "risk");
  assert.equal(statusOf(null), "new");
  assert.equal(statusOf(90, 2), "new");
});

test("alertes : inactivité, chute, bilan manquant, séances loupées, ressenti", () => {
  const adh = { score: 30, status: "risk", trend: -25, age: 30 };
  const ag = [{ d: addDays(T, -5), st: "done" }, { d: addDays(T, -3), st: "missed" }, { d: addDays(T, -1), st: "missed" }];
  const l = alerts({ adh, today: T, lastActive: addDays(T, -8), lastCheckin: addDays(T, -12), agenda: ag, lastCi: { energy: 3, sleepH: 5.5, stress: 9, mood: 2 }, health: { flags: ["coeur"] } });
  const codes = l.map(x => x.code);
  for (const c of ["idle", "score", "drop", "checkin", "missed", "energy", "sleep", "stress", "mood", "health"]) assert.ok(codes.includes(c), "alerte " + c);
  assert.equal(l[0].level, "risk");
  assert.equal(l.at(-1).level, "info");
  assert.match(l.find(x => x.code === "idle").text, /8 jours/);
});

test("alertes : membre régulier = aucune alerte", () => {
  const l = alerts({ adh: { score: 88, status: "ok", trend: 3, age: 40 }, today: T, lastActive: T, lastCheckin: addDays(T, -2), agenda: [{ d: addDays(T, -1), st: "done" }], lastCi: { energy: 7, sleepH: 7.5, stress: 4, mood: 4 } });
  assert.deepEqual(l, []);
});

test("alertes : bilan non exigé (gratuit) → pas d'alerte bilan", () => {
  const l = alerts({ adh: { score: 80, status: "ok", age: 40 }, today: T, lastActive: T, checkinExpected: false });
  assert.equal(l.length, 0);
});

test("résumé de progression : poids, tour de taille, séances, meilleure progression", () => {
  const from = addDays(T, -29);
  const weights = Array.from({ length: 30 }, (_, i) => ({ d: addDays(from, i), v: 90 - i * 0.1 }));
  const measures = [{ d: from, waistNav: 98 }, { d: addDays(T, -1), waistNav: 94.5 }];
  const workouts = Array.from({ length: 12 }, (_, i) => ({ end: addDays(from, i * 2 + 1) + "T18:00:00Z", volume: 5000 }));
  const lifts = { "Squat barre": [{ d: addDays(from, 1), e1rm: 100 }, { d: addDays(T, -2), e1rm: 110 }], "Curl": [{ d: addDays(from, 2), e1rm: 30 }] };
  const ci = [{ d: addDays(T, -7), energy: 6, sleepH: 7, win: "J'ai tenu mes 3 séances" }, { d: T, energy: 8, sleepH: 7.5 }];
  const s = progressSummary({ from, to: T, weights, measures, workouts, lifts, checkins: ci });
  assert.ok(s.weight.delta < -2 && s.weight.delta > -3.5, "poids : " + s.weight.delta);
  assert.equal(s.waist.delta, -3.5);
  assert.equal(s.sessions, 12);
  assert.equal(s.tonnage, 60000);
  assert.equal(s.lifts.length, 1);
  assert.equal(s.lifts[0].name, "Squat barre");
  assert.equal(s.checkins, 2);
  assert.equal(s.energy, 7);
  assert.deepEqual(s.wins, ["J'ai tenu mes 3 séances"]);
});

test("scores hebdomadaires : un point par semaine depuis le début", () => {
  const days = fill(28, () => ({ food: true }));
  const pts = weeklyScores({ days, checkins: [], today: T, since: addDays(T, -20), weeks: 8 });
  assert.equal(pts.length, 3);
  assert.ok(pts.every(p => p.score > 0));
});
