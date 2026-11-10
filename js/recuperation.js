// Récupération et fatigue nerveuse (créateur de programme, étape 7). Module pur : testé par `node --test tests/recuperation.test.mjs`.
// Spécification : page Notion « SPEC : Créateur de programme individualisé », §6.
//
// ENTRÉES : le check-in du jour (sommeil, énergie, stress, courbatures, motivation, en 10 secondes) et les séances faites
//   (RPE réel et prévu, séries faites ou manquées, charges maximales estimées).
// INDICATEURS : fatigue nerveuse (charge lourde cumulée, ratio charge récente / charge habituelle, baisse de performance,
//   RPE plus élevé que prévu, sommeil et motivation en baisse), fatigue musculaire locale (courbatures, volume par pattern).
// RÉPONSES : feu vert / orange / rouge du jour ; en orange une version allégée (moins de séries, RPE plafonné) ; après plusieurs
//   jours rouges une semaine de décharge est proposée ; un rappel de coucher lié à la séance du lendemain.
// Tout est indicatif, formulé sans jugement, et ne remplace pas l'avis d'un professionnel de santé.
// Les seuils sont des points de départ (spec : « Terrain ou hypothèse »), réunis ici pour être ajustés avec les données des clients.
import { indiceSeance, pctDe } from "./indice.js";

export const VERSION = 1;
export const FEUX = { vert: { id: "vert", nom: "Vert", icone: "🟢", rang: 1 }, orange: { id: "orange", nom: "Orange", icone: "🟠", rang: 2 }, rouge: { id: "rouge", nom: "Rouge", icone: "🔴", rang: 3 } };
export const SEUILS = { vert: 70, orange: 45 };                       // disponibilité ≥ 70 : vert ; ≥ 45 : orange ; sinon rouge
export const POIDS_CHECKIN = { sommeil: 0.25, energie: 0.25, stress: 0.15, courbatures: 0.15, motivation: 0.20 };
export const PENALITE_FATIGUE = 0.45;                                  // points retirés par point de fatigue nerveuse (0 à 100)
export const SANS_CHECKIN = 78;                                        // disponibilité supposée sans check-in : seuls les signaux des séances comptent
// Allègement d'une séance : part de séries retirées, plafond de RPE, plancher de séries par exercice
export const ALLEGEMENT = { orange: { retire: 0.25, rpe: 7.5, plancher: 2 }, rouge: { retire: 0.4, rpe: 7, plancher: 2 }, decharge: { retire: 0.4, rpe: 6.5, plancher: 2 } };
// Cadence d'une décharge planifiée selon le niveau (semaines), spec : toutes les 4 à 8 semaines
export const CADENCE_DECHARGE = { debutant: 8, regulier: 6, avance: 4 };
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const interp = (x, pts) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return pts.at(-1)[1]; };
const moy = (a) => a.length ? a.reduce((t, x) => t + x, 0) / a.length : null;
const r1 = (x) => Math.round(x * 10) / 10;
const vir = (x) => String(x).replace(".", ",");   // nombre à la française : 7,5

// ---------- Dates ----------
export const addJ = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const jourParDefaut = (iso) => String(iso).slice(0, 10);

// ---------- Le check-in du jour (échelles de 1 à 10, comme les curseurs de l'onglet Récupération) ----------
// ci : { sleep (heures), sleepQ (1-5), energy, stress, sore (courbatures), motiv } ; énergie et motivation : haut = bien ; stress et courbatures : haut = pénible
export function scoreSommeil(h, q = null) {
  if (!(h > 0)) return null;
  const base = interp(h, [[4, 10], [5, 30], [6, 60], [7, 90], [7.5, 100], [9, 100], [11, 80]]);
  return base * (q ? 0.75 + 0.25 * (q - 1) / 4 : 1);
}
export function scoreCheckin(ci = {}) {
  const p = {};
  const s = scoreSommeil(ci.sleep, ci.sleepQ); if (s != null) p.sommeil = s;
  if (ci.energy != null) p.energie = (ci.energy - 1) / 9 * 100;
  if (ci.stress != null) p.stress = (10 - ci.stress) / 9 * 100;
  if (ci.sore != null) p.courbatures = (10 - ci.sore) / 9 * 100;
  if (ci.motiv != null) p.motivation = (ci.motiv - 1) / 9 * 100;
  const ks = Object.keys(p); if (ks.length < 2) return null;
  const w = ks.reduce((t, k) => t + POIDS_CHECKIN[k], 0);
  return { score: Math.round(ks.reduce((t, k) => t + p[k] * POIDS_CHECKIN[k], 0) / w), parts: Object.fromEntries(ks.map(k => [k, Math.round(p[k])])), reponses: ks.length };
}

