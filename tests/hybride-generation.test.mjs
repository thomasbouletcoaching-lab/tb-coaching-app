// Tests de la génération d'une semaine hybride : node --test tests/hybride-generation.test.mjs
// Personas fictifs : reprise à 3 séances, régulier avancé à 6 séances, débutante sans matériel.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as GH from "../js/hybride-generation.js";

const D = JSON.parse(readFileSync(new URL("../data/hybride.json", import.meta.url), "utf8"));
const rows = JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex;
X.setExercices(rows);
const R = X.exercices();
const bloc = (n, macroId = "M1") => ({ macroId, debut: "2026-12-07", nbSeances: n });
const items = (p) => p.seances.flatMap(s => s.blocs.flatMap(b => b.items));
const blocsDe = (s) => s.blocs.map(b => b.id);

const reprise = { answers: { level: "comeback", materiel: ["salle_complete"], zones: [] } };
const avance = { answers: { level: "advanced", materiel: ["salle_complete"], zones: [] }, halterophilie: true, vma: 15 };
const sansMateriel = { answers: { level: "beginner", materiel: ["poids_du_corps"], zones: [] } };

test("3 séances en reprise : nerveux en premier, zone 2 à la place des intervalles, aucune règle enfreinte", () => {
  const p = GH.semaine(D, R, { bloc: bloc(3), semaineMacro: 1, ...reprise });
  assert.equal(p.seances.length, 3);
  assert.deepEqual(p.regles, []);
  for (const s of p.seances) {
    const ids = blocsDe(s), premierNonNerveux = ids.findIndex(b => !["echauffement", "vitesse", "plio", "halterophilie"].includes(b));
    assert.ok(ids.slice(premierNonNerveux).every(b => !["vitesse", "plio", "halterophilie"].includes(b)), s.titre);
  }
  const cardio = items(p).find(l => l.categorie === "cardio");
  assert.match(cardio.nom, /Zone 2/); assert.match(cardio.note, /reprise/);
  assert.ok(items(p).some(l => /à 90 %/.test(l.nom)), "accélérations sous-maximales en reprise");
  assert.equal(p.rir, 3);
});

test("6 séances, régulier avancé : haltérophilie, skills, allures, cibles de développement approchées", () => {
  const p = GH.semaine(D, R, { bloc: bloc(6), semaineMacro: 3, ...avance });
  assert.equal(p.seances.length, 6);
  assert.ok(items(p).some(l => /power clean/i.test(l.nom)));
  assert.ok(items(p).some(l => /muscle-up/i.test(l.nom)));
  assert.ok(items(p).some(l => /km\/h/.test(l.note || "")), "allure calculée depuis la VMA");
  for (const g of Object.keys(p.cibles).filter(k => p.cibles[k].statut === "dev")) assert.ok(p.volume[g] >= p.cibles[g].min, `${g} : ${p.volume[g]} < ${p.cibles[g].min}`);
  assert.equal(p.rir, 1);
  assert.ok(items(p).filter(l => l.rpe != null).every(l => l.rpe <= 9));
});

test("débutante sans matériel : uniquement des exercices faisables au poids du corps, pas d'haltérophilie à la barre", () => {
  const p = GH.semaine(D, R, { bloc: bloc(3), semaineMacro: 1, ...sansMateriel });
  const slugs = items(p).filter(l => l.slug).map(l => l.slug);
  assert.ok(slugs.length >= 6);
  for (const s of slugs) assert.ok(R.find(e => e.slug === s).materiel.includes("poids_du_corps"), s);
  assert.ok(!items(p).some(l => /power clean|barre/i.test(l.nom)));
});

test("décharge (semaine 4) : volume divisé par deux, pas de sprint ni de pliométrie, intensité gardée", () => {
  const s3 = GH.semaine(D, R, { bloc: bloc(6), semaineMacro: 3, ...avance });
  const s4 = GH.semaine(D, R, { bloc: bloc(6), semaineMacro: 4, ...avance });
  assert.ok(s4.decharge);
  const tot = (p) => items(p).filter(l => l.slug).reduce((t, l) => t + l.n, 0);
  assert.ok(tot(s4) <= tot(s3) * 0.65, `${tot(s4)} vs ${tot(s3)}`);
  assert.ok(!items(s4).some(l => l.categorie === "vitesse"));
  assert.ok(!s4.seances.some(s => s.blocs.find(b => b.id === "plio")?.items.length));
  assert.ok(s4.tests.includes("vma"), "semaine 4 : test de VMA");
});

test("exercices détestés et gênes respectés (questionnaire sur mesure)", () => {
  const p0 = GH.semaine(D, R, { bloc: bloc(4), semaineMacro: 1, ...avance });
  const premier = items(p0).find(l => l.slug && l.couche === "squelette");
  const p = GH.semaine(D, R, { bloc: bloc(4), semaineMacro: 1, ...avance, prefs: { [premier.slug]: "hate" } });
  assert.ok(!items(p).some(l => l.slug === premier.slug));
  const g = GH.semaine(D, R, { bloc: bloc(4), semaineMacro: 1, answers: { ...avance.answers, zones: ["epaule"] } });
  for (const l of items(g).filter(x => x.slug)) assert.ok(!R.find(e => e.slug === l.slug).contre_indications.includes("epaule"), l.nom);
});

test("conversion vers le moteur de séances existant", () => {
  const p = GH.semaine(D, R, { bloc: bloc(4), semaineMacro: 2, ...avance });
  const prog = GH.versProgramme(D, p);
  assert.equal(prog.s.length, 4);
  assert.ok(prog.s.every(s => s[2].length > 0));
  assert.equal(prog.custom, true);
  assert.equal(prog.hybride.semaineMacro, 2);
});

test("gêne au genou : pas de sprint, la course passe à vélo", () => {
  const p = GH.semaine(D, R, { bloc: bloc(6), semaineMacro: 6, answers: { level: "advanced", materiel: ["salle_complete"], zones: ["genou"] } });
  assert.ok(!items(p).some(l => l.categorie === "vitesse"));
  assert.ok(!items(p).some(l => l.categorie === "cardio" && /course/.test(l.nom)));
});
