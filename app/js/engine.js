// Moteur d'entraînement : programmes (Méthode Thomas Boulet + programmes perso), charges calculées,
// surcharge progressive ajustée au réel (RPE), agenda, volume, alertes.
import { S, update, today } from "./store.js";

let PROG = null, FICHES = null, LIB = null;
export async function loadPrograms() { if (!PROG) PROG = await (await fetch("data/programs.json")).json(); return PROG; }
export async function loadFiches() { if (!FICHES) { try { FICHES = await (await fetch("data/fiches.json")).json(); } catch { FICHES = { ex: {}, fam: {}, svg: {} }; } } return FICHES; }
export async function loadLib() { if (!LIB) { try { LIB = await (await fetch("data/lib.json")).json(); } catch { LIB = { BASE: [] }; } } return LIB; }
// Ajouts du coach (bibliothèque partagée) : programmes, exercices, vidéos
export const extra = { programs: [], exercises: {}, videos: {} };
export const videoOf = (name) => extra.videos[name] || extra.exercises[name]?.video || null;
export const programs = () => [...(PROG?.P || []), ...extra.programs.filter(p => !(PROG?.P || []).some(x => x.id === p.id)), ...(S().customPrograms || [])];
export const program = (id) => programs().find(p => p.id === id) || null;
export const fiches = () => FICHES;
export const lib = () => LIB;

export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const DAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
export const KIND_LABEL = { F: "Force", S: "Secondaire", P: "Principal", I: "Isolation", C: "Gainage", A: "Accessoire", N: "Street", K: "Activation", M: "Mobilité", G: "Gainage", R: "Rééducation", U: "Unilatéral", J: "Renfort", X: "Perso" };
const REST = { F: 180, N: 150, S: 120, P: 120, A: 90, U: 90, J: 90, I: 75, G: 60, C: 60, R: 60, K: 45, M: 30, X: 120 };

// Types de séries et techniques d'intensification
export const SET_TYPES = { N: "Normale", W: "Échauffement", T: "Top set", B: "Back-off", D: "Dégressive", A: "AMRAP", E: "À l'échec" };
export const TECHS = [
  ["♨️", "Échauffement"], ["📶", "Montée en gamme"], ["💀", "À l'échec"], ["🔻", "Dropset"], ["⏱️", "Rest-pause"], ["🔁", "Myo-reps"],
  ["🧩", "Cluster"], ["🔀", "Dropset mécanique"], ["✂️", "Partielles"], ["🤝", "Reps forcées"], ["⬇️", "Négatives"], ["🐢", "Excentrique lent"],
  ["🛑", "Pause à chaque rep"], ["⏸️", "Isométrie"], ["½", "Reps et demie"], ["7️⃣", "Série 21 (7-7-7)"], ["😈", "Reps trichées"],
  ["🔗", "Enchaînée (superset, pré-fatigue)"], ["🩸", "Occlusion (BFR)"],
];

// ---------- Choix du programme ----------
export function pickProgram(p) {
  if (p.backPain) return "tb-dos4";
  const adv = p.level === "advanced", beg = p.level === "beginner" || p.level === "comeback";
  if (beg) return p.days <= 2 ? "tb-rep2" : "tb-rep3";
  if (p.discipline === "streetlifting") return adv ? "tb-ml4" : "tb-pb4";
  if (p.discipline === "powerbuilding") return adv ? "tb-pb4" : "tb-int4";
  if (p.discipline === "powerlifting") return adv ? "tb-ml4" : "tb-pb4";
  if (p.days <= 2) return "tb-rep2";
  if (p.days === 3) return "tb-int3";
  if (p.days >= 5 && adv) return "tb-adv5";
  return "tb-int4";
}
export function weeksOf(p) { if (p.weeks) return p.weeks; if (p.custom) return 8; const sc = PROG.SC[p.sc]; return sc[Object.keys(sc)[0]].length; }
export function phaseOf(p, w) {
  if (p.phases?.[w - 1]) return p.phases[w - 1] === "Deload" ? "Allègement" : p.phases[w - 1];
  if (p.custom || p.weeks) return isDeload(p, w) ? "Allègement" : "Bloc perso";
  return (p.ph || PROG.PH)[w - 1] || "";
}
export function schemeFor(p, row, week) {
  const kind = row[1];
  if (row[5] && (Array.isArray(row[5].sets) || typeof row[5].sets === "number")) return setsTxt(weekPlan(row[5], week, p).sets) || "–";
  if (p.custom) return "3x8-12 RPE8";
  const sc = PROG.SC[p.sc];
  return (sc[kind] || sc.I || ["3x8-12 RPE8"])[week - 1] || "3x8-12 RPE8";
}

