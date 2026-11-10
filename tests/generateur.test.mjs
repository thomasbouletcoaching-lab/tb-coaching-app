// Tests du générateur de programme : node --test tests/generateur.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";
import * as P from "../js/programme.js";
import * as G from "../js/generateur.js";

X.setExercices(JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex);
const codes = X.PATTERNS.map(p => p.code);
const base = { goal: "muscle", level: "regular", materiel: ["salle_complete"], daysWanted: 4, daysReal: 4, sessionMin: 75, zones: [], style: "any" };
const mk = (a = {}, prefs = {}) => ({ answers: { ...base, ...a }, prefs });
const sess = (p) => p.sessions, tousItems = (p) => p.sessions.flatMap(s => s.items);
const sqPat = (p, c) => tousItems(p).filter(l => l.pattern === c && l.couche === "squelette");

test("déterministe : mêmes réponses, même proposition ; une autre variante change des exercices", () => {
  assert.deepEqual(G.generer(mk()), G.generer(mk()));
  assert.notDeepEqual(tousItems(G.generer(mk(), { seed: 1 })).map(l => l.slug), tousItems(G.generer(mk(), { seed: 0 })).map(l => l.slug));
});

test("de 2 à 6 séances : bon nombre de séances, jours distincts, les 8 patterns présents dans la semaine", () => {
  for (let n = 2; n <= 6; n++) for (const style of ["any", "fullbody", "hautbas", "ppl"]) {
    const p = G.generer(mk({ daysWanted: n, daysReal: n, style }));
    assert.equal(sess(p).length, n, `${n} séances, style ${style}`);
    assert.equal(new Set(sess(p).map(s => s.dow)).size, n);
    assert.equal(p.jours.filter(Boolean).length, n);
    for (const c of codes) assert.ok(sqPat(p, c).length >= 1, `${c} absent (${n} séances, ${style})`);
  }
});

test("structure : haut/bas à 4, pousser/tirer/jambes à 6, corps entier à 2", () => {
  assert.deepEqual(sess(G.generer(mk({ daysWanted: 4, daysReal: 4 }))).map(s => s.titre), ["Haut du corps A", "Bas du corps A", "Haut du corps B", "Bas du corps B"]);
  assert.deepEqual(sess(G.generer(mk({ daysWanted: 6, daysReal: 6 }))).map(s => s.titre), ["Pousser A", "Tirer A", "Jambes A", "Pousser B", "Tirer B", "Jambes B"]);
  const f2 = G.generer(mk({ daysWanted: 2, daysReal: 2 }));
  for (const s of sess(f2)) assert.equal(new Set(s.items.filter(l => l.couche === "squelette").map(l => l.pattern)).size, 8, "les 8 patterns à chaque séance");
  const haut = G.generer(mk({ daysWanted: 4, daysReal: 4 }));
  assert.ok(haut.sessions[0].items.filter(l => l.couche === "squelette").every(l => ["PH", "PV", "TH", "TV"].includes(l.pattern)));
  assert.ok(haut.sessions[1].items.filter(l => l.couche === "squelette").every(l => ["SG", "SH", "CH", "FG"].includes(l.pattern)));
});

test("séances voulues > tenables : on construit sur les tenables et on l'explique", () => {
  const p = G.generer(mk({ daysWanted: 5, daysReal: 3 }));
  assert.equal(p.n, 3);
  assert.ok(p.controles.some(c => c.niveau === "info" && /5 séances mais en tiens 3/.test(c.texte)));
  assert.equal(p.profil.sousCapacite, true);
});

