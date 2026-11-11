// Générateur de programme individualisé (créateur de programme, étape 3).
// Module pur (aucun accès à l'écran ni au stockage) : testé par `node --test tests/generateur.test.mjs`.
//
// Entrée  : les réponses du questionnaire (S().programme = { answers, prefs }) et la bibliothèque d'exercices.
// Sortie  : une PROPOSITION de programme (jamais appliquée toute seule) : séances, séries, durée estimée, contrôles.
// Couche 1 (squelette) : les 8 patterns, répartis selon le nombre de séances, avec les règles de récupération.
// Couche 2 (isolation) : selon l'objectif, les priorités et le temps restant. Couche 3 : modules utiles (mobilité, unilatéral, rotation).
// Les seuils sont des points de départ (spec Notion, §3.1 et §4) : ils sont réunis en haut de ce fichier pour être ajustés.
import { BASE } from "./exercices-base.js";
import { PATTERNS, PATTERN, exercices, CATEGORIES, estRoi } from "./exercices.js";
import { contraintes, joursRetenus, ecartSeances } from "./programme.js";
import { controlesObjectif } from "./soutenabilite.js";
import { indiceSeance, chargeSemaine, enchainementsLourds, allegee, EXEC_S, ECHAUFFEMENT_MIN, minutes as minutesIndice } from "./indice.js";

export const VERSION = 1;
const ORDRE = PATTERNS.map(p => p.code);
const HAUT = ["PH", "PV", "TH", "TV"], BAS = ["SG", "SH", "CH", "FG"];
export const DOW = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// ---- Réglages (séries difficiles par pattern et par semaine, spec §3.1) ----
export const SERIES = { debutant: { cible: 4, max: 6 }, regulier: { cible: 8, max: 10 }, avance: { cible: 10, max: 14 }, peuDeTemps: { cible: 4, max: 5 } };
export const MIN_SERIES = 3;
const TEMPS_RESTREINT_MIN = 120; // moins de 2 h d'entraînement par semaine : minimum utile
const REPOS = { F: 180, P: 120, I: 75, C: 60, M: 30 };
// Jours d'entraînement proposés par défaut (l'agenda personnel viendra à l'étape 5)
const JOURS = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
// Même liste que le moteur de séances (engine.js, unitOf) : exercices mesurés en secondes
const SECONDES = /gainage|planche|plank|chaise contre|copenhagen|hollow|suspension|isom|L-sit|stretch|étirement|marche active|marche inclinée|vélo|corde à sauter|équilibre sur|tenu|porté|carry|farmers|spanish squat|mobilité|bear hold|body saw|squat profond/i;
export const enSecondes = (nom) => SECONDES.test(nom || "");

const niveauDe = (a) => ({ beginner: "debutant", comeback: "debutant", regular: "regulier", advanced: "avance" })[a.level] || "regulier";

// ---------- Structure de la semaine (spec §3.2) ----------
const S = (label, elig) => ({ label, elig });
const FULL = (label) => S(label, ORDRE), HB = S("Haut du corps", HAUT), BB = S("Bas du corps", BAS);
export function structure(n, style = "any") {
  const st = style || "any";
  let sessions, note = null;
  if (n <= 1) sessions = [FULL("Corps entier")];
  else if (n === 2) sessions = st === "hautbas" ? [HB, BB] : [FULL("Corps entier A"), FULL("Corps entier B")];
  else if (n === 3) sessions = st === "hautbas" ? [HB, BB, S("Complet · priorités", null)] : st === "ppl" ? [S("Pousser", ["PH", "PV"]), S("Tirer", ["TH", "TV"]), S("Jambes", BAS)] : [FULL("Corps entier A"), FULL("Corps entier B"), FULL("Corps entier C")];
  else if (n === 4) sessions = st === "fullbody" ? "ABCD".split("").map(l => FULL("Corps entier " + l)) : st === "ppl" ? [S("Pousser", ["PH", "PV"]), S("Tirer", ["TH", "TV"]), S("Jambes", BAS), S("Complet · priorités", null)] : [HB, BB, HB, BB];
  else if (n === 5) sessions = st === "fullbody" ? "ABCDE".split("").map(l => FULL("Corps entier " + l)) : st === "ppl" ? [S("Pousser", ["PH", "PV"]), S("Tirer", ["TH", "TV"]), S("Jambes", BAS), HB, BB] : [HB, BB, HB, BB, S("Complet · priorités", null)];
  else {
    if (st === "fullbody") note = "Six séances « corps entier » ne laissent pas assez de récupération : je propose pousser / tirer / jambes deux fois.";
    sessions = st === "hautbas" ? [HB, BB, HB, BB, HB, BB] : [S("Pousser", ["PH", "PV"]), S("Tirer", ["TH", "TV"]), S("Jambes", BAS), S("Pousser", ["PH", "PV"]), S("Tirer", ["TH", "TV"]), S("Jambes", BAS)];
  }
  const type = sessions.every(s => s.elig?.length === 8) ? "full" : "split";
  const lettres = {}; // « Haut du corps » deux fois : A, B
  const total = {}; sessions.forEach(s => { total[s.label] = (total[s.label] || 0) + 1; });
  const vus = {}; const libs = sessions.map(s => { if (total[s.label] < 2) return s.label; vus[s.label] = (vus[s.label] || 0) + 1; return `${s.label} ${"ABC"[vus[s.label] - 1]}`; });
  // Avec une séance « complète » à 4 séances, on la décale pour garder 48 h après les jambes
  const dows = n === 4 && sessions.some(s => !s.elig) ? [0, 1, 3, 5] : JOURS[Math.min(6, Math.max(1, n))];
  return { type, note, sessions: sessions.map((s, i) => ({ ...s, titre: libs[i], dow: dows[i] })) };
}

