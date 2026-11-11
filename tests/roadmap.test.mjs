// Tests de la roadmap vers un record : node --test tests/roadmap.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as R from "../js/roadmap.js";

X.setExercices(JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex);
const base = { nom: "Développé couché barre", cur: 100, tgt: 110, kg: 105, reps: 1, debut: "2026-11-11", fin: "2027-02-03", freq: 2, niveau: "regulier" };

test("verdict : réaliste, ambitieux, pas réaliste selon le rythme nécessaire", () => {
  const v = (tgt, jours, extra = {}) => R.verdict({ cur: 100, tgt, jours, niveau: "regulier", freq: 2, ...extra });
  assert.equal(v(103, 84).id, "realiste");
  assert.equal(v(105, 84).id, "ambitieux");
  assert.equal(v(112, 84).id, "impossible");
  assert.equal(v(100, 84).id, "atteint");
  assert.equal(R.verdict({ cur: 0, tgt: 100, jours: 60 }).id, "inconnu");
});

test("verdict : le niveau et la fréquence changent le plafond ; un délai trop court est refusé", () => {
  assert.equal(R.verdict({ cur: 60, tgt: 66, jours: 90, niveau: "debutant", freq: 3 }).id, "realiste");
  assert.equal(R.verdict({ cur: 180, tgt: 195, jours: 90, niveau: "avance", freq: 2 }).id, "impossible");
  assert.ok(R.verdict({ cur: 100, tgt: 106, jours: 90, freq: 3 }).ratio < R.verdict({ cur: 100, tgt: 106, jours: 90, freq: 1 }).ratio);
  assert.equal(R.verdict({ cur: 100, tgt: 110, jours: 14 }).id, "impossible");
});

test("verdict impossible : propose une date réaliste et une charge atteignable à l'échéance", () => {
  const v = R.verdict({ cur: 100, tgt: 125, jours: 84, niveau: "regulier", freq: 2, reps: 1 });
  assert.ok(v.kgMax > 100 && v.kgMax < 125, `kgMax ${v.kgMax}`);
  const d = v.dateReal("2026-11-11"); assert.ok(d > "2027-02-03", d);
});

test("phases : le jour J est la dernière semaine, un affûtage la précède, des décharges tous les 4 semaines", () => {
  const p = R.phasesDe(12);
  assert.equal(p.at(-1), "Objectif"); assert.equal(p.at(-2), "Affûtage"); assert.equal(p.length, 12);
  assert.equal(p[3], "Deload"); assert.ok(p.includes("Accumulation") && p.includes("Intensification") && p.includes("Réalisation"));
  assert.deepEqual(R.phasesDe(4), ["Réalisation", "Réalisation", "Réalisation", "Objectif"]);
  assert.ok(R.phasesDe(26).every(x => R.PHASES.includes(x)));
});

test("roadmap : toutes les semaines ont leurs séances, la charge monte, le jour J vise exactement la charge demandée", () => {
  const r = R.construire(base);
  assert.equal(r.nbSemaines, 12); assert.equal(r.semaines.length, 12);
  assert.ok(r.semaines.every(s => s.seances.length === 2 && s.seances.every(x => x.sets.length > 0)));
  const e = r.semaines.map(s => s.e1);
  for (let i = 1; i < e.length; i++) assert.ok(e[i] >= e[i - 1] - 0.05, `e1 recule semaine ${i + 1}`);
  assert.equal(r.semaines.at(-1).e1, 110);
  const jourJ = r.semaines.at(-1).seances.at(-1); assert.equal(jourJ.type, "test");
  const tentative = jourJ.sets.at(-1); assert.equal(tentative.kg, 105); assert.equal(tentative.lo, 1); assert.equal(tentative.rpe, 10);
  assert.ok(R.echauffement(jourJ.sets).length >= 3 && R.echauffement(jourJ.sets).every(x => x.kg < 105));
});

