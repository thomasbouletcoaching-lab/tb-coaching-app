// Quêtes, XP, série, rangs et objets du personnage du module « athlète hybride ».
// Module pur : aucun accès à l'écran, au stockage ni au serveur. Testé par `node --test tests/hybride-quetes.test.mjs`.
// Le même fichier tourne sur le téléphone (affichage) et dans la fonction serveur `hybride-xp` (seule à écrire l'XP, décision C56).
//
// Principe : tout est DÉRIVÉ des logs existants (séances, routine, tests), avec des clés déterministes.
// Rejouer le calcul sur les mêmes logs donne exactement les mêmes événements : le serveur peut les insérer
// avec « on conflict do nothing » sans jamais compter deux fois.
//
// Règles du brief :
//   · XP pour la régularité, la technique, la récupération, la décharge, les tests et les records ;
//     jamais pour le volume brut, jamais pour une séance faite malgré une douleur ou une fatigue déclarées.
//   · Série tolérante : jours de grâce, pause « imprévu ou mauvaise nuit », repos prévu et décharge ne la cassent pas.
//   · Retour après une absence : accueil positif, jamais de reproche.
//   · Le personnage ne régresse jamais : un objet débloqué le reste.
import { calendrier, addJours, ecartJours, lundiDe, dowDe, gabarit, poidsExercice, macro } from "./hybride.js";

export const VERSION = 1;

// ---------- Outils ----------
const parJour = (liste) => { const m = {}; liste.forEach(x => { (m[x.d] = m[x.d] || []).push(x); }); return m; };
const nbSeries = (s) => (s.exercices || []).reduce((t, e) => t + (e.series || []).length, 0);
const valide = (s) => !s.douleur && !s.fatigue;
export const semaineDe = (d) => lundiDe(d);

// ---------- Adaptateur : état de l'app → journal ----------
// Lit sans rien modifier. st : état local (S()) ou instantané serveur ({ workouts, daily, hybride }).
// exDe(nom) → ligne de data/exercices.json (ou null).
const DOULEUR = /douleur|mal |mal$|gêne|gene|bless|tendin|pincement|sciatique/i;
const Z2_NOM = /zone ?2|(^|[^\p{L}])z2([^\p{L}]|$)/iu;
const Z2_PROBABLE = /vélo|velo|rameur|footing|marche rapide|elliptique/i;
const INTENSE = /fraction|interval|sprint|vma|seuil|tabata|hiit/i;
export function journalDepuisEtat(D, st = {}, exDe = () => null) {
  const H = D.hypotheses, h = st.hybride || {};
  const fatigueLe = (d) => { const e = st.daily?.[d]?.feel?.energy; return e != null && +e <= H.fatigueEnergieMax; };
  const seances = (st.workouts || []).filter(w => w && (w.end || w.start)).map((w, i) => {
    const d = String(w.end || w.start).slice(0, 10);
    let echauffement = false, prevention = 0, skills = false, z2Min = 0, douleur = false;
    const exercices = (w.exercises || []).map(e => {
      const row = exDe(e.name) || { nom: e.name, muscles: [] };
      const faites = (e.sets || []).filter(s => s.done);
      const travail = faites.filter(s => s.type !== "W");
      if (faites.some(s => s.type === "W") || row.categorie === "mobilite" || /échauffement|activation/i.test(e.name || "")) echauffement = true;
      if (faites.some(s => s.pain || DOULEUR.test(s.note || "")) || DOULEUR.test(e.myNote || "")) douleur = true;
      const p = poidsExercice(D, row), principal = Object.keys(p).find(k => p[k] === 1);
      if (principal && D.groupes.find(g => g.id === principal)?.qualite === "prevention") prevention += travail.length;
      if (row.categorie === "skills") skills = travail.length > 0;
      if (row.categorie === "cardio" && Z2_NOM.test(e.name || "") && !INTENSE.test(e.name || "")) z2Min += travail.reduce((t, s) => t + (+s.min || (+s.sec || 0) / 60), 0);
      return { nom: e.name, series: travail.map(s => ({ reps: +s.reps || 0, kg: +s.kg || 0, sec: +s.sec || 0 })) };
    });
    return { id: String(w.id || w.end || i), d, exercices, echauffement, prevention, skills, z2Min, douleur, fatigue: fatigueLe(d), records: (w.records || []).length, libre: !!w.free };
  });
  const cardio = [];
  Object.entries(st.daily || {}).forEach(([d, x]) => (x?.cardio || []).forEach(c => {
    const n = c?.n || "", min = +c?.min || 0;
    cardio.push({ d, min, z2: !INTENSE.test(n) && (Z2_NOM.test(n) || Z2_PROBABLE.test(n)) });
  }));
  const jours = {};
  Object.entries(st.daily || {}).forEach(([d, x]) => { if (x?.feel && Object.keys(x.feel).length) (jours[d] = jours[d] || {}).forme = true; });
  Object.entries(h.pauses || {}).forEach(([d, motif]) => { if (motif) (jours[d] = jours[d] || {}).pause = String(motif); });
  return { seances, cardio, jours, tests: (h.tests || []).filter(t => t?.d && t?.type), bloc: h.bloc || null };
}

