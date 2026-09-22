/* SALIDAS · js/navegacion.js — Navegación principal: cambiarVista y vistas Inicio/Diseño/Administración */

/* ---------------- NAVEGACIÓN PRINCIPAL ---------------- */
function irAHoy() {
  ESTADO.fecha = hoyStr();
  ESTADO.anioMes = anioMesDe(ESTADO.fecha);
  ESTADO.colapsadas = new Set();
  cambiarVista('conteos');
}

/** Desde "Inicio": al pulsar el nombre de una agrupación en la tabla de
 *  "Estado del conteo de hoy/mañana", lleva directamente a Conteos
 *  Diarios en la fecha correspondiente y hace scroll hasta esa
 *  agrupación (mismo "ir a sección" que ya usa el resumen lateral de
 *  Conteos Diarios, ver irASeccion en conteos-resumen.js). */
function irAAgrupacionDesdeInicio_(fecha, nombreRuta) {
  if (!fecha || !nombreRuta) return;
  ESTADO.fecha = fecha;
  ESTADO.anioMes = anioMesDe(fecha);
  ESTADO.colapsadas = new Set();
  cambiarVista('conteos', nombreRuta);
}

/** Cambia entre las tres secciones de la app (Inicio / Conteos /
 *  Configuración), marcando la pestaña activa en la cabecera y
 *  renderizando el contenido correspondiente en <main>. Para
 *  "configuracion"/"administracion", `seccion` (opcional) indica qué
 *  página del desplegable se quiere abrir (p.ej. 'emails'); si no se
 *  indica, se mantiene/usa la última sección activa. Para "conteos",
 *  `seccion` (opcional) es el nombre de una agrupación a la que hacer
 *  scroll automáticamente en cuanto termine de cargar el día (ver
 *  irAAgrupacionDesdeInicio_, que es quien la usa desde "Inicio"). */
function cambiarVista(vista, seccion) {
  ESTADO.vista = vista;
  document.querySelectorAll('.topbar-nav-item').forEach(function (btn) {
    btn.classList.toggle('activa', btn.dataset.vista === vista);
  });
  document.getElementById('topbar-fecha-wrap').style.display = (vista === 'conteos') ? '' : 'none';
  const elRefrescoConteo = document.getElementById('topbar-refresco-conteo');
  if (elRefrescoConteo) elRefrescoConteo.classList.toggle('visible', vista === 'conteos');
  document.getElementById('main').classList.toggle('main-sin-padding', vista === 'inicio');
  document.body.classList.toggle('vista-inicio-activa', vista === 'inicio');

  if (vista === 'configuracion' && seccion) ESTADO_CONFIG.seccionActiva = seccion;
  if (vista === 'administracion' && seccion) ESTADO_ADMIN.seccionActiva = seccion;
  marcarSeccionActivaEnDropdown();

  if (vista === 'inicio') {
    renderVistaInicio();
  } else if (vista === 'configuracion') {
    renderVistaConfiguracion();
  } else if (vista === 'administracion') {
    renderVistaAdministracion();
  } else {
    if (!ESTADO.fecha) {
      ESTADO.fecha = hoyStr();
      ESTADO.anioMes = anioMesDe(ESTADO.fecha);
    }
    renderShellPrincipal();
    cargarCalendario();
    const promesaConteo = cargarConteoDia();
    if (seccion && promesaConteo && typeof promesaConteo.then === 'function') {
      promesaConteo.then(function () { irASeccion(seccion); });
    }
  }
}

/** INICIO: página principal tras entrar en la app. Dos tarjetas ("Estado
 *  del conteo de hoy" / "...de mañana"), pegadas arriba del todo, con una
 *  tabla ruta × 60/PTA/CART. donde cada casilla se marca en verde cuando
 *  esa columna está completa para esa ruta (naranja si está a medias),
 *  más una columna de estado (Completado/En progreso/Pendiente) por ruta,
 *  según esos mismos 3 checks -- no según si ya se ha enviado Definitivo.
 *  Todo sobre la foto de portada a página completa (ver
 *  body.vista-inicio-activa en styles.css). */

