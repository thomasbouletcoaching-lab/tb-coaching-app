// Tests de l'indice de difficulté de la séance : node --test tests/indice.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as G from "../js/generateur.js";
import * as P from "../js/programme.js";
import * as I from "../js/indice.js";

X.setExercices(JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex);
const L = (nom, n, lo, hi, rpe, nerveux, kind = "F", rest = 180, extra = {}) => ({ nom, n, lo, hi, rpe, nerveux, kind, rest, unite: "reps", couche: "squelette", pattern: "PH", ...extra });
const iso = (n = 3, rpe = 8) => L("Curl", n, 10, 12, rpe, 1, "I", 75, { couche: "isolation", pattern: undefined });
const base = { goal: "muscle", level: "regular", materiel: ["salle_basique"], daysWanted: 4, daysReal: 4, sessionMin: 75, zones: [], style: "any" };
const prog = (a = {}) => ({ answers: { ...base, ...a }, prefs: {} });

test("pourcentage du 1RM : Epley corrigé par les répétitions en réserve, comme le moteur", () => {
  assert.equal(Math.round(I.pctDe(8, 8)), 75);
  assert.equal(Math.round(I.pctDe(5, 8)), 81);
  assert.equal(I.pctDe(1, 10), 100);
  assert.ok(I.pctDe(30, 5) > 0 && I.pctDe(30, 5) < I.pctDe(10, 8), "les répétitions sont plafonnées à 15");
  assert.ok(I.pctDe(5, 9) > I.pctDe(5, 7), "plus on est proche de l'échec, plus la série est lourde");
});

test("INOL d'une série : répétitions ÷ (100 − %1RM), plancher du dénominateur, échauffement ignoré", () => {
  const l = L("Squat", 1, 8, 8, 8, 3);
  assert.ok(Math.abs(I.inolSerie({ lo: 8, hi: 8, rpe: 8 }, l) - 8 / 25) < 1e-9);
  assert.ok(Math.abs(I.inolSerie({ lo: 5, hi: 5, pct: 80 }, l) - 5 / 20) < 1e-9, "un % explicite prime sur l'estimation");
  assert.ok(Number.isFinite(I.inolSerie({ lo: 1, hi: 1, rpe: 10 }, l)), "pas d'infini à 100 %");
  assert.equal(I.inolSerie({ lo: 8, hi: 8, rpe: 8, t: "W" }, l), 0);
  assert.equal(I.inolSerie({ lo: 30, hi: 30 }, { kind: "M", unite: "s" }), 0, "mobilité : aucune charge");
});

test("coût nerveux : un soulevé de terre à RPE 9 coûte plus qu'une isolation à RPE 9 (exemple de la spec)", () => {
  const dl = I.indiceSeance([L("Soulevé de terre", 3, 5, 5, 9, 3)]), ci = I.indiceSeance([iso(3, 9)]);
  assert.ok(dl.nerveux > 2 * ci.nerveux, `${dl.nerveux} contre ${ci.nerveux}`);
  assert.ok(I.nerveuxSerie({ lo: 5, hi: 5, rpe: 9 }, L("x", 1, 5, 5, 9, 3)) > I.nerveuxSerie({ lo: 5, hi: 5, rpe: 8 }, L("x", 1, 5, 5, 8, 3)) * 1.4, "bonus au-dessus de RPE 9");
  assert.equal(I.nerveuxSerie({ lo: 5, hi: 5, rpe: 9, t: "W" }, L("x", 1, 5, 5, 9, 3)), 0);
});

test("monotonie : plus de séries, un RPE plus haut ou une séance plus longue augmentent l'indice", () => {
  const s = (n, rpe, rest = 120) => I.indiceSeance([L("A", n, 8, 8, rpe, 3, "P", rest), L("B", n, 8, 8, rpe, 2, "P", rest), iso(n, rpe)]).score;
  assert.ok(s(4, 8) > s(3, 8) && s(3, 8) > s(2, 8));
  assert.ok(s(3, 9) > s(3, 8) && s(3, 8) > s(3, 7));
  assert.ok(s(3, 8, 180) > s(3, 8, 60), "les repos longs allongent la séance");
});

test("bornes et bandes : 0 à 100, Légère / Modérée / Exigeante / Très exigeante", () => {
  assert.equal(I.indiceSeance([]).score, 0); assert.equal(I.indiceSeance([]).niveau.nom, "Légère");
  const enorme = I.indiceSeance(Array.from({ length: 12 }, () => L("Lourd", 8, 3, 3, 10, 3)));
  assert.ok(enorme.score <= 100 && enorme.niveau.id === "tres" && enorme.niveau.rang === 4);
  assert.deepEqual([27, 28, 49, 50, 69, 70].map(x => I.niveauDe(x).id), ["legere", "moderee", "moderee", "exigeante", "exigeante", "tres"]);
  assert.equal(I.POIDS.duree + I.POIDS.inol + I.POIDS.nerveux, 1);
});

