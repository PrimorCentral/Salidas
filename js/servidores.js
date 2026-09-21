/* SALIDAS · js/servidores.js — Administración: Servidores */

/* ---------------- ADMINISTRACIÓN: "Servidores" ----------------
 * Pantalla de solo lectura que muestra el estado de la cuenta principal y
 * de las cuentas puente (envío de lotes de avisos a tiendas), a partir de
 * getEstadoServidores() (solo admin). No hay filtros: son pocas cuentas
 * (una por lote + la principal), así que se listan todas en tarjetas.
 * "Refrescar" vuelve a pedir el estado; no hay caché entre visitas a la
 * sección salvo la de la propia sesión de navegación (mismo espíritu que
 * "Palets forzados": si ya se cargó una vez, se repinta con lo que ya hay
 * y solo se vuelve al servidor si se pulsa Refrescar o es la primera vez).
 */
let ADMIN_SERVIDORES_ESTADO = { datos: null };

function renderAdminServidores() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="vista-card-header">' +
        '<h2>Servidores</h2>' +
        '<div class="vista-card-header-acciones">' +
          '<button type="button" class="btn-admin-refrescar" id="btn-admin-servidores-refrescar" title="Volver a consultar el estado ahora mismo">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
            'Refrescar</button>' +
        '</div>' +
      '</div>' +
      '<p>Cuenta principal y cuentas puente que envían los avisos de palets a tiendas, con su cuota de email restante y cuándo dieron señales de vida por última vez.</p>' +
      '<div id="admin-servidores-resultado"><div class="loader">Cargando…</div></div>' +
    '</div>';

  document.getElementById('btn-admin-servidores-refrescar').onclick = function () { cargarServidoresAdmin_(true); };

  if (ADMIN_SERVIDORES_ESTADO.datos) {
    pintarServidores_();
  } else {
    cargarServidoresAdmin_();
  }
}

function cargarServidoresAdmin_(esRefrescoManual) {
  if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'servidores') return;
  const resultadoEl = document.getElementById('admin-servidores-resultado');
  const btnRefrescar = document.getElementById('btn-admin-servidores-refrescar');
  if (esRefrescoManual && btnRefrescar) { btnRefrescar.classList.add('girando'); btnRefrescar.disabled = true; }
  if (!esRefrescoManual && resultadoEl) resultadoEl.innerHTML = '<div class="loader">Cargando…</div>';

  llamarApi_('getEstadoServidores', [])
    .then(function (datos) {
      if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'servidores') return;
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      ADMIN_SERVIDORES_ESTADO.datos = datos;
      pintarServidores_();
    })
    .catch(function (err) {
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      mostrarErrorServidor(err);
      if (resultadoEl) resultadoEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar el estado de los servidores.</div>';
    });
}

function pintarServidores_() {
  const cont = document.getElementById('admin-servidores-resultado');
  if (!cont) return;
  const datos = ADMIN_SERVIDORES_ESTADO.datos;
  const servidores = (datos && datos.servidores) || [];

  if (!servidores.length) {
    cont.innerHTML =
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>' +
        'Ninguna cuenta se ha registrado todavía.' +
      '</div>';
    return;
  }

  cont.innerHTML =
    '<div class="admin-resumen">' + servidores.length + (servidores.length === 1 ? ' cuenta' : ' cuentas') +
      ' · umbral de conexión: ' + escapeHtml(String(datos.umbralConectadoMinutos)) + ' min</div>' +
    '<div class="servidores-grid">' + servidores.map(pintarTarjetaServidor_).join('') + '</div>';
}

function pintarTarjetaServidor_(s) {
  const conectado = !!s.conectado;
  const cuotaConocida = s.cuotaRestante !== null && s.cuotaRestante !== undefined;
  const cuotaMaximaConocida = cuotaConocida && s.cuotaMaxima !== null && s.cuotaMaxima !== undefined && Number(s.cuotaMaxima) > 0;
  const pctCuota = cuotaMaximaConocida ? Math.max(0, Math.min(100, Math.round((Number(s.cuotaRestante) / Number(s.cuotaMaxima)) * 100))) : null;
  const cuotaBaja = pctCuota !== null && pctCuota <= 15;

  const filaCuota = cuotaConocida
    ? ('<div class="servidor-card-fila"><span class="etiqueta">Cuota email hoy</span><span class="valor">' +
        escapeHtml(String(s.cuotaRestante)) + (cuotaMaximaConocida ? (' / ' + escapeHtml(String(s.cuotaMaxima))) : '') +
      '</span></div>' +
      (cuotaMaximaConocida
        ? '<div class="servidor-card-cuota-barra' + (cuotaBaja ? ' baja' : '') + '"><div style="width:' + pctCuota + '%;"></div></div>'
        : ''))
    : '<div class="servidor-card-fila"><span class="etiqueta">Cuota email hoy</span><span class="valor">—</span></div>';

  const filaConexion = s.esEstaCuenta
    ? '<div class="servidor-card-fila"><span class="etiqueta">Conexión</span><span class="valor">Esta misma cuenta</span></div>'
    : '<div class="servidor-card-fila"><span class="etiqueta">Última conexión</span><span class="valor">' +
        (s.ultimaConexion ? escapeHtml(s.ultimaConexion) : 'nunca') +
      '</span></div>' +
      (s.minutosDesdeUltimaConexion !== null && s.minutosDesdeUltimaConexion !== undefined
        ? '<div class="servidor-card-fila"><span class="etiqueta">Hace</span><span class="valor">' + formatearMinutosTranscurridos_(s.minutosDesdeUltimaConexion) + '</span></div>'
        : '');

  return (
    '<div class="servidor-card ' + (conectado ? 'conectado' : 'desconectado') + '">' +
      '<div class="servidor-card-header">' +
        '<div>' +
          '<div class="servidor-card-nombre">' + escapeHtml(s.nombre || ('Lote ' + s.lote)) + '</div>' +
          (s.email ? '<div class="servidor-card-email">' + escapeHtml(s.email) + '</div>' : '') +
        '</div>' +
        '<span class="servidor-estado-badge ' + (conectado ? 'ok' : 'mal') + '"><span class="badge-dot"></span>' +
          (conectado ? 'Conectado' : 'Sin conexión reciente') +
        '</span>' +
      '</div>' +
      filaCuota +
      filaConexion +
      (s.notas ? '<div class="servidor-card-notas">' + escapeHtml(s.notas) + '</div>' : '') +
    '</div>'
  );
}

/** minutos -> "hace 5 min" / "hace 2 h 10 min" / "hace 3 días", para la
 *  tarjeta de cada cuenta puente en Administración > Servidores. */
function formatearMinutosTranscurridos_(minutos) {
  minutos = Number(minutos) || 0;
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return minutos + ' min';
  const horas = Math.floor(minutos / 60);
  const restoMin = minutos % 60;
  if (horas < 24) return horas + ' h' + (restoMin ? ' ' + restoMin + ' min' : '');
  const dias = Math.floor(horas / 24);
  return dias + (dias === 1 ? ' día' : ' días');
}
