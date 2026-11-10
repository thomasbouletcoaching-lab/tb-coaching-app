// Agenda « Ma semaine type » (créateur de programme, étape 5). Module pur : testé par `node --test tests/semaine.test.mjs`.
//
// - LE FIXE : ce qui revient chaque semaine (travail, enfants, trajets, repas, autre sport), plus le lever et le coucher.
// - LE VARIABLE : ce qui change cette semaine (déplacement, réunion tardive, enfant malade, soirée…).
// - LES SÉANCES COMME DES RENDEZ-VOUS : on cherche les créneaux libres où une séance tient (durée + trajet), on respecte les
//   règles de récupération (48 h entre deux séances d'un même pattern, 72 h pour une charnière lourde), on évite de rogner le
//   sommeil et on garde au moins un créneau de rechange dans la semaine.
// - IMPRÉVU : « Je ne peux pas » propose les prochains créneaux possibles ; sinon une version courte, ou la fusion de deux séances.
// Une séance décalée n'est pas un échec : rien ici ne compte un décalage comme une séance manquée.
import { ecartExige } from "./generateur.js";

export const VERSION = 1;
export const TYPES = [["travail", "Travail"], ["famille", "Famille, enfants"], ["trajet", "Trajet"], ["repas", "Repas"], ["sport", "Autre sport"], ["engagement", "Culte, engagement"], ["autre", "Autre"]];
export const TYPE_ICONE = { travail: "💼", famille: "👨‍👩‍👧", trajet: "🚗", repas: "🍽️", sport: "⚽", engagement: "🙏", autre: "📌", sommeil: "😴", seance: "🏋️", info: "ℹ️" };
// Ce qui change cette semaine : choix rapides de la revue du dimanche (type, libellé, horaires proposés)
export const IMPREVUS = [["deplacement", "Un déplacement", "trajet", "08:00", "19:00"], ["reunion", "Une réunion tardive", "travail", "17:00", "20:00"], ["enfant", "Un enfant malade, une garde", "famille", "08:00", "18:00"], ["soiree", "Une soirée", "autre", "19:00", "23:00"], ["autre", "Autre chose", "autre", "12:00", "14:00"]];
export const PREFERENCES = [["matin", "Le matin", 7 * 60 + 30], ["midi", "Le midi", 12 * 60 + 15], ["soir", "Le soir", 18 * 60 + 30]];
export const POIDS = { violation: 1000, generique: 60, sansRechange: 250, ecart: 40, prefParDixMin: 1, margeParQuartH: 0.5, changement: 25 };
const PAS = 5, APRES_LEVER = 30, AVANT_COUCHER = 60, MIN_LIBRE = 15;

// ---------- Dates et heures ----------
export const min = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return (a || 0) * 60 + (b || 0); };
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const dowOf = (d) => (new Date(d + "T12:00:00").getDay() + 6) % 7;
export const addJ = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const ecartJours = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
export const lundiDe = (d) => addJ(d, -dowOf(d));
export const semaineDe = (lundi) => Array.from({ length: 7 }, (_, i) => addJ(lundi, i));
const arrondi = (m, sens = 0) => sens < 0 ? Math.floor(m / PAS) * PAS : sens > 0 ? Math.ceil(m / PAS) * PAS : Math.round(m / PAS) * PAS;

