/* SALIDAS · js/navegacion-cabecera.js — Cabecera: menús Diseño/Administración y desplegables */

/* ---------------- NAVEGACIÓN PRINCIPAL (cabecera) ---------------- */
// Vive en el HTML estático de la cabecera (no se redibuja con cada día), así
// que sus listeners se enganchan una sola vez aquí, al cargar la página.
//
// Secciones de "Configuración" (se necesitan ya aquí porque el desplegable
// de la cabecera se construye con ellas; más secciones futuras solo se
// añaden a esta lista).
const CONFIG_SECCIONES = [
  { id: 'plantilla', label: 'Rutas y tiendas', permiso: 'plantilla' },
  { id: 'emails', label: 'Configuración agencias', permiso: 'agencias' },
  { id: 'tiendas', label: 'Configuración tiendas', permiso: 'tiendas' },
  { id: 'config-hora-aviso-tiendas', label: 'Configuración hora aviso tiendas', permiso: 'config_hora_aviso_tiendas' }
  // futuras secciones de Configuración van aquí
];
let ESTADO_CONFIG = { seccionActiva: 'emails' };

// Secciones de "Administración": a diferencia de Configuración (ajustes que
// definen cómo funciona la app), aquí van pantallas de solo lectura para
// auditoría/consulta de lo que ya ha pasado (registros, historiales...).
// `permiso: null` = exclusiva de admin, ningún operario puede tenerla
// aunque se le marquen permisos (caso de "Servidores": monitorización de
// las cuentas puente, nada que un operario necesite consultar).
const ADMIN_SECCIONES = [
  { id: 'festivos', label: 'Bloqueos y cambios', permiso: 'festivos' },
  { id: 'palets-forzados', label: 'Palets forzados', permiso: 'palets_forzados' },
  { id: 'usuarios', label: 'Usuarios', permiso: 'usuarios' },
  { id: 'servidores', label: 'Servidores', permiso: null },
  { id: 'cola-emails', label: 'Cola de avisos a tiendas', permiso: 'cola_emails' },
  { id: 'simulacion-aviso-tiendas', label: 'Simulación envío tiendas', permiso: 'aviso_tiendas' },
  // Solo administradores: "registro_actividad" no está en CATALOGO_PERMISOS,
  // así que no se le puede dar a un operario (tienePermiso deja pasar al admin).
  { id: 'registro-actividad', label: 'Registro de actividad', permiso: 'registro_actividad' }
  // futuras secciones de Administración van aquí
];
let ESTADO_ADMIN = { seccionActiva: 'palets-forzados' };

// Botones simples (Inicio, Conteos): navegan directamente al pulsarlos.
document.querySelectorAll('.topbar-nav > .topbar-nav-item').forEach(function (btn) {
  btn.addEventListener('click', function () { cambiarVista(btn.dataset.vista); });
});

