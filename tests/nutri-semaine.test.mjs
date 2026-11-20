import test from "node:test";
import assert from "node:assert/strict";
import { statutJour, series, estNote } from "../js/nutri-semaine.js";

test("couleur du jour selon l'écart à l'objectif", () => {
  assert.equal(statutJour(2000, 2000).st, "ok");
  assert.equal(statutJour(2190, 2000).st, "ok");
  assert.equal(statutJour(2300, 2000).st, "proche");
  assert.equal(statutJour(1650, 2000).st, "proche");
  assert.equal(statutJour(2500, 2000).st, "loin");
  assert.equal(statutJour(900, 2000).st, "loin");
  assert.equal(statutJour(300, 2000).st, "vide");
  assert.equal(statutJour(0, 2000, { futur: true }).st, "vide");
});
test("aujourd'hui : en cours tant que l'objectif n'est pas presque atteint", () => {
  assert.equal(statutJour(1200, 2000, { aujourdhui: true }).st, "encours");
  assert.equal(statutJour(200, 2000, { aujourdhui: true }).st, "encours");
  assert.equal(statutJour(0, 2000, { aujourdhui: true }).st, "vide");
  assert.equal(statutJour(1950, 2000, { aujourdhui: true }).st, "ok");
  assert.equal(statutJour(2600, 2000, { aujourdhui: true }).st, "loin");
});
test("jour noté : au moins 30 % de l'objectif", () => {
  assert.ok(estNote(600, 2000)); assert.ok(!estNote(500, 2000)); assert.ok(!estNote(500, 0));
});
test("flamme : jours notés d'affilée, aujourd'hui non noté ne casse pas la série", () => {
  const j = (note, st = "ok") => ({ note, st });
  assert.deepEqual(series([j(true), j(true), j(true), j(false, "vide")]), { notes: 3, ok: 3, record: 3 });
  assert.deepEqual(series([j(true), j(false, "vide"), j(true, "proche"), j(true)]), { notes: 2, ok: 1, record: 2 });
  assert.equal(series([j(true), j(true), j(true), j(true), j(false, "vide"), j(true), j(false, "vide")]).record, 4);
  assert.equal(series([]).notes, 0);
});
