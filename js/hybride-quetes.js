// Quêtes, XP, série, rangs et objets du personnage du module « athlète hybride ».
// Module pur : aucun accès à l'écran, au stockage ni au serveur. Testé par `node --test tests/hybride-quetes.test.mjs`.
// Le même fichier tourne sur le téléphone (affichage) et dans la fonction serveur `hybride-xp` (seule à écrire l'XP, décision C56).
//
// Principe : tout est DÉRIVÉ des logs existants (séances, routine, tests notés, pauses), avec des clés déterministes
// qui ne dépendent ni de l'ordre des séances ni du bloc choisi : rejouer le calcul ne compte jamais deux fois,
// et modifier son bloc ne redonne pas d'XP (fenêtres de dates fixes).
//
// Règles du brief :
//   · XP pour la régularité, la technique, la récupération, la décharge, les tests et les records ;
//     jamais pour le volume brut (plafond par jour), jamais pour une séance faite malgré une douleur ou une fatigue déclarées.
//   · Série tolérante : jour de grâce, pause « imprévu ou mauvaise nuit » (plafonnée), repos prévu et décharge ne la cassent pas ;
//     une séance décalée dans la semaine compte (on compare la semaine, pas le jour exact).
//   · Retour après une absence : accueil positif, jamais de reproche.
//   · Le personnage ne régresse jamais : un objet débloqué le reste.
import { calendrier, addJours, ecartJours, lundiDe, dowDe, gabarit, poidsExercice, macro } from "./hybride.js";

export const VERSION = 2;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const EPOQUE = "2026-01-05"; // un lundi : origine des fenêtres fixes

// ---------- Outils ----------
export const semaineDe = (d) => lundiDe(d);
const nbSeries = (s) => (s.exercices || []).reduce((t, e) => t + (e.series || []).length, 0);
const valide = (s) => !s.douleur && !s.fatigue;
const fenetre = (d, n) => Math.floor(ecartJours(EPOQUE, d) / n);
const joursDistincts = (l) => new Set(l.map(s => s.d)).size;
// Date à Paris d'un horodatage (une séance finie à 0 h 30 compte pour ce jour-là, pas pour la veille en UTC)
const FMT = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
export function dateParis(x) {
  if (typeof x !== "string" && !(x instanceof Date)) return null;
  if (typeof x === "string" && ISO.test(x)) return x;
  const t = new Date(x); if (isNaN(t)) return null;
  const d = FMT.format(t); return ISO.test(d) ? d : null;
}