test("volume par pattern dans les fourchettes de la spec (3 à 6 / 6 à 10 / 8 à 14 / 3 à 5 si peu de temps)", () => {
  const inter = G.seriesParPattern({ level: "regular", sessionMin: 60 }, 4);
  codes.forEach(c => assert.ok(inter[c].sets >= 6 && inter[c].sets <= 10, c));
  const deb = G.seriesParPattern({ level: "beginner", sessionMin: 60 }, 3);
  codes.forEach(c => assert.ok(deb[c].sets >= 3 && deb[c].sets <= 6, c));
  const av = G.seriesParPattern({ level: "advanced", sessionMin: 60 }, 5);
  codes.forEach(c => assert.ok(av[c].sets >= 8 && av[c].sets <= 14, c));
  const court = G.seriesParPattern({ level: "regular", sessionMin: 30 }, 3);
  codes.forEach(c => assert.ok(court[c].sets >= 3 && court[c].sets <= 5, c));
});

test("priorités et points faibles : plus de séries, justifiées et affichées", () => {
  const sp = G.seriesParPattern({ level: "regular", sessionMin: 60, priorities: ["pecs", "dos"], weak: ["FG"] }, 4);
  assert.equal(sp.PH.sets, 10); assert.equal(sp.TH.sets, 10); assert.equal(sp.FG.sets, 10);
  assert.equal(sp.SG.sets, 8);
  assert.ok(sp.PH.why.join().includes("priorité pecs") && sp.FG.why.includes("point faible"));
  const p = G.generer(mk({ priorities: ["pecs"], weak: ["FG"] }));
  assert.ok(p.controles.some(c => c.niveau === "info" && /Déséquilibre voulu/.test(c.texte) && /PH/.test(c.texte) && /FG/.test(c.texte)));
});

test("matériel : à la maison avec haltères, tout reste faisable, y compris flexion de genou et tirage vertical", () => {
  const p = G.generer(mk({ materiel: ["halteres_maison", "poids_du_corps", "elastique", "barre_traction"], level: "beginner", daysWanted: 3, daysReal: 3 }));
  const ok = new Set(["halteres_maison", "poids_du_corps", "elastique", "barre_traction"]);
  tousItems(p).forEach(l => { const e = X.exercice(l.slug); assert.ok(e.materiel.some(m => ok.has(m)), `${l.nom} demande autre chose`); });
  for (const c of codes) assert.ok(sqPat(p, c).length >= 1, `${c} absent à la maison`);
  const nu = G.generer(mk({ materiel: ["poids_du_corps"], level: "beginner", daysWanted: 3, daysReal: 3 }));
  assert.ok(sqPat(nu, "FG").length >= 1, "flexion de genou au poids du corps");
  assert.ok(nu.avertissements.some(w => /TV/.test(w)) && nu.semaine.TV.absent, "tirage vertical impossible sans barre ni élastique : signalé");
  assert.ok(nu.controles.some(c => c.niveau === "alerte" && /TV/.test(c.texte)));
});

test("gênes : aucun exercice déconseillé pour une zone gênée, jamais", () => {
  for (const zones of [["genou"], ["epaule", "poignet"], ["bas_du_dos", "hanche"]]) {
    const p = G.generer(mk({ zones, daysWanted: 5, daysReal: 5 }));
    tousItems(p).forEach(l => assert.ok(!X.exercice(l.slug).contre_indications.some(z => zones.includes(z)), `${l.nom} gêne ${zones}`));
  }
});

test("favoris et détestés : un adoré passe en tête, un détesté n'apparaît jamais", () => {
  const p0 = G.generer(mk({ daysWanted: 3, daysReal: 3 }));
  const hate = tousItems(p0).filter(l => l.couche === "squelette").slice(0, 3).map(l => l.slug);
  const p1 = G.generer(mk({ daysWanted: 3, daysReal: 3 }, Object.fromEntries(hate.map(s => [s, "hate"]))));
  tousItems(p1).forEach(l => assert.ok(!hate.includes(l.slug), l.nom));
  const p2 = G.generer(mk({ daysWanted: 3, daysReal: 3 }, { "front-squat": "love", "hack-squat-machine": "love" }));
  assert.ok(tousItems(p2).some(l => l.slug === "front-squat" || l.slug === "hack-squat-machine"));
});

