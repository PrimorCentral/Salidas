/* SALIDAS · js/festivos.js — Gestión de festivos */

/* ---------------- GESTIÓN FESTIVOS ----------------
 * Resumen de todas las notas y cierres de tienda guardados (pasados y
 * futuros), construido sin necesitar un endpoint nuevo: se recorre mes a
 * mes con getMesCalendario (que ya trae qué días tienen notas/cierres) y
 * solo se pide el detalle completo (getConteoDia) de los días marcados.
 *
 * Por defecto se muestra 1 mes (navegable con las flechas). Además hay
 * filtros por texto (tienda/agrupación/contenido), por tipo (cierre u
 * observación) y, opcionalmente, un rango de fechas personalizado que
 * sustituye a la navegación mensual mientras esté activo. Los filtros de
 * texto/tipo se aplican en el cliente sobre los datos ya cargados
 * (FESTIVOS_ESTADO.datosCache), sin volver a pedir nada al servidor; solo
 * cambiar de mes o de rango de fechas dispara una nueva carga.
 */
let FESTIVOS_ESTADO = {
  semanaInicio: null,    // 'YYYY-MM-DD' del lunes de la semana mostrada (navegación semanal por defecto)
  idSolicitud: 0,
  datosCache: [],        // conteo completo (getConteoDia) de los días del rango que sí tienen notas/cierres
  diasRango: [],         // TODAS las fechas del rango actual, en orden (aunque no tengan nada guardado)
  filtroTexto: '',
  filtroTipo: 'todos',   // 'todos' | 'cierre' | 'nota'
  filtroDesde: null,     // 'YYYY-MM-DD' -- si desde+hasta están definidos, sustituye la navegación semanal
  filtroHasta: null,
  filtrosAbiertos: false  // si el panel de filtros (oculto tras un icono) está desplegado
};

/** Suma (o resta) días a una fecha 'YYYY-MM-DD' y devuelve otra fecha en el mismo formato. */
function sumarDias_(fecha, delta) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** Devuelve el lunes ('YYYY-MM-DD') de la semana a la que pertenece la fecha dada. */
function lunesDeSemana_(fecha) {
  const dow = new Date(fecha + 'T12:00:00').getDay(); // 0=domingo..6=sábado
  return sumarDias_(fecha, -((dow + 6) % 7));
}

/** Enumera todas las fechas ('YYYY-MM-DD') entre inicio y fin, ambos incluidos. */
function diasDeRango_(inicio, fin) {
  const out = [];
  let cursor = inicio, guard = 0;
  while (cursor <= fin && guard < 400) { out.push(cursor); cursor = sumarDias_(cursor, 1); guard++; }
  return out;
}

function sumarMeses_(anioMes, delta) {
  const partes = anioMes.split('-').map(Number);
  let anio = partes[0], mes = partes[1] - 1 + delta;
  anio += Math.floor(mes / 12);
  mes = ((mes % 12) + 12) % 12;
  return anio + '-' + pad2(mes + 1);
}

function mesesEnRango_(inicio, fin) {
  const out = [];
  let cursor = inicio, guard = 0;
  while (cursor <= fin && guard < 60) {
    out.push(cursor);
    cursor = sumarMeses_(cursor, 1);
    guard++;
  }
  return out;
}