// ---------- Les séances faites, vues par le calcul ----------
const NERVEUX_NOM = [[/soulev|deadlift|squat|good morning|rack pull/i, 3], [/d[ée]velopp|presse|rowing|traction|hip thrust|dips|fentes|bulgarian|hack|pull-?down|tirage/i, 2]];
export const nerveuxParDefaut = (nom) => (NERVEUX_NOM.find(([re]) => re.test(nom || "")) || [0, 1])[1];
export function lignesDeSeance(w, nerveuxDe = nerveuxParDefaut) {
  return (w.exercises || []).map(ex => {
    const faites = (ex.sets || []).filter(s => s.done); if (!faites.length) return null;
    return { nom: ex.name, kind: ex.kind || "P", nerveux: nerveuxDe(ex.name), rest: ex.rest || 90, unite: ex.unit === "s" ? "s" : "reps", series: faites.map(s => ({ t: s.type, lo: s.reps ?? s.lo, hi: s.reps ?? s.lo, rpe: s.rpe ?? s.trpe ?? null })) };
  }).filter(Boolean);
}
const travaille = (s) => s.done && s.type !== "W";
const dansFenetre = (w, de, a, jourDe) => { const j = jourDe(w.end || w.start); return j >= de && j <= a; };

// Charge brute d'une période (somme INOL + coût nerveux des séances, comme l'indice de difficulté)
export function charge(workouts, de, a, { nerveuxDe = nerveuxParDefaut, jourDe = jourParDefaut } = {}) {
  const ws = workouts.filter(w => w.end && dansFenetre(w, de, a, jourDe));
  const t = ws.reduce((s, w) => { const i = indiceSeance(lignesDeSeance(w, nerveuxDe)); return { inol: s.inol + i.inol, nerveux: s.nerveux + i.nerveux }; }, { inol: 0, nerveux: 0 });
  return { valeur: r1(t.inol + t.nerveux), seances: ws.length };
}
// Ratio : les 7 derniers jours / la moyenne des 4 semaines d'avant. Il faut au moins 2 semaines passées avec des séances.
export function ratioCharge(workouts, auj, opts = {}) {
  const recent = charge(workouts, addJ(auj, -6), auj, opts);
  const avant = [1, 2, 3, 4].map(k => charge(workouts, addJ(auj, -6 - 7 * k), addJ(auj, -7 * k), opts)).filter(x => x.seances > 0);
  if (avant.length < 2) return { ratio: null, recent, habituelle: null, semainesConnues: avant.length };
  const habituelle = moy(avant.map(x => x.valeur));
  return { ratio: habituelle > 0 ? r1(recent.valeur / habituelle) : null, recent, habituelle: r1(habituelle), semainesConnues: avant.length };
}
// Séries lourdes : ≥ 85 % du 1RM estimé ou RPE ≥ 9, sur un mouvement polyarticulaire (coût nerveux ≥ 2)
export function seriesLourdes(workouts, de, a, { nerveuxDe = nerveuxParDefaut, jourDe = jourParDefaut } = {}) {
  let n = 0;
  workouts.filter(w => w.end && dansFenetre(w, de, a, jourDe)).forEach(w => (w.exercises || []).forEach(ex => {
    if (nerveuxDe(ex.name) < 2 || ex.unit === "s" || ex.bw) return;
    (ex.sets || []).filter(travaille).forEach(s => { const rpe = s.rpe ?? s.trpe ?? 8; if (rpe >= 9 || pctDe(s.reps ?? s.lo ?? 8, rpe) >= 85) n++; });
  }));
  return n;
}
// RPE ressenti moins RPE prévu sur les séries faites des 14 derniers jours (à charge prescrite égale) ; il faut au moins 8 séries notées
export function deriveRpe(workouts, auj, { jourDe = jourParDefaut } = {}) {
  const e = [];
  workouts.filter(w => w.end && dansFenetre(w, addJ(auj, -13), auj, jourDe)).forEach(w => (w.exercises || []).forEach(ex => (ex.sets || []).filter(travaille).forEach(s => { if (s.rpe != null && s.trpe != null) e.push(s.rpe - s.trpe); })));
  return e.length >= 8 ? { ecart: r1(moy(e)), series: e.length } : null;
}
// Séries prévues mais pas faites, sur les 14 derniers jours
export function seriesManquees(workouts, auj, { jourDe = jourParDefaut } = {}) {
  let prevues = 0, manquees = 0;
  workouts.filter(w => w.end && dansFenetre(w, addJ(auj, -13), auj, jourDe)).forEach(w => (w.exercises || []).forEach(ex => (ex.sets || []).filter(s => s.type !== "W").forEach(s => { prevues++; if (!s.done) manquees++; })));
  return prevues >= 8 ? { part: r1(manquees / prevues), prevues, manquees } : null;
}
// Baisse de performance : la dernière charge maximale estimée d'un mouvement comparée au meilleur des 28 jours d'avant
export function baissePerformance(lifts, auj) {
  let pire = null;
  Object.entries(lifts || {}).forEach(([nom, h]) => {
    if ((h || []).length < 3) return;
    const der = h.at(-1), avant = h.slice(0, -1).filter(x => x.d >= addJ(auj, -28) && x.d < der.d); if (!avant.length || der.d < addJ(auj, -14)) return;
    const best = Math.max(...avant.map(x => x.e1rm)), baisse = best > 0 ? (best - der.e1rm) / best : 0;
    if (baisse > 0 && (!pire || baisse > pire.baisse)) pire = { nom, baisse: r1(baisse * 100) / 100, pct: Math.round(baisse * 100) };
  });
  return pire;
}
// Sommeil et motivation : les 3 derniers jours comparés aux 7 d'avant
export function tendanceCheckins(daily, auj) {
  const v = (de, a, f) => { const x = []; for (let d = de; d <= a; d = addJ(d, 1)) { const z = f(daily?.[d] || {}); if (z != null) x.push(z); } return x; };
  const lire = { sleep: (x) => x.sleep ?? null, motiv: (x) => x.feel?.motiv ?? null };
  const out = {};
  for (const [k, f] of Object.entries(lire)) { const r = v(addJ(auj, -2), auj, f), p = v(addJ(auj, -9), addJ(auj, -3), f); if (r.length >= 2 && p.length >= 3) out[k] = r1(moy(r) - moy(p)); }
  return out;
}

