// Questionnaire « Mon programme sur mesure » (créateur de programme, étape 2). Module pur, testé par `node --test tests/programme.test.mjs`.
// Partie courte (gratuite) : objectif, niveau, matériel, séances voulues et réalistes, durée, gênes, style.
// Partie avancée (Premium) : priorités, points faibles, anatomie, historique d'abandon, contexte de vie, exercices favoris.
import { alternatives, exercices, ZONES } from "./exercices.js";

export const VERSION = 1;
export const GOALS = [["fat", "Perdre du gras"], ["muscle", "Prendre du muscle"], ["recomp", "Perdre du gras et prendre du muscle"], ["strength", "Gagner en force"], ["health", "Santé, énergie, longévité"], ["sport", "Préparer un sport"], ["restart", "Reprendre en douceur après une longue pause"]];
export const MATERIEL_Q = [["salle_complete", "Salle complète"], ["salle_basique", "Salle basique (type Basic-Fit)"], ["halteres_maison", "Haltères et banc à la maison"], ["poids_du_corps", "Poids du corps, sans matériel"], ["barre_traction", "Barre de traction"], ["elastique", "Élastiques"]];
export const MUSCLE_GROUPS = [["pecs", "Pecs"], ["dos", "Dos"], ["epaules", "Épaules"], ["bras", "Bras"], ["quadriceps", "Quadriceps"], ["ischios", "Ischios"], ["fessiers", "Fessiers"], ["mollets", "Mollets"], ["abdos", "Abdos"]];
export const PATTERN_Q = [["PH", "Pousser devant moi (développé couché, pompes)"], ["PV", "Pousser au-dessus de la tête (développé militaire)"], ["TH", "Tirer vers moi (rowing)"], ["TV", "Tirer vers le bas (tractions, tirage)"], ["SG", "Squat sur les cuisses (hack squat, fentes courtes)"], ["SH", "Squat sur les hanches (low bar, presse pieds hauts)"], ["CH", "Soulevés et fessiers (soulevé de terre, hip thrust)"], ["FG", "Arrière de cuisse (leg curl, Nordic)"]];
export const QUIT_WHY = [["temps", "Manque de temps"], ["motivation", "La motivation est partie"], ["douleur", "Une douleur ou une blessure"], ["famille", "Vie de famille, travail"], ["resultats", "Résultats trop lents"], ["perfectionnisme", "Une séance ratée, et tout s'arrête"]];

const ZQ = ZONES.map(([v, l]) => [v, l]);
const nb = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, `${a + i} séance${a + i > 1 ? "s" : ""}`]);

