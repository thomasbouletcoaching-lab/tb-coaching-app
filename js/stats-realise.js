// Statistiques sur le RÉALISÉ (décision C72) : volume par muscle face aux repères MV / MEV / MAV / MRV, équilibre entre
// parties du corps et patterns, prévu face à fait, surcharge progressive et « stimulus » par muscle.
// Module pur : testé par `node --test tests/stats-realise.test.mjs`. Les fonctions de lecture (muscles et pattern d'un
// exercice, jour d'une séance) sont passées en paramètres.
// Seules les séries faites comptent, échauffements exclus. Séries effectives : muscle principal 1, secondaires ½ (js/volume.js).
import * as V from "./volume.js";

export const VERSION = 1;
const r1 = (x) => Math.round(x * 10) / 10;
const moy = (a) => a.length ? a.reduce((t, x) => t + x, 0) / a.length : null;
export const addJ = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const nbJours = (de, a) => Math.round((new Date(a + "T12:00:00") - new Date(de + "T12:00:00")) / 864e5) + 1;
const jourParDefaut = (iso) => String(iso || "").slice(0, 10);
const travail = (s) => s.type !== "W";
const faite = (s) => s.done && travail(s);

// ---------- Patterns : le catalogue d'abord (patternDe), sinon le nom ----------
export const PATTERNS = [["PH", "Poussée horizontale", "haut"], ["PV", "Poussée verticale", "haut"], ["TH", "Tirage horizontal", "haut"], ["TV", "Tirage vertical", "haut"],
  ["SG", "Squat genou", "bas"], ["SH", "Squat hanche", "bas"], ["CH", "Charnière", "bas"], ["FG", "Flexion de genou", "bas"]];
const PAT_NOM = [
  ["TV", /traction|pull.?up|chin.?up|tirage (vertical|poitrine|nuque)|lat ?pull|pulldown/i],
  ["CH", /soulev[ée]|deadlift|good morning|roumain|rack pull|hip thrust|pont fessier|kettlebell swing/i],
  ["TH", /rowing|\brow\b|tirage horizontal|seated row|\bt-?bar\b|tirage (assis|buste)/i],
  ["PV", /d[ée]velopp[ée] (militaire|[ée]paules|arnold|nuque)|overhead|push press|shoulder press|\bohp\b|landmine/i],
  ["PH", /d[ée]velopp[ée]|bench|pompe|push.?up|chest press|dips|floor press/i],
  ["FG", /leg curl|curl (ischio|jambe)|nordic|glute.?ham/i],
  ["SG", /squat|presse (à|a) cuisses|leg press|fente|lunge|bulgar|hack|step.?up/i],
];
export const patternParNom = (nom) => (PAT_NOM.find(([, re]) => re.test(nom || "")) || [null])[0];

// ---------- Lecture des séances d'une période ----------
function seancesDe(workouts, de, a, jourDe = jourParDefaut) {
  return (workouts || []).filter(w => w.end && !w.cardio).filter(w => { const j = jourDe(w.end || w.start); return j >= de && j <= a; });
}
export function semainesDe(de, a) { return Math.max(1, nbJours(de, a)) / 7; }

// ---------- 1. Volume par muscle, avec la zone MV / MEV / MAV / MRV ----------
// musclesDe(nom) -> [{ g: id du groupe (js/volume.js), c: coefficient }]
export function musclesParVolume(nom, musclesOf, fx = null) {
  const out = {};
  V.faisceauxOf(nom, musclesOf, fx).forEach(({ f, c }) => { const g = V.groupOf(f); if (g) out[g.id] = Math.max(out[g.id] || 0, c); });
  return Object.entries(out).map(([g, c]) => ({ g, c }));
}
export function zone(v, L) {
  if (v > L.mrv) return { id: "trop", nom: "Au-delà du MRV", rang: 5 };
  if (v >= L.mav[1]) return { id: "haut", nom: "Haut de zone", rang: 4 };
  if (v >= L.mav[0]) return { id: "optimal", nom: "Zone optimale", rang: 3 };
  if (v >= L.mev && L.mev > 0) return { id: "progression", nom: "Progression", rang: 2 };
  if (v >= L.mv && L.mv > 0) return { id: "maintien", nom: "Maintien", rang: 1 };
  if (L.mev === 0 && v > 0) return { id: "progression", nom: "Progression", rang: 2 };
  return { id: "sous", nom: v > 0 ? "Sous le maintien" : "Pas travaillé", rang: 0 };
}
export function volumeParMuscle(workouts, de, a, { musclesDe, lm = V.landmarks(), jourDe } = {}) {
  const sem = semainesDe(de, a), tot = {};
  seancesDe(workouts, de, a, jourDe).forEach(w => (w.exercises || []).forEach(ex => {
    const n = (ex.sets || []).filter(faite).length; if (!n) return;
    musclesDe(ex.name).forEach(({ g, c }) => { tot[g] = (tot[g] || 0) + n * c; });
  }));
  return V.GROUPS.map(g => { const L = lm[g.id], v = r1((tot[g.id] || 0) / sem); return { id: g.id, nom: g.n, parSem: v, total: r1(tot[g.id] || 0), lm: L, zone: zone(v, L), indicatif: !!g.ind }; });
}

