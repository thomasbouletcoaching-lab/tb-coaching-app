// Écran « Mon programme sur mesure » : questionnaire une question par écran, puis exercices favoris (Premium).
// Les réponses vivent sur le téléphone (S().programme) et partent avec l'instantané vers le coach.
import { S, update, today } from "../store.js";
import { $app, esc, toast, routes, actions, forms, go, I, header, buzz, coachLogo, premium, lockVeil } from "../core.js";
import * as P from "../programme.js";
import * as X from "../exercices.js";
import { pushData } from "../sync.js";

const Q = { i: -1, a: {}, prefs: {}, done: false, echo: null };

const stepsNow = () => P.steps(Q.a, premium());
const isEdit = () => !!S().programme?.answers;

function start() {
  const prev = S().programme;
  Q.a = { ...(prev?.answers || {}) }; Q.prefs = { ...(prev?.prefs || {}) }; Q.done = false; Q.echo = null;
  // Les gênes déjà déclarées dans « Mon point de départ » sont reprises, pas redemandées de zéro
  if (!Q.a.zones && S().anamnese?.consent) Q.a.zones = P.zonesFromAnamnese(S().anamnese.zones);
  Q.i = 0;
}
function save() {
  update(st => { st.programme = { v: P.VERSION, at: new Date().toISOString(), answers: Q.a, prefs: Q.prefs }; });
  pushData(true);
}

