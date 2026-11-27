// Saisie du coach à la place d'un client : il utilise les mêmes écrans que le client (séance notée après coup, journal alimentaire),
// sur les données du client ; seuls les ajouts / corrections sont envoyés au serveur, puis appliqués sur le téléphone du client.
import { S, proxyStart, proxyStop, proxyActive } from "./store.js";

let M = null, tmr = null;
const J = (x) => JSON.stringify(x);
const baseOf = () => ({
  w: new Map((S().workouts || []).map(w => [String(w.id), J(w)])),
  f: new Map(Object.entries(S().food || {}).flatMap(([d, l]) => l.map(e => [d + "|" + e.id, J(e)]))),
  l: Object.fromEntries(Object.entries(S().lifts || {}).map(([k, h]) => [k, h.length])),
  e: J(S().echanges || {}),
});
export function diffSaisie() {
  if (!M) return null;
  const cur = S(), out = { workouts: [], wDel: [], food: {}, foodDel: {}, lifts: {} };
  const seenW = new Set();
  for (const w of cur.workouts || []) { const k = String(w.id); seenW.add(k); if (M.base.w.get(k) !== J(w)) out.workouts.push(w); }
  for (const k of M.base.w.keys()) if (!seenW.has(k)) out.wDel.push(k);
  const seenF = new Set();
  for (const [d, l] of Object.entries(cur.food || {})) for (const e of l) { const k = d + "|" + e.id; seenF.add(k); if (M.base.f.get(k) !== J(e)) (out.food[d] = out.food[d] || []).push(e); }
  for (const k of M.base.f.keys()) if (!seenF.has(k)) { const i = k.indexOf("|"), d = k.slice(0, i), id = k.slice(i + 1); (out.foodDel[d] = out.foodDel[d] || []).push(id); }
  for (const [n, h] of Object.entries(cur.lifts || {})) { const b = M.base.l[n] || 0; if (h.length > b) out.lifts[n] = h.slice(b); }
  if (J(cur.echanges || {}) !== M.base.e) out.echanges = cur.echanges || {};
  const vide = !out.echanges && !out.workouts.length && !out.wDel.length && !Object.keys(out.food).length && !Object.keys(out.foodDel).length && !Object.keys(out.lifts).length;
  return vide ? null : out;
}
async function flush() {
  if (!M) return; clearTimeout(tmr);
  const d = diffSaisie(); if (!d) return;
  const { cloud } = await import("./core.js"), { toast } = await import("./core.js");
  const snap = baseOf();
  try {
    const c = await cloud(); await c.coachSaisie(M.id, d); M.base = snap;
    // Le résumé du client (agenda, dernière séance, rappels) est recalculé tout de suite, sans attendre qu'il ouvre l'appli
    try { const { snapshot } = await import("./sync.js"), r = snapshot(true); if (r?.summary) await c.coachSummary(M.id, r.summary); } catch { }
  }
  catch (e) { toast("Enregistrement chez le client impossible : " + e.message); }
}
export const saisieActive = () => proxyActive();
export async function saisieStart(id, name, data) {
  if (proxyActive()) return true;
  const me = S().me;
  if (!proxyStart(data, me, () => { clearTimeout(tmr); tmr = setTimeout(flush, 900); }, { id, name })) return false;
  M = { id, name, base: baseOf() };
  return true;
}
export async function saisieStop() { await flush(); proxyStop(); M = null; }