test("exemples calibrés : séance de débutant légère, 4×5 classique modérée, séance lourde à RPE 9 très exigeante", () => {
  const debutant = I.indiceSeance([L("Presse", 2, 10, 12, 7, 2, "P"), L("Développé machine", 2, 10, 12, 7, 1, "P"), L("Tirage", 2, 10, 12, 7, 1, "P"), L("Leg curl", 2, 10, 12, 7, 1, "P"), L("Gainage", 2, 30, 45, 7, 1, "C", 60, { unite: "s" })]);
  assert.equal(debutant.niveau.id, "legere", String(debutant.score));
  const classique = I.indiceSeance([L("Squat", 4, 5, 5, 8, 3), L("Développé couché", 4, 5, 5, 8, 3), L("Rowing", 4, 8, 8, 8, 3), iso(3, 8)]);
  assert.equal(classique.niveau.id, "moderee", String(classique.score));
  const lourde = I.indiceSeance([L("Squat", 5, 3, 3, 9, 3), L("Développé couché", 5, 3, 3, 9, 3), L("Soulevé de terre", 3, 3, 3, 9.5, 3), L("Rowing", 4, 6, 6, 8, 3), iso(3, 8)]);
  assert.equal(lourde.niveau.id, "tres", String(lourde.score));
});

test("séries non uniformes (programmes du moteur) : top set + back-off, échauffement ignoré", () => {
  const l = { nom: "Squat", nerveux: 3, kind: "F", rest: 180, unite: "reps", series: [{ t: "W", lo: 5, hi: 5, pct: 50 }, { t: "T", lo: 3, hi: 3, pct: 85 }, { t: "B", lo: 5, hi: 5, pct: 75 }, { t: "B", lo: 5, hi: 5, pct: 75 }] };
  const i = I.indiceSeance([l]);
  assert.equal(I.nbSeriesTravail(l), 3);
  assert.ok(Math.abs(i.inol - (3 / 15 + 2 * 5 / 25)) < 0.06, String(i.inol));
  assert.equal(i.parLigne[0].series, 3);
});

test("détail pour le coach : INOL et coût nerveux par exercice, somme cohérente", () => {
  const i = I.indiceSeance([L("A", 4, 8, 8, 8, 3), iso(3, 8)]);
  assert.equal(i.parLigne.length, 2);
  assert.ok(Math.abs(i.parLigne.reduce((t, x) => t + x.inol, 0) - i.inol) < 0.06);
  assert.ok(i.parLigne[0].nerveux > i.parLigne[1].nerveux);
});

test("charge de la semaine : somme des charges brutes et des minutes", () => {
  const a = I.indiceSeance([L("A", 4, 8, 8, 8, 3)]), b = I.indiceSeance([L("B", 3, 8, 8, 8, 2)]), c = I.chargeSemaine([a, b]);
  assert.equal(c.seances, 2); assert.equal(c.minutes, a.minutes + b.minutes); assert.ok(Math.abs(c.inol - (a.inol + b.inol)) < 0.11);
  assert.deepEqual(I.chargeSemaine([]), { inol: 0, nerveux: 0, minutes: 0, scoreMoyen: 0, seances: 0 });
});

test("deux séances très exigeantes de suite sont repérées, pas à 2 jours d'écart", () => {
  const t = (dow, id) => ({ titre: "S" + dow, dow, indice: { niveau: { id } } });
  assert.equal(I.enchainementsLourds([t(0, "tres"), t(1, "tres"), t(3, "exigeante")]).length, 1);
  assert.equal(I.enchainementsLourds([t(0, "tres"), t(2, "tres")]).length, 0);
  assert.equal(I.enchainementsLourds([t(6, "tres"), t(0, "tres")]).length, 1, "dimanche puis lundi");
  assert.equal(I.enchainementsLourds([t(0, "tres"), t(1, "exigeante")]).length, 0);
});

