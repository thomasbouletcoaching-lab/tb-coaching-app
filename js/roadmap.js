// Roadmap vers un record : à partir du 1RM actuel, de la charge visée et d'une date, calcule si c'est réaliste, ambitieux ou pas réaliste,
// puis bâtit toute la progression, semaine par semaine et séance par séance (séries, répétitions, effort, charge en kg et en % du 1RM).
// Module pur (aucun accès à l'écran ni au stockage) : testé par `node --test tests/roadmap.test.mjs`.
//
// Les charges suivent la même règle que le reste de l'app : 1RM estimé (Epley corrigé par les répétitions en réserve, RIR = 10 − RPE).
// Les rythmes de progression par niveau sont des points de départ (ordres de grandeur couramment admis en force), réunis ici pour être ajustés.
import { exercice } from "./exercices.js";

export const VERSION = 1;
// Gain d'un 1RM par mois à fréquence de 2 séances par semaine sur ce mouvement, en % : au-delà, on sort du réaliste
export const RYTHME = { debutant: 4.0, regulier: 1.8, avance: 0.7 };
export const FREQ_COEF = { 1: 0.75, 2: 1, 3: 1.1 };
export const SEUIL_REALISTE = 0.8, SEUIL_AMBITIEUX = 1.25;
export const SEMAINES_MIN = 4, SEMAINES_MAX = 26;

const SEM_PAR_MOIS = 4.345;
export const effR = (reps, rpe = 8) => Math.min(reps + Math.max(0, 10 - (rpe || 8)), 15);
export const e1rm = (kg, reps, rpe = 10) => { const r = effR(reps, rpe); return !kg || !reps ? 0 : r <= 1 ? kg : kg * (1 + r / 30); };
export const chargePour = (e1, reps, rpe) => { const r = effR(reps, rpe); return r <= 1 ? e1 : e1 / (1 + r / 30); };
export const arrondi = (kg, pas = 2.5) => Math.round(kg / pas) * pas;

export const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const joursEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
export const dowOf = (iso) => (new Date(iso + "T12:00:00").getDay() + 6) % 7; // 0 = lundi
export const lundiDe = (iso) => addDays(iso, -dowOf(iso));

export const niveauDepuis = (level) => ({ beginner: "debutant", comeback: "debutant", regular: "regulier", advanced: "avance" })[level] || "regulier";

// ---------- Verdict ----------
// cur / tgt : 1RM estimé actuel et visé (kg). Renvoie { id, ratio, … } avec id ∈ atteint | realiste | ambitieux | impossible
export function verdict({ cur, tgt, jours, niveau = "regulier", freq = 2, reps = 1, kg = null }) {
  const pl = (RYTHME[niveau] || RYTHME.regulier) * (FREQ_COEF[freq] || 1) / 100;
  const mois = Math.max(jours, 1) / 30.4, semaines = Math.max(jours, 1) / 7;
  const hausse = cur > 0 ? tgt / cur - 1 : 0;
  const base = { plafondMois: pl, hausse, semaines, mois };
  if (!(cur > 0)) return { ...base, id: "inconnu", ratio: null, titre: "Il me faut ton 1RM de départ", texte: "Indique ton 1RM actuel (ou une série récente) pour calculer ta progression." };
  if (tgt <= cur * 1.0005) return { ...base, id: "atteint", ratio: 0, titre: "Déjà dans tes cordes", texte: "Ton niveau actuel couvre déjà cet objectif : la roadmap sert à le confirmer proprement le jour J." };
  const mensuel = Math.pow(tgt / cur, 1 / mois) - 1, ratio = mensuel / pl;
  const e1Max = cur * Math.pow(1 + pl, mois);                                   // ce qu'on peut raisonnablement atteindre à l'échéance
  const kgMax = reps > 1 ? arrondi(e1Max / (1 + reps / 30)) : arrondi(e1Max);
  const moisBesoin = Math.log(tgt / cur) / Math.log(1 + pl * 0.9);
  const dateReal = (debut) => addDays(debut, Math.ceil(moisBesoin * 30.4));
  const id = jours < 21 && hausse > 0.02 ? "impossible" : ratio <= SEUIL_REALISTE ? "realiste" : ratio <= SEUIL_AMBITIEUX ? "ambitieux" : "impossible";
  const pct = (v) => (v * 100).toFixed(1).replace(".", ",");
  const TITRES = { realiste: "Réaliste", ambitieux: "Ambitieux", impossible: "Pas réaliste dans ce délai" };
  const TEXTES = {
    realiste: `Il te faut environ +${pct(hausse)} % en ${Math.round(semaines)} semaines, soit ${pct(mensuel)} % par mois. À ton niveau, on compte jusqu'à ${pct(pl)} % par mois : tu as de la marge.`,
    ambitieux: `Il te faut environ +${pct(hausse)} % en ${Math.round(semaines)} semaines, soit ${pct(mensuel)} % par mois, pour ${pct(pl)} % par mois habituellement. C'est jouable avec de la régularité, du sommeil et des séances tenues, mais sans marge.`,
    impossible: jours < 21 ? "Trois semaines, c'est trop court pour monter sensiblement : on peut préparer un bon test de ton niveau actuel, pas un nouveau palier." : `Il te faut environ +${pct(hausse)} % en ${Math.round(semaines)} semaines, soit ${pct(mensuel)} % par mois, quand on progresse plutôt de ${pct(pl)} % par mois. Mieux vaut un objectif tenable qu'une roadmap qui t'use.`,
  };
  return { ...base, id, ratio, mensuel, titre: TITRES[id], texte: TEXTES[id], kgMax, e1Max, moisBesoin, dateReal };
}