// Botones con desplegable (Configuración): al pulsarlos solo se abre/cierra
// la lista de subpáginas debajo; no se navega hasta elegir una de la lista.
document.querySelectorAll('.topbar-nav-dropdown').forEach(function (wrap) {
  const toggle = wrap.querySelector('.topbar-nav-item-dropdown');
  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    const yaAbierto = wrap.classList.contains('abierto');
    cerrarDropdownsTopbar();
    if (!yaAbierto) {
      wrap.classList.add('abierto');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
});
// Clic fuera del desplegable (o tras elegir una opción) lo cierra.
document.addEventListener('click', cerrarDropdownsTopbar);

function cerrarDropdownsTopbar() {
  document.querySelectorAll('.topbar-nav-dropdown.abierto').forEach(function (wrap) {
    wrap.classList.remove('abierto');
    wrap.querySelector('.topbar-nav-item-dropdown').setAttribute('aria-expanded', 'false');
  });
}

/** Construye la lista del desplegable de "Diseño" a partir de las
 *  secciones a las que la sesión actual tiene acceso (seccionesConfigPermitidas_,
 *  admin las tiene todas; un operario solo las de sus permisos) y engancha
 *  sus clics (cada uno navega directamente a esa sección y cierra el
 *  desplegable). El menú entero además se oculta por CSS si no hay ninguna
 *  sección permitida (ver clase "tiene-menu-diseno" en <style>). */
function poblarDropdownConfiguracion() {
  const cont = document.getElementById('topbar-dropdown-menu-configuracion');
  cont.innerHTML = seccionesConfigPermitidas_().map(function (s) {
    const activa = ESTADO.vista === 'configuracion' && s.id === ESTADO_CONFIG.seccionActiva;
    return '<button type="button" class="topbar-dropdown-item' + (activa ? ' activa' : '') + '" data-seccion="' + s.id + '">' + escapeHtml(s.label) + '</button>';
  }).join('');
  cont.querySelectorAll('.topbar-dropdown-item').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      cerrarDropdownsTopbar();
      cambiarVista('configuracion', btn.getAttribute('data-seccion'));
    });
  });
}
function marcarSeccionActivaEnDropdown() {
  document.querySelectorAll('#topbar-dropdown-menu-configuracion .topbar-dropdown-item').forEach(function (btn) {
    const activa = ESTADO.vista === 'configuracion' && btn.getAttribute('data-seccion') === ESTADO_CONFIG.seccionActiva;
    btn.classList.toggle('activa', activa);
  });
  document.querySelectorAll('#topbar-dropdown-menu-administracion .topbar-dropdown-item').forEach(function (btn) {
    const activa = ESTADO.vista === 'administracion' && btn.getAttribute('data-seccion') === ESTADO_ADMIN.seccionActiva;
    btn.classList.toggle('activa', activa);
  });
}
poblarDropdownConfiguracion();

/** Construye la lista del desplegable de "Administración" a partir de las
 *  secciones a las que la sesión actual tiene acceso (seccionesAdminPermitidas_).
 *  "Servidores" nunca aparece para un operario (permiso: null en
 *  ADMIN_SECCIONES). El menú entero se oculta por CSS si no queda ninguna
 *  sección permitida (ver clase "tiene-menu-administracion" en <style>). */
function poblarDropdownAdministracion() {
  const cont = document.getElementById('topbar-dropdown-menu-administracion');
  if (!cont) return;
  cont.innerHTML = seccionesAdminPermitidas_().map(function (s) {
    const activa = ESTADO.vista === 'administracion' && s.id === ESTADO_ADMIN.seccionActiva;
    return '<button type="button" class="topbar-dropdown-item' + (activa ? ' activa' : '') + '" data-seccion="' + s.id + '">' + escapeHtml(s.label) + '</button>';
  }).join('');
  cont.querySelectorAll('.topbar-dropdown-item').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      cerrarDropdownsTopbar();
      cambiarVista('administracion', btn.getAttribute('data-seccion'));
    });
  });
}
poblarDropdownAdministracion();


/* ---------------- FRANJA DEL DÍA (solo en Conteos Diarios) ----------------
 * Debajo de la barra de menús, pegada a ella. Lleva todo lo del día que
 * antes iba en la barra o en la columna izquierda:
 *   izquierda: Hoy / Mañana y el resumen del día (rutas, ajustadas...)
 *   centro:    ‹ fecha › (la fecha abre el calendario) y CONTEO ESPECIAL
 *   derecha:   buscador de agrupación o tienda, + Nota, imprimir y la
 *              cuenta atrás del refresco.
 * Los botones fijos se enganchan una sola vez aquí. El calendario y el
 * buscador los pinta renderShellPrincipal (js/plantilla.js) cada vez que
 * se entra en Conteos, y se quitan al salir (limpiarSubbarraConteo_), para
 * que #calendar-body solo exista estando en Conteos, como antes. */