// ---------- Adaptateur : état de l'app → journal ----------
// Lit sans rien modifier. st : état local (S()) ou instantané serveur ({ workouts, daily, hybride }).
// exDe(nom) → ligne de data/exercices.json (ou null). Toute date invalide est ignorée (jamais d'erreur).
const DOULEUR = /douleur|(?<![\p{L}])mal(?![\p{L}])|gêne|gene(?![\p{L}])|bless|tendin|pincement|sciatique/iu;
const Z2_NOM = /zone ?2|(^|[^\p{L}])z2([^\p{L}]|$)/iu;
const Z2_PROBABLE = /vélo|velo|rameur|footing|marche rapide|elliptique/i;
const INTENSE = /fraction|interval|sprint|vma|seuil|tabata|hiit/i;
const obj = (x) => x && typeof x === "object" && !Array.isArray(x) ? x : {};
export function journalDepuisEtat(D, st = {}, exDe = () => null) {
  const H = D.hypotheses, h = obj(st.hybride), daily = obj(st.daily);
  const fatigueLe = (d) => { const e = obj(daily[d]).feel?.energy; return e != null && +e <= H.fatigueEnergieMax; };
  const seances = (Array.isArray(st.workouts) ? st.workouts : []).map(w => {
    if (!w || typeof w !== "object") return null;
    const d = dateParis(w.end || w.start); if (!d) return null;
    let echauffement = false, prevention = 0, skills = false, z2Min = 0, douleur = false;
    const exercices = (Array.isArray(w.exercises) ? w.exercises : []).map(e => {
      e = obj(e); const nom = String(e.name || ""), row = exDe(nom) || { nom, muscles: [] };
      const faites = (Array.isArray(e.sets) ? e.sets : []).filter(s => s && s.done);
      const travail = faites.filter(s => s.type !== "W");
      if (faites.some(s => s.type === "W") || row.categorie === "mobilite" || /échauffement|activation/i.test(nom)) echauffement = true;
      if (faites.some(s => s.pain || DOULEUR.test(s.note || "")) || DOULEUR.test(e.myNote || "")) douleur = true;
      const p = poidsExercice(D, row), principal = Object.keys(p).find(k => p[k] === 1);
      if (principal && D.groupes.find(g => g.id === principal)?.qualite === "prevention") prevention += travail.length;
      if (row.categorie === "skills" && travail.length) skills = true;
      if (row.categorie === "cardio" && Z2_NOM.test(nom) && !INTENSE.test(nom)) z2Min += travail.reduce((t, s) => t + (+s.min || (+s.sec || 0) / 60), 0);
      return { nom, series: travail.map(s => ({ reps: +s.reps || 0, kg: +s.kg || 0, sec: +s.sec || 0 })) };
    });
    const heure = String(w.end || w.start);
    return { d, heure, exercices, echauffement, prevention, skills, z2Min, douleur, fatigue: fatigueLe(d), records: Array.isArray(w.records) ? w.records.length : 0 };
  }).filter(Boolean).sort((a, b) => a.heure < b.heure ? -1 : a.heure > b.heure ? 1 : 0);
  const cardio = [], jours = {};
  Object.entries(daily).forEach(([d, x]) => {
    if (!ISO.test(d)) return; x = obj(x);
    (Array.isArray(x.cardio) ? x.cardio : []).forEach(c => { c = obj(c); const n = String(c.n || ""); cardio.push({ d, min: +c.min || 0, z2: !INTENSE.test(n) && (Z2_NOM.test(n) || Z2_PROBABLE.test(n)) }); });
    if (Object.keys(obj(x.feel)).length) (jours[d] = jours[d] || {}).forme = true;
  });
  // Pauses : au plus pausesParSemaine par semaine (les premières de la semaine)
  const parSem = {}, pauses = obj(h.pauses);
  Object.keys(pauses).filter(d => ISO.test(d) && pauses[d]).sort().forEach(d => {
    const l = semaineDe(d); parSem[l] = (parSem[l] || 0) + 1;
    if (parSem[l] <= H.pausesParSemaine) (jours[d] = jours[d] || {}).pause = true;
  });
  const typesTests = new Set(D.macros.flatMap(m => Object.values(m.tests || {}).flat()));
  const tests = (Array.isArray(h.tests) ? h.tests : []).map(obj).filter(t => ISO.test(t.d || "") && typesTests.has(t.type)).map(t => ({ d: t.d, type: t.type }));
  return { seances, cardio, jours, tests, bloc: h.bloc || null };
}

// ---------- Jours prévus par le bloc ----------
export function joursPrevus(D, bloc, du, au) {
  if (!bloc?.macroId || !bloc?.debut || !bloc?.nbSeances) return new Set();
  const cal = calendrier(D, { debut: bloc.debut, macroId: bloc.macroId });
  const dows = new Set(gabarit(D, bloc.nbSeances).seances.map(s => s.jour)), out = new Set();
  for (let d = du > cal[0].du ? du : cal[0].du; d <= au && d <= cal[11].au; d = addJours(d, 1)) if (dows.has(dowDe(d))) out.add(d);
  return out;
}
const calDe = (D, J) => J.bloc ? calendrier(D, { debut: J.bloc.debut, macroId: J.bloc.macroId }) : null;
const enDecharge = (cal, d) => !!cal?.find(s => s.du <= d && d <= s.au && s.decharge);
// Séances prévues d'une semaine (jusqu'au jour « jusque » inclus), pauses déduites
const prevuesSemaine = (D, J, l, jusque) => [...joursPrevus(D, J.bloc, l, jusque)].filter(d => !J.jours[d]?.pause).length;

