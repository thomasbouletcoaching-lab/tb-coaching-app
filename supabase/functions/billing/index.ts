// Paiement des formules (Premium, Coaching léger) : ouvre Stripe Checkout ou le portail client Stripe.
// Rien n'est prélevé sans que l'utilisateur valide lui-même le paiement sur la page Stripe.
// Authentification : jeton de session vérifié via auth.getUser (verify_jwt désactivé : nouvelles clés de signature).
import { createClient } from "npm:@supabase/supabase-js@2";
import { LOOKUP, STRIPE_KEY, stripe } from "./stripe.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const APP = "https://thomasbouletcoaching-lab.github.io/tb-coaching-app/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
    if (!user || !user.email || !user.email_confirmed_at) return json({ error: "Session invalide, reconnecte-toi." }, 401);
    const body = await req.json().catch(() => ({}));
    const isCoach = !!(await sb.from("coaches").select("uid").eq("uid", user.id).maybeSingle()).data;

    // coach : vérifier la configuration (clé + 3 prix) et l'activer dans l'app
    if (body.action === "check") {
      if (!isCoach) return json({ error: "Réservé au coach" }, 403);
      if (!STRIPE_KEY()) return json({ ok: false, mode: null, found: [], missing: Object.values(LOOKUP), error: "Clé STRIPE_SECRET_KEY absente des secrets Supabase" });
      const r = await stripe("GET", "prices", { active: true, limit: 10, lookup_keys: Object.values(LOOKUP), expand: ["data.product"] });
      const found = (r.data || []).map((p: any) => ({ key: p.lookup_key, amount: p.unit_amount / 100, currency: p.currency, interval: p.recurring && p.recurring.interval, product: p.product && p.product.name }));
      const missing = Object.values(LOOKUP).filter((k) => !found.some((f: any) => f.key === k));
      const mode = STRIPE_KEY().startsWith("sk_live") || STRIPE_KEY().startsWith("rk_live") ? "live" : "test";
      const hook = !!Deno.env.get("STRIPE_WEBHOOK_SECRET");
      const ok = !missing.length && hook;
      await sb.from("app_flags").upsert({ k: "stripe_ready", v: ok, updated_at: new Date().toISOString() });
      if (ok) {
        const P: Record<string, number> = {}; for (const f of found) P[f.key] = f.amount;
        const { data: cur } = await sb.from("app_flags").select("v").eq("k", "prices").maybeSingle();
        await sb.from("app_flags").upsert({ k: "prices", v: { ...(cur && cur.v || {}), premium_month: P.tb_premium_month, premium_year: P.tb_premium_year, light_month: P.tb_light_month }, updated_at: new Date().toISOString() });
      }
      return json({ ok, mode, found, missing, webhook: hook });
    }

    // dossier de l'utilisateur
    const [{ data: r1 }, { data: r2 }] = await Promise.all([
      sb.from("clients").select("id,coach_id,email,name").eq("coach_id", user.id),
      sb.from("clients").select("id,coach_id,email,name").ilike("email", user.email.replace(/[%_\\]/g, "\\$&")),
    ]);
    const seen = new Set<string>();
    const mine = [...(r1 || []), ...(r2 || [])].filter((r: any) => !seen.has(r.id) && seen.add(r.id) && (r.coach_id === user.id || (r.email || "").toLowerCase() === user.email!.toLowerCase()));
    const ids = mine.map((r: any) => r.id);
    const { data: subs } = ids.length ? await sb.from("subs").select("*").in("client_id", ids) : { data: [] };
    const sub: any = (subs || [])[0];
    const client: any = sub ? mine.find((r: any) => r.id === sub.client_id) : mine[0];
    if (!STRIPE_KEY()) return json({ error: "Le paiement en ligne n'est pas encore activé. Réessaie bientôt." }, 400);

    if (body.action === "portal") {
      if (!sub || !sub.stripe_customer) return json({ error: "Aucun abonnement payé sur ce compte." }, 400);
      const p = await stripe("POST", "billing_portal/sessions", { customer: sub.stripe_customer, return_url: APP + "?billing=portal", locale: "fr" });
      return json({ url: p.url });
    }

    if (body.action === "checkout") {
      if (isCoach) return json({ error: "Le compte coach ne s'abonne pas." }, 400);
      if (!client) return json({ error: "Termine d'abord ton inscription dans l'app." }, 400);
      if (!sub) return json({ error: "Tu es déjà accompagné en coaching : tout est inclus." }, 400);
      if (!body.terms) return json({ error: "Accepte d'abord les conditions générales de vente." }, 400);
      const key = body.plan === "light" ? "light_month" : body.interval === "year" ? "premium_year" : "premium_month";
      if (sub.stripe_sub && ["active", "trialing", "past_due"].includes(sub.status)) {
        // déjà abonné : changement de formule ou résiliation dans le portail (évite deux abonnements)
        const p = await stripe("POST", "billing_portal/sessions", { customer: sub.stripe_customer, return_url: APP + "?billing=portal", locale: "fr" });
        return json({ url: p.url, portal: true });
      }
      const pr = await stripe("GET", "prices", { active: true, limit: 1, lookup_keys: [LOOKUP[key]] });
      const price = pr.data && pr.data[0];
      if (!price) return json({ error: "Cette formule n'est pas encore disponible." }, 400);
      let customer = sub.stripe_customer;
      if (!customer) {
        const c = await stripe("POST", "customers", { email: user.email, name: client.name || undefined, metadata: { client_id: client.id } });
        customer = c.id;
        await sb.from("subs").update({ stripe_customer: customer, updated_at: new Date().toISOString() }).eq("client_id", client.id);
      }
      const trial = key.startsWith("premium") && !sub.trial_used ? 7 : undefined;
      const s = await stripe("POST", "checkout/sessions", {
        mode: "subscription", customer, client_reference_id: client.id, locale: "fr", allow_promotion_codes: true,
        line_items: { 0: { price: price.id, quantity: 1 } },
        subscription_data: { metadata: { client_id: client.id }, ...(trial ? { trial_period_days: trial } : {}) },
        metadata: { client_id: client.id, terms_at: new Date().toISOString() },
        success_url: APP + "?billing=ok", cancel_url: APP + "?billing=cancel",
      });
      return json({ url: s.url });
    }
    return json({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Paiement indisponible : " + (e as Error).message }, 500);
  }
});
