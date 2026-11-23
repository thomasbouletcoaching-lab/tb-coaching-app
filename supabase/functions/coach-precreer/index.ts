// Le coach crée l'espace d'un client avant sa première connexion, puis génère son lien de connexion.
// Réservé au coach (profil is_coach). Aucune donnée secrète n'est renvoyée : seulement l'identifiant et un jeton à usage unique.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return out({ error: "Non connecté" }, 401);
    const { data: me } = await admin.from("cxs_profiles").select("is_coach").eq("id", u.user.id).maybeSingle();
    if (!me?.is_coach) return out({ error: "Réservé au coach" }, 403);
    const b = await req.json();

    if (b.action === "create") {
      const email = String(b.email || "").trim().toLowerCase(), name = String(b.name || "").trim().slice(0, 80);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out({ error: "E-mail invalide" }, 400);
      if (!name) return out({ error: "Prénom requis" }, 400);
      const pwd = crypto.randomUUID() + crypto.randomUUID();
      const { data, error } = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true, user_metadata: { name } });
      if (error) return out({ error: /already|registered|exists/i.test(error.message) ? "Ce client a déjà un compte avec cet e-mail" : error.message }, 409);
      const row: Record<string, unknown> = { id: data.user.id, email, name };
      if (b.tier) row.tier = String(b.tier);
      if (b.tier_until) row.tier_until = String(b.tier_until);
      const { error: e2 } = await admin.from("cxs_profiles").upsert(row, { onConflict: "id" });
      if (e2) return out({ error: e2.message }, 500);
      return out({ id: data.user.id });
    }

    if (b.action === "link") {
      const { data: t, error: e1 } = await admin.auth.admin.getUserById(String(b.id));
      if (e1 || !t?.user?.email) return out({ error: "Client introuvable" }, 404);
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: t.user.email });
      if (error) return out({ error: error.message }, 500);
      return out({ token: data.properties.hashed_token });
    }
    return out({ error: "Action inconnue" }, 400);
  } catch (e) { return out({ error: String((e as Error).message || e) }, 500); }
});
