/**
 * Service Worker - Conteos Diarios
 * =================================
 * Cachea el "app shell" (index.html + assets estáticos) para que la PWA
 * cargue rápido y funcione offline, y avisa al frontend cuando hay una
 * versión nueva instalada en vez de activarla sola por sorpresa: espera a
 * que el usuario confirme en el modal "Nueva versión disponible" (ver
 * index.html) para no interrumpir a nadie a media faena rellenando un
 * conteo.
 *
 * CÓMO PUBLICAR UNA ACTUALIZACIÓN
 * --------------------------------
 * 1. Sube los archivos que hayan cambiado (index.html, etc.) al hosting.
 * 2. Sube ESTE archivo de nuevo, cambiando el número de CACHE_VERSION de
 *    aquí abajo (p.ej. 'v1' -> 'v2'). Ese cambio de contenido es lo que
 *    hace que el navegador detecte el service worker como "distinto" y
 *    dispare todo el flujo de aviso en el frontend.
 * 3. Actualiza también version.json con el MISMO número que pongas en
 *    APP_VERSION_ACTUAL dentro de index.html. Es el mecanismo de
 *    respaldo (sondeo activo) para navegadores donde el ciclo de vida del
 *    Service Worker tarda en dispararse -- típicamente Safari/iOS con la
 *    PWA instalada en pantalla de inicio.
 *
 * Los tres valores (CACHE_VERSION aquí, "version" en version.json, y
 * APP_VERSION_ACTUAL en index.html) deben subir siempre juntos y con el
 * mismo número, aunque cada uno cumple un papel distinto.
 */

const CACHE_VERSION = 'v1.2.9'; // <-- SUBE ESTE NÚMERO EN CADA DESPLIEGUE
const CACHE_NAME = 'conteos-diarios-' + CACHE_VERSION;

// Archivos del "app shell" que se cachean al instalar. Ajusta esta lista si
// tienes más assets estáticos fijos (más iconos, manifest.json con otro
// nombre, etc.). No hace falta listar aquí llamadas a la API: esas nunca se
// cachean (ver 'fetch' más abajo).
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        // {cache:'reload'} para no coger estos archivos de una caché HTTP
        // vieja del propio navegador al construir la caché nueva.
        const requests = APP_SHELL.map(function (url) { return new Request(url, { cache: 'reload' }); });
        return cache.addAll(requests);
      })
      .catch(function (err) {
        console.warn('Service worker: fallo cacheando el app shell', err);
      })
    // OJO: no se llama a self.skipWaiting() aquí. Este service worker se
    // queda "esperando" (waiting) hasta que el frontend le mande el mensaje
    // SKIP_WAITING (botón "Actualizar ahora" del modal), así la pestaña
    // abierta sigue funcionando con la versión antigua hasta que el usuario
    // decida actualizar.
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (nombres) {
        return Promise.all(
          nombres
            .filter(function (nombre) { return nombre !== CACHE_NAME; })
            .map(function (nombre) { return caches.delete(nombre); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Mensaje que manda index.html cuando el usuario pulsa "Actualizar ahora"
// en el modal: activa este service worker inmediatamente sin esperar a que
// se cierren todas las pestañas abiertas.
self.addEventListener('message', function (event) {
  const esSkipWaiting = event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING');
  if (esSkipWaiting) self.skipWaiting();
});

/**
 * Estrategia de red:
 *  - Navegación / HTML (index.html): "network first, cache fallback". Se
 *    intenta siempre traer la versión más reciente si hay conexión; si no
 *    hay red, se sirve la última copia cacheada para que la app siga
 *    funcionando offline.
 *  - Resto de assets estáticos (iconos, manifest...): "cache first", ya
 *    que cambian mucho menos y así se gana velocidad.
 *  - Llamadas a la API de Apps Script (POST, u otros dominios): se dejan
 *    pasar directas a la red, nunca se cachean ni se intervienen aquí (los
 *    datos de conteos siempre tienen que ser en vivo).
 */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return; // las llamadas a la API son POST: se ignoran aquí, van directas a la red

  const esNavegacion = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (esNavegacion) {
    event.respondWith(
      fetch(req)
        .then(function (resp) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copia); });
          return resp;
        })
        .catch(function () {
          return caches.match(req).then(function (r) { return r || caches.match('./index.html'); });
        })
    );
    return;
  }

  // Solo se intercepta el propio origen (assets locales); todo lo demás
  // (API de Apps Script, imágenes externas, etc.) va directo a la red.
  const esMismoOrigen = new URL(req.url).origin === self.location.origin;
  if (!esMismoOrigen) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copia); });
        return resp;
      });
    })
  );
});