// Une question par écran. type : single | multi | text. section : court (gratuit) | avance (Premium).
export const QUESTIONS = [
  { id: "goal", section: "court", type: "single", q: "Quel est ton <span class=\"k\">objectif principal</span> ?", opts: GOALS },
  { id: "goal2", section: "court", type: "single", q: "Et un <span class=\"k\">objectif secondaire</span> ?", sub: "Un seul, au maximum. Tu peux passer.", opts: [["none", "Aucun, je me concentre sur le premier"], ...GOALS] },
  { id: "target", section: "court", type: "text", q: "Un <span class=\"k\">objectif chiffré et daté</span> ?", sub: "Facultatif. Par exemple « -8 kg d'ici juin » ou « 100 kg au développé couché ».", ph: "Ton objectif", optional: true },
  { id: "level", section: "court", type: "single", q: "Où en es-tu <span class=\"k\">aujourd'hui</span> ?", opts: [["beginner", "Je débute"], ["comeback", "Je reprends après une pause"], ["regular", "Je m'entraîne régulièrement"], ["advanced", "Je m'entraîne depuis plus de 2 ans"]] },
  { id: "materiel", section: "court", type: "multi", q: "De quel <span class=\"k\">matériel</span> disposes-tu ?", sub: "Coche tout ce que tu as. Les exercices proposés en tiendront compte.", opts: MATERIEL_Q, min: 1 },
  { id: "daysWanted", section: "court", type: "single", q: "Combien de <span class=\"k\">séances par semaine</span> aimerais-tu faire ?", opts: nb(2, 6) },
  { id: "daysReal", section: "court", type: "single", q: "Et combien en <span class=\"k\">tiens-tu vraiment</span>, même les semaines chargées ?", sub: "Sois honnête : mieux vaut 3 séances tenues 12 semaines que 5 pendant 3 semaines.", opts: nb(1, 6) },
  { id: "sessionMin", section: "court", type: "single", q: "Combien de <span class=\"k\">temps par séance</span> au maximum ?", sub: "Échauffement compris, sans le trajet.", opts: [[20, "20 minutes"], [30, "30 minutes"], [45, "45 minutes"], [60, "1 heure"], [75, "1 h 15"], [90, "1 h 30 ou plus"]] },
  { id: "zones", section: "court", type: "multi", q: "Une <span class=\"k\">gêne</span> à une zone en ce moment ?", sub: "Ces zones servent uniquement à écarter les exercices qui pourraient gêner. Rien de coché : aucune gêne. En cas de douleur aiguë ou de blessure récente, demande l'avis d'un professionnel de santé.", opts: ZQ, min: 0 },
  { id: "style", section: "court", type: "single", q: "Ton <span class=\"k\">style</span> de séances préféré ?", opts: [["fullbody", "Corps entier à chaque séance"], ["hautbas", "Haut du corps / bas du corps"], ["ppl", "Pousser / tirer / jambes"], ["any", "Peu importe, choisis pour moi"]] },
  // ---- Partie avancée (Premium) ----
  { id: "priorities", section: "avance", type: "multi", q: "Quels <span class=\"k\">muscles</span> veux-tu mettre en avant ?", sub: "Trois au maximum.", opts: MUSCLE_GROUPS, min: 0, max: 3 },
  { id: "weak", section: "avance", type: "multi", q: "Quels mouvements te paraissent <span class=\"k\">faibles ou bloquent</span> ?", sub: "Ceux qui stagnent, ou que tu évites. Trois au maximum.", opts: PATTERN_Q, min: 0, max: 3 },
  { id: "torso", section: "avance", type: "single", q: "En squat, ton <span class=\"k\">buste penche-t-il</span> beaucoup ?", sub: "Ça oriente le choix des variantes de squat.", opts: [["lot", "Oui, beaucoup vers l'avant"], ["little", "Non, il reste plutôt droit"], ["unknown", "Je ne sais pas"]] },
  { id: "ankle", section: "avance", type: "single", q: "<span class=\"k\">Cheville</span> : ton genou touche-t-il le mur, pied à 10 cm ?", sub: "Test genou-mur : pied à plat, talon au sol.", opts: [["good", "Oui, facilement"], ["limited", "Non, ça bloque"], ["unknown", "Je n'ai pas testé"]] },
  { id: "shoulder", section: "avance", type: "single", q: "<span class=\"k\">Épaule</span> : bras tendus au-dessus de la tête, sans cambrer ?", opts: [["good", "Oui, sans effort"], ["limited", "Non, je cambre ou ça tire"], ["unknown", "Je n'ai pas testé"]] },
  { id: "quits", section: "avance", type: "single", q: "Combien de fois as-tu <span class=\"k\">arrêté</span> l'entraînement après l'avoir repris ?", sub: "Aucun jugement : ça sert à bâtir un plan que tu tiens.", opts: [["0", "Jamais vraiment"], ["1", "Une fois"], ["3", "2 ou 3 fois"], ["5", "Plus de 3 fois"]] },
  { id: "quitAfter", section: "avance", type: "single", q: "En général, au bout de <span class=\"k\">combien de temps</span> ?", skip: (a) => !a.quits || a.quits === "0", opts: [["2", "Moins de 3 semaines"], ["5", "3 à 6 semaines"], ["10", "6 à 12 semaines"], ["20", "Plus de 12 semaines"]] },
  { id: "quitWhy", section: "avance", type: "multi", q: "Qu'est-ce qui a <span class=\"k\">coupé l'élan</span> ?", sub: "Coche ce qui s'applique.", skip: (a) => !a.quits || a.quits === "0", opts: QUIT_WHY, min: 0 },
  { id: "sleep", section: "avance", type: "single", q: "Ton <span class=\"k\">sommeil</span> en moyenne ?", opts: [["5", "Moins de 6 h"], ["6.5", "6 à 7 h"], ["7.5", "7 à 8 h"], ["8.5", "Plus de 8 h"]] },
  { id: "stress", section: "avance", type: "single", q: "Ton niveau de <span class=\"k\">stress</span> en ce moment ?", opts: [["low", "Faible"], ["mid", "Moyen"], ["high", "Élevé"]] },
  { id: "work", section: "avance", type: "single", q: "Ton <span class=\"k\">travail</span> ?", opts: [["desk", "Surtout en position assise"], ["standing", "Debout, en mouvement"], ["physical", "Physique (chantier, manutention)"]] },
  { id: "kids", section: "avance", type: "single", q: "As-tu des <span class=\"k\">enfants en bas âge</span> ?", opts: [["no", "Non"], ["yes", "Oui"]] },
];
const BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));
export const question = (id) => BY_ID[id] || null;

