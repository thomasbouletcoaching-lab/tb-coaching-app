import test from "node:test";
import assert from "node:assert/strict";
import { absenceActive, scoreDefi, defiEtat, resultats, codeInvitation, annoncesVisibles } from "../js/reseau.js";
test("absence", () => {
  assert.equal(absenceActive({ on: false, to: "2026-12-01" }, "2026-11-21"), null);
  assert.equal(absenceActive({ on: true, from: "2026-11-20", to: "2026-11-25" }, "2026-11-21").now, true);
  assert.equal(absenceActive({ on: true, from: "2026-11-25", to: "2026-11-30" }, "2026-11-21").now, false);
  assert.equal(absenceActive({ on: true, from: "2026-12-20", to: "2026-12-30" }, "2026-11-21"), null);
  assert.equal(absenceActive({ on: true, from: "2026-11-01", to: "2026-11-10" }, "2026-11-21"), null);
});
test("score de défi", () => {
  const st = { workouts: [{ end: "2026-11-02T18:00:00" }, { end: "2026-11-05T18:00:00" }, { end: "2026-10-30T18:00:00" }], food: { "2026-11-02": [{}], "2026-11-03": [] }, daily: { "2026-11-04": { cardio: [{ min: 30 }, { min: 15 }] } } };
  const d = { from: "2026-11-01", to: "2026-11-07" };
  assert.equal(scoreDefi({ ...d, metric: "seances" }, st), 2);
  assert.equal(scoreDefi({ ...d, metric: "nutri" }, st), 1);
  assert.equal(scoreDefi({ ...d, metric: "cardio" }, st), 45);
  assert.equal(defiEtat(d, "2026-11-08"), "fini");
});
test("sondage, code, annonces", () => {
  assert.deepEqual(resultats(["a", "b", "c"], { 0: 1, 1: 3 }), { tot: 4, pct: [25, 75, 0] });
  assert.match(codeInvitation(), /^TB-[A-HJ-NP-Z2-9]{5}$/);
  const l = annoncesVisibles([{ id: 1, d: "2026-11-20" }, { id: 2, d: "2026-08-01" }, { id: 3, d: "2026-08-01", pin: true }, { id: 4, d: "2026-11-21" }], "2026-11-21");
  assert.deepEqual(l.map(a => a.id), [3, 4, 1]);
});