// Las tres casillas de conteo reales (misma nomenclatura que el resto de
// la app: js/plantilla.js -> etiquetas = { c60: '60', pta: 'PTA', cart: 'CART.' }).
// Cada una viene de la API como 'vacio' | 'parcial' | 'completo'.
const INICIO_CAMPOS_ = [
  { clave: 'c60Estado', etiqueta: '60' },
  { clave: 'ptaEstado', etiqueta: 'PTA' },
  { clave: 'cartEstado', etiqueta: 'CART.' }
];
// El estado general de la ruta ya no depende de si se ha enviado
// Definitivo a la agencia, sino solo de los tres checks (60/PTA/CART.) de
// arriba: 'completado' cuando los 3 están en verde, 'pendiente' cuando no
// hay ningún dato escrito todavía y 'progreso' en cualquier caso
// intermedio (mismo criterio que aplica get_resumen_inicio en el backend).
const INICIO_ESTADO_TXT_ = { completado: 'Completado', progreso: 'En progreso', pendiente: 'Pendiente' };

function renderVistaInicio() {
  const main = document.getElementById('main');
  main.innerHTML =
    htmlBannerInstalacion_() +
    '<div class="version-badge">' + (APP_VERSION_ACTUAL ? 'v' + escapeHtml(APP_VERSION_ACTUAL) : '') + '</div>' +
    '<div class="inicio-cols2" id="inicio-cols2">' +
      htmlTarjetaInicioCargando_('Estado del conteo de hoy', 'hoy') +
      htmlTarjetaInicioCargando_('Estado del conteo de mañana', 'manana') +
    '</div>';
  vincularBotonInstalar_();

  llamarApi_('resumenInicio', [])
    .then(function (resumen) {
      const cont = document.getElementById('inicio-cols2');
      if (!cont) return; // el usuario ya ha cambiado de vista
      cont.innerHTML =
        htmlTarjetaInicio_('Estado del conteo de hoy', resumen.hoy, 'hoy') +
        htmlTarjetaInicio_('Estado del conteo de mañana', resumen.manana, 'manana');
      cont.querySelectorAll('[data-ir-agrupacion]').forEach(function (btn) {
        btn.onclick = function () {
          irAAgrupacionDesdeInicio_(btn.getAttribute('data-fecha'), btn.getAttribute('data-ruta'));
        };
      });
    })
    .catch(function (err) {
      const cont = document.getElementById('inicio-cols2');
      if (cont) {
        cont.innerHTML =
          htmlTarjetaInicioError_('Estado del conteo de hoy') +
          htmlTarjetaInicioError_('Estado del conteo de mañana');
      }
      mostrarErrorServidor(err);
    });
}

function htmlTarjetaInicioCargando_(titulo, tipo) {
  return (
    '<div class="inicio-card inicio-card-' + tipo + '">' +
      '<div class="inicio-card-header"><h2>' + escapeHtml(titulo) + '</h2></div>' +
      '<div class="inicio-card-vacio">Cargando…</div>' +
    '</div>'
  );
}

function htmlTarjetaInicioError_(titulo) {
  return (
    '<div class="inicio-card">' +
      '<div class="inicio-card-header"><h2>' + escapeHtml(titulo) + '</h2></div>' +
      '<div class="inicio-card-vacio">No se ha podido cargar. Vuelve a intentarlo más tarde.</div>' +
    '</div>'
  );
}

/** Construye una tarjeta completa a partir de la respuesta de
 *  get_resumen_inicio para "hoy" o "manana": { fecha, dia, rutas,
 *  totalRutas, enviadas, enProgreso, pendientes }. */
function htmlTarjetaInicio_(titulo, datos, tipo) {
  datos = datos || {};
  const rutas = datos.rutas || [];
  const subtitulo = datos.fecha ? formatearFechaLarga(datos.fecha) : '';
  let cuerpo;
  if (!rutas.length) {
    cuerpo = '<div class="inicio-card-vacio">No hay rutas para este día.</div>';
  } else {
    cuerpo =
      '<div class="inicio-tabla-conteo">' +
        '<div class="inicio-tc-fila inicio-tc-header">' +
          '<div class="inicio-tc-nombre-col">Ruta</div>' +
          INICIO_CAMPOS_.map(function (c) { return '<div class="inicio-tc-col">' + c.etiqueta + '</div>'; }).join('') +
          '<div class="inicio-tc-pill-col">Estado</div>' +
        '</div>' +
        rutas.map(function (ruta) { return htmlFilaRutaInicio_(ruta, datos.fecha); }).join('') +
      '</div>';
  }
  return (
    '<div class="inicio-card inicio-card-' + tipo + '">' +
      '<div class="inicio-card-header">' +
        '<h2>' + escapeHtml(titulo) + '</h2>' +
        (subtitulo ? '<span class="inicio-card-fecha">' + escapeHtml(subtitulo) + '</span>' : '') +
      '</div>' +
      cuerpo +
    '</div>'
  );
}

