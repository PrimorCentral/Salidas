/* SALIDAS · js/hoja-notas.js — Almacén: Hoja de notas */

/* ---------------- ALMACÉN: "Hoja de notas" ----------------
 * Sustituye a los Excel de notas (uno por nave: GAITE y PTA, con una hoja
 * por día de lunes a sábado). Cada hoja es una lista de secciones (agencia /
 * grupo) con sus tiendas, plantas, refuerzos y observaciones.
 *
 * Lo que se automatiza (todo en el backend, ver get_hoja_notas /
 * hoja_notas_accion y el trigger trg_hn_tienda_cambio en Supabase):
 *  - El nombre y el tránsito de cada tienda se leen en vivo de la lista de
 *    tiendas (que viene de GIDT): si cambian, cambian en todas las hojas.
 *  - Si una tienda se da de baja, sus líneas dejan de salir solas en todas
 *    las hojas (y vuelven si se da de alta otra vez).
 *  - Tienda nueva que no está en ninguna hoja: sale en un aviso para
 *    colocarla; al añadirla se puede poner a la vez en otras hojas y se le
 *    copian las plantas que ya tenga en otra hoja.
 *  - Agencia y población son de la tienda: se escriben una vez.
 *  - Festivos: columnas con el horario de cada tienda ese día; se quitan
 *    solas al pasar la fecha.
 *
 * Ver: permiso "hoja_notas_ver" (o el de editar). Editar: permiso
 * "hoja_notas" (los administradores siempre pueden las dos cosas). */

const HN_DIAS = [
  { id: 'LUNES', corto: 'LUN', largo: 'Lunes' },
  { id: 'MARTES', corto: 'MAR', largo: 'Martes' },
  { id: 'MIERCOLES', corto: 'MIÉ', largo: 'Miércoles' },
  { id: 'JUEVES', corto: 'JUE', largo: 'Jueves' },
  { id: 'VIERNES', corto: 'VIE', largo: 'Viernes' },
  { id: 'SABADO', corto: 'SÁB', largo: 'Sábado' }
];
const HN_NAVES = ['GAITE', 'PTA'];

let HN = { dia: null, nave: null, datos: null, editar: false, verOcultas: false, filtro: '', peticion: 0, latido: null, bloqueoDe: null, vigia: null };

/* ---------------- BLOQUEO DE EDICIÓN ----------------
 * Solo una persona puede editar a la vez cada hoja (día + nave). Al pulsar
 * "Editar" se pide el bloqueo (hoja_notas_bloqueo 'tomar'); mientras se
 * edita se renueva cada 40 s; al terminar, cambiar de día/nave o salir de
 * la pantalla se suelta. Si la app se cierra sin soltarlo, caduca solo a
 * los 2 minutos. El servidor rechaza cualquier cambio en una hoja que
 * tenga bloqueada otra persona. Un administrador puede quitar el bloqueo. */
const HN_LATIDO_MS = 40000;

function hnBloqueo_(accion, dia, nave) {
  return hnRpc_('hoja_notas_bloqueo', { p_dia: dia || HN.dia, p_nave: nave || HN.nave, p_accion: accion });
}

function hnEntrarEdicion_(forzar) {
  const btn = document.getElementById('hn-btn-editar');
  if (btn) btn.disabled = true;
  hnBloqueo_(forzar ? 'forzar' : 'tomar')
    .then(function (r) {
      if (btn) btn.disabled = false;
      if (!r || !r.ok) { hnModalBloqueada_(r || {}); return; }
      HN.editar = true;
      HN.bloqueoDe = { dia: HN.dia, nave: HN.nave };
      clearInterval(HN.latido);
      HN.latido = setInterval(hnLatido_, HN_LATIDO_MS);
      // Se recarga para editar sobre lo último guardado.
      hnCargar_(true);
    })
    .catch(function (err) { if (btn) btn.disabled = false; mostrarErrorServidor(err); });
}

/** Suelta el bloqueo (si se tenía) y sale del modo editar. */
function hnSalirEdicion_() {
  clearInterval(HN.latido);
  HN.latido = null;
  const de = HN.bloqueoDe;
  HN.bloqueoDe = null;
  HN.editar = false;
  HN.verOcultas = false;
  if (de) hnBloqueo_('soltar', de.dia, de.nave).catch(function () { /* caduca solo */ });
}

function hnLatido_() {
  if (!HN.editar || !HN.bloqueoDe) { clearInterval(HN.latido); return; }
  if (!document.getElementById('hn-hoja')) { hnSalirEdicion_(); return; }
  hnBloqueo_('renovar', HN.bloqueoDe.dia, HN.bloqueoDe.nave)
    .then(function (r) {
      if (r && r.ok) return;
      clearInterval(HN.latido);
      HN.latido = null;
      HN.bloqueoDe = null;
      HN.editar = false;
      cerrarModal();
      hnCargar_(true);
      appConfirm('Ya no estás editando', (r && r.por ? r.por + ' ha tomado' : 'Otra persona ha tomado') +
        ' la edición de esta hoja. Lo que no hubieras guardado no se ha guardado.', function () {});
    })
    .catch(function () { /* sin conexión: se reintenta en el siguiente latido */ });
}

function hnModalBloqueada_(r) {
  const desde = r.desde ? hnFechaHora_(r.desde).split(' ')[1] : '';
  const cuerpo =
    '<div class="hn-bloqueada">' +
      '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
      '<div><b>' + escapeHtml(r.por || 'Otra persona') + '</b> está editando la hoja de ' +
        escapeHtml(HN.nave + ' · ' + hnDiaLargo_(HN.dia)) + (desde ? ' desde las ' + escapeHtml(desde) : '') + '.' +
        '<br>Podrás editarla cuando termine. Mientras tanto puedes verla e imprimirla.</div>' +
    '</div>';
  hnAbrirModal_('Hoja bloqueada', cuerpo,
    (esAdmin() ? '<button class="modal-cancel hn-btn-forzar" id="hn-forzar-btn">Quitar su bloqueo y editar</button>' : '') +
    '<button class="modal-confirm" id="modal-cancel-btn">Entendido</button>');
  const f = document.getElementById('hn-forzar-btn');
  if (f) {
    f.onclick = function () {
      cerrarModal();
      appConfirm('Quitar bloqueo', 'Se quitará la edición a ' + (r.por || 'la otra persona') + '. Lo que tenga sin guardar en ese momento no se guardará.', function () {
        hnEntrarEdicion_(true);
      }, true);
    };
  }
}

/** Mientras otra persona edita la hoja que se está viendo, se refresca
 *  sola cada minuto (para ver sus cambios y saber cuándo queda libre). */
function hnVigilar_() {
  clearInterval(HN.vigia);
  HN.vigia = null;
  const b = HN.datos && HN.datos.bloqueo;
  if (HN.editar || !b || b.mio) return;
  HN.vigia = setInterval(function () {
    if (!document.getElementById('hn-hoja')) { clearInterval(HN.vigia); return; }
    if (HN.editar || document.getElementById('modal-overlay').style.display === 'flex') return;
    hnCargar_(true);
  }, 60000);
}

window.addEventListener('pagehide', function () { if (HN.editar) hnSalirEdicion_(); });

function hnDiaLargo_(id) {
  const d = HN_DIAS.find(function (x) { return x.id === id; });
  return d ? d.largo : id;
}

/** Hoy (domingo -> lunes, que no hay hoja de domingo). */
function hnDiaPorDefecto_() {
  const d = new Date().getDay();
  return d === 0 ? 'LUNES' : HN_DIAS[d - 1].id;
}

function hnNavePorDefecto_() {
  return SESSION_NAVE === 'PTA' ? 'PTA' : 'GAITE';
}

function hnRpc_(nombre, params) {
  return llamarRpcSupabase_(nombre, params);
}

function hnAccion_(accion, datos) {
  return hnRpc_('hoja_notas_accion', { p_accion: accion, p_datos: datos || {} });
}

/* ---------------- COLORES DE SECCIÓN ----------------
 * color null = automático (verde si el nombre lleva ADELANTO), 'ninguno' =
 * sin color a propósito, o uno de la lista. */
const HN_COLORES = [
  { id: 'verde', nombre: 'Verde' },
  { id: 'amarillo', nombre: 'Amarillo' },
  { id: 'naranja', nombre: 'Naranja' },
  { id: 'rojo', nombre: 'Rojo' },
  { id: 'azul', nombre: 'Azul' },
  { id: 'morado', nombre: 'Morado' },
  { id: 'gris', nombre: 'Gris' }
];

function hnColorAuto_(nombre) {
  return /ADELANT/i.test(nombre || '') ? 'verde' : '';
}
/** Color con el que se pinta la sección ('' = el gris de siempre). */
function hnColorDe_(sec) {
  if (!sec) return '';
  if (sec.color === 'ninguno') return '';
  return sec.color || hnColorAuto_(sec.nombre);
}

/* ---------------- APLICAR EN OTRAS HOJAS ----------------
 * Al cambiar algo de una tienda o una sección se pregunta si se quiere
 * cambiar también en otros días y en la otra nave. Solo se ofrecen las
 * hojas donde está esa misma tienda (o una sección con el mismo nombre). */

function hnClaveHoja_(dia, nave) { return dia + '|' + nave; }

/** Hojas (sin la actual) donde está la tienda `num`. */
function hnHojasConTienda_(num) {
  const m = (HN.datos && HN.datos.presenciaTiendas) || {};
  const actual = hnClaveHoja_(HN.dia, HN.nave);
  return (m[num] || []).filter(function (k) { return k !== actual; });
}
/** Hojas (sin la actual) con una sección que se llama `nombre`. */
function hnHojasConSeccion_(nombre) {
  const m = (HN.datos && HN.datos.presenciaSecciones) || {};
  const actual = hnClaveHoja_(HN.dia, HN.nave);
  return (m[String(nombre || '').trim().toUpperCase()] || []).filter(function (k) { return k !== actual; });
}
/** Todas las hojas menos la actual. */
function hnOtrasHojas_() {
  const res = [];
  HN_NAVES.forEach(function (n) {
    HN_DIAS.forEach(function (d) { if (!(d.id === HN.dia && n === HN.nave)) res.push(hnClaveHoja_(d.id, n)); });
  });
  return res;
}

