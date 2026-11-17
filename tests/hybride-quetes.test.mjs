// Tests des quêtes, de l'XP, de la série, des rangs et des objets : node --test tests/hybride-quetes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as Q from "../js/hybride-quetes.js";

const D = JSON.parse(readFileSync(new URL("../data/hybride.json", import.meta.url), "utf8"));
const EX = JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex;
const exDe = (n) => EX.find(x => x.nom === n) || null;

// Bloc fictif : M1 à 3 séances (lundi, mercredi, vendredi) à partir du lundi 7 décembre 2026
const BLOC = { macroId: "M1", debut: "2026-12-07", nbSeances: 3 };
const set = (o = {}) => ({ done: true, reps: 5, kg: 60, ...o });
const seance = (d, exos, extra = {}) => ({ id: d + (extra.suffixe || ""), end: d + "T18:00:00Z", exercises: exos, ...extra });
const complete = (d, extra) => seance(d, [
  { name: "Squat barre", sets: [set({ type: "W" }), set(), set(), set()] },
  { name: "Rotation externe élastique", sets: [set(), set(), set()] },
], extra);
const etat = (workouts, o = {}) => ({ workouts, daily: o.daily || {}, hybride: { bloc: BLOC, tests: o.tests || [], pauses: o.pauses || {} } });
const J = (workouts, o) => Q.journalDepuisEtat(D, etat(workouts, o), exDe);

test("catalogue : quêtes de jour, de semaine, de bloc, de skills et boss ; textes sans accord de genre", () => {
  const types = new Set(D.quetes.map(q => q.type));
  for (const t of ["jour", "semaine", "bloc", "skill", "boss"]) assert.ok(types.has(t), t);
  for (const q of D.quetes) assert.doesNotMatch(q.titre, /\b(prêt|prête|motivé|fatigué|seul|seule)\b/i, q.id);
  assert.deepEqual(D.rangs.map(r => r.nom), ["Bronze", "Argent", "Or", "Platine", "Diamant", "Maître"]);
  for (let i = 1; i < D.rangs.length; i++) assert.ok(D.rangs[i].min > D.rangs[i - 1].min);
});

test("adaptateur : échauffement, petits muscles, douleur, fatigue, zone 2, sans rien modifier", () => {
  const w = [complete("2026-12-07"), seance("2026-12-09", [{ name: "Squat barre", sets: [set({ pain: true })] }]), seance("2026-12-11", [{ name: "Vélo zone 2", sets: [set({ min: 30 })] }])];
  const st = etat(w, { daily: { "2026-12-11": { feel: { energy: 2 } } } });
  const avant = JSON.stringify(st);
  const j = Q.journalDepuisEtat(D, st, exDe);
  assert.equal(JSON.stringify(st), avant, "l'état n'est pas modifié");
  assert.ok(j.seances[0].echauffement); assert.equal(j.seances[0].prevention, 3);
  assert.ok(j.seances[1].douleur);
  assert.ok(j.seances[2].fatigue); assert.equal(j.seances[2].z2Min, 30);
  assert.ok(j.jours["2026-12-11"].forme);
});

test("XP : séance, technique, forme ; jamais pour une séance faite malgré une douleur ou une fatigue", () => {
  const w = [complete("2026-12-07"), complete("2026-12-09", { suffixe: "b" }), complete("2026-12-11", { suffixe: "c" })];
  w[1].exercises[0].sets[1].pain = true;
  const j = J(w, { daily: { "2026-12-11": { feel: { energy: 3 } }, "2026-12-07": { feel: { energy: 8 } } } });
  const ev = Q.evenements(D, j, "2026-12-13");
  const seances = ev.filter(e => e.source === "regularite").map(e => e.d);
  assert.deepEqual(seances, ["2026-12-07"]);
  assert.ok(ev.some(e => e.cle === "complete:2026-12-07"));
  assert.ok(!ev.some(e => e.d === "2026-12-09" && e.source !== "recuperation"));
  assert.ok(ev.some(e => e.cle === "forme:2026-12-11"), "noter sa forme rapporte, même un jour de fatigue");
  assert.ok(ev.every(e => e.xp > 0 && ["regularite", "technique", "recuperation", "decharge", "test", "record", "quete"].includes(e.source)));
});