// ---------- 2. Équilibre : patterns et parties du corps ----------
export function seriesParPattern(workouts, de, a, { patternDe = patternParNom, jourDe } = {}) {
  const sem = semainesDe(de, a), out = Object.fromEntries(PATTERNS.map(([c]) => [c, 0]));
  seancesDe(workouts, de, a, jourDe).forEach(w => (w.exercises || []).forEach(ex => {
    const p = patternDe(ex.name) || patternParNom(ex.name); if (!p || !(p in out)) return;
    out[p] += (ex.sets || []).filter(faite).length;
  }));
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, r1(v / sem)]));
}
// Repères indicatifs (littérature et pratique) : tirage ≥ poussée, arrière de la cuisse proche de l'avant, deltoïde postérieur ≥ antérieur
export const REPERES = { tirage: [1, 1.5], cuisse: [0.7, 1.3], epaule: [1, 2], hautBas: [0.6, 1.6] };
function ratio(a, b, rep, nom, texteA, texteB) {
  const r = b > 0 ? r1(a / b) : a > 0 ? null : null;
  const etat = r == null ? (a + b > 0 ? "desequilibre" : "inconnu") : r < rep[0] ? "bas" : r > rep[1] ? "haut" : "ok";
  return { nom, a: r1(a), b: r1(b), ratio: r, repere: rep, etat, texteA, texteB };
}
export function equilibre(workouts, de, a, { musclesDe, patternDe, lm, jourDe } = {}) {
  const pat = seriesParPattern(workouts, de, a, { patternDe, jourDe }), mus = Object.fromEntries(volumeParMuscle(workouts, de, a, { musclesDe, lm, jourDe }).map(m => [m.id, m.parSem]));
  const haut = pat.PH + pat.PV + pat.TH + pat.TV, bas = pat.SG + pat.SH + pat.CH + pat.FG;
  return {
    patterns: pat,
    ratios: [
      ratio(pat.TH + pat.TV, pat.PH + pat.PV, REPERES.tirage, "Tirage / poussée", "Tirage", "Poussée"),
      ratio(mus.isch + mus.fess, mus.quad, REPERES.cuisse, "Arrière / avant de la cuisse", "Ischios + fessiers", "Quadriceps"),
      ratio(mus.dpost, mus.dant, REPERES.epaule, "Épaule arrière / avant", "Deltoïde postérieur", "Deltoïde antérieur"),
      ratio(bas, haut, REPERES.hautBas, "Bas / haut du corps", "Bas du corps", "Haut du corps"),
    ],
  };
}