/** Pregunta, dentro del modal abierto, en qué otras hojas aplicar el
 *  cambio. Oculta (sin borrar) lo que había en el modal; "Volver" lo
 *  devuelve tal cual. opts: { titulo, texto (html), elegibles: ['DIA|NAVE'],
 *  noElegibleTxt, botonSolo, botonVarias, peligro, onElegir(lista) }.
 *  lista = [{ dia, nave }] (vacía = solo esta hoja). */
function hnPreguntarHojas_(opts) {
  const custom = document.getElementById('modal-custom');
  const acciones = document.getElementById('modal-actions');
  const titulo = document.getElementById('modal-title');
  const tituloAntes = titulo.textContent;
  const ocultos = [];
  Array.prototype.forEach.call(custom.children, function (el) { if (el.style.display !== 'none') { ocultos.push(el); el.style.display = 'none'; } });
  Array.prototype.forEach.call(acciones.children, function (el) { if (el.style.display !== 'none') { ocultos.push(el); el.style.display = 'none'; } });
  if (opts.titulo) titulo.textContent = opts.titulo;

  const elegibles = opts.elegibles || [];
  const panel = document.createElement('div');
  panel.className = 'hn-paso-hojas';
  panel.innerHTML =
    '<div class="hn-paso-texto">' + opts.texto + '</div>' +
    '<div class="hn-paso-rapidos">' +
      '<button type="button" class="hn-chip" data-rapido="nave">' + escapeHtml(HN.nave) + ' · todos los días</button>' +
      '<button type="button" class="hn-chip" data-rapido="ambas">Ambas naves · todos los días</button>' +
      '<button type="button" class="hn-chip hn-chip-suave" data-rapido="ninguna">Desmarcar</button>' +
    '</div>' +
    '<div class="hn-paso-rejilla">' +
      HN_NAVES.map(function (n) {
        return '<div class="hn-paso-fila"><b>' + n + '</b>' +
          HN_DIAS.map(function (d) {
            const k = hnClaveHoja_(d.id, n);
            if (d.id === HN.dia && n === HN.nave) {
              return '<label class="hn-paso-dia actual" title="La hoja que estás editando"><input type="checkbox" checked disabled>' + d.corto + '</label>';
            }
            const ok = elegibles.indexOf(k) !== -1;
            return '<label class="hn-paso-dia' + (ok ? '' : ' no') + '"' + (ok ? '' : ' title="' + escapeAttr(opts.noElegibleTxt || 'No está en esa hoja') + '"') + '>' +
              '<input type="checkbox" data-hoja="' + k + '"' + (ok ? '' : ' disabled') + '>' + d.corto + '</label>';
          }).join('') + '</div>';
      }).join('') +
    '</div>' +
    '<div class="hn-paso-leyenda"><span class="hn-paso-dia actual"><input type="checkbox" checked disabled>esta hoja</span>' +
      '<span class="hn-paso-dia no"><input type="checkbox" disabled>' + escapeHtml(opts.noElegibleTxt || 'no está en esa hoja') + '</span></div>';
  custom.appendChild(panel);

  const bVolver = document.createElement('button');
  bVolver.className = 'modal-cancel'; bVolver.textContent = 'Volver';
  const bSolo = document.createElement('button');
  bSolo.className = 'modal-cancel hn-paso-solo'; bSolo.textContent = opts.botonSolo || 'Solo en esta hoja';
  const bVarias = document.createElement('button');
  bVarias.className = 'modal-confirm' + (opts.peligro ? ' danger' : '');
  acciones.appendChild(bVolver); acciones.appendChild(bSolo); acciones.appendChild(bVarias);

  const cajas = panel.querySelectorAll('input[data-hoja]');
  const marcadas = function () {
    const res = [];
    cajas.forEach(function (c) { if (c.checked) { const p = c.dataset.hoja.split('|'); res.push({ dia: p[0], nave: p[1] }); } });
    return res;
  };
  const refrescar = function () {
    const n = marcadas().length;
    bVarias.disabled = !n;
    bVarias.textContent = (opts.botonVarias || 'Aplicar también en') + (n ? ' ' + n + (n === 1 ? ' hoja más' : ' hojas más') : '…');
  };
  cajas.forEach(function (c) { c.addEventListener('change', refrescar); });
  panel.querySelectorAll('[data-rapido]').forEach(function (b) {
    b.onclick = function () {
      const modo = b.dataset.rapido;
      cajas.forEach(function (c) {
        if (c.disabled) return;
        c.checked = modo === 'ambas' || (modo === 'nave' && c.dataset.hoja.split('|')[1] === HN.nave);
      });
      refrescar();
    };
  });
  refrescar();

  const quitarPanel = function () {
    panel.remove(); bVolver.remove(); bSolo.remove(); bVarias.remove();
    titulo.textContent = tituloAntes;
    ocultos.forEach(function (el) { el.style.display = ''; });
  };
  bVolver.onclick = quitarPanel;
  const elegir = function (lista, btn) {
    bVolver.disabled = bSolo.disabled = bVarias.disabled = true;
    btn.textContent = 'Guardando…';
    // Si algo falla, se vuelve al formulario con el error a la vista.
    opts.onElegir(lista, function (err) {
      quitarPanel();
      if (err) hnErrorModal_(err);
    });
  };
  bSolo.onclick = function () { elegir([], bSolo); };
  bVarias.onclick = function () { elegir(marcadas(), bVarias); };
}

/** Mensaje tras guardar con "aplicar en otras hojas". */
function hnAvisoResultado_(base, r) {
  let msg = base;
  if (r && r.anadidasOtras) msg += ' (y en ' + r.anadidasOtras + (r.anadidasOtras === 1 ? ' hoja más' : ' hojas más') + ')';
  mostrarToast(msg);
  const bloq = (r && r.bloqueadas) || [];
  if (bloq.length) {
    appConfirm('No se ha cambiado en todas',
      'Estas hojas las estaba editando otra persona y no se han tocado: ' +
      bloq.map(function (b) { return b.nave + ' · ' + hnDiaLargo_(b.dia) + (b.por ? ' (' + b.por + ')' : ''); }).join(', ') +
      '. Cámbialas cuando terminen.', function () {});
  }
}

/* ---------------- PANTALLA ---------------- */

function renderAlmacenHojaNotas() {
  const cont = document.getElementById('almacen-contenido');
  if (!cont) return;
  if (!HN.dia) HN.dia = hnDiaPorDefecto_();
  if (!HN.nave) HN.nave = hnNavePorDefecto_();
  hnSalirEdicion_();
  HN.filtro = '';
  HN.datos = null;

  cont.innerHTML =
    '<div class="vista-card hn-card">' +
      '<div class="vista-card-header">' +
        '<h2>Hoja de notas <span class="hn-sub" id="hn-sub"></span></h2>' +
        '<div class="vista-card-header-acciones">' +
          '<button type="button" class="hn-btn" id="hn-btn-imprimir" title="Imprimir la hoja de esta nave y este día">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' +
            'Imprimir</button>' +
          '<button type="button" class="hn-btn hn-solo-editor" id="hn-btn-festivos" title="Columnas de festivos (horario de las tiendas ese día)">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
            'Festivos</button>' +
          '<button type="button" class="hn-btn hn-solo-editor" id="hn-btn-ocultas" title="Las tiendas y secciones marcadas como «no sale» (y las dadas de baja)">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
            '<span>Ver tiendas ocultas</span></button>' +
          '<button type="button" class="hn-btn hn-solo-editor" id="hn-btn-copiar" title="Sustituir esta hoja por una copia de otra">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
            'Copiar de otra hoja</button>' +
          '<button type="button" class="hn-btn hn-btn-editar hn-solo-editor" id="hn-btn-editar">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>' +
            '<span>Editar</span></button>' +
        '</div>' +
      '</div>' +
      '<div class="hn-barra">' +
        '<div class="plantilla-dias hn-dias" id="hn-dias">' +
          HN_DIAS.map(function (d) {
            return '<button type="button" data-dia="' + d.id + '" title="' + d.largo + '">' + d.corto + '</button>';
          }).join('') +
        '</div>' +
        '<div class="hn-naves" id="hn-naves">' +
          HN_NAVES.map(function (n) { return '<button type="button" data-nave="' + n + '">' + n + '</button>'; }).join('') +
        '</div>' +
        '<div class="emails-config-busqueda hn-buscar">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
          '<input type="text" id="hn-buscar" placeholder="Buscar tienda, sección o grupo…">' +
        '</div>' +
      '</div>' +
      '<div id="hn-avisos"></div>' +
      '<div id="hn-hoja" class="hn-hoja"><div class="loader"><span class="spinner-navy"></span><div>Cargando…</div></div></div>' +
    '</div>';

  document.querySelectorAll('#hn-dias button').forEach(function (b) {
    b.onclick = function () { if (HN.dia !== b.dataset.dia) { hnSalirEdicion_(); HN.dia = b.dataset.dia; hnCargar_(); } };
  });
  document.querySelectorAll('#hn-naves button').forEach(function (b) {
    b.onclick = function () { if (HN.nave !== b.dataset.nave) { hnSalirEdicion_(); HN.nave = b.dataset.nave; hnCargar_(); } };
  });
  document.getElementById('hn-btn-imprimir').onclick = hnImprimir_;
  document.getElementById('hn-btn-editar').onclick = function () {
    if (HN.editar) { hnSalirEdicion_(); hnCargar_(true); }
    else hnEntrarEdicion_(false);
  };
  document.getElementById('hn-btn-festivos').onclick = hnModalFestivos_;
  document.getElementById('hn-btn-copiar').onclick = hnModalCopiar_;
  document.getElementById('hn-btn-ocultas').onclick = function () {
    HN.verOcultas = !HN.verOcultas;
    hnPintar_();
  };

  let temporizador = null;
  document.getElementById('hn-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizador);
    const v = e.target.value;
    temporizador = setTimeout(function () { HN.filtro = v.trim().toLowerCase(); hnPintarHoja_(); }, 180);
  });

  hnCargar_();
}

function hnMarcarBarra_() {
  document.querySelectorAll('#hn-dias button').forEach(function (b) { b.classList.toggle('activo', b.dataset.dia === HN.dia); });
  document.querySelectorAll('#hn-naves button').forEach(function (b) { b.classList.toggle('activo', b.dataset.nave === HN.nave); });
}

