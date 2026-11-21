import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/cardio.js";
test("allures et zones", () => {
  assert.equal(C.allure(12), "5:00");
  assert.equal(C.allureZone("ef", 15), "5:20–6:09 /km");
  assert.equal(C.fcZone("seuil", 190), "160–171 bpm");
});
test("déroulé et durée", () => {
  const m = C.modele("seuil"), d = C.deroule(m.blocs);
  assert.equal(d.length, 1 + 6 + 1);
  assert.equal(C.dureeTotale(m.blocs), 15 + 36 + 10);
  assert.equal(C.resumeBlocs(m.blocs), "15 min endurance fondamentale + 3 × (10 min seuil / 2 min facile) + 10 min facile");
  const k = C.deroule(C.modele("1000").blocs, { vma: 15 }).find(x => x.km === 1);
  assert.ok(Math.abs(k.dureeMin - 4) < 0.01); // 1 km à 15 km/h
});
test("progression du coach", () => {
  const it = { blocs: C.modele("seuil").blocs, prog: { effortMin: 2, reps: 1, every: 1 } };
  const b2 = C.progresser(it, 2);
  assert.equal(b2[1].rep, 5); assert.equal(b2[1].items[0].min, 14); assert.equal(b2[1].items[1].min, 2);
  assert.deepEqual(C.progresser(it, 0), it.blocs);
});
test("planning avec récurrence", () => {
  const it = { id: 1, quand: { jours: [1, 3], from: "2026-11-16" } }; // mardi, jeudi
  const o = C.occurrences([it, { id: 2, quand: { date: "2026-11-21" } }], "2026-11-16", "2026-11-29");
  assert.deepEqual(o.map(x => x.d), ["2026-11-17", "2026-11-19", "2026-11-21", "2026-11-24", "2026-11-26"]);
  assert.equal(o.at(-1).k, 1);
  const bi = C.occurrences([{ quand: { jours: [0], from: "2026-11-16", every: 2 } }], "2026-11-16", "2026-12-14");
  assert.deepEqual(bi.map(x => x.d), ["2026-11-16", "2026-11-30", "2026-12-14"]);
  const lim = C.occurrences([{ quand: { jours: [0], from: "2026-11-16" }, prog: { weeks: 2 } }], "2026-11-16", "2026-12-14");
  assert.equal(lim.length, 2);
  assert.equal(C.libQuand({ jours: [1, 3] }), "Chaque semaine · Mar, Jeu");
});
test("dépense par MET", () => {
  const e = [{ z: "ef", dureeMin: 60 }];
  const met = C.metEtape(e[0], { vma: 15, sport: "course" });
  assert.ok(met > 8 && met < 12, String(met));
  assert.equal(C.kcalSeance(e, 80, { vma: 15, sport: "course" }), Math.round((met - 1) * 80));
  assert.equal(C.metEtape({ z: "seuil" }, { sport: "velo" }), 8.2);
});
