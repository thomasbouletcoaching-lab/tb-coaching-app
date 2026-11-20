// Armoire à trophées (décision C61) : badges, XP, niveaux, grades et animaux débloqués.
// Module pur : tout est calculé à partir de l'état du téléphone, testé par `node --test tests/armoire.test.mjs`.
// Règles : les points ne viennent jamais du poids ni du corps. Les badges « selon ton poids de corps » sont
// facultatifs (éteints par défaut) ; le poids n'est jamais affiché, seul le rapport charge / poids compte.

// ---------- Niveaux de médaille et XP ----------
export const NIVEAUX = ["bronze", "argent", "or", "platine", "diamant"];
export const XP_NIVEAU = { bronze: 25, argent: 50, or: 100, platine: 200, diamant: 400 };
export const niveauDe = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
export const xpPourNiveau = (n) => 40 * (n - 1) ** 2;
// Couleur de l'anneau autour de l'animal selon le niveau
export const anneauDe = (niveau) => niveau >= 20 ? "#4C7BF2" : niveau >= 15 ? "#5FA9B0" : niveau >= 10 ? "#E9AE00" : niveau >= 5 ? "#9AA6B6" : "#C07A45";

// ---------- Familles de badges ----------
// mesure : nom de la valeur lue dans les statistiques ; seuils : un par niveau (bronze → diamant)
const kg = (n) => `${n} kg`, fois = (n) => `${String(n).replace(".", ",")} × ton poids`;
export const FAMILLES = [
  // Force (charge réelle d'une série faite, hors échauffement)
  { id: "couche", cat: "force", nom: "Développé couché", mesure: "max.couche", seuils: [40, 60, 80, 100, 140], unite: kg },
  { id: "squat", cat: "force", nom: "Squat", mesure: "max.squat", seuils: [60, 80, 100, 140, 180], unite: kg },
  { id: "terre", cat: "force", nom: "Soulevé de terre", mesure: "max.terre", seuils: [60, 100, 140, 180, 220], unite: kg },
  { id: "militaire", cat: "force", nom: "Développé militaire", mesure: "max.militaire", seuils: [30, 40, 60, 80, 100], unite: kg },
  { id: "traction-lestee", cat: "force", nom: "Traction lestée", mesure: "max.tractionLestee", seuils: [10, 20, 30, 40, 50], unite: (n) => `+${n} kg` },
  // Force selon le poids de corps (facultatif)
  { id: "couche-relatif", cat: "relatif", nom: "Couché selon ton poids", mesure: "rel.couche", seuils: [0.5, 0.75, 1, 1.25, 1.5], unite: fois, poids: true },
  { id: "squat-relatif", cat: "relatif", nom: "Squat selon ton poids", mesure: "rel.squat", seuils: [0.75, 1, 1.5, 2, 2.5], unite: fois, poids: true },
  { id: "terre-relatif", cat: "relatif", nom: "Soulevé de terre selon ton poids", mesure: "rel.terre", seuils: [1, 1.5, 2, 2.5, 3], unite: fois, poids: true },
  { id: "militaire-relatif", cat: "relatif", nom: "Militaire selon ton poids", mesure: "rel.militaire", seuils: [0.4, 0.5, 0.75, 1, 1.2], unite: fois, poids: true },
  // Calisthénie (répétitions dans une seule série)
  { id: "tractions", cat: "calisthenie", nom: "Tractions d'affilée", mesure: "reps.tractions", seuils: [1, 5, 10, 15, 20], unite: (n) => `${n} rép.` },
  { id: "pompes", cat: "calisthenie", nom: "Pompes d'affilée", mesure: "reps.pompes", seuils: [10, 20, 30, 40, 50], unite: (n) => `${n} rép.` },
  { id: "dips", cat: "calisthenie", nom: "Dips d'affilée", mesure: "reps.dips", seuils: [5, 10, 15, 20, 30], unite: (n) => `${n} rép.` },
  // Course
  { id: "sorties", cat: "course", nom: "Sorties de course", mesure: "course.sorties", seuils: [1, 10, 25, 50, 100], unite: (n) => `${n} sortie${n > 1 ? "s" : ""}` },
  { id: "heures-course", cat: "course", nom: "Heures de course", mesure: "course.heures", seuils: [5, 20, 50, 100, 200], unite: (n) => `${n} h` },
  { id: "sortie-longue", cat: "course", nom: "Sortie longue", mesure: "course.plusLongue", seuils: [30, 45, 60, 90, 120], unite: (n) => `${n} min d'affilée` },
  // Régularité
  { id: "seances", cat: "regularite", nom: "Séances faites", mesure: "reg.seances", seuils: [1, 10, 50, 100, 250], unite: (n) => `${n} séance${n > 1 ? "s" : ""}` },
  { id: "serie", cat: "regularite", nom: "Série de jours", mesure: "reg.serie", seuils: [3, 7, 14, 30, 100], unite: (n) => `${n} jours` },
  { id: "reprises", cat: "regularite", nom: "Reprises après un écart", mesure: "reg.reprises", seuils: [1, 3, 5, 10, 20], unite: (n) => `${n} reprise${n > 1 ? "s" : ""}` },
  { id: "proteines", cat: "nutrition", nom: "Protéines atteintes", mesure: "reg.proteines", seuils: [7, 14, 30, 60, 100], unite: (n) => `${n} jours` },
];
// Badges uniques : un skill réussi au moins une fois (série faite)
export const SKILLS = [
  { id: "muscle-up", nom: "Premier muscle-up", niveau: "or", re: /^muscle-up(?!.*(assist|négat|negat))/i, reps: 1 },
  { id: "muscle-up-5", nom: "5 muscle-ups d'affilée", niveau: "platine", re: /^muscle-up(?!.*(assist|négat|negat))/i, reps: 5 },
  { id: "front-lever-groupe", nom: "Front lever groupé (5 s)", niveau: "argent", re: /^front lever group/i, sec: 5 },
  { id: "front-lever", nom: "Front lever complet (3 s)", niveau: "diamant", re: /^front lever complet/i, sec: 3 },
  { id: "handstand", nom: "Handstand libre (10 s)", niveau: "or", re: /^(équilibre libre|handstand libre)/i, sec: 10 },
  { id: "planche-groupee", nom: "Planche groupée (5 s)", niveau: "or", re: /^(planche groupée|tuck planche)/i, sec: 5 },
  { id: "pistol", nom: "Pistol squat", niveau: "argent", re: /^pistol squat(?!.*assist)/i, reps: 1 },
  { id: "l-sit", nom: "L-sit (20 s)", niveau: "argent", re: /^l-sit/i, sec: 20 },
  { id: "hspu", nom: "Pompe en équilibre", niveau: "platine", re: /^pompes en équilibre|^handstand push-up/i, reps: 1 },
  { id: "honnete", nom: "Honnête avec soi", niveau: "argent", stat: "reg.crises", min: 1, cat: "esprit", desc: "Un « Je craque » traité sans jugement" },
];

