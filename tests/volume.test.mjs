// Tests du moteur « Volume de la semaine » (js/volume.js). Lancement : node --test tests/volume.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../js/volume.js";

const MUS = {
  "Développé couché barre": ["Pecs", "Triceps", "Épaules-avant"],
  "Développé incliné haltères": ["Pecs", "Épaules-avant", "Triceps"],
  "Dips lestés": ["Pecs", "Triceps"],
  "Squat barre": ["Quadriceps", "Fessiers", "Lombaires"],
  "Traction lestée": ["Dos-largeur", "Biceps"],
  "Élévations latérales": ["Épaules-latéral"],
  "Gainage": ["Abdos", "Mobilité"],
};
const musclesOf = (n) => MUS[n] || ["Autre"];
const L = (n, sets, extra = {}) => ({ ...V.newLine(n), sets, ...extra });

test("faisceaux : principal à 1, secondaires à 0,5, pectoraux découpés selon l'exercice", () => {
  assert.deepEqual(V.faisceauxOf("Développé couché barre", musclesOf), [{ f: "Pecs-milieu", c: 1 }, { f: "Triceps", c: 0.5 }, { f: "Épaules-avant", c: 0.5 }]);
  assert.equal(V.faisceauxOf("Développé incliné haltères", musclesOf)[0].f, "Pecs-haut");
  assert.equal(V.faisceauxOf("Dips lestés", musclesOf)[0].f, "Pecs-bas");
  assert.deepEqual(V.faisceauxOf("Gainage", musclesOf), [{ f: "Abdos", c: 1 }], "les muscles hors repères (mobilité) sont ignorés");
  assert.deepEqual(V.faisceauxOf("Squat barre", musclesOf, [{ f: "Quadriceps", c: 1 }, { f: "Fessiers", c: 0.75 }]), [{ f: "Quadriceps", c: 1 }, { f: "Fessiers", c: 0.75 }], "coefficients réglés par le coach");
});

test("volume : somme pondérée par faisceau, puis par muscle", () => {
  const r = V.computeVolume([L("Développé couché barre", 8), L("Développé incliné haltères", 6), L("Dips lestés", 4)], { musclesOf });
  assert.equal(r.byF["Pecs-milieu"], 8); assert.equal(r.byF["Pecs-haut"], 6); assert.equal(r.byF["Pecs-bas"], 4);
  assert.equal(r.byG.pecs, 18);
  assert.equal(r.byG.tri, 9); // 8×0,5 + 6×0,5 + 4×0,5
  assert.equal(r.byG.dant, 7); // 8×0,5 + 6×0,5
  assert.equal(r.total, 18);
});

test("statuts MV / MEV / MAV / MRV", () => {
  const lm = V.landmarks().pecs; // 6 / 8 / 12-20 / 22
  assert.equal(V.statusOf(0, lm).k, "low");
  assert.equal(V.statusOf(4, lm).k, "low");
  assert.equal(V.statusOf(7, lm).k, "mv");
  assert.equal(V.statusOf(10, lm).k, "prog");
  assert.equal(V.statusOf(16, lm).k, "opt");
  assert.equal(V.statusOf(21, lm).k, "watch");
  assert.equal(V.statusOf(23, lm).k, "over");
  assert.equal(V.statusOf(0, V.landmarks().fess).k, "none", "MV à 0 : non travaillé plutôt qu'insuffisant");
});

test("seuils : défaut, puis client, puis bloc", () => {
  const lm = V.landmarks({ pecs: { mrv: 18 } }, { pecs: { mev: 10, mav: [12, 16] } });
  assert.deepEqual(lm.pecs, { mv: 6, mev: 10, mav: [12, 16], mrv: 18 });
  assert.deepEqual(lm.dos, V.GROUPS.find(g => g.id === "dos").lm);
  const f = V.faisceauLm("Pecs-haut", V.landmarks());
  assert.equal(f.ind, true); assert.equal(f.mrv, 7.5);
});