// ---------- Volume par pattern ----------
const PRIORITE_PATTERNS = { pecs: ["PH"], epaules: ["PV"], dos: ["TH", "TV"], quadriceps: ["SG", "SH"], ischios: ["CH", "FG"], fessiers: ["CH", "SH"] };
const NOMS_PRIORITE = { pecs: "pecs", epaules: "épaules", dos: "dos", quadriceps: "quadriceps", ischios: "ischios", fessiers: "fessiers" };
export function profil(a = {}, n) {
  const niveau = niveauDe(a), tempsRestreint = n * (+a.sessionMin || 60) <= TEMPS_RESTREINT_MIN;
  // Plan volontairement sous la capacité quand les arrêts passés ou l'écart voulu/tenable le suggèrent (spec §9.5)
  const sousCapacite = ["3", "5"].includes(String(a.quits)) || ecartSeances(a) >= 2;
  const fatigue = a.sleep === "5" || a.stress === "high";
  return { niveau, tempsRestreint, sousCapacite, fatigue, travailPhysique: a.work === "physical" };
}
export function seriesParPattern(a = {}, n) {
  const pf = profil(a, n), ref = SERIES[pf.tempsRestreint ? "peuDeTemps" : pf.niveau], out = {};
  const prio = {}, faibles = new Set(a.weak || []);
  (a.priorities || []).forEach(g => (PRIORITE_PATTERNS[g] || []).forEach(p => { (prio[p] = prio[p] || []).push(NOMS_PRIORITE[g]); }));
  for (const p of ORDRE) {
    let s = ref.cible; const why = [];
    if (prio[p]) { s += 2; why.push(`priorité ${prio[p].join(", ")}`); }
    if (faibles.has(p)) { s += 2; why.push("point faible"); }
    if (pf.travailPhysique && BAS.includes(p)) { s -= 1; why.push("travail physique : bas du corps allégé"); }
    if (pf.fatigue) { s -= 1; why.push("sommeil ou stress : volume allégé"); }
    if (pf.sousCapacite) { s -= 1; why.push("départ volontairement sous ta capacité"); }
    out[p] = { sets: Math.max(MIN_SERIES, Math.min(ref.max, s)), why, prio: !!prio[p] || faibles.has(p) };
  }
  return out;
}

