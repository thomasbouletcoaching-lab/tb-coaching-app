import test from "node:test";
import assert from "node:assert/strict";
import { unitsFor, fmtQty, gramsOf, addHabit, usualOf } from "../js/portions.js";

test("unités naturelles : œuf, beurre, sucre, huile, pain", () => {
  assert.equal(unitsFor({ n: "Oeuf, cru" })[0].s, "œuf");
  assert.equal(unitsFor({ n: "Oeuf, cru" })[0].g, 55);
  assert.equal(unitsFor({ n: "Beurre à 82% MG, doux" })[0].s, "noisette de beurre");
  assert.ok(unitsFor({ n: "Sucre blanc" }).some(u => u.s === "c. à café" && u.g === 5));
  assert.ok(unitsFor({ n: "Huile d'olive vierge extra" }).some(u => u.s === "c. à soupe"));
  assert.equal(unitsFor({ n: "Pain de mie, complet" })[0].s, "tranche");
  assert.equal(unitsFor({ n: "Beurre de cacahuète ou Pâte d'arachide" })[0].s, "c. à café");
});
test("pas de faux amis : thon à l'huile, yaourt sucré, chocolat au lait, pomme de terre", () => {
  assert.ok(!unitsFor({ n: "Thon, à l'huile, appertisé" }).some(u => u.s === "c. à soupe"));
  assert.equal(unitsFor({ n: "Yaourt sucré" })[0].s, "pot");
  assert.equal(unitsFor({ n: "Chocolat au lait, tablette" })[0].s, "carré");
  assert.equal(unitsFor({ n: "Pomme de terre, bouillie/cuite à l'eau" })[0].s, "pomme de terre moyenne");
  assert.deepEqual(unitsFor({ n: "Saumon, cuit" }), []);
});
test("portion vendue à l'unité en premier", () => {
  const u = unitsFor({ n: "Barre protéinée", ug: 45 });
  assert.equal(u[0].s, "portion"); assert.equal(u[0].g, 45);
});
test("affichage et grammes", () => {
  const oeuf = unitsFor({ n: "Oeuf, cru" })[0];
  assert.equal(fmtQty(2, oeuf), "2 œufs");
  assert.equal(fmtQty(1, oeuf), "1 œuf");
  assert.equal(fmtQty(0.5, unitsFor({ n: "Avocat, pulpe, cru" })[1]), "½ avocat");
  assert.equal(gramsOf(3, oeuf), 165);
});
test("quantité habituelle : la plus fréquente, sinon la plus récente", () => {
  let h = null;
  h = addHabit(h, 150); h = addHabit(h, 200); h = addHabit(h, 150);
  assert.equal(usualOf(h).g, 150); assert.equal(usualOf(h).times, 2);
  h = addHabit(null, 110, { n: 2, s: "œuf", p: "œufs", g: 55 });
  assert.equal(usualOf(h).u.n, 2);
  assert.equal(usualOf(null), null);
  let k = null; for (let i = 0; i < 12; i++) k = addHabit(k, i);
  assert.equal(k.l.length, 8);
});
test("buffet et cheat meal : on compte les pièces sans peser", () => {
  const u = (n) => unitsFor({ n }).map(x => x.s);
  assert.deepEqual(u("Sushi ou Maki aux produits de la mer"), ["maki", "sushi (nigiri)", "california"]);
  assert.equal(gramsOf(6, unitsFor({ n: "Maki (saumon, thon, concombre…) – valeurs Ciqual « Sushi ou Maki aux produits de la mer »" })[0]), 120);
  assert.equal(u("Nem ou Pâté impérial, au porc, préemballé, cuit")[0], "nem");
  assert.equal(u("Har gow (ravioli vapeur à la crevette) – valeurs Ciqual « Ravioli chinois à la vapeur à la crevette, cuit »")[0], "ravioli vapeur");
  assert.equal(u("Pizza jambon fromage, préemballée")[0], "part");
  assert.equal(u("Pain au chocolat feuilleté, artisanal")[0], "pain au chocolat");   // pas « tranche » comme le pain
  assert.deepEqual(u("Croissant au jambon"), []);                                      // viennoiserie garnie : pas le poids d'un croissant nature
  assert.equal(fmtQty(2, unitsFor({ n: "Bière blanche" })[2]), "2 pintes (50 cl)");
  assert.equal(u("Poulet, croquette panée ou nuggets")[0], "nugget");
  // un aliment vendu à l'unité (fast-food) garde sa portion en premier
  assert.equal(unitsFor({ n: "Frites de pommes de terre, surgelées, cuites en friteuse", ug: 114 })[0].s, "portion");
});