// ---------- Prescription série par série, règles de surcharge, cycle écrit à l'avance ----------
// row[5] = { sets: [{ t, lo, hi, rpe, pct, kg, tech }], rest, prog: { load, step, every, addSet, reps }, weeks: { [semaine]: [séries] }, tempoW: { [semaine]: "3-1-1" }, techW: { [semaine]: [techniques] } }
// load : "auto" (selon le RPE ressenti), "pct" (+step % du 1RM), "kg" (+step kg), "rpe" (+step de RPE), toutes les « every » semaines.
export const DEF_PROG = { load: "auto", step: 2.5, every: 1, addSet: null, reps: null };
export const LOAD_MODES = [["auto", "Automatique (selon ton RPE)"], ["pct", "+ % du 1RM"], ["kg", "+ kg"], ["rpe", "+ RPE"]];
export function migrateRow(x) {
  if (!x) return x;
  if (typeof x.sets === "number") {
    const n = x.sets; x.sets = Array.from({ length: n }, () => ({ t: "N", lo: x.lo || 8, hi: x.hi || x.lo || 12, rpe: x.rpe || 8, pct: x.pct || null, kg: null, tech: [...(x.tech || [])] }));
    delete x.lo; delete x.hi; delete x.rpe; delete x.pct; x.tech = [];
  }
  if (!x.prog) x.prog = { ...DEF_PROG };
  return x;
}
export function isDeload(p, w) { const d = p?.deload; if (p?.phases?.[w - 1]) return p.phases[w - 1] === "Deload"; if (!d) return false; if (d.w?.length) return d.w.includes(w); return d.every ? w % d.every === 0 : false; }
const cpSet = (s) => ({ t: "N", tech: [], ...s, tech: [...(s.tech || [])] });
export function weekPlan(x, w, p = null) {
  x = migrateRow(x);
  const pr = x.prog || DEF_PROG, deload = isDeload(p, w), test = p?.phases?.[w - 1] === "Test";
  let sets;
  if (x.weeks?.[w]) sets = x.weeks[w].map(cpSet);
  else {
    let steps = 0; for (let k = 1; k < w; k++) if (!isDeload(p, k) && p?.phases?.[k - 1] !== "Test") steps++;
    const n = Math.floor(steps / Math.max(1, pr.every || 1));
    sets = (x.sets || []).map(cpSet);
    const work = (s) => s.t !== "W";
    if (pr.load === "pct") sets.forEach(s => { if (s.pct && work(s)) s.pct = Math.round((s.pct + pr.step * n) * 10) / 10; });
    if (pr.load === "kg") sets.forEach(s => { if (s.kg && work(s)) s.kg = Math.round((s.kg + pr.step * n) * 100) / 100; });
    if (pr.load === "rpe") sets.forEach(s => { if (s.rpe && work(s)) s.rpe = Math.min(10, Math.round((s.rpe + pr.step * n) * 2) / 2); });
    if (pr.reps?.every) { const k = Math.floor(steps / pr.reps.every); sets.forEach(s => { if (!work(s)) return; s.lo = Math.max(pr.reps.min || 1, s.lo + pr.reps.delta * k); s.hi = Math.max(s.lo, (s.hi || s.lo) + pr.reps.delta * k); }); }
    // séries ajoutées : seulement pendant l'accumulation quand le programme a des phases
    let acc = 0; for (let k = 1; k < w; k++) if (!isDeload(p, k) && (!p?.phases?.length || p.phases[k - 1] === "Accumulation")) acc++;
    if (pr.addSet?.every) { const k = Math.floor(acc / pr.addSet.every), cur = sets.filter(work).length, max = pr.addSet.max || 99; for (let i = 0; i < k && cur + i < max; i++) { const l = sets.filter(work).at(-1); if (l) sets.push(cpSet({ ...l, t: l.t === "T" ? "B" : l.t })); } }
    const top = test && sets.find(s => work(s) && s.pct);
    if (top) sets = [...sets.filter(s => !work(s)), { t: "T", lo: 1, hi: 1, rpe: 9.5, pct: null, kg: null, tech: [], note: "Test : monte par paliers jusqu'à un single propre" }];
    if ((deload || test) && !top) { const keep = Math.max(1, Math.ceil(sets.filter(work).length * .6)); let c = 0; sets = sets.filter(s => !work(s) || c++ < keep).map(s => !work(s) ? s : { ...s, pct: s.pct ? Math.round(s.pct * .88) : s.pct, kg: s.kg ? Math.round(s.kg * .88 * 4) / 4 : s.kg, rpe: s.rpe ? Math.max(5, s.rpe - 2) : s.rpe, tech: [] }); }
  }
  const tech = x.techW?.[w]; if (tech?.length) sets.forEach(s => { if (s.t !== "W") s.tech = [...new Set([...(s.tech || []), ...tech])]; });
  return { sets, tempo: x.tempoW?.[w] || null, deload, test, custom: !!x.weeks?.[w] };
}
export function setsTxt(sets) {
  const g = []; (sets || []).filter(s => s.t !== "W").forEach(s => { const k = `${s.t}|${s.lo}|${s.hi}|${s.pct}|${s.kg}|${s.rpe}`; const l = g.at(-1); if (l && l.k === k) l.n++; else g.push({ k, n: 1, s }); });
  return g.map(({ n, s }) => `${n}x${s.lo}${s.hi && s.hi !== s.lo ? "-" + s.hi : ""}${s.pct ? "@" + s.pct + "%" : ""}${s.kg ? "@" + fmtKg(s.kg) + "kg" : ""}${s.rpe ? " RPE" + s.rpe : ""}${s.t === "A" ? " AMRAP" : s.t === "D" ? " DS" : ""}`).join(" + ");
}
// "1x5@80% + 3x8@70%", "3x8-10 RPE8", "1x5@76.5%@RPE9", "4x6@60kg RPE8", "3x10 DS" -> séries
export function parseSets(str) {
  const out = [];
  String(str || "").split("+").map(x => x.trim()).filter(Boolean).forEach((part, gi, all) => {
    const m = part.match(/^(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/i); if (!m) return;
    const pct = part.match(/@\s*([\d.,]+)\s*%/), kg = part.match(/@\s*([\d.,]+)\s*kg/i), rpe = part.match(/RPE\s*([\d.,]+)/i);
    const t = /AMRAP/i.test(part) ? "A" : /\bDS\b/.test(part) ? "D" : all.length > 1 ? (gi === 0 ? "T" : "B") : "N";
    for (let i = 0; i < +m[1]; i++) out.push({ t, lo: +m[2], hi: +(m[3] || m[2]), pct: pct ? +pct[1].replace(",", ".") : null, kg: kg ? +kg[1].replace(",", ".") : null, rpe: rpe ? +rpe[1].replace(",", ".") : (pct ? null : 8), tech: [] });
  });
  return out;
}

// "3x8-10 RPE8", "1x3@85% + 4x5@75%", "2x10-12 RPE9 + 1x10-12 RPE10 DS"
export function parseScheme(str) {
  return String(str || "3x8-12 RPE8").split("+").map(s => s.trim()).map(s => {
    const m = s.match(/^(\d+)\s*x\s*(\d+)(?:-(\d+))?(?:\s*@\s*([\d.]+)%)?(?:\s*@?\s*[\d.,]+\s*kg)?(?:\s*@?\s*RPE\s*([\d.]+))?(\s*(?:DS|AMRAP))?/i);
    if (!m) return { sets: 3, lo: 8, hi: 12, rpe: 8 };
    return { sets: +m[1], lo: +m[2], hi: +(m[3] || m[2]), pct: m[4] ? +m[4] : null, rpe: m[5] ? +m[5] : null, ds: !!m[6] };
  });
}

// ---------- Exercices ----------
const BW = /poids de corps|pompes|gainage|planche|plank|dead bug|bird dog|hollow|relev[ée] de jambes(?! .*lest)|hip airplane|stretch|étirement|copenhagen|chaise contre|superman|mobilit|respiration|90\/90|cat camel|McGill|crunch au sol|tractions(?!.*lest)|dips(?!.*lest)|muscle-up|traction australienne/i;
const exInfo = (name) => FICHES?.ex?.[name] || extra.exercises[name] || (S().customExercises || []).find(x => x.n === name) || null;
export function unitOf(name, kind) {
  const x = exInfo(name); if (x?.unit) return x.unit;
  if (kind === "M") return "s";
  if (/gainage|planche|plank|chaise contre|copenhagen|hollow|suspension|isom|L-sit|stretch|étirement|marche active|marche inclinée|vélo|rameur|corde à sauter|équilibre sur|tenu|porté|carry|farmers|spanish squat/i.test(name)) return "s";
  return "reps";
}
export const isBodyweight = (name) => { if (/lest/i.test(name)) return false; const x = exInfo(name); if (x?.eq) return ["Poids de corps", "Anneaux"].includes(x.eq); return BW.test(name); };
export function stepOf(name) { if (/lest/i.test(name)) return 1.25; if (/kettlebell/i.test(name)) return 4; if (/haltère/i.test(name)) return 2; return 2.5; }
export const roundTo = (kg, step) => Math.max(0, Math.round(kg / step) * step);
export const fmtKg = (kg) => (Math.round((kg || 0) * 100) / 100).toString().replace(".", ",");

// Epley corrigé par les répétitions en réserve (RIR = 10 − RPE)
// (une répétition à RPE 10 = le 1RM lui-même)
const effR = (reps, rpe) => Math.min(reps + Math.max(0, 10 - (rpe || 8)), 15);
export function e1rm(kg, reps, rpe = 8) { if (!kg || !reps) return 0; const r = effR(reps, rpe); return r <= 1 ? kg : kg * (1 + r / 30); }
export const loadFor = (e, reps, rpe = 8) => { const r = effR(reps, rpe); return r <= 1 ? e : e / (1 + r / 30); };
export const pctFor = (reps, rpe = 10) => 100 * loadFor(1, reps, rpe);

// Records de départ (onboarding ou saisis à la main)
const SEEDS = [
  [/développé couché haltères/i, "dbbench", 1], [/développé incliné haltères/i, "dbbench", .88], [/développé (épaules|militaire) haltères/i, "dbohp", 1],
  [/tractions lestées/i, "pullup", 1], [/dips lestés/i, "dip", 1], [/muscle-up lesté/i, "muscleup", 1],
  [/^tirage vertical (poulie|prise neutre|supination)/i, "pulldown", 1], [/tirage vertical unilatéral/i, "pulldown", .5],
  [/^squat barre(?!.*(pause|tempo))/i, "squat", 1], [/squat barre.*pause/i, "squat", .85], [/squat barre.*tempo/i, "squat", .75],
  [/^front squat/i, "squat", .8], [/hack squat|leg press|presse à cuisses/i, "squat", 1.6],
  [/^développé couché barre(?!.*(pause|serrée|incliné))/i, "bench", 1], [/développé couché barre.*pause/i, "bench", .93], [/développé couché.*serrée/i, "bench", .88],
  [/développé incliné barre/i, "bench", .82], [/développé incliné haltères/i, "bench", .32], [/développé couché haltères/i, "bench", .36],
  [/^soulevé de terre(?!.*(roumain|jambes))/i, "deadlift", 1], [/soulevé de terre roumain barre/i, "deadlift", .62], [/soulevé de terre roumain haltères/i, "deadlift", .26],
  [/développé militaire barre/i, "ohp", 1], [/développé (épaules|militaire) haltères/i, "ohp", .36],
  [/rowing barre/i, "row", 1], [/rowing haltère/i, "row", .42],
  [/tractions lestées/i, "pullup", 1], [/dips lestés/i, "dip", 1],
];
export const MAIN_LIFTS = [["squat", "Squat barre"], ["bench", "Développé couché barre"], ["deadlift", "Soulevé de terre"], ["ohp", "Développé militaire barre (OHP)"], ["row", "Rowing barre"], ["pullup", "Tractions lestées (pronation)"], ["dip", "Dips lestés"], ["dbbench", "Développé couché haltères"], ["dbohp", "Développé militaire haltères"], ["muscleup", "Muscle-up lesté"], ["pulldown", "Tirage vertical poulie"]];
export function seedE1rm(name) {
  const rec = S().profile?.records || {};
  for (const [re, key, f] of SEEDS) if (re.test(name) && rec[key]?.e1rm) return rec[key].e1rm * f;
  return 0;
}
export function currentE1rm(name) {
  const h = S().lifts[name];
  if (!h?.length) return seedE1rm(name);
  if (h.at(-1).manual) return h.at(-1).e1rm;
  const last = h.at(-1).e1rm, best3 = Math.max(...h.slice(-3).map(x => x.e1rm));
  return last * .6 + best3 * .4;
}
export function setRecord(key, kg, reps, rpe = 10) {
  update(st => { st.profile.records = st.profile.records || {}; st.profile.records[key] = { k: kg, r: reps, rpe, e1rm: Math.round(e1rm(kg, reps, rpe) * 10) / 10, d: today() }; });
  const name = MAIN_LIFTS.find(m => m[0] === key)?.[1];
  if (name) update(st => { (st.lifts[name] = st.lifts[name] || []).push({ d: today(), e1rm: Math.round(e1rm(kg, reps, rpe) * 10) / 10, manual: true }); });
}

// ---------- Plan et séance du jour ----------
export function nextSession(at = null) {
  const pl = S().plan; if (!pl) return null;
  const p = program(pl.programId); if (!p) return null;
  const idx = at ?? pl.idx, s = p.s[idx % p.s.length];
  return { p, week: pl.week, idx, title: s[0], day: s[1], exercises: s[2], phase: phaseOf(p, pl.week), weeks: weeksOf(p), cycle: pl.cycle || 1 };
}
// Rattrapage : la séance suivante pas encore faite de la même semaine (pour fusionner deux séances le même jour)
export function mergeCandidate() {
  const pl = S().plan; if (!pl) return null; const p = program(pl.programId); if (!p) return null;
  const done = doneIn(pl.programId, pl.cycle || 1, pl.week);
  const i = p.s.findIndex((_, k) => k !== pl.idx % p.s.length && !done.has(k) && k > pl.idx % p.s.length);
  return i < 0 ? null : { idx: i, title: p.s[i][0] };
}
// Deux séances en une : mouvements en double regroupés ; version « adaptée » = environ un tiers de séries en moins
export function buildMerged(adapt = true) {
  const a = buildSession(), m = mergeCandidate(); if (!a || !m) return a;
  const b = buildSession(m.idx);
  const ex = [...a.exercises];
  b.exercises.forEach(e => { const same = ex.find(x => x.name === e.name); if (same) { if (!adapt) same.sets.push(...e.sets.filter(s => s.type !== "W")); } else ex.push(e); });
  if (adapt) {
    // version adaptée : au plus 9 exercices (on retire d'abord les isolations de la séance rattrapée), environ un tiers de séries en moins
    const minor = (e) => ["I", "A", "X", "C", "G"].includes(e.kind);
    for (let i = ex.length - 1; ex.length > 9 && i >= a.exercises.length; i--) if (minor(ex[i])) ex.splice(i, 1);
    for (let i = ex.length - 1; ex.length > 9 && i >= 0; i--) if (minor(ex[i])) ex.splice(i, 1);
    ex.forEach(e => { const work = e.sets.filter(s => s.type !== "W"), keep = Math.max(2, Math.ceil(work.length * 2 / 3)); let n = 0; e.sets = e.sets.filter(s => s.type === "W" || ++n <= keep); });
  }
  return { ...a, idx2: m.idx, title: `${a.title} + ${b.title}`, merged: adapt ? "adaptée" : "complète", exercises: ex };
}
export function daysSinceLast() { const w = S().workouts; if (!w.length) return null; return Math.floor((Date.now() - new Date(w.at(-1).end).getTime()) / 864e5); }

export function lastExercise(name) {
  const w = S().workouts;
  for (let i = w.length - 1; i >= 0; i--) { const ex = w[i].exercises.find(x => x.name === name); if (ex && ex.sets.some(s => s.done)) return { ex, date: w[i].end, week: w[i].week, title: w[i].title }; }
  return null;
}
// Stagnation : le meilleur 1RM estimé des 3 dernières semaines ne dépasse pas celui d'avant
export function stalls(minDays = 21) {
  const out = [], now = Date.now(), dismissed = S().stallSnooze || {};
  Object.entries(S().lifts || {}).forEach(([name, h]) => {
    const real = h.filter(x => !x.manual); if (real.length < 4) return;
    const last = new Date(real.at(-1).d).getTime(); if (now - last > 30 * 864e5) return;
    const cut = now - minDays * 864e5;
    const before = real.filter(x => new Date(x.d).getTime() < cut), recent = real.filter(x => new Date(x.d).getTime() >= cut);
    if (!before.length || recent.length < 2) return;
    const b = Math.max(...before.map(x => x.e1rm)), r = Math.max(...recent.map(x => x.e1rm));
    if (r <= b * 1.005 && !(dismissed[name] && dismissed[name] > now)) {
      const since = real.slice().reverse().find(x => x.e1rm >= b)?.d || before.at(-1).d;
      out.push({ name, best: b, recent: r, weeks: Math.max(3, Math.round((now - new Date(since).getTime()) / (7 * 864e5))) });
    }
  });
  return out.sort((a, b) => b.weeks - a.weeks);
}
export function snoozeStall(name, days = 21) { update(st => { st.stallSnooze = st.stallSnooze || {}; st.stallSnooze[name] = Date.now() + days * 864e5; }); }
export function lastPerformance(name) {
  const l = lastExercise(name); if (!l) return null;
  const s = l.ex.sets.filter(x => x.done && x.type !== "W");
  return s.length ? s.reduce((a, b) => (e1rm(b.kg, b.reps, b.rpe) > e1rm(a.kg, a.reps, a.rpe) ? b : a)) : null;
}
// Suggestion pour la prochaine fois : compare le ressenti réel au ressenti prévu
export function suggestion(name, targetRpe = 8, lo = 8, hi = 10, step = 2.5) {
  const l = lastExercise(name); if (!l) return null;
  const work = l.ex.sets.filter(s => s.done && s.type !== "W" && s.kg);
  if (!work.length) return null;
  const avgRpe = work.reduce((a, s) => a + (s.rpe ?? s.trpe ?? 8), 0) / work.length;
  const best = work.reduce((a, b) => (b.kg > a.kg ? b : a));
  const allTop = work.every(s => s.reps >= hi);
  const pain = l.ex.sets.some(s => s.pain);
  let txt, kg = best.kg;
  if (pain) { txt = "Douleur signalée la dernière fois : garde la même charge ou change d'exercice."; }
  else if (avgRpe >= targetRpe + 1) { txt = `Plus dur que prévu (RPE ${fmtKg(avgRpe)} pour ${fmtKg(targetRpe)}) : on garde ${fmtKg(kg)} kg et on vise des reps plus propres.`; }
  else if (avgRpe <= targetRpe - 1.5 || allTop) { const g = goalFor(name), gs = g && goalStatus(g); const goalJump = gs && gs.need > 0 ? Math.ceil(gs.need * best.kg / Math.max(1, gs.cur) / step) : 0; kg = roundTo(best.kg + Math.max(1, Math.round(pace().jump * (avgRpe <= targetRpe - 2 ? 2 : 1)), Math.min(goalJump, 3)) * step, step); txt = `Plus facile que prévu (RPE ${fmtKg(avgRpe)}) : monte à ${fmtKg(kg)} kg.${goalJump > 1 ? " Ton objectif demande ce rythme." : ""}`; }
  else { txt = `Dans la cible (RPE ${fmtKg(avgRpe)}) : vise ${best.reps + 1} reps à ${fmtKg(kg)} kg ou la charge proposée.`; }
  return { txt, kg, last: `${fmtKg(best.kg)} kg × ${best.reps} à RPE ${fmtKg(best.rpe ?? best.trpe ?? 8)}`, date: l.date };
}

export function buildSession(at = null) {
  const ns = nextSession(at); if (!ns) return null;
  const { p, week } = ns;
  const gap = daysSinceLast();
  const comeback = gap !== null && gap >= 14;
  const exercises = ns.exercises.map((row, i) => {
    const orig = row[0], name = S().swaps[orig] || orig, kind = row[1];
    const scheme = schemeFor(p, row, week);
    const groups = parseScheme(scheme);
    const plan = row[5] && (Array.isArray(row[5].sets) || typeof row[5].sets === "number") ? weekPlan(row[5], week, p) : null;
    const unit = unitOf(name, kind), bw = isBodyweight(name) || unit === "s";
    const e = bw ? 0 : currentE1rm(name), step = stepOf(name);
    const prev = lastPerformance(name);
    const plannedTech = (row[5]?.tech) || [];
    const sets = [];
    if (plan) plan.sets.forEach(sp => {
      let kg = null;
      if (!bw || sp.kg) {
        if (sp.kg) kg = sp.kg;
        else if (e) kg = (sp.pct ? e * sp.pct / 100 : loadFor(e, sp.lo, sp.rpe || 8)) * (sp.t === "W" ? 1 : pace().f);
        else if (prev) kg = sp.t === "W" ? prev.kg * .6 : prev.kg;
        if (kg && comeback) kg *= .9;
        if (kg && sp.t === "D") kg *= sp.kg ? 1 : .8;
        if (kg) kg = roundTo(kg, step);
      }
      sets.push({ g: sp.t === "W" ? -1 : 0, type: sp.t || "N", kg, reps: sp.lo, lo: sp.lo, hi: sp.hi || sp.lo, rpe: null, trpe: sp.rpe || (sp.t === "W" ? 5 : 8), pct: sp.pct || (e && kg ? Math.round(kg / e * 100) : null), tech: [...(sp.tech || [])], note: sp.note || "", done: false });
    });
    else groups.forEach((g, gi) => {
      for (let k = 0; k < g.sets; k++) {
        let kg = null;
        if (!bw) {
          if (e) kg = (g.pct ? e * g.pct / 100 : loadFor(e, g.lo, g.rpe || 8)) * pace().f;
          else if (prev) kg = prev.kg;
          if (kg && comeback) kg *= .9;
          if (kg && g.ds && k === g.sets - 1) kg *= .8;
          if (kg) kg = roundTo(kg, step);
        }
        const type = g.ds && k === g.sets - 1 ? "D" : groups.length > 1 ? (gi === 0 ? "T" : "B") : "N";
        sets.push({ g: gi, type, kg, reps: g.lo, lo: g.lo, hi: g.hi, rpe: null, trpe: g.rpe || 8, pct: g.pct || (e && kg ? Math.round(kg / e * 100) : null), tech: g.ds && k === g.sets - 1 ? ["Dropset"] : [...plannedTech], note: "", done: false });
      }
    });
    // Échauffement proposé sur les mouvements de force
    if (!bw && !sets.some(s => s.type === "W") && (kind === "F" || (kind === "P" && i === 0)) && sets[0]?.kg) {
      const top = sets[0].kg;
      [[.5, 8], [.7, 4], [.85, 2]].reverse().forEach(([f, r]) => sets.unshift({ g: -1, type: "W", kg: roundTo(top * f, step), reps: r, lo: r, hi: r, trpe: 5, rpe: null, pct: null, tech: [], note: "", done: false }));
    }
    const sug = bw ? null : suggestion(name, groups.at(-1).rpe || 8, groups.at(-1).lo, groups.at(-1).hi, step);
    return { orig, name, kind, note: row[2] || "", ss: row[3] || null, tempo: plan?.tempo || row[4] || null, scheme, unit, bw, step, rest: (row[5]?.rest) || REST[kind] || 90, sets, e1: e, sug, myNote: "" };
  });
  return { id: Date.now(), programId: p.id, week, idx: ns.idx % p.s.length, cycle: ns.cycle, title: ns.title, phase: ns.phase, start: new Date().toISOString(), comeback, exercises };
}
export function freeSession(title = "Séance libre") {
  return { id: Date.now(), programId: null, free: true, week: S().plan?.week || 1, idx: null, title, phase: "Libre", start: new Date().toISOString(), comeback: false, exercises: [] };
}
export function blankExercise(name) {
  const unit = unitOf(name, "X"), bw = isBodyweight(name) || unit === "s", e = bw ? 0 : currentE1rm(name), step = stepOf(name);
  const prev = lastPerformance(name);
  const kg = bw ? null : prev?.kg ?? (e ? roundTo(loadFor(e, 8, 8), step) : null);
  const sets = [0, 1, 2].map(() => ({ g: 0, type: "N", kg, reps: prev?.reps || 8, lo: 8, hi: 12, trpe: 8, rpe: null, pct: e && kg ? Math.round(kg / e * 100) : null, tech: [], note: "", done: false }));
  return { orig: name, name, kind: "X", note: "", scheme: "3x8-12 RPE8", unit, bw, step, rest: 120, sets, e1: e, sug: bw ? null : suggestion(name, 8, 8, 12, step), myNote: "" };
}

// Séance express (10, 20, 30 ou 45 min) : on garde les mouvements principaux, dans l'ordre du programme,
// en retirant d'abord les exercices d'isolation et les dernières séries, avec des repos raccourcis.
const PRIO = { F: 0, N: 0, P: 1, S: 2, U: 3, J: 3, A: 4, X: 4, I: 5, C: 6, G: 6, K: 7, M: 8, R: 8 };
export function expressSession(s, min) {
  const cap = min <= 10 ? 75 : min <= 20 ? 90 : min <= 30 ? 120 : 150;
  const warm = min <= 10 ? 1 : min <= 20 ? 3 : 5;
  let budget = (min - warm) * 60;
  const work = 40; // secondes par série de travail
  const ex = s.exercises.map((x, i) => ({ x, i, p: PRIO[x.kind] ?? 4 })).sort((a, b) => a.p - b.p || a.i - b.i);
  const keep = new Map();
  const minSets = min <= 10 ? 2 : 2;
  // 1er passage : chaque exercice prioritaire reçoit ses séries minimales tant que le temps le permet
  for (const e of ex) {
    const rest = Math.min(cap, e.x.rest || 90), sets = e.x.sets.filter(st => st.type !== "W");
    const need = Math.min(minSets, sets.length) * (work + rest);
    if (need > budget) continue;
    keep.set(e.i, Math.min(minSets, sets.length)); budget -= need;
    if (min <= 10 && keep.size >= 2) break;
  }
  // 2e passage : séries supplémentaires, mouvements principaux d'abord
  for (const e of ex) {
    if (!keep.has(e.i)) continue;
    const rest = Math.min(cap, e.x.rest || 90), total = e.x.sets.filter(st => st.type !== "W").length;
    while (keep.get(e.i) < total && budget >= work + rest) { keep.set(e.i, keep.get(e.i) + 1); budget -= work + rest; }
  }
  const out = s.exercises.map((x, i) => {
    if (!keep.has(i)) return null;
    let n = keep.get(i);
    const warmups = min <= 20 ? [] : x.sets.filter(st => st.type === "W").slice(0, 1);
    const sets = [...warmups, ...x.sets.filter(st => st.type !== "W").slice(0, n)];
    return { ...x, sets, rest: Math.min(cap, x.rest || 90) };
  }).filter(Boolean);
  if (!out.length && s.exercises.length) { const x = s.exercises[0]; out.push({ ...x, sets: x.sets.filter(st => st.type !== "W").slice(0, 2), rest: Math.min(cap, x.rest || 90) }); }
  const dropped = s.exercises.length - out.length;
  return { ...s, exercises: out, express: min, title: s.title, expressNote: (dropped ? `${dropped} exercice${dropped > 1 ? "s" : ""} retiré${dropped > 1 ? "s" : ""}, repos` : "Repos") + ` ${Math.floor(cap / 60)} min${cap % 60 ? " " + (cap % 60) : ""} max` };
}

// Fin de séance : e1RM, records, volume, avance le plan (sauf séance libre)
export function finishSession(cur) {
  const d = today(), records = [];
  let volume = 0, sets = 0;
  update(st => {
    cur.exercises.forEach(ex => {
      const done = ex.sets.filter(s => s.done && s.type !== "W");
      sets += done.length;
      done.forEach(s => { if (s.kg && ex.unit === "reps") volume += s.kg * s.reps; });
      if (ex.bw) return;
      const best = Math.max(0, ...done.filter(s => s.kg && s.reps && s.type !== "D").map(s => e1rm(s.kg, s.reps, s.rpe ?? s.trpe)));
      if (!best) return;
      const cur0 = currentE1rm(ex.name);
      const felt = done.some(s => s.rpe != null);
      const val = (!felt && cur0 && best < cur0) ? cur0 : best;
      const h = st.lifts[ex.name] || (st.lifts[ex.name] = []);
      const ref = Math.max(h.length ? Math.max(...h.map(x => x.e1rm)) : 0, seedE1rm(ex.name));
      if (ref && best > ref * 1.005) records.push({ name: ex.name, before: ref, after: best });
      h.push({ d, e1rm: Math.round(val * 10) / 10 });
      if (h.length > 200) h.splice(0, h.length - 200);
    });
    cur.end = new Date().toISOString();
    cur.volume = Math.round(volume); cur.setsDone = sets; cur.records = records;
    st.workouts.push(cur);
    st.current = null;
    if (!cur.free && st.plan) {
      const p = program(st.plan.programId);
      // prochaine séance : la première pas encore faite de la semaine, sinon semaine suivante
      const done = doneIn(st.plan.programId, st.plan.cycle || 1, st.plan.week);
      const left = p.s.map((_, i) => i).filter(i => !done.has(i));
      if (left.length) st.plan.idx = left[0];
      else {
        st.plan.idx = 0; st.plan.week++;
        const blk = st.season?.blocks?.[st.season.cur || 0], blockEnd = blk && blk.programId === st.plan.programId ? blk.weeks : null;
        if (blockEnd && (st.plan.week > blockEnd || (st.plan.week > weeksOf(p) && blockEnd <= weeksOf(p)))) { if (!seasonAdvance(st)) { st.plan.week = 1; st.plan.cycle = (st.plan.cycle || 1) + 1; } cur.blockDone = true; }
        else if (st.plan.week > weeksOf(p)) { st.plan.week = 1; st.plan.cycle = (st.plan.cycle || 1) + 1; }
      }
    }
  });
  return cur;
}

// Corriger une séance faite : séries, charges, date ; ou la supprimer
export function recomputeWorkout(w) {
  let volume = 0, sets = 0;
  w.exercises.forEach(ex => { const done = ex.sets.filter(s => s.done && s.type !== "W"); sets += done.length; done.forEach(s => { if (s.kg && ex.unit === "reps") volume += s.kg * s.reps; }); });
  w.volume = Math.round(volume); w.setsDone = sets; return w;
}
export function saveWorkout(w) { update(st => { const i = st.workouts.findIndex(x => x.id === w.id); if (i >= 0) st.workouts[i] = recomputeWorkout(w); st.workouts.sort((a, b) => a.end.localeCompare(b.end)); }); }
export function deleteWorkout(id) {
  update(st => {
    const w = st.workouts.find(x => x.id === id); if (!w) return;
    st.workouts = st.workouts.filter(x => x.id !== id);
    const d = iso(new Date(w.end));
    if (!st.workouts.some(x => iso(new Date(x.end)) === d)) w.exercises.forEach(ex => { const h = st.lifts[ex.name]; if (h) st.lifts[ex.name] = h.filter(x => x.d !== d || x.manual); });
    // la séance redevient à faire si elle était dans la semaine en cours
    if (!w.free && st.plan && w.programId === st.plan.programId && (w.cycle || 1) === (st.plan.cycle || 1) && w.week === st.plan.week) st.plan.idx = Math.min(st.plan.idx, w.idx);
  });
}

// Séances faites dans une semaine donnée du cycle (indices des séances du programme)
export function doneIn(programId, cycle, week) {
  return new Set(S().workouts.filter(w => !w.free && w.programId === programId && (w.cycle || 1) === cycle && w.week === week && w.idx != null).flatMap(w => w.idx2 != null ? [w.idx, w.idx2] : [w.idx]));
}
// Se placer dans le cycle : semaine et séance choisies
export function placeIn(week, idx = null) {
  update(st => { const p = program(st.plan.programId); st.plan.week = Math.max(1, Math.min(weeksOf(p), week));
    if (idx == null) { const done = doneIn(st.plan.programId, st.plan.cycle || 1, st.plan.week); idx = p.s.findIndex((_, i) => !done.has(i)); if (idx < 0) idx = 0; }
    st.plan.idx = idx; });
}

// ---------- Réglage de la surcharge progressive ----------
// Rythme global : facteur sur les charges calculées et sur le saut proposé quand c'est facile
export const PROG_PACE = { prudent: { f: .95, jump: .5, n: "Prudent" }, normal: { f: 1, jump: 1, n: "Normal" }, ambitieux: { f: 1.03, jump: 1.5, n: "Ambitieux" } };
export const pace = () => PROG_PACE[S().settings?.pace] || PROG_PACE.normal;
// Ajuster le 1RM estimé d'un exercice (toutes les charges futures suivent)
export function nudgeE1rm(name, deltaKg) {
  const cur = currentE1rm(name); if (!cur) return 0;
  const v = Math.max(1, Math.round((cur + deltaKg) * 10) / 10);
  update(st => { (st.lifts[name] = st.lifts[name] || []).push({ d: today(), e1rm: v, manual: true }); });
  return v;
}

// ---------- Semaine, agenda ----------
// Semaine type : S().schedule = { days: [{ on, time, dur, place } × 7] } ; sinon les jours du programme
export const schedule = () => S().schedule?.days?.length === 7 ? S().schedule : null;
export function weekLayout(p) {
  const out = []; let k = 0, days = schedule() ? schedule().days.map(d => d.on) : (p.days || []);
  days.forEach((on, i) => { if (on && k < p.s.length) { out.push({ dow: i, s: p.s[k], k }); k++; } });
  return out;
}
// Heure, durée et lieu d'une séance : réglage du jour, sinon la semaine type
export function slotOf(dateStr) {
  const d = schedule()?.days?.[dowOf(dateStr)] || {}, o = S().slots?.[dateStr] || {};
  return { time: o.time ?? d.time ?? null, dur: o.dur ?? d.dur ?? S().profile?.sessionMin ?? null, place: o.place ?? d.place ?? null };
}
export function setSlot(dateStr, fields) { update(st => { st.slots = st.slots || {}; st.slots[dateStr] = { ...(st.slots[dateStr] || {}), ...fields }; }); }
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
export const dowOf = (dateStr) => (new Date(dateStr + "T12:00:00").getDay() + 6) % 7;
// Statut de chaque jour entre deux dates : fait, loupé, prévu (avec la séance prévue), déplacé
export function agenda(from, to) {
  const out = {}, pl = S().plan, p = pl && program(pl.programId);
  const moves = S().moves || {}, skips = S().skips || {};
  const doneBy = {}; S().workouts.forEach(w => { const k = iso(new Date(w.end)); (doneBy[k] = doneBy[k] || []).push(w); });
  const lay = p ? weekLayout(p) : [];
  const t = today(), start = pl?.startedAt || t;
  const movedTo = {}; Object.entries(moves).forEach(([a, b]) => { movedTo[b] = a; });
  // séances futures : on déroule l'ordre du programme à partir de la prochaine séance
  let idx = pl ? pl.idx : 0;
  const d0 = new Date(from + "T12:00:00"), d1 = new Date(to + "T12:00:00");
  const futureStart = doneBy[t] ? iso(new Date(Date.now() + 864e5)) : t;
  // une séance déplacée reste la même séance : l'ordre est calculé sur les jours d'origine
  const futureMap = {}, orig = {};
  if (p) {
    const end = [to, ...Object.keys(moves)].sort().at(-1);
    for (let d = new Date(futureStart + "T12:00:00"); iso(d) <= end; d.setDate(d.getDate() + 1)) {
      const k = iso(d);
      if (lay.some(l => l.dow === dowOf(k)) && !skips[k]) { orig[k] = p.s[idx % p.s.length][0]; idx++; }
    }
    Object.entries(orig).forEach(([k, t0]) => { if (!moves[k]) futureMap[k] = t0; });
    Object.entries(moves).forEach(([a, b]) => { if (b < futureStart) return;
      const t0 = orig[a] || (a < futureStart ? p.s[(lay.find(l => l.dow === dowOf(a))?.k) ?? 0]?.[0] : null); if (!t0) return;
      futureMap[b] = futureMap[b] && futureMap[b] !== t0 ? `${futureMap[b]} + ${t0}` : t0; });
  }
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    const k = iso(d), dow = dowOf(k);
    const plannedDay = p && lay.some(l => l.dow === dow);
    if (doneBy[k]) out[k] = { st: "done", title: doneBy[k].map(w => w.title).join(" + "), w: doneBy[k] };
    else if (k >= futureStart && futureMap[k]) out[k] = { st: "planned", title: futureMap[k], moved: !!movedTo[k] };
    else if (k < t && k >= start && ((plannedDay && !moves[k] && !skips[k]) || movedTo[k])) out[k] = { st: "missed", title: p?.s[(lay.find(l => l.dow === dow)?.k) ?? 0]?.[0] || "Séance" };
    else if (skips[k] && plannedDay) out[k] = { st: "rest", title: "Repos choisi" };
    if (moves[k]) out[k] = { ...(out[k] || {}), st: out[k]?.st === "done" ? "done" : "away", to: moves[k] };
    if (out[k] && out[k].st !== "done") Object.assign(out[k], slotOf(k));
  }
  return out;
}
export function moveSession(from, to, time = null) {
  update(st => {
    st.moves = st.moves || {};
    Object.keys(st.moves).forEach(k => { if (st.moves[k] === from) { st.moves[k] = to; if (k === to) delete st.moves[k]; from = null; } }); // re-déplacer une séance déjà déplacée
    if (from) { if (from === to) delete st.moves[from]; else st.moves[from] = to; }
    if (time) { st.slots = st.slots || {}; st.slots[to] = { ...(st.slots[to] || {}), time }; }
  });
}
export function toggleSkip(day) { update(st => { st.skips = st.skips || {}; if (st.skips[day]) delete st.skips[day]; else st.skips[day] = true; }); }

