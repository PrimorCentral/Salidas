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
const ICONO_CAMION_16_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h15v13H3z"/><path d="M18 8h3l3 3v5h-6"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>';
const ICONO_AVISO_20_ = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
const ICONO_AVISO_16_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
const ICONO_CHECK_14_ = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
const ICONO_CANDADO_15_ = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const ICONO_INFO_16_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>';

const ICONO_LAPIZ_15_ = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const ICONO_LAPIZ_12_ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

/**
 * Lápiz de edición al lado de la X (modal de carga del camión).
 * activo=false -> "Editar carga" (vista de solo lectura)
 * activo=true  -> marcado mientras se edita; pulsarlo sale de la edición.
 */
function ponerLapizModal_(activo, onClick) {
  quitarLapizModal_();
  const box = document.getElementById('modal-box');
  const b = document.createElement('button');
  b.type = 'button';
  b.id = 'modal-editar-lapiz';
  b.className = 'modal-editar-lapiz' + (activo ? ' activo' : '');
  b.title = activo ? 'Salir de la edición' : 'Editar carga';
  b.setAttribute('aria-label', b.title);
  b.innerHTML = ICONO_LAPIZ_15_;
  b.onclick = onClick;
  box.appendChild(b);
  box.classList.add('con-lapiz');
}
function quitarLapizModal_() {
  const b = document.getElementById('modal-editar-lapiz');
  if (b) b.remove();
  document.getElementById('modal-box').classList.remove('con-lapiz');
}

