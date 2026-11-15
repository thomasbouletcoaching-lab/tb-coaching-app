// Garde-fou de la migration (phase 2) : la nouvelle app et ses fonctions ne doivent plus lire ni écrire
// dans l'ancienne table « messages » ; tout passe par « cxs_messages ».
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const racine = new URL("..", import.meta.url).pathname;
const fichiers = (dir, out = []) => {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) fichiers(p, out); else if (/\.(js|ts)$/.test(f)) out.push(p); }
  return out;
};
const sources = [...fichiers(join(racine, "js")), ...fichiers(join(racine, "supabase", "functions"))];
const ancienne = /\.from\(\s*["'`]messages["'`]\s*\)/;

test("aucun fichier de la nouvelle app ni des fonctions n'utilise l'ancienne table messages", () => {
  const fautifs = sources.filter(f => ancienne.test(readFileSync(f, "utf8")));
  assert.deepEqual(fautifs.map(f => f.replace(racine, "")), []);
});

test("la messagerie de js/cloud.js utilise cxs_messages", () => {
  const src = readFileSync(join(racine, "js", "cloud.js"), "utf8");
  const bloc = src.slice(src.indexOf("// Messagerie"), src.indexOf("// Notifications"));
  for (const fn of ["thread", "send", "react", "markRead", "unreadFromCoach"]) {
    const d = bloc.indexOf(`function ${fn}(`); assert.ok(d >= 0, `${fn} introuvable`);
    const fin = bloc.indexOf("\nexport ", d + 1); const corps = bloc.slice(d, fin < 0 ? undefined : fin);
    assert.match(corps, /from\("cxs_messages"\)/, `${fn} doit utiliser cxs_messages`);
  }
});