// ---------- Jours prévus par le bloc ----------
export function joursPrevus(D, bloc, du, au) {
  if (!bloc?.macroId || !bloc?.debut || !bloc?.nbSeances) return new Set();
  const cal = calendrier(D, { debut: bloc.debut, macroId: bloc.macroId });
  const dows = new Set(gabarit(D, bloc.nbSeances).seances.map(s => s.jour)), out = new Set();
  for (let d = du > cal[0].du ? du : cal[0].du; d <= au && d <= cal[11].au; d = addJours(d, 1)) if (dows.has(dowDe(d))) out.add(d);
  return out;
}
const semaineDecharge = (cal, d) => !!cal?.find(s => s.du <= d && d <= s.au && s.decharge);

// ---------- Série tolérante ----------
export function serie(D, J, auj) {
  const H = D.hypotheses, faites = new Set(J.seances.map(s => s.d));
  const activites = [...faites, ...J.cardio.map(c => c.d), ...Object.keys(J.jours).filter(d => J.jours[d].forme || J.jours[d].pause), ...J.tests.map(t => t.d)].filter(d => d <= auj).sort();
  if (!activites.length) return { jours: 0, record: 0, graceRestante: H.graceParSemaine, retour: false, message: "Ta série démarre à ta première séance." };
  const cal = J.bloc ? calendrier(D, { debut: J.bloc.debut, macroId: J.bloc.macroId }) : null;
  const prevus = joursPrevus(D, J.bloc, activites[0], auj);
  let jours = 0, record = 0; const graces = [];
  for (let d = activites[0]; d <= auj; d = addJours(d, 1)) {
    const fait = faites.has(d), pause = !!J.jours[d]?.pause, prevu = prevus.has(d);
    if (fait || pause) { jours++; }
    else if (!prevu) { jours++; }                                  // repos prévu : la série continue
    else if (d === auj) { /* séance du jour encore possible : rien ne change */ }
    else if (cal && semaineDecharge(cal, d)) { jours++; }          // décharge : un jour allégé ne casse rien
    else {
      const recentes = graces.filter(g => ecartJours(g, d) < 7).length;
      if (recentes < H.graceParSemaine) { graces.push(d); jours++; }
      else jours = 0;
    }
    record = Math.max(record, jours);
  }
  const derniere = activites[activites.length - 1], absence = ecartJours(derniere, auj);
  // Retour : une longue absence, avec au moins une séance prévue manquée (sans bloc : l'absence suffit)
  const manque = [...prevus].some(d => d > derniere && d < auj && !J.jours[d]?.pause);
  const retour = absence >= H.absenceRetour && (!J.bloc || manque);
  const graceRestante = Math.max(0, H.graceParSemaine - graces.filter(g => ecartJours(g, auj) < 7).length);
  const message = retour ? "On reprend. Une séance à la fois, sans rien rattraper." : jours ? null : "Ta série redémarre aujourd'hui.";
  return { jours: retour ? 0 : jours, record, graceRestante, retour, message };
}

// ---------- Quêtes ----------
function palierAtteint(p, s) {
  const re = new RegExp(p.re, "iu");
  return s.exercices.some(e => re.test(e.nom || "") && e.series.filter(x =>
    (!p.reps || x.reps >= p.reps) && (!p.sec || x.sec >= p.sec) && (!p.kg || x.kg >= p.kg)).length >= p.series);
}

