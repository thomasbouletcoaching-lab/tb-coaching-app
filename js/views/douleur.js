// Alertes de blessure : on peut les traiter (quelques questions) pour les ranger quand c'est bénin,
// ou les garder visibles et prévenir le coach quand c'est à prendre au sérieux.
import { S, update } from "../store.js";
import * as DL from "../douleur.js";
import { esc, toast, buzz, actions, sheet, closeSheet, rerender, go } from "../core.js";
import { pushStats } from "../sync.js";

const VERDICT = {
  benin: ["✅", "Plutôt bénin", "Ça ressemble à une gêne passagère. L'alerte est rangée ; elle reviendra seulement si tu notes de nouveau une douleur sur cet exercice. Garde une charge confortable et une technique propre."],
  surveiller: ["👀", "À surveiller", "Rien d'alarmant, mais adapte : baisse un peu la charge, ralentis le tempo ou remplace l'exercice (🔄 dans la séance) pendant une à deux semaines. L'alerte est rangée et reviendra si la douleur est de nouveau notée."],
  serieux: ["🩺", "À prendre au sérieux", "Arrête les mouvements qui réveillent la douleur et fais-toi examiner par un professionnel de santé (médecin, kiné). Préviens Thomas pour adapter ton programme. L'alerte reste visible jusqu'à ce que tu indiques que c'est réglé."],
};
// Ligne d'une alerte : bouton pour la traiter, ou statut si elle a été jugée sérieuse
export function alerteLigne(a) {
  const t = a.triage;
  return `<div class="mt8"><p class="small" style="margin:0"><b>${esc(a.name)}</b> · ${a.count} fois en 3 semaines${t?.v === "serieux" ? ` <span class="tag" style="background:var(--warn);color:#fff">à prendre au sérieux</span>` : ""}<br><span class="muted">${esc(a.last.note)}</span></p>
    <div class="row mt4" style="gap:6px">${t?.v === "serieux" ? `<button class="btn btn-line btn-xs" style="width:auto" data-a="pain-ok" data-n="${esc(a.name)}">✅ C'est réglé</button><button class="btn btn-ghost btn-xs" style="width:auto" data-a="go" data-r="chat">Prévenir Thomas</button>` : `<button class="btn btn-line btn-xs" style="width:auto" data-a="pain-triage" data-n="${esc(a.name)}">🩺 Traiter l'alerte</button>`}</div></div>`;
}

let PT = null; // { n, r }
function triageSheet() {
  const r = PT.r, fini = DL.complet(r), v = fini ? DL.verdict(r) : null;
  sheet(`<h2 class="h2">🩺 ${esc(PT.n)}</h2><p class="xs muted">Quelques questions pour savoir si cette alerte est à prendre au sérieux ou à laisser de côté. Ce n'est pas un diagnostic.</p>
    ${DL.QUESTIONS.map(q => `<div class="lbl mt12">${esc(q.q)}</div><div class="chips wrap mt4">${q.o.map(([k, l]) => `<button class="chip ${r[q.id] === k ? "on" : ""}" data-a="pt-ans" data-q="${q.id}" data-v="${k}">${esc(l)}</button>`).join("")}</div>`).join("")}
    ${v ? `<div class="card ${v.v === "serieux" ? "" : "soft"} mt16" style="${v.v === "serieux" ? "box-shadow:0 0 0 2px var(--warn) inset" : ""}"><b>${VERDICT[v.v][0]} ${VERDICT[v.v][1]}</b>${v.drapeaux.length ? `<p class="xs mt4" style="margin-bottom:0">Signe${v.drapeaux.length > 1 ? "s" : ""} d'alerte : ${esc(v.drapeaux.join(", "))}.</p>` : ""}<p class="small mt8" style="margin-bottom:0">${VERDICT[v.v][2]}</p></div>
      <button class="btn btn-red mt12" data-a="pt-save">${v.v === "serieux" ? "Enregistrer et garder l'alerte" : "Ranger l'alerte"}</button>${v.v === "serieux" ? `<button class="btn btn-line mt8" data-a="pt-save" data-chat="1">Enregistrer et prévenir Thomas</button>` : ""}`
      : `<p class="xs muted mt12">Réponds aux ${DL.QUESTIONS.length} questions pour voir le résultat.</p>`}`, null, { keep: !!document.getElementById("sheet") });
}
actions["pain-triage"] = (b, d) => { PT = { n: d.n, r: { ...(S().painTriage?.[d.n]?.r || {}) } }; triageSheet(); };
actions["pt-ans"] = (b, d) => { if (!PT) return; PT.r[d.q] = d.v; buzz(8); triageSheet(); };
actions["pt-save"] = (b, d) => {
  if (!PT || !DL.complet(PT.r)) return;
  const v = DL.verdict(PT.r).v, n = PT.n;
  update(st => { st.painTriage = { ...(st.painTriage || {}), [n]: { v, r: PT.r, at: new Date().toISOString() } }; });
  PT = null; closeSheet(); pushStats();
  toast(v === "serieux" ? "Alerte gardée : prends soin de toi" : "Alerte rangée"); if (d.chat) go("chat"); else rerender();
};
actions["pain-ok"] = (b, d) => {
  if (!confirm("La douleur est passée ? L'alerte sera rangée (elle reviendra si tu en notes une nouvelle).")) return;
  update(st => { st.painTriage = { ...(st.painTriage || {}), [d.n]: { v: "regle", at: new Date().toISOString() } }; });
  pushStats(); toast("Alerte rangée"); rerender();
};
