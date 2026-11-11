// Atelier « Créer mon programme » : on part du squelette (les 8 catégories de mouvements) et on construit sa semaine à la main.
// Module pur (aucun accès à l'écran ni au stockage) : testé par `node --test tests/atelier.test.mjs`.
//
// Le brouillon a la même forme que la proposition du générateur (sessions → items) : on réutilise donc l'indice de difficulté,
// la conversion en programme (versProgramme) et le moteur de séances, sans rien changer à ce qui existe.
// Les catégories sont fixes ; les exercices, eux, se choisissent et se remplacent dans la catégorie.
import * as G from "./generateur.js";
import * as V from "./volume.js";
import { PATTERNS, exercice, groupeDe } from "./exercices.js";

export const VERSION = 1;
export const JOURS_PAR_DEFAUT = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
export const ORDRE = PATTERNS.map(p => p.code);
export const FOCUS_SERIES_EN_PLUS = 2;

const lettre = (k) => String.fromCharCode(65 + k);
const titreDe = (k) => `Séance ${lettre(k)}`;

// ---------- Création ----------
export function nouveau(dows = JOURS_PAR_DEFAUT[3], { niveau = "regulier", nom = "Mon programme" } = {}) {
  const ds = [...new Set(dows)].sort((a, b) => a - b);
  return { v: VERSION, nom, niveau, semaines: 8, decharge: 4, sessions: ds.map((d, k) => ({ titre: titreDe(k), dow: d, items: [] })) };
}
// Point de départ : la proposition du générateur, copiée (on ne modifie jamais l'original)
export function depuisProposition(prop, { nom = "Mon programme" } = {}) {
  const c = JSON.parse(JSON.stringify(prop));
  return { v: VERSION, nom, niveau: c.profil?.niveau || "regulier", semaines: c.semaines || 8, decharge: c.decharge || 4, depuis: "proposition",
    sessions: c.sessions.map((s, k) => ({ titre: s.titre || titreDe(k), dow: s.dow, items: s.items.map(l => ({ ...l })) })) };
}
export const clone = (d) => JSON.parse(JSON.stringify(d));

// ---------- Jours ----------
export function basculerJour(d, dow) {
  const i = d.sessions.findIndex(s => s.dow === dow);
  if (i >= 0) { if (d.sessions.length <= 1) return { ...d, refus: "Garde au moins un jour d'entraînement." }; const s = d.sessions[i]; return { ...d, sessions: d.sessions.filter((_, k) => k !== i), retire: s.items.length ? s : null }; }
  const sessions = [...d.sessions, { titre: "", dow, items: [] }].sort((a, b) => a.dow - b.dow);
  sessions.forEach((s, k) => { if (!s.items.length || /^Séance [A-F]$/.test(s.titre) || !s.titre) s.titre = titreDe(k); });
  return { ...d, sessions };
}

// ---------- Exercices dans les séances ----------
const PF = () => G.profil({}, 3);
export function ligneDe(e, n = 3, d = null) {
  const a = { goal: d?.objectif || "muscle", level: d?.niveau === "debutant" ? "beginner" : d?.niveau === "avance" ? "advanced" : "regular" };
  const l = G.ligne(e, n, a, G.profil(a, 3));
  return { ...l, ss: null, focus: false };
}
export function ajouter(d, si, e, n = 3) {
  const x = typeof e === "object" ? e : exercice(e); if (!x || !d.sessions[si]) return d;
  const c = clone(d); c.sessions[si].items.push(ligneDe(x, n, d)); return c;
}
export function retirer(d, si, li) {
  const c = clone(d), s = c.sessions[si]; if (!s?.items[li]) return d;
  const [l] = s.items.splice(li, 1);
  if (l.ss) { const reste = s.items.filter(x => x.ss === l.ss); if (reste.length < 2) reste.forEach(x => { x.ss = null; }); }
  return c;
}
export function deplacer(d, si, li, delta) {
  const c = clone(d), it = c.sessions[si]?.items, j = li + delta; if (!it || j < 0 || j >= it.length) return d;
  [it[li], it[j]] = [it[j], it[li]]; return c;
}
// Change d'exercice dans la même catégorie : les séries et le format sont gardés
export function remplacer(d, si, li, slug) {
  const l = d.sessions[si]?.items[li], e = exercice(slug); if (!l || !e) return d;
  const c = clone(d), n = ligneDe(e, l.n, d), cur = c.sessions[si].items[li];
  c.sessions[si].items[li] = { ...n, n: cur.n, lo: cur.lo, hi: cur.hi, rpe: cur.rpe, rest: cur.rest, ss: cur.ss, focus: cur.focus };
  return c;
}
export function regler(d, si, li, patch) {
  const c = clone(d), l = c.sessions[si]?.items[li]; if (!l) return d;
  const p = { ...patch };
  if ("n" in p) p.n = Math.max(1, Math.min(10, Math.round(+p.n) || 1));
  if ("lo" in p || "hi" in p) { const lo = Math.max(1, Math.round(+(p.lo ?? l.lo)) || 1), hi = Math.max(lo, Math.round(+(p.hi ?? l.hi)) || lo); p.lo = lo; p.hi = hi; }
  if ("rpe" in p && p.rpe != null) p.rpe = Math.max(5, Math.min(10, Math.round(+p.rpe * 2) / 2));
  if ("rest" in p) p.rest = Math.max(15, Math.min(300, Math.round(+p.rest) || 60));
  Object.assign(l, p); return c;
}
// Focus : on veut progresser sur ce mouvement précis (bench, squat…). Plus de séries, reps plus basses, une série ajoutée toutes les 2 semaines.
export function basculerFocus(d, si, li) {
  const c = clone(d), l = c.sessions[si]?.items[li]; if (!l) return d;
  if (l.focus) { l.focus = false; l.n = Math.max(1, l.n - FOCUS_SERIES_EN_PLUS); }
  else { l.focus = true; l.n = Math.min(10, l.n + FOCUS_SERIES_EN_PLUS); if (l.couche === "squelette") { l.lo = Math.min(l.lo, 3); l.hi = Math.min(l.hi, 6); l.hi = Math.max(l.hi, l.lo); l.rpe = Math.min(l.rpe || 8, 8.5); } }
  return c;
}
// Superset : l'exercice est enchaîné avec le suivant ; on délie en retouchant
export function basculerSuperset(d, si, li) {
  const c = clone(d), it = c.sessions[si]?.items; if (!it?.[li]) return d;
  const l = it[li], nx = it[li + 1];
  if (l.ss) { const k = l.ss; it.forEach(x => { if (x.ss === k) x.ss = null; }); return c; }
  if (!nx) return { ...d, refus: "Il faut un exercice juste après pour former un superset." };
  const pris = new Set(it.map(x => x.ss).filter(Boolean)); let k = "A"; while (pris.has(k)) k = String.fromCharCode(k.charCodeAt(0) + 1);
  l.ss = k; nx.ss = nx.ss || k; return c;
}

