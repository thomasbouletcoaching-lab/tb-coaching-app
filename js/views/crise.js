// « Je craque » : protocole de 3 minutes, sans calcul punitif ni rattrapage.
import { S, update, today } from "../store.js";
import { $app, esc, routes, forms, header, tabbar, buzz, toast } from "../core.js";

routes.crise = () => {
  const recent = (S().crises || []).slice(-3).reverse();
  $app.innerHTML = header("Je craque", "3 minutes, pas plus", { back: "home" }) + `<main class="page">
    <div class="card"><div class="lbl">1 · Respire</div><p class="mt8" style="margin:0">Inspire 4 secondes, expire 6 secondes. Fais-le six fois. Pas besoin de réussir, juste de ralentir.</p></div>
    <div class="card"><div class="lbl">2 · Nomme ce qui se passe</div><p class="small muted mt8">Une phrase, ni plus ni moins. Ce n'est pas un jugement.</p>
      <form class="mt8" data-f="crise-note"><textarea name="v" maxlength="200" placeholder="Ex. j'ai tout mangé après une journée dure" style="width:100%;box-sizing:border-box;min-height:80px;font:inherit;padding:10px;border-radius:12px;border:1px solid var(--line);background:var(--paper);color:var(--ink)"></textarea><button class="btn btn-line btn-sm mt8">Garder cette note</button></form></div>
    <div class="card"><div class="lbl">3 · Choisis la suite</div><p class="mt8" style="margin:0">Un verre d'eau. Puis une seule action : sortir marcher 10 minutes, appeler quelqu'un, ou prier. Pas de rattrapage, pas de calcul punitif : ton prochain repas est un repas normal.</p></div>
    ${recent.length ? `<h2 class="sec">Tes dernières notes</h2>${recent.map(c => `<div class="card soft"><span class="xs muted">${esc(c.d)}</span><p class="small mt4" style="margin:0">${esc(c.note)}</p></div>`).join("")}` : ""}
    <div class="card soft mt12"><p class="small" style="margin:0">Si les craquages reviennent souvent, parle-en à un professionnel de santé. En détresse : 3114 (prévention du suicide, 24 h/24), ou le 15 / le 112 en urgence.</p></div>
  </main>${tabbar("home")}`;
};
forms["crise-note"] = (v) => {
  const note = (v.v || "").trim();
  if (!note) return toast("Écris une phrase d'abord");
  update(st => { st.crises = [...(st.crises || []), { d: today(), note }]; });
  buzz(); toast("Note gardée. Une seule décision à la fois.");
  routes.crise();
};
