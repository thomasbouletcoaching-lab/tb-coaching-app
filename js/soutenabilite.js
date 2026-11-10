// Score de soutenabilité : « Est-ce que ça tient dans ta vie ? » (créateur de programme, étape 6). Module pur : testé par
// `node --test tests/soutenabilite.test.mjs`. Spécification : page Notion « SPEC : Créateur de programme individualisé », §8.
//
// Cinq ingrédients, chacun noté de 0 (très risqué) à 100 (très tenable), puis pondérés :
//   1. le TEMPS demandé par rapport au temps libre réel (la part de marge consommée) ;
//   2. la CHARGE de la semaine par rapport à la capacité estimée (sommeil, stress, travail physique, enfants en bas âge) ;
//   3. le SAUT par rapport à l'activité actuelle (passer de 0 à 5 séances = risque élevé) ;
//   4. l'HISTORIQUE d'abandon (nombre de reprises, durée avant l'arrêt) ;
//   5. l'ÉCART entre les séances du plan et celles jugées réalistes par la personne.
// Résultat : Tenable / Ambitieux / Trop ambitieux. Les formulations restent positives : on ne juge pas la personne, on juge le plan.
// Les seuils sont des points de départ (spec : « Terrain ou hypothèse »), réunis ici pour être ajustés avec les données des clients.

export const VERSION = 1;
export const NIVEAUX = { tenable: { id: "tenable", nom: "Tenable", rang: 1 }, ambitieux: { id: "ambitieux", nom: "Ambitieux", rang: 2 }, trop: { id: "trop", nom: "Trop ambitieux", rang: 3 } };
export const SEUILS = { tenable: 72, ambitieux: 50 };          // score ≥ 72 : tenable ; ≥ 50 : ambitieux ; en dessous : trop ambitieux
export const POIDS = { temps: 0.25, charge: 0.25, saut: 0.20, historique: 0.15, ecart: 0.15 };
// Capacité de charge hebdomadaire (somme des indices de séance ÷ 100) selon le niveau, avant ajustement de la vie
export const CAPACITE = { debutant: 1.5, regulier: 2.4, avance: 3.2 };
// Ce qui rogne la capacité (points sur 100)
export const VIE = { sommeil: { "5": 25, "6.5": 10, "7.5": 0, "8.5": 0 }, stress: { high: 20, mid: 5, low: 0 }, travailPhysique: 15, enfants: 10, plancher: 40 };
// Temps libre « utile » : on ne compte pas plus de 5 h libres par jour (le reste, c'est la vie), et seulement 60 % de ce temps.
// Sans « Ma semaine » remplie, on retombe sur une estimation moyenne, ajustée par la capacité de vie (enfants, travail physique, stress).
export const LIBRE = { capJour: 300, part: 0.6, estime: 1260 };
export const libreUtile = (libreParJour) => Math.round(libreParJour.reduce((t, m) => t + Math.min(Math.max(m, 0), LIBRE.capJour), 0) * LIBRE.part);
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const interp = (x, pts) => { // pts : [[x, y], ...] croissant en x
  if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return pts.at(-1)[1];
};
const pc = (x) => Math.round(x * 100);
const niveauParScore = (s) => s >= SEUILS.tenable ? NIVEAUX.tenable : s >= SEUILS.ambitieux ? NIVEAUX.ambitieux : NIVEAUX.trop;

