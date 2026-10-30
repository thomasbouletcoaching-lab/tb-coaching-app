// Mon compte : connexion par e-mail aux comptes TB my Coach (coaching, messages, synchronisation).
import * as C from "../cloud.js";
import { convertTb, tbPosition } from "../tbconvert.js";
import { S, update, APP_MODE, today } from "../store.js";
import { refreshMe } from "../sync.js";
import { $app, esc, toast, routes, forms, actions, I, header, tabbar, rerender, go, isCoach } from "../core.js";

let mode = "signin"; // signin | signup | reset

// Numéro de téléphone accepté à la place de l'e-mail : même identifiant technique que dans TB my Coach
function loginId(s) {
  s = String(s || "").trim();
  if (!s || s.includes("@")) return s;
  let d = s.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (/^0\d{9}$/.test(d)) d = "33" + d.slice(1);
  d = d.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? `tel-${d}@tel.tbcoach.invalid` : s;
}

async function body() {
  const email = await C.accountEmail();
  if (email) {
    return `<div class="card mt12"><div class="lbl">Connecté</div><p class="mt8" style="margin:0"><b>${esc(email)}</b></p>
      <p class="small muted mt8">Tes séances, ta nutrition et tes mesures restent sur ce téléphone. Le coaching et la messagerie passent par ton compte TB my Coach.</p>
      <button class="btn btn-red mt12" data-a="account-restore">Restaurer mes données TB my Coach</button>
      <button class="btn btn-line mt12" data-a="account-out">Me déconnecter</button></div>`;
  }
  const tab = (m, l) => `<button class="btn ${mode === m ? "btn-red" : "btn-line"} btn-sm" data-a="account-mode" data-v="${m}">${l}</button>`;
  const head = `<div class="row mt12" style="gap:8px">${tab("signin", "Connexion")}${tab("signup", "Créer un compte")}${tab("reset", "Mot de passe")}</div>`;
  if (mode === "reset") return `${head}<div class="card mt12"><form data-f="account-reset">
      <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label>
      <button class="btn btn-red mt12">Recevoir le lien</button></form></div>`;
  const signup = mode === "signup";
  return `${head}<div class="card mt12"><form data-f="${signup ? "account-signup" : "account-signin"}">
      ${signup ? `<label class="field"><span>Prénom</span><input name="name" autocomplete="given-name"></label>` : ""}
      <label class="field"><span>E-mail ou téléphone</span><input name="email" type="text" inputmode="email" autocomplete="username" required></label>
      <label class="field"><span>Mot de passe (6 caractères min.)</span><input name="password" type="password" minlength="6" autocomplete="${signup ? "new-password" : "current-password"}" required></label>
      <button class="btn btn-red mt12">${signup ? "Créer mon compte" : "Me connecter"}</button></form></div>
      <p class="xs muted mt8">Utilise l'e-mail de ton compte TB my Coach : tes accès coaching sont les mêmes.</p>`;
}

routes.account = async () => {
  const content = await body();
  $app.innerHTML = header("Mon compte", "", { back: "profile" }) + `<main class="page">${content}</main>${tabbar("profile")}`;
};

actions["account-mode"] = (b, d) => { mode = d.v; rerender(); };

actions["account-restore"] = async () => {
  try { const r = await restoreMigrated(); toast(r.w + r.f + r.m + r.p ? `Restauré : ${r.w} séances, ${r.f} repas, ${r.m} mesures${r.p ? ", programme et position TB" : ""}` : "Rien de nouveau à restaurer"); }
  catch (e) { toast("Restauration impossible : " + e.message); }
  rerender();
};

actions["account-out"] = async () => {
  try { await C.signOutSb(); toast("Déconnecté"); } catch (e) { toast("Déconnexion impossible : " + e.message); }
  rerender();
};

