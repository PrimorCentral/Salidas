/* SALIDAS · js/permisos.js — Rol y permisos de la sesión (esAdmin, tienePermiso, aplicarPermisosUI) */

/** true si la sesión actual es de administrador. Se usa para mostrar u
 *  ocultar en el momento los controles de notas/observaciones/cierres. */
function esAdmin() { return SESSION_ROL === 'admin'; }

/** true si la sesión actual puede realizar algo protegido por `clave`
 *  (una de las de CATALOGO_PERMISOS). Un admin siempre puede -- igual que
 *  hace verificar_permiso en el backend, que le deja pasar sin mirar la
 *  columna "permisos". Para un operario, mira SESSION_PERMISOS. */
function tienePermiso(clave) {
  if (esAdmin()) return true;
  return !!(SESSION_PERMISOS && SESSION_PERMISOS[clave]);
}

/** Secciones de "Diseño" / "Administración" que la sesión actual puede
 *  ver, en el mismo orden del catálogo. Un admin las ve todas. */
function seccionesConfigPermitidas_() { return CONFIG_SECCIONES.filter(function (s) { return tienePermiso(s.permiso); }); }
function seccionesAdminPermitidas_() { return ADMIN_SECCIONES.filter(function (s) { return s.permiso && tienePermiso(s.permiso); }); }

// Claves de CATALOGO_PERMISOS que se traducen en una clase "perm-<clave>"
// en <body>, para que el CSS pueda mostrar botones sueltos (crear/borrar
// notas, cerrar tienda...) sin tener que tocar JS cada vez. Se recalculan
// aquí en vez de leer CATALOGO_PERMISOS directamente porque ese catálogo
// vive más abajo en el archivo (se define junto al resto de "Usuarios").
const CLAVES_PERMISOS_UI_ = [
  'usuarios', 'notas', 'cierres', 'agencias',
  'tiendas', 'plantilla', 'aviso_tiendas', 'config_hora_aviso_tiendas',
  'festivos', 'palets_forzados', 'cola_emails', 'ver_cuadrante_completo'
];

/** Añade/quita la clase 'es-admin' en <body> (compatibilidad con las
 *  reglas CSS ya existentes) y, para operarios, una clase "perm-<clave>"
 *  por cada permiso fino que tengan marcado -- así el CSS puede mostrar
 *  botones concretos (nota, cerrar tienda...) sin depender de ser admin.
 *  También reconstruye los desplegables de "Diseño" y "Administración"
 *  con solo las secciones a las que la sesión actual tiene acceso, y
 *  reajusta la sección activa si la que había por defecto no es una de
 *  ellas. */
function aplicarPermisosUI() {
  document.body.classList.toggle('es-admin', esAdmin());
  CLAVES_PERMISOS_UI_.forEach(function (clave) {
    document.body.classList.toggle('perm-' + clave, tienePermiso(clave));
  });

  const configPermitidas = seccionesConfigPermitidas_();
  const adminPermitidas = seccionesAdminPermitidas_();
  document.body.classList.toggle('tiene-menu-diseno', configPermitidas.length > 0);
  document.body.classList.toggle('tiene-menu-administracion', adminPermitidas.length > 0);

  if (!configPermitidas.some(function (s) { return s.id === ESTADO_CONFIG.seccionActiva; })) {
    ESTADO_CONFIG.seccionActiva = configPermitidas.length ? configPermitidas[0].id : ESTADO_CONFIG.seccionActiva;
  }
  if (!adminPermitidas.some(function (s) { return s.id === ESTADO_ADMIN.seccionActiva; })) {
    ESTADO_ADMIN.seccionActiva = adminPermitidas.length ? adminPermitidas[0].id : ESTADO_ADMIN.seccionActiva;
  }

  const elRol = document.getElementById('topbar-usuario-rol');
  if (elRol) elRol.textContent = SESSION_ROL ? (SESSION_NOMBRE || (esAdmin() ? 'Administrador' : 'Operario')) : '';
  poblarDropdownConfiguracion();
  poblarDropdownAdministracion();
}

/* ---------------- NAVES (60 / PTA / CART.) ---------------- */

// Nave -> columna de conteo que le corresponde (misma nomenclatura que el
// resto de la app: data-campo="c60" | "pta" | "cart").
const NAVES_CONTEO = [
  { nave: 'GAITE', campo: 'c60', etiqueta: '60' },
  { nave: 'PTA', campo: 'pta', etiqueta: 'PTA' },
  { nave: 'CARTAMA', campo: 'cart', etiqueta: 'CART.' }
];

function naveDeCampo_(campo) {
  return NAVES_CONTEO.find(function (n) { return n.campo === campo; }) || null;
}

/** Columna ('c60' | 'pta' | 'cart') de la nave del usuario conectado, o
 *  null si no tiene nave. */
function campoNaveSesion_() {
  const n = NAVES_CONTEO.find(function (x) { return x.nave === SESSION_NAVE; });
  return n ? n.campo : null;
}

/** true si el usuario conectado solo puede tocar la columna de su nave:
 *  operario CON nave. Los administradores y los operarios sin nave
 *  pueden rellenar las tres columnas (como hasta ahora). */
function restringidoANave_() {
  return !esAdmin() && !!campoNaveSesion_();
}

/** true si el usuario conectado puede escribir en la columna `campo`. */
function puedeEditarCampoConteo_(campo) {
  if (!restringidoANave_()) return true;
  return campo === campoNaveSesion_();
}
