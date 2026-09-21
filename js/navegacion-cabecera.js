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
  { id: 'emails', label: 'Email agencias', permiso: 'agencias' },
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
  { id: 'festivos', label: 'Cierres y cambios', permiso: 'festivos' },
  { id: 'palets-forzados', label: 'Palets forzados', permiso: 'palets_forzados' },
  { id: 'usuarios', label: 'Usuarios', permiso: 'usuarios' },
  { id: 'servidores', label: 'Servidores', permiso: null },
  { id: 'cola-emails', label: 'Cola de avisos a tiendas', permiso: 'cola_emails' },
  { id: 'simulacion-aviso-tiendas', label: 'Simulación envío tiendas', permiso: 'aviso_tiendas' }
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
