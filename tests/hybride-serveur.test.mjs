// Tests de ce que la fonction serveur « hybride-xp » écrit : node --test tests/hybride-serveur.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../js/hybride-serveur.js";

const D = JSON.parse(readFileSync(new URL("../data/hybride.json", import.meta.url), "utf8"));
const EX = JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex;
const exDe = (n) => EX.find(x => x.nom === n) || null;
const set = (o = {}) => ({ done: true, reps: 5, kg: 60, ...o });
const data = { workouts: [{ id: "a", end: "2026-12-07T18:00:00Z", exercises: [{ name: "Squat barre", sets: [set({ type: "W" }), set(), set()] }, { name: "Rotation externe élastique", sets: [set(), set()] }], records: [{}] }], daily: { "2026-12-07": { feel: { energy: 7 } } } };
const ligne = { macro_id: "M1", debut: "2026-12-07", nb_seances: 3 };

test("lignes à écrire : XP bornée, sources autorisées, clés uniques, rejouable à l'identique", () => {
  const a = S.aEcrire(D, { data, blocLigne: ligne }, exDe, "2026-12-08"), b = S.aEcrire(D, { data: JSON.parse(JSON.stringify(data)), blocLigne: ligne }, exDe, "2026-12-08");
  assert.deepEqual(a, b);
  assert.ok(a.xp.length >= 4);
  assert.equal(new Set(a.xp.map(x => x.cle)).size, a.xp.length);
  for (const x of a.xp) { assert.ok(x.xp > 0 && x.xp <= 500); assert.ok(["regularite", "technique", "recuperation", "decharge", "test", "record", "quete"].includes(x.source)); }
  assert.ok(a.quetes.some(q => q.quete_id === "seance-du-jour"));
  assert.ok(a.debloques.includes("tenue-base"));
});

test("le bloc vient de la table, jamais de l'instantané ; une ligne invalide est ignorée", () => {
  const triche = { ...data, hybride: { bloc: { macroId: "M1", debut: "2020-01-06", nbSeances: 6 } } };
  const r = S.aEcrire(D, { data: triche, blocLigne: null }, exDe, "2026-12-08");
  assert.ok(!r.quetes.some(q => q.quete_id === "meso-termine"));
  assert.equal(S.blocDepuisLigne({ macro_id: "M9", debut: "2026-12-07", nb_seances: 3 }), null);
  assert.equal(S.blocDepuisLigne({ macro_id: "M1", debut: "hier", nb_seances: 3 }), null);
  assert.equal(S.blocDepuisLigne({ macro_id: "M1", debut: "2026-12-07", nb_seances: 9 }), null);
});

test("instantané vide ou mal formé : aucune erreur, aucune XP ; les objets déjà débloqués restent", () => {
  for (const d of [{}, { workouts: "x", daily: 3 }, { workouts: [null, {}], daily: { "2026-12-07": null } }]) {
    const r = S.aEcrire(D, { data: d, blocLigne: ligne, debloquesAvant: ["tenue-or"] }, exDe, "2026-12-08");
    assert.equal(r.xp.length, 0); assert.ok(r.debloques.includes("tenue-or"));
  }
});

test("champs inventés dans l'instantané (xp, rang) sans effet", () => {
  const r = S.aEcrire(D, { data: { ...data, xp: 99999, hybride: { xp: 99999, rang: "maitre" } }, blocLigne: ligne }, exDe, "2026-12-08");
  assert.ok(r.resume.xp < 300);
});

test("date du jour à Paris", () => {
  assert.equal(S.aujourdhuiParis(new Date("2026-12-07T23:30:00Z")), "2026-12-08");
  assert.equal(S.aujourdhuiParis(new Date("2026-07-07T21:59:00Z")), "2026-07-07");
});

test("objets : débloqués sur l'XP totale en base (pas seulement l'instantané), jamais retirés", () => {
  const r = S.aEcrire(D, { data, blocLigne: ligne, debloquesAvant: ["cape"] }, exDe, "2026-12-08");
  const o = S.objetsApres(D, r, 4500, ["cape"]);
  assert.ok(o.includes("tenue-diamant")); assert.ok(o.includes("cape"));
  assert.ok(!S.objetsApres(D, r, 0, []).includes("tenue-or"));
});

test("moteur de la fonction serveur à jour (sinon : node tools/build-fonction-hybride.mjs)", async () => {
  const { empreinte, donnees } = await import("../tools/build-fonction-hybride.mjs");
  const racine = new URL("..", import.meta.url).pathname;
  const m = readFileSync(new URL("../supabase/functions/hybride-xp/moteur.js", import.meta.url), "utf8");
  assert.match(m, new RegExp(`empreinte:${empreinte(racine)}`));
  // Les exercices gardés suffisent : même XP qu'avec la bibliothèque complète
  const { ex } = donnees(racine), mini = new Map(ex.map(e => [e.nom, e]));
  const w = { workouts: [{ end: "2026-12-07T18:00:00Z", exercises: [{ name: "Squat barre", sets: [set({ type: "W" }), set()] }, { name: "Copenhagen plank", sets: [set(), set(), set()] }, { name: "Muscle-up strict", sets: [set({ reps: 2 }), set({ reps: 2 }), set({ reps: 2 })] }] }] };
  assert.deepEqual(S.aEcrire(D, { data: w, blocLigne: ligne }, n => mini.get(n) || null, "2026-12-08").xp, S.aEcrire(D, { data: w, blocLigne: ligne }, exDe, "2026-12-08").xp);
});