/** Pide la hoja al servidor. `silencioso`: sin el "Cargando…" (tras guardar). */
function hnCargar_(silencioso) {
  hnMarcarBarra_();
  const id = ++HN.peticion;
  const contHoja = document.getElementById('hn-hoja');
  if (!silencioso && contHoja) contHoja.innerHTML = '<div class="loader"><span class="spinner-navy"></span><div>Cargando…</div></div>';
  return hnRpc_('get_hoja_notas', { p_dia: HN.dia, p_nave: HN.nave })
    .then(function (datos) {
      if (id !== HN.peticion) return;
      HN.datos = datos;
      if (!datos.puedeEditar && HN.editar) hnSalirEdicion_();
      hnPintar_();
      hnVigilar_();
    })
    .catch(function (err) {
      if (id !== HN.peticion) return;
      const c = document.getElementById('hn-hoja');
      if (c) c.innerHTML = '<div class="hn-vacio">No se ha podido cargar la hoja. Vuelve a intentarlo.</div>';
      mostrarErrorServidor(err);
    });
}

function hnPintar_() {
  const d = HN.datos;
  if (!d) return;
  const card = document.querySelector('.hn-card');
  if (card) {
    card.classList.toggle('hn-puede-editar', !!d.puedeEditar);
    card.classList.toggle('hn-editando', HN.editar);
  }
  const btnEditar = document.getElementById('hn-btn-editar');
  if (btnEditar) btnEditar.querySelector('span').textContent = HN.editar ? 'Terminar de editar' : 'Editar';
  const btnOcultas = document.getElementById('hn-btn-ocultas');
  if (btnOcultas) {
    const n = hnContarOcultas_();
    btnOcultas.querySelector('span').textContent = HN.verOcultas
      ? 'Esconder ocultas'
      : 'Ver tiendas ocultas' + (n ? ' (' + n + ')' : '');
    btnOcultas.classList.toggle('activo', HN.verOcultas);
    btnOcultas.disabled = !n && !HN.verOcultas;
  }

  const sub = document.getElementById('hn-sub');
  if (sub) {
    let txt = d.nave + ' · ' + hnDiaLargo_(d.dia).toUpperCase();
    if (d.actualizadoEn) {
      txt += ' · actualizada ' + hnFechaHora_(d.actualizadoEn) + (d.actualizadoPor ? ' por ' + d.actualizadoPor : '');
    }
    sub.textContent = txt;
  }
  hnPintarAvisos_();
  hnPintarHoja_();
}

/** Tiendas y secciones que no salen en la hoja ("no sale" o dadas de baja). */
function hnContarOcultas_() {
  let n = 0;
  (HN.datos && HN.datos.secciones || []).forEach(function (s) {
    if (!s.activa) n++;
    (s.lineas || []).forEach(function (l) { if (!s.activa || !l.activa || l.baja) n++; });
  });
  return n;
}
/** ¿Se pintan las ocultas? Solo en modo editar y con «Ver tiendas ocultas». */
function hnMostrarOcultas_() {
  return HN.editar && HN.verOcultas;
}

function hnFechaHora_(iso) {
  const f = new Date(iso);
  if (isNaN(f)) return '';
  return pad2(f.getDate()) + '/' + pad2(f.getMonth() + 1) + ' ' + pad2(f.getHours()) + ':' + pad2(f.getMinutes());
}

/* ---------------- AVISOS (tiendas nuevas / dadas de baja) ---------------- */

function hnLineasDeBaja_() {
  const res = [];
  (HN.datos.secciones || []).forEach(function (s) {
    (s.lineas || []).forEach(function (l) { if (l.baja) res.push(l); });
  });
  return res;
}

