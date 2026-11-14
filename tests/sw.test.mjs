// Liste hors ligne du service worker : tout module JavaScript réellement chargé par l'app doit y figurer,
// et tout fichier listé doit exister. Évite qu'un écran ajouté ne marche pas hors ligne (salle sans réseau).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
const SHELL = JSON.parse(sw.match(/const SHELL = (\[[^\]]*\]);/)[1]);

// Graphe des imports (statiques et à la demande) à partir de js/app.js
function charges(entree) {
  const vus = new Set(), pile = [entree];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    const src = readFileSync(join(ROOT, f), "utf8");
    for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+\.js)["']/g)) pile.push(normalize(join(dirname(f), m[1])).replace(/\\/g, "/"));
  }
  return [...vus].sort();
}

test("le numéro de version du cache est présent", () => { assert.match(sw, /const C = "cxs-v\d+";/); });

test("chaque fichier de la liste hors ligne existe", () => {
  const absents = SHELL.filter(u => u !== "./" && !existsSync(join(ROOT, u)));
  assert.deepEqual(absents, [], "fichiers listés dans sw.js mais introuvables");
});

test("chaque module chargé par l'app est dans la liste hors ligne", () => {
  const modules = charges("js/app.js");
  assert.ok(modules.length > 40, "le graphe des imports doit couvrir l'app (" + modules.length + " modules trouvés)");
  const oublies = modules.filter(m => !SHELL.includes(m));
  assert.deepEqual(oublies, [], "modules chargés par l'app mais absents de SHELL dans sw.js");
});

test("les pages d'entrée et la feuille de style sont dans la liste", () => {
  for (const u of ["./", "index.html", "coach.html", "css/app.css", "js/app.js"]) assert.ok(SHELL.includes(u), u + " manque dans SHELL");
});

test("aucun doublon dans la liste", () => { assert.equal(new Set(SHELL).size, SHELL.length); });
