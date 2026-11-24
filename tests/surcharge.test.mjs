import test from "node:test";
import assert from "node:assert/strict";
import * as SU from "../js/surcharge.js";
test("décision selon le RPE réel", () => {
  const cible = { lo: 8, hi: 10, rpe: 8 };
  assert.equal(SU.decider("charge", [{ kg: 60, reps: 10, rpe: 7 }, { kg: 60, reps: 10, rpe: 7 }], cible).kg, 5);
  assert.equal(SU.decider("charge", [{ kg: 60, reps: 7, rpe: 9.5 }], cible).etat, "dur");
  assert.equal(SU.decider("reps", [{ kg: 60, reps: 9, rpe: 8 }], cible).reps, 1);
});
test("ajustement en direct", () => {
  assert.equal(SU.ajusterEnDirect({ kg: 100, rpe: 9.5, trpe: 8 }).pct, -7.5);
  assert.equal(SU.ajusterEnDirect({ kg: 100, rpe: 8, trpe: 8 }), null);
});
test("les modèles produisent un format valide", () => {
  for (const m of SU.MODELES) { const x = { sets: [{ t: "N", lo: 8, hi: 10, rpe: 8 }, { t: "N", lo: 8, hi: 10, rpe: 8 }] }; m.f(x); assert.ok(x.prog && x.sets.length); }
});