export function workoutsThisWeek() {
  const now = new Date(), mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return S().workouts.filter(w => new Date(w.end) >= mon);
}
export function activeWeeks(n = 8) {
  const out = []; const now = new Date(); now.setHours(0, 0, 0, 0);
  const mon = new Date(now); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  for (let i = n - 1; i >= 0; i--) {
    const a = new Date(mon); a.setDate(a.getDate() - 7 * i); const b = new Date(a); b.setDate(b.getDate() + 7);
    const ws = S().workouts.filter(w => { const t = new Date(w.end); return t >= a && t < b; });
    out.push({ start: a, count: ws.length, volume: ws.reduce((x, w) => x + (w.volume || 0), 0), sets: ws.reduce((x, w) => x + (w.setsDone || 0), 0) });
  }
  return out;
}
export function streakWeeks() {
  const w = activeWeeks(52); let n = 0;
  for (let i = w.length - 1; i >= 0; i--) { if (w[i].count > 0) n++; else if (i === w.length - 1) continue; else break; }
  return n;
}

// ---------- Volume et muscles ----------
export const MUSCLES = ["Pecs", "Dos-largeur", "Dos-épaisseur", "Épaules-avant", "Épaules-latéral", "Épaules-arrière", "Trapèzes", "Biceps", "Triceps", "Avant-bras", "Abdos", "Lombaires", "Quadriceps", "Ischios", "Fessiers", "Adducteurs", "Mollets", "Cou", "Mobilité", "Cardio"];
export const EQUIP = ["Barre", "Haltères", "Machine", "Poulie", "Poids de corps", "Lest", "Kettlebell", "Élastique", "Smith", "Anneaux", "Landmine", "Trap bar", "Autre"];
export const equipOf = (name) => exInfo(name)?.eq || "Autre";
export function musclesOf(name) {
  const x = exInfo(name); if (x?.mus?.length) return x.mus;
  const r = LIB?.BASE?.find(x => x[0] === name);
  if (r) return [r[1], r[2], r[3]].filter(Boolean);
  const F = FICHES?.ex?.[name]; return F ? [(FICHES.fam[F.fam]?.nom || F.fam).split("(")[0].trim()] : ["Autre"];
}
// Séries effectives par muscle (principal = 1, secondaires = 0,5) et tonnage, sur une période
export function volumeStats(fromDate, toDate = today()) {
  const byMuscle = {}, byExercise = {}, sessions = [];
  S().workouts.forEach(w => {
    const k = iso(new Date(w.end)); if (k < fromDate || k > toDate) return;
    let ton = 0, n = 0;
    w.exercises.forEach(ex => {
      const done = ex.sets.filter(s => s.done && s.type !== "W"); if (!done.length) return;
      const t = done.reduce((a, s) => a + (ex.unit === "reps" && s.kg ? s.kg * s.reps : 0), 0);
      ton += t; n += done.length;
      const e = byExercise[ex.name] = byExercise[ex.name] || { sets: 0, ton: 0 }; e.sets += done.length; e.ton += t;
      musclesOf(ex.name).forEach((m, i) => { const v = byMuscle[m] = byMuscle[m] || { sets: 0, ton: 0 }; v.sets += done.length * (i === 0 ? 1 : .5); v.ton += i === 0 ? t : 0; });
    });
    sessions.push({ d: k, title: w.title, ton: Math.round(ton), sets: n });
  });
  return { byMuscle, byExercise, sessions };
}
export function monthlyVolume(n = 6) {
  const out = [], now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const a = new Date(now.getFullYear(), now.getMonth() - i, 1), b = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const ws = S().workouts.filter(w => { const t = new Date(w.end); return t >= a && t < b; });
    out.push({ label: a.toLocaleDateString("fr-FR", { month: "short" }), volume: ws.reduce((x, w) => x + (w.volume || 0), 0), count: ws.length });
  }
  return out;
}

