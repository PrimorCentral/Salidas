/* SALIDAS · js/conteos-dia.js — Conteos diarios: contenido del día y autorefresco */

/* ---------------- CONTENIDO DEL DÍA ---------------- */
function cargarConteoDia() {
  const cont = document.getElementById('dia-contenido');
  cont.innerHTML = '<div class="loader"><span class="spinner-navy"></span><div>Cargando conteo…</div></div>';
  document.getElementById('resumen-body').innerHTML = '<div class="resumen-vacio">Cargando…</div>';
  llamarApi_('getConteoDia', [ESTADO.fecha])
    .then(renderContenidoDia)
    .catch(mostrarErrorServidor);
  iniciarAutorefrescoConteoDia_();
}

/**
 * AUTORREFRESCO EN VIVO: varias personas pueden tener esta misma pantalla
 * abierta a la vez en ordenadores distintos, así que cada cierto tiempo
 * se vuelve a consultar el conteo del día en silencio, para que si otro
 * ordenador guarda o envía algo, aquí se vea sin tener que recargar la
 * página a mano.
 *
 * La regla de oro es que NUNCA debe notarse mientras se está trabajando:
 * - No se toca ninguna agrupación con cambios sin guardar, un guardado en
 *   curso, o el foco (el cursor escribiendo) dentro de ella — ver
 *   panel._enUso() en crearSeccionPanel. Esa agrupación se deja tal cual
 *   y se reintenta en el siguiente sondeo.
 * - Una agrupación "libre" solo se reconstruye si sus datos han cambiado
 *   de verdad (se compara con panel._firma); si no hay nada nuevo no se
 *   toca el DOM para no perder el scroll ni el estado colapsado/expandido.
 * - Nunca se mueve el scroll ni se muestra ningún loader/spinner: es un
 *   refresco silencioso, no una recarga.
 * - Se pausa solo cuando la pestaña está en segundo plano o cuando se
 *   sale de la pantalla de conteos, y se reanuda al volver.
 */
let CONTEO_REFRESCO_INTERVALO_ = null;
let CONTEO_REFRESCO_EN_VUELO_ = false;
const CONTEO_REFRESCO_MS_ = 5000;

// Temporizador visual (topbar, junto al reloj): puramente decorativo, no
// afecta en nada a cuándo se sondea de verdad — solo pinta la cuenta atrás
// hasta la próxima vez que el setInterval de arriba vaya a mirar. Ver
// actualizarTemporizadorRefrescoConteo_().
let CONTEO_REFRESCO_PROX_TS_ = null; // marca de tiempo (Date.now()) del próximo sondeo
let CONTEO_REFRESCO_TICK_INTERVALO_ = null; // repinta el número cada segundo

function iniciarAutorefrescoConteoDia_() {
  if (CONTEO_REFRESCO_INTERVALO_) clearInterval(CONTEO_REFRESCO_INTERVALO_);
  CONTEO_REFRESCO_PROX_TS_ = Date.now() + CONTEO_REFRESCO_MS_;
  CONTEO_REFRESCO_INTERVALO_ = setInterval(function () {
    CONTEO_REFRESCO_PROX_TS_ = Date.now() + CONTEO_REFRESCO_MS_;
    if (ESTADO.vista !== 'conteos') {
      clearInterval(CONTEO_REFRESCO_INTERVALO_);
      CONTEO_REFRESCO_INTERVALO_ = null;
      CONTEO_REFRESCO_PROX_TS_ = null;
      return;
    }
    if (document.hidden) return; // pestaña en segundo plano: no gastar peticiones de balde
    refrescarConteoDiaEnVivo_();
  }, CONTEO_REFRESCO_MS_);
  iniciarTicTacRefrescoConteo_();
}

/** Arranca (si no estaba ya en marcha) el repintado cada segundo del
 *  numerito de cuenta atrás del topbar. Se para solo en cuanto se sale de
 *  la vista de conteos (ver actualizarTemporizadorRefrescoConteo_), así que
 *  no hace falta pararlo a mano al cambiar de pantalla. */
function iniciarTicTacRefrescoConteo_() {
  if (CONTEO_REFRESCO_TICK_INTERVALO_) return; // ya en marcha, no duplicar
  actualizarTemporizadorRefrescoConteo_();
  CONTEO_REFRESCO_TICK_INTERVALO_ = setInterval(actualizarTemporizadorRefrescoConteo_, 1000);
}

