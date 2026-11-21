import test from "node:test";
import assert from "node:assert/strict";
import { dernierJourBilan, prochainJourBilan, bilanAFaire, libelleRythme } from "../js/bilan-reglages.js";
// 2026-11-15 = dimanche ; 2026-11-21 = samedi
test("rythme hebdomadaire le dimanche", () => {
  const r = { dow: 6, every: 1, from: "2026-11-01" };
  assert.equal(dernierJourBilan(r, "2026-11-21"), "2026-11-15");
  assert.equal(prochainJourBilan(r, "2026-11-21"), "2026-11-22");
  assert.equal(dernierJourBilan(r, "2026-11-22"), "2026-11-22");
});
test("toutes les 2 semaines à partir du début", () => {
  const r = { dow: 6, every: 2, from: "2026-11-01" }; // premier : 1er novembre (dimanche)
  assert.equal(dernierJourBilan(r, "2026-11-21"), "2026-11-15");
  assert.equal(prochainJourBilan(r, "2026-11-21"), "2026-11-29");
  assert.equal(dernierJourBilan(r, "2026-11-28"), "2026-11-15");
});
test("à faire pendant 3 jours, sauf s'il est déjà fait", () => {
  const r = { on: true, dow: 6, every: 1, from: "2026-11-01" };
  assert.equal(bilanAFaire(r, "2026-11-16", null).due, true);
  assert.equal(bilanAFaire(r, "2026-11-18", "2026-11-13").due, true);
  assert.equal(bilanAFaire(r, "2026-11-18", "2026-11-15").due, false);
  assert.equal(bilanAFaire(r, "2026-11-19", null).due, false);
  assert.equal(bilanAFaire({ ...r, on: false }, "2026-11-16", null).due, false);
});
test("pas encore commencé", () => {
  assert.equal(dernierJourBilan({ dow: 0, from: "2026-12-01" }, "2026-11-21"), null);
  assert.equal(prochainJourBilan({ dow: 0, from: "2026-12-01" }, "2026-11-21"), "2026-12-07");
  assert.equal(libelleRythme({ dow: 6, every: 2 }), "Toutes les 2 semaines · le dimanche");
});