// ---------- Fatigue nerveuse (0 = aucune, 100 = très élevée) ----------
export function fatigueNerveuse(s) {
  const actifs = [];
  const ajoute = (id, points, texte) => { if (points > 0) actifs.push({ id, points, texte }); };
  if (s.ratio?.ratio != null) ajoute("charge", interp(s.ratio.ratio, [[1.25, 0], [1.4, 18], [1.8, 40], [2.5, 45]]), `Ta charge de la semaine est à ${String(s.ratio.ratio).replace(".", ",")} fois ta moyenne.`);
  if (s.lourdes != null) { const hab = s.lourdesHabituelles; const p = (s.lourdes >= 12 ? 15 : s.lourdes >= 8 ? 8 : 0) + (hab > 0 && s.lourdes >= 1.5 * hab ? 8 : 0); ajoute("lourdes", Math.min(p, 20), `${s.lourdes} séries lourdes cette semaine.`); }
  if (s.baisse) ajoute("performance", interp(s.baisse.pct, [[4, 0], [5, 20], [10, 32], [15, 35]]), `Tes charges de ${s.baisse.nom.toLowerCase()} baissent de ${s.baisse.pct} %.`);
  if (s.rpe) ajoute("rpe", interp(s.rpe.ecart, [[0.4, 0], [0.8, 15], [1.3, 25], [2, 30]]), `Ton effort ressenti dépasse l'effort prévu de ${String(s.rpe.ecart).replace(".", ",")} point${s.rpe.ecart >= 2 ? "s" : ""} à charge égale.`);
  if (s.manquees) ajoute("manquees", interp(s.manquees.part, [[0.1, 0], [0.15, 10], [0.3, 15]]), `${Math.round(s.manquees.part * 100)} % des séries prévues n'ont pas été faites.`);
  if (s.tendance) {
    const dormi = s.tendance.sleep != null && s.tendance.sleep <= -1, motive = s.tendance.motiv != null && s.tendance.motiv <= -2;
    if (dormi || motive) ajoute("tendance", dormi && motive ? 18 : 12, dormi && motive ? "Sommeil et motivation en baisse ces derniers jours." : dormi ? "Tu dors moins que d'habitude depuis quelques jours." : "Ta motivation baisse depuis quelques jours.");
  }
  const score = Math.round(clamp(actifs.reduce((t, x) => t + x.points, 0)));
  return { score, niveau: score >= 50 ? "élevée" : score >= 25 ? "modérée" : "faible", actifs: actifs.sort((a, b) => b.points - a.points) };
}
// Fatigue musculaire locale : séries par pattern sur les 3 derniers jours + courbatures déclarées
export function fatigueLocale(workouts, auj, { patternDe = () => null, jourDe = jourParDefaut } = {}) {
  const par = {};
  workouts.filter(w => w.end && dansFenetre(w, addJ(auj, -2), auj, jourDe)).forEach(w => (w.exercises || []).forEach(ex => {
    const p = patternDe(ex.name); if (!p) return; par[p] = (par[p] || 0) + (ex.sets || []).filter(travaille).length;
  }));
  return Object.entries(par).filter(([, n]) => n >= 6).sort((a, b) => b[1] - a[1]).map(([pattern, series]) => ({ pattern, series }));
}