routes.monprogramme = async () => {
  await X.loadExercices();
  if (Q.i < 0 && !Q.done) return intro();
  if (Q.done) return fin();
  const st = stepsNow(), s = st[Q.i];
  if (!s) return finishCourt(st);
  if (s.id === "favs") return favs(st);
  const q = P.question(s.id), pct = Math.round(Q.i / st.length * 100), cur = Q.a[q.id];
  let body;
  if (q.type === "single") body = `<div class="choices">${q.opts.map(([v, l]) => `<button class="choice ${String(cur) === String(v) ? "on" : ""}" data-a="pq-pick" data-v="${esc(String(v))}">${l}</button>`).join("")}</div>`;
  else if (q.type === "multi") body = `<form class="choices" data-f="pq-multi" style="align-items:stretch"><div class="chips wrap">${q.opts.map(([v, l]) => `<label class="chip pick"><input type="checkbox" name="v" value="${esc(String(v))}" ${(cur || []).map(String).includes(String(v)) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div><button class="btn btn-red mt12">${q.min ? "Continuer" : (cur?.length ? "Continuer" : "Aucune, continuer")}</button></form>`;
  else body = `<form class="choices" data-f="pq-text" style="align-items:stretch"><label class="field"><span>${q.ph || ""}</span><input name="v" maxlength="80" value="${esc(cur || "")}"></label><button class="btn btn-red">${q.optional ? "Continuer" : "Valider"}</button></form>`;
  $app.innerHTML = `<section class="convo"><div class="convo-top"><button class="icon-btn" data-a="pq-back" aria-label="Retour">${I.back}</button><div class="progress"><i style="width:${pct}%"></i></div></div>
    <div class="coach-mark"><span class="av">${coachLogo(22)}</span>Thomas · ton programme sur mesure</div>
    <h1 class="q">${q.q}</h1>${q.sub ? `<p class="q-sub">${q.sub}</p>` : ""}${body}</section>`;
};

function intro() {
  const done = S().programme?.answers, pr = premium();
  $app.innerHTML = header("Mon programme sur mesure", "", { back: "train" }) + `<main class="page">
    <div class="card"><h2 class="h2">${done ? "Tes réponses sont enregistrées" : "Un programme qui tient dans ta vie"}</h2>
      <p class="small muted mt8">Dix questions, deux minutes : ton objectif, ton matériel, le nombre de séances que tu tiens vraiment et les zones à ménager. Tout reste sur ton téléphone.</p>
      ${done ? `<button class="btn btn-red mt12" data-a="go" data-r="monprofil">Voir mon profil</button><button class="btn btn-line mt8" data-a="go" data-r="monplan">Voir mon programme proposé</button><button class="btn btn-line mt8" data-a="pq-start">Modifier mes réponses</button>` : `<button class="btn btn-red mt12" data-a="pq-start">Commencer</button>`}</div>
    ${done ? `<h2 class="sec">Ce que je sais de toi</h2><div class="card">${recap()}</div>` : ""}
    <h2 class="sec">Pour aller plus loin <small>Bâtisseur</small></h2>
    <div class="card ${pr ? "" : "locked"}" style="position:relative;min-height:${pr ? "0" : "200px"}"><p class="small" style="margin:0">Priorités et points faibles, anatomie (squat, cheville, épaule), historique de tes arrêts, contexte de vie et <b>tes exercices favoris</b> : ceux que tu adores passent en premier, ceux que tu détestes ne reviennent plus.</p>
      ${pr ? "" : lockVeil("Bâtisseur", "Le questionnaire avancé et tes exercices favoris.")}</div></main>`;
}
const recap = () => `<div>${P.resume(S().programme).map(([k, v]) => `<div class="row between small" style="padding:7px 0;border-bottom:1px solid var(--line);gap:12px;align-items:flex-start"><span class="muted" style="flex:none">${esc(k)}</span><span style="text-align:right">${esc(v)}</span></div>`).join("")}</div>`;

function finishCourt() { save(); Q.done = true; buzz(); routes.monprogramme(); }

function favs(st) {
  const lists = aNoterNow(), pct = Math.round(Q.i / st.length * 100);
  $app.innerHTML = `<section class="convo" style="padding-bottom:110px"><div class="convo-top"><button class="icon-btn" data-a="pq-back" aria-label="Retour">${I.back}</button><div class="progress"><i style="width:${pct}%"></i></div></div>
    <div class="coach-mark"><span class="av">${coachLogo(22)}</span>Thomas · ton programme sur mesure</div>
    <h1 class="q">Tes <span class="k">exercices favoris</span></h1>
    <p class="q-sub">Touche 😍 pour ceux que tu adores : ils passent en premier. Touche 🚫 pour ceux que tu détestes : ils ne reviennent plus. Sans réponse, c'est neutre.</p>
    ${X.PATTERNS.filter(p => lists[p.code]?.length).map(p => `<h2 class="sec" style="font-size:18px"><span><span class="pat ${p.code}">${p.code}</span> ${esc(p.nom)}</span></h2><div class="list">${lists[p.code].map(e => `<div class="li" data-slug="${esc(e.slug)}" style="gap:8px"><span class="grow small"><b>${esc(e.nom)}</b></span>
      <button class="chip sm ${Q.prefs[e.slug] === "love" ? "on" : ""}" data-a="pq-pref" data-s="${esc(e.slug)}" data-v="love" aria-label="J'adore ${esc(e.nom)}" aria-pressed="${Q.prefs[e.slug] === "love"}">😍</button>
      <button class="chip sm ${Q.prefs[e.slug] === "hate" ? "on" : ""}" data-a="pq-pref" data-s="${esc(e.slug)}" data-v="hate" aria-label="Je déteste ${esc(e.nom)}" aria-pressed="${Q.prefs[e.slug] === "hate"}">🚫</button></div>`).join("")}</div>`).join("") || `<p class="small muted">Aucun exercice à noter avec ton matériel et tes gênes.</p>`}
    </section><div class="dock"><button class="btn btn-red" data-a="pq-favs-ok">Terminer</button></div>`;
}
const aNoterNow = () => P.aNoter({ answers: Q.a });

function fin() {
  $app.innerHTML = header("Mon programme sur mesure", "C'est enregistré", { back: "train" }) + `<main class="page">
    <div class="card hl"><h2 class="h2">C'est noté, ${esc(S().profile?.name || "")} 👌</h2>
      <p class="small muted mt8">${P.ecartSeances(Q.a) > 0 ? `Tu aimerais ${Q.a.daysWanted} séances mais en tiens ${Q.a.daysReal} : on construira ton programme sur ${Q.a.daysReal}, et on en ajoutera quand la régularité sera là.` : "Ces réponses sont enregistrées."} Je te propose maintenant un programme à partir de ces réponses : tu le vois, tu peux remplacer des exercices, et tu ne l'adoptes que si tu le veux.</p></div>
    <h2 class="sec">Ce que je sais de toi</h2><div class="card">${recap()}</div>
    ${premium() ? "" : `<div class="card mt12"><p class="small" style="margin:0">Avec le Bâtisseur : priorités, anatomie, historique et exercices favoris.</p><button class="btn btn-line btn-sm mt8" data-a="go" data-r="offers">Voir les offres</button></div>`}
    <div class="stack mt12"><button class="btn btn-red" data-a="go" data-r="monprofil">Voir mon profil</button><button class="btn btn-line" data-a="go" data-r="monplan">Voir mon programme proposé</button><button class="btn btn-line" data-a="pq-start">Modifier mes réponses</button><button class="btn btn-ghost" data-a="go" data-r="train">Retour à l'entraînement</button></div></main>`;
}

const advance = (val) => { const s = stepsNow()[Q.i]; if (s) Q.a[s.id] = val; Q.i++; buzz(); routes.monprogramme(); };
actions["pq-start"] = () => { start(); routes.monprogramme(); };
actions["pq-back"] = () => { if (Q.i <= 0) { Q.i = -1; Q.done = false; return routes.monprogramme(); } Q.i--; routes.monprogramme(); };
actions["pq-pick"] = (b, d) => { const q = P.question(stepsNow()[Q.i]?.id); if (!q) return; const r = P.validate(q, d.v); if (!r.ok) return toast(r.msg); advance(r.value); };
forms["pq-multi"] = (v, f) => { const q = P.question(stepsNow()[Q.i]?.id); if (!q) return; const r = P.validate(q, new FormData(f).getAll("v")); if (!r.ok) return toast(r.msg); advance(r.value); };
forms["pq-text"] = (v) => { const q = P.question(stepsNow()[Q.i]?.id); if (!q) return; const r = P.validate(q, v.v); if (!r.ok) return toast(r.msg); advance(r.value); };
actions["pq-pref"] = (b, d) => {
  const note = Q.prefs[d.s] === d.v ? "neutral" : d.v; Q.prefs = P.noter(Q.prefs, d.s, note); buzz(8);
  const row = b.closest(".li"); // on ne réaffiche pas l'écran : la liste reste où elle est
  row.querySelectorAll("button").forEach(x => { const on = Q.prefs[d.s] === x.dataset.v; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
};
actions["pq-favs-ok"] = () => { Q.i++; finishCourt(); };
