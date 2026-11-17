// Tests du personnage : node --test tests/personnage.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../js/personnage.js";

test("SVG valide, titre accessible, aucun texte genré ni sur le corps", () => {
  const s = P.svg({}, {});
  assert.match(s, /^<svg [^>]*role="img"[^>]*aria-label="Ton personnage"/);
  assert.match(s, /<title>Ton personnage<\/title>/);
  assert.doesNotMatch(s, /<text/);
  assert.ok(s.length < 8000, "léger");
});

test("normaliser : valeurs inconnues ramenées au défaut, rien d'injecté", () => {
  const a = P.normaliser({ peau: 99, coiffure: "<script>", visage: "x", silhouette: 7, tenue: "tenue-or", accessoires: ["cape", "bombe"] });
  assert.deepEqual(a, { ...P.DEFAUT, accessoires: [] });
  const s = P.svg({ coiffure: '"><script>' }, { titre: '<b>"x"</b>' });
  assert.doesNotMatch(s, /<script|<b>/);
});

test("tenues, décors et accessoires seulement s'ils sont débloqués", () => {
  assert.equal(P.normaliser({ tenue: "tenue-or", decor: "decor-stade", accessoires: ["cape"] }, ["tenue-or", "cape"]).tenue, "tenue-or");
  assert.equal(P.normaliser({ decor: "decor-stade" }, ["tenue-or"]).decor, "decor-salle");
  assert.deepEqual(P.normaliser({ accessoires: ["cape"] }, ["cape"]).accessoires, ["cape"]);
});

test("toutes les combinaisons se dessinent dans les deux styles", () => {
  for (const style of ["geo", "trait"]) for (const coiffure of P.COIFFURES) for (const visage of P.VISAGES) for (const silhouette of P.SILHOUETTES) {
    const s = P.svg({ coiffure, visage, silhouette }, { style });
    assert.ok(s.startsWith("<svg") && s.endsWith("</svg>") && !/NaN|undefined/.test(s), `${style} ${coiffure} ${visage} ${silhouette}`);
  }
});