// Fusionne les données migrées de TB my Coach (séances, repas, mesures) avec ce que le téléphone contient déjà.
// Rien n'est effacé : on ajoute ce qui manque (même identifiant ou même jour = déjà présent, on ne double pas).
export async function restoreMigrated() {
  const m = await C.fetchMigrated();
  if (!m) return { w: 0, f: 0, m: 0, p: 0 };
  let w = 0, f = 0, ms = 0;
  update(st => {
    const ids = new Set((st.workouts || []).map(x => String(x.id)));
    const addW = (m.history || []).filter(x => !ids.has(String(x.id)));
    if (addW.length) { st.workouts = [...(st.workouts || []), ...addW].sort((a, b) => String(a.start || "").localeCompare(String(b.start || ""))); w = addW.length; }
    st.food = st.food || {};
    Object.entries(m.food || {}).forEach(([d, arr]) => {
      const cur = st.food[d] || [];
      const have = new Set(cur.map(x => String(x.id)));
      const add = (arr || []).filter(x => !have.has(String(x.id)));
      if (add.length) { st.food[d] = [...cur, ...add]; f += add.length; }
    });
    const days = new Set((st.measures || []).map(x => x.d));
    const addM = (m.measures || []).filter(x => !days.has(x.d));
    if (addM.length) { st.measures = [...(st.measures || []), ...addM].sort((a, b) => String(a.d).localeCompare(String(b.d))); ms = addM.length; }
  });
  // Programme en cours (converti depuis TB my Coach) et position : remplacent le plan créé à l'onboarding
  // La position n'est posée qu'une fois (tant que le plan n'est pas celui de TB) : elle ne revient pas en arrière ensuite
  let p = 0;
  const prog = m.tbRaw?.sessions?.length ? convertTb(m.tbRaw, "main") : null;
  if (prog) {
    const pos = tbPosition(prog, m.tbRaw.last || null);
    update(st => {
      st.customPrograms = [...(st.customPrograms || []).filter(x => x.id !== prog.id), prog];
      if (!st.plan || !String(st.plan.programId || "").startsWith("tb-")) { st.plan = pos; st.current = null; }
    });
    p = 1;
  }
  return { w, f, m: ms, p };
}

// Compte récupéré sur un nouveau téléphone : profil, plan et programme viennent de la copie du serveur
// (ce que le membre a envoyé au coach). Ne touche pas à un téléphone déjà configuré.
export async function restoreFromCloud(m) {
  if (!m || S().profile || !m.profile) return false;
  update(st => {
    st.profile = m.profile;
    st.plan = m.plan || st.plan;
    st.current = m.current ?? null;
    st.customPrograms = m.customPrograms || [];
    st.moves = m.moves || {}; st.skips = m.skips || {}; st.swaps = m.swaps || {};
    st.season = m.season ?? st.season; st.goals = m.goals ?? st.goals; st.lifts = m.lifts || st.lifts || {};
    st.workouts = m.workouts || []; st.food = m.food || {}; st.daily = m.daily || {}; st.measures = m.measures || [];
    st.settings = { ...(st.settings || {}), ...(m.settings || {}) };
    st.trialStart = st.trialStart || today();
    st.synced = true;
  });
  return true;
}

forms["account-signin"] = async (v) => {
  try {
    await C.signInEmail(loginId(v.email), v.password);
    let full = false; try { full = await restoreFromCloud(await C.fetchMigrated()); } catch (err) { console.warn("Compte non restauré :", err.message); }
    let r = { w: 0, f: 0, m: 0, p: 0 }; try { r = await restoreMigrated(); } catch (err) { console.warn("Données non restaurées :", err.message); }
    await refreshMe().catch(() => { });
    toast(full ? "Connecté · ton compte est restauré" : r.w + r.f + r.m ? `Connecté · ${r.w} séances, ${r.f} repas, ${r.m} mesures restaurés` : "Connecté");
    go(APP_MODE === "coach" && isCoach() ? "admin-today" : "profile");
  }
  catch (e) { toast(e.message === "Invalid login credentials" ? "E-mail ou mot de passe incorrect" : "Connexion impossible : " + e.message); }
};

forms["account-signup"] = async (v) => {
  try {
    const r = await C.signUpEmail(v.email.trim(), v.password, (v.name || "").trim());
    if (r.session) { toast("Compte créé"); go("profile"); }
    else { toast("Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi."); mode = "signin"; rerender(); }
  } catch (e) { toast("Création impossible : " + e.message); }
};

forms["account-reset"] = async (v) => {
  try { await C.resetPasswordEmail(v.email.trim()); toast("Lien envoyé par e-mail"); }
  catch (e) { toast("Envoi impossible : " + e.message); }
};