/** Prepara el modal "ancho" con contenido propio (sin título ni textarea). */
function prepararModalCarga_() {
  quitarLapizModal_();
  const box = document.getElementById('modal-box');
  box.classList.remove('usuario-form', 'medio', 'peligro');
  box.classList.add('ancho');
  document.getElementById('modal-title').style.display = 'none';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';
  const custom = document.getElementById('modal-custom');
  // En columna: cabecera, totales y botones quietos; solo se desplaza la
  // tabla (ver .modal-tabla-scroll en styles.css). Los demás modales vuelven
  // a poner display:block al abrirse.
  custom.style.display = 'flex';
  custom.style.flexDirection = 'column';
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
  if (carga.origen === 'contado') {
    return '<div class="modal-lista-estado contado">' + ICONO_INFO_16_ + 'Sin ajustar: se cargará lo contado</div>';
  }
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

/** Modales de la carga del camión en dos columnas (pantalla ancha): a la
 *  izquierda las tarjetas, avisos y camiones; a la derecha la tabla de
 *  tiendas. En pantalla estrecha (móvil) se apilan como siempre. */
function columnasCarga_(izq, der) {
  return '<div class="modal-carga-cols"><div class="modal-carga-izq">' + izq + '</div><div class="modal-carga-der">' + der + '</div></div>';
}

/** Etiqueta roja "Conteo cambiado: 7 → 9" para las tiendas a revisar. */
function etiquetaCambioConteo_(cambio) {
  return ' <span class="modal-carga-cambio">Conteo cambiado: ' + cambio.antes + ' → ' + cambio.ahora + '</span>';
}

/* ---------------- CAMIONES DE LA CARGA ----------------
 * camiones = [{ matricula, remolque, tiendas: ['NOMBRE TIENDA', ...],
 *               parciales: { 'NOMBRE TIENDA': palets } }] o null/[] (sin
 * camiones: todo como antes).
 * - tiendas: las que van ENTERAS en ese camión. Con un solo camión todas
 *   van en él aunque no estén en la lista.
 * - parciales: tiendas REPARTIDAS entre varios camiones (opción «Dividir…»):
 *   cuántos palets de esa tienda van en este camión. Si lo repartido no
 *   suma lo que se carga, la tienda sale entera en «SIN CAMIÓN ASIGNADO».
 * Las tiendas abiertas que no estén en ningún camión salen en «SIN CAMIÓN
 * ASIGNADO» y las cerradas, al final (igual que en el email a la agencia). */
/** Máximo de palets que puede llevar un camión (no hay camiones más grandes). */
const MAX_PALETS_CAMION = 33;
function camionesValidos_(camiones) {
  return Array.isArray(camiones) ? camiones.filter(function (c) { return c && c.matricula; }) : [];
}
/** Nº de camión (0, 1, ...) de una tienda que va entera, o -1 si no está en ninguno. */
function indiceCamionTienda_(camiones, tienda) {
  if (!camiones || !camiones.length) return -1;
  if (camiones.length === 1) return 0;
  for (let i = 0; i < camiones.length; i++) {
    if (Array.isArray(camiones[i].tiendas) && camiones[i].tiendas.indexOf(tienda) !== -1) return i;
  }
  return -1;
}
/** Reparto de una tienda dividida: [palets camión 1, palets camión 2, ...] o null si va entera. */
function repartoTienda_(camiones, tienda) {
  if (!camiones || camiones.length < 2) return null;
  let hay = false;
  const r = camiones.map(function (c) {
    const n = c && c.parciales && Object.prototype.hasOwnProperty.call(c.parciales, tienda) ? (Number(c.parciales[tienda]) || 0) : 0;
    if (n > 0) hay = true;
    return n;
  });
  return hay ? r : null;
}
function sumaReparto_(r) {
  return (r || []).reduce(function (a, n) { return a + (Number(n) || 0); }, 0);
}
/** Texto de la franja: "CAMIÓN 2 · Matrícula 2210 MBX · Remolque R 0973 BFH". */
function tituloCamionHtml_(camion, idx, n) {
  if (idx < 0) return '<b>SIN CAMIÓN ASIGNADO</b>';
  return '<b>CAMIÓN' + (n >= 2 ? ' ' + (idx + 1) : '') + '</b> · Matrícula <b>' + escapeHtml(camion.matricula || '') +
    '</b> · Remolque <b>' + escapeHtml(camion.remolque || '—') + '</b>';
}
/**
 * Agrupa filas [{cerrada, camion (nº o -1), reparto (array o null), cargar,
 * sobra}] por camión. Devuelve null si no hay camiones; si no, { n, grupos:
 * [{idx, camion, items, cargar, sobra}] (los no asignados al final, idx -1),
 * cerradas }. Cada item es { f, cargar, sobra, parte }: parte = null si la
 * tienda va entera, o { n, de } si es su parte de un reparto (el sobrante
 * de la tienda se cuenta solo en su primera parte).
 */
function agruparFilasPorCamion_(filas, camiones) {
  const n = camiones ? camiones.length : 0;
  if (!n) return null;
  const grupos = camiones.map(function (c, i) { return { idx: i, camion: c, items: [], cargar: 0, sobra: 0 }; });
  const sin = { idx: -1, camion: null, items: [], cargar: 0, sobra: 0 };
  const cerradas = [];
  function meter(g, item) { g.items.push(item); g.cargar += item.cargar; g.sobra += item.sobra; }
  filas.forEach(function (f) {
    if (f.cerrada) { cerradas.push(f); return; }
    const cargar = Number(f.cargar) || 0, sobra = Number(f.sobra) || 0;
    if (n >= 2 && Array.isArray(f.reparto) && sumaReparto_(f.reparto) === cargar && cargar > 0) {
      let primera = true;
      f.reparto.forEach(function (p, k) {
        p = Number(p) || 0;
        if (p <= 0 || k >= n) return;
        meter(grupos[k], { f: f, cargar: p, sobra: primera ? sobra : 0, parte: { n: p, de: cargar } });
        primera = false;
      });
      return;
    }
    const enteraEn = (!Array.isArray(f.reparto) && f.camion >= 0 && f.camion < n) ? grupos[f.camion] : sin;
    meter(enteraEn, { f: f, cargar: cargar, sobra: sobra, parte: null });
  });
  if (sin.items.length) grupos.push(sin);
  return { n: n, grupos: grupos, cerradas: cerradas };
}
/** "(5 de 10)" para la parte de una tienda repartida. */
function etiquetaParte_(parte) {
  return parte ? ' <span class="parte-reparto">(' + parte.n + ' de ' + parte.de + ')</span>' : '';
}

/**
 * Tabla de solo lectura TIENDA / A CARGAR / SOBRANTE.
 * lista: [{tienda, contados, cargar, cerrada, camion (opcional), reparto (opcional)}]
 * revisar: { 'NOMBRE TIENDA': {antes, ahora} } (opcional)
 * marcarAjustadas: añade la etiqueta "Ajustada" donde cargar ≠ contados.
 * camiones (opcional): agrupa las tiendas por camión, con su matrícula y
 *   remolque y (con 2 o más camiones) el subtotal de cada uno. Si una fila
 *   trae "camion"/"reparto" se usan; si no, se buscan en los camiones.
 * Devuelve { html, filas (para imprimir), totContados, totCargar, totSobra, camiones }.
 */
function tablaCargaFija_(lista, revisar, marcarAjustadas, camiones) {
  revisar = revisar || {};
  camiones = camionesValidos_(camiones);
  let totContados = 0, totCargar = 0, totSobra = 0;
  const filas = lista.map(function (t) {
    const camion = typeof t.camion === 'number' ? t.camion : indiceCamionTienda_(camiones, t.tienda);
    const reparto = t.reparto !== undefined ? t.reparto : repartoTienda_(camiones, t.tienda);
    if (t.cerrada) return { tienda: t.tienda, cerrada: true, camion: camion, reparto: null };
    const contados = Number(t.contados) || 0;
    const cargar = Number(t.cargar) || 0;
    const sobra = Math.max(0, contados - cargar);
    const cambio = revisar[t.tienda];
    totContados += contados; totCargar += cargar; totSobra += sobra;
    return {
      tienda: t.tienda, cargar: cargar, sobra: sobra, camion: camion, reparto: reparto,
      cambio: cambio, ajustada: marcarAjustadas && cargar !== contados && !cambio
    };
  });
  function filaHtml(f, cargar, sobra, parte) {
    if (f.cerrada) return '<tr class="cerrada"><td class="tienda">' + escapeHtml(f.tienda) + '</td><td class="num" colspan="2">CERRADA</td></tr>';
    if (cargar === undefined) { cargar = f.cargar; sobra = f.sobra; }
    return '<tr class="' + (f.cambio ? 'revisar' : (f.ajustada ? 'ajustada' : '')) + '"><td class="tienda">' + escapeHtml(f.tienda) +
        etiquetaParte_(parte) + (f.cambio ? etiquetaCambioConteo_(f.cambio) : '') + '</td>' +
      '<td class="num cargar' + (f.cambio ? ' revisar' : '') + '">' + cargar + '</td>' +
      '<td class="num sobra' + (sobra ? '' : ' cero') + '">' + (sobra || '—') + '</td></tr>';
  }
  const agr = agruparFilasPorCamion_(filas, camiones);
  let cuerpo;
  if (!agr) {
    cuerpo = filas.map(function (f) { return filaHtml(f); }).join('');
  } else {
    cuerpo = agr.grupos.map(function (g) {
      return '<tr class="fila-camion' + (g.idx < 0 ? ' sin-camion' : '') + '"><td colspan="3">' + tituloCamionHtml_(g.camion, g.idx, agr.n) + '</td></tr>' +
        g.items.map(function (it) { return filaHtml(it.f, it.cargar, it.sobra, it.parte); }).join('') +
        (agr.n >= 2 && g.idx >= 0
          ? '<tr class="fila-subtotal-camion"><td>Subtotal camión ' + (g.idx + 1) + '</td><td class="num">' + g.cargar + '</td><td class="num">' + (g.sobra || '—') + '</td></tr>'
          : '');
    }).join('') + agr.cerradas.map(function (f) { return filaHtml(f); }).join('');
  }
  const html = '<div class="modal-tabla-scroll"><table class="modal-lista-tabla">' +
    '<thead><tr><th>Tienda</th><th class="num">A cargar</th><th class="num">Sobrante</th></tr></thead>' +
    '<tbody>' + cuerpo + '</tbody>' +
    '<tfoot><tr><td>Total palets' + (camiones.length >= 2 ? ' (' + camiones.length + ' camiones)' : '') + '</td><td class="num">' + totCargar + '</td><td class="num">' + totSobra + '</td></tr></tfoot>' +
  '</table></div>';
  return { html: html, filas: filas, totContados: totContados, totCargar: totCargar, totSobra: totSobra, camiones: camiones };
}


/**
 * Modal "Lista de carga" (camioncito): TIENDA, TOTAL a cargar y SOBRANTE.
 *
 * info: { tipo: 'ajuste'|'prevision'|'definitivo', hora, enviadoPor, lista, camiones } o null
 * extra (opcional, servidor nuevo):
 *   revisar:     { 'NOMBRE TIENDA': {antes, ahora} } tiendas cuyo conteo cambió
 *   soloLectura: muestra la banda "Solo lectura" (usuario sin permiso)
 *   onEditar:    si viene, lápiz al lado de la X para pasar a editar la carga
 * info.tipo 'contado': nadie ha ajustado todavía; se enseña lo contado.
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
    tabla = tablaCargaFija_(lista, revisar, tipo === 'ajuste', info.camiones);
    // tipo 'contado': aún no hay carga guardada, no hay hora ni autor.
    cuerpo = estadoCargaHtml_({ origen: tipo, hora: info.hora, por: info.enviadoPor }) +
      (hayRevisar
        ? '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
            '<span>El conteo ha cambiado después de fijar la carga. Un responsable con permiso «Ajustar carga» tiene que verificarla.</span></div></div>'
        : '') +
      statsCargaHtml_(tabla.totContados, tabla.totCargar, tabla.totSobra);
    cuerpo = columnasCarga_(cuerpo, tabla.html);
  }

  custom.innerHTML =
    cabeceraModalCarga_(info ? 'Lista de carga · ' + titulo : 'Carga del camión · ' + titulo, fechaTexto, hayRevisar ? 'rojo' : '') +
    cuerpo;

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>' +
    (tabla ? '<button class="modal-whatsapp" id="modal-whatsapp-btn" title="Compartir por WhatsApp">' + ICONO_COMPARTIR_16_ + '<span>WhatsApp</span></button>' : '') +
    (tabla ? '<button class="modal-confirm" id="modal-confirm-btn">Imprimir</button>' : '');
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  if (extra.onEditar) ponerLapizModal_(false, extra.onEditar);
  if (tabla) {
    const tipoTexto = tipo === 'definitivo' ? 'Definitivo' : (tipo === 'ajuste' ? 'Carga ajustada' : (tipo === 'contado' ? 'Lo contado' : 'Previsión'));
    document.getElementById('modal-confirm-btn').onclick = function () {
      imprimirListaCarga_(titulo, fechaTexto, tipoTexto, tabla.filas, tabla.totCargar, tabla.totSobra, tabla.camiones);
    };
    document.getElementById('modal-whatsapp-btn').onclick = function () {
      compartirListaCargaWhatsApp_(titulo, fechaTexto, tipoTexto, tabla.filas, tabla.totCargar, tabla.totSobra, tabla.camiones);
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
 *   camiones: camiones guardados [{matricula, remolque, tiendas, parciales}] o null,
 *   tipoEnvio: 'prevision'|'definitivo'|null (si se abre en mitad de un envío),
 *   onGuardar: function(cargas, camiones) con cargas = { 'NOMBRE TIENDA': palets }
 *     y camiones = [{matricula, remolque, tiendas: ['NOMBRE TIENDA', ...],
 *       parciales: {'NOMBRE TIENDA': palets}}] ([] = sin camiones),
 *   onCancelar: opcional,
 *   desdeLapiz: true si se ha entrado pulsando el lápiz de la vista de
 *     solo lectura: lápiz marcado, etiqueta "Modo edición" y sin Imprimir
 *     (Cancelar o el lápiz vuelven a la vista de solo lectura vía onCancelar)
 * }
 *
 * Camiones (opcional): matrícula (obligatoria) y remolque (opcional) de
 * cada camión. Con 2 o más camiones aparece la columna «Camión» para decir
 * en cuál va cada tienda, y todas las tiendas abiertas tienen que tener uno
 * para poder guardar. Con un solo camión, todas van en él.
 * «Dividir…» en ese desplegable reparte una tienda entre varios camiones:
 * debajo de la fila sale una casilla por camión y lo repartido tiene que
 * sumar lo que se carga para poder guardar.
 */
function mostrarModalAjustarCarga(datos) {
  const custom = prepararModalCarga_();
  const filasDatos = datos.filas;
  const cambios = filasDatos.filter(function (f) { return f.cambio; });
  const revisar = cambios.length > 0;
  const enEnvio = !!datos.tipoEnvio;
  const etiquetaTipo = datos.tipoEnvio === 'definitivo' ? 'Definitivo' : 'Previsión';

  // Estado de los camiones: lista de {matricula, remolque} y, por fila, el
  // nº de camión (0, 1, ...), -1 si todavía no tiene o DIVIDIR si está
  // repartida entre varios (reparto[i] = palets en cada camión).
  const DIVIDIR = -2;
  const guardados = camionesValidos_(datos.camiones);
  const camiones = guardados.map(function (c) { return { matricula: c.matricula || '', remolque: c.remolque || '' }; });
  const reparto = filasDatos.map(function (f) { return f.cerrada ? null : repartoTienda_(guardados, f.nombre); });
  const asignacion = filasDatos.map(function (f, i) {
    if (f.cerrada) return -1;
    return reparto[i] ? DIVIDIR : indiceCamionTienda_(guardados, f.nombre);
  });

  const filas = filasDatos.map(function (f, i) {
    if (f.cerrada) return '<tr class="cerrada"><td class="tienda">' + escapeHtml(quitarCodigoTienda(f.nombre)) + '</td><td class="num" colspan="5">CERRADA</td></tr>';
    const hayLimite = !isNaN(f.limite) && f.limite > 0;
    return '<tr class="' + (f.cambio ? 'revisar' : '') + '" data-fila="' + i + '">' +
      '<td class="tienda">' + escapeHtml(quitarCodigoTienda(f.nombre)) + (f.cambio ? etiquetaCambioConteo_(f.cambio) : '') + '</td>' +
      '<td class="num contados' + (hayLimite && f.contados + f.otros > f.limite ? ' pasado' : '') + '">' + f.contados +
        (f.otros ? ' <span class="modal-palets-otros">+' + f.otros + ' vie/dom</span>' : '') + '</td>' +
      '<td class="num">' + (hayLimite ? f.limite : '—') + '</td>' +
      '<td class="num"><div class="modal-palets-ctrl">' +
        '<button type="button" data-i="' + i + '" data-d="-1" aria-label="Restar">−</button>' +
        '<input type="number" min="0" step="1" inputmode="numeric" id="carga-tienda-' + i + '" data-i="' + i + '" value="' + f.cargar + '">' +
        '<button type="button" data-i="' + i + '" data-d="1" aria-label="Sumar">+</button>' +
      '</div></td>' +
      '<td class="num nave" data-q="' + i + '"></td>' +
      '<td class="num col-camion"><select class="sel-camion" data-c="' + i + '" aria-label="Camión de ' + escapeHtml(quitarCodigoTienda(f.nombre)) + '"></select></td>' +
    '</tr>';
  }).join('');

  const quien = datos.carga && datos.carga.por
    ? (datos.carga.origen === 'prevision' ? 'se envió la previsión' : datos.carga.por + ' ajustó la carga') + (datos.carga.hora ? ' (' + datos.carga.hora + ' h)' : '')
    : 'se fijó la carga';

  custom.innerHTML =
    cabeceraModalCarga_(revisar ? 'Verificar carga del camión' : 'Ajustar carga del camión',
      datos.titulo + ' · ' + (enEnvio ? etiquetaTipo + ' · ' : '') + datos.fechaTexto, revisar ? 'rojo' : '') +
    columnasCarga_(
    estadoCargaHtml_(datos.carga) +
    '<div class="modal-carga-stats"></div>' +
    (revisar
      ? '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
          '<span>El conteo ha cambiado en ' + cambios.length + (cambios.length === 1 ? ' tienda' : ' tiendas') + ' desde que ' + escapeHtml(quien) +
          '. La carga no se ha tocado: revísala y pulsa «' + (enEnvio ? 'Verificar y continuar' : 'Verificar carga') + '».</span></div></div>'
      : '') +
    '<div class="modal-carga-pasadas"></div>' +
    (datos.desdeLapiz ? '<div class="modal-modo-edicion">' + ICONO_LAPIZ_12_ + 'Modo edición</div>' : '') +
    '<div class="modal-camiones">' +
      '<div class="modal-camiones-cab"><span class="modal-camiones-titulo">' + ICONO_CAMION_16_ + 'Camiones</span>' +
        '<span class="modal-camiones-ayuda">Matrícula y remolque (opcional) · máx. ' + MAX_PALETS_CAMION + ' palets por camión</span></div>' +
      '<div class="modal-camiones-lista"></div>' +
      '<div class="modal-camiones-aviso"></div>' +
      '<button type="button" class="modal-camiones-add">+ Añadir camión</button>' +
    '</div>' +
    '<p class="modal-palets-intro">Palets que van en el camión por tienda: es lo que saldrá en el email a la agencia. ' +
      (enEnvio ? 'Al confirmar se guarda y sigues con el envío.' : 'Se guarda sin enviar nada.') + '</p>',
    '<div class="modal-tabla-scroll"><table class="modal-palets-tabla modal-carga-ajuste"><thead><tr><th>Tienda</th><th class="num">Contados</th><th class="num">Límite</th><th class="num">A cargar</th><th class="num">En nave</th><th class="num col-camion">Camión</th></tr></thead>' +
    '<tbody>' + filas + '</tbody></table></div>');

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button type="button" class="modal-enlace izq" id="modal-restablecer-btn">Restablecer a lo contado</button>' +
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    (datos.desdeLapiz ? '' : '<button class="modal-secundario" id="modal-imprimir-btn">Imprimir</button>') +
    '<button class="modal-confirm" id="modal-confirm-btn">' +
      (revisar ? (enEnvio ? 'Verificar y continuar' : 'Verificar carga') : (enEnvio ? 'Guardar y continuar' : 'Guardar carga')) +
    '</button>';
  document.getElementById('modal-overlay').style.display = 'flex';

  const inputs = Array.prototype.slice.call(custom.querySelectorAll('.modal-palets-ctrl input'));
  const selects = Array.prototype.slice.call(custom.querySelectorAll('select.sel-camion'));
  const tabla = custom.querySelector('table.modal-carga-ajuste');
  const listaCamiones = custom.querySelector('.modal-camiones-lista');
  const avisoCamiones = custom.querySelector('.modal-camiones-aviso');
  const btnOk = document.getElementById('modal-confirm-btn');
  const btnImprimir = document.getElementById('modal-imprimir-btn');
  function valor(inp) {
    const v = parseInt(inp.value, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  }
  function normalizarMatricula(t) {
    return String(t || '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, 15);
  }
  // Nº de camión efectivo de una fila: con un solo camión, el 0; DIVIDIR
  // si está repartida.
  function camionDeFila(i) {
    if (filasDatos[i].cerrada || !camiones.length) return -1;
    if (camiones.length === 1) return 0;
    return asignacion[i];
  }
  function cargaFila(i) {
    const inp = custom.querySelector('input[data-i="' + i + '"]');
    return inp ? valor(inp) : 0;
  }

  // Tarjetas de los camiones (matrícula, remolque, quitar) y desplegables
  // de la columna «Camión». Se rehacen al añadir/quitar un camión.
  function pintarCamiones() {
    listaCamiones.innerHTML = camiones.map(function (c, k) {
      return '<div class="modal-camion" data-k="' + k + '">' +
        '<span class="modal-camion-num">' + (k + 1) + '</span>' +
        '<label class="modal-camion-campo"><span>Matrícula</span><input type="text" class="cam-matricula" data-k="' + k + '" maxlength="15" autocomplete="off" placeholder="Matrícula" value="' + escapeHtml(c.matricula) + '"></label>' +
        '<label class="modal-camion-campo"><span>Remolque</span><input type="text" class="cam-remolque" data-k="' + k + '" maxlength="15" autocomplete="off" placeholder="Remolque" value="' + escapeHtml(c.remolque) + '"></label>' +
        '<span class="modal-camion-total" data-t="' + k + '"></span>' +
        '<button type="button" class="modal-camion-quitar" data-k="' + k + '" aria-label="Quitar camión ' + (k + 1) + '" title="Quitar camión">×</button>' +
      '</div>';
    }).join('');
    listaCamiones.querySelectorAll('input.cam-matricula, input.cam-remolque').forEach(function (inp) {
      inp.oninput = function () {
        const pos = inp.selectionStart;
        const limpio = normalizarMatricula(inp.value);
        if (limpio !== inp.value) { inp.value = limpio; try { inp.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
        const k = Number(inp.getAttribute('data-k'));
        if (inp.classList.contains('cam-matricula')) { camiones[k].matricula = limpio; pintarOpciones(); }
        else camiones[k].remolque = limpio;
        refrescar();
      };
    });
    listaCamiones.querySelectorAll('.modal-camion-quitar').forEach(function (b) {
      b.onclick = function () { quitarCamion(Number(b.getAttribute('data-k'))); };
    });
    tabla.classList.toggle('con-camiones', camiones.length >= 2);
    pintarOpciones();
    pintarRepartos();
  }
  function pintarOpciones() {
    const opciones = '<option value="-1">—</option>' + camiones.map(function (c, k) {
      return '<option value="' + k + '">' + (k + 1) + (c.matricula ? ' · ' + escapeHtml(c.matricula) : '') + '</option>';
    }).join('') + '<option value="' + DIVIDIR + '">Dividir…</option>';
    selects.forEach(function (s) {
      const i = Number(s.getAttribute('data-c'));
      s.innerHTML = opciones;
      const a = asignacion[i];
      s.value = String(a === DIVIDIR || (a >= 0 && a < camiones.length) ? a : -1);
    });
    // Las etiquetas de las casillas del reparto llevan la matrícula.
    custom.querySelectorAll('.modal-reparto-campo > span[data-rl]').forEach(function (sp) {
      const k = Number(sp.getAttribute('data-rl'));
      if (camiones[k]) sp.textContent = 'Camión ' + (k + 1) + (camiones[k].matricula ? ' · ' + camiones[k].matricula : '');
    });
  }
  // Fila extra debajo de cada tienda dividida: una casilla de palets por camión.
  function pintarRepartos() {
    custom.querySelectorAll('tr.fila-reparto').forEach(function (tr) { tr.remove(); });
    filasDatos.forEach(function (f, i) {
      if (camionDeFila(i) !== DIVIDIR) return;
      const fila = custom.querySelector('tr[data-fila="' + i + '"]');
      if (!fila) return;
      const tr = document.createElement('tr');
      tr.className = 'fila-reparto';
      tr.setAttribute('data-r', i);
      tr.innerHTML = '<td colspan="6"><div class="modal-reparto">' +
        camiones.map(function (c, k) {
          return '<label class="modal-reparto-campo"><span data-rl="' + k + '">Camión ' + (k + 1) + (c.matricula ? ' · ' + escapeHtml(c.matricula) : '') + '</span>' +
            '<input type="number" min="0" step="1" inputmode="numeric" data-ri="' + i + '" data-rk="' + k + '" value="' + (reparto[i][k] || 0) + '"></label>';
        }).join('') +
        '<span class="modal-reparto-estado" data-re="' + i + '"></span></div></td>';
      fila.insertAdjacentElement('afterend', tr);
      tr.querySelectorAll('input').forEach(function (inp) {
        inp.oninput = function () {
          const v = parseInt(inp.value, 10);
          const k = Number(inp.getAttribute('data-rk'));
          reparto[i][k] = isNaN(v) || v < 0 ? 0 : v;
          // Con 2 camiones, el otro se queda con lo que falta.
          if (camiones.length === 2) {
            const otro = 1 - k;
            reparto[i][otro] = Math.max(0, cargaFila(i) - reparto[i][k]);
            const inpOtro = tr.querySelector('input[data-rk="' + otro + '"]');
            if (inpOtro) inpOtro.value = reparto[i][otro];
          }
          refrescar();
        };
      });
    });
  }
  function anadirCamion() {
    if (camiones.length >= 10) return;
    // Al pasar de 1 a 2 camiones, las tiendas se quedan en el camión 1.
    if (camiones.length === 1) filasDatos.forEach(function (f, i) { if (!f.cerrada) asignacion[i] = 0; });
    camiones.push({ matricula: '', remolque: '' });
    reparto.forEach(function (r) { if (r) r.push(0); });
    pintarCamiones();
    refrescar();
    const nuevo = listaCamiones.querySelector('input.cam-matricula[data-k="' + (camiones.length - 1) + '"]');
    if (nuevo) nuevo.focus();
  }
  function quitarCamion(k) {
    camiones.splice(k, 1);
    // Las tiendas de ese camión se quedan sin camión; las de los siguientes
    // bajan un número. En las divididas se quita la casilla de ese camión
    // (si ya no cuadra, sale en rojo). Con menos de 2 camiones no hay reparto.
    asignacion.forEach(function (a, i) {
      if (a === k) asignacion[i] = -1;
      else if (a > k) asignacion[i] = a - 1;
    });
    reparto.forEach(function (r, i) {
      if (!r) return;
      r.splice(k, 1);
      if (camiones.length < 2) { reparto[i] = null; asignacion[i] = 0; }
    });
    pintarCamiones();
    refrescar();
  }

  function refrescar() {
    let totContados = 0, totCargar = 0, pasadas = 0, vacias = 0;
    const totCamion = camiones.map(function () { return { palets: 0, tiendas: 0 }; });
    let sinCamion = 0, descuadres = 0;
    inputs.forEach(function (inp) {
      const i = Number(inp.getAttribute('data-i'));
      const f = filasDatos[i];
      const q = custom.querySelector('[data-q="' + i + '"]');
      const v = valor(inp);
      const vacio = inp.value === '';
      const pasado = !isNaN(f.limite) && f.limite > 0 && v + f.otros > f.limite;
      totContados += f.contados; totCargar += v;
      if (pasado) pasadas++;
      if (vacio) vacias++;
      const cam = camionDeFila(i);
      if (cam >= 0) { totCamion[cam].palets += v; totCamion[cam].tiendas++; }
      if (cam === DIVIDIR) {
        reparto[i].forEach(function (n, k) {
          if (n > 0 && totCamion[k]) { totCamion[k].palets += n; totCamion[k].tiendas++; }
        });
        const suma = sumaReparto_(reparto[i]);
        const cuadra = suma === v;
        if (!cuadra) descuadres++;
        const est = custom.querySelector('[data-re="' + i + '"]');
        if (est) {
          est.textContent = cuadra ? 'Repartidos ' + suma + ' de ' + v : 'Repartidos ' + suma + ' de ' + v + (suma < v ? ' · faltan ' + (v - suma) : ' · sobran ' + (suma - v));
          est.classList.toggle('mal', !cuadra);
        }
        const trR = custom.querySelector('tr[data-r="' + i + '"]');
        if (trR) trR.classList.toggle('mal', !cuadra);
      }
      const falta = camiones.length >= 2 && cam === -1;
      if (falta) sinCamion++;
      const sel = custom.querySelector('select.sel-camion[data-c="' + i + '"]');
      if (sel) sel.classList.toggle('falta', falta);
      inp.classList.toggle('pasado', pasado || vacio);
      q.classList.toggle('pasado', pasado || vacio);
      q.classList.toggle('cero', !vacio && !pasado && v === f.contados);
      if (vacio) q.textContent = 'Falta';
      else if (pasado) q.textContent = '+' + (v + f.otros - f.limite) + ' límite';
      else if (f.contados - v > 0) q.textContent = f.contados - v;
      else if (v > f.contados) q.textContent = '+' + (v - f.contados) + ' contado';
      else q.textContent = '—';
      q.title = vacio ? 'Indica un número'
        : pasado ? (v + f.otros - f.limite) + ' palet(s) por encima del límite'
        : f.contados - v > 0 ? 'Quedan ' + (f.contados - v) + ' en nave'
        : v > f.contados ? (v - f.contados) + ' más de lo contado' : 'No queda nada en nave';
    });
    custom.querySelector('.modal-carga-stats').innerHTML = statsCargaHtml_(totContados, totCargar, Math.max(0, totContados - totCargar));
    custom.querySelector('.modal-carga-pasadas').innerHTML = pasadas
      ? '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
          '<span>' + pasadas + (pasadas === 1 ? ' tienda sigue' : ' tiendas siguen') + ' por encima de su límite</span></div></div>'
      : '';
    // Totales de cada camión y avisos (falta matrícula / tiendas sin camión).
    let sinMatricula = 0;
    const excedidos = [];
    camiones.forEach(function (c, k) {
      const t = listaCamiones.querySelector('[data-t="' + k + '"]');
      const exceso = totCamion[k].palets - MAX_PALETS_CAMION;
      if (exceso > 0) excedidos.push({ k: k, exceso: exceso });
      if (t) {
        t.textContent = totCamion[k].tiendas + (totCamion[k].tiendas === 1 ? ' tienda' : ' tiendas') + ' · ' + totCamion[k].palets + ' palets' +
          (exceso > 0 ? ' · ' + exceso + ' de más' : '');
        t.classList.toggle('pasado', exceso > 0);
      }
      const tarjeta = listaCamiones.querySelector('.modal-camion[data-k="' + k + '"]');
      if (tarjeta) tarjeta.classList.toggle('pasado', exceso > 0);
      const inp = listaCamiones.querySelector('input.cam-matricula[data-k="' + k + '"]');
      const falta = !c.matricula.trim();
      if (falta) sinMatricula++;
      if (inp) inp.classList.toggle('falta', falta);
    });
    const avisos = [];
    if (sinMatricula) avisos.push(sinMatricula === 1 ? 'Falta la matrícula de un camión' : 'Falta la matrícula de ' + sinMatricula + ' camiones');
    if (sinCamion) avisos.push(sinCamion === 1 ? '1 tienda sin camión' : sinCamion + ' tiendas sin camión');
    if (descuadres) avisos.push(descuadres === 1 ? '1 tienda dividida no cuadra' : descuadres + ' tiendas divididas no cuadran');
    // Máximo 33 palets por camión. Si no caben, se dice cuántos camiones hacen falta.
    if (excedidos.length) {
      const necesarios = Math.ceil(totCargar / MAX_PALETS_CAMION);
      if (camiones.length < necesarios) {
        avisos.push(totCargar + ' palets no caben en ' + camiones.length + (camiones.length === 1 ? ' camión' : ' camiones') +
          ' (máx. ' + MAX_PALETS_CAMION + ' por camión): hacen falta ' + necesarios + '. Añade ' + (necesarios - camiones.length === 1 ? 'otro camión' : (necesarios - camiones.length) + ' camiones más'));
      } else {
        avisos.push(excedidos.map(function (e) { return 'El camión ' + (e.k + 1) + ' lleva ' + e.exceso + ' de más'; }).join(' · ') +
          ' (máx. ' + MAX_PALETS_CAMION + ' por camión): pasa tiendas a otro camión');
      }
    }
    avisoCamiones.innerHTML = avisos.map(function (t) { return '<div>' + escapeHtml(t) + '</div>'; }).join('');
    avisoCamiones.style.display = avisos.length ? '' : 'none';
    custom.querySelector('.modal-camiones-add').style.display = camiones.length >= 10 ? 'none' : '';
    btnOk.disabled = vacias > 0 || sinMatricula > 0 || sinCamion > 0 || descuadres > 0 || excedidos.length > 0;
    if (btnImprimir) btnImprimir.disabled = vacias > 0;
  }

  custom.querySelectorAll('.modal-palets-ctrl button').forEach(function (b) {
    b.onclick = function () {
      const inp = custom.querySelector('input[data-i="' + b.getAttribute('data-i') + '"]');
      inp.value = Math.max(0, valor(inp) + Number(b.getAttribute('data-d')));
      refrescar();
    };
  });
  inputs.forEach(function (inp) { inp.oninput = refrescar; });
  selects.forEach(function (s) {
    s.onchange = function () {
      const i = Number(s.getAttribute('data-c'));
      const nuevo = Number(s.value);
      if (nuevo === DIVIDIR && asignacion[i] !== DIVIDIR) {
        // Al dividir, de entrada todo va en el camión que tenía (o el 1):
        // solo hay que pasar al otro los palets que van allí.
        const r = camiones.map(function () { return 0; });
        r[asignacion[i] >= 0 && asignacion[i] < camiones.length ? asignacion[i] : 0] = cargaFila(i);
        reparto[i] = r;
      } else if (nuevo !== DIVIDIR) {
        reparto[i] = null;
      }
      asignacion[i] = nuevo;
      pintarRepartos();
      refrescar();
      if (nuevo === DIVIDIR) {
        const otra = custom.querySelector('input[data-ri="' + i + '"][data-rk="' + (reparto[i].indexOf(cargaFila(i)) === 0 ? 1 : 0) + '"]');
        if (otra) { otra.focus(); otra.select(); }
      }
    };
  });
  custom.querySelector('.modal-camiones-add').onclick = anadirCamion;
  pintarCamiones();
  refrescar();

  document.getElementById('modal-restablecer-btn').onclick = function () {
    inputs.forEach(function (inp) { inp.value = filasDatos[inp.getAttribute('data-i')].contados; });
    refrescar();
  };
  function cancelar() {
    cerrarModal();
    if (datos.onCancelar) datos.onCancelar();
  }
  document.getElementById('modal-cancel-btn').onclick = cancelar;
  if (datos.desdeLapiz) ponerLapizModal_(true, cancelar);
  // Camiones tal y como se guardan: matrícula, remolque, las tiendas que
  // van enteras y los palets de las tiendas divididas.
  function camionesParaGuardar() {
    return camiones.map(function (c, k) {
      const parciales = {};
      filasDatos.forEach(function (f, i) {
        if (camionDeFila(i) === DIVIDIR && reparto[i][k] > 0) parciales[f.nombre] = reparto[i][k];
      });
      return {
        matricula: c.matricula.trim(),
        remolque: c.remolque.trim(),
        tiendas: filasDatos.filter(function (f, i) { return camionDeFila(i) === k; }).map(function (f) { return f.nombre; }),
        parciales: parciales
      };
    });
  }
  // Imprime la lista de carga con lo que hay ahora en pantalla (aunque no se
  // haya guardado todavía), igual que la que imprimen los operadores.
  if (btnImprimir) btnImprimir.onclick = function () {
    const lista = filasDatos.map(function (f, i) {
      const nombre = quitarCodigoTienda(f.nombre);
      if (f.cerrada) return { tienda: nombre, cerrada: true };
      const inp = custom.querySelector('input[data-i="' + i + '"]');
      const cam = camionDeFila(i);
      return { tienda: nombre, contados: f.contados, cargar: inp ? valor(inp) : f.cargar, cerrada: false,
        camion: cam, reparto: cam === DIVIDIR ? reparto[i].slice() : null };
    });
    const tabla = tablaCargaFija_(lista, null, false, camiones.filter(function (c) { return c.matricula.trim(); }).length === camiones.length ? camiones : null);
    imprimirListaCarga_(datos.titulo, datos.fechaTexto, enEnvio ? etiquetaTipo : 'Carga ajustada',
      tabla.filas, tabla.totCargar, tabla.totSobra, tabla.camiones);
  };
  btnOk.onclick = function () {
    const cargas = {};
    let falta = null;
    inputs.forEach(function (inp) {
      if (inp.value === '' && !falta) falta = inp;
      cargas[filasDatos[inp.getAttribute('data-i')].nombre] = valor(inp);
    });
    if (falta) { falta.focus(); return; }
    const sinMatricula = listaCamiones.querySelector('input.cam-matricula.falta');
    if (sinMatricula) { sinMatricula.focus(); return; }
    const sinCamion = custom.querySelector('select.sel-camion.falta');
    if (sinCamion) { sinCamion.focus(); return; }
    const descuadre = custom.querySelector('tr.fila-reparto.mal input');
    if (descuadre) { descuadre.focus(); return; }
    datos.onGuardar(cargas, camionesParaGuardar());
  };
}

/**
 * Modal "¿Es correcta esta carga?": sale al pulsar Enviar Previsión /
 * Enviar Definitivo cuando ya hay una carga guardada (ajustada a mano o
 * de la previsión) y no hay nada pendiente de verificar.
 *
 * datos: { titulo, fechaTexto, tipo, carga, lista: [{tienda, contados, cargar, cerrada}],
 *          onSi, onModificar (null si el usuario no tiene permiso) }
 * Si la carga tiene camiones (datos.carga.camiones), la tabla sale agrupada
 * por camión, igual que en el email.
 */
function mostrarModalCargaCorrecta(datos) {
  const custom = prepararModalCarga_();
  const etiqueta = datos.tipo === 'definitivo' ? 'Definitivo' : 'Previsión';
  const tabla = tablaCargaFija_(datos.lista, null, true, datos.carga && datos.carga.camiones);
  custom.innerHTML =
    cabeceraModalCarga_('¿Es correcta esta carga?', datos.titulo + ' · ' + etiqueta + ' · ' + datos.fechaTexto, 'ambar') +
    columnasCarga_(
    estadoCargaHtml_(datos.carga) +
    statsCargaHtml_(tabla.totContados, tabla.totCargar, tabla.totSobra) +
    '<div class="modal-envio-aviso modal-carga-info"><div class="modal-envio-aviso-titulo">' + ICONO_INFO_16_ +
      '<span>Esta es la carga que irá en el email de ' + etiqueta.toLowerCase() + '.</span></div></div>',
    tabla.html);

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
 * datos: { titulo, fechaTexto, tipo, lista, revisar, camiones (opcional) }
 */
function mostrarModalCargaPendiente(datos) {
  const custom = prepararModalCarga_();
  const tabla = tablaCargaFija_(datos.lista, datos.revisar, false, datos.camiones);
  custom.innerHTML =
    cabeceraModalCarga_('No se puede enviar todavía', datos.titulo + ' · ' + (datos.tipo === 'definitivo' ? 'Definitivo' : 'Previsión') + ' · ' + datos.fechaTexto, 'rojo') +
    columnasCarga_(
    '<div class="modal-envio-aviso modal-envio-alerta"><div class="modal-envio-aviso-titulo">' + ICONO_AVISO_16_ +
      '<span>El conteo ha cambiado después de fijar la carga. Avisa a un responsable con permiso «Ajustar carga» para que la verifique.</span></div></div>' +
    statsCargaHtml_(tabla.totContados, tabla.totCargar, tabla.totSobra), tabla.html);
  document.getElementById('modal-actions').innerHTML = '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
}

/** Imprime la lista de carga en una hoja limpia (iframe oculto), sin tocar
 *  la hoja de impresión del día ni el resto de la pantalla.
 *  camiones (opcional): todo en una hoja, agrupado por camión con su
 *  matrícula, remolque y (con 2 o más) subtotal. Cada fila trae su nº de
 *  camión en f.camion, o su reparto en f.reparto (ver tablaCargaFija_). */
function imprimirListaCarga_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra, camiones) {
  const celda = 'padding:6px 12px;border:1px solid #999;';
  camiones = camionesValidos_(camiones);
  function filaHtml(f, cargar, sobra, parte) {
    if (f.cerrada) return '<tr><td style="' + celda + '">' + escapeHtml(f.tienda) + '</td><td class="n" colspan="2" style="' + celda + 'font-weight:bold;">CERRADA</td></tr>';
    if (cargar === undefined) { cargar = f.cargar; sobra = f.sobra; }
    return '<tr><td style="' + celda + '">' + escapeHtml(f.tienda) +
        (parte ? ' <span style="font-size:13px;color:#555;">(' + parte.n + ' de ' + parte.de + ')</span>' : '') + '</td>' +
      '<td class="n" style="' + celda + 'font-weight:bold;">' + cargar + '</td><td class="n" style="' + celda + '">' + (sobra || '') + '</td></tr>';
  }
  const agr = agruparFilasPorCamion_(filas, camiones);
  const cuerpo = !agr
    ? filas.map(function (f) { return filaHtml(f); }).join('')
    : agr.grupos.map(function (g) {
        return '<tr><td colspan="3" style="' + celda + 'background:' + (g.idx < 0 ? '#f3d9a8' : '#d9d9d9') + ';font-size:14px;">' + tituloCamionHtml_(g.camion, g.idx, agr.n) + '</td></tr>' +
          g.items.map(function (it) { return filaHtml(it.f, it.cargar, it.sobra, it.parte); }).join('') +
          (agr.n >= 2 && g.idx >= 0
            ? '<tr><td style="' + celda + 'background:#f4f4f4;text-align:right;font-size:13px;">Subtotal camión ' + (g.idx + 1) + '</td><td class="n" style="' + celda + 'background:#f4f4f4;font-weight:bold;">' + g.cargar + '</td><td class="n" style="' + celda + 'background:#f4f4f4;">' + (g.sobra || '') + '</td></tr>'
            : '');
      }).join('') + agr.cerradas.map(function (f) { return filaHtml(f); }).join('');
  const html =
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Lista de carga</title>' +
    '<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#444;font-size:13px}' +
    'table{border-collapse:collapse;width:100%;font-size:15px}th{background:#eee;text-align:left}td.n,th.n{text-align:center;width:110px}' +
    'tr{page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>' +
    '<h1>Lista de carga · ' + escapeHtml(titulo) + '</h1>' +
    '<p>' + escapeHtml(fechaTexto) + ' · ' + tipoTexto + '</p>' +
    '<table><tr><th style="' + celda + '">TIENDA</th><th class="n" style="' + celda + '">TOTAL</th><th class="n" style="' + celda + '">SOBRANTE</th></tr>' +
    cuerpo +
    '<tr><td style="' + celda + 'font-weight:bold;background:#eee;">TOTAL PALETS' + (camiones.length >= 2 ? ' (' + camiones.length + ' camiones)' : '') + '</td><td class="n" style="' + celda + 'font-weight:bold;background:#eee;">' + totCargar + '</td><td class="n" style="' + celda + 'font-weight:bold;background:#eee;">' + totSobra + '</td></tr>' +
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

const ICONO_COMPARTIR_16_ = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg>';

/** Texto de la lista de carga para WhatsApp (*negrita* al estilo WhatsApp).
 *  Mismo contenido que la hoja impresa: tiendas, a cargar, sobrante,
 *  agrupado por camión si los hay. */
function textoListaCargaWhatsApp_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra, camiones) {
  camiones = camionesValidos_(camiones);
  const lineas = ['*Lista de carga · ' + titulo + '*', fechaTexto + ' · ' + tipoTexto, ''];
  function linea(f, cargar, sobra, parte) {
    if (f.cerrada) return f.tienda + ': CERRADA';
    if (cargar === undefined) { cargar = f.cargar; sobra = f.sobra; }
    return f.tienda + (parte ? ' (' + parte.n + ' de ' + parte.de + ')' : '') + ': *' + cargar + '*' +
      (sobra ? ' (' + (sobra === 1 ? 'sobra 1' : 'sobran ' + sobra) + ')' : '');
  }
  const agr = agruparFilasPorCamion_(filas, camiones);
  if (!agr) {
    filas.forEach(function (f) { lineas.push(linea(f)); });
  } else {
    agr.grupos.forEach(function (g) {
      if (!g.items.length) return;
      lineas.push(g.idx < 0
        ? '*SIN CAMIÓN ASIGNADO*'
        : '*CAMIÓN' + (agr.n >= 2 ? ' ' + (g.idx + 1) : '') + '* · Matrícula ' + (g.camion.matricula || '') + ' · Remolque ' + (g.camion.remolque || '—'));
      g.items.forEach(function (it) { lineas.push(linea(it.f, it.cargar, it.sobra, it.parte)); });
      if (agr.n >= 2 && g.idx >= 0) lineas.push('_Subtotal camión ' + (g.idx + 1) + ': ' + g.cargar + '_');
      lineas.push('');
    });
    agr.cerradas.forEach(function (f) { lineas.push(linea(f)); });
  }
  if (lineas[lineas.length - 1] !== '') lineas.push('');
  lineas.push('*Total palets: ' + totCargar + '*' + (camiones.length >= 2 ? ' (' + camiones.length + ' camiones)' : '') +
    ' · Sobrante: ' + totSobra);
  return lineas.join('\n');
}

/** Dibuja la lista de carga como imagen PNG (pequeña, para WhatsApp).
 *  Devuelve una Promise<Blob>. Mismo contenido que la hoja impresa. */
function imagenListaCarga_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra, camiones) {
  camiones = camionesValidos_(camiones);
  // Filas a pintar: {k:'camion'|'fila'|'subtotal'|'cerrada', ...}
  const items = [];
  const agr = agruparFilasPorCamion_(filas, camiones);
  function fila(f, cargar, sobra, parte) {
    if (f.cerrada) { items.push({ k: 'cerrada', tienda: f.tienda }); return; }
    if (cargar === undefined) { cargar = f.cargar; sobra = f.sobra; }
    items.push({ k: 'fila', tienda: f.tienda + (parte ? ' (' + parte.n + ' de ' + parte.de + ')' : ''), cargar: cargar, sobra: sobra });
  }
  if (!agr) {
    filas.forEach(function (f) { fila(f); });
  } else {
    agr.grupos.forEach(function (g) {
      if (!g.items.length) return;
      items.push({ k: 'camion', sin: g.idx < 0, texto: g.idx < 0
        ? 'SIN CAMIÓN ASIGNADO'
        : 'CAMIÓN' + (agr.n >= 2 ? ' ' + (g.idx + 1) : '') + ' · ' + (g.camion.matricula || '') + ' · Remolque ' + (g.camion.remolque || '—') });
      g.items.forEach(function (it) { fila(it.f, it.cargar, it.sobra, it.parte); });
      if (agr.n >= 2 && g.idx >= 0) items.push({ k: 'subtotal', texto: 'Subtotal camión ' + (g.idx + 1), cargar: g.cargar, sobra: g.sobra });
    });
    agr.cerradas.forEach(function (f) { fila(f); });
  }

  const ESC = 2;                 // nitidez (retina / zoom en el móvil)
  const W = 560, PAD = 20;
  const CAB = 74, TH = 34, FH = 36, PIE = 44;
  const xCargar = W - PAD - 70;   // centro de la columna A CARGAR (sin sobrante)
  const H = CAB + TH + items.length * FH + PIE;
  const canvas = document.createElement('canvas');
  canvas.width = W * ESC; canvas.height = H * ESC;
  const ctx = canvas.getContext('2d');
  ctx.scale(ESC, ESC);
  const FUENTE = 'Arial, Helvetica, sans-serif';
  function txt(s, x, y, tam, peso, color, alin) {
    ctx.font = (peso || 'normal') + ' ' + tam + 'px ' + FUENTE;
    ctx.fillStyle = color; ctx.textAlign = alin || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function recortar(s, max, tam, peso) {
    ctx.font = (peso || 'normal') + ' ' + tam + 'px ' + FUENTE;
    if (ctx.measureText(s).width <= max) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }

  // Fondo y cabecera
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1c2b45'; ctx.fillRect(0, 0, W, CAB);
  txt(recortar('Lista de carga · ' + titulo, W - 2 * PAD, 20, 'bold'), PAD, 28, 20, 'bold', '#ffffff');
  txt(fechaTexto, PAD, 54, 13, 'normal', '#c9d2e3');
  // Etiqueta destacada: verde si es definitivo, amarilla en cualquier otro caso
  const esDefinitivo = tipoTexto === 'Definitivo';
  const etiqueta = esDefinitivo ? 'CARGA DEFINITIVA' : 'PREVISIÓN DE CARGA';
  ctx.font = 'normal 13px ' + FUENTE;
  const xEtq = PAD + ctx.measureText(fechaTexto).width + 12;
  ctx.font = 'bold 13px ' + FUENTE;
  const anchoEtq = ctx.measureText(etiqueta).width + 20;
  ctx.fillStyle = esDefinitivo ? '#22a447' : '#ffd400';
  ctx.fillRect(xEtq, 54 - 12, anchoEtq, 24);
  txt(etiqueta, xEtq + 10, 55, 13, 'bold', esDefinitivo ? '#ffffff' : '#1c2430');

  // Encabezado de la tabla
  let y = CAB;
  ctx.fillStyle = '#f4f5f7'; ctx.fillRect(0, y, W, TH);
  txt('TIENDA', PAD, y + TH / 2, 11, 'bold', '#5b6573');
  txt('A CARGAR', xCargar, y + TH / 2, 11, 'bold', '#5b6573', 'center');
  y += TH;

  items.forEach(function (it) {
    const cy = y + FH / 2;
    if (it.k === 'camion') {
      ctx.fillStyle = it.sin ? '#f8e6c4' : '#e4e8ef'; ctx.fillRect(0, y, W, FH);
      txt(recortar(it.texto, W - 2 * PAD, 13, 'bold'), PAD, cy, 13, 'bold', '#1c2430');
    } else if (it.k === 'subtotal') {
      ctx.fillStyle = '#f7f8fa'; ctx.fillRect(0, y, W, FH);
      txt(it.texto, xCargar - 60, cy, 12, 'normal', '#5b6573', 'right');
      txt(String(it.cargar), xCargar, cy, 14, 'bold', '#1c2430', 'center');
    } else if (it.k === 'cerrada') {
      txt(recortar(it.tienda, xCargar - 60 - PAD, 15, 'bold'), PAD, cy, 15, 'bold', '#9aa3ae');
      txt('CERRADA', xCargar, cy, 12, 'bold', '#9aa3ae', 'center');
    } else {
      txt(recortar(it.tienda, xCargar - 60 - PAD, 15, 'bold'), PAD, cy, 15, 'bold', '#1c2430');
      txt(String(it.cargar), xCargar, cy, 17, 'bold', '#1c2430', 'center');
    }
    ctx.fillStyle = '#e6e8ec'; ctx.fillRect(0, y + FH - 1, W, 1);
    y += FH;
  });

  // Total
  ctx.fillStyle = '#1c2430'; ctx.fillRect(0, y, W, 2);
  ctx.fillStyle = '#f4f5f7'; ctx.fillRect(0, y + 2, W, PIE - 2);
  const ty = y + PIE / 2 + 1;
  txt('Total palets' + (camiones.length >= 2 ? ' (' + camiones.length + ' camiones)' : ''), PAD, ty, 15, 'bold', '#1c2430');
  txt(String(totCargar), xCargar, ty, 18, 'bold', '#1c2430', 'center');

  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('No se pudo crear la imagen')); }, 'image/png');
  });
}

