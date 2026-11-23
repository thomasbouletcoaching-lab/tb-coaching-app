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
// Une seule conversation par membre, dans la table « cxs_messages » (l'ancienne table « messages » n'est plus écrite
// depuis la migration de la phase 2 ; elle reste en lecture seule jusqu'à son archivage).
let cidCache = null;
async function myClientId() {
  if (cidCache) return cidCache;
  const { data, error } = await sb.rpc("cxs_my_client_id"); if (error) throw error;
  cidCache = data || null; return cidCache;
}
// Fiche client liée au compte d'un membre : ne sert plus qu'au dossier des vocaux dans le stockage
async function clientIdFor(memberId) {
  if (!memberId || memberId === uid) return myClientId();
  const { data, error } = await sb.rpc("cxs_client_id_of", { p_uid: memberId }); if (error) throw error;
  return data || null;
}
const ownThread = (memberId) => !memberId || memberId === uid;
const MSG_COLS = "id,user_id,sender,body,created_at,read_at,reactions,audio_path,media";
export async function thread(memberId = uid) {
  const { data, error } = await sb.from("cxs_messages").select(MSG_COLS).eq("user_id", memberId || uid).order("created_at", { ascending: true }).limit(300);
  if (error) throw error; return data || [];
}
export async function send(body, memberId = uid, audioPath = null) {
  const { error } = await sb.from("cxs_messages").insert({ user_id: memberId || uid, sender: uid, body, audio_path: audioPath }); if (error) throw error;
}
// Message vocal : fichier dans le bucket « media », dans le dossier de la fiche client (mêmes droits que les photos)
export async function uploadAudio(blob, memberId = uid) {
  const cid = await clientIdFor(memberId); if (!cid) throw new Error("Aucune fiche client liée à ce compte");
  const ext = /mp4/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
  const path = `${cid}/audio/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (error) throw error; return path;
}
export async function audioUrl(path) {
  const { data, error } = await sb.storage.from("media").createSignedUrl(path, 3600);
  if (error) throw error; return data.signedUrl;
}
export async function react(id, emoji, current = {}) {
  const r = { ...(current || {}) }; if (r[uid] === emoji) delete r[uid]; else r[uid] = emoji;
  const { error } = await sb.from("cxs_messages").update({ reactions: r }).eq("id", id); if (error) throw error; return r;
}
export async function markRead(memberId, fromOther) {
  await sb.from("cxs_messages").update({ read_at: new Date().toISOString() }).eq("user_id", ownThread(memberId) ? uid : memberId).neq("sender", uid).is("read_at", null);
}
export async function markUnread(memberId) {
  const { data } = await sb.from("cxs_messages").select("id").eq("user_id", memberId).eq("sender", memberId).order("created_at", { ascending: false }).limit(1);
  if (data?.[0]) { const { error } = await sb.from("cxs_messages").update({ read_at: null }).eq("id", data[0].id); if (error) throw error; }
}
export async function unreadFromCoach() {
  if (!uid) return 0;
  const { count } = await sb.from("cxs_messages").select("id", { count: "exact", head: true }).eq("user_id", uid).neq("sender", uid).is("read_at", null);
  return count || 0;
}

// Bilans de l'ancienne app (migrés en phase 2, en lecture seule)
export async function legacyCheckins(memberId = uid) {
  const { data, error } = await sb.from("cxs_legacy_checkins").select("id,d,week,date_source,weight,sleep_q,win,coach_reply,legacy").eq("user_id", memberId || uid).order("d", { ascending: false }).limit(100);
  if (error) throw error; return data || [];
}

// Notifications
export async function notifications() {
  if (!uid) return [];
  const [{ data }, { data: rd }] = await Promise.all([
    sb.from("cxs_notifications").select("id,user_id,title,body,created_at").or(`user_id.is.null,user_id.eq.${uid}`).order("created_at", { ascending: false }).limit(50),
    sb.from("cxs_notif_reads").select("notif_id").eq("user_id", uid).limit(500)]);
  const lus = new Set((rd || []).map(r => r.notif_id));
  return (data || []).map(n => ({ ...n, read: lus.has(n.id) }));
}
// Lu / non lu, par notification (aussi pour celles envoyées à tous)
export async function notifRead(ids) { if (!uid || !ids.length) return; const { error } = await sb.from("cxs_notif_reads").upsert(ids.map(id => ({ user_id: uid, notif_id: id })), { ignoreDuplicates: true }); if (error) throw error; }
export async function notifUnread(id) { const { error } = await sb.from("cxs_notif_reads").delete().eq("user_id", uid).eq("notif_id", id); if (error) throw error; }
// Notifications push (abonnement de ce téléphone, test, rappel de fin de repos programmé côté serveur)
export async function pushPublicKey() { const { data, error } = await sb.rpc("push_public_key"); if (error) throw error; return data; }
export async function pushRegister(sub) { const j = sub.toJSON(); const { error } = await sb.rpc("push_register", { p_endpoint: j.endpoint, p_sub: j }); if (error) throw error; }
export async function pushTest() { const { data, error } = await sb.rpc("push_test"); if (error) throw error; return data; }
export async function pushRest(seconds, title, body) { if (!uid) return; const { error } = await sb.rpc("cxs_push_rest", { p_seconds: Math.round(seconds), ...(title ? { p_title: title } : {}), ...(body ? { p_body: body } : {}) }); if (error) throw error; }

// Espace coach
export async function members() {
  const { data, error } = await sb.from("cxs_profiles").select("id,email,name,tier,tier_until,onboarding,stats,created_at,last_seen,is_coach").order("last_seen", { ascending: false }).limit(500);
  if (error) throw error;
  const { data: un } = await sb.from("cxs_messages").select("user_id,sender").is("read_at", null).limit(2000);
  const unread = {}; (un || []).forEach(m => { if (m.sender === m.user_id) unread[m.user_id] = (unread[m.user_id] || 0) + 1; });
  return data.filter(p => !p.is_coach && !p.onboarding?.hidden).map(p => ({ ...p, unread: unread[p.id] || 0 }));
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
// Bibliothèque d'exercices classée par pattern (table cxs_exercices). Le membre ne reçoit que les exercices actifs (RLS).
export async function exercicesAll() {
  const { data, error } = await sb.from("cxs_exercices").select("id,slug,nom,pattern_principal,pattern_secondaire,couche,categorie,muscles,materiel,niveau,cout_nerveux,variantes,contre_indications,video_url,note,actif").order("nom", { ascending: true }).limit(2000);
  if (error) throw error; return data || [];
}
export async function exerciceUpdate(id, fields) {
  const { error } = await sb.from("cxs_exercices").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function lastMessages() {
  // Fil de chaque membre, TB et CalXsthenos réunis (fonction réservée au coach)
  const { data, error } = await sb.rpc("cxs_inbox").order("created_at", { ascending: false }).limit(2000);
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

// Programme écrit par le coach (table cxs_coach_plans). Le membre le lit, le coach l'écrit.
export async function coachPlan() {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("cxs_coach_plans").select("program,updated_at").eq("user_id", uid).maybeSingle();
  if (error) throw error; return data || null;
}
export async function coachPlanGet(memberId) {
  const { data, error } = await sb.from("cxs_coach_plans").select("program,updated_at").eq("user_id", memberId).maybeSingle();
  if (error) throw error; return data || null;
}
export async function coachPlanSet(memberId, program) {
  const { error } = await sb.from("cxs_coach_plans").upsert({ user_id: memberId, program, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Nutrition : totaux journaliers (table nutri_daily). Le membre écrit les siens, le coach lit ceux de tous.
export async function pushNutri(rows) {
  const { error } = await sb.from("nutri_daily").upsert(rows, { onConflict: "user_id,d" });
  if (error) throw error;
}
export async function nutriRecent(days = 7) {
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const { data, error } = await sb.from("nutri_daily").select("user_id,d,kcal,sucres_g,sodium_mg,potassium_mg").gte("d", from);
  if (error) throw error; return data || [];
}

// Plan alimentaire écrit par le coach (table cxs_coach_food_plans). Le membre le lit, le coach l'écrit.
export async function coachFood() {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("cxs_coach_food_plans").select("plan,updated_at").eq("user_id", uid).maybeSingle();
  if (error) throw error; return data || null;
}
export async function coachFoodGet(memberId) {
  const { data, error } = await sb.from("cxs_coach_food_plans").select("plan,updated_at").eq("user_id", memberId).maybeSingle();
  if (error) throw error; return data || null;
}
export async function coachFoodSet(memberId, plan) {
  const { error } = await sb.from("cxs_coach_food_plans").upsert({ user_id: memberId, plan, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Séance en direct (table cxs_live_sessions) : une seule séance par membre, lue et écrite par le membre et le coach.
export async function liveGet(userId) {
  const { data, error } = await sb.from("cxs_live_sessions").select("state,updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw error; return data || null;
}
export async function liveSet(userId, state) {
  const at = new Date().toISOString();
  const { error } = await sb.from("cxs_live_sessions").upsert({ user_id: userId, state, updated_at: at });
  if (error) throw error;
  return at;
}

// Coach : séances en direct qui tournent en ce moment (moins de 8 h, non terminées)
export async function liveAll() {
  const { data, error } = await sb.from("cxs_live_sessions").select("user_id,state,updated_at").order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  const lim = Date.now() - 8 * 3600e3;
  return (data || []).filter(r => r.state && Object.keys(r.state).length && !r.state.ended && new Date(r.updated_at).getTime() > lim);
}

// Brouillons « Volume de la semaine » et seuils MV/MEV/MAV/MRV (table programme_drafts).
// member_id = le membre concerné (soi-même pour son propre programme). Seul l'auteur lit et écrit ses brouillons ;
// le membre lit en plus les seuils que son coach a réglés pour lui.
export async function volDraftGet(memberId = null) {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("programme_drafts").select("name,status,data,updated_at").eq("owner", uid).eq("member_id", memberId || uid).eq("kind", "draft").maybeSingle();
  if (error) throw error; return data || null;
}
export async function volDraftSet(memberId, name, data, status = "draft") {
  if (!uid) await ensureSession();
  const { error } = await sb.from("programme_drafts").upsert({ owner: uid, member_id: memberId || uid, kind: "draft", status, name, data, updated_at: new Date().toISOString() }, { onConflict: "owner,member_id,kind" });
  if (error) throw error;
}
export async function volSeuilsGet(memberId = null) {
  if (!uid) await ensureSession();
  const m = memberId || uid;
  const { data, error } = await sb.from("programme_drafts").select("owner,data,updated_at").eq("member_id", m).eq("kind", "seuils");
  if (error) throw error;
  const rows = data || [];
  // Pour un membre : les seuils du coach priment sur les siens
  const r = memberId ? rows.find(x => x.owner === uid) : (rows.find(x => x.owner !== uid) || rows.find(x => x.owner === uid));
  return r?.data || null;
}
export async function volSeuilsSet(memberId, data) {
  if (!uid) await ensureSession();
  const { error } = await sb.from("programme_drafts").upsert({ owner: uid, member_id: memberId || uid, kind: "seuils", status: "publie", name: "Seuils de volume", data, updated_at: new Date().toISOString() }, { onConflict: "owner,member_id,kind" });
  if (error) throw error;
}

// Photos de progrès partagées volontairement par le membre : dossier privé progress/<uid>/ du bucket « media ».
// Droits : migration supabase/migrations/2026-11-08_suivi_photos.sql (le membre dépose et lit les siennes, le coach lit tout).
export async function uploadProgressPhoto(blob, name) {
  if (!uid) await ensureSession();
  const path = `progress/${uid}/${name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await sb.storage.from("media").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
  if (error) throw error; return path;
}
export async function progressPhotoUrls(paths) {
  if (!paths?.length) return {};
  const { data, error } = await sb.storage.from("media").createSignedUrls(paths, 3600);
  if (error) throw error;
  return Object.fromEntries((data || []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]));
}

