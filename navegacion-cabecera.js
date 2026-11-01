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
document.getElementById('subbarra-nota').onclick = function () {
  // Mismo botón que "Añadir" de Observaciones importantes.
  const btn = document.getElementById('btn-nota-dia');
  if (btn) btn.click();
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

/** Resumen del día en la franja: cuántas rutas hay y cómo van, con los
 *  mismos estados y colores que la pantalla de Inicio. Se repinta al
 *  cargar el día y con cada autorefresco (ver js/conteos-dia.js). */
function pintarSubbarraConteo_(data) {
  marcarDiaEnSubbarra_();
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
