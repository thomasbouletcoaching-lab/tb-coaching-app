// Tests des réactions du personnage (données fictives)
import { test } from "node:test";
import assert from "node:assert/strict";
import * as V from "../js/personnage-vie.js";

const base = { auj: "2026-11-18", serie: { jours: 3 }, rang: { id: "bronze", nom: "Bronze" }, rangVu: "bronze" };
test("vie : séance du jour → pose de victoire et une seule fête", () => {
  const a = V.humeur({ ...base, seanceAujourdhui: true });
  assert.equal(a.pose, "biceps"); assert.deepEqual(a.fete, { cle: "seance:2026-11-18", titre: "Séance validée" });
  const b = V.humeur({ ...base, seanceAujourdhui: true, feteVue: "seance:2026-11-18" });
  assert.equal(b.pose, "biceps"); assert.equal(b.fete, null);
});
test("vie : nouveau rang → fête prioritaire", () => {
  const a = V.humeur({ ...base, rang: { id: "argent", nom: "Argent" }, seanceAujourdhui: true });
  assert.equal(a.fete.cle, "rang:argent"); assert.match(a.phrase, /Argent/);
  assert.equal(V.humeur({ ...base, rangVu: null, rang: { id: "argent", nom: "Argent" } }).fete, null, "première visite : pas de fête");
});
test("vie : retour, pause, jour prévu, repos → posture calme, jamais de reproche", () => {
  const cas = [{ serie: { jours: 0, retour: true } }, { pause: true }, { jourPrevu: true }, {}, { serie: { jours: 12 } }];
  for (const c of cas) {
    const r = V.humeur({ ...base, ...c });
    assert.equal(r.pose, "repos"); assert.equal(r.fete, null);
    assert.doesNotMatch(r.phrase, /rat[ée]|retard|honte|nul|dommage|enfin/i);
  }
  assert.match(V.humeur({ ...base, serie: { jours: 0, retour: true } }).phrase, /sans rien rattraper/);
});
test("vie : textes sans accord de genre", () => {
  const tous = [...V.REPLIQUES, ...["", "x"].flatMap(() => [V.humeur({ ...base, seanceAujourdhui: true }).phrase, V.humeur({ ...base, jourPrevu: true }).phrase, V.humeur(base).phrase])];
  for (const t of tous) assert.doesNotMatch(t, /·e|\b(prêt|prête|fier|fière|content|contente|motivé|motivée|seul|seule)\b/i, t);
  assert.equal(V.replique(-1), V.REPLIQUES.at(-1));
});
