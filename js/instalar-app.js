/* SALIDAS · js/instalar-app.js — Instalación obligatoria de la PWA (modal igual que en GIDT) */

// ---------------------------------------------------------------
// Modal obligatorio: exige tener SALIDAS instalada como app (PWA) antes
// de poder usarla, tanto en ordenador (Chrome/Edge) como en móvil.
// No se puede cerrar haciendo click fuera ni con Escape: el HTML lo
// muestra por defecto (class "show") y este script solo lo oculta si
// detecta que la app ya se está ejecutando instalada.
// ---------------------------------------------------------------
(function () {
  const overlay          = document.getElementById('instalarAppModalOverlay');
  const btnInstalar      = document.getElementById('btnInstalarApp');
  const btnInstalarTexto = document.getElementById('btnInstalarAppTexto');
  const btnYaInstalada   = document.getElementById('btnYaInstalada');
  const textoAyuda       = document.getElementById('instalarAppAyuda');

  if (!overlay || !btnInstalar || !btnYaInstalada) return;

  // Chrome/Edge (escritorio o Android) disparan este evento cuando la app
  // cumple los requisitos para instalarse (manifest + service worker +
  // HTTPS). Se guarda para lanzarlo al pulsar el botón (solo se puede
  // lanzar una vez y a partir de un click del usuario).
  let promptDiferido = null;

  function estaInstalada() {
    // Chrome/Edge/Android: la ventana se abrió en modo standalone
    // (icono propio, sin barra de navegador).
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    // Alguna variante de Windows (WebView2 / Edge) usa "window-controls-overlay".
    if (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    // Safari en iOS/iPadOS no dispara beforeinstallprompt ni el
    // display-mode anterior; expone esta propiedad en su lugar.
    if (window.navigator.standalone === true) return true;
    return false;
  }

  function ocultarModal() { overlay.classList.remove('show'); }
  function mostrarModal() { overlay.classList.add('show'); }

  function comprobarEstado() {
    if (estaInstalada()) ocultarModal();
    else mostrarModal();
  }

  window.addEventListener('beforeinstallprompt', function (evento) {
    evento.preventDefault();
    promptDiferido = evento;
    if (textoAyuda) textoAyuda.style.display = 'none';
  });

  // Se dispara en cuanto el usuario completa la instalación (desde
  // nuestro botón o desde el icono nativo del navegador).
  window.addEventListener('appinstalled', function () {
    promptDiferido = null;
    ocultarModal();
  });

  btnInstalar.addEventListener('click', async function () {
    if (promptDiferido) {
      btnInstalar.disabled = true;
      if (btnInstalarTexto) btnInstalarTexto.textContent = 'Instalando…';
      try {
        promptDiferido.prompt();
        await promptDiferido.userChoice;
      } catch (err) {
        console.error('Error al lanzar la instalación:', err);
      }
      promptDiferido = null;
      btnInstalar.disabled = false;
      if (btnInstalarTexto) btnInstalarTexto.textContent = '⬇️ Instalar App';
      // Si se instaló, "appinstalled" ya habrá cerrado el modal; por si el
      // navegador no lo dispara a tiempo, se comprueba también aquí.
      comprobarEstado();
    } else {
      // El navegador no ha ofrecido el evento nativo: no es compatible
      // (Safari, Firefox) o ya se descartó antes en esta sesión. Se
      // muestran instrucciones manuales.
      if (textoAyuda) textoAyuda.style.display = 'block';
    }
  });

  btnYaInstalada.addEventListener('click', function () {
    // Evita el aviso "¿Quieres volver a cargar?" del beforeunload de sesion.js.
    window.RECARGA_POR_ACTUALIZACION_ = true;
    location.reload();
  });

  // Comprobación inicial y cada vez que la pestaña vuelve a primer plano
  // (por si se instaló desde otra pestaña u otro navegador).
  comprobarEstado();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') comprobarEstado();
  });
  window.addEventListener('focus', comprobarEstado);
})();

// El antiguo banner de "Inicio" queda sustituido por el modal obligatorio.
// Se mantienen estas dos funciones vacías porque js/navegacion.js las llama
// al pintar la vista de Inicio.
function htmlBannerInstalacion_() { return ''; }
function vincularBotonInstalar_() {}