// ---------- Lecture des exercices ----------
const LEVES = {
  couche: /^développé couché (barre|smith|prise large)(?!.*(planches|élastiques|sécurités|au sol))/i,
  squat: /^(squat barre|squat smith(?! pieds)|front squat|squat zercher)/i,
  terre: /^soulevé de terre(?! (roumain|jambes tendues|haltères|sumo kettlebell|sur blocs))/i,
  militaire: /^développé militaire (barre|assis barre|smith)/i,
};
const TRACTIONS = /^tractions?(?!.*(assist|excentrique|négativ|negativ|machine))/i, LESTEE = /^tractions?.*lest/i;
const POMPES = /^pompes(?!.*(genoux|surélevées mains|scapulaires|pike|équilibre))/i;
const DIPS = /^dips(?!.*(assist|machine|banc|chaises|négat|negat))/i;
const NON_COURSE = /vélo|velo|rameur|natation|nage|elliptique|ski/i;
const COURSE = /course|footing|jogging|running|(^|[^\p{L}])run([^\p{L}]|$)|fractionn|trail|sprint|vma/iu;
const obj = (x) => x && typeof x === "object" && !Array.isArray(x) ? x : {};
const jour = (s) => /^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : null;

// Poids notés, triés par date (lus une seule fois) ; poids le plus récent à une date (au plus 120 jours avant), sinon null
const poidsTries = (daily) => Object.entries(daily).map(([k, v]) => [k, +obj(v).weight]).filter(([k, p]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && p > 25 && p < 400).sort((a, b) => a[0] < b[0] ? -1 : 1);
function poidsA(tries, d) {
  let lo = 0, hi = tries.length - 1, i = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (tries[m][0] <= d) { i = m; lo = m + 1; } else hi = m - 1; }
  if (i < 0 || (Date.parse(d) - Date.parse(tries[i][0])) / 864e5 > 120) return null;
  return tries[i][1];
}

