// Genre (accord des textes) et sexe (estimations) : jamais déduits l'un de l'autre. Paliers adaptés au profil réel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { genreDe, genreChoisi, accord, mifflinSexe, sexeValide, GENRES, SEXES } from "../js/genre.js";
import { palier, paliersPour, PALIERS, reprend } from "../js/paliers.js";

test("sans choix, on s'adresse à la personne de façon neutre", () => {
  for (const p of [undefined, null, {}, { genre: "" }, { genre: "x" }, { sex: "f" }, { sex: "m" }]) assert.equal(genreDe(p), "n", JSON.stringify(p));
  assert.equal(genreChoisi({ sex: "f" }), false); assert.equal(genreChoisi({ genre: "n" }), true);
});

test("le sexe ne sert jamais à deviner le genre, et inversement", () => {
  assert.equal(genreDe({ sex: "f", genre: "m" }), "m"); assert.equal(genreDe({ sex: "m", genre: "f" }), "f"); assert.equal(genreDe({ sex: "m", genre: "n" }), "n");
  assert.equal(mifflinSexe(undefined), -78); assert.equal(mifflinSexe("f"), -161); assert.equal(mifflinSexe("m"), 5);
  for (const v of ["", null, "n", "x", "F"]) assert.equal(mifflinSexe(v), -78, String(v));
  assert.equal(sexeValide("f"), "f"); assert.equal(sexeValide("m"), "m"); assert.equal(sexeValide(""), null); assert.equal(sexeValide("autre"), null);
});

test("accord : la forme choisie, sinon la neutre ; la forme neutre est obligatoire", () => {
  const f = { m: "fier", f: "fière", n: "satisfait·e" };
  assert.equal(accord({ genre: "m" }, f), "fier"); assert.equal(accord({ genre: "f" }, f), "fière"); assert.equal(accord({}, f), "satisfait·e"); assert.equal(accord({ sex: "f" }, f), "satisfait·e");
  assert.equal(accord({ genre: "f" }, { m: "a", n: "c" }), "c");
  assert.throws(() => accord({}, { m: "a", f: "b" })); assert.throws(() => accord({}, null));
});

test("les listes proposées : trois genres, et la possibilité de ne pas dire son sexe", () => {
  assert.deepEqual(GENRES.map(g => g[0]), ["m", "f", "n"]); assert.deepEqual(SEXES.map(s => s[0]), ["m", "f", ""]);
});

const NIVEAUX = [1, 2, 3, 4, 5, 7, 8, 12];
const PROFILS = [];
for (const genre of [undefined, "m", "f", "n"]) for (const sex of [undefined, "m", "f"]) for (const level of [undefined, "beginner", "comeback", "regular", "advanced"]) for (const goal of ["fat", "muscle", "restart"]) PROFILS.push({ genre, sex, level, goal });

test("aucun palier ne dit « Homme » ou « Femme » sans que la personne ait choisi ce genre", () => {
  for (const p of PROFILS) for (const n of NIVEAUX) {
    const nom = palier(n, p).name;
    if (p.genre !== "m") assert.ok(!/\bHomme\b|\bLe (Commençant|Nouveau venu)\b/.test(nom), `${JSON.stringify(p)} niveau ${n} → ${nom}`);
    if (p.genre !== "f") assert.ok(!/\bFemme\b|\bLa (Commençante|Nouvelle venue)\b/.test(nom), `${JSON.stringify(p)} niveau ${n} → ${nom}`);
  }
});

test("bug signalé : une personne sans genre choisi, ou au féminin, ne voit jamais « L'Homme de la reprise »", () => {
  for (const sex of [undefined, "m", "f"]) for (const level of ["comeback", "regular", undefined]) {
    assert.notEqual(palier(3, { sex, level }).name, "L'Homme de la reprise");
    assert.notEqual(palier(3, { sex, level, genre: "f" }).name, "L'Homme de la reprise");
    assert.notEqual(palier(3, { sex, level, genre: "n" }).name, "L'Homme de la reprise");
  }
  assert.equal(palier(3, { genre: "f", level: "comeback" }).name, "La Femme de la reprise");
  assert.equal(palier(3, { genre: "m", level: "comeback" }).name, "L'Homme de la reprise");
  assert.equal(palier(3, { level: "comeback" }).name, "La reprise en marche");
});

test("on ne parle de reprise ou de retour qu'à quelqu'un qui reprend", () => {
  for (const p of PROFILS) for (const n of NIVEAUX) {
    const s = palier(n, p), t = s.name + " " + s.line;
    if (!reprend(p)) assert.ok(!/reprise|retour|reviens|revenir|repart/i.test(t), `${JSON.stringify(p)} niveau ${n} → ${t}`);
  }
  assert.equal(reprend({ level: "comeback" }), true); assert.equal(reprend({ goal: "restart", level: "regular" }), true); assert.equal(reprend({ level: "regular", goal: "fat" }), false); assert.equal(reprend(undefined), false);
  assert.match(palier(4, { level: "regular", genre: "f" }).name, /La Femme d'élan/);
});

test("on ne dit pas « commençant » à quelqu'un de régulier ou d'avancé", () => {
  for (const level of ["regular", "advanced"]) for (const genre of ["m", "f", "n"]) assert.ok(!/Commençant|Premiers pas/.test(palier(1, { level, genre }).name));
  assert.equal(palier(1, { level: "beginner", genre: "f" }).name, "La Commençante"); assert.equal(palier(1, {}).name, "Premiers pas"); assert.equal(palier(2, { level: "advanced" }).name, "Nouveau cap");
});

test("chaque palier a ses trois formes, une icône et une phrase qui ne s'accorde avec personne", () => {
  for (const p of PALIERS) { assert.ok(p.icon && p.variantes.length); assert.equal(p.variantes.at(-1).si({}), true, "la dernière variante couvre tous les profils");
    for (const v of p.variantes) { for (const g of ["m", "f", "n"]) assert.ok(v.noms[g] && v.noms[g].length <= 26, JSON.stringify(v.noms)); assert.ok(!/\b(prête?|fi(er|ère)|motivée?|régulier|régulière|revenue?|seule?)\b/i.test(v.line), v.line); assert.ok(!/Homme|Femme/.test(v.noms.n)); } }
});

test("seuils d'origine conservés (1, 3, 5, 8) et niveaux hors bornes tolérés", () => {
  assert.deepEqual(PALIERS.map(p => p.from), [1, 3, 5, 8]);
  assert.equal(palier(0, {}).from, 1); assert.equal(palier(undefined, {}).from, 1); assert.equal(palier(99, {}).from, 8); assert.equal(palier(7, {}).from, 5);
  assert.equal(paliersPour({ genre: "f", level: "comeback" }).map(s => s.name).join(" | "), "De retour | La Femme de la reprise | La Femme de discipline | La Femme de fer");
});

test("modèles de nutrition : aucun nom ni description ne présume un homme, un âge précis ou une situation familiale", () => {
  const M = JSON.parse(readFileSync(new URL("../data/nutrition-models.json", import.meta.url), "utf8"));
  for (const m of M) { const t = m.name + " " + (m.prof || "");
    if (m.id !== "femme") assert.ok(!/\bhommes?\b|\bfemmes?\b/i.test(t), t);
    assert.ok(!/\b(Client|Pratiquant|Débutant)\b/.test(t), t); assert.ok(!/\d{2}-\d{2} ans|travail et famille/.test(t), t); }
});