// ---------- Module « athlète hybride » (tables cxs_hyb_*, fonction hybride-xp) ----------
// Les règles d'accès sont côté serveur : un membre n'écrit que son bloc et l'apparence de son personnage ;
// l'XP, les quêtes et les objets débloqués ne sont écrits que par la fonction hybride-xp.
export async function hybBlocSave(b) {
  const { error } = await sb.from("cxs_hyb_bloc").upsert({ user_id: uid, macro_id: b.macroId, debut: b.debut, nb_seances: b.nbSeances, data: { reprise: !!b.reprise, vma: b.vma || null, halterophilie: !!b.halterophilie } }, { onConflict: "user_id" });
  if (error) throw error;
}
export async function hybApparence(apparence) {
  const { error } = await sb.from("cxs_hyb_personnage").upsert({ user_id: uid, apparence }, { onConflict: "user_id" });
  if (error) throw error;
}
export async function hybCalcul() {
  const { data, error } = await sb.functions.invoke("hybride-xp", { body: {} });
  if (error) throw error;
  return data;
}
export async function hybConsentir(accord) { const { error } = await sb.rpc("cxs_hyb_consentir", { p_accord: !!accord }); if (error) throw error; }
export async function hybConsentement() { const { data } = await sb.from("cxs_hyb_consentement").select("accorde_le, revoque_le").eq("user_id", uid).maybeSingle(); return data || null; }
// Vue coach : les règles d'accès renvoient des lignes vides pour un abonné en autonomie sans consentement
export async function hybPourCoach(memberId) {
  const [b, x, q] = await Promise.all([
    sb.from("cxs_hyb_bloc").select("macro_id, debut, nb_seances, updated_at").eq("user_id", memberId).maybeSingle(),
    (async () => { const out = []; for (let de = 0; de < 20000; de += 1000) { const r = await sb.from("cxs_hyb_xp").select("xp, cree_le").eq("user_id", memberId).order("cree_le", { ascending: false }).range(de, de + 999); if (r.error) return r; out.push(...(r.data || [])); if ((r.data || []).length < 1000) break; } return { data: out }; })(),
    sb.from("cxs_hyb_quetes").select("quete_id, periode, reussie_le").eq("user_id", memberId).order("reussie_le", { ascending: false }).limit(20),
  ]);
  return { bloc: b.data || null, xp: (x.data || []).reduce((t, e) => t + (e.xp || 0), 0), dernier: x.data?.[0]?.cree_le || null, quetes: q.data || [], vide: !b.data && !(x.data || []).length };
}

