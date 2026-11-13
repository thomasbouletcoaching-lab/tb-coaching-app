// « Je craque » : la personne décrit son envie en quelques taps, l'app propose une action concrète,
// déculpabilise et dit quoi faire après. Aucun calcul punitif, aucun rattrapage, aucun jeûne.
// La logique (règles, déclencheurs) est dans js/crise.js (pur, testé).
import { S, update, today } from "../store.js";
import { $app, esc, routes, actions, forms, changes, header, tabbar, buzz, toast, rank, fmtDate } from "../core.js";
import * as C from "../crise.js";

// Saisie en cours (jamais enregistrée tant que la personne n'a pas demandé « Quoi faire maintenant »)
let CR = neuf();
function neuf() { return { envie: null, emotion: null, contexte: null, intensite: 3, note: "", vue: "saisie", i: null }; }
const heure = () => new Date().toTimeString().slice(0, 5);
const jour = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? fmtDate(d, { weekday: "short", day: "numeric", month: "long" }) : String(d || "");

const puces = (cle, liste, titre) => `<div class="lbl mt12" id="cr-l-${cle}">${titre}</div>
  <div class="chips wrap mt8" role="group" aria-labelledby="cr-l-${cle}">${liste.map(([v, l]) => `<button type="button" class="chip ${String(CR[cle]) === String(v) ? "on" : ""}" style="min-height:44px" data-a="cr-pick" data-k="${cle}" data-v="${v}" aria-pressed="${String(CR[cle]) === String(v)}">${esc(l)}</button>`).join("")}</div>`;

function saisie() {
  return `<div class="card"><h2 class="h2" style="margin:0">Qu'est-ce qui se passe ?</h2>
      <p class="small muted mt4" style="margin-bottom:0">Quelques taps suffisent. Rien n'est obligatoire, rien n'est jugé.</p>
      ${puces("envie", C.ENVIES, "J'ai envie de")}
      ${puces("emotion", C.EMOTIONS, "Ce que je ressens")}
      ${puces("contexte", C.CONTEXTES, "Où je suis")}
      ${puces("intensite", C.INTENSITES.map(([v, l]) => [v, v + " · " + l]), "Force de l'envie")}
      <form class="mt12" data-f="cr-go"><label class="field"><span>En quelques mots (facultatif)</span>
        <textarea name="note" maxlength="200" rows="2" placeholder="Ex. journée difficile, placard ouvert en rentrant">${esc(CR.note)}</textarea></label>
        <button class="btn btn-red mt12" style="width:100%">Quoi faire maintenant</button></form></div>`;
}

function reponse() {
  const r = C.reponse(CR), e = CR.i != null ? (S().crises || [])[CR.i] : null;
  return `<div class="card hl" aria-live="polite"><div class="lbl">Maintenant</div><h2 class="h2 mt4" style="margin-bottom:0">${esc(r.titre)}</h2>
      <ol class="mt8" style="margin:8px 0 0;padding-left:20px">${r.etapes.map(x => `<li class="mt8">${esc(x)}</li>`).join("")}</ol></div>
    <div class="card"><div class="lbl">Après</div><p class="mt8" style="margin:0">${esc(r.apres)}</p></div>
    <div class="card soft"><p style="margin:0">${esc(r.rassure)}</p></div>
    <div class="card"><div class="lbl" id="cr-l-suite">Et ensuite, qu'est-ce qui s'est passé ?</div>
      <p class="small muted mt4" style="margin:0">Facultatif. Ça sert seulement à repérer ce qui t'aide.</p>
      <div class="stack mt8" role="group" aria-labelledby="cr-l-suite">${C.SUITES.map(([v, l]) => `<button type="button" class="btn ${e?.suite === v ? "btn-red" : "btn-line"}" data-a="cr-suite" data-v="${v}" aria-pressed="${e?.suite === v}">${esc(l)}</button>`).join("")}</div>
      ${e?.suite ? `<p class="mt12" style="margin-bottom:0">${esc(C.cloture(e.suite))}</p>` : ""}</div>
    <button class="btn btn-line" style="width:100%" data-a="cr-new">Décrire une autre envie</button>`;
}

