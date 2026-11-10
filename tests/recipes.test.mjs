// Tests des fractions de recette (js/recipes.js). Lancement : node --test tests/recipes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/recipes.js";

test("fracVal : n/d, 0 si invalide", () => {
  assert.equal(R.fracVal(1, 4), 0.25);
  assert.equal(R.fracVal(2, 5), 0.4);
  assert.equal(R.fracVal(0, 4), 0);
  assert.equal(R.fracVal(1, 0), 0);
});

test("une fraction de la recette entière = fraction des macros totales (cru ou cuit, même résultat)", () => {
  const r = R.RECIPES.find(x => x.id === "chili"), tot = R.macros(r.ing, 1);
  for (const [n, d] of [[1, 4], [1, 6], [2, 5]]) {
    const por = R.fracVal(n, d) * r.portions, part = R.macros(r.ing, r.portions);
    assert.ok(Math.abs(part.kcal * por - tot.kcal * n / d) <= r.portions, `${n}/${d} : calories cohérentes`);
  }
  assert.equal(R.fracVal(5, 5) * r.portions, r.portions, "5/5 = la recette entière");
});

test("toFrac retrouve les fractions simples", () => {
  assert.deepEqual(R.toFrac(0.25), [1, 4]);
  assert.deepEqual(R.toFrac(0.4), [2, 5]);
  assert.deepEqual(R.toFrac(1 / 6), [1, 6]);
  assert.deepEqual(R.toFrac(1), [1, 1]);
  assert.equal(R.toFrac(0), null);
});

test("libellé du journal", () => assert.equal(R.fracLabel("Quiche", 2, 5), "Quiche (2/5 de la recette)"));
