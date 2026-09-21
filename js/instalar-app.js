/* SALIDAS · js/instalar-app.js — Instalación de la PWA (banner y evento beforeinstallprompt) */

/* ---------------- INSTALAR APP (PWA) ---------------- */
// Chrome/Edge/Android disparan "beforeinstallprompt" cuando la PWA cumple
// los requisitos (manifest + service worker + HTTPS); lo capturamos aquí
// para poder lanzar el diálogo nativo de instalación nosotros mismos, al
// pulsar el botón del banner, en vez de esperar al mini-icono que el
// navegador mete en la barra de direcciones (fácil de no ver). iOS Safari
// no dispara este evento (Apple no lo soporta): ahí se muestran
// instrucciones manuales en su lugar ("Compartir" > "Añadir a inicio").
let INSTALL_PROMPT_EVENT = null;

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  INSTALL_PROMPT_EVENT = e;
  actualizarBannerInstalacion();
});

window.addEventListener('appinstalled', function () {
  INSTALL_PROMPT_EVENT = null;
  actualizarBannerInstalacion();
});

/** true si la app YA se está ejecutando instalada/standalone (abierta
 *  desde el icono, sin barra de navegador): cubre Android/Chrome/Edge
 *  (display-mode: standalone) y iOS Safari (navigator.standalone). */
function appYaInstalada_() {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

function esIOS_() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** HTML del banner de "Inicio": vacío/oculto si ya está instalada; botón
 *  de instalación nativo si el navegador soporta beforeinstallprompt;
 *  instrucciones manuales en iOS; nada en el resto (navegadores sin
 *  soporte de instalación detectable, p.ej. Firefox). */
function htmlBannerInstalacion_() {
  if (appYaInstalada_()) return '<div id="instalar-banner" style="display:none;"></div>';

  if (INSTALL_PROMPT_EVENT) {
    return (
      '<div class="instalar-banner" id="instalar-banner">' +
        '<img src="icon-192.png" alt="" class="instalar-banner-icon">' +
        '<div class="instalar-banner-texto">' +
          '<strong>Instala la app en tu dispositivo</strong>' +
          '<span>Acceso directo desde tu pantalla de inicio, a pantalla completa.</span>' +
        '</div>' +
        '<button type="button" class="btn-instalar-app" id="btn-instalar-app">Instalar</button>' +
      '</div>'
    );
  }

  if (esIOS_()) {
    return (
      '<div class="instalar-banner" id="instalar-banner">' +
        '<img src="icon-192.png" alt="" class="instalar-banner-icon">' +
        '<div class="instalar-banner-texto">' +
          '<strong>Instala la app en tu iPhone/iPad</strong>' +
          '<span>Toca <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M12 2v13M8 6l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg> (Compartir) y luego "Añadir a pantalla de inicio".</span>' +
        '</div>' +
      '</div>'
    );
  }

  return '<div id="instalar-banner" style="display:none;"></div>';
}

/** Vuelve a pintar el banner si "Inicio" está visible ahora mismo (p.ej.
 *  cuando "beforeinstallprompt" llega DESPUÉS de haber renderizado ya la
 *  vista). Si "Inicio" no está en pantalla, no hace nada. */
function actualizarBannerInstalacion() {
  const cont = document.getElementById('instalar-banner');
  if (!cont) return;
  cont.outerHTML = htmlBannerInstalacion_();
  vincularBotonInstalar_();
}

function vincularBotonInstalar_() {
  const btn = document.getElementById('btn-instalar-app');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (!INSTALL_PROMPT_EVENT) return;
    INSTALL_PROMPT_EVENT.prompt();
    INSTALL_PROMPT_EVENT.userChoice.finally(function () {
      INSTALL_PROMPT_EVENT = null;
      actualizarBannerInstalacion();
    });
  });
}
