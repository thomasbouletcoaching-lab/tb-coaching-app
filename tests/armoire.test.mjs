// Tests de l'armoire à trophées (données fictives)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "../js/armoire.js";
import * as AN from "../js/animaux.js";

const serie = (reps, kg = 0, extra = {}) => ({ done: true, reps, kg, ...extra });
const seance = (d, exos) => ({ end: d + "T10:00:00Z", exercises: exos.map(([name, sets]) => ({ name, sets })) });
const st = {
  workouts: [
    seance("2026-10-01", [["Développé couché barre", [serie(5, 100, { type: "W" }), serie(5, 82.5)]], ["Squat barre", [serie(3, 100)]], ["Tractions pronation (poids de corps)", [serie(11)]]]),
    seance("2026-10-08", [["Développé couché haltères", [serie(8, 45)]], ["Soulevé de terre roumain barre", [serie(8, 150)]], ["Muscle-up strict", [serie(1)]], ["Équilibre libre (handstand)", [serie(0, 0, { sec: 12 })]], ["Course zone 2", [serie(0, 0, { min: 40 })]]]),
    seance("2026-10-09", [["Pompes sur les genoux", [serie(60)]], ["Tractions assistées élastique", [serie(30)]], ["Dips (poids de corps)", [{ done: false, reps: 40 }]]]),
  ],
  daily: { "2026-09-20": { weight: 80, cardio: [{ n: "Footing", min: 65 }, { n: "Vélo", min: 90 }] }, "2026-10-05": { cardio: [{ n: "Fractionné VMA", min: 30 }] } },
};
const reg = { sessions: 12, streak: 8, comebacks: 3, proteinDays: 0, crises: 1, points: 300 };

