// Détection des profils (créateur de programme, étape 8). Module pur : testé par `node --test tests/profils.test.mjs`.
// Spécification : page Notion « SPEC : Créateur de programme individualisé », §9.
//
// Un profil n'est pas une case unique : une personne peut en cumuler plusieurs. Les profils sont MONTRÉS au membre et
// formulés en positif (« Reprise durable », jamais « yoyo »). Ils adaptent des réglages (plancher, séances courtes, plans de secours),
// rien de plus : aucun profil ne change les données ni n'ouvre ou ferme une fonction.
//
// Le parcours « reprise durable » (§9.5) : plan sous la capacité, plancher minimum, mode « On reprend » après deux séances manquées,
// total des séances qui ne baisse jamais, plans « si… alors… » rédigés à l'avance.
// Seuils et règles : points de départ (spec : « Terrain ou hypothèse »), réunis ici pour être ajustés.

export const VERSION = 1;

// Catalogue : nom montré au membre, phrase positive, réglages appliqués
export const CATALOGUE = {
  depart: { nom: "Départ en confiance", phrase: "Tu démarres : on apprend les mouvements avant de charger." },
  reprise: { nom: "Reprise en douceur", phrase: "Tu reviens après une pause : on retrouve le rythme avant de monter les charges." },
  durable: { nom: "Reprise durable", phrase: "Tu sais revenir : on bâtit un plan que tu tiens, avec un minimum pour les semaines difficiles." },
  progression: { nom: "Progression méthodique", phrase: "Tes charges ont besoin d'un nouveau stimulus : on met en avant les mouvements qui progressent le moins." },
  maitrise: { nom: "Précision et maîtrise", phrase: "Tu t'entraînes depuis longtemps : on travaille la technique et la gestion de la fatigue." },
  competition: { nom: "Objectif compétition", phrase: "Tu vises une performance : le squelette reste, les mouvements de force passent en premier." },
  silhouette: { nom: "Silhouette en vue", phrase: "Ton objectif est physique : le muscle se garde, le volume reste juste." },
  forme: { nom: "Forme durable", phrase: "Tu veux de l'énergie sur la durée : des séances complètes, sans excès, avec de la mobilité." },
  organise: { nom: "Organisé et efficace", phrase: "Ton temps est précieux : des séances courtes qui gardent l'essentiel." },
  rythme: { nom: "Rythme changeant", phrase: "Ton emploi du temps bouge : on replanifie avec toi, semaine après semaine." },
  equilibre: { nom: "Équilibre de vie", phrase: "Ta vie est intense en ce moment : on protège ton sommeil et ta récupération." },
  corps: { nom: "Corps déjà sollicité", phrase: "Ton travail demande déjà beaucoup au corps : on allège le bas du corps." },
  regularite: { nom: "Régularité d'abord", phrase: "Une séance faite vaut mieux qu'une séance parfaite : on compte les séances, pas les jours exacts." },
  polyvalent: { nom: "Sportif polyvalent", phrase: "Tu pratiques un sport : le travail unilatéral et la rotation complètent ta semaine." },
};
export const MAX_AFFICHES = 4;

// Plans « si… alors… » rédigés à l'avance (§9.5 point 6), que le membre peut garder, changer ou compléter
export const SI_ALORS_DEFAUT = [
  ["Si je finis tard", "alors je fais la version de 20 minutes, à la maison"],
  ["Si je dors moins de 6 heures", "alors je garde la même séance, mais je m'arrête à RPE 7"],
  ["Si je rate deux séances", "alors je reprends par une séance courte, sans rattraper ce qui a manqué"],
];

const num = (x) => (x == null || x === "" ? null : +x);
const rangLvl = { beginner: 0, comeback: 0, regular: 1, advanced: 2 };

