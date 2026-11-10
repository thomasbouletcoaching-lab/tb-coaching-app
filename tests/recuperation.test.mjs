// Tests de la récupération et de la fatigue nerveuse : node --test tests/recuperation.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/recuperation.js";
import * as I from "../js/indice.js";

const A = "2026-11-10", add = R.addJ;
const base = { auj: A, workouts: [], lifts: {}, daily: {} };
const set = (o = {}) => ({ type: "N", kg: 100, reps: 5, lo: 5, trpe: 8, rpe: 8, done: true, ...o });
const seance = (jour, exos, o = {}) => ({ id: jour, start: jour + "T17:00:00.000Z", end: jour + "T18:00:00.000Z", exercises: exos, ...o });
const ex = (name, sets, o = {}) => ({ name, unit: "reps", kind: "P", rest: 120, sets, ...o });
const normale = (jour, rpe = 8, trpe = 8) => seance(jour, [ex("Squat barre", Array.from({ length: 5 }, () => set({ rpe, trpe }))), ex("Développé couché", Array.from({ length: 4 }, () => set({ kg: 80, rpe, trpe })))]);
const habitude = (n = 4) => [9, 16, 23, 30].slice(0, n).map(k => normale(add(A, -k)));
const bon = { sleep: 8, sleepQ: 4, energy: 8, stress: 3, sore: 3, motiv: 8 };

test("sommeil : 7 h 30 et plus = 100, une nuit courte baisse nettement, la qualité module", () => {
  assert.equal(R.scoreSommeil(8), 100); assert.equal(R.scoreSommeil(7.5), 100); assert.ok(R.scoreSommeil(6) < R.scoreSommeil(7) && R.scoreSommeil(5) < R.scoreSommeil(6) && R.scoreSommeil(4) <= 10);
  assert.ok(R.scoreSommeil(8, 1) < R.scoreSommeil(8, 5) && R.scoreSommeil(8, 5) === 100);
  assert.equal(R.scoreSommeil(0), null); assert.equal(R.scoreSommeil(null), null);
});