// ---------- Version allégée ----------
const seanceLongue = () => G.generer(prog({ sessionMin: 90, daysWanted: 4, daysReal: 4, priorities: ["bras"] })).sessions[0];
test("allégée : tient dans 20, 30 et 45 minutes, plus légère, sans toucher à la séance d'origine", () => {
  const s = seanceLongue(), avant = JSON.stringify(s.items);
  const l = { 45: I.allegee(s.items, 45), 30: I.allegee(s.items, 30), 20: I.allegee(s.items, 20) };
  for (const c of [45, 30, 20]) { assert.ok(l[c].tient && l[c].minutes <= c, `${c} : ${l[c].minutes} min`); assert.ok(l[c].indice.score < s.indice.score, `${c} plus légère`); }
  assert.ok(l[20].indice.score <= l[30].indice.score && l[30].indice.score <= l[45].indice.score);
  assert.equal(JSON.stringify(s.items), avant, "la séance d'origine n'est pas modifiée");
});
test("allégée : retire l'isolation d'abord, garde le squelette tant que le temps le permet, jamais plus de séries", () => {
  const s = seanceLongue(), a = I.allegee(s.items, 45);
  assert.ok(a.items.every(x => x.couche === "squelette"), "plus d'isolation");
  assert.ok(s.items.filter(x => x.couche !== "squelette").every(x => a.retire.includes(x.nom)));
  const orig = new Map(s.items.map(x => [x.nom, x.n]));
  a.items.forEach(x => assert.ok(x.series.length <= orig.get(x.nom) && x.series.length >= 1, x.nom));
  const pats = (l) => new Set(l.filter(x => x.couche === "squelette").map(x => x.pattern));
  assert.deepEqual([...pats(a.items)].sort(), [...pats(s.items)].sort(), "les patterns de la séance sont gardés à 45 min");
});
test("allégée : à 20 minutes, les patterns prioritaires sont gardés en dernier", () => {
  const p = G.generer(prog({ sessionMin: 90, daysWanted: 2, daysReal: 2, priorities: ["pecs"] })), a = G.allegeeSeance(p, 0, 20);
  assert.ok(a.minutes <= 22 && a.items.length >= 2);
  assert.ok(a.items.some(x => x.pattern === "PH"), "PH (priorité pecs) est gardé");
});
test("allégée : ciblesPour ne propose que les durées plus courtes que la séance", () => {
  assert.deepEqual(G.ciblesPour(74), [20, 30, 45]); assert.deepEqual(G.ciblesPour(40), [20, 30]); assert.deepEqual(G.ciblesPour(20), []);
});

// ---------- Dans le générateur ----------
test("chaque séance proposée porte son indice ; la semaine porte sa charge", () => {
  const p = G.generer(prog());
  p.sessions.forEach(s => { assert.ok(s.indice.score >= 0 && s.indice.score <= 100 && s.indice.minutes === s.minutes); assert.deepEqual(s.indice, I.indiceSeance(s.items)); });
  assert.equal(p.charge.seances, 4); assert.equal(p.charge.minutes, p.sessions.reduce((t, s) => t + s.minutes, 0));
});
test("jamais deux séances très exigeantes de suite, quel que soit le profil", () => {
  for (const goal of ["strength", "muscle"]) for (const n of [3, 4, 5, 6]) for (const style of ["any", "fullbody", "hautbas", "ppl"]) {
    const p = G.generer(prog({ goal, level: "advanced", sessionMin: 90, daysWanted: n, daysReal: n, style, materiel: ["salle_complete"] }));
    assert.equal(I.enchainementsLourds(p.sessions).length, 0, `${goal} ${n} ${style}`);
    assert.ok(!p.controles.some(c => c.niveau === "alerte" && /très exigeantes/.test(c.texte)));
  }
});
test("le contrôle signale deux séances très exigeantes de suite quand elles existent", () => {
  const p = G.generer(prog({ daysWanted: 3, daysReal: 3 }));
  const f = JSON.parse(JSON.stringify(p)); f.sessions[0].dow = 0; f.sessions[1].dow = 1; f.sessions.forEach(s => { s.indice = { niveau: { id: "tres" } }; });
  assert.ok(G.controles(f, {}).some(c => c.niveau === "alerte" && /très exigeantes/.test(c.texte)));
});
test("remplacer un exercice recalcule l'indice et la charge", () => {
  const pr = prog({ daysWanted: 3, daysReal: 3 }), p = G.generer(pr), li = p.sessions[0].items.findIndex(l => l.couche === "squelette");
  const alts = G.alternativesLigne(p, pr, 0, li, P.alternativesPour);
  assert.ok(alts.length > 0);
  const q = G.remplacerLigne(p, pr, 0, li, alts[0].slug);
  assert.deepEqual(q.sessions[0].indice, I.indiceSeance(q.sessions[0].items)); assert.ok(q.charge.seances === p.charge.seances);
});