// ---------- Choix des exercices ----------
const TECHNIQUE = /pause|tempo|Spoto|Larsen|déficit|sécurités|planches|blocs|avec élastiques|prise arrachée|Anderson|pin press|board press|Swiss|claquées|archer|pseudo|à un bras|négatifs|explosi|lockout|bras tendus|jambes tendues|Zercher|Safety|unilatéral/i;
const re = { talons: /talons|hack|presse|leg press|goblet|split|fentes|pendulum|belt/i };
export function pool(code, prog, rows = exercices(), { niveau = "avance", filtreNiveau = true } = {}) {
  const c = contraintes(prog), a = prog?.answers || {}, prefs = prog?.prefs || {};
  const max = { debutant: 0, intermediaire: 1, avance: 2 }, plafond = { debutant: 0, regulier: 1, avance: 2 }[niveau];
  const rang = (e) => max[e.niveau];
  const pf = profil(a, 3);
  const score = (e) => {
    let s = 0;
    if (prefs[e.slug] === "love") s -= 100;
    if (code === "SG" && (a.torso === "lot" || a.ankle === "limited") && re.talons.test(e.nom)) s -= 20;
    if (code === "PV" && a.shoulder === "limited") s += (e.contre_indications.includes("epaule") ? 15 : 0) - (/machine|landmine|élastique/i.test(e.nom) ? 10 : 0);
    if (/pull-over/i.test(e.nom)) s += 8; if (/^Dips/i.test(e.nom)) s += 4; if (/Squat (sumo )?poids de corps/i.test(e.nom)) s += 6;
    s += Math.abs(rang(e) - plafond) * 3;
    if (!BASE.has(e.slug) && !estRoi(e)) s += 14; // les autres exercices de la famille restent disponibles (remplacer, favoris) mais passent après
    if (TECHNIQUE.test(e.nom)) s += 12; // variantes techniques (pause, tempo, prises spéciales…) : disponibles, mais après les mouvements de base
    if (estRoi(e) && plafond >= 1) s -= 4; // les exercices rois passent devant, dès le niveau régulier
    s += (pf.fatigue || pf.sousCapacite || pf.travailPhysique || plafond === 0) ? e.cout_nerveux * 3 : (niveau === "avance" ? -e.cout_nerveux : 0);
    return s;
  };
  return rows.filter(e => e.actif && e.couche === "squelette" && e.pattern_principal === code)
    .filter(e => !c.materiel.length || e.materiel.some(m => c.materiel.includes(m)))
    .filter(e => !e.contre_indications.some(z => c.contreIndications.includes(z)))
    .filter(e => !c.exclure.includes(e.slug))
    .filter(e => !filtreNiveau || rang(e) <= plafond || prefs[e.slug] === "love" || estRoi(e))
    .map(e => [score(e), e]).sort((x, y) => x[0] - y[0] || x[1].nom.localeCompare(y[1].nom, "fr")).map(v => v[1]);
}
const choisir = (liste, k, seed = 0) => { if (!liste.length) return []; const d = seed % Math.min(liste.length, 4); return [...liste.slice(d), ...liste.slice(0, d)].slice(0, k); };

// ---------- Fiche d'une ligne : séries, répétitions, repos ----------
export function kindDe(e) {
  if (e.couche === "squelette") return e.cout_nerveux >= 3 ? "F" : "P";
  if (e.couche === "isolation") return "I";
  if (e.categorie === "mobilite") return "M";
  if (e.categorie === "rotation") return "C";
  return "P";
}
export function ligne(e, n, a = {}, pf = profil(a, 3)) {
  const kind = kindDe(e), force = a.goal === "strength", debut = pf.niveau === "debutant", sec = enSecondes(e.nom);
  let lo, hi;
  if (kind === "F") [lo, hi] = force ? [3, 6] : debut ? [6, 10] : [5, 8];
  else if (kind === "P") [lo, hi] = force ? [5, 8] : debut ? [10, 12] : [8, 12];
  else if (kind === "I") [lo, hi] = force ? [8, 12] : [10, 15];
  else if (kind === "C") [lo, hi] = [10, 12];
  else [lo, hi] = [30, 30];
  if (sec && kind !== "M") [lo, hi] = [30, 45];
  let rpe = kind === "M" ? null : debut ? 7 : pf.niveau === "avance" && kind !== "I" ? 8.5 : 8;
  if (rpe && pf.sousCapacite) rpe = Math.min(rpe, 7.5);
  return { slug: e.slug, nom: e.nom, pattern: e.pattern_principal, couche: e.couche, categorie: e.categorie, kind, n, lo, hi, rpe, rest: REPOS[kind], unite: sec || kind === "M" ? "s" : "reps", nerveux: e.cout_nerveux, note: e.note || "" };
}
export const minutesLigne = (l) => l.n * (EXEC_S + l.rest) / 60;
export const minutesSeance = (items) => minutesIndice(items);

