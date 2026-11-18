// Tests du module pur js/social.js : partage, parrainage, filtre anti-contacts, jeu d'encouragements.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as SO from "../js/social.js";

const seance = {
  title: "Push A · insta @bigbro", start: "2026-11-18T17:00:00Z", end: "2026-11-18T18:05:00Z", volume: 8450, setsDone: 18,
  records: [{ name: "Développé couché", before: 90, after: 95 }],
  exercises: [
    { name: "Développé couché", sets: [{ done: true, type: "W", kg: 40, reps: 10 }, { done: true, kg: 90, reps: 5 }], recsHit: [{ k: "kg" }] },
    { name: "Dips", sets: [{ done: true, reps: 12 }] },
    { name: "Écarté poulie", sets: [{ done: false, reps: 12 }] },
  ],
  notes: "douleur épaule", bodyweight: 82,
};

test("récap public : durée, séries, tonnage, records ; aucun contact, aucune donnée de corps", () => {
  const r = SO.recapSeance(seance, { medaille: "Or" });
  assert.equal(r.min, 65); assert.equal(r.series, 18); assert.equal(r.tonnes, 8.5); assert.equal(r.exos, 2);
  assert.deepEqual(r.records, ["Développé couché"]); assert.equal(r.medaille, "Or"); assert.equal(r.d, "2026-11-18");
  assert.equal(r.titre, "Push A ·");
  const json = JSON.stringify(r);
  assert.ok(!/@|insta|douleur|82|bodyweight|notes/.test(json), json);
  assert.equal(SO.recapSeance(seance, { medaille: "Titane" }).medaille, null);
});

test("filtre anti-contacts : liens, e-mails, @comptes, numéros, réseaux", () => {
  const cas = ["mon insta: @thomas.fit", "écris-moi jean.dupont@mail.fr", "06 12 34 56 78", "+33612345678", "www.monsite.fr", "https://x.co/abc", "snap thomasfit", "go sur monlien.bio/x", "whatsapp 0612345678", "t.me/groupe"];
  for (const c of cas) { assert.ok(SO.contientContact(c), c); assert.ok(!/@|\d{6}|www|http|insta|snap|\.fr|\.bio|whatsapp|t\.me/i.test(SO.sansContact(c)), c + " → " + SO.sansContact(c)); }
  for (const c of ["Full body A", "Jambes 5x5 lourd", "Push · 3 x 8-12", "Séance du 18/11"]) { assert.equal(SO.contientContact(c), false, c); assert.equal(SO.sansContact(c), c); }
  assert.equal(SO.sansContact("<script>"), "script");
  assert.equal(SO.sansContact("a".repeat(100), 10).length, 10);
});

test("pseudo : longueur, caractères, pas de numéro ni de réseau", () => {
  assert.equal(SO.pseudoErreur("Tom B."), null);
  assert.equal(SO.pseudoErreur("Éloïse_92"), null);
  assert.ok(SO.pseudoErreur("x"));
  assert.ok(SO.pseudoErreur("a".repeat(21)));
  assert.ok(SO.pseudoErreur("tom@gmail"));
  assert.ok(SO.pseudoErreur("0612345678"));
  assert.ok(SO.pseudoErreur("insta tomfit"));
  assert.ok(SO.pseudoErreur("<b>tom</b>"));
  assert.equal(SO.pseudoParDefaut("thomas boulet"), "thomas B.");
  assert.equal(SO.pseudoParDefaut("Camille"), "Camille");
  assert.equal(SO.pseudoParDefaut(""), "");
});

test("lien de séance : aller-retour, revérifié à la lecture", () => {
  const r = SO.recapSeance(seance);
  const url = SO.lienPartage("https://exemple.invalid/app/index.html#/done", { code: "K7M2QX", seance: r, de: "Tom B." });
  assert.match(url, /^https:\/\/exemple\.invalid\/app\/index\.html\?r=K7M2QX&k=seance&d=/);
  assert.ok(!url.includes("#"));
  const lu = SO.lireLien(new URL(url).search);
  assert.equal(lu.code, "K7M2QX"); assert.equal(lu.seance.titre, r.titre); assert.equal(lu.seance.series, 18); assert.equal(lu.seance.de, "Tom B.");
  // Lien fabriqué à la main : valeurs absurdes et contacts retirés
  const faux = "?r=abc&k=seance&d=" + SO.versB64({ titre: "Appelle 0612345678", series: 1e9, tonnes: -3, records: ["www.x.fr"], medaille: "diamant", de: "@moi" });
  const f = SO.lireLien(faux);
  assert.equal(f.code, undefined); assert.equal(f.seance.series, 0); assert.equal(f.seance.tonnes, 0); assert.deepEqual(f.seance.records, []);
  assert.equal(f.seance.medaille, null); assert.ok(!/\d{6}/.test(f.seance.titre)); assert.equal(f.seance.de, "");
  assert.equal(SO.lireLien("?k=seance&d=%%%"), null);
  assert.equal(SO.lireLien(""), null);
  assert.equal(SO.lireLien("?r=k7m2qx").code, "K7M2QX");
  assert.equal(SO.lireLien("?r=K7M2Q0"), null, "0 n'est pas dans l'alphabet");
});

