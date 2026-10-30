// Lien avec le serveur TB my Coach (Supabase). Tout échec réseau est silencieux : l'app reste utilisable hors ligne.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { CONFIG } from "./config.js";

export const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "cxs.auth" } });

let uid = null;
export const userId = () => uid;

export class LoginRequired extends Error { constructor() { super("LOGIN_REQUIRED"); this.name = "LoginRequired"; } }
// Connexion par e-mail (comptes TB my Coach). Sans connexion, le réseau est ignoré : l'app reste utilisable hors ligne.
export async function ensureSession() {
  const { data } = await sb.auth.getSession();
  if (data.session) { uid = data.session.user.id; return uid; }
  throw new LoginRequired();
}
export async function signUpEmail(email, password, name) {
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
  if (error) throw error;
  if (data.session) { uid = data.user.id; await ensureProfile(data.user, name); }
  return data;
}
export async function signInEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  uid = data.user.id; await ensureProfile(data.user);
  return data;
}
export async function resetPasswordEmail(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] });
  if (error) throw error;
}
export async function signOutSb() { await sb.auth.signOut(); uid = null; }
export async function accountEmail() { const { data } = await sb.auth.getSession(); return data.session?.user?.email || null; }
// Crée le profil au premier passage (le serveur refuse de créer un profil sans ce passage)
export async function ensureProfile(user, name = null) {
  const { error } = await sb.from("cxs_profiles").upsert(
    { id: user.id, email: user.email, name: name || user.user_metadata?.name || null },
    { onConflict: "id", ignoreDuplicates: true }
  );
  if (error) throw error;
}
export async function currentSession() {
  const { data } = await sb.auth.getSession(); uid = data.session?.user.id || null; return uid;
}

export async function saveProfile(fields) {
  if (!uid) await ensureSession();
  const { error } = await sb.from("cxs_profiles").update({ ...fields, last_seen: new Date().toISOString() }).eq("id", uid);
  if (error) throw error;
}
export async function fetchMe() {
  if (!uid) return null;
  const [{ data: p }, { data: left }] = await Promise.all([
    sb.from("cxs_profiles").select("id,email,name,tier,tier_until,is_coach").eq("id", uid).maybeSingle(),
    sb.rpc("cxs_msgs_left"),
  ]);
  return p ? { ...p, msgsLeft: left } : null;
}
export async function touch(stats) {
  if (!uid) return;
  const f = { last_seen: new Date().toISOString() }; if (stats) f.stats = stats;
  await sb.from("cxs_profiles").update(f).eq("id", uid);
}

// Messagerie
// Messagerie avec le coach : même table « messages » que l'espace coach TB (fiche client liée au compte)
let cidCache = null;
async function myClientId() {
  if (cidCache) return cidCache;
  const { data, error } = await sb.rpc("cxs_my_client_id"); if (error) throw error;
  cidCache = data || null; return cidCache;
}
const asThread = (m) => ({ id: m.id, user_id: uid, sender: m.from_coach ? "coach" : uid, body: m.body, created_at: m.created_at, read_at: m.read_at, reactions: m.reactions || {} });
const ownThread = (memberId) => !memberId || memberId === uid;
export async function thread(memberId = uid) {
  if (!ownThread(memberId)) {
    const { data, error } = await sb.from("cxs_messages").select("id,user_id,sender,body,created_at,read_at,reactions").eq("user_id", memberId).order("created_at", { ascending: true }).limit(300);
    if (error) throw error; return data;
  }
  const cid = await myClientId(); if (!cid) return [];
  const { data, error } = await sb.from("messages").select("id,from_coach,body,created_at,read_at,reactions").eq("client_id", cid).order("created_at", { ascending: true }).limit(300);
  if (error) throw error; return (data || []).map(asThread);
}
export async function send(body, memberId = uid) {
  if (!ownThread(memberId)) { const { error } = await sb.from("cxs_messages").insert({ user_id: memberId, sender: uid, body }); if (error) throw error; return; }
  const cid = await myClientId(); if (!cid) throw new Error("Aucune fiche client liée à ce compte");
  const { error } = await sb.from("messages").insert({ client_id: cid, sender: uid, from_coach: false, body }); if (error) throw error;
}
export async function react(id, emoji, current = {}) {
  const r = { ...(current || {}) }; if (r[uid] === emoji) delete r[uid]; else r[uid] = emoji;
  const { error } = await sb.from("messages").update({ reactions: r }).eq("id", id); if (error) throw error; return r;
}
export async function markRead(memberId, fromOther) {
  if (!ownThread(memberId)) { await sb.from("cxs_messages").update({ read_at: new Date().toISOString() }).eq("user_id", memberId).neq("sender", uid).is("read_at", null); return; }
  const cid = await myClientId(); if (!cid) return;
  await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("client_id", cid).eq("from_coach", true).is("read_at", null);
}
export async function unreadFromCoach() {
  if (!uid) return 0;
  const cid = await myClientId(); if (!cid) return 0;
  const { count } = await sb.from("messages").select("id", { count: "exact", head: true }).eq("client_id", cid).eq("from_coach", true).is("read_at", null);
  return count || 0;
}