function formatearFechaCorta_(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return d.getDate() + ' ' + MESES_ES[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}

function renderAdminFestivos() {
  if (!FESTIVOS_ESTADO.semanaInicio) FESTIVOS_ESTADO.semanaInicio = lunesDeSemana_(hoyStr());
  FESTIVOS_ESTADO.filtroTexto = '';

  const cont = document.getElementById('admin-contenido');
  if (!cont) return;
  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="festivos-fijo">' +
        '<div class="vista-card-header">' +
          '<h2>Cierres y cambios</h2>' +
          '<div class="vista-card-header-acciones">' +
            '<button type="button" class="btn-festivos-filtro' + (FESTIVOS_ESTADO.filtrosAbiertos ? ' abierto' : '') + '" id="btn-festivos-filtro-toggle" title="Filtrar">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>' +
              '<span class="badge-punto" id="festivos-filtro-badge" style="display:none;"></span>' +
            '</button>' +
            '<button type="button" class="btn-anadir-obs" id="btn-festivos-anadir">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
              'Añadir cierre / observación</button>' +
          '</div>' +
        '</div>' +
        '<p>Resumen de todas las notas y cierres de tienda guardados, tanto pasados como futuros.</p>' +
        '<div class="festivos-stats" id="festivos-stats"></div>' +
        '<div class="festivos-toolbar">' +
          '<button type="button" class="nav" id="festivos-prev" aria-label="Semana anterior">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
          '<div class="rango-label" id="festivos-rango"></div>' +
          '<button type="button" class="nav" id="festivos-next" aria-label="Semana siguiente">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>' +
          '<button type="button" class="btn-hoy-festivos" id="festivos-hoy">Hoy</button>' +
        '</div>' +
        '<div class="festivos-filtros' + (FESTIVOS_ESTADO.filtrosAbiertos ? ' abierta' : '') + '" id="festivos-filtros-panel">' +
          '<div class="festivos-filtros-inner">' +
            '<div class="festivos-filtros-contenido">' +
              '<div class="festivos-filtros-fila">' +
                '<div class="festivos-filtro-busqueda">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
                  '<input type="text" id="festivos-buscar" placeholder="Buscar tienda, agrupación o texto…">' +
                '</div>' +
              '</div>' +
              '<div class="festivos-filtros-fila">' +
                '<div class="festivos-filtro-tipo" id="festivos-filtro-tipo">' +
                  '<button type="button" class="activo" data-tipo="todos">Todos</button>' +
                  '<button type="button" data-tipo="cierre">Cierres</button>' +
                  '<button type="button" data-tipo="nota">Observaciones</button>' +
                  '<button type="button" data-tipo="cambio">Cambios</button>' +
                '</div>' +
                '<div class="festivos-filtro-fechas">' +
                  '<input type="date" id="festivos-desde" aria-label="Desde">' +
                  '<span>—</span>' +
                  '<input type="date" id="festivos-hasta" aria-label="Hasta">' +
                '</div>' +
                '<button type="button" class="festivos-filtro-limpiar" id="festivos-limpiar-filtros" title="Quitar todos los filtros">' +
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>' +
                  'Limpiar filtros</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="festivos-lista"><div class="loader">Cargando…</div></div>' +
    '</div>';

  document.getElementById('btn-festivos-anadir').onclick = abrirGestorObservaciones;
  document.getElementById('btn-festivos-filtro-toggle').onclick = function () {
    FESTIVOS_ESTADO.filtrosAbiertos = !FESTIVOS_ESTADO.filtrosAbiertos;
    document.getElementById('festivos-filtros-panel').classList.toggle('abierta', FESTIVOS_ESTADO.filtrosAbiertos);
    this.classList.toggle('abierto', FESTIVOS_ESTADO.filtrosAbiertos);
    // El panel tarda .22s en abrirse/cerrarse (ver CSS); se recalcula la
    // altura de la lista varias veces durante la transición para que no se
    // quede corta o le sobre hueco mientras se anima.
    [0, 90, 180, 260].forEach(function (ms) { setTimeout(function () { ajustarAlturaListaScrollable_('festivos-lista'); }, ms); });
  };
  document.getElementById('festivos-prev').onclick = function () { desplazarSemanaFestivos_(-1); };
  document.getElementById('festivos-next').onclick = function () { desplazarSemanaFestivos_(1); };
  document.getElementById('festivos-hoy').onclick = function () {
    FESTIVOS_ESTADO.semanaInicio = lunesDeSemana_(hoyStr());
    FESTIVOS_ESTADO.filtroDesde = null;
    FESTIVOS_ESTADO.filtroHasta = null;
    document.getElementById('festivos-desde').value = '';
    document.getElementById('festivos-hasta').value = '';
    cargarFestivos();
  };

  let temporizadorBusqueda = null;
  document.getElementById('festivos-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusqueda);
    const valor = e.target.value;
    temporizadorBusqueda = setTimeout(function () {
      FESTIVOS_ESTADO.filtroTexto = valor.trim().toLowerCase();
      aplicarFiltrosFestivos_();
    }, 200);
  });

  document.querySelectorAll('#festivos-filtro-tipo button').forEach(function (btn) {
    btn.onclick = function () {
      FESTIVOS_ESTADO.filtroTipo = btn.getAttribute('data-tipo');
      document.querySelectorAll('#festivos-filtro-tipo button').forEach(function (b) { b.classList.toggle('activo', b === btn); });
      aplicarFiltrosFestivos_();
    };
  });

  document.getElementById('festivos-desde').onchange = actualizarFiltroFechas_;
  document.getElementById('festivos-hasta').onchange = actualizarFiltroFechas_;

  document.getElementById('festivos-limpiar-filtros').onclick = function () {
    FESTIVOS_ESTADO.filtroTexto = '';
    FESTIVOS_ESTADO.filtroTipo = 'todos';
    FESTIVOS_ESTADO.filtroDesde = null;
    FESTIVOS_ESTADO.filtroHasta = null;
    document.getElementById('festivos-buscar').value = '';
    document.getElementById('festivos-desde').value = '';
    document.getElementById('festivos-hasta').value = '';
    document.querySelectorAll('#festivos-filtro-tipo button').forEach(function (b) { b.classList.toggle('activo', b.getAttribute('data-tipo') === 'todos'); });
    cargarFestivos();
  };

  cargarFestivos();
  ajustarAlturaListaScrollable_('festivos-lista');
  window.addEventListener('resize', ajustarAlturasListasConfig_debounced_);
}