// ---------- Le feu du jour ----------
// ctx : { auj, checkin ({sleep, sleepQ, energy, stress, sore, motiv}), workouts, lifts, daily, nerveuxDe, patternDe, jourDe }
export function signaux(ctx) {
  const o = { nerveuxDe: ctx.nerveuxDe || nerveuxParDefaut, jourDe: ctx.jourDe || jourParDefaut }, w = ctx.workouts || [], auj = ctx.auj;
  const hab = [1, 2, 3].map(k => seriesLourdes(w, addJ(auj, -6 - 7 * k), addJ(auj, -7 * k), o)), habOk = hab.filter(x => x > 0);
  return { ratio: ratioCharge(w, auj, o), lourdes: seriesLourdes(w, addJ(auj, -6), auj, o), lourdesHabituelles: habOk.length >= 2 ? moy(habOk) : null,
    baisse: baissePerformance(ctx.lifts, auj), rpe: deriveRpe(w, auj, o), manquees: seriesManquees(w, auj, o), tendance: tendanceCheckins(ctx.daily, auj) };
}
export function etat(ctx) {
  const sg = signaux(ctx), fatigue = fatigueNerveuse(sg), sc = ctx.checkin ? scoreCheckin(ctx.checkin) : null;
  const dispo = Math.round(clamp((sc ? sc.score : SANS_CHECKIN) - fatigue.score * PENALITE_FATIGUE));
  let feu = dispo >= SEUILS.vert ? FEUX.vert : dispo >= SEUILS.orange ? FEUX.orange : FEUX.rouge;
  const ci = ctx.checkin || {};
  // Garde-fou : une nuit très courte et une énergie basse ne donnent jamais un feu vert
  if (feu.rang < 2 && ci.sleep > 0 && ci.sleep < 5 && ci.energy != null && ci.energy <= 3) feu = FEUX.orange;
  const raisons = [];
  if (sc) { const p = sc.parts;
    if (p.sommeil != null && p.sommeil < 60) raisons.push(ci.sleep < 6 ? `Nuit courte (${String(r1(ci.sleep)).replace(".", ",")} h).` : "Sommeil de moins bonne qualité.");
    if (p.energie != null && p.energie < 45) raisons.push("Énergie basse ce matin.");
    if (p.stress != null && p.stress < 45) raisons.push("Stress élevé.");
    if (p.courbatures != null && p.courbatures < 45) raisons.push("Courbatures importantes.");
    if (p.motivation != null && p.motivation < 40) raisons.push("Motivation basse."); }
  fatigue.actifs.slice(0, 2).forEach(a => raisons.push(a.texte));
  if (!raisons.length) raisons.push(feu.id === "vert" ? (sc ? "Tout va bien : tu peux suivre ta séance comme prévu." : "Rien d'inquiétant dans tes dernières séances.") : "Plusieurs petits signaux de fatigue s'additionnent.");
  const conseil = { vert: "Séance comme prévue. Écoute-toi, et profite de la forme.", orange: `Version allégée : environ un quart de séries en moins, effort plafonné à RPE ${vir(ALLEGEMENT.orange.rpe)}. Tu gardes les mouvements.`, rouge: `Aujourd'hui : repos actif (marche, mobilité) ou une séance courte, effort plafonné à RPE ${vir(ALLEGEMENT.rouge.rpe)}.` }[feu.id];
  return { v: VERSION, feu, disponibilite: dispo, checkin: sc, signaux: sg, fatigue, locale: fatigueLocale(ctx.workouts || [], ctx.auj, { patternDe: ctx.patternDe, jourDe: ctx.jourDe }), raisons: raisons.slice(0, 3), conseil, confiance: sc ? (sg.ratio.ratio != null ? "bonne" : "moyenne") : "à affiner" };
}