// Notifications
export async function notifications() {
  if (!uid) return [];
  const { data } = await sb.from("cxs_notifications").select("id,user_id,title,body,created_at").or(`user_id.is.null,user_id.eq.${uid}`).order("created_at", { ascending: false }).limit(50);
  return data || [];
}

// Espace coach
export async function members() {
  const { data, error } = await sb.from("cxs_profiles").select("id,email,name,tier,tier_until,onboarding,stats,created_at,last_seen,is_coach").order("last_seen", { ascending: false }).limit(500);
  if (error) throw error;
  const { data: un } = await sb.from("cxs_messages").select("user_id,sender").is("read_at", null).limit(2000);
  const unread = {}; (un || []).forEach(m => { if (m.sender === m.user_id) unread[m.user_id] = (unread[m.user_id] || 0) + 1; });
  return data.filter(p => !p.is_coach).map(p => ({ ...p, unread: unread[p.id] || 0 }));
}
export async function setTier(id, tier) { const { error } = await sb.rpc("cxs_set_tier", { target: id, new_tier: tier }); if (error) throw error; }
export async function notify(title, body, to = null) {
  const { error } = await sb.from("cxs_notifications").insert({ user_id: to, title, body }); if (error) throw error;
}

// Données du membre pour l'espace coach (séances, journal, agenda, mesures)
export async function pushData(data, summary) {
  if (!uid) await ensureSession();
  // Fusion avec l'existant : l'historique migré et les repas/mesures déjà envoyés ne doivent pas être effacés
  const { data: cur, error: e0 } = await sb.from("cxs_member_data").select("data").eq("user_id", uid).maybeSingle();
  if (e0) throw e0;
  const prev = cur?.data || {};
  const merged = { ...prev, ...data };
  merged.food = { ...(prev.food || {}), ...(data.food || {}) };
  const byDay = new Map();
  [...(prev.measures || []), ...(data.measures || [])].forEach(m => byDay.set(m.d, m));
  merged.measures = [...byDay.values()].sort((a, b) => String(a.d).localeCompare(String(b.d)));
  const { error } = await sb.from("cxs_member_data").upsert({ user_id: uid, data: merged, summary, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function memberData(id) {
  const { data, error } = await sb.from("cxs_member_data").select("data,summary,updated_at").eq("user_id", id).maybeSingle();
  if (error) throw error; return data;
}
export async function allSummaries() {
  const { data, error } = await sb.from("cxs_member_data").select("user_id,summary,updated_at").order("updated_at", { ascending: false }).limit(500);
  if (error) throw error; return data || [];
}

// Espace coach : données privées (to-do, business, notes), bibliothèque partagée, derniers messages
export async function storeGet(keys) {
  const { data, error } = await sb.from("cxs_coach_store").select("key,value").in("key", keys);
  if (error) throw error; return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}
export async function storeSet(key, value) {
  const { error } = await sb.from("cxs_coach_store").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function libraryAll() {
  const { data, error } = await sb.from("cxs_library").select("id,kind,name,data,updated_at").order("id", { ascending: true }).limit(2000);
  if (error) throw error; return data || [];
}
export async function libraryAdd(kind, name, data) {
  const { data: r, error } = await sb.from("cxs_library").insert({ kind, name, data }).select("id").single();
  if (error) throw error; return r.id;
}
export async function libraryUpdate(id, fields) {
  const { error } = await sb.from("cxs_library").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function libraryDel(id) { const { error } = await sb.from("cxs_library").delete().eq("id", id); if (error) throw error; }
export async function lastMessages() {
  const { data, error } = await sb.from("cxs_messages").select("user_id,sender,body,created_at,read_at").order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  const by = {};
  (data || []).forEach(m => { const t = by[m.user_id] = by[m.user_id] || { last: m, unread: 0, bilan: false }; if (m.sender === m.user_id && !m.read_at) { t.unread++; if (/^📝 Bilan/.test(m.body)) t.bilan = true; } });
  return by;
}

// Données migrées depuis TB my Coach : history (séances), food (repas par jour), measures (mesures)
export async function fetchMigrated() {
  const uid = await currentUserIdSb();
  if (!uid) return null;
  const { data, error } = await sb.from("cxs_member_data").select("data").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}
async function currentUserIdSb() { const { data } = await sb.auth.getSession(); return data.session?.user?.id || null; }

// Décalages de séances posés par le coach (table cxs_coach_slots). Le membre les lit, le coach les écrit.
export async function coachSlots() {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("cxs_coach_slots").select("orig_d,new_d,new_time,updated_at");
  if (error) throw error; return data || [];
}
export async function coachSlotSet(memberId, origD, newD, newTime) {
  const { error } = await sb.from("cxs_coach_slots").upsert({ user_id: memberId, orig_d: origD, new_d: newD, new_time: newTime || null, updated_at: new Date().toISOString() });
  if (error) throw error;
}
