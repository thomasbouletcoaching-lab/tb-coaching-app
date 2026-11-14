// « Je craque » : règles de réponse, déclencheurs, journal. Logique pure (js/crise.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("aucun texte ne parle de suicide, de numéro d'urgence, de prière, d'alcool, ni de compensation à faire", () => {
  const interdits = /suicid|3114|pri(e|è)re|\bprier\b|alcool|rattrap|compense[rz]? (avec|par|en)|saute(r)? (un|le|ton) repas|brûle[rz]? |élimine[rz]? |mérite|faute|faiblesse|honte|coupable|paquet/i;
  for (const c of COMBIS) assert.ok(!interdits.test(tout(C.reponse(c)).replace(C.APRES, "")), JSON.stringify(c) + " → " + tout(C.reponse(c)));
  for (const [s] of C.SUITES) assert.ok(!interdits.test(C.cloture(s)), s);
  for (const liste of [C.ENVIES, C.EMOTIONS, C.CONTEXTES, C.INTENSITES, C.SUITES]) for (const [, l] of liste) assert.ok(!interdits.test(l), l);
  // La phrase « après » interdit explicitement le repas sauté, le jeûne et la séance de compensation
  assert.match(C.APRES, /Pas de repas sauté, pas de jeûne pour rattraper, pas de séance en plus pour compenser/);
});

test("le code des deux fichiers (hors commentaires) ne contient ni « suicide », ni 3114, ni prière : couvre aussi les textes de l'écran et du plan préventif", () => {
  for (const f of ["../js/crise.js", "../js/views/crise.js"]) {
    const code = readFileSync(new URL(f, import.meta.url), "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    assert.ok(!/suicid|3114|pri(e|è)re|\bprier\b|\b112\b|le 15\b/i.test(code), f);
  }
});

test("plan préventif : aucune phrase ne culpabilise, et les collations sont des exemples adaptables", () => {
  const cas = [];
  for (const [tr, , h] of C.TRANCHES) for (const [em] of C.EMOTIONS) for (const [co] of C.CONTEXTES) cas.push(Array.from({ length: 3 }, (_, k) => ({ d: "2026-11-0" + (k + 1), t: String(h % 24).padStart(2, "0") + ":30", emotion: em, contexte: co })));
  for (const j of cas) { const d = C.declencheurs(j); assert.equal(d.plan.length >= 1, true);
    for (const x of [...d.plan, ...d.constats]) assert.ok(!/honte|faute|faiblesse|coupable|mérite|rattrap|compens|jeûn/i.test(x), x); }
  for (const c of Object.values(C.COLLATION)) assert.match(c, /^par exemple .* selon ce que tu manges$/);
  assert.match(C.declencheurs(cas.find(j => j[0].t.startsWith("14")))?.plan[0] || "", /par exemple un laitage ou son équivalent végétal/);
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
    assert.equal(r.cle, "manger"); assert.match(r.etapes.join(" "), /Mange maintenant quelque chose de précis et suffisant : par exemple du pain avec du fromage, des œufs ou du houmous/);
  }
  assert.match(C.reponse({ emotion: "faim" }).etapes.join(" "), /par exemple un laitage ou son équivalent végétal/);
  assert.match(C.reponse({ emotion: "faim", envie: "gras" }).etapes.join(" "), /du pain avec du fromage/);
});

test("moment partagé (soirée, restaurant) : on en profite en choisissant, repli sur le repas plaisir", () => {
  for (const c of [{ contexte: "soiree" }, { contexte: "resto", intensite: 5 }, { emotion: "fete", contexte: "maison" }]) {
    const r = C.reponse(c); assert.equal(r.cle, "plaisir"); assert.match(r.etapes.join(" "), /Ce repas peut être ton repas plaisir : il a sa place dans ton plan/);
  }
  // Le conseil lié au ressenti ne s'ajoute pas ici : « attends 10 minutes » contredirait « profite du moment »
  for (const [emotion] of C.EMOTIONS) if (emotion !== "faim") assert.equal(C.reponse({ contexte: "resto", emotion }).etapes.length, 4, emotion);
  assert.ok(!C.ENVIES.some(e => e[0] === "alcool"), "l'alcool n'est pas une envie proposée");
  assert.equal(C.libelle.contexte("soiree"), "À une soirée, chez des amis");
});

test("intensité : pause de 10 minutes en dessous du seuil, portion choisie à partir du seuil", () => {
  assert.equal(C.reponse({ intensite: 1 }).cle, "pause");
  assert.equal(C.reponse({ intensite: C.INTENSITE_FORTE - 1, contexte: "maison" }).cle, "pause");
  assert.equal(C.reponse({ intensite: C.INTENSITE_FORTE, contexte: "maison" }).cle, "portion");
  assert.equal(C.reponse({ intensite: 5 }).cle, "portion");
  assert.match(C.reponse({ intensite: 2 }).etapes[0], new RegExp(C.PAUSE_MIN + " minutes"));
  assert.match(C.reponse({ intensite: 5 }).etapes.join(" "), /une portion dans une assiette ou un bol, range le reste/);
  assert.equal(C.reponse({}).cle, "pause"); assert.equal(C.reponse().cle, "pause"); assert.equal(C.reponse(null).cle, "pause");
  assert.equal(C.reponse({ intensite: "abc" }).cle, "pause"); assert.equal(C.reponse({ intensite: 0 }).cle, "pause"); assert.equal(C.reponse({ intensite: null }).cle, "pause"); assert.equal(C.reponse({ intensite: 99 }).cle, "portion");
});

