// « Je craque » : règles de réponse, déclencheurs, journal. Logique pure (js/crise.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/crise.js";

const tout = (r) => [r.titre, ...r.etapes, r.apres, r.rassure].join(" ");
const COMBIS = [];
for (const [envie] of [[null], ...C.ENVIES]) for (const [emotion] of [[null], ...C.EMOTIONS]) for (const [contexte] of [[null], ...C.CONTEXTES]) for (const [intensite] of C.INTENSITES) COMBIS.push({ envie, emotion, contexte, intensite });

test("toute combinaison donne une action concrète, la suite, et une phrase qui déculpabilise", () => {
  assert.ok(COMBIS.length > 1500);
  for (const c of COMBIS) {
    const r = C.reponse(c);
    assert.ok(r.titre && r.etapes.length >= 2, JSON.stringify(c));
    assert.equal(r.apres, C.APRES); assert.equal(r.rassure, C.RASSURE);
  }
});

test("aucun texte ne parle de suicide, de numéro d'urgence, de prière, ni de compensation à faire", () => {
  const interdits = /suicid|3114|\b15\b|\b112\b|pri(e|è)re|\bprier\b|rattrap|compense[rz]? (avec|par|en)|saute(r)? (un|le|ton) repas|brûle[rz]? |élimine[rz]? |mérite|faute|craqué par faiblesse|honte|coupable/i;
  for (const c of COMBIS) assert.ok(!interdits.test(tout(C.reponse(c)).replace(C.APRES, "")), JSON.stringify(c) + " → " + tout(C.reponse(c)));
  for (const [s] of C.SUITES) assert.ok(!interdits.test(C.cloture(s)), s);
  // La phrase « après » interdit explicitement le repas sauté, le jeûne et la séance de compensation
  assert.match(C.APRES, /Pas de repas sauté, pas de jeûne, pas de séance en plus pour compenser/);
});

test("aucun texte ne présume le genre de la personne", () => {
  // Adjectifs et participes qui s'accorderaient avec la personne (« un seul repas » parle du repas : autorisé)
  const accord = /\b(prête?|fatiguée?|assise?|contente?|fi(er|ère)|tentée?|motivée?|tout seul|toute seule|sûre? de toi)\b/i;
  for (const c of COMBIS) { const t = tout(C.reponse(c)); assert.ok(!accord.test(t), t); }
  for (const [s] of C.SUITES) assert.ok(!accord.test(C.cloture(s)), s);
  for (const liste of [C.ENVIES, C.EMOTIONS, C.CONTEXTES, C.INTENSITES, C.SUITES]) for (const [, l] of liste) assert.ok(!accord.test(l), l);
});

test("la faim passe avant tout : on mange quelque chose de précis et suffisant", () => {
  for (const contexte of [null, "maison", "soiree", "resto"]) for (const intensite of [1, 3, 5]) {
    const r = C.reponse({ emotion: "faim", contexte, intensite, envie: "sale" });
    assert.equal(r.cle, "manger"); assert.match(r.etapes.join(" "), /Mange maintenant quelque chose de précis et suffisant : deux tranches de pain/);
  }
  assert.match(C.reponse({ emotion: "faim" }).etapes.join(" "), /un yaourt ou un fromage blanc/);
});

test("moment partagé (soirée, restaurant) : on en profite en choisissant, repli sur le repas plaisir", () => {
  for (const c of [{ contexte: "soiree" }, { contexte: "resto", intensite: 5 }, { emotion: "fete", contexte: "maison" }]) {
    const r = C.reponse(c); assert.equal(r.cle, "plaisir"); assert.match(r.etapes.join(" "), /repas plaisir de la semaine/);
  }
  assert.match(C.reponse({ contexte: "soiree", envie: "alcool" }).etapes.join(" "), /verre d'eau avec chaque verre d'alcool/);
});

test("intensité : pause de 10 minutes en dessous du seuil, portion choisie à partir du seuil", () => {
  assert.equal(C.reponse({ intensite: 1 }).cle, "pause");
  assert.equal(C.reponse({ intensite: C.INTENSITE_FORTE - 1, contexte: "maison" }).cle, "pause");
  assert.equal(C.reponse({ intensite: C.INTENSITE_FORTE, contexte: "maison" }).cle, "portion");
  assert.equal(C.reponse({ intensite: 5 }).cle, "portion");
  assert.match(C.reponse({ intensite: 2 }).etapes[0], /10 minutes/);
  assert.match(C.reponse({ intensite: 5 }).etapes.join(" "), /une portion dans une assiette ou un bol, range le reste/);
  assert.equal(C.reponse({}).cle, "pause"); assert.equal(C.reponse().cle, "pause");
  assert.equal(C.reponse({ intensite: "abc" }).cle, "pause"); assert.equal(C.reponse({ intensite: 99 }).cle, "portion");
});

