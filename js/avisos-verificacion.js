/* SALIDAS · js/avisos-verificacion.js — Aviso a administradores: conteo cambiado DESPUÉS de verificar */

/**
 * Solo para administradores. Cuando alguien cambia un número de una
 * columna (60 / PTA / CART.) que ya estaba verificada, el backend (trigger
 * de "conteos") deja un aviso en avisos_verificacion. Aquí:
 *  - una campana en la cabecera con el número de avisos sin ver,
 *  - un aviso emergente abajo a la izquierda en cuanto llega uno nuevo
 *    (en cualquier pantalla de la app),
 *  - una lista desplegable con el detalle (agrupación, columna, quién
 *    verificó, quién cambió y qué números) y "Ir a la agrupación".
 * Se consulta cada AVISOS_VERIF_MS_ mientras la sesión sea de admin.
 */
const AVISOS_VERIF_MS_ = 15000;
let AVISOS_VERIF_ = { lista: [], intervalo: null, enVuelo: false, yaMostrados: {}, primeraCarga: true };

/** Arranca (o para) la campana según el rol de la sesión. Se llama tras el
 *  login (ver js/auth.js). */
function iniciarAvisosVerificacion_() {
  pararAvisosVerificacion_();
  if (!esAdmin()) return;
  crearCampanaAvisosVerificacion_();
  AVISOS_VERIF_.primeraCarga = true;
  AVISOS_VERIF_.yaMostrados = {};
  consultarAvisosVerificacion_();
  AVISOS_VERIF_.intervalo = setInterval(function () {
    if (!SESSION_TOKEN || !esAdmin()) { pararAvisosVerificacion_(); return; }
    if (document.hidden) return;
    consultarAvisosVerificacion_();
  }, AVISOS_VERIF_MS_);
}

function pararAvisosVerificacion_() {
  if (AVISOS_VERIF_.intervalo) clearInterval(AVISOS_VERIF_.intervalo);
  AVISOS_VERIF_.intervalo = null;
  AVISOS_VERIF_.lista = [];
  const btn = document.getElementById('btn-avisos-verif');
  if (btn) btn.remove();
  const panel = document.getElementById('avisos-verif-panel');
  if (panel) panel.remove();
  const toast = document.getElementById('avisos-verif-toast');
  if (toast) toast.remove();
}

function crearCampanaAvisosVerificacion_() {
  if (document.getElementById('btn-avisos-verif')) return;
  const usuario = document.querySelector('.topbar-usuario');
  if (!usuario) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'btn-avisos-verif';
  btn.className = 'btn-avisos-verif';
  btn.title = 'Conteos cambiados después de verificar';
  btn.setAttribute('aria-label', 'Avisos de conteos cambiados después de verificar');
  btn.innerHTML =
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>' +
    '<span class="avisos-verif-contador" id="avisos-verif-contador"></span>';
  btn.onclick = function (e) { e.stopPropagation(); alternarPanelAvisosVerificacion_(); };
  usuario.parentNode.insertBefore(btn, usuario);

  // Cerrar el desplegable al hacer clic fuera.
  document.addEventListener('click', function (e) {
    const panel = document.getElementById('avisos-verif-panel');
    if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && e.target.id !== 'btn-avisos-verif') {
      panel.style.display = 'none';
    }
  });
}

