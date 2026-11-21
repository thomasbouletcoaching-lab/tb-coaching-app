// Tests des statistiques sur le réalisé : node --test tests/stats-realise.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "../js/stats-realise.js";
import * as V from "../js/volume.js";

const A = "2026-11-21", add = T.addJ;
const MUS = { "Squat barre": ["Quadriceps", "Fessiers"], "Développé couché barre": ["Pecs", "Triceps", "Épaules-avant"], "Rowing barre": ["Dos-épaisseur", "Biceps"], "Leg curl": ["Ischios"], "Tractions lestées": ["Dos-largeur", "Biceps"], "Oiseau": ["Épaules-arrière"] };
const musclesOf = (n) => MUS[n] || [];
const musclesDe = (n) => T.musclesParVolume(n, musclesOf);
const set = (o = {}) => ({ type: "N", kg: 100, pkg: 100, reps: 8, lo: 8, hi: 10, trpe: 8, rpe: 8, done: true, ...o });
const ex = (name, sets, o = {}) => ({ name, unit: "reps", sets, ...o });
const w = (d, exercises) => ({ id: d + Math.random(), start: d + "T10:00:00.000Z", end: d + "T11:00:00.000Z", exercises });

test("musclesParVolume : groupe principal à 1, secondaires à ½", () => {
  assert.deepEqual(musclesDe("Squat barre"), [{ g: "quad", c: 1 }, { g: "fess", c: 0.5 }]);
  assert.deepEqual(musclesDe("Inconnu"), []);
});

test("volume par muscle : séries faites par semaine, échauffements et séries non faites exclus, zone MV → MRV", () => {
  const ws = [0, 7].map(k => w(add(A, -k), [ex("Squat barre", [set({ type: "W" }), ...Array.from({ length: 6 }, () => set()), set({ done: false })])]));
  const v = T.volumeParMuscle(ws, add(A, -13), A, { musclesDe });
  const q = v.find(m => m.id === "quad"), f = v.find(m => m.id === "fess");
  assert.equal(q.parSem, 6); assert.equal(f.parSem, 3); assert.equal(q.zone.id, "maintien", "6 séries : au MV des quadriceps (6), sous le MEV (8)");
  assert.equal(v.find(m => m.id === "pecs").zone.id, "sous");
  const L = V.landmarks().quad;
  assert.equal(T.zone(10, L).id, "progression"); assert.equal(T.zone(14, L).id, "optimal"); assert.equal(T.zone(17, L).id, "haut"); assert.equal(T.zone(25, L).id, "trop");
});

test("patterns : le catalogue d'abord, sinon le nom", () => {
  assert.equal(T.patternParNom("Tractions lestées (pronation)"), "TV"); assert.equal(T.patternParNom("Développé militaire barre"), "PV");
  assert.equal(T.patternParNom("Développé couché barre"), "PH"); assert.equal(T.patternParNom("Hip thrust barre"), "CH"); assert.equal(T.patternParNom("Curl biceps"), null);
  const p = T.seriesParPattern([w(A, [ex("Squat barre", [set(), set(), set()]), ex("Machin", [set(), set()])])], add(A, -6), A, { patternDe: (n) => n === "Machin" ? "TH" : null });
  assert.equal(p.SG, 3); assert.equal(p.TH, 2);
});

test("équilibre : tirage / poussée, arrière / avant de la cuisse, repères", () => {
  const ws = [w(A, [ex("Développé couché barre", Array.from({ length: 8 }, () => set())), ex("Rowing barre", Array.from({ length: 4 }, () => set())), ex("Squat barre", Array.from({ length: 6 }, () => set())), ex("Leg curl", [set(), set()])])];
  const e = T.equilibre(ws, add(A, -6), A, { musclesDe });
  const tp = e.ratios.find(r => r.nom === "Tirage / poussée"); assert.equal(tp.ratio, 0.5); assert.equal(tp.etat, "bas");
  const cu = e.ratios.find(r => r.nom.startsWith("Arrière")); assert.equal(cu.a, 5); assert.equal(cu.b, 6); assert.equal(cu.etat, "ok", "ischios 2 + fessiers 3 face à 6 quadriceps : 0,8");
});

test("prévu et fait : séries, muscles en retard, charge, reps et RPE", () => {
  const ws = [w(A, [ex("Squat barre", [set({ kg: 95, rpe: 9 }), set({ kg: 95, reps: 7, rpe: 9 }), set({ kg: 95, rpe: 9 }), set({ done: false })]), ex("Leg curl", [set(), set({ done: false }), set({ done: false })])])];
  const p = T.prevuFait(ws, add(A, -6), A, { musclesDe, seancesPrevues: 2 });
  assert.deepEqual(p.series, { faites: 4, prevues: 7, pct: 57 });
  assert.equal(p.seances.pct, 50);
  assert.equal(p.ecarts[0].nom, "Ischio-jambiers"); assert.equal(p.ecarts[0].pct, 33);
  assert.equal(p.charge.pct, 96); assert.equal(p.reps.sous, 25); assert.equal(p.rpe.ecart, 0.8);
});

test("surcharge : progresse, stable, stagne, régresse", () => {
  const seq = (vals) => vals.map(([k, kg, reps]) => w(add(A, -k), [ex("Squat barre", [set({ kg, reps, rpe: 8 }), set({ kg, reps, rpe: 8 }), set({ kg, reps, rpe: 8 })])]));
  const v = (ws) => T.verdictExercice(T.historiqueExercice(ws, "Squat barre"), A);
  assert.equal(v(seq([[35, 100, 8], [28, 100, 8], [14, 105, 8], [7, 107.5, 8]])).id, "progresse");
  assert.ok(v(seq([[35, 100, 8], [28, 100, 8], [14, 100, 9], [7, 100, 9]])).signes.some(s => /plus de reps à 100 kg/.test(s)));
  assert.equal(v(seq([[56, 100, 8], [35, 102.5, 8], [28, 102.5, 8], [14, 102.5, 8], [7, 102.5, 8]])).id, "stagne");
  assert.equal(v(seq([[35, 100, 8], [28, 100, 8], [14, 92.5, 8], [7, 92.5, 8]])).id, "regresse");
  assert.equal(v(seq([[7, 100, 8]])).id, "inconnu");
});

test("stimulus : 3 critères, ce qui manque est dit concrètement", () => {
  const prog = [35, 28, 14, 7, 3].map((k, i) => w(add(A, -k), [ex("Squat barre", Array.from({ length: 5 }, () => set({ kg: 100 + i * 2.5, rpe: 8 }))), ex("Leg curl", [set({ rpe: 5, trpe: 6 }), set({ rpe: 5, trpe: 6 })])]));
  const s = T.stimulus(prog, A, { musclesDe });
  const q = s.find(m => m.id === "quad"), i = s.find(m => m.id === "isch");
  assert.equal(q.intensite, true); assert.equal(q.progression, true);
  assert.equal(i.etat, "non"); assert.ok(i.manque.some(t => /MEV/.test(t)) && i.manque.some(t => /RPE 7 à 9/.test(t)));
});