// ---------- Plusieurs jours rouges : proposer une semaine de décharge ----------
// feux : { 'YYYY-MM-DD': 'vert' | 'orange' | 'rouge' } (jours avec check-in)
export function dechargeConseillee(feux, auj, { actuelle = null, refusLe = null, fatigue = null } = {}) {
  if (actuelle && actuelle.fin >= auj) return { propose: false, raison: "décharge en cours" };
  if (refusLe && refusLe >= addJ(auj, -1)) return { propose: false, raison: "refusée récemment" };
  const j5 = [0, 1, 2, 3, 4].map(k => feux?.[addJ(auj, -k)]).filter(Boolean), rouges = j5.filter(f => f === "rouge").length;
  const deSuite = feux?.[auj] === "rouge" && feux?.[addJ(auj, -1)] === "rouge";
  const ok = rouges >= 3 || (deSuite && fatigue?.niveau === "élevée");
  return { propose: ok, rouges, sur: j5.length, raison: ok ? `${rouges} jour${rouges > 1 ? "s" : ""} rouge${rouges > 1 ? "s" : ""} sur ${j5.length}${deSuite && fatigue?.niveau === "élevée" ? ", fatigue nerveuse élevée" : ""}` : "" };
}
export const finDecharge = (debut, jours = 7) => addJ(debut, jours - 1);
export const dechargeActive = (d, auj) => !!d && d.debut <= auj && d.fin >= auj;
export const cadenceDecharge = (niveau) => CADENCE_DECHARGE[niveau] || 6;

