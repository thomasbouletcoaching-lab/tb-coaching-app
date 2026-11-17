// Construit supabase/functions/hybride-xp/moteur.js : le moteur pur de js/ et les données utiles de data/, en un seul fichier minifié.
// Usage : node tools/build-fonction-hybride.mjs (nécessite npx esbuild). Un test vérifie que moteur.js est à jour (empreinte).
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SOURCES = ["js/hybride.js", "js/hybride-quetes.js", "js/hybride-serveur.js", "data/hybride.json", "data/exercices.json"];
export const empreinte = (racine) => createHash("sha256").update(SOURCES.map(f => readFileSync(join(racine, f), "utf8")).join("\n")).digest("hex").slice(0, 16);

// Données minimales : on retire les commentaires (_clé) et, des exercices, on ne garde que ce qui sert au calcul
const sansCommentaires = (o) => Array.isArray(o) ? o.map(sansCommentaires) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_") && k !== "contenu" && k !== "note").map(([k, v]) => [k, sansCommentaires(v)])) : o;
export function donnees(racine) {
  const D = sansCommentaires(JSON.parse(readFileSync(join(racine, "data/hybride.json"), "utf8")));
  // Le serveur ne lit les exercices que pour repérer l'échauffement (mobilité), les skills, le cardio et les petits muscles :
  // les autres exercices sont traités comme inconnus, ce qui ne change aucun calcul d'XP.
  const UTILES = new Set(["mobilite", "skills", "cardio", "coiffe"]), PETITS = new Set(["Adducteurs", "Avant-bras", "Cou"]);
  const ex = JSON.parse(readFileSync(join(racine, "data/exercices.json"), "utf8")).ex.filter(e => UTILES.has(e.categorie) || PETITS.has((e.muscles || [])[0])).map(e => ({ nom: e.nom, muscles: (e.muscles || []).slice(0, 3), ...(e.categorie ? { categorie: e.categorie } : {}) }));
  return { D, ex };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const racine = new URL("..", import.meta.url).pathname, tmp = mkdtempSync(join(tmpdir(), "hyb-"));
  const { D, ex } = donnees(racine);
  writeFileSync(join(tmp, "entree.js"), `export { aEcrire, aujourdhuiParis, objetsApres } from ${JSON.stringify(join(racine, "js/hybride-serveur.js"))};
export const D = ${JSON.stringify(D)};
export const EX = ${JSON.stringify(ex)};\n`);
  execFileSync("npx", ["--yes", "esbuild@0.21.5", join(tmp, "entree.js"), "--bundle", "--minify", "--format=esm", "--log-level=error", `--outfile=${join(tmp, "moteur.js")}`], { stdio: "inherit" });
  const code = readFileSync(join(tmp, "moteur.js"), "utf8");
  writeFileSync(join(racine, "supabase/functions/hybride-xp/moteur.js"), `// GÉNÉRÉ par tools/build-fonction-hybride.mjs depuis ${SOURCES.join(", ")} : ne pas modifier.\n// empreinte:${empreinte(racine)}\n${code}`);
  console.log("moteur.js :", code.length, "octets");
}
