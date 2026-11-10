// Tests de l'agenda « Ma semaine type » (planification des séances, récupération, imprévus) : node --test tests/semaine.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as W from "../js/semaine.js";

const LUN = "2026-11-09"; // un lundi
const bureau = { id: "w", type: "travail", label: "Bureau", jours: [0, 1, 2, 3, 4], debut: "09:00", fin: "18:00" };
const sem = (extra = {}) => W.normaliser({ fixe: [bureau], ...extra });
const patt = (...c) => c.map(x => ({ code: x, lourd: x === "CH" || x === "SG" }));
const S = (titre, dur, p, lieu = "Salle") => ({ titre, dur, lieu, patterns: p });
const haut = patt("PH", "PV", "TH", "TV"), bas = patt("SG", "SH", "CH", "FG");

test("heures et dates : conversions, lundi de la semaine, passage de mois", () => {
  assert.equal(W.min("18:30"), 1110); assert.equal(W.hhmm(1110), "18:30"); assert.equal(W.hhmm(65), "01:05");
  assert.equal(W.dowOf(LUN), 0); assert.equal(W.dowOf("2026-11-15"), 6);
  assert.equal(W.lundiDe("2026-11-15"), LUN); assert.equal(W.lundiDe(LUN), LUN);
  assert.equal(W.addJ("2026-11-30", 1), "2026-12-01"); assert.equal(W.addJ("2026-03-28", 1), "2026-03-29"); assert.equal(W.addJ("2026-03-29", 1), "2026-03-30");
  assert.equal(W.ecartJours("2026-11-09", "2026-11-12"), 3); assert.deepEqual(W.semaineDe(LUN).slice(5), ["2026-11-14", "2026-11-15"]);
});

test("blocs : le fixe revient chaque semaine, le variable seulement ce jour-là, le calendrier importé compte", () => {
  const s = sem({ variable: [{ id: "v", type: "autre", label: "Dîner", date: "2026-11-11", debut: "19:00", fin: "22:00" }] });
  assert.equal(W.blocsDuJour(s, LUN).length, 1); assert.equal(W.blocsDuJour(s, "2026-11-14").length, 0);
  assert.equal(W.blocsDuJour(s, "2026-11-11").length, 2); assert.equal(W.blocsDuJour(s, "2026-11-18").length, 1, "la semaine suivante : plus de dîner");
  const b = W.blocsDuJour(s, LUN, [{ d: LUN, s: "12:00", e: "13:00", t: "Dentiste" }, { d: LUN, s: "00:00", e: "23:59", t: "Férié" }]);
  assert.equal(b.length, 2, "un événement toute la journée ne bloque pas l'entraînement");
  assert.ok(b.some(x => x.source === "calendrier" && x.label === "Dentiste"));
});

test("validation d'un bloc : horaires, nuit à découper, jours, date", () => {
  assert.equal(W.validerBloc({ type: "travail", jours: [1], debut: "18:00", fin: "09:00" }).ok, false);
  assert.equal(W.validerBloc({ type: "travail", jours: [], debut: "09:00", fin: "10:00" }).ok, false);
  assert.equal(W.validerBloc({ type: "autre", date: "demain", debut: "09:00", fin: "10:00" }).ok, false);
  const v = W.validerBloc({ type: "inconnu", label: "  X  ", jours: ["2", 0, 2], debut: "09:00", fin: "10:00" });
  assert.ok(v.ok && v.bloc.type === "autre" && v.bloc.label === "X" && v.bloc.jours.join() === "0,2" && v.bloc.id);
});

test("créneaux libres : fenêtre après le lever et une heure avant le coucher, trous entre les blocs", () => {
  const f = W.fenetre(sem()); assert.deepEqual(f, { a: 7 * 60 + 30, b: 22 * 60 });
  assert.deepEqual(W.creneauxLibres(sem(), LUN), [[450, 540], [1080, 1320]]);
  assert.deepEqual(W.creneauxLibres(sem(), "2026-11-14"), [[450, 1320]], "samedi : toute la fenêtre");
  assert.deepEqual(W.creneauxLibres(sem(), LUN, [], { apres: 1200 }), [[1200, 1320]], "aujourd'hui : rien dans le passé");
  assert.equal(W.sommeilVise(sem()), 480); assert.equal(W.sommeilVise({ reglages: { lever: "06:00", coucher: "00:30" } }), 330);
});

