/* SALIDAS · js/navegacion.js — Navegación principal: cambiarVista y vistas Inicio/Diseño/Administración */

/* ---------------- NAVEGACIÓN PRINCIPAL ---------------- */
function irAHoy() {
  ESTADO.fecha = hoyStr();
  ESTADO.anioMes = anioMesDe(ESTADO.fecha);
  ESTADO.colapsadas = new Set();
  cambiarVista('conteos');
}

/** Cambia entre las tres secciones de la app (Inicio / Conteos /
 *  Configuración), marcando la pestaña activa en la cabecera y
 *  renderizando el contenido correspondiente en <main>. Para
 *  "configuracion", `seccion` (opcional) indica qué página del
 *  desplegable se quiere abrir (p.ej. 'emails'); si no se indica, se
 *  mantiene/usa la última sección activa. */
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
    cargarConteoDia();
  }
}

/** INICIO: página principal tras entrar en la app. Cabecera compacta con
 *  saludo según la hora + nombre del usuario, y dos tarjetas ("Estado del
 *  conteo de hoy" / "...de mañana") con una tabla ruta × 60/PTA/CART.
 *  donde cada casilla se marca en verde cuando esa columna está completa
 *  para esa ruta, más una columna de estado (Enviada/En progreso/
 *  Pendiente) por ruta. Todo sobre la foto de portada a página completa
 *  (ver body.vista-inicio-activa en styles.css). */

/** Primer nombre de pila, en formato "Jose" (no todo mayúsculas), a partir
 *  de SESSION_NOMBRE (nombre completo tal cual se guarda en la BD). */
function nombrePilaSesion_() {
  if (!SESSION_NOMBRE) return '';
  const primero = String(SESSION_NOMBRE).trim().split(/\s+/)[0] || '';
  if (!primero) return '';
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora local
 *  del navegador (mismo criterio que el reloj de la cabecera). */
function saludoSegunHora_() {
  const h = new Date().getHours();
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

// Las tres casillas de conteo reales (misma nomenclatura que el resto de
// la app: js/plantilla.js -> etiquetas = { c60: '60', pta: 'PTA', cart: 'CART.' }).
// Cada una viene de la API como 'vacio' | 'parcial' | 'completo'.
const INICIO_CAMPOS_ = [
  { clave: 'c60Estado', etiqueta: '60' },
  { clave: 'ptaEstado', etiqueta: 'PTA' },
  { clave: 'cartEstado', etiqueta: 'CART.' }
];
const INICIO_ESTADO_TXT_ = { enviado: 'Enviada', progreso: 'En progreso', pendiente: 'Pendiente' };

function renderVistaInicio() {
  const main = document.getElementById('main');
  const nombre = nombrePilaSesion_();
  main.innerHTML =
    htmlBannerInstalacion_() +
    '<div class="inicio-hero">' +
      '<div class="inicio-saludo">' + escapeHtml(saludoSegunHora_()) + (nombre ? ', ' + escapeHtml(nombre) : '') + '</div>' +
      '<div class="inicio-saludo-fecha">' + escapeHtml(formatearFechaLarga(hoyStr())) + '</div>' +
      '<div class="version-badge">' + (APP_VERSION_ACTUAL ? 'v' + escapeHtml(APP_VERSION_ACTUAL) : '') + '</div>' +
    '</div>' +
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
        rutas.map(htmlFilaRutaInicio_).join('') +
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

function htmlFilaRutaInicio_(ruta) {
  const estado = ruta.estado || 'pendiente';
  return (
    '<div class="inicio-tc-fila">' +
      '<div class="inicio-tc-nombre-col">' + escapeHtml(ruta.nombre || '') + '</div>' +
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
