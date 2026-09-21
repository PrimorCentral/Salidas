/* SALIDAS · js/palets-forzados.js — Administración: Palets forzados */

/* ---------------- ADMINISTRACIÓN: "Palets forzados" ----------------
 * Pantalla de solo lectura sobre la hoja Palets_Forzados: cada vez que
 * alguien confirma dar palets en una casilla que traía "NO" (ver
 * escribirCeldaConteo_ / registrarPaletForzado_ en el backend), queda un
 * registro ahí. Hasta ahora solo se podía consultar abriendo la Google
 * Sheet a mano; esta pantalla lo trae a la app con filtro por fechas y
 * búsqueda de tienda.
 *
 * Requiere la función de backend getPaletsForzadosAdmin(fechaIni, fechaFin)
 * (SOLO ADMIN) -- ver nota al final de este bloque para añadirla a
 * Codigo.gs si todavía no existe.
 */
let ADMIN_PALETS_ESTADO = { fechaIni: null, fechaFin: null, filtroTexto: '', datos: null };

/** 'yyyy-MM-dd' de hace "dias" días, calculado en el propio navegador. */
function fechaHaceDiasJs_(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function renderAdminPaletsForzados() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;

  // Por defecto, últimos 30 días: es la ventana más útil para revisar
  // incidencias recientes sin cargar todo el histórico de golpe.
  if (!ADMIN_PALETS_ESTADO.fechaIni) ADMIN_PALETS_ESTADO.fechaIni = fechaHaceDiasJs_(30);
  if (!ADMIN_PALETS_ESTADO.fechaFin) ADMIN_PALETS_ESTADO.fechaFin = hoyStr();
  ADMIN_PALETS_ESTADO.filtroTexto = '';

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="vista-card-header">' +
        '<h2>Palets forzados</h2>' +
        '<div class="vista-card-header-acciones">' +
          '<button type="button" class="btn-admin-refrescar" id="btn-admin-palets-refrescar" title="Volver a pedir los datos con las fechas actuales">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
            'Refrescar</button>' +
        '</div>' +
      '</div>' +
      '<p>Registro de cada vez que se han dado palets en una casilla que traía "NO" (avisos confirmados a mano en el conteo del día). Es un histórico de solo lectura: no se puede editar ni borrar desde aquí.</p>' +
      '<div class="admin-filtros">' +
        '<div class="admin-filtro-campo"><label>Desde</label><input type="date" id="admin-palets-desde" value="' + ADMIN_PALETS_ESTADO.fechaIni + '"></div>' +
        '<div class="admin-filtro-campo"><label>Hasta</label><input type="date" id="admin-palets-hasta" value="' + ADMIN_PALETS_ESTADO.fechaFin + '"></div>' +
        '<div class="admin-filtro-campo admin-filtro-busqueda">' +
          '<label>Buscar tienda</label>' +
          '<div class="emails-config-busqueda">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input type="text" id="admin-palets-buscar" placeholder="Nombre de la tienda…">' +
          '</div>' +
        '</div>' +
        '<button type="button" class="btn-admin-buscar" id="btn-admin-palets-buscar">Buscar</button>' +
      '</div>' +
      '<div id="admin-palets-resultado"></div>' +
    '</div>';

  document.getElementById('btn-admin-palets-refrescar').onclick = function () { cargarPaletsForzadosAdmin_(true); };
  document.getElementById('btn-admin-palets-buscar').onclick = function () { cargarPaletsForzadosAdmin_(); };

  document.getElementById('admin-palets-desde').addEventListener('change', function (e) {
    if (!e.target.value) return;
    ADMIN_PALETS_ESTADO.fechaIni = e.target.value;
  });
  document.getElementById('admin-palets-hasta').addEventListener('change', function (e) {
    if (!e.target.value) return;
    ADMIN_PALETS_ESTADO.fechaFin = e.target.value;
  });

  let temporizadorBusquedaPalets = null;
  document.getElementById('admin-palets-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusquedaPalets);
    const valor = e.target.value;
    temporizadorBusquedaPalets = setTimeout(function () {
      ADMIN_PALETS_ESTADO.filtroTexto = valor.trim().toLowerCase();
      pintarTablaPaletsForzados_();
    }, 200);
  });

  // Ya no se busca sola al entrar: si ya había resultados de una búsqueda
  // anterior en esta misma sesión se muestran tal cual (sin volver a pedirlos
  // al servidor); si no, se espera a que el usuario pulse "Buscar".
  if (ADMIN_PALETS_ESTADO.datos) {
    pintarTablaPaletsForzados_();
  } else {
    mostrarPromptBusquedaPalets_();
  }
}

