// Paliers (« Ton personnage ») : le nom s'adapte au genre CHOISI par la personne et à son profil réel.
// Règles (décision D6) : aucun nom ne présume le genre (sans choix : forme neutre) ; on ne parle de « reprise »
// qu'à quelqu'un qui reprend (niveau « comeback » de l'onboarding ou objectif « restart »).
// Module pur, testé par tests/paliers.test.mjs. Les seuils de niveau (1, 3, 5, 8) sont ceux d'origine.
import { genreDe } from "./genre.js";

export const reprend = (profile) => profile?.level === "comeback" || profile?.goal === "restart";
const debute = (profile) => !profile?.level || profile.level === "beginner";

// Chaque palier : variantes par situation, chacune avec ses trois formes (m, f, n) et sa phrase.
export const PALIERS = [
  { from: 1, icon: "🌱", variantes: [
    { si: debute, noms: { m: "Le Commençant", f: "La Commençante", n: "Premiers pas" }, line: "Chaque début compte. Le premier pas est déjà une décision." },
    { si: reprend, noms: { m: "De retour", f: "De retour", n: "De retour" }, line: "Revenir est déjà une décision. On repart d'ici." },
    { si: () => true, noms: { m: "Le Nouveau venu", f: "La Nouvelle venue", n: "Nouveau cap" }, line: "Nouvel outil, mêmes exigences. On pose les repères." },
  ] },
  { from: 3, icon: "🔥", variantes: [
    { si: reprend, noms: { m: "L'Homme de la reprise", f: "La Femme de la reprise", n: "La reprise en marche" }, line: "Tu reviens après les écarts. C'est ça, la force." },
    { si: () => true, noms: { m: "L'Homme d'élan", f: "La Femme d'élan", n: "L'élan" }, line: "Tu enchaînes les semaines. C'est ça, la force." },
  ] },
  { from: 5, icon: "🛡️", variantes: [
    { si: () => true, noms: { m: "L'Homme de discipline", f: "La Femme de discipline", n: "La discipline" }, line: "Ta régularité se voit : elle devient ton caractère." },
  ] },
  { from: 8, icon: "🏛️", variantes: [
    { si: () => true, noms: { m: "L'Homme de fer", f: "La Femme de fer", n: "Volonté de fer" }, line: "Corps, régularité et méthode tiennent ensemble. Continue." },
  ] },
];

// Palier d'un niveau pour un profil : { from, icon, name, line }.
export function palier(level, profile) {
  const p = [...PALIERS].reverse().find(x => (Number(level) || 1) >= x.from) || PALIERS[0];
  const v = p.variantes.find(x => x.si(profile)) || p.variantes.at(-1);
  return { from: p.from, icon: p.icon, name: v.noms[genreDe(profile)], line: v.line };
}
// Liste des paliers pour un profil (écran Trophées : « Les stades de ton personnage »)
export const paliersPour = (profile) => PALIERS.map(p => palier(p.from, profile));
