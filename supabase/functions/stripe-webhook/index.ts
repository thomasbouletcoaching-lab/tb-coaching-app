// Reçoit les événements Stripe (abonnement créé, renouvelé, impayé, résilié) et met à jour les droits dans « subs ».
// Appelée uniquement par Stripe : chaque requête est authentifiée par la signature Stripe-Signature (STRIPE_WEBHOOK_SECRET).
import { createClient } from "npm:@supabase/supabase-js@2";
import { stripe, subRow } from "./stripe.ts";

const enc = new TextEncoder();
async function verify(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = parts["t"]; if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const payload = await req.text();
  if (!secret || !(await verify(payload, req.headers.get("Stripe-Signature") || "", secret))) return new Response("signature", { status: 400 });
  const ev = JSON.parse(payload);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    let s: any = null, cid: string | null = null;
    if (ev.type === "checkout.session.completed" && ev.data.object.mode === "subscription") {
      cid = ev.data.object.client_reference_id;
      s = await stripe("GET", "subscriptions/" + ev.data.object.subscription, { expand: ["items.data.price"] });
    } else if (/^customer\.subscription\.(created|updated|deleted|resumed|paused)$/.test(ev.type)) {
      s = ev.data.object;
    } else return new Response("ignored", { status: 200 });

    cid = cid || (s.metadata && s.metadata.client_id) || null;
    const custId = typeof s.customer === "string" ? s.customer : s.customer && s.customer.id;
    let { data: cur } = cid ? await sb.from("subs").select("*").eq("client_id", cid).maybeSingle() : { data: null };
    if (!cur && custId) ({ data: cur } = await sb.from("subs").select("*").eq("stripe_customer", custId).maybeSingle());
    if (!cur) { console.error("abonné introuvable", ev.id, custId); return new Response("unknown", { status: 200 }); }
    const row = subRow(s);
    // un vieil abonnement résilié ne doit pas écraser l'abonnement en cours
    if (cur.stripe_sub && cur.stripe_sub !== s.id && row.status === "canceled" && ["active", "trialing", "past_due"].includes(cur.status)) return new Response("stale", { status: 200 });
    const before = cur.plan;
    const { error } = await sb.from("subs").update(row).eq("client_id", cur.client_id);
    if (error) throw error;
    // nouveau coaching léger : prévenir le coach par un message dans l'app (notification habituelle)
    if (row.plan === "light" && before !== "light" && cur.user_id) {
      await sb.from("messages").insert({ client_id: cur.client_id, sender: cur.user_id, from_coach: false, body: "🎉 Je viens de m'abonner au coaching léger. On commence quand tu veux !" });
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
