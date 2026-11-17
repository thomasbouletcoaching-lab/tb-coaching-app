// Tests du moteur « athlète hybride » : node --test tests/hybride.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "../js/hybride.js";

const D = JSON.parse(readFileSync(new URL("../data/hybride.json", import.meta.url), "utf8"));
const EX = JSON.parse(readFileSync(new URL("../data/exercices.json", import.meta.url), "utf8")).ex;
const ex = (slug) => { const e = EX.find(x => x.slug === slug); assert.ok(e, `exercice absent : ${slug}`); return e; };
const g = (id) => D.groupes.find(x => x.id === id);

test("données : 7 qualités, hypothèses en tête, groupes complets", () => {
  assert.deepEqual(D.qualites.map(q => q.id), ["hypertrophie", "force", "puissance", "vitesse", "endurance", "skills", "prevention"]);
  assert.equal(Object.keys(D)[2], "hypotheses");
  for (const x of D.groupes) {
    assert.ok(x.maintien[0] <= x.maintien[1] && x.dev[0] <= x.dev[1], x.id);
    assert.ok(x.tags || x.re || x.cats, `${x.id} : aucune façon de le reconnaître`);
    assert.ok(D.qualites.some(q => q.id === x.qualite), x.id);
  }
  for (const id of ["coiffe", "cou", "tib", "avb", "add"]) assert.equal(g(id).qualite, "prevention", id);
  for (const m of D.macros) assert.ok(m.dev.length <= 2, `${m.id} : plus de 2 qualités en développement`);
  assert.equal(JSON.stringify(D).match(/92 ?kg|bébé|Timothée/), null, "aucune donnée personnelle dans le fichier public");
});