// ---------- Ce qu'on sait de la personne ----------
export const niveauDe = (a = {}) => ({ beginner: "debutant", comeback: "debutant", regular: "regulier", advanced: "avance" })[a.level] || "regulier";
// Capacité de vie (0 à 100) : 100 = rien ne pèse sur la récupération
export function capaciteVie(a = {}) {
  let c = 100; const raisons = [];
  const so = VIE.sommeil[String(a.sleep)] || 0; if (so) { c -= so; raisons.push(a.sleep === "5" ? "sommeil court" : "sommeil un peu court"); }
  const st = VIE.stress[a.stress] || 0; if (st) { c -= st; raisons.push(a.stress === "high" ? "stress élevé" : "un peu de stress"); }
  if (a.work === "physical") { c -= VIE.travailPhysique; raisons.push("travail physique"); }
  if (a.kids === "yes") { c -= VIE.enfants; raisons.push("enfants en bas âge"); }
  return { valeur: Math.max(VIE.plancher, c), raisons };
}
// Séances par semaine « d'aujourd'hui » : la moyenne récente si on la connaît, sinon une estimation selon le niveau déclaré
export function activiteActuelle(a = {}, recent = null) {
  if (recent && recent.length >= 2) { const m = recent.reduce((t, x) => t + x, 0) / recent.length; return { seances: Math.round(m * 10) / 10, source: "mesure" }; }
  return { seances: { beginner: 0, comeback: 0.5, regular: 3, advanced: 4 }[a.level] ?? 2, source: "declare" };
}

// ---------- Les cinq ingrédients ----------
// plan : { n, seances: [{ minutes, score }] } ; ctx : { answers, libre (minutes libres par semaine, ou null), trajet (minutes aller), actuel (séances/semaine ou null) }
export function ingredients(plan, ctx = {}) {
  const a = ctx.answers || {}, n = plan.n, minutes = plan.seances.reduce((t, s) => t + s.minutes, 0), out = {};
  // 1. Temps
  const trajet = (ctx.trajet || 0) * 2 * n, demande = minutes + trajet, vie0 = capaciteVie(a);
  const mesure = ctx.libre > 0, libre = mesure ? ctx.libre : Math.round(LIBRE.estime * (0.6 + 0.4 * vie0.valeur / 100)), r = demande / libre;
  out.temps = { score: interp(r, [[0.15, 100], [0.30, 70], [0.45, 40], [0.65, 12], [1, 3]]), ratio: r, demande, libre, confiance: mesure ? "mesuré" : "estimé",
    detail: (r <= 0.3 ? `Tes séances (${demande} min par semaine, trajets compris) prennent ${pc(r)} % de ton temps libre utile : il reste de la marge.` : r <= 0.45 ? `Tes séances prennent ${pc(r)} % de ton temps libre utile : c'est une part importante.` : `Tes séances prennent ${pc(r)} % de ton temps libre utile : très peu de marge pour un imprévu.`) + (mesure ? "" : " Remplis « Ma semaine » pour que je compare à ton temps libre réel.") };
  // 2. Charge de la semaine / capacité
  const charge = plan.seances.reduce((t, s) => t + s.score, 0) / 100, vie = capaciteVie(a), cap = CAPACITE[niveauDe(a)] * vie.valeur / 100, rc = cap ? charge / cap : 9;
  out.charge = { score: interp(rc, [[0.8, 100], [1.0, 85], [1.2, 60], [1.5, 30], [2.0, 5]]), ratio: rc, charge: Math.round(charge * 10) / 10, capacite: Math.round(cap * 10) / 10,
    detail: rc <= 1 ? `La charge de ta semaine est à ta portée${vie.raisons.length ? ` (en tenant compte de : ${vie.raisons.join(", ")})` : ""}.` : rc <= 1.3 ? `La charge de ta semaine est un peu haute pour ta récupération${vie.raisons.length ? ` (${vie.raisons.join(", ")})` : ""}.` : `La charge de ta semaine dépasse ce que ta récupération peut absorber${vie.raisons.length ? ` (${vie.raisons.join(", ")})` : ""}.` };
  // 3. Saut par rapport à l'activité actuelle
  const act = activiteActuelle(a, ctx.actuel), saut = n - act.seances;
  out.saut = { score: interp(saut, [[2, 100], [3, 80], [4, 50], [5, 15]]), saut, actuel: act.seances, source: act.source,
    detail: saut <= 2 ? `Passer à ${n} séance${n > 1 ? "s" : ""} par semaine est une marche raisonnable.` : saut <= 3 ? `Passer de ${act.seances} à ${n} séances par semaine : une marche à franchir, mieux vaut la monter par étapes.` : `Passer de ${act.seances} à ${n} séances par semaine d'un coup est une très grande marche : le corps et l'emploi du temps ont besoin de temps.` };
  // 4. Historique d'abandon
  const q = a.quits; let h, dh;
  if (q == null) { h = 75; dh = "Je ne connais pas ton historique : réponds au questionnaire avancé pour affiner."; }
  else { h = { "0": 100, "1": 80, "3": 55, "5": 35 }[String(q)] ?? 75;
    const court = ["2", "5"].includes(String(a.quitAfter)); if (court && n >= 4 && h < 100) h -= 10;
    dh = h >= 100 ? "Tu n'as pas d'arrêt derrière toi : bon point de départ." : h >= 75 ? "Un arrêt derrière toi : rien d'inquiétant, on garde un plan souple." : `Tu as repris plusieurs fois${court ? ", souvent après quelques semaines" : ""} : c'est précisément pour ça qu'on vise un plan qu'on tient.`; }
  out.historique = { score: clamp(h), detail: dh, connu: q != null };
  // 5. Écart avec le réaliste
  const reel = +a.daysReal || n, ecartPlan = n - reel;
  out.ecart = { score: ecartPlan <= 0 ? 100 : interp(ecartPlan, [[0, 100], [1, 60], [2, 30], [3, 10]]), ecartPlan,
    detail: ecartPlan <= 0 ? (+a.daysWanted > reel ? `Tu aimerais ${a.daysWanted} séances mais en tiens ${reel} : le plan part de ce que tu tiens.` : `Le plan reste dans ce que tu juges réaliste (${reel} séance${reel > 1 ? "s" : ""}).`) : `Ce plan compte ${n} séances alors que tu en juges ${reel} réalistes.` };
  return out;
}