test("XP : jamais pour le volume brut (20 séries ou 3 séries : même XP)", () => {
  const gros = seance("2026-12-07", [{ name: "Squat barre", sets: Array.from({ length: 20 }, () => set()) }]);
  const petit = seance("2026-12-07", [{ name: "Squat barre", sets: [set(), set(), set()] }]);
  const xp = (w) => Q.evenements(D, J([w]), "2026-12-08").reduce((t, e) => t + e.xp, 0);
  assert.equal(xp(gros), xp(petit));
});

test("XP : idempotent (même journal → mêmes clés), records plafonnés par séance", () => {
  const w = [complete("2026-12-07", { records: [{}, {}, {}, {}] })];
  const a = Q.evenements(D, J(w), "2026-12-20"), b = Q.evenements(D, J(JSON.parse(JSON.stringify(w))), "2026-12-20");
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map(e => e.cle)).size, a.length, "aucune clé en double");
  assert.equal(a.filter(e => e.source === "record").length, D.xp.recordsMaxParSeance);
  assert.ok(Q.evenements(D, J(w), "2026-12-06").length === 0, "rien dans le futur");
});

test("quêtes de semaine : séances prévues (pause déduite), zone 2, skills, prévention", () => {
  const mu = complete("2026-12-09", { suffixe: "b" });
  mu.exercises.push({ name: "Muscle-up strict", sets: [set({ reps: 2 }), set({ reps: 2 }), set({ reps: 2 })] });
  const w = [complete("2026-12-07"), mu];
  const daily = { "2026-12-12": { cardio: [{ n: "Vélo zone 2", min: 30 }] } };
  const sans = Q.reussites(D, J(w, { daily }), "2026-12-13").map(r => r.id);
  assert.ok(!sans.includes("seances-prevues"), "vendredi prévu et pas fait : 2 séances sur 3");
  const j = J(w, { daily, pauses: { "2026-12-11": "imprevu" } });
  const ids = Q.reussites(D, j, "2026-12-13").map(r => r.id);
  for (const id of ["seances-prevues", "zone-2", "skills", "prevention", "seance-du-jour", "skill-muscleup"]) assert.ok(ids.includes(id), id);
  const enCours = Q.quetesDuMoment(D, j, "2026-12-13");
  assert.equal(enCours.find(q => q.id === "seances-prevues").sur, 2);
  assert.equal(enCours.find(q => q.id === "skill-muscleup").prochain, "Muscle-up strict 3 × 3");
});

test("zone 2 notée dans la routine : vélo compté, fractionné non", () => {
  const ok = Q.reussites(D, J([], { daily: { "2026-12-08": { cardio: [{ n: "Vélo", min: 40 }] } } }), "2026-12-13");
  assert.ok(ok.some(r => r.id === "zone-2"));
  const non = Q.reussites(D, J([], { daily: { "2026-12-08": { cardio: [{ n: "Vélo fractionné", min: 40 }] } } }), "2026-12-13");
  assert.ok(!non.some(r => r.id === "zone-2"));
});

test("bloc : mésocycle terminé et décharge faite (volume réduit), seulement une fois la semaine passée", () => {
  const w = [];
  for (let k = 0; k < 4; k++) for (const j of [0, 2, 4]) {
    const d = new Date(Date.UTC(2026, 11, 7 + k * 7 + j)).toISOString().slice(0, 10);
    const n = k === 3 ? 2 : 5;
    w.push(seance(d, [{ name: "Squat barre", sets: Array.from({ length: n }, () => set()) }]));
  }
  assert.ok(!Q.reussites(D, J(w), "2027-01-03").some(r => r.id === "meso-termine"), "pas avant la fin de la semaine 4");
  const ids = Q.reussites(D, J(w), "2027-01-04").map(r => r.id);
  assert.ok(ids.includes("meso-termine")); assert.ok(ids.includes("decharge"));
  const ev = Q.evenements(D, J(w), "2027-01-04");
  assert.equal(ev.find(e => e.cle.startsWith("quete:decharge")).xp, D.xp.decharge);
  assert.equal(ev.find(e => e.cle.startsWith("quete:decharge")).source, "decharge");
  const plein = w.map(x => x.end.startsWith("2026-12-2") || x.end.startsWith("2026-12-30") || x.end.startsWith("2027-01-01") ? { ...x, exercises: [{ name: "Squat barre", sets: Array.from({ length: 5 }, () => set()) }] } : x);
  assert.ok(!Q.reussites(D, J(plein), "2027-01-04").some(r => r.id === "decharge"), "semaine 4 à plein volume : pas de décharge");
});