// ---------- Répartition des patterns sur les séances, avec récupération ----------
export const dist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 7 - d); };
function ecartMini(dows) { if (dows.length < 2) return 7; const s = [...dows].sort((x, y) => x - y); let m = 7; for (let i = 0; i < s.length; i++) m = Math.min(m, (s[(i + 1) % s.length] - s[i] + 7) % 7 || 7); return m; }
function combinaisons(arr, k) { if (k === 0) return [[]]; if (arr.length < k) return []; const [x, ...r] = arr; return [...combinaisons(r, k - 1).map(c => [x, ...c]), ...combinaisons(r, k)]; }
// Écart minimal (jours) exigé entre deux séances d'un même pattern : 3 pour une charnière lourde (72 h), 2 sinon (48 h)
export const ecartExige = (code, lourd) => code === "CH" && lourd ? 3 : 2;

export function generer(prog, opts = {}) {
  const a = prog?.answers || {}, seed = opts.seed || 0, rows = opts.rows || exercices();
  const n = Math.min(6, Math.max(1, joursRetenus(a) || 3)), st = structure(n, a.style);
  const pf = profil(a, n), sp = seriesParPattern(a, n), avert = [];
  if (st.note) avert.push(st.note);
  const sessions = st.sessions.map(s => ({ titre: s.titre, dow: s.dow, type: s.label, elig: s.elig, items: [], patterns: [] }));
  const sPat = {}, manquants = [];

  // 1. Exercices retenus par pattern (du plus contraint au plus libre : les points prioritaires d'abord)
  const ordre = [...ORDRE].sort((x, y) => (sp[y].prio - sp[x].prio) || (x === "CH" ? -1 : y === "CH" ? 1 : 0) || ORDRE.indexOf(x) - ORDRE.indexOf(y));
  const exos = {};
  for (const code of ordre) {
    let l = pool(code, prog, rows, { niveau: pf.niveau });
    if (!l.length) l = pool(code, prog, rows, { niveau: pf.niveau, filtreNiveau: false });
    if (!l.length) { manquants.push(code); avert.push(`Aucun exercice ${code} (${PATTERN[code].nom}) avec ton matériel et tes gênes : ce pattern est absent de la proposition.`); continue; }
    exos[code] = l;
  }

  // 2. Fréquence et séances de chaque pattern, avec les écarts de récupération
  const fixes = sessions.map((s, i) => i).filter(i => sessions[i].elig);
  const charge = sessions.map(() => 0);
  for (const code of ordre.filter(c => exos[c])) {
    const lourd = exos[code][0].cout_nerveux >= 3, exige = ecartExige(code, lourd);
    const elig = fixes.filter(i => sessions[i].elig.includes(code));
    let f = st.type === "full" ? (sp[code].prio && n >= 3 ? 3 : 2) : elig.length;
    f = Math.min(f, elig.length, Math.max(1, Math.floor(sp[code].sets / 2)));
    let choix = null;
    for (; f >= 1 && !choix; f--) {
      const cs = combinaisons(elig, f).filter(c => f === 1 || ecartMini(c.map(i => sessions[i].dow)) >= exige);
      if (cs.length) choix = cs.sort((x, y) => (x.reduce((t, i) => t + charge[i], 0) - y.reduce((t, i) => t + charge[i], 0)) || (ecartMini(y.map(i => sessions[i].dow)) - ecartMini(x.map(i => sessions[i].dow))))[0];
    }
    if (!choix) choix = [elig[0]];
    choix.forEach(i => { sessions[i].patterns.push(code); charge[i]++; });
    sPat[code] = choix;
  }
  // Séance « complète · priorités » : les patterns à travailler en plus, un du haut et un du bas au moins
  sessions.forEach((s, i) => {
    if (s.elig) return;
    const deja = (c) => (sPat[c] || []).length;
    // Seulement les patterns qui gardent leur récupération : 48 h (72 h pour une charnière lourde) avec leurs autres séances
    const libre = (c) => (sPat[c] || []).every(j => dist(sessions[j].dow, s.dow) >= ecartExige(c, exos[c][0].cout_nerveux >= 3));
    const cand = ordre.filter(c => exos[c] && libre(c)).sort((x, y) => (sp[y].prio - sp[x].prio) || (deja(x) - deja(y)) || ORDRE.indexOf(x) - ORDRE.indexOf(y));
    const haut = cand.filter(c => HAUT.includes(c)).slice(0, 2), bas = cand.filter(c => BAS.includes(c)).slice(0, 2);
    const choisis = [...new Set([...(sp[cand[0]]?.prio ? [cand[0]] : []), ...haut, ...bas])].slice(0, 4);
    s.patterns = choisis; choisis.forEach(c => { (sPat[c] = sPat[c] || []).push(i); });
  });

  // 3. Séries par apparition et exercices par pattern (variantes alternées quand on peut)
  for (const code of ordre.filter(c => exos[c])) {
    const idx = sPat[code], f = idx.length, total = sp[code].sets;
    const k = pf.niveau === "debutant" || pf.tempsRestreint ? 1 : Math.max(2, Math.round(total / 3));
    const choisis = choisir(exos[code], Math.min(k, 3, f), seed);
    idx.slice().sort((x, y) => x - y).forEach((si, j) => {
      const e = choisis[j % choisis.length], base = Math.floor(total / f), reste = j < total - base * f ? 1 : 0;
      sessions[si].items.push({ ...ligne(e, Math.max(2, base + reste), a, pf), _rang: j });
    });
  }

  // 4. Le temps : on retire d'abord une série aux patterns les moins prioritaires, jamais un pattern de la semaine
  const tMax = +a.sessionMin || 60;
  const minutes = (s) => minutesSeance(s.items);
  for (const s of sessions) {
    let garde = 60;
    while (minutes(s) > tMax && garde-- > 0) {
      const l = s.items.filter(x => x.n > 2).sort((x, y) => (sp[x.pattern]?.prio ? 1 : 0) - (sp[y.pattern]?.prio ? 1 : 0) || y.n - x.n)[0];
      if (l) { l.n--; continue; }
      const dups = s.items.filter(x => (sPat[x.pattern] || []).length > 1).sort((x, y) => (sp[x.pattern].prio ? 1 : 0) - (sp[y.pattern].prio ? 1 : 0))[0];
      if (!dups) break;
      s.items = s.items.filter(x => x !== dups); sPat[dups.pattern] = sPat[dups.pattern].filter(i => sessions[i] !== s); s.patterns = s.patterns.filter(c => c !== dups.pattern);
    }
    if (minutes(s) > tMax) avert.push(`« ${s.titre} » dépasse ${tMax} min même réduite : ${minutes(s)} min. Touche « Version courte » pour une version qui tient.`);
  }

  // 5. Isolation (couche 2) puis modules (couche 3), seulement s'il reste du temps
  const iso = isolationVisee(a), cat = {};
  const poolIso = (c) => { const k = contraintes(prog); return rows.filter(e => e.actif && e.couche === "isolation" && e.categorie === c && (!k.materiel.length || e.materiel.some(m => k.materiel.includes(m))) && !e.contre_indications.some(z => k.contreIndications.includes(z)) && !k.exclure.includes(e.slug)).sort((x, y) => ((prog?.prefs?.[y.slug] === "love") - (prog?.prefs?.[x.slug] === "love")) || (BASE.has(y.slug) - BASE.has(x.slug)) || x.contre_indications.length - y.contre_indications.length || (x.niveau === "debutant" ? 0 : 1) - (y.niveau === "debutant" ? 0 : 1) || x.nom.localeCompare(y.nom, "fr")); };
  const HAUT_CAT = ["biceps", "triceps", "elevations_laterales", "deltoides_posterieurs", "avant_bras"];
  for (const [c, want] of iso) {
    const ex = choisir(poolIso(c), 1, seed)[0]; if (!ex) continue;
    const ok = sessions.filter(s => HAUT_CAT.includes(c) ? s.patterns.some(p => HAUT.includes(p)) : c === "mollets" ? s.patterns.some(p => BAS.includes(p)) : true);
    const parts = want >= 4 ? [Math.ceil(want / 2), Math.floor(want / 2)] : [want]; let place = 0;
    for (const s of ok.sort((x, y) => minutes(x) - minutes(y))) {
      if (place >= parts.length) break;
      const l = ligne(ex, parts[place], a, pf);
      if (minutes(s) + minutesLigne(l) > tMax) continue;
      s.items.push(l); place++;
    }
    const reste = parts.slice(place).reduce((t, x) => t + x, 0);
    if (want - reste > 0) cat[c] = want - reste;
    else avert.push(`Pas de place pour ${CATEGORIES[c].toLowerCase()} : le squelette passe avant l'isolation.`);
  }
  const suggestions = [], mods = modulesVises(a);
  for (const m of mods) {
    if (m.cardio) { suggestions.push(m.texte); continue; }
    const ex = rows.find(e => e.actif && e.couche === "module" && e.categorie === m.cat && m.re.test(e.nom) && !e.contre_indications.some(z => (a.zones || []).includes(z)) && (!(a.materiel || []).length || e.materiel.some(x => a.materiel.includes(x))));
    const cible = sessions.filter(s => m.pour(s)).sort((x, y) => minutes(x) - minutes(y))[0];
    if (!ex || !cible) { if (m.texte) suggestions.push(m.texte); continue; }
    const l = ligne(ex, m.n, a, pf);
    if (minutes(cible) + minutesLigne(l) > tMax) { suggestions.push(m.texte); continue; }
    if (l.kind === "M") cible.items.unshift(l); else cible.items.push(l);
  }

  // 6. Ordre dans la séance : mobilité, puis le plus lourd, isolation à la fin
  const rangType = (l) => l.kind === "M" ? 0 : l.couche === "squelette" ? 1 : l.couche === "module" ? 2 : 3;
  sessions.forEach(s => { s.items = s.items.map(({ _rang, ...l }) => l).sort((x, y) => rangType(x) - rangType(y) || (rangType(x) === 1 ? (y.nerveux - x.nerveux) || ORDRE.indexOf(x.pattern) - ORDRE.indexOf(y.pattern) : 0)); s.minutes = minutes(s); });

  // 7. Indice de difficulté : jamais deux séances « très exigeantes » à moins de 48 h (spec §5.3) ; on allège la seconde
  const cote = (s) => { s.indice = indiceSeance(s.items); };
  sessions.forEach(cote);
  for (let tour = 0, g = 40; enchainementsLourds(sessions).length && g-- > 0; tour++) {
    const lourdes = enchainementsLourds(sessions).map(([, b]) => sessions.find(s => s.titre === b)), s = lourdes[0];
    const l = s.items.filter(x => x.couche === "squelette" && x.n > 2).sort((x, y) => y.nerveux - x.nerveux || y.n - x.n)[0] || s.items.filter(x => x.n > 1 && x.couche !== "squelette")[0];
    if (!l) break;
    l.n--; s.minutes = minutes(s); cote(s);
  }
  const prop = {
    v: VERSION, seed, n, style: a.style || "any", structure: st.type, sessions: sessions.map(s => ({ titre: s.titre, dow: s.dow, type: s.type, items: s.items, minutes: s.minutes, indice: s.indice })),
    jours: DOW.map((_, i) => sessions.some(s => s.dow === i)), semaine: null, iso: cat, avertissements: avert, suggestions, profil: pf,
    semaines: 12, decharge: pf.niveau === "debutant" ? 6 : 4,
    voulu: +a.daysWanted || n, tenable: +a.daysReal || n,
  };
  prop.semaine = Object.fromEntries(ORDRE.map(c => [c, { sets: totalSeries(prop, c), cible: sp[c].sets, why: sp[c].why, absent: manquants.includes(c) }]));
  prop.charge = chargeSemaine(prop.sessions.map(s => s.indice));
  prop.controles = controles(prop, a);
  return prop;
}
const totalSeries = (prop, code) => prop.sessions.reduce((t, s) => t + s.items.filter(l => l.pattern === code && l.couche === "squelette").reduce((u, l) => u + l.n, 0), 0);

