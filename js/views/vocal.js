// Mémos vocaux « buffet / grignotage » : tu dictes en cours de journée (« à 13h une louche de riz… »),
// l'app garde le mémo avec son heure, et le soir tu le réécoutes pour ajouter les aliments au bon repas.
// Les enregistrements restent sur le téléphone (IndexedDB) : pas de transcription automatique.
import { today } from "../store.js";
import { esc, toast, buzz, actions, rerender } from "../core.js";
import { addFoodSheet } from "./food.js";

let MEMOS = [], REC = null, T0 = 0;
const DB = "cxs-memos";
const open = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("m", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("m", mode), s = t.objectStore("m"), q = fn(s); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };
async function load() { try { MEMOS = (await tx("readonly", s => s.getAll())) || []; MEMOS.sort((a, b) => a.id - b.id); } catch { MEMOS = []; } }
load().then(() => rerender?.()).catch(() => { });

const mealFor = (t) => { const h = +String(t).slice(0, 2); return h < 11 ? "Petit-déjeuner" : h < 15 ? "Déjeuner" : h < 18 ? "Collation" : "Dîner"; };
export function memosCard(d) {
  const list = MEMOS.filter(m => m.d === d);
  return `<div class="card mt12"><div class="row between"><div><b>🎙️ Mémo vocal</b><div class="xs muted">Dicte ce que tu manges au fil de la journée, tu le saisis le soir.</div></div>
    ${d === today() ? `<button class="btn ${REC ? "btn-red" : "btn-line"} btn-sm" data-a="memo-rec" style="width:auto">${REC ? "⏹️ Arrêter" : "🎙️ Enregistrer"}</button>` : ""}</div>
    ${list.length ? `<div class="list mt8">${list.map(m => `<div class="li" style="gap:8px"><span class="grow small"><b>${esc(m.t)}</b> · ${m.dur || "?"} s${m.done ? ` <span class="tag g">saisi</span>` : ""}</span>
      <button class="icon-btn sm" data-a="memo-play" data-id="${m.id}" aria-label="Écouter">▶</button>
      <button class="btn btn-line btn-xs" data-a="memo-use" data-id="${m.id}" style="width:auto">Saisir</button>
      <button class="icon-btn sm" data-a="memo-del" data-id="${m.id}" aria-label="Supprimer">✕</button></div>`).join("")}</div>` : ""}</div>`;
}
actions["memo-rec"] = async () => {
  if (REC) { REC.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast("Enregistrement vocal non disponible sur ce téléphone");
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast("Micro refusé : autorise-le dans les réglages du téléphone"); }
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported?.(t)) || "";
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : {}), chunks = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); REC = null;
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" }), dur = Math.round((Date.now() - T0) / 1000);
    if (blob.size < 1500) { toast("Mémo trop court"); return rerender(); }
    const now = new Date(), m = { id: Date.now(), d: today(), t: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`, dur, blob, done: false };
    try { await tx("readwrite", s => s.put(m)); MEMOS.push(m); buzz(); toast("Mémo enregistré"); } catch { toast("Stockage impossible sur ce téléphone"); }
    rerender();
  };
  REC = rec; T0 = Date.now(); rec.start(); toast("Enregistrement… touche ⏹️ pour finir"); rerender();
};
let AUD = null;
actions["memo-play"] = (b, d) => {
  const m = MEMOS.find(x => x.id === +d.id); if (!m) return;
  try { AUD?.pause(); AUD = new Audio(URL.createObjectURL(m.blob)); AUD.play(); } catch { toast("Lecture impossible"); }
};
actions["memo-use"] = async (b, d) => {
  const m = MEMOS.find(x => x.id === +d.id); if (!m) return;
  m.done = true; try { await tx("readwrite", s => s.put(m)); } catch { }
  addFoodSheet(mealFor(m.t));
};
actions["memo-del"] = async (b, d) => {
  if (!confirm("Supprimer ce mémo ?")) return;
  try { await tx("readwrite", s => s.delete(+d.id)); } catch { }
  MEMOS = MEMOS.filter(x => x.id !== +d.id); rerender();
};
