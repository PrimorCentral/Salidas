/* SALIDAS · js/carga-global.js — Ventana "Cargando…" global (igual que la de GIDT) */

// ---------------------------------------------------------------
// Ventana de carga global: tarjeta "Cargando…" centrada, con el fondo
// difuminado, mientras se cargan datos (conteo, calendario, rutas y
// tiendas, bloqueos y cambios, hoja de notas, usuarios, registro...).
// Es la misma que la de GIDT.
//
// - Usa un contador en vez de un simple show/hide para que, si hay dos
//   cargas solapadas, no desaparezca hasta que terminen todas.
// - Solo aparece si la carga tarda más de un momento (CARGA_RETARDO_MS),
//   para que las cargas rápidas no hagan parpadear la pantalla.
// - Si pasan CARGA_LENTA_MS y sigue cargando, añade "Está tardando más de
//   lo normal" y el botón "Cancelar consulta", que corta las consultas a
//   Supabase en marcha (ver fetchCancelable, usado en supabase-client.js)
//   y cierra la ventana dejando la pantalla como estaba.
//
// Se enciende sola:
// - Mientras haya en pantalla un "Cargando…" de los de siempre (.loader,
//   .cargando-linea, el de la ventana de Añadir observación...). Esos
//   "Cargando…" siguen en su sitio para guardar el hueco, pero no se ven:
//   en su lugar sale esta ventana (ver vigía más abajo).
// - En las consultas que se lanzan al pulsar algo y no tenían "Cargando…"
//   propio (ver ACCIONES_CON_CARGA_GLOBAL_ en llamarApi_, sesion.js).
// Las consultas que se repiten solas de fondo (refresco del conteo,
// avisos de verificación...) NO la encienden.
// ---------------------------------------------------------------
const CARGA_RETARDO_MS = 250;
const CARGA_LENTA_MS = 10000;

let cargaGlobalContador = 0;
let cargaGlobalTimerMostrar = null;
let cargaGlobalTimerLenta = null;

// Momento en que se canceló la última consulta: durante unos segundos se
// ignoran los avisos de error que lleguen por esa cancelación (ver
// mostrarErrorServidor y mostrarErrorFijo en ui-modal.js).
let consultaCanceladaEn = 0;
function consultaRecienCancelada() {
  return Date.now() - consultaCanceladaEn < 5000;
}

// Controlador con el que se cortan todas las consultas en marcha al pulsar
// "Cancelar consulta". Se renueva tras cada cancelación, así las consultas
// nuevas no nacen ya canceladas.
let cargaAbortController = new AbortController();

// fetch que usa el cliente de Supabase: igual que el normal, pero se corta
// si se pulsa "Cancelar consulta" mientras está en marcha.
function fetchCancelable(url, opciones) {
  opciones = opciones || {};
  const senalCancelar = cargaAbortController.signal;
  let signal = senalCancelar;
  if (opciones.signal) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([opciones.signal, senalCancelar]);
    } else {
      // Navegadores sin AbortSignal.any: se encadenan a mano.
      const ctrl = new AbortController();
      const cortar = function () { ctrl.abort(); };
      if (opciones.signal.aborted || senalCancelar.aborted) ctrl.abort();
      opciones.signal.addEventListener('abort', cortar, { once: true });
      senalCancelar.addEventListener('abort', cortar, { once: true });
      signal = ctrl.signal;
    }
  }
  return fetch(url, Object.assign({}, opciones, { signal: signal }));
}

function cargaGlobalElementos() {
  return {
    overlay: document.getElementById('cargaGlobalOverlay'),
    box: document.getElementById('cargaGlobalBox')
  };
}

function cargaGlobalPintar() {
  const el = cargaGlobalElementos();
  if (!el.overlay) return;
  if (el.box) el.box.classList.remove('lento');
  el.overlay.classList.add('show');
  clearTimeout(cargaGlobalTimerLenta);
  cargaGlobalTimerLenta = setTimeout(function () {
    if (cargaGlobalContador > 0 && el.box) el.box.classList.add('lento');
  }, CARGA_LENTA_MS - CARGA_RETARDO_MS);
}

