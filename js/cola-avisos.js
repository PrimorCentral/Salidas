/* SALIDAS · js/cola-avisos.js — Administración: Cola de avisos a tiendas */

/* ---------------- ADMINISTRACIÓN: "Cola de avisos a tiendas" ----------------
 * Los avisos de palets a tiendas (barrido del día, ver "Aviso a tiendas"
 * en Configuración) ya NO se envían al momento: enviar_avisos_tiendas()
 * los deja encolados en la tabla cola_emails_tiendas y un job de
 * pg_cron (procesar_cola_emails_tiendas, cada minuto) los va mandando de
 * verdad a un ritmo máximo de 30/min, para no saturar el SMTP.
 * Esta página es solo de consulta/control de esa cola: contadores por
 * estado, filtro por fecha y reintento manual de los que hayan quedado
 * en error (tras 5 intentos automáticos fallidos).
 */
let ADMIN_COLA_EMAILS_ESTADO = { datos: null, fecha: hoyStr(), refrescoAuto: null, filtroEstado: 'encola' };

function renderAdminColaEmails() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;

  ADMIN_COLA_EMAILS_ESTADO.filtroEstado = 'encola';

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="vista-card-header">' +
        '<h2>Cola de avisos a tiendas</h2>' +
        '<div class="vista-card-header-acciones">' +
          '<button type="button" class="btn-admin-refrescar" id="btn-cola-emails-refrescar" title="Volver a consultar la cola ahora mismo">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
            'Refrescar</button>' +
        '</div>' +
      '</div>' +
      '<p>Los avisos de palets a tiendas se encolan aquí y se envían solos, a un ritmo máximo de 30 por minuto, para no saturar el correo. Esta pantalla se refresca sola cada 10 segundos mientras la tengas abierta.</p>' +
      '<div class="admin-filtros">' +
        '<div class="admin-filtro-campo"><label>Fecha (vacío = todas)</label><input type="date" id="cola-emails-fecha" value="' + escapeAttr(ADMIN_COLA_EMAILS_ESTADO.fecha) + '"></div>' +
        '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-cola-emails-reintentar-todos">Reintentar todos los errores</button>' +
      '</div>' +
      '<div id="cola-emails-resultado"><div class="loader">Cargando…</div></div>' +
    '</div>';

  document.getElementById('btn-cola-emails-refrescar').onclick = function () { cargarColaEmailsAdmin_(true); };
  document.getElementById('cola-emails-fecha').addEventListener('change', function (e) {
    ADMIN_COLA_EMAILS_ESTADO.fecha = e.target.value || '';
    cargarColaEmailsAdmin_();
  });
  document.getElementById('btn-cola-emails-reintentar-todos').onclick = function () { reintentarTodosErroresColaEmails_(); };

  cargarColaEmailsAdmin_();

  if (ADMIN_COLA_EMAILS_ESTADO.refrescoAuto) clearInterval(ADMIN_COLA_EMAILS_ESTADO.refrescoAuto);
  ADMIN_COLA_EMAILS_ESTADO.refrescoAuto = setInterval(function () {
    if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'cola-emails') {
      clearInterval(ADMIN_COLA_EMAILS_ESTADO.refrescoAuto);
      ADMIN_COLA_EMAILS_ESTADO.refrescoAuto = null;
      return;
    }
    cargarColaEmailsAdmin_();
  }, 10000);
}

function cargarColaEmailsAdmin_(esRefrescoManual) {
  if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'cola-emails') return;
  const resultadoEl = document.getElementById('cola-emails-resultado');
  const btnRefrescar = document.getElementById('btn-cola-emails-refrescar');
  if (esRefrescoManual && btnRefrescar) { btnRefrescar.classList.add('girando'); btnRefrescar.disabled = true; }
  if (!esRefrescoManual && !ADMIN_COLA_EMAILS_ESTADO.datos && resultadoEl) resultadoEl.innerHTML = '<div class="loader">Cargando…</div>';

  llamarApi_('getColaEmailsTiendas', [ADMIN_COLA_EMAILS_ESTADO.fecha || null])
    .then(function (datos) {
      if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'cola-emails') return;
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      ADMIN_COLA_EMAILS_ESTADO.datos = datos;
      pintarColaEmails_();
    })
    .catch(function (err) {
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      mostrarErrorServidor(err);
      if (resultadoEl) resultadoEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar la cola de emails.</div>';
    });
}

/** Etiquetas (en plural, tal cual se ven en los badges) para cada estado,
 *  usadas tanto para pintar los chips como para el mensaje de "no hay
 *  nada" cuando el filtro activo no tiene filas. */
const COLA_EMAILS_ETIQUETAS_FILTRO_ = {
  pendiente: 'pendientes',
  enviando: 'enviándose',
  enviado: 'enviados',
  error: 'con error'
};
/** Igual que COLA_EMAILS_ETIQUETAS_FILTRO_ pero en singular, para el
 *  mensaje "No hay ningún correo ___" cuando el filtro activo está vacío. */
const COLA_EMAILS_ETIQUETAS_FILTRO_SINGULAR_ = {
  pendiente: 'pendiente',
  enviando: 'enviándose',
  enviado: 'enviado',
  error: 'con error',
  encola: 'en cola'
};