// Isolation visée (séries par semaine) selon l'objectif et les priorités ; le squelette passe toujours avant
function isolationVisee(a) {
  const want = new Map(), add = (c, n) => want.set(c, Math.max(want.get(c) || 0, n));
  const goal = a.goal, pr = new Set(a.priorities || []);
  if (["muscle", "recomp"].includes(goal)) { add("biceps", 4); add("triceps", 4); add("elevations_laterales", 4); }
  if (["muscle", "recomp", "health"].includes(goal) || a.work === "desk") add("deltoides_posterieurs", 3);
  if (["fat", "health", "restart", "recomp"].includes(goal)) add("abdos", 3);
  if (pr.has("bras")) { add("biceps", 6); add("triceps", 6); }
  if (pr.has("epaules")) { add("elevations_laterales", 6); add("deltoides_posterieurs", 4); }
  if (pr.has("mollets")) add("mollets", 6);
  if (pr.has("abdos")) add("abdos", 6);
  if (goal === "strength") want.delete("biceps"), want.delete("elevations_laterales");
  return [...want.entries()].sort((x, y) => y[1] - x[1]);
}
// Modules (couche 3), seulement quand le questionnaire les justifie
function modulesVises(a) {
  const m = [];
  if (a.ankle === "limited") m.push({ cat: "mobilite", re: /cheville/i, n: 2, texte: "Mobilité de cheville (genou au mur) : 2 × 30 s avant le squat.", pour: s => s.items.some(l => l.pattern === "SG" || l.pattern === "SH") });
  if (a.shoulder === "limited") m.push({ cat: "mobilite", re: /World/i, n: 2, texte: "Mobilité d'épaule et de colonne (World's greatest stretch) : 2 × 30 s avant les poussées.", pour: s => s.items.some(l => l.pattern === "PV" || l.pattern === "PH") });
  if (a.work === "desk") m.push({ cat: "mobilite", re: /90\/90/i, n: 2, texte: "Mobilité des hanches 90/90 : 2 × 30 s, utile si tu es beaucoup assis.", pour: s => s.items.some(l => BAS.includes(l.pattern)) });
  if (a.goal === "sport") { m.push({ cat: "unilateral", re: /Step-up/i, n: 2, texte: "Travail unilatéral (step-up, fentes) : utile pour le sport.", pour: s => s.items.some(l => BAS.includes(l.pattern)) }); m.push({ cat: "rotation", re: /Pallof/i, n: 2, texte: "Anti-rotation (Pallof press) : utile pour les sports de raquette ou de combat.", pour: s => s.items.some(l => HAUT.includes(l.pattern)) }); }
  if (["fat", "health", "restart", "recomp"].includes(a.goal)) m.push({ cardio: true, texte: "Cardio facile (marche rapide, vélo en zone 2) : 2 fois 20 à 30 min par semaine, en dehors des séances." });
  return m;
}