// ---------- Partage, amis, communauté, parrainage (migration 2026-11-18_cxs_social.sql) ----------
// Sans la migration, les fonctions n'existent pas : erreur « SOCIAL_ABSENT », l'écran affiche « bientôt disponible ».
export class SocialAbsent extends Error { constructor() { super("SOCIAL_ABSENT"); this.name = "SocialAbsent"; } }
async function soc(fn, args = {}) {
  if (!uid) await ensureSession();
  const { data, error } = await sb.rpc(fn, args);
  if (error) { if (error.code === "PGRST202" || error.code === "42883" || error.code === "PGRST205" || /Could not find the function|does not exist/i.test(error.message || "")) throw new SocialAbsent(); throw error; }
  return data;
}
export const socMoi = (depuis = null) => soc("cxs_soc_moi", { p_depuis: depuis });
export const socProfil = (pseudo, avatar, communaute, visibilite) => soc("cxs_soc_profil_enregistrer", { p_pseudo: pseudo, p_avatar: avatar, p_communaute: communaute, p_visibilite: visibilite });
export const socCode = (pseudo = null) => soc("cxs_soc_mon_code", { p_pseudo: pseudo });
export const socPublier = (cle, data, visibilite, type = "seance") => soc("cxs_soc_publier", { p_cle: cle, p_type: type, p_data: data, p_visibilite: visibilite });
export const socRetirer = (id) => soc("cxs_soc_retirer", { p_id: id });
export const socFil = (portee, avant = null, limite = 30) => soc("cxs_soc_fil", { p_portee: portee, p_avant: avant, p_limite: limite });
export const socReagir = (id, emoji, on = true) => soc("cxs_soc_reagir", { p_activite: id, p_emoji: emoji, p_on: on });
export const socSignaler = (id, motif) => soc("cxs_soc_signaler", { p_activite: id, p_motif: motif });
export const socAmiDemander = (code) => soc("cxs_soc_ami_demander", { p_code: code });
export const socAmiRepondre = (autre, oui) => soc("cxs_soc_ami_repondre", { p_demandeur: autre, p_accepte: oui });
export const socAmiRetirer = (autre) => soc("cxs_soc_ami_retirer", { p_autre: autre });
export const socAmis = () => soc("cxs_soc_amis_liste");
export const parrainageLier = (code) => soc("cxs_parrainage_lier", { p_code: code });
export const socEffacer = () => soc("cxs_soc_effacer_mes_donnees");
// Coach : modération, signalements, parrainages et récompenses
export const socModerer = (id, masque) => soc("cxs_soc_moderer", { p_activite: id, p_masque: masque });
export const recompenseTraiter = (id, oui, note = null) => soc("cxs_recompense_traiter", { p_id: id, p_accorde: oui, p_note: note });
export async function socCoach() {
  if (!uid) await ensureSession();
  const [sig, rec, par, prof] = await Promise.all([
    sb.from("cxs_soc_signalements").select("id,activite_id,motif,created_at,traite_le").is("traite_le", null).order("created_at", { ascending: false }).limit(50),
    sb.from("cxs_recompenses").select("id,parrain_id,filleul_id,type,mode,statut,note,created_at").order("created_at", { ascending: false }).limit(100),
    sb.from("cxs_parrainages").select("filleul_id,parrain_id,lie_le,premium_le").order("lie_le", { ascending: false }).limit(500),
    sb.from("cxs_soc_profils").select("user_id,pseudo,avatar,communaute,masque").limit(1000),
  ]);
  const e = sig.error || rec.error || par.error || prof.error;
  if (e) { if (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message || "")) throw new SocialAbsent(); throw e; }
  const ids = [...new Set((sig.data || []).map(s => s.activite_id))];
  const acts = ids.length ? (await sb.from("cxs_soc_activites").select("id,user_id,data,visibilite,masque,created_at").in("id", ids)).data || [] : [];
  return { signalements: sig.data || [], recompenses: rec.data || [], parrainages: par.data || [], profils: prof.data || [], activites: acts };
}
// Liens de partage courts (migration 2026-11-19_cxs_partages.sql). La lecture marche sans compte (personne invitée).
export const partageCreer = (type, data) => soc("cxs_soc_partage_creer", { p_type: type, p_data: data });
export async function partageLire(id) {
  const { data, error } = await sb.rpc("cxs_soc_partage_lire", { p_id: id });
  if (error) throw error;
  return data;
}