test("début d'une séance : trajet compris, au plus près de l'heure visée, jamais hors créneau", () => {
  assert.equal(W.meilleurDebut([1080, 1320], 60, 15, 1110), 1110);
  assert.equal(W.meilleurDebut([1080, 1320], 60, 15, 1300), 1245, "avance pour finir avant la fin du créneau (trajet de retour compris)");
  assert.equal(W.meilleurDebut([1080, 1320], 60, 15, 600), 1095, "attend le trajet d'aller");
  assert.equal(W.meilleurDebut([1080, 1140], 60, 15, 1100), null, "ne tient pas");
  const p = W.placerLe(sem(), LUN, 60, { lieu: "Salle" }); assert.ok(p.debut >= 1095 && p.fin <= 1305 && p.fin - p.debut === 60);
  assert.equal(W.placerLe(sem(), LUN, 60, { lieu: "Maison" }).debut, 1110, "à la maison : pas de trajet");
  assert.equal(W.placerLe(sem({ reglages: { trajet: 60 } }), LUN, 120, { lieu: "Salle" }).debut, 1140, "deux heures plus deux trajets d'une heure : tient pile dans 18 h - 22 h");
  assert.equal(W.placerLe(sem({ reglages: { trajet: 75 } }), LUN, 120, { lieu: "Salle" }), null, "avec 75 min de trajet : ne tient plus");
});

test("récupération : même pattern à moins de 48 h refusé, 72 h pour une charnière lourde, patterns différents tolérés", () => {
  const m = (a, b, pa, pb, o) => W.manquesRecuperation([{ date: a, patterns: pa }, { date: b, patterns: pb }], o);
  assert.equal(m("2026-11-09", "2026-11-10", haut, haut).length, 4);
  assert.equal(m("2026-11-09", "2026-11-10", haut, bas).length, 0, "haut puis bas le lendemain : autorisé");
  assert.equal(m("2026-11-09", "2026-11-11", haut, haut).length, 0);
  assert.equal(m("2026-11-09", "2026-11-11", bas, bas).map(x => x.code).join(), "CH", "charnière lourde : 72 h exigées");
  assert.equal(m("2026-11-09", "2026-11-12", bas, bas).length, 0);
  assert.equal(m("2026-11-09", "2026-11-10", null, haut)[0].type, "generique");
  assert.equal(m("2026-11-09", "2026-11-15", haut, haut, { cyclique: true }).length, 4, "semaine type : dimanche puis lundi");
});

test("placer 3 séances : jours distincts, créneaux qui tiennent, écarts, rechange", () => {
  const ss = [S("A", 60, patt("PH", "SG")), S("B", 60, patt("TH", "CH")), S("C", 60, patt("PV", "SH"))];
  const p = W.planifier(sem(), LUN, ss, { cyclique: true });
  assert.equal(p.affectations.length, 3); assert.equal(new Set(p.affectations.map(a => a.date)).size, 3); assert.equal(p.reportees.length, 0);
  const libre = (a) => W.creneauxLibres(sem(), a.date).some(([x, y]) => a.debut - 15 >= x && a.fin + 15 <= y);
  p.affectations.forEach(a => assert.ok(libre(a), `${a.date} ${W.hhmm(a.debut)}`));
  assert.ok(p.affectations.every(a => a.fin - a.debut === 60));
  assert.ok(p.rechange, "un créneau de rechange"); assert.equal(p.manques.length, 0);
  assert.ok(p.affectations.map(a => a.i).join() === "0,1,2" && p.affectations.every((a, k, t) => k === 0 || a.date > t[k - 1].date), "les séances gardent l'ordre du programme");
});

test("placer : la récupération prime, quel que soit le planning", () => {
  for (const n of [2, 3, 4, 5]) {
    const ss = Array.from({ length: n }, (_, i) => S("S" + i, 60, i % 2 ? bas : haut));
    const p = W.planifier(sem(), LUN, ss, { cyclique: true });
    assert.equal(p.affectations.length, n);
    assert.equal(W.manquesRecuperation(p.affectations.map(a => ({ date: a.date, patterns: a.patterns || ss[a.i].patterns })), { cyclique: true }).length, 0, `${n} séances`);
  }
});

test("placer : jours trop chargés évités, créneau le soir seulement, heure visée respectée", () => {
  const s = sem({ fixe: [{ ...bureau, jours: [0, 1, 2, 3, 4], debut: "07:30", fin: "21:00" }], reglages: { pref: "soir", trajet: 15 } });
  const p = W.planifier(s, LUN, [S("A", 60, haut), S("B", 60, bas)]);
  assert.ok(p.affectations.every(a => a.dow >= 5), "bureau de 7 h 30 à 21 h : séances le week-end");
  const matin = W.planifier(sem({ reglages: { pref: "matin" } }), LUN, [S("A", 45, haut)], {});
  assert.ok(matin.affectations[0].debut < 9 * 60, "préférence du matin : avant le bureau");
  assert.equal(W.planifier(sem({ reglages: { pref: "midi" } }), LUN, [S("A", 40, haut)], {}).affectations[0].debut >= 12 * 60 - 20, true);
});

