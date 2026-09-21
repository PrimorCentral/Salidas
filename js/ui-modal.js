/* SALIDAS · js/ui-modal.js — Helpers de UI: toasts, modales y botón de cerrar */

function mostrarToast(msg, esError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = esError ? 'show error' : 'show';
  setTimeout(function () { t.className = t.className.replace('show', ''); }, 3200);
}

function mostrarErrorServidor(err) {
  // Si el mensaje viene vacío es porque el error ya se avisó por su cuenta
  // (p.ej. "Sesión caducada" -- ver llamarRpcSupabase_/volverALogin_): no
  // pintamos un segundo toast encima sin contenido.
  if (err && err.message === '') return;
  mostrarToast('Error: ' + (err && err.message ? err.message : err), true);
}

function appConfirm(titulo, texto, onConfirm, peligro) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.toggle('peligro', !!peligro);
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-text').textContent = texto;
  document.getElementById('modal-text').style.display = 'block';
  document.getElementById('modal-textarea').style.display = 'none';
  document.getElementById('modal-custom').style.display = 'none';
  document.getElementById('modal-custom').innerHTML = '';
  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm' + (peligro ? ' danger' : '') + '" id="modal-confirm-btn">' +
    (peligro ? 'Eliminar' : 'Confirmar') + '</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () { cerrarModal(); onConfirm(); };
}

function appPrompt(titulo, placeholder, onSubmit, mayusculas) {
  // mayusculas (opcional, por defecto true): si es true, lo que se escriba
  // en el textarea se convierte a mayúsculas automáticamente mientras se
  // teclea. Se desactiva explícitamente para prompts numéricos (p.ej.
  // "Número de palets a forzar"), donde no aplica.
  if (mayusculas === undefined) mayusculas = true;
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-custom').style.display = 'none';
  document.getElementById('modal-custom').innerHTML = '';
  const textarea = document.getElementById('modal-textarea');
  textarea.value = '';
  textarea.placeholder = placeholder || '';
  textarea.style.display = 'block';
  textarea.oninput = mayusculas
    ? function (e) {
        const el = e.target;
        const inicio = el.selectionStart;
        const fin = el.selectionEnd;
        el.value = el.value.toUpperCase();
        el.setSelectionRange(inicio, fin);
      }
    : null;
  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const texto = textarea.value.trim();
    if (!texto) { textarea.focus(); return; }
    cerrarModal();
    onSubmit(texto);
  };
  setTimeout(function () { textarea.focus(); }, 50);
}

/**
 * Modal informativo de "Enviar Previsión" / "Enviar Definitivo": muestra un resumen (tiendas,
 * total de palets, tiendas sin datos todavía) antes de confirmar, y luego
 * pasa a un estado "Enviando…" con spinner mientras se guarda y se manda
 * el email, terminando en un estado de éxito (se cierra solo) o de error
 * (se puede reintentar/cerrar).
 *
 * datos: { nombre, fechaTexto, totalTiendas, tiendasConDatos, pendientes, totalPalets }
 * onConfirmar: function(callback) — hace el guardado + envío real y llama a
 *              callback(true) si fue bien, o callback(false, mensajeError) si no.
 * tipo: 'prevision' | 'definitivo' — cambia el título del botón y la nota
 *       de aviso, ya que tienen consecuencias distintas.
 */