test("niveau : un débutant n'a que des exercices débutants quand il y en a ; pas de pattern sans exercice", () => {
  const p = G.generer(mk({ level: "beginner", daysWanted: 3, daysReal: 3 }));
  tousItems(p).filter(l => l.couche === "squelette").forEach(l => assert.equal(X.exercice(l.slug).niveau, "debutant", l.nom));
  assert.ok(codes.every(c => !p.semaine[c].absent));
});

test("récupération : l'écart entre deux séances d'un même pattern respecte 48 h (72 h pour une charnière lourde)", () => {
  for (let n = 2; n <= 6; n++) for (const style of ["any", "fullbody", "hautbas", "ppl"]) {
    const p = G.generer(mk({ daysWanted: n, daysReal: n, style, level: "advanced" }));
    assert.ok(!p.controles.some(c => c.niveau === "alerte" && /Récupération/.test(c.texte)), `${n} séances, ${style} : ${p.controles.map(c => c.texte).join(" | ")}`);
    const jours = {}; sess(p).forEach(s => s.items.filter(l => l.couche === "squelette").forEach(l => { (jours[l.pattern] = jours[l.pattern] || new Set()).add(s.dow); }));
    for (const [c, d] of Object.entries(jours)) { const t = [...d].sort((a, b) => a - b); for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 2, `${c} deux jours de suite (${n}, ${style})`); }
  }
});

test("temps : aucune séance ne dépasse la durée choisie de plus de 10 %, pour plusieurs durées", () => {
  for (const sessionMin of [20, 30, 45, 60, 90]) for (const n of [2, 3, 4, 5]) {
    const p = G.generer(mk({ sessionMin, daysWanted: n, daysReal: n }));
    p.sessions.forEach(s => assert.ok(s.minutes <= sessionMin * 1.1 + 1 || p.avertissements.length > 0, `${s.titre} ${s.minutes} min pour ${sessionMin}`));
    for (const c of codes) assert.ok(sqPat(p, c).length >= 1, `${c} perdu avec ${sessionMin} min`);
  }
  const court = G.generer(mk({ sessionMin: 30, daysWanted: 3, daysReal: 3 }));
  assert.ok(court.sessions.every(s => s.minutes <= 33), court.sessions.map(s => s.minutes).join());
});

test("le squelette passe avant l'isolation : sans temps, pas d'isolation ; avec du temps, présente selon l'objectif", () => {
  const court = G.generer(mk({ sessionMin: 20, daysWanted: 3, daysReal: 3 }));
  assert.equal(tousItems(court).filter(l => l.couche === "isolation").length, 0);
  assert.ok(court.avertissements.some(w => /Pas de place/.test(w)));
  const moyen = G.generer(mk({ sessionMin: 30, daysWanted: 3, daysReal: 3 }));
  moyen.sessions.forEach(s => assert.ok(s.minutes <= 31, "l'isolation n'entre que s'il reste du temps : " + s.minutes));
  const long = G.generer(mk({ sessionMin: 90, daysWanted: 4, daysReal: 4, goal: "muscle", priorities: ["bras"] }));
  const cats = new Set(tousItems(long).filter(l => l.couche === "isolation").map(l => l.categorie));
  assert.ok(cats.has("biceps") && cats.has("triceps") && cats.has("elevations_laterales"));
  const force = G.generer(mk({ sessionMin: 90, goal: "strength" }));
  assert.ok(!tousItems(force).some(l => l.categorie === "biceps"));
});

test("objectif force : répétitions basses ; hypertrophie : 8 à 12 ; débutant : RPE 7 ; sous-capacité : RPE plafonné", () => {
  const f = tousItems(G.generer(mk({ goal: "strength" }))).find(l => l.kind === "F");
  assert.ok(f.lo >= 3 && f.hi <= 6, `${f.nom} ${f.lo}-${f.hi}`);
  const m = tousItems(G.generer(mk({ goal: "muscle" }))).find(l => l.kind === "P");
  assert.deepEqual([m.lo, m.hi], [8, 12]);
  tousItems(G.generer(mk({ level: "beginner" }))).filter(l => l.rpe).forEach(l => assert.equal(l.rpe, 7));
  tousItems(G.generer(mk({ level: "advanced", quits: "3" }))).filter(l => l.rpe).forEach(l => assert.ok(l.rpe <= 7.5));
});

