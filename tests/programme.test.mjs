// Tests du questionnaire « Mon programme sur mesure » : node --test tests/programme.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as P from "../js/programme.js";

X.setExercices(JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex);
const prog = (a = {}, prefs = {}) => ({ answers: a, prefs });

test("parcours gratuit : partie courte seule, sans les favoris", () => {
  const s = P.steps({}, false).map(x => x.id);
  assert.deepEqual(s, ["goal", "goal2", "target", "level", "materiel", "daysWanted", "daysReal", "sessionMin", "zones", "style"]);
  assert.ok(!s.includes("favs"));
});

test("parcours Premium : partie avancée et favoris ; les questions sur les arrêts sautent si aucun arrêt", () => {
  const a = P.steps({ quits: "0" }, true).map(x => x.id);
  assert.ok(a.includes("priorities") && a.includes("torso") && a.at(-1) === "favs");
  assert.ok(!a.includes("quitAfter") && !a.includes("quitWhy"));
  const b = P.steps({ quits: "3" }, true).map(x => x.id);
  assert.ok(b.includes("quitAfter") && b.includes("quitWhy"));
});

test("chaque question a des réponses cohérentes et les mêmes valeurs que la bibliothèque", () => {
  for (const q of P.QUESTIONS) { if (q.type !== "text") assert.ok(q.opts.length >= 2, q.id); }
  assert.deepEqual(P.question("materiel").opts.map(o => o[0]).sort(), X.MATERIEL.map(o => o[0]).sort());
  assert.deepEqual(P.question("zones").opts.map(o => o[0]).sort(), X.ZONES.map(o => o[0]).sort());
  assert.deepEqual(P.question("weak").opts.map(o => o[0]), X.PATTERNS.map(p => p.code));
});

test("validation : choix unique, choix multiple (min et max), texte facultatif", () => {
  assert.equal(P.validate(P.question("goal"), "fat").value, "fat");
  assert.equal(P.validate(P.question("goal"), "nimporte").ok, false);
  assert.equal(P.validate(P.question("daysWanted"), "4").value, 4);
  assert.equal(P.validate(P.question("materiel"), []).ok, false);
  assert.deepEqual(P.validate(P.question("materiel"), ["poids_du_corps", "garage"]).value, ["poids_du_corps"]);
  assert.deepEqual(P.validate(P.question("zones"), []).value, []);
  assert.equal(P.validate(P.question("priorities"), ["pecs", "dos", "bras", "abdos"]).ok, false);
  assert.equal(P.validate(P.question("target"), "   ").value, null);
  assert.equal(P.validate(P.question("target"), "x".repeat(200)).value.length, 80);
});

test("contraintes : matériel, zones et exercices détestés", () => {
  const c = P.contraintes(prog({ materiel: ["poids_du_corps"], zones: ["genou"] }, { "squat-poids-de-corps": "hate", pompes: "love" }));
  assert.deepEqual(c, { materiel: ["poids_du_corps"], contreIndications: ["genou"], exclure: ["squat-poids-de-corps"] });
  assert.deepEqual(P.contraintes(null), { materiel: [], contreIndications: [], exclure: [] });
});

test("alternativesPour : respecte matériel, gênes et détestés ; les favoris passent en premier", () => {
  const maison = prog({ materiel: ["poids_du_corps"], zones: [] }, { "pompes-sur-les-genoux": "love" });
  const l = P.alternativesPour("Développé couché barre", maison);
  assert.deepEqual(l.map(e => e.slug), ["pompes-sur-les-genoux", "pompes"]);
  assert.deepEqual(P.alternativesPour("Développé couché barre", prog({ materiel: ["poids_du_corps"], zones: ["poignet"] })), [], "les pompes gênent le poignet : rien à proposer sans matériel");
  assert.deepEqual(P.alternativesPour("Développé couché barre", prog({ materiel: ["poids_du_corps"] }, { pompes: "hate" })).map(e => e.slug), ["pompes-sur-les-genoux"]);
  assert.ok(P.alternativesPour("Développé couché barre", prog({ materiel: ["salle_basique"] }, { "chest-press-machine": "hate" })).every(e => e.slug !== "chest-press-machine"));
  assert.equal(P.alternativesPour("Développé couché barre", prog({ materiel: ["salle_basique"] }, { "chest-press-machine": "love" }))[0].slug, "chest-press-machine");
});

test("aNoter : seulement le squelette faisable avec son matériel et sans gêne", () => {
  const all = P.aNoter(prog({ materiel: ["salle_complete"], zones: [] }));
  assert.deepEqual(Object.keys(all).sort(), X.PATTERNS.map(p => p.code).sort());
  const maison = P.aNoter(prog({ materiel: ["poids_du_corps"], zones: ["genou"] }));
  for (const l of Object.values(maison)) for (const e of l) assert.ok(e.couche === "squelette" && e.materiel.includes("poids_du_corps") && !e.contre_indications.includes("genou"));
  assert.ok(!Object.values(maison).flat().some(e => e.slug === "nordic-hamstring-curl"), "Nordic gêne le genou");
});

test("notes : adore et déteste se stockent, neutre efface", () => {
  let p = P.noter({}, "pompes", "love"); assert.deepEqual(p, { pompes: "love" });
  p = P.noter(p, "pompes", "hate"); assert.deepEqual(p, { pompes: "hate" });
  p = P.noter(p, "pompes", "neutral"); assert.deepEqual(p, {});
});

test("séances voulues et tenables", () => {
  assert.equal(P.joursRetenus({ daysWanted: 5, daysReal: 3 }), 3);
  assert.equal(P.joursRetenus({ daysWanted: 3, daysReal: 4 }), 3);
  assert.equal(P.ecartSeances({ daysWanted: 5, daysReal: 3 }), 2);
  assert.equal(P.ecartSeances({}), 0);
});

test("anamnèse : les zones sont converties vers celles de la bibliothèque", () => {
  assert.deepEqual(P.zonesFromAnamnese(["lombaires", "nuque", "genou", "genou"]), ["bas_du_dos", "genou"]);
});

test("coach : les gênes ne partent qu'avec le consentement de l'anamnèse", () => {
  const p = { v: 1, at: "2026-11-10T10:00:00Z", answers: { goal: "fat", zones: ["genou"] }, prefs: { pompes: "love" } };
  assert.deepEqual(P.pourCoach(p, false).answers, { goal: "fat" });
  assert.deepEqual(P.pourCoach(p, true).answers, { goal: "fat", zones: ["genou"] });
  assert.equal(P.pourCoach(null, true), null);
});

test("résumé lisible, sans donnée vide", () => {
  const r = Object.fromEntries(P.resume(prog({ goal: "fat", goal2: "muscle", level: "comeback", materiel: ["poids_du_corps", "elastique"], daysWanted: 5, daysReal: 3, sessionMin: 30, zones: ["genou"], style: "any", quits: "3", quitAfter: "5", quitWhy: ["temps"] }, { pompes: "love", squat: "hate" })));
  assert.equal(r["Objectif"], "Perdre du gras · puis prendre du muscle");
  assert.equal(r["Séances"], "5 voulues · 3 tenables");
  assert.equal(r["Gênes"], "Genou");
  assert.match(r["Arrêts passés"], /2 ou 3 fois · après 3 à 6 semaines · manque de temps/);
  assert.equal(r["Exercices"], "1 adoré · 1 détesté");
  assert.equal(Object.fromEntries(P.resume(prog({ goal: "fat" })))["Gênes"], "Aucune");
});
