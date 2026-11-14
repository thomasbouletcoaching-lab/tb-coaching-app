// « Je craque » : logique pure (aucun accès à l'écran ni au stockage), testée par tests/crise.test.mjs.
// La personne décrit son envie ; on propose une action concrète, on déculpabilise, on dit quoi faire APRÈS.
// Règles du cahier des charges : aucune compensation punitive, aucun jeûne, aucun conseil médical.
//
// HYPOTHÈSES À AJUSTER AVEC LE TERRAIN (points de départ, pas des vérités). Elles sont toutes ici :
export const PAUSE_MIN = 10;          // durée de la pause proposée avant de décider
export const INTENSITE_FORTE = 4;     // à partir de cette intensité (sur 5), on propose d'emblée une portion choisie
export const INTENSITE_DEFAUT = 3;    // intensité retenue pour la réponse quand la personne ne l'a pas indiquée
export const MIN_ENTREES = 3;         // nombre d'envies décrites avant de parler de déclencheurs
export const PART_DOMINANTE = 0.5;    // un déclencheur est « dominant » s'il revient dans au moins la moitié des cas
export const JOURNAL_MAX = 200;       // nombre de notes gardées sur le téléphone
export const PARTAGE_MAX = 30;        // nombre de notes jointes au dossier du coach quand l'accord est donné
export const COUCHER_PLUS_TOT_MIN = 30; // avance du coucher suggérée quand la fatigue domine
export const HEURE_COLLATION = "16 h";  // heure de la collation suggérée quand les envies arrivent l'après-midi
// Tranches de la journée : [clé, libellé, heure de début, heure de fin] (les heures après minuit comptent pour la nuit)
export const TRANCHES = [["matin", "le matin", 5, 11], ["midi", "à l'heure du déjeuner", 11, 14], ["aprem", "l'après-midi", 14, 18], ["soir", "le soir", 18, 22], ["nuit", "tard le soir ou la nuit", 22, 29]];
// Exemples de collation : toujours des exemples, à adapter à ce que la personne mange (régime, allergies)
export const COLLATION = {
  defaut: "par exemple un laitage ou son équivalent végétal, un fruit, et une poignée de fruits à coque ou de graines, selon ce que tu manges",
  sale: "par exemple du pain avec du fromage, des œufs ou du houmous, et un fruit, selon ce que tu manges",
};
// Ligne d'écoute française pour les troubles du comportement alimentaire (« Anorexie Boulimie Info Écoute »),
// vérifiée le 13/11/2026 sur ffab.fr et reseautca-idf.org. À revérifier une fois par an.
export const LIGNE_ECOUTE = "09 69 325 900";

// (L'alcool n'est pas proposé : ce n'est pas une envie de manger, et l'app ne conseille rien à ce sujet.)
export const ENVIES = [["sucre", "Sucré"], ["sale", "Salé"], ["gras", "Gras ou frit"], ["tout", "Tout ce qui passe"], ["autre", "Autre chose"]];
export const EMOTIONS = [["faim", "Faim (ventre vide)"], ["stress", "Stress"], ["fatigue", "Fatigue"], ["ennui", "Ennui"], ["tristesse", "Tristesse"], ["colere", "Colère"], ["fete", "Envie de partager un moment"]];
export const CONTEXTES = [["maison", "À la maison"], ["travail", "Au travail"], ["soiree", "À une soirée, chez des amis"], ["resto", "Au restaurant"], ["courses", "En courses"], ["trajet", "En déplacement"]];
export const INTENSITES = [[1, "Légère"], [2, "Présente"], [3, "Forte"], [4, "Très forte"], [5, "Envahissante"]];
export const SUITES = [["passee", "L'envie est passée"], ["portion", "J'ai pris une portion"], ["plus", "J'ai mangé plus que prévu"]];

const lib = (liste, cle) => (liste.find(x => x[0] === cle) || [])[1] || "";
export const libelle = { envie: (k) => lib(ENVIES, k), emotion: (k) => lib(EMOTIONS, k), contexte: (k) => lib(CONTEXTES, k), intensite: (k) => lib(INTENSITES, Number(k)), suite: (k) => lib(SUITES, k) };