test("placer : trop de séances pour la semaine → les dernières sont reportées, et dites", () => {
  const dense = sem({ fixe: [{ ...bureau, jours: [0, 1, 2, 3, 4, 5], debut: "07:30", fin: "22:00" }] });
  const ss = [S("A", 60, haut), S("B", 60, bas), S("C", 60, haut)];
  const p = W.planifier(dense, LUN, ss);
  assert.equal(p.affectations.length, 1); assert.deepEqual(p.reportees, [1, 2]); assert.equal(p.affectations[0].dow, 6);
  assert.ok(W.controles(p, dense, ss).some(c => c.niveau === "alerte" && /passent à la semaine suivante/.test(c.texte)));
  const vide = W.planifier(sem({ fixe: [{ ...bureau, jours: [0, 1, 2, 3, 4, 5, 6], debut: "07:30", fin: "22:00" }] }), LUN, ss);
  assert.equal(vide.affectations.length, 0); assert.deepEqual(vide.reportees, [0, 1, 2]);
});

test("placer : le plan actuel est gardé quand c'est déjà le meilleur, et bouger a un coût", () => {
  const ss = [S("A", 60, haut), S("B", 60, bas)], libre = W.planifier(sem(), LUN, ss);
  const aff = (p) => p.affectations.map(a => a.date).join();
  const base = W.planifier(sem(), LUN, ss, { courant: { 0: libre.affectations[0].date, 1: libre.affectations[1].date } });
  assert.equal(aff(base), aff(libre)); assert.equal(base.score, libre.score, "rien à changer : aucun coût");
  const autre = W.planifier(sem(), LUN, ss, { courant: { 0: "2026-11-14", 1: "2026-11-15" } });
  assert.ok(autre.score > libre.score, "déplacer des séances déjà placées coûte dans le score");
});