function cargaGlobalQuitar() {
  clearTimeout(cargaGlobalTimerMostrar);
  clearTimeout(cargaGlobalTimerLenta);
  cargaGlobalTimerMostrar = null;
  cargaGlobalTimerLenta = null;
  const el = cargaGlobalElementos();
  if (el.overlay) el.overlay.classList.remove('show');
  if (el.box) el.box.classList.remove('lento');
}

function mostrarCargandoGlobal() {
  cargaGlobalContador++;
  if (cargaGlobalContador === 1 && !cargaGlobalTimerMostrar) {
    cargaGlobalTimerMostrar = setTimeout(function () {
      cargaGlobalTimerMostrar = null;
      if (cargaGlobalContador > 0) cargaGlobalPintar();
    }, CARGA_RETARDO_MS);
  }
}

function ocultarCargandoGlobal() {
  cargaGlobalContador = Math.max(0, cargaGlobalContador - 1);
  if (cargaGlobalContador === 0) cargaGlobalQuitar();
}

// Envuelve una carga (función que devuelve una promesa, o la promesa en sí)
// con la ventana de carga.
function conCargaGlobal(carga) {
  mostrarCargandoGlobal();
  return Promise.resolve()
    .then(function () { return typeof carga === 'function' ? carga() : carga; })
    .then(function (r) { ocultarCargandoGlobal(); return r; },
          function (e) { ocultarCargandoGlobal(); throw e; });
}

// "Cancelar consulta": corta lo que esté en marcha, cierra la ventana y
// avisa con un toast. Los errores que provoque el corte no se muestran.
function cancelarConsultaGlobal() {
  consultaCanceladaEn = Date.now();
  const anterior = cargaAbortController;
  cargaAbortController = new AbortController();
  anterior.abort();
  // Los "Cargando…" que haya ahora en pantalla ya no vuelven a encender la
  // ventana (la consulta que esperaban se ha cortado).
  elementosCargaVisibles_().forEach(function (el) { CARGAS_DESCARTADAS_.add(el); });
  vigiaCargaActiva_ = false;
  cargaGlobalContador = 0;
  cargaGlobalQuitar();
  if (typeof mostrarToast === 'function') mostrarToast('✕ Consulta cancelada');
}

// ---------------------------------------------------------------
// Vigía: mientras haya en pantalla algún "Cargando…" de los de siempre,
// la ventana global cuenta como una carga más.
// ---------------------------------------------------------------
const SELECTOR_CARGAS_ = '.loader, .cargando-linea, .gestor-loading-overlay.visible';
const CARGAS_DESCARTADAS_ = new WeakSet();
let vigiaCargaActiva_ = false;
let vigiaCargaPendiente_ = false;

function elementosCargaVisibles_() {
  return Array.prototype.filter.call(document.querySelectorAll(SELECTOR_CARGAS_), function (el) {
    // Oculto (pestaña o pantalla que no se ve): no cuenta.
    return el.isConnected && el.getClientRects().length > 0;
  });
}

function revisarVigiaCarga_() {
  vigiaCargaPendiente_ = false;
  const hay = elementosCargaVisibles_().some(function (el) { return !CARGAS_DESCARTADAS_.has(el); });
  if (hay && !vigiaCargaActiva_) {
    vigiaCargaActiva_ = true;
    mostrarCargandoGlobal();
  } else if (!hay && vigiaCargaActiva_) {
    vigiaCargaActiva_ = false;
    ocultarCargandoGlobal();
  }
}

function programarVigiaCarga_() {
  if (vigiaCargaPendiente_) return;
  vigiaCargaPendiente_ = true;
  (window.requestAnimationFrame || setTimeout)(revisarVigiaCarga_);
}

(function arrancarCargaGlobal_() {
  function enganchar() {
    const btn = document.getElementById('btnCancelarConsulta');
    if (btn) btn.addEventListener('click', cancelarConsultaGlobal);
    new MutationObserver(programarVigiaCarga_).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden']
    });
    programarVigiaCarga_();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enganchar);
  else enganchar();
})();
