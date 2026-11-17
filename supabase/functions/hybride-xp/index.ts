// Calcule et enregistre l'XP, les quêtes réussies et les objets débloqués d'un membre (décision C56).
// Le téléphone n'écrit jamais l'XP : il appelle cette fonction, qui relit son instantané (cxs_member_data)
// et son bloc (cxs_hyb_bloc), puis insère des événements à clé unique (rejouable sans doublon).
// Authentification : jeton de session vérifié via auth.getUser (comme « billing »).
// Les fichiers .js et .json de ce dossier sont des copies de js/ et data/ (tools/sync-fonction-hybride.sh) : ne pas les modifier ici.
import { createClient } from "npm:@supabase/supabase-js@2";
import { aEcrire, aujourdhuiParis, objetsApres } from "./hybride-serveur.js";
// Données embarquées (copies de data/ faites par tools/sync-fonction-hybride.sh) : les règles d'XP ne changent
// qu'au déploiement de la fonction, jamais par une simple publication du site.
import D from "./hybride.json" with { type: "json" };
import E from "./exercices.json" with { type: "json" };

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const EX = new Map(((E as any).ex || []).map((e: any) => [e.nom, e]));
const ok = <T>(r: { data: T; error: unknown }) => { if (r.error) throw r.error; return r.data; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "Session invalide, reconnecte-toi." }, 401);
    const uid = user.id; // toujours la personne connectée : aucun identifiant n'est lu dans la requête

    const [md, bl, pe] = await Promise.all([
      sb.from("cxs_member_data").select("data").eq("user_id", uid).maybeSingle(),
      sb.from("cxs_hyb_bloc").select("macro_id, debut, nb_seances").eq("user_id", uid).maybeSingle(),
      sb.from("cxs_hyb_personnage").select("debloques").eq("user_id", uid).maybeSingle(),
    ]).then((l) => l.map(ok)) as any[];
    const avant = pe?.debloques || [];
    const r = aEcrire(D, { data: md?.data || {}, blocLigne: bl, debloquesAvant: avant }, (n: string) => EX.get(n) || null, aujourdhuiParis());

    if (r.xp.length) ok(await sb.from("cxs_hyb_xp").upsert(r.xp.map((x) => ({ ...x, user_id: uid })), { onConflict: "user_id,cle", ignoreDuplicates: true }));
    if (r.quetes.length) ok(await sb.from("cxs_hyb_quetes").upsert(r.quetes.map((q) => ({ ...q, user_id: uid })), { onConflict: "user_id,quete_id,periode", ignoreDuplicates: true }));

    // XP totale relue en base, page par page (pas de limite à 1000 lignes)
    let xp = 0;
    for (let de = 0; ; de += 1000) {
      const page = ok(await sb.from("cxs_hyb_xp").select("xp").eq("user_id", uid).order("id").range(de, de + 999)) as any[];
      xp += (page || []).reduce((t, x) => t + (x.xp || 0), 0);
      if (!page || page.length < 1000) break;
    }
    const debloques = objetsApres(D, r, xp, avant);
    ok(await sb.from("cxs_hyb_personnage").upsert({ user_id: uid, debloques, updated_at: new Date().toISOString() }, { onConflict: "user_id" }));
    return json({ ok: true, xp, serie: r.resume.serie, debloques });
  } catch (e) {
    console.error("hybride-xp", e);
    return json({ error: "Calcul impossible pour l'instant. Réessaie plus tard." }, 500);
  }
});
