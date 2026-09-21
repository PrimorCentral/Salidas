/* SALIDAS · js/gestor-observaciones.js — Gestor de observaciones (admin, cualquier día) */

/* ---------------- GESTOR DE OBSERVACIONES (admin, cualquier día) ----------------
 * Permite crear notas generales, notas de agrupación o cierres de tienda
 * para CUALQUIER fecha desde un único modal, sin tener que navegar antes
 * hasta ese día. La lista de agrupaciones/tiendas para buscar se obtiene
 * con getPlantillaDia(dia) (la plantilla de rutas/tiendas de ese día de la
 * semana), NO con getConteoDia(fecha): a diferencia de getConteoDia,
 * getPlantillaDia no depende de la ventana de fechas accesibles (hoy +
 * VENTANA_FUTURO_DIAS_), así que desde aquí se pueden dejar anotaciones
 * para fechas futuras lejanas (festivos, cierres ya conocidos con
 * antelación, etc.) sin que la fecha "parezca" no tener hoja de conteo.
 */
let GESTOR_OBS = { fecha: null, datosDia: null, tipo: 'general', seleccion: null, cargaId: 0 };

/** Nombre de hoja de conteo (LUNES..DOMINGO) para una fecha 'YYYY-MM-DD',
 *  calculado en el propio navegador (espejo de MAPA_DIA_SEMANA / getDay()
 *  del backend) para no depender de getConteoDia. Los 7 días de la semana
 *  tienen hoja propia, así que esto nunca devuelve null. */
const MAPA_DIA_SEMANA_JS_ = { 0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SABADO' };
function diaDesdeFechaJs_(fecha) {
  return MAPA_DIA_SEMANA_JS_[new Date(fecha + 'T12:00:00').getDay()];
}

function abrirGestorObservaciones(fechaInicial) {
  // fechaInicial (opcional): 'yyyy-MM-dd'. Se usa cuando se abre el gestor
  // desde el botón "+" de un día concreto en "Gestión festivos", para que
  // el formulario ya salga con esa fecha puesta en vez de la de hoy.
  const fecha = (typeof fechaInicial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicial))
    ? fechaInicial
    : ESTADO.fecha;
  GESTOR_OBS = { fecha: fecha, datosDia: null, tipo: 'general', seleccion: null, cargaId: 0 };

  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.add('gestor-obs');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Añadir observación';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';
  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML = '';
  custom.appendChild(crearFormularioGestorObs_());

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = guardarDesdeGestorObs_;

  cargarDatosDiaGestorObs_(GESTOR_OBS.fecha);
}