test("calendrier : 12 semaines, 3 mésos, S4 décharge, tests VMA en S4 et S12", () => {
  const c = H.calendrier(D, { debut: "2026-12-02", macroId: "M1" });
  assert.equal(c.length, 12);
  assert.equal(c[0].du, "2026-11-30"); // ramené au lundi
  assert.deepEqual(c.map(s => s.meso), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  assert.deepEqual(c.map(s => s.rir), [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4]);
  assert.deepEqual(c.filter(s => s.decharge).map(s => s.n), [4, 8, 12]);
  assert.ok(c[3].tests.includes("vma") && c[11].tests.includes("vma"));
  assert.equal(H.position(c, "2026-11-29"), null);
  assert.equal(H.position(c, "2026-12-09").n, 2);
  assert.equal(H.position(c, "2026-12-09").jour, 2);
  assert.deepEqual(H.position(c, "2027-03-01"), { fini: true });
  assert.throws(() => H.calendrier(D, { debut: "2026-12-01", macroId: "M9" }));
});

test("statuts : 2 qualités en développement au maximum, les autres en maintien", () => {
  const s = H.statutsQualites(D, "M2");
  assert.equal(Object.values(s).filter(x => x === "dev").length, 2);
  assert.equal(s.force, "dev"); assert.equal(s.hypertrophie, "maintien");
  const gr = H.statutGroupes(D, { macroId: "M1" });
  assert.equal(gr.quad, "dev"); assert.equal(gr.coiffe, "maintien");
  const pr = H.statutGroupes(D, { macroId: "M1", prioritaires: ["quad", "dos"] });
  assert.equal(pr.quad, "dev"); assert.equal(pr.pecs, "maintien");
});

test("progression du méso : S1 bas, S2 milieu, S3 haut, S4 volume ÷ 2", () => {
  const q = g("quad");
  assert.equal(H.cibleGroupe(D, q, "dev", 1).cible, 8);
  assert.equal(H.cibleGroupe(D, q, "dev", 2).cible, 11);
  assert.equal(H.cibleGroupe(D, q, "dev", 3).cible, 14);
  const s4 = H.cibleGroupe(D, q, "dev", 4);
  assert.equal(s4.cible, 7); assert.ok(s4.decharge); assert.equal(s4.rir, 4);
  assert.equal(H.cibleGroupe(D, q, "maintien", 3).cible, 4);
  assert.equal(H.cibleGroupe(D, q, "maintien", 4).cible, 2);
  assert.throws(() => H.cibleGroupe(D, q, "dev", 5));
});

test("plafond selon le nombre de séances : 3 séances ≈ 8 séries par grand groupe", () => {
  const q = g("quad");
  assert.equal(H.cibleGroupe(D, q, "dev", 3, { nbSeances: 3 }).cible, 8);
  assert.equal(H.cibleGroupe(D, q, "dev", 1, { nbSeances: 3 }).cible, 8);
  assert.equal(H.cibleGroupe(D, q, "dev", 3, { nbSeances: 4 }).cible, 10);
  assert.equal(H.cibleGroupe(D, g("dlat"), "dev", 3, { nbSeances: 3 }).cible, 12, "petit groupe : pas de plafond");
});

test("méso suivant : repart de S2 si la récupération a suivi, sinon du même départ", () => {
  const q = g("quad");
  assert.equal(H.departMesoSuivant(D, q, "dev", { recuperationOk: true }), 11);
  assert.equal(H.departMesoSuivant(D, q, "dev", { recuperationOk: false, depart: null }), null);
  const c = H.cibles(D, { macroId: "M1", semaine: 1, departs: { quad: 11 } });
  assert.equal(c.quad.cible, 11);
});

test("volume pondéré : 1 principal, 0,5 synergistes, groupes « directs »", () => {
  const p = H.poidsExercice(D, ex("developpe-couche-barre"));
  assert.deepEqual(p, { pecs: 1, tri: 0.5, dant: 0.5 });
  const v = H.volume(D, [{ ex: ex("developpe-couche-barre"), series: 4 }, { ex: ex("muscle-up"), series: 3 }, { ex: ex("front-lever-groupe-tuck"), series: 5 }]);
  assert.equal(v.pecs, 5.5);   // 4 + 3 × 0,5
  assert.equal(v.dos, 8);      // muscle-up 3 + front lever 5
  assert.equal(v.abs, 2.5);    // front lever 5 × 0,5
  assert.equal(v.tri, 0, "triceps : seules les séries directes comptent");
  assert.equal(v.dant, 0);
});

test("petits muscles reconnus : tibial, coiffe, psoas, cou", () => {
  assert.equal(H.poidsExercice(D, ex("tibial-raise-releveurs")).tib, 1);
  assert.equal(H.poidsExercice(D, ex("tibial-raise-releveurs")).mol, 0.5);
  assert.equal(H.poidsExercice(D, ex("rotation-externe-elastique")).coiffe, 1);
  assert.equal(H.poidsExercice(D, ex("releve-de-jambes-suspendu")).psoas, 1);
  assert.equal(H.poidsExercice(D, ex("releve-de-jambes-suspendu")).abs, 1);
  assert.equal(H.poidsExercice(D, ex("flexion-du-cou-allonge")).cou, 1);
});

test("lignes depuis les séances terminées : échauffements et séries non faites exclus, fenêtre de dates", () => {
  const w = [
    { end: "2026-12-01T10:00:00Z", exercises: [{ name: "Développé couché barre", sets: [{ type: "W", done: true }, { done: true }, { done: true }, { done: false }] }] },
    { end: "2026-12-10T10:00:00Z", exercises: [{ name: "Développé couché barre", sets: [{ done: true }] }] },
  ];
  const by = (n) => EX.find(x => x.nom === n);
  const l = H.lignesDepuisSeances(w, by, { du: "2026-11-30", au: "2026-12-06" });
  assert.equal(l.length, 1); assert.equal(l[0].series, 2);
});

test("alertes : poussée / tirage, genou / hanche, sous le maintien, plafond, total", () => {
  const C = H.cibles(D, { macroId: "M1", semaine: 3 });
  const L = [{ ex: ex("developpe-couche-barre"), series: 16 }, { ex: ex("rowing-barre-prise-snatch"), series: 4 }, { ex: ex("pompes-en-equilibre-handstand-push-up"), series: 3 }];
  const a = H.alertes(D, { lignes: L, cibles: C });
  const ids = a.map(x => x.id);
  assert.ok(ids.includes("poussee-horizontal"));
  assert.ok(ids.includes("poussee-vertical"), "HSPU sans tirage vertical");
  assert.ok(ids.includes("plafond-pecs"), "16 séries > 14");
  assert.ok(ids.includes("sous-quad"));
  assert.ok(!ids.some(i => i.endsWith("dant")), "deltoïde antérieur : jamais d'alerte");
  const genou = H.alertes(D, { lignes: [{ ex: { nom: "Squat", pattern_principal: "SG", muscles: ["Quadriceps"] }, series: 10 }, { ex: { nom: "RDL", pattern_principal: "CH", muscles: ["Ischios"] }, series: 3 }] });
  assert.ok(genou.some(x => x.id === "genou"));
  const eq = H.alertes(D, { lignes: [{ ex: ex("developpe-couche-barre"), series: 6 }, { ex: ex("rowing-barre-prise-snatch"), series: 6 }] });
  assert.ok(!eq.some(x => x.id.startsWith("poussee")));
  const tot = H.alertes(D, { lignes: [{ ex: { nom: "x" }, series: 60 }], nbSeances: 3 });
  assert.ok(tot.some(x => x.id === "total"));
});

test("gabarits 3 à 6 séances : tous respectent les règles d'ordre, en reprise comme après", () => {
  for (const n of [3, 4, 5, 6]) {
    const s = H.gabarit(D, n).seances;
    assert.equal(s.length, n);
    for (const sm of [1, 2, 5, 6]) assert.deepEqual(H.verifierSemaine(D, s, { semaineMacro: sm, reprise: true }), [], `${n} séances, semaine ${sm}`);
  }
  assert.throws(() => H.gabarit(D, 2));
});

test("règles : nerveux en premier, pas d'intervalles la veille des jambes lourdes, zone 2 à vélo", () => {
  const mauvais = [
    { jour: 0, nom: "Jambes", jambesLourdes: true, blocs: ["echauffement", "force", "vitesse"] },
    { jour: 6, nom: "Intervalles", blocs: ["cardio"], cardio: { zone: "Z5", modalite: "course" } },
    { jour: 2, nom: "Z2", blocs: ["cardio"], cardio: { zone: "Z2", modalite: "course" } },
  ];
  const r = H.verifierSemaine(D, mauvais).map(x => x.regle);
  assert.ok(r.includes("ordre")); assert.ok(r.includes("veille")); assert.ok(r.includes("z2"));
});

test("reprise de la course : zone 2 seulement les 4 premières semaines, intervalles ensuite", () => {
  const sam = H.gabarit(D, 6).seances.find(s => s.jour === 5);
  assert.equal(H.cardioEffectif(D, sam, { semaineMacro: 3, reprise: true }).zone, "Z2");
  assert.equal(H.cardioEffectif(D, sam, { semaineMacro: 5, reprise: true }).zone, "Z5");
  const fbC = H.gabarit(D, 3).seances[2];
  const c = H.cardioEffectif(D, fbC, { semaineMacro: 2, reprise: true });
  assert.equal(c.zone, "Z2"); assert.ok(c.remplace);
});

test("allures : zones en % de VMA, demi-Cooper", () => {
  const a = H.allures(D, 15);
  const z2 = a.find(z => z.id === "Z2");
  assert.deepEqual(z2.kmh, [9, 10.8]);
  assert.equal(z2.allure[1], "6:40");
  assert.equal(H.vmaDemiCooper(1550), 15.5);
  assert.equal(H.zoneDe(D, 15, 10), "Z2");
  assert.equal(H.zoneDe(D, 15, 14.5), "Z5");
  assert.deepEqual(H.allures(D, 0), []);
});

test("forme du jour : on retire des accessoires, on garde les principaux, pas de sprint en orange", () => {
  const seance = { blocs: [
    { id: "echauffement", exercices: [{ nom: "Gammes", role: "principal" }] },
    { id: "vitesse", exercices: [{ nom: "Accélérations 20 m", role: "principal" }] },
    { id: "force", exercices: [{ nom: "Squat", role: "principal", max: true }] },
    { id: "hypertrophie", exercices: [{ nom: "Leg curl", role: "accessoire" }, { nom: "Mollets", role: "accessoire" }, { nom: "Fente", role: "accessoire" }] },
  ] };
  const v = H.formeDuJour(D, seance, "vert");
  assert.deepEqual(v.retires, []); assert.equal(v.seance.blocs.length, 4);
  const o = H.formeDuJour(D, seance, "orange");
  assert.ok(o.retires.includes("Accélérations 20 m"));
  assert.ok(o.retires.includes("Fente"));
  const garde = o.seance.blocs.flatMap(b => b.exercices.map(e => e.nom));
  assert.ok(garde.includes("Squat") && garde.includes("Gammes"));
  assert.equal(o.seance.blocs.find(b => b.id === "force").exercices[0].max, false);
  const r = H.formeDuJour(D, seance, "rouge");
  assert.equal(r.seance.blocs.find(b => b.id === "hypertrophie").exercices.length, 1);
  assert.equal(seance.blocs.length, 4, "l'original n'est pas modifié");
  assert.throws(() => H.formeDuJour(D, seance, "bleu"));
});

test("programme en cours : jamais remplacé sans accord, l'ancien est gardé en copie", () => {
  const e0 = { hybride: { courant: { macroId: "M1" }, anciens: [] } };
  const refus = H.remplacerProgramme(e0, { macroId: "M2" });
  assert.equal(refus.ok, false); assert.equal(refus.etat, e0);
  const ok = H.remplacerProgramme(e0, { macroId: "M2" }, { accord: true, maintenant: "2026-12-01T00:00:00Z" });
  assert.equal(ok.etat.hybride.courant.macroId, "M2");
  assert.equal(ok.etat.hybride.anciens[0].macroId, "M1");
  assert.equal(e0.hybride.courant.macroId, "M1", "l'état d'origine n'est pas modifié");
  assert.ok(H.remplacerProgramme({}, { macroId: "M1" }).ok, "premier programme : pas besoin d'accord");
  const vieux = { macroId: "M1", debut: "2026-12-01" };
  const lu = H.lire(vieux);
  assert.equal(lu.courant.migreDe, 0); assert.equal(vieux.v, undefined, "ancien format lu sans être modifié");
});