test("accents et emoji survivent à l'encodage du lien", () => {
  const o = { titre: "Épaules & dos 💪", de: "Zoé" };
  assert.deepEqual(SO.depuisB64(SO.versB64(o)), o);
});

test("programme du catalogue : voyage par son identifiant", () => {
  const pub = SO.programmePublic({ id: "tb-rep3", name: "Reprise · Full body 3 j", s: [[1]] }, { catalogue: true });
  assert.deepEqual(pub, { id: "tb-rep3", n: "Reprise · Full body 3 j" });
  const url = SO.lienPartage("https://exemple.invalid/", { code: "K7M2QX", programme: pub, de: "Tom" });
  const lu = SO.lireLien(new URL(url).search);
  assert.equal(lu.programme.id, "tb-rep3"); assert.equal(lu.programme.de, "Tom");
  assert.equal(SO.lireLien("?k=programme&prog=../../etc"), null);
});

test("programme personnel : envoyé en entier (sans notes), importable chez la personne invitée", () => {
  const perso = { id: "my-1", custom: true, name: "Mon PPL", split: "PPL", lvl: "Intermédiaire", weeks: 10,
    s: [["Push", "Lundi", [["Développé couché", "P", "note perso : épaule"], ["Dips", "I"]]], ["Pull", "Mercredi", [["Tractions", "P"]]], ["Legs", null, [["Squat", "F"]]]] };
  const pub = SO.programmePublic(perso, { schema: (r) => r[1] === "F" ? "5x5 RPE8" : "3x8-12" });
  assert.equal(pub.n, "Mon PPL"); assert.equal(pub.sem, 10);
  assert.deepEqual(pub.s[0][2][0], ["Développé couché", "P", "3x8-12"]);
  assert.ok(!JSON.stringify(pub).includes("épaule"));
  const url = SO.lienPartage("https://exemple.invalid/", { programme: pub });
  const lu = SO.lireLien(new URL(url).search);
  assert.equal(lu.programme.s.length, 3); assert.equal(lu.programme.n, "Mon PPL", "le nom survit à l'aller-retour du lien");
  const imp = SO.programmeImportable(lu.programme, { id: "recu-1", de: "Tom B." });
  assert.equal(imp.id, "recu-1"); assert.equal(imp.custom, true); assert.equal(imp.weeks, 10);
  assert.deepEqual(imp.s.map(x => x[1]), ["Lundi", "Mercredi", "Vendredi"]);
  assert.deepEqual(imp.days, [true, false, true, false, true, false, false]);
  assert.deepEqual(imp.s[2][2], [["Squat", "F"]]);
  assert.match(imp.desc, /Tom B\./);
  assert.equal(SO.programmeImportable({ s: [] }), null);
});

test("parrainage : mois offerts, paliers, plafond annuel", () => {
  assert.deepEqual(SO.progressionParrainage(0, 2).atteints, []);
  assert.equal(SO.progressionParrainage(0, 2).prochain.id, "recruteur");
  assert.equal(SO.progressionParrainage(0, 2).inscrits, 2);
  assert.equal(SO.progressionParrainage(1).mois, 1);
  assert.equal(SO.progressionParrainage(2).mois, 2);
  assert.equal(SO.progressionParrainage(3).mois, 3, "3 filleuls : 3 mois, pas de mois bonus");
  assert.equal(SO.progressionParrainage(3).badge.id, "ambassadeur");
  assert.equal(SO.progressionParrainage(4).manque, 1);
  assert.equal(SO.progressionParrainage(25).mois, 6, "plafond de 6 mois par an");
  assert.match(SO.PALIERS.find(p => p.n === 3).cadeau, /Analyse vidéo/);
  assert.ok(!SO.PALIERS.some(p => /visio|relu/i.test(p.cadeau)), "aucun cadeau qui prend du temps de coaching");
  assert.equal(SO.progressionParrainage(25).prochain, null);
  assert.equal(SO.joursEssai(30, { code: "K7M2QX" }), 37);
  assert.equal(SO.joursEssai(30, null), 30);
});

