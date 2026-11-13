// Transcritor — service worker: funciona offline e recebe áudios do "Compartilhar" (Android)
const SHELL = 'transcritor-shell-v1';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('transcritor-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // modelo e biblioteca: deixa o navegador cuidar

  // Áudio recebido pelo "Compartilhar"
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const files = form.getAll('audio');
        const c = await caches.open('shared-files');
        let i = 0;
        for (const f of files) {
          if (!(f instanceof File)) continue;
          await c.put(new Request(`./shared/${Date.now()}-${i++}`), new Response(f, {
            headers: { 'Content-Type': f.type || 'audio/ogg', 'X-Name': encodeURIComponent(f.name || 'audio.ogg') }
          }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  // Páginas do app: tenta a rede (pega atualizações), cai para o cache offline
  if (e.request.method === 'GET') {
    e.respondWith((async () => {
      try {
        const r = await fetch(e.request);
        if (r.ok) { const c = await caches.open(SHELL); c.put(e.request, r.clone()); }
        return r;
      } catch (err) {
        return (await caches.match(e.request, { ignoreSearch: true })) || caches.match('./index.html');
      }
    })());
  }
});
