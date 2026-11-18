// Le personnage réagit à ce qui se passe : pose, phrase, fête. Module pur, testé par `node --test tests/personnage-vie.test.mjs`.
// Règles : phrases inclusives (aucun accord de genre, aucune hypothèse sur l'âge ou le corps), jamais de reproche,
// jamais de culpabilisation après une absence ou une pause. Une fête n'a lieu qu'une fois par événement.

// ctx : { auj, seanceAujourdhui, jourPrevu, pause, serie: { jours, retour }, rang: { id, nom }, rangVu, feteVue }
// → { pose: "repos" | "biceps", phrase, fete: null | { cle, titre } }
export function humeur(ctx = {}) {
  const auj = String(ctx.auj || ""), s = ctx.serie || {}, rang = ctx.rang || {};
  const choisir = (l) => l[[...auj].reduce((t, c) => t + c.charCodeAt(0), 0) % l.length];
  let fete = null;
  if (rang.id && ctx.rangVu && rang.id !== ctx.rangVu) fete = { cle: `rang:${rang.id}`, titre: `Nouveau rang : ${rang.nom}` };
  else if (ctx.seanceAujourdhui && ctx.feteVue !== `seance:${auj}`) fete = { cle: `seance:${auj}`, titre: "Séance validée" };
  const pose = ctx.seanceAujourdhui || fete ? "biceps" : "repos";
  let phrase;
  if (fete?.cle.startsWith("rang:")) phrase = `${rang.nom} ! Tout ce travail se voit.`;
  else if (ctx.seanceAujourdhui) phrase = choisir(["Séance validée. Maintenant, on récupère.", "C'est dans la boîte. Bois de l'eau, dors bien.", "Encore une brique de posée."]);
  else if (s.retour) phrase = "Te revoilà ! On reprend en douceur, sans rien rattraper.";
  else if (ctx.pause) phrase = "Pause notée. On repart quand tu veux.";
  else if (ctx.jourPrevu) phrase = choisir(["C'est jour de séance. On y va ?", "Ta séance du jour est prête.", "Un petit effort aujourd'hui, une grande fierté ce soir."]);
  else if (s.jours >= 7) phrase = `${s.jours} jours de série. La régularité, c'est ta force.`;
  else phrase = choisir(["Jour de repos : les muscles se construisent maintenant.", "Repos mérité. Marche, mobilité, et c'est tout bon.", "Le repos fait partie du programme."]);
  return { pose, phrase, fete };
}

// Réplique quand on touche le personnage (tourne à chaque appui)
export const REPLIQUES = ["On y va quand tu veux.", "On lâche rien.", "Hydratation : check ?", "Une séance à la fois.", "Ta régularité, c'est la classe."];
export const replique = (n) => REPLIQUES[((n % REPLIQUES.length) + REPLIQUES.length) % REPLIQUES.length];