// ---------- Série tolérante ----------
// Un jour compte tant qu'il y a eu une activité (séance, cardio, forme, pause, test) il y a moins de absenceRetour jours ;
// la semaine de décharge ne fait pas avancer l'absence. À la fin de chaque semaine du bloc (hors décharge),
// les séances faites sont comparées aux séances prévues : un manque est pardonné (grâce), au-delà la série repart.
export function serie(D, J, auj) {
  const H = D.hypotheses, faitesJ = new Set(J.seances.map(s => s.d));
  const actif = new Set([...faitesJ, ...J.cardio.map(c => c.d), ...Object.keys(J.jours).filter(d => J.jours[d].forme || J.jours[d].pause), ...J.tests.map(t => t.d)].filter(d => d <= auj));
  const debut = [...actif].sort()[0];
  if (!debut) return { jours: 0, record: 0, graceRestante: H.graceParSemaine, retour: false, message: "Ta série démarre à ta première séance." };
  const cal = calDe(D, J);
  const manques = (l, jusque) => Math.max(0, prevuesSemaine(D, J, l, jusque) - [...faitesJ].filter(d => d >= l && d <= jusque).length);
  let jours = 0, record = 0, absence = 0;
  for (let d = debut; d <= auj; d = addJours(d, 1)) {
    if (actif.has(d)) absence = 0; else if (!enDecharge(cal, d)) absence++;
    jours = absence >= H.absenceRetour ? 0 : jours + 1;
    if (dowDe(d) === 6 && d < auj && !enDecharge(cal, d) && manques(lundiDe(d), d) > H.graceParSemaine) jours = 0;
    record = Math.max(record, jours);
  }
  const retour = absence >= H.absenceRetour;
  const graceRestante = Math.max(0, H.graceParSemaine - manques(lundiDe(auj), addJours(auj, -1)));
  const message = retour ? "On reprend. Une séance à la fois, sans rien rattraper." : jours ? null : "Ta série redémarre aujourd'hui.";
  return { jours, record, graceRestante, retour, message };
}

// ---------- Quêtes ----------
function palierAtteint(p, s) {
  const re = new RegExp(p.re, "iu");
  return s.exercices.some(e => re.test(e.nom || "") && e.series.filter(x =>
    (!p.reps || x.reps >= p.reps) && (!p.sec || x.sec >= p.sec) && (!p.kg || x.kg >= p.kg)).length >= p.series);
}

// Toutes les réussites depuis le début (pour l'XP et les objets) : [{ id, periode, d }]
// Seules les séances sans douleur ni fatigue déclarées comptent pour les quêtes.
export function reussites(D, J, auj) {
  const H = D.hypotheses, out = [], seances = J.seances.filter(s => s.d <= auj && valide(s));
  // Quotidiennes
  new Set(seances.filter(s => s.echauffement && s.prevention > 0).map(s => s.d)).forEach(d => out.push({ id: "seance-du-jour", periode: d, d }));
  Object.entries(J.jours).forEach(([d, j]) => { if (j.forme && d <= auj) out.push({ id: "forme-du-matin", periode: d, d }); });
  // Hebdomadaires (jours distincts)
  const semaines = new Set([...seances.map(s => semaineDe(s.d)), ...J.cardio.filter(c => c.d <= auj).map(c => semaineDe(c.d))]);
  semaines.forEach(l => {
    const au = addJours(l, 6), dans = seances.filter(s => s.d >= l && s.d <= au);
    const prevus = prevuesSemaine(D, J, l, au), fin = dans.length ? dans.at(-1).d : l;
    if (prevus && joursDistincts(dans) >= prevus) out.push({ id: "seances-prevues", periode: l, d: fin });
    const z2 = dans.find(s => s.z2Min >= H.minZ2)?.d || J.cardio.find(c => c.d >= l && c.d <= au && c.d <= auj && c.z2 && c.min >= H.minZ2)?.d;
    if (z2) out.push({ id: "zone-2", periode: l, d: z2 });
    const sk = dans.find(s => s.skills); if (sk) out.push({ id: "skills", periode: l, d: sk.d });
    const pr = dans.find(s => s.prevention >= H.seriesPrevention); if (pr) out.push({ id: "prevention", periode: l, d: pr.d });
  });
  // Bloc : périodes = fenêtres fixes de dates (changer de bloc ne redonne rien)
  const cal = calDe(D, J);
  if (cal) {
    [1, 2, 3].forEach(m => {
      const sem = cal.filter(s => s.meso === m), au = sem[3].au; if (au >= auj) return;
      const prevus = prevuesSemaine(D, J, sem[0].du, au);
      const faites = joursDistincts(seances.filter(s => s.d >= sem[0].du && s.d <= au));
      const periode = `f${fenetre(au, H.fenetreBloc)}`;
      if (prevus && faites / prevus >= H.partMesoTermine) out.push({ id: "meso-termine", periode, d: au });
      const avant = seances.filter(s => s.d >= sem[2].du && s.d <= sem[2].au).reduce((t, s) => t + nbSeries(s), 0);
      const dech = seances.filter(s => s.d >= sem[3].du && s.d <= sem[3].au);
      if (dech.length && avant && dech.reduce((t, s) => t + nbSeries(s), 0) <= avant * 0.6) out.push({ id: "decharge", periode, d: au });
    });
    // Boss : tous les tests de fin de macro notés en semaine 12 (ou la semaine qui suit)
    const types = macro(D, J.bloc.macroId)?.tests?.["12"] || [];
    const tests = J.tests.filter(t => t.d >= cal[11].du && t.d <= addJours(cal[11].au, 7) && t.d <= auj);
    if (types.length && types.every(t => tests.some(x => x.type === t))) {
      const d = tests.filter(t => types.includes(t.type)).map(t => t.d).sort().at(-1);
      out.push({ id: "boss", periode: `b${fenetre(d, H.fenetreBloc * 3)}`, d });
    }
  }
  // Skills : chaque palier, une fois pour toutes
  D.quetes.filter(q => q.type === "skill").forEach(q => {
    (D.skills[q.skill]?.paliers || []).forEach((p, i) => {
      const s = seances.find(x => palierAtteint(p, x));
      if (s) out.push({ id: q.id, periode: `p${i + 1}`, d: s.d, palier: p.nom });
    });
  });
  const vus = new Set();
  return out.filter(r => { const k = r.id + "|" + r.periode; return !vus.has(k) && vus.add(k); })
    .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.id < b.id ? -1 : 1);
}