// ---------- Squelette : séries par catégorie ----------
export const lignesSquelette = (d, code) => d.sessions.flatMap((s, si) => s.items.map((l, li) => ({ l, si, li })).filter(x => x.l.couche === "squelette" && x.l.pattern === code));
export function seriesParPattern(d) {
  const out = Object.fromEntries(ORDRE.map(c => [c, 0]));
  d.sessions.forEach(s => s.items.forEach(l => { if (l.couche === "squelette" && out[l.pattern] != null) out[l.pattern] += l.n; }));
  return out;
}
export const cibleSeries = (niveau = "regulier") => (G.SERIES[niveau] || G.SERIES.regulier).cible;
export const maxSeries = (niveau = "regulier") => (G.SERIES[niveau] || G.SERIES.regulier).max;
// État d'une catégorie : « manque » (rien), « faible » (sous le minimum), « juste », « ok », « beaucoup »
export function etat(n, niveau = "regulier") {
  const cible = cibleSeries(niveau);
  if (!n) return "manque";
  if (n < G.MIN_SERIES) return "faible";
  if (n < cible * 0.75) return "juste";
  if (n > maxSeries(niveau) + 2) return "beaucoup";
  return "ok";
}
export function equilibre(d) {
  const sp = seriesParPattern(d), cible = cibleSeries(d.niveau);
  const par = Object.fromEntries(ORDRE.map(c => [c, { sets: sp[c], cible, etat: etat(sp[c], d.niveau), ratio: Math.min(1.5, sp[c] / cible) }]));
  const manquants = ORDRE.filter(c => par[c].etat === "manque"), faibles = ORDRE.filter(c => par[c].etat === "faible" || par[c].etat === "juste");
  const total = ORDRE.reduce((t, c) => t + sp[c], 0);
  const haut = ["PH", "PV", "TH", "TV"].reduce((t, c) => t + sp[c], 0), bas = total - haut;
  const poussee = sp.PH + sp.PV, tirage = sp.TH + sp.TV;
  return { par, manquants, faibles, total, haut, bas, poussee, tirage, complet: manquants.length === 0 };
}
// Ajuste une catégorie d'une série : sur la séance où elle a le moins de séries (+) ou le plus (−). Sans exercice : rien à ajuster.
export function ajusterPattern(d, code, delta) {
  const L = lignesSquelette(d, code); if (!L.length) return { d, besoinExercice: delta > 0 };
  const c = clone(d);
  const cible = (delta > 0 ? [...L].sort((x, y) => x.l.n - y.l.n) : [...L].sort((x, y) => y.l.n - x.l.n))[0];
  const l = c.sessions[cible.si].items[cible.li];
  if (delta < 0 && l.n <= 1) return { d: retirer(c, cible.si, cible.li) };
  l.n = Math.max(1, Math.min(10, l.n + delta)); return { d: c };
}
// Répartition d'une catégorie par séance : { si: nombre de séries } (0 = pas de ce mouvement ce jour-là)
export const repartition = (d, code) => d.sessions.map((s, si) => s.items.filter(l => l.couche === "squelette" && l.pattern === code).reduce((t, l) => t + l.n, 0));
export function placer(d, code, si, n) {
  const c = clone(d), s = c.sessions[si]; if (!s) return { d };
  const idx = s.items.map((l, i) => [l, i]).filter(([l]) => l.couche === "squelette" && l.pattern === code);
  if (n <= 0) { for (const [, i] of idx.reverse()) { const r = retirer(c, si, i); c.sessions = r.sessions; } return { d: c }; }
  if (!idx.length) return { d, besoinExercice: true };
  idx[0][0].n = Math.min(10, n); idx.slice(1).forEach(([l]) => { l.n = 0; });
  s.items = s.items.filter(l => l.n > 0); return { d: c };
}

