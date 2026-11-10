// Bibliothèque d'exercices classée selon les 8 patterns (modèle de Sebastian Oreb).
// Module pur (aucune dépendance à l'interface) : testé par `node --test tests/exercices.test.mjs`.
// Source : la table Supabase `cxs_exercices` quand elle est joignable, sinon la version embarquée data/exercices.json.

// Couche 1 : le squelette. 4 patterns du haut du corps, 4 du bas.
export const PATTERNS = [
  { code: "PH", nom: "Poussée horizontale", zone: "haut" },
  { code: "PV", nom: "Poussée verticale", zone: "haut" },
  { code: "TH", nom: "Tirage horizontal", zone: "haut" },
  { code: "TV", nom: "Tirage vertical", zone: "haut" },
  { code: "SG", nom: "Squat dominante genou", zone: "bas" },
  { code: "SH", nom: "Squat dominante hanche", zone: "bas" },
  { code: "CH", nom: "Charnière de hanche", zone: "bas" },
  { code: "FG", nom: "Flexion de genou", zone: "bas" },
];
export const PATTERN = Object.fromEntries(PATTERNS.map(p => [p.code, p]));
export const COUCHES = [["squelette", "Squelette"], ["isolation", "Isolation"], ["module", "Modules"]];
// Couche 2 (isolation) et couche 3 (modules optionnels) : pas de pattern, une catégorie
export const CATEGORIES = {
  biceps: "Biceps", triceps: "Triceps", elevations_laterales: "Élévations latérales", deltoides_posterieurs: "Deltoïdes postérieurs",
  mollets: "Mollets", abdos: "Abdos", avant_bras: "Avant-bras",
  unilateral: "Unilatéral", portes: "Portés", rotation: "Rotation / anti-rotation", cardio: "Cardio", mobilite: "Mobilité",
};
export const MATERIEL = [["salle_complete", "Salle complète"], ["salle_basique", "Salle basique"], ["halteres_maison", "Haltères maison"], ["poids_du_corps", "Poids du corps"], ["barre_traction", "Barre de traction"]];
export const NIVEAUX = [["debutant", "Débutant"], ["intermediaire", "Intermédiaire"], ["avance", "Avancé"]];
export const ZONES = [["epaule", "Épaule"], ["coude", "Coude"], ["poignet", "Poignet"], ["bas_du_dos", "Bas du dos"], ["genou", "Genou"], ["hanche", "Hanche"], ["cheville", "Cheville"]];
export const label = (liste, v) => (liste.find(x => x[0] === v) || [v, v])[1];

let ROWS = [], BY_SLUG = {}, BY_NOM = {}, SOURCE = "aucune";
export function setExercices(rows, source = "embarquée") {
  ROWS = (rows || []).map(r => ({ muscles: [], materiel: [], variantes: [], contre_indications: [], actif: true, ...r }));
  BY_SLUG = Object.fromEntries(ROWS.map(r => [r.slug, r]));
  BY_NOM = Object.fromEntries(ROWS.map(r => [r.nom, r]));
  SOURCE = source;
}
export const exercices = () => ROWS;
export const source = () => SOURCE;
// Accepte un exercice, son slug ou son nom
export const exercice = (x) => !x ? null : typeof x === "object" ? x : BY_SLUG[x] || BY_NOM[x] || null;
// Groupe de remplacement : le pattern principal, ou la catégorie pour l'isolation et les modules
export const groupeDe = (e) => e ? e.pattern_principal || e.categorie || null : null;

const nrm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const croise = (a, b) => (a || []).some(x => (b || []).includes(x));
const liste = (v) => v == null || v === "" ? [] : Array.isArray(v) ? v : [v];
const RANG = { debutant: 0, intermediaire: 1, avance: 2 };

// Filtre de la vue bibliothèque. Tous les critères sont facultatifs.
export function filtrer({ pattern = "", couche = "", materiel = "", q = "", inactifs = true } = {}) {
  const mat = liste(materiel), t = nrm(q).split(/\s+/).filter(Boolean);
  return ROWS.filter(e => {
    if (!inactifs && !e.actif) return false;
    if (pattern && e.pattern_principal !== pattern && e.pattern_secondaire !== pattern) return false;
    if (couche && e.couche !== couche) return false;
    if (mat.length && !croise(e.materiel, mat)) return false;
    if (t.length) { const h = nrm(e.nom + " " + e.muscles.join(" ") + " " + (CATEGORIES[e.categorie] || "") + " " + (PATTERN[e.pattern_principal]?.nom || "")); if (!t.every(x => h.includes(x))) return false; }
    return true;
  });
}

// Remplacements possibles d'un exercice (bouton « remplacer ») :
// même pattern principal (ou même catégorie hors squelette), exercices actifs seulement,
// - materiel : lieux ou matériel dont la personne dispose ; on garde ce qui est faisable avec au moins l'un d'eux (vide = pas de filtre) ;
// - contreIndications : zones gênées ; on écarte tout exercice déconseillé pour l'une d'elles ;
// - exclure : slugs ou noms à écarter (exercices détestés, déjà dans la séance…).
// Ordre : les variantes liées d'abord, puis le niveau le plus proche, puis le coût nerveux le plus proche.
export function alternatives(x, { materiel = [], contreIndications = [], exclure = [] } = {}) {
  const e = exercice(x); if (!e) return [];
  const g = groupeDe(e); if (!g) return [];
  const mat = liste(materiel), ci = liste(contreIndications), out = liste(exclure).map(v => exercice(v)?.slug || v);
  const score = (o) => (e.variantes.includes(o.slug) ? 0 : 10) + Math.abs(RANG[o.niveau] - RANG[e.niveau]) * 2 + Math.abs(o.cout_nerveux - e.cout_nerveux);
  return ROWS
    .filter(o => o.slug !== e.slug && o.actif && groupeDe(o) === g && o.couche === e.couche)
    .filter(o => !mat.length || croise(o.materiel, mat))
    .filter(o => !croise(o.contre_indications, ci))
    .filter(o => !out.includes(o.slug))
    .map(o => [score(o), o]).sort((a, b) => a[0] - b[0] || a[1].nom.localeCompare(b[1].nom, "fr")).map(v => v[1]);
}

// Nombre d'exercices actifs par pattern principal (pour les 8 cases de la vue « Squelette »)
export function compterParPattern(rows = ROWS) {
  const n = Object.fromEntries(PATTERNS.map(p => [p.code, 0]));
  rows.forEach(e => { if (e.actif && e.pattern_principal) n[e.pattern_principal]++; });
  return n;
}

// ---------- Chargement (navigateur) ----------
const KEY = "cxs.exos";
let loading = null;
// Version embarquée d'abord (marche hors ligne), remplacée par la dernière copie du serveur gardée sur le téléphone
export function loadExercices() {
  if (!loading) loading = (async () => {
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { cache = null; }
    if (cache?.length) return setExercices(cache, "serveur");
    try { setExercices((await (await fetch("data/exercices.json")).json()).ex, "embarquée"); } catch { setExercices([], "aucune"); }
  })();
  return loading;
}
// c = module cloud.js. Si la table n'existe pas encore ou si le réseau manque, on garde ce qu'on a.
export async function refreshExercices(c) {
  await loadExercices();
  if (!c?.exercicesAll) return false;
  try {
    const rows = await c.exercicesAll();
    if (!rows.length) return false;
    setExercices(rows, "serveur");
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* stockage plein : sans gravité */ }
    return true;
  } catch { return false; }
}
