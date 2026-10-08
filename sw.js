const C="tb-v30";
self.addEventListener("install",e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest","./icon-192.png"]).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch",e=>{ const r=e.request; if(r.method!=="GET") return; const u=new URL(r.url);
  if(u.searchParams.has("vcheck")) return; // vérification de nouvelle version : toujours le réseau
  if(r.mode==="navigate"){ e.respondWith(fetch(r).then(res=>{ const cp=res.clone(); caches.open(C).then(c=>c.put("./index.html",cp)); return res; }).catch(()=>caches.match("./index.html"))); return; }
  if(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host)||u.origin===location.origin){ e.respondWith(caches.match(r).then(m=>{ const f=fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; }).catch(()=>m); return m||f; })); } });
// notifications
self.addEventListener("push",e=>{ let d={}; try{ d=e.data?e.data.json():{}; }catch(err){ d={body:e.data&&e.data.text()}; }
  // tag unique par message (sinon un nouveau message remplace l'ancien sans sonner) + renotify : son et vibration à chaque fois
  const kind=d.kind||d.tag||"info", tag=kind==="message"||kind==="lead"?kind+"-"+(d.at||Date.now()):kind;
  e.waitUntil(self.registration.showNotification(d.title||"TB my Coach",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",tag,renotify:true,silent:false,
      vibrate:[200,100,200],timestamp:d.at||Date.now(),data:{url:d.url||"./",kind}})
    .then(()=>self.registration.getNotifications()).then(ns=>{ // pastille sur l'icône de l'app (écran d'accueil)
      if(self.navigator&&self.navigator.setAppBadge) return self.navigator.setAppBadge(Math.max(1,ns.length)).catch(()=>{}); }).catch(()=>{})); });
self.addEventListener("notificationclick",e=>{ e.notification.close(); const url=new URL((e.notification.data&&e.notification.data.url)||"./",self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{ for(const w of ws){ if(w.url.startsWith(self.registration.scope)&&"focus" in w) return w.focus(); } return self.clients.openWindow(url); })); });
self.addEventListener("message",e=>{ if(e.data==="clear-badge"){ e.waitUntil(self.registration.getNotifications().then(ns=>ns.forEach(n=>n.close())).then(()=>self.navigator&&self.navigator.clearAppBadge?self.navigator.clearAppBadge().catch(()=>{}):null)); } });