function hnPintarAvisos_() {
  const cont = document.getElementById('hn-avisos');
  if (!cont) return;
  const d = HN.datos;
  let html = '';
  if (d.bloqueo && !d.bloqueo.mio) {
    html +=
      '<div class="hn-aviso hn-aviso-editando">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
        '<span><b>' + escapeHtml(d.bloqueo.por || 'Otra persona') + '</b> está editando esta hoja' +
        (d.bloqueo.desde ? ' desde las ' + escapeHtml(hnFechaHora_(d.bloqueo.desde).split(' ')[1]) : '') +
        '. Se actualiza sola cada minuto.</span>' +
      '</div>';
  }
  if (!d.puedeEditar) { cont.innerHTML = html; return; }
  const nuevas = d.sinColocar || [];
  if (nuevas.length) {
    html +=
      '<div class="hn-aviso hn-aviso-nueva">' +
        '<b>' + nuevas.length + (nuevas.length === 1 ? ' tienda nueva no está' : ' tiendas nuevas no están') + ' en ninguna hoja de notas.</b> ' +
        'Pulsa una para colocarla en esta hoja:' +
        '<div class="hn-chips">' +
          nuevas.map(function (t) {
            return '<button type="button" class="hn-chip" data-colocar="' + t.num + '">' + escapeHtml(t.nombre) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
  }
  const bajas = hnLineasDeBaja_();
  if (bajas.length) {
    const nombres = [];
    bajas.forEach(function (l) { if (nombres.indexOf(l.nombre) === -1) nombres.push(l.nombre); });
    html +=
      '<div class="hn-aviso hn-aviso-baja">' +
        '<b>' + nombres.length + (nombres.length === 1 ? ' tienda de esta hoja ya no existe' : ' tiendas de esta hoja ya no existen') + '</b> ' +
        '(dadas de baja en la lista de tiendas). Ya no salen en la hoja ni al imprimir: ' +
        '<span class="hn-aviso-nombres">' + nombres.map(escapeHtml).join(', ') + '</span>. ' +
        '<button type="button" class="hn-link" id="hn-quitar-bajas">Quitarlas de todas las hojas</button>' +
      '</div>';
  }
  cont.innerHTML = html;
  cont.querySelectorAll('[data-colocar]').forEach(function (b) {
    b.onclick = function () {
      const num = Number(b.dataset.colocar);
      if (HN.editar) { hnModalLinea_(null, null, num); return; }
      hnBloqueo_('tomar').then(function (r) {
        if (!r || !r.ok) { hnModalBloqueada_(r || {}); return; }
        HN.editar = true;
        HN.bloqueoDe = { dia: HN.dia, nave: HN.nave };
        clearInterval(HN.latido);
        HN.latido = setInterval(hnLatido_, HN_LATIDO_MS);
        hnPintar_();
        hnModalLinea_(null, null, num);
      }).catch(mostrarErrorServidor);
    };
  });
  const btnBajas = document.getElementById('hn-quitar-bajas');
  if (btnBajas) {
    btnBajas.onclick = function () {
      appConfirm('Quitar tiendas dadas de baja', 'Se quitarán de TODAS las hojas de notas (GAITE y PTA, todos los días) las líneas de tiendas que ya no existen.', function () {
        hnAccion_('quitar_bajas', {}).then(function (r) {
          mostrarToast('Hecho: ' + (r && r.anadidasOtras ? r.anadidasOtras : 0) + ' líneas quitadas');
          hnCargar_(true);
        }).catch(mostrarErrorServidor);
      }, true);
    };
  }
}

/* ---------------- TABLA ---------------- */

function hnHora_(transito) {
  if (!transito || transito <= 1) return '';
  return String(transito * 24);
}

function hnLineaCoincide_(l, sec, filtro) {
  if (!filtro) return true;
  const txt = [l.nombre, l.grupo, l.grupo2, l.grupoNotas, l.agencia, l.poblacion, sec.nombre]
    .concat((l.filas || []).map(function (f) { return [f.planta, f.ref, f.obs].join(' '); }))
    .join(' ').toLowerCase();
  return txt.indexOf(filtro) !== -1;
}

/** HTML de la tabla completa. opts: { editar, imprimir, filtro } */
function hnTablaHtml_(datos, opts) {
  const fest = datos.festivos || [];
  const editar = !!opts.editar;
  const nCols = fest.length + 14 + (editar ? 1 : 0);

  let html = '<table class="hn-tabla' + (opts.imprimir ? ' hn-tabla-print' : '') + '">' +
    '<colgroup>' +
      fest.map(function () { return '<col class="hn-c-fest">'; }).join('') +
      '<col class="hn-c-ab"><col class="hn-c-dom"><col class="hn-c-grupo"><col class="hn-c-g2">' +
      '<col class="hn-c-tienda"><col class="hn-c-hora"><col class="hn-c-age"><col class="hn-c-pob">' +
      '<col class="hn-c-planta"><col class="hn-c-ref"><col class="hn-c-obs">' +
      '<col class="hn-c-x"><col class="hn-c-x"><col class="hn-c-x">' +
      (editar ? '<col class="hn-c-acc">' : '') +
    '</colgroup>' +
    '<thead><tr>' +
      fest.map(function (f) { return '<th class="hn-th-fest" title="Horario festivo">' + escapeHtml(f.etiqueta) + '</th>'; }).join('') +
      '<th title="Grupo de notas">A</th><th title="Apertura en domingo">DOM</th><th>GRUPO</th><th title="Grupo">C</th>' +
      '<th class="hn-th-tienda">TIENDA</th><th title="Tránsito en horas">HORA</th><th>AGE</th><th>POBLACIÓN</th>' +
      '<th>PLANTAS</th><th>REFUERZOS</th><th>OBSERVACIONES</th><th>1</th><th>2</th><th>3</th>' +
      (editar ? '<th></th>' : '') +
    '</tr></thead>';

  // Lo que no sale ("no sale" o dada de baja) solo se ve en modo editar
  // y pulsando «Ver tiendas ocultas».
  const verOcultas = editar && !!opts.verOcultas;
  let pintadas = 0;
  (datos.secciones || []).forEach(function (sec, iSec) {
    if (!sec.activa && !verOcultas) return;
    const lineasTodas = sec.lineas || [];
    const nombreSecCoincide = opts.filtro && (sec.nombre || '').toLowerCase().indexOf(opts.filtro) !== -1;
    const lineas = lineasTodas.filter(function (l) {
      if (!verOcultas && (!l.activa || l.baja)) return false;
      return nombreSecCoincide || hnLineaCoincide_(l, sec, opts.filtro);
    });
    if (opts.filtro && !lineas.length && !nombreSecCoincide) return;
    // Sección de título de bloque (CANARIAS, MALAGA...): no tiene tiendas.
    const esBloque = !lineasTodas.length;
    if (!editar && !esBloque && !lineas.length) return;
    pintadas++;

    const color = hnColorDe_(sec);
    html += '<tbody class="hn-sec' + (sec.activa ? '' : ' hn-oculta') + (esBloque ? ' hn-sec-bloque' : '') + (color ? ' hn-color-' + color : '') + '" data-seccion="' + sec.id + '">';
    if (esBloque) {
      html += '<tr class="hn-fila-bloque"><td colspan="' + (nCols - (editar ? 1 : 0)) + '">' +
        hnTextoSeccion_(sec) + '</td>' + (editar ? '<td class="hn-acc">' + hnAccSeccionHtml_(iSec) + '</td>' : '') + '</tr>';
    } else {
      html += '<tr class="hn-fila-sec"><td colspan="' + (nCols - 3 - (editar ? 1 : 0)) + '"><div class="hn-sec-caja">' + hnTextoSeccion_(sec) + '</div></td>' +
        (sec.casillas ? '<td class="hn-x">1</td><td class="hn-x">2</td><td class="hn-x">3</td>' : '<td></td><td></td><td></td>') +
        (editar ? '<td class="hn-acc">' + hnAccSeccionHtml_(iSec) + '</td>' : '') +
        '</tr>';
    }
    lineas.forEach(function (l, iLin) {
      html += hnFilasLineaHtml_(l, fest, editar, iLin, lineas.length);
    });
    if (editar && !esBloque) {
      html += '<tr class="hn-fila-anadir"><td colspan="' + nCols + '"><button type="button" class="hn-link" data-anadir="' + sec.id + '">+ Añadir tienda a ' + escapeHtml(sec.nombre || 'esta sección') + '</button></td></tr>';
    }
    html += '</tbody>';
  });
  html += '</table>';

  if (!pintadas) {
    return '<div class="hn-vacio">' + (opts.filtro ? 'No hay nada que coincida con la búsqueda.' : 'Esta hoja está vacía.') + '</div>' +
      (editar && !opts.filtro ? '<button type="button" class="hn-link" data-nueva-seccion="1">+ Añadir sección</button>' : '');
  }
  return html;
}

function hnTextoSeccion_(sec) {
  return '<span class="hn-sec-nombre">' + escapeHtml(sec.nombre || '(sin nombre)') + '</span>' +
    ((sec.instruccion || sec.nota)
      ? '<span class="hn-sec-der">' +
          (sec.instruccion ? '<span class="hn-sec-instr">' + escapeHtml(sec.instruccion) + '</span>' : '') +
          (sec.nota ? '<span class="hn-sec-nota">' + escapeHtml(sec.nota) + '</span>' : '') +
        '</span>'
      : '') +
    (sec.activa ? '' : '<span class="hn-badge hn-badge-oculta">no sale</span>');
}

const HN_SVG_ARRIBA_ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
const HN_SVG_ABAJO_ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
const HN_SVG_LAPIZ_ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const HN_SVG_MAS_ = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>';

function hnAccSeccionHtml_(iSec) {
  return '<span class="hn-acc-grupo">' +
    '<button type="button" title="Subir sección" data-sec-mover="-1" data-i="' + iSec + '">' + HN_SVG_ARRIBA_ + '</button>' +
    '<button type="button" title="Bajar sección" data-sec-mover="1" data-i="' + iSec + '">' + HN_SVG_ABAJO_ + '</button>' +
    '<button type="button" title="Editar sección" data-sec-editar="' + iSec + '">' + HN_SVG_LAPIZ_ + '</button>' +
    '<button type="button" title="Añadir una sección debajo" data-sec-nueva="' + iSec + '">' + HN_SVG_MAS_ + '</button>' +
  '</span>';
}

function hnFilasLineaHtml_(l, fest, editar, iLin, nLin) {
  const filas = (l.filas && l.filas.length) ? l.filas : [{}];
  const clases = 'hn-fila' + (l.activa ? '' : ' hn-oculta') + (l.baja ? ' hn-baja' : '') + (editar ? ' hn-clicable' : '');
  let html = '';
  filas.forEach(function (f, i) {
    html += '<tr class="' + clases + (i ? ' hn-fila-extra' : ' hn-fila-tienda') + '" data-linea="' + l.id + '">';
    if (i === 0) {
      fest.forEach(function (fe) {
        const v = (l.festivos || {})[fe.id] || '';
        if (editar && l.num) {
          html += '<td class="hn-fest"><input type="text" class="hn-fest-input" data-fest="' + fe.id + '" data-num="' + l.num + '" value="' + escapeAttr(v) + '" maxlength="12"></td>';
        } else {
          html += '<td class="hn-fest' + (v === 'CIERRE' ? ' hn-fest-cierre' : '') + '">' + escapeHtml(v) + '</td>';
        }
      });
      // Colores como en el Excel: DOM verde si abre (SI/OC...) y
      // anaranjado si está vacío; la "C" en rojo.
      html +=
        '<td class="hn-c hn-ab">' + escapeHtml(l.grupoNotas || '') + '</td>' +
        '<td class="hn-c hn-dom' + (l.dom ? ' hn-dom-si' : ' hn-dom-vacio') + '">' + escapeHtml(l.dom || '') + '</td>' +
        '<td class="hn-c hn-grupo">' + escapeHtml(l.grupo || '') + '</td>' +
        '<td class="hn-c hn-g2' + (l.grupo2 ? ' hn-lleno' : '') + '">' + escapeHtml(l.grupo2 || '') + '</td>' +
        '<td class="hn-tienda">' + escapeHtml(l.nombre || '') +
          (l.baja ? ' <span class="hn-badge hn-badge-baja">dada de baja</span>' : '') +
          (!l.activa ? ' <span class="hn-badge hn-badge-oculta">no sale</span>' : '') +
        '</td>' +
        '<td class="hn-c hn-hora">' + hnHora_(l.transito) + '</td>' +
        '<td class="hn-c hn-age">' + escapeHtml(l.agencia || '') + '</td>' +
        '<td class="hn-pob">' + escapeHtml(l.poblacion || '') + '</td>';
    } else {
      html += fest.map(function () { return '<td class="hn-fest"></td>'; }).join('') +
        '<td class="hn-ab"></td><td class="hn-dom"></td><td class="hn-grupo"></td><td class="hn-g2"></td><td class="hn-tienda"></td><td class="hn-hora"></td><td class="hn-age"></td><td class="hn-pob"></td>';
    }
    // Color del renglón (opcional): pinta sus casillas de planta, refuerzo y observación.
    const rc = f.color ? ' hn-rc hn-rc-' + f.color : '';
    html +=
      '<td class="hn-planta' + (f.planta ? ' hn-lleno' : '') + rc + '">' + escapeHtml(f.planta || '') + '</td>' +
      '<td class="hn-ref' + (f.ref ? ' hn-lleno' : '') + rc + '">' + escapeHtml(f.ref || '') + '</td>' +
      '<td class="hn-obs' + (f.obs ? ' hn-lleno' : '') + rc + '">' + escapeHtml(f.obs || '') + '</td>' +
      '<td class="hn-x"></td><td class="hn-x"></td><td class="hn-x"></td>';
    if (editar) {
      html += '<td class="hn-acc">' + (i === 0
        ? '<span class="hn-acc-grupo">' +
            '<button type="button" title="Subir" data-lin-mover="-1"' + (iLin === 0 ? ' disabled' : '') + '>' + HN_SVG_ARRIBA_ + '</button>' +
            '<button type="button" title="Bajar" data-lin-mover="1"' + (iLin === nLin - 1 ? ' disabled' : '') + '>' + HN_SVG_ABAJO_ + '</button>' +
          '</span>'
        : '') + '</td>';
    }
    html += '</tr>';
  });
  return html;
}

function hnPintarHoja_() {
  const cont = document.getElementById('hn-hoja');
  if (!cont || !HN.datos) return;
  cont.innerHTML =
    (HN.editar ? '<div class="hn-ayuda-editar">Pulsa una tienda para editarla. Las flechas cambian el orden; el lápiz de cada sección la edita (también su color) y el + añade una sección debajo. Al guardar un cambio te pregunto si lo quieres también en otros días o en la otra nave. Los horarios de festivo se escriben directamente en su casilla.</div>' : '') +
    '<div class="hn-scroll">' + hnTablaHtml_(HN.datos, { editar: HN.editar, verOcultas: hnMostrarOcultas_(), filtro: HN.filtro }) + '</div>' +
    (HN.editar ? '<div class="hn-pie-editar"><button type="button" class="hn-link" data-nueva-seccion="1">+ Añadir sección al final</button></div>' : '');
  if (HN.editar) hnVincularEdicion_(cont);
  hnAjustarAltoScroll_();
}

/* El scroll va dentro de la tabla (no en toda la página), con la cabecera
 * TIENDA / HORA / AGE... siempre fija arriba: la caja de la tabla ocupa lo
 * que queda de pantalla por debajo de ella. */
function hnAjustarAltoScroll_() {
  const sc = document.querySelector('#hn-hoja .hn-scroll');
  if (!sc) return;
  const top = sc.getBoundingClientRect().top + window.scrollY;
  const pie = document.querySelector('#hn-hoja .hn-pie-editar');
  const reservado = (pie ? pie.offsetHeight + 12 : 0) + 18;
  sc.style.maxHeight = Math.max(260, window.innerHeight - top - reservado) + 'px';
}
window.addEventListener('resize', function () {
  if (ESTADO && ESTADO.vista === 'almacen') hnAjustarAltoScroll_();
});

/* ---------------- EDICIÓN EN LA TABLA ---------------- */

function hnBuscarSeccion_(id) {
  return (HN.datos.secciones || []).find(function (s) { return s.id === id; }) || null;
}
function hnBuscarLinea_(id) {
  let res = null;
  (HN.datos.secciones || []).some(function (s) {
    const l = (s.lineas || []).find(function (x) { return x.id === id; });
    if (l) { res = { linea: l, seccion: s }; return true; }
    return false;
  });
  return res;
}

function hnVincularEdicion_(cont) {
  cont.querySelectorAll('tr.hn-clicable').forEach(function (tr) {
    tr.addEventListener('click', function (e) {
      if (e.target.closest('button, input')) return;
      const r = hnBuscarLinea_(tr.dataset.linea);
      if (r) hnModalLinea_(r.seccion.id, r.linea);
    });
  });
  cont.querySelectorAll('[data-lin-mover]').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      const tr = b.closest('tr');
      hnMoverLinea_(tr.dataset.linea, Number(b.dataset.linMover));
    };
  });
  cont.querySelectorAll('[data-sec-mover]').forEach(function (b) {
    b.onclick = function () { hnMoverSeccion_(Number(b.dataset.i), Number(b.dataset.secMover)); };
  });
  cont.querySelectorAll('[data-sec-editar]').forEach(function (b) {
    b.onclick = function () { hnModalSeccion_(HN.datos.secciones[Number(b.dataset.secEditar)], null); };
  });
  cont.querySelectorAll('[data-sec-nueva]').forEach(function (b) {
    b.onclick = function () { hnModalSeccion_(null, HN.datos.secciones[Number(b.dataset.secNueva)].id); };
  });
  cont.querySelectorAll('[data-nueva-seccion]').forEach(function (b) {
    b.onclick = function () { hnModalSeccion_(null, null); };
  });
  cont.querySelectorAll('[data-anadir]').forEach(function (b) {
    b.onclick = function () { hnModalLinea_(b.dataset.anadir, null, null); };
  });
  cont.querySelectorAll('.hn-fest-input').forEach(function (inp) {
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    inp.addEventListener('input', function () { inp.value = inp.value.toUpperCase(); });
    inp.addEventListener('change', function () {
      const valor = inp.value.trim().toUpperCase();
      inp.classList.add('guardando');
      hnAccion_('festivo_valor', { festivoId: inp.dataset.fest, num: Number(inp.dataset.num), valor: valor })
        .then(function () {
          inp.classList.remove('guardando');
          // El horario es de la tienda: se actualiza en todas sus líneas.
          (HN.datos.secciones || []).forEach(function (s) {
            (s.lineas || []).forEach(function (l) {
              if (l.num === Number(inp.dataset.num)) {
                l.festivos = l.festivos || {};
                if (valor) l.festivos[inp.dataset.fest] = valor; else delete l.festivos[inp.dataset.fest];
              }
            });
          });
          document.querySelectorAll('.hn-fest-input[data-fest="' + inp.dataset.fest + '"][data-num="' + inp.dataset.num + '"]').forEach(function (o) {
            if (o !== inp) o.value = valor;
          });
        })
        .catch(function (err) { inp.classList.remove('guardando'); mostrarErrorServidor(err); });
    });
  });
}