// ---------- Courbe de progression ----------
// Un peu plus rapide au début qu'à la fin (comme dans la réalité), arrivée exacte au jour J
const courbe = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 1.3);

// ---------- Phases ----------
export const PHASES = ["Accumulation", "Intensification", "Réalisation", "Deload", "Affûtage", "Objectif"];
export function phasesDe(W) {
  const out = Array(W).fill(null);
  out[W - 1] = "Objectif";
  let n = W - 1; if (W >= 5) { out[W - 2] = "Affûtage"; n = W - 2; }
  const trav = []; for (let w = 1; w <= n; w++) { if (n >= 6 && w % 4 === 0 && w < n) out[w - 1] = "Deload"; else trav.push(w); }
  const k = trav.length;
  const [a, i] = W >= 10 ? [Math.round(k * 0.4), Math.round(k * 0.4)] : W >= 6 ? [0, Math.round(k * 0.6)] : [0, 0];
  trav.forEach((w, idx) => { out[w - 1] = idx < a ? "Accumulation" : idx < a + i ? "Intensification" : "Réalisation"; });
  return out;
}
export const NOM_TYPE = { lourd: "Lourd", volume: "Volume", leger: "Technique", activation: "Activation", test: "Jour J" };
export const typesDe = (freq, phase) => phase === "Objectif" ? (freq === 1 ? ["test"] : [...Array(freq - 1).fill("activation"), "test"]) : ["lourd", "volume", "leger"].slice(0, freq);
// Groupes de séries { n, reps, rpe } par phase et type de séance
const PRESC = {
  Accumulation: { lourd: [{ n: 4, reps: 6, rpe: 7.5 }], volume: [{ n: 3, reps: 8, rpe: 7.5 }], leger: [{ n: 3, reps: 10, rpe: 6.5 }] },
  Intensification: { lourd: [{ n: 4, reps: 4, rpe: 8 }], volume: [{ n: 3, reps: 6, rpe: 7.5 }], leger: [{ n: 3, reps: 6, rpe: 6.5 }] },
  Réalisation: { lourd: [{ n: 3, reps: 3, rpe: 8 }, { n: 2, reps: 2, rpe: 9 }], volume: [{ n: 3, reps: 4, rpe: 7.5 }], leger: [{ n: 3, reps: 3, rpe: 6.5 }] },
  Deload: { lourd: [{ n: 3, reps: 5, rpe: 6.5 }], volume: [{ n: 2, reps: 6, rpe: 6 }], leger: [{ n: 2, reps: 5, rpe: 6 }] },
  Affûtage: { lourd: [{ n: 3, reps: 2, rpe: 8 }, { n: 1, reps: 1, rpe: 9 }], volume: [{ n: 2, reps: 3, rpe: 7 }], leger: [{ n: 2, reps: 3, rpe: 6.5 }] },
  Objectif: { activation: [{ n: 2, reps: 4, rpe: 6 }] },
};
export const REPOS = { F: 180, P: 120 };