// Icono de ubicación (mismo pin que .badge-ubicacion en las secciones de
// Conteos Diarios, ver js/conteos-panel.js) para el badge de
// ubicación/hora de carga entre paréntesis en el nombre de la ruta.
const INICIO_SVG_UBICACION_ =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';

function htmlFilaRutaInicio_(ruta, fecha) {
  const estado = ruta.estado || 'pendiente';
  // El nombre de la ruta trae la ubicación/hora de carga entre
  // paréntesis (p.ej. "NIEVES (GAITE 8:00)"); parsearNombreAgrupacion
  // (js/conteos-panel.js) es el mismo parser que ya usa Conteos Diarios.
  const partes = parsearNombreAgrupacion(ruta.nombre || '');
  const badgeUbicacion = partes.ubicacion
    ? '<span class="inicio-badge-ubicacion">' + INICIO_SVG_UBICACION_ + escapeHtml(partes.ubicacion) + '</span>'
    : '';
  // El nombre es clicable: lleva directamente a esa agrupación en Conteos
  // Diarios (ver irAAgrupacionDesdeInicio_ e "IR A AGRUPACIÓN..." en
  // renderVistaInicio, que engancha el onclick tras pintar la tarjeta).
  return (
    '<div class="inicio-tc-fila">' +
      '<button type="button" class="inicio-tc-nombre-col inicio-tc-nombre-col-link" data-ir-agrupacion data-fecha="' + escapeAttr(fecha || '') + '" data-ruta="' + escapeAttr(ruta.nombre || '') + '" title="Ir a esta agrupación en Conteos Diarios">' +
        '<span class="inicio-tc-nombre-txt">' + escapeHtml(partes.titulo) + '</span>' +
        badgeUbicacion +
      '</button>' +
      INICIO_CAMPOS_.map(function (c) {
        return '<div class="inicio-tc-col">' + htmlCheckCircleInicio_(ruta[c.clave]) + '</div>';
      }).join('') +
      '<div class="inicio-tc-pill-col"><span class="inicio-pill inicio-pill-' + estado + '">' +
        escapeHtml(INICIO_ESTADO_TXT_[estado] || estado) +
      '</span></div>' +
    '</div>'
  );
}

/** estado: 'vacio' (gris, nada rellenado) | 'parcial' (naranja, alguna
 *  casilla rellenada) | 'completo' (verde, todas rellenadas -- con
 *  check). */
function htmlCheckCircleInicio_(estado) {
  estado = estado || 'vacio';
  return (
    '<span class="inicio-check-circle inicio-check-circle-' + estado + '">' +
      (estado === 'completo'
        ? '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '') +
    '</span>'
  );
}

/** CONFIGURACIÓN: ya no tiene submenú lateral dentro de la página (la
 *  elección de sección se hace desde el desplegable de la cabecera); aquí
 *  solo se renderiza el contenido de la sección activa, a todo el ancho. */
function renderVistaConfiguracion() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="config-contenido" id="config-contenido"></div>';
  renderSeccionConfigActiva();
}

function renderSeccionConfigActiva() {
  if (ESTADO_CONFIG.seccionActiva === 'emails') renderConfigEmails();
  else if (ESTADO_CONFIG.seccionActiva === 'plantilla') renderConfigPlantilla();
  else if (ESTADO_CONFIG.seccionActiva === 'config-hora-aviso-tiendas') renderConfigHoraAvisoTiendas();
  else if (ESTADO_CONFIG.seccionActiva === 'tiendas') renderConfigTiendas();
}

/** ADMINISTRACIÓN: mismo patrón que renderVistaConfiguracion, pero con su
 *  propio contenedor ("admin-contenido") para no compartir estado con
 *  Configuración por accidente. */
function renderVistaAdministracion() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="config-contenido" id="admin-contenido"></div>';
  renderSeccionAdminActiva();
}

function renderSeccionAdminActiva() {
  if (ESTADO_ADMIN.seccionActiva === 'festivos') renderAdminFestivos();
  else if (ESTADO_ADMIN.seccionActiva === 'palets-forzados') renderAdminPaletsForzados();
  else if (ESTADO_ADMIN.seccionActiva === 'usuarios') renderAdminUsuarios();
  else if (ESTADO_ADMIN.seccionActiva === 'servidores') renderAdminServidores();
  else if (ESTADO_ADMIN.seccionActiva === 'cola-emails') renderAdminColaEmails();
  else if (ESTADO_ADMIN.seccionActiva === 'simulacion-aviso-tiendas') renderSimulacionAvisoTiendas();
}