test("cette semaine : on ne place rien dans le passé, et on compte les séances déjà faites", () => {
  const dates = ["2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
  const p = W.planifier(sem(), LUN, [S("B", 60, bas)], { dates, now: { date: "2026-11-12", min: 20 * 60 + 30 }, fixes: [{ date: "2026-11-11", patterns: bas }] });
  assert.ok(p.affectations[0].date >= "2026-11-14", "bas fait mercredi : pas avant 48 h (72 h charnière lourde)");
  const tard = W.planifier(sem(), LUN, [S("A", 60, haut)], { dates: ["2026-11-12"], now: { date: "2026-11-12", min: 21 * 60 } });
  assert.equal(tard.affectations.length, 0, "à 21 h, plus de créneau ce soir");
});

test("contrôles : sommeil rogné, sommeil court, tout va bien", () => {
  const tard = sem({ reglages: { coucher: "22:30", pref: "soir" } });
  const p = W.planifier(tard, "2026-11-14", [S("A", 60, haut)], { dates: ["2026-11-14"] });
  assert.ok(!W.controles(p, tard, []).some(c => /rogne/.test(c.texte)), "la fenêtre s'arrête 1 h avant le coucher");
  const coucherTard = { ...p, affectations: [{ ...p.affectations[0], fin: W.min("22:00") }] };
  assert.ok(W.controles(coucherTard, tard, []).some(c => c.niveau === "alerte" && /rogne ton sommeil/.test(c.texte)));
  assert.ok(W.controles(p, { reglages: { lever: "06:00", coucher: "00:30" } }, []).some(c => c.niveau === "info" && /5 h 30/.test(c.texte)));
  assert.ok(W.controles(W.planifier(sem(), LUN, [S("A", 60, haut)]), sem(), []).every(c => c.niveau !== "alerte"));
});

// ---------- Je ne peux pas ----------
const jnp = (date, extra = {}) => W.jeNePeuxPas(sem(), date, S("Haut B", 60, haut), { aujourdhui: "2026-11-10", now: { date: "2026-11-10", min: 8 * 60 }, ...extra });
test("je ne peux pas : les prochains créneaux possibles, dans l'ordre, jamais le jour refusé, jamais deux séances le même jour", () => {
  const r = jnp("2026-11-12", { autres: [{ date: "2026-11-14", patterns: bas, titre: "Bas B" }], faites: [{ date: "2026-11-09", patterns: haut }] });
  assert.ok(r.propositions.length >= 2 && r.propositions.length <= 3);
  assert.ok(r.propositions.every(p => p.date !== "2026-11-12" && p.date !== "2026-11-14"));
  assert.ok(r.propositions.every((p, i, t) => i === 0 || p.date > t[i - 1].date), "du plus tôt au plus tard");
  assert.ok(r.propositions.every(p => p.fin - p.debut === 60));
  assert.ok(r.propositions.every(p => W.ecartJours("2026-11-09", p.date) >= 2), "haut déjà fait lundi : pas avant 48 h");
  assert.match(r.propositions[0].raison, /h après ta séance du 09\/11|créneau libre/);
  assert.equal(r.courte, null); assert.equal(r.fusion, null);
});
test("je ne peux pas : une séance haut ne se place pas la veille d'une autre séance haut", () => {
  const r = jnp("2026-11-12", { autres: [{ date: "2026-11-16", patterns: haut, titre: "Haut A" }] });
  assert.ok(r.propositions.every(p => p.date !== "2026-11-15" && p.date !== "2026-11-17"), "pas à moins de 48 h de Haut A (lundi 16)");
});
test("je ne peux pas : aucun créneau → version courte de 20 min, puis fusion avec la séance suivante", () => {
  const plein = W.normaliser({ fixe: [{ ...bureau, jours: [0, 1, 2, 3, 4, 5, 6], debut: "07:30", fin: "21:30" }] });
  const r = W.jeNePeuxPas(plein, "2026-11-12", S("Haut B", 60, haut), { aujourdhui: "2026-11-10", now: { date: "2026-11-10", min: 8 * 60 }, autres: [{ date: "2026-11-14", patterns: bas, titre: "Bas B" }] });
  assert.equal(r.propositions.length, 0);
  assert.equal(r.courte, null, "même 20 min + trajets ne tiennent pas : fenêtre fermée");
  assert.deepEqual(r.fusion, { date: "2026-11-14", titre: "Bas B" });
  const presque = W.normaliser({ fixe: [{ ...bureau, jours: [0, 1, 2, 3, 4, 5, 6], debut: "07:30", fin: "21:00" }] });
  const c = W.jeNePeuxPas(presque, "2026-11-12", S("Haut B", 60, haut), { aujourdhui: "2026-11-10", now: { date: "2026-11-10", min: 8 * 60 } });
  assert.equal(c.propositions.length, 0); assert.ok(c.courte && c.courte.dur === 20 && c.courte.fin - c.courte.debut === 20, JSON.stringify(c));
  assert.equal(c.fusion, null);
});
test("je ne peux pas : aujourd'hui, rien avant l'heure qu'il est", () => {
  const r = W.jeNePeuxPas(sem(), "2026-11-14", S("Haut B", 60, haut), { aujourdhui: "2026-11-14", now: { date: "2026-11-14", min: 20 * 60 }, horizon: 0 });
  assert.equal(r.propositions.length, 0, "samedi 20 h, horizon d'un jour : plus de créneau");
});

// ---------- Vers l'agenda existant ----------
test("semaine type : format attendu par le moteur (7 jours, on / time / dur / place), anciens réglages conservés", () => {
  const p = W.planifier(sem(), LUN, [S("A", 60, haut), S("B", 45, bas, "Maison")], { cyclique: true });
  const sc = W.versSchedule(p, { days: Array.from({ length: 7 }, () => ({ on: true, time: "10:00", dur: 90, place: "Salle" })) });
  assert.equal(sc.days.length, 7); assert.equal(sc.days.filter(d => d.on).length, 2);
  p.affectations.forEach(a => { const d = sc.days[a.dow]; assert.equal(d.on, true); assert.equal(d.time, W.hhmm(a.debut)); assert.equal(d.dur, a.fin - a.debut); assert.equal(d.place, a.lieu); });
  sc.days.filter(d => !d.on).forEach(d => { assert.equal(d.time, "10:00"); assert.equal(d.dur, 90); });
  assert.equal(W.versSchedule(p).days.length, 7);
});

test("normaliser : données incomplètes ou anciennes sans erreur", () => {
  assert.deepEqual(W.normaliser(null), W.defaut());
  const s = W.normaliser({ fixe: [{ id: "x" }, bureau], variable: [{ date: "2026-11-10" }], reglages: { lever: "06:30" } });
  assert.equal(s.fixe.length, 1); assert.equal(s.variable.length, 0); assert.equal(s.reglages.lever, "06:30"); assert.equal(s.reglages.coucher, "23:00");
});