/** Comparte la lista de carga por WhatsApp con texto e imagen.
 *  WhatsApp no permite que una web mande directamente a un grupo concreto,
 *  así que el grupo se elige cada vez.
 *  - Móvil: menú de compartir del teléfono con la imagen y el texto
 *    (WhatsApp → elegir grupo). Si el móvil no deja compartir archivos,
 *    abre WhatsApp solo con el texto.
 *  - Ordenador: copia la imagen al portapapeles (sin abrir pestañas); el
 *    usuario la pega con Ctrl+V en el grupo, en su WhatsApp ya abierto. */
function compartirListaCargaWhatsApp_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra, camiones) {
  const texto = textoListaCargaWhatsApp_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra, camiones);
  const movil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  let imagen;
  try { imagen = imagenListaCarga_(titulo, fechaTexto, tipoTexto, filas, totCargar, totSobra, camiones); }
  catch (e) { imagen = Promise.reject(e); }
  imagen.catch(function () {}); // los fallos se tratan abajo; evita avisos de promesa sin capturar

  if (movil) {
    imagen.then(function (blob) {
      const nombre = 'Lista de carga ' + String(titulo).replace(/[\\/:*?"<>|]/g, '') + '.png';
      const archivo = new File([blob], nombre, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        return navigator.share({ files: [archivo], text: texto }).catch(function (e) {
          if (e && e.name === 'AbortError') return; // el usuario cerró el menú
          window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
        });
      }
      window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    }).catch(function () {
      window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    });
    return;
  }

  // Ordenador: no se abre ninguna pestaña (el navegador no deja usar la de
  // WhatsApp Web que ya tiene abierta el usuario). Se copia la imagen y se
  // pega con Ctrl+V en el grupo, en su WhatsApp de siempre. El portapapeles
  // se pide ya, dentro del clic.
  let copiada = Promise.reject(new Error('sin portapapeles de imágenes'));
  try {
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
      copiada = navigator.clipboard.write([new ClipboardItem({ 'image/png': imagen })]);
    }
  } catch (e) { /* se prueba con el texto */ }
  copiada.then(function () {
    mostrarToast('Lista copiada como imagen. Ve a WhatsApp, abre el grupo y pulsa Ctrl+V');
  }).catch(function () {
    // Navegador sin imágenes en el portapapeles: al menos el texto.
    try {
      navigator.clipboard.writeText(texto).then(function () {
        mostrarToast('Lista copiada como texto. Ve a WhatsApp, abre el grupo y pulsa Ctrl+V');
      }).catch(function () { mostrarToast('No se pudo copiar la lista', true); });
    } catch (e) { mostrarToast('No se pudo copiar la lista', true); }
  });
}

/** Estado intermedio "Enviando…": sin botones, sin posibilidad de cerrar mientras dura. */
function mostrarModalCargando(texto) {
  quitarLapizModal_();
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
  quitarLapizModal_();
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
  document.getElementById('modal-box').classList.remove('anadir-tienda-modal');
  document.getElementById('modal-title').style.display = '';
}
document.getElementById('modal-cerrar-x').onclick = cerrarModal;
