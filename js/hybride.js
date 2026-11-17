// Programme « athlète hybride » : moteur pur (aucun accès à l'écran, au stockage ni au serveur).
// Testé par `node --test tests/hybride.test.mjs`.
//
// Toutes les valeurs (fourchettes, zones, gabarits, seuils) viennent de data/hybride.json, passé en argument (D).
// Les seuils qui sont des hypothèses sont réunis en tête de ce fichier JSON (clé « hypotheses »).
//
// Contenu :
//   1. Calendrier : macrocycle de 12 semaines = 3 mésocycles de 4 semaines, position d'un jour dans le bloc
//   2. Cibles de volume par groupe musculaire (maintien ou développement, progression S1 → S4)
//   3. Volume hebdomadaire pondéré (1 pour le principal, 0,5 pour les synergistes) et statut face à la cible
//   4. Alertes d'équilibre (poussée / tirage, genou / hanche, sous le maintien, au-dessus du plafond, total)
//   5. Gabarits de semaine et règles d'ordre (nerveux en premier, pas d'intervalles la veille des jambes lourdes, zone 2 à vélo)
//   6. Cardio : allures par zone depuis la VMA, reprise de la course
//   7. Forme du jour : on retire des accessoires, on garde les mouvements principaux
//   8. Programme en cours : jamais remplacé sans accord, l'ancien est toujours gardé en copie

export const VERSION = 1;
const MS_JOUR = 864e5;

// ---------- Dates (chaînes AAAA-MM-JJ, midi local pour éviter les décalages d'heure d'été) ----------
const dt = (iso) => new Date(iso + "T12:00:00Z");
export const addJours = (iso, n) => { const d = dt(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const ecartJours = (a, b) => Math.round((dt(b) - dt(a)) / MS_JOUR);
export const dowDe = (iso) => (dt(iso).getUTCDay() + 6) % 7; // 0 = lundi
export const lundiDe = (iso) => addJours(iso, -dowDe(iso));
const r05 = (x) => Math.round(x * 2) / 2;

// ---------- 1. Calendrier ----------
export const qualite = (D, id) => D.qualites.find(q => q.id === id) || null;
export const macro = (D, id) => D.macros.find(m => m.id === id) || null;

// Statut d'une qualité dans un macrocycle : « dev » (au plus 2) ou « maintien »
export function statutsQualites(D, macroId) {
  const m = macro(D, macroId); if (!m) throw new Error(`Macrocycle inconnu : ${macroId}`);
  const dev = new Set(m.dev.slice(0, 2));
  return Object.fromEntries(D.qualites.map(q => [q.id, dev.has(q.id) ? "dev" : "maintien"]));
}

// Les 12 semaines d'un macrocycle à partir d'un lundi
export function calendrier(D, { debut, macroId }) {
  const m = macro(D, macroId); if (!m) throw new Error(`Macrocycle inconnu : ${macroId}`);
  // Un bloc commence toujours un lundi : si la date choisie n'en est pas un, on prend le lundi suivant
  const lundi = dowDe(debut) === 0 ? debut : addJours(lundiDe(debut), 7);
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1, meso = Math.floor(i / 4) + 1, sem = (i % 4) + 1;
    const p = D.progression.find(x => x.semaine === sem);
    return { n, meso, semaine: sem, du: addJours(lundi, i * 7), au: addJours(lundi, i * 7 + 6), rir: p.rir, decharge: !!p.decharge, phase: p.nom, tests: (m.tests || {})[n] || [] };
  });
}

// Où en est-on ce jour-là ? null avant le début ; { fini: true } après la semaine 12
export function position(cal, iso) {
  if (!cal?.length || iso < cal[0].du) return null;
  const s = cal.find(x => x.du <= iso && iso <= x.au);
  return s ? { ...s, jour: dowDe(iso) } : { fini: true };
}