// ---------- La roadmap ----------
// { nom, cur (e1RM), tgt (e1RM visé), kg, reps, debut (aujourd'hui), fin (date visée), freq, niveau }
export function construire({ nom, cur, tgt, kg, reps = 1, debut, fin, freq = 2, niveau = "regulier" }) {
  const jours = joursEntre(debut, fin);
  const W = Math.max(SEMAINES_MIN, Math.min(SEMAINES_MAX, Math.floor(jours / 7) + (jours % 7 > 2 ? 1 : 0) || 1));
  const lundi = lundiDe(debut), phases = phasesDe(W), f = Math.max(1, Math.min(3, freq));
  let e1 = cur; const semaines = [];
  for (let w = 1; w <= W; w++) {
    const ph = phases[w - 1];
    if (ph !== "Deload") e1 = cur + (tgt - cur) * courbe((w - 1) / Math.max(1, W - 1)); // la décharge ne fait pas avancer la charge
    const e1w = ph === "Objectif" ? tgt : e1;
    const types = typesDe(f, ph), seances = types.map((type) => {
      if (type === "test") {
        const att = arrondi(kg, 2.5);
        const ramp = [[.6, 5], [.75, 3], [.85, 2], [.93, 1]].map(([p, r]) => ({ t: "W", lo: r, hi: r, kg: arrondi(att * p), rpe: null, pct: Math.round(att * p / tgt * (1 + reps / 30) * 100) }));
        return { type, titre: NOM_TYPE.test, sets: [...ramp, { t: "N", lo: reps, hi: reps, kg: att, rpe: 10, pct: Math.round(e1rm(att, reps, 10) / tgt * 100) }], note: `Ta tentative : ${att} kg × ${reps}. Échauffe-toi en montant, repose-toi bien avant.` };
      }
      const sets = (PRESC[ph]?.[type] || []).flatMap(g => Array.from({ length: g.n }, () => { const k = arrondi(chargePour(e1w, g.reps, g.rpe)); return { t: "N", lo: g.reps, hi: g.reps, kg: k, rpe: g.rpe, pct: Math.round(k / e1w * 100) }; }));
      return { type, titre: NOM_TYPE[type], sets, note: "" };
    });
    semaines.push({ w, du: addDays(lundi, (w - 1) * 7), phase: ph, e1: Math.round(e1w * 10) / 10, seances });
  }
  return { v: VERSION, nom, cur, tgt, kg, reps, debut, fin, freq: f, niveau, semaines, nbSemaines: W };
}
export const groupes = (sets) => { const g = []; (sets || []).filter(x => x.t !== "W").forEach(x => { const l = g.at(-1); if (l && l.lo === x.lo && l.kg === x.kg && l.rpe === x.rpe) l.n++; else g.push({ n: 1, lo: x.lo, kg: x.kg, rpe: x.rpe, pct: x.pct }); }); return g; };
export const echauffement = (sets) => (sets || []).filter(x => x.t === "W");
export const semaineEnCours = (r, aujourdhui) => { const l = lundiDe(aujourdhui); return r.semaines.find(s => s.du === l)?.w || (aujourdhui < r.semaines[0].du ? 0 : r.nbSemaines + 1); };