function crearFormularioGestorObs_() {
  const wrap = document.createElement('div');
  wrap.className = 'gestor-form';
  wrap.innerHTML =
    '<div class="gestor-campo">' +
      '<label>Fecha</label>' +
      '<input type="date" id="gestor-fecha" value="' + GESTOR_OBS.fecha + '">' +
    '</div>' +
    '<div class="gestor-campo">' +
      '<label>Tipo</label>' +
      '<div class="gestor-tipo-pills">' +
        '<button type="button" class="gestor-tipo-pill activa" data-tipo="general">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>' +
          'Nota del día</button>' +
        '<button type="button" class="gestor-tipo-pill" data-tipo="agrupacion">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' +
          'Nota de agrupación</button>' +
        '<button type="button" class="gestor-tipo-pill" data-tipo="cierre">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>' +
          'Cerrar tienda</button>' +
        '<button type="button" class="gestor-tipo-pill" data-tipo="cambio">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>' +
          'Cambio puntual</button>' +
      '</div>' +
      '<div class="gestor-aviso" id="gestor-aviso-dia" style="display:none;margin-top:8px;">Ese día de la semana no tiene hoja de conteo: solo se puede añadir una nota general.</div>' +
    '</div>' +
    '<div class="gestor-campo" id="gestor-busqueda-campo" style="display:none;">' +
      '<label id="gestor-busqueda-label">Agrupación</label>' +
      '<div class="gestor-busqueda-wrap">' +
        '<input type="text" id="gestor-busqueda" placeholder="Escribe para buscar…" autocomplete="off">' +
        '<button type="button" class="gestor-busqueda-clear" id="gestor-busqueda-clear" title="Limpiar búsqueda">×</button>' +
        '<div class="gestor-busqueda-resultados" id="gestor-busqueda-resultados" style="display:none;"></div>' +
      '</div>' +
      '<div class="gestor-campo-ayuda" id="gestor-busqueda-ayuda" style="display:none;">Puedes marcar varias tiendas: se guardará un cierre para cada una.</div>' +
      '<div id="gestor-seleccion-actual" style="margin-top:10px;"></div>' +
    '</div>' +
    '<div class="gestor-campo" id="gestor-transito-campo" style="display:none;">' +
      '<label>Plazo de entrega para este cambio</label>' +
      '<div class="gestor-tipo-pills">' +
        '<button type="button" class="gestor-tipo-pill gestor-transito-pill activa" data-opcion="actual">Mantener el plazo actual de la tienda</button>' +
        '<button type="button" class="gestor-tipo-pill gestor-transito-pill" data-opcion="nuevo">Usar un plazo distinto solo para este cambio</button>' +
      '</div>' +
      '<select id="gestor-transito-select" style="display:none;margin-top:8px;"></select>' +
      '<div class="gestor-campo-ayuda">Por si la agencia por la que sale hoy no sirve en el mismo plazo que la habitual. No cambia el plazo normal de la tienda, solo el de este envío puntual.</div>' +
    '</div>' +
    '<div class="gestor-campo" id="gestor-aviso-error-campo">' +
      '<div class="gestor-aviso-error" id="gestor-aviso-error">' +
        '<span id="gestor-aviso-error-texto"></span>' +
        '<button type="button" id="gestor-reintentar">Reintentar</button>' +
      '</div>' +
    '</div>' +
    '<div class="gestor-campo">' +
      '<label id="gestor-texto-label">Nota</label>' +
      '<textarea id="gestor-texto" placeholder="Escribe la nota general del día…"></textarea>' +
    '</div>' +
    '<div class="gestor-loading-overlay" id="gestor-loading-overlay">' +
      '<div class="gestor-spinner"></div>' +
      '<div class="gestor-loading-texto">Cargando agrupaciones de ese día…</div>' +
    '</div>';

  wrap.querySelector('#gestor-fecha').addEventListener('change', function (e) {
    if (!e.target.value) return;
    GESTOR_OBS.fecha = e.target.value;
    GESTOR_OBS.datosDia = null;
    GESTOR_OBS.seleccion = GESTOR_OBS.tipo === 'cierre' ? [] : null;
    document.getElementById('gestor-busqueda').value = '';
    const btnLimpiar = document.getElementById('gestor-busqueda-clear');
    if (btnLimpiar) btnLimpiar.classList.remove('visible');
    actualizarSeleccionGestorObs_();
    cargarDatosDiaGestorObs_(GESTOR_OBS.fecha);
  });

  wrap.querySelector('#gestor-reintentar').addEventListener('click', function () {
    cargarDatosDiaGestorObs_(GESTOR_OBS.fecha);
  });

  // Fuerza mayúsculas mientras se escribe la nota/motivo (vale para los 3
  // tipos: nota del día, nota de agrupación y motivo de cierre, ya que
  // comparten el mismo textarea #gestor-texto). Se conserva la posición del
  // cursor para que no "salte" al final en cada pulsación.
  wrap.querySelector('#gestor-texto').addEventListener('input', function (e) {
    const el = e.target;
    const inicio = el.selectionStart;
    const fin = el.selectionEnd;
    el.value = el.value.toUpperCase();
    el.setSelectionRange(inicio, fin);
  });

  wrap.querySelectorAll('.gestor-tipo-pill[data-tipo]').forEach(function (btn) {
    btn.onclick = function () {
      if (btn.disabled) return;
      wrap.querySelectorAll('.gestor-tipo-pill[data-tipo]').forEach(function (b) { b.classList.remove('activa'); });
      btn.classList.add('activa');
      GESTOR_OBS.tipo = btn.getAttribute('data-tipo');
      GESTOR_OBS.seleccion = GESTOR_OBS.tipo === 'cierre'
        ? []
        : (GESTOR_OBS.tipo === 'cambio' ? { origen: null, destino: null, transitoOverride: null } : null);
      document.getElementById('gestor-busqueda').value = '';
      const btnLimpiar = document.getElementById('gestor-busqueda-clear');
      if (btnLimpiar) btnLimpiar.classList.remove('visible');
      actualizarFormularioSegunTipo_();
    };
  });

  // Opciones de plazo (24h..120h) para el paso 3 de "Cambio puntual": se
  // reutiliza TRANSITO_OPCIONES, la misma lista que en Configuración de
  // tiendas, para que ambos sitios ofrezcan siempre los mismos valores.
  const selectTransito = wrap.querySelector('#gestor-transito-select');
  selectTransito.innerHTML = TRANSITO_OPCIONES.map(function (op) {
    return '<option value="' + op.valor + '">' + op.texto + '</option>';
  }).join('');
  selectTransito.addEventListener('change', function () {
    const sel = GESTOR_OBS.seleccion || {};
    sel.transitoOverride = Number(selectTransito.value);
    GESTOR_OBS.seleccion = sel;
  });

  wrap.querySelectorAll('.gestor-transito-pill').forEach(function (btn) {
    btn.onclick = function () {
      wrap.querySelectorAll('.gestor-transito-pill').forEach(function (b) { b.classList.remove('activa'); });
      btn.classList.add('activa');
      const sel = GESTOR_OBS.seleccion || {};
      if (btn.getAttribute('data-opcion') === 'nuevo') {
        sel.transitoOverride = Number(selectTransito.value) || (sel.origen && sel.origen.transito) || 1;
        selectTransito.value = String(sel.transitoOverride);
        selectTransito.style.display = '';
      } else {
        sel.transitoOverride = null;
        selectTransito.style.display = 'none';
      }
      GESTOR_OBS.seleccion = sel;
    };
  });

  const inputBusqueda = wrap.querySelector('#gestor-busqueda');
  const btnLimpiarBusqueda = wrap.querySelector('#gestor-busqueda-clear');
  inputBusqueda.addEventListener('input', function () {
    // En "Cerrar tienda" se puede elegir varias tiendas: escribir para buscar
    // la siguiente no debe borrar las que ya se marcaron. En "Nota de
    // agrupación" solo hay una elegida a la vez, así que escribir sí la
    // sustituye (se está buscando otra distinta).
    if (GESTOR_OBS.tipo !== 'cierre' && GESTOR_OBS.tipo !== 'cambio') GESTOR_OBS.seleccion = null;
    btnLimpiarBusqueda.classList.toggle('visible', !!inputBusqueda.value);
    actualizarSeleccionGestorObs_();
    renderResultadosBusquedaGestorObs_(inputBusqueda.value);
  });
  inputBusqueda.addEventListener('focus', function () {
    renderResultadosBusquedaGestorObs_(inputBusqueda.value);
  });
  btnLimpiarBusqueda.addEventListener('click', function () {
    inputBusqueda.value = '';
    btnLimpiarBusqueda.classList.remove('visible');
    if (GESTOR_OBS.tipo !== 'cierre' && GESTOR_OBS.tipo !== 'cambio') GESTOR_OBS.seleccion = null;
    actualizarSeleccionGestorObs_();
    renderResultadosBusquedaGestorObs_('');
    inputBusqueda.focus();
  });

  return wrap;
}