function mostrarPromptBusquedaPalets_() {
  const cont = document.getElementById('admin-palets-resultado');
  if (!cont) return;
  cont.innerHTML =
    '<div class="emails-config-vacio">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
      'Elige el rango de fechas y pulsa "Buscar" para consultar el registro.' +
    '</div>';
}

function cargarPaletsForzadosAdmin_(esRefrescoManual) {
  if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'palets-forzados') return;
  const resultadoEl = document.getElementById('admin-palets-resultado');
  const btnRefrescar = document.getElementById('btn-admin-palets-refrescar');
  if (esRefrescoManual && btnRefrescar) { btnRefrescar.classList.add('girando'); btnRefrescar.disabled = true; }
  if (!esRefrescoManual && resultadoEl) resultadoEl.innerHTML = '<div class="loader">Cargando…</div>';

  llamarApi_('getPaletsForzadosAdmin', [ADMIN_PALETS_ESTADO.fechaIni, ADMIN_PALETS_ESTADO.fechaFin])
    .then(function (datos) {
      if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'palets-forzados') return;
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      ADMIN_PALETS_ESTADO.datos = datos || [];
      pintarTablaPaletsForzados_();
    })
    .catch(function (err) {
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      mostrarErrorServidor(err);
      if (resultadoEl) resultadoEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar el registro.</div>';
    });
}

function pintarTablaPaletsForzados_() {
  const cont = document.getElementById('admin-palets-resultado');
  if (!cont) return;
  const datos = ADMIN_PALETS_ESTADO.datos || [];

  const filtro = ADMIN_PALETS_ESTADO.filtroTexto;
  const items = datos.filter(function (it) { return !filtro || it.tienda.toLowerCase().indexOf(filtro) !== -1; });

  if (!items.length) {
    cont.innerHTML =
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>' +
        (datos.length ? 'Ninguna coincide con la búsqueda.' : 'No hay palets forzados registrados en ese rango de fechas.') +
      '</div>';
    return;
  }

  cont.innerHTML =
    '<div class="admin-resumen">' + items.length + (items.length === 1 ? ' registro' : ' registros') + '</div>' +
    '<div class="admin-tabla-wrap"><table class="admin-tabla">' +
      '<thead><tr><th>Fecha</th><th>Día</th><th>Tienda</th><th>Columna</th><th class="admin-col-palets">Palets</th><th>Usuario</th><th>Registrado</th></tr></thead>' +
      '<tbody>' + items.map(function (it) {
        return '<tr>' +
          '<td>' + escapeHtml(formatearFechaCorta_(it.fecha)) + '</td>' +
          '<td>' + escapeHtml(it.dia) + '</td>' +
          '<td class="admin-col-tienda">' + escapeHtml(it.tienda) + '</td>' +
          '<td>' + escapeHtml(it.columna) + '</td>' +
          '<td class="admin-col-palets">' + escapeHtml(String(it.palets)) + '</td>' +
          '<td>' + escapeHtml(it.usuario || '—') + '</td>' +
          '<td>' + escapeHtml(it.fechaHora) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody>' +
    '</table></div>';
}