// ---------- Volume par muscle (faisceaux et groupes, repères MV / MEV / MAV / MRV) ----------
export const musclesDe = (n) => exercice(n)?.muscles || [];
export function volumeMuscles(d, lm = V.landmarks()) {
  const lines = d.sessions.flatMap(s => s.items.map(l => ({ n: l.nom, sets: l.n, split: {}, id: l.slug })));
  const byF = {}, byG = {}; let total = 0;
  lines.forEach(l => { total += l.sets; V.faisceauxOf(l.n, musclesDe, null).forEach(({ f, c }) => { byF[f] = (byF[f] || 0) + l.sets * c; const g = V.groupOf(f); if (g) byG[g.id] = (byG[g.id] || 0) + l.sets * c; }); });
  const groupes = V.GROUPS.map(g => {
    const sets = Math.round((byG[g.id] || 0) * 2) / 2, L = lm[g.id] || g.lm;
    const statut = sets === 0 ? (L.mev > 0 ? "absent" : "libre") : sets < L.mev ? "sous" : sets > L.mrv ? "trop" : sets >= L.mav[0] && sets <= L.mav[1] ? "optimal" : "ok";
    return { id: g.id, nom: g.n, sets, lm: L, statut };
  });
  return { groupes, byF, total };
}

// ---------- Contrôles (jamais bloquants) ----------
export function controles(d) {
  const out = [], eq = equilibre(d), nom = (c) => PATTERNS.find(p => p.code === c).nom.toLowerCase();
  if (!eq.total) return [{ niveau: "info", texte: "Place tes premiers exercices : le squelette et le graphique se remplissent au fur et à mesure." }];
  if (eq.manquants.length) out.push({ niveau: "alerte", texte: `Il manque ${eq.manquants.map(nom).join(", ")} : un mouvement absent finit par faire défaut.` });
  else out.push({ niveau: "ok", texte: "Les huit catégories de mouvements sont présentes dans ta semaine." });
  if (eq.faibles.length) out.push({ niveau: "info", texte: `Volume léger sur ${eq.faibles.map(nom).join(", ")} : ajoute quelques séries si tu veux progresser dessus.` });
  if (eq.poussee && eq.tirage && (eq.tirage < eq.poussee * 0.7)) out.push({ niveau: "alerte", texte: "Les tirages sont nettement sous les poussées : pour les épaules, vise autant de tirages que de poussées." });
  if (eq.haut && eq.bas && eq.bas < eq.haut * 0.5) out.push({ niveau: "info", texte: "Le bas du corps est peu travaillé par rapport au haut." });
  d.sessions.forEach(s => { const m = G.minutesSeance(s.items); if (m > 90) out.push({ niveau: "alerte", texte: `« ${s.titre} » dure environ ${m} min : pense à répartir sur une autre séance.` }); });
  const vm = volumeMuscles(d); vm.groupes.filter(g => g.statut === "trop").forEach(g => out.push({ niveau: "alerte", texte: `${g.nom} : ${g.sets} séries par semaine, au-delà de ce qui se récupère (${g.lm.mrv}).` }));
  return out;
}

// ---------- Conversion en programme du moteur ----------
export function proposition(d) {
  const jours = Array(7).fill(false); d.sessions.forEach(s => { jours[s.dow] = true; });
  return { v: G.VERSION, seed: 0, n: d.sessions.length, structure: "perso", sessions: d.sessions.map(s => ({ titre: s.titre, dow: s.dow, items: s.items })), jours, semaines: d.semaines, decharge: d.decharge, profil: { niveau: d.niveau } };
}
export function vers(d, { id = "atelier", name } = {}) {
  const p = G.versProgramme(proposition(d), { id, name: name || d.nom || "Mon programme" });
  p.desc = `${d.sessions.length} séance${d.sessions.length > 1 ? "s" : ""} par semaine, construites par moi sur les 8 catégories de mouvements.`;
  p.atelier = { v: VERSION, at: new Date().toISOString() };
  delete p.gen; return p;
}
export const nbExercices = (d) => d.sessions.reduce((t, s) => t + s.items.length, 0);