test("check-in : pondérations, inversions (stress et courbatures), réponses partielles, trop peu de réponses", () => {
  assert.ok(Math.abs(Object.values(R.POIDS_CHECKIN).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const c = R.scoreCheckin(bon); assert.ok(c.score >= 80 && c.reponses === 5);
  assert.ok(R.scoreCheckin({ ...bon, stress: 9 }).score < c.score, "plus de stress, moins de disponibilité");
  assert.ok(R.scoreCheckin({ ...bon, sore: 9 }).score < c.score, "plus de courbatures, moins de disponibilité");
  assert.ok(R.scoreCheckin({ ...bon, energy: 2 }).score < c.score);
  assert.equal(R.scoreCheckin({ energy: 7, motiv: 7 }).reponses, 2, "réponses partielles : renormalisé");
  assert.equal(R.scoreCheckin({ energy: 7 }), null); assert.equal(R.scoreCheckin({}), null);
  assert.ok(R.scoreCheckin({ sleep: 4, energy: 1, stress: 10, sore: 10, motiv: 1 }).score <= 5);
});

test("lignes d'une séance : séries faites seulement, RPE réel sinon prévu, mouvement lourd reconnu", () => {
  const w = seance(A, [ex("Squat barre", [set({ rpe: null, trpe: 8 }), set({ done: false }), set({ type: "W", kg: 40 })])]);
  const l = R.lignesDeSeance(w); assert.equal(l.length, 1); assert.equal(l[0].series.length, 2); assert.equal(l[0].series[0].rpe, 8); assert.equal(l[0].nerveux, 3);
  assert.equal(R.nerveuxParDefaut("Curl barre EZ"), 1); assert.equal(R.nerveuxParDefaut("Rowing haltère"), 2); assert.equal(R.nerveuxParDefaut("Soulevé de terre roumain"), 3);
  assert.equal(R.lignesDeSeance(seance(A, [ex("X", [set({ done: false })])])).length, 0);
});

test("charge de la semaine : même calcul que l'indice, échauffement exclu", () => {
  const w = normale(A), c = R.charge([w], add(A, -6), A);
  const i = I.indiceSeance(R.lignesDeSeance(w)); assert.ok(Math.abs(c.valeur - (i.inol + i.nerveux)) < 0.11); assert.equal(c.seances, 1);
  const avecEch = seance(A, [ex("Squat barre", [set({ type: "W", kg: 40 }), ...Array.from({ length: 5 }, () => set())])]);
  assert.equal(R.charge([avecEch], add(A, -6), A).valeur, R.charge([seance(A, [ex("Squat barre", Array.from({ length: 5 }, () => set()))])], add(A, -6), A).valeur);
  assert.equal(R.charge([], add(A, -6), A).valeur, 0);
  assert.equal(R.charge([normale(add(A, -8))], add(A, -6), A).seances, 0, "hors période");
});

test("ratio charge récente / habituelle : 1 pour une semaine normale, plus pour une semaine chargée, inconnu sans recul", () => {
  const h = habitude(); // une séance par semaine depuis 4 semaines
  assert.ok(Math.abs(R.ratioCharge([...h, normale(add(A, -1))], A).ratio - 1) < 0.15);
  const chargee = [...h, ...[0, 1, 2, 3].map(k => normale(add(A, -k)))];
  assert.ok(R.ratioCharge(chargee, A).ratio > 3);
  const peu = R.ratioCharge([normale(add(A, -9)), normale(A)], A); assert.equal(peu.ratio, null); assert.equal(peu.semainesConnues, 1);
  assert.equal(R.ratioCharge([], A).ratio, null);
  assert.ok(R.ratioCharge([...h, ...[0, 1].map(k => normale(add(A, -k)))], A).habituelle > 0);
});

test("séries lourdes : ≥ 85 % du 1RM ou RPE ≥ 9 sur un mouvement polyarticulaire seulement", () => {
  const lourd = seance(A, [ex("Squat barre", [set({ rpe: 9.5 }), set({ rpe: 9 }), set({ rpe: 8, reps: 2, lo: 2 }), set({ rpe: 8 })]), ex("Curl barre EZ", [set({ rpe: 10 }), set({ rpe: 10 })])]);
  assert.equal(R.seriesLourdes([lourd], add(A, -6), A), 3, "2 à RPE 9+ et 1 double à RPE 8 (≥ 85 %), pas le curl");
  assert.equal(R.seriesLourdes([lourd], add(A, -30), add(A, -10)), 0);
  assert.equal(R.seriesLourdes([seance(A, [ex("Squat barre", [set({ rpe: 9, done: false })])])], add(A, -6), A), 0, "séries non faites ignorées");
});

test("dérive du RPE : effort ressenti moins effort prévu, au moins 8 séries notées", () => {
  const dur = [0, 1, 2].map(k => normale(add(A, -k), 9.5, 8));
  assert.ok(Math.abs(R.deriveRpe(dur, A).ecart - 1.5) < 1e-9);
  assert.equal(R.deriveRpe([normale(A, 8, 8)], A).ecart, 0);
  assert.equal(R.deriveRpe([seance(A, [ex("Squat barre", [set(), set()])])], A), null, "pas assez de séries");
  assert.equal(R.deriveRpe([seance(A, [ex("Squat barre", Array.from({ length: 10 }, () => set({ rpe: null })))])], A), null, "RPE jamais noté");
});

test("séries manquées : part des séries prévues non faites sur 14 jours", () => {
  const w = seance(A, [ex("Squat barre", [...Array.from({ length: 6 }, () => set()), ...Array.from({ length: 4 }, () => set({ done: false }))])]);
  const m = R.seriesManquees([w], A); assert.equal(m.part, 0.4); assert.equal(m.manquees, 4);
  assert.equal(R.seriesManquees([seance(A, [ex("X", [set(), set()])])], A), null);
});

test("baisse de performance : dernière charge maximale estimée face au meilleur des 28 jours d'avant", () => {
  const l = { "Squat barre": [{ d: add(A, -40), e1rm: 130 }, { d: add(A, -20), e1rm: 135 }, { d: add(A, -12), e1rm: 134 }, { d: add(A, -1), e1rm: 125 }] };
  assert.equal(R.baissePerformance(l, A).pct, 7); assert.equal(R.baissePerformance(l, A).nom, "Squat barre");
  assert.equal(R.baissePerformance({ X: [{ d: add(A, -20), e1rm: 100 }, { d: add(A, -10), e1rm: 105 }, { d: add(A, -1), e1rm: 110 }] }, A), null, "en progrès");
  assert.equal(R.baissePerformance({ X: [{ d: add(A, -20), e1rm: 100 }, { d: add(A, -10), e1rm: 105 }] }, A), null, "pas assez de points");
  assert.equal(R.baissePerformance({ X: [{ d: add(A, -60), e1rm: 100 }, { d: add(A, -50), e1rm: 120 }, { d: add(A, -40), e1rm: 90 }] }, A), null, "trop ancien");
});

test("tendance du sommeil et de la motivation : 3 derniers jours contre les 7 d'avant", () => {
  const d = {}; for (let k = 3; k <= 9; k++) d[add(A, -k)] = { sleep: 8, feel: { motiv: 8 } }; for (let k = 0; k <= 2; k++) d[add(A, -k)] = { sleep: 6, feel: { motiv: 5 } };
  const t = R.tendanceCheckins(d, A); assert.equal(t.sleep, -2); assert.equal(t.motiv, -3);
  assert.deepEqual(R.tendanceCheckins({}, A), {});
});

test("fatigue nerveuse : 0 sans signal ; élevée quand la charge, le RPE et les charges maximales vont mal ensemble", () => {
  assert.equal(R.fatigueNerveuse({}).score, 0); assert.equal(R.fatigueNerveuse({}).niveau, "faible");
  const f = R.fatigueNerveuse({ ratio: { ratio: 1.9 }, rpe: { ecart: 1.5 }, baisse: { nom: "Squat barre", pct: 8 }, lourdes: 14, lourdesHabituelles: 6, tendance: { sleep: -1.5 } });
  assert.equal(f.niveau, "élevée"); assert.ok(f.score >= 80 && f.score <= 100); assert.ok(f.actifs.every((x, i, t) => i === 0 || x.points <= t[i - 1].points), "du plus gros signal au plus petit");
  assert.equal(R.fatigueNerveuse({ ratio: { ratio: 1.1 } }).score, 0, "une semaine un peu plus chargée n'est pas de la fatigue");
  assert.ok(R.fatigueNerveuse({ ratio: { ratio: 1.5 } }).niveau === "modérée" || R.fatigueNerveuse({ ratio: { ratio: 1.5 } }).score > 0);
  assert.match(R.fatigueNerveuse({ baisse: { nom: "Squat barre", pct: 8 } }).actifs[0].texte, /squat barre baissent de 8 %/);
});

test("fatigue locale : patterns très sollicités ces 3 derniers jours", () => {
  const l = R.fatigueLocale([normale(add(A, -1))], A, { patternDe: (n) => ({ "Squat barre": "SG", "Développé couché": "PH" })[n] });
  assert.deepEqual(l, [{ pattern: "SG", series: 5 }].filter(x => x.series >= 6), "5 séries : sous le seuil de 6");
  const gros = seance(add(A, -1), [ex("Squat barre", Array.from({ length: 8 }, () => set()))]);
  assert.deepEqual(R.fatigueLocale([gros], A, { patternDe: () => "SG" }), [{ pattern: "SG", series: 8 }]);
  assert.deepEqual(R.fatigueLocale([gros], A, {}), []);
});

test("feu du jour : bon check-in = vert ; nuit courte, énergie basse et stress = rouge ; un peu fatigué = orange", () => {
  assert.equal(R.etat({ ...base, checkin: bon }).feu.id, "vert");
  assert.equal(R.etat({ ...base, checkin: { sleep: 5, sleepQ: 2, energy: 4, stress: 7, sore: 6, motiv: 4 } }).feu.id, "rouge");
  assert.equal(R.etat({ ...base, checkin: { sleep: 6.5, sleepQ: 3, energy: 6, stress: 5, sore: 5, motiv: 6 } }).feu.id, "orange");
  const e = R.etat({ ...base, checkin: bon }); assert.equal(e.confiance, "moyenne"); assert.match(e.conseil, /Séance comme prévue/);
});

test("feu du jour : les séances comptent, même sans check-in ; un bon check-in ne masque pas une surcharge", () => {
  const chargee = [...habitude(), ...[0, 1, 2, 3, 4, 6].map(k => normale(add(A, -k), 9.5, 8))];
  const lifts = { "Squat barre": [{ d: add(A, -40), e1rm: 130 }, { d: add(A, -20), e1rm: 135 }, { d: add(A, -12), e1rm: 134 }, { d: add(A, -1), e1rm: 125 }] };
  const sans = R.etat({ ...base, workouts: chargee, lifts }), avec = R.etat({ ...base, checkin: bon, workouts: chargee, lifts });
  assert.notEqual(sans.feu.id, "vert"); assert.notEqual(avec.feu.id, "vert", "bon check-in mais semaine très chargée");
  assert.ok(avec.fatigue.niveau === "élevée" && avec.raisons.some(t => /fois ta moyenne/.test(t)));
  const neutre = R.etat({ ...base }); assert.equal(neutre.feu.id, "vert"); assert.equal(neutre.confiance, "à affiner"); assert.equal(neutre.checkin, null);
});

test("garde-fou : une nuit sous 5 h avec une énergie très basse n'est jamais verte", () => {
  const e = R.etat({ ...base, checkin: { sleep: 4.5, energy: 3, stress: 2, sore: 2, motiv: 9 } });
  assert.ok(e.feu.rang >= 2, e.feu.id);
});

test("raisons : au plus 3, formulées sans jugement", () => {
  const e = R.etat({ ...base, checkin: { sleep: 4, sleepQ: 1, energy: 2, stress: 9, sore: 8, motiv: 2 }, workouts: [...habitude(), ...[0, 1, 2].map(k => normale(add(A, -k), 9.5, 8))] });
  assert.ok(e.raisons.length <= 3 && e.raisons.length >= 1);
  e.raisons.forEach(t => assert.ok(!/paresse|faible|échec|nul|honte|raté|mauvais/i.test(t), t));
  assert.match(e.conseil, /repos actif/);
});

// ---------- Décharge ----------
test("décharge : conseillée après 3 jours rouges sur 5, ou 2 de suite avec une fatigue élevée ; jamais deux fois", () => {
  const f = (o) => o;
  assert.equal(R.dechargeConseillee(f({ [A]: "rouge", [add(A, -1)]: "orange", [add(A, -2)]: "rouge", [add(A, -3)]: "vert", [add(A, -4)]: "rouge" }), A).propose, true);
  assert.equal(R.dechargeConseillee(f({ [A]: "rouge", [add(A, -1)]: "rouge", [add(A, -2)]: "vert" }), A).propose, false, "2 rouges sans fatigue élevée");
  assert.equal(R.dechargeConseillee(f({ [A]: "rouge", [add(A, -1)]: "rouge" }), A, { fatigue: { niveau: "élevée" } }).propose, true);
  assert.equal(R.dechargeConseillee(f({ [A]: "orange", [add(A, -1)]: "orange", [add(A, -2)]: "orange" }), A).propose, false, "orange n'est pas rouge");
  assert.equal(R.dechargeConseillee(f({ [A]: "rouge", [add(A, -1)]: "rouge", [add(A, -2)]: "rouge" }), A, { actuelle: { debut: A, fin: add(A, 6) } }).propose, false, "déjà en décharge");
  assert.equal(R.dechargeConseillee(f({ [A]: "rouge", [add(A, -1)]: "rouge", [add(A, -2)]: "rouge" }), A, { refusLe: A }).propose, false, "refusée aujourd'hui");
  assert.equal(R.dechargeConseillee(f({ [add(A, -9)]: "rouge", [add(A, -8)]: "rouge", [add(A, -7)]: "rouge" }), A).propose, false, "trop ancien");
  assert.match(R.dechargeConseillee(f({ [A]: "rouge", [add(A, -1)]: "rouge", [add(A, -2)]: "rouge" }), A).raison, /3 jours rouges sur 3/);
});
test("décharge : sept jours, active entre le début et la fin, cadence selon le niveau", () => {
  assert.equal(R.finDecharge(A), add(A, 6));
  assert.equal(R.dechargeActive({ debut: A, fin: add(A, 6) }, add(A, 3)), true); assert.equal(R.dechargeActive({ debut: A, fin: add(A, 6) }, add(A, 7)), false); assert.equal(R.dechargeActive(null, A), false);
  assert.deepEqual([R.cadenceDecharge("debutant"), R.cadenceDecharge("regulier"), R.cadenceDecharge("avance"), R.cadenceDecharge("?")], [8, 6, 4, 6]);
  assert.ok(Object.values(R.CADENCE_DECHARGE).every(w => w >= 4 && w <= 8), "toutes les 4 à 8 semaines (spec)");
});

// ---------- Séance allégée ----------
const sess = () => ({ title: "Haut A", exercises: [
  { name: "Développé couché", step: 2.5, sets: [{ type: "W", kg: 40, reps: 5, trpe: 5 }, ...Array.from({ length: 4 }, () => ({ type: "N", kg: 80, reps: 8, lo: 8, trpe: 8, pct: 75, tech: [] }))] },
  { name: "Rowing", step: 2, sets: Array.from({ length: 3 }, () => ({ type: "N", kg: 60, reps: 5, lo: 5, trpe: 9.5, pct: null, tech: [] })) },
  { name: "Gainage", step: 1, sets: Array.from({ length: 2 }, () => ({ type: "N", kg: null, reps: 30, lo: 30, trpe: 7, tech: [] })) },
] });
test("allégée orange : moins de séries, effort plafonné, charges recalculées, échauffement gardé, original intact", () => {
  const s0 = sess(), avant = JSON.stringify(s0), { seance: s, resume } = R.adapterSeance(s0, "orange");
  assert.equal(JSON.stringify(s0), avant, "la séance d'origine n'est pas modifiée");
  const trav = (ex) => ex.sets.filter(x => x.type !== "W");
  assert.equal(trav(s.exercises[0]).length, 3, "4 séries → 3"); assert.equal(trav(s.exercises[1]).length, 2, "3 → 2"); assert.equal(trav(s.exercises[2]).length, 2, "plancher de 2 séries");
  assert.equal(s.exercises[0].sets.filter(x => x.type === "W").length, 1, "échauffement gardé");
  s.exercises.forEach(ex => trav(ex).forEach(x => assert.ok(x.trpe <= 7.5, `${ex.name} RPE ${x.trpe}`)));
  assert.equal(trav(s.exercises[2])[0].trpe, 7, "un effort déjà plus bas n'est pas relevé");
  assert.equal(trav(s.exercises[0])[0].kg, 80, "RPE 8 → 7,5 : l'écart est inférieur au pas de charge de 2,5 kg, la charge ne bouge pas");
  assert.equal(trav(s.exercises[1])[0].kg, Math.round(60 * I.pctDe(5, 7.5) / I.pctDe(5, 9.5) / 2) * 2, "RPE 9,5 → 7,5 : la charge est recalculée et arrondie au pas");
  assert.ok(trav(s.exercises[1])[0].kg < 60);
  assert.deepEqual(resume, { avant: 9, apres: 7, rpe: 7.5, mode: "orange" }); assert.match(s.allegeNote, /7 séries au lieu de 9, effort plafonné à RPE 7,5\./); assert.equal(s.allege, "orange");
});
test("allégée rouge et décharge : plus d'allègement et plus bas, jamais en dessous de 2 séries ni du plafond", () => {
  const o = R.adapterSeance(sess(), "orange").resume.apres, r = R.adapterSeance(sess(), "rouge").resume, d = R.adapterSeance(sess(), "decharge").resume;
  assert.ok(r.apres <= o && d.apres <= o); assert.equal(r.rpe, 7); assert.equal(d.rpe, 6.5);
  R.adapterSeance(sess(), "decharge").seance.exercises.forEach(ex => ex.sets.filter(x => x.type !== "W").forEach(x => assert.ok(x.trpe <= 6.5)));
  assert.ok(R.adapterSeance(sess(), "rouge").seance.exercises.every(ex => ex.sets.filter(x => x.type !== "W").length >= 2));
});
test("allégée : dropsets et séries à l'échec deviennent des séries normales ; mode inconnu = séance inchangée", () => {
  const s = { exercises: [{ name: "X", step: 2.5, sets: [{ type: "T", kg: 100, reps: 5, trpe: 8, tech: [] }, { type: "D", kg: 80, reps: 8, trpe: 8, tech: ["Dropset"] }, { type: "A", kg: 60, reps: 10, trpe: 9, tech: ["À l'échec"] }, { type: "N", kg: 60, reps: 10, trpe: 8, tech: [] }] }] };
  const a = R.adapterSeance(s, "orange").seance.exercises[0].sets; assert.ok(a.every(x => !["D", "A"].includes(x.type)) && a.every(x => !(x.tech || []).includes("Dropset")));
  assert.deepEqual(R.adapterSeance(s, "autre"), { seance: s, resume: null });
});

// ---------- Rappel de coucher ----------
test("rappel de coucher : séance tôt demain = coucher plus tôt ; séance tardive = coucher habituel", () => {
  const reglages = { lever: "07:00", coucher: "23:00" }, v = 480;
  const tot = R.rappelCoucher({ demain: { time: "06:30" }, reglages, sommeilVise: v, trajet: 15 });
  assert.equal(tot.reveil, "05:15"); assert.equal(tot.heure, "21:15"); assert.equal(tot.avance, true); assert.match(tot.texte, /lève-toi à 05:15 et couche-toi avant 21:15/);
  const tard = R.rappelCoucher({ demain: { time: "18:30" }, reglages, sommeilVise: v, trajet: 15 });
  assert.equal(tard.avance, false); assert.equal(tard.reveil, "07:00"); assert.match(tard.texte, /coucher habituel \(23:00\)/);
  assert.match(R.rappelCoucher({ demain: null, reglages, sommeilVise: v }).texte, /couche-toi vers 23:00/);
  assert.equal(R.rappelCoucher({ demain: { time: "00:30" }, reglages: { lever: "07:00", coucher: "00:30" }, sommeilVise: 420 }).avance, false, "séance après minuit : cas limite sans erreur");
});

test("feux : trois niveaux ordonnés, seuils cohérents", () => {
  assert.deepEqual(Object.values(R.FEUX).map(f => f.rang), [1, 2, 3]); assert.ok(R.SEUILS.vert > R.SEUILS.orange);
  assert.ok(R.ALLEGEMENT.orange.rpe > R.ALLEGEMENT.rouge.rpe && R.ALLEGEMENT.rouge.rpe > R.ALLEGEMENT.decharge.rpe);
  assert.ok(R.ALLEGEMENT.orange.retire < R.ALLEGEMENT.rouge.retire);
});
