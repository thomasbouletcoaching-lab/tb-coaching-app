// Tests de l'atelier « Créer mon programme » : node --test tests/atelier.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as A from "../js/atelier.js";
import * as G from "../js/generateur.js";

X.setExercices(JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex);
const pat = { PH: "developpe-couche-barre", PV: "developpe-militaire-barre-ohp", TH: "rowing-penche-debout-a-la-barre", TV: "tractions-pronation-poids-de-corps", SG: "squat-barre", SH: "squat-barre-basse-low-bar", CH: "souleve-de-terre-roumain-barre", FG: "leg-curl-assis" };

test("départ : une séance par jour choisi, vide, avec les 8 catégories à zéro", () => {
  const d = A.nouveau([0, 2, 4]);
  assert.equal(d.sessions.length, 3); assert.deepEqual(d.sessions.map(s => s.titre), ["Séance A", "Séance B", "Séance C"]);
  const eq = A.equilibre(d); assert.equal(eq.total, 0); assert.equal(eq.manquants.length, 8);
});

test("ajouter / retirer / déplacer / remplacer un exercice", () => {
  let d = A.nouveau([0, 3]);
  d = A.ajouter(d, 0, pat.PH); d = A.ajouter(d, 0, pat.TH);
  assert.deepEqual(d.sessions[0].items.map(l => l.pattern), ["PH", "TH"]);
  d = A.deplacer(d, 0, 0, 1); assert.equal(d.sessions[0].items[0].pattern, "TH");
  d = A.remplacer(d, 0, 1, "developpe-couche-halteres"); assert.equal(d.sessions[0].items[1].slug, "developpe-couche-halteres");
  assert.equal(d.sessions[0].items[1].n, 3, "les séries sont gardées");
  d = A.retirer(d, 0, 0); assert.equal(d.sessions[0].items.length, 1);
});

test("squelette : séries par catégorie, état, équilibre et manques", () => {
  let d = A.nouveau([0, 3]);
  for (const c of ["PH", "PV", "TH", "TV"]) d = A.ajouter(d, 0, pat[c], 4);
  for (const c of ["SG", "SH", "CH"]) d = A.ajouter(d, 1, pat[c], 4);
  const eq = A.equilibre(d);
  assert.deepEqual(eq.manquants, ["FG"]); assert.equal(eq.complet, false);
  assert.equal(eq.par.PH.sets, 4); assert.equal(eq.haut, 16); assert.equal(eq.bas, 12);
  assert.ok(A.controles(d).some(c => /Il manque flexion de genou/.test(c.texte)));
  d = A.ajouter(d, 1, pat.FG, 3); assert.equal(A.equilibre(d).complet, true);
  assert.ok(A.controles(d).some(c => c.niveau === "ok"));
  assert.equal(A.etat(0), "manque"); assert.equal(A.etat(2), "faible"); assert.equal(A.etat(8), "ok"); assert.equal(A.etat(20), "beaucoup");
});

test("ajusterPattern : + sur la séance la moins chargée, − sur la plus chargée, rien sans exercice", () => {
  let d = A.nouveau([0, 3]);
  d = A.ajouter(d, 0, pat.PH, 4); d = A.ajouter(d, 1, pat.PH, 2);
  let r = A.ajusterPattern(d, "PH", 1); assert.deepEqual(A.repartition(r.d, "PH"), [4, 3]);
  r = A.ajusterPattern(d, "PH", -1); assert.deepEqual(A.repartition(r.d, "PH"), [3, 2]);
  assert.equal(A.ajusterPattern(d, "TV", 1).besoinExercice, true);
  r = A.ajusterPattern(A.ajouter(A.nouveau([0]), 0, pat.PH, 1), "PH", -1); assert.equal(r.d.sessions[0].items.length, 0, "à zéro, l'exercice sort");
});

test("placer : répartit une catégorie par séance", () => {
  let d = A.ajouter(A.ajouter(A.nouveau([0, 3]), 0, pat.PH, 4), 1, pat.PH, 2);
  d = A.placer(d, "PH", 1, 0).d; assert.deepEqual(A.repartition(d, "PH"), [4, 0]);
  assert.equal(A.placer(d, "PH", 1, 3).besoinExercice, true);
  d = A.placer(d, "PH", 0, 6).d; assert.deepEqual(A.repartition(d, "PH"), [6, 0]);
});

