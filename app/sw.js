// Service worker TB my Coach : l'app fonctionne hors ligne en salle.
// Après chaque modification de l'app, augmenter ce numéro de version.
const C = "cxs-v41";
const SHELL = ["./", "index.html", "coach.html", "manifest-coach.webmanifest", "css/app.css", "js/app.js", "js/core.js", "js/sync.js", "js/store.js", "js/engine.js", "js/energy.js", "js/nutrition.js", "js/recipes.js", "js/config.js", "js/views/onboarding.js", "js/views/home.js", "js/views/agenda.js", "js/views/train.js", "js/views/food.js", "js/views/meals.js", "js/views/supps.js", "js/shop.js", "js/quests.js", "js/views/trophees.js", "js/views/coach.js", "js/views/more.js", "js/views/crise.js", "js/views/recup.js", "js/library.js", "js/cloud.js", "js/views/season.js", "js/views/admin.js", "data/fiches.json", "data/lib.json", "data/programs.json", "data/nutrition-models.json", "manifest.webmanifest", "assets/logo-grec.jpg", "assets/favicon-96-grec.png", "assets/icon-192-grec.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname.includes("openfoodfacts") || u.hostname.includes("supabase")) return; // toujours en ligne
  // Fichiers de l'app (même origine) : réseau d'abord, pour que chaque ouverture reçoive la dernière version.
  // Le cache ne sert qu'en secours hors ligne (salle sans réseau).
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.match(e.request)));
    return;
  }
  // Polices et autres ressources externes : cache d'abord.
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok && u.hostname.includes("fonts.")) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
