// Analyses vidéo enregistrées sur le téléphone (IndexedDB) : la vidéo découpée + les annotations. Rien n'est envoyé.
const DB = "tbcoach-videos", ST = "analyses";
function ouvrir() { return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
const tx = async (mode, fn) => { const db = await ouvrir(); return new Promise((ok, ko) => { const t = db.transaction(ST, mode), s = t.objectStore(ST), r = fn(s); t.oncomplete = () => ok(r?.result); t.onerror = () => ko(t.error); }); };
export const enregistrer = (rec) => tx("readwrite", s => s.put(rec));
export const lire = (id) => tx("readonly", s => s.get(id));
export const supprimer = (id) => tx("readwrite", s => s.delete(id));
