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
  const esInformatica = tipo === 'informatica';
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
        '<div class="nombre">' + escapeHtml(datos.nombre) + (esDefinitivo ? ' · Definitivo' : (esInformatica ? ' · Informática' : ' · Previsión')) + '</div>' +
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
    (esInformatica
      ? '<p class="modal-envio-nota">Se avisará a <strong>informática</strong> del conteo de esta agrupación, enviándole el resumen actual por email.</p>'
      : esDefinitivo
      ? '<p class="modal-envio-nota">Se enviará el email <strong>definitivo</strong> con el resumen a la agencia de transporte. Después, esta agrupación quedará bloqueada y no se podrá editar.</p>'
      : '<p class="modal-envio-nota">Se enviará un email de <strong>previsión</strong> con el resumen actual a la agencia de transporte. El conteo seguirá siendo editable hasta que envies el definitivo.</p>');

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn"' + (bloqueadoPorPeso ? ' disabled title="Completa el peso de todas las tiendas antes de enviar"' : '') + '>' + (esDefinitivo ? 'Enviar Definitivo' : (esInformatica ? 'Enviar a informática' : 'Enviar Previsión')) + '</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  if (!bloqueadoPorPeso) {
    document.getElementById('modal-confirm-btn').onclick = function () {
      mostrarModalCargando(esDefinitivo ? 'Enviando el definitivo a la agencia, espere por favor…' : (esInformatica ? 'Avisando a informática, espere por favor…' : 'Enviando la previsión a la agencia, espere por favor…'));
      onConfirmar(function (ok, mensaje) {
        // Si el servidor dice que no hay permiso (p.ej. se lo quitaron con la sesión ya abierta), mismo aviso que al pulsar el botón.
        if (!ok && mensaje === 'Usuario sin permiso') { mostrarModalSinPermiso(); return; }
        mostrarModalResultadoEnvio(ok, mensaje);
      });
    };
  }
}

/**
 * Modal "Confirma el número de palets a cargar en el camión": sale ANTES del
 * resumen de "Enviar Previsión" / "Enviar Definitivo" solo si alguna tienda
 * está por encima de su límite. Por cada tienda pasada se pide cuántos
 * palets van realmente en el camión; ese número es el que sale en la
 * columna TOTAL del email a la agencia (el conteo guardado no se toca).
 *
 * excedidas: [{ nombre, carga, otros, limite, sugerido }]
 *   carga    = TOTAL real de la fila (lo que iría en el email)
 *   otros    = VIERNES + DOMINGO (cuentan para el límite, no van en el email)
 *   sugerido = valor propuesto por defecto (límite - otros, sin pasar de carga)
 * onConfirmar: function(ajustes) con ajustes = { 'NOMBRE TIENDA': palets }
 */