test("boss : tous les tests de fin de macro notés en semaine 12", () => {
  const tests = [{ d: "2027-02-23", type: "vma" }, { d: "2027-02-25", type: "5rm" }];
  assert.ok(Q.reussites(D, J([], { tests }), "2027-02-28").some(r => r.id === "boss"));
  assert.ok(!Q.reussites(D, J([], { tests: tests.slice(0, 1) }), "2027-02-28").some(r => r.id === "boss"));
  const ev = Q.evenements(D, J([], { tests }), "2027-02-28");
  assert.equal(ev.filter(e => e.source === "test").length, 2);
});

test("série tolérante : grâce, pause, repos prévu ; retour positif après une absence", () => {
  const w = ["2026-12-07", "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-18"].map(d => complete(d, { suffixe: d }));
  // Le mercredi 16 est manqué : une grâce par semaine, la série tient
  const s = Q.serie(D, J(w), "2026-12-19");
  assert.equal(s.jours, 13); assert.equal(s.graceRestante, 0); assert.equal(s.retour, false);
  // Deux séances manquées dans la même semaine : la série repart
  const s2 = Q.serie(D, J(w.slice(0, 4)), "2026-12-19");
  assert.ok(s2.jours < 13);
  // Avec une pause « mauvaise nuit » déclarée le 18, rien n'est perdu
  const s3 = Q.serie(D, J(w.slice(0, 4), { pauses: { "2026-12-18": "nuit" } }), "2026-12-19");
  assert.equal(s3.jours, 13);
  // Longue absence : accueil positif, aucun reproche
  const r = Q.serie(D, J(w), "2027-01-05");
  assert.equal(r.retour, true); assert.match(r.message, /On reprend/);
  assert.doesNotMatch(r.message, /dommage|perdu|raté|échou|honte|encore/i);
  assert.ok(r.record >= 13, "le record est gardé");
});

test("série : la semaine de décharge ne casse pas la série", () => {
  const w = [];
  for (const d of ["2026-12-07", "2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18", "2026-12-21", "2026-12-23", "2026-12-25", "2027-01-04"]) w.push(complete(d, { suffixe: d }));
  const s = Q.serie(D, J(w), "2027-01-04"); // semaine 4 (28/12 → 3/1) sans aucune séance : décharge
  assert.equal(s.jours, 29);
});

test("rangs et objets : seuils, jamais de régression", () => {
  assert.equal(Q.rang(D, 0).id, "bronze");
  assert.equal(Q.rang(D, 299).reste, 1);
  assert.equal(Q.rang(D, 900).id, "or");
  assert.equal(Q.rang(D, 99999).suivant, null);
  const o1 = Q.debloques(D, { xp: 950, quetes: ["zone-2"], serieRecord: 8 });
  for (const id of ["tenue-base", "tenue-argent", "tenue-or", "decor-piste", "bandeau"]) assert.ok(o1.includes(id), id);
  assert.ok(!o1.includes("tenue-platine"));
  const o2 = Q.debloques(D, { xp: 0, quetes: [], serieRecord: 0 }, o1);
  for (const id of o1) assert.ok(o2.includes(id), `jamais repris : ${id}`);
  const inconnu = Q.debloques(D, {}, ["objet-ancien"]);
  assert.ok(inconnu.includes("objet-ancien"), "un objet d'une ancienne version reste aussi");
});

