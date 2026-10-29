/* SALIDAS · js/registro-actividad.js — Administración: Registro de actividad */

/* ---------------- ADMINISTRACIÓN: "Registro de actividad" ----------------
 * Pantalla de solo lectura (solo administradores) con lo que han hecho los
 * usuarios en la app: conteos editados, bloqueos/notas/cambios puntuales,
 * usuarios, emails de tiendas y emails de agencias.
 *
 * Lo rellena la base de datos sola (triggers sobre cada tabla, ver tabla
 * registro_actividad en Supabase); aquí solo se consulta con la RPC
 * get_registro_actividad(p_token, p_desde, p_hasta). Las ediciones
 * seguidas de una misma casilla por el mismo usuario (menos de 3 minutos
 * entre una y otra) se juntan en una sola línea "antes → después".
 * Se guardan 6 meses.
 */
let ADMIN_ACTIVIDAD_ESTADO = { desde: null, hasta: null, rango: null, usuarios: [], secciones: [], verbos: [], texto: '', datos: null, pagina: 1, agruparMovimientos: false, menuAbierto: null, busca: { usuarios: '', secciones: '', verbos: '' } };

// Registros por página (para que la lista no se haga eterna).
const ACTIVIDAD_POR_PAGINA_ = 30;

const SECCIONES_ACTIVIDAD_ = ['Conteos', 'Envíos y desbloqueos', 'Bloqueos y cambios', 'Plantilla', 'Usuarios', 'Emails tiendas', 'Emails agencias'];

// Periodos rápidos del filtro de fechas.
const RANGOS_ACTIVIDAD_ = [
  { id: 'hoy', texto: 'Hoy' },
  { id: 'ayer', texto: 'Ayer' },
  { id: '7d', texto: 'Últimos 7 días' },
  { id: 'mes', texto: 'Este mes' },
  { id: 'custom', texto: 'Elegir fechas' }
];
// Tipos de acción (el verbo de "Qué hizo"), para filtrar por ellos.
const VERBOS_ACTIVIDAD_ = ['Añadió', 'Eliminó', 'Cambió', 'Movió', 'Ajustó', 'Envió', 'Desbloqueó', 'Quitó', 'Bloqueó'];

function fechasDeRangoActividad_(rango) {
  const hoy = hoyStr();
  if (rango === 'ayer') { const a = sumarDias_(hoy, -1); return [a, a]; }
  if (rango === '7d') return [sumarDias_(hoy, -6), hoy];
  if (rango === 'mes') return [hoy.slice(0, 8) + '01', hoy];
  return [hoy, hoy];
}

