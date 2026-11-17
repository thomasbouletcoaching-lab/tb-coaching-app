// Calcule et enregistre l'XP, les quêtes réussies et les objets débloqués d'un membre (décision C56).
// Le téléphone n'écrit jamais l'XP : il appelle cette fonction, qui relit son instantané (cxs_member_data)
// et son bloc (cxs_hyb_bloc), puis insère des événements à clé unique (rejouable sans doublon).
// Authentification : jeton de session vérifié via auth.getUser (comme « billing »).
// Les fichiers .js de ce dossier sont des copies de js/ (tools/sync-fonction-hybride.sh) : ne pas les modifier ici.
import { createClient } from "npm:@supabase/supabase-js@2";
import { aEcrire, aujourdhuiParis } from "./hybride-serveur.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const APP = "https://thomasbouletcoaching-lab.github.io/tb-coaching-app/";

let CACHE: { D: any; ex: Map<string, any>; at: number } | null = null;
async function donnees() {
  if (CACHE && Date.now() - CACHE.at < 3600_000) return CACHE;
  const [D, E] = await Promise.all([fetch(APP + "data/hybride.json").then((r) => r.json()), fetch(APP + "data/exercices.json").then((r) => r.json())]);
  CACHE = { D, ex: new Map((E.ex || []).map((e: any) => [e.nom, e])), at: Date.now() };
  return CACHE;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Session invalide, reconnecte-toi." }, 401);
    const uid = user.id; // toujours la personne connectée : aucun identifiant n'est lu dans la requête

    const [{ D, ex }, md, bl, pe] = await Promise.all([
      donnees(),
      sb.from("cxs_member_data").select("data").eq("user_id", uid).maybeSingle(),
      sb.from("cxs_hyb_bloc").select("macro_id, debut, nb_seances").eq("user_id", uid).maybeSingle(),
      sb.from("cxs_hyb_personnage").select("debloques").eq("user_id", uid).maybeSingle(),
    ]);
    const r = aEcrire(D, { data: md.data?.data || {}, blocLigne: bl.data, debloquesAvant: pe.data?.debloques || [] }, (n: string) => ex.get(n) || null, aujourdhuiParis());

    if (r.xp.length) {
      const { error } = await sb.from("cxs_hyb_xp").upsert(r.xp.map((x) => ({ ...x, user_id: uid })), { onConflict: "user_id,cle", ignoreDuplicates: true });
      if (error) throw error;
    }
    if (r.quetes.length) {
      const { error } = await sb.from("cxs_hyb_quetes").upsert(r.quetes.map((q) => ({ ...q, user_id: uid })), { onConflict: "user_id,quete_id,periode", ignoreDuplicates: true });
      if (error) throw error;
    }
    const { error: ep } = await sb.from("cxs_hyb_personnage").upsert({ user_id: uid, debloques: r.debloques, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (ep) throw ep;

    // XP totale relue en base : elle ne baisse jamais, même si l'instantané a oublié de vieilles séances
    const { data: tot } = await sb.from("cxs_hyb_xp").select("xp").eq("user_id", uid);
    const xp = (tot || []).reduce((t: number, x: any) => t + (x.xp || 0), 0);
    return json({ ok: true, xp, serie: r.resume.serie, debloques: r.debloques });
  } catch (e) {
    console.error("hybride-xp", e);
    return json({ error: "Calcul impossible pour l'instant. Réessaie plus tard." }, 500);
  }
});
