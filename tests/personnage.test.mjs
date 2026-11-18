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

test("personnage réaliste : chaque combinaison a ses 3 calques sur le disque", async () => {
  const { existsSync } = await import("node:fs");
  const racine = new URL("../assets/perso", import.meta.url).pathname;
  let n = 0;
  for (const base of P.R3D.bases) for (let muscle = 0; muscle < 4; muscle++) for (let graisse = 0; graisse < 4; graisse++)
    for (const peau3d of Object.keys(P.R3D.peaux)) for (const coiffure3d of Object.keys(P.R3D.coiffures)) for (const tenue of Object.keys(P.R3D.tenues)) {
      for (const f of P.calques({ base, muscle, graisse, peau3d, coiffure3d, tenue }, [tenue], racine)) { assert.ok(existsSync(f), f); n++; }
    }
  assert.ok(n > 5000);
});

test("personnage réaliste : sans base choisie, dessin neutre ; valeurs inconnues ramenées au défaut", () => {
  assert.match(P.rendu({}), /^<svg/);
  assert.match(P.rendu({ base: "a" }), /class="perso3d"/);
  const r = P.normaliserRealiste({ base: "a", muscle: 9, graisse: -1, peau3d: "x", coiffure3d: "<b>", tenue: "tenue-or" }, ["tenue-or"]);
  assert.deepEqual([r.muscle, r.graisse, r.peau3d, r.coiffure3d, r.tenue], [1, 1, "p2", "courte", "tenue-base"]);
  assert.equal(P.calques({ base: "a", coiffure3d: "rase" }).length, 2);
  assert.doesNotMatch(P.rendu({ base: "a" }, { titre: '"><script>' }), /<script/);
});
