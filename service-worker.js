/**
 * Service worker de "Conteos Diarios".
 *
 * Solo cachea el "shell" estático de la app (HTML, manifest, iconos) para
 * que pueda instalarse y abra rápido. Los datos (conteos, calendario,
 * observaciones, envíos) SIEMPRE van directos a Apps Script por red: no se
 * cachean, porque son datos en vivo que cambian constantemente entre
 * compañeros usando la app a la vez.
 *
 * Si cambias el HTML/CSS/JS, sube el número de CACHE_NAME para que los
 * usuarios reciban la versión nueva en vez de la cacheada.
 */
const CACHE_NAME = 'conteos-diarios-v1';
const ARCHIVOS_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ARCHIVOS_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(
        nombres
          .filter(function (nombre) { return nombre !== CACHE_NAME; })
          .map(function (nombre) { return caches.delete(nombre); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const url = event.request.url;

  // Las llamadas a Apps Script (los datos) nunca se cachean: van siempre a red.
  if (url.indexOf('script.google.com') !== -1) {
    return;
  }

  // Para el shell estático: red primero, y si no hay conexión, caché.
  event.respondWith(
    fetch(event.request)
      .then(function (resp) {
        const respClon = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, respClon); });
        return resp;
      })
      .catch(function () { return caches.match(event.request); })
  );
});