/** Ajusta el formulario (buscador visible/oculto, etiquetas) según el tipo elegido. */
function actualizarFormularioSegunTipo_() {
  const campoBusqueda = document.getElementById('gestor-busqueda-campo');
  const label = document.getElementById('gestor-busqueda-label');
  const ayuda = document.getElementById('gestor-busqueda-ayuda');
  const textoLabel = document.getElementById('gestor-texto-label');
  const textoArea = document.getElementById('gestor-texto');
  const inputBusqueda = document.getElementById('gestor-busqueda');
  if (!campoBusqueda) return;

  const campoTexto = textoArea.closest('.gestor-campo');
  if (campoTexto) campoTexto.style.display = '';

  if (GESTOR_OBS.tipo === 'general') {
    campoBusqueda.style.display = 'none';
    ayuda.style.display = 'none';
    textoLabel.textContent = 'Nota';
    textoArea.placeholder = 'Escribe la nota general del día…';
  } else if (GESTOR_OBS.tipo === 'agrupacion') {
    campoBusqueda.style.display = 'block';
    ayuda.style.display = 'none';
    label.textContent = 'Agrupación';
    inputBusqueda.placeholder = 'Busca una agrupación…';
    textoLabel.textContent = 'Nota';
    textoArea.placeholder = 'Escribe la nota para esta agrupación…';
  } else if (GESTOR_OBS.tipo === 'cambio') {
    campoBusqueda.style.display = 'block';
    ayuda.style.display = 'block';
    const sel = GESTOR_OBS.seleccion || {};
    if (!sel.origen) {
      label.textContent = 'Tienda que cambia';
      inputBusqueda.placeholder = 'Busca la tienda que sale por otra agrupación…';
      ayuda.textContent = 'Elige la tienda que, solo este día, sale por una agrupación distinta a la suya.';
    } else {
      label.textContent = 'Agrupación destino';
      inputBusqueda.placeholder = 'Busca la agrupación por la que sale…';
      ayuda.textContent = 'Elige la agrupación (activa ese mismo día) por la que sale ' + sel.origen.tienda + '.';
    }
    if (campoTexto) campoTexto.style.display = 'none';
    actualizarSeccionTransitoGestorObs_();
  } else {
    campoBusqueda.style.display = 'block';
    ayuda.style.display = 'block';
    label.textContent = 'Tiendas';
    inputBusqueda.placeholder = 'Busca y añade una o varias tiendas…';
    textoLabel.textContent = 'Motivo del cierre';
    textoArea.placeholder = 'Ej. "Tienda cerrada, no se da a agencia"…';
  }
  document.getElementById('gestor-busqueda-resultados').style.display = 'none';
  actualizarSeleccionGestorObs_();
}

/** Muestra/oculta y rellena el paso 3 de "Cambio puntual" (plazo de
 *  entrega): solo tiene sentido una vez elegidas tienda de origen Y
 *  agrupación destino. Se deja siempre en "mantener el plazo actual" salvo
 *  que el usuario haya tocado ya el select (sel.transitoOverride != null). */
function actualizarSeccionTransitoGestorObs_() {
  const campo = document.getElementById('gestor-transito-campo');
  if (!campo) return;
  const sel = GESTOR_OBS.seleccion || {};
  if (GESTOR_OBS.tipo !== 'cambio' || !sel.origen || !sel.destino) {
    campo.style.display = 'none';
    return;
  }
  campo.style.display = 'block';

  const badgeActual = badgeTransitoTienda(sel.origen.transito);
  const textoActual = badgeActual ? badgeActual.texto : '24H';
  const pillActual = campo.querySelector('.gestor-transito-pill[data-opcion="actual"]');
  if (pillActual) pillActual.textContent = 'Mantener el plazo actual de la tienda (' + textoActual + ')';

  const usaNuevo = sel.transitoOverride != null;
  campo.querySelectorAll('.gestor-transito-pill').forEach(function (b) {
    b.classList.toggle('activa', (b.getAttribute('data-opcion') === 'nuevo') === usaNuevo);
  });
  const selectEl = document.getElementById('gestor-transito-select');
  if (selectEl) {
    selectEl.style.display = usaNuevo ? '' : 'none';
    if (usaNuevo) selectEl.value = String(sel.transitoOverride);
  }
}

/** Actualiza el texto del botón "Guardar" para reflejar cuántos cierres se van a crear (si es más de uno). */
function actualizarBotonGuardarGestor_() {
  const btn = document.getElementById('modal-confirm-btn');
  if (!btn) return;
  const n = GESTOR_OBS.tipo === 'cierre' && GESTOR_OBS.seleccion ? GESTOR_OBS.seleccion.length : 0;
  btn.textContent = n > 1 ? 'Guardar ' + n + ' cierres' : 'Guardar';
}

/** Muestra el/los chip(s) de lo ya elegido (una agrupación, o varias tiendas si es un cierre), con opción de quitar cada uno. */
function actualizarSeleccionGestorObs_() {
  const cont = document.getElementById('gestor-seleccion-actual');
  if (!cont) return;
  actualizarBotonGuardarGestor_();

  if (GESTOR_OBS.tipo === 'cierre') {
    const seleccion = GESTOR_OBS.seleccion || [];
    if (!seleccion.length) { cont.innerHTML = ''; return; }
    const contador = seleccion.length === 1 ? '1 tienda seleccionada' : seleccion.length + ' tiendas seleccionadas';
    cont.innerHTML =
      '<div class="gestor-seleccion-contador">' + contador + '</div>' +
      '<div class="gestor-seleccion-chips">' +
      seleccion.map(function (s, i) {
        return '<span class="gestor-seleccion-chip">' + escapeHtml(s.tienda + ' (' + s.agrupacion + ')') +
          '<button type="button" data-quitar="' + i + '">×</button></span>';
      }).join('') +
      '</div>';
    cont.querySelectorAll('button[data-quitar]').forEach(function (btn) {
      btn.onclick = function () {
        GESTOR_OBS.seleccion.splice(Number(btn.getAttribute('data-quitar')), 1);
        actualizarSeleccionGestorObs_();
        renderResultadosBusquedaGestorObs_(document.getElementById('gestor-busqueda').value);
      };
    });
    return;
  }

  if (GESTOR_OBS.tipo === 'cambio') {
    const sel = GESTOR_OBS.seleccion || {};
    if (!sel.origen) { cont.innerHTML = ''; return; }
    let html = '<div class="gestor-seleccion-chips"><span class="gestor-seleccion-chip">' +
      escapeHtml(sel.origen.tienda + ' (' + sel.origen.agrupacion + ')') +
      '<button type="button" id="gestor-quitar-origen">×</button></span>';
    if (sel.destino) {
      html += '<span class="gestor-seleccion-chip">→ ' + escapeHtml(sel.destino) +
        '<button type="button" id="gestor-quitar-destino">×</button></span>';
    }
    html += '</div>';
    cont.innerHTML = html;
    document.getElementById('gestor-quitar-origen').onclick = function () {
      GESTOR_OBS.seleccion = { origen: null, destino: null, transitoOverride: null };
      document.getElementById('gestor-busqueda').value = '';
      actualizarFormularioSegunTipo_();
      const inputBusq = document.getElementById('gestor-busqueda');
      if (inputBusq) inputBusq.focus();
      renderResultadosBusquedaGestorObs_('');
    };
    const btnQuitarDestino = document.getElementById('gestor-quitar-destino');
    if (btnQuitarDestino) {
      btnQuitarDestino.onclick = function () {
        sel.destino = null;
        sel.transitoOverride = null;
        document.getElementById('gestor-busqueda').value = '';
        actualizarSeleccionGestorObs_();
        actualizarSeccionTransitoGestorObs_();
        const inputBusq = document.getElementById('gestor-busqueda');
        if (inputBusq) inputBusq.focus();
        renderResultadosBusquedaGestorObs_('');
      };
    }
    actualizarSeccionTransitoGestorObs_();
    return;
  }

  if (!GESTOR_OBS.seleccion) { cont.innerHTML = ''; return; }
  const texto = GESTOR_OBS.seleccion.agrupacion;
  cont.innerHTML = '<div class="gestor-seleccion-chips"><span class="gestor-seleccion-chip">' + escapeHtml(texto) + '<button type="button" id="gestor-quitar-seleccion">×</button></span></div>';
  document.getElementById('gestor-quitar-seleccion').onclick = function () {
    GESTOR_OBS.seleccion = null;
    document.getElementById('gestor-busqueda').value = '';
    actualizarSeleccionGestorObs_();
  };
}