// ---------- Données ----------
export const defaut = () => ({ v: VERSION, reglages: { lever: "07:00", coucher: "23:00", trajet: 15, pref: "soir" }, fixe: [], variable: [] });
export function normaliser(sem) {
  const d = defaut(), s = { ...d, ...(sem || {}), reglages: { ...d.reglages, ...(sem?.reglages || {}) } };
  s.fixe = (s.fixe || []).filter(b => b && b.debut && b.fin && Array.isArray(b.jours)); s.variable = (s.variable || []).filter(b => b && b.date && b.debut && b.fin);
  return s;
}
let n = 0; export const idBloc = () => "b" + Date.now().toString(36) + (n++).toString(36);
// Valide un bloc saisi à l'écran. Une nuit se découpe en deux blocs : pas de bloc à cheval sur minuit.
export function validerBloc(b) {
  if (!b.debut || !b.fin) return { ok: false, msg: "Indique l'heure de début et de fin." };
  if (min(b.fin) <= min(b.debut)) return { ok: false, msg: "La fin doit être après le début (une nuit se découpe en deux blocs)." };
  if (b.date === undefined && !(b.jours || []).length) return { ok: false, msg: "Choisis au moins un jour." };
  if (b.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { ok: false, msg: "Choisis une date." };
  const type = TYPES.some(t => t[0] === b.type) ? b.type : "autre";
  return { ok: true, bloc: { id: b.id || idBloc(), type, label: String(b.label || "").trim().slice(0, 40), ...(b.date !== undefined ? { date: b.date } : { jours: [...new Set(b.jours.map(Number))].filter(x => x >= 0 && x <= 6).sort() }), debut: b.debut, fin: b.fin } };
}
export const sommeilVise = (sem) => { const r = normaliser(sem).reglages, c = min(r.coucher), l = min(r.lever); return (l - c + 1440) % 1440 || 1440; };

// ---------- Occupation d'un jour ----------
// Les événements « toute la journée » d'un calendrier importé (anniversaire, férié) ne bloquent pas l'entraînement.
const toutJour = (e) => e.s === "00:00" && e.e === "23:59";
export function blocsDuJour(sem, date, busy = []) {
  const s = normaliser(sem), dow = dowOf(date), out = [];
  s.fixe.filter(b => b.jours.includes(dow)).forEach(b => out.push({ debut: min(b.debut), fin: min(b.fin), type: b.type, label: b.label, source: "fixe", id: b.id }));
  s.variable.filter(b => b.date === date).forEach(b => out.push({ debut: min(b.debut), fin: min(b.fin), type: b.type, label: b.label, source: "variable", id: b.id }));
  (busy || []).filter(e => e.d === date && !toutJour(e)).forEach(e => out.push({ debut: min(e.s), fin: min(e.e), type: "autre", label: e.t || "Occupé", source: "calendrier" }));
  return out.sort((a, b) => a.debut - b.debut || a.fin - b.fin);
}
// Fenêtre où l'on peut s'entraîner : après le lever, et pas dans l'heure qui précède le coucher
export function fenetre(sem) {
  const r = normaliser(sem).reglages, lever = min(r.lever); let coucher = min(r.coucher); if (coucher <= lever) coucher = 1440;
  return { a: lever + APRES_LEVER, b: Math.min(coucher, 1440) - AVANT_COUCHER };
}
// Créneaux libres du jour (en minutes), d'au moins MIN_LIBRE ; `apres` : minute avant laquelle rien n'est proposé (aujourd'hui)
export function creneauxLibres(sem, date, busy = [], { apres = 0 } = {}) {
  const f = fenetre(sem), occ = blocsDuJour(sem, date, busy).map(b => [Math.max(b.debut, f.a), Math.min(b.fin, f.b)]).filter(x => x[1] > x[0]);
  const out = []; let at = Math.max(f.a, apres);
  for (const [d, e] of occ) { if (d - at >= MIN_LIBRE) out.push([at, d]); at = Math.max(at, e); }
  if (f.b - at >= MIN_LIBRE) out.push([at, f.b]);
  return out;
}
export const trajetPour = (sem, lieu) => /maison|domicile|chez moi/i.test(lieu || "") ? 0 : +normaliser(sem).reglages.trajet || 0;
// Début le plus proche de l'heure visée dans un créneau, trajet compris ; null si la séance n'y tient pas
export function meilleurDebut([a, b], dur, trajet, cible) {
  const lo = arrondi(a + trajet, 1), hi = arrondi(b - trajet - dur, -1);
  if (hi < lo) return null;
  return Math.max(lo, Math.min(hi, arrondi(cible)));
}
const cibleHoraire = (sem, pref) => (PREFERENCES.find(p => p[0] === (pref || normaliser(sem).reglages.pref)) || PREFERENCES[2])[2];
// Meilleur début du jour pour une séance : { debut, fin, marge (minutes libres autour) } ou null
export function placerLe(sem, date, dur, { lieu = "Salle", busy = [], apres = 0, cible = null } = {}) {
  const tr = trajetPour(sem, lieu), c = cible ?? cibleHoraire(sem);
  let meilleur = null;
  for (const cr of creneauxLibres(sem, date, busy, { apres })) {
    const d = meilleurDebut(cr, dur, tr, c); if (d == null) continue;
    const ecart = Math.abs(d - c), marge = (cr[1] - cr[0]) - (dur + 2 * tr);
    if (!meilleur || ecart < meilleur.ecart) meilleur = { debut: d, fin: d + dur, marge, ecart };
  }
  return meilleur;
}

// ---------- Récupération entre séances ----------
// seances : [{ date, patterns: [{ code, lourd }] | null }]. Renvoie les manques d'écart (jours) entre séances qui sollicitent le même pattern.
export function manquesRecuperation(seances, { cyclique = false } = {}) {
  const out = [];
  for (let i = 0; i < seances.length; i++) for (let j = i + 1; j < seances.length; j++) {
    const a = seances[i], b = seances[j]; let gap = Math.abs(ecartJours(a.date, b.date)); if (cyclique) gap = Math.min(gap, 7 - gap);
    if (a.patterns && b.patterns) {
      for (const pa of a.patterns) { const pb = b.patterns.find(x => x.code === pa.code); if (!pb) continue; const need = ecartExige(pa.code, pa.lourd || pb.lourd); if (gap < need) out.push({ type: "pattern", code: pa.code, gap, need, a: a.date, b: b.date }); }
    } else if (gap < 2) out.push({ type: "generique", gap, need: 2, a: a.date, b: b.date });
  }
  return out;
}

// ---------- Placer les séances de la semaine ----------
function combinaisons(arr, k) { if (k === 0) return [[]]; if (arr.length < k) return []; const [x, ...r] = arr; return [...combinaisons(r, k - 1).map(c => [x, ...c]), ...combinaisons(r, k)]; }
// seances : [{ titre, dur (min), lieu, patterns }] dans l'ordre du programme.
// opts : busy (calendrier importé), dates (jours possibles, par défaut la semaine du lundi), fixes ([{date, patterns}] séances déjà faites ou figées),
//        courant ({ index: date } plan actuel : on préfère ne pas bouger), now ({ date, min }), cyclique (semaine type : la semaine suivante ressemble à celle-ci)
export function planifier(sem, lundi, seances, { busy = [], dates = null, fixes = [], courant = {}, now = null, cyclique = false, pref = null } = {}) {
  const jours = (dates || semaineDe(lundi)).slice().sort(), s = normaliser(sem), cible = cibleHoraire(s, pref);
  const apresDe = (d) => now && now.date === d ? arrondi(now.min + 30, 1) : 0;
  const options = seances.map(se => Object.fromEntries(jours.map(d => [d, placerLe(s, d, se.dur, { lieu: se.lieu, busy, apres: apresDe(d), cible })])));
  const total = seances.length;
  for (let k = total; k >= 1; k--) {
    const garde = seances.slice(0, k), cs = [];
    for (const combo of combinaisons(jours, k)) {
      if (combo.some((d, i) => !options[i][d])) continue;
      const aff = combo.map((d, i) => ({ i, date: d, ...options[i][d], patterns: seances[i].patterns }));
      const manques = manquesRecuperation([...fixes, ...aff.map(x => ({ date: x.date, patterns: x.patterns }))], { cyclique });
      const strict = manques.filter(m => m.type === "pattern").length, generique = manques.filter(m => m.type === "generique").length;
      const ecarts = combo.slice(1).map((d, i) => ecartJours(combo[i], d)); const minEcart = ecarts.length ? Math.min(...ecarts) : 7;
      const libres = jours.filter(d => !combo.includes(d) && garde.some((se, i) => placerLe(s, d, Math.min(se.dur, 30), { lieu: se.lieu, busy, apres: apresDe(d), cible })));
      const rechange = libres.length > 0 || k < total;
      const score = strict * POIDS.violation + generique * POIDS.generique + (rechange ? 0 : POIDS.sansRechange) - minEcart * POIDS.ecart
        + aff.reduce((t, x) => t + Math.abs(x.debut - cible) / 10 * POIDS.prefParDixMin - Math.min(x.marge, 120) / 15 * POIDS.margeParQuartH, 0)
        + aff.filter(x => courant[x.i] && courant[x.i] !== x.date).length * POIDS.changement;
      cs.push({ aff, manques, score, rechange: libres[0] || null });
    }
    if (cs.length) {
      const best = cs.sort((a, b) => a.score - b.score)[0];
      return { affectations: best.aff.map(({ i, date, debut, fin, marge, patterns }) => ({ i, titre: seances[i].titre, date, dow: dowOf(date), debut, fin, marge, lieu: seances[i].lieu || "Salle" })), reportees: seances.slice(k).map((x, j) => k + j),
        manques: best.manques, rechange: best.rechange, score: Math.round(best.score), cyclique };
    }
  }
  return { affectations: [], reportees: seances.map((_, i) => i), manques: [], rechange: null, score: 0, cyclique };
}

// Messages lisibles pour l'écran : ce qui est bien, ce qui manque
export function controles(plan, sem, seances = []) {
  const out = [], push = (niveau, texte) => out.push({ niveau, texte }), r = normaliser(sem).reglages;
  if (plan.reportees.length) push("alerte", `${plan.reportees.length} séance${plan.reportees.length > 1 ? "s" : ""} ne trouve${plan.reportees.length > 1 ? "nt" : ""} pas de créneau : ${plan.reportees.map(i => seances[i]?.titre || "séance").join(", ")}. ${plan.reportees.length > 1 ? "Elles passent" : "Elle passe"} à la semaine suivante.`);
  const patt = plan.manques.filter(m => m.type === "pattern");
  if (patt.length) push("alerte", `Récupération courte : ${[...new Set(patt.map(m => m.code))].join(", ")} travaillés à moins de 48 h (72 h pour une charnière lourde).`);
  else if (plan.affectations.length) push("ok", "Au moins 48 h entre deux séances d'un même pattern.");
  if (plan.affectations.length) push(plan.rechange ? "ok" : "alerte", plan.rechange ? "Un créneau de rechange reste libre dans la semaine." : "Aucun créneau de rechange : au premier imprévu, une séance sautera.");
  const tard = plan.affectations.filter(x => x.fin > min(r.coucher) - 90 && min(r.coucher) > min(r.lever));
  if (tard.length) push("alerte", `${tard.length} séance${tard.length > 1 ? "s" : ""} finit${tard.length > 1 ? "issent" : ""} moins d'1 h 30 avant ton coucher (${r.coucher}) : ça rogne ton sommeil.`);
  const sv = sommeilVise(sem); if (sv < 420) push("info", `Sommeil visé : ${Math.floor(sv / 60)} h ${String(sv % 60).padStart(2, "0")}. C'est court : la récupération en pâtit.`);
  return out;
}

// ---------- « Je ne peux pas » ----------
// seance : { titre, dur, lieu, patterns } ; date : le jour prévu. ctx : { aujourdhui, now ({date,min}), autres ([{date, patterns, titre}]), faites ([{date, patterns}]), busy }
// Renvoie jusqu'à 3 propositions (le plus tôt possible, récupération respectée) ; sinon une version courte, ou la fusion avec la séance suivante.
export function jeNePeuxPas(sem, date, seance, { aujourdhui, now = null, autres = [], faites = [], busy = [], horizon = 7 } = {}) {
  const s = normaliser(sem), debut = date > aujourdhui ? date : aujourdhui, cible = cibleHoraire(s);
  const dates = Array.from({ length: horizon + 1 }, (_, i) => addJ(debut, i)).filter(d => d !== date);
  const voisines = [...faites, ...autres.filter(x => x.date !== date)];
  const apresDe = (d) => now && now.date === d ? arrondi(now.min + 30, 1) : 0;
  // Récupération : aucune séance voisine (déjà faite ou prévue) ne sollicite les mêmes patterns à moins de 48 h (72 h charnière lourde) ; sans patterns connus, un jour de repos au moins
  const ok = (d) => !manquesRecuperation([...voisines, { date: d, patterns: seance.patterns }]).some(m => m.a === d || m.b === d);
  const occupe = (d) => autres.some(x => x.date === d);
  const propositions = [];
  for (const d of dates) {
    if (occupe(d)) continue;
    const p = placerLe(s, d, seance.dur, { lieu: seance.lieu, busy, apres: apresDe(d), cible });
    if (!p || !ok(d)) continue;
    const delai = ecartJours(date, d);
    propositions.push({ date: d, debut: p.debut, fin: p.fin, delai, raison: raisonCreneau(d, voisines, seance) });
    if (propositions.length === 3) break;
  }
  const res = { propositions, courte: null, fusion: null };
  if (propositions.length) return res;
  // Version courte (20 min) dans les 3 prochains jours, sur un jour où la récupération tient
  for (const d of dates.slice(0, 4)) { if (occupe(d) || !ok(d)) continue; const p = placerLe(s, d, 20, { lieu: seance.lieu, busy, apres: apresDe(d), cible }); if (p) { res.courte = { date: d, debut: p.debut, fin: p.fin, dur: 20 }; break; } }
  // Fusion avec la prochaine séance prévue (dans les 4 jours) : une seule séance prioritaire
  const suivante = autres.filter(x => ecartJours(date, x.date) > 0 && ecartJours(date, x.date) <= 4).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (suivante) res.fusion = { date: suivante.date, titre: suivante.titre };
  return res;
}
function raisonCreneau(d, voisines, seance) {
  const avant = voisines.filter(v => v.date < d).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (avant) { const h = ecartJours(avant.date, d) * 24; return `${h} h après ta séance du ${avant.date.slice(8)}/${avant.date.slice(5, 7)}`; }
  return "créneau libre, récupération respectée";
}

// ---------- Vers l'agenda existant ----------
// Semaine type : au format de S().schedule ({ days: [{ on, time, dur, place }] }) lu par engine.js
export function versSchedule(plan, ancien = null) {
  const days = Array.from({ length: 7 }, (_, i) => { const old = ancien?.days?.[i] || {}; return { on: false, time: old.time || null, dur: old.dur || 60, place: old.place || null }; });
  plan.affectations.forEach(a => { days[a.dow] = { on: true, time: hhmm(a.debut), dur: a.fin - a.debut, place: a.lieu || null }; });
  return { days };
}
