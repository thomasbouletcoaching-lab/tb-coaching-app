import test from "node:test";
import assert from "node:assert/strict";
import { moyenne, verdict, nbCommentaires, resumeRevue, nettoyer, vide } from "../js/revue.js";
test("moyenne et verdict", () => {
  assert.equal(moyenne({ technique: 4, intensite: 5 }), 4.5);
  assert.equal(moyenne({ technique: 0, plan: "" }), null);
  assert.equal(verdict(4.5), "Excellent"); assert.equal(verdict(2), "À retravailler");
});
test("nettoyage de la saisie", () => {
  const d = nettoyer({ reaction: "🔥", note: "  Super  ", grades: { technique: "4", tempo: 9, plan: 3.4 }, ex: { 0: { c: "", sets: { 1: "Genoux qui rentrent", 2: " " } }, 1: { c: " " } } });
  assert.deepEqual(d.grades, { technique: 4, plan: 3 });
  assert.equal(d.note, "Super");
  assert.deepEqual(d.ex, { 0: { sets: { 1: "Genoux qui rentrent" } } });
  assert.equal(nbCommentaires(d), 2);
  assert.match(resumeRevue(d), /^🔥 · Vue par Thomas · 3,5\/5 · 2 commentaires$/);
  assert.equal(nettoyer({ reaction: "💩" }).reaction, undefined);
  assert.equal(vide({}), true); assert.equal(vide(nettoyer({})), false);
});