function hnMoverLinea_(lineaId, dir) {
  const r = hnBuscarLinea_(lineaId);
  if (!r) return;
  const lista = r.seccion.lineas;
  const i = lista.indexOf(r.linea);
  let j = i + dir;
  // Con las ocultas escondidas, se salta por encima de ellas (si no, la
  // flecha parecería no hacer nada).
  if (!hnMostrarOcultas_()) {
    while (j >= 0 && j < lista.length && (!lista[j].activa || lista[j].baja)) j += dir;
  }
  if (j < 0 || j >= lista.length) return;
  lista.splice(i, 1);
  lista.splice(j, 0, r.linea);
  hnPintarHoja_();
  hnAccion_('linea_mover', { id: lineaId, seccionId: r.seccion.id, ids: lista.map(function (l) { return l.id; }) })
    .catch(function (err) { mostrarErrorServidor(err); hnCargar_(true); });
}

function hnMoverSeccion_(i, dir) {
  const secs = HN.datos.secciones;
  let j = i + dir;
  if (!hnMostrarOcultas_()) {
    while (j >= 0 && j < secs.length && !secs[j].activa) j += dir;
  }
  if (j < 0 || j >= secs.length) return;
  const s = secs.splice(i, 1)[0];
  secs.splice(j, 0, s);
  hnPintarHoja_();
  hnAccion_('secciones_ordenar', { dia: HN.dia, nave: HN.nave, ids: secs.map(function (x) { return x.id; }) })
    .catch(function (err) { mostrarErrorServidor(err); hnCargar_(true); });
}

/* ---------------- MODALES ---------------- */

function hnAbrirModal_(titulo, htmlCuerpo, htmlAcciones, ancho) {
  const box = document.getElementById('modal-box');
  ['ancho', 'medio', 'peligro', 'usuario-form'].forEach(function (c) { box.classList.remove(c); });
  if (ancho) box.classList.add('ancho');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';
  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML = htmlCuerpo;
  document.getElementById('modal-actions').innerHTML = htmlAcciones;
  document.getElementById('modal-overlay').style.display = 'flex';
  const cancelar = document.getElementById('modal-cancel-btn');
  if (cancelar) cancelar.onclick = cerrarModal;
  return custom;
}

function hnErrorModal_(err) {
  const custom = document.getElementById('modal-custom');
  let aviso = document.getElementById('hn-modal-error');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'hn-modal-error';
    aviso.className = 'hn-modal-error';
    custom.appendChild(aviso);
  }
  aviso.textContent = (err && err.message) ? err.message : String(err || 'No se ha podido guardar.');
}

function hnBotonOcupado_(btn, texto) {
  btn.disabled = true;
  btn.dataset.textoOriginal = btn.textContent;
  btn.textContent = texto;
}
function hnBotonLibre_(btn) {
  btn.disabled = false;
  if (btn.dataset.textoOriginal) btn.textContent = btn.dataset.textoOriginal;
}

function hnInputMayus_(inp) {
  inp.addEventListener('input', function () {
    const pos = inp.selectionStart;
    inp.value = inp.value.toUpperCase();
    try { inp.setSelectionRange(pos, pos); } catch (e) { /* tipos sin selección */ }
  });
}

/** Editor de una tienda de la hoja. seccionId: sección por defecto (null
 *  si viene del aviso de tiendas nuevas). linea: null para añadir.
 *  numInicial: tienda ya elegida (aviso de tiendas nuevas). */