// ---------- Détection ----------
// a : réponses du questionnaire (programme.answers) ; ctx : { stalls (nombre), missed14 (séances loupées sur 14 jours), variables (blocs variables cette semaine), age, discipline }
export function detecter(a = {}, ctx = {}) {
  const out = [], ajoute = (id, why) => { if (!out.some(x => x.id === id)) out.push({ id, ...CATALOGUE[id], why }); };
  const quits = num(a.quits) ?? 0, quitAfter = num(a.quitAfter), age = num(ctx.age), level = a.level;
  const reprise = level === "comeback" || (quits >= 1 && rangLvl[level] === 0);

  // Historique d'arrêts : le parcours « reprise durable » (yoyo) est nommé en positif
  if (quits >= 2 || (quits >= 1 && quitAfter && quitAfter <= 5)) ajoute("durable", quits >= 2 ? "plusieurs reprises" : "arrêt rapide après une reprise");
  if (reprise && !out.some(x => x.id === "durable")) ajoute("reprise", "retour après une pause");
  if (level === "beginner") ajoute("depart", "débutant");
  if (level === "advanced") ajoute("maitrise", "plus de deux ans d'entraînement");
  if ((ctx.stalls || 0) >= 1 && rangLvl[level] >= 1) ajoute("progression", `${ctx.stalls} mouvement${ctx.stalls > 1 ? "s" : ""} qui stagne${ctx.stalls > 1 ? "nt" : ""}`);
  if (a.goal === "strength" && (/power|squat|bench|développé|soulev|compét|street/i.test(a.target || "") || ctx.discipline === "powerlifting")) ajoute("competition", "objectif de force chiffré");
  if (a.goal === "fat" || a.goal === "recomp") ajoute("silhouette", "objectif de silhouette");
  if (age >= 40 && (a.goal === "health" || a.goal === "restart")) ajoute("forme", `${age} ans, objectif santé`);
  if (a.goal === "health" && !out.some(x => x.id === "forme")) ajoute("forme", "objectif énergie et santé");
  if (a.kids === "yes" && (num(a.sessionMin) ?? 60) <= 45) ajoute("organise", "peu de temps, enfants");
  if ((ctx.variables || 0) >= 3) ajoute("rythme", "emploi du temps variable");
  if (a.stress === "high" || (num(a.sleep) != null && num(a.sleep) <= 5.5)) ajoute("equilibre", a.stress === "high" ? "stress élevé" : "sommeil court");
  if (a.work === "physical") ajoute("corps", "travail physique");
  if (a.quitWhy?.includes("perfectionnisme") || (a.quitWhy?.includes("temps") && quits >= 1)) ajoute("regularite", "arrêts après une séance ratée");
  if (a.goal === "sport") ajoute("polyvalent", "pratique sportive");
  return out.slice(0, MAX_AFFICHES);
}

// ---------- Réglages qui en découlent ----------
// Plancher : le minimum à tenir les semaines difficiles (spec §9.5 point 2)
export function plancher(profils = []) {
  const ids = profils.map(p => p.id);
  if (ids.includes("durable") || ids.includes("reprise")) return { seances: 2, minutes: 20, texte: "Deux séances de 20 minutes : c'est le minimum qui compte, même les semaines difficiles." };
  if (ids.includes("organise") || ids.includes("equilibre") || ids.includes("regularite")) return { seances: 2, minutes: 30, texte: "Deux séances de 30 minutes suffisent pour une semaine de référence." };
  return null;
}

// Mode « On reprend » : après deux séances manquées sur les 14 derniers jours, sans séance aujourd'hui
export function enReprise(ctx = {}) {
  return (ctx.missed14 || 0) >= 2 && !ctx.doneToday;
}
// Total des séances : ne baisse jamais, même si l'historique est corrigé ou une séance supprimée
export function totalSeances(nbSeances, precedent = 0) {
  return Math.max(Number(precedent) || 0, Number(nbSeances) || 0);
}

// Plans « si… alors… » : on garde ceux du membre, sinon les défauts
export function siAlorsDe(liste) {
  const ok = (liste || []).filter(x => x && x.si && x.alors).map(x => ({ si: String(x.si).trim().slice(0, 60), alors: String(x.alors).trim().slice(0, 120) }));
  return ok.length ? ok : SI_ALORS_DEFAUT.map(([si, alors]) => ({ si, alors }));
}

// Phrase qui résume les profils, positive et brève
export function resume(profils = []) {
  if (!profils.length) return "Ton profil se précisera au fil de tes séances.";
  return profils.map(p => p.nom).join(" · ");
}

// Ce qui part chez le coach : identifiants seulement (aucune réponse de santé)
export function pourCoach(profils = []) {
  return { v: VERSION, ids: profils.map(p => p.id), at: new Date().toISOString() };
}