// ---------- Le score ----------
export function evaluer(plan, ctx = {}) {
  const ing = ingredients(plan, ctx);
  const score = Math.round(Object.entries(POIDS).reduce((t, [k, w]) => t + w * ing[k].score, 0));
  let niveau = niveauParScore(score);
  // Garde-fous : un ingrédient très mauvais empêche le « tenable », un temps impossible impose « trop ambitieux »
  // Un point très faible DU PLAN (temps, charge, saut, écart) empêche « tenable ». L'historique, lui, décrit la personne et non le plan :
  // il pèse dans le score et dans le cumul de risques, mais ne doit pas rendre impossible toute version tenable.
  const duPlan = ["temps", "charge", "saut", "ecart"].map(k => [k, ing[k]]).sort((x, y) => x[1].score - y[1].score)[0], pire = duPlan;
  if (pire[1].score < 45 && niveau.rang < NIVEAUX.ambitieux.rang) niveau = NIVEAUX.ambitieux;
  if (Object.values(ing).filter(v => v.score <= 30).length >= 2) niveau = NIVEAUX.trop;   // deux gros risques cumulés
  if (ing.temps.score <= 10 && ing.temps.confiance === "mesuré") niveau = NIVEAUX.trop;
  const parOrdre = Object.entries(ing).map(([id, v]) => ({ id, ...v, poids: POIDS[id] })).sort((x, y) => x.score - y.score);
  return { v: VERSION, score, niveau, ingredients: ing, aTravailler: parOrdre.filter(x => x.score < 70).map(x => x.id), message: message(niveau, plan, ing), confiance: ing.temps.confiance === "mesuré" && ing.historique.connu ? "bonne" : "à affiner" };
}
function message(niveau, plan, ing) {
  const n = plan.n, k = Math.max(2, Math.min(n - 1, 3));
  if (niveau.id === "tenable") return "Ce plan tient dans ta vie : tu as de la marge, et c'est ce qui permet de continuer 12 semaines.";
  if (niveau.id === "ambitieux") return `Ce plan est ambitieux mais faisable. Pour le tenir, démarre un cran en dessous et monte quand la régularité est là.`;
  return `Ce plan vise trop haut pour ta vie actuelle. Mieux vaut ${k} séances tenues 12 semaines que ${n} pendant 3 semaines.`;
}

