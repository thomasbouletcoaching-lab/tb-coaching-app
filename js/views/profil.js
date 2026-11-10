// Mon profil (étape 8) : profils détectés (formulés en positif), parcours « reprise durable », mode « On reprend », plans « si… alors… ».
// Gratuit : c'est le parcours de reprise, il ne doit jamais être payant. Le calcul est dans js/profils.js (pur).
import { S, update, today } from "../store.js";
import * as E from "../engine.js";
import * as X from "../exercices.js";
import * as P from "../profils.js";
import * as PR from "../programme.js";
import { $app, esc, toast, routes, actions, forms, go, I, header, sheet, closeSheet, rerender, buzz, isCoach, addDays } from "../core.js";

// ---------- Ce qu'on sait de la personne ----------
export function profilsActuels() {
  const a = S().programme?.answers || {}, prof = S().profile || {};
  const ws = S().workouts || [];
  // Séances manquées : celles que le planning prévoyait et qui n'ont pas eu lieu (14 derniers jours)
  const t = today(), ag = E.agenda(addDays(t, -14), t);
  const missed14 = Object.values(ag).filter(x => x.st === "missed").length;
  const variables = (S().semaine?.variable || []).filter(b => b.date >= addDays(t, -6) && b.date <= addDays(t, 7)).length;
  const stalls = (() => { try { return E.stalls().length; } catch { return 0; } })();
  return { a: { level: prof.level, ...a }, ctx: { stalls, missed14, variables, age: prof.age, discipline: prof.discipline } };
}
export function profilDetecte() {
  if (!S().profile) return [];
  const { a, ctx } = profilsActuels();
  return P.detecter(a, ctx);
}
const memoire = () => S().profil || {};
// Le total ne baisse jamais : on le garde au plus haut vu
export function totalSeances() {
  const total = P.totalSeances((S().workouts || []).length, memoire().total || 0);
  if (total !== memoire().total) update(st => { st.profil = { ...(st.profil || {}), total }; });
  return total;
}

// ---------- Carte « On reprend » sur l'accueil : deux séances manquées, rien aujourd'hui ----------
export function criseCard() {
  if (isCoach() || !S().profile) return "";
  const { ctx } = profilsActuels();
  if (!P.enReprise({ missed14: ctx.missed14, doneToday: (S().workouts || []).some(w => (w.end || "").slice(0, 10) === today()) })) return "";
  return `<div class="card hl mt12"><div class="lbl">🔁 On reprend</div><b class="h3">Pas de souci, on repart simplement</b><p class="small muted mt4" style="margin:4px 0 10px">Une séance courte aujourd'hui, sans rattraper ce qui a manqué. Ce qui compte, c'est de reprendre.</p>
    <button class="btn btn-red btn-sm" style="width:100%" data-a="crise-go">On reprend : séance de 20 minutes</button></div>`;
}
actions["crise-go"] = async () => {
  if (S().current) return go("workout");
  await Promise.all([E.loadPrograms(), E.loadFiches(), E.loadLib(), X.loadExercices()]);
  const s0 = E.buildSession(); if (!s0) return toast("Choisis d'abord un programme.");
  const s = E.expressSession(s0, 20); s.target = 20; s.start = new Date().toISOString(); s.crise = true;
  update(st => { st.current = s; });
  buzz(); toast("On reprend : une séance courte, sans rattrapage"); go("workout");
};