test("charges : arrondies à 2,5 kg, cohérentes avec le 1RM estimé (Epley + RIR) et l'effort", () => {
  const r = R.construire(base), s = r.semaines[0].seances[0];
  for (const x of s.sets) { assert.equal(x.kg % 2.5, 0); const e = R.e1rm(x.kg, x.lo, x.rpe); assert.ok(e <= r.semaines[0].e1 * 1.02 && e >= r.semaines[0].e1 * 0.95, `${x.kg} × ${x.lo}`); }
  assert.ok(s.sets[0].pct >= 70 && s.sets[0].pct <= 85);
  const lourd = r.semaines[0].seances[0].sets[0], volume = r.semaines[0].seances[1].sets[0];
  assert.ok(lourd.kg > volume.kg, "séance lourde plus lourde que séance de volume");
});

test("décharge : charge réduite sans reculer le 1RM de départ de la semaine suivante", () => {
  const r = R.construire(base), i = r.semaines.findIndex(s => s.phase === "Deload"), d = r.semaines[i], a = r.semaines[i - 1], n = r.semaines[i + 1];
  assert.ok(d.seances[0].sets.length < a.seances[0].sets.length || d.seances[0].sets[0].kg < a.seances[0].sets[0].kg);
  assert.equal(d.e1, a.e1); assert.ok(n.e1 > d.e1);
});

test("fréquence : 1, 2 ou 3 séances par semaine ; semaine du jour J : activation puis tentative", () => {
  for (const f of [1, 2, 3]) { const r = R.construire({ ...base, freq: f }); assert.ok(r.semaines.every(s => s.seances.length === f)); assert.equal(r.semaines.at(-1).seances.at(-1).type, "test"); }
  assert.equal(R.construire({ ...base, freq: 3 }).semaines.at(-1).seances[0].type, "activation");
});

test("délais : au moins 4 semaines, au plus 26", () => {
  assert.equal(R.construire({ ...base, fin: "2026-11-20" }).nbSemaines, 4);
  assert.equal(R.construire({ ...base, fin: "2028-01-01" }).nbSemaines, 26);
});

test("programme du moteur : une séance par jour, charges semaine par semaine, accessoires de la même catégorie", () => {
  const r = R.construire(base), p = R.vers(r, { id: "road-test" });
  assert.equal(p.id, "road-test"); assert.equal(p.custom, true); assert.equal(p.weeks, 12); assert.equal(p.s.length, 2); assert.equal(p.phases.length, 12);
  assert.deepEqual(p.days.map((x, i) => x ? i : -1).filter(i => i >= 0), [0, 3]);
  const main = p.s[0][2][0]; assert.equal(main[0], "Développé couché barre");
  assert.equal(Object.keys(main[5].weeks).length, 12); assert.deepEqual(main[5].weeks[1], main[5].sets);
  assert.equal(p.s[1][2][0][5].weeks[12].at(-1).kg, 105, "la dernière séance du jour J porte la tentative");
  assert.equal(p.s[0][2].length, 4, "1 mouvement + 3 accessoires");
  assert.ok(p.s[0][2].slice(1).every(row => X.exercice(row[0])), "accessoires de la bibliothèque");
  assert.ok(!p.phases.includes("Test"), "pas de phase « Test » : elle réduirait les charges du jour J");
});

test("catégorie de mouvement : reconnue d'après le nom", () => {
  assert.equal(R.patternDe("Développé couché barre"), "PH"); assert.equal(R.patternDe("Squat barre"), "SG"); assert.equal(R.patternDe("Soulevé de terre"), "CH");
  assert.equal(R.patternDe("Tractions lestées (pronation)"), "TV"); assert.equal(R.patternDe("Développé militaire barre (OHP)"), "PV");
});

// Recalage d'une roadmap démarrée plus tard
{
  const R2 = await import('../js/roadmap.js');
  const d0 = new Date(); const iso = (n) => { const x = new Date(d0); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const road = R2.construire({ nom: 'Développé couché barre', cur: 100, tgt: 110, kg: 110, reps: 1, debut: iso(0), fin: iso(140), freq: 2, niveau: 'regulier' });
  const prog = R2.vers(road, { id: 'road-x' });
  const plusTard = R2.recaler(prog, iso(14));
  console.log(plusTard.weeks < prog.weeks && plusTard.id === 'road-x' ? '  ✓ roadmap recalée au démarrage' : '  ✗ recalage');
  if (!(plusTard.weeks < prog.weeks && plusTard.id === 'road-x')) process.exitCode = 1;
}