// ---------- 2. Cibles de volume ----------
// Groupes en développement : la liste prioritaire du bloc si elle est donnée (choix du coach), sinon les groupes
// dont la qualité est en développement, dans l'ordre de priorité du macrocycle, limités à groupesDevMax.
export function statutGroupes(D, { macroId, prioritaires = null, nbSeances = 6 }) {
  let dev;
  if (prioritaires) dev = new Set(prioritaires);
  else {
    const st = statutsQualites(D, macroId), ordre = macro(D, macroId).groupesDev || [];
    const cands = D.groupes.filter(g => st[g.qualite] === "dev" && !g.sansAlerte).map(g => g.id);
    const tries = [...ordre.filter(id => cands.includes(id)), ...cands.filter(id => !ordre.includes(id))];
    const max = D.hypotheses.groupesDevMax?.[String(nbSeances)] ?? tries.length;
    dev = new Set(tries.slice(0, max));
  }
  return Object.fromEntries(D.groupes.map(g => [g.id, dev.has(g.id) ? "dev" : "maintien"]));
}

// Cible d'un groupe pour une semaine du mésocycle (1 à 4) : { min, max, cible }
export function cibleGroupe(D, g, statut, semaine, { nbSeances = 6, depart = null } = {}) {
  const H = D.hypotheses, p = D.progression.find(x => x.semaine === semaine);
  if (!p) throw new Error(`Semaine de mésocycle invalide : ${semaine}`);
  let [lo, hi] = statut === "dev" ? g.dev : g.maintien;
  const plaf = g.grand && statut === "dev" ? H.plafondGrandGroupe?.[String(nbSeances)] : null;
  if (plaf != null) { hi = Math.min(hi, plaf); lo = Math.min(lo, hi); }
  if (depart != null && statut === "dev") lo = Math.min(Math.max(lo, depart), hi);
  const cible = statut === "dev" ? r05(lo + (hi - lo) * p.vol) : lo;
  // Décharge : pas de minimum, une petite marge au-dessus de la cible
  if (p.decharge) { const c = r05(cible * H.coefDecharge); return { min: 0, max: c + (H.margeDecharge || 0), cible: c, rir: p.rir, decharge: true }; }
  return { min: lo, max: hi, cible, rir: p.rir, decharge: false };
}

export function cibles(D, { macroId, semaine, nbSeances = 6, prioritaires = null, departs = {} }) {
  const st = statutGroupes(D, { macroId, prioritaires, nbSeances });
  return Object.fromEntries(D.groupes.map(g => [g.id, { statut: st[g.id], ...cibleGroupe(D, g, st[g.id], semaine, { nbSeances, depart: departs[g.id] ?? null }) }]));
}

// Point de départ du méso suivant : niveau de S2 si la récupération a suivi, sinon même départ (§3)
export function departMesoSuivant(D, g, statut, { recuperationOk, nbSeances = 6, depart = null }) {
  if (!recuperationOk) return depart;
  return cibleGroupe(D, g, statut, 2, { nbSeances, depart }).cible;
}

// ---------- 3. Volume pondéré ----------
// Poids d'un exercice sur chaque groupe : 1 pour le principal, 0,5 pour les synergistes.
// ex : ligne de data/exercices.json ({ nom, muscles, categorie }) ou objet minimal { nom, muscles }.
export function poidsExercice(D, ex) {
  const out = {}, nom = String(ex?.nom || ex?.name || "");
  const pose = (id, c) => { if (!(out[id] >= c)) out[id] = c; };
  // 1) motif sur le nom ou catégorie : le groupe devient principal (tibial, coiffe, psoas, cou)
  let principalForce = null;
  D.groupes.forEach(g => {
    if ((g.re && new RegExp(g.re, "iu").test(nom)) || (g.cats && g.cats.includes(ex?.categorie))) { pose(g.id, 1); principalForce = principalForce || g.id; }
  });
  // 2) étiquettes de muscles : la première est principale, les suivantes synergistes
  (ex?.muscles || []).slice(0, 3).forEach((m, i) => {
    const g = D.groupes.find(x => (x.tags || []).includes(m)); if (!g) return;
    if (principalForce && g.id !== principalForce && i === 0 && principalForce !== "psoas") { pose(g.id, 0.5); return; }
    pose(g.id, i === 0 ? 1 : 0.5);
  });
  return out;
}