// ---------- Alertes de blessure ----------
const PAIN_WORDS = /douleur|mal |mal$|gêne|gene|bless|tendin|pincement|craqu|lombaire|sciatique/i;
export function injuryAlerts(days = 21) {
  const since = Date.now() - days * 864e5, out = [];
  S().workouts.forEach(w => {
    if (new Date(w.end) < since) return;
    w.exercises.forEach(ex => {
      const pain = ex.sets.filter(s => s.pain || PAIN_WORDS.test(s.note || ""));
      if (pain.length || PAIN_WORDS.test(ex.myNote || "")) out.push({ name: ex.name, date: w.end, note: ex.myNote || pain.map(s => s.note).filter(Boolean).join(" · ") || "Douleur signalée" });
    });
  });
  const byName = {}; out.forEach(a => { (byName[a.name] = byName[a.name] || []).push(a); });
  return Object.entries(byName).map(([name, list]) => ({ name, count: list.length, last: list.at(-1) }));
}

// ---------- Objectif : nombre de cycles ----------
export function cyclesToGoal(current, target, level = "regular") {
  if (!current || !target || target <= current) return { cycles: 0, months: 0, rate: 0 };
  const rate = { beginner: .1, comeback: .1, regular: .05, advanced: .025 }[level] ?? .05; // gain par cycle de 12 semaines
  const cycles = Math.ceil(Math.log(target / current) / Math.log(1 + rate));
  return { cycles, months: cycles * 3, rate };
}

