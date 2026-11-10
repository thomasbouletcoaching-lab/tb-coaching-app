// Tests de la bibliothèque d'exercices par pattern : node --test tests/exercices.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as X from "../js/exercices.js";

const DATA = JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex;
const FICHES = JSON.parse(readFileSync(new URL("../data/fiches.json", import.meta.url), "utf8")).ex;
const codes = X.PATTERNS.map(p => p.code), ids = (l) => l.map(x => x[0]);
const reset = () => X.setExercices(JSON.parse(JSON.stringify(DATA)));
reset();

test("taille : entre 80 et 120 exercices, slugs et noms uniques", () => {
  assert.ok(DATA.length >= 80 && DATA.length <= 120, `${DATA.length} exercices`);
  assert.equal(new Set(DATA.map(e => e.slug)).size, DATA.length);
  assert.equal(new Set(DATA.map(e => e.nom)).size, DATA.length);
});

test("chaque champ respecte les valeurs prévues (les mêmes que les contraintes de la table)", () => {
  for (const e of DATA) {
    assert.ok(ids(X.COUCHES).includes(e.couche), e.nom);
    assert.ok(e.pattern_principal === null || codes.includes(e.pattern_principal), e.nom);
    assert.ok(e.pattern_secondaire === null || codes.includes(e.pattern_secondaire), e.nom);
    if (e.couche === "squelette") assert.ok(e.pattern_principal, `${e.nom} : squelette sans pattern`);
    else assert.ok(X.CATEGORIES[e.categorie], `${e.nom} : catégorie manquante`);
    assert.ok(e.materiel.length && e.materiel.every(m => ids(X.MATERIEL).includes(m)), e.nom);
    assert.ok(ids(X.NIVEAUX).includes(e.niveau), e.nom);
    assert.ok([1, 2, 3].includes(e.cout_nerveux), e.nom);
    assert.ok(e.contre_indications.every(z => ids(X.ZONES).includes(z)), e.nom);
    assert.ok(e.muscles.length, `${e.nom} : muscles manquants`);
    assert.equal(e.actif, true);
  }
});

test("décisions du 10/11/2026 : dips = PH, hip thrust = CH, pull-over = TV", () => {
  assert.equal(X.exercice("Dips (poids de corps)").pattern_principal, "PH");
  assert.equal(X.exercice("Hip thrust barre").pattern_principal, "CH");
  assert.equal(X.exercice("Pull-over poulie haute").pattern_principal, "TV");
  assert.equal(X.exercice("Pull-over haltère").pattern_principal, "TV");
});

test("au moins 6 exercices par pattern, dont des options sans salle", () => {
  for (const c of codes) {
    const l = DATA.filter(e => e.pattern_principal === c);
    assert.ok(l.length >= 6, `${c} : ${l.length}`);
    assert.ok(l.some(e => e.materiel.includes("halteres_maison")), `${c} : rien à la maison`);
    // Le tirage vertical sans aucun matériel n'existe pas : il lui faut une barre de traction ou un élastique
    if (c !== "TV") assert.ok(l.some(e => e.materiel.includes("poids_du_corps")), `${c} : rien au poids du corps`);
    else assert.ok(l.some(e => e.materiel.includes("barre_traction")), "TV : rien à la barre de traction");
    assert.ok(l.some(e => e.niveau === "debutant"), `${c} : rien pour un débutant`);
  }
});

test("flexion de genou à la maison : au moins 4 solutions au poids du corps", () => {
  const l = X.filtrer({ pattern: "FG", materiel: "poids_du_corps" });
  assert.ok(l.length >= 4, l.map(e => e.nom).join(", "));
  assert.ok(l.some(e => e.niveau === "debutant"));
});

test("isolation : les 7 catégories ; modules : les 5 catégories", () => {
  const cats = (c) => new Set(DATA.filter(e => e.couche === c).map(e => e.categorie));
  assert.deepEqual([...cats("isolation")].sort(), ["abdos", "avant_bras", "biceps", "deltoides_posterieurs", "elevations_laterales", "mollets", "triceps"]);
  assert.deepEqual([...cats("module")].sort(), ["cardio", "mobilite", "portes", "rotation", "unilateral"]);
});

test("variantes liées : elles existent, partagent le même pattern et sont réciproques", () => {
  for (const e of DATA) for (const s of e.variantes) {
    const v = X.exercice(s);
    assert.ok(v, `${e.nom} → ${s} introuvable`);
    assert.equal(X.groupeDe(v), X.groupeDe(e), `${e.nom} → ${v.nom}`);
    assert.ok(v.variantes.includes(e.slug), `${v.nom} ne renvoie pas vers ${e.nom}`);
  }
});

