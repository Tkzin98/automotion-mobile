const CACHE="automotion-studio-v12.5.0";
self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
// Development-safe worker: do not cache app resources. The editor always gets the current build.
self.addEventListener("fetch",()=>{});
