// Personnage du module « athlète hybride » : dessin SVG léger, original, aux couleurs TB.
// Module pur (renvoie une chaîne SVG), testé par `node --test tests/personnage.test.mjs`.
//
// Règles : le personnage ne juge jamais le corps réel (aucune photo, aucune mesure : la silhouette est un choix libre
// parmi des formes équivalentes, sans nom ni classement) ; aucun accord de genre ; il ne régresse jamais (les objets
// viennent de la liste des objets débloqués, qui ne fait que grandir).
// Deux directions artistiques en prototype (point d'arrêt R6) : « geo » (formes pleines, géométriques) et « trait »
// (trait continu inspiré des figures des vases grecs, en écho au logo).

export const VERSION = 1;
export const PEAUX = ["#F6D7C3", "#E8B896", "#C98E66", "#A86B47", "#7A4A2E", "#4E2E1C"];
export const CHEVEUX_COULEURS = ["#1E1B18", "#4A3020", "#8A5A2B", "#C9A15B", "#B4B4B4", "#1F4FB5"];
export const COIFFURES = ["rase", "courte", "boucles", "chignon", "tresses", "longue"];
export const VISAGES = ["rond", "ovale", "carre"];
export const SILHOUETTES = [1, 2, 3, 4]; // largeurs d'épaules et de taille, sans nom
export const TENUES = { "tenue-base": ["#1F4FB5", "#18212C"], "tenue-argent": ["#9AA6B2", "#3A4552"], "tenue-or": ["#E9AE00", "#18212C"], "tenue-platine": ["#DDE6EE", "#5B6673"], "tenue-diamant": ["#6E9BF0", "#173C8A"], "tenue-maitre": ["#18212C", "#E9AE00"] };
export const DECORS = { "decor-salle": "Salle de sport", "decor-piste": "Piste d'athlétisme", "decor-parc": "Parc de street workout", "decor-stade": "Stade" };

export const DEFAUT = { peau: 2, coiffure: "courte", cheveux: 0, visage: "ovale", silhouette: 2, tenue: "tenue-base", decor: "decor-salle", accessoires: [] };