function hnModalLinea_(seccionId, linea, numInicial) {
  const d = HN.datos;
  const nueva = !linea;
  const tiendas = d.tiendas || [];
  const secciones = (d.secciones || []).filter(function (s) { return (s.lineas || []).length || s.id === seccionId || !nueva; });
  const fest = d.festivos || [];
  const tiendaIni = numInicial ? tiendas.find(function (t) { return t.num === numInicial; }) : null;
  const l = linea || {
    num: tiendaIni ? tiendaIni.num : null, nombre: tiendaIni ? tiendaIni.nombre : '',
    agencia: tiendaIni ? tiendaIni.agencia : '', poblacion: tiendaIni ? tiendaIni.poblacion : '',
    grupoNotas: '', dom: '', grupo: '', grupo2: '', filas: [], activa: true, festivos: {}
  };
  const secActual = seccionId || ((secciones.find(function (s) { return (s.lineas || []).length; }) || {}).id);

  const opcionesSecciones = (d.secciones || []).map(function (s) {
    return '<option value="' + s.id + '"' + (s.id === secActual ? ' selected' : '') + '>' + escapeHtml(s.nombre || '(sin nombre)') + (s.instruccion ? ' — ' + escapeHtml(s.instruccion) : '') + '</option>';
  }).join('');

  const otrasHojas = [];
  HN_DIAS.forEach(function (di) {
    HN_NAVES.forEach(function (n) {
      if (di.id === HN.dia && n === HN.nave) return;
      otrasHojas.push({ dia: di.id, nave: n, corto: di.corto });
    });
  });

  const cuerpo =
    (nueva
      ? '<div class="modal-campo">' +
          '<label for="hn-l-tienda">Tienda</label>' +
          '<input type="text" id="hn-l-tienda" list="hn-l-tiendas" placeholder="Escribe el número o el nombre…" value="' + escapeAttr(l.nombre || '') + '" autocomplete="off">' +
          '<datalist id="hn-l-tiendas">' + tiendas.map(function (t) { return '<option value="' + escapeAttr(t.nombre) + '">'; }).join('') + '</datalist>' +
          '<span class="modal-campo-ayuda">Elige una de la lista de tiendas (el nombre y el tránsito se mantienen solos).</span>' +
        '</div>'
      : '<div class="hn-l-titulo">' + escapeHtml(l.nombre) +
          (l.transito ? ' <span class="hn-badge">' + (l.transito * 24) + ' h</span>' : '') +
          (l.baja ? ' <span class="hn-badge hn-badge-baja">dada de baja</span>' : '') +
        '</div>') +
    '<div class="modal-campo">' +
      '<label for="hn-l-seccion">Sección</label>' +
      '<select id="hn-l-seccion">' + opcionesSecciones + '</select>' +
    '</div>' +
    '<div class="hn-subtitulo">De la tienda <span>(igual en todas las hojas)</span></div>' +
    '<div class="modal-campo-fila-2">' +
      '<div class="modal-campo"><label for="hn-l-age">Agencia</label><input type="text" id="hn-l-age" maxlength="10" value="' + escapeAttr(l.agencia || '') + '"></div>' +
      '<div class="modal-campo"><label for="hn-l-pob">Población</label><input type="text" id="hn-l-pob" maxlength="40" value="' + escapeAttr(l.poblacion || '') + '"></div>' +
    '</div>' +
    '<div class="hn-subtitulo">De esta hoja <span>(' + escapeHtml(HN.nave + ' · ' + hnDiaLargo_(HN.dia)) + ')</span></div>' +
    '<div class="hn-fila-4">' +
      '<div class="modal-campo"><label for="hn-l-ab" title="Grupo de notas">A (grupo notas)</label><input type="text" id="hn-l-ab" maxlength="6" value="' + escapeAttr(l.grupoNotas || '') + '"></div>' +
      '<div class="modal-campo"><label for="hn-l-dom" title="Apertura en domingo">DOM</label><input type="text" id="hn-l-dom" maxlength="14" value="' + escapeAttr(l.dom || '') + '"></div>' +
      '<div class="modal-campo"><label for="hn-l-grupo">Grupo</label><input type="text" id="hn-l-grupo" maxlength="8" placeholder="G-00" value="' + escapeAttr(l.grupo || '') + '"></div>' +
      '<div class="modal-campo"><label for="hn-l-g2">C</label><input type="text" id="hn-l-g2" maxlength="6" value="' + escapeAttr(l.grupo2 || '') + '"></div>' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label>Plantas, refuerzos y observaciones</label>' +
      '<div class="hn-filas-ed" id="hn-l-filas"></div>' +
      '<button type="button" class="hn-link" id="hn-l-fila-mas">+ Añadir renglón</button>' +
      (nueva ? '<span class="modal-campo-ayuda">Si lo dejas vacío, se copian los que ya tenga la tienda en otra hoja.</span>' : '') +
    '</div>' +
    (fest.length && !nueva
      ? '<div class="hn-subtitulo">Horario festivo</div><div class="hn-fila-4">' +
          fest.map(function (fe) {
            return '<div class="modal-campo"><label>' + escapeHtml(fe.etiqueta) + '</label><input type="text" class="hn-l-fest" data-fest="' + fe.id + '" maxlength="12" placeholder="HH / CIERRE / 11:00" value="' + escapeAttr((l.festivos || {})[fe.id] || '') + '"></div>';
          }).join('') +
        '</div>'
      : '') +
    '<label class="hn-check"><input type="checkbox" id="hn-l-activa"' + (l.activa ? ' checked' : '') + '> Sale en la hoja (desmárcalo para dejarla guardada pero sin que salga)</label>' +
    (nueva
      ? '<div class="hn-subtitulo">Añadir también en <span>(en la sección con el mismo nombre)</span></div>' +
        '<div class="hn-otras-hojas">' +
          HN_NAVES.map(function (n) {
            return '<div class="hn-otras-fila"><b>' + n + '</b>' +
              otrasHojas.filter(function (o) { return o.nave === n; }).map(function (o) {
                return '<label><input type="checkbox" data-otra-dia="' + o.dia + '" data-otra-nave="' + o.nave + '">' + o.corto + '</label>';
              }).join('') + '</div>';
          }).join('') +
          '<button type="button" class="hn-link" id="hn-l-marcar-todas">Marcar todas</button>' +
        '</div>'
      : '<div class="hn-quitar">' +
          '<button type="button" class="hn-link hn-link-peligro" id="hn-l-quitar">Quitar tienda…</button>' +
        '</div>' +
        (l.num && hnHojasConTienda_(l.num).length
          ? '<p class="modal-campo-ayuda hn-l-ayuda-otras">Esta tienda está también en otras ' + hnHojasConTienda_(l.num).length + ' hojas: al guardar te preguntaré si quieres cambiarlo también allí.</p>'
          : ''));

  hnAbrirModal_(nueva ? 'Añadir tienda' : 'Editar tienda', cuerpo,
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">' + (nueva ? 'Añadir' : 'Guardar') + '</button>', true);

  ['hn-l-age', 'hn-l-pob', 'hn-l-ab', 'hn-l-dom', 'hn-l-grupo', 'hn-l-g2'].forEach(function (id) { hnInputMayus_(document.getElementById(id)); });
  document.querySelectorAll('.hn-l-fest').forEach(hnInputMayus_);

  // Renglones de plantas / refuerzos / observaciones
  const contFilas = document.getElementById('hn-l-filas');
  const pintarFila = function (f) {
    const div = document.createElement('div');
    div.className = 'hn-filas-ed-fila';
    div.dataset.color = f.color || '';
    div.innerHTML =
      '<input type="text" class="hn-f-planta" placeholder="Planta" maxlength="40" value="' + escapeAttr(f.planta || '') + '">' +
      '<input type="text" class="hn-f-ref" placeholder="Refuerzo" maxlength="80" value="' + escapeAttr(f.ref || '') + '">' +
      '<input type="text" class="hn-f-obs" placeholder="Observación" maxlength="120" value="' + escapeAttr(f.obs || '') + '">' +
      '<button type="button" class="hn-f-color" title="Color del renglón"></button>' +
      '<button type="button" class="hn-f-quitar" title="Quitar renglón">×</button>' +
      // Paleta del color del renglón (se abre con el botón de color)
      '<div class="hn-f-paleta" style="display:none">' +
        '<button type="button" class="hn-color-op hn-color-ninguno" data-color="">Sin color</button>' +
        HN_COLORES.map(function (c) {
          return '<button type="button" class="hn-color-op hn-muestra-' + c.id + '" data-color="' + c.id + '">' + c.nombre + '</button>';
        }).join('') +
      '</div>';
    div.querySelectorAll('input').forEach(hnInputMayus_);
    const btnColor = div.querySelector('.hn-f-color');
    const paleta = div.querySelector('.hn-f-paleta');
    const pintarColor = function () {
      const c = div.dataset.color;
      btnColor.className = 'hn-f-color' + (c ? ' hn-muestra-' + c : '');
      btnColor.title = 'Color del renglón: ' + (c ? (HN_COLORES.find(function (x) { return x.id === c; }) || {}).nombre : 'sin color');
      paleta.querySelectorAll('.hn-color-op').forEach(function (b) { b.classList.toggle('activo', b.dataset.color === c); });
    };
    btnColor.onclick = function () { paleta.style.display = paleta.style.display === 'none' ? '' : 'none'; };
    paleta.querySelectorAll('.hn-color-op').forEach(function (b) {
      b.onclick = function () { div.dataset.color = b.dataset.color; pintarColor(); paleta.style.display = 'none'; };
    });
    pintarColor();
    div.querySelector('.hn-f-quitar').onclick = function () { div.remove(); };
    contFilas.appendChild(div);
  };
  (l.filas || []).forEach(pintarFila);
  document.getElementById('hn-l-fila-mas').onclick = function () { pintarFila({}); };

  // Tienda elegida en "añadir": rellena agencia y población.
  let tiendaElegida = tiendaIni;
  const inpTienda = document.getElementById('hn-l-tienda');
  if (inpTienda) {
    inpTienda.addEventListener('input', function () {
      const v = inpTienda.value.trim().toUpperCase();
      const num = parseInt(v, 10);
      tiendaElegida = tiendas.find(function (t) { return t.nombre === v; }) ||
        (String(num) === v.replace(/^0+/, '') ? tiendas.find(function (t) { return t.num === num; }) : null) || null;
      if (tiendaElegida) {
        if (!document.getElementById('hn-l-age').value) document.getElementById('hn-l-age').value = tiendaElegida.agencia || '';
        if (!document.getElementById('hn-l-pob').value) document.getElementById('hn-l-pob').value = tiendaElegida.poblacion || '';
      }
    });
    if (!tiendaIni) setTimeout(function () { inpTienda.focus(); }, 50);
  }
  const btnMarcar = document.getElementById('hn-l-marcar-todas');
  if (btnMarcar) {
    btnMarcar.onclick = function () {
      const cajas = document.querySelectorAll('[data-otra-dia]');
      const todas = Array.prototype.every.call(cajas, function (c) { return c.checked; });
      cajas.forEach(function (c) { c.checked = !todas; });
    };
  }

  const leerFilas = function () {
    const res = [];
    contFilas.querySelectorAll('.hn-filas-ed-fila').forEach(function (div) {
      const f = {
        planta: div.querySelector('.hn-f-planta').value.trim(),
        ref: div.querySelector('.hn-f-ref').value.trim(),
        obs: div.querySelector('.hn-f-obs').value.trim()
      };
      const limpio = {};
      if (f.planta) limpio.planta = f.planta;
      if (f.ref) limpio.ref = f.ref;
      if (f.obs) limpio.obs = f.obs;
      if (Object.keys(limpio).length) {
        if (div.dataset.color) limpio.color = div.dataset.color;
        res.push(limpio);
      }
    });
    return res;
  };

  // Quitar: si la tienda está en otras hojas, se pregunta de cuáles.
  const bq = document.getElementById('hn-l-quitar');
  if (bq) {
    bq.onclick = function () {
      const otras = l.num ? hnHojasConTienda_(l.num) : [];
      const quitarEn = function (lista, alTerminar) {
        hnAccion_('linea_eliminar_en', { id: l.id, aplicarEn: lista })
          .then(function (r) { cerrarModal(); hnAvisoResultado_('Tienda quitada', r); hnCargar_(true); })
          .catch(function (err) { if (alTerminar) alTerminar(err); else mostrarErrorServidor(err); });
      };
      if (!otras.length) {
        appConfirm('Quitar tienda', 'Se quitará ' + l.nombre + ' de la hoja de ' + HN.nave + ' · ' + hnDiaLargo_(HN.dia) + '.', function () { quitarEn([]); }, true);
        return;
      }
      hnPreguntarHojas_({
        titulo: 'Quitar tienda',
        texto: '¿Quitar <b>' + escapeHtml(l.nombre) + '</b> solo de esta hoja o también de otras? Marca de qué otras hojas.',
        elegibles: otras,
        noElegibleTxt: 'no está en esa hoja',
        botonSolo: 'Solo de esta hoja',
        botonVarias: 'Quitar también de',
        peligro: true,
        onElegir: quitarEn
      });
    };
  }

  document.getElementById('modal-confirm-btn').onclick = function () {
    const btn = this;
    const seccionDestino = document.getElementById('hn-l-seccion').value;
    const filas = leerFilas();
    const datos = {
      grupoNotas: document.getElementById('hn-l-ab').value,
      dom: document.getElementById('hn-l-dom').value,
      grupo: document.getElementById('hn-l-grupo').value,
      grupo2: document.getElementById('hn-l-g2').value,
      activa: document.getElementById('hn-l-activa').checked
    };
    if (nueva) {
      if (!inpTienda.value.trim()) { inpTienda.focus(); return; }
      if (!tiendaElegida) { hnErrorModal_('Elige una tienda de la lista.'); inpTienda.focus(); return; }
      datos.seccionId = seccionDestino;
      datos.num = tiendaElegida.num;
      if (filas.length) datos.filas = filas;
      const otras = [];
      document.querySelectorAll('[data-otra-dia]').forEach(function (c) {
        if (c.checked) otras.push({ dia: c.dataset.otraDia, nave: c.dataset.otraNave });
      });
      if (otras.length) datos.tambienEn = otras;
    } else {
      datos.id = l.id;
      datos.filas = filas;
    }
    if (nueva || l.num) {
      datos.agencia = document.getElementById('hn-l-age').value;
      datos.poblacion = document.getElementById('hn-l-pob').value;
    }

    // Qué ha cambiado (para preguntar si se cambia también en otras hojas).
    const campos = [];
    if (!nueva) {
      const norm = function (v) { return String(v || '').trim().toUpperCase(); };
      const normFilas = function (lista) {
        return JSON.stringify((lista || []).map(function (f) {
          return { planta: norm(f.planta), ref: norm(f.ref), obs: norm(f.obs), color: f.color || '' };
        }).filter(function (f) { return f.planta || f.ref || f.obs; }));
      };
      if (norm(datos.grupoNotas) !== norm(l.grupoNotas)) campos.push('grupoNotas');
      if (norm(datos.dom) !== norm(l.dom)) campos.push('dom');
      if (norm(datos.grupo) !== norm(l.grupo)) campos.push('grupo');
      if (norm(datos.grupo2) !== norm(l.grupo2)) campos.push('grupo2');
      if (normFilas(filas) !== normFilas(l.filas)) campos.push('filas');
      if (!!datos.activa !== !!l.activa) campos.push('activa');
      if (seccionDestino !== seccionId) campos.push('seccion');
    }
    const otrasHojas = (!nueva && l.num && campos.length) ? hnHojasConTienda_(l.num) : [];

    const guardar = function (aplicarEn, alFallar) {
    hnAccion_('linea_guardar', datos)
      .then(function (r) {
        const pendientes = [];
        // Cambio de sección (solo al editar)
        if (!nueva && seccionDestino !== seccionId) {
          const dest = hnBuscarSeccion_(seccionDestino);
          const ids = (dest ? dest.lineas.map(function (x) { return x.id; }) : []).concat([l.id]);
          pendientes.push(hnAccion_('linea_mover', { id: l.id, seccionId: seccionDestino, ids: ids }));
        }
        // Horarios festivos que hayan cambiado
        document.querySelectorAll('.hn-l-fest').forEach(function (inp) {
          const v = inp.value.trim().toUpperCase();
          if (v !== ((l.festivos || {})[inp.dataset.fest] || '')) {
            pendientes.push(hnAccion_('festivo_valor', { festivoId: inp.dataset.fest, num: l.num, valor: v }));
          }
        });
        return Promise.all(pendientes).then(function () { return r; });
      })
      .then(function (r) {
        // Llevar los cambios a las otras hojas elegidas (después de mover
        // de sección, para que use ya la sección nueva).
        if (!aplicarEn || !aplicarEn.length) return r;
        return hnAccion_('linea_propagar', { id: l.id, campos: campos, aplicarEn: aplicarEn });
      })
      .then(function (r) {
        cerrarModal();
        if (!nueva) { hnAvisoResultado_('Guardado', r); hnCargar_(true); return; }
        let msg = 'Tienda añadida';
        if (r && r.anadidasOtras) msg += ' (y en ' + r.anadidasOtras + (r.anadidasOtras === 1 ? ' hoja más' : ' hojas más') + ')';
        if (r && r.sinSeccion) msg += '. En ' + r.sinSeccion + (r.sinSeccion === 1 ? ' hoja' : ' hojas') + ' no había una sección con ese nombre';
        mostrarToast(msg);
        hnCargar_(true);
      })
      .catch(function (err) { hnBotonLibre_(btn); if (alFallar) alFallar(err); else hnErrorModal_(err); });
    };

    if (otrasHojas.length) {
      const nombresCampos = { grupoNotas: 'A', dom: 'DOM', grupo: 'Grupo', grupo2: 'C', filas: 'plantas / refuerzos / observaciones', activa: 'si sale en la hoja', seccion: 'la sección' };
      hnPreguntarHojas_({
        titulo: '¿Cambiar también en otras hojas?',
        texto: 'Has cambiado <b>' + campos.map(function (c) { return escapeHtml(nombresCampos[c]); }).join(', ') + '</b> de ' +
          '<b>' + escapeHtml(l.nombre) + '</b>. ¿Lo cambio también en otros días o en la otra nave? Marca dónde.' +
          (campos.indexOf('seccion') !== -1 ? '<br><span class="hn-paso-nota">La sección solo se cambia donde exista una con el mismo nombre.</span>' : ''),
        elegibles: otrasHojas,
        noElegibleTxt: 'la tienda no está en esa hoja',
        onElegir: guardar
      });
      return;
    }
    hnBotonOcupado_(btn, 'Guardando…');
    guardar([]);
  };
}

/** Editor de sección. sec: null para crear (debajo de `despuesDe`, o al final). */
function hnModalSeccion_(sec, despuesDe) {
  const nueva = !sec;
  const s = sec || { nombre: '', instruccion: '', nota: '', casillas: true, activa: true, color: null };
  let colorElegido = s.color || '';
  const cuerpo =
    '<div class="modal-campo"><label for="hn-s-nombre">Nombre</label><input type="text" id="hn-s-nombre" maxlength="80" placeholder="Ej: TXT PORTUGAL" value="' + escapeAttr(s.nombre || '') + '"></div>' +
    '<div class="modal-campo"><label for="hn-s-instr">Instrucción</label><input type="text" id="hn-s-instr" maxlength="120" list="hn-s-instr-lista" placeholder="Ej: SACAR GRUPO COMPLETO" value="' + escapeAttr(s.instruccion || '') + '">' +
      '<datalist id="hn-s-instr-lista"><option value="SACAR GRUPO COMPLETO"><option value="SACAR POR TIENDA"><option value="SACAR POR GRUPO"><option value="GAITE SACA POR GRUPO / PTA POR TIENDA"></datalist></div>' +
    '<div class="modal-campo"><label for="hn-s-nota">Nota</label><input type="text" id="hn-s-nota" maxlength="160" placeholder="Ej: GENERAR MARTES 14:00" value="' + escapeAttr(s.nota || '') + '"></div>' +
    '<div class="modal-campo"><label>Color</label>' +
      '<div class="hn-colores" id="hn-s-colores">' +
        '<button type="button" class="hn-color-op hn-color-auto" data-color="" title="Verde si el nombre lleva ADELANTO; si no, gris">Automático</button>' +
        '<button type="button" class="hn-color-op hn-color-ninguno" data-color="ninguno" title="Gris, como siempre">Sin color</button>' +
        HN_COLORES.map(function (c) {
          return '<button type="button" class="hn-color-op hn-muestra-' + c.id + '" data-color="' + c.id + '" title="' + c.nombre + '">' + c.nombre + '</button>';
        }).join('') +
      '</div>' +
      '<span class="modal-campo-ayuda" id="hn-s-color-ayuda"></span>' +
    '</div>' +
    '<label class="hn-check"><input type="checkbox" id="hn-s-casillas"' + (s.casillas ? ' checked' : '') + '> Casillas 1 · 2 · 3 para marcar</label>' +
    '<label class="hn-check"><input type="checkbox" id="hn-s-activa"' + (s.activa ? ' checked' : '') + '> Sale en la hoja</label>' +
    '<p class="modal-campo-ayuda">Una sección sin tiendas sale como título de bloque (p. ej. CANARIAS o MALAGA).</p>' +
    (nueva ? '' : '<div class="hn-quitar"><button type="button" class="hn-link hn-link-peligro" id="hn-s-borrar">Eliminar sección y sus tiendas…</button></div>');

  hnAbrirModal_(nueva ? 'Nueva sección' : 'Editar sección', cuerpo,
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">' + (nueva ? 'Crear' : 'Guardar') + '</button>');
  ['hn-s-nombre', 'hn-s-instr', 'hn-s-nota'].forEach(function (id) { hnInputMayus_(document.getElementById(id)); });
  setTimeout(function () { document.getElementById('hn-s-nombre').focus(); }, 50);

  // Color: se marca el elegido y se explica qué hará "Automático".
  const pintarColores = function () {
    const nombre = document.getElementById('hn-s-nombre').value;
    document.querySelectorAll('#hn-s-colores .hn-color-op').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.color === colorElegido);
    });
    const auto = hnColorAuto_(nombre);
    const autoBtn = document.querySelector('#hn-s-colores .hn-color-auto');
    autoBtn.className = 'hn-color-op hn-color-auto' + (auto ? ' hn-muestra-' + auto : '') + (colorElegido === '' ? ' activo' : '');
    document.getElementById('hn-s-color-ayuda').textContent = colorElegido === ''
      ? (auto ? 'Automático: sale en verde porque es un ADELANTO.' : 'Automático: sale en gris. Si el nombre lleva ADELANTO, saldría en verde.')
      : '';
  };
  document.querySelectorAll('#hn-s-colores .hn-color-op').forEach(function (b) {
    b.onclick = function () { colorElegido = b.dataset.color; pintarColores(); };
  });
  document.getElementById('hn-s-nombre').addEventListener('input', pintarColores);
  pintarColores();

  const bBorrar = document.getElementById('hn-s-borrar');
  if (bBorrar) {
    bBorrar.onclick = function () {
      const n = (sec.lineas || []).length;
      const otras = hnHojasConSeccion_(sec.nombre);
      const borrarEn = function (lista, alFallar) {
        hnAccion_('seccion_eliminar_en', { id: sec.id, aplicarEn: lista })
          .then(function (r) { cerrarModal(); hnAvisoResultado_('Sección eliminada', r); hnCargar_(true); })
          .catch(function (err) { if (alFallar) alFallar(err); else mostrarErrorServidor(err); });
      };
      if (!otras.length) {
        appConfirm('Eliminar sección', 'Se eliminará la sección ' + (sec.nombre || '') + (n ? ' con sus ' + n + ' tiendas' : '') + ' de esta hoja.', function () { borrarEn([]); }, true);
        return;
      }
      hnPreguntarHojas_({
        titulo: 'Eliminar sección',
        texto: 'Se eliminará <b>' + escapeHtml(sec.nombre || '') + '</b>' + (n ? ' con sus ' + n + ' tiendas' : '') +
          '. Hay una sección con el mismo nombre en otras hojas: ¿la elimino también allí (con sus tiendas)?',
        elegibles: otras,
        noElegibleTxt: 'no tiene esa sección',
        botonSolo: 'Solo en esta hoja',
        botonVarias: 'Eliminar también en',
        peligro: true,
        onElegir: borrarEn
      });
    };
  }

  document.getElementById('modal-confirm-btn').onclick = function () {
    const btn = this;
    const nombre = document.getElementById('hn-s-nombre').value.trim();
    if (!nombre) { document.getElementById('hn-s-nombre').focus(); return; }
    const datos = {
      nombre: nombre,
      instruccion: document.getElementById('hn-s-instr').value,
      nota: document.getElementById('hn-s-nota').value,
      casillas: document.getElementById('hn-s-casillas').checked,
      activa: document.getElementById('hn-s-activa').checked,
      color: colorElegido
    };
    if (nueva) {
      datos.dia = HN.dia;
      datos.nave = HN.nave;
      if (despuesDe) datos.despuesDe = despuesDe;
    } else {
      datos.id = sec.id;
    }

    // Qué ha cambiado y en qué otras hojas se puede aplicar.
    const campos = [];
    let otras = [];
    const secRef = despuesDe ? hnBuscarSeccion_(despuesDe) : null;
    if (nueva) {
      const yaEstan = hnHojasConSeccion_(nombre);
      otras = hnOtrasHojas_().filter(function (k) { return yaEstan.indexOf(k) === -1; });
    } else {
      const norm = function (v) { return String(v || '').trim().toUpperCase(); };
      if (norm(datos.nombre) !== norm(sec.nombre)) campos.push('nombre');
      if (norm(datos.instruccion) !== norm(sec.instruccion)) campos.push('instruccion');
      if (norm(datos.nota) !== norm(sec.nota)) campos.push('nota');
      if (!!datos.casillas !== !!sec.casillas) campos.push('casillas');
      if (!!datos.activa !== !!sec.activa) campos.push('activa');
      if ((datos.color || '') !== (sec.color || '')) campos.push('color');
      if (campos.length) otras = hnHojasConSeccion_(sec.nombre);
    }

    const guardar = function (aplicarEn, alFallar) {
      hnAccion_('seccion_guardar', datos)
        .then(function (r) {
          if (!aplicarEn || !aplicarEn.length) return r;
          if (nueva) {
            return hnAccion_('seccion_copiar_en', { id: r.id, aplicarEn: aplicarEn, despuesDeNombre: secRef ? secRef.nombre : '' });
          }
          return hnAccion_('seccion_propagar', { id: sec.id, nombreAnterior: sec.nombre, campos: campos, aplicarEn: aplicarEn });
        })
        .then(function (r) { cerrarModal(); hnAvisoResultado_(nueva ? 'Sección creada' : 'Sección guardada', r); hnCargar_(true); })
        .catch(function (err) { hnBotonLibre_(btn); if (alFallar) alFallar(err); else hnErrorModal_(err); });
    };

    if (otras.length) {
      const nombresCampos = { nombre: 'el nombre', instruccion: 'la instrucción', nota: 'la nota', casillas: 'las casillas', activa: 'si sale en la hoja', color: 'el color' };
      hnPreguntarHojas_(nueva ? {
        titulo: '¿Crear también en otras hojas?',
        texto: '¿Creo la sección <b>' + escapeHtml(nombre) + '</b> también en otros días o en la otra nave?' +
          (secRef ? ' Irá debajo de <b>' + escapeHtml(secRef.nombre) + '</b> donde exista; si no, al final.' : ' Irá al final de cada hoja.'),
        elegibles: otras,
        noElegibleTxt: 'ya tiene esa sección',
        botonVarias: 'Crear también en',
        onElegir: guardar
      } : {
        titulo: '¿Cambiar también en otras hojas?',
        texto: 'Has cambiado <b>' + campos.map(function (c) { return nombresCampos[c]; }).join(', ') + '</b> de la sección <b>' + escapeHtml(sec.nombre) + '</b>. ' +
          '¿Lo cambio también en las secciones con el mismo nombre de otros días o de la otra nave?',
        elegibles: otras,
        noElegibleTxt: 'no tiene esa sección',
        onElegir: guardar
      });
      return;
    }
    hnBotonOcupado_(btn, 'Guardando…');
    guardar([]);
  };
}