function journal() {
  const tous = S().crises || [], d = C.declencheurs(tous), recents = tous.map((e, i) => ({ e, i })).slice(-5).reverse();
  if (!tous.length) return "";
  const partage = rank() >= 2 ? `<label class="check mt12"><input type="checkbox" data-c="cr-share" ${S().criseShare ? "checked" : ""}> Partager ce journal avec Thomas, pour qu'il m'aide à repérer mes déclencheurs. Je peux retirer cet accord ici à tout moment.</label>` : "";
  return `<h2 class="sec">Mon journal <small>${tous.length}</small></h2>
    ${d ? `<div class="card"><div class="lbl">Ce qui revient</div><ul class="mt8" style="margin:8px 0 0;padding-left:20px">${d.constats.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      ${d.plan.length ? `<div class="lbl mt12">Pour prendre de l'avance</div><ul class="mt8" style="margin:8px 0 0;padding-left:20px">${d.plan.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="small muted mt8" style="margin-bottom:0">Pas encore de déclencheur net : continue à noter, ça se dessinera.</p>`}</div>`
      : `<p class="small muted">Après ${C.MIN_ENTREES} envies décrites, tu verras ici ce qui les déclenche le plus souvent.</p>`}
    ${recents.map(({ e, i }) => `<div class="card soft"><div class="row between" style="gap:8px;align-items:flex-start"><div style="min-width:0"><span class="xs muted">${esc(jour(e.d))}</span>
      ${C.resume(e) ? `<p class="small mt4" style="margin:0">${esc(C.resume(e))}</p>` : ""}${e.note ? `<p class="small mt4" style="margin:0">${esc(e.note)}</p>` : ""}</div>
      <button type="button" class="btn btn-line btn-sm" style="min-height:44px;flex:none" data-a="cr-del" data-i="${i}" aria-label="Effacer la note du ${esc(jour(e.d))}">Effacer</button></div></div>`).join("")}
    ${partage}`;
}

routes.crise = () => {
  $app.innerHTML = header("Je craque", "On regarde ça ensemble, sans jugement", { back: "home" }) + `<main class="page">
    ${CR.vue === "reponse" ? reponse() : saisie()}
    ${journal()}
    <p class="small muted mt16">Si les craquages sont fréquents ou te semblent incontrôlables, parles-en à ton médecin, ou à la ligne d'écoute spécialisée dans les troubles du comportement alimentaire au ${C.LIGNE_ECOUTE}.</p>
  </main>${tabbar("home")}`;
};

actions["cr-pick"] = (b, d) => {
  const v = d.k === "intensite" ? Number(d.v) : d.v;
  CR[d.k] = d.k !== "intensite" && CR[d.k] === v ? null : v; // un second tap retire le choix
  const note = document.querySelector('[data-f="cr-go"] textarea'); if (note) CR.note = note.value;
  buzz(); routes.crise();
};
forms["cr-go"] = (v) => {
  CR.note = (v.note || "").trim();
  const e = C.entree({ d: today(), t: heure(), ...CR });
  update(st => { st.crises = [...(st.crises || []), e].slice(-C.JOURNAL_MAX); });
  CR.i = S().crises.length - 1; CR.vue = "reponse";
  buzz(); routes.crise(); window.scrollTo(0, 0);
};
actions["cr-suite"] = (b, d) => {
  if (CR.i == null || !C.SUITES.some(x => x[0] === d.v)) return;
  update(st => { if (st.crises[CR.i]) st.crises[CR.i].suite = d.v; });
  buzz(); routes.crise();
};
actions["cr-new"] = () => { CR = neuf(); routes.crise(); window.scrollTo(0, 0); };
actions["cr-del"] = (b, d) => {
  const i = Number(d.i); if (!Number.isInteger(i)) return;
  if (!confirm("Effacer cette note de ton journal ?")) return;
  update(st => { st.crises = (st.crises || []).filter((_, k) => k !== i); });
  if (CR.i === i) CR = neuf(); else if (CR.i != null && CR.i > i) CR.i--;
  toast("Note effacée"); routes.crise();
};
// Partage avec le coach : accord explicite, séparé, révocable. Sans accord, rien ne part (voir snapshot() dans js/sync.js).
changes["cr-share"] = (el) => {
  update(st => { st.criseShare = el.checked ? new Date().toISOString() : null; });
  toast(el.checked ? "Thomas pourra voir ton journal des craquages" : "Accord retiré : ton journal reste sur ton téléphone");
};