function renderAdminRegistroActividad() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;
  const st = ADMIN_ACTIVIDAD_ESTADO;
  // Al entrar no hay ningún periodo marcado: se busca al pulsar uno.
  if (!st.desde || !st.hasta) { const f = fechasDeRangoActividad_('hoy'); st.desde = f[0]; st.hasta = f[1]; }

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="vista-card-header">' +
        '<h2>Registro de actividad</h2>' +
        '<div class="vista-card-header-acciones">' +
          '<button type="button" class="btn-admin-refrescar" id="btn-admin-actividad-refrescar" title="Volver a pedir los datos con las fechas actuales">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
            'Refrescar</button>' +
        '</div>' +
      '</div>' +
      '<p>Quién ha hecho qué en la app: conteos, envíos y desbloqueos, bloqueos y cambios, plantilla (rutas y tiendas), usuarios, emails de tiendas y de agencias. Es un histórico de solo lectura y se guardan los últimos 6 meses.</p>' +
      '<div class="ra-filtros">' +
        // Fila 1: periodo
        '<div class="ra-filtro-fila">' +
          '<span class="ra-filtro-etq">Periodo</span>' +
          '<div class="ra-chips" id="ra-rangos">' +
            RANGOS_ACTIVIDAD_.map(function (r) {
              return '<button type="button" class="ra-chip' + (st.rango === r.id ? ' activo' : '') + '" data-ra-rango="' + r.id + '">' + escapeHtml(r.texto) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="ra-fechas" id="ra-fechas"' + (st.rango === 'custom' ? '' : ' hidden') + '>' +
            '<input type="date" id="admin-actividad-desde" value="' + st.desde + '" title="Desde">' +
            '<span>a</span>' +
            '<input type="date" id="admin-actividad-hasta" value="' + st.hasta + '" title="Hasta">' +
            '<button type="button" class="btn-admin-buscar" id="btn-admin-actividad-buscar">Buscar</button>' +
          '</div>' +
          '<span class="ra-periodo-texto" id="ra-periodo-texto"></span>' +
        '</div>' +
        // Fila 2: usuarios, sección y acción (varios en cada uno) + buscador
        '<div class="ra-filtro-fila">' +
          '<span class="ra-filtro-etq">Filtrar</span>' +
          ['usuarios', 'secciones', 'verbos'].map(function (clave) {
            return '<div class="ra-multi" id="ra-multi-' + clave + '">' +
              '<button type="button" class="ra-multi-btn" id="ra-multi-' + clave + '-btn" data-ra-multi="' + clave + '"></button>' +
              '<div class="ra-multi-menu" id="ra-multi-' + clave + '-menu" hidden></div>' +
            '</div>';
          }).join('') +
          '<div class="emails-config-busqueda ra-buscar">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input type="text" id="admin-actividad-buscar" placeholder="Buscar tienda, agrupación, matrícula, texto de una nota…" value="' + escapeHtml(st.texto) + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="admin-actividad-resultado"></div>' +
    '</div>';

  document.getElementById('btn-admin-actividad-refrescar').onclick = function () { cargarRegistroActividad_(true); };
  document.getElementById('btn-admin-actividad-buscar').onclick = function () { cargarRegistroActividad_(); };
  document.getElementById('admin-actividad-desde').addEventListener('change', function (e) { if (e.target.value) st.desde = e.target.value; });
  document.getElementById('admin-actividad-hasta').addEventListener('change', function (e) { if (e.target.value) st.hasta = e.target.value; });

  // Periodo: los rápidos buscan al momento; "Elegir fechas" enseña los
  // dos campos de fecha y espera a que se pulse Buscar.
  document.querySelectorAll('[data-ra-rango]').forEach(function (btn) {
    btn.onclick = function () {
      st.rango = btn.getAttribute('data-ra-rango');
      document.querySelectorAll('[data-ra-rango]').forEach(function (b) { b.classList.toggle('activo', b === btn); });
      document.getElementById('ra-fechas').hidden = st.rango !== 'custom';
      if (st.rango === 'custom') { document.getElementById('admin-actividad-desde').focus(); return; }
      const f = fechasDeRangoActividad_(st.rango);
      st.desde = f[0]; st.hasta = f[1];
      document.getElementById('admin-actividad-desde').value = st.desde;
      document.getElementById('admin-actividad-hasta').value = st.hasta;
      cargarRegistroActividad_();
    };
  });

  // Desplegables de usuarios, sección y acción (varios a la vez en cada uno).
  document.querySelectorAll('[data-ra-multi]').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      const clave = btn.getAttribute('data-ra-multi');
      st.menuAbierto = st.menuAbierto === clave ? null : clave;
      pintarFiltrosActividad_();
      if (st.menuAbierto) { const inp = document.getElementById('ra-multi-buscar'); if (inp) inp.focus(); }
    };
  });
  if (!window.RA_CLICK_FUERA_LISTO_) {
    window.RA_CLICK_FUERA_LISTO_ = true;
    document.addEventListener('click', function (e) {
      const est = ADMIN_ACTIVIDAD_ESTADO;
      if (!est.menuAbierto) return;
      const caja = document.getElementById('ra-multi-' + est.menuAbierto);
      if (caja && !caja.contains(e.target)) {
        est.menuAbierto = null;
        pintarFiltrosActividad_();
      }
    });
  }

  let temporizador = null;
  document.getElementById('admin-actividad-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizador);
    const valor = e.target.value;
    temporizador = setTimeout(function () { st.texto = valor.trim(); st.pagina = 1; pintarRegistroActividad_(); }, 200);
  });

  pintarPeriodoActividad_();
  pintarFiltrosActividad_();
  // No se busca sola al entrar: si ya había resultados de una búsqueda
  // anterior en esta sesión se muestran tal cual; si no, se espera a que
  // se elija un periodo (o se pulse Buscar).
  if (st.datos) pintarRegistroActividad_();
  else mostrarPromptRegistroActividad_();
}

/** Texto con las fechas del periodo elegido, junto a los botones. */
function pintarPeriodoActividad_() {
  const el = document.getElementById('ra-periodo-texto');
  if (!el) return;
  const st = ADMIN_ACTIVIDAD_ESTADO;
  if (!st.rango || st.rango === 'custom' || !st.datos) { el.textContent = ''; return; }
  el.textContent = st.desde === st.hasta
    ? formatearFechaLarga(st.desde)
    : 'del ' + formatearFechaCorta_(st.desde) + ' al ' + formatearFechaCorta_(st.hasta);
}

/** Verbo de un registro (para el filtro "Acción"). */
function verboActividad_(it) {
  return it._movimiento ? 'Movió' : (queHizoActividad_(it).verbo || 'Otros');
}