// Toutes les réussites depuis le début (pour l'XP et les objets) : [{ id, periode, d }]
export function reussites(D, J, auj) {
  const H = D.hypotheses, out = [], seances = J.seances.filter(s => s.d <= auj), parD = parJour(seances);
  const cat = Object.fromEntries(D.quetes.map(q => [q.id, q]));
  // Quotidiennes
  Object.entries(parD).forEach(([d, l]) => { if (l.some(s => valide(s) && s.echauffement && s.prevention > 0)) out.push({ id: "seance-du-jour", periode: d, d }); });
  Object.entries(J.jours).forEach(([d, j]) => { if (j.forme && d <= auj) out.push({ id: "forme-du-matin", periode: d, d }); });
  // Hebdomadaires
  const semaines = new Set([...seances.map(s => semaineDe(s.d)), ...J.cardio.filter(c => c.d <= auj).map(c => semaineDe(c.d))]);
  semaines.forEach(l => {
    const au = addJours(l, 6), dans = seances.filter(s => s.d >= l && s.d <= au);
    const prevus = [...joursPrevus(D, J.bloc, l, au)].filter(d => !J.jours[d]?.pause);
    const fin = dans.length ? dans.map(s => s.d).sort().at(-1) : l;
    if (prevus.length && dans.length >= prevus.length) out.push({ id: "seances-prevues", periode: l, d: fin });
    const z2 = dans.find(s => s.z2Min >= H.minZ2)?.d || J.cardio.find(c => c.d >= l && c.d <= au && c.d <= auj && c.z2 && c.min >= H.minZ2)?.d;
    if (z2) out.push({ id: "zone-2", periode: l, d: z2 });
    const sk = dans.find(s => s.skills); if (sk) out.push({ id: "skills", periode: l, d: sk.d });
    const pr = dans.find(s => s.prevention >= H.seriesPrevention); if (pr) out.push({ id: "prevention", periode: l, d: pr.d });
  });
  // Bloc : mésocycle terminé, décharge faite (seulement pour des semaines passées)
  if (J.bloc) {
    const cal = calendrier(D, { debut: J.bloc.debut, macroId: J.bloc.macroId }), tag = `${J.bloc.macroId}:${cal[0].du}`;
    [1, 2, 3].forEach(m => {
      const sem = cal.filter(s => s.meso === m), au = sem[3].au; if (au >= auj) return;
      const prevus = [...joursPrevus(D, J.bloc, sem[0].du, au)].filter(d => !J.jours[d]?.pause).length;
      const faites = seances.filter(s => s.d >= sem[0].du && s.d <= au).length;
      if (prevus && faites / prevus >= H.partMesoTermine) out.push({ id: "meso-termine", periode: `${tag}:m${m}`, d: au });
      const avant = seances.filter(s => s.d >= sem[2].du && s.d <= sem[2].au).reduce((t, s) => t + nbSeries(s), 0);
      const dech = seances.filter(s => s.d >= sem[3].du && s.d <= sem[3].au);
      const vol = dech.reduce((t, s) => t + nbSeries(s), 0);
      if (dech.length && avant && vol <= avant * 0.6) out.push({ id: "decharge", periode: `${tag}:m${m}`, d: au });
    });
    // Boss : tous les tests de fin de macro notés en semaine 12 (ou la semaine qui suit)
    const types = macro(D, J.bloc.macroId)?.tests?.["12"] || [];
    const faits = new Set(J.tests.filter(t => t.d >= cal[11].du && t.d <= addJours(cal[11].au, 7) && t.d <= auj).map(t => t.type));
    if (types.length && types.every(t => faits.has(t))) out.push({ id: "boss", periode: tag, d: J.tests.filter(t => types.includes(t.type)).map(t => t.d).sort().at(-1) });
  }
  // Skills : chaque palier, une fois pour toutes
  D.quetes.filter(q => q.type === "skill").forEach(q => {
    (D.skills[q.skill]?.paliers || []).forEach((p, i) => {
      const s = seances.filter(valide).sort((a, b) => a.d < b.d ? -1 : 1).find(x => palierAtteint(p, x));
      if (s) out.push({ id: q.id, periode: `p${i + 1}`, d: s.d, palier: p.nom });
    });
  });
  return out.filter(r => cat[r.id]).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.id < b.id ? -1 : 1);
}