function pintarColaEmails_() {
  const cont = document.getElementById('cola-emails-resultado');
  if (!cont) return;
  const datos = ADMIN_COLA_EMAILS_ESTADO.datos;
  const resumen = (datos && datos.resumen) || { pendiente: 0, enviando: 0, enviado: 0, error: 0 };
  const todasLasFilas = (datos && datos.filas) || [];
  const filtroEfectivo = ADMIN_COLA_EMAILS_ESTADO.filtroEstado;

  const filas = !filtroEfectivo ? todasLasFilas
    : (filtroEfectivo === 'encola'
      ? todasLasFilas.filter(function (f) { return f.estado === 'pendiente' || f.estado === 'enviando'; })
      : todasLasFilas.filter(function (f) { return f.estado === filtroEfectivo; }));

  let html =
    '<div class="admin-resumen">' +
      '<span class="cola-emails-chip pendiente' + ((filtroEfectivo === 'pendiente' || filtroEfectivo === 'encola') ? ' activo' : '') + '" data-filtro-estado="pendiente">' + resumen.pendiente + ' pendientes</span>' +
      '<span class="cola-emails-chip enviando' + ((filtroEfectivo === 'enviando' || filtroEfectivo === 'encola') ? ' activo' : '') + '" data-filtro-estado="enviando">' + resumen.enviando + ' enviándose</span>' +
      '<span class="cola-emails-chip enviado' + (filtroEfectivo === 'enviado' ? ' activo' : '') + '" data-filtro-estado="enviado">' + resumen.enviado + ' enviados</span>' +
      '<span class="cola-emails-chip error' + (filtroEfectivo === 'error' ? ' activo' : '') + '" data-filtro-estado="error">' + resumen.error + ' con error</span>' +
    '</div>';

  if (!todasLasFilas.length) {
    html +=
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>' +
        'No hay correos en la cola' + (ADMIN_COLA_EMAILS_ESTADO.fecha ? ' para esta fecha.' : ' todavía.') +
      '</div>';
  } else if (!filas.length) {
    html +=
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>' +
        'No hay ningún correo ' + COLA_EMAILS_ETIQUETAS_FILTRO_SINGULAR_[filtroEfectivo] + (ADMIN_COLA_EMAILS_ESTADO.fecha ? ' para esta fecha.' : '.') +
      '</div>';
  } else {
    html +=
      '<table class="cola-emails-tabla">' +
        '<thead><tr><th>Tienda</th><th>Email</th><th>Palets</th><th>Conteo</th><th>Fecha envío</th><th>Fecha llegada palets</th><th>Estado</th><th>Intentos</th><th></th></tr></thead>' +
        '<tbody>' +
        filas.map(pintarFilaColaEmail_).join('') +
        '</tbody>' +
      '</table>';
  }

  cont.innerHTML = html;

  cont.querySelectorAll('[data-filtro-estado]').forEach(function (chip) {
    chip.onclick = function () {
      const estado = chip.getAttribute('data-filtro-estado');
      ADMIN_COLA_EMAILS_ESTADO.filtroEstado = (ADMIN_COLA_EMAILS_ESTADO.filtroEstado === estado) ? null : estado;
      pintarColaEmails_();
    };
  });

  cont.querySelectorAll('[data-reintentar-id]').forEach(function (btn) {
    btn.onclick = function () { reintentarEmailCola_(btn.getAttribute('data-reintentar-id')); };
  });
}

function pintarFilaColaEmail_(f) {
  const etiquetas = { pendiente: 'Pendiente', enviando: 'Enviando…', enviado: 'Enviado', error: 'Error' };
  return (
    '<tr>' +
      '<td>' + escapeHtml(f.tienda) + '</td>' +
      '<td>' + escapeHtml(f.email) + '</td>' +
      '<td>' + escapeHtml(String(f.totalPalets)) + '</td>' +
      '<td>' + escapeHtml(fechaDDMMYYYY_(f.fecha)) + '</td>' +
      '<td>' + (f.enviadoEn ? escapeHtml(fechaHoraDDMMYYYY_(f.enviadoEn)) : '<span class="cola-emails-sin-fecha">—</span>') + '</td>' +
      '<td>' + escapeHtml(fechaDDMMYYYY_(f.fechaEntrega)) + '</td>' +
      '<td><span class="cola-emails-estado ' + f.estado + '">' + etiquetas[f.estado] + '</span>' +
        (f.estado === 'error' && f.error ? '<div class="cola-emails-error-detalle" title="' + escapeAttr(f.error) + '">' + escapeHtml(f.error) + '</div>' : '') +
      '</td>' +
      '<td>' + escapeHtml(String(f.intentos)) + '</td>' +
      '<td>' + (f.estado === 'error' ? '<button type="button" class="btn-sincronizar-agrupaciones" data-reintentar-id="' + f.id + '">Reintentar</button>' : '') + '</td>' +
    '</tr>'
  );
}

function reintentarEmailCola_(id) {
  llamarApi_('reintentarEmailCola', [Number(id)])
    .then(function () {
      mostrarToast('Correo puesto de nuevo en la cola, se enviará en el próximo minuto.');
      cargarColaEmailsAdmin_();
    })
    .catch(function (err) { mostrarErrorServidor(err); });
}

function reintentarTodosErroresColaEmails_() {
  llamarApi_('reintentarTodosErroresCola', [ADMIN_COLA_EMAILS_ESTADO.fecha || null])
    .then(function (n) {
      mostrarToast(n > 0 ? (n + ' correo(s) puesto(s) de nuevo en la cola.') : 'No había ningún correo en error.');
      cargarColaEmailsAdmin_();
    })
    .catch(function (err) { mostrarErrorServidor(err); });
}
