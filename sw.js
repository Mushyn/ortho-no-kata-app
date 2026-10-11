// Service worker : généré par `node tools/build-sw.js` (ne pas modifier sw.js à la main).
// Le nom du cache change dès qu'un fichier de l'appli change : c'est ce qui déclenche
// la bannière « Nouvelle version disponible ».
const CACHE_NAME = 'ortho-no-kata-3ac1361a';
const ASSETS = [
  "./",
  "data/dictees-v1.json",
  "data/mots-v1.json",
  "data/phrases-v1.json",
  "dictee.html",
  "dictee.js",
  "dictees-model.js",
  "dom.js",
  "duel-model.js",
  "duel.html",
  "duel.js",
  "fit.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-plein.svg",
  "icons/logo.svg",
  "index.html",
  "lecon.html",
  "lecon.js",
  "manifest.json",
  "menu.js",
  "mots-model.js",
  "mots.html",
  "mots.js",
  "pwa.js",
  "rules.js",
  "scores.html",
  "scores.js",
  "shared.js",
  "style.css",
  "theme.js"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' }))))
    )
  );
  // Pas de skipWaiting() automatique : la mise à jour n'est activée que si l'utilisateur
  // appuie sur le bouton du bandeau (message SKIP_WAITING ci-dessous).
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cles => Promise.all(cles.filter(c => c !== CACHE_NAME).map(c => caches.delete(c))))
  );
  self.clients.claim();
});

// Cache d'abord, réseau en secours, et repli sur la page d'accueil hors connexion
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(enCache => {
      if (enCache) return enCache;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('index.html');
        return new Response('', { status: 503, statusText: 'Hors connexion' });
      });
    })
  );
});
