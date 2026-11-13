// Abonnements de la nouvelle app TB my Coach (liens de paiement Stripe, metadata app = « tb-my-coach »).
// Met à jour cxs_profiles.tier / tier_until. Ne touche JAMAIS un compte coach ni une formule autre que free/premium
// (Invité, coaching…) : ces accès sont gérés à la main par le coach.
import { stripe, periodEnd } from "./stripe.ts";

const LIVE = ["active", "trialing", "past_due"];
const isUuid = (x: unknown) => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);

// Retourne true si l'événement concerne la nouvelle app (traité ici), false sinon (le flux historique continue).
export async function cxsHandle(sb: any, ev: any, fetchSub = (id: string) => stripe("GET", "subscriptions/" + id, { expand: ["items.data.price"] }), setMeta = (id: string, uid: string) => stripe("POST", "subscriptions/" + id, { metadata: { user_id: uid } })): Promise<boolean> {
  const o = ev?.data?.object; if (!o) return false;
  let sub: any = null, uid: string | null = null;
  if (ev.type === "checkout.session.completed") {
    if (o.mode !== "subscription" || o.metadata?.app !== "tb-my-coach") return false;
    sub = await fetchSub(o.subscription);
    uid = isUuid(o.client_reference_id) ? o.client_reference_id : null;
    if (!uid) {
      const mail = (o.customer_details?.email || o.customer_email || "").toLowerCase();
      if (mail) { const { data } = await sb.from("cxs_profiles").select("id").ilike("email", mail).limit(2); if (data?.length === 1) uid = data[0].id; }
    }
    if (uid) await setMeta(sub.id, uid).catch(() => { }); // pour retrouver le membre aux renouvellements / résiliations
  } else if (/^customer\.subscription\.(created|updated|deleted|resumed|paused)$/.test(ev.type)) {
    if (o.metadata?.app !== "tb-my-coach") return false;
    sub = o; uid = isUuid(o.metadata?.user_id) ? o.metadata.user_id : null;
  } else return false;

  if (!uid) { console.error("membre introuvable pour l'abonnement", sub?.id); return true; }
  const { data: p } = await sb.from("cxs_profiles").select("id,tier,is_coach").eq("id", uid).maybeSingle();
  if (!p || p.is_coach) return true;
  if (!["free", "premium"].includes(p.tier || "free")) return true; // Invité / coaching : ne pas écraser
  const live = LIVE.includes(sub.status) && ev.type !== "customer.subscription.deleted";
  const pe = periodEnd(sub);
  const patch = live ? { tier: "premium", tier_until: pe ? new Date(pe * 1000).toISOString().slice(0, 10) : null } : { tier: "free", tier_until: null };
  const { error } = await sb.from("cxs_profiles").update(patch).eq("id", uid);
  if (error) throw error;
  return true;
}