// ---------- 3. Prévu et fait ----------
// seancesPrevues : nombre de séances au planning sur la période (agenda), facultatif
export function prevuFait(workouts, de, a, { musclesDe, patternDe = patternParNom, jourDe, seancesPrevues = null } = {}) {
  const ws = seancesDe(workouts, de, a, jourDe), mus = {}, pat = {}, ex = {};
  let prevues = 0, faites = 0, kgP = [], repsBas = 0, repsDans = 0, repsHaut = 0, rpe = [];
  ws.forEach(w => (w.exercises || []).forEach(e => {
    const t = (e.sets || []).filter(travail); if (!t.length) return;
    const f = t.filter(s => s.done);
    prevues += t.length; faites += f.length;
    const x = ex[e.name] = ex[e.name] || { nom: e.name, prevues: 0, faites: 0 }; x.prevues += t.length; x.faites += f.length;
    (musclesDe ? musclesDe(e.name) : []).forEach(({ g, c }) => { const m = mus[g] = mus[g] || { prevues: 0, faites: 0 }; m.prevues += t.length * c; m.faites += f.length * c; });
    const p = patternDe(e.name) || patternParNom(e.name); if (p) { const q = pat[p] = pat[p] || { prevues: 0, faites: 0 }; q.prevues += t.length; q.faites += f.length; }
    f.forEach(s => {
      if (s.pkg > 0 && s.kg > 0 && e.unit !== "s") kgP.push(s.kg / s.pkg);
      const lo = s.lo ?? s.reps, hi = s.hi ?? lo;
      if (s.reps != null && lo != null) { if (s.reps < lo) repsBas++; else if (s.reps > hi) repsHaut++; else repsDans++; }
      if (s.rpe != null && s.trpe != null) rpe.push(s.rpe - s.trpe);
    });
  }));
  const pc = (x, y) => y > 0 ? Math.round(x / y * 100) : null, rep = repsBas + repsDans + repsHaut;
  const ecarts = Object.entries(mus).map(([g, m]) => ({ g, nom: V.groupById(g)?.n || g, prevues: r1(m.prevues), faites: r1(m.faites), pct: pc(m.faites, m.prevues) }))
    .filter(m => m.prevues >= 2 && m.pct < 85).sort((x, y) => x.pct - y.pct);
  return {
    seances: { faites: ws.length, prevues: seancesPrevues, pct: seancesPrevues ? pc(ws.length, seancesPrevues) : null },
    series: { faites, prevues, pct: pc(faites, prevues) },
    muscles: mus, patterns: pat, exercices: Object.values(ex).sort((x, y) => (x.faites / x.prevues) - (y.faites / y.prevues)),
    ecarts,
    charge: kgP.length >= 3 ? { pct: Math.round(moy(kgP) * 100), series: kgP.length } : null,
    reps: rep >= 3 ? { sous: pc(repsBas, rep), dans: pc(repsDans, rep), audessus: pc(repsHaut, rep), series: rep } : null,
    rpe: rpe.length >= 3 ? { ecart: r1(moy(rpe)), series: rpe.length } : null,
  };
}