test("bilan : XP totale = somme des événements, le tout sans erreur sur un journal vide", () => {
  const vide = Q.bilan(D, Q.journalDepuisEtat(D, {}, exDe), "2026-12-07");
  assert.equal(vide.xp, 0); assert.equal(vide.rang.id, "bronze"); assert.equal(vide.serie.jours, 0);
  const b = Q.bilan(D, J([complete("2026-12-07")]), "2026-12-07");
  assert.equal(b.xp, b.evenements.reduce((t, e) => t + e.xp, 0));
  assert.ok(b.quetes.some(q => q.id === "seance-du-jour" && q.reussie));
});

// ---------- Corrections de la relecture indépendante (session 2) ----------
const xpTotal = (j, auj) => Q.evenements(D, j, auj).reduce((t, e) => t + e.xp, 0);
const cles = (j, auj) => new Set(Q.evenements(D, j, auj).map(e => e.cle));
const mois = () => { const w = []; for (let k = 0; k < 12; k++) for (const j of [0, 2, 4]) { const d = new Date(Date.UTC(2026, 11, 7 + k * 7 + j)).toISOString().slice(0, 10); w.push(complete(d, { suffixe: d })); } return w; };
const avecBloc = (w, bloc, o = {}) => Q.journalDepuisEtat(D, { workouts: w, daily: o.daily || {}, hybride: { bloc, tests: o.tests || [], pauses: o.pauses || {} } }, exDe);

test("changer de bloc ne redonne pas l'XP des quêtes de bloc (fenêtres fixes)", () => {
  const w = mois(), auj = "2027-03-08";
  const a = cles(avecBloc(w, BLOC), auj);
  for (const b of [{ ...BLOC, debut: "2026-12-14" }, { ...BLOC, macroId: "M2" }, { ...BLOC, debut: "2026-12-21", macroId: "M3" }]) {
    const nouvelles = [...cles(avecBloc(w, b), auj)].filter(k => !a.has(k) && /meso-termine|decharge|boss/.test(k));
    assert.ok(nouvelles.length <= 1, `${JSON.stringify(b)} : ${nouvelles.join(", ")}`);
  }
});

test("plusieurs séances le même jour : au plus 2 rapportent, et l'ordre ou les identifiants n'y changent rien", () => {
  const cinq = Array.from({ length: 5 }, (_, i) => complete("2026-12-07", { id: "x" + i, end: `2026-12-07T1${i}:00:00Z` }));
  const ev = Q.evenements(D, J(cinq), "2026-12-08");
  assert.equal(ev.filter(e => e.source === "regularite").length, 2);
  assert.equal(ev.filter(e => e.source === "technique").length, 1);
  const melange = Q.evenements(D, J([...cinq].reverse().map((w, i) => ({ ...w, id: undefined }))), "2026-12-08");
  assert.deepEqual(melange.map(e => e.cle), ev.map(e => e.cle));
});

test("séances avec douleur ou fatigue : aucune XP de quête non plus", () => {
  const w = ["2026-12-07", "2026-12-09", "2026-12-11"].map(d => complete(d, { suffixe: d }));
  w.forEach(x => { x.exercises[0].sets[1].pain = true; });
  const ev = Q.evenements(D, J(w), "2026-12-13");
  assert.ok(!ev.some(e => e.source === "quete" || e.source === "regularite" || e.source === "technique"), ev.map(e => e.cle).join(","));
});

test("tests : seulement les types connus, une fois par type et par fenêtre de 28 jours", () => {
  const tests = [...Array.from({ length: 40 }, (_, i) => ({ d: "2026-12-08", type: "invente" + i })), { d: "2026-12-08", type: "vma" }, { d: "2026-12-09", type: "vma" }];
  const ev = Q.evenements(D, J([], { tests }), "2026-12-10");
  assert.equal(ev.filter(e => e.source === "test").length, 1);
});

