import test from "node:test";
import assert from "node:assert/strict";
import { verdict, complet, aAfficher } from "../js/douleur.js";

test("bénin : légère, courbature, seulement pendant l'effort", () => {
  assert.equal(verdict({ int: "faible", type: "courbature", quand: "effort", signes: "non", evol: "mieux" }).v, "benin");
});
test("à surveiller : gênante ou qui dure après la séance, sans signe d'alarme", () => {
  assert.equal(verdict({ int: "moyenne", type: "gene", quand: "apres", signes: "non", evol: "pareil" }).v, "surveiller");
});
test("sérieux dès un signe d'alarme", () => {
  for (const r of [{ int: "forte" }, { type: "vive" }, { type: "nerf" }, { quand: "repos" }, { signes: "oui" }, { evol: "pire" }]) {
    const x = verdict({ int: "faible", type: "courbature", quand: "effort", signes: "non", evol: "mieux", ...r });
    assert.equal(x.v, "serieux"); assert.equal(x.drapeaux.length, 1);
  }
});
test("questionnaire complet", () => {
  assert.ok(!complet({ int: "faible" }));
  assert.ok(complet({ int: "faible", type: "gene", quand: "effort", signes: "non", evol: "mieux" }));
});
test("alerte rangée, sauf nouvelle douleur ou verdict sérieux", () => {
  assert.ok(aAfficher("2026-11-10T18:00:00Z", null));
  assert.ok(!aAfficher("2026-11-10T18:00:00Z", { v: "benin", at: "2026-11-11T10:00:00Z" }));
  assert.ok(aAfficher("2026-11-12T18:00:00Z", { v: "surveiller", at: "2026-11-11T10:00:00Z" }));
  assert.ok(aAfficher("2026-11-10T18:00:00Z", { v: "serieux", at: "2026-11-11T10:00:00Z" }));
});