// ---------- 4. Surcharge progressive ----------
// 1RM estimé d'une série : Epley, avec les reps en réserve si le RPE est noté (RPE 8 = 2 reps en réserve)
export const e1rm = (kg, reps, rpe = null) => kg > 0 && reps > 0 ? kg * (1 + (reps + (rpe != null && rpe >= 5 ? Math.max(0, 10 - rpe) : 0)) / 30) : 0;
// Une ligne par séance pour un exercice : meilleure e1RM, charge max, reps à cette charge, tonnage, séries, reps totales, RPE moyen
export function historiqueExercice(workouts, nom, { jourDe = jourParDefaut } = {}) {
  return (workouts || []).filter(w => w.end).flatMap(w => (w.exercises || []).filter(e => e.name === nom).map(e => {
    const f = (e.sets || []).filter(faite); if (!f.length) return null;
    const charge = e.unit !== "s" && f.some(s => s.kg > 0) && !e.bw;
    const top = charge ? Math.max(...f.map(s => s.kg || 0)) : 0;
    return { d: jourDe(w.end), e1rm: charge ? r1(Math.max(...f.map(s => e1rm(s.kg || 0, s.reps || 0, s.rpe)))) : 0, top,
      repsTop: charge ? Math.max(...f.filter(s => s.kg === top).map(s => s.reps || 0)) : Math.max(...f.map(s => s.reps || 0)),
      tonnage: Math.round(f.reduce((t, s) => t + (s.kg || 0) * (s.reps || 0), 0)), series: f.length, reps: f.reduce((t, s) => t + (s.reps || 0), 0),
      rpe: moy(f.filter(s => s.rpe != null).map(s => s.rpe)), charge };
  }).filter(Boolean)).sort((x, y) => x.d.localeCompare(y.d));
}
// Verdict d'un exercice : 3 dernières semaines face aux 3 d'avant. Progresse si un indicateur monte (e1RM +2 %, reps à la
// même charge, tonnage +5 % ou une série de plus), régresse si l'e1RM baisse de plus de 3 %, sinon stable ; « stagne »
// quand le meilleur e1RM date de plus de 3 semaines avec au moins 3 séances depuis.
export const SEUILS_SURCHARGE = { e1rm: 0.02, baisse: 0.03, tonnage: 0.05, fenetre: 21, stagne: 21 };
export function verdictExercice(h, auj) {
  const S = SEUILS_SURCHARGE, rec = h.filter(x => x.d > addJ(auj, -S.fenetre) && x.d <= auj), av = h.filter(x => x.d > addJ(auj, -2 * S.fenetre) && x.d <= addJ(auj, -S.fenetre));
  if (!rec.length || !av.length) return { id: "inconnu", nom: "Pas assez de recul", signes: [], rec: rec.length, av: av.length };
  const m = (l, k) => moy(l.map(x => x[k])), best = (l, k) => Math.max(...l.map(x => x[k])), signes = [];
  const charge = rec.some(x => x.charge) && av.some(x => x.charge);
  const eR = charge ? best(rec, "e1rm") : 0, eA = charge ? best(av, "e1rm") : 0;
  if (charge && eA > 0 && eR >= eA * (1 + S.e1rm)) signes.push(`1RM estimé +${Math.round((eR / eA - 1) * 100)} %`);
  const topA = best(av, "top"), memeCharge = rec.filter(x => x.top >= topA && topA > 0);
  if (charge && memeCharge.length && Math.max(...memeCharge.map(x => x.repsTop)) > Math.max(...av.filter(x => x.top === topA).map(x => x.repsTop))) signes.push(`plus de reps à ${String(topA).replace(".", ",")} kg`);
  if (charge && best(rec, "top") > topA) signes.push(`charge max ${String(topA).replace(".", ",")} → ${String(best(rec, "top")).replace(".", ",")} kg`);
  if (!charge && best(rec, "repsTop") > best(av, "repsTop")) signes.push(`reps max ${best(av, "repsTop")} → ${best(rec, "repsTop")}`);
  const tR = m(rec, "tonnage"), tA = m(av, "tonnage"); if (tA > 0 && tR >= tA * (1 + S.tonnage)) signes.push(`tonnage par séance +${Math.round((tR / tA - 1) * 100)} %`);
  if (m(rec, "series") >= m(av, "series") + 1) signes.push("une série de plus par séance");
  if (charge && eA > 0 && eR < eA * (1 - S.baisse) && !signes.length) return { id: "regresse", nom: "Régresse", signes: [`1RM estimé −${Math.round((1 - eR / eA) * 100)} %`], rec: rec.length, av: av.length };
  if (signes.length) return { id: "progresse", nom: "Progresse", signes, rec: rec.length, av: av.length };
  const cle = charge ? "e1rm" : "repsTop", bestAll = Math.max(...h.map(x => x[cle])), dBest = h.filter(x => x[cle] === bestAll)[0].d, depuis = h.filter(x => x.d > dBest).length;
  if (dBest <= addJ(auj, -S.stagne) && depuis >= 3) return { id: "stagne", nom: `Stagne depuis ${Math.floor(nbJours(dBest, auj) / 7)} semaines`, signes: [], rec: rec.length, av: av.length };
  return { id: "stable", nom: "Stable", signes: [], rec: rec.length, av: av.length };
}
export function surcharge(workouts, auj, { jourDe } = {}) {
  const noms = [...new Set((workouts || []).filter(w => w.end && (jourDe || jourParDefaut)(w.end) > addJ(auj, -42)).flatMap(w => (w.exercises || []).filter(e => (e.sets || []).some(faite)).map(e => e.name)))];
  return noms.map(nom => { const h = historiqueExercice(workouts, nom, { jourDe }); return { nom, h, verdict: verdictExercice(h, auj), conseil: null }; })
    .map(x => ({ ...x, conseil: conseilExercice(x) }))
    .sort((x, y) => ORDRE_V[x.verdict.id] - ORDRE_V[y.verdict.id] || y.h.length - x.h.length);
}
const ORDRE_V = { regresse: 0, stagne: 1, stable: 2, progresse: 3, inconnu: 4 };
function conseilExercice({ verdict, h }) {
  const d = h.at(-1);
  if (verdict.id === "stagne" || verdict.id === "stable") return d?.charge ? `Vise une rep de plus par série ; au haut de ta fourchette, +2,5 kg.` : "Vise une rep de plus par série, ou ralentis la descente (3 s).";
  if (verdict.id === "regresse") return "Vérifie sommeil et récupération ; garde la charge et vise la qualité, ou prévois une semaine plus légère.";
  return null;
}

