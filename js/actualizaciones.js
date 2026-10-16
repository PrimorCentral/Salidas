/* SALIDAS · js/actualizaciones.js — PWA: versión (version.json), aviso de actualización y service worker */

/* ---------------- PWA: versión + aviso de actualización ----------------
 * La ÚNICA fuente del número de versión es version.json. Al arrancar, la app
 * lo lee (queda en APP_VERSION_ACTUAL, que se pinta en el login y en "Inicio")
 * y después lo vuelve a consultar cada 5 minutos y cada vez que se vuelve a
 * la app. Si el número ha cambiado en el servidor, sale un modal obligatorio
 * de "Actualización disponible" (no se recarga sola, para no interrumpir a
 * nadie mientras rellena un conteo). Al pulsar "Actualizar ahora" se
 * desregistra el service worker, se vacían las cachés, se refresca la caché
 * HTTP de los archivos propios y se recarga.
 *
 * PARA PUBLICAR UNA ACTUALIZACIÓN: sube los archivos que cambien (todos en el
 * mismo commit), cambia el número de version.json y añade arriba del todo en
 * js/changelog.js la entrada de esa versión (sale en "Acerca de" > Novedades).
 * No hay que tocar nada más (ni config.js ni service-worker.js).
 */
let actualizacionYaAvisada = false;
const VERSION_INTERVALO_MS_ = 5 * 60 * 1000;

/** Lee el número de versión actual del servidor (siempre fresco, sin caché). */
function obtenerVersionRemota_() {
  return fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
    .then(function (resp) { return resp.ok ? resp.json() : null; })
    .then(function (data) { return (data && data.version) ? String(data.version) : null; })
    .catch(function () { return null; }); // sin conexión o version.json no disponible: no es crítico
}

/** Pinta el número de versión en el login y en "Inicio" (todos los .version-badge). */
function aplicarVersionEnPantalla_() {
  if (!APP_VERSION_ACTUAL) return;
  document.querySelectorAll('.version-badge').forEach(function (el) {
    el.textContent = 'v' + APP_VERSION_ACTUAL;
  });
}

/** Arranque: guarda con qué versión se ha cargado la app. */
function comprobarVersionInicial_() {
  return obtenerVersionRemota_().then(function (version) {
    if (version && !APP_VERSION_ACTUAL) {
      APP_VERSION_ACTUAL = version;
      aplicarVersionEnPantalla_();
    }
  });
}

/** Compara la versión del servidor con la de esta pestaña y avisa si ha cambiado. */
function comprobarActualizacion_() {
  if (actualizacionYaAvisada) return;
  if (!APP_VERSION_ACTUAL) { comprobarVersionInicial_(); return; } // no se pudo leer al arrancar: se reintenta
  obtenerVersionRemota_().then(function (remota) {
    if (remota && remota !== APP_VERSION_ACTUAL) mostrarModalActualizacion(remota);
  });
}

/** versionNueva es opcional: si no se conoce, se omiten los números y la
 *  chapa del perro dice "Nueva versión". Misma ventana que en GIDT (marcado
 *  en index.html, #actualizacionModalOverlay): un perro pasea por la calle
 *  con la nueva versión; al pulsar "Actualizar ahora" echa a correr y sale
 *  una barra de progreso mientras se limpia la caché y se recarga. No se
 *  puede cerrar (ni con clic fuera ni con Escape): la actualización es
 *  obligatoria. */
function mostrarModalActualizacion(versionNueva) {
  // Si ya hay otro modal abierto (p.ej. alguien confirmando un cierre de
  // tienda), no se lo quitamos de encima: se reintenta en el próximo
  // sondeo/evento en vez de interrumpir lo que está haciendo.
  if (actualizacionYaAvisada) return;
  if (document.getElementById('modal-overlay').style.display === 'flex') {
    setTimeout(function () { mostrarModalActualizacion(versionNueva); }, 15000);
    return;
  }
  const overlay = document.getElementById('actualizacionModalOverlay');
  if (!overlay) return;
  actualizacionYaAvisada = true;

  // "Acerca de" es solo informativa: si estaba abierta, se cierra.
  if (typeof window.cerrarModalAcercaDe_ === 'function') window.cerrarModalAcercaDe_();

  if (APP_VERSION_ACTUAL && versionNueva) {
    document.getElementById('actVersionActual').textContent = 'v' + APP_VERSION_ACTUAL;
    document.getElementById('actVersionNueva').textContent = 'v' + versionNueva;
    document.getElementById('actVersiones').hidden = false;
  }
  if (versionNueva) document.getElementById('actChapaVersion').textContent = 'v' + versionNueva;

  overlay.classList.add('show');
  document.body.classList.add('modal-propio-abierto');
  const btn = document.getElementById('btnActualizarAhora');
  btn.addEventListener('click', aplicarActualizacion, { once: true });
}

