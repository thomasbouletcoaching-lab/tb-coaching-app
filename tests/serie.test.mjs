// Série de jours actifs : un repos prévu ne casse pas la série, un retour après absence reçoit un message positif.
import test from "node:test";
import assert from "node:assert/strict";
import { streakOf, awayDays, retourMessage } from "../js/serie.js";

const A = { score: 2, routine: true, nutri: true }, R = { score: 0, rest: true }, V = { score: 0 }, P = { score: 1, routine: true };
const jours = (liste, fin = "2026-11-15") => { const o = {}; liste.forEach((x, i) => { const d = new Date(fin + "T12:00:00"); d.setDate(d.getDate() - (liste.length - 1 - i)); o[d.toISOString().slice(0, 10)] = x; }); return o; };

test("jours actifs consécutifs", () => { assert.equal(streakOf(jours([V, A, A, A]), "2026-11-15"), 3); });
test("un jour de repos prévu ne casse pas la série et ne compte pas", () => { assert.equal(streakOf(jours([A, A, R, A]), "2026-11-15"), 3); });
test("deux jours de repos prévus de suite ne cassent pas la série", () => { assert.equal(streakOf(jours([A, R, R, A]), "2026-11-15"), 2); });
test("un jour vide non prévu casse la série", () => { assert.equal(streakOf(jours([A, A, V, A]), "2026-11-15"), 1); });
test("la journée en cours, pas encore remplie, ne casse pas la série", () => { assert.equal(streakOf(jours([A, A, P]), "2026-11-15"), 2); });
test("aujourd'hui en repos prévu : la série d'hier tient", () => { assert.equal(streakOf(jours([A, A, R]), "2026-11-15"), 2); });
test("aucune donnée : série à zéro", () => { assert.equal(streakOf({}, "2026-11-15"), 0); });
test("absence : nombre de jours sans geste avant aujourd'hui", () => {
  assert.equal(awayDays(jours([A, V, V, V, V]), "2026-11-15"), 3);
  assert.equal(awayDays(jours([A, A, V]), "2026-11-15"), 0);
  assert.equal(awayDays({}, "2026-11-15"), 0);
});
test("message de retour : positif, sans reproche, seulement après 3 jours d'absence", () => {
  assert.equal(retourMessage(2, false), "");
  for (const m of [retourMessage(3, false), retourMessage(10, true)]) { assert.match(m, /On reprend/); assert.doesNotMatch(m, /manqu|rat[ée]|perdu|dommage|absence|retard|enfin/i); }
});