function mostrarModalEnviarAgencia(datos, onConfirmar, tipo) {
  const esDefinitivo = tipo === 'definitivo';
  document.getElementById('modal-box').classList.add('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-title').style.display = 'none';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';

  const completo = datos.tiendasConDatos >= datos.totalTiendas && datos.totalTiendas > 0;
  const pct = datos.totalTiendas > 0 ? Math.round((datos.tiendasConDatos / datos.totalTiendas) * 100) : 0;

  const filaAviso = datos.pendientes.length
    ? '<div class="modal-envio-aviso">' +
        '<div class="modal-envio-aviso-titulo">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' +
          '<span>' + datos.pendientes.length + ' tienda(s) sin datos todavía</span>' +
        '</div>' +
        '<div class="modal-envio-chips">' +
          datos.pendientes.map(function (t) { return '<span class="modal-envio-chip">' + escapeHtml(quitarCodigoTienda(t)) + '</span>'; }).join('') +
        '</div>' +
      '</div>'
    : '<div class="modal-envio-ok">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<span>Todas las tiendas tienen datos introducidos</span>' +
      '</div>';

  const filaExcedidas = (datos.excedidas && datos.excedidas.length)
    ? '<div class="modal-envio-aviso modal-envio-alerta">' +
        '<div class="modal-envio-aviso-titulo">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' +
          '<span>' + datos.excedidas.length + ' tienda(s) por encima de su límite</span>' +
        '</div>' +
        '<div class="modal-envio-chips">' +
          datos.excedidas.map(function (e) {
            return '<span class="modal-envio-chip">' + escapeHtml(quitarCodigoTienda(e.nombre)) + ' — ' + e.total + '/' + e.limite + '</span>';
          }).join('') +
        '</div>' +
      '</div>'
    : '';

  const pesoFaltante = datos.pesoFaltante || [];
  const bloqueadoPorPeso = pesoFaltante.length > 0;
  const filaPesoFaltante = bloqueadoPorPeso
    ? '<div class="modal-envio-aviso modal-envio-alerta">' +
        '<div class="modal-envio-aviso-titulo">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' +
          '<span>Falta el peso en ' + pesoFaltante.length + ' tienda(s) — es obligatorio para poder enviar</span>' +
        '</div>' +
        '<div class="modal-envio-chips">' +
          pesoFaltante.map(function (n) { return '<span class="modal-envio-chip">' + escapeHtml(quitarCodigoTienda(n)) + '</span>'; }).join('') +
        '</div>' +
      '</div>'
    : '';

  custom.innerHTML =
    '<div class="modal-envio-cabecera">' +
      '<div class="modal-envio-cabecera-icono">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h15v13H3z"/><path d="M18 8h3l3 3v5h-6"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>' +
      '</div>' +
      '<div class="modal-envio-cabecera-texto">' +
        '<div class="nombre">' + escapeHtml(datos.nombre) + (esDefinitivo ? ' · Definitivo' : ' · Previsión') + '</div>' +
        '<div class="fecha">' + escapeHtml(datos.fechaTexto) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-envio-stats">' +
      '<div class="modal-envio-stat' + (completo ? ' completo' : (datos.tiendasConDatos > 0 ? ' acento' : '')) + '">' +
        '<span class="lbl">Tiendas con datos</span>' +
        '<span class="val">' + datos.tiendasConDatos + ' / ' + datos.totalTiendas + '</span>' +
        '<div class="modal-envio-barra"><div class="modal-envio-barra-fill' + (completo ? ' completo' : '') + '" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="modal-envio-stat">' +
        '<span class="lbl">Total palets a cargar</span>' +
        '<span class="val">' + datos.totalPalets + '</span>' +
      '</div>' +
      '<div class="modal-envio-stat">' +
        '<span class="lbl">Progreso</span>' +
        '<span class="val">' + pct + '%</span>' +
      '</div>' +
    '</div>' +
    filaAviso +
    filaExcedidas +
    filaPesoFaltante +
    (esDefinitivo
      ? '<p class="modal-envio-nota">Se enviará el email <strong>definitivo</strong> con el resumen a la agencia de transporte. Después, esta agrupación quedará bloqueada y no se podrá editar.</p>'
      : '<p class="modal-envio-nota">Se enviará un email de <strong>previsión</strong> con el resumen actual a la agencia de transporte. El conteo seguirá siendo editable hasta que envies el definitivo.</p>');

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn"' + (bloqueadoPorPeso ? ' disabled title="Completa el peso de todas las tiendas antes de enviar"' : '') + '>' + (esDefinitivo ? 'Enviar Definitivo' : 'Enviar Previsión') + '</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  if (!bloqueadoPorPeso) {
    document.getElementById('modal-confirm-btn').onclick = function () {
      mostrarModalCargando(esDefinitivo ? 'Enviando el definitivo a la agencia, espere por favor…' : 'Enviando la previsión a la agencia, espere por favor…');
      onConfirmar(function (ok, mensaje) {
        // Si el servidor dice que no hay permiso (p.ej. se lo quitaron con la sesión ya abierta), mismo aviso que al pulsar el botón.
        if (!ok && mensaje === 'Usuario sin permiso') { mostrarModalSinPermiso(); return; }
        mostrarModalResultadoEnvio(ok, mensaje);
      });
    };
  }
}

/** Estado intermedio "Enviando…": sin botones, sin posibilidad de cerrar mientras dura. */
function mostrarModalCargando(texto) {
  document.getElementById('modal-title').textContent = '';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';
  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-cargando"><span class="spinner-navy"></span><span>' + escapeHtml(texto) + '</span></div>';
  document.getElementById('modal-actions').innerHTML = '';
  document.getElementById('modal-overlay').style.display = 'flex';
}

/** Estado final tras el envío: éxito (se cierra solo) o error (queda un botón para cerrar/reintentar). */
function mostrarModalResultadoEnvio(ok, mensaje) {
  const custom = document.getElementById('modal-custom');
  custom.innerHTML =
    '<div class="modal-resultado ' + (ok ? 'exito' : 'error') + '">' +
    (ok
      ? '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>'
      : '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>') +
    '<span>' + escapeHtml(mensaje) + '</span>' +
    '</div>';
  if (ok) {
    setTimeout(cerrarModal, 1300);
  } else {
    const actions = document.getElementById('modal-actions');
    actions.innerHTML = '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>';
    document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  }
}

/** Aviso de "sin permiso": modal con un solo botón "Aceptar" (mismo aspecto que
 *  el de GIDT). Se usa cuando alguien pulsa algo para lo que su usuario no tiene
 *  el permiso (p.ej. Enviar previsión / Enviar definitivo). */
function mostrarModalSinPermiso(mensaje) {
  const box = document.getElementById('modal-box');
  box.classList.remove('ancho', 'medio', 'usuario-form', 'peligro', 'actualizacion', 'gestor-obs');
  box.classList.add('sin-permiso');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Sin permiso';
  document.getElementById('modal-text').textContent = mensaje || 'Usuario no cuenta con los permisos necesarios.';
  document.getElementById('modal-text').style.display = 'block';
  document.getElementById('modal-textarea').style.display = 'none';
  document.getElementById('modal-custom').style.display = 'none';
  document.getElementById('modal-custom').innerHTML = '';
  document.getElementById('modal-actions').innerHTML = '<button class="modal-confirm danger" id="modal-confirm-btn">Aceptar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = cerrarModal;
}

function cerrarModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-overlay').classList.remove('overlay-actualizacion');
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('actualizacion');
  document.getElementById('modal-box').classList.remove('sin-permiso');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.remove('gestor-obs');
  document.getElementById('modal-box').classList.remove('orden-retirada-modal');
  document.getElementById('modal-title').style.display = '';
}
document.getElementById('modal-cerrar-x').onclick = cerrarModal;
