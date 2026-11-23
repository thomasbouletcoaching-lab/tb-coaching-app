// Photo du repas : table des plats et classement (sans le modèle de vision, qui tourne dans le navigateur)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeTable, rank, merge, ZONES } from "../js/photo-repas.js";

const J = JSON.parse(readFileSync(new URL("../data/plats-photo.json", import.meta.url), "utf8"));
const T = decodeTable(J);

test("la table des plats se décode : un vecteur unitaire par plat", () => {
  assert.equal(T.plats.length, J.plats.length); assert.ok(T.plats.length >= 150);
  assert.equal(T.vecs[0].length, J.dim);
  for (const v of T.vecs) { let s = 0; for (const x of v) s += x * x; assert.ok(Math.abs(Math.sqrt(s) - 1) < 0.02); }
  assert.equal(new Set(T.plats.map(p => p.id)).size, T.plats.length, "identifiants uniques");
  assert.ok(T.plats.every(p => p.fr && p.q), "chaque plat a un libellé et une recherche");
});
test("modèle sous licence libre, pas de version réservée à la recherche", () => {
  assert.match(T.model, /siglip/i); assert.match(J.src, /Apache 2\.0/);
});
test("classement : le vecteur d'un plat le place en premier, scores décroissants", () => {
  const i = T.plats.findIndex(p => p.id === "maki"), r = rank(T.vecs[i], T, 5);
  assert.equal(r[0].id, "maki"); assert.equal(r.length, 5);
  for (let k = 1; k < r.length; k++) assert.ok(r[k - 1].score >= r[k].score);
});
test("zones d'une assiette : chaque plat gardé une fois, avec son meilleur score", () => {
  const m = merge([[{ id: "a", score: 0.1 }, { id: "b", score: 0.3 }], [{ id: "a", score: 0.5 }]]);
  assert.deepEqual(m.map(x => [x.id, x.score]), [["a", 0.5], ["b", 0.3]]);
  assert.ok(ZONES.every(([x0, y0, x1, y1]) => x0 >= 0 && y0 >= 0 && x1 <= 1 && y1 <= 1 && x1 > x0 && y1 > y0));
});
