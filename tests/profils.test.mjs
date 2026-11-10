// Tests de la détection des profils : node --test tests/profils.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../js/profils.js";

const ids = (p) => p.map(x => x.id);

test("débutant : profil « Départ en confiance », pas de plancher imposé", () => {
  const p = P.detecter({ level: "beginner", goal: "fat" });
  assert.ok(ids(p).includes("depart") && ids(p).includes("silhouette"));
  assert.equal(P.plancher(p), null);
});

test("reprise durable : plusieurs arrêts, arrêt rapide ou reprise — nommé en positif, plancher de 2 séances de 20 min", () => {
  const p = P.detecter({ level: "comeback", goal: "muscle", quits: "5", quitAfter: "2", quitWhy: ["temps"] });
  assert.ok(ids(p).includes("durable"), ids(p).join());
  assert.equal(p.find(x => x.id === "durable").nom, "Reprise durable");
  assert.ok(!ids(p).includes("reprise"), "le parcours durable remplace la simple reprise");
  assert.deepEqual([P.plancher(p).seances, P.plancher(p).minutes], [2, 20]);
});

test("reprise simple : un retour après une pause sans arrêts répétés", () => {
  const p = P.detecter({ level: "comeback", goal: "health", quits: "0" });
  assert.ok(ids(p).includes("reprise") && !ids(p).includes("durable"));
});

test("avancé et stagnation : progression ciblée seulement si un mouvement stagne et que la personne n'est pas débutante", () => {
  assert.ok(ids(P.detecter({ level: "advanced" }, { stalls: 1 })).includes("progression"));
  assert.ok(ids(P.detecter({ level: "advanced" })).includes("maitrise"));
  assert.ok(!ids(P.detecter({ level: "beginner" }, { stalls: 3 })).includes("progression"), "un débutant qui n'avance pas n'a pas à être ciblé");
});

test("objectif de force chiffré : compétition ; santé après 40 ans : forme durable", () => {
  assert.ok(ids(P.detecter({ level: "advanced", goal: "strength", target: "100 kg au développé couché" })).includes("competition"));
  assert.ok(!ids(P.detecter({ level: "advanced", goal: "strength", target: "" })).includes("competition"));
  assert.ok(ids(P.detecter({ level: "regular", goal: "health" }, { age: 45 })).includes("forme"));
});

test("parent pressé : peu de temps et enfants ; plancher de 2 séances de 30 min pour l'organisé", () => {
  const p = P.detecter({ level: "regular", goal: "muscle", kids: "yes", sessionMin: 30 });
  assert.ok(ids(p).includes("organise"));
  assert.equal(P.plancher(p).minutes, 30);
  assert.ok(!ids(P.detecter({ level: "regular", kids: "yes", sessionMin: 90 })).includes("organise"), "enfants mais une séance longue : pas le profil");
});

test("emploi du temps et corps : rythme changeant avec trois blocs variables, travail physique", () => {
  assert.ok(ids(P.detecter({ level: "regular" }, { variables: 3 })).includes("rythme"));
  assert.ok(!ids(P.detecter({ level: "regular" }, { variables: 2 })).includes("rythme"));
  assert.ok(ids(P.detecter({ level: "regular", work: "physical" })).includes("corps"));
});

test("stress et sommeil : équilibre de vie", () => {
  assert.ok(ids(P.detecter({ level: "regular", stress: "high" })).includes("equilibre"));
  assert.ok(ids(P.detecter({ level: "regular", sleep: "5" })).includes("equilibre"));
  assert.ok(!ids(P.detecter({ level: "regular", sleep: "7.5", stress: "low" })).includes("equilibre"));
});

test("régularité : arrêts après une séance ratée (perfectionnisme), sport polyvalent", () => {
  assert.ok(ids(P.detecter({ level: "regular", quits: "1", quitWhy: ["perfectionnisme"] })).includes("regularite"));
  assert.ok(ids(P.detecter({ level: "regular", goal: "sport" })).includes("polyvalent"));
});

test("cumul et limite : plusieurs profils, au plus quatre affichés", () => {
  const p = P.detecter({ level: "comeback", goal: "fat", quits: "5", quitAfter: "2", kids: "yes", sessionMin: 30, stress: "high", work: "physical" }, { variables: 4, age: 50 });
  assert.ok(p.length >= 3 && p.length <= P.MAX_AFFICHES);
  assert.ok(new Set(ids(p)).size === p.length, "pas de doublon");
});

test("formulation : aucun nom ni phrase du catalogue ne juge la personne", () => {
  const mots = /yoyo|abandon|faible|échec|raté|paresse|nul|honte|mauvais|rate/i;
  for (const x of Object.values(P.CATALOGUE)) { assert.ok(!mots.test(x.nom), x.nom); assert.ok(!mots.test(x.phrase), x.phrase); }
  assert.ok(Object.values(P.CATALOGUE).every(x => x.nom && x.phrase.endsWith(".")));
});

test("mode « On reprend » : deux séances manquées sur 14 jours, sans séance aujourd'hui", () => {
  assert.equal(P.enReprise({ missed14: 2, doneToday: false }), true);
  assert.equal(P.enReprise({ missed14: 1, doneToday: false }), false);
  assert.equal(P.enReprise({ missed14: 5, doneToday: true }), false, "déjà une séance aujourd'hui : rien à reprendre");
  assert.equal(P.enReprise({}), false);
});

test("total des séances : ne baisse jamais", () => {
  assert.equal(P.totalSeances(12, 0), 12);
  assert.equal(P.totalSeances(9, 12), 12, "une séance supprimée ne fait pas reculer le total");
  assert.equal(P.totalSeances(15, 12), 15);
  assert.equal(P.totalSeances(undefined, undefined), 0);
});

test("plans « si… alors… » : défauts rédigés à l'avance, les réponses du membre gardées, valeurs nettoyées", () => {
  assert.equal(P.siAlorsDe([]).length, 3);
  assert.equal(P.siAlorsDe([]).every(x => /^Si /.test(x.si) && /^alors /.test(x.alors)), true);
  assert.deepEqual(P.siAlorsDe([{ si: "  Si je suis malade ", alors: "alors je marche" }, { si: "", alors: "x" }]), [{ si: "Si je suis malade", alors: "alors je marche" }]);
  assert.equal(P.siAlorsDe([{ si: "a".repeat(100), alors: "b" }])[0].si.length, 60);
});

test("coach : seuls les identifiants partent, jamais les réponses de santé", () => {
  const p = P.detecter({ level: "comeback", quits: "5", quitAfter: "2", zones: ["genou"], healthNote: "opéré" });
  const c = P.pourCoach(p);
  assert.deepEqual(Object.keys(c).sort(), ["at", "ids", "v"]);
  assert.ok(c.ids.every(x => typeof x === "string"));
  assert.ok(!JSON.stringify(c).includes("genou") && !JSON.stringify(c).includes("opéré"));
});

test("résumé lisible, y compris sans profil", () => {
  assert.equal(P.resume([]), "Ton profil se précisera au fil de tes séances.");
  assert.equal(P.resume([{ nom: "A" }, { nom: "B" }]), "A · B");
});