test("les noms correspondent aux fiches de l'app (sauf les 3 solutions maison ajoutées pour la flexion de genou)", () => {
  const hors = DATA.filter(e => !FICHES[e.nom]).map(e => e.nom);
  assert.equal(hors.length, 3, hors.join(", "));
  assert.ok(hors.every(n => X.exercice(n).pattern_principal === "FG"));
});

test("alternatives : même pattern, jamais l'exercice lui-même, accepte un nom, un slug ou l'objet", () => {
  const a = X.alternatives("Développé couché barre");
  assert.ok(a.length >= 5);
  assert.ok(a.every(e => e.pattern_principal === "PH" && e.nom !== "Développé couché barre"));
  assert.deepEqual(X.alternatives("developpe-couche-barre"), a);
  assert.deepEqual(X.alternatives(X.exercice("Développé couché barre")), a);
  assert.deepEqual(X.alternatives("Exercice inconnu"), []);
  assert.ok(a[0].slug && X.exercice("Développé couché barre").variantes.includes(a[0].slug), "les variantes liées passent en premier");
});

test("alternatives : filtre par matériel", () => {
  const maison = X.alternatives("Leg curl assis", { materiel: ["poids_du_corps"] });
  assert.ok(maison.length >= 4 && maison.every(e => e.materiel.includes("poids_du_corps")));
  assert.ok(!maison.some(e => e.nom === "Leg curl allongé"));
  const mixte = X.alternatives("Tirage vertical poulie", { materiel: ["poids_du_corps", "barre_traction"] });
  assert.ok(mixte.some(e => e.nom === "Tractions assistées élastique"));
  assert.ok(mixte.every(e => e.materiel.includes("barre_traction") || e.materiel.includes("poids_du_corps")));
  assert.deepEqual(X.alternatives("Tirage vertical poulie", { materiel: "barre_traction" }), X.alternatives("Tirage vertical poulie", { materiel: ["barre_traction"] }));
});

test("alternatives : filtre par contre-indications et exclusions", () => {
  const a = X.alternatives("Développé couché barre", { contreIndications: ["epaule"] });
  assert.ok(a.length >= 3 && a.every(e => !e.contre_indications.includes("epaule")));
  assert.ok(!a.some(e => e.nom === "Dips (poids de corps)"));
  const b = X.alternatives("Squat barre haute (high bar)", { contreIndications: ["genou"], materiel: ["poids_du_corps"] });
  assert.deepEqual(b.map(e => e.nom), ["Squat poids de corps"]);
  const c = X.alternatives("Développé couché barre", { exclure: ["Pompes", "chest-press-machine"] });
  assert.ok(!c.some(e => ["Pompes", "Chest press machine"].includes(e.nom)));
});

test("alternatives : isolation et modules restent dans leur catégorie ; un exercice désactivé n'est plus proposé", () => {
  assert.ok(X.alternatives("Curl barre EZ").every(e => e.categorie === "biceps"));
  assert.ok(X.alternatives("Pallof press poulie").every(e => e.categorie === "rotation"));
  X.exercice("Pompes").actif = false;
  assert.ok(!X.alternatives("Développé couché barre").some(e => e.nom === "Pompes"));
  assert.equal(X.filtrer({ pattern: "PH", inactifs: false }).some(e => e.nom === "Pompes"), false);
  reset();
});

test("filtre de la vue : pattern (principal ou secondaire), couche, matériel, recherche sans accents", () => {
  assert.equal(X.filtrer({}).length, DATA.length);
  assert.ok(X.filtrer({ pattern: "PV" }).some(e => e.nom === "Développé incliné haltères"), "pattern secondaire inclus");
  assert.ok(X.filtrer({ couche: "isolation" }).every(e => e.couche === "isolation"));
  assert.ok(X.filtrer({ materiel: "barre_traction" }).every(e => e.materiel.includes("barre_traction")));
  assert.ok(X.filtrer({ q: "developpe couche" }).some(e => e.nom === "Développé couché barre"));
  assert.ok(X.filtrer({ q: "ischios" }).length >= 8);
  const n = X.compterParPattern();
  assert.equal(Object.values(n).reduce((a, b) => a + b, 0), DATA.filter(e => e.couche === "squelette").length);
});

test("élastiques : une option à part, réservée aux exercices qui ne demandent que cela", () => {
  const el = X.filtrer({ materiel: "elastique" });
  assert.ok(el.length >= 5 && el.every(e => e.materiel.includes("elastique")));
  assert.ok(DATA.filter(e => /élastique/i.test(e.nom)).every(e => e.materiel.includes("elastique") || e.materiel.includes("barre_traction")), "un exercice élastique hors option élastique");
  assert.ok(!X.filtrer({ materiel: "halteres_maison" }).some(e => e.materiel.length === 1 && e.materiel[0] === "elastique"));
});
