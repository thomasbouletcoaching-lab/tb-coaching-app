// Indice de difficulté de la séance (créateur de programme, étape 4). Module pur : testé par `node --test tests/indice.test.mjs`.
//
// Un seul chiffre lisible (0 à 100, puis Légère / Modérée / Exigeante / Très exigeante) qui combine, comme dans la spec (§5) :
//   1. la DURÉE estimée : séries × (temps d'exécution + repos) + échauffement ;
//   2. la CHARGE D'INTENSITÉ, inspirée de l'INOL : pour chaque série, répétitions ÷ (100 − % du 1RM). Sans 1RM connu, le % est
//      estimé à partir des répétitions et du RPE (même formule que le moteur de séances : Epley corrigé par les répétitions en réserve) ;
//   3. le COÛT NERVEUX : un mouvement lourd et polyarticulaire proche de l'échec coûte plus qu'une isolation au même RPE.
// Côté membre : « Indice de difficulté de la séance ». Le détail INOL n'est montré que côté coach et dans « En savoir plus ».
// Les seuils et coefficients sont des points de départ (spec : « Terrain ou hypothèse »), réunis ici pour être ajustés.

export const EXEC_S = 40;              // secondes d'exécution d'une série
export const ECHAUFFEMENT_MIN = 8;     // minutes d'échauffement d'une séance complète
export const PLAFOND_REPOS = { 20: 90, 30: 120, 45: 150 }; // repos maximal (s) des versions allégées
export const ECHAUFFEMENT_ALLEGE = { 20: 3, 30: 4, 45: 5 };

// Pondération des trois ingrédients (somme = 1) et valeurs qui donnent le maximum de chacun
export const POIDS = { duree: 0.30, inol: 0.40, nerveux: 0.30 };
export const REF = { dureeMin: 20, dureeMax: 100, inol: 11, nerveux: 16 };
// Bandes de l'indice (borne haute exclue)
export const NIVEAUX = [{ id: "legere", nom: "Légère", max: 28 }, { id: "moderee", nom: "Modérée", max: 50 }, { id: "exigeante", nom: "Exigeante", max: 70 }, { id: "tres", nom: "Très exigeante", max: 101 }];
// Coût nerveux d'une série à RPE max, selon le coût de l'exercice (1 = isolation, 3 = mouvement lourd polyarticulaire)
export const COUT = { 1: 0.25, 2: 0.6, 3: 1 };
const BONUS_LOURD = 1.5;               // série à ≥ 85 % du 1RM ou RPE ≥ 9 sur un mouvement polyarticulaire (coût ≥ 2)
const DENOM_MIN = 5;                   // plancher du dénominateur de l'INOL (évite l'infini près du 1RM)
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

// ---------- % du 1RM ----------
// Epley corrigé par les répétitions en réserve (RIR = 10 − RPE) ; identique à engine.js (pctFor), vérifié dans tests/monplan-e2e.js
export const repsEffectives = (reps, rpe) => Math.min(reps + Math.max(0, 10 - (rpe || 8)), 15);
export const pctDe = (reps, rpe = 8) => { const r = repsEffectives(reps, rpe); return r <= 1 ? 100 : 100 / (1 + r / 30); };

// ---------- Une ligne = un exercice ----------
// { nom, kind, nerveux (1-3), rest (s), unite: "reps" | "s",
//   n, lo, hi, rpe, pct   (n séries identiques)   ou   series: [{ lo, hi, rpe, pct, t }] }
export function series(l) {
  if (Array.isArray(l.series) && l.series.length) return l.series;
  return Array.from({ length: Math.max(0, l.n || 0) }, () => ({ lo: l.lo, hi: l.hi, rpe: l.rpe, pct: l.pct }));
}
const travail = (s) => s.t !== "W"; // les séries d'échauffement ne comptent pas dans la charge

// INOL d'une série : répétitions ÷ (100 − %1RM). Maintien en secondes : l'effort est faible, on compte 1 « répétition » par 10 s à 60 %.
export function inolSerie(s, l = {}) {
  if (!travail(s) || l.kind === "M") return 0;
  const reps = ((+s.lo || 0) + (+s.hi || +s.lo || 0)) / 2;
  if (l.unite === "s") return (reps / 10) / (100 - 60);
  const pct = s.pct || pctDe(reps, s.rpe);
  return reps / Math.max(100 - Math.min(pct, 100), DENOM_MIN);
}
export const nerveuxSerie = (s, l = {}) => {
  if (!travail(s) || l.kind === "M") return 0;
  const cout = COUT[l.nerveux] ?? COUT[2], rpe = s.rpe || 7.5, reps = ((+s.lo || 0) + (+s.hi || +s.lo || 0)) / 2;
  const pct = s.pct || pctDe(reps, s.rpe);
  const lourd = (l.nerveux || 2) >= 2 && l.unite !== "s" && (pct >= 85 || rpe >= 9);
  return cout * clamp((rpe - 5) / 5) * (lourd ? BONUS_LOURD : 1);
};
export const nbSeriesTravail = (l) => series(l).filter(travail).length;
export const dureeLigneMin = (l, cap = null) => nbSeriesTravail(l) * (EXEC_S + Math.min(l.rest ?? 90, cap ?? 1e9)) / 60;
export function minutes(lignes, { echauffement = ECHAUFFEMENT_MIN, cap = null } = {}) {
  return Math.round(echauffement + lignes.reduce((t, l) => t + dureeLigneMin(l, cap), 0));
}