function desplazarSemanaFestivos_(delta) {
  if (FESTIVOS_ESTADO.filtroDesde && FESTIVOS_ESTADO.filtroHasta) return; // navegación deshabilitada con rango personalizado
  FESTIVOS_ESTADO.semanaInicio = sumarDias_(FESTIVOS_ESTADO.semanaInicio, delta * 7);
  cargarFestivos();
}

function actualizarFiltroFechas_() {
  const desde = document.getElementById('festivos-desde').value || null;
  const hasta = document.getElementById('festivos-hasta').value || null;
  FESTIVOS_ESTADO.filtroDesde = desde;
  FESTIVOS_ESTADO.filtroHasta = hasta;
  if (desde && hasta) cargarFestivos(); // rango completo: hace falta volver a pedir los meses que cubre
  else aplicarFiltrosFestivos_();       // rango incompleto: no cambia lo que hay que cargar, solo se ignora como filtro
}

function cargarFestivos() {
  if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'festivos') return;
  const rangoEl = document.getElementById('festivos-rango');
  const listaEl = document.getElementById('festivos-lista');
  if (!rangoEl || !listaEl) return;

  const rangoPersonalizado = !!(FESTIVOS_ESTADO.filtroDesde && FESTIVOS_ESTADO.filtroHasta);
  const inicio = rangoPersonalizado ? FESTIVOS_ESTADO.filtroDesde : FESTIVOS_ESTADO.semanaInicio;
  const fin = rangoPersonalizado ? FESTIVOS_ESTADO.filtroHasta : sumarDias_(FESTIVOS_ESTADO.semanaInicio, 6);

  rangoEl.textContent = formatearFechaCorta_(inicio) + ' — ' + formatearFechaCorta_(fin);

  ['festivos-prev', 'festivos-next', 'festivos-hoy'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.disabled = rangoPersonalizado;
  });

  const idSolicitud = ++FESTIVOS_ESTADO.idSolicitud;
  listaEl.innerHTML = '<div class="loader">Cargando…</div>';
  const statsElCarga = document.getElementById('festivos-stats');
  if (statsElCarga) statsElCarga.innerHTML = '';

  const meses = mesesEnRango_(anioMesDe(inicio), anioMesDe(fin));

  Promise.all(meses.map(function (m) { return llamarApi_('getMesCalendario', [m]).catch(function () { return []; }); }))
    .then(function (resultadosMeses) {
      // Nos quedamos con la info (fecha, si tiene notas/cierres) de cada día
      // del rango exacto pedido, aunque no tenga nada guardado: así se puede
      // pintar la lista completa día a día (lunes a domingo) más abajo.
      const infoPorFecha = {};
      resultadosMeses.forEach(function (dias) {
        (dias || []).forEach(function (info) { infoPorFecha[info.fecha] = info; });
      });
      const diasRango = diasDeRango_(inicio, fin);
      const fechasConContenido = diasRango.filter(function (fecha) {
        const info = infoPorFecha[fecha];
        return info && (info.tieneNotas || info.tieneCierres || info.tieneExcepciones);
      });
      return Promise.all(fechasConContenido.map(function (fecha) {
        return llamarApi_('getConteoDia', [fecha]).catch(function () { return null; });
      })).then(function (datosDias) { return { diasRango: diasRango, datosDias: datosDias }; });
    })
    .then(function (resultado) {
      if (idSolicitud !== FESTIVOS_ESTADO.idSolicitud) return; // ya no es la petición vigente
      FESTIVOS_ESTADO.diasRango = resultado.diasRango;
      FESTIVOS_ESTADO.datosCache = resultado.datosDias || [];
      aplicarFiltrosFestivos_();
    })
    .catch(function (err) {
      if (idSolicitud !== FESTIVOS_ESTADO.idSolicitud) return;
      listaEl.innerHTML = '<div class="festivos-vacio">No se ha podido cargar la información.</div>';
      mostrarErrorServidor(err);
    });
}