// Écrans à afficher : la partie courte, puis, si Premium, la partie avancée et les exercices favoris
export function steps(answers = {}, isPremium = false) {
  const vis = QUESTIONS.filter(q => (q.section === "court" || isPremium) && !(q.skip && q.skip(answers)));
  return isPremium ? [...vis.map(q => ({ id: q.id })), { id: "favs" }] : vis.map(q => ({ id: q.id }));
}

// Une réponse est-elle valable ? (messages en français pour l'écran)
export function validate(q, value) {
  if (q.type === "text") return { ok: true, value: String(value || "").trim().slice(0, 80) || null };
  if (q.type === "multi") {
    const v = Array.isArray(value) ? value.filter(x => q.opts.some(o => String(o[0]) === String(x))) : [];
    if (q.min && v.length < q.min) return { ok: false, msg: "Choisis au moins une réponse." };
    if (q.max && v.length > q.max) return { ok: false, msg: `Trois réponses au maximum.` };
    return { ok: true, value: v };
  }
  const o = q.opts.find(x => String(x[0]) === String(value));
  return o ? { ok: true, value: o[0] } : { ok: false, msg: "Choisis une réponse." };
}

// Les zones de l'« état de santé » (anamnèse) et celles de la bibliothèque n'ont pas les mêmes noms
const ZONE_ANAMNESE = { lombaires: "bas_du_dos", epaule: "epaule", coude: "coude", poignet: "poignet", hanche: "hanche", genou: "genou", cheville: "cheville" };
export const zonesFromAnamnese = (zones = []) => [...new Set(zones.map(z => ZONE_ANAMNESE[z]).filter(Boolean))];

// Contraintes à passer à alternatives() : matériel, zones gênées, exercices détestés
export function contraintes(prog) {
  const a = prog?.answers || {}, prefs = prog?.prefs || {};
  return {
    materiel: Array.isArray(a.materiel) ? a.materiel : [],
    contreIndications: Array.isArray(a.zones) ? a.zones : [],
    exclure: Object.keys(prefs).filter(s => prefs[s] === "hate"),
  };
}
// Bouton « remplacer » : les alternatives d'un exercice, adaptées à la personne. Ses favoris passent en premier.
export function alternativesPour(x, prog) {
  const list = alternatives(x, contraintes(prog)), prefs = prog?.prefs || {};
  return [...list.filter(e => prefs[e.slug] === "love"), ...list.filter(e => prefs[e.slug] !== "love")];
}