// ---------- Contrôles : le plan est-il équilibré, récupérable, tenable ? (spec §4 et §8) ----------
export function controles(prop, a = {}) {
  const out = [], push = (niveau, texte) => out.push({ niveau, texte });
  const absents = ORDRE.filter(c => prop.semaine[c].absent);
  if (absents.length) push("alerte", `Patterns absents : ${absents.join(", ")}.`); else push("ok", "Les 8 patterns sont couverts.");
  const sets = ORDRE.filter(c => !prop.semaine[c].absent).map(c => prop.semaine[c].sets);
  if (sets.length) {
    const hi = Math.max(...sets), lo = Math.min(...sets);
    const voulus = ORDRE.filter(c => prop.semaine[c].why?.some(w => /priorité|point faible/.test(w)));
    if (hi > 2 * lo && !voulus.length) push("alerte", `Déséquilibre : de ${lo} à ${hi} séries par pattern sans priorité qui le justifie.`);
    else if (voulus.length) push("info", `Déséquilibre voulu : ${voulus.map(c => `${c} (${prop.semaine[c].why.filter(w => /priorité|point faible/.test(w)).join(", ")})`).join(" · ")}.`);
    else push("ok", "Volume équilibré entre les patterns.");
  }
  const mal = [], jours = {};
  prop.sessions.forEach(s => s.items.filter(l => l.couche === "squelette").forEach(l => { (jours[l.pattern] = jours[l.pattern] || []).push({ dow: s.dow, nerveux: l.nerveux }); }));
  for (const [c, l] of Object.entries(jours)) {
    const d = [...new Set(l.map(x => x.dow))]; if (d.length < 2) continue;
    const exige = ecartExige(c, l.some(x => x.nerveux >= 3));
    if (ecartMini(d) < exige) mal.push(`${c} (${ecartMini(d) * 24} h)`);
  }
  if (mal.length) push("alerte", `Récupération courte entre deux séances du même pattern : ${mal.join(", ")}.`); else push("ok", "Au moins 48 h entre deux séances du même pattern (72 h pour une charnière lourde).");
  const tMax = +a.sessionMin || 60, long = prop.sessions.filter(s => s.minutes > tMax * 1.1);
  if (long.length) push("alerte", `${long.length} séance${long.length > 1 ? "s" : ""} au-dessus de ${tMax} min.`); else push("ok", `Chaque séance tient en ${tMax} min ou moins (de ${Math.min(...prop.sessions.map(s => s.minutes))} à ${Math.max(...prop.sessions.map(s => s.minutes))} min).`);
  const lourds = enchainementsLourds(prop.sessions.map(s => ({ ...s, indice: s.indice || indiceSeance(s.items) })));
  if (lourds.length) push("alerte", `Deux séances « très exigeantes » de suite : ${lourds.map(x => x.join(" puis ")).join(" ; ")}.`);
  else if (prop.sessions.length > 1) push("ok", "Pas deux séances très exigeantes de suite.");
  if (prop.voulu > prop.tenable) push("info", `Tu aimerais ${prop.voulu} séances mais en tiens ${prop.tenable} : le programme est construit sur ${prop.n}. On en ajoutera quand la régularité sera prouvée.`);
  if (prop.profil.sousCapacite) push("info", "Départ volontairement un peu en dessous de ta capacité : on vise la régularité d'abord, puis on monte.");
  controlesObjectif(prop, a).forEach(c => push(c.niveau, c.texte));
  return out;
}

