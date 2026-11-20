import test from "node:test";
import assert from "node:assert/strict";
import { treadmillMet, netKcal } from "../js/activite-calc.js";

test("tapis : la pente fait monter les MET (marche inclinée)", () => {
  assert.equal(treadmillMet(5, 0), 3.4);
  assert.equal(treadmillMet(5, 12), 8.5);
  assert.ok(treadmillMet(5, 15) > treadmillMet(5, 12));
  assert.ok(treadmillMet(10, 0) > 9 && treadmillMet(10, 0) < 11); // course 10 km/h ≈ 10 MET
  assert.equal(treadmillMet(0, 10), null);
});
test("calories : chiffre de la machine (total) moins le repos, ou actives telles quelles", () => {
  assert.equal(netKcal({ min: 30, kcal: 300, kt: "total" }, 80), 260);
  assert.equal(netKcal({ min: 30, kcal: 250, kt: "actives" }, 80), 250);
  assert.equal(netKcal({ min: 60, met: 6 }, 70), 350);
  assert.equal(netKcal({ min: 30, kcal: 10, kt: "total" }, 80), 0);
});
