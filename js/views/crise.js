// « Je craque » : la personne décrit son envie en quelques taps, l'app propose une action concrète,
// déculpabilise et dit quoi faire après. Aucun calcul punitif, aucun rattrapage, aucun jeûne.
// La logique (règles, déclencheurs) est dans js/crise.js (pur, testé).
import { S, update, today } from "../store.js";
import { $app, esc, routes, actions, forms, changes, header, tabbar, buzz, toast, rank, fmtDate } from "../core.js";
import { pushData } from "../sync.js";
import * as C from "../crise.js";

// Saisie en cours (jamais enregistrée tant que la personne n'a pas demandé « Quoi faire maintenant »)
// `id` = identifiant de l'entrée du journal dont la réponse est affichée ; `nouveau` = la personne a demandé une autre saisie.
let CR = neuf();
function neuf(nouveau = false) { return { envie: null, emotion: null, contexte: null, intensite: null, note: "", vue: "saisie", id: null, nouveau }; }
const courante = () => (CR.id ? (S().crises || []).find(e => e.id === CR.id) : null) || null;
const vierge = () => !CR.envie && !CR.emotion && !CR.contexte && !CR.intensite && !CR.note;
// L'écran dit « reviens ici ensuite » : au retour (même après fermeture de l'app), on retrouve l'envie du jour encore sans issue.
// Une réponse de la veille n'est jamais réaffichée.
function reprendre() {
  if (CR.vue === "reponse") { const e = courante(); if (!e || e.d !== today()) CR = neuf(); return; }
  if (CR.nouveau || !vierge()) return;
  const e = [...(S().crises || [])].reverse().find(x => x && x.id && x.d === today());
  if (e && !e.suite) CR = { envie: e.envie, emotion: e.emotion, contexte: e.contexte, intensite: e.intensite, note: e.note || "", vue: "reponse", id: e.id, nouveau: false };
}
// Après un redessin, le focus revient sur l'élément équivalent (clavier, lecteur d'écran) sans faire sauter la page.
const focus = (sel) => { const el = document.querySelector(sel); if (el) el.focus({ preventScroll: true }); };
const heure = () => new Date().toTimeString().slice(0, 5);
const jour = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? fmtDate(d, { weekday: "short", day: "numeric", month: "long" }) : String(d || "");

const puces = (cle, liste, titre) => `<div class="lbl mt12" id="cr-l-${cle}">${titre}</div>
  <div class="chips wrap mt8" role="group" aria-labelledby="cr-l-${cle}">${liste.map(([v, l]) => `<button type="button" class="chip ${String(CR[cle]) === String(v) ? "on" : ""}" style="min-height:44px" data-a="cr-pick" data-k="${cle}" data-v="${v}" aria-pressed="${String(CR[cle]) === String(v)}">${String(CR[cle]) === String(v) ? "✓ " : ""}${esc(l)}</button>`).join("")}</div>`;

function saisie() {
  return `<div class="card"><h2 class="h2" style="margin:0">Qu'est-ce qui se passe ?</h2>
      <p class="small muted mt4" style="margin-bottom:0">Touche ce qui te correspond. Rien n'est obligatoire, rien n'est jugé.</p>
      ${puces("envie", C.ENVIES, "J'ai envie de")}
      ${puces("emotion", C.EMOTIONS, "Ce que je ressens")}
      ${puces("contexte", C.CONTEXTES, "Où je suis")}
      ${puces("intensite", C.INTENSITES.map(([v, l]) => [v, v + " · " + l]), "Force de l'envie")}
      <form class="mt12" data-f="cr-go"><label class="field"><span>En quelques mots (facultatif)</span>
        <textarea name="note" maxlength="200" rows="2" placeholder="Ex. journée difficile, placard ouvert en rentrant">${esc(CR.note)}</textarea></label>
        <button class="btn btn-red mt12" style="width:100%">Quoi faire maintenant</button></form></div>`;
}

function reponse() {
  const r = C.reponse(CR), e = courante();
  return `<div class="card hl"><div class="lbl">Maintenant</div><h2 class="h2 mt4" id="cr-titre" tabindex="-1" style="margin-bottom:0;outline:none">${esc(r.titre)}</h2>
      <ol class="mt8" style="margin:8px 0 0;padding-left:20px">${r.etapes.map(x => `<li class="mt8">${esc(x)}</li>`).join("")}</ol></div>
    <div class="card"><div class="lbl">Après</div><p class="mt8" style="margin:0">${esc(r.apres)}</p></div>
    <div class="card soft"><p style="margin:0">${esc(r.rassure)}</p></div>
    <div class="card"><div class="lbl" id="cr-l-suite">Et ensuite, qu'est-ce qui s'est passé ?</div>
      <p class="small muted mt4" style="margin:0">Facultatif. Ça sert seulement à repérer ce qui t'aide.</p>
      <div class="stack mt8" role="group" aria-labelledby="cr-l-suite">${C.SUITES.map(([v, l]) => `<button type="button" class="btn ${e?.suite === v ? "btn-red" : "btn-line"}" data-a="cr-suite" data-v="${v}" aria-pressed="${e?.suite === v}">${e?.suite === v ? "✓ " : ""}${esc(l)}</button>`).join("")}</div>
      <p class="mt12" id="cr-cloture" role="status" style="margin-bottom:0">${e?.suite ? esc(C.cloture(e.suite)) : ""}</p></div>
    <button class="btn btn-line" style="width:100%" data-a="cr-new">Décrire une autre envie</button>`;
}

