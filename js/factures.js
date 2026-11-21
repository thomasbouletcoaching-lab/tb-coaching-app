// Mon activité : catalogue d'offres et factures de micro-entrepreneur. Pur (sans DOM ni état) : testé par tests/factures.test.mjs.
export const TYPES_OFFRE = [["seance", "Séance à l'unité"], ["pack", "Carnet de séances"], ["accompagnement", "Accompagnement / cycle"], ["presentiel", "Coaching en présentiel"], ["distanciel", "Coaching à distance"], ["autre", "Autre"]];
export const UNITES = ["la séance", "par mois", "le cycle", "le carnet", "l'heure", ""];
const r2 = (x) => Math.round((+x || 0) * 100) / 100;
export const totalLignes = (lignes = []) => r2(lignes.reduce((a, l) => a + r2((+l.qte || 0) * (+l.pu || 0)), 0));
// Numéro suivant, continu par année : 2026-001, 2026-002… (obligatoire : chronologique et sans trou)
export function numeroSuivant(factures = [], annee) {
  const n = factures.filter(f => String(f.num || "").startsWith(annee + "-")).map(f => +String(f.num).split("-")[1] || 0);
  return `${annee}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, "0")}`;
}
// Statut : payée (date de paiement), en retard (échéance dépassée), à payer
export function statut(f, t) { if (f.payeLe) return { k: "payee", l: "Payée", c: "good" }; if (f.echeance && f.echeance < t) return { k: "retard", l: "En retard", c: "warn" }; return { k: "attente", l: "À payer", c: "" }; }
export const joursRetard = (f, t) => f.payeLe || !f.echeance || f.echeance >= t ? 0 : Math.round((new Date(t + "T12:00:00") - new Date(f.echeance + "T12:00:00")) / 864e5);
const e = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const eur = (x) => r2(x).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const dfr = (k) => k ? new Date(k + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
// Facture imprimable (Imprimer › Enregistrer en PDF). Mentions d'une micro-entreprise non soumise à la TVA.
export function htmlFacture(f, s = {}) {
  const tot = totalLignes(f.lignes);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${e(f.num)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18212C;max-width:760px;margin:24px auto;padding:0 20px;font-size:14px;line-height:1.45}h1{font-size:26px;margin:0}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:8px;border-bottom:1px solid #E3E7ED;text-align:left}th{background:#F3F5F8;font-size:12px;text-transform:uppercase;letter-spacing:.04em}td.n,th.n{text-align:right;white-space:nowrap}.top{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}.box{background:#F7F8FA;border-radius:10px;padding:12px 14px}.tot{font-size:18px;font-weight:800}.mut{color:#6B7686;font-size:12px}.btn{display:inline-block;margin:18px 0;padding:10px 16px;border-radius:10px;background:#1B3FA0;color:#fff;border:0;font-size:15px}@media print{.btn{display:none}body{margin:0}}</style></head><body>
<button class="btn" onclick="window.print()">Imprimer / enregistrer en PDF</button>
<div class="top"><div><h1>Facture</h1><div>N° <b>${e(f.num)}</b></div><div>Date : ${dfr(f.d)}</div>${f.echeance ? `<div>Échéance : ${dfr(f.echeance)}</div>` : ""}</div>
<div class="box"><b>${e(s.nom || "Thomas Boulet")}</b><br>${e(s.activite || "Coach sportif · Entrepreneur individuel")}${s.adresse ? `<br>${e(s.adresse).replace(/\n/g, "<br>")}` : ""}${s.siret ? `<br>SIRET : ${e(s.siret)}` : ""}${s.email ? `<br>${e(s.email)}` : ""}</div></div>
<div class="box" style="margin-top:16px"><span class="mut">Facturé à</span><br><b>${e(f.client || "Client")}</b>${f.adresse ? `<br>${e(f.adresse).replace(/\n/g, "<br>")}` : ""}</div>
<table><tr><th>Désignation</th><th class="n">Qté</th><th class="n">Prix unitaire</th><th class="n">Total</th></tr>
${(f.lignes || []).map(l => `<tr><td>${e(l.label)}</td><td class="n">${String(+l.qte || 0).replace(".", ",")}</td><td class="n">${eur(l.pu)}</td><td class="n">${eur((+l.qte || 0) * (+l.pu || 0))}</td></tr>`).join("")}
<tr><td colspan="3" class="n tot">Total à payer</td><td class="n tot">${eur(tot)}</td></tr></table>
<p><b>TVA non applicable, art. 293 B du CGI.</b></p>
${f.payeLe ? `<p>✅ Payée le ${dfr(f.payeLe)}${f.moyen ? ` (${e(f.moyen)})` : ""}.</p>` : `<p>Paiement ${s.paiement ? `par ${e(s.paiement)}` : "à réception"}${f.echeance ? `, au plus tard le ${dfr(f.echeance)}` : ""}.</p>`}
<p class="mut">En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal${s.pro ? " et indemnité forfaitaire pour frais de recouvrement de 40 € (clients professionnels)" : ""}. Pas d'escompte pour paiement anticipé.</p>
${f.note ? `<p class="mut">${e(f.note)}</p>` : ""}</body></html>`;
}
