// Récompense du parrain dans le webhook Stripe (supabase/functions/stripe-webhook/parrainage.js), Stripe et Supabase simulés.
import { test } from "node:test";
import assert from "node:assert/strict";
import { recompenserParrain, CREDIT_CENTIMES } from "../supabase/functions/stripe-webhook/parrainage.js";

function faux({ premium = { recompense: true, id: 7, parrain: "p-1", coach: false }, subs = [], tx = [], erreur = null } = {}) {
  const appels = { rpc: [], stripe: [] };
  const sb = { rpc: async (n, a) => { appels.rpc.push([n, a]); if (n === "cxs_parrainage_premium") return erreur ? { data: null, error: erreur } : { data: premium, error: null }; return { data: null, error: null }; } };
  const stripe = async (m, path, body) => { appels.stripe.push([m, path, body]);
    if (path === "subscriptions/search") return { data: subs };
    if (path.endsWith("/balance_transactions") && m === "GET") return { data: tx };
    return { id: "cbtxn_1" }; };
  return { sb, stripe, appels };
}

test("parrain abonné sur Stripe : 1 mois crédité sur sa prochaine facture", async () => {
  const f = faux({ subs: [{ id: "sub_1", status: "active", customer: "cus_9" }] });
  const r = await recompenserParrain(f.sb, "fil-1", f.stripe);
  assert.deepEqual([r.fait, r.mode], [true, "credit_stripe"]);
  const post = f.appels.stripe.find(a => a[0] === "POST");
  assert.equal(post[1], "customers/cus_9/balance_transactions");
  assert.equal(post[2].amount, -CREDIT_CENTIMES); assert.equal(post[2].metadata.recompense_id, "7");
  assert.deepEqual(f.appels.rpc.at(-1), ["cxs_recompense_appliquer", { p_id: 7, p_mode: "credit_stripe" }]);
});

test("webhook rejoué : le crédit n'est pas posé deux fois", async () => {
  const f = faux({ subs: [{ id: "sub_1", status: "active", customer: "cus_9" }], tx: [{ metadata: { recompense_id: "7" } }] });
  const r = await recompenserParrain(f.sb, "fil-1", f.stripe);
  assert.equal(r.mode, "credit_stripe");
  assert.equal(f.appels.stripe.filter(a => a[0] === "POST").length, 0);
});

test("parrain sans abonnement Stripe : 30 jours de Bâtisseur en plus", async () => {
  const f = faux({ subs: [{ id: "sub_0", status: "canceled", customer: "cus_9" }] });
  const r = await recompenserParrain(f.sb, "fil-1", f.stripe);
  assert.equal(r.mode, "prolongation");
  assert.deepEqual(f.appels.rpc.at(-1), ["cxs_recompense_appliquer", { p_id: 7, p_mode: "prolongation" }]);
});

test("parrain coaché, pas de parrain, ou migration absente : rien d'automatique", async () => {
  let f = faux({ premium: { recompense: true, id: 8, parrain: "p-2", coach: true } });
  assert.equal((await recompenserParrain(f.sb, "x", f.stripe)).raison, "coach"); assert.equal(f.appels.stripe.length, 0);
  f = faux({ premium: { recompense: false, raison: "sans_parrain" } });
  assert.equal((await recompenserParrain(f.sb, "x", f.stripe)).raison, "sans_parrain"); assert.equal(f.appels.rpc.length, 1);
  f = faux({ erreur: { code: "PGRST202", message: "Could not find the function" } });
  assert.equal((await recompenserParrain(f.sb, "x", f.stripe)).raison, "migration_absente");
  f = faux({ erreur: { code: "500", message: "panne" } });
  await assert.rejects(() => recompenserParrain(f.sb, "x", f.stripe));
});

test("identifiant du parrain nettoyé dans la requête de recherche Stripe", async () => {
  const f = faux({ premium: { recompense: true, id: 9, parrain: "a' OR '1", coach: false } });
  await recompenserParrain(f.sb, "x", f.stripe);
  assert.ok(!/'a' OR/.test(f.appels.stripe[0][2].query));
});