// ---------- Version tenable : moins de séances, plus courtes ----------
// base : { answers, prefs } ; generer(prog) -> proposition (js/generateur.js) ; planDe(prop) -> { n, seances: [{ minutes, score }] }
export const planDe = (prop) => ({ n: prop.n, seances: prop.sessions.map(s => ({ minutes: s.minutes, score: (s.indice || {}).score ?? 0 })) });
export function versionTenable(base, ctx, generer, { duree = [90, 75, 60, 45, 30], plancher = 2 } = {}) {
  const a = base.answers || {}, n0 = Math.max(1, Math.min(6, Math.min(+a.daysWanted || 3, +a.daysReal || +a.daysWanted || 3))), m0 = +a.sessionMin || 60;
  const durees = [...new Set([m0, ...duree.filter(d => d < m0)])].sort((x, y) => y - x), essais = [];
  for (let k = n0; k >= Math.min(plancher, n0); k--) for (const m of durees) {
    const prog = { ...base, answers: { ...a, daysWanted: k, daysReal: k, sessionMin: m } }, prop = generer(prog), ev = evaluer(planDe(prop), { ...ctx, answers: prog.answers });
    essais.push({ seances: k, minutes: m, volume: k * m, prop, evaluation: ev, answers: { daysWanted: k, daysReal: k, sessionMin: m } });
  }
  const bons = essais.filter(e => e.evaluation.niveau.id === "tenable");
  // On garde le plus de séances possible, puis les séances les plus longues, parmi les plans tenables
  const choisi = (bons.length ? bons : essais).sort((x, y) => bons.length ? (y.volume - x.volume) || (y.seances - x.seances) : y.evaluation.score - x.evaluation.score)[0];
  return { ...choisi, tenable: choisi.evaluation.niveau.id === "tenable", essais: essais.length };
}

// ---------- Montée progressive : démarrer sous la cible, monter quand la régularité est prouvée ----------
// Séances de départ : on ne démarre pas à pleine cible quand la marche est grande, quand les arrêts passés sont nombreux ou pour un plan « sous capacité ».
export function depart(cible, a = {}, actuel = null) {
  const act = activiteActuelle(a, actuel).seances, saut = cible - act, prudent = ["3", "5"].includes(String(a.quits)) || (+a.daysWanted || cible) - (+a.daysReal || cible) >= 2;
  if (cible <= 2) return cible;
  if (saut >= 3 || prudent) return Math.max(2, Math.min(cible - 1, Math.round(act) + 1 || 2));
  if (saut > 2) return cible - 1;
  return cible;
}
export function paliers(cible, depart0, { semaines = 3, seuil = 0.9 } = {}) {
  const out = []; for (let k = depart0; k <= cible; k++) out.push({ seances: k, condition: k < cible ? `${semaines} semaines à ${Math.round(seuil * 100)} % des séances faites` : "objectif" });
  return out;
}
// semaines : [{ prevu, fait }] des dernières semaines COMPLÈTES, de la plus ancienne à la plus récente
export function regulariteProuvee(semaines, { semaines: nb = 3, seuil = 0.9 } = {}) {
  const r = (semaines || []).slice(-nb);
  if (r.length < nb) return { ok: false, tenues: r.filter(s => s.prevu > 0 && s.fait / s.prevu >= seuil).length, besoin: nb, raison: `encore ${nb - r.length} semaine${nb - r.length > 1 ? "s" : ""} pour juger` };
  const tenues = r.filter(s => s.prevu > 0 && s.fait / s.prevu >= seuil).length;
  return { ok: tenues === nb, tenues, besoin: nb, raison: tenues === nb ? `${nb} semaines d'affilée à ${Math.round(seuil * 100)} % ou plus` : `${tenues} semaine${tenues > 1 ? "s" : ""} sur ${nb} au niveau voulu` };
}