// Quêtes affichées aujourd'hui : jour, semaine en cours, bloc en cours, prochain palier de skill, boss
export function quetesDuMoment(D, J, auj) {
  const H = D.hypotheses, R = reussites(D, J, auj), ok = (id, periode) => R.some(r => r.id === id && r.periode === periode);
  const l = semaineDe(auj), au = addJours(l, 6), dans = J.seances.filter(s => s.d >= l && s.d <= auj);
  const prevus = [...joursPrevus(D, J.bloc, l, au)].filter(d => !J.jours[d]?.pause).length;
  const out = [];
  const add = (q, periode, n, sur, extra = {}) => out.push({ id: q.id, type: q.type, titre: q.titre, periode, n, sur, reussie: ok(q.id, periode), ...extra });
  D.quetes.forEach(q => {
    if (q.type === "jour") add(q, auj, ok(q.id, auj) ? 1 : 0, 1);
    else if (q.id === "seances-prevues") { if (prevus) add(q, l, Math.min(dans.length, prevus), prevus); }
    else if (q.type === "semaine") add(q, l, ok(q.id, l) ? 1 : 0, 1);
    else if (q.type === "skill") {
      const pal = D.skills[q.skill]?.paliers || [], faits = pal.filter((_, i) => ok(q.id, `p${i + 1}`)).length;
      add(q, `p${Math.min(faits + 1, pal.length)}`, faits, pal.length, { prochain: pal[faits]?.nom || null });
    }
  });
  if (J.bloc) {
    const cal = calendrier(D, { debut: J.bloc.debut, macroId: J.bloc.macroId }), pos = cal.find(s => s.du <= auj && auj <= s.au);
    if (pos) {
      const tag = `${J.bloc.macroId}:${cal[0].du}`, p = `${tag}:m${pos.meso}`;
      D.quetes.filter(q => q.type === "bloc").forEach(q => add(q, p, ok(q.id, p) ? 1 : 0, 1, { semaine: pos.n }));
      const boss = D.quetes.find(q => q.type === "boss"), types = macro(D, J.bloc.macroId)?.tests?.["12"] || [];
      const faits = new Set(J.tests.filter(t => t.d >= cal[11].du).map(t => t.type));
      add(boss, tag, types.filter(t => faits.has(t)).length, types.length, { tests: types, ouvert: pos.n >= 12 });
    }
  }
  return out;
}

// ---------- Événements d'XP (clés déterministes) ----------
export function evenements(D, J, auj) {
  const X = D.xp, out = [];
  const ajoute = (cle, source, xp, d, libelle) => { if (xp > 0) out.push({ cle, source, xp, d, libelle }); };
  J.seances.filter(s => s.d <= auj).forEach(s => {
    if (!valide(s)) return;                                   // douleur ou fatigue déclarée : aucune XP
    ajoute(`seance:${s.d}:${s.id}`, "regularite", X.seance, s.d, "Séance faite");
    if (s.echauffement && s.prevention > 0) ajoute(`complete:${s.d}:${s.id}`, "technique", X.seanceComplete, s.d, "Échauffement et petits muscles faits");
    for (let i = 0; i < Math.min(s.records, X.recordsMaxParSeance); i++) ajoute(`record:${s.d}:${s.id}:${i}`, "record", X.record, s.d, "Record");
  });
  Object.entries(J.jours).forEach(([d, j]) => { if (j.forme && d <= auj) ajoute(`forme:${d}`, "recuperation", X.forme, d, "Forme du matin notée"); });
  J.tests.filter(t => t.d <= auj).forEach(t => ajoute(`test:${t.type}:${t.d}`, "test", X.test, t.d, "Test fait"));
  reussites(D, J, auj).forEach(r => {
    const q = D.quetes.find(x => x.id === r.id);
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
  const ids = new Set([...(precedents || []), ...D.objets.filter(o => ok(o.condition)).map(o => o.id)]);
  return D.objets.map(o => o.id).filter(id => ids.has(id)).concat([...ids].filter(id => !D.objets.some(o => o.id === id)));
}

// ---------- Bilan complet ----------
export function bilan(D, J, auj, { precedents = [] } = {}) {
  const ev = evenements(D, J, auj), xp = ev.reduce((t, e) => t + e.xp, 0);
  const R = reussites(D, J, auj), s = serie(D, J, auj);
  return { xp, rang: rang(D, xp), serie: s, quetes: quetesDuMoment(D, J, auj), evenements: ev,
    debloques: debloques(D, { xp, quetes: R.map(r => r.id), serieRecord: s.record }, precedents) };
}