// ---------- Remplacer un exercice dans la proposition ----------
export function remplacerLigne(prop, prog, si, li, slug, rows = exercices()) {
  const e = rows.find(r => r.slug === slug), l = prop.sessions[si]?.items[li]; if (!e || !l) return prop;
  const a = prog?.answers || {}, copie = JSON.parse(JSON.stringify(prop)), cible = copie.sessions[si];
  cible.items[li] = { ...ligne(e, l.n, a, profil(a, prop.n)), n: l.n };
  cible.minutes = minutesSeance(cible.items); cible.indice = indiceSeance(cible.items);
  copie.charge = chargeSemaine(copie.sessions.map(s => s.indice || indiceSeance(s.items)));
  copie.semaine = Object.fromEntries(ORDRE.map(c => [c, { ...prop.semaine[c], sets: totalSeries(copie, c) }]));
  copie.controles = controles(copie, a);
  return copie;
}
// Alternatives proposées pour une ligne : mêmes règles que le questionnaire, sans doublon dans la séance
export function alternativesLigne(prop, prog, si, li, alternativesFn) {
  const l = prop.sessions[si]?.items[li]; if (!l) return [];
  const deja = new Set(prop.sessions[si].items.map(x => x.slug));
  return alternativesFn(l.slug, prog).filter(e => !deja.has(e.slug));
}

