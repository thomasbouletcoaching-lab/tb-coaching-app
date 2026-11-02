// Effets visuels : logo TB tracé trait par trait, animation de record, médaille et grade de séance.
import { esc } from "./core.js";

// Logo « TB » qui se dessine trait par trait (remplace l'ancienne croix)
export function tbLogo(size = 110) {
  return `<svg class="tb-draw" width="${size}" height="${size * .72}" viewBox="0 0 76 54" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-label="TB">
    <defs><linearGradient id="tbg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8F3510"/><stop offset=".6" stop-color="#C2541F"/><stop offset="1" stop-color="#EE8A45"/></linearGradient></defs>
    <path class="t1" pathLength="1" d="M5 8H31" stroke="#fff" stroke-width="7"/>
    <path class="t2" pathLength="1" d="M18 8V46" stroke="#fff" stroke-width="7"/>
    <path class="t3" pathLength="1" d="M43 8V46" stroke="url(#tbg)" stroke-width="7"/>
    <path class="t4" pathLength="1" d="M43 8H55a9.5 9.5 0 0 1 0 19H43" stroke="url(#tbg)" stroke-width="7"/>
    <path class="t5" pathLength="1" d="M43 27H58a9.5 9.5 0 0 1 0 19H43" stroke="url(#tbg)" stroke-width="7"/>
  </svg>`;
}

// Grades de séance selon le tonnage (charge × reps) et ce que ça représente
export const GRADES = [
  { t: 0, name: "Fer", icon: "⚙️", color: "#8a8f98" },
  { t: 2000, name: "Bronze", icon: "🥉", color: "#b0703a" },
  { t: 4000, name: "Argent", icon: "🥈", color: "#aeb6c2" },
  { t: 6000, name: "Or", icon: "🥇", color: "#e6b422" },
  { t: 9000, name: "Platine", icon: "💠", color: "#6fd3d0" },
  { t: 13000, name: "Diamant", icon: "💎", color: "#5aa7ff" },
  { t: 20000, name: "Légende", icon: "👑", color: "#ff7a3d" },
];
export const WEIGHTS = [
  [100, "un panda géant", "🐼"], [250, "un piano droit", "🎹"], [500, "un cheval", "🐎"], [1000, "une Fiat 500", "🚗"], [1500, "un hippopotame", "🦛"],
  [2000, "un rhinocéros", "🦏"], [3000, "un 4×4", "🚙"], [4000, "un éléphant d'Asie", "🐘"], [6000, "un éléphant d'Afrique", "🐘"], [8000, "un T-rex", "🦖"],
  [10000, "un bus scolaire", "🚌"], [15000, "un camion", "🚛"], [20000, "un TGV (une motrice)", "🚄"], [30000, "une baleine à bosse", "🐋"], [50000, "un avion de ligne", "✈️"], [100000, "un yacht de luxe", "🛥️"],
];
export const gradeOf = (kg) => [...GRADES].reverse().find(g => kg >= g.t);
export const nextGrade = (kg) => GRADES.find(g => g.t > kg) || null;
export const weightLike = (kg) => { const w = [...WEIGHTS].reverse().find(x => kg >= x[0]) || WEIGHTS[0]; const n = kg / w[0]; return { name: w[1], icon: w[2], n, txt: n >= 1.6 ? `${Math.round(n)} ${plural(w[1])}` : w[1] }; };
const plural = (s) => s.replace(/^un /, "").replace(/^une /, "").replace(/ \(.*/, "") + "s";
const fmtT = (kg) => (kg / 1000).toFixed(1).replace(".", ",");

// Médaille de séance : grade du tonnage + ce qui a été accompli
export function medalHtml(w, extra = {}) {
  const kg = w.volume || 0, g = gradeOf(kg), like = weightLike(kg), nx = nextGrade(kg);
  const planned = extra.planned || 0, pct = planned ? Math.round(w.setsDone / planned * 100) : null;
  const recs = (extra.recs || []).length;
  const badges = [recs ? `🏆 ${recs} record${recs > 1 ? "s" : ""}` : "", pct != null && pct >= 100 ? "✅ Séance complète" : "", w.setsDone >= 20 ? "🔥 20 séries et plus" : ""].filter(Boolean);
  return `<div class="medal" style="--mc:${g.color}"><div class="medal-disc"><span>${g.icon}</span></div>
    <div class="lbl" style="color:#fff;opacity:.8">GRADE DE LA SÉANCE</div><div class="medal-name">${g.name}</div>
    <p class="mt8" style="margin:8px 0 0">Tu as soulevé <b>${fmtT(kg)} t</b>${kg >= 100 ? ` : l'équivalent ${like.txt.replace(/^une? /, m => m.startsWith('une') ? "d'une " : "d'un ").replace(/^(\d)/, 'de $1')} ${like.icon}` : ""}</p>
    ${nx ? `<p class="xs" style="opacity:.75;margin:6px 0 0">Encore ${fmtT(nx.t - kg)} t pour le grade ${nx.name} ${nx.icon}</p>` : `<p class="xs" style="opacity:.75;margin:6px 0 0">Grade maximum atteint 👑</p>`}
    ${badges.length ? `<div class="chips wrap mt8" style="justify-content:center">${badges.map(b => `<span class="tag" style="background:rgba(255,255,255,.18);color:#fff">${esc(b)}</span>`).join("")}</div>` : ""}</div>`;
}

// Animation de record : charge max, 1RM estimé ou volume de série
const REC_LBL = { kg: ["⚖️", "Charge la plus lourde"], e1: ["📈", "Nouveau 1RM estimé"], vol: ["📦", "Record de volume sur une série"] };
export const recLabel = (k) => REC_LBL[k];
let fxT = null;
export function celebrate(name, recs) {
  if (!recs?.length) return;
  document.getElementById("rec-fx")?.remove(); clearTimeout(fxT);
  const el = document.createElement("div"); el.id = "rec-fx";
  const parts = Array.from({ length: 36 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(0)}vw;--d:${(Math.random() * .8).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--c:${["#EE8A45", "#fff", "#e6b422", "#5aa7ff", "#C2541F"][i % 5]}"></i>`).join("");
  el.innerHTML = `${parts}<div class="rec-card"><div class="rec-trophy">🏆</div><div class="rec-title">NOUVEAU RECORD</div><div class="rec-ex">${esc(name)}</div>
    ${recs.map(r => `<div class="rec-line"><span>${REC_LBL[r.k][0]} ${REC_LBL[r.k][1]}</span><b>${esc(r.txt)}</b></div>`).join("")}</div>`;
  el.onclick = () => { el.remove(); clearTimeout(fxT); };
  document.body.appendChild(el);
  try { navigator.vibrate?.([30, 40, 30, 40, 90]); } catch { }
  fxT = setTimeout(() => el.remove(), 3600);
}
