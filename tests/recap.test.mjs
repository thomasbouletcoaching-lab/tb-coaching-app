import test from "node:test";
import assert from "node:assert/strict";
import { precedent, ecart, recapExercice, serieTxt } from "../js/recap.js";
const S = (kg, reps, type = "N") => ({ kg, reps, done: true, type });
const w1 = { id: 1, start: "2026-11-10T18:00:00Z", end: "2026-11-10T19:00:00Z", exercises: [{ name: "Squat", sets: [S(60, 10, "W"), S(100, 8), S(100, 7)] }] };
const w2 = { id: 2, start: "2026-11-14T18:00:00Z", end: "2026-11-14T19:00:00Z", exercises: [{ name: "Squat", scheme: "3x8-10", sets: [S(60, 10, "W"), S(102.5, 8), S(100, 8), S(100, 6)] }] };
test("trouve la dernière séance avec le même exercice", () => {
  assert.equal(precedent(w2, [w1, w2], "Squat").w.id, 1);
  assert.equal(precedent(w1, [w1, w2], "Squat"), null);
});
test("écarts série par série", () => {
  assert.deepEqual(ecart(S(102.5, 8), S(100, 8)), { txt: "+2,5 kg", sens: 1 });
  assert.deepEqual(ecart(S(100, 8), S(100, 7)), { txt: "+1 rep", sens: 1 });
  assert.deepEqual(ecart(S(100, 8), S(100, 8)), { txt: "=", sens: 0 });
  assert.equal(ecart(S(95, 10), S(100, 8)).sens, -1);
  assert.equal(ecart(S(100, 6), null).txt, "nouveau");
});
test("récap d'un exercice : prévu, avant, écarts, volume", () => {
  const r = recapExercice(w2, w2.exercises[0], [w1, w2]);
  assert.equal(r.prevu, "3x8-10");
  assert.equal(r.series.length, 3);
  assert.equal(r.series[1].ecart.txt, "+1 rep");
  assert.equal(r.series[2].ecart.txt, "nouveau");
  assert.equal(r.dVol, 102.5 * 8 + 800 + 600 - 1500);
  assert.equal(serieTxt(S(102.5, 8)), "102,5 × 8");
});