function journal() {
  const tous = S().crises || [], d = C.declencheurs(tous), recents = tous.map((e, i) => ({ e, i })).slice(-5).reverse();
  if (!tous.length) return "";
  // La case reste visible tant qu'un accord est en cours, même si la formule a changé : un accord doit toujours pouvoir se retirer.
  const partage = rank() >= 2 || S().criseShare ? `<label class="check mt12"><input type="checkbox" data-c="cr-share" ${S().criseShare ? "checked" : ""}> Partager ce journal avec Thomas, pour qu'il m'aide à repérer mes déclencheurs. Je peux retirer cet accord ici à tout moment.</label>` : "";
  return `<h2 class="sec">Mon journal <small>${tous.length}</small></h2>
    ${d ? `<div class="card"><div class="lbl">Ce qui revient</div><ul class="mt8" style="margin:8px 0 0;padding-left:20px">${d.constats.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${d.plan.length ? `<div class="lbl mt12">Pour prendre de l'avance</div><ul class="mt8" style="margin:8px 0 0;padding-left:20px">${d.plan.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="small muted mt8" style="margin-bottom:0">Pas encore de déclencheur net : continue à noter, ça se dessinera.</p>`}</div>`
      : `<p class="small muted">Après ${C.MIN_ENTREES} envies décrites, tu verras ici ce qui les déclenche le plus souvent.</p>`}
    ${recents.map(({ e, i }) => `<div class="card soft"><div class="row between" style="gap:8px;align-items:flex-start"><div style="min-width:0"><span class="xs muted">${esc(jour(e.d))}</span>
      ${C.resume(e) ? `<p class="small mt4" style="margin:0">${esc(C.resume(e))}</p>` : ""}${e.note ? `<p class="small mt4" style="margin:0">${esc(e.note)}</p>` : ""}</div>
      <button type="button" class="btn btn-line btn-sm" style="min-height:44px;flex:none" data-a="cr-del" data-i="${i}" aria-label="Effacer la note du ${esc(jour(e.d))}${typeof e.t === "string" ? " à " + esc(e.t) : ""}">Effacer</button></div></div>`).join("")}
    ${partage}`;
}

routes.crise = () => {
  reprendre();
  $app.innerHTML = header("Je craque", "On regarde ça ensemble, sans jugement", { back: "home" }) + `<main class="page">
    ${CR.vue === "reponse" ? reponse() : saisie()}
    ${journal()}
    <p class="small muted mt16">Si les craquages sont fréquents ou te semblent incontrôlables, parles-en à un médecin, ou à la ligne d'écoute spécialisée dans les troubles du comportement alimentaire au ${C.LIGNE_ECOUTE}.</p>
  </main>${tabbar("home")}`;
};

actions["cr-pick"] = (b, d) => {
  const v = d.k === "intensite" ? Number(d.v) : d.v;
  CR[d.k] = CR[d.k] === v ? null : v; // un second tap retire le choix
  const note = document.querySelector('[data-f="cr-go"] textarea'); if (note) CR.note = note.value;
  buzz(); routes.crise(); focus(`[data-a="cr-pick"][data-k="${d.k}"][data-v="${d.v}"]`);
};
forms["cr-go"] = (v) => {
  CR.note = (v.note || "").trim();
  const e = C.entree({ ...CR, id: Date.now(), d: today(), t: heure() });
  update(st => { st.crises = [...(st.crises || []), e].slice(-C.JOURNAL_MAX); });
  CR.id = e.id; CR.vue = "reponse"; CR.nouveau = false;
  buzz(); routes.crise(); window.scrollTo(0, 0); focus("#cr-titre");
};
actions["cr-suite"] = (b, d) => {
  if (!courante() || !C.SUITES.some(x => x[0] === d.v)) return;
  update(st => { const e = st.crises.find(x => x.id === CR.id); if (e) e.suite = d.v; });
  buzz(); routes.crise(); focus(`[data-a="cr-suite"][data-v="${d.v}"]`);
};
actions["cr-new"] = () => { CR = neuf(true); routes.crise(); window.scrollTo(0, 0); focus('[data-a="cr-pick"]'); };
actions["cr-del"] = (b, d) => {
  const i = Number(d.i), e = (S().crises || [])[i]; if (!Number.isInteger(i) || !e) return;
  if (!confirm("Effacer cette note de ton journal ?")) return;
  if (e.id && e.id === CR.id) CR = neuf(true); // on efface l'envie affichée : retour à la saisie
  update(st => { st.crises = (st.crises || []).filter((_, k) => k !== i); });
  toast("Note effacée"); routes.crise();
};
// Partage avec le coach : accord explicite, séparé, révocable. Sans accord, rien ne part (voir snapshot() dans js/sync.js).
changes["cr-share"] = (el) => {
  update(st => { st.criseShare = el.checked ? new Date().toISOString() : null; });
  pushData(true); // envoi immédiat : un retrait d'accord ne doit pas attendre la prochaine sauvegarde
  toast(el.checked ? "Thomas pourra voir ton journal des craquages" : "Accord retiré. La copie de Thomas est effacée dès que ton téléphone est en ligne.");
};