// Volume de la semaine. lignes : [{ ex, series }] (séries effectives, échauffement exclu).
// Pour un groupe « direct », seules les séries où il est principal comptent.
export function volume(D, lignes) {
  const v = Object.fromEntries(D.groupes.map(g => [g.id, 0]));
  (lignes || []).forEach(({ ex, series }) => {
    const n = +series || 0; if (!n) return;
    Object.entries(poidsExercice(D, ex)).forEach(([id, c]) => {
      const g = D.groupes.find(x => x.id === id);
      if (g.direct && c < 1) return;
      v[id] += n * c;
    });
  });
  Object.keys(v).forEach(k => { v[k] = r05(v[k]); });
  return v;
}

// Lignes d'une semaine à partir des séances terminées (format de js/engine.js : workouts[].exercises[].sets[])
export function lignesDepuisSeances(workouts, exDe, { du, au }) {
  const lignes = [];
  (workouts || []).forEach(w => {
    const d = String(w.end || w.start || w.d || "").slice(0, 10); if (!d || d < du || d > au) return;
    (w.exercises || []).forEach(e => {
      const n = (e.sets || []).filter(s => s.done && s.type !== "W").length; if (!n) return;
      lignes.push({ ex: exDe(e.name) || { nom: e.name, muscles: [] }, series: n });
    });
  });
  return lignes;
}

// Statut d'un volume face à sa cible
export function statutVolume(D, v, c) {
  const m = D.hypotheses.margePlafond || 0;
  if (v < c.min) return "sous";
  if (v > c.max + m) return "au-dessus";
  return "dans";
}

// ---------- 4. Alertes d'équilibre ----------
// Séries par pattern (codes de data/exercices.json). SH (squat dominante hanche) compte moitié genou, moitié hanche (hypothèse).
export function seriesParPattern(lignes) {
  const p = {};
  (lignes || []).forEach(({ ex, series }) => {
    const n = +series || 0; if (!n) return;
    [[ex?.pattern_principal, 1], [ex?.pattern_secondaire, 0.5]].forEach(([c, k]) => { if (c) p[c] = (p[c] || 0) + n * k; });
  });
  return p;
}

const ratioAlerte = (a, b, max, min = 0) => (a >= Math.max(min, 1e-9) && (b === 0 || a / b > max));

export function alertes(D, { lignes, cibles: C, nbSeances = 6 }) {
  const H = D.hypotheses, out = [];
  const v = volume(D, lignes), p = seriesParPattern(lignes);
  const P = (c) => p[c] || 0;
  // Poussée / tirage, par plan
  [["PH", "TH", "horizontal"], ["PV", "TV", "vertical"]].forEach(([pou, tir, plan]) => {
    if (ratioAlerte(P(pou), P(tir), H.ratioPousseeTirageMax, H.seriesMinAlerteRatio)) out.push({ id: `poussee-${plan}`, niveau: "attention", texte: `Plus de poussée que de tirage sur le plan ${plan} (${P(pou)} séries contre ${P(tir)}).` });
  });
  // Genou / hanche
  const genou = P("SG") + P("SH") / 2, hanche = P("CH") + P("FG") + P("SH") / 2;
  if (ratioAlerte(genou, hanche, H.ratioGenouHancheMax, H.seriesMinAlerteRatio)) out.push({ id: "genou", niveau: "attention", texte: `Plus de travail dominante genou que dominante hanche (${genou} contre ${hanche}).` });
  else if (ratioAlerte(hanche, genou, H.ratioGenouHancheMax, H.seriesMinAlerteRatio)) out.push({ id: "hanche", niveau: "attention", texte: `Plus de travail dominante hanche que dominante genou (${hanche} contre ${genou}).` });
  // Muscle sous le maintien ou au-dessus du plafond
  if (C) D.groupes.forEach(g => {
    const c = C[g.id]; if (!c || g.sansAlerte) return;
    const s = statutVolume(D, v[g.id], c);
    if (s === "sous" && !g.sansAlerteBas && c.min > 0) out.push({ id: `sous-${g.id}`, groupe: g.id, niveau: c.statut === "dev" ? "attention" : "info", texte: `${g.nom} : ${v[g.id]} séries, sous ${c.statut === "dev" ? "la cible" : "le maintien"} (${c.min}).` });
    if (s === "au-dessus") out.push({ id: `plafond-${g.id}`, groupe: g.id, niveau: "attention", texte: `${g.nom} : ${v[g.id]} séries, au-dessus du plafond (${c.max}).` });
  });
  // Total de la semaine
  const total = (lignes || []).reduce((t, l) => t + (+l.series || 0), 0), tmax = H.totalMaxSemaine?.[String(nbSeances)];
  if (tmax && total > tmax) out.push({ id: "total", niveau: "attention", texte: `${total} séries cette semaine : au-delà de ${tmax}, la récupération risque de ne pas suivre.` });
  return out;
}