function consultarAvisosVerificacion_() {
  if (AVISOS_VERIF_.enVuelo || !SESSION_TOKEN) return;
  AVISOS_VERIF_.enVuelo = true;
  llamarApi_('getAvisosVerificacion', [])
    .then(function (lista) {
      AVISOS_VERIF_.lista = lista || [];
      pintarContadorAvisosVerificacion_();
      // Aviso emergente solo para los NUEVOS de esta sesión (no para lo
      // que ya estaba sin ver al entrar: eso lo dice el contador).
      const nuevos = AVISOS_VERIF_.lista.filter(function (a) {
        const clave = a.id + '|' + a.actualizadoEn;
        const nuevo = !a.visto && !a.resuelto && !AVISOS_VERIF_.yaMostrados[clave];
        AVISOS_VERIF_.yaMostrados[clave] = true;
        return nuevo;
      });
      if (!AVISOS_VERIF_.primeraCarga && nuevos.length) mostrarToastAvisoVerificacion_(nuevos[0], nuevos.length);
      AVISOS_VERIF_.primeraCarga = false;
      const panel = document.getElementById('avisos-verif-panel');
      if (panel && panel.style.display !== 'none') pintarPanelAvisosVerificacion_();
    })
    .catch(function () { /* fallo puntual: se reintenta en el siguiente ciclo */ })
    .finally(function () { AVISOS_VERIF_.enVuelo = false; });
}

function pintarContadorAvisosVerificacion_() {
  const el = document.getElementById('avisos-verif-contador');
  if (!el) return;
  const sinVer = AVISOS_VERIF_.lista.filter(function (a) { return !a.visto; }).length;
  el.textContent = sinVer > 9 ? '9+' : (sinVer ? String(sinVer) : '');
  const btn = document.getElementById('btn-avisos-verif');
  if (btn) btn.classList.toggle('con-avisos', sinVer > 0);
}

function etiquetaCampoAviso_(campo) {
  const n = naveDeCampo_(campo);
  return n ? n.etiqueta : campo;
}

function resumenCambiosAviso_(a) {
  return (a.cambios || []).map(function (c) {
    return quitarCodigoTienda(quitarMarcadorNombre(c.tienda || '')) + ' ' + numCambioVerif_(c.antes) + ' → ' + numCambioVerif_(c.despues);
  }).join(' · ');
}

function alternarPanelAvisosVerificacion_() {
  let panel = document.getElementById('avisos-verif-panel');
  if (panel && panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'avisos-verif-panel';
    panel.className = 'avisos-verif-panel';
    document.body.appendChild(panel);
  }
  panel.style.display = 'block';
  pintarPanelAvisosVerificacion_();
  consultarAvisosVerificacion_();
}

function pintarPanelAvisosVerificacion_() {
  const panel = document.getElementById('avisos-verif-panel');
  if (!panel) return;
  const lista = AVISOS_VERIF_.lista;
  panel.innerHTML =
    '<div class="avisos-verif-cabecera">' +
      '<span>Cambios después de verificar</span>' +
      (lista.some(function (a) { return !a.visto; }) ? '<button type="button" class="avisos-verif-todo-visto">Marcar todo como visto</button>' : '') +
    '</div>' +
    (lista.length
      ? '<div class="avisos-verif-lista">' + lista.map(function (a) {
          const titulo = parsearNombreAgrupacion(a.ruta || '').titulo;
          return '<div class="avisos-verif-item' + (a.visto ? ' visto' : '') + (a.resuelto ? ' resuelto' : '') + '">' +
            '<div class="avisos-verif-icono">' + (a.resuelto ? SVG_CHECK_VERIF_ : SVG_AVISO_VERIF_) + '</div>' +
            '<div class="avisos-verif-textos">' +
              '<div class="avisos-verif-titulo">' + escapeHtml(titulo) + ' · columna ' + escapeHtml(etiquetaCampoAviso_(a.campo)) +
                ' <span class="avisos-verif-fecha">' + escapeHtml(formatearFechaCortaAviso_(a.fecha)) + ' ' + escapeHtml(a.hora || '') + '</span></div>' +
              '<div class="avisos-verif-quien">Verificado por <b>' + escapeHtml(a.verificadoPor || '—') + '</b>' + (a.verificadoHora ? ' a las ' + escapeHtml(a.verificadoHora) : '') +
                ' · cambiado por <b>' + escapeHtml(a.modificadoPor || '—') + '</b>' + (a.hora ? ' a las ' + escapeHtml(a.hora) : '') + '</div>' +
              '<div class="avisos-verif-cambios">' + escapeHtml(resumenCambiosAviso_(a)) + '</div>' +
              (a.resuelto
                ? '<div class="avisos-verif-resuelto">' + SVG_CHECK_VERIF_ + 'Vuelto a verificar' + (a.resueltoPor ? ' por ' + escapeHtml(a.resueltoPor) : '') + (a.resueltoHora ? ' a las ' + escapeHtml(a.resueltoHora) : '') + '</div>'
                : '') +
              '<button type="button" class="avisos-verif-ir" data-id="' + escapeAttr(a.id) + '">Ir a la agrupación →</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="avisos-verif-vacio">No hay cambios después de verificar en los últimos 3 días.</div>');

  const btnTodo = panel.querySelector('.avisos-verif-todo-visto');
  if (btnTodo) btnTodo.onclick = function (e) { e.stopPropagation(); marcarAvisosVistos_(null); };
  panel.querySelectorAll('.avisos-verif-ir').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      const aviso = AVISOS_VERIF_.lista.find(function (x) { return x.id === b.getAttribute('data-id'); });
      if (aviso) irAAvisoVerificacion_(aviso);
    };
  });
}