/** Va a un día desde la franja (Hoy, Mañana, flechas). */
function irADiaDesdeSubbarra_(fecha) {
  if (!fecha || ESTADO.vista !== 'conteos') return;
  cerrarCalendarioSubbarra_();
  seleccionarFecha(fecha);
  marcarDiaEnSubbarra_();
}
document.getElementById('subbarra-hoy').onclick = function () { irADiaDesdeSubbarra_(hoyStr()); };
document.getElementById('subbarra-manana').onclick = function () { irADiaDesdeSubbarra_(sumarDias_(hoyStr(), 1)); };
document.getElementById('subbarra-dia-anterior').onclick = function () { irADiaDesdeSubbarra_(sumarDias_(ESTADO.fecha, -1)); };
document.getElementById('subbarra-dia-siguiente').onclick = function () { irADiaDesdeSubbarra_(sumarDias_(ESTADO.fecha, 1)); };
// «Añadir observación»: el antiguo botón «Añadir» de Observaciones
// importantes, ahora en la franja. Usa el día que se está viendo.
document.getElementById('subbarra-nota').onclick = function () {
  const data = ESTADO.datosDiaActual;
  if (!data || data.bloqueada) return;
  abrirModalAnadirObservacionDia_(data);
};

/** Marca Hoy / Mañana según el día que se está viendo. */
function marcarDiaEnSubbarra_() {
  const hoy = hoyStr();
  document.getElementById('subbarra-hoy').classList.toggle('activa', ESTADO.fecha === hoy);
  document.getElementById('subbarra-manana').classList.toggle('activa', ESTADO.fecha === sumarDias_(hoy, 1));
}

/* Calendario desplegable (al pulsar la fecha). Se cierra al elegir un día,
 * al pulsar fuera o con Escape. */
const SUBBARRA_CALENDARIO_ = document.getElementById('subbarra-calendario');
const SUBBARRA_FECHA_BTN_ = document.getElementById('subbarra-fecha-btn');
function abrirCalendarioSubbarra_() {
  if (!document.getElementById('calendar-body')) return;
  SUBBARRA_CALENDARIO_.hidden = false;
  SUBBARRA_FECHA_BTN_.classList.add('abierto');
  SUBBARRA_FECHA_BTN_.setAttribute('aria-expanded', 'true');
}
function cerrarCalendarioSubbarra_() {
  SUBBARRA_CALENDARIO_.hidden = true;
  SUBBARRA_FECHA_BTN_.classList.remove('abierto');
  SUBBARRA_FECHA_BTN_.setAttribute('aria-expanded', 'false');
}
SUBBARRA_FECHA_BTN_.onclick = function (e) {
  e.stopPropagation();
  if (SUBBARRA_CALENDARIO_.hidden) abrirCalendarioSubbarra_();
  else cerrarCalendarioSubbarra_();
};
SUBBARRA_CALENDARIO_.addEventListener('click', function (e) {
  e.stopPropagation(); // los clics dentro no cuentan como "fuera"
  const dia = e.target.closest('.cal-day[data-fecha]');
  if (dia && !dia.disabled) {
    cerrarCalendarioSubbarra_();
    // seleccionarFecha ya lo hace el propio día (renderCalendario).
    setTimeout(marcarDiaEnSubbarra_, 0);
  }
});
document.addEventListener('click', function () {
  if (!SUBBARRA_CALENDARIO_.hidden) cerrarCalendarioSubbarra_();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !SUBBARRA_CALENDARIO_.hidden) cerrarCalendarioSubbarra_();
});

/** Al salir de Conteos: fuera el calendario y el buscador de la franja. */
function limpiarSubbarraConteo_() {
  cerrarCalendarioSubbarra_();
  SUBBARRA_CALENDARIO_.innerHTML = '';
  document.getElementById('subbarra-buscar-slot').innerHTML = '';
  document.getElementById('subbarra-resumen').innerHTML = '';
}

/* ---------------- BUSCADOR DE LA FRANJA ----------------
 * Busca agrupaciones y tiendas del día que se está viendo y enseña los
 * resultados en un desplegable debajo del propio buscador (el acceso
 * rápido de la izquierda ya no se filtra). Al pulsar un resultado lleva a
 * esa agrupación; si se pulsa una tienda, además la marca en la tabla.
 * Flechas arriba/abajo para moverse, Intro para ir, Escape para cerrar.
 * El buscador lo pinta renderShellPrincipal (js/plantilla.js) y lo
 * engancha con esta función cada vez que se entra en Conteos. */