/* Convierte el resultado crudo de getConteoDia en una lista plana de
 * anotaciones individuales {fecha, tag, tipo, texto, id}, sin agrupar
 * todavía: agrupar y filtrar se hace después, en aplicarFiltrosFestivos_,
 * así los filtros de texto/tipo no necesitan volver a tocar el servidor. */
function aplanarDatosFestivos_(datosDias) {
  const lista = [];
  (datosDias || []).forEach(function (data) {
    if (!data) return;
    (data.notasGenerales || []).forEach(function (n) {
      lista.push({ fecha: data.fecha, tag: 'Nota del día', tipo: n.tipo, texto: n.texto, id: n.id });
    });
    (data.secciones || []).forEach(function (seccion) {
      (seccion.notas || []).forEach(function (n) {
        lista.push({ fecha: data.fecha, tag: parsearNombreAgrupacion(seccion.nombre).titulo, tipo: n.tipo, texto: n.texto, id: n.id });
      });
      (seccion.tiendas || []).forEach(function (t) {
        if (t.cerrada) lista.push({ fecha: data.fecha, tag: t.nombre, tipo: 'cierre', texto: t.motivoCierre || 'Tienda cerrada', id: t.cierreId });
      });
      (seccion.excepcionesSalida || []).forEach(function (e) {
        lista.push({ fecha: data.fecha, tag: parsearNombreAgrupacion(seccion.nombre).titulo, tipo: 'cambio', texto: e.texto, id: e.id });
      });
    });
  });
  return lista;
}

function aplicarFiltrosFestivos_() {
  const listaEl = document.getElementById('festivos-lista');
  const statsEl = document.getElementById('festivos-stats');
  if (!listaEl) return;

  let items = aplanarDatosFestivos_(FESTIVOS_ESTADO.datosCache);

  if (FESTIVOS_ESTADO.filtroDesde && FESTIVOS_ESTADO.filtroHasta) {
    items = items.filter(function (it) { return it.fecha >= FESTIVOS_ESTADO.filtroDesde && it.fecha <= FESTIVOS_ESTADO.filtroHasta; });
  }
  if (FESTIVOS_ESTADO.filtroTipo !== 'todos') {
    items = items.filter(function (it) { return it.tipo === FESTIVOS_ESTADO.filtroTipo; });
  }
  if (FESTIVOS_ESTADO.filtroTexto) {
    const q = FESTIVOS_ESTADO.filtroTexto;
    items = items.filter(function (it) {
      return it.tag.toLowerCase().indexOf(q) !== -1 || it.texto.toLowerCase().indexOf(q) !== -1;
    });
  }

  const porFecha = {};
  items.forEach(function (it) { (porFecha[it.fecha] = porFecha[it.fecha] || []).push(it); });

  const hayFiltrosDeContenido = !!FESTIVOS_ESTADO.filtroTexto || FESTIVOS_ESTADO.filtroTipo !== 'todos';
  const hayFiltrosActivos = hayFiltrosDeContenido || !!(FESTIVOS_ESTADO.filtroDesde && FESTIVOS_ESTADO.filtroHasta);
  const badgeEl = document.getElementById('festivos-filtro-badge');
  if (badgeEl) badgeEl.style.display = hayFiltrosActivos ? 'block' : 'none';

  // Con un filtro de texto o tipo activo solo tiene sentido mostrar los días
  // que de verdad tienen algo que coincida. Sin ese filtro (vista normal),
  // se listan TODOS los días del rango, aunque algunos no tengan nada
  // guardado (se marcan como "Sin ninguna anotación").
  const grupos = hayFiltrosDeContenido
    ? Object.keys(porFecha).sort().map(function (fecha) { return { fecha: fecha, items: porFecha[fecha] }; })
    : (FESTIVOS_ESTADO.diasRango || []).map(function (fecha) { return { fecha: fecha, items: porFecha[fecha] || [] }; });

  renderStatsFestivos_(statsEl, grupos);
  renderListaFestivos_(listaEl, grupos, hayFiltrosDeContenido);
  ajustarAlturaListaScrollable_('festivos-lista');
}

