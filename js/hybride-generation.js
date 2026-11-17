// Génération d'une semaine du programme « athlète hybride » à partir du bloc en cours.
// Module pur, testé par `node --test tests/hybride-generation.test.mjs`.
//
// Réutilise le générateur existant (js/generateur.js) : choix des exercices par pattern (pool, avec matériel,
// gênes et exercices détestés du questionnaire « sur mesure »), format des lignes (ligne) et conversion
// vers le moteur de séances (versProgramme). Le résultat est une PROPOSITION, jamais appliquée toute seule :
// l'app demande l'accord du membre avant de remplacer un programme en cours (js/hybride.js, remplacerProgramme).
import * as H from "./hybride.js";
import { pool, ligne, profil, versProgramme as versProgrammeGen } from "./generateur.js";
import { BASE } from "./exercices-base.js";

export const VERSION = 1;
const NIVEAU_EX = { debutant: 0, intermediaire: 1, avance: 2 };
const NIVEAU_PERS = { debutant: 0, regulier: 1, avance: 2 };

// Exercice dont le groupe principal est g, faisable avec le matériel, sans gêne déclarée
function pourGroupe(D, g, rows, { materiel = [], zones = [], exclure = new Set(), niveau = "regulier" }) {
  const ok = rows.filter(e => e.actif !== false && H.poidsExercice(D, e)[g] === 1)
    .filter(e => !materiel.length || (e.materiel || []).some(m => materiel.includes(m)))
    .filter(e => !(e.contre_indications || []).some(z => zones.includes(z)) && !exclure.has(e.slug));
  // Isolation d'abord ; un mouvement du squelette (ex. leg curl, flexion de genou) seulement à défaut
  const score = (e) => (e.couche === "squelette" ? 3 : 0) + (BASE.has(e.slug) ? 0 : 10) + Math.max(0, (NIVEAU_EX[e.niveau] ?? 1) - (NIVEAU_PERS[niveau] ?? 1)) * 5 + (e.cout_nerveux || 1);
  return ok.sort((a, b) => score(a) - score(b) || a.nom.localeCompare(b.nom, "fr"))[0] || null;
}
const parSlug = (rows, slug) => rows.find(e => e.slug === slug) || null;
const faisable = (e, ctx) => !!e && (!ctx.materiel.length || (e.materiel || []).some(m => ctx.materiel.includes(m))) && !(e.contre_indications || []).some(z => ctx.zones.includes(z)) && !ctx.exclure.has(e.slug);
const synthetique = (nom, n, reps, repos, categorie) => ({ slug: null, nom, pattern: null, couche: "module", categorie, kind: "A", n, lo: reps, hi: reps, rpe: null, rest: repos, unite: "reps", nerveux: 3, note: "" });