test("volume par muscle : séries directes à 1, secondaires à 0,5, statut face aux repères", () => {
  let d = A.ajouter(A.nouveau([0]), 0, pat.PH, 10);
  const vm = A.volumeMuscles(d), pecs = vm.groupes.find(g => g.id === "pecs"), tri = vm.groupes.find(g => g.id === "tri");
  assert.equal(pecs.sets, 10); assert.equal(tri.sets, 5); assert.equal(pecs.statut, "ok");
  assert.equal(vm.groupes.find(g => g.id === "quad").statut, "absent");
  d = A.ajouter(d, 0, pat.PH, 10); d = A.ajouter(d, 0, pat.PH, 6);
  assert.equal(A.volumeMuscles(d).groupes.find(g => g.id === "pecs").statut, "trop");
});

test("focus : plus de séries, reps plus basses, une série ajoutée toutes les 2 semaines ; superset ; programme du moteur", () => {
  let d = A.nouveau([0, 3]); d = A.ajouter(d, 0, pat.PH, 3); d = A.ajouter(d, 0, pat.TH, 3);
  d = A.basculerFocus(d, 0, 0); const l = d.sessions[0].items[0];
  assert.equal(l.focus, true); assert.equal(l.n, 3 + A.FOCUS_SERIES_EN_PLUS); assert.ok(l.hi <= 6);
  d = A.basculerSuperset(d, 0, 0); assert.equal(d.sessions[0].items[0].ss, "A"); assert.equal(d.sessions[0].items[1].ss, "A");
  const p = A.vers(d, { id: "atelier", name: "Mon test" });
  assert.equal(p.custom, true); assert.equal(p.id, "atelier"); assert.equal(p.s.length, 2); assert.equal(p.days.filter(Boolean).length, 2);
  const row = p.s[0][2][0]; assert.equal(row[3], "A"); assert.deepEqual(row[5].prog.addSet, { every: 2, max: l.n + 2 }); assert.equal(row[5].sets.length, l.n);
  assert.equal(p.s[0][2][1][3], "A");
  d = A.basculerSuperset(d, 0, 0); assert.equal(d.sessions[0].items[1].ss, null, "délier");
  d = A.basculerFocus(d, 0, 0); assert.equal(d.sessions[0].items[0].n, 3);
  assert.equal(A.basculerSuperset(A.ajouter(A.nouveau([0]), 0, pat.PH), 0, 0).refus?.length > 0, true, "pas de suivant : refus poli");
});

test("jours : ajouter un jour crée une séance, retirer un jour garde au moins un jour", () => {
  let d = A.nouveau([0, 3]); d = A.basculerJour(d, 4); assert.deepEqual(d.sessions.map(s => s.dow), [0, 3, 4]);
  d = A.basculerJour(d, 3); assert.deepEqual(d.sessions.map(s => s.dow), [0, 4]);
  assert.ok(A.basculerJour(A.nouveau([2]), 2).refus);
});

test("règler : bornes sur séries, reps, RPE et repos", () => {
  let d = A.ajouter(A.nouveau([0]), 0, pat.PH);
  d = A.regler(d, 0, 0, { n: 99, lo: 20, hi: 5, rpe: 12, rest: 5 }); const l = d.sessions[0].items[0];
  assert.equal(l.n, 10); assert.equal(l.lo, 20); assert.equal(l.hi, 20); assert.equal(l.rpe, 10); assert.equal(l.rest, 15);
});

test("point de départ : la proposition du générateur est copiée sans être modifiée", () => {
  const prop = G.generer({ answers: { goal: "muscle", level: "regular", materiel: ["salle_basique"], daysWanted: 3, daysReal: 3, sessionMin: 60, zones: [], style: "any" }, prefs: {} });
  const avant = JSON.stringify(prop), d = A.depuisProposition(prop);
  assert.equal(d.sessions.length, prop.sessions.length); assert.equal(A.equilibre(d).complet, true);
  A.ajouter(d, 0, pat.PH); assert.equal(JSON.stringify(prop), avant);
});

test("ajout groupé, déplacement et jours par catégorie", async () => {
  const A2 = await import("../js/atelier.js");
  let d = A2.nouveau([0, 2, 4]);
  d = A2.ajouterPlusieurs(d, 0, ["developpe-couche-barre", "developpe-incline-barre"], () => 4);
  assert.equal(d.sessions[0].items.length, 2); assert.equal(d.sessions[0].items[1].n, 4);
  d = A2.deplacerVers(d, 0, 1, 2);
  assert.equal(d.sessions[0].items.length, 1); assert.equal(d.sessions[2].items[0].slug, "developpe-incline-barre");
  assert.deepEqual(A2.joursPattern(d, "PH"), [0, 4]);
  d = A2.basculerJourPattern(d, "PH", 4);
  assert.deepEqual(A2.joursChoisis(d, "PH"), [0]);
  assert.equal(d.sessions[2].items.length, 0); assert.equal(d.sessions[0].items.length, 2);
  d = A2.basculerJourPattern(d, "PH", 2);
  assert.deepEqual(A2.joursPattern(d, "PH"), [0, 2]);
});
