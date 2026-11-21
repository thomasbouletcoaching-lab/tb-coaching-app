// Tests : node --test tests/envoi-programme.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { planApresEnvoi } from "../js/envoi-programme.js";

const prog = (mode) => ({ s: [["A", "Lundi", []], ["B", "Mercredi", []], ["C", "Vendredi", []]], ...(mode ? { envoi: { mode } } : {}) });
const enCours = { programId: "coach-plan", startedAt: "2026-10-01", week: 6, idx: 2, cycle: 2 };

test("ajustement : même semaine, même séance suivante, même cycle, même début", () => {
  assert.deepEqual(planApresEnvoi(enCours, prog("ajustement"), "2026-11-21"), enCours);
});
test("ajustement avec une séance retirée : la séance suivante reste dans le programme", () => {
  const p = { s: [["A", "Lundi", []], ["B", "Mercredi", []]], envoi: { mode: "ajustement" } };
  assert.equal(planApresEnvoi(enCours, p, "2026-11-21").idx, 1);
});
test("nouveau programme : repart en semaine 1, cycle 1, aujourd'hui", () => {
  assert.deepEqual(planApresEnvoi(enCours, prog("nouveau"), "2026-11-21"), { programId: "coach-plan", startedAt: "2026-11-21", week: 1, idx: 0, cycle: 1 });
});
test("premier programme du coach : semaine 1, même en ajustement", () => {
  assert.equal(planApresEnvoi({ programId: "tb-rep3", week: 4, idx: 1 }, prog("ajustement"), "2026-11-21").week, 1);
  assert.equal(planApresEnvoi(null, prog(), "2026-11-21").week, 1);
});
test("ancien envoi sans mode : la position est gardée, le cycle aussi", () => {
  assert.equal(planApresEnvoi(enCours, prog(), "2026-11-21").cycle, 2);
});