/** Carga (o recarga, al cambiar de fecha) las agrupaciones/tiendas de ese día. */
/** Carga (o recarga, al cambiar de fecha) las agrupaciones/tiendas de ese día.
 *
 * Usa un "id de carga" (GESTOR_OBS.cargaId) en vez de comparar solo la
 * fecha: así, si el usuario teclea la fecha rápido y se disparan varias
 * peticiones seguidas, solo la ÚLTIMA lanzada puede actualizar la
 * pantalla — las respuestas de peticiones ya obsoletas (aunque lleguen
 * después) se ignoran. También arma un timeout de seguridad: si en 12s no
 * ha llegado ni éxito ni error (p.ej. un fallo de red que ni dispara el
 * failureHandler), se muestra un aviso con botón "Reintentar" en vez de
 * dejar el spinner dando vueltas para siempre.
 */
/** Carga (o recarga, al cambiar de fecha) las agrupaciones/tiendas de ese día.
 *
 * Usa PRIMERO getConteoDia(fecha) — la llamada de siempre, ya probada —
 * porque para cualquier fecha dentro de la ventana normal (hoy, ayer,
 * mañana...) funciona perfectamente y además trae el estado de cierres
 * (para no ofrecer una tienda ya cerrada al buscarla). SOLO si esa
 * llamada indica que la fecha está "bloqueada" (más allá de la ventana de
 * futuro accesible) se hace una SEGUNDA llamada a getPlantillaDia(dia),
 * que no depende de esa ventana, para poder seguir dejando notas o
 * cierres en fechas lejanas (festivos, etc.) sin las tiendas ya cerradas.
 *
 * Usa un "id de carga" (GESTOR_OBS.cargaId) en vez de comparar solo la
 * fecha: si el usuario teclea la fecha rápido y se disparan varias
 * peticiones seguidas, solo la ÚLTIMA lanzada puede actualizar la
 * pantalla. También arma un timeout de seguridad: si en 12s no ha
 * llegado ni éxito ni error, se muestra un aviso con botón "Reintentar"
 * en vez de dejar el spinner dando vueltas para siempre.
 */
function cargarDatosDiaGestorObs_(fecha) {
  const overlay = document.getElementById('gestor-loading-overlay');
  const avisoError = document.getElementById('gestor-aviso-error');
  const avisoErrorTexto = document.getElementById('gestor-aviso-error-texto');

  const miId = (GESTOR_OBS.cargaId || 0) + 1;
  GESTOR_OBS.cargaId = miId;

  if (avisoError) avisoError.classList.remove('visible');
  if (overlay) overlay.classList.add('visible');

  let timeoutId = setTimeout(onTimeout, 12000);

  function onTimeout() {
    if (miId !== GESTOR_OBS.cargaId) return;
    if (overlay) overlay.classList.remove('visible');
    if (avisoErrorTexto) avisoErrorTexto.textContent = 'La carga está tardando demasiado. Puede que el servidor de Apps Script no haya respondido. Comprueba tu conexión y vuelve a intentarlo.';
    if (avisoError) avisoError.classList.add('visible');
  }

  function mostrarError(mensaje) {
    if (overlay) overlay.classList.remove('visible');
    if (avisoErrorTexto) avisoErrorTexto.textContent = mensaje;
    if (avisoError) avisoError.classList.add('visible');
  }

  function aplicarDatos(data) {
    try {
      GESTOR_OBS.datosDia = data;
      if (overlay) overlay.classList.remove('visible');

      const sinDia = !data.dia || !(data.secciones && data.secciones.length);
      const pillAgr = document.querySelector('.gestor-tipo-pill[data-tipo="agrupacion"]');
      const pillCierre = document.querySelector('.gestor-tipo-pill[data-tipo="cierre"]');
      const aviso = document.getElementById('gestor-aviso-dia');
      if (pillAgr) pillAgr.disabled = sinDia;
      if (pillCierre) pillCierre.disabled = sinDia;
      if (aviso) aviso.style.display = sinDia ? 'block' : 'none';

      if (sinDia && GESTOR_OBS.tipo !== 'general') {
        GESTOR_OBS.tipo = 'general';
        document.querySelectorAll('.gestor-tipo-pill[data-tipo]').forEach(function (b) {
          b.classList.toggle('activa', b.getAttribute('data-tipo') === 'general');
        });
      }
      actualizarFormularioSegunTipo_();
    } catch (e) {
      mostrarError('Error al procesar los datos recibidos: ' + (e && e.message ? e.message : e));
    }
  }

  // 2º intento (solo si la fecha está bloqueada por la ventana de futuro):
  // plantilla del día de la semana, sin restricción de fecha.
  function pedirPlantilla() {
    const dia = diaDesdeFechaJs_(fecha);
    llamarApi_('getPlantillaDia', [dia])
      .then(function (data) {
        clearTimeout(timeoutId);
        if (miId !== GESTOR_OBS.cargaId) return;
        aplicarDatos(data);
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        if (miId !== GESTOR_OBS.cargaId) return;
        const mensaje = (err && err.message) ? err.message : String(err);
        mostrarError('No se ha podido cargar: ' + mensaje);
        mostrarErrorServidor(err);
      });
  }

  // 1er intento: la llamada de siempre, para fechas dentro de la ventana.
  llamarApi_('getConteoDia', [fecha])
    .then(function (data) {
      if (miId !== GESTOR_OBS.cargaId) { clearTimeout(timeoutId); return; }
      if (data && data.bloqueada) {
        // Fuera de la ventana normal: reintentamos con la plantilla, que sí
        // sabe leer ese día de la semana sin mirar la fecha en absoluto.
        pedirPlantilla();
        return;
      }
      clearTimeout(timeoutId);
      aplicarDatos(data);
    })
    .catch(function (err) {
      clearTimeout(timeoutId);
      if (miId !== GESTOR_OBS.cargaId) return;
      const mensaje = (err && err.message) ? err.message : String(err);
      mostrarError('No se ha podido cargar: ' + mensaje);
      mostrarErrorServidor(err);
    });
}