/** Columnas de festivo: nombre, fecha (pasada la fecha deja de salir) y en
 *  qué días sale. El horario de cada tienda se escribe en la tabla. */
function hnModalFestivos_() {
  const lista = (HN.datos && HN.datos.festivosTodos) || [];
  const hoy = hoyStr();
  const filaHtml = function (f) {
    const pasado = f.fecha && f.fecha < hoy;
    return '<div class="hn-fest-ed' + (pasado ? ' pasado' : '') + '" data-id="' + escapeAttr(f.id || '') + '">' +
      '<input type="text" class="hn-fe-etq" maxlength="20" placeholder="Ej: DOM 1 NOV" value="' + escapeAttr(f.etiqueta || '') + '">' +
      '<input type="date" class="hn-fe-fecha" value="' + escapeAttr(f.fecha || '') + '">' +
      '<span class="hn-fe-dias">' + HN_DIAS.map(function (d) {
        return '<label><input type="checkbox" value="' + d.id + '"' + ((f.dias || []).indexOf(d.id) !== -1 ? ' checked' : '') + '>' + d.corto + '</label>';
      }).join('') + '</span>' +
      '<button type="button" class="hn-fe-guardar">Guardar</button>' +
      (f.id ? '<button type="button" class="hn-fe-borrar" title="Eliminar festivo">×</button>' : '') +
      (pasado ? '<span class="hn-badge">ya pasó</span>' : '') +
    '</div>';
  };
  const cuerpo =
    '<p class="modal-campo-ayuda" style="margin:0 0 10px;">Cada festivo es una columna con el horario de cada tienda ese día (HH, CIERRE, 11:00…). Sale en las hojas de los días marcados y deja de salir sola cuando pasa la fecha. El horario se escribe en la propia tabla, en modo editar.</p>' +
    '<div id="hn-fe-lista">' + lista.map(filaHtml).join('') + '</div>' +
    '<div class="hn-subtitulo">Nuevo festivo</div>' +
    '<div id="hn-fe-nuevo">' + filaHtml({ etiqueta: '', fecha: '', dias: [HN.dia] }) + '</div>';
  hnAbrirModal_('Festivos', cuerpo, '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>', true);

  const cont = document.getElementById('modal-custom');
  cont.querySelectorAll('.hn-fe-etq').forEach(hnInputMayus_);
  cont.querySelectorAll('.hn-fest-ed').forEach(function (div) {
    div.querySelector('.hn-fe-guardar').onclick = function () {
      const btn = this;
      const etiqueta = div.querySelector('.hn-fe-etq').value.trim();
      if (!etiqueta) { div.querySelector('.hn-fe-etq').focus(); return; }
      const dias = [];
      div.querySelectorAll('.hn-fe-dias input:checked').forEach(function (c) { dias.push(c.value); });
      hnBotonOcupado_(btn, '…');
      hnAccion_('festivo_guardar', { id: div.dataset.id || null, etiqueta: etiqueta, fecha: div.querySelector('.hn-fe-fecha').value, dias: dias })
        .then(function () { mostrarToast('Festivo guardado'); return hnCargar_(true); })
        .then(function () { hnModalFestivos_(); })
        .catch(function (err) { hnBotonLibre_(btn); hnErrorModal_(err); });
    };
    const borrar = div.querySelector('.hn-fe-borrar');
    if (borrar) {
      borrar.onclick = function () {
        hnAccion_('festivo_eliminar', { id: div.dataset.id })
          .then(function () { mostrarToast('Festivo eliminado'); return hnCargar_(true); })
          .then(function () { hnModalFestivos_(); })
          .catch(function (err) { hnErrorModal_(err); });
      };
    }
  });
}