// Statistiques utiles aux badges. reg : chiffres de régularité déjà calculés par js/quests.js (gather)
export function stats(st = {}, reg = {}, { poids = false } = {}) {
  const daily = obj(st.daily), max = { couche: 0, squat: 0, terre: 0, militaire: 0, tractionLestee: 0 }, rel = { couche: 0, squat: 0, terre: 0, militaire: 0 };
  const tries = poids ? poidsTries(daily) : [], reps = { tractions: 0, pompes: 0, dips: 0 }, faits = new Set(), course = { sorties: 0, minutes: 0, plusLongue: 0 };
  const ajouterCourse = (min) => { if (!(min > 0)) return; course.sorties++; course.minutes += min; course.plusLongue = Math.max(course.plusLongue, min); };
  for (const w of Array.isArray(st.workouts) ? st.workouts : []) {
    const d = jour(obj(w).end || obj(w).start); if (!d) continue;
    for (const e of Array.isArray(w.exercises) ? w.exercises : []) {
      const nom = String(obj(e).name || "").trim();
      const series = (Array.isArray(obj(e).sets) ? e.sets : []).filter(s => s && s.done && s.type !== "W").map(s => ({ reps: +s.reps || 0, kg: +s.kg || 0, sec: +s.sec || 0, min: +s.min || 0 }));
      if (!series.length) continue;
      for (const [k, re] of Object.entries(LEVES)) if (re.test(nom)) {
        const m = Math.max(0, ...series.filter(s => s.reps >= 1 && s.kg < 1000).map(s => s.kg));
        max[k] = Math.max(max[k], m);
        if (poids && m > 0) { const p = poidsA(tries, d); if (p) rel[k] = Math.max(rel[k], Math.round(m / p * 100) / 100); }
      }
      if (LESTEE.test(nom)) max.tractionLestee = Math.max(max.tractionLestee, ...series.filter(s => s.reps >= 1 && s.kg < 200).map(s => s.kg));
      if (TRACTIONS.test(nom)) reps.tractions = Math.max(reps.tractions, ...series.map(s => s.reps));
      if (POMPES.test(nom)) reps.pompes = Math.max(reps.pompes, ...series.map(s => s.reps));
      if (DIPS.test(nom)) reps.dips = Math.max(reps.dips, ...series.map(s => s.reps));
      for (const sk of SKILLS) if (sk.re && sk.re.test(nom) && series.some(s => (!sk.reps || s.reps >= sk.reps) && (!sk.sec || s.sec >= sk.sec))) faits.add(sk.id);
      if (COURSE.test(nom) && !NON_COURSE.test(nom)) ajouterCourse(series.reduce((t, s) => t + (s.min || s.sec / 60), 0));
    }
  }
  for (const v of Object.values(daily)) for (const c of Array.isArray(obj(v).cardio) ? v.cardio : []) if (COURSE.test(String(obj(c).n || "")) && !NON_COURSE.test(String(obj(c).n || ""))) ajouterCourse(Math.min(+c.min || 0, 600));
  return {
    max, rel, reps, faits,
    course: { sorties: course.sorties, heures: Math.floor(course.minutes / 60), plusLongue: Math.round(course.plusLongue) },
    reg: { seances: +reg.sessions || 0, serie: +reg.streak || 0, reprises: +reg.comebacks || 0, proteines: +reg.proteinDays || 0, crises: +reg.crises || 0, points: +reg.points || 0 },
  };
}
const lire = (s, chemin) => chemin.split(".").reduce((o, k) => o?.[k], s) || 0;

