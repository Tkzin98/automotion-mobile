const CACHE='automotion-shell-v3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const r=event.request; if(r.method!=='GET') return;
 const u=new URL(r.url); if(u.origin!==location.origin) return;
 const appFile=['index.html','app.js','styles.css','manifest.webmanifest','sw.js'].some(n=>u.pathname.endsWith('/'+n)||u.pathname===n);
 if(appFile){event.respondWith(fetch(r,{cache:'no-store'}).then(res=>{const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));return res}).catch(()=>caches.match(r)));}
 else {event.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(y=>y.put(r,c));return res})));}
});