function renderStatsFestivos_(statsEl, grupos) {
  if (!statsEl) return;
  let totalCierres = 0, totalNotas = 0, totalCambios = 0, diasConContenido = 0;
  grupos.forEach(function (g) {
    if (g.items.length) diasConContenido++;
    g.items.forEach(function (it) {
      if (it.tipo === 'cierre') totalCierres++;
      else if (it.tipo === 'cambio') totalCambios++;
      else totalNotas++;
    });
  });
  statsEl.innerHTML =
    '<div class="festivos-stat">' +
      '<span class="icono"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>' +
      '<span class="txt"><span class="valor">' + diasConContenido + '</span><span class="etiqueta">día' + (diasConContenido === 1 ? '' : 's') + '</span></span>' +
    '</div>' +
    '<div class="festivos-stat cierre">' +
      '<span class="icono">' + ICONO_CIERRE_ + '</span>' +
      '<span class="txt"><span class="valor">' + totalCierres + '</span><span class="etiqueta">cierre' + (totalCierres === 1 ? '' : 's') + '</span></span>' +
    '</div>' +
    '<div class="festivos-stat nota">' +
      '<span class="icono">' + ICONO_NOTA_ + '</span>' +
      '<span class="txt"><span class="valor">' + totalNotas + '</span><span class="etiqueta">nota' + (totalNotas === 1 ? '' : 's') + '</span></span>' +
    '</div>' +
    '<div class="festivos-stat cambio">' +
      '<span class="icono">' + ICONO_CAMBIO_ + '</span>' +
      '<span class="txt"><span class="valor">' + totalCambios + '</span><span class="etiqueta">cambio' + (totalCambios === 1 ? '' : 's') + '</span></span>' +
    '</div>';
}