// Ce qu'on fait après, quelle que soit l'issue : toujours la même phrase, jamais de rattrapage.
export const APRES = "Ton prochain repas est un repas normal, à l'heure habituelle. Pas de repas sauté, pas de jeûne pour rattraper, pas de séance en plus pour compenser.";
export const RASSURE = "Une envie de manger arrive à tout le monde. Elle ne dit rien de ta valeur ni de ta volonté. Ce qui compte, c'est la suite, et tu es en train de t'en occuper.";

const SELON_EMOTION = {
  stress: "D'abord, trois respirations lentes : 4 secondes à l'inspiration, 6 à l'expiration.",
  fatigue: `La fatigue se déguise souvent en faim. Si tu peux, couche-toi ${COUCHER_PLUS_TOT_MIN} minutes plus tôt ce soir.`,
  ennui: `Change d'activité pendant ${PAUSE_MIN} minutes : appelle quelqu'un, range une chose, sors prendre l'air.`,
  tristesse: `Ce que tu ressens est légitime. Écris-le en une phrase ou dis-le à quelqu'un : la nourriture peut attendre ${PAUSE_MIN} minutes.`,
  colere: `Ce que tu ressens est légitime. Écris-le en une phrase ou dis-le à quelqu'un : la nourriture peut attendre ${PAUSE_MIN} minutes.`,
};

// Réponse concrète à une envie décrite. Renvoie { cle, titre, etapes[], apres, rassure }.
// Ordre des règles : la faim d'abord (on mange), puis le moment partagé (on en profite), puis l'intensité.
// Le conseil lié au ressenti vient EN PREMIER (il précède la décision) et seulement quand on propose d'attendre.
export function reponse(saisie) {
  const { envie = null, emotion = null, contexte = null, intensite = null } = saisie || {};
  const n = Number(intensite), i = Number.isFinite(n) && n >= 1 ? Math.min(5, n) : INTENSITE_DEFAUT;
  const social = contexte === "soiree" || contexte === "resto" || emotion === "fete";
  let cle, titre, etapes;
  if (emotion === "faim") {
    cle = "manger"; titre = "C'est de la faim : mange";
    etapes = [
      "Ce que tu décris ressemble à de la faim. La bonne réponse à la faim, c'est de manger.",
      `Mange maintenant quelque chose de précis et suffisant : ${COLLATION[envie] || (envie === "gras" ? COLLATION.sale : COLLATION.defaut)}.`,
      `Prends ${PAUSE_MIN} minutes pour manger tranquillement. Si tu as encore faim ensuite, ressers-toi.`,
    ];
  } else if (social) {
    cle = "plaisir"; titre = "Profite du moment, en choisissant";
    etapes = [
      "Tu es dans un moment qui compte. Manger ici fait partie de la vie, pas d'un écart.",
      "Choisis ce qui te fait vraiment envie, pas tout ce qui est là. Sers-toi une portion et savoure-la lentement.",
      "Bois un verre d'eau, puis éloigne-toi du buffet ou repose la carte.",
      "Ce repas peut être ton repas plaisir : il a sa place dans ton plan.",
    ];
  } else if (i >= INTENSITE_FORTE) {
    cle = "portion"; titre = "Une portion choisie, tranquillement";
    etapes = [
      "L'envie est forte, et c'est normal. Tu n'as pas à la combattre de front.",
      `Bois un grand verre d'eau et laisse passer ${PAUSE_MIN} minutes.`,
      "Si l'envie est toujours là : sers-toi une portion dans une assiette ou un bol, range le reste, et prends le temps de la manger, sans écran si possible.",
    ];
  } else {
    cle = "pause"; titre = `Une pause de ${PAUSE_MIN} minutes`;
    etapes = [
      `Bois un grand verre d'eau, puis sors marcher ou change de pièce pendant ${PAUSE_MIN} minutes.`,
      "Reviens ici ensuite. Si l'envie est passée, c'est réglé. Si elle est encore là, sers-toi une portion choisie et prends le temps de la manger.",
    ];
  }
  if ((cle === "pause" || cle === "portion") && SELON_EMOTION[emotion]) etapes.unshift(SELON_EMOTION[emotion]);
  return { cle, titre, etapes, apres: APRES, rassure: RASSURE };
}

