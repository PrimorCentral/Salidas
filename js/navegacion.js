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

/** INICIO: página principal tras entrar en la app. De momento solo una
 *  imagen de portada (almacén/palets, con el mismo tratamiento oscuro que
 *  la pantalla de login); aquí es donde en el futuro irán los mensajes y
 *  avisos generales del equipo. */
function renderVistaInicio() {
  const main = document.getElementById('main');
  main.innerHTML =
    htmlBannerInstalacion_() +
    '<div class="inicio-hero"><div class="version-badge">' + (APP_VERSION_ACTUAL ? 'v' + escapeHtml(APP_VERSION_ACTUAL) : '') + '</div></div>';
  vincularBotonInstalar_();
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
