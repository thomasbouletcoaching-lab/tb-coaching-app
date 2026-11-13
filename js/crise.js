// « Je craque » : logique pure (aucun accès à l'écran ni au stockage), testée par tests/crise.test.mjs.
// La personne décrit son envie ; on propose une action concrète, on déculpabilise, on dit quoi faire APRÈS.
// Règles du cahier des charges : aucune compensation punitive, aucun jeûne, aucun conseil médical.
//
// HYPOTHÈSES À AJUSTER AVEC LE TERRAIN (points de départ, pas des vérités) :
export const PAUSE_MIN = 10;          // durée de la pause proposée avant de décider
export const INTENSITE_FORTE = 4;     // à partir de cette intensité (sur 5), on propose d'emblée une portion choisie
export const MIN_ENTREES = 3;         // nombre de craquages décrits avant de parler de déclencheurs
export const PART_DOMINANTE = 0.5;    // un déclencheur est « dominant » s'il revient dans au moins la moitié des cas
export const JOURNAL_MAX = 200;       // nombre de notes gardées sur le téléphone
// Ligne d'écoute française pour les troubles du comportement alimentaire (« Anorexie Boulimie Info Écoute »),
// vérifiée le 13/11/2026 sur ffab.fr et reseautca-idf.org. À revérifier une fois par an.
export const LIGNE_ECOUTE = "09 69 325 900";

export const ENVIES = [["sucre", "Sucré"], ["sale", "Salé"], ["gras", "Gras ou frit"], ["alcool", "Alcool"], ["tout", "Tout ce qui passe"], ["autre", "Autre chose"]];
export const EMOTIONS = [["faim", "Vraie faim"], ["stress", "Stress"], ["fatigue", "Fatigue"], ["ennui", "Ennui"], ["tristesse", "Tristesse"], ["colere", "Colère"], ["fete", "Envie de partager un moment"]];
export const CONTEXTES = [["maison", "À la maison"], ["travail", "Au travail"], ["soiree", "En soirée"], ["resto", "Au restaurant"], ["courses", "En courses"], ["trajet", "En déplacement"]];
export const INTENSITES = [[1, "Légère"], [2, "Présente"], [3, "Forte"], [4, "Très forte"], [5, "Envahissante"]];
export const SUITES = [["passee", "L'envie est passée"], ["portion", "J'ai pris une portion"], ["plus", "J'ai mangé plus que prévu"]];

const lib = (liste, cle) => (liste.find(x => x[0] === cle) || [])[1] || "";
export const libelle = { envie: (k) => lib(ENVIES, k), emotion: (k) => lib(EMOTIONS, k), contexte: (k) => lib(CONTEXTES, k), intensite: (k) => lib(INTENSITES, Number(k)), suite: (k) => lib(SUITES, k) };

// Ce qu'on fait après, quelle que soit l'issue : toujours la même phrase, jamais de rattrapage.
export const APRES = "Ton prochain repas est un repas normal, à l'heure habituelle. Pas de repas sauté, pas de jeûne, pas de séance en plus pour compenser.";
export const RASSURE = "Une envie de manger arrive à tout le monde. Elle ne dit rien de ta valeur ni de ta volonté. Ce qui compte, c'est la suite, et tu es en train de t'en occuper.";

const COLLATION = {
  sucre: "un yaourt ou un fromage blanc, un fruit, et une poignée d'amandes ou de noix",
  sale: "deux tranches de pain, du fromage ou deux œufs, et un fruit",
  gras: "deux tranches de pain, du fromage ou deux œufs, et un fruit",
};
const SELON_EMOTION = {
  stress: "Avant de décider : trois respirations lentes, 4 secondes à l'inspiration, 6 à l'expiration.",
  fatigue: "La fatigue se déguise souvent en faim. Si tu peux, couche-toi 30 minutes plus tôt ce soir.",
  ennui: "Change d'activité pendant ces 10 minutes : appelle quelqu'un, range une chose, sors prendre l'air.",
  tristesse: "Ce que tu ressens est légitime. Écris-le en une phrase ou dis-le à quelqu'un : la nourriture peut attendre 10 minutes.",
  colere: "Ce que tu ressens est légitime. Écris-le en une phrase ou dis-le à quelqu'un : la nourriture peut attendre 10 minutes.",
};