function mostrarModalConfirmarPalets(datos, excedidas, tipo, onConfirmar) {
  const box = document.getElementById('modal-box');
  box.classList.remove('usuario-form', 'medio', 'peligro');
  box.classList.add('ancho');
  document.getElementById('modal-title').style.display = 'none';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';

  const titulo = excedidas.length === 1
    ? '1 tienda por encima de su límite'
    : excedidas.length + ' tiendas por encima de su límite';
  const etiquetaTipo = tipo === 'definitivo' ? 'Definitivo' : 'Previsión';

  const filas = excedidas.map(function (e, i) {
    return '<tr>' +
      '<td class="tienda">' + escapeHtml(quitarCodigoTienda(e.nombre)) + '</td>' +
      '<td class="num total">' + e.carga + (e.otros ? '<div class="modal-palets-otros">+' + e.otros + ' vie/dom</div>' : '') + '</td>' +
      '<td class="num">' + e.limite + '</td>' +
      '<td class="num"><div class="modal-palets-ctrl">' +
        '<button type="button" data-i="' + i + '" data-d="-1" aria-label="Restar">−</button>' +
        '<input type="number" min="0" step="1" inputmode="numeric" data-i="' + i + '" value="' + e.sugerido + '">' +
        '<button type="button" data-i="' + i + '" data-d="1" aria-label="Sumar">+</button>' +
      '</div><div class="modal-palets-quedan" data-q="' + i + '"></div></td>' +
    '</tr>';
  }).join('');

  custom.innerHTML =
    '<div class="modal-envio-cabecera">' +
      '<div class="modal-envio-cabecera-icono modal-palets-icono">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h15v13H3z"/><path d="M18 8h3l3 3v5h-6"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>' +
      '</div>' +
      '<div class="modal-envio-cabecera-texto">' +
        '<div class="nombre">Confirma el número de palets a cargar en el camión</div>' +
        '<div class="fecha">' + escapeHtml(datos.nombre) + ' · ' + etiquetaTipo + ' · ' + escapeHtml(datos.fechaTexto) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>' +
      '<span>' + titulo + '</span></div></div>' +
    '<p class="modal-palets-intro">Indica cuántos palets van realmente en el camión. Es el número que saldrá en el email a la agencia. Por defecto se propone el límite de cada tienda.</p>' +
    '<table class="modal-palets-tabla"><thead><tr><th>Tienda</th><th class="num">Contados</th><th class="num">Límite</th><th class="num">A cargar</th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Confirmar y continuar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';

  const inputs = custom.querySelectorAll('.modal-palets-ctrl input');

  function valor(inp) {
    const v = parseInt(inp.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function refrescar() {
    inputs.forEach(function (inp) {
      const e = excedidas[inp.getAttribute('data-i')];
      const q = custom.querySelector('[data-q="' + inp.getAttribute('data-i') + '"]');
      const v = valor(inp);
      const pasado = v + e.otros > e.limite;
      const vacio = inp.value === '';
      inp.classList.toggle('pasado', pasado || vacio);
      q.classList.toggle('pasado', pasado || vacio);
      if (vacio) q.textContent = 'Indica un número';
      else if (pasado) q.textContent = '+' + (v + e.otros - e.limite) + ' sobre el límite';
      else q.textContent = (e.carga - v > 0) ? 'Quedan ' + (e.carga - v) + ' en nave' : '';
    });
  }

  custom.querySelectorAll('.modal-palets-ctrl button').forEach(function (b) {
    b.onclick = function () {
      const inp = custom.querySelector('input[data-i="' + b.getAttribute('data-i') + '"]');
      inp.value = Math.max(0, valor(inp) + Number(b.getAttribute('data-d')));
      refrescar();
    };
  });
  inputs.forEach(function (inp) { inp.oninput = refrescar; });
  refrescar();

  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const ajustes = {};
    let falta = null;
    inputs.forEach(function (inp) {
      if (inp.value === '' && !falta) falta = inp;
      ajustes[excedidas[inp.getAttribute('data-i')].nombre] = valor(inp);
    });
    if (falta) { falta.focus(); return; }
    onConfirmar(ajustes);
  };
  setTimeout(function () { if (inputs[0]) inputs[0].select(); }, 50);
}

/**
 * Camioncito junto al total de palets de la cabecera.
 *
 * Con el servidor nuevo (seccion.carga definida, aunque sea null) sale
 * SIEMPRE, con un color por estado:
 *   gris tenue  -> nadie ha ajustado la carga todavía
 *   azul        -> carga ajustada a mano, sin enviar
 *   ámbar       -> Previsión enviada
 *   rojo + "!"  -> el conteo cambió después de ajustar: hay que verificar
 *   verde       -> Definitivo enviado (ya no se puede tocar)
 * revisar: true si alguna tienda ajustada ha cambiado de conteo (lo
 * calcula el panel en vivo, ver tiendasARevisar_ en conteos-panel.js).
 *
 * Si seccion.carga no viene (servidor antiguo), como antes: solo aparece
 * tras la Previsión o el Definitivo. Ámbar tras la previsión, verde tras
 * el definitivo.
 */
function htmlBotonListaCarga_(seccion, revisar) {
  const svg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h15v13H3z"/><path d="M18 8h3l3 3v5h-6"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>';
  if (seccion.carga === undefined) {
    if (!seccion.previsionEnviada && seccion.estado !== 'enviado') return '';
    const esDefAnt = seccion.estado === 'enviado';
    return '<button type="button" class="btn-lista-carga' + (esDefAnt ? ' definitivo' : '') + '" title="Lista de carga (' + (esDefAnt ? 'definitivo' : 'previsión') + ')" aria-label="Lista de carga">' + svg + '</button>';
  }
  const c = seccion.carga;
  let clase = ' sin-configurar', titulo = 'Carga sin configurar';
  if (seccion.estado === 'enviado' || (c && c.origen === 'definitivo')) { clase = ' definitivo'; titulo = 'Lista de carga (definitivo)'; }
  else if (revisar) { clase = ' revisar'; titulo = 'El conteo ha cambiado: hay que verificar la carga'; }
  else if (c && c.origen === 'prevision') { clase = ''; titulo = 'Lista de carga (previsión)'; }
  else if (c && c.origen === 'ajuste') { clase = ' ajustada'; titulo = 'Carga ajustada (sin enviar)'; }
  return '<button type="button" class="btn-lista-carga' + clase + '" title="' + titulo + '" aria-label="' + titulo + '">' + svg + '</button>';
}

const ICONO_CAMION_20_ = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h15v13H3z"/><path d="M18 8h3l3 3v5h-6"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>';
const ICONO_AVISO_20_ = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
const ICONO_AVISO_16_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
const ICONO_CHECK_14_ = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
const ICONO_CANDADO_15_ = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICONO_INFO_16_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';

/** Prepara el modal "ancho" con contenido propio (sin título ni textarea). */
function prepararModalCarga_() {
  const box = document.getElementById('modal-box');
  box.classList.remove('usuario-form', 'medio', 'peligro');
  box.classList.add('ancho');
  document.getElementById('modal-title').style.display = 'none';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';
  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  return custom;
}

function cabeceraModalCarga_(titulo, subtitulo, variante) {
  return '<div class="modal-envio-cabecera">' +
    '<div class="modal-envio-cabecera-icono' + (variante ? ' ' + variante : '') + '">' + (variante === 'rojo' ? ICONO_AVISO_20_ : ICONO_CAMION_20_) + '</div>' +
    '<div class="modal-envio-cabecera-texto">' +
      '<div class="nombre">' + escapeHtml(titulo) + '</div>' +
      '<div class="fecha">' + escapeHtml(subtitulo) + '</div>' +
    '</div>' +
  '</div>';
}

/** Pastilla "Carga ajustada / Previsión enviada / Definitivo enviado a las X h por Y". */
function estadoCargaHtml_(carga) {
  if (!carga) return '';
  const textos = { ajuste: 'Carga ajustada', prevision: 'Previsión enviada', definitivo: 'Definitivo enviado' };
  const clases = { ajuste: ' ajuste', prevision: ' prevision', definitivo: '' };
  return '<div class="modal-lista-estado' + (clases[carga.origen] || '') + '">' + ICONO_CHECK_14_ +
    (textos[carga.origen] || 'Carga guardada') +
    (carga.hora ? ' a las ' + escapeHtml(carga.hora) + ' h' : '') +
    (carga.por ? ' por ' + escapeHtml(carga.por) : '') +
    '</div>';
}

function statsCargaHtml_(totContados, totCargar, totSobra) {
  return '<div class="modal-envio-stats">' +
    '<div class="modal-envio-stat"><span class="lbl">Contados</span><span class="val">' + totContados + '</span></div>' +
    '<div class="modal-envio-stat completo"><span class="lbl">A cargar</span><span class="val">' + totCargar + '</span></div>' +
    '<div class="modal-envio-stat' + (totSobra ? ' acento' : '') + '"><span class="lbl">Quedan en nave</span><span class="val">' + totSobra + '</span></div>' +
  '</div>';
}

/** Etiqueta roja "Conteo cambiado: 7 → 9" para las tiendas a revisar. */
function etiquetaCambioConteo_(cambio) {
  return '<div><span class="modal-carga-cambio">Conteo cambiado: ' + cambio.antes + ' → ' + cambio.ahora + '</span></div>';
}

/**
 * Tabla de solo lectura TIENDA / A CARGAR / SOBRANTE.
 * lista: [{tienda, contados, cargar, cerrada}]
 * revisar: { 'NOMBRE TIENDA': {antes, ahora} } (opcional)
 * marcarAjustadas: añade la etiqueta "Ajustada" donde cargar ≠ contados.
 * Devuelve { html, filas (para imprimir), totContados, totCargar, totSobra }.
 */
function tablaCargaFija_(lista, revisar, marcarAjustadas) {
  revisar = revisar || {};
  let totContados = 0, totCargar = 0, totSobra = 0;
  const filas = lista.map(function (t) {
    if (t.cerrada) {
      return { html: '<tr class="cerrada"><td class="tienda">' + escapeHtml(t.tienda) + '</td><td class="num" colspan="2">CERRADA</td></tr>', tienda: t.tienda, cerrada: true };
    }
    const contados = Number(t.contados) || 0;
    const cargar = Number(t.cargar) || 0;
    const sobra = Math.max(0, contados - cargar);
    const cambio = revisar[t.tienda];
    const ajustada = marcarAjustadas && cargar !== contados && !cambio;
    totContados += contados; totCargar += cargar; totSobra += sobra;
    return {
      html: '<tr class="' + (cambio ? 'revisar' : (ajustada ? 'ajustada' : '')) + '"><td class="tienda">' + escapeHtml(t.tienda) + (cambio ? etiquetaCambioConteo_(cambio) : '') + '</td>' +
        '<td class="num cargar' + (cambio ? ' revisar' : '') + '">' + cargar + '</td>' +
        '<td class="num sobra' + (sobra ? '' : ' cero') + '">' + (sobra || '—') + '</td></tr>',
      tienda: t.tienda, cargar: cargar, sobra: sobra
    };
  });
  const html = '<div class="modal-tabla-scroll"><table class="modal-lista-tabla">' +
    '<thead><tr><th>Tienda</th><th class="num">A cargar</th><th class="num">Sobrante</th></tr></thead>' +
    '<tbody>' + filas.map(function (f) { return f.html; }).join('') + '</tbody>' +
    '<tfoot><tr><td>Total palets</td><td class="num">' + totCargar + '</td><td class="num">' + totSobra + '</td></tr></tfoot>' +
  '</table></div>';
  return { html: html, filas: filas, totContados: totContados, totCargar: totCargar, totSobra: totSobra };
}

const BANDA_SOLO_LECTURA_CARGA_ = '<div class="modal-carga-solo-lectura">' + ICONO_CANDADO_15_ + '<span>Solo lectura. Para cambiar la carga hace falta el permiso «Ajustar carga».</span></div>';

/**
 * Modal "Lista de carga" (camioncito): TIENDA, TOTAL a cargar y SOBRANTE.
 *
 * info: { tipo: 'ajuste'|'prevision'|'definitivo', hora, enviadoPor, lista } o null
 * extra (opcional, servidor nuevo):
 *   revisar:     { 'NOMBRE TIENDA': {antes, ahora} } tiendas cuyo conteo cambió
 *   soloLectura: muestra la banda "Solo lectura" (usuario sin permiso)
 *   onAjustar:   si viene, botón "Ajustar carga" / "Verificar carga"
 */
function mostrarModalListaCarga(info, titulo, fechaTexto, extra) {
  extra = extra || {};
  const custom = prepararModalCarga_();
  const revisar = extra.revisar || {};
  const hayRevisar = Object.keys(revisar).length > 0;
  const lista = (info && Array.isArray(info.lista)) ? info.lista : null;
  const tipo = info ? info.tipo : null;

  let cuerpo;
  let tabla = null;
  if (!info) {
    cuerpo = '<p class="modal-envio-nota">Todavía nadie ha ajustado la carga de esta agrupación. Al enviar se usará lo contado, como hasta ahora.</p>';
  } else if (!lista) {
    cuerpo = estadoCargaHtml_({ origen: tipo, hora: info.hora, por: info.enviadoPor }) +
      '<p class="modal-envio-nota">Este envío se hizo antes de que la app guardase la lista de carga, así que no hay lista para él. Aparecerá en los próximos envíos.</p>';
  } else {
    tabla = tablaCargaFija_(lista, revisar, tipo === 'ajuste');
    cuerpo = estadoCargaHtml_({ origen: tipo, hora: info.hora, por: info.enviadoPor }) +
      (hayRevisar
        ? '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
            '<span>El conteo ha cambiado después de fijar la carga. Un responsable con permiso «Ajustar carga» tiene que verificarla.</span></div></div>'
        : '') +
      statsCargaHtml_(tabla.totContados, tabla.totCargar, tabla.totSobra) + tabla.html;
  }

  custom.innerHTML =
    cabeceraModalCarga_(info ? 'Lista de carga · ' + titulo : 'Carga del camión · ' + titulo, fechaTexto, hayRevisar ? 'rojo' : '') +
    (extra.soloLectura ? BANDA_SOLO_LECTURA_CARGA_ : '') +
    cuerpo;

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>' +
    (extra.onAjustar ? '<button class="modal-secundario" id="modal-ajustar-btn">' + (hayRevisar ? 'Verificar carga' : 'Ajustar carga') + '</button>' : '') +
    (tabla ? '<button class="modal-confirm" id="modal-confirm-btn">Imprimir</button>' : '');
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  if (extra.onAjustar) document.getElementById('modal-ajustar-btn').onclick = extra.onAjustar;
  if (tabla) {
    const tipoTexto = tipo === 'definitivo' ? 'Definitivo' : (tipo === 'ajuste' ? 'Carga ajustada' : 'Previsión');
    document.getElementById('modal-confirm-btn').onclick = function () {
      imprimirListaCarga_(titulo, fechaTexto, tipoTexto, tabla.filas, tabla.totCargar, tabla.totSobra);
    };
  }
}

/**
 * Modal "Ajustar carga del camión" / "Verificar carga del camión".
 *
 * datos: {
 *   titulo, fechaTexto,
 *   filas: [{ nombre, contados, limite, otros, cerrada, cargar, cambio: {antes, ahora}|null }],
 *   carga: carga vigente (para decir quién la ajustó) o null,
 *   tipoEnvio: 'prevision'|'definitivo'|null (si se abre en mitad de un envío),
 *   onGuardar: function(cargas) con cargas = { 'NOMBRE TIENDA': palets },
 *   onCancelar: opcional
 * }
 */
function mostrarModalAjustarCarga(datos) {
  const custom = prepararModalCarga_();
  const filasDatos = datos.filas;
  const cambios = filasDatos.filter(function (f) { return f.cambio; });
  const revisar = cambios.length > 0;
  const enEnvio = !!datos.tipoEnvio;
  const etiquetaTipo = datos.tipoEnvio === 'definitivo' ? 'Definitivo' : 'Previsión';

  const filas = filasDatos.map(function (f, i) {
    if (f.cerrada) return '<tr class="cerrada"><td class="tienda">' + escapeHtml(quitarCodigoTienda(f.nombre)) + '</td><td class="num" colspan="3">CERRADA</td></tr>';
    const hayLimite = !isNaN(f.limite) && f.limite > 0;
    return '<tr class="' + (f.cambio ? 'revisar' : '') + '" data-fila="' + i + '">' +
      '<td class="tienda">' + escapeHtml(quitarCodigoTienda(f.nombre)) + (f.cambio ? etiquetaCambioConteo_(f.cambio) : '') + '</td>' +
      '<td class="num contados' + (hayLimite && f.contados + f.otros > f.limite ? ' pasado' : '') + '">' + f.contados +
        (f.otros ? '<div class="modal-palets-otros">+' + f.otros + ' vie/dom</div>' : '') + '</td>' +
      '<td class="num">' + (hayLimite ? f.limite : '—') + '</td>' +
      '<td class="num"><div class="modal-palets-ctrl">' +
        '<button type="button" data-i="' + i + '" data-d="-1" aria-label="Restar">−</button>' +
        '<input type="number" min="0" step="1" inputmode="numeric" id="carga-tienda-' + i + '" data-i="' + i + '" value="' + f.cargar + '">' +
        '<button type="button" data-i="' + i + '" data-d="1" aria-label="Sumar">+</button>' +
      '</div><div class="modal-palets-quedan" data-q="' + i + '"></div></td>' +
    '</tr>';
  }).join('');

  const quien = datos.carga && datos.carga.por
    ? (datos.carga.origen === 'prevision' ? 'se envió la previsión' : datos.carga.por + ' ajustó la carga') + (datos.carga.hora ? ' (' + datos.carga.hora + ' h)' : '')
    : 'se fijó la carga';

  custom.innerHTML =
    cabeceraModalCarga_(revisar ? 'Verificar carga del camión' : 'Ajustar carga del camión',
      datos.titulo + ' · ' + (enEnvio ? etiquetaTipo + ' · ' : '') + datos.fechaTexto, revisar ? 'rojo' : '') +
    '<div class="modal-carga-stats"></div>' +
    (revisar
      ? '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
          '<span>El conteo ha cambiado en ' + cambios.length + (cambios.length === 1 ? ' tienda' : ' tiendas') + ' desde que ' + escapeHtml(quien) +
          '. La carga no se ha tocado: revísala y pulsa «' + (enEnvio ? 'Verificar y continuar' : 'Verificar carga') + '».</span></div></div>'
      : '') +
    '<div class="modal-carga-pasadas"></div>' +
    '<p class="modal-palets-intro">Indica cuántos palets van en el camión por tienda. Es lo que saldrá en el email a la agencia. ' +
      (enEnvio ? 'Al confirmar se guarda y sigues con el envío.' : 'Se guarda sin enviar nada; se puede cambiar hasta que se mande el definitivo.') + '</p>' +
    '<div class="modal-tabla-scroll"><table class="modal-palets-tabla"><thead><tr><th>Tienda</th><th class="num">Contados</th><th class="num">Límite</th><th class="num">A cargar</th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button type="button" class="modal-enlace izq" id="modal-restablecer-btn">Restablecer a lo contado</button>' +
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">' +
      (revisar ? (enEnvio ? 'Verificar y continuar' : 'Verificar carga') : (enEnvio ? 'Guardar y continuar' : 'Guardar carga')) +
    '</button>';
  document.getElementById('modal-overlay').style.display = 'flex';

  const inputs = Array.prototype.slice.call(custom.querySelectorAll('.modal-palets-ctrl input'));
  const btnOk = document.getElementById('modal-confirm-btn');
  function valor(inp) {
    const v = parseInt(inp.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function refrescar() {
    let totContados = 0, totCargar = 0, pasadas = 0, vacias = 0;
    inputs.forEach(function (inp) {
      const f = filasDatos[inp.getAttribute('data-i')];
      const q = custom.querySelector('[data-q="' + inp.getAttribute('data-i') + '"]');
      const v = valor(inp);
      const vacio = inp.value === '';
      const pasado = !isNaN(f.limite) && f.limite > 0 && v + f.otros > f.limite;
      totContados += f.contados; totCargar += v;
      if (pasado) pasadas++;
      if (vacio) vacias++;
      inp.classList.toggle('pasado', pasado || vacio);
      q.classList.toggle('pasado', pasado || vacio);
      if (vacio) q.textContent = 'Indica un número';
      else if (pasado) q.textContent = '+' + (v + f.otros - f.limite) + ' sobre el límite';
      else if (f.contados - v > 0) q.textContent = 'Quedan ' + (f.contados - v) + ' en nave';
      else if (v > f.contados) q.textContent = '+' + (v - f.contados) + ' sobre lo contado';
      else q.textContent = '';
    });
    custom.querySelector('.modal-carga-stats').innerHTML = statsCargaHtml_(totContados, totCargar, Math.max(0, totContados - totCargar));
    custom.querySelector('.modal-carga-pasadas').innerHTML = pasadas
      ? '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
          '<span>' + pasadas + (pasadas === 1 ? ' tienda sigue' : ' tiendas siguen') + ' por encima de su límite</span></div></div>'
      : '';
    btnOk.disabled = vacias > 0;
  }

  custom.querySelectorAll('.modal-palets-ctrl button').forEach(function (b) {
    b.onclick = function () {
      const inp = custom.querySelector('input[data-i="' + b.getAttribute('data-i') + '"]');
      inp.value = Math.max(0, valor(inp) + Number(b.getAttribute('data-d')));
      refrescar();
    };
  });
  inputs.forEach(function (inp) { inp.oninput = refrescar; });
  refrescar();

  document.getElementById('modal-restablecer-btn').onclick = function () {
    inputs.forEach(function (inp) { inp.value = filasDatos[inp.getAttribute('data-i')].contados; });
    refrescar();
  };
  document.getElementById('modal-cancel-btn').onclick = function () {
    cerrarModal();
    if (datos.onCancelar) datos.onCancelar();
  };
  btnOk.onclick = function () {
    const cargas = {};
    let falta = null;
    inputs.forEach(function (inp) {
      if (inp.value === '' && !falta) falta = inp;
      cargas[filasDatos[inp.getAttribute('data-i')].nombre] = valor(inp);
    });
    if (falta) { falta.focus(); return; }
    datos.onGuardar(cargas);
  };
}

/**
 * Modal "¿Es correcta esta carga?": sale al pulsar Enviar Previsión /
 * Enviar Definitivo cuando ya hay una carga guardada (ajustada a mano o
 * de la previsión) y no hay nada pendiente de verificar.
 *
 * datos: { titulo, fechaTexto, tipo, carga, lista: [{tienda, contados, cargar, cerrada}],
 *          onSi, onModificar (null si el usuario no tiene permiso) }
 */
function mostrarModalCargaCorrecta(datos) {
  const custom = prepararModalCarga_();
  const etiqueta = datos.tipo === 'definitivo' ? 'Definitivo' : 'Previsión';
  const tabla = tablaCargaFija_(datos.lista, null, true);
  custom.innerHTML =
    cabeceraModalCarga_('¿Es correcta esta carga?', datos.titulo + ' · ' + etiqueta + ' · ' + datos.fechaTexto, 'ambar') +
    estadoCargaHtml_(datos.carga) +
    statsCargaHtml_(tabla.totContados, tabla.totCargar, tabla.totSobra) +
    '<div class="modal-envio-aviso modal-carga-info"><div class="modal-envio-aviso-titulo">' + ICONO_INFO_16_ +
      '<span>Esta es la carga que irá en el email de ' + etiqueta.toLowerCase() + '.</span></div></div>' +
    tabla.html;

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel izq" id="modal-cancel-btn">Cancelar</button>' +
    (datos.onModificar ? '<button class="modal-secundario" id="modal-modificar-btn">Modificar carga</button>' : '') +
    '<button class="modal-confirm" id="modal-confirm-btn">Sí, es correcta</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  if (datos.onModificar) document.getElementById('modal-modificar-btn').onclick = datos.onModificar;
  document.getElementById('modal-confirm-btn').onclick = datos.onSi;
}

/**
 * Modal "No se puede enviar todavía": la carga está pendiente de verificar
 * y el usuario no tiene el permiso "Ajustar carga".
 *
 * datos: { titulo, fechaTexto, tipo, lista, revisar }
 */
function mostrarModalCargaPendiente(datos) {
  const custom = prepararModalCarga_();
  const tabla = tablaCargaFija_(datos.lista, datos.revisar, false);
  custom.innerHTML =
    cabeceraModalCarga_('No se puede enviar todavía', datos.titulo + ' · ' + (datos.tipo === 'definitivo' ? 'Definitivo' : 'Previsión') + ' · ' + datos.fechaTexto, 'rojo') +
    '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
      '<span>El conteo ha cambiado después de fijar la carga. Avisa a un responsable con permiso «Ajustar carga» para que la verifique.</span></div></div>' +
    statsCargaHtml_(tabla.totContados, tabla.totCargar, tabla.totSobra) + tabla.html;
  document.getElementById('modal-actions').innerHTML = '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
}

/** Imprime la lista de carga en una hoja limpia (iframe oculto), sin tocar
 *  la hoja de impresión del día ni el resto de la pantalla. */
function imprimirListaCarga_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra) {
  const celda = 'padding:6px 12px;border:1px solid #999;';
  const html =
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Lista de carga</title>' +
    '<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#444;font-size:13px}' +
    'table{border-collapse:collapse;width:100%;font-size:15px}th{background:#eee;text-align:left}td.n,th.n{text-align:center;width:110px}</style></head><body>' +
    '<h1>Lista de carga · ' + escapeHtml(titulo) + '</h1>' +
    '<p>' + escapeHtml(fechaTexto) + ' · ' + tipoTexto + '</p>' +
    '<table><tr><th style="' + celda + '">TIENDA</th><th class="n" style="' + celda + '">TOTAL</th><th class="n" style="' + celda + '">SOBRANTE</th></tr>' +
    filas.map(function (f) {
      return f.cerrada
        ? '<tr><td style="' + celda + '">' + escapeHtml(f.tienda) + '</td><td class="n" colspan="2" style="' + celda + 'font-weight:bold;">CERRADA</td></tr>'
        : '<tr><td style="' + celda + '">' + escapeHtml(f.tienda) + '</td><td class="n" style="' + celda + 'font-weight:bold;">' + f.cargar + '</td><td class="n" style="' + celda + '">' + (f.sobra || '') + '</td></tr>';
    }).join('') +
    '<tr><td style="' + celda + 'font-weight:bold;background:#eee;">TOTAL PALETS</td><td class="n" style="' + celda + 'font-weight:bold;background:#eee;">' + totCargar + '</td><td class="n" style="' + celda + 'font-weight:bold;background:#eee;">' + totSobra + '</td></tr>' +
    '</table></body></html>';

  const viejo = document.getElementById('iframe-lista-carga');
  if (viejo) viejo.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'iframe-lista-carga';
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(function () {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  }, 150);
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
  document.getElementById('modal-box').classList.remove('acerca-de');
  document.getElementById('modal-box').classList.remove('cambio-obligatorio');
  document.getElementById('modal-title').style.display = '';
}
document.getElementById('modal-cerrar-x').onclick = cerrarModal;