/** Pasa los filtros salvo el que se indica en "excepto" (para contar
 *  cuántos registros hay en cada opción de ese filtro). */
function pasaFiltrosActividad_(it, excepto) {
  const st = ADMIN_ACTIVIDAD_ESTADO;
  if (excepto !== 'usuarios' && st.usuarios.length && st.usuarios.indexOf(it.nombre || '—') === -1) return false;
  if (excepto !== 'secciones' && st.secciones.length && st.secciones.indexOf(it.seccion) === -1) return false;
  if (excepto !== 'verbos' && st.verbos.length && st.verbos.indexOf(verboActividad_(it)) === -1) return false;
  if (st.texto) {
    const todo = [it.elemento, it.contexto, it.dia_plantilla, it.detalle, it.accion, it.nombre].join(' ').toLowerCase();
    if (todo.indexOf(st.texto.toLowerCase()) === -1) return false;
  }
  return true;
}

/** Registros del periodo ya preparados (con movimientos agrupados si toca). */
function baseActividad_() {
  const st = ADMIN_ACTIVIDAD_ESTADO;
  const datos = st.datos || [];
  return st.agruparMovimientos ? agruparMovimientosActividad_(datos) : datos;
}

const CONFIG_MULTI_ACTIVIDAD_ = {
  usuarios:  { todos: 'Todos los usuarios', buscar: 'Buscar usuario…', vacio: 'Ningún usuario coincide',
               icono: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>' },
  secciones: { todos: 'Todas las secciones', buscar: 'Buscar sección…', vacio: 'Ninguna sección coincide',
               icono: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
  verbos:    { todos: 'Todas las acciones', buscar: 'Buscar acción…', vacio: 'Ninguna acción coincide',
               icono: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>' }
};

/** Opciones de cada desplegable y cuántos registros tiene cada una
 *  (contando el resto de filtros puestos). */
function opcionesMultiActividad_(clave) {
  const st = ADMIN_ACTIVIDAD_ESTADO;
  const base = baseActividad_();
  const cuenta = {};
  const valorDe = clave === 'usuarios' ? function (it) { return it.nombre || '—'; }
    : clave === 'secciones' ? function (it) { return it.seccion; }
    : verboActividad_;
  base.forEach(function (it) { if (pasaFiltrosActividad_(it, clave)) { const v = valorDe(it); cuenta[v] = (cuenta[v] || 0) + 1; } });
  let valores;
  if (clave === 'secciones') valores = SECCIONES_ACTIVIDAD_.slice();
  else if (clave === 'verbos') {
    const vistos = {};
    base.forEach(function (it) { vistos[verboActividad_(it)] = true; });
    valores = VERBOS_ACTIVIDAD_.filter(function (v) { return vistos[v]; });
    if (vistos.Otros) valores.push('Otros');
  } else {
    const vistos = {};
    (st.datos || []).forEach(function (it) { vistos[it.nombre || '—'] = true; });
    valores = Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }
  st[clave].forEach(function (v) { if (valores.indexOf(v) === -1) valores.push(v); });
  return valores.map(function (v) { return { valor: v, n: cuenta[v] || 0 }; });
}

/** Marca de color de cada opción (sección o tipo de acción). */
function marcaOpcionActividad_(clave, valor) {
  if (clave === 'secciones') return '<span class="ra-multi-dot ' + claseSeccionActividad_(valor) + '"></span>';
  if (clave === 'verbos') return '<span class="ra-multi-dot ra-v-' + claseVerboActividad_(valor) + '"></span>';
  return '';
}

/** Pinta los tres desplegables (Usuarios, Sección y Acción): el botón con
 *  lo elegido y, el que esté abierto, su menú con buscador y casillas. */
function pintarFiltrosActividad_() {
  ['usuarios', 'secciones', 'verbos'].forEach(pintarMultiActividad_);
}

function pintarMultiActividad_(clave) {
  const st = ADMIN_ACTIVIDAD_ESTADO;
  const cfg = CONFIG_MULTI_ACTIVIDAD_[clave];
  const btn = document.getElementById('ra-multi-' + clave + '-btn');
  const menu = document.getElementById('ra-multi-' + clave + '-menu');
  if (!btn || !menu) return;
  const sel = st[clave];
  const corto = function (v) {
    if (clave !== 'usuarios') return v;
    const p = String(v).split(/\s+/);
    return p.length > 2 ? p[0] + ' ' + p[p.length - 2] : v;
  };
  btn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + cfg.icono + '</svg>' +
    '<span>' + (sel.length === 0 ? cfg.todos
      : sel.length === 1 ? escapeHtml(corto(sel[0]))
      : escapeHtml(corto(sel[0])) + ' y ' + (sel.length - 1) + ' más') + '</span>' +
    (sel.length ? '<span class="ra-multi-num">' + sel.length + '</span>' : '') +
    '<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  btn.classList.toggle('con-seleccion', sel.length > 0);
  btn.classList.toggle('abierto', st.menuAbierto === clave);

  const abierto = st.menuAbierto === clave;
  menu.hidden = !abierto;
  if (!abierto) { menu.innerHTML = ''; return; }

  const q = normalizarBusquedaActividad_(st.busca[clave]);
  const opciones = opcionesMultiActividad_(clave).filter(function (o) { return !q || normalizarBusquedaActividad_(o.valor).indexOf(q) !== -1; });

  menu.innerHTML =
    '<div class="ra-multi-buscar"><input type="text" id="ra-multi-buscar" placeholder="' + escapeAttr(cfg.buscar) + '" value="' + escapeAttr(st.busca[clave]) + '"></div>' +
    '<div class="ra-multi-lista">' +
      (opciones.length ? opciones.map(function (o) {
        const marcado = sel.indexOf(o.valor) !== -1;
        return '<label class="ra-multi-item' + (o.n || marcado ? '' : ' vacio') + '"><input type="checkbox" data-ra-opcion="' + escapeAttr(o.valor) + '"' + (marcado ? ' checked' : '') + '>' +
          marcaOpcionActividad_(clave, o.valor) +
          '<span class="nombre">' + escapeHtml(o.valor) + '</span><span class="ra-chip-n">' + o.n + '</span></label>';
      }).join('') : '<div class="ra-filtro-vacio" style="padding:10px 12px;">' + (st.datos ? cfg.vacio : 'Elige antes un periodo') + '</div>') +
    '</div>' +
    '<div class="ra-multi-pie">' +
      '<button type="button" id="ra-multi-limpiar"' + (sel.length ? '' : ' disabled') + '>Quitar selección</button>' +
      '<button type="button" id="ra-multi-cerrar" class="principal">Listo</button>' +
    '</div>';

  const inp = document.getElementById('ra-multi-buscar');
  inp.addEventListener('input', function () {
    st.busca[clave] = inp.value;
    const pos = inp.selectionStart;
    pintarMultiActividad_(clave);
    const nuevo = document.getElementById('ra-multi-buscar');
    if (nuevo) { nuevo.focus(); nuevo.setSelectionRange(pos, pos); }
  });
  menu.querySelectorAll('[data-ra-opcion]').forEach(function (chk) {
    chk.onchange = function () {
      const v = chk.getAttribute('data-ra-opcion');
      const pos = sel.indexOf(v);
      if (chk.checked && pos === -1) sel.push(v);
      if (!chk.checked && pos !== -1) sel.splice(pos, 1);
      st.pagina = 1;
      pintarRegistroActividad_();
    };
  });
  document.getElementById('ra-multi-limpiar').onclick = function () { st[clave] = []; st.pagina = 1; pintarRegistroActividad_(); };
  document.getElementById('ra-multi-cerrar').onclick = function () { st.menuAbierto = null; st.busca[clave] = ''; pintarMultiActividad_(clave); };
}

function claseVerboActividad_(v) {
  return { 'Añadió': 'add', 'Eliminó': 'del', 'Quitó': 'del', 'Cambió': 'edit', 'Movió': 'move', 'Ajustó': 'warn', 'Desbloqueó': 'warn', 'Bloqueó': 'warn', 'Envió': 'send' }[v] || 'otro';
}

function normalizarBusquedaActividad_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Línea con los filtros que están puestos, cada uno con su × para
 *  quitarlo, y un "Quitar todos". */
function htmlFiltrosActivosActividad_() {
  const st = ADMIN_ACTIVIDAD_ESTADO;
  const pills = [];
  st.usuarios.forEach(function (u) { pills.push(['usuarios', u, u]); });
  st.secciones.forEach(function (s) { pills.push(['secciones', s, s]); });
  st.verbos.forEach(function (v) { pills.push(['verbos', v, v]); });
  if (st.texto) pills.push(['texto', st.texto, '«' + st.texto + '»']);
  if (!pills.length) return '';
  return '<div class="ra-activos">' +
    '<span class="ra-filtro-etq">Filtrando por</span>' +
    pills.map(function (p) {
      return '<span class="ra-activo">' + escapeHtml(p[2]) + '<button type="button" data-ra-quitar="' + p[0] + '" data-ra-valor="' + escapeAttr(p[1]) + '" title="Quitar este filtro">×</button></span>';
    }).join('') +
    '<button type="button" class="ra-activos-limpiar" id="ra-quitar-todos">Quitar todos</button>' +
  '</div>';
}

function mostrarPromptRegistroActividad_() {
  const cont = document.getElementById('admin-actividad-resultado');
  if (!cont) return;
  cont.innerHTML =
    '<div class="emails-config-vacio">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
      'Elige un periodo (Hoy, Ayer, Últimos 7 días…) para consultar el registro.' +
    '</div>';
}

function enRegistroActividad_() {
  return ESTADO.vista === 'administracion' && ESTADO_ADMIN.seccionActiva === 'registro-actividad';
}

function cargarRegistroActividad_(esRefrescoManual) {
  if (!enRegistroActividad_()) return;
  const st = ADMIN_ACTIVIDAD_ESTADO;
  if (st.desde > st.hasta) { mostrarToast('La fecha "Desde" no puede ser posterior a "Hasta"', true); return; }
  const resultadoEl = document.getElementById('admin-actividad-resultado');
  const btnRefrescar = document.getElementById('btn-admin-actividad-refrescar');
  if (esRefrescoManual && btnRefrescar) { btnRefrescar.classList.add('girando'); btnRefrescar.disabled = true; }
  if (!esRefrescoManual && resultadoEl) resultadoEl.innerHTML = '<div class="loader"><span class="spinner-navy"></span><div>Cargando…</div></div>';

  function quitarGiro() { if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; } }

  llamarApi_('getRegistroActividad', [st.desde, st.hasta])
    .then(function (datos) {
      quitarGiro();
      if (!enRegistroActividad_()) return;
      st.datos = datos || [];
      st.pagina = 1;
      pintarRegistroActividad_();
    })
    .catch(function (err) {
      quitarGiro();
      mostrarErrorServidor(err);
      if (resultadoEl) resultadoEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar el registro.</div>';
    });
}

function claseSeccionActividad_(seccion) {
  switch (seccion) {
    case 'Conteos': return 'ra-sec-conteos';
    case 'Bloqueos y cambios': return 'ra-sec-bloqueos';
    case 'Plantilla': return 'ra-sec-plantilla';
    case 'Envíos y desbloqueos': return 'ra-sec-envios';
    case 'Usuarios': return 'ra-sec-usuarios';
    case 'Emails tiendas': return 'ra-sec-tiendas';
    case 'Emails agencias': return 'ra-sec-agencias';
    default: return '';
  }
}

/* ---- Presentación de cada registro: "qué hizo" y "dónde", en frases ---- */

/** Verbo (con su color) y resto de la frase de "Qué hizo" a partir de la
 *  acción guardada en la base de datos (p. ej. "Añadida nota"). */
function queHizoActividad_(it) {
  const elem = it.elemento && it.elemento !== 'Toda la agrupación' && it.elemento !== 'Todo el día' ? it.elemento : '';
  const tipoNota = it.contexto ? 'nota de agrupación' : 'nota del día';
  const fijo = {
    'Añadida nota': ['Añadió', 'add', tipoNota],
    'Eliminada nota': ['Eliminó', 'del', tipoNota],
    'Editada nota': ['Cambió', 'edit', tipoNota],
    'Movida nota': ['Movió', 'move', 'nota a otro sitio'],
    'Añadido cambio puntual': ['Añadió', 'add', 'cambio puntual' + (elem ? ' de ' + elem : '')],
    'Eliminado cambio puntual': ['Quitó', 'del', 'cambio puntual' + (elem ? ' de ' + elem : '')],
    'Editado conteo': ['Cambió', 'edit', 'conteo' + (elem ? ' de ' + elem : '')],
    'Editado conteo (casilla compartida)': ['Cambió', 'edit', 'conteo' + (elem ? ' de ' + elem : '') + ' (casilla compartida)'],
    'Ajustada la carga (conteo bloqueado)': ['Ajustó', 'warn', 'la carga (el conteo queda bloqueado)'],
    'Desbloqueado conteo (carga ajustada)': ['Desbloqueó', 'warn', 'el conteo (se borra la carga ajustada)'],
    'Enviado definitivo (conteo bloqueado)': ['Envió', 'send', 'el definitivo'],
    'Enviada previsión': ['Envió', 'send', 'la previsión'],
    'Matrícula tras el definitivo': ['Cambió', 'edit', 'matrícula después del definitivo'],
    'Editada tienda en plantilla': ['Cambió', 'edit', 'tienda' + (elem ? ' ' + elem : '')],
    'Editada agrupación en plantilla': ['Cambió', 'edit', 'la agrupación'],
    'Movida tienda': ['Movió', 'edit', 'tienda' + (elem ? ' ' + elem : '')]
  }[it.accion];
  if (fijo) return { verbo: fijo[0], clase: fijo[1], resto: fijo[2] };
  // Acciones sin frase propia: se saca el verbo de la primera palabra.
  const a = String(it.accion || '');
  const reglas = [
    [/^(Añadid|Cread|Dad)[oa]s?\b/i, 'Añadió', 'add'],
    [/^(Eliminad|Borrad|Quitad)[oa]s?\b/i, 'Eliminó', 'del'],
    [/^(Editad|Cambiad|Modificad)[oa]s?\b/i, 'Cambió', 'edit'],
    [/^Movid[oa]s?\b/i, 'Movió', 'edit'],
    [/^Enviad[oa]s?\b/i, 'Envió', 'send'],
    [/^(Bloquead)[oa]s?\b/i, 'Bloqueó', 'warn'],
    [/^(Desbloquead)[oa]s?\b/i, 'Desbloqueó', 'warn']
  ];
  for (let i = 0; i < reglas.length; i++) {
    const m = a.match(reglas[i][0]);
    if (m) return { verbo: reglas[i][1], clase: reglas[i][2], resto: (a.slice(m[0].length).trim() + (elem ? ' ' + elem : '')).trim() };
  }
  return { verbo: '', clase: '', resto: a + (elem ? ' · ' + elem : '') };
}

/** "TXT NORTE (PTA 11:00)" -> "TXT NORTE · PTA 11:00" */
function agrupacionLegibleActividad_(nombre) {
  const p = parsearNombreAgrupacion(nombre || '');
  return p.titulo + (p.ubicacion ? ' · ' + p.ubicacion : '');
}

const DIAS_CORTOS_ACTIVIDAD_ = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function fechaCortaConDiaActividad_(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return DIAS_CORTOS_ACTIVIDAD_[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}

/** "Dónde": qué conteo (o qué pantalla) se vio afectado y, debajo, la
 *  agrupación o el elemento concreto. */
function dondeActividad_(it) {
  const esEspecial = /^ESPECIAL/i.test(it.dia_plantilla || '');
  if (it.seccion === 'Plantilla') {
    const dia = esEspecial
      ? 'conteo especial del ' + String(it.dia_plantilla).replace(/^ESPECIAL\s*/i, '')
      : 'plantilla del ' + String(it.dia_plantilla || '').toLowerCase();
    return { linea: 'Rutas y tiendas · ' + dia, sub: it.contexto ? agrupacionLegibleActividad_(it.contexto) : '' };
  }
  if (it.seccion === 'Usuarios' || it.seccion === 'Emails tiendas' || it.seccion === 'Emails agencias') {
    return { linea: it.seccion, sub: it.elemento || '' };
  }
  const linea = it.fecha_ref
    ? (esEspecial ? 'Conteo especial del ' : 'Conteo del ') + fechaCortaConDiaActividad_(it.fecha_ref)
    : (it.dia_plantilla ? 'Conteo del ' + String(it.dia_plantilla).toLowerCase() : '—');
  let sub = '';
  if (it.contexto) sub = agrupacionLegibleActividad_(it.contexto);
  else if (it.elemento === 'Todo el día') sub = 'Nota general (todas las agrupaciones)';
  return { linea: linea, sub: sub };
}

/** Junta en una sola línea "Movió" cuando la misma persona añade una nota
 *  y en menos de un minuto elimina la misma nota en otro sitio del mismo
 *  conteo (p. ej. pasar una nota del día a una agrupación). */
function agruparMovimientosActividad_(items) {
  const usados = {};
  const out = [];
  const segundos = function (it) {
    const p = String(it.hora || '0:0:0').split(':').map(Number);
    return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  };
  items.forEach(function (it, i) {
    if (usados[i]) return;
    if (it.accion === 'Añadida nota' || it.accion === 'Eliminada nota') {
      const opuesta = it.accion === 'Añadida nota' ? 'Eliminada nota' : 'Añadida nota';
      for (let j = i + 1; j < items.length && j < i + 6; j++) {
        const o = items[j];
        if (usados[j] || o.accion !== opuesta || o.usuario !== it.usuario || o.dia !== it.dia ||
            o.fecha_ref !== it.fecha_ref || (o.detalle || '') !== (it.detalle || '') ||
            Math.abs(segundos(o) - segundos(it)) > 60) continue;
        const anadida = it.accion === 'Añadida nota' ? it : o;
        const eliminada = it.accion === 'Añadida nota' ? o : it;
        if ((anadida.contexto || '') === (eliminada.contexto || '')) continue;
        usados[j] = true;
        const desde = eliminada.contexto ? parsearNombreAgrupacion(eliminada.contexto).titulo : 'Nota general';
        const hacia = anadida.contexto ? parsearNombreAgrupacion(anadida.contexto).titulo : 'Nota general';
        out.push(Object.assign({}, anadida, {
          hora: segundos(anadida) < segundos(eliminada) ? anadida.hora : eliminada.hora,
          _movimiento: { desde: desde, hacia: hacia, deDia: !eliminada.contexto, aDia: !anadida.contexto }
        }));
        return;
      }
    }
    out.push(it);
  });
  return out;
}

function filaActividadHtml_(it) {
  const cuando = it.hora + (it.hora_fin ? '–' + it.hora_fin : '');
  let q, d;
  if (it._movimiento) {
    const mv = it._movimiento;
    q = { verbo: 'Movió', clase: 'move', resto: mv.deDia ? 'nota del día a una agrupación' : (mv.aDia ? 'nota de agrupación a nota del día' : 'nota a otra agrupación') };
    d = { linea: dondeActividad_(it).linea, sub: mv.desde + ' → ' + mv.hacia };
  } else {
    q = queHizoActividad_(it);
    d = dondeActividad_(it);
  }
  const esNota = /nota/i.test(it.accion || '');
  const detalle = it.detalle ? (esNota ? '«' + it.detalle + '»' : it.detalle) : '';
  return '<tr>' +
    '<td class="ra-hora">' + escapeHtml(cuando) + '</td>' +
    '<td class="ra-quien">' + escapeHtml(it.nombre || '—') + '</td>' +
    '<td class="ra-que">' +
      (q.verbo ? '<span class="ra-verbo ra-v-' + q.clase + '">' + escapeHtml(q.verbo) + '</span>' : '') +
      escapeHtml(q.resto) +
      (detalle ? '<div class="ra-sub">' + escapeHtml(detalle) + '</div>' : '') +
    '</td>' +
    '<td class="ra-donde">' + escapeHtml(d.linea) + (d.sub ? '<div class="ra-sub">' + escapeHtml(d.sub) + '</div>' : '') + '</td>' +
    '<td class="ra-sec"><span class="ra-seccion ' + claseSeccionActividad_(it.seccion) + '">' + escapeHtml(it.seccion) + '</span></td>' +
  '</tr>';
}

function pintarRegistroActividad_() {
  const cont = document.getElementById('admin-actividad-resultado');
  if (!cont) return;
  const st = ADMIN_ACTIVIDAD_ESTADO;
  pintarFiltrosActividad_();
  pintarPeriodoActividad_();
  const datos = st.datos || [];
  const lista = baseActividad_().filter(function (it) { return pasaFiltrosActividad_(it); });

  if (!lista.length) {
    cont.innerHTML = htmlFiltrosActivosActividad_() +
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>' +
        (datos.length ? 'Ningún registro coincide con los filtros.' : 'No hay actividad registrada en esas fechas.') +
      '</div>';
    enlazarFiltrosActivosActividad_(cont);
    return;
  }

  const totalPaginas = Math.max(1, Math.ceil(lista.length / ACTIVIDAD_POR_PAGINA_));
  if (!st.pagina || st.pagina < 1) st.pagina = 1;
  if (st.pagina > totalPaginas) st.pagina = totalPaginas;
  const inicio = (st.pagina - 1) * ACTIVIDAD_POR_PAGINA_;
  const pagina = lista.slice(inicio, inicio + ACTIVIDAD_POR_PAGINA_);

  // Cuántas acciones hay de cada día (en todo el resultado, no solo en la
  // página), para ponerlo en la cabecera de cada día.
  const porDia = {};
  lista.forEach(function (it) { porDia[it.dia] = (porDia[it.dia] || 0) + 1; });

  let filas = '';
  let diaActual = null;
  pagina.forEach(function (it) {
    if (it.dia !== diaActual) {
      diaActual = it.dia;
      const largo = formatearFechaLarga(it.dia);
      filas += '<tr class="ra-fila-dia"><td colspan="5"><span>' + escapeHtml(largo.charAt(0).toUpperCase() + largo.slice(1)) + '</span>' +
        '<span class="ra-fila-dia-n">' + porDia[it.dia] + (porDia[it.dia] === 1 ? ' acción' : ' acciones') + '</span></td></tr>';
    }
    filas += filaActividadHtml_(it);
  });

  cont.innerHTML =
    htmlFiltrosActivosActividad_() +
    '<div class="admin-resumen ra-resumen">' +
      '<span>' + lista.length + (lista.length === 1 ? ' registro' : ' registros') +
        (totalPaginas > 1 ? ' · mostrando ' + (inicio + 1) + '–' + (inicio + pagina.length) : '') +
        (datos.length >= 3000 ? ' · se muestran los 3000 más recientes, acota las fechas para ver el resto' : '') + '</span>' +
      '<label class="ra-agrupar" title="Junta en una línea cuando una nota se pasa de un sitio a otro (se añade en uno y se borra en otro en menos de un minuto)">' +
        '<input type="checkbox" id="ra-agrupar-mov"' + (st.agruparMovimientos ? ' checked' : '') + '> Agrupar movimientos de notas</label>' +
    '</div>' +
    '<div class="admin-tabla-wrap ra-tabla-scroll"><table class="admin-tabla admin-tabla-actividad">' +
      '<thead><tr><th>Hora</th><th>Quién</th><th>Qué hizo</th><th>Dónde</th><th>Sección</th></tr></thead>' +
      '<tbody>' + filas + '</tbody>' +
    '</table></div>' +
    htmlPaginacionActividad_(st.pagina, totalPaginas);

  enlazarFiltrosActivosActividad_(cont);
  ajustarAlturaTablaActividad_();
  document.getElementById('ra-agrupar-mov').addEventListener('change', function (e) {
    st.agruparMovimientos = e.target.checked;
    st.pagina = 1;
    pintarRegistroActividad_();
  });

  cont.querySelectorAll('[data-ra-pagina]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      st.pagina = parseInt(btn.getAttribute('data-ra-pagina'), 10) || 1;
      pintarRegistroActividad_();
      // Volver arriba de la tabla al cambiar de página.
      const wrap = cont.querySelector('.ra-tabla-scroll');
      if (wrap) wrap.scrollTop = 0;
    });
  });
}

