// Ajoute dans Brevo chaque personne qui laisse son e-mail sur le site (table « leads »), dans la liste qui correspond
// à sa demande (calculateur, appel, candidature). C'est ce qui déclenche la séquence de 7 e-mails.
// Appelée uniquement par le « Database Webhook » Supabase sur INSERT dans leads, avec l'en-tête x-webhook-secret.
// Secrets (jamais dans le dépôt) : BREVO_API_KEY, BREVO_WEBHOOK_SECRET, BREVO_LIST_CALCULATEUR, BREVO_LIST_APPEL,
// BREVO_LIST_CANDIDATURE (facultatif), BREVO_LIST_AUTRE (facultatif).
import { listesDepuis, versContact, sansAttributsPerso, memeSecret } from "./contact.ts";

const brevo = (key: string, body: unknown) => fetch("https://api.brevo.com/v3/contacts", {
  method: "POST",
  headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
  body: JSON.stringify(body),
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  if (!memeSecret(req.headers.get("x-webhook-secret") || "", Deno.env.get("BREVO_WEBHOOK_SECRET") || "")) return new Response("secret", { status: 401 });
  const key = Deno.env.get("BREVO_API_KEY") || "";
  if (!key) return new Response("BREVO_API_KEY absente", { status: 500 });
  let ev: any; try { ev = await req.json(); } catch { return new Response("json", { status: 400 }); }
  if (ev?.type !== "INSERT" || ev?.table !== "leads") return new Response("ignoré", { status: 200 });
  const c = versContact(ev.record, listesDepuis((k) => Deno.env.get(k)));
  if (!c.ok) { console.log("non envoyé :", c.raison); return new Response("ignoré : " + c.raison, { status: 200 }); }
  let r = await brevo(key, c.body);
  if (r.status === 400) {
    const t = await r.text();
    console.warn("Brevo 400, nouvel essai avec le prénom seulement :", t.slice(0, 300));
    r = await brevo(key, sansAttributsPerso(c.body));
  }
  if (!r.ok && r.status !== 204) { const t = await r.text(); console.error("Brevo", r.status, t.slice(0, 300)); return new Response("brevo " + r.status, { status: 502 }); }
  return new Response("ok", { status: 200 });
});
