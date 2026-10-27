/* SALIDAS · js/conteos-panel.js — Conteos diarios: agrupación (crearSeccionPanel) y autoguardado */

/* ---------------- SECCIÓN / AGRUPACIÓN ---------------- */

/**
 * Separa el nombre de la agrupación tal como viene de la hoja
 * (ej. "TXT NORTE (PTA 11:00)") en:
 *   titulo:    "TXT NORTE"
 *   ubicacion: "PTA 11:00"  (lo que va entre paréntesis, o null si no hay)
 */
function parsearNombreAgrupacion(nombre) {
  const m = String(nombre).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { titulo: m[1].trim(), ubicacion: m[2].trim() };
  return { titulo: String(nombre).trim(), ubicacion: null };
}

/**
 * Muestra el indicador de sincronización durante el autoguardado.
 * Filosofía: silencio cuando todo va bien, solo se ve algo mientras se
 * está guardando (y desaparece solo, sin más aviso).
 *
 * Vive en un único sitio (la barra superior, junto a "Administrador"), no
 * repetido en cada cabecera de agrupación. Como puede haber varias
 * agrupaciones guardando a la vez (el autoguardado de cada una es
 * independiente), se lleva la cuenta con SYNC_GUARDANDO_CONTADOR_: el
 * indicador se mantiene visible mientras el contador sea > 0, y solo se
 * apaga cuando la última agrupación en vuelo termina de guardar.
 */
let SYNC_GUARDANDO_CONTADOR_ = 0;
function marcarGuardando(panel, activo) {
  const ind = document.getElementById('sync-indicator-global');
  if (!ind) return;
  SYNC_GUARDANDO_CONTADOR_ = Math.max(0, SYNC_GUARDANDO_CONTADOR_ + (activo ? 1 : -1));
  if (SYNC_GUARDANDO_CONTADOR_ > 0) {
    ind.classList.add('mostrando');
    ind.innerHTML = '<span class="sync-spinner"></span><span>Guardando…</span>';
  } else {
    ind.classList.remove('mostrando');
    ind.innerHTML = '';
  }
}

/**
 * Texto "hace X" para el aviso de último guardado junto al botón
 * "Guardar conteo" de cada agrupación. Cada agrupación registra aquí su
 * propia función de refresco (ver REFRESCADORES_ULTIMO_GUARDADO_) y un
 * único intervalo global las va llamando a todas cada 20s, para no tener
 * un setInterval por cada agrupación abierta en pantalla.
 */
function formatearTiempoRelativo_(fecha) {
  const segundos = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 1000));
  if (segundos < 10) return 'justo ahora';
  if (segundos < 60) return 'hace ' + segundos + ' s';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return 'hace ' + minutos + ' min';
  const horas = Math.round(minutos / 60);
  if (horas < 24) return 'hace ' + horas + ' h';
  return 'hace ' + Math.round(horas / 24) + ' d';
}
let REFRESCADORES_ULTIMO_GUARDADO_ = [];
setInterval(function () {
  // Al re-renderizar (cambio de fecha, recarga de sección…) las agrupaciones
  // viejas se sustituyen en el DOM, pero sus funciones seguirían aquí
  // apuntando a nodos ya desconectados: se limpian solas de paso para que
  // la lista no crezca sin límite en una sesión larga.
  REFRESCADORES_ULTIMO_GUARDADO_ = REFRESCADORES_ULTIMO_GUARDADO_.filter(function (fn) {
    return fn(); // cada función devuelve false si su nodo ya no está en el DOM
  });
}, 20000);

/* ---------------- SOBRE (envíos) + CANDADO (carga ajustada) ---------------- */

const SVG_SOBRE_ = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const SVG_CANDADO_CARGA_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const SVG_MENU_PREVISION_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';
const SVG_MENU_DEFINITIVO_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>';
const SVG_MENU_INFORMATICA_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>';
const SVG_MENU_CAMION_ = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3h15v13H3z"/><path d="M18 8h3l3 3v5h-6"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>';
const SVG_DESCARGA_ = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
// Hojita de color con el tipo (PDF / XLS / PDF+) para el menú de descargas.
function SVG_DOC_(color, texto, tam) {
  return '<svg width="16" height="18" viewBox="0 0 24 26" aria-hidden="true">' +
    '<path d="M4 2h11l6 6v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="' + color + '"/>' +
    '<path d="M15 2v6h6" fill="#ffffff" opacity="0.32"/>' +
    '<text x="12" y="19" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="' + tam + '" font-weight="800" fill="#ffffff">' + texto + '</text></svg>';
}
const SVG_OJO_ = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';

// Pestaña elegida en cada agrupación con carga ajustada ("fecha|agrupación"
// -> true si se está viendo el conteo REAL). Vive aquí fuera para que el
// autorefresco, que rehace los paneles, no devuelva a nadie a la otra
// pestaña mientras mira una. Por defecto se ve la carga ajustada.
const VISTA_CONTEO_REAL_ = {};

// Menú del sobre abierto ahora mismo (solo uno a la vez). Mientras está
// abierto se saca a <body> con posición fija, para que no lo recorte el
// borde del panel (que tiene overflow:hidden); al cerrarlo vuelve a su
// sitio en la cabecera, así el resto del código lo sigue encontrando ahí.
let MENU_ENVIOS_ABIERTO_ = null; // { btn, menu, wrap }
function cerrarMenuEnvios_() {
  const m = MENU_ENVIOS_ABIERTO_;
  if (!m) return;
  MENU_ENVIOS_ABIERTO_ = null;
  m.menu.hidden = true;
  m.menu.classList.remove('abierto');
  m.menu.style.top = m.menu.style.left = '';
  m.btn.classList.remove('activo');
  m.btn.setAttribute('aria-expanded', 'false');
  if (m.wrap.isConnected) m.wrap.appendChild(m.menu);
  else m.menu.remove();
}
function abrirMenuEnvios_(btn, menu, wrap) {
  cerrarMenuEnvios_();
  document.body.appendChild(menu);
  menu.hidden = false;
  menu.classList.add('abierto');
  btn.classList.add('activo');
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  const w = menu.offsetWidth, h = menu.offsetHeight;
  const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  const top = (r.bottom + 6 + h > window.innerHeight && r.top - 6 - h > 0) ? r.top - 6 - h : r.bottom + 6;
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
  MENU_ENVIOS_ABIERTO_ = { btn: btn, menu: menu, wrap: wrap };
}
document.addEventListener('click', function (e) {
  const m = MENU_ENVIOS_ABIERTO_;
  if (m && !m.menu.contains(e.target) && !m.btn.contains(e.target)) cerrarMenuEnvios_();
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenuEnvios_(); });
window.addEventListener('resize', cerrarMenuEnvios_);
window.addEventListener('scroll', function (e) {
  const m = MENU_ENVIOS_ABIERTO_;
  if (m && !(e.target && e.target.nodeType === 1 && m.menu.contains(e.target))) cerrarMenuEnvios_();
}, true);

function htmlBotonDeshacerEnvio_() {
  return '<button type="button" class="btn-deshacer-envio" title="Deshacer envío (solo se puede el mismo día)">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
    '<path d="M10 11v6"></path><path d="M14 11v6"></path>' +
    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
    '</svg></button>';
}