function enlazarFiltrosActivosActividad_(cont) {
  const st = ADMIN_ACTIVIDAD_ESTADO;
  cont.querySelectorAll('[data-ra-quitar]').forEach(function (b) {
    b.onclick = function () {
      const clave = b.getAttribute('data-ra-quitar');
      const valor = b.getAttribute('data-ra-valor');
      if (clave === 'texto') {
        st.texto = '';
        const inp = document.getElementById('admin-actividad-buscar');
        if (inp) inp.value = '';
      } else {
        st[clave] = st[clave].filter(function (x) { return x !== valor; });
      }
      st.pagina = 1;
      pintarRegistroActividad_();
    };
  });
  const todos = document.getElementById('ra-quitar-todos');
  if (todos) todos.onclick = function () {
    st.usuarios = []; st.secciones = []; st.verbos = []; st.texto = '';
    const inp = document.getElementById('admin-actividad-buscar');
    if (inp) inp.value = '';
    st.pagina = 1;
    pintarRegistroActividad_();
  };
}

/** Alto de la tabla para que todo quepa en la pantalla sin scroll de
 *  página: desde donde empieza la tabla hasta el final de la ventana,
 *  dejando sitio para la paginación y el margen de abajo. */
function ajustarAlturaTablaActividad_() {
  const wrap = document.querySelector('#admin-actividad-resultado .ra-tabla-scroll');
  if (!wrap) return;
  const pag = document.querySelector('#admin-actividad-resultado .ra-paginacion');
  const altoPag = pag ? pag.offsetHeight + 12 : 0;
  const arriba = wrap.getBoundingClientRect().top + window.scrollY;
  const margenAbajo = 56; // padding de la tarjeta y de la página (con un pequeño margen)
  const disponible = window.innerHeight - arriba - altoPag - margenAbajo;
  wrap.style.maxHeight = Math.max(200, Math.floor(disponible)) + 'px';
}
window.addEventListener('resize', function () {
  if (typeof enRegistroActividad_ === 'function' && enRegistroActividad_()) ajustarAlturaTablaActividad_();
});

/** Botones « ‹ Página X de Y › ». Sin nada si cabe todo en una página. */
function htmlPaginacionActividad_(actual, total) {
  if (total <= 1) return '';
  function boton(texto, destino, titulo, deshabilitado) {
    return '<button type="button" class="ra-pag-btn"' + (deshabilitado ? ' disabled' : ' data-ra-pagina="' + destino + '"') +
      ' title="' + titulo + '">' + texto + '</button>';
  }
  return '<div class="ra-paginacion">' +
    boton('«', 1, 'Primera página', actual === 1) +
    boton('‹ Anterior', actual - 1, 'Página anterior', actual === 1) +
    '<span class="ra-pag-info">Página ' + actual + ' de ' + total + '</span>' +
    boton('Siguiente ›', actual + 1, 'Página siguiente', actual === total) +
    boton('»', total, 'Última página', actual === total) +
  '</div>';
}