/** Resalta, dentro de "texto", la primera aparición de "q" (ya en minúsculas)
 *  envolviéndola en <mark>. Si no hay query o no hay coincidencia, devuelve
 *  el texto escapado tal cual. */
function resaltarCoincidenciaGestorObs_(texto, q) {
  const t = String(texto || '');
  if (!q) return escapeHtml(t);
  const idx = t.toLowerCase().indexOf(q);
  if (idx === -1) return escapeHtml(t);
  return escapeHtml(t.slice(0, idx)) + '<mark>' + escapeHtml(t.slice(idx, idx + q.length)) + '</mark>' + escapeHtml(t.slice(idx + q.length));
}

// Cuántos resultados como máximo se pintan de golpe en el desplegable. No es
// un límite de búsqueda (se sigue buscando en TODAS las agrupaciones/tiendas
// del día): es solo para no pintar de una vez cientos de filas si no se ha
// escrito nada todavía. En cuanto se escribe algo, casi siempre el número de
// coincidencias baja de sobra por debajo de esto.
const GESTOR_OBS_LIMITE_VISIBLE_ = 60;

/** Filtra agrupaciones o tiendas (según el tipo elegido) y pinta el
 *  desplegable de resultados.
 *
 * En modo "cierre" los resultados se agrupan por agrupación/ruta (en vez de
 * una lista plana), con un botón "Añadir todas" por grupo: muy útil para
 * festivos, cuando hace falta cerrar una ruta entera de una vez en lugar de
 * tienda a tienda. Antes esta función se quedaba solo con las 8 primeras
 * coincidencias (items.slice(0,8)), así que cualquier tienda que no
 * estuviera entre esas 8 primeras no aparecía nunca, escribieras lo que
 * escribieras: se ha quitado ese límite (ver GESTOR_OBS_LIMITE_VISIBLE_,
 * que solo acota cuántas se pintan de golpe, no cuántas se buscan).
 */
/** Calcula dónde debe colocarse el desplegable de resultados (posición fija
 *  respecto a la pantalla, no al modal) y cuánto alto puede tener como
 *  máximo según el hueco real que quede debajo del buscador. Se llama cada
 *  vez que se va a mostrar el desplegable, así siempre encaja aunque el
 *  modal tenga scroll, la ventana se haya redimensionado, etc. */
function posicionarResultadosGestorObs_() {
  const cont = document.getElementById('gestor-busqueda-resultados');
  const wrap = document.querySelector('.gestor-busqueda-wrap');
  if (!cont || !wrap) return;
  const rect = wrap.getBoundingClientRect();
  const margenInferior = 16;
  const espacioAbajo = window.innerHeight - rect.bottom - margenInferior;
  const espacioArriba = rect.top - margenInferior;
  // Preferimos abrir hacia abajo; si hay muy poco hueco ahí pero arriba hay
  // claramente más sitio, abrimos hacia arriba en su lugar.
  const haciaArriba = espacioAbajo < 160 && espacioArriba > espacioAbajo;
  cont.style.left = rect.left + 'px';
  cont.style.width = rect.width + 'px';
  if (haciaArriba) {
    cont.style.top = '';
    cont.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    cont.style.maxHeight = Math.max(120, Math.min(400, espacioArriba)) + 'px';
  } else {
    cont.style.bottom = '';
    cont.style.top = (rect.bottom + 4) + 'px';
    cont.style.maxHeight = Math.max(120, Math.min(400, espacioAbajo)) + 'px';
  }
}
window.addEventListener('resize', function () {
  const cont = document.getElementById('gestor-busqueda-resultados');
  if (cont && cont.style.display !== 'none') posicionarResultadosGestorObs_();
});

