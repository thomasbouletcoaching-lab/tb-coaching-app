// Anamnèse : santé, blessures, historique, mode de vie, motivation. Complète l'onboarding (qui reste court).
// Questions santé inspirées du PAR-Q+ 2023 (PAR-Q+ Collaboration), reformulées : ce n'est pas le questionnaire officiel.
// Données de santé : consentement explicite, stockées sur le téléphone et partagées uniquement avec le coach.
import { S, update, today } from "../store.js";
import { $app, esc, num, toast, routes, actions, forms, go, header, tabbar, fmtDate, buzz, I } from "../core.js";
import { pushData } from "../sync.js";
import { defiOn } from "../progress.js";

export const HEALTH = [
  ["heart", "Un médecin t'a-t-il déjà parlé d'un problème au cœur ou d'une tension trop élevée ?"],
  ["chest", "As-tu une douleur dans la poitrine au repos, dans ta journée ou pendant l'effort ?"],
  ["dizzy", "Dans les 12 derniers mois, as-tu perdu l'équilibre à cause d'un vertige, ou perdu connaissance ?"],
  ["chronic", "As-tu une autre maladie chronique diagnostiquée (diabète, asthme, autre) ?"],
  ["meds", "Prends-tu en ce moment un traitement sur ordonnance pour une maladie chronique ?"],
  ["joint", "As-tu (ou as-tu eu dans les 12 derniers mois) un problème aux os, articulations, tendons ou muscles qui pourrait s'aggraver si tu bouges plus ?"],
  ["supervised", "Un médecin t'a-t-il dit de ne faire du sport que sous surveillance médicale ?"],
];
const ZONES = [["epaule", "Épaule"], ["coude", "Coude"], ["poignet", "Poignet"], ["nuque", "Nuque, haut du dos"], ["lombaires", "Bas du dos"], ["hanche", "Hanche"], ["genou", "Genou"], ["cheville", "Cheville, pied"]];
const TRIED = [["salle", "La salle, sans accompagnement"], ["coach", "Un coach"], ["programme", "Un programme en ligne"], ["appli", "Une appli"], ["regime", "Un régime"], ["sport", "Un sport collectif"]];
const SCHED = [["bureau", "Horaires de bureau"], ["decale", "Horaires décalés"], ["deplacement", "Souvent en déplacement"], ["variable", "Très variables"]];
const ALCO = [["jamais", "Jamais"], ["rare", "Occasionnellement"], ["semaine", "Chaque week-end"], ["souvent", "Plusieurs fois par semaine"]];
const YEARS = [["0", "Jamais vraiment"], ["1", "Moins d'1 an"], ["3", "1 à 3 ans"], ["5", "Plus de 3 ans"]];

