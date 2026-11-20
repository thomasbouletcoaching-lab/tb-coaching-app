import test from "node:test";
import assert from "node:assert/strict";
// engine.js importe store.js (localStorage) : on simule un navigateur minimal
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
globalThis.document = { documentElement: { dataset: {} } };
const E = await import("../js/engine.js");

test("double progression : 3×8 → 3×9 → 3×10, puis +2,5 kg et retour à 3×8", () => {
  const x = { sets: [1, 2, 3].map(() => ({ t: "N", lo: 8, hi: 8, kg: 60, rpe: 8, tech: [] })), prog: { load: "double", to: 10, step: 2.5, every: 1 } };
  const w = (n) => E.weekPlan(x, n, { weeks: 12 }).sets;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(n => `${w(n)[0].lo}@${w(n)[0].kg}`), ["8@60", "9@60", "10@60", "8@62.5", "9@62.5", "10@62.5", "8@65"]);
  assert.equal(w(4).length, 3);
});
test("double progression toutes les 2 semaines, en % du 1RM", () => {
  const x = { sets: [{ t: "N", lo: 6, hi: 8, pct: 75, rpe: 8, tech: [] }], prog: { load: "double", to: 8, step: 2.5, every: 2 } };
  const w = (n) => E.weekPlan(x, n, { weeks: 12 }).sets[0];
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(n => `${w(n).lo}@${w(n).pct}`), ["6@75", "6@75", "7@75", "7@75", "8@75", "8@75", "6@77.5"]);
});
test("échauffement non touché, décharge respectée", () => {
  const x = { sets: [{ t: "W", lo: 10, hi: 10, kg: 30, tech: [] }, { t: "N", lo: 8, hi: 8, kg: 60, rpe: 8, tech: [] }], prog: { load: "double", to: 9, step: 5, every: 1 } };
  const p = { weeks: 8, deload: { every: 4 } };
  const s3 = E.weekPlan(x, 3, p).sets;
  assert.equal(s3[0].lo, 10); assert.equal(s3[0].kg, 30);
  assert.equal(s3[1].lo, 8); assert.equal(s3[1].kg, 65);
  const s5 = E.weekPlan(x, 5, p).sets; // semaine 4 = décharge, non comptée
  assert.equal(s5[1].lo, 9); assert.equal(s5[1].kg, 65);
});
test("doubleStep", () => {
  assert.deepEqual(E.doubleStep(8, 10, 0), { reps: 8, bumps: 0 });
  assert.deepEqual(E.doubleStep(8, 10, 5), { reps: 10, bumps: 1 });
  assert.deepEqual(E.doubleStep(8, 8, 3), { reps: 8, bumps: 3 });
});