// Apparence valide : toute valeur inconnue revient au défaut ; tenue, décor et accessoires seulement s'ils sont débloqués
export function normaliser(a = {}, debloques = []) {
  const ok = new Set(["tenue-base", "decor-salle", ...(Array.isArray(debloques) ? debloques : [])]);
  const x = { ...DEFAUT, ...(a && typeof a === "object" ? a : {}) };
  return {
    peau: Number.isInteger(x.peau) && x.peau >= 0 && x.peau < PEAUX.length ? x.peau : DEFAUT.peau,
    coiffure: COIFFURES.includes(x.coiffure) ? x.coiffure : DEFAUT.coiffure,
    cheveux: Number.isInteger(x.cheveux) && x.cheveux >= 0 && x.cheveux < CHEVEUX_COULEURS.length ? x.cheveux : DEFAUT.cheveux,
    visage: VISAGES.includes(x.visage) ? x.visage : DEFAUT.visage,
    silhouette: SILHOUETTES.includes(x.silhouette) ? x.silhouette : DEFAUT.silhouette,
    tenue: TENUES[x.tenue] && ok.has(x.tenue) ? x.tenue : "tenue-base",
    decor: DECORS[x.decor] && ok.has(x.decor) ? x.decor : "decor-salle",
    accessoires: (Array.isArray(x.accessoires) ? x.accessoires : []).filter(id => ["bandeau", "gants", "chrono", "cape"].includes(id) && ok.has(id)),
  };
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Décors (communs aux deux styles) ----------
function decor(id, trait) {
  const sol = trait ? "#E9DCC4" : "#DCE4F2", fond = trait ? "#F4EBDA" : "#EEF1F4", c = trait ? "#B4491A" : "#1F4FB5";
  const base = `<rect width="200" height="240" fill="${fond}"/><rect y="196" width="200" height="44" fill="${sol}"/>`;
  if (id === "decor-piste") return base + `<path d="M0 214 Q100 200 200 214" stroke="${c}" stroke-width="2" fill="none" opacity=".6"/><path d="M0 228 Q100 214 200 228" stroke="${c}" stroke-width="2" fill="none" opacity=".6"/>`;
  if (id === "decor-parc") return base + `<g stroke="${c}" stroke-width="4" opacity=".55"><line x1="22" y1="60" x2="22" y2="196"/><line x1="178" y1="60" x2="178" y2="196"/><line x1="18" y1="62" x2="182" y2="62"/></g><circle cx="30" cy="40" r="10" fill="${c}" opacity=".15"/>`;
  if (id === "decor-stade") return base + `<g fill="${c}" opacity=".18"><rect x="0" y="120" width="200" height="12"/><rect x="0" y="140" width="200" height="12"/><rect x="0" y="160" width="200" height="12"/></g><g fill="${c}" opacity=".5"><circle cx="20" cy="30" r="4"/><circle cx="180" cy="30" r="4"/></g>`;
  return base + `<g stroke="${c}" stroke-width="3" opacity=".35"><line x1="20" y1="170" x2="60" y2="170"/><rect x="14" y="160" width="6" height="20" fill="${c}"/><rect x="60" y="160" width="6" height="20" fill="${c}"/></g><rect x="150" y="70" width="34" height="50" rx="4" fill="${c}" opacity=".08"/>`;
}

// ---------- Style « geo » : formes pleines ----------
function geo(a) {
  const p = PEAUX[a.peau], h = CHEVEUX_COULEURS[a.cheveux], [t1, t2] = TENUES[a.tenue];
  const ep = [26, 30, 34, 38][a.silhouette - 1], ta = [20, 24, 28, 33][a.silhouette - 1];
  const tete = a.visage === "rond" ? `<circle cx="100" cy="62" r="22" fill="${p}"/>` : a.visage === "carre" ? `<rect x="79" y="40" width="42" height="44" rx="12" fill="${p}"/>` : `<ellipse cx="100" cy="62" rx="20" ry="24" fill="${p}"/>`;
  const cheveux = {
    rase: `<path d="M80 54 Q100 34 120 54 Q100 46 80 54Z" fill="${h}" opacity=".55"/>`,
    courte: `<path d="M78 58 Q78 34 100 34 Q122 34 122 58 Q112 44 100 46 Q88 44 78 58Z" fill="${h}"/>`,
    boucles: `<g fill="${h}"><circle cx="84" cy="44" r="10"/><circle cx="100" cy="38" r="11"/><circle cx="116" cy="44" r="10"/><circle cx="78" cy="56" r="7"/><circle cx="122" cy="56" r="7"/></g>`,
    chignon: `<path d="M78 58 Q78 34 100 34 Q122 34 122 58 Q110 42 100 42 Q90 42 78 58Z" fill="${h}"/><circle cx="100" cy="28" r="9" fill="${h}"/>`,
    tresses: `<path d="M78 60 Q78 34 100 34 Q122 34 122 60 Q110 44 100 44 Q90 44 78 60Z" fill="${h}"/><g fill="${h}"><rect x="74" y="58" width="7" height="40" rx="3.5"/><rect x="119" y="58" width="7" height="40" rx="3.5"/></g>`,
    longue: `<path d="M76 92 Q72 34 100 34 Q128 34 124 92 L116 92 Q118 52 100 48 Q82 52 84 92Z" fill="${h}"/>`,
  }[a.coiffure];
  const corps = `<path d="M${100 - ep} 96 Q100 88 ${100 + ep} 96 L${100 + ta} 150 L${100 - ta} 150Z" fill="${t1}"/>`;
  const bras = `<g stroke="${p}" stroke-width="11" stroke-linecap="round" fill="none"><path d="M${100 - ep + 3} 100 L${100 - ep - 12} 128 L${100 - ep - 4} 148"/><path d="M${100 + ep - 3} 100 L${100 + ep + 12} 128 L${100 + ep + 4} 148"/></g>`;
  const jambes = `<g stroke="${t2}" stroke-width="15" stroke-linecap="round"><line x1="${100 - ta / 2}" y1="150" x2="${100 - ta / 2 - 4}" y2="190"/><line x1="${100 + ta / 2}" y1="150" x2="${100 + ta / 2 + 4}" y2="190"/></g><g fill="${t1}"><ellipse cx="${100 - ta / 2 - 6}" cy="194" rx="11" ry="5"/><ellipse cx="${100 + ta / 2 + 6}" cy="194" rx="11" ry="5"/></g>`;
  const yeux = `<g fill="#18212C"><circle cx="92" cy="64" r="2.4"/><circle cx="108" cy="64" r="2.4"/></g><path d="M93 74 Q100 79 107 74" stroke="#18212C" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const acc = [
    a.accessoires.includes("cape") ? `<path d="M${100 - ep} 96 Q100 92 ${100 + ep} 96 L${100 + ep + 14} 176 Q100 168 ${100 - ep - 14} 176Z" fill="#B4491A" opacity=".9"/>` : "",
  ].join("");
  const dessus = [
    a.accessoires.includes("bandeau") ? `<rect x="78" y="48" width="44" height="6" rx="3" fill="#E9AE00"/>` : "",
    a.accessoires.includes("gants") ? `<g fill="#18212C"><circle cx="${100 - ep - 4}" cy="149" r="6"/><circle cx="${100 + ep + 4}" cy="149" r="6"/></g>` : "",
    a.accessoires.includes("chrono") ? `<circle cx="${100 + ep + 13}" cy="128" r="4" fill="#E9AE00" stroke="#18212C" stroke-width="1.5"/>` : "",
    `<path d="M96 112 L104 112 L100 122Z" fill="${t2}" opacity=".7"/>`,
  ].join("");
  return acc + jambes + corps + bras + tete + cheveux + yeux + dessus;
}

// ---------- Style « trait » : trait continu, couleurs de terre cuite ----------
function trait(a) {
  const p = PEAUX[a.peau], h = CHEVEUX_COULEURS[a.cheveux], [t1] = TENUES[a.tenue], k = "#2A1A12";
  const ep = [22, 26, 30, 34][a.silhouette - 1], ta = [16, 19, 22, 26][a.silhouette - 1];
  const s = `stroke="${k}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  const tete = a.visage === "rond" ? `<circle cx="100" cy="60" r="19" fill="${p}" ${s}/>` : a.visage === "carre" ? `<rect x="82" y="40" width="36" height="40" rx="10" fill="${p}" ${s}/>` : `<ellipse cx="100" cy="60" rx="17" ry="21" fill="${p}" ${s}/>`;
  const cheveux = {
    rase: `<path d="M84 52 Q100 36 116 52" fill="none" ${s} stroke-dasharray="2 4"/>`,
    courte: `<path d="M82 56 Q82 36 100 36 Q118 36 118 56 Q108 46 100 47 Q92 46 82 56Z" fill="${h}" ${s}/>`,
    boucles: `<path d="M82 52 q-4 -10 6 -12 q2 -10 12 -6 q8 -8 14 2 q10 0 6 12" fill="${h}" ${s}/>`,
    chignon: `<path d="M82 56 Q82 36 100 36 Q118 36 118 56 Q108 44 100 44 Q92 44 82 56Z" fill="${h}" ${s}/><circle cx="100" cy="30" r="7" fill="${h}" ${s}/>`,
    tresses: `<path d="M82 58 Q82 36 100 36 Q118 36 118 58" fill="${h}" ${s}/><path d="M80 58 l-2 8 l4 6 l-3 8 l4 6 M120 58 l2 8 l-4 6 l3 8 l-4 6" fill="none" ${s}/>`,
    longue: `<path d="M83 52 Q90 40 100 40 Q110 40 117 52 Q108 46 100 47 Q92 46 83 52Z" fill="${h}" ${s}/>`,
  }[a.coiffure];
  // Cheveux longs : la masse passe derrière la tête
  const arriere = a.coiffure === "longue" ? `<path d="M80 92 Q74 34 100 34 Q126 34 120 92Z" fill="${h}" ${s}/>` : "";
  const corps = `<path d="M${100 - ep} 92 Q100 86 ${100 + ep} 92 L${100 + ta} 146 L${100 - ta} 146Z" fill="${t1}" ${s}/><path d="M${100 - ta} 132 L${100 + ta} 132" ${s} opacity=".5"/>`;
  const membres = `<path d="M${100 - ep + 2} 96 L${100 - ep - 14} 124 L${100 - ep - 2} 144 M${100 + ep - 2} 96 L${100 + ep + 14} 124 L${100 + ep + 2} 144 M${100 - ta / 2} 146 L${100 - ta / 2 - 6} 192 M${100 + ta / 2} 146 L${100 + ta / 2 + 6} 192" fill="none" stroke="${k}" stroke-width="9" stroke-linecap="round"/><path d="M${100 - ep + 2} 96 L${100 - ep - 14} 124 L${100 - ep - 2} 144 M${100 + ep - 2} 96 L${100 + ep + 14} 124 L${100 + ep + 2} 144 M${100 - ta / 2} 146 L${100 - ta / 2 - 6} 192 M${100 + ta / 2} 146 L${100 + ta / 2 + 6} 192" fill="none" stroke="${p}" stroke-width="4" stroke-linecap="round"/>`;
  const visage = `<path d="M92 60 h4 M104 60 h4 M95 70 Q100 73 105 70" ${s} fill="none" stroke-width="2.4"/>`;
  const acc = a.accessoires.includes("cape") ? `<path d="M${100 - ep} 92 L${100 - ep - 16} 178 Q100 170 ${100 + ep + 16} 178 L${100 + ep} 92" fill="#B4491A" ${s} opacity=".85"/>` : "";
  const dessus = [
    a.accessoires.includes("bandeau") ? `<path d="M83 48 Q100 42 117 48" fill="none" stroke="#E9AE00" stroke-width="5" stroke-linecap="round"/>` : "",
    a.accessoires.includes("gants") ? `<g fill="${k}"><circle cx="${100 - ep - 2}" cy="145" r="5"/><circle cx="${100 + ep + 2}" cy="145" r="5"/></g>` : "",
    a.accessoires.includes("chrono") ? `<circle cx="${100 + ep + 12}" cy="124" r="4" fill="#E9AE00" ${s} stroke-width="1.5"/>` : "",
  ].join("");
  // Frise grecque sous les pieds
  const frise = `<path d="M10 206 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10 v-8 h10 v8 h10" fill="none" stroke="#B4491A" stroke-width="2" opacity=".5"/>`;
  return frise + acc + arriere + membres + corps + tete + cheveux + visage + dessus;
}

// SVG complet. titre : texte lu par les lecteurs d'écran (« Ton personnage »).
export function svg(apparence, { style = "geo", debloques = [], titre = "Ton personnage", taille = 160 } = {}) {
  const a = normaliser(apparence, debloques), t = style === "trait";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="${taille}" height="${Math.round(taille * 1.2)}" role="img" aria-label="${esc(titre)}"><title>${esc(titre)}</title>${decor(a.decor, t)}${t ? trait(a) : geo(a)}</svg>`;
}