function crearSeccionPanel(seccion, dia, fecha, esHoy) {
  // El backend calcula seccion.editable teniendo en cuenta la fecha (solo
  // lectura si han pasado más de 2 días) y si ya se envió a la agencia
  // (una vez enviado, ya no se puede modificar). Si por lo que sea no
  // viniera ese campo, se asume editable (compatibilidad hacia atrás).
  let editable = seccion.editable !== false && seccion.estado !== 'enviado';

  const panel = document.createElement('div');
  panel.className = 'seccion-panel estado-' + seccion.estado + (editable ? '' : ' no-editable');
  panel.setAttribute('data-seccion-key', seccion.nombre);
  if (ESTADO.colapsadas.has(seccion.nombre)) panel.classList.add('colapsada');

  const partes = parsearNombreAgrupacion(seccion.nombre);
  const iniciales = partes.titulo.replace(/[^A-ZÁÉÍÓÚÑ ]/gi, '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '·';

  const badgeUbicacion = partes.ubicacion
    ? '<span class="badge-ubicacion">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
      escapeHtml(partes.ubicacion) + '</span>'
    : '';

  // Botones de envío: ya no van sueltos en la cabecera, sino dentro del
  // menú del sobre (al lado del camioncito). Son los MISMOS botones de
  // siempre (misma clase, mismos permisos, mismo flujo), solo cambia dónde
  // se ven.
  const htmlBotonesEnvio_ =
    (editable && seccion.estado !== 'enviado' && !seccion.previsionEnviada
      ? '<button type="button" class="btn-header-prevision" title="Enviar previsión por email (no bloquea el conteo, se puede volver a enviar)">' + SVG_MENU_PREVISION_ + '<span>Enviar previsión</span></button>'
      : '') +
    (editable && seccion.estado !== 'enviado'
      ? '<button type="button" class="btn-header-definitivo" title="Enviar definitivo por email (bloquea el conteo, lo archiva y vacía las casillas)">' + SVG_MENU_DEFINITIVO_ + '<span>Enviar definitivo</span></button>'
      : '') +
    // "Enviar a informática" es un aviso interno: sigue disponible aunque
    // ya se haya enviado el Definitivo (solo depende de la fecha, que el
    // backend manda en seccion.puedeInformatica).
    ((seccion.puedeInformatica !== undefined ? seccion.puedeInformatica : seccion.editable) !== false
      ? '<button type="button" class="btn-header-informatica" title="Enviar la previsión de carga solo a transporte@primor.eu (no bloquea el conteo, se puede volver a enviar)">' + SVG_MENU_INFORMATICA_ + '<span>Enviar a informática</span></button>'
      : '');
  // El sobre también enseña lo que ya se ha enviado (previsión en azul,
  // definitivo en verde, con una marca ✓ y el detalle arriba del menú),
  // así que se pinta aunque ya no quede ningún envío por hacer.
  const htmlMenuEnvios_ = (htmlBotonesEnvio_ || seccion.previsionEnviada || seccion.estado === 'enviado')
    ? '<span class="envios-wrap">' +
        '<button type="button" class="btn-menu-envios btn-menu-email" title="Enviar por email" aria-label="Enviar por email" aria-haspopup="true" aria-expanded="false">' + SVG_SOBRE_ + '<span class="sobre-marca" hidden>✓</span></button>' +
        '<div class="menu-envios" role="menu" hidden>' +
          '<div class="menu-envios-estado" hidden></div>' +
          htmlBotonesEnvio_ +
          '<div class="menu-envios-aviso" hidden>Guardando el conteo…</div>' +
        '</div>' +
      '</span>'
    : '';

  // Botón de descarga (al lado del sobre): menú con PDF, Excel y, en las
  // rutas que lo tienen, PDF especial. Son los mismos botones de antes.
  const htmlMenuDescargas_ =
    '<span class="envios-wrap descargas-wrap">' +
      '<button type="button" class="btn-menu-envios btn-menu-descargas" title="Descargar PDF o Excel" aria-label="Descargar PDF o Excel" aria-haspopup="true" aria-expanded="false">' + SVG_DESCARGA_ + '</button>' +
      '<div class="menu-envios menu-descargas" role="menu" hidden>' +
        '<button type="button" class="btn-pdf-seccion menu-item" title="Generar PDF de esta agrupación">' + SVG_DOC_('#e0342a', 'PDF', 7.5) + '<span>PDF</span></button>' +
        '<button type="button" class="btn-excel-seccion menu-item" title="Exportar a Excel esta agrupación">' + SVG_DOC_('#1d6f42', 'XLS', 7.5) + '<span>Excel</span></button>' +
        (seccion.tienePdfEspecial
          ? '<button type="button" class="btn-pdf-especial-seccion menu-item" title="Generar el PDF Control responsables (reparto en camión) de esta agrupación">' + SVG_DOC_('var(--prevision)', 'PDF+', 6) + '<span>PDF Control responsables</span></button>'
          : '') +
      '</div>' +
    '</span>';

  const header = document.createElement('div');
  header.className = 'seccion-header';
  header.innerHTML =
    '<div class="seccion-header-top">' +
    '<div class="icono-agrup">' + iniciales + '</div>' +
    // Cabecera en dos columnas, igual en todas las agrupaciones (sea el
    // nombre largo o corto):
    //   NOMBRE              | ubicación · tiendas · estado
    //   chips de verificado | pestañas Carga ajustada / Ver conteo real
    '<div class="info"><div class="name-row">' +
    '<span class="name">' + escapeHtml(partes.titulo) + '</span>' +
    '<div class="name-row-datos">' + badgeUbicacion +
    '<span class="count">' + seccion.tiendas.filter(function (t) { return !t.salePorExcepcion; }).length + ' tienda(s)</span>' +
    badgeEstadoCabecera_(seccion) +
    '</div>' +
    '<span class="verif-pastillas"></span>' +
    '<div class="vista-carga-tabs" role="tablist" hidden>' +
      '<button type="button" class="vista-carga-tab" data-vista="ajustada" role="tab">' + SVG_MENU_CAMION_ + '<span class="vista-carga-etiqueta">Carga ajustada</span><span class="vista-carga-num"></span></button>' +
      '<button type="button" class="vista-carga-tab" data-vista="real" role="tab">' + SVG_OJO_ + '<span>Ver conteo real sin ajustar</span><span class="vista-carga-num"></span></button>' +
    '</div>' +
    '<span class="aviso-carga-no-ajustada" hidden title="Las naves están verificadas, pero un responsable todavía no ha ajustado la carga del camión">' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
      'CARGA NO AJUSTADA POR UN RESPONSABLE</span>' +
    '</div></div>' +
    // Botones de la derecha en un bloque de ancho mínimo fijo: así la
    // columna de ubicación / pestañas queda a la misma altura en todas las
    // agrupaciones, tengan más o menos botones.
    '<div class="seccion-header-controles">' +
    (seccion.tieneViernes ? '<span class="badge-total-viernes" title="Palets de VIERNES: suman al TOTAL de cada tienda, pero no al total de palets de la carga">Viernes:&nbsp;<span class="total-viernes-valor">0</span></span>' : '') +
    (seccion.tieneCasillaDomingo ? '<span class="badge-total-domingo" title="Palets de DOMINGO: suman al TOTAL de cada tienda, pero no al total de palets de la carga">Domingo:&nbsp;<span class="total-domingo-valor">0</span></span>' : '') +
    '<span class="badge-total-palets"><span class="total-palets-valor">0</span>&nbsp;palets</span>' +
    htmlBotonListaCarga_(seccion) +
    htmlMenuEnvios_ +
    htmlMenuDescargas_ +
    // VERIFICAR CONTEO (icono de check): administradores (eligen la nave
    // en un modal) y operarios con nave (solo la suya).
    (editable && seccion.estado !== 'enviado' && (esAdmin() || restringidoANave_())
      ? '<span class="verif-wrap"></span>'
      : '') +
    '<button type="button" class="btn-candado-carga" hidden aria-label="Conteo bloqueado">' + SVG_CANDADO_CARGA_ + '</button>' +
    '</div>' +
    '<button type="button" class="btn-toggle-colapsar" title="Contraer / expandir">' +
    '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
    '</div>' +
    '<div class="seccion-header-meta">' +
    '<div class="seccion-header-badges">' +
    // "Previsión enviada" ya no va aquí: se ve en el sobre (ver pintarEstadoSobre_).
    // La papelera "Deshacer envío" ya no se muestra tras el definitivo.
    (!editable && seccion.estado !== 'enviado' ? '<span class="badge badge-solo-lectura">Solo lectura</span>' : '') +
    '</div>' +
    '</div>';
  panel.appendChild(header);

  header.addEventListener('click', function (e) {
    if (!e.target.closest('.btn-toggle-colapsar')) return;
    panel.classList.toggle('colapsada');
    if (panel.classList.contains('colapsada')) ESTADO.colapsadas.add(seccion.nombre);
    else ESTADO.colapsadas.delete(seccion.nombre);
  });

  // Camioncito junto a los palets. Con el servidor nuevo (seccion.carga
  // definida) abre la carga del camión: para ajustarla/verificarla si se
  // tiene el permiso "Ajustar carga", o para verla en solo lectura. Con el
  // servidor antiguo (seccion.carga sin definir), como antes: la lista
  // guardada con el último envío (ver htmlBotonListaCarga_ / mostrarModalListaCarga).
  function bindBotonListaCarga_() {
    const btn = header.querySelector('.btn-lista-carga');
    if (!btn) return;
    btn.onclick = function (e) {
      e.stopPropagation();
      if (seccion.carga !== undefined) { abrirCarga_(); return; }
      btn.disabled = true;
      google.script.run
        .withSuccessHandler(function (info) {
          btn.disabled = false;
          if (!info) { mostrarToast('Todavía no hay ningún envío para esta agrupación', true); return; }
          mostrarModalListaCarga(info, parsearNombreAgrupacion(seccion.nombre).titulo, formatearFechaLarga(fecha));
        })
        .withFailureHandler(function (err) {
          btn.disabled = false;
          mostrarErrorServidor(err);
        })
        .getListaCarga(dia, seccion.nombre, fecha);
    };
  }
  // El camioncito cambia de color sin recargar la página: tras un envío,
  // tras guardar la carga, o al cambiar el conteo de una tienda ajustada.
  let claseBotonCarga_ = null;
  function actualizarBotonListaCarga_(revisar) {
    if (revisar === undefined) revisar = Object.keys(tiendasARevisar_()).length > 0;
    const wrapTmp = document.createElement('div');
    wrapTmp.innerHTML = htmlBotonListaCarga_(seccion, revisar);
    const nuevo = wrapTmp.firstElementChild;
    const viejo = header.querySelector('.btn-lista-carga');
    const claseNueva = nuevo ? nuevo.className : '';
    if (viejo && claseNueva === claseBotonCarga_) return; // ya está como debe: no tocar el DOM
    claseBotonCarga_ = claseNueva;
    if (viejo) viejo.remove();
    const badge = header.querySelector('.badge-total-palets');
    if (nuevo && badge) badge.insertAdjacentElement('afterend', nuevo);
    bindBotonListaCarga_();
  }
  bindBotonListaCarga_();

  // Sobre: abre/cierra el menú con los tres envíos. Al pulsar una opción
  // el menú se cierra ANTES (fase de captura) de que el botón haga lo suyo,
  // así vuelve a su sitio en la cabecera.
  const btnMenuEnvios = header.querySelector('.btn-menu-envios');
  const menuEnvios = header.querySelector('.menu-envios');
  const enviosWrap = header.querySelector('.envios-wrap');
  if (btnMenuEnvios && menuEnvios) {
    btnMenuEnvios.onclick = function (e) {
      e.stopPropagation();
      if (MENU_ENVIOS_ABIERTO_ && MENU_ENVIOS_ABIERTO_.menu === menuEnvios) cerrarMenuEnvios_();
      else abrirMenuEnvios_(btnMenuEnvios, menuEnvios, enviosWrap);
    };
    menuEnvios.addEventListener('click', function (e) {
      if (e.target.closest('button')) cerrarMenuEnvios_();
    }, true);
  }
  const btnMenuDescargas = header.querySelector('.btn-menu-descargas');
  const menuDescargas = header.querySelector('.menu-descargas');
  const descargasWrap = header.querySelector('.descargas-wrap');
  if (btnMenuDescargas && menuDescargas) {
    btnMenuDescargas.onclick = function (e) {
      e.stopPropagation();
      if (MENU_ENVIOS_ABIERTO_ && MENU_ENVIOS_ABIERTO_.menu === menuDescargas) cerrarMenuEnvios_();
      else abrirMenuEnvios_(btnMenuDescargas, menuDescargas, descargasWrap);
    };
    menuDescargas.addEventListener('click', function (e) {
      if (e.target.closest('button')) cerrarMenuEnvios_();
    }, true);
  }
  // Candado (bloqueo por carga ajustada).
  const btnCandado = header.querySelector('.btn-candado-carga');
  if (btnCandado) btnCandado.onclick = function (e) { e.stopPropagation(); pulsarCandado_(); };
  // Pestañas "Carga ajustada" / "Ver conteo real sin ajustar".
  header.querySelectorAll('.vista-carga-tab').forEach(function (t) {
    t.onclick = function (e) {
      e.stopPropagation();
      const clave = fecha + '|' + seccion.nombre;
      VISTA_CONTEO_REAL_[clave] = t.getAttribute('data-vista') === 'real';
      pintarEstadoBloqueo_();
    };
  });

  /* ---------------- CARGA DEL CAMIÓN ----------------
   * seccion.carga = { origen: 'ajuste'|'prevision'|'definitivo', hora, por,
   *   lista: [{tienda, contados, cargar, cerrada}] } o null.
   * "contados" es el TOTAL que tenía la tienda cuando se fijó la carga.
   * Una tienda está "ajustada" si se fijó con cargar ≠ contados; si después
   * cambia su conteo, la carga NO se recalcula: queda "a revisar" hasta que
   * alguien con permiso "Ajustar carga" la verifique. Las tiendas no
   * ajustadas cargan siempre lo contado. */
  function puedeAjustarCarga_() {
    return editable && seccion.estado !== 'enviado' && tienePermiso('ajustar_carga');
  }
  // Tiendas de la tabla con lo contado AHORA (TOTAL en pantalla), su límite
  // y VIERNES + DOMINGO (cuentan para el límite, no van en la carga).
  function filasCargaActuales_() {
    const filas = [];
    tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
      if (tr.classList.contains('fila-grupo-header') || tr.classList.contains('fila-sale-excepcion')) return;
      const nombre = tr.getAttribute('data-nombre') || '';
      if (!nombre) return;
      if (tr.classList.contains('fila-cerrada')) { filas.push({ nombre: nombre, cerrada: true }); return; }
      const totalInput = tr.querySelector('input[data-campo="total"]');
      const valor = totalInput ? parseFloat(totalInput.value) : NaN;
      const viernesInput = tr.querySelector('input[data-campo="viernes"]');
      const domingoInput = tr.querySelector('input[data-campo="casillaDomingo"]');
      const vie = viernesInput && viernesInput.value !== '' ? (parseFloat(viernesInput.value) || 0) : 0;
      const dom = domingoInput && domingoInput.value !== '' ? (parseFloat(domingoInput.value) || 0) : 0;
      filas.push({
        nombre: nombre,
        contados: isNaN(valor) ? 0 : valor,
        limite: parseFloat(tr.getAttribute('data-limite')),
        otros: vie + dom
      });
    });
    return filas;
  }
  function cargaEditable_() {
    const c = seccion.carga;
    return !!(c && c.origen !== 'definitivo' && seccion.estado !== 'enviado' && Array.isArray(c.lista));
  }
  // { 'NOMBRE TIENDA': true } de las tiendas repartidas entre varios camiones
  // («Dividir…»). Su carga queda fijada como si se hubiera ajustado a mano:
  // si cambia su conteo, hay que revisar el reparto.
  function tiendasDivididas_() {
    const res = {};
    const c = seccion.carga;
    if (!c || !Array.isArray(c.camiones) || c.camiones.length < 2) return res;
    c.camiones.forEach(function (cam) {
      if (cam && cam.parciales) Object.keys(cam.parciales).forEach(function (t) { res[t] = true; });
    });
    return res;
  }
  // { 'NOMBRE TIENDA': palets } de las tiendas ajustadas a mano (o divididas) que siguen en la tabla.
  function ajustesGuardados_() {
    const res = {};
    if (!cargaEditable_()) return res;
    const abiertas = {};
    const divididas = tiendasDivididas_();
    filasCargaActuales_().forEach(function (f) { if (!f.cerrada) abiertas[f.nombre] = true; });
    seccion.carga.lista.forEach(function (t) {
      if (t.cerrada || t.cargar === null || t.cargar === undefined || !abiertas[t.tienda]) return;
      if (Number(t.cargar) !== Number(t.contados) || divididas[t.tienda]) res[t.tienda] = Number(t.cargar);
    });
    return res;
  }
  // { 'NOMBRE TIENDA': {antes, ahora} } de las tiendas ajustadas cuyo conteo ha cambiado.
  function tiendasARevisar_() {
    const res = {};
    if (!cargaEditable_()) return res;
    const guardadas = {};
    const divididas = tiendasDivididas_();
    seccion.carga.lista.forEach(function (t) { guardadas[t.tienda] = t; });
    filasCargaActuales_().forEach(function (f) {
      const g = guardadas[f.nombre];
      if (f.cerrada || !g || g.cerrada) return;
      const antes = Number(g.contados) || 0;
      if ((Number(g.cargar) !== antes || divididas[f.nombre]) && f.contados !== antes) res[f.nombre] = { antes: antes, ahora: f.contados };
    });
    return res;
  }
  // Carga que saldría ahora en el email: la ajustada donde la hay, lo contado en el resto.
  function listaCargaEfectiva_() {
    const ajustes = ajustesGuardados_();
    return filasCargaActuales_().map(function (f) {
      if (f.cerrada) return { tienda: f.nombre, cerrada: true };
      return { tienda: f.nombre, contados: f.contados, cargar: Object.prototype.hasOwnProperty.call(ajustes, f.nombre) ? ajustes[f.nombre] : f.contados, cerrada: false };
    });
  }
  // Camioncito + pastilla "Carga a revisar" de la cabecera.
  function actualizarEstadoCarga_() {
    if (seccion.carga === undefined) return;
    const revisar = Object.keys(tiendasARevisar_()).length > 0;
    actualizarBotonListaCarga_(revisar);
    const fila = header.querySelector('.name-row-datos');
    let badge = header.querySelector('.badge-carga-revisar');
    if (revisar && !badge && fila) {
      badge = document.createElement('span');
      badge.className = 'badge badge-carga-revisar';
      badge.title = 'El conteo ha cambiado después de ajustar la carga';
      badge.innerHTML = '<span class="badge-dot"></span>Carga a revisar';
      fila.appendChild(badge);
    } else if (!revisar && badge) {
      badge.remove();
    }
    pintarEstadoBloqueo_();
  }

  // Línea de badges de previsión / solo lectura: se oculta si no tiene
  // nada, para no dejar hueco. (Las pestañas de carga ya van en la
  // cabecera, debajo de la ubicación.)
  function actualizarFilaMeta_() {
    const meta = header.querySelector('.seccion-header-meta');
    if (!meta) return;
    const badges = header.querySelector('.seccion-header-badges');
    meta.hidden = !(badges && badges.children.length);
  }

  /* ---------------- CARGA AJUSTADA = CONTEO BLOQUEADO ----------------
   * En cuanto hay una carga ajustada (alguna tienda con cargar ≠ contados,
   * o repartida entre camiones), el conteo queda bloqueado para todos los
   * que no son administradores, y la app enseña por defecto la carga
   * ajustada (con la pestaña "Ver conteo real sin ajustar" para ver lo
   * contado). Solo un administrador puede desbloquearlo con el candado:
   * al desbloquear se borra el ajuste (la carga vuelve a ser lo contado).
   * No hace falta guardar nada nuevo en la base de datos: "bloqueado" es
   * simplemente "hay carga ajustada", así que todos los ordenadores lo ven
   * igual con el autorefresco. */
  // Bloqueado = hay carga guardada (ajustada a mano o de la previsión
  // enviada) y un administrador no la ha desbloqueado después. El
  // servidor lo dice en seccion.carga.desbloqueada (se vuelve a bloquear
  // solo si se ajusta la carga o se envía la previsión otra vez).
  function hayCargaAjustada_() {
    return cargaEditable_() && !seccion.carga.desbloqueada;
  }
  // "un responsable ha ajustado la carga" / "se ha enviado la previsión".
  function motivoBloqueo_() {
    return (seccion.carga && seccion.carga.origen === 'prevision') ? 'se ha enviado la previsión' : 'un responsable ha ajustado la carga';
  }
  // Ficha del modal: motivo, quién y hora del bloqueo.
  function fichaBloqueo_() {
    const c = seccion.carga || {};
    return [['Motivo', tituloBloqueo_()], ['Por', nombreLegible_(c.por)], ['Hora', c.hora]];
  }
  function tituloBloqueo_() {
    return (seccion.carga && seccion.carga.origen === 'prevision') ? 'Previsión enviada' : 'Carga ajustada';
  }
  function bloqueadoParaMi_() {
    return editable && !esAdmin() && hayCargaAjustada_();
  }
  function quienAjusto_() {
    const c = seccion.carga || {};
    return [c.por, c.hora].filter(Boolean).join(' · ');
  }
  // Tiendas cuya carga (ajustada, de la previsión o del definitivo ya
  // enviado) no coincide con lo contado: { 'NOMBRE TIENDA': palets }.
  // Es lo que enseñan las pestañas "Carga ajustada / enviada" y "Ver
  // conteo real sin ajustar". Mientras la carga se puede tocar es lo mismo
  // que ajustesGuardados_(); con el definitivo enviado se lee de la carga
  // que se mandó (ahí ya no hay candado: el conteo está archivado).
  function ajustesParaVista_() {
    if (cargaEditable_()) return ajustesGuardados_();
    const res = {};
    const c = seccion.carga;
    if (!c || !Array.isArray(c.lista)) return res;
    const abiertas = {};
    const divididas = tiendasDivididas_();
    filasCargaActuales_().forEach(function (f) { if (!f.cerrada) abiertas[f.nombre] = true; });
    c.lista.forEach(function (t) {
      if (t.cerrada || t.cargar === null || t.cargar === undefined || !abiertas[t.tienda]) return;
      if (Number(t.cargar) !== Number(t.contados) || divididas[t.tienda]) res[t.tienda] = Number(t.cargar);
    });
    return res;
  }
  function esCargaEnviada_() {
    return seccion.estado === 'enviado' || !!(seccion.carga && seccion.carga.origen === 'definitivo');
  }
  function totalCargaAjustada_() {
    const ajustes = ajustesParaVista_();
    return filasCargaActuales_().reduce(function (s, f) {
      if (f.cerrada) return s;
      return s + (Object.prototype.hasOwnProperty.call(ajustes, f.nombre) ? ajustes[f.nombre] : (Number(f.contados) || 0));
    }, 0);
  }
  function totalContadoAhora_() {
    return filasCargaActuales_().reduce(function (s, f) { return s + (f.cerrada ? 0 : (Number(f.contados) || 0)); }, 0);
  }
  let bloqueoPintado_ = null; // último estado de bloqueo aplicado (null = todavía ninguno)
  function pintarEstadoBloqueo_() {
    const hay = hayCargaAjustada_();             // carga ajustada que aún se puede tocar -> candado
    const hayVista = Object.keys(ajustesParaVista_()).length > 0; // lo cargado ≠ lo contado -> pestañas
    const bloqueado = bloqueadoParaMi_();
    // Pestaña: la que haya elegido el usuario; si no ha elegido, la carga
    // (o el conteo real si un administrador lo ha desbloqueado).
    const eleccion = VISTA_CONTEO_REAL_[fecha + '|' + seccion.nombre];
    const verReal = !hayVista || (eleccion !== undefined ? eleccion : !!(seccion.carga && seccion.carga.desbloqueada));

    // Casillas de la tabla real: se apagan solo las que estaban
    // encendidas (y se marcan), para no encender al desbloquear las que
    // estuvieran apagadas por otro motivo (otra nave, doble salida…).
    if (bloqueado) {
      tableWrap.querySelectorAll('input.celda, .btn-cerrar-tienda, .btn-reabrir').forEach(function (el) {
        if (!el.disabled) { el.disabled = true; el.classList.add('bloq-carga'); }
      });
    } else {
      tableWrap.querySelectorAll('.bloq-carga').forEach(function (el) { el.disabled = false; el.classList.remove('bloq-carga'); });
    }
    panel.classList.toggle('carga-bloqueada', bloqueado);

    // Candado de la cabecera (solo si la agrupación aún se puede tocar).
    const candado = header.querySelector('.btn-candado-carga');
    if (candado) {
      const defHoy = definitivoDesbloqueable_();
      candado.hidden = !((hay && editable) || defHoy);
      const quien = quienAjusto_();
      if (defHoy) candado.title = esAdmin()
        ? 'Definitivo enviado. Pulsa para desbloquearlo (deshace el envío; solo el mismo día).'
        : 'Definitivo enviado: si hay que cambiar algo, avisa a un responsable.';
      else candado.title = esAdmin()
        ? 'Conteo bloqueado: ' + motivoBloqueo_() + (quien ? ' (' + quien + ')' : '') + '. Pulsa para desbloquearlo.'
        : 'Conteo bloqueado: ' + motivoBloqueo_() + (quien ? ' (' + quien + ')' : '') + '.';
    }

    // Aviso encima de la tabla.
    if (hay && editable) {
      const quien = quienAjusto_();
      avisoBloqueo.hidden = false;
      const c = seccion.carga || {};
      avisoBloqueo.innerHTML = SVG_CANDADO_CARGA_ +
        '<span class="aviso-carga-texto"><b>Conteo bloqueado</b> · ' + escapeHtml(tituloBloqueo_()) +
        (c.por ? ' por ' + escapeHtml(nombreLegible_(c.por)) : '') + (c.hora ? ' a las ' + escapeHtml(c.hora) : '') + '</span>' +
        '<span class="aviso-carga-accion">' + (esAdmin() ? 'Pulsa el candado para desbloquearlo' : 'Avisa a un responsable') + '</span>';
    } else {
      avisoBloqueo.hidden = true;
      avisoBloqueo.innerHTML = '';
    }

    // Pestañas "Carga ajustada" / "Ver conteo real sin ajustar".
    const tabs = header.querySelector('.vista-carga-tabs');
    if (tabs) {
      tabs.hidden = !hayVista;
      const etiqueta = tabs.querySelector('[data-vista="ajustada"] .vista-carga-etiqueta');
      // Siempre "Carga ajustada" (antes ponía "Carga enviada" tras enviar la previsión o el definitivo).
      if (etiqueta) etiqueta.textContent = 'Carga ajustada';
      tabs.querySelectorAll('.vista-carga-tab').forEach(function (t) {
        const activa = (t.getAttribute('data-vista') === 'real') === verReal;
        t.classList.toggle('activa', activa);
        t.setAttribute('aria-selected', activa ? 'true' : 'false');
      });
      if (hayVista) {
        tabs.querySelector('[data-vista="ajustada"] .vista-carga-num').textContent = totalCargaAjustada_();
        tabs.querySelector('[data-vista="real"] .vista-carga-num').textContent = totalContadoAhora_();
      }
    }

    // Qué tabla se ve, y el total de palets de la cabecera.
    tableWrap.hidden = !verReal;
    vistaAjustadaWrap.hidden = verReal;
    const badgePalets = header.querySelector('.badge-total-palets');
    if (verReal) {
      vistaAjustadaWrap.innerHTML = '';
      if (badgePalets) { badgePalets.classList.remove('es-ajustada'); badgePalets.removeAttribute('title'); }
      actualizarTotalPalets();
    } else {
      pintarVistaAjustada_();
      const el = header.querySelector('.total-palets-valor');
      if (el) el.textContent = totalCargaAjustada_();
      if (badgePalets) { badgePalets.classList.add('es-ajustada'); badgePalets.title = 'Palets de la carga ' + (esCargaEnviada_() ? 'enviada' : 'ajustada') + ' (contados: ' + totalContadoAhora_() + ')'; }
    }

    actualizarFilaMeta_();

    // Si el bloqueo ha cambiado, el botón VERIFICAR CONTEO también.
    if (bloqueoPintado_ !== null && bloqueoPintado_ !== bloqueado) pintarVerificaciones_();
    bloqueoPintado_ = bloqueado;
    pintarAvisoCargaNoAjustada_();
  }

  // Aviso en rojo "CARGA NO AJUSTADA POR UN RESPONSABLE" (en el sitio de
  // las pestañas de carga): sale cuando TODAS las naves están verificadas
  // pero nadie ha guardado la carga del camión (ni ajuste ni previsión),
  // y aún no se ha enviado el definitivo. Si un administrador desbloqueó
  // la carga, cuenta como no ajustada.
  function pintarAvisoCargaNoAjustada_() {
    const aviso = header.querySelector('.aviso-carga-no-ajustada');
    if (!aviso) return;
    const v = seccion.verificaciones || {};
    const todasVerificadas = NAVES_CONTEO.every(function (n) { return !!v[n.campo]; });
    const c = seccion.carga;
    const hayCarga = !!(c && !c.desbloqueada);
    aviso.hidden = !(todasVerificadas && !hayCarga && seccion.estado !== 'enviado' && !seccion.previsionEnviada);
  }

  // Copia de solo lectura de la tabla real con los números de la carga
  // ajustada. Lo que se quita en cada tienda se reparte en el orden de
  // siempre: primero PTA, luego CART. y por último 60. Las casillas que
  // cambian salen en azul (con lo contado al pasar el ratón).
  function pintarVistaAjustada_() {
    const ajustes = ajustesParaVista_();
    const original = tableWrap.querySelector('table.conteo');
    if (!original) return;
    const tabla = original.cloneNode(true);
    tabla.classList.add('conteo-ajustado');
    // cloneNode no siempre copia lo escrito/calculado en las casillas
    // (solo lo que venía en el HTML): se copia a mano, casilla a casilla.
    const inputsOriginal = original.querySelectorAll('input');
    tabla.querySelectorAll('input').forEach(function (inp, i) { if (inputsOriginal[i]) inp.value = inputsOriginal[i].value; });
    tabla.querySelectorAll('input, button').forEach(function (el) { el.disabled = true; el.tabIndex = -1; });
    tabla.querySelectorAll('tbody tr').forEach(function (tr) {
      const nombre = tr.getAttribute('data-nombre');
      if (!nombre || tr.classList.contains('fila-cerrada') || !Object.prototype.hasOwnProperty.call(ajustes, nombre)) return;
      const totalIn = tr.querySelector('input[data-campo="total"]');
      if (!totalIn) return;
      const contados = parseFloat(totalIn.value) || 0;
      const cargar = Number(ajustes[nombre]) || 0;
      let quitar = contados - cargar;
      ['pta', 'cart', 'c60'].forEach(function (campo) {
        if (quitar <= 0) return;
        const inp = tr.querySelector('input[data-campo="' + campo + '"]');
        if (!inp || inp.classList.contains('celda-no') || inp.classList.contains('celda-otra-agencia')) return;
        const v = parseFloat(inp.value) || 0;
        const q = Math.min(v, quitar);
        if (q <= 0) return;
        inp.value = v - q;
        inp.classList.add('celda-ajustada');
        inp.title = 'Contado: ' + v + ' · se quita' + (q === 1 ? ' 1 palet' : 'n ' + q + ' palets');
        quitar -= q;
      });
      totalIn.value = cargar;
      const vis = tr.querySelector('input[data-campo="totalVisual"]');
      let totalVisto = cargar;
      if (vis) {
        const antes = vis.value === '' ? contados : (parseFloat(vis.value) || 0);
        totalVisto = antes - (contados - cargar);
        vis.value = totalVisto;
        vis.classList.add('celda-ajustada');
        vis.title = 'Contado: ' + antes + ' · carga ajustada: ' + totalVisto;
      }
      // PESO automático: con los palets que de verdad se cargan.
      const pesoIn = tr.querySelector('input[data-campo="peso"]');
      if (pesoIn && !pesoIn.classList.contains('celda-otra-agencia') && typeof PESO_PALET_KG !== 'undefined') {
        const n = function (c) { const i = tr.querySelector('input[data-campo="' + c + '"]'); return i ? (parseFloat(i.value) || 0) : 0; };
        const kg = n('c60') * PESO_PALET_KG.c60 + n('pta') * PESO_PALET_KG.pta + n('cart') * PESO_PALET_KG.cart;
        pesoIn.value = kg || '';
      }
      tr.classList.add('fila-ajustada');
    });
    // La vista de la carga va "a pelo": sin avisos de límite ni notas
    // debajo del TOTAL (eso se ve en "Ver conteo real sin ajustar").
    tabla.querySelectorAll('tbody tr').forEach(function (tr) { tr.classList.remove('fila-aviso', 'fila-alerta'); });
    tabla.querySelectorAll('.diff-nota').forEach(function (n) { n.textContent = ''; n.className = 'diff-nota'; });
    vistaAjustadaWrap.innerHTML = '';
    vistaAjustadaWrap.appendChild(tabla);
    // Las cabeceras de ruta ("8P MAX. POR RUTA ... — 10/8") venían copiadas
    // de la tabla real, con la suma de lo contado. Se recalculan aquí con
    // los TOTAL ya ajustados, para que el chip diga lo que de verdad se
    // carga en esa ruta (y su color: rojo solo si la carga ajustada se pasa).
    attachValidacionGrupos(vistaAjustadaWrap);
  }

  // Candado: el administrador desbloquea (con confirmación); el resto solo
  // ve quién lo bloqueó.
  // Con el definitivo ya enviado HOY, el mismo candado sirve para
  // desbloquearlo (lo que antes hacía la papelera "Deshacer envío"):
  // se quita la marca de enviado y se recuperan los datos para editar.
  function definitivoDesbloqueable_() {
    return seccion.estado === 'enviado' && !!esHoy;
  }
  function desbloquearDefinitivo_() {
    const titulo = parsearNombreAgrupacion(seccion.nombre).titulo;
    if (!esAdmin()) {
      mostrarModalCandado_({
        titulo: 'Conteo bloqueado', agrupacion: titulo, fechaTexto: formatearFechaLarga(fecha),
        ficha: [['Motivo', 'Definitivo enviado'], ['Por', nombreLegible_(seccion.enviadoPor)], ['Hora', seccion.horaEnvio]],
        nota: 'Si hay que cambiar algo, avisa a un responsable.'
      });
      return;
    }
    mostrarModalCandado_({
      abierto: true, titulo: '¿Desbloquear el definitivo?', agrupacion: titulo, fechaTexto: formatearFechaLarga(fecha),
      ficha: [['Motivo', 'Definitivo enviado'], ['Por', nombreLegible_(seccion.enviadoPor)], ['Hora', seccion.horaEnvio]],
      puntos: [
        'Se deshace el envío del definitivo y se recuperan los números para poder corregirlos.',
        'El email que ya recibió la agencia no se puede recuperar.',
        'Si había carga ajustada, se borra, y los operarios podrán volver a tocar el conteo.'
      ],
      nota: 'Solo se puede hacer el mismo día en que se envió.',
      onConfirmar: function () {
        const candado = header.querySelector('.btn-candado-carga');
        if (candado) candado.disabled = true;
        mostrarModalCargando('Desbloqueando el definitivo…');
        llamarApi_('deshacerEnvioSeccion', [dia, seccion.nombre, fecha])
          .then(function () {
            // Sin el definitivo, quedaría bloqueado por la previsión o la
            // carga ajustada: se desbloquea también.
            return llamarApi_('desbloquearCarga', [dia, seccion.nombre, fecha]).catch(function () { return null; });
          })
          .then(function () {
            if (candado) candado.disabled = false;
            delete VISTA_CONTEO_REAL_[fecha + '|' + seccion.nombre];
            cerrarModal();
            mostrarToast('Definitivo desbloqueado');
            cargarConteoDia();
            cargarCalendario();
          })
          .catch(function (err) {
            if (candado) candado.disabled = false;
            cerrarModal();
            mostrarErrorServidor(err);
          });
      }
    });
  }
  function pulsarCandado_() {
    if (definitivoDesbloqueable_()) { desbloquearDefinitivo_(); return; }
    if (!hayCargaAjustada_()) return;
    const titulo = parsearNombreAgrupacion(seccion.nombre).titulo;
    const quien = quienAjusto_();
    if (!esAdmin()) {
      mostrarModalCandado_({
        titulo: 'Conteo bloqueado', agrupacion: titulo, fechaTexto: formatearFechaLarga(fecha),
        ficha: fichaBloqueo_(),
        nota: 'Si hay que cambiar algo, avisa a un responsable.'
      });
      return;
    }
    const esPrevision = seccion.carga && seccion.carga.origen === 'prevision';
    mostrarModalCandado_({
      abierto: true, titulo: '¿Desbloquear el conteo?', agrupacion: titulo, fechaTexto: formatearFechaLarga(fecha),
      ficha: fichaBloqueo_(),
      puntos: [
        'Los operarios podrán volver a corregir el conteo.',
        esPrevision
          ? 'La previsión ya enviada no se deshace: el email ya salió. Si había carga ajustada, se borra.'
          : 'Se borra la carga ajustada, con sus camiones y matrículas, y se vuelve a ver el conteo real (' + totalContadoAhora_() + ' palets).',
        'Si se vuelve a ajustar la carga o a enviar la previsión, se bloquea otra vez.'
      ],
      onConfirmar: desbloquearCarga_
    });
  }
  // Desbloquear (solo administradores, el servidor lo comprueba): borra la
  // carga ajustada si la hay y apunta el desbloqueo. Todos los ordenadores
  // lo ven con el autorefresco (seccion.carga.desbloqueada).
  function desbloquearCarga_() {
    mostrarModalCargando('Desbloqueando el conteo…');
    llamarApi_('desbloquearCarga', [dia, seccion.nombre, fecha])
      .then(function (carga) {
        seccion.carga = carga || null;
        delete VISTA_CONTEO_REAL_[fecha + '|' + seccion.nombre];
        actualizarEstadoCarga_();
        cerrarModal();
        mostrarToast('Conteo desbloqueado: ya se ve el conteo real');
      })
      .catch(function (err) {
        cerrarModal();
        mostrarErrorServidor(err);
      });
  }
  function infoCargaParaModal_() {
    const c = seccion.carga;
    return c ? { tipo: c.origen, hora: c.hora, enviadoPor: c.por, lista: c.lista, camiones: c.camiones || null } : null;
  }
  // Camiones (matrícula, remolque y tiendas) de la carga vigente, si la hay.
  function camionesCarga_() {
    const c = seccion.carga;
    return (c && Array.isArray(c.camiones)) ? c.camiones : null;
  }
  // Click en el camioncito (servidor nuevo).
  function abrirCarga_() {
    const titulo = parsearNombreAgrupacion(seccion.nombre).titulo;
    const fechaTexto = formatearFechaLarga(fecha);
    const c = seccion.carga;
    const revisar = tiendasARevisar_();
    const hayRevisar = Object.keys(revisar).length > 0;
    const puede = puedeAjustarCarga_();
    // A revisar: se abre directamente en edición para verificarla.
    if (puede && hayRevisar) {
      abrirAjustarCarga_(null, null);
      return;
    }
    // Siempre se abre como la ven los flejadores (solo lectura). Con el
    // permiso "Ajustar carga" sale además el lápiz al lado de la X para
    // pasar a editarla y guardarla.
    // Carga ajustada sin enviar: se enseña con lo contado AHORA (la que
    // saldría en el email). Previsión/Definitivo: lo que se mandó.
    let info = infoCargaParaModal_();
    if (info && info.tipo === 'ajuste' && seccion.estado !== 'enviado') info.lista = listaCargaEfectiva_();
    // Nadie la ha ajustado todavía: se enseña lo contado (con o sin permiso),
    // con la etiqueta "CARGA SIN AJUSTAR POR UN RESPONSABLE".
    if (!info && seccion.estado !== 'enviado') info = { tipo: 'contado', lista: listaCargaEfectiva_() };
    const onEditar = puede ? function () { abrirAjustarCarga_(null, null, true); } : null;
    mostrarModalListaCarga(info, titulo, fechaTexto, {
      revisar: revisar,
      soloLectura: !puede && !(c && c.origen === 'definitivo') && seccion.estado !== 'enviado',
      onEditar: onEditar
    });
    // Sin ajustar todavía y con permiso: ventanita encima preguntando si
    // se quiere ajustar (solo se quita con sus botones o con Escape).
    if (puede && info && info.tipo === 'contado') mostrarAvisoCargaSinAjustar(onEditar);
  }
  // Modal editable. tipoEnvio: 'prevision'|'definitivo' si se abre en mitad
  // de un envío (entonces alTerminar sigue con el envío tras guardar).
  // desdeLapiz: se ha entrado con el lápiz de la vista de solo lectura;
  // al guardar o cancelar se vuelve a esa vista.
  function abrirAjustarCarga_(tipoEnvio, alTerminar, desdeLapiz) {
    const ajustes = ajustesGuardados_();
    const revisar = tiendasARevisar_();
    const filas = filasCargaActuales_().map(function (f) {
      if (f.cerrada) return f;
      return Object.assign({}, f, {
        cargar: Object.prototype.hasOwnProperty.call(ajustes, f.nombre) ? ajustes[f.nombre] : f.contados,
        cambio: revisar[f.nombre] || null
      });
    });
    mostrarModalAjustarCarga({
      titulo: parsearNombreAgrupacion(seccion.nombre).titulo,
      fechaTexto: formatearFechaLarga(fecha),
      filas: filas,
      carga: seccion.carga,
      camiones: camionesCarga_(),
      tipoEnvio: tipoEnvio,
      desdeLapiz: !!desdeLapiz,
      onCancelar: desdeLapiz ? abrirCarga_ : null,
      onGuardar: function (cargas, camiones) {
        guardarCarga_(cargas, camiones, function (ok) {
          if (!ok) return;
          if (alTerminar) { alTerminar(); return; }
          cerrarModal();
          if (desdeLapiz) abrirCarga_();
          mostrarToast('Carga guardada');
        });
      }
    });
  }
  // Guarda primero el conteo (para que el servidor vea lo mismo que hay en
  // pantalla) y después la carga, con sus camiones (matrícula, remolque y
  // tiendas de cada uno; [] = sin camiones).
  function guardarCarga_(cargas, camiones, done) {
    mostrarModalCargando('Guardando la carga del camión…');
    autoguardarSeccion(function (ok) {
      if (!ok) { cerrarModal(); done(false); return; }
      llamarApi_('guardarCargaAjustada', [dia, seccion.nombre, fecha, cargas, camiones || []])
        .then(function (carga) {
          seccion.carga = carga || null;
          // Carga recién guardada: se vuelve a ver la carga ajustada (si la hay).
          delete VISTA_CONTEO_REAL_[fecha + '|' + seccion.nombre];
          actualizarEstadoCarga_();
          done(true);
        })
        .catch(function (err) {
          cerrarModal();
          if (err && /permiso/i.test(err.message || '')) mostrarModalSinPermiso();
          else mostrarErrorServidor(err);
          done(false);
        });
    });
  }

  // Notas/instrucciones de carga escritas en la propia hoja de Excel
  // (ej. "1 CAMIÓN 33 P. + ... TODOS LOS LUNES"). De solo lectura.
  if (seccion.notasCarga && seccion.notasCarga.length) {
    const cargaWrap = document.createElement('div');
    cargaWrap.className = 'seccion-notas-carga';
    seccion.notasCarga.forEach(function (texto) {
      cargaWrap.appendChild(crearNotaCargaChip(texto));
    });
    panel.appendChild(cargaWrap);
  }

  // Observaciones manuales guardadas para esta agrupación (hoja Observaciones), sí se pueden borrar.
  if (seccion.notas && seccion.notas.length) {
    const notasWrap = document.createElement('div');
    notasWrap.className = 'seccion-notas';
    seccion.notas.forEach(function (n) { notasWrap.appendChild(crearNotaChip(n)); });
    panel.appendChild(notasWrap);
  }

  const body = document.createElement('div');
  body.className = 'seccion-body';

  // Columna lateral: solo se muestra si hay una lista de "quitar en este
  // orden" que mostrar; ya no aloja botones (Guardar / Enviar), que ahora
  // viven en la cabecera.
  let acciones = null;
  if (seccion.ordenRetirada && seccion.ordenRetirada.length) {
    acciones = document.createElement('div');
    acciones.className = 'seccion-acciones';
    const ordenWrap = document.createElement('div');
    ordenWrap.className = 'orden-retirada';
    ordenWrap.innerHTML =
      '<div class="orden-retirada-titulo">Quitar en este orden</div>' +
      '<ol>' + seccion.ordenRetirada.map(function (o) { return '<li>' + escapeHtml(quitarCodigoTienda(quitarMarcadorNombre(o))) + '</li>'; }).join('') + '</ol>';
    acciones.appendChild(ordenWrap);
    body.appendChild(acciones);
  }

  const tablaCol = document.createElement('div');
  tablaCol.className = 'seccion-tabla-col';
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  // Nombres de las tiendas de cada grupo (para mostrarlos juntos una sola
  // vez en la fila-cabecera, en vez de repetir la nota en cada tienda).
  const nombresPorGrupo = {};
  seccion.tiendas.forEach(function (t) {
    if (!t.notaGrupoId) return;
    if (!nombresPorGrupo[t.notaGrupoId]) nombresPorGrupo[t.notaGrupoId] = [];
    nombresPorGrupo[t.notaGrupoId].push(t.nombre);
  });

  // Las tiendas de un mismo grupo de palets se pintan juntas (ver
  // juntarGruposDePalets en conteos-badges.js), aunque en la plantilla haya
  // otras tiendas en medio.
  const tiendasEnOrden = juntarGruposDePalets(seccion.tiendas);
  const filasHtml = tiendasEnOrden.map(function (t, i) {
    const anterior = tiendasEnOrden[i - 1];
    const siguiente = tiendasEnOrden[i + 1];
    const esPrimeraDeGrupo = !!t.notaGrupoId && (!anterior || anterior.notaGrupoId !== t.notaGrupoId);
    const esUltimaDeGrupo = !!t.notaGrupoId && (!siguiente || siguiente.notaGrupoId !== t.notaGrupoId);
    const headerHtml = esPrimeraDeGrupo ? filaGrupoHeaderHtml(t, nombresPorGrupo[t.notaGrupoId], seccion.tienePeso, seccion.tieneCExpress, seccion.tieneSobrestock, seccion.tieneViernes, seccion.tieneCasillaDomingo) : '';
    return headerHtml + filaHtml(t, esPrimeraDeGrupo, esUltimaDeGrupo, seccion.tienePeso, seccion.tieneCExpress, seccion.tieneSobrestock, seccion.tieneViernes, seccion.tieneCasillaDomingo);
  }).join('');
  tableWrap.innerHTML =
    '<table class="conteo"><thead><tr>' +
    '<th class="th-nombre">Tienda</th><th>Límite</th>' +
    (seccion.tieneViernes ? '<th class="th-viernes">VIERNES</th>' : '') +
    (seccion.tieneCasillaDomingo ? '<th class="th-domingo">DOMINGO</th>' : '') +
    NAVES_CONTEO.map(function (n) { return thCampoNave_(n.campo, n.etiqueta); }).join('') +
    '<th class="th-total">TOTAL</th><th>PDTE</th>' +
    (seccion.tienePeso ? '<th>PESO</th>' : '') +
    (seccion.tieneCExpress ? '<th>C.EXPRESS</th>' : '') +
    (seccion.tieneSobrestock ? '<th>SOBRESTOCK</th>' : '') +
    '<th></th>' +
    '</tr></thead><tbody>' + filasHtml + '</tbody></table>';
  if (!editable) {
    // Fecha demasiado antigua (2+ días atrás) o ya enviada: se puede
    // consultar, pero no modificar nada de esta agrupación.
    tableWrap.querySelectorAll('input.celda, input.celda-total').forEach(function (input) { input.disabled = true; });
    tableWrap.querySelectorAll('.btn-cerrar-tienda, .btn-reabrir, input.celda-no').forEach(function (btn) { btn.disabled = true; });
  }
  if (editable && restringidoANave_()) {
    // Operario con nave: las columnas de las otras naves se ven, pero no
    // se pueden tocar (tampoco forzar un "NO" de otra nave). El backend
    // (guardar_conteo) conserva además lo guardado en esas columnas
    // aunque llegara otra cosa.
    NAVES_CONTEO.forEach(function (n) {
      if (puedeEditarCampoConteo_(n.campo)) return;
      tableWrap.querySelectorAll('tbody input[data-campo="' + n.campo + '"]').forEach(function (input) {
        input.disabled = true;
        input.classList.add('celda-bloqueada-nave');
        input.title = 'Solo lectura: columna de la nave ' + n.nave;
      });
    });
  }
  // Aviso "conteo bloqueado" y tabla de la CARGA AJUSTADA (solo lectura,
  // copia de la tabla real con los números de la carga). La tabla real
  // (tableWrap) sigue siempre en el DOM aunque esté oculta: es la que se
  // guarda, la que leen los envíos, el PDF y el Excel.
  const avisoBloqueo = document.createElement('div');
  avisoBloqueo.className = 'aviso-carga-bloqueada';
  avisoBloqueo.hidden = true;
  const vistaAjustadaWrap = document.createElement('div');
  vistaAjustadaWrap.className = 'table-wrap tabla-ajustada-wrap';
  vistaAjustadaWrap.hidden = true;
  tablaCol.appendChild(avisoBloqueo);
  tablaCol.appendChild(vistaAjustadaWrap);
  tablaCol.appendChild(tableWrap);
  body.appendChild(tablaCol);

  panel.appendChild(body);

  // Total de palets de la agrupación: suma en vivo del TOTAL de cada tienda
  // (no cuenta las tiendas cerradas, que no tienen input de TOTAL). El
  // VIERNES NO entra aquí (no va en la carga): se suma aparte en su propia
  // etiqueta "Viernes: N" de la cabecera. Lo mismo con DOMINGO.
  function actualizarTotalPalets() {
    let suma = 0;
    tableWrap.querySelectorAll('input.celda-total').forEach(function (inp) {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) suma += v;
    });
    const el = header.querySelector('.total-palets-valor');
    if (el) el.textContent = suma;
    const elV = header.querySelector('.total-viernes-valor');
    if (elV) {
      let sumaV = 0;
      tableWrap.querySelectorAll('input[data-campo="viernes"]').forEach(function (inp) {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) sumaV += v;
      });
      elV.textContent = sumaV;
    }
    const elD = header.querySelector('.total-domingo-valor');
    if (elD) {
      let sumaD = 0;
      tableWrap.querySelectorAll('input[data-campo="casillaDomingo"]').forEach(function (inp) {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) sumaD += v;
      });
      elD.textContent = sumaD;
    }
    return suma;
  }
  const sumaInicialPalets = actualizarTotalPalets();

  // GUARDADO MANUAL: ya no se guarda solo mientras se escribe. En su
  // lugar, cualquier cambio en un input marca la agrupación como "con
  // cambios sin guardar" (botón "Guardar conteo" destacado y con pulso).
  // Los botones "Enviar Previsión" / "Enviar Definitivo" se activan si ya
  // hay algún total guardado para esta agrupación (venga de esta sesión o
  // de una anterior: si al recargar la página ya trae datos, no tiene
  // sentido pedir pulsar "Guardar conteo" otra vez solo para desbloquear
  // el envío). Si después se edita algo, se apagan otra vez hasta el
  // siguiente guardado.
  const btnGuardarConteo = header.querySelector('.btn-header-guardar');
  const spanUltimoGuardado = header.querySelector('.ultimo-guardado');
  let hayCambiosSinGuardar = false;
  let guardandoAhora_ = false; // guardado en vuelo (antes lo indicaba el botón "Guardar conteo" deshabilitado)
  let haGuardadoAlMenosUnaVez = sumaInicialPalets > 0;
  let ultimoGuardadoEn = null; // Date del último guardado con éxito (esta sesión)
  let timerAutoguardadoInactividad_ = null; // ver marcarCambiosSinGuardar_ / RESPALDO POR INACTIVIDAD más abajo
  function refrescarTextoUltimoGuardado_() {
    if (!spanUltimoGuardado || !spanUltimoGuardado.isConnected) return false;
    if (ultimoGuardadoEn) {
      spanUltimoGuardado.textContent = 'Guardado ' + formatearTiempoRelativo_(ultimoGuardadoEn);
      spanUltimoGuardado.title = 'Guardado a las ' + ultimoGuardadoEn.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return true;
  }
  REFRESCADORES_ULTIMO_GUARDADO_.push(refrescarTextoUltimoGuardado_);
  function actualizarBotonesEnvio_() {
    const bloquear = !haGuardadoAlMenosUnaVez || hayCambiosSinGuardar;
    [header.querySelector('.btn-header-prevision'), header.querySelector('.btn-header-definitivo'), header.querySelector('.btn-header-informatica')].forEach(function (btn) {
      if (!btn) return;
      // Con el Definitivo ya enviado no hay nada que guardar: "Enviar a
      // informática" se puede pulsar directamente.
      if (seccion.estado === 'enviado' && btn.classList.contains('btn-header-informatica')) { btn.disabled = false; return; }
      if (!btn.hasAttribute('data-title-original')) btn.setAttribute('data-title-original', btn.title);
      btn.disabled = bloquear;
      btn.title = bloquear ? (hayCambiosSinGuardar ? 'Guardando el conteo…' : 'Todavía no hay conteo guardado') : btn.getAttribute('data-title-original');
    });
    actualizarMenuEnvios_();
  }
  // Menú del sobre: aviso "Pulsa antes Guardar conteo" si hay alguna
  // opción apagada, y el sobre desaparece si ya no queda ninguna opción.
  function actualizarMenuEnvios_() {
    const menu = header.querySelector('.menu-envios') || (MENU_ENVIOS_ABIERTO_ && MENU_ENVIOS_ABIERTO_.wrap.closest('.seccion-header') === header ? MENU_ENVIOS_ABIERTO_.menu : null);
    const wrap = header.querySelector('.envios-wrap');
    if (!menu || !wrap) return;
    const botones = menu.querySelectorAll('.btn-header-prevision, .btn-header-definitivo, .btn-header-informatica');
    const aviso = menu.querySelector('.menu-envios-aviso');
    if (aviso) {
      aviso.hidden = !Array.prototype.some.call(botones, function (b) { return b.disabled; });
      aviso.textContent = hayCambiosSinGuardar ? 'Guardando el conteo…' : 'Todavía no hay conteo guardado';
    }
    const hayEnviado = !!(seccion.previsionEnviada || seccion.estado === 'enviado');
    wrap.hidden = botones.length === 0 && !hayEnviado;
    if (wrap.hidden && MENU_ENVIOS_ABIERTO_ && MENU_ENVIOS_ABIERTO_.menu === menu) cerrarMenuEnvios_();
    pintarEstadoSobre_(menu);
  }
  // Estado de los envíos en el sobre: azul si se envió la previsión, verde
  // si se envió el definitivo (manda sobre la previsión), con la marca ✓;
  // quién y cuándo, en el título (al pasar el ratón) y arriba del menú.
  function pintarEstadoSobre_(menu) {
    const btn = header.querySelector('.btn-menu-email');
    if (!btn) return;
    const marca = btn.querySelector('.sobre-marca');
    const caja = menu ? menu.querySelector('.menu-envios-estado') : null;
    const c = seccion.carga;
    const porPrev = (c && c.origen === 'prevision' && c.por) ? nombreLegible_(c.por) : (seccion.previsionEnviadaPor || '');
    const lineas = [];
    if (seccion.estado === 'enviado') {
      lineas.push({ clase: 'definitivo', titulo: 'Definitivo enviado', detalle: [seccion.enviadoPor, seccion.horaEnvio].filter(Boolean).join(' · ') });
    }
    if (seccion.previsionEnviada) {
      lineas.push({ clase: 'prevision', titulo: 'Previsión enviada', detalle: [porPrev, seccion.previsionEnviada].filter(Boolean).join(' · ') });
    }
    btn.classList.remove('sobre-prevision', 'sobre-definitivo');
    if (!lineas.length) {
      if (marca) marca.hidden = true;
      if (caja) { caja.hidden = true; caja.innerHTML = ''; }
      btn.title = 'Enviar por email';
      return;
    }
    btn.classList.add('sobre-' + lineas[0].clase);
    if (marca) marca.hidden = false;
    btn.title = lineas.map(function (l) { return l.titulo + (l.detalle ? ' por ' + l.detalle : ''); }).join('\n');
    if (caja) {
      caja.hidden = false;
      caja.innerHTML = lineas.map(function (l) {
        return '<div class="menu-envios-estado-linea ' + l.clase + '"><strong>' + escapeHtml(l.titulo) + '</strong>' +
          (l.detalle ? '<span>por ' + escapeHtml(l.detalle) + '</span>' : '') + '</div>';
      }).join('');
    }
  }
  function marcarCambiosSinGuardar_() {
    hayCambiosSinGuardar = true;
    if (btnGuardarConteo) {
      btnGuardarConteo.classList.remove('sin-cambios');
      btnGuardarConteo.classList.add('con-cambios');
      btnGuardarConteo.textContent = 'Guardar conteo';
    }
    actualizarBotonesEnvio_();
    // RESPALDO POR INACTIVIDAD: además de guardar al pulsar "Guardar
    // conteo" o al salir de la tabla (ver "focusout" más abajo), si el
    // usuario se queda 3 segundos sin tocar nada (ni escribe, ni hace
    // clic en otro sitio) se guarda solo, por si se queda a medias sin
    // hacer ninguna de las dos cosas. Cada pulsación reinicia el
    // temporizador (debounce), así que mientras se sigue escribiendo no
    // se dispara ningún guardado de más.
    clearTimeout(timerAutoguardadoInactividad_);
    timerAutoguardadoInactividad_ = setTimeout(function () {
      if (!hayCambiosSinGuardar) return; // ya se guardó por otra vía mientras tanto
      autoguardarSeccion();
    }, 3000);
  }
  function marcarTodoGuardado_() {
    hayCambiosSinGuardar = false;
    haGuardadoAlMenosUnaVez = true;
    clearTimeout(timerAutoguardadoInactividad_); // ya no hace falta el respaldo por inactividad: no queda nada pendiente
    if (btnGuardarConteo) {
      btnGuardarConteo.classList.remove('con-cambios');
      btnGuardarConteo.classList.add('sin-cambios');
      btnGuardarConteo.textContent = 'Guardado';
    }
    actualizarBotonesEnvio_();
  }
  // Se llama solo cuando de verdad ha habido una vuelta al servidor con
  // éxito (no en el caso de "Guardar conteo" pulsado sin cambios), para
  // que el "hace X min" refleje guardados reales.
  function marcarGuardadoAhora_() {
    ultimoGuardadoEn = new Date();
    refrescarTextoUltimoGuardado_();
  }
  // "Guardar conteo" siempre se puede pulsar (mientras sea editable),
  // haya o no cambios: si no hay nada nuevo que guardar, no llama al
  // servidor (evita una petición de red innecesaria), pero igualmente
  // deja constancia de que se ha "confirmado" el guardado en esta
  // sesión, que es lo que activa los botones de envío.
  function autoguardarSeccion(onDone) {
    if (!editable) { if (onDone) onDone(false); return; } // por si acaso: no se guarda nada de una agrupación no editable
    if (!hayCambiosSinGuardar) { marcarTodoGuardado_(); if (onDone) onDone(true); return; }
    const filas = recogerFilas(tableWrap);
    marcarGuardando(panel, true);
    guardandoAhora_ = true;
    if (btnGuardarConteo) btnGuardarConteo.disabled = true;
    llamarApi_('guardarConteo', [dia, filas, fecha, seccion.nombre])
      .then(function () {
        marcarGuardando(panel, false);
        guardandoAhora_ = false;
        if (btnGuardarConteo) btnGuardarConteo.disabled = false;
        marcarTodoGuardado_();
        marcarGuardadoAhora_();
        if (onDone) onDone(true);
      })
      .catch(function (err) {
        marcarGuardando(panel, false);
        guardandoAhora_ = false;
        if (btnGuardarConteo) btnGuardarConteo.disabled = false;
        marcarCambiosSinGuardar_(); // el guardado falló: sigue habiendo cambios sin guardar
        mostrarErrorServidor(err);
        if (onDone) onDone(false);
      });
  }
  if (btnGuardarConteo) {
    btnGuardarConteo.onclick = function (e) {
      e.stopPropagation();
      autoguardarSeccion();
    };
  }

  // GUARDADO AUTOMÁTICO AL PERDER EL FOCO: si el usuario termina de tocar
  // una casilla de esta tabla y el foco se va fuera de ella (a otra
  // agrupación, a un botón, o fuera de la página), se guarda solo, sin
  // esperar a que pulse "Guardar conteo" a mano. Si el foco simplemente
  // salta a otra casilla DENTRO de la misma tabla (lo normal al usar
  // Tab o ir campo a campo), no se hace nada todavía: se espera a que de
  // verdad termine con esta agrupación. El botón sigue ahí como respaldo
  // manual y como indicador visual de si queda algo sin guardar.
  tableWrap.addEventListener('focusout', function () {
    if (!editable) return;
    // No nos fiamos solo de e.relatedTarget (en algunos navegadores llega
    // null al hacer clic fuera de la ventana o en un elemento no
    // enfocable), así que se revisa en el siguiente tick dónde ha
    // quedado realmente el foco.
    setTimeout(function () {
      const focoActual = document.activeElement;
      const siguetocandoEstaTabla = focoActual && tableWrap.contains(focoActual);
      if (siguetocandoEstaTabla) return; // saltó a otra casilla de la misma tabla: no hacer nada aún
      if (!hayCambiosSinGuardar) return; // nada pendiente
      autoguardarSeccion();
    }, 0);
  }, true);

  actualizarBotonesEnvio_(); // estado inicial: envío apagado hasta el primer "Guardar conteo" de esta sesión
  actualizarEstadoCarga_(); // estado inicial del camioncito (ya con la tabla pintada)

  /** Recalcula EN VIVO (sin esperar a guardar ni a recargar) si esta
   *  agrupación "tiene datos" (pendiente -> en progreso), para que el
   *  borde de la cabecera y el punto de "Acceso rápido a agrupación" se
   *  pongan en naranja nada más empezar a escribir, en vez de solo tras
   *  guardar/enviar o recargar la página. Nunca toca una agrupación ya
   *  enviada (candado). */
  function actualizarEstadoLocalSeccion_() {
    if (seccion.estado === 'enviado') return;
    let tieneDatos = false;
    tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
      if (tr.classList.contains('fila-grupo-header') || tr.classList.contains('fila-cerrada') || tr.classList.contains('fila-sale-excepcion')) return;
      tr.querySelectorAll('input.celda').forEach(function (inp) {
        const v = String(inp.value || '').trim();
        if (v !== '' && v.toUpperCase() !== 'NO') tieneDatos = true;
      });
    });
    const nuevoEstado = tieneDatos ? 'progreso' : 'pendiente';
    if (seccion.estado === nuevoEstado) return;
    seccion.estado = nuevoEstado;
    panel.classList.remove('estado-pendiente', 'estado-progreso');
    panel.classList.add('estado-' + nuevoEstado);
    actualizarMenuRapidoItem_(seccion);
  }

  tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
    if (tr.classList.contains('fila-grupo-header')) {
      return; // fila-resumen del grupo: no es una tienda, no lleva inputs
    }
    if (tr.classList.contains('fila-sale-excepcion')) {
      return; // tienda que hoy sale por otra agrupación: solo un td-colspan informativo, sin inputs
    }
    if (tr.classList.contains('fila-cerrada')) {
      const btnReabrir = tr.querySelector('.btn-reabrir');
      if (btnReabrir) {
        btnReabrir.onclick = function () {
          if (!editable) return;
          const cierreId = tr.getAttribute('data-cierre-id');
          appConfirm('Desbloquear conteo', '¿Quieres desbloquear el conteo de esta tienda para hoy?', function () {
            eliminarObservacionYRecargar(cierreId);
          });
        };
      }
    } else {
      attachCalculoYValidacion(tr);
      attachForzarNo(tr);
      tr.querySelectorAll('input.celda:not(.celda-total):not(.celda-total-visual)').forEach(function (input) {
        input.addEventListener('input', function () {
          marcarCambiosSinGuardar_();
          actualizarTotalPalets();
          actualizarEstadoCarga_();
          actualizarEstadoLocalSeccion_();
          quitarVerificacionLocal_(input.getAttribute('data-campo'));
        });
      });
      const btnCerrar = tr.querySelector('.btn-cerrar-tienda');
      if (btnCerrar) {
        btnCerrar.onclick = function () {
          if (!editable) return;
          const nombreTienda = tr.getAttribute('data-nombre');
          appPrompt('Bloquear conteo', 'Observación que saldrá en el conteo (ej. "TIENDA CERRADA POR INVENTARIO")…', function (texto) {
            guardarObservacionYRecargar({ fecha: fecha, dia: dia, agrupacion: seccion.nombre, tienda: nombreTienda, tipo: 'cierre', texto: texto });
          });
        };
      }
    }
  });

  attachValidacionGrupos(tableWrap);

  /* ---------- VERIFICAR CONTEO (por nave) ---------- */
  if (!seccion.verificaciones) seccion.verificaciones = {};
  if (!seccion.cambiosVerif) seccion.cambiosVerif = {};

  /** Tiendas de esta agrupación que tienen VACÍA la columna `campo` (sin
   *  contar cerradas, las que hoy salen por otra agrupación ni las
   *  casillas "NO" sin forzar): son las que se pondrán a 0 al verificar. */
  function vaciasDeCampo_(campo) {
    const inputs = [];
    const nombres = [];
    tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
      if (tr.classList.contains('fila-grupo-header') || tr.classList.contains('fila-cerrada') || tr.classList.contains('fila-sale-excepcion')) return;
      const input = tr.querySelector('input[data-campo="' + campo + '"]');
      // "NO" sin forzar y columnas que hoy rellena otra agrupación (doble
      // salida): no se tocan al verificar.
      if (!input || input.classList.contains('celda-no') || input.classList.contains('celda-otra-agencia')) return;
      if (String(input.value).trim() === '') {
        inputs.push(input);
        nombres.push(tr.getAttribute('data-nombre') || '');
      }
    });
    return { inputs: inputs, nombres: nombres };
  }

  /** Si se cambia a mano un número de una columna ya verificada, la
   *  verificación deja de valer (el backend la borra al guardar). Aquí se
   *  quita ya en pantalla, y se marca el panel para que el siguiente
   *  autorefresco lo repinte con lo que diga el servidor. */
  function quitarVerificacionLocal_(campo) {
    if (!campo || !seccion.verificaciones[campo]) return;
    const ver = seccion.verificaciones[campo];
    // Hasta que llegue el detalle real del servidor (siguiente
    // autorefresco), se marca ya como "cambiado tras verificar".
    if (!seccion.cambiosVerif[campo]) {
      seccion.cambiosVerif[campo] = { verificadoPor: ver.nombre || ver.usuario || '', verificadoHora: ver.hora || '', modificadoPor: SESSION_USUARIO || '', hora: '', cambios: [] };
    }
    delete seccion.verificaciones[campo];
    panel._firma = '';
    pintarVerificaciones_();
  }

  /** Pastillas 60 / PTA / CART. junto al nombre, cabeceras de la tabla y
   *  botón VERIFICAR CONTEO, según seccion.verificaciones. */
  function pintarVerificaciones_() {
    const v = seccion.verificaciones || {};
    const pastillas = header.querySelector('.verif-pastillas');
    if (pastillas) {
      pastillas.innerHTML = NAVES_CONTEO.map(function (n) {
        const ver = v[n.campo];
        const cam = !ver && seccion.cambiosVerif[n.campo];
        if (ver) return '<span class="verif-pastilla ok" title="' + escapeAttr(n.nave + ' verificado por ' + (ver.nombre || ver.usuario || '') + ' a las ' + (ver.hora || '')) + '">' + SVG_CHECK_VERIF_ + escapeHtml(n.etiqueta) + '</span>';
        if (cam) return '<span class="verif-pastilla modificada" title="' + escapeAttr(textoCambiosVerif_(n, cam)) + '">' + SVG_AVISO_VERIF_ + escapeHtml(n.etiqueta) + ' cambiado tras verificar</span>';
        return '<span class="verif-pastilla" title="' + escapeAttr(n.nave + ': sin verificar') + '">' + escapeHtml(n.etiqueta) + '</span>';
      }).join('');
    }
    // Recuadro con el detalle de lo cambiado después de verificar.
    let caja = panel.querySelector('.verif-cambios-caja');
    const camposCambiados = NAVES_CONTEO.filter(function (n) { return !v[n.campo] && seccion.cambiosVerif[n.campo]; });
    if (camposCambiados.length) {
      if (!caja) {
        caja = document.createElement('div');
        caja.className = 'verif-cambios-caja';
        header.insertAdjacentElement('afterend', caja);
      }
      caja.innerHTML = camposCambiados.map(function (n) {
        return '<div class="verif-cambios-linea">' + SVG_AVISO_VERIF_ + '<span>' + escapeHtml(textoCambiosVerif_(n, seccion.cambiosVerif[n.campo])) + '</span></div>';
      }).join('');
    } else if (caja) {
      caja.remove();
    }
    tableWrap.querySelectorAll('thead th[data-campo]').forEach(function (th) {
      th.classList.toggle('th-verificada', !!v[th.getAttribute('data-campo')]);
    });
    pintarAvisoCargaNoAjustada_();

    const wrap = header.querySelector('.verif-wrap');
    if (!wrap) return;
    // VERIFICAR CONTEO como icono de check (el detalle ya lo dan las
    // pastillas 60 / PTA / CART. junto al nombre). Colores:
    //   normal = falta verificar · ok = verificado · aviso = cambiado tras
    //   verificar · bloqueado = conteo bloqueado por la carga.
    const icono = function (etiqueta, clase, titulo) {
      return '<' + etiqueta + (etiqueta === 'button' ? ' type="button"' : '') +
        ' class="btn-header-verificar btn-verif-icono' + (clase ? ' ' + clase : '') + '" title="' + escapeAttr(titulo) + '" aria-label="' + escapeAttr(titulo) + '">' +
        SVG_CHECK_VERIF_ + '</' + etiqueta + '>';
    };
    if (esAdmin()) {
      const todas = NAVES_CONTEO.every(function (n) { return v[n.campo]; });
      const cambiada = NAVES_CONTEO.some(function (n) { return !v[n.campo] && seccion.cambiosVerif[n.campo]; });
      wrap.innerHTML = icono('button', todas ? 'ok' : (cambiada ? 'aviso' : ''),
        todas ? 'Conteo verificado en las 3 naves (pulsa para volver a verificar o anular)'
          : (cambiada ? 'Hay que volver a verificar: se cambió después de verificar' : 'Verificar conteo (elegir nave)'));
      wrap.querySelector('button').onclick = function (e) { e.stopPropagation(); abrirModalVerificarAdmin_(); };
      return;
    }
    const campo = campoNaveSesion_();
    const n = naveDeCampo_(campo);
    const ver = v[campo];
    if (ver) {
      wrap.innerHTML = icono('span', 'ok', n.etiqueta + ' verificado por ' + (ver.nombre || ver.usuario || '') + (ver.hora ? ' a las ' + ver.hora : ''));
      return;
    }
    // Conteo bloqueado por la carga: no se puede verificar (eso pone
    // casillas a 0 y guarda).
    if (bloqueadoParaMi_()) {
      wrap.innerHTML = icono('span', 'bloqueado', 'Conteo bloqueado: no se puede verificar');
      return;
    }
    wrap.innerHTML = icono('button', seccion.cambiosVerif[campo] ? 'aviso' : '',
      (seccion.cambiosVerif[campo] ? 'Volver a verificar ' : 'Verificar ') + 'la columna ' + n.etiqueta + ' (' + n.nave + ')');
    wrap.querySelector('button').onclick = function (e) {
      e.stopPropagation();
      const vacias = vaciasDeCampo_(campo);
      mostrarModalConfirmarVerificacion_(seccion, fecha, n, vacias.nombres, function () { ejecutarVerificacion_(campo); });
    };
  }

  /** Pone a 0 las tiendas vacías de esa columna, guarda y deja constancia
   *  de la verificación en el servidor. */
  function ejecutarVerificacion_(campo) {
    if (!editable || bloqueadoParaMi_()) return;
    const n = naveDeCampo_(campo);
    const btn = header.querySelector('.btn-header-verificar');
    if (btn) btn.disabled = true;
    vaciasDeCampo_(campo).inputs.forEach(function (input) {
      input.value = '0';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    autoguardarSeccion(function (ok) {
      if (!ok) { if (btn) btn.disabled = false; return; }
      llamarApi_('verificarConteo', [dia, seccion.nombre, fecha, campo])
        .then(function (res) {
          seccion.verificaciones[campo] = res || { nombre: SESSION_NOMBRE || SESSION_USUARIO, hora: '' };
          delete seccion.cambiosVerif[campo];
          panel._firma = '';
          pintarVerificaciones_();
          mostrarToast(n.etiqueta + ' verificado en ' + parsearNombreAgrupacion(seccion.nombre).titulo);
        })
        .catch(function (err) {
          if (btn) btn.disabled = false;
          mostrarErrorServidor(err);
        });
    });
  }

  function anularVerificacion_(campo) {
    const n = naveDeCampo_(campo);
    appConfirm('Anular verificación',
      'Se quitará la verificación de ' + n.etiqueta + ' (' + n.nave + ') en ' + parsearNombreAgrupacion(seccion.nombre).titulo + '. No se borra ningún número. En Inicio el check de ' + n.etiqueta + ' dejará de estar en verde. ¿Continuar?',
      function () {
        llamarApi_('anularVerificacionConteo', [dia, seccion.nombre, fecha, campo])
          .then(function () {
            delete seccion.verificaciones[campo];
            panel._firma = '';
            pintarVerificaciones_();
            mostrarToast('Verificación de ' + n.etiqueta + ' anulada');
          })
          .catch(mostrarErrorServidor);
      }, true);
    // appConfirm con peligro pone "Eliminar" en el botón: aquí se lee mejor "Anular".
    const btnOk = document.getElementById('modal-confirm-btn');
    if (btnOk) btnOk.textContent = 'Anular';
  }

  /** Modal del administrador: elegir qué nave verificar (o anular / volver
   *  a verificar una ya verificada). */
  function abrirModalVerificarAdmin_() {
    const v = seccion.verificaciones || {};
    let elegido = null;
    const opciones = NAVES_CONTEO.map(function (n) {
      const ver = v[n.campo];
      const vacias = vaciasDeCampo_(n.campo).nombres.length;
      const cam = !ver && seccion.cambiosVerif[n.campo];
      const detalle = ver
        ? 'Verificado por ' + (ver.nombre || ver.usuario || '') + ' a las ' + (ver.hora || '') + ' · elegir para volver a verificar'
        : (cam ? 'Cambiado después de verificar' + (cam.modificadoPor ? ' (' + cam.modificadoPor + ')' : '') + '. ' : '') +
          (vacias ? vacias + (vacias === 1 ? ' tienda vacía se pondrá a 0' : ' tiendas vacías se pondrán a 0') : 'Todas las tiendas tienen dato');
      return '<div class="verif-opcion' + (ver ? ' es-verificada' : '') + '" data-campo="' + n.campo + '" role="button" tabindex="0">' +
          '<span class="verif-radio"></span>' +
          '<span class="verif-opcion-textos"><span class="verif-opcion-titulo">' + escapeHtml(n.nave) + ' · columna ' + escapeHtml(n.etiqueta) + '</span>' +
          '<span class="verif-opcion-detalle' + (!ver && vacias ? ' con-vacias' : '') + '">' + escapeHtml(detalle) + '</span></span>' +
          (ver
            ? '<span class="verif-estado ok">' + SVG_CHECK_VERIF_ + 'Verificado</span><button type="button" class="verif-btn-anular" data-anular="' + n.campo + '">Anular</button>'
            : (cam ? '<span class="verif-estado modificada">' + SVG_AVISO_VERIF_ + 'Cambiado</span>' : '<span class="verif-estado">Pendiente</span>')) +
        '</div>';
    }).join('');

    prepararModalCustom_('medio');
    const custom = document.getElementById('modal-custom');
    custom.innerHTML =
      '<div class="verif-modal">' +
        '<div class="verif-modal-titulo">¿Qué nave quieres verificar?</div>' +
        '<div class="verif-modal-sub">' + escapeHtml(parsearNombreAgrupacion(seccion.nombre).titulo) + ' · ' + escapeHtml(formatearFechaLarga(fecha)) + '</div>' +
        '<div class="verif-opciones">' + opciones + '</div>' +
        '<div class="verif-modal-nota">Queda registrado a tu nombre. Las tiendas vacías de esa columna se ponen a 0 y en Inicio el check de esa nave se pone en verde.</div>' +
      '</div>';
    const actions = document.getElementById('modal-actions');
    actions.innerHTML =
      '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
      '<button class="modal-confirm verif-confirmar" id="modal-confirm-btn" disabled>Elige una nave</button>';
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-cancel-btn').onclick = cerrarModal;
    const btnOk = document.getElementById('modal-confirm-btn');

    custom.querySelectorAll('.verif-opcion').forEach(function (op) {
      const elegir = function () {
        custom.querySelectorAll('.verif-opcion').forEach(function (o) { o.classList.remove('elegida'); });
        op.classList.add('elegida');
        elegido = op.getAttribute('data-campo');
        const n = naveDeCampo_(elegido);
        btnOk.disabled = false;
        btnOk.textContent = (v[elegido] ? 'Volver a verificar ' : 'Verificar ') + n.etiqueta;
      };
      op.addEventListener('click', function (e) { if (e.target.closest('.verif-btn-anular')) return; elegir(); });
      op.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(); } });
    });
    custom.querySelectorAll('.verif-btn-anular').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        cerrarModal();
        anularVerificacion_(b.getAttribute('data-anular'));
      };
    });
    btnOk.onclick = function () {
      if (!elegido) return;
      cerrarModal();
      ejecutarVerificacion_(elegido);
    };
  }

  pintarVerificaciones_();

  const btnHeaderPrevision = header.querySelector('.btn-header-prevision');
  if (btnHeaderPrevision) {
    btnHeaderPrevision.onclick = function (e) {
      e.stopPropagation();
      // El botón se ve siempre, pero enviar requiere el permiso "Enviar previsión"
      // (el backend lo vuelve a comprobar en enviar_prevision_agencia).
      if (!tienePermiso('enviar_prevision')) { mostrarModalSinPermiso(); return; }
      abrirEnvioConLimite_('prevision');
    };
  }

  const btnHeaderDefinitivo = header.querySelector('.btn-header-definitivo');
  if (btnHeaderDefinitivo) {
    btnHeaderDefinitivo.onclick = function (e) {
      e.stopPropagation();
      // Igual que la previsión: requiere el permiso "Enviar definitivo"
      // (el backend lo vuelve a comprobar en enviar_definitivo_agencia).
      if (!tienePermiso('enviar_definitivo')) { mostrarModalSinPermiso(); return; }
      abrirEnvioConLimite_('definitivo');
    };
  }

  /**
   * Previsión / Definitivo: si alguna tienda (con datos en el TOTAL) está por
   * encima de su límite, primero se pide confirmar cuántos palets se cargan
   * en el camión (mostrarModalConfirmarPalets); esos números sustituyen al
   * TOTAL de esas tiendas en el email. Si no hay ninguna pasada, se va
   * directo al resumen de siempre.
   */
  function abrirEnvioConLimite_(tipo) {
    // Hay carga guardada (ajustada a mano o de la previsión): antes de nada
    // se pregunta si es correcta, o se pide verificarla si cambió el conteo.
    if (cargaEditable_()) {
      const titulo = parsearNombreAgrupacion(seccion.nombre).titulo;
      const fechaTexto = formatearFechaLarga(fecha);
      const revisar = tiendasARevisar_();
      if (Object.keys(revisar).length) {
        if (puedeAjustarCarga_()) abrirAjustarCarga_(tipo, function () { continuarEnvio_(tipo); });
        else mostrarModalCargaPendiente({ titulo: titulo, fechaTexto: fechaTexto, tipo: tipo, lista: listaCargaEfectiva_(), revisar: revisar, camiones: camionesCarga_() });
        return;
      }
      mostrarModalCargaCorrecta({
        titulo: titulo,
        fechaTexto: fechaTexto,
        tipo: tipo,
        carga: seccion.carga,
        lista: listaCargaEfectiva_(),
        onSi: function () { continuarEnvio_(tipo); },
        onModificar: puedeAjustarCarga_() ? function () { abrirAjustarCarga_(tipo, function () { continuarEnvio_(tipo); }); } : null
      });
      return;
    }
    continuarEnvio_(tipo);
  }

  // Envío de siempre. Las tiendas con carga ya ajustada no vuelven a salir
  // en el modal de límite: su número ya está decidido.
  function continuarEnvio_(tipo) {
    const resumen = calcularResumenEnvio();
    const guardados = ajustesGuardados_();
    const contadosAhora = {};
    filasCargaActuales_().forEach(function (f) { if (!f.cerrada) contadosAhora[f.nombre] = f.contados; });
    Object.keys(guardados).forEach(function (nombre) {
      resumen.totalPalets += guardados[nombre] - (contadosAhora[nombre] || 0);
    });
    resumen.excedidas = resumen.excedidas.map(function (e) {
      if (!Object.prototype.hasOwnProperty.call(guardados, e.nombre)) return e;
      return Object.assign({}, e, { carga: guardados[e.nombre], total: guardados[e.nombre] + e.otros, yaDecidida: true });
    }).filter(function (e) { return e.total > e.limite; });
    const aConfirmar = resumen.excedidas.filter(function (e) { return e.carga > 0 && !e.yaDecidida; });
    const seguir = function (ajustes) {
      if (ajustes) {
        resumen.excedidas.forEach(function (e) {
          if (Object.prototype.hasOwnProperty.call(ajustes, e.nombre)) {
            resumen.totalPalets += ajustes[e.nombre] - e.carga;
          }
        });
        // En el resumen solo siguen como "por encima del límite" las que
        // se hayan confirmado aun así por encima.
        resumen.excedidas = resumen.excedidas.filter(function (e) {
          const cargar = Object.prototype.hasOwnProperty.call(ajustes, e.nombre) ? ajustes[e.nombre] : e.carga;
          return cargar + e.otros > e.limite;
        }).map(function (e) {
          const cargar = Object.prototype.hasOwnProperty.call(ajustes, e.nombre) ? ajustes[e.nombre] : e.carga;
          return Object.assign({}, e, { total: cargar + e.otros });
        });
      }
      // Lo que va en el email: la carga ya ajustada + lo confirmado ahora.
      const todos = Object.assign({}, guardados, ajustes || {});
      mostrarModalEnviarAgencia(resumen, function (callback) {
        enviarSeccion(tipo, callback, Object.keys(todos).length ? todos : null);
      }, tipo);
    };
    if (aConfirmar.length) {
      mostrarModalConfirmarPalets(resumen, aConfirmar, tipo, seguir);
    } else {
      seguir(null);
    }
  }

  const btnHeaderInformatica = header.querySelector('.btn-header-informatica');
  if (btnHeaderInformatica) {
    btnHeaderInformatica.onclick = function (e) {
      e.stopPropagation();
      // Requiere el permiso "Enviar a informática"
      // (el backend lo vuelve a comprobar en enviar_informatica_agencia).
      if (!tienePermiso('enviar_informatica')) { mostrarModalSinPermiso(); return; }
      mostrarModalEnviarAgencia(calcularResumenEnvio(), function (callback) {
        enviarSeccion('informatica', callback);
      }, 'informatica');
    };
  }

  // Enlaza el click de "Deshacer envío" sobre el botón que se le pase: sirve
  // tanto para el que ya viniera en el HTML inicial del panel (si la página
  // se carga con la agrupación ya enviada hoy) como para el que se añade
  // dinámicamente justo después de un envío definitivo (ver
  // aplicarResultadoEnvio_ más abajo), sin duplicar esta lógica.
  function bindBotonDeshacerEnvio_(btnDeshacerEnvio) {
    if (!btnDeshacerEnvio) return;
    btnDeshacerEnvio.onclick = function (e) {
      e.stopPropagation();
      appConfirm(
        'Deshacer envío',
        'Vas a deshacer el envío de "' + seccion.nombre + '". Se quitará la marca de enviado y se recuperarán los datos para poder seguir editándolos. Solo puedes hacer esto el mismo día en que se envió. ¿Seguro que quieres continuar?',
        function () {
          btnDeshacerEnvio.disabled = true;
          google.script.run
            .withSuccessHandler(function () {
              btnDeshacerEnvio.disabled = false;
              cargarConteoDia();
              cargarCalendario();
            })
            .withFailureHandler(function (err) {
              btnDeshacerEnvio.disabled = false;
              mostrarErrorServidor(err);
            })
            .deshacerEnvioSeccion(dia, seccion.nombre, fecha);
        },
        true
      );
    };
  }
  bindBotonDeshacerEnvio_(header.querySelector('.btn-deshacer-envio'));

  const btnPdf = header.querySelector('.btn-pdf-seccion');
  if (btnPdf) {
    btnPdf.onclick = function (e) {
      e.stopPropagation();
      generarPdfSeccion(seccion, dia, fecha, tableWrap);
    };
  }

  const btnExcel = header.querySelector('.btn-excel-seccion');
  if (btnExcel) {
    btnExcel.onclick = function (e) {
      e.stopPropagation();
      generarExcelSeccion(seccion, dia, fecha, tableWrap, btnExcel);
    };
  }

  const btnPdfEspecial = header.querySelector('.btn-pdf-especial-seccion');
  if (btnPdfEspecial) {
    btnPdfEspecial.onclick = function (e) {
      e.stopPropagation();
      // Se exporta lo que se está viendo: si está abierta la pestaña
      // "Carga ajustada" (o "Carga enviada"), sale la carga con sus
      // números ajustados; si está "Ver conteo real sin ajustar", lo contado.
      const conAjuste = !vistaAjustadaWrap.hidden && !!vistaAjustadaWrap.querySelector('table.conteo');
      generarPdfEspecialSeccion(seccion, dia, fecha, conAjuste ? vistaAjustadaWrap : tableWrap);
    };
  }

  /** Recopila, en vivo desde los inputs actuales, los datos para el modal de envío. */
  function calcularResumenEnvio() {
    let totalTiendas = 0;
    let tiendasConDatos = 0;
    const pendientes = [];
    const excedidas = [];
    const pesoFaltante = [];
    tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
      if (tr.classList.contains('fila-grupo-header') || tr.classList.contains('fila-cerrada') || tr.classList.contains('fila-sale-excepcion')) return;
      totalTiendas++;
      const totalInput = tr.querySelector('input[data-campo="total"]');
      const valor = totalInput ? parseFloat(totalInput.value) : NaN;
      if (!isNaN(valor) && valor > 0) tiendasConDatos++;
      else pendientes.push(tr.getAttribute('data-nombre') || '');
      const limite = parseFloat(tr.getAttribute('data-limite'));
      // El VIERNES cuenta para el límite de la tienda (igual que el aviso
      // de la fila), aunque no vaya en la carga.
      const viernesInput = tr.querySelector('input[data-campo="viernes"]');
      const vie = viernesInput && viernesInput.value !== '' ? (parseFloat(viernesInput.value) || 0) : 0;
      // Y lo mismo con el DOMINGO.
      const domingoInput = tr.querySelector('input[data-campo="casillaDomingo"]');
      const dom = domingoInput && domingoInput.value !== '' ? (parseFloat(domingoInput.value) || 0) : 0;
      const valorConViernes = (isNaN(valor) ? 0 : valor) + vie + dom;
      if (valorConViernes > 0 && !isNaN(limite) && limite > 0 && valorConViernes > limite) {
        const carga = isNaN(valor) ? 0 : valor;
        const otros = vie + dom;
        excedidas.push({
          nombre: tr.getAttribute('data-nombre') || '',
          total: valorConViernes,
          limite: limite,
          exceso: valorConViernes - limite,
          // Para el modal "Confirma el número de palets a cargar": carga es
          // el TOTAL que va en el email; VIERNES + DOMINGO cuentan para el
          // límite pero no van en el email, así que se descuentan del valor
          // propuesto.
          carga: carga,
          otros: otros,
          sugerido: Math.max(0, Math.min(carga, limite - otros))
        });
      }
      if (seccion.tienePeso && !isNaN(valor) && valor > 0) {
        const pesoInput = tr.querySelector('input[data-campo="peso"]');
        const peso = pesoInput ? parseFloat(pesoInput.value) : NaN;
        // Doble salida: el PESO lo pone la agrupación de origen, no esta.
        const pesoDeOtra = pesoInput && pesoInput.classList.contains('celda-otra-agencia');
        if (!pesoDeOtra && (isNaN(peso) || peso <= 0)) pesoFaltante.push(tr.getAttribute('data-nombre') || '');
      }
    });
    let totalPalets = 0;
    tableWrap.querySelectorAll('input.celda-total').forEach(function (inp) {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) totalPalets += v;
    });
    return {
      nombre: seccion.nombre,
      fechaTexto: formatearFechaLarga(fecha),
      totalTiendas: totalTiendas,
      tiendasConDatos: tiendasConDatos,
      pendientes: pendientes,
      totalPalets: totalPalets,
      excedidas: excedidas,
      pesoFaltante: pesoFaltante
    };
  }

  // ajustes (opcional): { 'NOMBRE TIENDA': palets } confirmados en el modal
  // de límite; sustituyen al TOTAL de esas tiendas en el email.
  function enviarSeccion(tipo, callback, ajustes) {
    // "Enviar a informática" con el Definitivo ya enviado: no hay nada que
    // guardar (el conteo está archivado), se manda directamente.
    if (tipo === 'informatica' && seccion.estado === 'enviado') {
      const btnInf = header.querySelector('.btn-header-informatica');
      if (btnInf) btnInf.disabled = true;
      google.script.run
        .withSuccessHandler(function () {
          if (btnInf) btnInf.disabled = false;
          if (callback) callback(true, 'Informática avisada correctamente');
        })
        .withFailureHandler(function (err) {
          if (btnInf) btnInf.disabled = false;
          if (callback) callback(false, (err && err.message) ? err.message : String(err));
        })
        .enviarInformaticaAgencia(dia, seccion.nombre, fecha);
      return;
    }
    if (!editable) { if (callback) callback(false, 'Esta agrupación ya no se puede modificar.'); return; }
    const btnPrevision = header.querySelector('.btn-header-prevision');
    const btnDefinitivo = header.querySelector('.btn-header-definitivo');
    const btnInformatica = header.querySelector('.btn-header-informatica');
    if (btnPrevision) btnPrevision.disabled = true;
    if (btnDefinitivo) btnDefinitivo.disabled = true;
    if (btnInformatica) btnInformatica.disabled = true;
    const metodo = tipo === 'definitivo' ? 'enviarDefinitivoAgencia'
      : (tipo === 'informatica' ? 'enviarInformaticaAgencia' : 'enviarPrevisionAgencia');
    // Guarda inmediatamente (sin esperar el debounce) y, si todo va bien, envía.
    autoguardarSeccion(function (ok) {
      if (!ok) {
        if (btnPrevision) btnPrevision.disabled = false;
        if (btnDefinitivo) btnDefinitivo.disabled = false;
        if (btnInformatica) btnInformatica.disabled = false;
        if (callback) callback(false, 'No se han podido guardar los datos. Inténtalo de nuevo.');
        return;
      }
      google.script.run
        .withSuccessHandler(function (res) {
          if (btnPrevision) btnPrevision.disabled = false;
          if (btnDefinitivo) btnDefinitivo.disabled = false;
          if (btnInformatica) btnInformatica.disabled = false;
          // "Enviar a informática" no cambia nada en el panel (ni badges ni
          // bloqueos): solo manda el email a transporte@primor.eu.
          if (tipo === 'informatica') {
            if (callback) callback(true, 'Informática avisada correctamente');
            return;
          }
          aplicarResultadoEnvio_(tipo, res);
          // El cuadrante (este panel) ya se ha actualizado en vivo, sin
          // recargar nada; solo se refresca el calendario mensual (ligero,
          // sin loader de página) para que la celda del día refleje el
          // nuevo estado (pendiente/parcial/enviado).
          cargarCalendario();
          const mensaje = tipo === 'definitivo' 
          ? 'Definitivo enviado correctamente' 
          : 'Previsión enviada correctamente';

if (callback) callback(true, mensaje);
        })
        .withFailureHandler(function (err) {
          if (btnPrevision) btnPrevision.disabled = false;
          if (btnDefinitivo) btnDefinitivo.disabled = false;
          if (btnInformatica) btnInformatica.disabled = false;
          if (callback) callback(false, (err && err.message) ? err.message : String(err));
        })
        [metodo](dia, seccion.nombre, fecha, (tipo === 'informatica') ? null : (ajustes || null));
    });
  }

  // Tras un envío, la carga vigente pasa a ser la que se acaba de mandar
  // (el siguiente sondeo trae la misma desde el servidor).
  function cargaTrasEnvio_(tipo, resultado) {
    if (seccion.carga === undefined) return; // servidor antiguo
    const ahora = new Date();
    seccion.carga = {
      origen: tipo,
      hora: ('0' + ahora.getHours()).slice(-2) + ':' + ('0' + ahora.getMinutes()).slice(-2),
      por: SESSION_NOMBRE || (resultado && resultado.enviadoPor) || '',
      lista: (resultado && Array.isArray(resultado.listaCarga)) ? resultado.listaCarga : (seccion.carga ? seccion.carga.lista : null),
      // Los camiones que salieron en el email (el servidor los toma de la carga vigente).
      camiones: (resultado && resultado.camiones !== undefined) ? resultado.camiones : camionesCarga_()
    };
  }

  /**
   * Aplica el resultado de un envío de previsión/definitivo directamente
   * sobre el panel ya pintado en pantalla, sin volver a pedir todo el
   * cuadrante al servidor (mismo espíritu que quitarDeCacheFestivos_ en
   * "Gestión festivos": actualizar en vivo el estado local + el DOM).
   *
   *  - 'prevision': no bloquea nada; solo se añade/actualiza el badge
   *    "Previsión enviada" y se oculta el botón de "Enviar Previsión".
   *  - 'definitivo': la agrupación pasa a "enviado": se bloquean los
   *    inputs de la tabla, se ocultan los botones de envío, se actualiza
   *    el badge de estado y, si es hoy, aparece "Deshacer envío".
   */
  function aplicarResultadoEnvio_(tipo, resultado) {
    if (tipo === 'prevision') {
      seccion.previsionEnviada = (resultado && resultado.previsionEnviada) || seccion.previsionEnviada || '';
      seccion.previsionEnviadaPor = (resultado && resultado.enviadoPor) || seccion.previsionEnviadaPor || '';

      // El aviso de "Previsión enviada" se pinta en el sobre
      // (actualizarMenuEnvios_ -> pintarEstadoSobre_).

      const btnPrevisionEl = header.querySelector('.btn-header-prevision');
      if (btnPrevisionEl) btnPrevisionEl.remove();
      actualizarMenuEnvios_();
      actualizarFilaMeta_();
      actualizarMenuRapidoItem_(seccion);
      cargaTrasEnvio_('prevision', resultado);
      actualizarEstadoCarga_();
      actualizarBotonListaCarga_();
      return;
    }

    // tipo === 'definitivo'
    seccion.estado = 'enviado';
    seccion.horaEnvio = (resultado && resultado.horaEnvio) || seccion.horaEnvio || '';
    seccion.enviadoPor = (resultado && resultado.enviadoPor) || seccion.enviadoPor || '';
    // OJO: seccion.previsionEnviada NO se limpia aquí a propósito: el
    // backend (Estado_Previsiones) tampoco se borra al enviar el
    // definitivo, así que si se había mandado antes una previsión, su
    // badge se sigue viendo junto al de "Definitivo enviado" -- igual que
    // pasaría si recargases la página. Si aquí lo ocultáramos, quedaría
    // una diferencia entre "recién enviado, en esta sesión" y "recargado
    // desde cero", que es justo lo que queremos evitar.
    editable = false;

    panel.classList.remove('estado-pendiente', 'estado-progreso');
    panel.classList.add('estado-enviado', 'no-editable');

    const badgeEstadoExistente = header.querySelector('.badge-enviado, .badge-progreso');
    if (badgeEstadoExistente) badgeEstadoExistente.remove();

    const wrapTmp = document.createElement('div');
    wrapTmp.innerHTML = badgeEstadoCabecera_(seccion);
    const nuevoBadgeEstado = wrapTmp.firstElementChild;
    const countEl = header.querySelector('.name-row .count');
    if (nuevoBadgeEstado && countEl) countEl.insertAdjacentElement('afterend', nuevoBadgeEstado);

    const btnPrevisionEl = header.querySelector('.btn-header-prevision');
    if (btnPrevisionEl) btnPrevisionEl.remove();
    const btnDefinitivoEl = header.querySelector('.btn-header-definitivo');
    if (btnDefinitivoEl) btnDefinitivoEl.remove();
    // "Enviar a informática" NO se quita: sigue disponible tras el definitivo.
    actualizarBotonesEnvio_();
    cargaTrasEnvio_('definitivo', resultado);
    const badgeRevisar = header.querySelector('.badge-carga-revisar');
    if (badgeRevisar) badgeRevisar.remove();
    actualizarBotonListaCarga_();
    pintarEstadoBloqueo_();

    if (false && esHoy && !header.querySelector('.btn-deshacer-envio')) { // papelera "Deshacer envío" quitada
      const wrapBtn = document.createElement('div');
      wrapBtn.innerHTML = htmlBotonDeshacerEnvio_();
      const nuevoBtn = wrapBtn.firstElementChild;
      const badges = header.querySelector('.seccion-header-badges');
      const badgePrev = badges && badges.querySelector('.badge-prevision');
      if (badgePrev) badgePrev.insertAdjacentElement('afterend', nuevoBtn);
      else if (badges) badges.insertBefore(nuevoBtn, badges.firstChild);
      else header.appendChild(nuevoBtn);
      bindBotonDeshacerEnvio_(nuevoBtn);
    }

    tableWrap.querySelectorAll('input.celda, input.celda-total').forEach(function (input) { input.disabled = true; });
    tableWrap.querySelectorAll('.btn-cerrar-tienda, .btn-reabrir, input.celda-no').forEach(function (btn) { btn.disabled = true; });
    actualizarMenuRapidoItem_(seccion);
  }

  // AUTOREFRESCO EN VIVO (varios ordenadores a la vez): antes de devolver
  // el panel se le cuelgan dos cosas para que refrescarConteoDiaEnVivo_()
  // sepa si puede sustituirlo sin molestar:
  //  - _firma: "foto" de los datos con los que se pintó, para no
  //    reconstruir nada si el próximo sondeo trae exactamente lo mismo.
  //  - _enUso: si hay cambios sin guardar, un guardado en curso, o el
  //    foco está dentro de este panel, se considera que el usuario está
  //    trabajando aquí y el refresco automático no debe tocarlo todavía
  //    (se reintentará en el siguiente sondeo).
  // La columna TOTAL de la tabla real se calcula al enlazar cada fila (más
  // arriba), después del primer pintado: se repinta la vista ajustada ya
  // con todos los totales.
  if (seccion.carga !== undefined) pintarEstadoBloqueo_();
  actualizarFilaMeta_();

  panel._firma = JSON.stringify([seccion, dia, esHoy]);
  panel._enUso = function () {
    // OJO: document.activeElement es por documento, no por ventana. Si el
    // usuario hizo clic en una casilla de esta agrupación y luego cambió de
    // ventana/pestaña SIN volver a tocar nada en esta página, el navegador
    // no dispara "focusout" (el foco no se ha movido a otro elemento del
    // DOM) y esa casilla se queda como activeElement para siempre, aunque
    // la ventana ya no esté activa. Sin el "document.hasFocus() &&" de abajo,
    // eso bloquearía el autorefresco de esta agrupación indefinidamente. Por
    // eso el "cursor puesto en un campo" solo cuenta como "en uso" si la
    // ventana realmente tiene el foco en este instante; los cambios sin
    // guardar o un guardado en curso sí protegen siempre, foco o no.
    if (MENU_ENVIOS_ABIERTO_ && (MENU_ENVIOS_ABIERTO_.menu === menuEnvios || MENU_ENVIOS_ABIERTO_.menu === menuDescargas)) return true;
    return hayCambiosSinGuardar || guardandoAhora_ || (document.hasFocus() && panel.contains(document.activeElement));
  };

  return panel;
}