// opts : { bloc: { macroId, debut, nbSeances }, semaineMacro (1 à 12), answers (questionnaire « sur mesure »), prefs,
//          reprise (bool), vma (km/h), halterophilie (technique acquise), paliers: { muscleup: 0… } }
export function semaine(D, rows, opts) {
  const { bloc, semaineMacro = 1, answers = {}, prefs = {}, reprise = !!H.macro(D, bloc.macroId)?.repriseCourse, vma = null, halterophilie = false, paliers = {} } = opts;
  const G = D.generation, n = bloc.nbSeances, gab = H.gabarit(D, n), cal = H.calendrier(D, { debut: bloc.debut, macroId: bloc.macroId });
  const sem = cal[Math.min(12, Math.max(1, semaineMacro)) - 1], dech = sem.decharge;
  const C = H.cibles(D, { macroId: bloc.macroId, semaine: sem.semaine, nbSeances: n });
  const prog = { answers, prefs }, pf = profil(answers, n), rpe = Math.min(9.5, 10 - sem.rir);
  const exclure = new Set(Object.keys(prefs).filter(s => prefs[s] === "hate"));
  const ctx = { materiel: answers.materiel || [], zones: answers.zones || [], exclure, niveau: pf.niveau };
  const moitie = (x) => dech ? Math.max(1, Math.round(x * D.hypotheses.coefDecharge)) : x;
  const fixe = (l, nSeries) => ({ ...l, n: moitie(nSeries), rpe: l.rpe == null ? null : (dech ? Math.min(l.rpe, 10 - D.hypotheses.rirDecharge) : rpe) });

  // Nombre de passages en force de chaque muscle principal dans la semaine (pour partager ses séries)
  const occForce = {};
  gab.seances.forEach(s => (s.slots?.force || []).forEach(code => {
    const e = pool(code, prog, rows, { niveau: pf.niveau })[0]; if (!e) return;
    const g = Object.keys(H.poidsExercice(D, e)).find(k => H.poidsExercice(D, e)[k] === 1); if (g) occForce[g] = (occForce[g] || 0) + 1;
  }));

  // 1. Blocs fixes (vitesse, pliométrie, haltérophilie, force, skills, cardio)
  const seances = gab.seances.map(s => {
    const blocs = s.blocs.map(id => ({ id, items: [] })), B = (id) => blocs.find(b => b.id === id);
    const sansSprint = (answers.zones || []).some(z => (D.hypotheses.zonesSansSprint || []).includes(z));
    if (B("vitesse") && !dech && !sansSprint) B("vitesse").items.push(synthetique(reprise && semaineMacro <= D.cardio.repriseSemaines ? `${G.vitesse.nom} à 90 %` : G.vitesse.nom, G.vitesse.n, G.vitesse.reps, G.vitesse.repos, "vitesse"));
    if (B("plio") && !dech) { const e = parSlug(rows, G.plio.slug); if (faisable(e, ctx)) B("plio").items.push({ ...ligne(e, G.plio.n, answers, pf), lo: G.plio.reps, hi: G.plio.reps, rpe: null }); }
    if (B("halterophilie")) { const e = parSlug(rows, halterophilie ? G.halterophilie.technique : G.halterophilie.sinon); if (faisable(e, ctx)) B("halterophilie").items.push({ ...ligne(e, moitie(G.halterophilie.n), answers, pf), lo: G.halterophilie.reps, hi: G.halterophilie.reps, rpe: null, note: halterophilie ? "Technique : 70 à 85 %, jamais à l'échec." : "Haltérophilie remplacée tant que la technique n'est pas acquise." }); }
    (s.slots?.force || []).forEach(code => {
      const e = pool(code, prog, rows, { niveau: pf.niveau })[0] || pool(code, prog, rows, { niveau: pf.niveau, filtreNiveau: false })[0];
      if (!e || !B("force")) return;
      // Séries lourdes : la cible du muscle principal, partagée entre ses passages de la semaine (3 à seriesForce, §3 « 3 à 6 séries »)
      const g = Object.keys(H.poidsExercice(D, e)).find(k => H.poidsExercice(D, e)[k] === 1), nb = occForce[g] || 1;
      const series = Math.min(G.seriesForce, Math.max(3, Math.round((C[g]?.cible || G.seriesForce) / nb)));
      B("force").items.push(fixe(ligne(e, series, answers, pf), series));
    });
    (s.slots?.skills || []).forEach(k => {
      const pal = D.skills[k]?.paliers || [], p = pal[Math.min(paliers[k] || 0, pal.length - 1)];
      const re = p && new RegExp(p.re, "iu"), e = re && rows.find(x => x.actif !== false && re.test(x.nom) && faisable(x, ctx));
      if (e && B("skills")) {
        const l = fixe(ligne(e, G.seriesSkill, answers, pf), G.seriesSkill), cible = p.sec || p.reps || l.lo;
        B("skills").items.push({ ...l, lo: cible, hi: cible, unite: p.sec ? "s" : "reps", note: `Objectif : ${p.nom}.`, rpe: null });
      }
    });
    const c0 = H.cardioEffectif(D, s, { semaineMacro, reprise });
    // Gêne au genou, à la cheville ou à la hanche : la course passe à vélo (moins d'impacts)
    const c = c0 && sansSprint && (c0.modalite === "course" || c0.modalite === "libre") ? { ...c0, modalite: "velo" } : c0;
    if (c && B("cardio")) {
      const z = D.zones.find(x => x.id === c.zone), al = vma ? H.allures(D, vma).find(x => x.id === c.zone) : null;
      const mod = { velo: "à vélo", rameur: "au rameur", course: "en course", libre: "" }[c.modalite] || "";
      B("cardio").items.push({ ...synthetique(`${c.zone === "Z2" ? "Zone 2" : c.zone + " · " + z.nom} ${mod}`.trim(), 1, c.min, 0, "cardio"), unite: "min", note: `${dech ? Math.round(c.min / 2) : c.min} min${al ? ` · ${al.kmh[0]} à ${al.kmh[1]} km/h` : ""}${c.remplace ? " · reprise : intervalles remplacés par de la zone 2" : ""}` });
    }
    return { titre: s.nom, dow: s.jour, type: s.type, jambesLourdes: !!s.jambesLourdes, cardio: s.cardio, blocs, slots: s.slots || {} };
  });

  // 2. Volume déjà couvert par les blocs fixes, puis hypertrophie et prévention pour atteindre les cibles
  // Haltérophilie, sauts et sprints : pas de volume musculaire ni de pattern (ce ne sont pas des séries près de l'échec)
  const lignesDe = (ss) => ss.flatMap(s => s.blocs.filter(b => !["vitesse", "plio", "halterophilie"].includes(b.id)).flatMap(b => b.items)).filter(l => l.slug).map(l => ({ ex: parSlug(rows, l.slug), series: l.n }));
  const v = H.volume(D, lignesDe(seances));
  ["hypertrophie", "prevention"].forEach(bloc => {
    const groupes = [...new Set(seances.flatMap(s => s.slots[bloc] || []))];
    groupes.forEach(g => {
      const ou = seances.filter(s => (s.slots[bloc] || []).includes(g) && s.blocs.some(b => b.id === bloc));
      const reste = Math.max(0, (C[g]?.cible || 0) - v[g]); if (!reste || !ou.length) return;
      const e = pourGroupe(D, g, rows, ctx); if (!e) return;
      const par = Math.min(G.maxSeriesParExercice, Math.max(G.minSeriesParExercice, Math.ceil(reste / ou.length)));
      ou.forEach(s => s.blocs.find(b => b.id === bloc).items.push({ ...ligne(e, par, answers, pf), n: par, rpe: dech ? 10 - D.hypotheses.rirDecharge : rpe }));
      v[g] += par * ou.length;
    });
  });

  // Groupes encore sous leur minimum (sans place prévue dans les gabarits) : ajoutés là où il y a le moins à faire
  D.groupes.filter(g => !g.sansAlerte && C[g.id] && v[g.id] < C[g.id].min).forEach(g => {
    const bloc = g.qualite === "prevention" ? "prevention" : "hypertrophie";
    const ou = seances.filter(s => s.blocs.some(b => b.id === bloc) || s.blocs.some(b => b.id === "hypertrophie"))
      .sort((a, b) => a.blocs.reduce((t, x) => t + x.items.length, 0) - b.blocs.reduce((t, x) => t + x.items.length, 0))[0];
    const e = ou && pourGroupe(D, g.id, rows, ctx); if (!e) return;
    const n = Math.min(G.maxSeriesParExercice, Math.max(G.minSeriesParExercice, Math.ceil(C[g.id].cible - v[g.id])));
    (ou.blocs.find(b => b.id === bloc) || ou.blocs.find(b => b.id === "hypertrophie")).items.push({ ...ligne(e, n, answers, pf), n, rpe: dech ? 10 - D.hypotheses.rirDecharge : rpe });
    v[g.id] += n;
  });

  // 3. Contrôles : règles d'ordre de la semaine et alertes d'équilibre sur le résultat
  const toutes = lignesDe(seances);
  const regles = H.verifierSemaine(D, gab.seances, { semaineMacro, reprise });
  const alertes = H.alertes(D, { lignes: toutes, cibles: C, nbSeances: n });
  return { v: VERSION, semaineMacro, meso: sem.meso, semaineMeso: sem.semaine, rir: sem.rir, decharge: dech, tests: sem.tests, cibles: C, volume: H.volume(D, toutes), seances, regles, alertes };
}

// Vers le format du moteur de séances (js/engine.js), via le convertisseur du générateur existant
export function versProgramme(D, prop, { id = "hybride", name = "Athlète hybride" } = {}) {
  const p = {
    n: prop.seances.length, seed: 0, structure: "split", semaines: 4, decharge: 4, profil: { niveau: "regulier" },
    jours: prop.seances.map(s => s.dow),
    sessions: prop.seances.map(s => ({ titre: s.titre, dow: s.dow, items: s.blocs.flatMap(b => b.items) })),
  };
  const out = versProgrammeGen(p, { id, name });
  return { ...out, desc: `Semaine ${prop.semaineMacro} du bloc : ${prop.decharge ? "décharge" : `RIR ${prop.rir}`}.`, why: "Deux qualités progressent dans ce bloc, les autres sont entretenues.", hybride: { semaineMacro: prop.semaineMacro } };
}