const yn = (k, cur) => `<div class="yn"><label><input type="radio" name="h_${k}" value="0" ${cur === false ? "checked" : ""}><span>Non</span></label><label><input type="radio" name="h_${k}" value="1" ${cur === true ? "checked" : ""}><span>Oui</span></label></div>`;
const multi = (name, opts, cur = []) => `<div class="chips wrap">${opts.map(([v, l]) => `<label class="chip sm pick"><input type="checkbox" name="${name}" value="${v}" ${cur.includes(v) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
const one = (name, opts, cur) => `<div class="chips wrap">${opts.map(([v, l]) => `<label class="chip sm pick"><input type="radio" name="${name}" value="${v}" ${String(cur) === v ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;

routes.anamnese = () => {
  const a = S().anamnese || {}, h = a.health || {}, hi = a.history || {}, li = a.life || {}, mo = a.motivation || {};
  $app.innerHTML = header("Mon point de départ", a.at ? `Rempli le ${fmtDate(a.at.slice(0, 10), { day: "numeric", month: "long" })} · modifiable` : "3 minutes · pour un plan sans risque et qui te ressemble", { back: "__hist", offers: false }) + `<main class="page">
    <div class="card soft"><p class="small" style="margin:0">Ces réponses servent à adapter ton programme et à repérer ce qui demande l'avis d'un médecin. Elles restent sur ton téléphone et ne sont partagées qu'avec Thomas, ton coach.</p></div>
    <form data-f="anamnese" class="stack mt12">
      <h2 class="sec">🩺 Santé</h2>
      <div class="list">${HEALTH.map(([k, q]) => `<div class="li" style="flex-direction:column;align-items:stretch;gap:8px"><span class="small">${q}</span>${yn(k, h[k])}</div>`).join("")}</div>
      <label class="field"><span>Si tu as répondu oui, précise (facultatif)</span><textarea name="healthNote" maxlength="400">${esc(a.healthNote || "")}</textarea></label>
      <div class="card"><b class="small">Une douleur ou une gêne en ce moment ?</b>${multi("zones", ZONES, a.zones || [])}<p class="xs muted mt8" style="margin:0">Rien de coché = aucune gêne.</p></div>
      <label class="field"><span>Opérations ou blessures passées (facultatif)</span><input name="surgery" maxlength="200" value="${esc(a.surgery || "")}" placeholder="ex. ligaments croisés genou gauche, 2019"></label>

      <h2 class="sec">📜 Ton historique</h2>
      <div class="card"><b class="small">Depuis quand tu t'entraînes vraiment ?</b>${one("years", YEARS, hi.years)}</div>
      <div class="card"><b class="small">Ce que tu as déjà essayé</b>${multi("tried", TRIED, hi.tried || [])}</div>
      <label class="field"><span>Ce qui a marché pour toi</span><textarea name="worked" maxlength="400">${esc(hi.worked || "")}</textarea></label>
      <label class="field"><span>Ce qui t'a fait arrêter ou stagner</span><textarea name="stopped" maxlength="400" placeholder="Sois honnête, c'est entre nous">${esc(hi.stopped || "")}</textarea></label>

      <h2 class="sec">🏠 Ton mode de vie</h2>
      <div class="grid2"><label class="field"><span>Sommeil habituel (h / nuit)</span><input name="sleep" inputmode="decimal" value="${li.sleep != null ? String(li.sleep).replace(".", ",") : ""}" placeholder="ex. 6,5"></label>
        <label class="field"><span>Stress au travail (1 à 10)</span><input name="stress" inputmode="numeric" value="${li.stress ?? ""}" placeholder="ex. 6"></label></div>
      <div class="card"><b class="small">Ton rythme de travail</b>${one("schedule", SCHED, li.schedule)}</div>
      <div class="card"><b class="small">Enfants à la maison ?</b>${one("kids", [["0", "Non"], ["1", "Oui"]], li.kids == null ? "" : li.kids ? "1" : "0")}</div>
      <div class="card"><b class="small">Alcool</b>${one("alcohol", ALCO, li.alcohol)}</div>
      <div class="card"><b class="small">Tabac</b>${one("smoke", [["0", "Non"], ["1", "Oui"]], li.smoke == null ? "" : li.smoke ? "1" : "0")}</div>

      <h2 class="sec">🔥 Ta motivation</h2>
      <label class="field"><span>Pourquoi maintenant ? Ta vraie raison</span><textarea name="why" maxlength="400" placeholder="ex. je veux pouvoir monter trois étages sans m'essouffler">${esc(mo.why || "")}</textarea></label>
      <label class="field"><span>Dans 12 semaines, ta plus grande fierté serait…</span><textarea name="proud" maxlength="400">${esc(mo.proud || "")}</textarea></label>
      <div class="grid2"><label class="field"><span>Une date qui compte ? (facultatif)</span><input type="date" name="deadline" min="${today()}" value="${esc(mo.deadline || "")}"></label>
        <label class="field"><span>Envie de changer tes habitudes (1 à 10)</span><input name="ready" inputmode="numeric" value="${mo.ready ?? ""}" placeholder="ex. 8"></label></div>

      <label class="check mt8"><input type="checkbox" name="consent" ${a.consent ? "checked" : ""} required> J'accepte que ces informations, dont celles sur ma santé, soient enregistrées et partagées avec mon coach pour adapter mon accompagnement. Je peux les modifier ou les effacer à tout moment.</label>
      <button class="btn btn-red">Enregistrer</button>
      ${a.at ? `<button type="button" class="btn btn-ghost btn-sm" data-a="anam-del" style="align-self:center">Effacer mes réponses</button>` : ""}
    </form></main>${tabbar("profile")}`;
};

forms.anamnese = (v, f) => {
  const fd = new FormData(f), all = (k) => fd.getAll(k);
  if (!v.consent) return toast("Coche la case de consentement pour enregistrer.");
  const health = {}; let missing = 0;
  HEALTH.forEach(([k]) => { if (v["h_" + k] == null) missing++; else health[k] = v["h_" + k] === "1"; });
  if (missing) return toast(`Réponds aux ${HEALTH.length} questions santé (${missing} sans réponse).`);
  const n = (x, lo, hi) => { const y = num(x); return y >= lo && y <= hi ? y : null; };
  const flags = HEALTH.filter(([k]) => health[k]).map(([k]) => k);
  const a = { at: new Date().toISOString(), consent: true, health, healthNote: (v.healthNote || "").trim(), zones: all("zones"), surgery: (v.surgery || "").trim(), flags,
    history: { years: v.years || null, tried: all("tried"), worked: (v.worked || "").trim(), stopped: (v.stopped || "").trim() },
    life: { sleep: n(v.sleep, 2, 14), stress: n(v.stress, 1, 10), schedule: v.schedule || null, kids: v.kids == null ? null : v.kids === "1", alcohol: v.alcohol || null, smoke: v.smoke == null ? null : v.smoke === "1" },
    motivation: { why: (v.why || "").trim(), proud: (v.proud || "").trim(), deadline: v.deadline || null, ready: n(v.ready, 1, 10) } };
  update(st => { st.anamnese = a; if (a.zones.includes("lombaires") && st.profile) st.profile.backPain = true; });
  pushData(true); buzz(20);
  $app.innerHTML = `<section class="convo" style="justify-content:center"><div style="font-size:54px">${flags.length ? "🩺" : "✅"}</div>
    <h1 class="q">${flags.length ? "Merci. Un point avant d'aller plus loin." : "C'est noté, merci."}</h1>
    ${flags.length ? `<p class="q-sub">Tu as répondu oui à ${flags.length} question${flags.length > 1 ? "s" : ""} santé. <b>Parles-en à ton médecin avant d'augmenter ton activité</b>, et dis-lui ce que tu comptes faire. En attendant, garde des séances modérées. Thomas en est informé et adaptera ton programme.</p>`
      : `<p class="q-sub">Ton programme reste tel quel. Thomas a tes réponses pour l'ajuster si besoin.</p>`}
    <div class="stack mt24"><button class="btn btn-red" data-a="go" data-r="${defiOn() ? "defi" : "home"}">${defiOn() ? "Retour à mon défi" : "Accueil"}</button></div></section>`;
};
actions["anam-del"] = () => { if (!confirm("Effacer toutes tes réponses (santé comprise) ?")) return; update(st => { st.anamnese = null; }); pushData(true); toast("Réponses effacées"); go("home"); };

// Petite carte d'accueil tant que l'anamnèse n'est pas faite (après les 2 premiers jours pour ne pas surcharger le premier lancement)
export function anamneseCard() {
  if (S().anamnese?.at || !S().profile || S().me?.isCoach) return "";
  return `<button class="card tap mt12" data-a="go" data-r="anamnese" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left"><span style="font-size:28px">🩺</span><span class="grow"><b>Complète ton point de départ</b><br><span class="small muted">Santé, historique, motivation · 3 minutes</span></span>${I.chev}</button>`;
}