function actualizarTemporizadorRefrescoConteo_() {
  const el = document.getElementById('topbar-refresco-conteo');
  if (!el) return;
  if (ESTADO.vista !== 'conteos') {
    el.textContent = '';
    if (CONTEO_REFRESCO_TICK_INTERVALO_) { clearInterval(CONTEO_REFRESCO_TICK_INTERVALO_); CONTEO_REFRESCO_TICK_INTERVALO_ = null; }
    return;
  }
  if (CONTEO_REFRESCO_PROX_TS_ === null) { el.textContent = ''; return; }
  const segundos = Math.max(0, Math.round((CONTEO_REFRESCO_PROX_TS_ - Date.now()) / 1000));
  el.innerHTML = '<span class="punto-refresco"></span>' + segundos + 's';
}

/** Pequeño destello del puntito (se pone del color ámbar un instante) cada
 *  vez que de verdad se ha completado un sondeo, para poder confirmar de
 *  un vistazo que el autorefresco sigue vivo sin tener que fijarse en el
 *  número. Puramente visual: no cambia ningún dato ni ningún temporizador. */
function marcarRefrescoConteoRealizado_() {
  const el = document.getElementById('topbar-refresco-conteo');
  if (!el) return;
  el.classList.add('recien-refrescado');
  setTimeout(function () { el.classList.remove('recien-refrescado'); }, 900);
}

function refrescarConteoDiaEnVivo_() {
  if (CONTEO_REFRESCO_EN_VUELO_) return; // ya hay un sondeo en curso, no solapar
  const fechaDelSondeo = ESTADO.fecha;
  CONTEO_REFRESCO_EN_VUELO_ = true;
  llamarApi_('getConteoDia', [fechaDelSondeo])
    .then(function (data) {
      // Si mientras tanto el usuario cambió de fecha o de pantalla, esta
      // respuesta ya no vale: se descarta en silencio.
      if (ESTADO.vista !== 'conteos' || ESTADO.fecha !== fechaDelSondeo) return;
      marcarRefrescoConteoRealizado_();
      aplicarRefrescoConteoDiaEnVivo_(data);
    })
    .catch(function () {
      // Un fallo puntual del sondeo en segundo plano no debe interrumpir
      // a nadie con un error: se reintenta solo en el siguiente ciclo.
    })
    .finally(function () { CONTEO_REFRESCO_EN_VUELO_ = false; });
}

function aplicarRefrescoConteoDiaEnVivo_(data) {
  ESTADO.datosDiaActual = data;
  // El resumen del día y el acceso rápido no tienen inputs ni foco que
  // proteger, así que se repintan siempre enteros: es barato y mantiene
  // esos contadores/puntos de estado siempre al día.
  renderResumenDia(data);
  renderMenuRapido(data);

  if (data.bloqueada || !data.dia || !data.secciones || !data.secciones.length) return;

  const cont = document.getElementById('dia-contenido');
  if (!cont) return;
  const panelesActuales = cont.querySelectorAll('.seccion-panel[data-seccion-key]');
  const panelesPorClave = {};
  panelesActuales.forEach(function (p) { panelesPorClave[p.getAttribute('data-seccion-key')] = p; });

  data.secciones.forEach(function (seccion) {
    const panelViejo = panelesPorClave[seccion.nombre];
    if (!panelViejo) return; // agrupación nueva que no estaba antes: se verá al recargar/cambiar de fecha, no forzamos nada aquí
    if (panelViejo._enUso && panelViejo._enUso()) return; // el usuario está trabajando aquí: no tocar
    const firmaNueva = JSON.stringify([seccion, data.dia, data.esHoy]);
    if (panelViejo._firma === firmaNueva) return; // sin cambios de verdad: no reconstruir el DOM para nada
    const panelNuevo = crearSeccionPanel(seccion, data.dia, data.fecha, data.esHoy);
    panelViejo.replaceWith(panelNuevo);
  });
}