test("codes : alphabet sans caractères ambigus", () => {
  assert.ok(SO.codeValide("K7M2QX"));
  for (const c of ["K7M2Q", "K7M2QXX", "K7M2QO", "K7M2Q1", "k7m2qx", "K7M2QL", null]) assert.equal(SO.codeValide(c), false, String(c));
  assert.ok(!/[01ILO]/.test(SO.ALPHABET_CODE));
});

test("jeu : niveaux de supporter", () => {
  assert.equal(SO.niveauSupporter(0).nom, "Nouveau venu");
  assert.equal(SO.niveauSupporter(9).manque, 1);
  assert.equal(SO.niveauSupporter(10).nom, "Allumeur");
  assert.equal(SO.niveauSupporter(149).nom, "Moteur");
  assert.equal(SO.niveauSupporter(5000).suivant, null);
  assert.equal(SO.niveauSupporter(5000).pct, 1);
  assert.ok(SO.niveauSupporter(30).pct > 0 && SO.niveauSupporter(30).pct < 1);
});

test("jeu : série du supporter (3 encouragements par jour)", () => {
  const j = { "2026-11-15": 3, "2026-11-16": 5, "2026-11-17": 4, "2026-11-18": 1 };
  let s = SO.serieSupporter(j, "2026-11-18");
  assert.equal(s.jours, 3, "aujourd'hui pas encore rempli : la série d'hier tient"); assert.equal(s.enDanger, true); assert.equal(s.aujourdhui, 1);
  s = SO.serieSupporter({ ...j, "2026-11-18": 3 }, "2026-11-18");
  assert.equal(s.jours, 4); assert.equal(s.faite, true); assert.equal(s.enDanger, false);
  s = SO.serieSupporter({ "2026-11-16": 3 }, "2026-11-18");
  assert.equal(s.jours, 0, "un jour manqué casse la série");
  assert.equal(SO.serieSupporter(null, "2026-11-18").jours, 0);
  // Passage de mois
  assert.equal(SO.serieSupporter({ "2026-10-31": 3, "2026-11-01": 3 }, "2026-11-01").jours, 2);
});

test("badges sociaux et podium entre amis", () => {
  const b = SO.badgesSociaux({ donnes: 30, recus: 10, serie: 7, amis: 1, publies: 1 });
  assert.deepEqual(b.filter(x => x.ok).map(x => x.id), ["premier-pas", "coeur", "flamme"]);
  const p = SO.podium([{ pseudo: "B", seances: 3, donnes: 2 }, { pseudo: "A", seances: 4, donnes: 0 }, { pseudo: "C", seances: 3, donnes: 2 }, { pseudo: "D", seances: 1, donnes: 9 }]);
  assert.deepEqual(p.map(x => [x.pseudo, x.rang]), [["A", 1], ["B", 2], ["C", 2], ["D", 4]]);
});

test("réactions : un geste parmi une liste fermée, résumé trié", () => {
  assert.deepEqual(SO.REACTION_IDS, ["muscle", "feu", "bravo", "fusee", "couronne"]);
  assert.deepEqual(SO.resumeReactions({ feu: 3, muscle: 5, inconnu: 9, bravo: 0 }).map(r => [r.id, r.n]), [["muscle", 5], ["feu", 3]]);
  assert.deepEqual(SO.resumeReactions(null), []);
});

test("textes d'invitation : lien et code, jamais d'e-mail", () => {
  const t = SO.texteInvitation({ prenom: "Tom", code: "K7M2QX", lien: "https://x.invalid/?r=K7M2QX", jours: 37 });
  assert.match(t, /Tom t'invite/); assert.match(t, /37 jours offerts/); assert.match(t, /K7M2QX/);
  const s = SO.texteSeance({ titre: "Push", min: 60, series: 18, tonnes: 8.5, records: ["Squat"] }, "L");
  assert.match(s, /60 min · 18 séries · 8,5 t soulevées/); assert.match(s, /Record battu : Squat/);
});