// ---------- Vue du cycle ----------
export function cycleOverview(p) {
  const weeks = weeksOf(p), kinds = [...new Set(p.s.flatMap(s => s[2].map(r => r[1])))];
  const rows = [], v2 = p.s.some(s => s[2].some(r => r[5]?.sets));
  for (let w = 1; w <= weeks; w++) rows.push({ w, phase: phaseOf(p, w), schemes: Object.fromEntries(kinds.map(k => { const r = p.s.flatMap(s => s[2]).find(r => r[1] === k); return [k, v2 && r ? schemeFor(p, r, w) : p.custom ? "selon le plan" : schemeFor(p, [null, k], w)]; })) });
  return { weeks, kinds, rows };
}

// ---------- Exercices : remplacements, fiches ----------
export function alternatives(name) {
  const F = FICHES, fam = F?.ex?.[name]?.fam, m0 = musclesOf(name)[0];
  const same = fam ? Object.keys(F.ex).filter(n => n !== name && F.ex[n].fam === fam) : [];
  const near = allExercises().filter(n => n !== name && !same.includes(n) && musclesOf(n)[0] === m0);
  return [...same, ...near];
}
export function ficheOf(name) {
  const F = FICHES; const ex = F?.ex?.[name] || extra.exercises[name] || (S().customExercises || []).find(x => x.n === name); if (!ex) return null;
  const fam = F?.fam?.[ex.fam] || {};
  return { name, ...ex, fam, svg: F?.svg?.[fam.schema] || F?.svg?.[ex.fam] || null, video: videoOf(name) };
}
export function allExercises() { return [...new Set([...Object.keys(FICHES?.ex || {}), ...Object.keys(extra.exercises), ...(S().customExercises || []).map(x => x.n)])].sort((a, b) => a.localeCompare(b, "fr")); }
export const isCustomExercise = (name) => !FICHES?.ex?.[name] && !extra.exercises[name] && (S().customExercises || []).some(x => x.n === name);

