import test from "node:test";
import assert from "node:assert/strict";
import { statutSeance, remplissage } from "../js/anneaux-seances.js";
const set = (done, type = "N") => ({ done, type });
const w = (...sets) => ({ exercises: [{ sets }] });

test("séance complète, partielle, loupée, prévue, repos", () => {
  assert.equal(statutSeance({ st: "done", w: [w(set(true), set(true), set(true), set(false, "W"))] }).st, "complete");
  assert.equal(statutSeance({ st: "done", w: [w(set(true), set(false), set(false))] }).st, "partielle");
  assert.equal(statutSeance({ st: "missed" }).st, "loupee");
  assert.equal(statutSeance({ st: "planned" }).st, "prevue");
  assert.equal(statutSeance(null).st, "repos");
  assert.equal(statutSeance({ st: "rest" }).st, "repos");
});
test("remplissage : échauffements ignorés, 90 % = complète", () => {
  const ten = Array.from({ length: 10 }, (_, i) => set(i < 9));
  assert.equal(remplissage([w(...ten)]), 0.9);
  assert.equal(statutSeance({ st: "done", w: [w(...ten)] }).st, "complete");
  assert.equal(remplissage([]), 0);
  assert.equal(remplissage([{ exercises: [] }]), 1);
});