// ---------- 5. Gabarits et règles d'ordre ----------
export function gabarit(D, nbSeances) {
  const g = D.gabarits[String(nbSeances)]; if (!g) throw new Error(`Pas de gabarit à ${nbSeances} séances (3 à 6).`);
  return JSON.parse(JSON.stringify(g));
}

// Zone de cardio effective d'une séance pour une semaine du macro (reprise : zone 2 seulement)
export function cardioEffectif(D, s, { semaineMacro = 1, reprise = false } = {}) {
  if (!s.cardio) return null;
  const c = { ...s.cardio };
  const enReprise = reprise && semaineMacro <= D.cardio.repriseSemaines;
  if (!enReprise && c.apresReprise) c.zone = c.apresReprise;
  if (!enReprise && c.modaliteApresReprise) c.modalite = c.modaliteApresReprise;
  if (!enReprise && c.alterne && semaineMacro % 2 === 0) c.zone = c.alterne;
  // Reprise : les intervalles deviennent de la zone 2 à vélo (moins d'impacts pour les tendons)
  if (enReprise && c.zone !== "Z1" && c.zone !== "Z2") { c.zone = "Z2"; c.modalite = "velo"; c.remplace = true; }
  return c;
}
export const estIntervalles = (c) => !!c && (c.zone === "Z4" || c.zone === "Z5" || c.zone === "V");

// Vérifie une semaine (liste de séances { jour, blocs, jambesLourdes, cardio }). Renvoie la liste des règles enfreintes.
export function verifierSemaine(D, seances, opts = {}) {
  const out = [], rang = Object.fromEntries(D.blocs.map(b => [b.id, b])), H = D.hypotheses;
  seances.forEach(s => {
    // Nerveux en début de séance : aucun bloc non nerveux (hors échauffement) avant un bloc nerveux
    let vuAutre = null;
    (s.blocs || []).forEach(b => {
      const B = rang[b]; if (!B || b === "echauffement") return;
      if (B.nerveux && vuAutre) out.push({ regle: "ordre", jour: s.jour, texte: `${B.nom} doit passer avant ${rang[vuAutre].nom}.` });
      if (!B.nerveux) vuAutre = vuAutre || b;
    });
  });
  // Jamais d'intervalles la veille des jambes lourdes (semaine cyclique)
  seances.forEach(s => {
    if (!estIntervalles(cardioEffectif(D, s, opts))) return;
    const lendemain = (s.jour + H.decalageVeilleJambes) % 7;
    const j = seances.find(x => x.jour === lendemain && x.jambesLourdes);
    if (j) out.push({ regle: "veille", jour: s.jour, texte: `Intervalles la veille d'une séance de jambes lourdes (${j.nom || "jour " + (j.jour + 1)}).` });
  });
  // Zone 2 en partie à vélo ou au rameur
  const z2 = seances.map(s => cardioEffectif(D, s, opts)).filter(c => c && c.zone === "Z2");
  if (z2.length && !z2.some(c => c.modalite === "velo" || c.modalite === "rameur")) out.push({ regle: "z2", texte: "Aucune zone 2 à vélo ou au rameur cette semaine : la course seule interfère plus avec la force." });
  return out;
}