function engancharBuscadorSubbarra_() {
  const input = document.getElementById('subbarra-buscar-input');
  const limpiar = document.getElementById('subbarra-buscar-limpiar');
  const panel = document.getElementById('subbarra-buscar-resultados');
  if (!input || !panel) return;
  let resultados = [];   // [{ nombre, tienda }] en el orden en que se ven
  let activo = -1;
  let temporizador = null;

  function cerrar() { panel.hidden = true; activo = -1; }
  function marcarActivo(i) {
    const items = panel.querySelectorAll('[data-res]');
    activo = items.length ? (i + items.length) % items.length : -1;
    items.forEach(function (el, k) { el.classList.toggle('activo', k === activo); });
    if (activo >= 0) items[activo].scrollIntoView({ block: 'nearest' });
  }
  function ir(i) {
    const r = resultados[i];
    if (!r) return;
    cerrar();
    input.blur();
    irASeccion(r.nombre);
    if (r.tienda) setTimeout(function () { resaltarTiendaBuscada_(r.nombre, r.tienda); }, 450);
  }
  function buscar() {
    const texto = input.value.trim();
    limpiar.hidden = !input.value;
    const q = normalizarBusquedaPlantilla_(texto);
    resultados = [];
    if (q.length < 2) { cerrar(); return; }
    const data = ESTADO.datosDiaActual;
    const secciones = (data && !data.bloqueada && data.secciones) || [];
    let html = '';
    let n = 0;
    secciones.forEach(function (sec) {
      const partes = parsearNombreAgrupacion(sec.nombre);
      const enNombre = normalizarBusquedaPlantilla_(partes.titulo).indexOf(q) !== -1;
      // Una tienda que ese día sale por otra agrupación (cambio puntual) solo
      // cuenta en la agrupación por la que sale (igual que el acceso rápido).
      const tiendas = (sec.tiendas || []).filter(function (t) {
        return !t.salePorExcepcion && normalizarBusquedaPlantilla_(t.nombre).indexOf(q) !== -1;
      });
      if (!enNombre && !tiendas.length) return;
      resultados.push({ nombre: sec.nombre, tienda: null });
      html += '<button type="button" class="subbarra-res-agrup" data-res="' + (n++) + '" role="option">' +
        '<span class="dot ' + claseEstadoMenuRapido_(sec) + '"></span>' +
        '<span class="titulo">' + escapeHtml(partes.titulo) + '</span>' +
        (partes.ubicacion ? '<span class="ubic">' + escapeHtml(partes.ubicacion) + '</span>' : '') +
        '</button>';
      tiendas.slice(0, 6).forEach(function (t) {
        resultados.push({ nombre: sec.nombre, tienda: t.nombre });
        html += '<button type="button" class="subbarra-res-tienda" data-res="' + (n++) + '" role="option">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg>' +
          '<span>' + escapeHtml(t.nombre) + '</span></button>';
      });
      if (tiendas.length > 6) html += '<div class="subbarra-res-mas">y ' + (tiendas.length - 6) + ' tienda(s) más…</div>';
    });
    panel.innerHTML = html || '<div class="subbarra-res-vacio">Ninguna agrupación ni tienda coincide con «' + escapeHtml(texto) + '».</div>';
    panel.hidden = false;
    marcarActivo(0);
  }

  input.addEventListener('input', function () {
    clearTimeout(temporizador);
    temporizador = setTimeout(buscar, 120);
  });
  input.addEventListener('focus', function () { if (input.value.trim().length >= 2) buscar(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (panel.hidden) buscar();
      marcarActivo(activo + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(temporizador);
      if (panel.hidden) buscar();
      ir(activo >= 0 ? activo : 0);
    } else if (e.key === 'Escape') {
      cerrar();
      input.blur();
    }
  });
  panel.addEventListener('mousedown', function (e) { e.preventDefault(); }); // que no se pierda el foco al pulsar
  panel.addEventListener('click', function (e) {
    e.stopPropagation();
    const b = e.target.closest('[data-res]');
    if (b) ir(Number(b.getAttribute('data-res')));
  });
  panel.addEventListener('mousemove', function (e) {
    const b = e.target.closest('[data-res]');
    if (b && Number(b.getAttribute('data-res')) !== activo) marcarActivo(Number(b.getAttribute('data-res')));
  });
  input.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function (e) {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== input) cerrar();
  });
  limpiar.onclick = function (e) {
    e.stopPropagation();
    input.value = '';
    limpiar.hidden = true;
    cerrar();
    input.focus();
  };
}

