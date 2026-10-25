const C="tb-v110";
const MC="tb-media-v1"; // photos et vidéos du coach : gardées sur le téléphone (clé sans le jeton du lien signé)
self.addEventListener("install",e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest","./icon-192.png"]).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==MC).map(x=>caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch",e=>{ const r=e.request; if(r.method!=="GET") return; const u=new URL(r.url);
  if(u.searchParams.has("vcheck")) return; // vérification de nouvelle version : toujours le réseau
  if(/\/storage\/v1\/object\/sign\/media\//.test(u.pathname)){ e.respondWith(media(r,u)); return; }
  if(r.mode==="navigate"){ e.respondWith(fetch(r).then(res=>{ const cp=res.clone(); caches.open(C).then(c=>c.put("./index.html",cp)); return res; }).catch(()=>caches.match("./index.html"))); return; }
  if(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host)||u.origin===location.origin){ e.respondWith(caches.match(r).then(m=>{ const f=fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; }).catch(()=>m); return m||f; })); } });
// notifications
self.addEventListener("push",e=>{ let d={}; try{ d=e.data?e.data.json():{}; }catch(err){ d={body:e.data&&e.data.text()}; }
  // tag unique par message (sinon un nouveau message remplace l'ancien sans sonner) + renotify : son et vibration à chaque fois
  const kind=d.kind||d.tag||"info", tag=kind==="message"||kind==="lead"?kind+"-"+(d.at||Date.now()):kind;
  e.waitUntil(self.registration.showNotification(d.title||"TB my Coach",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",tag,renotify:true,silent:false,
      vibrate:[200,100,200],timestamp:d.at||Date.now(),data:{url:d.url||"./",kind}})
    .then(()=>self.clients.matchAll({type:"window",includeUncontrolled:true})).then(ws=>{ ws.forEach(w=>{ try{ w.postMessage({type:"push",kind}); }catch(err){} }); }) // l'app ouverte met à jour son centre de notifications
    .then(()=>self.registration.getNotifications()).then(ns=>{ // pastille sur l'icône de l'app (écran d'accueil)
      if(self.navigator&&self.navigator.setAppBadge) return self.navigator.setAppBadge(Math.max(1,ns.length)).catch(()=>{}); }).catch(()=>{})); });
self.addEventListener("notificationclick",e=>{ e.notification.close(); const url=new URL((e.notification.data&&e.notification.data.url)||"./",self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(ws=>{ for(const w of ws){ if(w.url.startsWith(self.registration.scope)&&"focus" in w){ try{ w.postMessage({type:"open",url}); }catch(err){} return w.focus(); } } return self.clients.openWindow(url); })); });
self.addEventListener("message",e=>{ if(e.data==="clear-badge"){ e.waitUntil(self.registration.getNotifications().then(ns=>ns.forEach(n=>n.close())).then(()=>self.navigator&&self.navigator.clearAppBadge?self.navigator.clearAppBadge().catch(()=>{}):null)); } });

// médias : téléchargés une fois, puis servis depuis le téléphone (y compris par morceaux pour les vidéos)
async function media(r,u){ const key=u.origin+u.pathname, c=await caches.open(MC); let hit=await c.match(key);
  if(!hit){ let res; try{ res=await fetch(u.href,{mode:"cors",credentials:"omit"}); }catch(err){ return fetch(r); }
    if(!res.ok) return res; const len=+res.headers.get("content-length")||0; if(len>40e6) return res;
    await c.put(key,res.clone()); trim(c); hit=res; }
  const rg=r.headers.get("range"); if(!rg) return hit;
  const blob=await hit.blob(), size=blob.size, m=/bytes=(\d*)-(\d*)/.exec(rg); if(!m) return new Response(blob,{headers:{"Content-Type":blob.type}});
  let a=m[1]===""?Math.max(0,size-(+m[2]||0)):+m[1], b=m[2]===""||m[1]===""?size-1:Math.min(+m[2],size-1); if(a>b||a>=size) return new Response(null,{status:416,headers:{"Content-Range":`bytes */${size}`}});
  const part=blob.slice(a,b+1); return new Response(part,{status:206,headers:{"Content-Type":blob.type||"video/mp4","Content-Range":`bytes ${a}-${b}/${size}`,"Content-Length":String(part.size),"Accept-Ranges":"bytes"}}); }
async function trim(c){ try{ const k=await c.keys(); if(k.length>200) await Promise.all(k.slice(0,k.length-200).map(x=>c.delete(x))); }catch(err){} }