/* ---------------- VERIFICAR CONTEO: helpers compartidos ---------------- */

const SVG_CHECK_VERIF_ = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const SVG_AVISO_VERIF_ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';

/** Número de conteo para los textos de cambios ("vacío" si no hay). */
function numCambioVerif_(v) { return (v === null || v === undefined || v === '') ? 'vacío' : String(v); }

/** Texto de un "cambio después de verificar" de una columna:
 *  "60 verificado por jlopez (10:42). Después cambiado por admin2 (11:18):
 *  MELILLA 3 → 5 · PARQUE CEUTA 0 → 2". */
function textoCambiosVerif_(nave, cam) {
  const lista = (cam.cambios || []).map(function (c) {
    return quitarCodigoTienda(quitarMarcadorNombre(c.tienda || '')) + ' ' + numCambioVerif_(c.antes) + ' → ' + numCambioVerif_(c.despues);
  });
  return nave.etiqueta + ' estaba verificado' + (cam.verificadoPor ? ' por ' + cam.verificadoPor : '') + (cam.verificadoHora ? ' (' + cam.verificadoHora + ')' : '') +
    '. Después lo cambió ' + (cam.modificadoPor || 'alguien') + (cam.hora ? ' (' + cam.hora + ')' : '') +
    (lista.length ? ': ' + lista.join(' · ') : '') + '. Hay que volver a verificar.';
}