// Réglages du coach pour un membre (table cxs_coach_settings) : bilans réglés et échéances. Le coach écrit, le membre lit les siens.
export async function coachSettingsGet(memberId) {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("cxs_coach_settings").select("data,updated_at").eq("user_id", memberId).maybeSingle();
  if (error) throw error; return data?.data || {};
}
export async function coachSettingsSet(memberId, data) {
  const { error } = await sb.from("cxs_coach_settings").upsert({ user_id: memberId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function myCoachSettings() {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("cxs_coach_settings").select("data,updated_at").eq("user_id", uid).maybeSingle();
  if (error) throw error; return data?.data || null;
}

// ---------- Refonte étape 2 : invitations (athlète préparé), infos publiques du coach, sondages, défis de groupe ----------
export async function invites() { const { data, error } = await sb.from("cxs_invites").select("*").order("created_at", { ascending: false }).limit(200); if (error) throw error; return data || []; }
export async function inviteSave(row) { const { error } = await sb.from("cxs_invites").upsert(row); if (error) throw error; }
export async function inviteDel(code) { const { error } = await sb.from("cxs_invites").delete().eq("code", code); if (error) throw error; }
export async function inviteClaim(code = null) { if (!uid) await ensureSession(); const { data, error } = await sb.rpc("cxs_invite_claim", { p_code: code }); if (error) throw error; return data; }
export async function coachPublic(keys) { const { data, error } = await sb.from("cxs_coach_public").select("key,value,updated_at").in("key", keys); if (error) throw error; return Object.fromEntries((data || []).map(r => [r.key, r.value])); }
export async function coachPublicSet(key, value) { const { error } = await sb.from("cxs_coach_public").upsert({ key, value, updated_at: new Date().toISOString() }); if (error) throw error; }
export async function pollVote(id, choice) { if (!uid) await ensureSession(); const { error } = await sb.from("cxs_poll_votes").upsert({ poll_id: id, user_id: uid, choice, at: new Date().toISOString() }); if (error) throw error; }
export async function myVotes() { if (!uid) await ensureSession(); const { data, error } = await sb.from("cxs_poll_votes").select("poll_id,choice").eq("user_id", uid); if (error) throw error; return Object.fromEntries((data || []).map(r => [r.poll_id, r.choice])); }
export async function pollResults(id) { const { data, error } = await sb.rpc("cxs_poll_results", { p_id: id }); if (error) throw error; return Object.fromEntries((data || []).map(r => [r.choice, Number(r.n)])); }
export async function defiParts(id) { const { data, error } = await sb.from("cxs_defi_parts").select("user_id,alias,value,updated_at").eq("defi_id", id).order("value", { ascending: false }).limit(100); if (error) throw error; return data || []; }
export async function defiJoin(id, alias, value) { if (!uid) await ensureSession(); const { error } = await sb.from("cxs_defi_parts").upsert({ defi_id: id, user_id: uid, alias, value, updated_at: new Date().toISOString() }); if (error) throw error; }
export async function defiLeave(id) { if (!uid) await ensureSession(); const { error } = await sb.from("cxs_defi_parts").delete().eq("defi_id", id).eq("user_id", uid); if (error) throw error; }
export const myUid = () => uid;

// ---------- Correction des séances (coach ↔ athlète) ----------
export async function reviewsOf(memberId) { const { data, error } = await sb.from("cxs_session_reviews").select("workout_id,data,updated_at,seen_at").eq("user_id", memberId).order("updated_at", { ascending: false }).limit(300); if (error) throw error; return Object.fromEntries((data || []).map(r => [r.workout_id, r])); }
export async function reviewSave(memberId, workoutId, data) { const { error } = await sb.from("cxs_session_reviews").upsert({ user_id: memberId, workout_id: String(workoutId), data, updated_at: new Date().toISOString(), seen_at: null }); if (error) throw error; }
export async function reviewDel(memberId, workoutId) { const { error } = await sb.from("cxs_session_reviews").delete().eq("user_id", memberId).eq("workout_id", String(workoutId)); if (error) throw error; }
export async function myReviews() { if (!uid) await ensureSession(); return reviewsOf(uid); }
export async function reviewSeen(ids) { if (!ids.length) return; const { error } = await sb.rpc("cxs_review_seen", { p_ids: ids.map(String) }); if (error) throw error; }
export const socCommenter = (id, texte) => soc("cxs_soc_commenter", { p_activite: id, p_texte: texte });
export const socCommentaires = (id) => soc("cxs_soc_commentaires_lire", { p_activite: id }).then(r => r || []);
export const socNbCommentaires = (ids) => soc("cxs_soc_nb_commentaires", { p_ids: ids }).then(r => Object.fromEntries((r || []).map(x => [x.activite_id, Number(x.n)])));
export const socRetirerCommentaire = (id) => soc("cxs_soc_commentaire_retirer", { p_id: id });

// ---------- Apple Santé via l'app Raccourcis (fonction « sante ») ----------
export const SANTE_URL = CONFIG.supabaseUrl + "/functions/v1/sante";
export async function healthTokenNew() { const { data, error } = await sb.rpc("cxs_health_token_new"); if (error) throw error; return data; }
export async function healthStatus() { if (!uid) await ensureSession(); const { data } = await sb.from("cxs_health_tokens").select("created_at,last_used").eq("user_id", uid).maybeSingle(); return data || null; }
export async function healthDel() { const { error } = await sb.from("cxs_health_tokens").delete().eq("user_id", uid); if (error) throw error; }
export async function healthDaily(since) { if (!uid) return []; const { data, error } = await sb.from("cxs_health_daily").select("d,data").eq("user_id", uid).gte("d", since).order("d"); if (error) throw error; return data || []; }

// ---------- Vidéos à analyser (table cxs_video_demandes, bucket « media », dossier <client>/analyses/<id>/) ----------
export async function videoEnvoyer(blob, { mvt = null, note = "" } = {}) {
  if (!uid) await ensureSession(); const cid = await myClientId(); if (!cid) throw new Error("Aucune fiche client liée à ce compte : écris à Thomas");
  const id = crypto.randomUUID(), ext = /quicktime/.test(blob.type) ? "mov" : /webm/.test(blob.type) ? "webm" : /m4v/.test(blob.type) ? "m4v" : "mp4";
  const path = `${cid}/analyses/${id}/source.${ext}`;
  const { error: e1 } = await sb.storage.from("media").upload(path, blob, { contentType: blob.type || "video/mp4", upsert: false }); if (e1) throw e1;
  const { error } = await sb.from("cxs_video_demandes").insert({ id, mvt, note: note || null, source_path: path });
  if (error) { await sb.storage.from("media").remove([path]).catch(() => { }); throw error; }
  return id;
}
export async function videosMiennes() {
  if (!uid) await ensureSession();
  const { data, error } = await sb.from("cxs_video_demandes").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(100); if (error) throw error; return data || [];
}
export async function videosCoach(memberId = null) {
  let q = sb.from("cxs_video_demandes").select("*").order("created_at", { ascending: false }).limit(200); if (memberId) q = q.eq("user_id", memberId);
  const { data, error } = await q; if (error) throw error; return data || [];
}
export async function videoUrl(path) { const { data, error } = await sb.storage.from("media").createSignedUrl(path, 3600); if (error) throw error; return data.signedUrl; }
export async function videoStatut(id, statut) { const { error } = await sb.from("cxs_video_demandes").update({ statut }).eq("id", id); if (error) throw error; }
// Le coach partage son analyse : compte rendu (JSON) et vidéo commentée (facultative), dans le dossier de la demande
export async function videoPartager(d, compteRendu, blob = null) {
  let analyse_path = d.analyse_path || null;
  if (blob) { const dir = d.source_path.replace(/\/source\.[^/]+$/, ""), ext = /webm/.test(blob.type) ? "webm" : "mp4"; analyse_path = `${dir}/analyse.${ext}`;
    const { error: e1 } = await sb.storage.from("media").upload(analyse_path, blob, { contentType: blob.type || "video/mp4", upsert: true }); if (e1) throw e1; }
  const { error } = await sb.from("cxs_video_demandes").update({ statut: "analysee", compte_rendu: compteRendu, analyse_path, analysed_at: new Date().toISOString() }).eq("id", d.id); if (error) throw error;
  await notify("🎥 Ton analyse vidéo est prête", `Thomas a analysé ta vidéo${compteRendu?.mvtNom ? ` (${compteRendu.mvtNom.toLowerCase()})` : ""}. Ouvre Entraînement › Analyses vidéo.`, d.user_id).catch(() => { });
}
export async function videoVue(id) { const { error } = await sb.rpc("cxs_video_vue", { p_id: id }); if (error) throw error; }
export async function videoSupprimer(d) { await sb.storage.from("media").remove([d.source_path, d.analyse_path].filter(Boolean)).catch(() => { }); const { error } = await sb.from("cxs_video_demandes").delete().eq("id", d.id); if (error) throw error; }

// Fusion d'un compte athlète dans le compte coach : le téléphone athlète dépose une copie complète,
// le compte coach la récupère puis rattache les données serveur (cxs_fusion_comptes).
export async function transfertDeposer(store) {
  if (!uid) await ensureSession();
  const { error } = await sb.from("cxs_transferts").upsert({ user_id: uid, data: store, created_at: new Date().toISOString() });
  if (error) throw error;
}
export async function transfertRecuperer(email) {
  const { data: id, error: e1 } = await sb.rpc("cxs_id_par_email", { p_email: email });
  if (e1) throw e1; if (!id) return null;
  const { data, error } = await sb.from("cxs_transferts").select("data,created_at").eq("user_id", id).maybeSingle();
  if (error) throw error;
  return { id, depot: data?.data || null, at: data?.created_at || null };
}
export async function fusionComptes(src) { const { data, error } = await sb.rpc("cxs_fusion_comptes", { src }); if (error) throw error; return data; }

// Espace créé d'avance par le coach : création du compte puis lien de connexion à usage unique (fonction coach-precreer)
export async function precreer(body) {
  const { data, error } = await sb.functions.invoke("coach-precreer", { body });
  if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch { } throw new Error(m); }
  if (data?.error) throw new Error(data.error); return data;
}
export async function signInToken(tokenHash) {
  const { data, error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) throw error;
  uid = data.user.id; await ensureProfile(data.user); return data;
}