// ---------- 6. Cardio ----------
const kmh = (vma, pct) => Math.round(vma * pct) / 100;
export const allureMinKm = (v) => { if (!v) return null; const s = Math.round(3600 / v); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export function allures(D, vma) {
  if (!(vma > 0)) return [];
  return D.zones.map(z => ({ id: z.id, nom: z.nom, kmh: [kmh(vma, z.vma[0]), kmh(vma, z.vma[1])], allure: [allureMinKm(kmh(vma, z.vma[1])), allureMinKm(kmh(vma, z.vma[0]))] }));
}
// VMA estimée depuis un demi-Cooper (6 min) : distance en mètres → km/h
export const vmaDemiCooper = (m) => Math.round(m / 100 * 10) / 10;
export const zoneDe = (D, vma, vitesse) => { if (!(vma > 0)) return null; const p = vitesse / vma * 100; return [...D.zones].reverse().find(z => p >= z.vma[0])?.id || "Z1"; };

// ---------- 7. Forme du jour ----------
// seance : { blocs: [{ id, exercices: [{ nom, role: "principal" | "accessoire", max?: bool }] }] }
// feu : « vert », « orange » ou « rouge » (même échelle que js/recuperation.js).
// On garde toujours l'échauffement et les mouvements principaux. Orange et rouge : pas de sprint, de pliométrie ni de max.
export function formeDuJour(D, seance, feu) {
  const part = D.hypotheses.formeDuJour?.[feu]; if (part == null) throw new Error(`Feu inconnu : ${feu}`);
  const s = JSON.parse(JSON.stringify(seance)), info = Object.fromEntries(D.blocs.map(b => [b.id, b]));
  if (feu === "vert") return { seance: s, retires: [], note: null };
  const retires = [];
  s.blocs = s.blocs.filter(b => { if (info[b.id]?.maxEffort) { retires.push(...(b.exercices || []).map(e => e.nom)); return false; } return true; });
  // Accessoires = exercices non principaux des blocs qui ne sont pas principaux (l'échauffement, la force, les skills et le cardio restent)
  const acc = s.blocs.filter(b => !info[b.id]?.principal).flatMap(b => (b.exercices || []).filter(e => e.role !== "principal").map(e => ({ b, e })));
  const n = Math.round(acc.length * part);
  // On retire les derniers accessoires de la séance (ceux qu'on ferait en fin de séance)
  acc.slice(acc.length - n).forEach(({ b, e }) => { b.exercices = b.exercices.filter(x => x !== e); retires.push(e.nom); });
  s.blocs.forEach(b => (b.exercices || []).forEach(e => { if (e.max) { e.max = false; e.note = "Pas de maximum aujourd'hui : séries lourdes habituelles."; } }));
  s.blocs = s.blocs.filter(b => b.id === "echauffement" || (b.exercices || []).length);
  s.forme = feu;
  return { seance: s, retires, note: `Version adaptée à ta forme : ${retires.length} exercice${retires.length > 1 ? "s" : ""} retiré${retires.length > 1 ? "s" : ""}, mouvements principaux gardés.` };
}

// ---------- 8. Programme en cours ----------
// etat : { hybride: { courant, anciens: [] } }. Jamais d'écrasement sans accord ; l'ancien est toujours copié.
export function remplacerProgramme(etat, nouveau, { accord = false, maintenant = new Date().toISOString() } = {}) {
  const h = etat?.hybride || { courant: null, anciens: [] };
  if (h.courant && !accord) return { ok: false, raison: "accord", etat };
  const anciens = [...(h.anciens || [])];
  if (h.courant) anciens.push({ ...JSON.parse(JSON.stringify(h.courant)), archiveLe: maintenant });
  return { ok: true, etat: { ...etat, hybride: { ...h, courant: { ...nouveau, v: VERSION, creeLe: maintenant }, anciens } } };
}

// Lecture d'un ancien format : on ne modifie jamais l'original, on renvoie une copie au format courant
export function lire(h) {
  if (!h) return { courant: null, anciens: [] };
  if (h.v === undefined && h.macroId) return { courant: { ...JSON.parse(JSON.stringify(h)), v: VERSION, migreDe: 0 }, anciens: [] };
  return { courant: h.courant || null, anciens: h.anciens || [] };
}