function renderResultadosBusquedaGestorObs_(query) {
  const cont = document.getElementById('gestor-busqueda-resultados');
  if (!cont) return;
  posicionarResultadosGestorObs_();

  if (!GESTOR_OBS.datosDia) {
    cont.innerHTML = '<div class="gestor-busqueda-vacio">Cargando…</div>';
    cont.style.display = 'block';
    return;
  }

  const q = String(query || '').trim().toLowerCase();
  const secciones = GESTOR_OBS.datosDia.secciones || [];

  if (GESTOR_OBS.tipo === 'agrupacion') {
    const items = secciones
      .map(function (s) { return { label: s.nombre, agrupacion: s.nombre }; })
      .filter(function (it) { return !q || it.label.toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { return a.label.localeCompare(b.label, 'es'); });

    if (!items.length) {
      cont.innerHTML = '<div class="gestor-busqueda-vacio">' + (q ? 'Sin resultados para «' + escapeHtml(query.trim()) + '»' : 'No hay agrupaciones disponibles') + '</div>';
      cont.style.display = 'block';
      return;
    }

    const visibles = items.slice(0, GESTOR_OBS_LIMITE_VISIBLE_);
    cont.innerHTML = visibles.map(function (it, i) {
      return '<div class="gestor-busqueda-item" data-idx="' + i + '"><span class="gestor-busqueda-item-texto">' +
        resaltarCoincidenciaGestorObs_(it.label, q) + '</span></div>';
    }).join('') + (items.length > visibles.length
      ? '<div class="gestor-busqueda-footer">Mostrando ' + visibles.length + ' de ' + items.length + ' — sigue escribiendo para acotar</div>'
      : '');
    cont.style.display = 'block';

    cont.querySelectorAll('.gestor-busqueda-item[data-idx]').forEach(function (el) {
      el.onclick = function () {
        const it = visibles[Number(el.getAttribute('data-idx'))];
        GESTOR_OBS.seleccion = { agrupacion: it.agrupacion };
        document.getElementById('gestor-busqueda').value = it.label;
        cont.style.display = 'none';
        actualizarSeleccionGestorObs_();
      };
    });
    return;
  }

  if (GESTOR_OBS.tipo === 'cambio') {
    const sel = GESTOR_OBS.seleccion || { origen: null, destino: null };

    if (!sel.origen) {
      // ---- Paso 1: elegir la tienda que cambia (agrupado por agrupación/ruta, selección única) ----
      const grupos = [];
      secciones.forEach(function (s) {
        const tiendas = (s.tiendas || []).filter(function (t) {
          if (t.entraPorExcepcion) return false; // ya está aquí por otro cambio puntual: no se puede volver a mover
          return !q || t.nombre.toLowerCase().indexOf(q) !== -1 || s.nombre.toLowerCase().indexOf(q) !== -1;
        });
        if (tiendas.length) grupos.push({ agrupacion: s.nombre, tiendas: tiendas });
      });

      if (!grupos.length) {
        cont.innerHTML = '<div class="gestor-busqueda-vacio">' + (q ? 'Sin resultados para «' + escapeHtml(query.trim()) + '»' : 'No hay tiendas disponibles') + '</div>';
        cont.style.display = 'block';
        return;
      }

      const planas = [];
      let html = '';
      grupos.forEach(function (g) {
        html += '<div class="gestor-busqueda-grupo"><span>' + escapeHtml(g.agrupacion) + ' · ' + g.tiendas.length + '</span></div>';
        g.tiendas.forEach(function (t) {
          const idx = planas.length;
          planas.push({ agrupacion: g.agrupacion, tienda: t.nombre, transito: t.transito });
          html += '<div class="gestor-busqueda-item" data-idx="' + idx + '">' +
            '<span class="gestor-busqueda-item-texto">' + resaltarCoincidenciaGestorObs_(t.nombre, q) + '</span></div>';
        });
      });
      cont.innerHTML = html;
      cont.style.display = 'block';
      cont.querySelectorAll('.gestor-busqueda-item[data-idx]').forEach(function (el) {
        el.onclick = function () {
          const it = planas[Number(el.getAttribute('data-idx'))];
          GESTOR_OBS.seleccion = { origen: { agrupacion: it.agrupacion, tienda: it.tienda, transito: it.transito }, destino: null, transitoOverride: null };
          document.getElementById('gestor-busqueda').value = '';
          cont.style.display = 'none';
          actualizarFormularioSegunTipo_();
          // Pasamos al paso 2: abrimos ya la lista de agrupaciones destino en
          // vez de esperar a que el buscador reciba el evento "focus" (si ya
          // lo tenía, el navegador no lo vuelve a disparar y el desplegable
          // se quedaba cerrado sin más).
          const inputBusq = document.getElementById('gestor-busqueda');
          if (inputBusq) inputBusq.focus();
          renderResultadosBusquedaGestorObs_('');
        };
      });
      return;
    }

    // ---- Paso 2: elegir la agrupación destino (activa ese mismo día, distinta de la de origen) ----
    const items = secciones
      .map(function (s) { return { label: s.nombre }; })
      .filter(function (it) { return it.label !== sel.origen.agrupacion; })
      .filter(function (it) { return !q || it.label.toLowerCase().indexOf(q) !== -1; })
      .sort(function (a, b) { return a.label.localeCompare(b.label, 'es'); });

    if (!items.length) {
      cont.innerHTML = '<div class="gestor-busqueda-vacio">' + (q ? 'Sin resultados para «' + escapeHtml(query.trim()) + '»' : 'No hay otras agrupaciones ese día') + '</div>';
      cont.style.display = 'block';
      return;
    }

    cont.innerHTML = items.map(function (it, i) {
      return '<div class="gestor-busqueda-item" data-idx="' + i + '"><span class="gestor-busqueda-item-texto">' +
        resaltarCoincidenciaGestorObs_(it.label, q) + '</span></div>';
    }).join('');
    cont.style.display = 'block';
    cont.querySelectorAll('.gestor-busqueda-item[data-idx]').forEach(function (el) {
      el.onclick = function () {
        const it = items[Number(el.getAttribute('data-idx'))];
        sel.destino = it.label;
        GESTOR_OBS.seleccion = sel;
        document.getElementById('gestor-busqueda').value = it.label;
        cont.style.display = 'none';
        actualizarSeleccionGestorObs_();
        actualizarSeccionTransitoGestorObs_();
      };
    });
    return;
  }

  if (GESTOR_OBS.tipo !== 'cierre') return;

  // ---- Modo "cierre": agrupado por agrupación/ruta ----
  const seleccionActual = GESTOR_OBS.seleccion || [];
  const estaMarcada = function (agrupacion, tienda) {
    return seleccionActual.some(function (s) { return s.tienda === tienda && s.agrupacion === agrupacion; });
  };

  const grupos = [];
  let totalCoincidencias = 0;
  secciones.forEach(function (s) {
    const tiendas = (s.tiendas || []).filter(function (t) {
      if (t.cerrada) return false; // ya cerrada: no tiene sentido volver a cerrarla
      return !q || t.nombre.toLowerCase().indexOf(q) !== -1 || s.nombre.toLowerCase().indexOf(q) !== -1;
    });
    if (tiendas.length) {
      grupos.push({ agrupacion: s.nombre, tiendas: tiendas });
      totalCoincidencias += tiendas.length;
    }
  });

  if (!grupos.length) {
    cont.innerHTML = '<div class="gestor-busqueda-vacio">' + (q ? 'Sin resultados para «' + escapeHtml(query.trim()) + '»' : 'No hay tiendas disponibles') + '</div>';
    cont.style.display = 'block';
    return;
  }

  // Índice plano (para los data-idx de cada tienda) que referencia este mismo
  // array "planas" al hacer clic, en vez de recalcularlo.
  const planas = [];
  let mostradas = 0;
  let truncado = false;
  let html = '';

  grupos.forEach(function (g) {
    if (mostradas >= GESTOR_OBS_LIMITE_VISIBLE_) { truncado = true; return; }
    const idsGrupo = g.tiendas.map(function (t) {
      const idx = planas.length;
      planas.push({ agrupacion: g.agrupacion, tienda: t.nombre });
      return idx;
    });
    mostradas += idsGrupo.length;

    const marcadasEnGrupo = idsGrupo.filter(function (idx) { return estaMarcada(planas[idx].agrupacion, planas[idx].tienda); }).length;
    const todoMarcado = idsGrupo.length > 1 && marcadasEnGrupo === idsGrupo.length;

    html += '<div class="gestor-busqueda-grupo"><span>' + escapeHtml(g.agrupacion) + ' · ' + g.tiendas.length + '</span>' +
      (idsGrupo.length > 1 ? '<button type="button" class="gestor-grupo-toggle" data-ids="' + idsGrupo.join(',') + '">' + (todoMarcado ? 'Quitar todas' : 'Añadir todas') + '</button>' : '') +
      '</div>';

    idsGrupo.forEach(function (idx) {
      const it = planas[idx];
      const marcada = estaMarcada(it.agrupacion, it.tienda);
      html += '<div class="gestor-busqueda-item' + (marcada ? ' marcada' : '') + '" data-idx="' + idx + '">' +
        '<span class="gestor-check">' + (marcada ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : '') + '</span>' +
        '<span class="gestor-busqueda-item-texto">' + resaltarCoincidenciaGestorObs_(it.tienda, q) + '</span></div>';
    });
  });

  if (truncado) {
    html += '<div class="gestor-busqueda-footer">Mostrando ' + mostradas + ' de ' + totalCoincidencias + ' — sigue escribiendo para acotar</div>';
  }

  cont.innerHTML = html;
  cont.style.display = 'block';

  cont.querySelectorAll('.gestor-busqueda-item[data-idx]').forEach(function (el) {
    el.onclick = function () {
      const it = planas[Number(el.getAttribute('data-idx'))];
      if (!GESTOR_OBS.seleccion) GESTOR_OBS.seleccion = [];
      const idx = GESTOR_OBS.seleccion.findIndex(function (s) { return s.tienda === it.tienda && s.agrupacion === it.agrupacion; });
      if (idx === -1) GESTOR_OBS.seleccion.push({ agrupacion: it.agrupacion, tienda: it.tienda });
      else GESTOR_OBS.seleccion.splice(idx, 1);
      actualizarSeleccionGestorObs_();
      renderResultadosBusquedaGestorObs_(query);
    };
  });

  cont.querySelectorAll('.gestor-grupo-toggle[data-ids]').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      const ids = btn.getAttribute('data-ids').split(',').map(Number);
      if (!GESTOR_OBS.seleccion) GESTOR_OBS.seleccion = [];
      const todoMarcado = ids.every(function (idx) { return estaMarcada(planas[idx].agrupacion, planas[idx].tienda); });
      ids.forEach(function (idx) {
        const it = planas[idx];
        const pos = GESTOR_OBS.seleccion.findIndex(function (s) { return s.tienda === it.tienda && s.agrupacion === it.agrupacion; });
        if (todoMarcado) { if (pos !== -1) GESTOR_OBS.seleccion.splice(pos, 1); }
        else if (pos === -1) GESTOR_OBS.seleccion.push({ agrupacion: it.agrupacion, tienda: it.tienda });
      });
      actualizarSeleccionGestorObs_();
      renderResultadosBusquedaGestorObs_(query);
    };
  });
}