function renderListaFestivos_(listaEl, grupos, hayFiltrosDeContenido) {
  if (!grupos.length) {
    listaEl.innerHTML = hayFiltrosDeContenido
      ? '<div class="festivos-vacio">' +
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
          '<span>Ningún resultado coincide con los filtros aplicados.</span>' +
        '</div>'
      : '<div class="festivos-vacio">' +
          '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
          '<span>Sin cierres ni anotaciones guardados en este rango.</span>' +
        '</div>';
    return;
  }

  const hoy = hoyStr();
  const semana = document.createElement('div');
  semana.className = 'festivos-semana';

  grupos.forEach(function (g) {
    const esHoy = g.fecha === hoy;
    const d = new Date(g.fecha + 'T12:00:00');
    const col = document.createElement('div');
    col.className = 'festivos-dia-col' + (esHoy ? ' es-hoy' : '') + (g.items.length ? '' : ' vacio');
    const itemsHtml = g.items.length
      ? g.items.map(function (it) {
          const clase = it.tipo === 'cierre' ? 'festivos-item cierre' : (it.tipo === 'cambio' ? 'festivos-item cambio' : 'festivos-item');
          const icono = it.tipo === 'cierre' ? ICONO_CIERRE_ : (it.tipo === 'cambio' ? ICONO_CAMBIO_ : ICONO_NOTA_);
          const delBtn = it.id
            ? '<button type="button" class="festivos-del" data-id="' + escapeAttr(it.id) + '" data-tipo="' + escapeAttr(it.tipo) + '" title="Eliminar">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>'
            : '';
          return '<div class="' + clase + '">' +
            '<span class="festivos-item-icon">' + icono + '</span>' +
            '<div class="festivos-item-body">' +
              '<span class="festivos-item-tag">' + escapeHtml(it.tag) + '</span>' +
              '<span class="festivos-item-texto">' + escapeHtml(it.texto) + '</span>' +
            '</div>' + delBtn + '</div>';
        }).join('')
      : '<div class="festivos-item-vacio">Sin ninguna anotación</div>';
    col.innerHTML =
      '<div class="festivos-dia-col-header">' +
        '<button type="button" class="festivos-dia-col-add" data-fecha="' + g.fecha + '" title="Añadir cierre / observación para este día">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
        '</button>' +
        '<div class="festivos-dia-col-badge"><span class="dia">' + d.getDate() + '</span><span class="mes">' + MESES_ES[d.getMonth()].slice(0, 3) + '</span></div>' +
        '<div class="festivos-dia-col-nombre">' + escapeHtml(DIAS_SEMANA_ES[d.getDay()]) +
          (esHoy ? '<span class="festivos-chip-hoy">Hoy</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="festivos-dia-col-items">' + itemsHtml + '</div>';
    semana.appendChild(col);
  });

  listaEl.innerHTML = '';
  listaEl.appendChild(semana);

  listaEl.querySelectorAll('.festivos-dia-col-add').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      abrirGestorObservaciones(btn.getAttribute('data-fecha'));
    };
  });

  listaEl.querySelectorAll('.festivos-del').forEach(function (btn) {
    btn.onclick = function () { eliminarObservacionDesdeFestivos_(btn.getAttribute('data-id'), btn.getAttribute('data-tipo')); };
  });
}

const ICONO_NOTA_ = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>';
const ICONO_CIERRE_ = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>';
const ICONO_CAMBIO_ = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';

// Quita del caché local (FESTIVOS_ESTADO.datosCache) el elemento con el id
// indicado, sin tocar el servidor: permite repintar al instante tras borrar,
// en vez de tener que volver a pedir todo el rango (con su loader y espera).
function quitarDeCacheFestivos_(id) {
  (FESTIVOS_ESTADO.datosCache || []).forEach(function (data) {
    if (!data) return;
    if (data.notasGenerales) {
      data.notasGenerales = data.notasGenerales.filter(function (n) { return n.id !== id; });
    }
    (data.secciones || []).forEach(function (seccion) {
      if (seccion.notas) {
        seccion.notas = seccion.notas.filter(function (n) { return n.id !== id; });
      }
      (seccion.tiendas || []).forEach(function (t) {
        if (t.cerrada && t.cierreId === id) {
          t.cerrada = false;
          t.motivoCierre = '';
          t.cierreId = null;
        }
        if (t.excepcionId === id) {
          t.entraPorExcepcion = false;
          t.excepcionId = null;
        }
      });
      if (seccion.excepcionesSalida) {
        seccion.excepcionesSalida = seccion.excepcionesSalida.filter(function (e) { return e.id !== id; });
      }
    });
  });
}

function eliminarObservacionDesdeFestivos_(id, tipo) {
  appConfirm(
    'Eliminar registro',
    '¿Seguro que quieres eliminar este registro? Esta acción no se puede deshacer.',
    function () {
      // Guardamos una copia del caché para poder revertir si el servidor falla.
      const copiaCache = JSON.parse(JSON.stringify(FESTIVOS_ESTADO.datosCache || []));
      quitarDeCacheFestivos_(id);
      aplicarFiltrosFestivos_();
      mostrarToast('Eliminado');
      const accion = tipo === 'cambio' ? 'eliminarExcepcionTienda' : 'eliminarObservacion';
      llamarApi_(accion, [id])
        .catch(function (err) {
          FESTIVOS_ESTADO.datosCache = copiaCache;
          aplicarFiltrosFestivos_();
          mostrarErrorServidor(err);
        });
    },
    true
  );
}