test("un conseil propre à l'émotion s'ajoute, sauf pour la faim", () => {
  assert.match(C.reponse({ emotion: "stress" }).etapes.at(-1), /respirations lentes/);
  assert.match(C.reponse({ emotion: "fatigue", intensite: 5 }).etapes.at(-1), /fatigue se déguise/);
  assert.match(C.reponse({ emotion: "tristesse" }).etapes.at(-1), /légitime/);
  assert.equal(C.reponse({ emotion: "faim" }).etapes.length, 3);
});

test("clôture : un message bienveillant pour chaque issue, rien pour une valeur inconnue", () => {
  for (const [s] of C.SUITES) assert.ok(C.cloture(s).length > 20);
  assert.match(C.cloture("plus"), /Un seul repas ne défait pas des semaines de régularité/);
  assert.equal(C.cloture("xx"), ""); assert.equal(C.cloture(), "");
});

test("tranches horaires, y compris après minuit", () => {
  assert.equal(C.tranche("07:30"), "matin"); assert.equal(C.tranche("12:00"), "midi"); assert.equal(C.tranche("16:45"), "aprem");
  assert.equal(C.tranche("21:59"), "soir"); assert.equal(C.tranche("22:00"), "nuit"); assert.equal(C.tranche("02:10"), "nuit"); assert.equal(C.tranche("04:59"), "nuit"); assert.equal(C.tranche("05:00"), "matin");
  assert.equal(C.tranche(""), null); assert.equal(C.tranche(undefined), null); assert.equal(C.tranche("midi"), null);
});

test("déclencheurs : rien avant 3 envies décrites, anciennes notes ignorées", () => {
  assert.equal(C.declencheurs([]), null); assert.equal(C.declencheurs(), null);
  assert.equal(C.declencheurs([{ d: "2026-11-01", note: "ancienne" }, { d: "2026-11-02", note: "ancienne" }, { d: "2026-11-03", note: "x" }, { d: "2026-11-04", note: "y" }]), null);
  assert.equal(C.declencheurs([{ d: "2026-11-01", t: "21:00", emotion: "stress" }, { d: "2026-11-02", t: "21:30", emotion: "stress" }]), null);
});

test("déclencheurs : heure, émotion et contexte dominants, avec un plan préventif", () => {
  const j = [
    { d: "2026-11-01", note: "ancienne note" },
    { d: "2026-11-02", t: "21:10", emotion: "fatigue", contexte: "maison", intensite: 4 },
    { d: "2026-11-04", t: "20:40", emotion: "fatigue", contexte: "maison", intensite: 3 },
    { d: "2026-11-05", t: "16:00", emotion: "stress", contexte: "travail", intensite: 2 },
    { d: "2026-11-08", t: "21:50", emotion: "fatigue", contexte: "maison", intensite: 5 },
  ];
  const d = C.declencheurs(j);
  assert.equal(d.n, 4); assert.deepEqual(d.tranche, { cle: "soir", n: 3 }); assert.deepEqual(d.emotion, { cle: "fatigue", n: 3 }); assert.deepEqual(d.contexte, { cle: "maison", n: 3 });
  assert.deepEqual(d.constats, ["3 fois sur 4, c'est le soir", "3 fois sur 4 : fatigue", "3 fois sur 4 : à la maison"]);
  assert.equal(d.plan.length, 3); assert.match(d.plan[1], /protège ton sommeil/);
});

test("déclencheurs : pas de conclusion quand rien ne domine", () => {
  const d = C.declencheurs([{ d: "1", t: "08:00", emotion: "stress" }, { d: "2", t: "13:00", emotion: "ennui" }, { d: "3", t: "21:00", emotion: "fatigue" }]);
  assert.equal(d.n, 3); assert.equal(d.tranche, null); assert.equal(d.emotion, null); assert.deepEqual(d.plan, []);
});

test("entrée du journal : valeurs inconnues écartées, note limitée à 200 caractères", () => {
  const e = C.entree({ d: "2026-11-13", t: "18:05", envie: "sucre", emotion: "<script>", contexte: "maison", intensite: 9, note: "  " + "a".repeat(300) });
  assert.deepEqual({ ...e, note: undefined }, { d: "2026-11-13", t: "18:05", envie: "sucre", emotion: null, contexte: "maison", intensite: 5, note: undefined });
  assert.equal(e.note.length, 200);
  assert.ok(!("note" in C.entree({ d: "2026-11-13", t: "18:05", note: "   " })));
  assert.equal(C.entree({ d: "x", t: "y" }).intensite, 3);
});

test("résumé d'une entrée, ancienne note comprise", () => {
  assert.equal(C.resume({ d: "2026-11-13", t: "18:05", envie: "sucre", emotion: "stress", contexte: "travail", intensite: 4, suite: "portion" }), "18:05 · Stress · Au travail · Sucré · intensité 4/5 · J'ai pris une portion");
  assert.equal(C.resume({ d: "2026-11-01", note: "ancienne" }), "");
});

test("la ligne d'écoute est un numéro français non surtaxé (09), jamais le 3114", () => { assert.match(C.LIGNE_ECOUTE, /^09 \d{2} \d{3} \d{3}$/); });
