// Parrainage : quand un filleul passe Bâtisseur pour la première fois, le parrain reçoit 1 mois offert.
// JavaScript simple (sans Deno ni TypeScript) pour être testé par node --test (tests/parrainage-webhook.test.mjs).
//   · Le serveur décide (fonction SQL cxs_parrainage_premium, service_role) : un mois offert par filleul, 6 par an.
//   · Parrain abonné sur Stripe : crédit d'un mois sur sa prochaine facture (solde client négatif), une seule fois.
//   · Parrain sans abonnement Stripe (essai, Bâtisseur offert) : 30 jours de Bâtisseur en plus (cxs_recompense_appliquer).
//   · Parrain coaché ou coach : rien d'automatique, la récompense attend le coach (statut « a_traiter »).
// Sans la migration 2026-11-18_cxs_social.sql, la fonction SQL n'existe pas : on ne fait rien, sans erreur.
export const CREDIT_CENTIMES = 1999; // 1 mois de Bâtisseur (19,99 €)
const absente = (e) => e && (e.code === "PGRST202" || e.code === "42883" || /does not exist|Could not find the function/i.test(e.message || ""));

export async function recompenserParrain(sb, filleul, stripe, { credit = CREDIT_CENTIMES } = {}) {
  const { data: r, error } = await sb.rpc("cxs_parrainage_premium", { p_filleul: filleul });
  if (error) { if (absente(error)) return { fait: false, raison: "migration_absente" }; throw error; }
  if (!r?.recompense) return { fait: false, raison: r?.raison || "aucune" };
  if (r.coach) return { fait: false, raison: "coach", id: r.id };
  let mode = "prolongation", sub = null;
  try {
    const q = await stripe("GET", "subscriptions/search", { query: `metadata['user_id']:'${String(r.parrain).replace(/'/g, "")}' AND metadata['app']:'tb-my-coach'`, limit: 10 });
    sub = (q?.data || []).find((s) => ["active", "trialing", "past_due"].includes(s.status)) || null;
  } catch (e) { console.error("recherche de l'abonnement du parrain", e?.message); }
  if (sub) {
    const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    // Webhook rejoué : le crédit déjà posé pour cette récompense n'est pas reposé
    const deja = await stripe("GET", `customers/${cust}/balance_transactions`, { limit: 50 });
    if (!(deja?.data || []).some((t) => t.metadata?.recompense_id === String(r.id))) {
      await stripe("POST", `customers/${cust}/balance_transactions`, { amount: -Math.abs(credit), currency: "eur", description: "Parrainage TB my Coach : 1 mois offert", metadata: { recompense_id: String(r.id), app: "tb-my-coach" } });
    }
    mode = "credit_stripe";
  }
  const { error: e2 } = await sb.rpc("cxs_recompense_appliquer", { p_id: r.id, p_mode: mode });
  if (e2) throw e2;
  return { fait: true, mode, id: r.id, parrain: r.parrain };
}