// Quêtes affichées aujourd'hui : jour, semaine en cours, bloc en cours, prochain palier de skill, boss
export function quetesDuMoment(D, J, auj, R = reussites(D, J, auj)) {
  const H = D.hypotheses, ok = (id, periode) => R.some(r => r.id === id && r.periode === periode);
  const l = semaineDe(auj), au = addJours(l, 6), dans = J.seances.filter(s => s.d >= l && s.d <= auj && valide(s));
  const prevus = prevuesSemaine(D, J, l, au), out = [];
  const add = (q, periode, n, sur, extra = {}) => out.push({ id: q.id, type: q.type, titre: q.titre, periode, n, sur, reussie: ok(q.id, periode), ...extra });
  D.quetes.forEach(q => {
    if (q.type === "jour") add(q, auj, ok(q.id, auj) ? 1 : 0, 1);
    else if (q.id === "seances-prevues") { if (prevus) add(q, l, Math.min(joursDistincts(dans), prevus), prevus); }
    else if (q.type === "semaine") add(q, l, ok(q.id, l) ? 1 : 0, 1);
    else if (q.type === "skill") {
      const pal = D.skills[q.skill]?.paliers || [], faits = pal.filter((_, i) => ok(q.id, `p${i + 1}`)).length;
      add(q, `p${Math.min(faits + 1, pal.length)}`, faits, pal.length, { prochain: pal[faits]?.nom || null });
    }
  });
  const cal = calDe(D, J), pos = cal?.find(s => s.du <= auj && auj <= s.au);
  if (pos) {
    const fin = cal.filter(s => s.meso === pos.meso)[3].au, p = `f${fenetre(fin, H.fenetreBloc)}`;
    D.quetes.filter(q => q.type === "bloc").forEach(q => add(q, p, ok(q.id, p) ? 1 : 0, 1, { semaine: pos.n }));
    const boss = D.quetes.find(q => q.type === "boss"), types = macro(D, J.bloc.macroId)?.tests?.["12"] || [];
    const faits = new Set(J.tests.filter(t => t.d >= cal[11].du && t.d <= auj).map(t => t.type));
    add(boss, "b", types.filter(t => faits.has(t)).length, types.length, { tests: types, ouvert: pos.n >= 12, reussie: R.some(r => r.id === "boss" && r.d >= cal[11].du) });
  }
  return out;
}

