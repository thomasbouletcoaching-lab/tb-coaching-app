// Tests du moteur « Objectif » (node --test tests/objectif.test.mjs). Données fictives uniquement.
import test from "node:test";
import assert from "node:assert/strict";
import * as O from "../js/objectif.js";

const pay = (d, amount, paid = true) => ({ d, amount, paid });

test("encaissé : seuls les paiements marqués encaissés, par mois ou par année", () => {
  const P = [pay("2026-11-02", 540), pay("2026-11-20", 540, false), pay("2026-10-05", 100), pay("2025-11-02", 999)];
  assert.equal(O.encaisse(P, "2026-11"), 540);
  assert.equal(O.encaisse(P, "2026"), 640);
  assert.equal(O.encaisse([], "2026"), 0);
});

test("mois en cours : encaissé, attendu, retards", () => {
  const P = [pay("2026-11-02", 540), pay("2026-11-20", 540, false), pay("2026-11-03", 89, false), pay("2026-10-01", 60, false)];
  const e = O.etatMois(P, "2026-11-08");
  assert.equal(e.encaisse, 540);
  assert.deepEqual([e.aVenir, e.nAVenir], [540, 1]);
  assert.deepEqual([e.retard, e.nRetard], [149, 2]);
});

test("mois précédents, y compris à cheval sur l'année", () => {
  assert.deepEqual(O.moisPrecedents("2026-02-10", 3), ["2026-01", "2025-12", "2025-11"]);
});

test("rythme : moyenne des mois complets avec encaissements, sinon mois en cours", () => {
  const P = [pay("2026-10-01", 3000), pay("2026-09-01", 1000), pay("2026-11-01", 50000)];
  assert.equal(O.rythme(P, "2026-11-08").parMois, 2000);
  assert.equal(O.rythme([pay("2026-11-01", 700)], "2026-11-08").parMois, 700);
  assert.equal(O.rythme([], "2026-11-08").parMois, 0);
});

test("seuils : dépassé, franchissement prévu cette année, ou pas", () => {
  // 30 000 € encaissés de janvier à juin (5 000 €/mois), on est le 1er juillet
  const P = ["01", "02", "03", "04", "05", "06"].map((m) => pay(`2026-${m}-15`, 5000));
  const s = O.seuilsAnnee(P, "2026-07-01");
  assert.equal(s.cumul, 30000);
  assert.equal(s.rythme.parMois, 5000);
  const tva = s.seuils.find((x) => x.id === "tva"), micro = s.seuils.find((x) => x.id === "micro");
  assert.equal(tva.statut, "proche");
  assert.equal(tva.prevu, "2026-08"); // 7 500 € restants à 5 000 €/mois → environ 1,5 mois
  assert.equal(micro.prevu, null);    // 53 600 € restants : pas avant la fin de l'année
  assert.equal(micro.statut, "ok");
  const s2 = O.seuilsAnnee([pay("2026-03-01", 40000)], "2026-04-01");
  assert.equal(s2.seuils.find((x) => x.id === "tva").statut, "depasse");
  assert.equal(s2.seuils.find((x) => x.id === "tva-maj").statut, "proche");
});

test("seuils 2026 conformes aux sources citées", () => {
  assert.deepEqual(O.SEUILS.liste.map((s) => s.montant), [37500, 41250, 83600]);
});

test("cycles en cours et revenu mensuel", () => {
  const C = [
    { start: "2026-10-01", weeks: 12, price: 540, split: "mois" },   // en cours
    { start: "2026-06-01", weeks: 12, price: 1620, split: "total" },  // terminé
    { start: "2026-11-01", weeks: 13, price: 1300, split: "total" },  // en cours : 1 300 € / (13 / 4,33 mois) = 433 €/mois
    { start: "2026-12-01", weeks: 12, price: 540, split: "mois" },   // pas commencé
  ];
  assert.equal(O.finCycle(C[0]), "2026-12-23");
  const r = O.revenuCycles(C, "2026-11-08");
  assert.equal(r.n, 2);
  assert.equal(r.parMois, 973);
});

test("plan : places libres valorisées, puis complément en abonnés", () => {
  const p = O.plan({ objectif: 10000, cycles: { n: 6, parMois: 3240 }, app: 300, places: 10, prixCycleMois: 540, formules: [{ id: "leger", nom: "Coaching léger", prix: 89 }, { id: "premium", nom: "Premium", prix: 9.99 }] });
  assert.equal(p.recurrent, 3540);
  assert.equal(p.manque, 6460);
  assert.equal(p.placesLibres, 4);
  assert.equal(p.placesUtiles, 4);
  assert.equal(p.apportPlaces, 2160);
  assert.equal(p.reste, 4300);
  assert.equal(p.capaciteMax, 5700);
  assert.equal(p.capaciteSuffit, false);
  assert.deepEqual(p.complements.map((f) => f.n), [49, 431]);
});

test("plan : objectif atteint, rien ne manque", () => {
  const p = O.plan({ objectif: 3000, cycles: { n: 6, parMois: 3240 }, places: 10, prixCycleMois: 540 });
  assert.equal(p.manque, 0);
  assert.equal(p.placesUtiles, 0);
  assert.equal(p.pct, 100);
});

test("acquisition : nouveaux clients et appels par mois", () => {
  assert.deepEqual(O.besoinAcquisition({ places: 10, dureeMois: 3 }), { nouveaux: 3.3, appels: null });
  assert.deepEqual(O.besoinAcquisition({ places: 10, dureeMois: 3, renouvellement: 0.5, signature: 1 / 3 }), { nouveaux: 1.7, appels: 6 });
});

test("source d'une demande : src, puis utm_source, puis origine", () => {
  assert.equal(O.sourceDe({ data: { src: "reel-1RM", utm_source: "instagram" } }), "reel-1rm");
  assert.equal(O.sourceDe({ data: { utm_source: "Instagram" } }), "instagram");
  assert.equal(O.sourceDe({ data: { origine: "site" } }), "site");
  assert.equal(O.sourceDe({}), "inconnue");
});

test("entonnoir : statuts, sources, taux de signature, fenêtre de temps", () => {
  const L = [
    { created_at: "2026-11-01T10:00:00Z", status: "client", data: { src: "reel-1rm", demande: "candidature" } },
    { created_at: "2026-10-20T10:00:00Z", status: "pas pour moi", data: { src: "reel-1rm", demande: "candidature" } },
    { created_at: "2026-10-15T10:00:00Z", status: "appel prévu", data: { src: "bio" } },
    { created_at: "2026-10-10T10:00:00Z", status: "nouveau", data: { origine: "site", demande: "calculateur" } },
    { created_at: "2026-01-01T10:00:00Z", status: "client", data: { src: "ancien" } }, // hors fenêtre
  ];
  const e = O.entonnoir(L, "2026-11-08", 90);
  assert.equal(e.total, 4);
  assert.equal(e.parStatut.client, 1);
  assert.equal(e.appels, 3);
  assert.equal(e.signature, 0.5);
  assert.equal(e.sources[0].source, "reel-1rm");
  assert.deepEqual([e.sources[0].n, e.sources[0].clients, e.sources[0].candidatures], [2, 1, 2]);
  assert.equal(O.entonnoir([], "2026-11-08").signature, null);
});