// ---------- 5. Stimulus par muscle : volume, intensité, progression ----------
// volume : séries effectives entre MEV et MRV ; intensité : au moins 2/3 des séries à RPE 7 ou plus (3 reps en réserve ou
// moins ; RPE prévu si le ressenti n'est pas noté) ; progression : un exercice dont c'est le muscle principal progresse.
export const PART_INTENSE = 2 / 3;
export function stimulus(workouts, auj, { musclesDe, lm = V.landmarks(), jourDe, semaines = 3 } = {}) {
  const de = addJ(auj, -7 * semaines + 1), vol = volumeParMuscle(workouts, de, auj, { musclesDe, lm, jourDe }), sc = surcharge(workouts, auj, { jourDe });
  const intens = {};
  seancesDe(workouts, de, auj, jourDe).forEach(w => (w.exercises || []).forEach(e => {
    const f = (e.sets || []).filter(faite), prim = musclesDe(e.name).find(x => x.c === 1); if (!prim || !f.length) return;
    const t = intens[prim.g] = intens[prim.g] || { dur: 0, n: 0 };
    f.forEach(s => { const r = s.rpe ?? s.trpe; if (r == null) return; t.n++; if (r >= 7) t.dur++; });
  }));
  return vol.filter(m => m.total > 0).map(m => {
    const L = m.lm, okVol = m.parSem >= Math.max(L.mev, 1) && m.parSem <= L.mrv;
    const it = intens[m.id], okInt = it && it.n >= 3 ? it.dur / it.n >= PART_INTENSE : null;
    const exos = sc.filter(x => musclesDe(x.nom).some(y => y.g === m.id && y.c === 1));
    const prog = exos.filter(x => x.verdict.id === "progresse"), connus = exos.filter(x => x.verdict.id !== "inconnu");
    const okProg = connus.length ? prog.length > 0 : null;
    const manque = [];
    if (!okVol) manque.push(m.parSem < Math.max(L.mev, 1) ? `+${Math.ceil(Math.max(L.mev, 1) - m.parSem)} série${Math.ceil(Math.max(L.mev, 1) - m.parSem) > 1 ? "s" : ""} par semaine (MEV ${L.mev})` : `−${Math.ceil(m.parSem - L.mrv)} série${Math.ceil(m.parSem - L.mrv) > 1 ? "s" : ""} par semaine : au-delà de ce qui se récupère (MRV ${L.mrv})`);
    if (okInt === false) manque.push("séries plus proches de l'échec : RPE 7 à 9 (1 à 3 reps en réserve)");
    if (okProg === false) manque.push("faire progresser un exercice : +1 rep ou +2,5 kg");
    const crit = [okVol, okInt, okProg], oui = crit.filter(x => x === true).length, connu = crit.filter(x => x !== null).length;
    const id = connu === 0 ? "inconnu" : oui === connu ? "ok" : oui >= connu - 1 && oui > 0 ? "partiel" : "non";
    return { id: m.id, nom: m.nom, parSem: m.parSem, lm: L, volume: okVol, intensite: okInt, progression: okProg, part: it && it.n ? Math.round(it.dur / it.n * 100) : null,
      exercices: exos.map(x => ({ nom: x.nom, verdict: x.verdict.id })), manque,
      verdict: { ok: "✅ Stimulus envoyé", partiel: "〰️ Stimulus partiel", non: "❌ Pas assez de raisons de progresser", inconnu: "Pas assez de recul" }[id], etat: id };
  }).sort((a, b) => ({ non: 0, partiel: 1, ok: 2, inconnu: 3 })[a.etat] - ({ non: 0, partiel: 1, ok: 2, inconnu: 3 })[b.etat]);
}
