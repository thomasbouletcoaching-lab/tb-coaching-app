import test from "node:test";
import assert from "node:assert/strict";
import { fusionner } from "../js/sante.js";
test("fusion des données de Santé", () => {
  const daily = { "2026-11-20": { steps: 3000, sleep: 6 }, "2026-11-21": { weight: 80 } };
  const r = fusionner(daily, [{ d: "2026-11-20", data: { steps: 8200, sleep: 7.5 } }, { d: "2026-11-21", data: { weight: 81, steps: 1200 } }, { d: "2026-11-19", data: { sleep: 8 } }]);
  assert.equal(r.daily["2026-11-20"].steps, 8200);
  assert.equal(r.daily["2026-11-20"].sleep, 6); // noté à la main : on garde
  assert.equal(r.daily["2026-11-21"].weight, 80);
  assert.equal(r.daily["2026-11-21"].steps, 1200);
  assert.equal(r.daily["2026-11-19"].sleep, 8);
  assert.equal(r.n, 3);
  const r2 = fusionner(r.daily, [{ d: "2026-11-19", data: { sleep: 7 } }]);
  assert.equal(r2.daily["2026-11-19"].sleep, 7); // venait déjà de Santé : mis à jour
  assert.equal(fusionner(r2.daily, [{ d: "2026-11-19", data: { sleep: 7 } }]).n, 0);
});