// ---------- Programme du moteur ----------
const ACCESSOIRES = {
  PH: ["developpe-incline-halteres", "rowing-haltere-unilateral", "extension-triceps-corde-poulie"],
  PV: ["developpe-militaire-assis-halteres", "tirage-vertical-poulie", "elevation-laterale-halteres"],
  TH: ["tirage-vertical-poulie", "face-pull", "curl-marteau-halteres"],
  TV: ["rowing-haltere-unilateral", "face-pull", "curl-marteau-halteres"],
  SG: ["leg-press", "leg-curl-assis", "mollets-debout-machine"],
  SH: ["hip-thrust-barre", "leg-curl-assis", "gainage-planche"],
  CH: ["fentes-marchees-halteres", "leg-curl-assis", "gainage-planche"],
  FG: ["leg-press", "hip-thrust-barre", "gainage-planche"],
};
export const patternDe = (nom) => exercice(nom)?.pattern_principal
  || (/couché|pompes|dips|pec/i.test(nom) ? "PH" : /militaire|épaules|overhead/i.test(nom) ? "PV" : /rowing|tirage horizontal/i.test(nom) ? "TH" : /traction|tirage vertical/i.test(nom) ? "TV" : /soulevé|deadlift|roumain/i.test(nom) ? "CH" : /squat|presse/i.test(nom) ? "SG" : "PH");
const DOW_NOM = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const JOURS = { 1: [0], 2: [0, 3], 3: [0, 2, 4] };
export function vers(r, { id, name, jours = null } = {}) {
  const f = r.freq, ds = jours?.length === f ? jours : JOURS[f], pat = patternDe(r.nom), acc = (ACCESSOIRES[pat] || ACCESSOIRES.PH).map(s => exercice(s)).filter(Boolean);
  const phases = r.semaines.map(s => s.phase);
  const setsOf = (s, j) => s.seances[j].sets.map(x => ({ t: x.t, lo: x.lo, hi: x.hi, rpe: x.rpe, pct: null, kg: x.kg, tech: [] }));
  const sessions = Array.from({ length: f }, (_, j) => {
    const w1 = r.semaines[0], weeks = {}; r.semaines.forEach(s => { weeks[s.w] = setsOf(s, j); });
    const main = [r.nom, "F", `Roadmap : ${r.nom} ${r.kg} kg × ${r.reps}`, null, null, { sets: weeks[1], rest: REPOS.F, prog: { load: "auto", step: 2.5, every: 1, addSet: null, reps: null }, weeks }];
    const rows = [main, ...acc.map((e, k) => [e.nom, e.couche === "isolation" ? "I" : "P", "", null, null, { sets: Array.from({ length: k === 0 ? 3 : 2 }, () => ({ t: "N", lo: 8, hi: 12, rpe: 8, pct: null, kg: null, tech: [] })), rest: e.couche === "isolation" ? 75 : 120, prog: { load: "auto", step: 2.5, every: 1, addSet: null, reps: null } }])];
    return [`Séance ${String.fromCharCode(65 + j)} · ${NOM_TYPE[w1.seances[j].type] || "Séance"}`, DOW_NOM[ds[j]], rows];
  });
  const days = Array(7).fill(false); ds.forEach(d => { days[d] = true; });
  return {
    id: id || "road-" + Date.now(), custom: true, name: name || `Roadmap · ${r.nom} ${r.kg} kg`, lvl: { debutant: "Débutant", regulier: "Intermédiaire", avance: "Avancé" }[r.niveau], split: `${f} séance${f > 1 ? "s" : ""} par semaine`,
    weeks: r.nbSemaines, deload: null, phases, days, s: sessions, prof: "",
    desc: `${r.nbSemaines} semaines pour passer de ${Math.round(r.cur)} kg à ${r.kg} kg × ${r.reps} (1RM estimé ${Math.round(r.tgt)} kg), jour J le ${r.fin}.`,
    why: "Chaque semaine a sa charge, ses séries et son effort : la progression est calculée à partir de ton 1RM actuel et de ta date visée. Si ta forme change, recalcule la roadmap.",
    road: { v: VERSION, at: new Date().toISOString(), fin: r.fin, params: { nom: r.nom, cur: r.cur, tgt: r.tgt, kg: r.kg, reps: r.reps, fin: r.fin, freq: r.freq, niveau: r.niveau } },
  };
}

// Programme de roadmap démarré plus tard : on recale les semaines sur aujourd'hui pour que le jour J reste la date visée.
export function recaler(prog, debut) {
  const p = prog?.road?.params; if (!p || joursEntre(debut, p.fin) < 7) return prog;
  return vers(construire({ ...p, debut }), { id: prog.id, name: prog.name });
}