// ---------- Saison : macrocycle d'un an en blocs ----------
// S().season = { start: "YYYY-MM-DD", cur: 0, blocks: [{ id, programId, weeks, focus }] }
export const FOCUS = { force: ["Force", "#B4491A"], hyper: ["Hypertrophie", "#C98A2B"], power: ["Puissance", "#8F3510"], deload: ["Allègement", "#7C8B6A"], test: ["Test / compétition", "#5B2A86"], reprise: ["Reprise", "#2F6F8F"], perso: ["Bloc perso", "#6E5A4E"] };
const addD = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return today(d); };
export function seasonBlocks() {
  const se = S().season; if (!se?.blocks?.length) return [];
  let d = se.start;
  return se.blocks.map((b, i) => { const p = program(b.programId), from = d, to = addD(d, b.weeks * 7 - 1); d = addD(d, b.weeks * 7); return { ...b, i, p, from, to, cur: i === (se.cur || 0) }; });
}
// Fin de bloc : on passe au programme du bloc suivant
export function seasonAdvance(st) {
  const se = st.season; if (!se?.blocks?.length) return false;
  const i = se.cur || 0, nb = se.blocks[i + 1]; if (!nb) return false;
  se.cur = i + 1; st.plan = { programId: nb.programId, startedAt: today(), week: 1, idx: 0, cycle: 1 }; return true;
}

