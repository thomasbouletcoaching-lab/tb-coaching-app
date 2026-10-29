// Données locales : tout reste sur le téléphone de l'utilisateur.
// Deux applis distinctes sur le même serveur : coach.html (espace coach) et index.html (client).
// Chacune garde ses données sur le téléphone, dans sa propre clé de stockage.
export const APP_MODE = document.documentElement.dataset.app === "coach" ? "coach" : "client";
const KEY = APP_MODE === "coach" ? "cxs.coach.v1" : "cxs.v1";

const blank = () => ({
  profile: null,          // réponses de l'onboarding
  plan: null,             // { programId, startedAt, week, idx, cycle }
  lifts: {},              // { [exercice]: [{ d, e1rm }] } historique e1RM
  workouts: [],           // séances terminées
  current: null,          // séance en cours
  food: {},               // { 'YYYY-MM-DD': [entrées] }
  dishes: [],             // plats enregistrés par l'utilisateur
  recentFoods: [],        // derniers aliments utilisés
  measures: [],           // { d, weight, waist, hips, chest, arm, thigh }
  application: null,      // candidature coaching
  swaps: {},              // exercice d'origine -> remplaçant choisi
  settings: { word: "discreet", haptics: true },
  favorites: [],          // ids de versets et d'affirmations
  me: { tier: "free", isCoach: false, msgsLeft: null }, // dernier état connu du serveur
  demoTier: null,         // aperçu d'une formule
  notifSeen: 0,           // horodatage de la dernière lecture des notifications
  synced: false,          // profil envoyé au serveur
  daily: {},              // { 'YYYY-MM-DD': { weight, steps, sleep, water, cardio:[{n,met,min}] } }
  fast: null,             // jeûne en cours { start, goal }
  fasts: [],              // jeûnes terminés { start, end }
  favFoods: [],           // aliments favoris
  myRecipes: [],          // recettes créées
  batches: [],            // sessions de batch cooking
  myPlan: null,           // plan alimentaire écrit par l'utilisateur
  customPrograms: [],     // programmes créés
  moves: {}, skips: {},   // agenda : séances déplacées, repos choisis
  highlights: {},         // Bible : { 'livre.chap.verset': couleur }
  bibleNotes: {},         // Bible : { 'livre.chap.verset': texte }
  bibleAt: { b: 43, c: 3 },
  kbRead: {},
  budget: { weekly: null, people: 1 }, // budget courses (Premium)
  receipts: [],           // tickets de caisse { id, d, shop, amount }
  prices: {},             // prix personnels { ingrédient: €/kg }
  crises: [],             // « Je craque » : notes { d, note }
});

let state;
try { state = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
catch { state = blank(); }

export const S = () => state;
const hooks = new Set();
export const onSave = (fn) => hooks.add(fn);
let borrowed = null;
export function save() {
  if (borrowed) return; // on lit les données d'un membre : rien n'est écrit sur ce téléphone
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn("Stockage plein", e); }
  hooks.forEach(f => { try { f(); } catch { } });
}
// Exécute fn avec l'état d'un autre membre (espace coach), puis revient à l'état du téléphone
export function withState(other, fn) {
  const mine = state; borrowed = true; state = Object.assign(blank(), other || {});
  try { return fn(); } finally { state = mine; borrowed = null; }
}
export function update(fn) { fn(state); save(); }
export function resetAll() { state = blank(); save(); }
export function exportJSON() { return JSON.stringify({ app: "calxsthenos", v: 1, at: new Date().toISOString(), data: state }, null, 1); }
export function importJSON(text) {
  const o = JSON.parse(text);
  if (!o || o.app !== "calxsthenos" || !o.data) throw new Error("Ce fichier n'est pas une sauvegarde TB my Coach.");
  state = Object.assign(blank(), o.data); save();
}

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return z.toISOString().slice(0, 10);
};

// Photos de progrès (IndexedDB)
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("cxs-photos", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("p", { keyPath: "id" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function addPhoto(blob, day = today(), view = "face", meta = {}) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction("p", "readwrite");
    tx.objectStore("p").put({ id: Date.now(), d: day, view, blob, ...meta });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
export async function listPhotos() {
  try {
    const d = await db();
    return await new Promise((res) => {
      const r = d.transaction("p").objectStore("p").getAll();
      r.onsuccess = () => res(r.result.sort((a, b) => b.d.localeCompare(a.d) || b.id - a.id)); r.onerror = () => res([]);
    });
  } catch { return []; }
}
export async function deletePhoto(id) {
  const d = await db();
  d.transaction("p", "readwrite").objectStore("p").delete(id);
}
export async function updatePhoto(id, fields) {
  const d = await db();
  return new Promise((res, rej) => {
    const st = d.transaction("p", "readwrite").objectStore("p"), g = st.get(id);
    g.onsuccess = () => { if (!g.result) return res(); const r = st.put({ ...g.result, ...fields }); r.onsuccess = res; r.onerror = () => rej(r.error); };
  });
}