function renderContenidoDia(data) {
  ESTADO.datosDiaActual = data;
  const cont = document.getElementById('dia-contenido');
  const wrap = document.createElement('div');

  const fechaLarga = formatearFechaLarga(data.fecha);
  const topbarFecha = document.getElementById('topbar-fecha');
  if (topbarFecha) topbarFecha.textContent = fechaLarga;

  if (data.bloqueada) {
    const msg = document.createElement('div');
    msg.className = 'sin-conteo-msg';
    msg.textContent = 'Esta fecha todavía no está disponible: solo se puede consultar/editar el conteo de hoy y de mañana.';
    wrap.appendChild(msg);
    cont.innerHTML = '';
    cont.appendChild(wrap);
    document.getElementById('resumen-body').innerHTML = '<div class="resumen-vacio">Fecha no disponible todavía.</div>';
    const menuRapido = document.getElementById('menu-rapido-body');
    if (menuRapido) menuRapido.innerHTML = '<div class="menu-rapido-vacio">Fecha no disponible todavía.</div>';
    return;
  }

  if (!data.dia) {
    const msg = document.createElement('div');
    msg.className = 'sin-conteo-msg';
    msg.textContent = 'Este día de la semana no tiene hoja de conteo. Puedes añadir una nota si necesitas dejar constancia de algo.';
    wrap.appendChild(msg);
  } else if (!data.secciones.length) {
    const msg = document.createElement('div');
    msg.className = 'sin-conteo-msg';
    msg.textContent = 'Esta hoja ("' + data.dia + '") todavía no tiene ninguna ruta configurada.';
    wrap.appendChild(msg);
  } else {
    // Datos antiguos sin cerrar (se mandó previsión pero nunca el
    // definitivo, y ha llegado otra semana): el backend ya los ha vaciado
    // solo con leer el conteo (ver getConteoDia/limpiarDatosAntiguosSiProcede_
    // en el backend); aquí solo se avisa de que ha pasado, para que no
    // parezca que el conteo aparece "vacío" de la nada sin explicación.
    const avisos = data.secciones
      .filter(function (s) { return s.datosAntiguosLimpiados; })
      .map(function (s) { return { titulo: parsearNombreAgrupacion(s.nombre).titulo, fecha: s.datosAntiguosLimpiados }; });
    if (avisos.length) {
      const aviso = document.createElement('div');
      aviso.className = 'aviso-datos-antiguos';
      aviso.innerHTML =
        '<strong>Aviso:</strong> se han vaciado datos sin cerrar de una fecha anterior (nunca se envió el definitivo) en: ' +
        avisos.map(function (a) { return escapeHtml(a.titulo) + ' (' + escapeHtml(a.fecha) + ')'; }).join(', ') + '.';
      wrap.appendChild(aviso);
    }

    data.secciones.forEach(function (seccion) {
      wrap.appendChild(crearSeccionPanel(seccion, data.dia, data.fecha, data.esHoy));
    });
  }

  cont.innerHTML = '';
  cont.appendChild(wrap);

  document.getElementById('btn-nota-dia').onclick = function () {
    appPrompt('Nota del día', 'Escribe una observación general para este día…', function (texto) {
      guardarObservacionYRecargar({ fecha: ESTADO.fecha, dia: data.dia || '', agrupacion: '', tienda: '', tipo: 'nota', texto: texto });
    });
  };

  renderResumenDia(data);
  renderMenuRapido(data);
}

/**
 * Lista de acceso rápido (sidebar izquierdo, debajo de la leyenda) con todas
 * las agrupaciones del día. Al pulsar una, se hace scroll y se expande esa
 * sección en el contenido principal (reutiliza irASeccion, la misma función
 * que usa el resumen del día).
 */
/** Estado a mostrar (color del punto) en "Acceso rápido a agrupación" para
 *  una sección. seccion.estado ('pendiente' | 'progreso' | 'enviado') y
 *  seccion.previsionEnviada son datos independientes (se puede enviar una
 *  previsión sin que eso cambie seccion.estado), así que aquí se combinan
 *  con una prioridad clara: definitivo enviado > previsión enviada > en
 *  progreso > pendiente. Se usa tanto al pintar el menú por primera vez
 *  como al actualizarlo en vivo tras enviar previsión/definitivo. */
function claseEstadoMenuRapido_(seccion) {
  if (seccion.estado === 'enviado') return 'estado-enviado';
  if (seccion.previsionEnviada) return 'estado-prevision';
  if (seccion.estado === 'progreso') return 'estado-progreso';
  return 'estado-pendiente';
}

/** Texto del tooltip (title) del punto de "Acceso rápido a agrupación",
 *  a juego con claseEstadoMenuRapido_. */
function tituloEstadoMenuRapido_(seccion) {
  switch (claseEstadoMenuRapido_(seccion)) {
    case 'estado-enviado': return 'Definitivo enviado';
    case 'estado-prevision': return 'Previsión enviada';
    case 'estado-progreso': return 'En progreso';
    default: return 'Sin empezar';
  }
}

let MENU_RAPIDO_ESTADO = { secciones: [], filtro: '' };

function renderMenuRapido(data) {
  MENU_RAPIDO_ESTADO.secciones = data.secciones || [];
  // Si se cambia de día y el input de búsqueda sigue en pantalla (el panel
  // no se destruye al recargar el conteo), respetamos lo que haya escrito;
  // el propio input conserva su valor porque el shell no se vuelve a pintar.
  pintarMenuRapido_();
}