const SVG_CANDADO_NAVE_ = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

/** <th> de 60 / PTA / CART.: con candado si el usuario no puede tocar esa
 *  columna, y resaltado si es la de su nave. */
function thCampoNave_(campo, etiqueta) {
  const propia = restringidoANave_() && campo === campoNaveSesion_();
  const bloqueada = !puedeEditarCampoConteo_(campo);
  return '<th data-campo="' + campo + '" class="th-campo-nave' + (propia ? ' th-nave-propia' : '') + (bloqueada ? ' th-nave-bloqueada' : '') + '"' +
    (bloqueada ? ' title="Solo lectura: columna de otra nave"' : '') + '>' +
    (bloqueada ? SVG_CANDADO_NAVE_ : '') + escapeHtml(etiqueta) + '</th>';
}

/** Deja el modal genérico (#modal-box) listo para contenido propio en
 *  #modal-custom, con el tamaño indicado ('medio' | 'ancho' | ''). */
function prepararModalCustom_(tamano) {
  const box = document.getElementById('modal-box');
  box.classList.remove('ancho', 'medio', 'usuario-form', 'peligro');
  if (tamano) box.classList.add(tamano);
  document.getElementById('modal-title').style.display = 'none';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';
  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML = '';
}

/* ---------------- MODAL DEL CANDADO ---------------- */

