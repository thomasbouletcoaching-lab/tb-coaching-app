// QCM « mes exercices » : pour chaque pattern, ceux que j'aime (😍) et ceux que je déteste (🚫).
// Envoyé par Thomas dans la conversation ; les réponses alimentent le programme (favoris d'abord, détestés exclus).
import { S, update } from "../store.js";
import { esc, toast, routes, actions, header, go, cloud, buzz, I } from "../core.js";
import * as P from "../programme.js";
import * as X from "../exercices.js";
import { pushData } from "../sync.js";

export const QUIZ_TOKEN = "[[quiz-exos]]";
let prefs = null;
routes["quiz-exos"] = async () => {
  const $app = document.getElementById("app");
  $app.innerHTML = header("Mes exercices", "Ce que tu aimes, ce que tu détestes", { back: "coach" }) + `<main class="page"><p class="empty">Chargement…</p></main>`;
  await X.loadExercices();
  prefs = prefs || { ...(S().programme?.prefs || {}) };
  const lists = P.aNoter({ answers: S().programme?.answers || {} });
  const nb = (v) => Object.values(prefs).filter(x => x === v).length;
  $app.innerHTML = header("Mes exercices", "Ce que tu aimes, ce que tu détestes", { back: "coach" }) + `<main class="page" style="padding-bottom:120px">
    <div class="card soft"><p class="small" style="margin:0">Pour chaque mouvement, touche <b>😍</b> pour ceux que tu adores (Thomas les mettra en priorité) et <b>🚫</b> pour ceux que tu détestes (ils sortent de ton programme). Sans réponse, c'est neutre.</p></div>
    ${X.PATTERNS.filter(p => lists[p.code]?.length).map(p => `<h2 class="sec" style="font-size:17px"><span><span class="pat ${p.code}">${p.code}</span> ${esc(p.nom)}</span></h2><div class="list">${lists[p.code].map(e => `<div class="li" style="gap:8px"><span class="grow small">${esc(e.nom)}</span>
      <button class="chip sm ${prefs[e.slug] === "love" ? "on" : ""}" data-a="qx-pref" data-s="${esc(e.slug)}" data-v="love" aria-label="J'adore ${esc(e.nom)}">😍</button>
      <button class="chip sm ${prefs[e.slug] === "hate" ? "on" : ""}" data-a="qx-pref" data-s="${esc(e.slug)}" data-v="hate" aria-label="Je déteste ${esc(e.nom)}">🚫</button></div>`).join("")}</div>`).join("")}
  </main><div class="dock"><button class="btn btn-red" data-a="qx-send">Envoyer à Thomas <span id="qx-n" class="xs" style="opacity:.85">(${nb("love")} 😍 · ${nb("hate")} 🚫)</span></button></div>`;
};
actions["qx-pref"] = (b, d) => {
  const note = prefs[d.s] === d.v ? "neutral" : d.v; prefs = P.noter(prefs, d.s, note); buzz(8);
  b.closest(".li").querySelectorAll("button").forEach(x => x.classList.toggle("on", prefs[d.s] === x.dataset.v));
  const n = document.getElementById("qx-n"); if (n) n.textContent = `(${Object.values(prefs).filter(x => x === "love").length} 😍 · ${Object.values(prefs).filter(x => x === "hate").length} 🚫)`;
};
actions["qx-send"] = async () => {
  update(st => { st.programme = { ...(st.programme || { v: P.VERSION, answers: {} }), prefs, at: new Date().toISOString() }; }); pushData?.();
  const nom = (slug) => (X.exercices().find(e => e.slug === slug) || {}).nom || slug;
  const love = Object.keys(prefs).filter(k => prefs[k] === "love").map(nom), hate = Object.keys(prefs).filter(k => prefs[k] === "hate").map(nom);
  const txt = `✅ Quiz exercices rempli\n😍 J'aime (${love.length}) : ${love.join(", ") || "–"}\n🚫 Je déteste (${hate.length}) : ${hate.join(", ") || "–"}`;
  try { const c = await cloud(); await c.ensureSession(); await c.send(txt); toast("Envoyé à Thomas 👌"); prefs = null; go("chat"); }
  catch { toast("Enregistré sur ton téléphone. L'envoi à Thomas a échoué : réessaie."); }
};
