const C="tb-v111", MC="tb-media-v1"; // MC : photos, vidéos et vocaux déjà vus (gardé d'une version de l'app à l'autre)
self.addEventListener("install",e=>{ e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest","./icon-192.png"]).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==MC).map(x=>caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch",e=>{ const r=e.request; if(r.method!=="GET") return; const u=new URL(r.url);
  if(u.searchParams.has("vcheck")) return; // vérification de nouvelle version : toujours le réseau
  if(MEDIA.test(u.pathname)&&/\.supabase\.co$/.test(u.host)&&u.searchParams.has("token")&&!u.searchParams.has("download")){ e.respondWith(media(r)); return; }
  if(r.mode==="navigate"){ e.respondWith(fetch(r).then(res=>{ const cp=res.clone(); caches.open(C).then(c=>c.put("./index.html",cp)); return res; }).catch(()=>caches.match("./index.html"))); return; }
  if(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/.test(u.host)||u.origin===location.origin){ e.respondWith(caches.match(r).then(m=>{ const f=fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(C).then(c=>c.put(r,cp)); } return res; }).catch(()=>m); return m||f; })); } });
// ---------- médias du Storage (URL signées) : téléchargés une seule fois, puis servis depuis le téléphone (clé : le fichier, sans le jeton)
// Les vidéos sont lues par morceaux (en-tête Range) : on garde le fichier entier et on renvoie le morceau demandé.
const MEDIA=/^\/storage\/v1\/object\/sign\/media\//, MAX_N=150, MAX_B=300*1048576, INF=new Map();
function mediaGet(url){ const key=new URL(url); key.search=""; return caches.open(MC).then(c=>c.match(key.href).then(m=>{ if(m) return m.blob().then(b=>({b,t:m.headers.get("content-type")||b.type}));
  if(INF.has(key.href)) return INF.get(key.href);
  const p=fetch(url,{mode:"cors",credentials:"omit"}).then(res=>{ if(res.status!==200) return null; return res.blob().then(b=>{ const t=res.headers.get("content-type")||b.type;
      return c.put(key.href,new Response(b,{headers:{"Content-Type":t,"Content-Length":String(b.size)}})).then(()=>mediaTrim(c,key.href)).catch(()=>{}).then(()=>({b,t})); }); })
    .finally(()=>INF.delete(key.href));
  INF.set(key.href,p); return p; })); }
function mediaTrim(c,url){ return c.keys().then(ks=>{ const del=[], rest=ks.filter(k=>{ if(new URL(k.url).search){ del.push(k); return false; } return true; }); // anciennes entrées avec jeton
  return Promise.all(rest.map(k=>c.match(k).then(m=>+(m&&m.headers.get("content-length"))||0))).then(sz=>{ let n=rest.length, tot=sz.reduce((a,x)=>a+x,0);
    for(let i=0;i<rest.length&&(n>MAX_N||tot>MAX_B);i++){ if(rest[i].url===url) continue; del.push(rest[i]); n--; tot-=sz[i]; } // les plus anciens d'abord
    return Promise.all(del.map(k=>c.delete(k))); }); }); }
function mediaResp(r,o){ const size=o.b.size, h={"Content-Type":o.t,"Accept-Ranges":"bytes"}, rg=r.headers.get("range"), m=rg&&/^bytes=(\d*)-(\d*)$/.exec(rg.trim());
  if(!m||(m[1]===""&&m[2]==="")){ h["Content-Length"]=String(size); return new Response(o.b,{status:200,headers:h}); }
  let s,e; if(m[1]===""){ s=Math.max(0,size-(+m[2])); e=size-1; } else { s=+m[1]; e=m[2]===""?size-1:Math.min(+m[2],size-1); }
  if(s>=size||s>e) return new Response(null,{status:416,headers:{"Content-Range":"bytes */"+size}});
  h["Content-Range"]=`bytes ${s}-${e}/${size}`; h["Content-Length"]=String(e-s+1); return new Response(o.b.slice(s,e+1),{status:206,headers:h}); }
function media(r){ return mediaGet(r.url).then(o=>o?mediaResp(r,o):fetch(r)).catch(()=>fetch(r)); }
self.addEventListener("message",e=>{ if(e.data==="clear-media") e.waitUntil(caches.delete(MC)); });
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