/** Sustituye la hoja actual por una copia de otra (otro día u otra nave). */
function hnModalCopiar_() {
  const opciones = [];
  HN_NAVES.forEach(function (n) {
    HN_DIAS.forEach(function (d) {
      if (d.id === HN.dia && n === HN.nave) return;
      opciones.push('<option value="' + d.id + '|' + n + '">' + n + ' · ' + d.largo + '</option>');
    });
  });
  const cuerpo =
    '<div class="modal-campo"><label for="hn-cp-origen">Copiar desde</label><select id="hn-cp-origen">' + opciones.join('') + '</select></div>' +
    '<div class="hn-aviso hn-aviso-baja" style="margin:0;">Se borra todo lo que hay ahora en la hoja de <b>' + escapeHtml(HN.nave + ' · ' + hnDiaLargo_(HN.dia)) + '</b> y se sustituye por la copia.</div>';
  hnAbrirModal_('Copiar de otra hoja', cuerpo,
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm danger" id="modal-confirm-btn">Sustituir hoja</button>');
  document.getElementById('modal-confirm-btn').onclick = function () {
    const btn = this;
    const partes = document.getElementById('hn-cp-origen').value.split('|');
    hnBotonOcupado_(btn, 'Copiando…');
    hnAccion_('hoja_copiar', { desdeDia: partes[0], desdeNave: partes[1], dia: HN.dia, nave: HN.nave })
      .then(function () { cerrarModal(); mostrarToast('Hoja copiada'); hnCargar_(true); })
      .catch(function (err) { hnBotonLibre_(btn); hnErrorModal_(err); });
  };
}

/* ---------------- IMPRIMIR ---------------- */

/** Hoja de impresión: la misma tabla, sin botones, sin lo que no sale, en
 *  A4 vertical (ver .hn-print en styles.css). La cabecera de la tabla se
 *  repite en cada página. */
function hnImprimir_() {
  if (!HN.datos) {
    mostrarToast('Espera a que cargue la hoja', true);
    return;
  }
  const cont = document.getElementById('hoja-impresion-manual');
  if (!cont) return;
  const ahora = new Date();
  cont.innerHTML =
    '<div class="hn-print">' +
      '<div class="hn-print-cab">' +
        '<b class="hn-print-dia">' + escapeHtml(hnDiaLargo_(HN.datos.dia).toUpperCase()) + '</b>' +
        '<b class="hn-print-fecha">' + pad2(ahora.getDate()) + '/' + pad2(ahora.getMonth() + 1) + '/' + ahora.getFullYear() + '</b>' +
        '<span class="hn-print-nave">HOJA DE NOTAS · ' + escapeHtml(HN.datos.nave) + '</span>' +
      '</div>' +
      hnTablaHtml_(HN.datos, { editar: false, imprimir: true, filtro: '' }) +
    '</div>';
  document.body.classList.add('imprimiendo-hoja-notas');
  const limpiar = function () {
    document.body.classList.remove('imprimiendo-hoja-notas');
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
}