test("armoire : force réelle, sans échauffement ni variantes exclues", () => {
  const s = A.stats(st, reg);
  assert.equal(s.max.couche, 82.5, "échauffement à 100 kg ignoré, haltères exclus");
  assert.equal(s.max.squat, 100); assert.equal(s.max.terre, 0, "roumain exclu");
  assert.equal(s.reps.tractions, 11, "assistées exclues"); assert.equal(s.reps.pompes, 0, "sur les genoux exclues"); assert.equal(s.reps.dips, 0, "série non faite");
  assert.ok(s.faits.has("muscle-up") && s.faits.has("handstand"));
  assert.deepEqual(s.course, { sorties: 3, heures: 2, plusLongue: 65 }, "vélo exclu");
});
test("armoire : badges, XP et niveau", () => {
  const a = A.armoire(st, reg);
  const ok = new Set(a.obtenus.map(b => b.id));
  for (const id of ["couche-1", "couche-2", "couche-3", "squat-3", "tractions-3", "seances-2", "serie-2", "reprises-2", "skill-muscle-up", "skill-handstand", "skill-honnete", "sortie-longue-3"]) assert.ok(ok.has(id), id);
  for (const id of ["couche-4", "squat-4", "tractions-4", "sortie-longue-4"]) assert.ok(!ok.has(id), id);
  assert.equal(a.xp, 300 + a.xpBadges); assert.equal(a.niveau, A.niveauDe(a.xp));
  assert.ok(a.pct >= 0 && a.pct <= 100 && a.reste > 0);
  assert.ok(!a.badges.some(b => b.cat === "relatif"), "badges selon le poids éteints par défaut");
  const couche = a.familles.find(f => f.id === "couche");
  assert.equal(couche.atteint.niveau, "or"); assert.equal(couche.prochain.seuil, 100); assert.equal(couche.pct, 83);
});
test("armoire : badges selon le poids de corps, seulement si activés, poids jamais exposé", () => {
  const a = A.armoire(st, reg, { poids: true });
  assert.equal(a.stats.rel.couche, 1.03); assert.equal(a.stats.rel.squat, 1.25);
  const ok = new Set(a.obtenus.map(b => b.id));
  assert.ok(ok.has("couche-relatif-3") && !ok.has("couche-relatif-4") && ok.has("squat-relatif-2") && !ok.has("squat-relatif-3"));
  const rel = a.badges.filter(b => b.cat === "relatif");
  assert.ok(rel.length === 20 && rel.every(b => !/kg/.test(b.libelle) && b.valeur < 10), "rapport seulement, jamais le poids");
  // Le poids ne fait jamais monter de niveau : aucun XP pour ces badges, jamais épinglés
  assert.equal(a.xp, A.armoire(st, reg).xp, "même XP avec ou sans les badges selon le poids");
  assert.deepEqual(A.profilArmoire({ epingles: ["couche-relatif-1", "couche-1"] }, a).epingles, ["couche-1"]);
  // Poids trop ancien (plus de 120 jours) : pas de rapport
  const vieux = { ...st, daily: { "2026-01-01": { weight: 80 } } };
  assert.equal(A.stats(vieux, reg, { poids: true }).rel.couche, 0);
});
test("armoire : animaux débloqués et profil", () => {
  const vide = A.armoire({}, {});
  assert.deepEqual(A.animauxDebloques(vide), ["renard", "ours", "loup"]);
  assert.equal(vide.niveau, 1); assert.equal(vide.obtenus.length, 0);
  const a = A.armoire(st, reg), deb = A.animauxDebloques(a);
  assert.ok(deb.includes("taureau") && deb.includes("phenix") && deb.includes("gorille"), deb.join());
  assert.ok(!deb.includes("aigle") && !deb.includes("dragon"));
  assert.deepEqual(A.profilArmoire({ animal: "dragon", epingles: ["couche-3", "couche-3", "faux", "squat-3", "seances-1", "serie-1"] }, a), { animal: "renard", epingles: ["couche-3", "squat-3", "seances-1"] });
  assert.equal(A.profilArmoire({ animal: "taureau" }, a).animal, "taureau");
  for (const x of A.DEBLOCAGES) assert.ok(AN.ANIMAUX[x.id], x.id);
});
test("armoire : amplitudes partielles et sprints hors course exclus", () => {
  const x = { workouts: [seance("2026-10-01", [["Développé couché barre aux planches (board press)", [serie(1, 140)]], ["Soulevé de terre sur blocs (block pull)", [serie(1, 250)]], ["Sprint vélo", [serie(0, 0, { min: 20 })]]])] };
  const s = A.stats(x, {});
  assert.equal(s.max.couche, 0); assert.equal(s.max.terre, 0); assert.equal(s.course.sorties, 0);
});
test("armoire : rapide même avec 1000 séances et 800 jours de poids", () => {
  const daily = {}, workouts = [];
  for (let i = 0; i < 800; i++) { const d = new Date(Date.UTC(2024, 0, 1) + i * 864e5).toISOString().slice(0, 10); daily[d] = { weight: 80 }; }
  for (let i = 0; i < 1000; i++) workouts.push(seance(new Date(Date.UTC(2024, 0, 1) + (i % 800) * 864e5).toISOString().slice(0, 10), [["Développé couché barre", [serie(5, 80)]], ["Squat barre", [serie(5, 100)]], ["Soulevé de terre", [serie(5, 120)]]]));
  const t0 = performance.now(); A.armoire({ workouts, daily }, {}, { poids: true }); assert.ok(performance.now() - t0 < 200, "moins de 200 ms");
});
test("armoire : nouveaux badges et données corrompues", () => {
  const a = A.armoire(st, reg);
  assert.equal(A.nouveaux(a, a.obtenus.map(b => b.id)).length, 0);
  assert.equal(A.nouveaux(a, null).length, a.obtenus.length);
  const bizarre = { workouts: [null, 3, { end: "pas une date" }, { end: "2026-10-01", exercises: [null, { name: "Squat barre", sets: [null, { done: true, reps: 1, kg: 1e9 }] }] }], daily: { x: null, "2026-10-01": { cardio: "non", weight: "abc" } } };
  const b = A.armoire(bizarre, { sessions: "x" });
  assert.equal(b.stats.max.squat, 0); assert.equal(b.niveau, 1);
});
test("armoire : chaque catégorie a son pictogramme, chaque médaille se dessine", () => {
  for (const b of A.armoire(st, reg, { poids: true }).badges) {
    assert.ok(AN.PICTOS[b.cat], b.cat);
    assert.match(AN.medaille(b.cat, b.niveau, { titre: b.nom }), /^<svg/);
  }
  assert.doesNotMatch(AN.medaille("force", "or", { titre: '"><script>' }), /<script/);
  assert.doesNotMatch(AN.medaillon("renard", { titre: '"><b>' }), /<b>/);
});

test("C73 : dips lestés (1RM), incliné, rowing, hip thrust, haltérophilie comptés", () => {
  const w = (name, kg, reps = 1) => ({ end: "2026-11-20T18:00:00Z", exercises: [{ name, sets: [{ done: true, kg, reps }] }] });
  const s = A.stats({ workouts: [w("Dips lestés", 42), w("Dips lestés — lockout", 90), w("Développé incliné barre", 72, 5), w("Rowing penché debout à la barre", 81, 8), w("Hip thrust barre", 150, 6), w("Arraché", 55), w("Épaulé-jeté", 70)] });
  assert.equal(s.max.dipsLestes, 42, "le lockout (amplitude partielle) ne compte pas");
  assert.equal(s.max.incline, 72); assert.equal(s.max.rowing, 81); assert.equal(s.max.hipThrust, 150); assert.equal(s.max.arrache, 55); assert.equal(s.max.epj, 70);
  const b = A.armoire({ workouts: [w("Dips lestés", 42)] }).badges.filter(x => x.famille === "dips-lestes" && x.ok).map(x => x.niveau);
  assert.deepEqual(b, ["bronze", "argent", "or"]);
});
