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
let ADMIN_ACTIVIDAD_ESTADO = { desde: null, hasta: null, usuario: '', seccion: '', texto: '', datos: null, pagina: 1, agruparMovimientos: false };

// Registros por página (para que la lista no se haga eterna).
const ACTIVIDAD_POR_PAGINA_ = 30;

const SECCIONES_ACTIVIDAD_ = ['Conteos', 'Envíos y desbloqueos', 'Bloqueos y cambios', 'Plantilla', 'Usuarios', 'Emails tiendas', 'Emails agencias'];

function renderAdminRegistroActividad() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;
  const st = ADMIN_ACTIVIDAD_ESTADO;
  if (!st.desde) st.desde = hoyStr();
  if (!st.hasta) st.hasta = hoyStr();

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
      '<div class="admin-filtros">' +
        '<div class="admin-filtro-campo"><label>Desde</label><input type="date" id="admin-actividad-desde" value="' + st.desde + '"></div>' +
        '<div class="admin-filtro-campo"><label>Hasta</label><input type="date" id="admin-actividad-hasta" value="' + st.hasta + '"></div>' +
        '<button type="button" class="btn-admin-buscar" id="btn-admin-actividad-buscar">Buscar</button>' +
        '<div class="admin-filtro-campo"><label>Usuario</label><select id="admin-actividad-usuario" class="admin-filtro-select"><option value="">Todos</option></select></div>' +
        '<div class="admin-filtro-campo"><label>Sección</label><select id="admin-actividad-seccion" class="admin-filtro-select"><option value="">Todas</option>' +
          SECCIONES_ACTIVIDAD_.map(function (s) {
            return '<option value="' + escapeHtml(s) + '"' + (st.seccion === s ? ' selected' : '') + '>' + escapeHtml(s) + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="admin-filtro-campo admin-filtro-busqueda">' +
          '<label>Buscar</label>' +
          '<div class="emails-config-busqueda">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input type="text" id="admin-actividad-buscar" placeholder="Tienda, agrupación, texto…" value="' + escapeHtml(st.texto) + '">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="admin-actividad-resultado"></div>' +
    '</div>';

  document.getElementById('btn-admin-actividad-refrescar').onclick = function () { cargarRegistroActividad_(true); };
  document.getElementById('btn-admin-actividad-buscar').onclick = function () { cargarRegistroActividad_(); };
  document.getElementById('admin-actividad-desde').addEventListener('change', function (e) { if (e.target.value) st.desde = e.target.value; });
  document.getElementById('admin-actividad-hasta').addEventListener('change', function (e) { if (e.target.value) st.hasta = e.target.value; });
  document.getElementById('admin-actividad-usuario').addEventListener('change', function (e) { st.usuario = e.target.value; st.pagina = 1; pintarRegistroActividad_(); });
  document.getElementById('admin-actividad-seccion').addEventListener('change', function (e) { st.seccion = e.target.value; st.pagina = 1; pintarRegistroActividad_(); });

  let temporizador = null;
  document.getElementById('admin-actividad-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizador);
    const valor = e.target.value;
    temporizador = setTimeout(function () { st.texto = valor.trim(); st.pagina = 1; pintarRegistroActividad_(); }, 200);
  });

  // No se busca sola al entrar: si ya había resultados de una búsqueda
  // anterior en esta sesión se muestran tal cual; si no, se espera a que
  // pulsen "Buscar".
  if (st.datos) pintarRegistroActividad_();
  else mostrarPromptRegistroActividad_();
}

function mostrarPromptRegistroActividad_() {
  const cont = document.getElementById('admin-actividad-resultado');
  if (!cont) return;
  cont.innerHTML =
    '<div class="emails-config-vacio">' +
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
      'Elige el rango de fechas y pulsa "Buscar" para consultar el registro.' +
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

/** Rellena el desplegable de usuarios con los que salen en los datos. */
function rellenarUsuariosActividad_() {
  const sel = document.getElementById('admin-actividad-usuario');
  if (!sel) return;
  const st = ADMIN_ACTIVIDAD_ESTADO;
  const vistos = {};
  (st.datos || []).forEach(function (it) { vistos[it.nombre || '—'] = true; });
  const nombres = Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  if (st.usuario && !vistos[st.usuario]) nombres.unshift(st.usuario);
  sel.innerHTML = '<option value="">Todos</option>' + nombres.map(function (n) {
    return '<option value="' + escapeHtml(n) + '"' + (st.usuario === n ? ' selected' : '') + '>' + escapeHtml(n) + '</option>';
  }).join('');
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
  rellenarUsuariosActividad_();
  const datos = st.datos || [];
  const texto = st.texto.toLowerCase();

  const items = datos.filter(function (it) {
    if (st.usuario && (it.nombre || '—') !== st.usuario) return false;
    if (st.seccion && it.seccion !== st.seccion) return false;
    if (texto) {
      const todo = [it.elemento, it.contexto, it.dia_plantilla, it.detalle, it.accion, it.nombre].join(' ').toLowerCase();
      if (todo.indexOf(texto) === -1) return false;
    }
    return true;
  });

  const lista = st.agruparMovimientos ? agruparMovimientosActividad_(items) : items;

  if (!lista.length) {
    cont.innerHTML =
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>' +
        (datos.length ? 'Ningún registro coincide con los filtros.' : 'No hay actividad registrada en esas fechas.') +
      '</div>';
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