// ---------- Adéquation du plan à l'objectif (spec §8.1) : plan juste, pas seulement tenable ----------
const LIFTS = [["PH", /d[ée]velopp[ée] couch[ée]|bench/i], ["PV", /d[ée]velopp[ée] militaire|overhead|\bohp\b/i], ["TV", /traction|pull-?up/i], ["TH", /rowing/i], ["CH", /soulev[ée] de terre|deadlift|hip thrust/i], ["SG", /squat/i], ["SH", /squat/i]];
const NOM_PATTERN = { PH: "développé couché", PV: "développé militaire", TH: "rowing", TV: "tractions", SG: "squat", SH: "squat", CH: "soulevé de terre" };
const freq = (prop, code) => prop.sessions.filter(s => s.items.some(l => l.couche === "squelette" && l.pattern === code)).length;
export function controlesObjectif(prop, a = {}) {
  const out = [], push = (niveau, texte) => out.push({ niveau, texte }), n = prop.n, g = a.goal;
  if (g === "strength") {
    const cible = String(a.target || ""), cites = LIFTS.filter(([, re]) => re.test(cible)).map(([c]) => c);
    const faibles = cites.filter(c => freq(prop, c) < 2 && n >= 2);
    if (faibles.length) { const c = faibles[0], f = freq(prop, c); push("alerte", `Tu vises la force au ${NOM_PATTERN[c]} mais tu ne fais ${f === 1 ? "qu'une séance" : "aucune séance"} de ${c} par semaine. Deux séances par semaine font progresser plus vite.`); }
    else if (n >= 3 && freq(prop, "PH") < 2) push("info", "Pour la force, deux séances par semaine sur le développé couché (PH) font progresser plus vite.");
    else push("ok", "Objectif force : tes mouvements principaux reviennent assez souvent dans la semaine.");
  } else if (["muscle", "recomp"].includes(g)) {
    const pr = Object.entries(prop.semaine).filter(([, v]) => v.why?.some(w => /priorité|point faible/.test(w)));
    if (pr.length) push("ok", `Objectif muscle : volume renforcé sur ${pr.map(([c]) => c).join(", ")}, comme tu l'as demandé.`);
    if (prop.sessions.every(s => s.items.every(l => l.couche !== "isolation")) && prop.sessions.some(s => s.minutes >= 55)) push("info", "Objectif muscle : aucune isolation dans la semaine. Elle viendra dès qu'il y aura du temps.");
  } else if (["fat"].includes(g)) {
    push("ok", "Perte de gras : tout le squelette est gardé pour conserver ton muscle, sans excès de cardio.");
    if (n >= 5) push("info", "Cinq séances ou plus en déficit calorique : surveille ta récupération.");
    push("info", "Associe-le à un léger déficit calorique (onglet Nutrition) : c'est lui qui fait perdre du gras.");
  } else if (g === "health") {
    push("ok", "Santé : les 8 catégories de mouvements, un volume modéré, avec du cardio facile en complément.");
  } else if (g === "sport") {
    const mod = prop.sessions.some(s => s.items.some(l => l.couche === "module" && ["unilateral", "rotation"].includes(l.categorie)));
    push(mod ? "ok" : "info", mod ? "Sport : du travail sur une jambe et en anti-rotation est inclus." : "Sport : ajoute du travail sur une jambe (fentes, step-up) quand tu as du temps.");
  } else if (g === "restart") {
    const dur = prop.sessions.some(s => s.items.some(l => l.rpe && l.rpe > 7.5));
    push(!dur && n <= 3 ? "ok" : "info", !dur && n <= 3 ? "Reprise : peu de séances, des efforts modérés, on monte ensuite." : "Reprise : pars doucement, les premières semaines servent à retrouver le rythme.");
  }
  return out.slice(0, 3);
}