test("pauses plafonnées : une par semaine, au-delà le jour reste prévu", () => {
  const pauses = Object.fromEntries(["2026-12-07", "2026-12-09", "2026-12-11"].map(d => [d, "imprevu"]));
  const j = J([], { pauses });
  assert.equal(Object.values(j.jours).filter(x => x.pause).length, 1);
  const unique = J([complete("2026-12-07")], { pauses: Object.fromEntries(["2026-12-09", "2026-12-11", "2026-12-14", "2026-12-16", "2026-12-18", "2026-12-21", "2026-12-23", "2026-12-25", "2026-12-28", "2026-12-30", "2027-01-01"].map(d => [d, "nuit"])) });
  assert.ok(!Q.reussites(D, unique, "2027-01-04").some(r => r.id === "meso-termine"), "une séance et des pauses ne terminent pas un mésocycle");
});

test("séances décalées dans la semaine : la série tient", () => {
  const w = [];
  for (let k = 0; k < 3; k++) for (const j of [-1, 1, 3]) { const d = new Date(Date.UTC(2026, 11, 7 + k * 7 + j)).toISOString().slice(0, 10); w.push(complete(d, { suffixe: d })); }
  const s = Q.serie(D, J(w), "2026-12-25");
  assert.ok(s.jours >= 18, JSON.stringify(s));
});

test("absence : le record ne monte pas sans activité, l'accueil « On reprend » s'affiche aussi après la fin du bloc", () => {
  const sans = Q.journalDepuisEtat(D, { workouts: [complete("2026-09-01")] }, exDe);
  const s = Q.serie(D, sans, "2026-12-10");
  assert.ok(s.record <= D.hypotheses.absenceRetour, JSON.stringify(s));
  assert.ok(s.retour);
  assert.ok(!Q.debloques(D, { serieRecord: s.record }).includes("cape"));
  const finie = Q.serie(D, J([complete("2027-02-26")]), "2027-06-01");
  assert.ok(finie.retour); assert.equal(finie.jours, 0);
});

test("dates : séance finie à 0 h 30 à Paris comptée ce jour-là ; dates invalides ignorées sans erreur", () => {
  assert.equal(Q.dateParis("2026-12-07T23:30:00Z"), "2026-12-08");
  const j = J([{ id: "n", end: "2026-12-07T23:30:00Z", exercises: [] }, { id: "num", end: 1763400000000, exercises: [] }, { id: "bad", end: "pas une date" }], { daily: { "2026-1-5": { feel: { energy: 5 } } } });
  assert.deepEqual(j.seances.map(s => s.d), ["2026-12-08"]);
  assert.equal(Object.keys(j.jours).length, 0);
  assert.doesNotThrow(() => Q.bilan(D, j, "2026-12-10"));
});

test("le mot « normal » n'est pas pris pour une douleur", () => {
  const w = complete("2026-12-07"); w.exercises[0].sets[1].note = "tempo normal";
  assert.equal(J([w]).seances[0].douleur, false);
  w.exercises[0].sets[1].note = "un peu mal au genou";
  assert.equal(J([w]).seances[0].douleur, true);
});

test("radar des 7 qualités : 0 sans données, monte avec les vraies séances, borné à 100", () => {
  const vide = Q.radar(D, J([]), "2026-12-20");
  assert.equal(vide.length, 7); assert.ok(vide.every(x => x.v === 0));
  const w = [];
  for (let k = 0; k < 4; k++) for (const j of [0, 2, 4]) { const d = new Date(Date.UTC(2026, 10, 23 + k * 7 + j)).toISOString().slice(0, 10); const s = complete(d, { suffixe: d }); s.exercises.push({ name: "Muscle-up strict", sets: [set({ reps: 2 }), set({ reps: 2 }), set({ reps: 2 })] }); w.push(s); }
  const r = Object.fromEntries(Q.radar(D, J(w), "2026-12-20").map(x => [x.id, x.v]));
  assert.ok(r.force > 0 && r.skills > 0 && r.prevention > 0);
  assert.ok(Object.values(r).every(v => v >= 0 && v <= 100));
  assert.equal(r.vitesse, 0);
});

test("objets : aucun prix aujourd'hui (C58)", () => { assert.ok(D.objets.every(o => o.prix === null)); });