// ---------- Événements d'XP (clés déterministes, indépendantes de l'ordre et des identifiants) ----------
export function evenements(D, J, auj, R = reussites(D, J, auj)) {
  const X = D.xp, H = D.hypotheses, out = [];
  const ajoute = (cle, source, xp, d, libelle) => { if (xp > 0) out.push({ cle, source, xp, d, libelle }); };
  // Séances : au plus seancesXpParJour par jour (créneaux 1, 2…), technique et records une fois par jour
  const parJour = {};
  J.seances.filter(s => s.d <= auj && valide(s)).forEach(s => { (parJour[s.d] = parJour[s.d] || []).push(s); });
  Object.entries(parJour).forEach(([d, l]) => {
    l.slice(0, H.seancesXpParJour).forEach((_, i) => ajoute(`seance:${d}:${i + 1}`, "regularite", X.seance, d, "Séance faite"));
    if (l.some(s => s.echauffement && s.prevention > 0)) ajoute(`complete:${d}`, "technique", X.seanceComplete, d, "Échauffement et petits muscles faits");
    const rec = Math.min(l.reduce((t, s) => t + s.records, 0), X.recordsMaxParSeance);
    for (let i = 0; i < rec; i++) ajoute(`record:${d}:${i + 1}`, "record", X.record, d, "Record");
  });
  Object.entries(J.jours).forEach(([d, j]) => { if (j.forme && d <= auj) ajoute(`forme:${d}`, "recuperation", X.forme, d, "Forme du matin notée"); });
  // Tests : un type donné rapporte au plus une fois par fenêtre fixe
  J.tests.filter(t => t.d <= auj).forEach(t => ajoute(`test:${t.type}:f${fenetre(t.d, H.fenetreTest)}`, "test", X.test, t.d, "Test fait"));
  R.forEach(r => {
    const q = D.quetes.find(x => x.id === r.id); if (!q) return;
    const xp = q.type === "semaine" ? X.queteSemaine : q.id === "decharge" ? X.decharge : q.type === "bloc" ? X.queteBloc : q.type === "skill" ? X.palierSkill : q.type === "boss" ? X.boss : 0;
    ajoute(`quete:${r.id}:${r.periode}`, q.id === "decharge" ? "decharge" : "quete", xp, r.d, q.titre + (r.palier ? ` · ${r.palier}` : ""));
  });
  const vus = new Set();
  return out.filter(e => !vus.has(e.cle) && vus.add(e.cle)).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.cle < b.cle ? -1 : 1);
}

// ---------- Rang ----------
export function rang(D, xp) {
  const R = D.rangs, i = R.reduce((k, r, j) => xp >= r.min ? j : k, 0), r = R[i], s = R[i + 1] || null;
  return { id: r.id, nom: r.nom, min: r.min, suivant: s ? { id: s.id, nom: s.nom, min: s.min } : null, reste: s ? s.min - xp : 0, pct: s ? Math.round((xp - r.min) / (s.min - r.min) * 100) : 100 };
}

// ---------- Objets du personnage : on ajoute, on ne retire jamais ----------
export function debloques(D, { xp = 0, quetes = [], serieRecord = 0 } = {}, precedents = []) {
  const ordre = Object.fromEntries(D.rangs.map((r, i) => [r.id, i])), monRang = ordre[rang(D, xp).id];
  const faites = new Set(quetes);
  const ok = (c = {}) => (c.rang == null || monRang >= ordre[c.rang]) && (c.quete == null || faites.has(c.quete)) && (c.serie == null || serieRecord >= c.serie);
  const ids = new Set([...(Array.isArray(precedents) ? precedents : []).filter(x => typeof x === "string"), ...D.objets.filter(o => ok(o.condition)).map(o => o.id)]);
  return D.objets.map(o => o.id).filter(id => ids.has(id)).concat([...ids].filter(id => !D.objets.some(o => o.id === id)));
}

// ---------- Bilan complet ----------
// xpBase : XP totale connue côté serveur (elle ne baisse jamais) ; sinon la somme des événements du journal
export function bilan(D, J, auj, { precedents = [], xpBase = null } = {}) {
  const R = reussites(D, J, auj), ev = evenements(D, J, auj, R), s = serie(D, J, auj);
  const xp = Math.max(xpBase ?? 0, ev.reduce((t, e) => t + e.xp, 0));
  return { xp, rang: rang(D, xp), serie: s, quetes: quetesDuMoment(D, J, auj, R), evenements: ev, reussites: R,
    debloques: debloques(D, { xp, quetes: R.map(r => r.id), serieRecord: s.record }, precedents) };
}