// Réponse concrète à une envie décrite. Renvoie { cle, titre, etapes[], apres, rassure }.
// Ordre des règles : la faim d'abord (on mange), puis le moment partagé (on en profite), puis l'intensité.
export function reponse({ envie = null, emotion = null, contexte = null, intensite = 3 } = {}) {
  const i = Math.min(5, Math.max(1, Number(intensite) || 3));
  const social = contexte === "soiree" || contexte === "resto" || emotion === "fete";
  let cle, titre, etapes;
  if (emotion === "faim") {
    cle = "manger"; titre = "C'est de la faim : mange";
    etapes = [
      "Ce que tu décris ressemble à de la faim, pas à un craquage. La bonne réponse à la faim, c'est de manger.",
      `Mange maintenant quelque chose de précis et suffisant : ${COLLATION[envie] || COLLATION.sucre}.`,
      "Prends 10 minutes à table, sans écran. Si tu as encore faim ensuite, ressers-toi.",
    ];
  } else if (social) {
    cle = "plaisir"; titre = "Profite du moment, en choisissant";
    etapes = [
      "Tu es dans un moment qui compte. Manger ici fait partie de la vie, pas d'un écart.",
      "Choisis ce qui te fait vraiment envie, pas tout ce qui est là. Sers-toi une portion et savoure-la lentement.",
      envie === "alcool" ? "Alterne un verre d'eau avec chaque verre d'alcool." : "Bois un verre d'eau, puis éloigne-toi du buffet ou repose la carte.",
      "Compte ce repas comme ton repas plaisir de la semaine : il a sa place dans ton plan.",
    ];
  } else if (i >= INTENSITE_FORTE) {
    cle = "portion"; titre = "Une portion choisie, pas un paquet fini";
    etapes = [
      "L'envie est forte, et c'est normal. Tu n'as pas à la combattre de front.",
      `Bois un grand verre d'eau et laisse passer ${PAUSE_MIN} minutes.`,
      "Si l'envie est toujours là : sers-toi une portion dans une assiette ou un bol, range le reste, et mange à table, sans écran.",
    ];
  } else {
    cle = "pause"; titre = `Une pause de ${PAUSE_MIN} minutes`;
    etapes = [
      `Bois un grand verre d'eau, puis sors marcher ou change de pièce pendant ${PAUSE_MIN} minutes.`,
      "Reviens ici ensuite. Si l'envie est passée, c'est réglé. Si elle est encore là, prends une portion choisie, à table.",
    ];
  }
  if (cle !== "manger" && SELON_EMOTION[emotion]) etapes.push(SELON_EMOTION[emotion]);
  return { cle, titre, etapes, apres: APRES, rassure: RASSURE };
}

// Message de clôture selon ce qui s'est passé : jamais de reproche, quelle que soit l'issue.
export function cloture(suite) {
  if (suite === "passee") return "Tu as laissé passer l'envie. Retiens ce qui a marché cette fois.";
  if (suite === "portion") return "Tu as choisi ta portion : c'est exactement ça, garder la main. La journée continue normalement.";
  if (suite === "plus") return "Ça arrive, et ça ne change rien à tes progrès de fond. Un seul repas ne défait pas des semaines de régularité. Prochain repas : normal.";
  return "";
}

export const TRANCHES = [["matin", "le matin", 5, 11], ["midi", "à l'heure du déjeuner", 11, 14], ["aprem", "l'après-midi", 14, 18], ["soir", "le soir", 18, 22], ["nuit", "tard le soir ou la nuit", 22, 29]];
export function tranche(hhmm) {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm || "")) return null;
  let h = Number(hhmm.split(":")[0]); if (h < 5) h += 24;
  return (TRANCHES.find(t => h >= t[2] && h < t[3]) || [null])[0];
}

