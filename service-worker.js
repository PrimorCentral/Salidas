/**
 * Service Worker - Conteos Diarios
 * =================================
 * Hace que la PWA sea instalable y guarda una copia de respaldo del código
 * de la app (index.html, styles.css y js/*.js) para poder abrirla sin
 * conexión. NO se encarga de detectar versiones nuevas: eso lo hace
 * js/actualizaciones.js con version.json, así que este archivo NO hay que
 * tocarlo al publicar una versión.
 *
 * CÓMO PUBLICAR UNA ACTUALIZACIÓN
 * --------------------------------
 * 1. Sube los archivos que hayan cambiado (index.html, styles.css, js/*.js,
 *    etc.) al hosting, todos en el MISMO commit.
 * 2. Cambia el número de version.json. Nada más.
 *
 * Nota: aquí NO se llama a self.skipWaiting() al instalar. Si algún día se
 * cambia este archivo, el nuevo se queda "en espera" y js/actualizaciones.js
 * lo activa al abrir la app; así una pestaña que siga abierta con una versión
 * anterior de la app no se recarga sola por sorpresa mientras alguien rellena
 * un conteo.
 */

// Nombre de caché FIJO: ya no cambia en cada versión (la detección de versiones
// nuevas es cosa de version.json). Las respuestas se renuevan solas porque el
// código va siempre "network first" (ver 'fetch' más abajo).
const CACHE_NAME = 'conteos-diarios';

// Archivos del "app shell" que se cachean al instalar. Los js/*.js NO hace
// falta listarlos: se guardan solos la primera vez que se cargan (ver 'fetch'
// más abajo), así que al añadir un .js nuevo solo hay que ponerlo en
// index.html. No hace falta listar aquí llamadas a la API: esas nunca se
// cachean.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
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
    // SKIP_WAITING (js/actualizaciones.js lo hace al abrir la app).
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

// Mensaje que manda la app (js/actualizaciones.js, y las versiones anteriores
// al pulsar "Actualizar ahora"): activa este service worker inmediatamente
// sin esperar a que se cierren todas las pestañas abiertas.
self.addEventListener('message', function (event) {
  const esSkipWaiting = event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING');
  if (esSkipWaiting) self.skipWaiting();
});

/**
 * Estrategia de red:
 *  - Navegación / HTML (index.html) y código propio (styles.css y js/*.js):
 *    "network first, cache fallback". Se intenta siempre traer la versión
 *    más reciente si hay conexión; si no hay red, se sirve la última copia
 *    cacheada para que la app siga funcionando offline. Van todos con la
 *    misma estrategia para que un index.html nuevo nunca se mezcle con JS
 *    viejo guardado en caché.
 *  - version.json: nunca pasa por el service worker (siempre red), para que
 *    el sondeo de "hay versión nueva" vea siempre el valor real.
 *  - Resto de assets estáticos (iconos, manifest...): "cache first", ya
 *    que cambian mucho menos y así se gana velocidad.
 *  - Llamadas a la API de Apps Script (POST, u otros dominios): se dejan
 *    pasar directas a la red, nunca se cachean ni se intervienen aquí (los
 *    datos de conteos siempre tienen que ser en vivo).
 */
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return; // las llamadas a la API son POST: se ignoran aquí, van directas a la red

  const url = new URL(req.url);
  const esMismoOrigen = url.origin === self.location.origin;

  // version.json no se toca aquí: va siempre directo a la red (y no se guarda
  // en caché), para que el sondeo de versión nueva vea siempre el valor real.
  if (esMismoOrigen && /\/version\.json$/.test(url.pathname)) return;

  const esNavegacion = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  // Código propio de la app (index.html se divide en styles.css + js/*.js):
  // misma estrategia que el HTML para que nunca se mezclen versiones.
  const esCodigo = esMismoOrigen && /\.(?:js|css)$/.test(url.pathname);

  if (esNavegacion || esCodigo) {
    event.respondWith(
      fetch(req)
        .then(function (resp) {
          // Solo se guardan respuestas correctas: un 404 puntual (p.ej. justo
          // durante un despliegue) no debe pisar la última copia buena.
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copia); });
          }
          return resp;
        })
        .catch(function () {
          return caches.match(req).then(function (r) {
            return r || (esNavegacion ? caches.match('./index.html') : Response.error());
          });
        })
    );
    return;
  }

  // Solo se intercepta el propio origen (assets locales); todo lo demás
  // (API de Apps Script, imágenes externas, etc.) va directo a la red.
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