// ---------- Collection ----------
// → { badges: [{ id, famille, cat, nom, niveau, ok, valeur, seuil, libelle }], familles: [...], xp, niveau, ... }
export function armoire(st = {}, reg = {}, opts = {}) {
  const poids = !!opts.poids, s = stats(st, reg, { poids });
  const badges = [], familles = [];
  for (const f of FAMILLES) {
    if (f.poids && !poids) continue;
    const v = lire(s, f.mesure);
    const lst = f.seuils.map((seuil, i) => ({ id: `${f.id}-${i + 1}`, famille: f.id, cat: f.cat, nom: f.nom, niveau: NIVEAUX[i], ok: v >= seuil, valeur: v, seuil, libelle: f.unite(seuil) }));
    badges.push(...lst);
    const faits = lst.filter(b => b.ok);
    familles.push({ ...f, valeur: v, atteint: faits.at(-1) || null, prochain: lst.find(b => !b.ok) || null, pct: lst.find(b => !b.ok) ? Math.min(99, Math.round(v / lst.find(b => !b.ok).seuil * 100)) : 100 });
  }
  for (const k of SKILLS) {
    const ok = k.stat ? lire(s, k.stat) >= k.min : s.faits.has(k.id);
    badges.push({ id: `skill-${k.id}`, famille: "skills", cat: k.cat || "skill", nom: k.nom, niveau: k.niveau, ok, libelle: k.desc || k.nom });
  }
  const obtenus = badges.filter(b => b.ok);
  // Les badges selon le poids de corps ne rapportent jamais d'XP (le poids ne doit jamais faire monter de niveau)
  const xpBadges = obtenus.reduce((t, b) => t + (b.cat === "relatif" ? 0 : XP_NIVEAU[b.niveau]), 0), xp = s.reg.points + xpBadges, niveau = niveauDe(xp);
  const base = xpPourNiveau(niveau), suivant = xpPourNiveau(niveau + 1);
  return { stats: s, badges, familles, obtenus, xp, xpBadges, niveau, pct: Math.round((xp - base) / (suivant - base) * 100), reste: suivant - xp, anneau: anneauDe(niveau) };
}

// ---------- Animaux ----------
// libre : disponible dès le début ; sinon une condition sur l'armoire
export const DEBLOCAGES = [
  { id: "renard", libre: true }, { id: "ours", libre: true }, { id: "loup", libre: true },
  { id: "taureau", txt: "Un badge de force en or", ok: (a) => a.obtenus.some(b => b.cat === "force" && NIVEAUX.indexOf(b.niveau) >= 2) },
  { id: "guepard", txt: "10 sorties de course", ok: (a) => a.stats.course.sorties >= 10 },
  { id: "gorille", txt: "3 badges de calisthénie", ok: (a) => a.obtenus.filter(b => b.cat === "calisthenie" || b.cat === "skill").length >= 3 },
  { id: "aigle", txt: "30 jours de série", ok: (a) => a.stats.reg.serie >= 30 },
  { id: "requin", txt: "50 séances", ok: (a) => a.stats.reg.seances >= 50 },
  { id: "phenix", txt: "3 reprises après un écart", ok: (a) => a.stats.reg.reprises >= 3 },
  { id: "lion", txt: "Niveau 10", ok: (a) => a.niveau >= 10 },
  { id: "tigre", txt: "Niveau 15", ok: (a) => a.niveau >= 15 },
  { id: "dragon", txt: "40 badges", ok: (a) => a.obtenus.filter(b => b.cat !== "relatif").length >= 40 },
];
export const animauxDebloques = (a) => DEBLOCAGES.filter(x => x.libre || x.ok(a)).map(x => x.id);
// Choix de la personne, ramené à un animal débloqué ; badges épinglés : 3 au plus, obtenus
export function profilArmoire(p = {}, a) {
  const deb = animauxDebloques(a), ok = new Set(a.obtenus.filter(b => b.cat !== "relatif").map(b => b.id)); // badges selon le poids : jamais épinglés (le profil part sur le serveur)
  const animal = deb.includes(p.animal) ? p.animal : "renard";
  const epingles = (Array.isArray(p.epingles) ? p.epingles : []).filter((id, i, l) => ok.has(id) && l.indexOf(id) === i).slice(0, 3);
  return { animal, epingles };
}
// Nouveaux badges depuis la dernière visite (pour la fête), en comparant aux identifiants déjà vus
export const nouveaux = (a, vus = []) => { const v = new Set(Array.isArray(vus) ? vus : []); return a.obtenus.filter(b => !v.has(b.id)); };
