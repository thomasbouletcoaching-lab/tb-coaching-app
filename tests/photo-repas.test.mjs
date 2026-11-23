// Photo du repas : table des plats et classement (sans le modèle de vision, qui tourne dans le navigateur)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeTable, rank, tapBox, TAP } from "../js/photo-repas.js";

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
test("toucher un aliment : carré centré sur le doigt, qui reste dans la photo", () => {
  const [x0, y0, x1, y1] = tapBox(1000, 800, 0.5, 0.5);
  assert.equal(x1 - x0 + 1, Math.round(800 * TAP)); assert.equal(y1 - y0 + 1, x1 - x0 + 1);
  assert.ok(Math.abs((x0 + x1) / 2 - 500) <= 1 && Math.abs((y0 + y1) / 2 - 400) <= 1, "centré");
  const c = tapBox(1000, 800, 0, 1); assert.equal(c[0], 0); assert.equal(c[3], 799, "dans un coin : recadré dans la photo");
  const e = tapBox(1000, 800, 1, 0); assert.equal(e[2], 999); assert.equal(e[1], 0);
});
test("aliments du repas de fête reconnaissables (beignets, pâtisseries orientales, gâteaux)", () => {
  const ids = new Set(T.plats.map(p => p.id));
  for (const id of ["beignet_africain", "patate_douce", "feuillete_saucisse", "chou_curry", "makrout", "basboussa", "quatre_quarts", "gateau_meringue", "fraisier"]) assert.ok(ids.has(id), id);
});
