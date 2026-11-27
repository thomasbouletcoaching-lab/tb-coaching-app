// Mésocycles, courbes de volume / intensité et séries par muscle (js/meso.js + weekPlan). Lancement : node --test tests/meso.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.document = { documentElement: { dataset: {} } };
const E = await import("../js/engine.js");
const M = await import("../js/meso.js");

const row = (name, kind, n = 3, o = {}) => [name, kind, "", null, null, { sets: Array.from({ length: n }, () => ({ t: "N", lo: 8, hi: 8, kg: null, pct: 70, rpe: 8, tech: [] })), prog: { ...E.DEF_PROG }, ...o }];
const prog = (rows, extra = {}) => ({ weeks: 16, custom: true, s: [["A", "Lundi", rows]], ...extra });

test("exemple 16 semaines : 3×8, 3×4, 3×6, singles-triples, allègements", () => {
  const ex = M.exemple16(), r = row("Squat barre", "F"), p = prog([r], { meso: ex.meso, phases: M.phasesFromBlocks(ex.meso, 16) });
  const s = (w) => E.weekPlan(r[5], w, p).sets.filter(z => z.t !== "W");
  assert.deepEqual([1, 2, 3].map(w => `${s(w).length}x${s(w)[0].lo}@${s(w)[0].pct}`), ["3x8@70", "3x8@72.5", "3x8@75"]);
  assert.equal(E.isDeload(p, 4), true); assert.equal(E.phaseOf(p, 13), "Réalisation");
  assert.deepEqual([5, 6, 7].map(w => `${s(w).length}x${s(w)[0].lo}@${s(w)[0].pct}`), ["3x4@80", "3x4@82.5", "3x4@85"]);
  assert.deepEqual([9, 10, 11].map(w => `${s(w)[0].lo}`), ["6", "7", "8"]);
  assert.deepEqual([13, 14, 15].map(w => `${s(w).length}x${s(w)[0].lo}-${s(w)[0].hi}@${s(w)[0].pct}`), ["4x1-3@88", "4x1-3@90", "4x1-3@92"]);
});
test("poids fixe, reps qui montent puis reps fixes, poids qui monte", () => {
  const blocks = [{ a: 1, b: 4, load: "reps", sets: 3, lo: 8, hi: 11, pct: 75 }, { a: 5, b: 8, load: "kg", sets: 3, lo: 8, hi: 8, pct: 75, step: 2.5 }];
  const r = row("Développé couché", "F"), p = prog([r], { meso: blocks, weeks: 8 });
  const s = (w) => E.weekPlan(r[5], w, p).sets[0];
  assert.deepEqual([1, 2, 3, 4].map(w => `${s(w).lo}@${s(w).pct}`), ["8@75", "9@75", "10@75", "11@75"]);
  assert.deepEqual([5, 6, 7, 8].map(w => `${s(w).lo}@${s(w).pct}`), ["8@75", "8@77.5", "8@80", "8@82.5"]);
});
test("portée : les isolations ne suivent pas le programme, sauf choix contraire", () => {
  const r1 = row("Squat barre", "F"), r2 = row("Curl biceps", "I"), r3 = row("Curl marteau", "I", 3, { meso: true }), r4 = row("Gainage", "C", 3, { meso: [{ a: 1, b: 8, load: "fixe", lo: 20, hi: 20 }] });
  const p = prog([r1, r2, r3, r4], { weeks: 8, meso: [{ a: 1, b: 8, load: "fixe", sets: 5, lo: 5, hi: 5, pct: 80 }] });
  assert.equal(E.weekPlan(r1[5], 2, p).sets.length, 5);
  assert.equal(E.weekPlan(r2[5], 2, p).sets.length, 3);
  assert.equal(E.weekPlan(r3[5], 2, p).sets.length, 5);
  assert.equal(E.weekPlan(r4[5], 2, p).sets[0].lo, 20);
  assert.equal(E.weekPlan(r1[5], 2, { ...p, mesoScope: "all" }).sets.length, 5);
});
test("courbes : volume et intensité par semaine ; allègement planifié sans double réduction", () => {
  const r = row("Squat barre", "F", 4), p = prog([r], { weeks: 4, vol: { 1: 100, 2: 125, 3: 50, 4: 100 }, int: { 1: 100, 2: 100, 3: 90, 4: 100 }, phases: ["Accumulation", "Accumulation", "Deload", "Accumulation"] });
  const s = (w) => E.weekPlan(r[5], w, p).sets;
  assert.equal(s(1).length, 4); assert.equal(s(2).length, 5); assert.equal(s(3).length, 2);
  assert.equal(s(3)[0].pct, 63); // 70 × 0,9 : pas de −12 % automatique en plus
});
test("séries par muscle : le voulu de la semaine est réparti sur les exercices du muscle", () => {
  const r1 = row("Traction lestée", "F", 3), r2 = row("Rowing barre", "P", 3), r3 = row("Squat barre", "F", 3);
  r1[6] = { fx: [{ f: "Dos-largeur", c: 1 }] }; r2[6] = { fx: [{ f: "Dos-épaisseur", c: 1 }] }; r3[6] = { fx: [{ f: "Quadriceps", c: 1 }] }; // hors navigateur, la bibliothèque n'est pas chargée
  const p = prog([r1, r2, r3], { weeks: 4, muscleSets: { dos: { 2: 10, 3: 4 } } });
  const n = (r, w) => E.weekPlan(r[5], w, p).sets.length;
  const dos = (w) => n(r1, w) + n(r2, w);
  assert.equal(dos(1), 6); assert.equal(dos(2), 10); assert.equal(dos(3), 4);
  assert.equal(n(r3, 2), 3); // les autres muscles ne bougent pas
});
test("blocs : phases et allègement reconnus", () => {
  const ex = M.exemple16(); assert.deepEqual(M.phasesFromBlocks(ex.meso, 16).filter(x => x === "Deload").length, 4);
  assert.equal(M.blockAt(ex.meso, 6).phase, "Intensification"); assert.equal(M.lastWorkBlock(ex.meso, 8).a, 5);
});
