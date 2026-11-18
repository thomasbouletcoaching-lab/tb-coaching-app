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

test("personnage réaliste : chaque combinaison a ses calques sur le disque, dans les deux poses", async () => {
  const { existsSync } = await import("node:fs");
  const racine = new URL("../assets/perso", import.meta.url).pathname;
  let n = 0;
  for (const pose of P.R3D.poses) for (const base of P.R3D.bases) for (let muscle = 0; muscle < 4; muscle++) for (let graisse = 0; graisse < 4; graisse++)
    for (let teint = 0; teint < P.R3D.teints.length; teint++) for (const coiffure3d of Object.keys(P.R3D.coiffures)) for (const tenue of Object.keys(P.R3D.tenues)) {
      for (const f of P.calques({ base, muscle, graisse, teint, coiffure3d, tenue }, [tenue], racine, pose)) { assert.ok(existsSync(f), f); n++; }
    }
  assert.ok(n > 10000);
});

test("personnage réaliste : sans base choisie, dessin neutre ; valeurs inconnues ramenées au défaut", () => {
  assert.match(P.rendu({}), /^<svg/);
  assert.match(P.rendu({ base: "a" }), /class="perso3d"/);
  const r = P.normaliserRealiste({ base: "a", muscle: 9, graisse: -1, teint: 12, cheveuxTeinte: "red;x", coiffure3d: "<b>", tenue: "tenue-or" }, ["tenue-or"]);
  assert.deepEqual([r.muscle, r.graisse, r.teint, r.cheveuxTeinte, r.coiffure3d, r.tenue], [1, 1, 1, "#4A3020", "courte", "tenue-base"]);
  assert.equal(P.calques({ base: "a", coiffure3d: "rase" }).length, 2);
  assert.doesNotMatch(P.rendu({ base: "a" }, { titre: '"><script>' }), /<script/);
});

test("personnage réaliste : anciennes peaux converties, teintes appliquées, pose de victoire", () => {
  assert.equal(P.normaliserRealiste({ base: "a", peau3d: "p5" }).teint, 6);
  assert.equal(P.normaliserRealiste({ base: "a", peau3d: "p5", teint: 2 }).teint, 2, "le teint choisi l'emporte");
  const c = P.couches({ base: "b", teint: 9, cheveuxTeinte: "#e2c690", coiffure3d: "longue" }, [], { pose: "biceps" });
  assert.deepEqual(c.map(x => x.src), ["assets/perso/biceps/corps/b-m1-g1-p6.webp", "assets/perso/biceps/tenue/b-m1-g1-base.webp", "assets/perso/biceps/cheveux/b-m1-g1-longue.webp"]);
  assert.deepEqual(c.map(x => x.teinte), ["#9C8474", null, "#E2C690"]);
  assert.equal(P.couches({ base: "a", teint: 0 })[0].teinte, null, "teint 1 : texture telle quelle");
  assert.equal(P.couches({ base: "a" }, [], { pose: "inconnue" })[0].src.includes("/biceps/"), false);
  const h = P.rendu({ base: "a", cheveuxTeinte: "#A27648" }, { pose: "biceps", anime: true, id: "x" });
  assert.match(h, /class="perso3d vit" id="x"/); assert.match(h, /mix-blend-mode:multiply/); assert.match(h, /mask:url\('assets\/perso\/biceps\/cheveux\//);
  assert.deepEqual(Object.keys(P.normaliser({ base: "a", teint: 3 })).filter(k => ["teint", "cheveuxTeinte"].includes(k)), ["teint", "cheveuxTeinte"]);
});