// ---------- Version allégée d'une séance en cours de préparation ----------
// séance : objet de js/engine.js (buildSession) : exercises[].sets[] avec { type, kg, reps, lo, trpe, done }
// mode : 'orange' | 'rouge' | 'decharge'. Ne modifie pas l'original.
export function adapterSeance(seance, mode) {
  const cfg = ALLEGEMENT[mode]; if (!cfg) return { seance, resume: null };
  const s = JSON.parse(JSON.stringify(seance)); let avant = 0, apres = 0, rpeMax = 0;
  s.exercises = s.exercises.map(ex => {
    const travail = ex.sets.filter(x => x.type !== "W"), n = travail.length; avant += n;
    const garde = Math.min(n, Math.max(cfg.plancher, Math.round(n * (1 - cfg.retire))));
    let k = 0;
    ex.sets = ex.sets.filter(x => x.type === "W" || k++ < garde).map(x => {
      if (x.type === "W") return x;
      const y = { ...x, type: ["D", "A"].includes(x.type) ? "N" : x.type, tech: (x.tech || []).filter(t => !/échec|forcé|dropset/i.test(t)) };
      const cible = y.trpe || 8;
      if (cible > cfg.rpe) { const f = pctDe(y.reps || y.lo || 8, cfg.rpe) / pctDe(y.reps || y.lo || 8, cible); if (y.kg) y.kg = Math.round(y.kg * f / (ex.step || 2.5)) * (ex.step || 2.5); y.pct = y.pct ? Math.round(y.pct * f) : y.pct; y.trpe = cfg.rpe; }
      rpeMax = Math.max(rpeMax, y.trpe || 0); apres++; return y;
    });
    return ex;
  }).filter(ex => ex.sets.some(x => x.type !== "W"));
  s.allege = mode; s.allegeNote = `Version allégée : ${apres} séries au lieu de ${avant}, effort plafonné à RPE ${vir(cfg.rpe)}.`;
  return { seance: s, resume: { avant, apres, rpe: cfg.rpe, mode } };
}

// ---------- Rappel de coucher lié à l'agenda (spec §6.3) ----------
// demain : { time: 'HH:MM' } de la séance du lendemain (ou null) ; reglages : { lever, coucher, trajet } ; sommeilVise (minutes)
const min = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return (a || 0) * 60 + (b || 0); };
const hhmm = (m) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
export function rappelCoucher({ demain, reglages, sommeilVise, trajet = 0, preparation = 60 }) {
  const lever = min(reglages.lever), habituel = min(reglages.coucher), h = String(Math.round(sommeilVise / 6) / 10).replace(".", ",");
  const soir = (m) => { const x = ((m % 1440) + 1440) % 1440; return x >= 12 * 60 ? x : x + 1440; }; // le soir avant minuit < après minuit
  if (!demain?.time || min(demain.time) < 4 * 60) return { heure: hhmm(habituel),   // pas de séance, ou une heure peu plausible (avant 4 h)
    texte: `Ce soir, couche-toi vers ${hhmm(habituel)} pour viser ${h} h de sommeil.`, avance: false };
  const reveil = Math.min(lever, min(demain.time) - trajet - preparation), coucher = reveil - sommeilVise, avance = soir(coucher) < soir(habituel) - 14;
  return { heure: hhmm(coucher), reveil: hhmm(reveil), avance, texte: avance ? `Demain, séance à ${demain.time} : lève-toi à ${hhmm(reveil)} et couche-toi avant ${hhmm(coucher)} pour garder ${h} h de sommeil.` : `Demain, séance à ${demain.time} : ton coucher habituel (${hhmm(habituel)}) te laisse tes ${h} h de sommeil.` };
}

// ---------- Pour le coach : le dernier feu et le nombre de jours rouges (les jours sans check-in ne comptent pas) ----------
export function resume(daily, auj, { decharge = null } = {}) {
  const feux = Object.entries(daily || {}).filter(([d, v]) => v?.feu && d <= auj && d >= addJ(auj, -6)).sort((a, b) => a[0].localeCompare(b[0]));
  if (!feux.length) return null;
  const dernier = feux.at(-1), j5 = feux.filter(([d]) => d >= addJ(auj, -4));
  return { feu: dernier[1].feu, d: dernier[0], rouges: j5.filter(([, v]) => v.feu === "rouge").length, sur: j5.length, decharge: dechargeActive(decharge, auj) };
}