const SVG_CANDADO_ABIERTO_ = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>';

/** "MARIA DOLORES AGUERA HURTADO" -> "Maria Dolores Aguera Hurtado" (los
 *  números de usuario, como "43848", se quedan igual). */
function nombreLegible_(texto) {
  return String(texto || '').toLowerCase().replace(/(^|[\s\-·])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
}

/** Modal del candado: título, agrupación y fecha, una ficha con motivo /
 *  quién / hora, y lo que pasa en puntos. Con onConfirmar sale Cancelar +
 *  el botón (rojo); sin él, solo "Entendido".
 *  opts = { abierto, titulo, agrupacion, fechaTexto, ficha: [[etiqueta, valor]],
 *           puntos: [texto], nota, textoBoton, onConfirmar } */
function mostrarModalCandado_(opts) {
  prepararModalCustom_('medio');
  const custom = document.getElementById('modal-custom');
  const ficha = (opts.ficha || []).filter(function (f) { return f[1]; });
  custom.innerHTML =
    '<div class="candado-modal">' +
      '<div class="candado-modal-cab">' +
        '<span class="candado-modal-icono' + (opts.abierto ? ' abierto' : '') + '">' + (opts.abierto ? SVG_CANDADO_ABIERTO_ : SVG_CANDADO_CARGA_) + '</span>' +
        '<span><span class="candado-modal-titulo">' + escapeHtml(opts.titulo) + '</span>' +
        '<span class="candado-modal-sub">' + escapeHtml(opts.agrupacion) + (opts.fechaTexto ? ' · ' + escapeHtml(opts.fechaTexto) : '') + '</span></span>' +
      '</div>' +
      (ficha.length
        ? '<div class="candado-modal-ficha">' + ficha.map(function (f) {
            return '<div class="candado-modal-fila"><span class="candado-modal-etq">' + escapeHtml(f[0]) + '</span><span class="candado-modal-val">' + escapeHtml(f[1]) + '</span></div>';
          }).join('') + '</div>'
        : '') +
      (opts.puntos && opts.puntos.length
        ? '<ul class="candado-modal-puntos">' + opts.puntos.map(function (t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ul>'
        : '') +
      (opts.nota ? '<div class="candado-modal-nota">' + escapeHtml(opts.nota) + '</div>' : '') +
    '</div>';
  const actions = document.getElementById('modal-actions');
  if (!opts.onConfirmar) {
    actions.innerHTML = '<button class="modal-confirm" id="modal-confirm-btn">Entendido</button>';
    document.getElementById('modal-overlay').style.display = 'flex';
    document.getElementById('modal-confirm-btn').onclick = cerrarModal;
    return;
  }
  // Por seguridad, desbloquear no es un botón: hay que ARRASTRAR el
  // candado hasta el final de la barra. Si se suelta antes, vuelve.
  actions.innerHTML =
    '<div class="desliza-fila">' +
      '<div class="desliza" role="slider" aria-label="' + escapeAttr(opts.textoBoton || 'Desliza para desbloquear') + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
        '<span class="desliza-relleno"></span>' +
        '<span class="desliza-texto">' + escapeHtml(opts.textoBoton || 'Desliza para desbloquear') + ' &#8594;</span>' +
        '<span class="desliza-mando" tabindex="0" title="Arrastra hasta el final para desbloquear">' + SVG_CANDADO_CARGA_ + '</span>' +
      '</div>' +
      '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '</div>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  activarDeslizador_(actions.querySelector('.desliza'), function () {
    cerrarModal();
    opts.onConfirmar();
  });
}

/** Barra "desliza para desbloquear": arrastrar el mando (ratón o dedo)
 *  hasta el final llama a onCompleto. Sin animaciones (en algunos PCs no
 *  se ven): el mando sigue al puntero y, si se suelta antes, vuelve. Con
 *  teclado: flecha derecha avanza a pasos, flecha izquierda retrocede. */
function activarDeslizador_(barra, onCompleto) {
  const mando = barra.querySelector('.desliza-mando');
  const relleno = barra.querySelector('.desliza-relleno');
  const texto = barra.querySelector('.desliza-texto');
  let max = 0, x = 0, inicio = null, hecho = false;
  function medir() { max = Math.max(0, barra.clientWidth - mando.offsetWidth - 8); }
  function poner(v) {
    x = Math.max(0, Math.min(max, v));
    mando.style.transform = 'translateX(' + x + 'px)';
    relleno.style.width = (x + mando.offsetWidth + 4) + 'px';
    texto.style.opacity = max ? String(Math.max(0, 1 - x / (max * 0.6))) : '1';
    barra.setAttribute('aria-valuenow', String(max ? Math.round(x / max * 100) : 0));
  }
  function completar() {
    if (hecho) return;
    hecho = true;
    poner(max);
    barra.classList.add('completo');
    mando.innerHTML = SVG_CANDADO_ABIERTO_;
    setTimeout(onCompleto, 120);
  }
  function soltar() {
    if (inicio === null || hecho) return;
    inicio = null;
    barra.classList.remove('arrastrando');
    if (x >= max * 0.95) completar(); else poner(0);
  }
  mando.addEventListener('pointerdown', function (e) {
    if (hecho) return;
    e.preventDefault();
    medir();
    inicio = e.clientX - x;
    barra.classList.add('arrastrando');
    try { mando.setPointerCapture(e.pointerId); } catch (err) { /* navegadores antiguos */ }
  });
  mando.addEventListener('pointermove', function (e) {
    if (inicio === null || hecho) return;
    poner(e.clientX - inicio);
  });
  mando.addEventListener('pointerup', soltar);
  mando.addEventListener('pointercancel', soltar);
  mando.addEventListener('lostpointercapture', soltar);
  mando.addEventListener('keydown', function (e) {
    if (hecho) return;
    medir();
    if (e.key === 'ArrowRight') { e.preventDefault(); poner(x + max / 5); if (x >= max) completar(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); poner(x - max / 5); }
  });
  medir();
  poner(0);
}

/** Confirmación del operario antes de verificar su columna: dice qué
 *  tiendas vacías se van a poner a 0. */
function mostrarModalConfirmarVerificacion_(seccion, fecha, nave, nombresVacias, onConfirmar) {
  prepararModalCustom_('medio');
  const custom = document.getElementById('modal-custom');
  custom.innerHTML =
    '<div class="verif-modal">' +
      '<div class="verif-modal-titulo">' + SVG_CHECK_VERIF_ + 'Verificar conteo · ' + escapeHtml(nave.etiqueta) + ' (' + escapeHtml(nave.nave) + ')</div>' +
      '<div class="verif-modal-sub">' + escapeHtml(parsearNombreAgrupacion(seccion.nombre).titulo) + ' · ' + escapeHtml(formatearFechaLarga(fecha)) + '</div>' +
      (nombresVacias.length
        ? '<div class="verif-vacias">' +
            '<div class="verif-vacias-titulo">' + nombresVacias.length + (nombresVacias.length === 1 ? ' tienda sin dato en ' : ' tiendas sin dato en ') + escapeHtml(nave.etiqueta) + ' se pondrá' + (nombresVacias.length === 1 ? '' : 'n') + ' a 0:</div>' +
            '<div class="modal-envio-chips">' + nombresVacias.map(function (t) { return '<span class="modal-envio-chip">' + escapeHtml(quitarCodigoTienda(quitarMarcadorNombre(t))) + '</span>'; }).join('') + '</div>' +
          '</div>'
        : '<div class="modal-envio-ok">' + SVG_CHECK_VERIF_ + '<span>Todas las tiendas tienen dato en ' + escapeHtml(nave.etiqueta) + '</span></div>') +
      '<div class="verif-modal-nota">Se guarda el conteo y en Inicio se marcará en verde el check de ' + escapeHtml(nave.etiqueta) + '. Las columnas de las otras naves no se tocan. Si después cambias algún número de ' + escapeHtml(nave.etiqueta) + ', habrá que volver a verificar.</div>' +
    '</div>';
  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm verif-confirmar" id="modal-confirm-btn">Sí, verificar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () { cerrarModal(); onConfirmar(); };
}


/** Badge de estado de la cabecera de la agrupación: "En progreso" como
 *  siempre; "Definitivo enviado" ya no sale aquí, se ve en el sobre del
 *  email (en verde, con quién y cuándo). */
function badgeEstadoCabecera_(seccion) {
  return seccion.estado === 'enviado' ? '' : badgeEstado(seccion);
}