test("fatigue et travail physique : volume allégé", () => {
  const norm = G.seriesParPattern({ level: "regular", sessionMin: 60 }, 4), fat = G.seriesParPattern({ level: "regular", sessionMin: 60, sleep: "5", work: "physical" }, 4);
  assert.equal(fat.SG.sets, norm.SG.sets - 2); assert.equal(fat.PH.sets, norm.PH.sets - 1);
});

test("modules : mobilité de cheville si la cheville bloque, cardio en suggestion", () => {
  const p = G.generer(mk({ ankle: "limited", goal: "fat", sessionMin: 90 }));
  assert.ok(tousItems(p).some(l => /cheville/i.test(l.nom) && l.kind === "M" && l.unite === "s"));
  assert.ok(p.suggestions.some(t => /Cardio/.test(t)));
});

test("remplacer : même pattern, séries conservées, contrôles recalculés, pas de doublon dans la séance", () => {
  const prog = mk({ daysWanted: 3, daysReal: 3 }), p = G.generer(prog);
  const si = 0, li = p.sessions[si].items.findIndex(l => l.couche === "squelette");
  const l0 = p.sessions[si].items[li];
  const alts = G.alternativesLigne(p, prog, si, li, P.alternativesPour);
  assert.ok(alts.length >= 2 && alts.every(e => e.pattern_principal === l0.pattern && e.slug !== l0.slug));
  assert.ok(!alts.some(e => p.sessions[si].items.some(x => x.slug === e.slug)));
  const q = G.remplacerLigne(p, prog, si, li, alts[0].slug);
  assert.equal(q.sessions[si].items[li].slug, alts[0].slug); assert.equal(q.sessions[si].items[li].n, l0.n);
  assert.equal(p.sessions[si].items[li].slug, l0.slug, "la proposition d'origine n'est pas modifiée");
  assert.ok(q.controles.length && q.sessions[si].minutes > 0);
});

test("format du moteur : séances [titre, jour, lignes], séries en tableau, jours alignés sur les séances", () => {
  const p = G.generer(mk({ daysWanted: 4, daysReal: 4 })), prog = G.versProgramme(p, { id: "gen-1" });
  assert.equal(prog.custom, true); assert.equal(prog.weeks, 12); assert.deepEqual(prog.deload, { every: 4 });
  assert.equal(prog.s.length, 4); assert.equal(prog.days.filter(Boolean).length, 4);
  const actifs = prog.days.map((on, i) => on ? G.DOW[i] : null).filter(Boolean);
  assert.deepEqual(prog.s.map(s => s[1]), actifs, "la k-ième séance tombe sur le k-ième jour actif");
  for (const [titre, jour, rows] of prog.s) {
    assert.ok(titre && G.DOW.includes(jour) && rows.length);
    for (const r of rows) { assert.equal(typeof r[0], "string"); assert.match(r[1], /^[FPICM]$/); assert.ok(Array.isArray(r[5].sets) && r[5].sets.length >= 1 && r[5].prog.load === "auto" && r[5].rest > 0); assert.ok(r[5].sets.every(s => s.t === "N" && s.lo <= s.hi && Array.isArray(s.tech))); }
  }
  assert.ok(prog.s.flatMap(s => s[2]).every(r => X.exercice(r[0])), "tous les noms sont ceux de la bibliothèque, donc de data/fiches.json");
});

test("durée estimée cohérente avec les repos", () => {
  assert.equal(G.minutesSeance([]), 8);
  assert.equal(G.minutesSeance([{ n: 3, rest: 120 }]), Math.round(8 + 3 * 160 / 60));
  assert.ok(G.enSecondes("Gainage planche") && !G.enSecondes("Pompes"));
});
