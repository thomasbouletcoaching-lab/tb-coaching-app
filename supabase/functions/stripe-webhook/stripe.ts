// Petit client Stripe (API REST, sans SDK) partagé par « billing » et « stripe-webhook ».
// La clé secrète est lue dans les secrets Supabase (STRIPE_SECRET_KEY) : jamais dans le dépôt ni dans l'app.
export const STRIPE_KEY = () => Deno.env.get("STRIPE_SECRET_KEY") || "";
// formule de l'app  <->  « lookup key » du prix créé dans Stripe
export const LOOKUP: Record<string, string> = { premium_month: "tb_premium_month", premium_year: "tb_premium_year", light_month: "tb_light_month" };
export const planOfLookup = (k?: string | null) => (k || "").startsWith("tb_light") ? "light" : (k || "").startsWith("tb_premium") ? "premium" : null;

function form(o: Record<string, unknown>, pre = "", out: string[] = []) {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(v)));
  }
  return out.join("&");
}
export async function stripe(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const qs = method === "GET" && body ? "?" + form(body) : "";
  const r = await fetch("https://api.stripe.com/v1/" + path + qs, {
    method,
    headers: { Authorization: "Bearer " + STRIPE_KEY(), "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2024-06-20" },
    body: method === "POST" && body ? form(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j && j.error && j.error.message) || "Stripe " + r.status);
  return j;
}
// fin de période : champ racine (anciennes versions d'API) ou par élément d'abonnement (récentes)
export const periodEnd = (s: any) => s.current_period_end || (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) || null;
const MAP: Record<string, string> = { active: "active", trialing: "trialing", past_due: "past_due", unpaid: "unpaid", incomplete: "incomplete", canceled: "canceled", incomplete_expired: "canceled", paused: "canceled" };
// abonnement Stripe -> ligne « subs »
export function subRow(s: any) {
  const price = s.items && s.items.data && s.items.data[0] && s.items.data[0].price;
  const status = MAP[s.status] || "incomplete";
  const plan = status === "canceled" ? "free" : (planOfLookup(price && price.lookup_key) || "premium");
  const pe = periodEnd(s);
  return {
    plan, status, source: "stripe", interval: price && price.recurring ? price.recurring.interval : null,
    period_end: pe ? new Date(pe * 1000).toISOString() : null, cancel_at_period_end: !!s.cancel_at_period_end,
    stripe_sub: s.id, stripe_customer: typeof s.customer === "string" ? s.customer : s.customer && s.customer.id,
    ...(s.trial_end ? { trial_used: true } : {}), updated_at: new Date().toISOString(),
  };
}