/** Guarda una observación en el backend, envuelto en una Promesa (google.script.run usa callbacks). */
function guardarObservacionPromise_(obs) {
  return llamarApi_('guardarObservacion', [obs]);
}

/** Valida el formulario y guarda la observación (nota general, de agrupación, o uno o varios cierres de tienda). */
function guardarDesdeGestorObs_() {
  const fecha = GESTOR_OBS.fecha;
  if (!fecha) { mostrarToast('Elige una fecha', true); return; }

  if (GESTOR_OBS.tipo === 'cambio') {
    guardarCambioPuntualDesdeGestor_();
    return;
  }

  const texto = (document.getElementById('gestor-texto').value || '').trim();
  if (!texto) { document.getElementById('gestor-texto').focus(); return; }

  const dia = (GESTOR_OBS.datosDia && GESTOR_OBS.datosDia.dia) || '';
  const base = { fecha: fecha, dia: dia, agrupacion: '', tienda: '', tipo: 'nota', texto: texto };

  let observaciones = [];
  if (GESTOR_OBS.tipo === 'general') {
    observaciones = [base];
  } else if (GESTOR_OBS.tipo === 'agrupacion') {
    if (!GESTOR_OBS.seleccion) { mostrarToast('Busca y selecciona una agrupación', true); return; }
    observaciones = [Object.assign({}, base, { agrupacion: GESTOR_OBS.seleccion.agrupacion })];
  } else if (GESTOR_OBS.tipo === 'cierre') {
    const seleccion = GESTOR_OBS.seleccion || [];
    if (!seleccion.length) { mostrarToast('Busca y selecciona al menos una tienda', true); return; }
    // Una tienda por cada cierre: mismo motivo para todas las marcadas.
    observaciones = seleccion.map(function (s) {
      return Object.assign({}, base, { agrupacion: s.agrupacion, tienda: s.tienda, tipo: 'cierre' });
    });
  }

  const btnGuardar = document.getElementById('modal-confirm-btn');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…'; }

  // Se guardan una a una (no en paralelo) para no saturar el backend de
  // Apps Script con llamadas simultáneas cuando se cierran varias tiendas
  // a la vez. Se guarda también el id que devuelve cada guardado, para
  // poder añadir la observación al caché local de "Gestión festivos" sin
  // tener que volver a pedir todo el rango al servidor (ver
  // agregarObservacionesACacheFestivos_ más abajo).
  const guardados = [];
  let cadena = Promise.resolve();
  observaciones.forEach(function (obs) {
    cadena = cadena.then(function () {
      return guardarObservacionPromise_(obs).then(function (res) {
        guardados.push(Object.assign({}, obs, { id: res && res.id }));
      });
    });
  });

  cadena
    .then(function () {
      cerrarModal();
      mostrarToast(observaciones.length > 1 ? observaciones.length + ' cierres guardados' : 'Guardado');
      if (document.getElementById('calendar-body')) cargarCalendario();
      if (fecha === ESTADO.fecha && document.getElementById('dia-contenido')) cargarConteoDia();
      if (ESTADO.vista === 'administracion' && ESTADO_ADMIN.seccionActiva === 'festivos') {
        agregarObservacionesACacheFestivos_(fecha, dia, guardados);
      }
    })
    .catch(function (err) {
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar'; }
      mostrarErrorServidor(err);
    });
}

