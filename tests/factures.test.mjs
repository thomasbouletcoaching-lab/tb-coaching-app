import test from "node:test";
import assert from "node:assert/strict";
import { numeroSuivant, totalLignes, statut, joursRetard, htmlFacture } from "../js/factures.js";
test("numérotation continue par année", () => {
  assert.equal(numeroSuivant([], 2026), "2026-001");
  assert.equal(numeroSuivant([{ num: "2026-001" }, { num: "2026-007" }, { num: "2025-012" }], 2026), "2026-008");
});
test("total, statut, retard", () => {
  assert.equal(totalLignes([{ qte: 3, pu: 49.9 }, { qte: 1, pu: 0.3 }]), 150);
  assert.equal(statut({ payeLe: "2026-11-02" }, "2026-11-21").k, "payee");
  assert.equal(statut({ echeance: "2026-11-10" }, "2026-11-21").k, "retard");
  assert.equal(joursRetard({ echeance: "2026-11-10" }, "2026-11-21"), 11);
  assert.equal(statut({ echeance: "2026-12-01" }, "2026-11-21").k, "attente");
});
test("facture imprimable avec mentions obligatoires", () => {
  const h = htmlFacture({ num: "2026-003", d: "2026-11-21", client: "Karim <test>", lignes: [{ label: "Cycle 12 semaines", qte: 1, pu: 1600 }] }, { siret: "123 456 789 00012", nom: "Thomas Boulet" });
  assert.match(h, /TVA non applicable, art\. 293 B du CGI/);
  assert.match(h, /N° <b>2026-003<\/b>/);
  assert.match(h, /SIRET : 123 456 789 00012/);
  assert.match(h, /Karim &lt;test&gt;/);
  assert.match(h, /1\s600,00 €/);
});