/** Botón "Actualizar ahora": el perro echa a correr y la app se deja limpia y se recarga. */
function aplicarActualizacion() {
  const btn = document.getElementById('btnActualizarAhora');
  const caja = document.querySelector('#actualizacionModalOverlay .actualizacion-modal-box');
  const escena = document.getElementById('actEscena');
  const mensaje = document.getElementById('actualizacionModalMensaje');
  if (btn) { btn.disabled = true; btn.textContent = 'Actualizando…'; }
  if (caja) caja.classList.add('actualizando');
  if (escena) escena.style.setProperty('--vel', '2.4');
  if (mensaje) mensaje.textContent = 'Descargando la nueva versión… no cierres la aplicación.';
  forzarActualizacion_();
}

// Tiempo mínimo que se ve la animación de "Actualizando…" (el perro
// corriendo) antes de recargar: la limpieza de caché suele tardar menos de
// un segundo y, sin esto, la animación apenas se llegaba a ver.
const DURACION_MINIMA_ACTUALIZANDO_MS_ = 3500;

/** Desregistra el service worker, vacía las cachés y refresca la caché HTTP
 *  del navegador para cada archivo propio de la página (si no, el navegador
 *  podría servir el HTML/CSS/JS viejo guardado en su caché normal al
 *  recargar). Después recarga. */
function forzarActualizacion_() {
  const inicio = Date.now();
  let recargado = false;
  const recargar = function () {
    if (recargado) return;
    const restante = DURACION_MINIMA_ACTUALIZANDO_MS_ - (Date.now() - inicio);
    if (restante > 0) { setTimeout(recargar, restante); return; }
    recargado = true;
    // Evita el aviso del navegador "¿Quieres volver a cargar la aplicación?"
    // (lo lanza el beforeunload de sesion.js): esta recarga es intencionada.
    window.RECARGA_POR_ACTUALIZACION_ = true;
    window.location.reload();
  };
  // Salvaguarda: si algo se queda colgado (red lenta...), se recarga igualmente.
  setTimeout(recargar, 8000);

  const desregistrar = ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations)
    ? navigator.serviceWorker.getRegistrations().then(function (registros) {
        return Promise.all(registros.map(function (r) { return r.unregister(); }));
      })
    : Promise.resolve();

  desregistrar
    .then(function () {
      if (!window.caches) return;
      return caches.keys().then(function (claves) {
        return Promise.all(claves.map(function (k) { return caches.delete(k); }));
      });
    })
    .then(function () {
      const urls = Array.prototype.map.call(document.querySelectorAll('link[href], script[src]'), function (el) {
        return el.href || el.src;
      }).filter(function (u) { return u && u.indexOf(location.origin) === 0; });
      urls.push(location.origin + location.pathname);
      return Promise.all(urls.map(function (u) { return fetch(u, { cache: 'reload' }).catch(function () {}); }));
    })
    .catch(function (err) { console.warn('Error limpiando la caché al actualizar:', err); })
    .then(recargar);
}

// Comprobar al volver a la app (tras minimizar, cambiar de pestaña, etc.).
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') comprobarActualizacion_();
});
window.addEventListener('focus', comprobarActualizacion_);

// Arranque: se guarda la versión con la que se ha cargado la app y se
// comprueba periódicamente si ha cambiado en el servidor.
comprobarVersionInicial_();
setInterval(comprobarActualizacion_, VERSION_INTERVALO_MS_);

// Service worker (solo sirve para que la PWA sea instalable y tenga una copia
// de respaldo sin conexión; las actualizaciones NO dependen de él).
if ('serviceWorker' in navigator) {
  // El service worker ya no cambia en cada versión. Si aun así llegara uno
  // nuevo que se quede "en espera" (es decir, mientras otro sigue activo),
  // se activa enseguida: sirve los archivos exactamente igual que el anterior.
  const activarSiEspera_ = function (worker) {
    if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
  };
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('service-worker.js').then(function (registration) {
      activarSiEspera_(registration.waiting);
      registration.addEventListener('updatefound', function () {
        const nuevo = registration.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', function () {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) activarSiEspera_(nuevo);
        });
      });
    }).catch(function (err) {
      console.warn('No se pudo registrar el service worker:', err);
    });
  });
}