/** Marca un momento la fila de una tienda encontrada con el buscador (la
 *  que se esté viendo: conteo real o carga ajustada) y la centra. */
function resaltarTiendaBuscada_(nombreAgrupacion, tienda) {
  const panel = document.querySelector('.seccion-panel[data-seccion-key="' + cssEscapeAtributo(nombreAgrupacion) + '"]');
  if (!panel) return;
  const filas = Array.prototype.filter.call(
    panel.querySelectorAll('tr[data-nombre="' + cssEscapeAtributo(tienda) + '"]'),
    function (tr) { return tr.offsetParent !== null; });
  const fila = filas[0];
  if (!fila) return;
  fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
  fila.classList.remove('fila-buscada');
  void fila.offsetWidth; // para que la animación vuelva a empezar
  fila.classList.add('fila-buscada');
  setTimeout(function () { fila.classList.remove('fila-buscada'); }, 2600);
}

/** Resumen del día en la franja: cuántas rutas hay y cómo van, con los
 *  mismos estados y colores que la pantalla de Inicio. Se repinta al
 *  cargar el día y con cada autorefresco (ver js/conteos-dia.js). */
function pintarSubbarraConteo_(data) {
  marcarDiaEnSubbarra_();
  document.getElementById('subbarra-nota').disabled = !(data && !data.bloqueada);
  const cont = document.getElementById('subbarra-resumen');
  if (!cont) return;
  const secciones = (data && !data.bloqueada && data.dia && data.secciones) || [];
  if (!secciones.length) { cont.innerHTML = ''; return; }
  const n = { ajustada: 0, sin_ajustar: 0, prevision: 0, definitivo: 0 };
  secciones.forEach(function (s) {
    const c = s.carga;
    const hayCarga = !!(c && !c.desbloqueada);
    if (s.estado === 'enviado') { n.definitivo++; return; }
    if (s.previsionEnviada || (hayCarga && c.origen === 'prevision')) { n.prevision++; return; }
    if (hayCarga) { n.ajustada++; return; }
    const v = s.verificaciones || {};
    if (NAVES_CONTEO.every(function (nv) { return !!v[nv.campo]; })) n.sin_ajustar++;
  });
  const pastilla = function (clase, num, texto, titulo) {
    return '<span class="subbarra-res subbarra-res-' + clase + '" title="' + escapeAttr(titulo) + '"><b>' + num + '</b>' + texto + '</span>';
  };
  cont.innerHTML =
    pastilla('total', secciones.length, secciones.length === 1 ? 'ruta' : 'rutas', 'Rutas de este día') +
    pastilla('ajustada', n.ajustada, n.ajustada === 1 ? 'ajustada' : 'ajustadas', 'Con la carga ajustada') +
    pastilla('sin_ajustar', n.sin_ajustar, 'sin ajustar', 'Naves verificadas, pero falta ajustar la carga') +
    (n.prevision ? pastilla('prevision', n.prevision, 'previsión', 'Con la previsión enviada') : '') +
    pastilla('definitivo', n.definitivo, n.definitivo === 1 ? 'enviada' : 'enviadas', 'Con el definitivo enviado');
}