/** Valida y guarda un "cambio puntual" (una tienda sale, solo esa fecha, por
 *  una agrupación distinta a la suya), llamando a guardarExcepcionTienda. */
function guardarCambioPuntualDesdeGestor_() {
  const fecha = GESTOR_OBS.fecha;
  const dia = (GESTOR_OBS.datosDia && GESTOR_OBS.datosDia.dia) || '';
  const sel = GESTOR_OBS.seleccion || {};
  if (!sel.origen) { mostrarToast('Busca y elige la tienda que cambia', true); return; }
  if (!sel.destino) { mostrarToast('Busca y elige la agrupación de destino', true); return; }

  const btnGuardar = document.getElementById('modal-confirm-btn');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…'; }

  llamarApi_('guardarExcepcionTienda', [{
    fecha: fecha,
    dia: dia,
    agrupacionOrigen: sel.origen.agrupacion,
    tienda: sel.origen.tienda,
    agrupacionDestino: sel.destino,
    transito: (sel.transitoOverride != null ? sel.transitoOverride : null)
  }])
    .then(function () {
      cerrarModal();
      mostrarToast('Cambio puntual guardado');
      if (document.getElementById('calendar-body')) cargarCalendario();
      if (fecha === ESTADO.fecha && document.getElementById('dia-contenido')) cargarConteoDia();
      if (ESTADO.vista === 'administracion' && ESTADO_ADMIN.seccionActiva === 'festivos') {
        cargarFestivos();
      }
    })
    .catch(function (err) {
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar'; }
      mostrarErrorServidor(err);
    });
}

/** Añade al caché local de "Gestión festivos" (FESTIVOS_ESTADO.datosCache)
 *  las observaciones recién guardadas en el servidor, y repinta al instante
 *  (mismo espíritu que quitarDeCacheFestivos_ al borrar): así añadir una
 *  nota/cierre desde el gestor no obliga a volver a pedir todo el rango
 *  visible con su loader y espera, igual que al eliminar una. */
function agregarObservacionesACacheFestivos_(fecha, dia, guardados) {
  if (!guardados || !guardados.length) return;

  FESTIVOS_ESTADO.datosCache = FESTIVOS_ESTADO.datosCache || [];
  let data = FESTIVOS_ESTADO.datosCache.filter(function (d) { return d && d.fecha === fecha; })[0];
  if (!data) {
    // Fecha que hasta ahora no tenía ninguna anotación (por eso no venía en
    // el caché, que solo trae los días con contenido): se crea un registro
    // nuevo para ella, vacío salvo por lo que se añade a continuación.
    data = { fecha: fecha, dia: dia || '', notasGenerales: [], secciones: [] };
    FESTIVOS_ESTADO.datosCache.push(data);
  }

  guardados.forEach(function (obs) {
    if (!obs.id) return; // por si el backend no devolviera id, no se añade "a ciegas" al caché
    if (!obs.agrupacion) {
      data.notasGenerales = data.notasGenerales || [];
      data.notasGenerales.push({ id: obs.id, texto: obs.texto, tipo: obs.tipo });
      return;
    }
    data.secciones = data.secciones || [];
    let seccion = data.secciones.filter(function (s) { return s.nombre === obs.agrupacion; })[0];
    if (!seccion) {
      seccion = { nombre: obs.agrupacion, notas: [], tiendas: [] };
      data.secciones.push(seccion);
    }
    if (!obs.tienda) {
      seccion.notas = seccion.notas || [];
      seccion.notas.push({ id: obs.id, texto: obs.texto, tipo: obs.tipo });
      return;
    }
    seccion.tiendas = seccion.tiendas || [];
    let tienda = seccion.tiendas.filter(function (t) { return t.nombre === obs.tienda; })[0];
    if (!tienda) {
      tienda = { nombre: obs.tienda, cerrada: false, motivoCierre: '', cierreId: null };
      seccion.tiendas.push(tienda);
    }
    tienda.cerrada = true;
    tienda.motivoCierre = obs.texto;
    tienda.cierreId = obs.id;
  });

  aplicarFiltrosFestivos_();
}

// Cierra el desplegable de resultados de búsqueda del gestor si se hace clic
// fuera de él. Se registra una única vez (no dentro de cada apertura del
// modal) para no acumular listeners repetidos en el documento.
//
// OJO: usamos e.composedPath() en vez de e.target.closest(...). Al elegir la
// tienda de origen en "Cambio puntual", el propio clic reconstruye al vuelo
// el contenido del desplegable (para mostrar ya el paso 2, agrupación
// destino) — con lo cual el elemento exacto donde se hizo clic queda
// desconectado del árbol DOM antes de que este listener llegue a mirarlo.
// e.target.closest('.gestor-busqueda-wrap') entonces no encuentra nada (el
// nodo ya no cuelga de ningún padre) y cerraba el desplegable justo después
// de abrirlo. composedPath() recoge la cadena de ancestros tal como estaba
// en el momento del clic, así que sigue siendo fiable aunque el DOM cambie
// durante el propio evento.
document.addEventListener('click', function (e) {
  const res = document.getElementById('gestor-busqueda-resultados');
  if (!res || res.style.display === 'none') return;
  const dentroDelBuscador = (typeof e.composedPath === 'function' ? e.composedPath() : [])
    .some(function (el) { return el && el.classList && el.classList.contains('gestor-busqueda-wrap'); });
  if (!dentroDelBuscador) res.style.display = 'none';
});