const dominant = (valeurs, n) => {
  const c = {}; for (const v of valeurs) if (v) c[v] = (c[v] || 0) + 1;
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] / n >= PART_DOMINANTE ? { cle: top[0], n: top[1] } : null;
};
const PLAN = {
  tranche: {
    aprem: "Prévois une vraie collation vers 16 h (un laitage, un fruit, une poignée d'oléagineux), avant que l'envie n'arrive.",
    soir: "Vérifie que ton dîner est suffisant, et prévois quelque chose à faire juste après (appel, douche, marche).",
    nuit: "Avance ton coucher de 30 minutes : passé une certaine heure, c'est surtout la fatigue qui parle.",
    matin: "Vérifie que ton premier repas contient des protéines et tient jusqu'au déjeuner.",
    midi: "Prépare ton déjeuner la veille pour ne pas avoir à choisir quand tu as faim.",
  },
  emotion: {
    faim: "Tes repas sont peut-être trop légers ou trop espacés : ajoute une collation ou augmente une portion.",
    stress: "Repère le moment de stress qui précède, et prévois une soupape de 5 minutes à cet endroit de ta journée (marche, respiration).",
    fatigue: "La fatigue revient souvent avant tes envies : protège ton sommeil en priorité cette semaine.",
    ennui: "Garde une liste de trois choses à faire en 10 minutes, à sortir quand l'ennui arrive.",
  },
  contexte: {
    maison: "Range hors de vue ce qui te tente le plus, et garde à portée de main ce qui te convient.",
    travail: "Apporte ta collation au travail pour ne pas dépendre du distributeur.",
    courses: "Fais tes courses après un repas, avec une liste.",
  },
};

// Déclencheurs repérés dans le journal. Les anciennes notes ({ d, note } sans détail) sont ignorées.
// Renvoie null tant qu'il n'y a pas assez d'entrées décrites.
export function declencheurs(journal = []) {
  const e = journal.filter(x => x && (x.emotion || x.contexte || x.t));
  if (e.length < MIN_ENTREES) return null;
  const tr = dominant(e.map(x => tranche(x.t)), e.length), em = dominant(e.map(x => x.emotion), e.length), co = dominant(e.map(x => x.contexte), e.length);
  const constats = [], plan = [];
  if (tr) { constats.push(`${tr.n} fois sur ${e.length}, c'est ${(TRANCHES.find(t => t[0] === tr.cle) || [])[1]}`); if (PLAN.tranche[tr.cle]) plan.push(PLAN.tranche[tr.cle]); }
  if (em) { constats.push(`${em.n} fois sur ${e.length} : ${libelle.emotion(em.cle).toLowerCase()}`); if (PLAN.emotion[em.cle]) plan.push(PLAN.emotion[em.cle]); }
  if (co) { constats.push(`${co.n} fois sur ${e.length} : ${libelle.contexte(co.cle).toLowerCase()}`); if (PLAN.contexte[co.cle]) plan.push(PLAN.contexte[co.cle]); }
  return { n: e.length, tranche: tr, emotion: em, contexte: co, constats, plan };
}

// Entrée du journal, nettoyée. `d` = date ISO, `t` = heure HH:MM.
export function entree({ d, t, envie, emotion, contexte, intensite, note }) {
  const ok = (liste, v) => liste.some(x => x[0] === v) ? v : null;
  const e = { d, t, envie: ok(ENVIES, envie), emotion: ok(EMOTIONS, emotion), contexte: ok(CONTEXTES, contexte), intensite: Math.min(5, Math.max(1, Number(intensite) || 3)) };
  const n = String(note || "").trim().slice(0, 200); if (n) e.note = n;
  return e;
}

// Résumé d'une entrée pour l'affichage (anciennes notes comprises).
export function resume(e) {
  return [e.t, libelle.emotion(e.emotion), libelle.contexte(e.contexte), libelle.envie(e.envie), e.intensite ? "intensité " + e.intensite + "/5" : "", libelle.suite(e.suite)].filter(Boolean).join(" · ");
}