test("le conseil lié au ressenti vient en premier, avant la décision, et seulement quand on propose d'attendre", () => {
  assert.match(C.reponse({ emotion: "stress" }).etapes[0], /respirations lentes/);
  assert.match(C.reponse({ emotion: "fatigue", intensite: 5 }).etapes[0], /fatigue se déguise/);
  assert.match(C.reponse({ emotion: "tristesse" }).etapes[0], /légitime/);
  assert.equal(C.reponse({ emotion: "stress" }).etapes.length, 3); assert.equal(C.reponse({}).etapes.length, 2);
  assert.equal(C.reponse({ emotion: "faim" }).etapes.length, 3);
});

test("clôture : un message bienveillant pour chaque issue, rien pour une valeur inconnue", () => {
  for (const [s] of C.SUITES) assert.ok(C.cloture(s).length > 20);
  assert.match(C.cloture("plus"), /Un repas ne défait pas ce que tu construis/);
  assert.equal(C.cloture("xx"), ""); assert.equal(C.cloture(), "");
});

test("tranches horaires, y compris après minuit", () => {
  assert.equal(C.tranche("07:30"), "matin"); assert.equal(C.tranche("12:00"), "midi"); assert.equal(C.tranche("16:45"), "aprem");
  assert.equal(C.tranche("21:59"), "soir"); assert.equal(C.tranche("22:00"), "nuit"); assert.equal(C.tranche("02:10"), "nuit"); assert.equal(C.tranche("04:59"), "nuit"); assert.equal(C.tranche("05:00"), "matin");
  assert.equal(C.tranche(""), null); assert.equal(C.tranche(undefined), null); assert.equal(C.tranche("midi"), null); assert.equal(C.tranche(["21:00"]), null); assert.equal(C.tranche(2100), null);
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

test("déclencheurs : pas de conclusion quand rien ne domine, ni à égalité", () => {
  const d = C.declencheurs([{ d: "1", t: "08:00", emotion: "stress" }, { d: "2", t: "13:00", emotion: "ennui" }, { d: "3", t: "21:00", emotion: "fatigue" }]);
  assert.equal(d.n, 3); assert.equal(d.tranche, null); assert.equal(d.emotion, null); assert.deepEqual(d.plan, []);
  const e = C.declencheurs([{ t: "21:00", emotion: "stress" }, { t: "21:10", emotion: "ennui" }, { t: "08:00", emotion: "stress" }, { t: "09:00", emotion: "ennui" }]);
  assert.equal(e.emotion, null); assert.equal(e.tranche, null);
});

test("un journal malformé (envoyé tel quel au coach) ne fait rien planter", () => {
  const sale = [null, 12, "x", [], { t: ["21:00"], emotion: { a: 1 }, contexte: "<img>" }, { t: 2100 }, { d: "2026-11-02", t: "21:10", emotion: "fatigue" }];
  assert.doesNotThrow(() => C.declencheurs(sale)); assert.equal(C.declencheurs("pas un tableau"), null); assert.equal(C.declencheurs({ length: 5 }), null);
  for (const x of sale) assert.equal(typeof C.resume(x), "string");
  assert.equal(C.resume({ t: ["21:00"], emotion: "<script>", contexte: "__proto__", envie: "constructor", suite: "toString" }), "");
});

test("entrée du journal : valeurs inconnues écartées, note limitée à 200 caractères, aucune donnée inventée", () => {
  const e = C.entree({ id: 42, d: "2026-11-13", t: "18:05", envie: "sucre", emotion: "<script>", contexte: "maison", intensite: 9, note: "  " + "a".repeat(300) });
  assert.deepEqual({ ...e, note: undefined }, { id: 42, d: "2026-11-13", t: "18:05", envie: "sucre", emotion: null, contexte: "maison", intensite: 5, note: undefined });
  assert.equal(e.note.length, 200);
  assert.ok(!("note" in C.entree({ d: "2026-11-13", t: "18:05", note: "   " })));
  assert.equal(C.entree({ d: "x", t: "y" }).intensite, null, "intensité non indiquée : elle reste vide");
  assert.equal(C.entree({ d: "x", t: "y", intensite: 0 }).intensite, null); assert.equal(C.entree({ d: "x", t: "y", envie: "alcool" }).envie, null);
});

test("résumé d'une entrée, ancienne note comprise", () => {
  assert.equal(C.resume({ d: "2026-11-13", t: "18:05", envie: "sucre", emotion: "stress", contexte: "travail", intensite: 4, suite: "portion" }), "18:05 · Stress · Au travail · Sucré · intensité 4/5 · J'ai pris une portion");
  assert.equal(C.resume({ d: "2026-11-01", note: "ancienne" }), "");
});

test("la ligne d'écoute est un numéro français non surtaxé (09), jamais le 3114", () => { assert.match(C.LIGNE_ECOUTE, /^09 \d{2} \d{3} \d{3}$/); });