// Exercices du squelette qu'on peut proposer à noter : faisables avec son matériel et sans gêne
export function aNoter(prog, rows = exercices()) {
  const c = contraintes(prog), out = {};
  rows.filter(e => e.actif && e.couche === "squelette")
    .filter(e => !c.materiel.length || e.materiel.some(m => c.materiel.includes(m)))
    .filter(e => !e.contre_indications.some(z => c.contreIndications.includes(z)))
    .forEach(e => { (out[e.pattern_principal] = out[e.pattern_principal] || []).push(e); });
  return out;
}

// Note « j'adore » / « je déteste » ; « neutre » = pas de note
export function noter(prefs = {}, slug, note) {
  const p = { ...prefs };
  if (note === "love" || note === "hate") p[slug] = note; else delete p[slug];
  return p;
}

// Écart entre séances voulues et réalistes : sert de base au futur score de soutenabilité
export const joursRetenus = (a = {}) => Math.min(+a.daysWanted || 0, +a.daysReal || +a.daysWanted || 0) || null;
export const ecartSeances = (a = {}) => (+a.daysWanted || 0) - (+a.daysReal || +a.daysWanted || 0);

// Ce que la personne a rempli (pour l'écran de fin et la fiche du coach)
export function resume(prog) {
  const a = prog?.answers || {}, lab = (id, v) => { const o = BY_ID[id]?.opts?.find(x => String(x[0]) === String(v)); return o ? o[1] : v; };
  const labs = (id, vs = []) => vs.map(v => lab(id, v)).join(", ");
  const rows = [];
  if (a.goal) rows.push(["Objectif", lab("goal", a.goal) + (a.goal2 && a.goal2 !== "none" ? ` · puis ${lab("goal", a.goal2).toLowerCase()}` : "")]);
  if (a.target) rows.push(["Cible", a.target]);
  if (a.level) rows.push(["Niveau", lab("level", a.level)]);
  if (a.materiel?.length) rows.push(["Matériel", labs("materiel", a.materiel)]);
  if (a.daysWanted) rows.push(["Séances", `${a.daysWanted} voulues · ${a.daysReal || a.daysWanted} tenables`]);
  if (a.sessionMin) rows.push(["Durée max", `${a.sessionMin} min`]);
  rows.push(["Gênes", a.zones?.length ? a.zones.map(z => ZONES.find(x => x[0] === z)?.[1] || z).join(", ") : "Aucune"]);
  if (a.style) rows.push(["Style", lab("style", a.style)]);
  if (a.priorities?.length) rows.push(["Priorités", labs("priorities", a.priorities)]);
  if (a.weak?.length) rows.push(["Points faibles", a.weak.join(", ")]);
  if (a.torso || a.ankle || a.shoulder) rows.push(["Anatomie", [a.torso && `buste : ${lab("torso", a.torso).toLowerCase()}`, a.ankle && `cheville : ${lab("ankle", a.ankle).toLowerCase()}`, a.shoulder && `épaule : ${lab("shoulder", a.shoulder).toLowerCase()}`].filter(Boolean).join(" · ")]);
  if (a.quits != null) rows.push(["Arrêts passés", a.quits === "0" ? "Aucun" : `${lab("quits", a.quits)}${a.quitAfter ? ` · après ${lab("quitAfter", a.quitAfter).toLowerCase()}` : ""}${a.quitWhy?.length ? ` · ${labs("quitWhy", a.quitWhy).toLowerCase()}` : ""}`]);
  const p = prog?.prefs || {}, love = Object.keys(p).filter(s => p[s] === "love").length, hate = Object.keys(p).filter(s => p[s] === "hate").length;
  if (love || hate) rows.push(["Exercices", `${love} adoré${love > 1 ? "s" : ""} · ${hate} détesté${hate > 1 ? "s" : ""}`]);
  return rows;
}

// Ce qui part chez le coach avec l'instantané. Les gênes (donnée de santé) ne partent qu'avec le consentement de l'anamnèse.
export function pourCoach(prog, consent = false) {
  if (!prog?.answers) return null;
  const { zones, ...reste } = prog.answers;
  return { v: prog.v || VERSION, at: prog.at, answers: consent ? { ...reste, zones } : reste, prefs: prog.prefs || {} };
}