/** Repinta "Acceso rápido a agrupación" aplicando MENU_RAPIDO_ESTADO.filtro
 *  (ya normalizado sin acentos/mayúsculas). Una agrupación se muestra si su
 *  propio nombre coincide, o si coincide el nombre de alguna tienda dentro
 *  de ella (en ese caso se sigue abriendo la agrupación entera al pulsar,
 *  igual que el resto de accesos rápidos). */
function pintarMenuRapido_() {
  const body = document.getElementById('menu-rapido-body');
  if (!body) return;

  const secciones = MENU_RAPIDO_ESTADO.secciones;
  if (!secciones.length) {
    body.innerHTML = '<div class="menu-rapido-vacio">Sin agrupaciones para este día.</div>';
    return;
  }

  const filtro = MENU_RAPIDO_ESTADO.filtro;
  const secccionesFiltradas = !filtro ? secciones : secciones.filter(function (seccion) {
    const titulo = parsearNombreAgrupacion(seccion.nombre).titulo;
    if (normalizarBusquedaPlantilla_(titulo).indexOf(filtro) !== -1) return true;
    return (seccion.tiendas || []).some(function (t) { return normalizarBusquedaPlantilla_(t.nombre).indexOf(filtro) !== -1; });
  });

  if (!secccionesFiltradas.length) {
    body.innerHTML = '<div class="menu-rapido-sin-resultados">Ninguna agrupación ni tienda coincide con la búsqueda.</div>';
    return;
  }

  body.innerHTML = '';
  secccionesFiltradas.forEach(function (seccion) {
    const titulo = parsearNombreAgrupacion(seccion.nombre).titulo;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-rapido-item ' + claseEstadoMenuRapido_(seccion);
    btn.setAttribute('data-seccion-key', seccion.nombre);
    btn.innerHTML =
      '<span class="dot" title="' + escapeAttr(tituloEstadoMenuRapido_(seccion)) + '"></span>' +
      '<span class="titulo">' + escapeHtml(titulo) + '</span>' +
      '<span class="count">' + seccion.tiendas.filter(function (t) { return !t.salePorExcepcion; }).length + '</span>';
    btn.onclick = function () { irASeccion(seccion.nombre); };
    body.appendChild(btn);
  });
}

/** Actualiza en vivo el color del punto de una agrupación en "Acceso rápido
 *  a agrupación" (p.ej. de pendiente/progreso a previsión enviada, o a
 *  definitivo enviado), sin repintar todo el menú. Se usa desde
 *  aplicarResultadoEnvio_ para que el menú lateral quede sincronizado con
 *  el panel aunque ya no se recargue todo el cuadrante al enviar. Recibe
 *  la sección completa (no solo el estado) porque el color depende de la
 *  combinación estado + previsionEnviada (ver claseEstadoMenuRapido_). */
function actualizarMenuRapidoItem_(seccion) {
  const item = document.querySelector('.menu-rapido-item[data-seccion-key="' + CSS.escape(seccion.nombre) + '"]');
  if (!item) return;
  item.classList.remove('estado-pendiente', 'estado-progreso', 'estado-prevision', 'estado-enviado');
  item.classList.add(claseEstadoMenuRapido_(seccion));
  const dot = item.querySelector('.dot');
  if (dot) dot.title = tituloEstadoMenuRapido_(seccion);
}

function crearNotaChip(n) {
  const div = document.createElement('div');
  div.className = 'nota-chip' + (n.tipo === 'cierre' ? ' tipo-cierre' : '');
  const span = document.createElement('span');
  span.className = 'txt';
  span.textContent = n.texto;
  const del = document.createElement('button');
  del.className = 'del';
  del.type = 'button';
  del.innerHTML = '&times;';
  del.onclick = function () {
    appConfirm('Eliminar nota', '¿Seguro que quieres eliminar esta nota?', function () {
      eliminarObservacionYRecargar(n.id);
    });
  };
  div.appendChild(span);
  div.appendChild(del);
  return div;
}

/**
 * Chip de solo lectura para una nota/instrucción de carga que viene escrita
 * en la propia hoja de Excel de ese día (ej. "1 CAMIÓN 33 P. + ... TODOS LOS
 * LUNES"). No tiene botón de borrar porque no vive en la hoja
 * "Observaciones": para cambiarla hay que editar la celda en la hoja del día.
 */
function crearNotaCargaChip(texto) {
  const div = document.createElement('div');
  div.className = 'nota-carga-chip';
  div.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
    '<span>' + escapeHtml(texto) + '</span>';
  return div;
}
