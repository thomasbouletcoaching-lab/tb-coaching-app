// Tests du score de soutenabilité : node --test tests/soutenabilite.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as G from "../js/generateur.js";
import * as S from "../js/soutenabilite.js";

X.setExercices(JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex);
const base = { goal: "muscle", level: "regular", materiel: ["salle_basique"], daysWanted: 4, daysReal: 4, sessionMin: 75, zones: [], style: "any" };
const prog = (a = {}, prefs = {}) => ({ answers: { ...base, ...a }, prefs });
const noter = (a = {}, ctx = {}) => { const p = prog(a), prop = G.generer(p); return { prop, ev: S.evaluer(S.planDe(prop), { answers: p.answers, libre: null, trajet: 15, actuel: [3, 3, 3, 3], ...ctx }) }; };
const plan = (n, minutes, score) => ({ n, seances: Array.from({ length: n }, () => ({ minutes, score })) });

test("pondération : la somme des poids vaut 1 et le score reste entre 0 et 100", () => {
  assert.ok(Math.abs(Object.values(S.POIDS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (const ev of [S.evaluer(plan(1, 20, 5), { answers: { level: "regular", daysReal: 1 }, actuel: [3, 3] }), S.evaluer(plan(6, 120, 95), { answers: { level: "beginner", sleep: "5", stress: "high", kids: "yes", work: "physical", quits: "5" }, actuel: [0, 0], libre: 300 })])
    assert.ok(ev.score >= 0 && ev.score <= 100, String(ev.score));
});

test("capacité de vie : sommeil, stress, travail physique et enfants la réduisent, avec un plancher", () => {
  assert.equal(S.capaciteVie({}).valeur, 100);
  assert.equal(S.capaciteVie({ sleep: "5" }).valeur, 75);
  assert.equal(S.capaciteVie({ sleep: "5", stress: "high", kids: "yes", work: "physical" }).valeur, 40, "plancher à 40");
  assert.deepEqual(S.capaciteVie({ sleep: "5", kids: "yes" }).raisons, ["sommeil court", "enfants en bas âge"]);
});

test("activité actuelle : la moyenne mesurée prime, sinon une estimation selon le niveau", () => {
  assert.deepEqual(S.activiteActuelle({ level: "beginner" }, [0, 0, 0, 0]), { seances: 0, source: "mesure" });
  assert.equal(S.activiteActuelle({ level: "regular" }, [2, 4]).seances, 3);
  assert.deepEqual(S.activiteActuelle({ level: "advanced" }, null), { seances: 4, source: "declare" });
  assert.equal(S.activiteActuelle({ level: "regular" }, [5]).source, "declare", "une seule semaine ne suffit pas");
});

test("temps libre utile : plafonné par jour et réduit à 60 %", () => {
  assert.equal(S.libreUtile([600, 600, 600, 600, 600, 600, 600]), Math.round(7 * 300 * 0.6));
  assert.equal(S.libreUtile([100, 0, -5, 50]), Math.round(150 * 0.6));
});

test("temps : la part du temps libre consommée fait baisser le score, mesurée ou estimée", () => {
  const t = (libre, p = plan(3, 60, 40)) => S.ingredients(p, { answers: { level: "regular", daysReal: 3 }, libre, trajet: 15, actuel: [3, 3] }).temps;
  assert.ok(t(2000).score > t(900).score && t(900).score > t(500).score);
  assert.equal(t(2000).confiance, "mesuré"); assert.equal(t(null).confiance, "estimé");
  assert.match(t(null).detail, /Remplis « Ma semaine »/);
  assert.match(t(500).detail, /très peu de marge/);
  assert.ok(t(2000).ratio < 0.15 && t(2000).score === 100);
  assert.ok(S.ingredients(plan(3, 60, 40), { answers: { level: "regular", kids: "yes", work: "physical", sleep: "5", stress: "high" }, libre: null, trajet: 15, actuel: [3] }).temps.libre < 1260, "la vie réduit le temps libre estimé");
});

test("charge : un même plan pèse plus pour qui récupère mal", () => {
  const c = (a) => S.ingredients(plan(4, 70, 60), { answers: { level: "regular", daysReal: 4, ...a }, actuel: [4, 4] }).charge;
  assert.ok(c({}).score > c({ sleep: "5" }).score && c({ sleep: "5" }).score > c({ sleep: "5", stress: "high", kids: "yes", work: "physical" }).score);
  assert.ok(S.ingredients(plan(4, 70, 60), { answers: { level: "advanced", daysReal: 4 }, actuel: [4] }).charge.score > c({}).score, "un avancé encaisse plus");
});

test("saut : de 0 à 5 séances est le pire cas, une marche d'une ou deux séances est sans risque", () => {
  const s = (n, act) => S.ingredients(plan(n, 60, 40), { answers: { level: "regular", daysReal: n }, actuel: act }).saut;
  assert.equal(s(3, [2, 2, 2]).score, 100); assert.equal(s(4, [2, 2, 2]).score, 100);
  assert.equal(s(5, [2, 2, 2]).score, 80); assert.ok(s(5, [1, 1, 1]).score < 80); assert.ok(s(5, [0, 0, 0]).score <= 15);
  assert.match(s(5, [0, 0]).detail, /très grande marche/); assert.match(s(3, [2, 2]).detail, /raisonnable/);
});

test("historique : plus d'arrêts, moins de score ; sans réponse, neutre et signalé", () => {
  const h = (q, after, n = 3) => S.ingredients(plan(n, 60, 40), { answers: { level: "regular", daysReal: n, quits: q, quitAfter: after }, actuel: [3, 3] }).historique;
  assert.equal(h("0").score, 100); assert.equal(h("1").score, 80); assert.equal(h("3").score, 55); assert.equal(h("5").score, 35);
  assert.equal(h("3", "5", 4).score, 45, "arrêts rapides et beaucoup de séances : plus risqué");
  assert.equal(S.ingredients(plan(3, 60, 40), { answers: { level: "regular" }, actuel: [3] }).historique.connu, false);
  assert.match(h("5").detail, /plan qu'on tient/);
});

test("écart : un plan au-delà du réaliste de la personne est pénalisé ; sinon l'envie plus grande que le réaliste est expliquée", () => {
  const e = (n, real, wanted) => S.ingredients(plan(n, 60, 40), { answers: { level: "regular", daysReal: real, daysWanted: wanted }, actuel: [3, 3] }).ecart;
  assert.equal(e(3, 3, 3).score, 100); assert.ok(e(4, 3, 4).score < 100 && e(5, 3, 5).score < e(4, 3, 4).score);
  assert.match(e(3, 3, 5).detail, /Tu aimerais 5 séances mais en tiens 3/);
});

test("niveaux : profils types — tenable, ambitieux, trop ambitieux", () => {
  assert.equal(noter({ goal: "fat", level: "beginner", materiel: ["halteres_maison", "poids_du_corps", "barre_traction"], daysWanted: 3, daysReal: 3, sessionMin: 45 }, { actuel: [0, 0, 0, 0], trajet: 0 }).ev.niveau.id, "tenable");
  assert.equal(noter({}, { actuel: [3, 3, 3, 3] }).ev.niveau.id, "tenable", "régulier, 4 séances, il en fait déjà 3");
  assert.equal(noter({ goal: "fat", level: "beginner", daysWanted: 5, daysReal: 5, sessionMin: 60 }, { actuel: [0, 0, 0, 0] }).ev.niveau.id, "ambitieux", "0 → 5 séances, en forme");
  const trop = noter({ level: "beginner", daysWanted: 5, daysReal: 5, sessionMin: 60, sleep: "5", stress: "high", kids: "yes", quits: "5", quitAfter: "2" }, { actuel: [0, 0, 0, 0] }).ev;
  assert.equal(trop.niveau.id, "trop"); assert.match(trop.message, /Ce plan vise trop haut pour ta vie actuelle\. Mieux vaut \d séances tenues 12 semaines que 5 pendant 3 semaines\./);
  assert.equal(noter({ level: "regular", kids: "yes", work: "physical", stress: "high", sleep: "6.5", sessionMin: 60 }, { actuel: [2, 2, 2, 2] }).ev.niveau.id, "ambitieux", "la charge dépasse la récupération : jamais « tenable »");
});

test("garde-fous : un temps libre mesuré impossible impose « trop ambitieux » ; l'ordre des points à travailler va du pire au meilleur", () => {
  const ev = S.evaluer(plan(5, 90, 50), { answers: { level: "regular", daysReal: 5 }, libre: 400, trajet: 15, actuel: [5, 5, 5] });
  assert.equal(ev.niveau.id, "trop");
  assert.ok(ev.aTravailler.includes("temps")); assert.ok(ev.aTravailler.every((id, i, t) => i === 0 || ev.ingredients[id].score >= ev.ingredients[t[i - 1]].score));
  assert.equal(S.evaluer(plan(3, 45, 25), { answers: { level: "regular", daysReal: 3 }, libre: 2500, actuel: [3, 3], trajet: 0 }).confiance, "à affiner", "historique inconnu : confiance à affiner");
  assert.equal(S.evaluer(plan(3, 45, 25), { answers: { level: "regular", daysReal: 3, quits: "0" }, libre: 2500, actuel: [3, 3], trajet: 0 }).confiance, "bonne");
});

test("messages : positifs, jamais culpabilisants", () => {
  const msgs = ["tenable", "ambitieux", "trop"].map(id => ({ tenable: noter({}, {}).ev, ambitieux: noter({ goal: "fat", level: "beginner", daysWanted: 5, daysReal: 5, sessionMin: 60 }, { actuel: [0, 0, 0, 0] }).ev, trop: noter({ level: "beginner", daysWanted: 5, daysReal: 5, sessionMin: 60, sleep: "5", stress: "high", kids: "yes", quits: "5" }, { actuel: [0, 0, 0, 0] }).ev })[id].message);
  msgs.forEach(m => assert.ok(!/échec|paresse|faible|nul|honte|raté/i.test(m), m));
  assert.match(msgs[0], /tient dans ta vie/);
});

test("version tenable : moins de séances et plus courtes, la plus grosse qui reste tenable", () => {
  const p = prog({ level: "beginner", daysWanted: 5, daysReal: 5, sessionMin: 60, sleep: "5", stress: "high", kids: "yes", quits: "5", quitAfter: "2" });
  const ctx = { actuel: [0, 0, 0, 0], libre: null, trajet: 15 };
  const avant = S.evaluer(S.planDe(G.generer(p)), { ...ctx, answers: p.answers });
  const v = S.versionTenable(p, ctx, G.generer);
  assert.equal(avant.niveau.id, "trop"); assert.equal(v.tenable, true); assert.equal(v.evaluation.niveau.id, "tenable");
  assert.ok(v.seances < 5 && v.seances >= 2 && v.minutes <= 60 && v.evaluation.score > avant.score);
  assert.equal(v.prop.n, v.seances); assert.ok(v.prop.sessions.every(s => s.minutes <= v.minutes + 3));
  assert.deepEqual(v.answers, { daysWanted: v.seances, daysReal: v.seances, sessionMin: v.minutes });
  assert.ok(v.essais >= 5, "plusieurs combinaisons essayées");
  // Aucune version tenable possible : on rend la meilleure, et on le dit
  const pire = S.versionTenable(prog({ level: "beginner", daysWanted: 4, daysReal: 4, sessionMin: 60 }), { actuel: [0], libre: 100, trajet: 30 }, G.generer);
  assert.equal(pire.tenable, false); assert.ok(pire.evaluation.score >= 0);
  // Un plan déjà tenable reste tel quel
  const ok = S.versionTenable(prog({ goal: "fat", level: "beginner", materiel: ["halteres_maison", "poids_du_corps", "barre_traction"], daysWanted: 3, daysReal: 3, sessionMin: 45 }), { actuel: [0, 0, 0, 0], libre: null, trajet: 0 }, G.generer);
  assert.equal(ok.seances, 3); assert.equal(ok.minutes, 45);
});

test("montée progressive : on démarre sous la cible quand la marche est grande, les arrêts nombreux ou le plan sous capacité", () => {
  assert.equal(S.depart(5, { level: "beginner" }, [0, 0, 0, 0]), 2);
  assert.equal(S.depart(5, { level: "regular" }, [3, 3, 3]), 5, "il en fait déjà 3 : la marche est de 2");
  assert.equal(S.depart(4, { level: "regular", quits: "3" }, [3, 3, 3]), 3, "arrêts passés : un cran en dessous");
  assert.equal(S.depart(3, { level: "beginner", daysWanted: 5, daysReal: 3 }, [0, 0]), 2, "écart voulu/réel de 2 : prudent");
  assert.equal(S.depart(2, { level: "beginner" }, [0, 0]), 2);
  assert.deepEqual(S.paliers(4, 2).map(p => p.seances), [2, 3, 4]);
  assert.equal(S.paliers(4, 2)[0].condition, "3 semaines à 90 % des séances faites"); assert.equal(S.paliers(4, 2).at(-1).condition, "objectif");
});

test("régularité prouvée : 3 semaines à 90 % des séances faites", () => {
  const w = (...c) => c.map(([prevu, fait]) => ({ prevu, fait }));
  assert.equal(S.regulariteProuvee(w([3, 3], [3, 3], [3, 3])).ok, true);
  assert.equal(S.regulariteProuvee(w([3, 3], [3, 2], [3, 3])).ok, false, "2 sur 3 = 67 %");
  assert.equal(S.regulariteProuvee(w([10, 9], [10, 9], [10, 9])).ok, true, "90 % pile");
  const peu = S.regulariteProuvee(w([3, 3], [3, 3])); assert.equal(peu.ok, false); assert.match(peu.raison, /encore 1 semaine pour juger/);
  assert.equal(S.regulariteProuvee(w([3, 0], [3, 3], [3, 3], [3, 3])).ok, true, "seules les 3 dernières comptent");
  assert.equal(S.regulariteProuvee([]).ok, false); assert.equal(S.regulariteProuvee(w([0, 0], [0, 0], [0, 0])).ok, false, "rien de prévu : rien de prouvé");
});

// ---------- Adéquation à l'objectif (spec §8.1) ----------
const objectif = (a) => { const p = prog({ daysWanted: 2, daysReal: 2, style: "hautbas", sessionMin: 90, ...a }); return S.controlesObjectif(G.generer(p), p.answers); };
test("force : message exact de la spec quand le mouvement visé n'est fait qu'une fois par semaine", () => {
  const c = objectif({ goal: "strength", target: "100 kg au développé couché" });
  assert.ok(c.some(x => x.niveau === "alerte" && x.texte.startsWith("Tu vises la force au développé couché mais tu ne fais qu'une séance de PH par semaine.")), JSON.stringify(c));
  const bien = S.controlesObjectif(G.generer(prog({ goal: "strength", target: "100 kg au développé couché", daysWanted: 4, daysReal: 4, materiel: ["salle_complete"] })), { goal: "strength", target: "100 kg au développé couché" });
  assert.ok(bien.every(x => x.niveau !== "alerte"), "deux séances de PH : pas d'alerte");
});
test("objectifs : muscle, perte de gras, santé, sport, reprise", () => {
  assert.ok(S.controlesObjectif(G.generer(prog({ goal: "muscle", priorities: ["pecs"] })), { goal: "muscle" }).some(x => /volume renforcé sur PH/.test(x.texte)));
  const fat = objectif({ goal: "fat" }); assert.ok(fat.some(x => /squelette est gardé/.test(x.texte)) && fat.some(x => /déficit calorique/.test(x.texte)));
  assert.ok(objectif({ goal: "health" }).some(x => /8 mouvements de base/.test(x.texte)));
  assert.ok(objectif({ goal: "sport" }).some(x => /Sport/.test(x.texte)));
  assert.ok(objectif({ goal: "restart", level: "comeback", daysWanted: 3, daysReal: 3, style: "any" }).some(x => x.niveau === "ok" && /Reprise/.test(x.texte)));
  assert.ok(objectif({ goal: "fat" }).length <= 3, "trois messages au plus");
});
test("les contrôles du générateur affichent l'adéquation à l'objectif", () => {
  const p = G.generer(prog({ goal: "strength", target: "squat 140 kg", daysWanted: 2, daysReal: 2, style: "hautbas" }));
  assert.ok(p.controles.some(c => /Tu vises la force au squat/.test(c.texte)));
});