test("tonnage : séries déduites du tonnage visé, % sur (PDC + lest) pour les mouvements lestés", () => {
  const ctx = { e1: (n) => ({ "Développé couché barre": 120, "Traction lestée": 120 })[n] || 0, bw: 80 };
  const b = L("Développé couché barre", 0, { mode: "ton", ton: 3000, lo: 5, hi: 5, it: { t: "kg", v: 100 } });
  assert.equal(V.lineSets(b, ctx), 6); // 3000 / (100 × 5)
  assert.equal(V.lineTonnage(b, ctx), 3000);
  const t = L("Traction lestée", 5, { bw: true, lo: 5, hi: 5, it: { t: "pct", v: 85 } });
  const c = V.chargeOf(t, ctx);
  assert.equal(c.total, 102); assert.equal(c.lest, 22); // 85 % de 120 = 102, moins 80 de PDC
  assert.equal(V.lineSets(L("Squat barre", 4, { mode: "ton", ton: 0 }), ctx), 4, "sans tonnage, on garde les séries");
});

test("répartition suggérée : tout est placé, le travail est étalé", () => {
  const lines = [L("Développé couché barre", 8, { force: true }), L("Squat barre", 8, { force: true }), L("Traction lestée", 8), L("Élévations latérales", 12)];
  const days = [true, false, true, false, true, false, false];
  const res = V.distribute(lines, days, { musclesOf });
  res.forEach((sp, i) => {
    assert.equal(Object.values(sp).reduce((a, b) => a + b, 0), lines[i].sets, `${lines[i].n} entièrement placé`);
    Object.keys(sp).forEach(d => assert.ok(days[+d], "seulement sur les jours d'entraînement"));
  });
  assert.ok(Object.keys(res[3]).length >= 3, "12 séries d'élévations sur 3 jours (4 max par séance)");
  assert.deepEqual(Object.values(res[0]), [4, 4], "8 séries de développé couché en 2 séances de 4");
});

test("contrôles : MRV dépassé, séance trop chargée, séries non placées", () => {
  const lines = [L("Développé couché barre", 24, { force: true, split: { 0: 12, 3: 12 } }), L("Squat barre", 6, { split: { 0: 3 } })];
  const msgs = V.checks(lines, [true, false, false, true, false, false, false], { musclesOf }).map(m => m.txt).join("\n");
  assert.match(msgs, /Pectoraux : 24 séries, au-dessus du MRV \(22\)/);
  assert.match(msgs, /Développé couché barre y contribue/);
  assert.match(msgs, /Lundi : 12 séries de Pectoraux/);
  assert.match(msgs, /Squat barre : 3 séries placées sur 6/);
});

test("conversion en séances : une séance par jour, force en premier", () => {
  const lines = [L("Élévations latérales", 4, { split: { 0: 4 } }), L("Développé couché barre", 4, { force: true, lo: 5, hi: 5, it: { t: "pct", v: 80 }, split: { 0: 4 } }), L("Squat barre", 3, { force: true, split: { 2: 3 } })];
  const s = V.toSessions(lines, [true, false, true, false, false, false, false], { musclesOf });
  assert.equal(s.length, 2); assert.equal(s[0][1], "Lundi"); assert.equal(s[1][1], "Mercredi");
  assert.equal(s[0][2][0][0], "Développé couché barre"); assert.equal(s[0][2][0][1], "F");
  assert.equal(s[0][2][0][5].sets.length, 4); assert.equal(s[0][2][0][5].sets[0].pct, 80);
  assert.match(s[0][0], /^Séance A · /);
});

test("lecture d'un programme existant", () => {
  const p = { s: [["A", "Lundi", [["Squat barre", "F", "", null, null, { sets: [{ t: "W", lo: 5, hi: 5 }, { t: "N", lo: 5, hi: 5, pct: 80 }, { t: "N", lo: 5, hi: 5, pct: 80 }] }]]], ["B", "Jeudi", [["Squat barre", "F", "", null, null, { sets: [{ t: "N", lo: 8, hi: 8, rpe: 8 }] }]]]] };
  const lines = V.fromProgram(p, { weekPlan: (r) => ({ sets: r[5].sets }), dayIndex: (se) => ["Lundi", "Mardi", "Mercredi", "Jeudi"].indexOf(se[1]) });
  assert.equal(lines.length, 1); assert.equal(lines[0].sets, 3);
  assert.deepEqual(lines[0].split, { 0: 2, 3: 1 }); assert.deepEqual(lines[0].it, { t: "pct", v: 80 });
});