// Message de clôture selon ce qui s'est passé : jamais de reproche, quelle que soit l'issue.
export function cloture(suite) {
  if (suite === "passee") return "Tu as laissé passer l'envie. Retiens ce qui a marché cette fois.";
  if (suite === "portion") return "Tu as choisi ta portion. La journée continue normalement.";
  if (suite === "plus") return "Ça arrive. Un repas ne défait pas ce que tu construis. Prochain repas : normal, à l'heure habituelle.";
  return "";
}

export function tranche(hhmm) {
  if (typeof hhmm !== "string" || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  let h = Number(hhmm.split(":")[0]); if (h < 5) h += 24;
  return (TRANCHES.find(t => h >= t[2] && h < t[3]) || [null])[0];
}

const dominant = (valeurs, n) => {
  const c = {}; for (const v of valeurs) if (v) c[v] = (c[v] || 0) + 1;
  const [top, second] = Object.entries(c).sort((a, b) => b[1] - a[1]);
  if (!top || top[1] / n < PART_DOMINANTE || (second && second[1] === top[1])) return null; // à égalité, rien ne domine
  return { cle: top[0], n: top[1] };
};
const PLAN = {
  tranche: {
    aprem: `Prévois une vraie collation vers ${HEURE_COLLATION} (${COLLATION.defaut}), avant que l'envie n'arrive.`,
    soir: "Vérifie que ton dîner est suffisant, et prévois quelque chose à faire juste après (appel, douche, marche).",
    nuit: `Si tu peux, avance ton coucher de ${COUCHER_PLUS_TOT_MIN} minutes.`,
    matin: "Vérifie que ton premier repas contient des protéines et tient jusqu'au déjeuner.",
    midi: "Prépare ton déjeuner la veille pour ne pas avoir à choisir quand tu as faim.",
  },
  emotion: {
    faim: "Tes repas sont peut-être trop légers ou trop espacés : ajoute une collation ou augmente une portion.",
    stress: "Repère le moment de stress qui précède, et prévois une courte soupape à cet endroit de ta journée (marche, respiration).",
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
  const e = (Array.isArray(journal) ? journal : []).filter(x => x && typeof x === "object" && (x.emotion || x.contexte || x.t));
  if (e.length < MIN_ENTREES) return null;
  const tr = dominant(e.map(x => tranche(x.t)), e.length), em = dominant(e.map(x => x.emotion), e.length), co = dominant(e.map(x => x.contexte), e.length);
  const constats = [], plan = [];
  if (tr) { constats.push(`${tr.n} fois sur ${e.length}, c'est ${(TRANCHES.find(t => t[0] === tr.cle) || [])[1]}`); if (PLAN.tranche[tr.cle]) plan.push(PLAN.tranche[tr.cle]); }
  if (em) { constats.push(`${em.n} fois sur ${e.length} : ${libelle.emotion(em.cle).toLowerCase()}`); if (PLAN.emotion[em.cle]) plan.push(PLAN.emotion[em.cle]); }
  if (co) { constats.push(`${co.n} fois sur ${e.length} : ${libelle.contexte(co.cle).toLowerCase()}`); if (PLAN.contexte[co.cle]) plan.push(PLAN.contexte[co.cle]); }
  return { n: e.length, tranche: tr, emotion: em, contexte: co, constats, plan };
}

// Entrée du journal, nettoyée. `d` = date ISO, `t` = heure HH:MM.
// L'intensité reste vide si la personne ne l'a pas indiquée : on n'invente pas de donnée.
export function entree({ id, d, t, envie, emotion, contexte, intensite, note }) {
  const ok = (liste, v) => liste.some(x => x[0] === v) ? v : null;
  const n = Number(intensite);
  const e = { id: id || null, d, t, envie: ok(ENVIES, envie), emotion: ok(EMOTIONS, emotion), contexte: ok(CONTEXTES, contexte), intensite: Number.isFinite(n) && n >= 1 ? Math.min(5, Math.round(n)) : null };
  const texte = String(note || "").trim().slice(0, 200); if (texte) e.note = texte;
  return e;
}

// Résumé d'une entrée pour l'affichage (anciennes notes comprises).
export function resume(e) {
  if (!e || typeof e !== "object") return "";
  return [typeof e.t === "string" ? e.t : "", libelle.emotion(e.emotion), libelle.contexte(e.contexte), libelle.envie(e.envie), e.intensite ? "intensité " + e.intensite + "/5" : "", libelle.suite(e.suite)].filter(Boolean).join(" · ");
}
