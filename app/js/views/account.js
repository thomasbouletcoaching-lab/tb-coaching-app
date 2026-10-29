// Mon compte : connexion par e-mail aux comptes TB my Coach (coaching, messages, synchronisation).
import * as C from "../cloud.js";
import { S, update } from "../store.js";
import { $app, esc, toast, routes, forms, actions, I, header, tabbar, rerender, go } from "../core.js";

let mode = "signin"; // signin | signup | reset

async function body() {
  const email = await C.accountEmail();
  if (email) {
    return `<div class="card mt12"><div class="lbl">Connecté</div><p class="mt8" style="margin:0"><b>${esc(email)}</b></p>
      <p class="small muted mt8">Tes séances, ta nutrition et tes mesures restent sur ce téléphone. Le coaching et la messagerie passent par ton compte TB my Coach.</p>
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
      <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label>
      <label class="field"><span>Mot de passe (6 caractères min.)</span><input name="password" type="password" minlength="6" autocomplete="${signup ? "new-password" : "current-password"}" required></label>
      <button class="btn btn-red mt12">${signup ? "Créer mon compte" : "Me connecter"}</button></form></div>
      <p class="xs muted mt8">Utilise l'e-mail de ton compte TB my Coach : tes accès coaching sont les mêmes.</p>`;
}

routes.account = async () => {
  const content = await body();
  $app.innerHTML = header("Mon compte", "", { back: "profile" }) + `<main class="page">${content}</main>${tabbar("profile")}`;
};

actions["account-mode"] = (b, d) => { mode = d.v; rerender(); };

actions["account-out"] = async () => {
  try { await C.signOutSb(); toast("Déconnecté"); } catch (e) { toast("Déconnexion impossible : " + e.message); }
  rerender();
};

// Restaure l'historique migré, seulement si le téléphone n'a encore aucune séance
export async function restoreHistoryOnce() {
  if (S().workouts?.length) return 0;
  try {
    const h = await C.fetchHistory();
    if (!Array.isArray(h) || !h.length) return 0;
    update(st => { st.workouts = h; });
    return h.length;
  } catch (e) { console.warn("Historique non restauré :", e.message); return 0; }
}

forms["account-signin"] = async (v) => {
  try {
    await C.signInEmail(v.email.trim(), v.password);
    const n = await restoreHistoryOnce();
    toast(n ? `Connecté · ${n} séances restaurées` : "Connecté"); go("profile");
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