function formatearFechaCortaAviso_(fecha) {
  if (!fecha) return '';
  const p = String(fecha).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : fecha;
}

/** Marca como vistos (ids = null: todos) y actualiza el contador. */
function marcarAvisosVistos_(ids) {
  AVISOS_VERIF_.lista.forEach(function (a) { if (!ids || ids.indexOf(a.id) !== -1) a.visto = true; });
  pintarContadorAvisosVerificacion_();
  pintarPanelAvisosVerificacion_();
  llamarApi_('marcarAvisosVerificacionVistos', [ids]).catch(function () {});
}

function irAAvisoVerificacion_(aviso) {
  marcarAvisosVistos_([aviso.id]);
  const panel = document.getElementById('avisos-verif-panel');
  if (panel) panel.style.display = 'none';
  const toast = document.getElementById('avisos-verif-toast');
  if (toast) toast.remove();
  irAAgrupacionDesdeInicio_(aviso.fecha, aviso.ruta);
}

function mostrarToastAvisoVerificacion_(aviso, total) {
  let toast = document.getElementById('avisos-verif-toast');
  if (toast) toast.remove();
  toast = document.createElement('div');
  toast.id = 'avisos-verif-toast';
  toast.className = 'avisos-verif-toast';
  toast.setAttribute('role', 'alert');
  toast.innerHTML =
    SVG_AVISO_VERIF_ +
    '<div class="avisos-verif-toast-textos">' +
      '<div class="avisos-verif-toast-titulo">Conteo cambiado después de verificar' + (total > 1 ? ' (' + total + ')' : '') + '</div>' +
      '<div class="avisos-verif-toast-detalle">' + escapeHtml(parsearNombreAgrupacion(aviso.ruta || '').titulo) + ' · ' + escapeHtml(etiquetaCampoAviso_(aviso.campo)) +
        ' — ' + escapeHtml(resumenCambiosAviso_(aviso)) + (aviso.modificadoPor ? ' (' + escapeHtml(aviso.modificadoPor) + ')' : '') + '</div>' +
      '<div class="avisos-verif-toast-botones"><button type="button" class="avisos-verif-toast-ver">Ver</button><button type="button" class="avisos-verif-toast-cerrar">Cerrar</button></div>' +
    '</div>';
  document.body.appendChild(toast);
  toast.querySelector('.avisos-verif-toast-ver').onclick = function () { irAAvisoVerificacion_(aviso); };
  toast.querySelector('.avisos-verif-toast-cerrar').onclick = function () { toast.remove(); };
  // Se va solo al cabo de 20 s (el aviso sigue en la campana).
  setTimeout(function () { if (toast.isConnected) toast.remove(); }, 20000);
}