// ---------- Objectifs de performance ----------
// S().goals = [{ id, name, kg, reps, date, start, created }]
export function goalTarget(g) { return e1rm(g.kg, g.reps || 1, 10); }
export function liftRate(name, weeks = 8) {
  const h = (S().lifts[name] || []).filter(x => new Date(x.d) >= new Date(Date.now() - weeks * 7 * 864e5));
  if (h.length < 3) return null;
  const xs = h.map(x => new Date(x.d).getTime() / (7 * 864e5)), ys = h.map(x => x.e1rm), n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den ? num / den : null; // kg de 1RM estimé par semaine
}
export function goalStatus(g) {
  const cur = currentE1rm(g.name) || g.start || 0, tgt = goalTarget(g), start = g.start || cur;
  const weeksLeft = Math.max(.5, (new Date(g.date + "T12:00:00") - Date.now()) / (7 * 864e5));
  const need = (tgt - cur) / weeksLeft, rate = liftRate(g.name);
  const total = Math.max(1, (new Date(g.date + "T12:00:00") - new Date(g.created + "T12:00:00")) / (7 * 864e5));
  const elapsed = Math.max(0, (Date.now() - new Date(g.created + "T12:00:00")) / (7 * 864e5));
  const traj = start + (tgt - start) * Math.min(1, elapsed / total);
  const pct = tgt > start ? Math.max(0, Math.min(1, (cur - start) / (tgt - start))) : 1;
  const eta = rate && rate > 0 && tgt > cur ? Math.ceil((tgt - cur) / rate) : null;
  return { cur, tgt, start, need, rate, traj, pct, eta, weeksLeft, done: cur >= tgt, ahead: cur >= traj };
}
// L'objectif dicte le saut de charge : le saut proposé couvre au moins le rythme nécessaire
export function goalFor(name) { return (S().goals || []).find(g => g.name === name && g.date >= today()) || null; }