// ---------- Une séance ----------
export function indiceSeance(lignes, opts = {}) {
  const parLigne = lignes.map(l => { const ss = series(l); return { nom: l.nom, series: ss.filter(travail).length, inol: ss.reduce((t, s) => t + inolSerie(s, l), 0), nerveux: ss.reduce((t, s) => t + nerveuxSerie(s, l), 0) }; });
  const inol = parLigne.reduce((t, x) => t + x.inol, 0), nerveux = parLigne.reduce((t, x) => t + x.nerveux, 0), min = minutes(lignes, opts);
  const comp = { duree: clamp((min - REF.dureeMin) / (REF.dureeMax - REF.dureeMin)), inol: clamp(inol / REF.inol), nerveux: clamp(nerveux / REF.nerveux) };
  const score = lignes.length ? Math.round(100 * (POIDS.duree * comp.duree + POIDS.inol * comp.inol + POIDS.nerveux * comp.nerveux)) : 0;
  return { score, niveau: niveauDe(score), minutes: min, inol: round1(inol), nerveux: round1(nerveux), composantes: comp, parLigne: parLigne.map(x => ({ ...x, inol: round2(x.inol), nerveux: round2(x.nerveux) })) };
}
const round1 = (x) => Math.round(x * 10) / 10, round2 = (x) => Math.round(x * 100) / 100;
export function niveauDe(score) { const n = NIVEAUX.find(x => score < x.max) || NIVEAUX.at(-1); return { id: n.id, nom: n.nom, rang: NIVEAUX.indexOf(n) + 1 }; }

// Charge de la semaine : somme des charges brutes. Elle sera comparée à la capacité estimée de la personne (score de soutenabilité, étape 6).
export function chargeSemaine(indices) {
  return { inol: round1(indices.reduce((t, i) => t + i.inol, 0)), nerveux: round1(indices.reduce((t, i) => t + i.nerveux, 0)), minutes: indices.reduce((t, i) => t + i.minutes, 0), scoreMoyen: indices.length ? Math.round(indices.reduce((t, i) => t + i.score, 0) / indices.length) : 0, seances: indices.length };
}

// Deux séances « Très exigeantes » à moins de 48 h : à éviter (spec §5.3). `jours` = indices de jour (0 = lundi).
export function enchainementsLourds(seances) {
  const out = [], s = [...seances].sort((a, b) => a.dow - b.dow);
  for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; if (s.length < 2 || a === b) continue; const ecart = (b.dow - a.dow + 7) % 7; if (ecart <= 1 && a.indice?.niveau.id === "tres" && b.indice?.niveau.id === "tres") out.push([a.titre, b.titre]); }
  return out;
}

// ---------- Version allégée (20, 30 ou 45 min) : garde le squelette, retire l'isolation et les modules, puis des séries ----------
// `prioritaires` : patterns à garder en dernier recours (priorités et points faibles). Ne modifie pas la séance d'origine.
// Les lignes rendues portent toujours un tableau `series` (les séries d'échauffement ne sont pas gardées : l'échauffement est réduit à part).
export function allegee(lignes, cible, { prioritaires = [] } = {}) {
  const cap = PLAFOND_REPOS[cible] || 120, warm = ECHAUFFEMENT_ALLEGE[cible] || 4, opts = { echauffement: warm, cap };
  const prio = new Set(prioritaires), retire = [];
  const squelette = (x) => x.couche === "squelette";
  lignes.filter(x => !squelette(x)).forEach(x => retire.push(x.nom));
  let l = lignes.filter(squelette).map(x => ({ ...x, rest: Math.min(x.rest ?? 90, cap), series: series(x).filter(travail).map(s => ({ ...s })) }));
  const nb = (x) => x.series.length;
  // Valeur de conservation : un pattern prioritaire, puis un mouvement lourd, passent en dernier
  const valeur = (x) => (prio.has(x.pattern) ? 100 : 0) + (x.nerveux || 1) * 10 + nb(x);
  const moins = (x) => { x.series = x.series.slice(0, -1); };
  let garde = 400;
  while (minutes(l, opts) > cible && garde-- > 0) {
    const a = l.filter(x => nb(x) > 2).sort((p, q) => valeur(p) - valeur(q) || nb(q) - nb(p))[0];
    if (a) { moins(a); continue; }
    const b = l.filter(x => nb(x) > 1 && (x.nerveux || 1) < 3).sort((p, q) => valeur(p) - valeur(q))[0];
    if (b) { moins(b); continue; }
    if (l.length <= 2) break;
    // Dernier recours : un pattern déjà présent ailleurs dans la séance d'abord, puis le moins prioritaire
    const doublon = l.filter(x => l.filter(y => y.pattern === x.pattern).length > 1).sort((p, q) => valeur(p) - valeur(q))[0];
    const sort = doublon || [...l].sort((p, q) => valeur(p) - valeur(q))[0];
    l = l.filter(x => x !== sort); retire.push(sort.nom);
  }
  const min = minutes(l, opts);
  return { cible, items: l, retire, minutes: min, indice: indiceSeance(l, opts), tient: min <= cible };
}
