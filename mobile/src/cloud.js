// Lien avec le serveur (base TB my Coach, tables cxs_). Compte e-mail + mot de passe.
// Les données restent utilisables hors ligne : seul le coaching a besoin du réseau.
import { supabase } from "./supabase";

export const configured = !!supabase;

export async function currentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw error;
  const user = data.user;
  if (user && data.session) await ensureProfile(user, name);
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await ensureProfile(data.user);
  return data;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

// Crée le profil CalXsthenos au premier passage (sans toucher aux comptes TB my Coach)
export async function ensureProfile(user, name = null) {
  const { error } = await supabase.from("cxs_profiles").upsert(
    { id: user.id, email: user.email, name: name || user.user_metadata?.name || null },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw error;
}

export async function myProfile() {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from("cxs_profiles").select("id,email,name,tier,tier_until,is_coach").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function msgsLeft() {
  const { data, error } = await supabase.rpc("cxs_msgs_left");
  if (error) throw error;
  return data; // null = illimité
}

export async function thread() {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from("cxs_messages")
    .select("id,user_id,sender,body,created_at,read_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return data || [];
}

export async function send(body) {
  const uid = await currentUserId();
  const { error } = await supabase.from("cxs_messages").insert({ user_id: uid, sender: uid, body });
  if (error) throw error;
}

export async function markRead() {
  const uid = await currentUserId();
  await supabase.from("cxs_messages").update({ read_at: new Date().toISOString() })
    .eq("user_id", uid).neq("sender", uid).is("read_at", null);
}
