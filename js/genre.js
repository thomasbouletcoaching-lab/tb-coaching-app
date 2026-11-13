// Genre grammatical et sexe : deux informations distinctes, toutes deux données par la personne, jamais déduites.
// - `profile.genre` : comment l'app s'adresse à la personne ("m" masculin, "f" féminin, "n" neutre). Sans choix : neutre.
// - `profile.sex`   : sert uniquement aux estimations physiologiques (dépense de repos, repères en fer…).
//                     "m", "f", ou absent si la personne préfère ne pas le dire.
// Module pur (aucun accès à l'écran ni au stockage), testé par tests/genre.test.mjs.

export const GENRES = [["m", "Au masculin"], ["f", "Au féminin"], ["n", "De façon neutre"]];
export const SEXES = [["m", "Homme"], ["f", "Femme"], ["", "Je préfère ne pas le dire"]];

// Genre choisi, ou neutre. Le sexe ne sert JAMAIS à deviner le genre.
export const genreDe = (profile) => (GENRES.some(g => g[0] === profile?.genre) ? profile.genre : "n");
export const genreChoisi = (profile) => GENRES.some(g => g[0] === profile?.genre);

// Accord d'un texte : accord(profile, { m: "prêt", f: "prête", n: "d'attaque" }). La forme neutre est obligatoire.
export function accord(profile, formes) {
  if (!formes || typeof formes.n !== "string") throw new Error("accord : la forme neutre est obligatoire");
  return formes[genreDe(profile)] ?? formes.n;
}

// Constante de sexe de la formule de Mifflin-St Jeor (dépense de repos) : +5 (homme), −161 (femme).
// HYPOTHÈSE : sans sexe déclaré, on prend le milieu des deux (−78). L'écart avec l'une ou l'autre valeur est de 83 kcal
// par jour, soit moins que l'incertitude de la formule elle-même ; l'étalonnage sur le poids réel (phase 6.4) le corrigera.
export const MIFFLIN_SEXE = { m: 5, f: -161, inconnu: -78 };
export const mifflinSexe = (sex) => (sex === "m" ? MIFFLIN_SEXE.m : sex === "f" ? MIFFLIN_SEXE.f : MIFFLIN_SEXE.inconnu);
export const sexeValide = (v) => (v === "m" || v === "f" ? v : null);