// ---------- Version allégée d'une séance (20, 30 ou 45 min) : garde le squelette, retire l'isolation puis des séries ----------
export const CIBLES_ALLEGEES = [20, 30, 45];
export function allegeeSeance(prop, si, cible) {
  const s = prop.sessions[si]; if (!s) return null;
  const prioritaires = ORDRE.filter(c => prop.semaine[c]?.why?.some(w => /priorité|point faible/.test(w)));
  return allegee(s.items, cible, { prioritaires });
}
export const ciblesPour = (minutesSeance) => CIBLES_ALLEGEES.filter(c => c < minutesSeance);

// ---------- Vers le format de programme du moteur de séances ----------
const PROG_DEF = { load: "auto", step: 2.5, every: 1, addSet: null, reps: null };
export function versProgramme(prop, { id, name = "Mon programme sur mesure" } = {}) {
  const s = prop.sessions.map((se, k) => [`Séance ${String.fromCharCode(65 + k)} · ${se.titre}`, DOW[se.dow], se.items.map(l => [l.nom, l.kind, l.note || "", null, null, {
    sets: Array.from({ length: l.n }, () => ({ t: "N", lo: l.lo, hi: l.hi, rpe: l.rpe, pct: null, kg: null, tech: [] })), rest: l.rest, prog: { ...PROG_DEF },
  }])]);
  const lvl = { debutant: "Débutant", regulier: "Intermédiaire", avance: "Avancé" }[prop.profil.niveau];
  return {
    id: id || "gen-" + Date.now(), custom: true, name, lvl, split: prop.structure === "full" ? "Corps entier" : prop.sessions.map(x => x.titre.replace(/ [ABC]$/, "")).filter((x, i, t) => t.indexOf(x) === i).join(" / "),
    weeks: prop.semaines, deload: { every: prop.decharge }, days: prop.jours, s, prof: "",
    desc: `${prop.n} séance${prop.n > 1 ? "s" : ""} par semaine, bâties sur les 8 patterns, adaptées à ton matériel et à tes gênes.`,
    why: "Chaque semaine couvre les huit catégories de mouvements (poussées, tirages, squats, charnière, flexion de genou) pour un physique équilibré, avec des séances qui tiennent dans ton temps et laissent le temps de récupérer.",
    gen: { v: VERSION, seed: prop.seed, at: new Date().toISOString() },
  };
}