// ---------- Écran ----------
routes.monprofil = async () => {
  await X.loadExercices();
  const profils = profilDetecte(), pl = P.plancher(profils), total = totalSeances();
  const si = P.siAlorsDe(S().profil?.siAlors), t = today();
  $app.innerHTML = header("Mon profil", "Ce qui te ressemble", { back: "more", offers: false }) + `<main class="page" style="padding-bottom:40px">
    <div class="card mt12"><div class="lbl">Ton profil</div>
      ${profils.length ? `<div class="chips wrap mt8" role="list">${profils.map(p => `<span class="tag r" role="listitem">${esc(p.nom)}</span>`).join("")}</div>
        ${profils.map(p => `<div class="li" style="padding:10px 0;gap:8px;border-bottom:1px solid var(--line)"><span class="grow small"><b>${esc(p.nom)}</b><br><span class="xs muted">${esc(p.phrase)}</span></span></div>`).join("")}`
        : `<p class="small muted mt8" style="margin:0">Ton profil se précisera au fil de tes séances et de tes réponses au questionnaire.</p>`}
      <p class="xs muted mt8" style="margin:8px 0 0">Ces profils adaptent quelques réglages. Ils ne changent rien à tes données.</p></div>

    ${pl ? `<h2 class="sec">🌱 Ton minimum</h2><div class="card"><b class="small">${esc(pl.texte)}</b>
      <p class="xs muted mt4" style="margin:4px 0 0">Les semaines difficiles, on tient ce minimum au lieu de tout lâcher.</p></div>` : ""}

    <h2 class="sec">🏁 Tes séances <small>total</small></h2>
    <div class="card"><div class="row between"><b class="h2">${total}</b><span class="small muted">séance${total > 1 ? "s" : ""} faite${total > 1 ? "s" : ""} depuis le début</span></div>
      <p class="xs muted mt4" style="margin:4px 0 0">Ce total ne revient jamais en arrière, même si une séance est corrigée ou retirée de l'historique.</p></div>

    <h2 class="sec">🧭 Si… alors…</h2>
    <p class="xs muted" style="margin:0 0 6px">Des plans de secours, écrits à l'avance : quand la semaine déraille, tu n'as pas à réfléchir.</p>
    <div class="card" style="padding:4px 14px">${si.map((x, i) => `<div class="li" style="padding:10px 0;gap:8px"><span class="grow small"><b>${esc(x.si)}</b><br><span class="muted">${esc(x.alors)}</span></span><button class="icon-btn sm" data-a="si-del" data-i="${i}" aria-label="Retirer ce plan">${I.close}</button></div>`).join("")}</div>
    <form data-f="si-add" class="card mt8"><label class="field"><span>Si…</span><input name="si" maxlength="60" placeholder="si je finis tard"></label><label class="field mt8"><span>alors…</span><input name="alors" maxlength="120" placeholder="alors je fais la version de 20 minutes"></label><button class="btn btn-line btn-sm mt8" style="width:100%">Ajouter ce plan</button></form>

    <h2 class="sec">🔁 Quand la semaine déraille</h2>
    <div class="card"><p class="small" style="margin:0">Touche « On reprend » : une séance courte aujourd'hui, sans rattraper ce qui a manqué. Le bouton apparaît tout seul sur l'accueil à ce moment-là.</p>
      <button class="btn btn-line btn-sm mt8" data-a="crise-go">Reprendre maintenant (20 min)</button></div>
    <p class="xs muted mt12" style="text-align:center">Aujourd'hui : ${esc(new Date(t + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</p>
  </main>`;
};
forms["si-add"] = (v, f) => {
  const si = (v.si || "").trim(), alors = (v.alors || "").trim();
  if (!si || !alors) return toast("Écris le « si » et le « alors ».");
  update(st => { const cur = P.siAlorsDe(st.profil?.siAlors); st.profil = { ...(st.profil || {}), siAlors: [...cur, { si, alors }].slice(-8) }; });
  f.reset(); toast("Plan ajouté"); rerender();
};
actions["si-del"] = (b, d) => {
  update(st => { const cur = P.siAlorsDe(st.profil?.siAlors); st.profil = { ...(st.profil || {}), siAlors: cur.filter((_, i) => i !== +d.i) }; });
  rerender();
};

// Résumé pour le coach : identifiants uniquement
export function profilPourCoach() { return P.pourCoach(profilDetecte()); }
