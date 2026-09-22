/* SALIDAS · js/plantilla.js — Configuración: Plantilla de conteos (rutas y tiendas) */

/* ---------------- CONFIGURACIÓN: "Plantilla conteos" ----------------
 * Editor de la estructura de cada hoja de día (LUNES, MARTES...): qué
 * rutas hay y qué tiendas tiene cada una, para no tener que abrir la
 * Google Sheet a mano. Solo lectura para cualquier rol; añadir, editar,
 * borrar y reordenar requiere el rol "admin" (igual que el resto de
 * Configuración).
 *
 * OJO: esto edita filas reales de la hoja de conteo (inserta, borra o
 * mueve filas). Mejor evitarlo mientras alguien esté a mitad de rellenar
 * el conteo de ese día en concreto, para no liarse con casillas ya
 * escritas de 60/PTA/CART. Por eso mismo, tras cada cambio se vuelve a
 * pedir la plantilla entera de ese día al servidor (los números de fila
 * cambian al insertar/borrar/mover, así que no se puede hacer una
 * actualización optimista local como en "Gestión festivos").
 */
let PLANTILLA_ESTADO = { dias: [], dia: null, secciones: [] };


/** Busca en el caché local (PLANTILLA_ESTADO.secciones) la tienda con ese
 *  "row" físico. Se usa para editar/borrar en memoria y repintar al
 *  instante, sin volver a pedir toda la plantilla al servidor (mismo
 *  espíritu que quitarDeCacheFestivos_ en "Gestión festivos"). */
function buscarTiendaPlantilla_(row) {
  for (let si = 0; si < PLANTILLA_ESTADO.secciones.length; si++) {
    const s = PLANTILLA_ESTADO.secciones[si];
    const t = s.tiendas.find(function (t) { return t.row === row; });
    if (t) return { seccion: s, tienda: t };
  }
  return null;
}

/** Igual que buscarTiendaPlantilla_ pero para una línea de nota de carga. */
function buscarNotaCargaPlantilla_(row) {
  for (let si = 0; si < PLANTILLA_ESTADO.secciones.length; si++) {
    const s = PLANTILLA_ESTADO.secciones[si];
    const n = s.notasCarga.find(function (n) { return n.row === row; });
    if (n) return { seccion: s, nota: n };
  }
  return null;
}

/** Refleja en memoria el desplazamiento de filas que provoca en la Sheet
 *  borrar (delta=-1) una fila física a partir de "filaDesde" (inclusive):
 *  todo lo que esté en esa fila o por debajo, en CUALQUIER ruta del día,
 *  se desplaza ese mismo número de filas, para que el modelo en memoria
 *  quede coherente con lo que ha hecho de verdad el backend. */
function desplazarRowsPlantillaDesde_(filaDesde, delta) {
  PLANTILLA_ESTADO.secciones.forEach(function (s) {
    s.tiendas.forEach(function (t) {
      if (t.row >= filaDesde) t.row += delta;
      if (t.notaFilaInicio && t.notaFilaInicio >= filaDesde) t.notaFilaInicio += delta;
    });
    s.notasCarga.forEach(function (n) {
      if (n.row >= filaDesde) n.row += delta;
    });
  });
}

/** Ejecuta una acción de "Rutas y tiendas" de forma optimista: aplica el
 *  cambio ya mismo en memoria (mutarLocal) y repinta al instante (sin
 *  loader, sin pedir nada al servidor); la llamada real al backend va en
 *  segundo plano. Si falla, se revierte el cambio local y se repinta con
 *  los datos de antes (igual que "Gestión festivos" al borrar una nota). */
function guardarPlantillaOptimista_(mutarLocal, accionApi, argsApi, mensajeExito, onExito, onError) {
  // onExito (opcional): recibe el resultado que devuelva la API cuando
  // llegue, para acciones que necesitan reaccionar a algo que solo se
  // sabe en el backend (p.ej. avisar de que un renombrado se ha
  // propagado también a otros días). El toast optimista de arriba se
  // sigue mostrando al momento como siempre; onExito puede completarlo
  // o sustituirlo cuando responda el servidor.
  // onError (opcional): recibe el error cuando el backend rechaza la
  // acción, DESPUÉS de revertir ya el cambio optimista local. Si
  // devuelve true, se entiende que el error ya se ha gestionado a mano
  // (p.ej. abriendo un modal para preguntar algo) y no se muestra el
  // toast de error genérico encima.
  const copia = JSON.parse(JSON.stringify(PLANTILLA_ESTADO.secciones));
  mutarLocal();
  pintarPlantilla_();
  if (mensajeExito && !onExito) mostrarToast(mensajeExito);
  llamarApi_(accionApi, argsApi)
    .then(function (resultado) {
      if (onExito) onExito(resultado);
    })
    .catch(function (err) {
      PLANTILLA_ESTADO.secciones = copia;
      pintarPlantilla_();
      if (onError && onError(err)) return;
      mostrarErrorServidor(err);
    });
}

function renderConfigPlantilla() {
  const cont = document.getElementById('config-contenido');
  if (!cont) return;
  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="vista-card-header">' +
        '<h2>Rutas y tiendas</h2>' +
      '</div>' +
      '<p>Configuración de todas las rutas y tiendas de cada hoja de conteo por días.</p>' +
      '<div class="emails-config-solo-lectura">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
        'Solo lectura: entra con la contraseña de administrador para poder editar.' +
      '</div>' +
      '<div class="plantilla-dias-fila" id="plantilla-dias-fila"></div>' +
      '<div id="plantilla-lista"><div class="loader">Cargando…</div></div>' +
    '</div>';

  llamarApi_('getDiasPlantilla', [])
    .then(function (dias) {
      PLANTILLA_ESTADO.dias = dias || [];
      // Si el día que tenía seleccionado de una visita anterior ya no
      // existe (p.ej. se ocultó esa hoja), se olvida. Si NO tenía ninguno
      // seleccionado (primera vez que se entra en esta sección), se deja
      // así -- ya no se carga automáticamente el primer día (antes
      // siempre caía en LUNES): hay que pulsar un día para que cargue.
      if (PLANTILLA_ESTADO.dia && PLANTILLA_ESTADO.dias.indexOf(PLANTILLA_ESTADO.dia) === -1) {
        PLANTILLA_ESTADO.dia = null;
      }
      pintarDiasPlantilla_();
      if (PLANTILLA_ESTADO.dia) {
        cargarPlantilla_();
      } else {
        const listaEl = document.getElementById('plantilla-lista');
        if (listaEl) listaEl.innerHTML = '<div class="festivos-vacio">Elige un día arriba para ver y editar sus rutas.</div>';
      }
    })
    .catch(mostrarErrorServidor);
}

function pintarDiasPlantilla_() {
  const cont = document.getElementById('plantilla-dias-fila');
  if (!cont) return;
  const botonesDias = PLANTILLA_ESTADO.dias.map(function (d) {
    return '<button type="button" class="' + (d === PLANTILLA_ESTADO.dia ? 'activo' : '') + '" data-dia="' + escapeAttr(d) + '">' + escapeHtml(d) + '</button>';
  }).join('');
  cont.innerHTML =
    '<div class="plantilla-dias">' + botonesDias + '</div>' +
    (PLANTILLA_ESTADO.dia ? buscadoresPlantillaHtml_() : '') +
    (tienePermiso('plantilla') && PLANTILLA_ESTADO.dia ? botonAnadirRutaPlantillaHtml_() : '');
  cont.querySelectorAll('.plantilla-dias button').forEach(function (btn) {
    btn.onclick = function () {
      if (btn.getAttribute('data-dia') === PLANTILLA_ESTADO.dia) return;
      PLANTILLA_ESTADO.dia = btn.getAttribute('data-dia');
      pintarDiasPlantilla_();
      cargarPlantilla_();
    };
  });
  const btnAnadirRuta = document.getElementById('btn-plantilla-anadir-ruta');
  if (btnAnadirRuta) btnAnadirRuta.onclick = anadirRutaPlantilla_;
  if (PLANTILLA_ESTADO.dia) inicializarBuscadoresPlantilla_();
}

/** HTML de los dos buscadores de "Rutas y tiendas" (agrupación y tienda):
 *  viven juntos en la fila de días (misma línea que LUNES/MARTES...), que
 *  es "sticky", así que se mantienen visibles al hacer scroll. Cada uno
 *  busca SOLO dentro del día seleccionado. */
function buscadoresPlantillaHtml_() {
  return (
    '<div class="plantilla-buscadores">' +
      buscadorInputPlantillaHtml_('plantilla-buscador-wrap', 'plantilla-buscador-input', 'plantilla-buscador-resultados', 'Buscar agrupación…') +
      buscadorInputPlantillaHtml_('plantilla-buscador-tienda-wrap', 'plantilla-buscador-tienda-input', 'plantilla-buscador-tienda-resultados', 'Buscar tienda…') +
    '</div>'
  );
}

function buscadorInputPlantillaHtml_(wrapId, inputId, resultadosId, placeholder) {
  return (
    '<div class="plantilla-buscador-wrap" id="' + wrapId + '">' +
      '<div class="plantilla-buscador">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<input type="text" id="' + inputId + '" placeholder="' + escapeAttr(placeholder) + '" autocomplete="off">' +
      '</div>' +
      '<div class="plantilla-buscador-resultados" id="' + resultadosId + '" style="display:none;"></div>' +
    '</div>'
  );
}

function cargarPlantilla_(opts) {
  if (ESTADO.vista !== 'configuracion' || ESTADO_CONFIG.seccionActiva !== 'plantilla') return;
  const listaEl = document.getElementById('plantilla-lista');
  if (!listaEl || !PLANTILLA_ESTADO.dia) return;
  // "silencioso": para acciones que insertan/mueven filas (el backend es
  // quien decide la fila exacta, así que hace falta volver a pedir los
  // datos), pero sin el loader ni el salto de scroll de una recarga
  // normal -- se mantiene el contenido anterior visible hasta que llega
  // la respuesta, y se restaura la posición de scroll al terminar.
  const silencioso = opts && opts.silencioso;
  const scrollY = window.scrollY;
  if (!silencioso) listaEl.innerHTML = '<div class="loader">Cargando…</div>';
  llamarApi_('getPlantillaDia', [PLANTILLA_ESTADO.dia])
    .then(function (resultado) {
      if (ESTADO.vista !== 'configuracion' || ESTADO_CONFIG.seccionActiva !== 'plantilla') return;
      PLANTILLA_ESTADO.secciones = (resultado && resultado.secciones) || [];
      pintarPlantilla_();
      if (silencioso) window.scrollTo(0, scrollY);
    })
    .catch(function (err) {
      listaEl.innerHTML = '<div class="festivos-vacio">No se ha podido cargar la plantilla de este día.</div>';
      mostrarErrorServidor(err);
    });
}

function botonAnadirRutaPlantillaHtml_() {
  return '<button type="button" class="btn-anadir-obs plantilla-anadir-ruta" id="btn-plantilla-anadir-ruta">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
    'Añadir ruta nueva</button>';
}

/** Quita acentos y pasa a minúsculas para que la búsqueda de agrupación/
 *  tienda no distinga "islazul" de "Islazul" ni de "íslazul". */
function normalizarBusquedaPlantilla_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** true si ya hay un listener global (en document) para cerrar los
 *  desplegables de los buscadores al hacer click fuera. Se pone a true la
 *  primera vez y no se vuelve a añadir, para no acumular listeners cada
 *  vez que se repinta la fila de días (pintarDiasPlantilla_ se llama en
 *  cada cambio de día). */
let PLANTILLA_BUSCADORES_CLICK_GLOBAL_LISTO_ = false;

/** Al hacer click fuera de un buscador (agrupación o tienda), cierra SOLO
 *  su propio desplegable de resultados (el otro buscador no se ve
 *  afectado si el click fue dentro de él). */
function cerrarDesplegablesBuscadorPlantilla_(ev) {
  document.querySelectorAll('.plantilla-buscador-wrap').forEach(function (wrap) {
    if (wrap.contains(ev.target)) return;
    const res = wrap.querySelector('.plantilla-buscador-resultados');
    if (res) res.style.display = 'none';
  });
}

/** Engancha ambos buscadores de "Rutas y tiendas" (agrupación y tienda) de
 *  la fila de días: cada uno filtra SOLO entre lo que hay en el día
 *  seleccionado (PLANTILLA_ESTADO.secciones). Se vuelve a llamar cada vez
 *  que se repinta la fila de días, porque los inputs se recrean enteros al
 *  cambiar de día. */
function inicializarBuscadoresPlantilla_() {
  if (!PLANTILLA_BUSCADORES_CLICK_GLOBAL_LISTO_) {
    PLANTILLA_BUSCADORES_CLICK_GLOBAL_LISTO_ = true;
    document.addEventListener('click', cerrarDesplegablesBuscadorPlantilla_);
  }

  inicializarBuscadorGenericoPlantilla_('plantilla-buscador-input', 'plantilla-buscador-resultados', function (q) {
    return PLANTILLA_ESTADO.secciones
      .filter(function (s) { return normalizarBusquedaPlantilla_(s.nombre).indexOf(q) !== -1; })
      .slice(0, 8);
  }, pintarResultadosBuscadorAgrupacionPlantilla_);

  inicializarBuscadorGenericoPlantilla_('plantilla-buscador-tienda-input', 'plantilla-buscador-tienda-resultados', function (q) {
    const encontradas = [];
    PLANTILLA_ESTADO.secciones.forEach(function (s) {
      s.tiendas.forEach(function (t) {
        if (normalizarBusquedaPlantilla_(t.nombre).indexOf(q) !== -1) encontradas.push({ tienda: t, ruta: s.nombre });
      });
    });
    return encontradas.slice(0, 8);
  }, pintarResultadosBuscadorTiendaPlantilla_);
}

/** Base común de un buscador con desplegable: al escribir, filtra con
 *  filtroFn(texto normalizado) y pinta el resultado con pintarFn(items,
 *  resultadosEl). Vacío de texto = desplegable cerrado. */
function inicializarBuscadorGenericoPlantilla_(inputId, resultadosId, filtroFn, pintarFn) {
  const input = document.getElementById(inputId);
  const resultadosEl = document.getElementById(resultadosId);
  if (!input || !resultadosEl) return;

  input.addEventListener('input', function () {
    const q = normalizarBusquedaPlantilla_(input.value.trim());
    if (!q) {
      resultadosEl.style.display = 'none';
      resultadosEl.innerHTML = '';
      return;
    }
    pintarFn(filtroFn(q), resultadosEl);
  });

  input.addEventListener('focus', function () {
    if (input.value.trim() && resultadosEl.innerHTML) resultadosEl.style.display = 'block';
  });
}

/** Pinta la lista desplegable de coincidencias del buscador de agrupaciones
 *  (siempre del día activo). */
function pintarResultadosBuscadorAgrupacionPlantilla_(secciones, resultadosEl) {
  if (!secciones.length) {
    resultadosEl.innerHTML = '<div class="plantilla-buscador-vacio">Sin coincidencias.</div>';
    resultadosEl.style.display = 'block';
    return;
  }
  resultadosEl.innerHTML = secciones.map(function (s) {
    const titulo = parsearNombreAgrupacion(s.nombre).titulo;
    return '<button type="button" class="plantilla-buscador-item" data-ruta="' + escapeAttr(s.nombre) + '">' +
      '<span class="nombre">' + escapeHtml(titulo) + '</span>' +
      '<span class="dia-tag">' + s.tiendas.length + (s.tiendas.length === 1 ? ' tienda' : ' tiendas') + '</span>' +
    '</button>';
  }).join('');
  resultadosEl.style.display = 'block';
  resultadosEl.querySelectorAll('.plantilla-buscador-item').forEach(function (btn) {
    btn.onclick = function () { irAAgrupacionPlantilla_(btn.getAttribute('data-ruta'), resultadosEl); };
  });
}

/** Pinta la lista desplegable de coincidencias del buscador de tiendas,
 *  con el nombre de la ruta a la que pertenece cada una a la derecha. */
function pintarResultadosBuscadorTiendaPlantilla_(encontradas, resultadosEl) {
  if (!encontradas.length) {
    resultadosEl.innerHTML = '<div class="plantilla-buscador-vacio">Sin coincidencias.</div>';
    resultadosEl.style.display = 'block';
    return;
  }
  resultadosEl.innerHTML = encontradas.map(function (it) {
    const tituloRuta = parsearNombreAgrupacion(it.ruta).titulo;
    return '<button type="button" class="plantilla-buscador-item" data-tienda-row="' + it.tienda.row + '">' +
      '<span class="nombre">' + escapeHtml(it.tienda.nombre) + '</span>' +
      '<span class="dia-tag">' + escapeHtml(tituloRuta) + '</span>' +
    '</button>';
  }).join('');
  resultadosEl.style.display = 'block';
  resultadosEl.querySelectorAll('.plantilla-buscador-item').forEach(function (btn) {
    btn.onclick = function () { irATiendaPlantilla_(Number(btn.getAttribute('data-tienda-row')), resultadosEl); };
  });
}

/** Al pinchar una agrupación del buscador: como siempre es del día activo,
 *  basta con cerrar su desplegable, vaciar el input y hacer scroll + resaltado. */
function irAAgrupacionPlantilla_(nombreRuta, resultadosEl) {
  resultadosEl.style.display = 'none';
  const input = document.getElementById('plantilla-buscador-input');
  if (input) { input.value = ''; input.blur(); }
  resaltarRutaPlantilla_(nombreRuta);
}

/** Igual que irAAgrupacionPlantilla_ pero para una tienda concreta (por su
 *  "row" físico, único dentro del día). */
function irATiendaPlantilla_(row, resultadosEl) {
  resultadosEl.style.display = 'none';
  const input = document.getElementById('plantilla-buscador-tienda-input');
  if (input) { input.value = ''; input.blur(); }
  resaltarTiendaPlantilla_(row);
}

/** Hace scroll hasta la ruta indicada (por su nombre exacto) dentro de
 *  "Rutas y tiendas" y la resalta un momento para que se note cuál es. */
function resaltarRutaPlantilla_(nombreRuta) {
  const el = document.querySelector('.plantilla-ruta[data-ruta-nombre="' + CSS.escape(nombreRuta) + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('plantilla-ruta-resaltada');
  setTimeout(function () { el.classList.remove('plantilla-ruta-resaltada'); }, 2200);
}

/** Hace scroll hasta la tienda indicada (por su "row" físico) dentro de
 *  "Rutas y tiendas" y la resalta un momento para que se note cuál es. */
function resaltarTiendaPlantilla_(row) {
  const el = document.querySelector('.plantilla-tienda[data-tienda-row="' + row + '"]');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('plantilla-tienda-resaltada');
  setTimeout(function () { el.classList.remove('plantilla-tienda-resaltada'); }, 2200);
}



/** Si el nombre de una tienda sigue el formato estándar "NNN - NOMBRE"
 *  (3 dígitos, guion, nombre), lo separa en { numero, resto } para poder
 *  editarlo con los mismos dos campos que "Añadir tienda" (evita volver a
 *  mezclar formatos al editar). Las pocas tiendas antiguas que no siguen
 *  ese formato (p.ej. sin número) devuelven null y se editan como texto
 *  libre, igual que siempre. */
function dividirNombreTiendaPlantilla_(nombre) {
  const m = String(nombre || '').match(/^(\d{3})\s*-\s*(.*)$/);
  return m ? { numero: m[1], resto: m[2] } : null;
}

/** Botón pequeño "60"/"PTA"/"CART." para bloquear (poner "NO") o
 *  desbloquear la casilla correspondiente de una tienda, desde "Rutas y
 *  tiendas". campo: 'c60' | 'pta' | 'cart'. Visible para todos (para que
 *  el usuario normal vea qué está bloqueado), pero solo pulsable si es
 *  admin. */
function botonBloqueoPlantillaHtml_(t, campo, etiqueta) {
  const bloqueado = campo === 'c60' ? t.bloqueo60 : (campo === 'pta' ? t.bloqueoPta : t.bloqueoCart);
  const titulo = bloqueado
    ? 'Quitar el bloqueo "NO" de ' + etiqueta + ' en esta tienda'
    : 'Bloquear la casilla ' + etiqueta + ' en los conteos';
  return '<button type="button" class="plantilla-tienda-bloqueo' + (bloqueado ? ' activo' : '') + '" data-bloqueo-row="' + t.row + '" data-bloqueo-campo="' + campo + '" data-bloqueo-activo="' + (bloqueado ? '1' : '0') + '" title="' + titulo + '"' + (tienePermiso('plantilla') ? '' : ' disabled') + '>' + etiqueta + '</button>';
}

function pintarPlantilla_() {
  const listaEl = document.getElementById('plantilla-lista');
  if (!listaEl) return;

  if (!PLANTILLA_ESTADO.secciones.length) {
    listaEl.innerHTML = '<div class="festivos-vacio">Sin rutas configuradas para este día.</div>';
    return;
  }

  listaEl.innerHTML = PLANTILLA_ESTADO.secciones.map(function (s, si) {
    let piezasTiendas = [];
    s.tiendas.forEach(function (t, ti) {
      const idSeguro = 'pt' + si + '_' + ti;
      const tieneNota = !!t.nota;

      const partesNombre = dividirNombreTiendaPlantilla_(t.nombre);
      const camposNombreHtml = partesNombre
        ? '<span class="numero" title="Número de tienda">' + escapeHtml(partesNombre.numero) + '</span>' +
          '<span class="nombre" title="Nombre de la tienda">' + escapeHtml(partesNombre.resto) + '</span>'
        : '<span class="nombre" title="Nombre de la tienda">' + escapeHtml(t.nombre) + '</span>';

      const notaLineaHtml = tieneNota
        ? '<div class="plantilla-tienda-notatxt" title="' + (t.notaGrupoId ? 'Grupo de palets' : 'Comentario de la tienda') + '">' +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>' +
            '<span>' + escapeHtml(t.nota) + '</span>' +
            (t.notaGrupoId
              ? '<span class="plantilla-tienda-notatxt-extra">' + (t.notaGrupoTipo === 'total' ? 'total' : ('máx ' + (t.notaLimite != null ? t.notaLimite : '?'))) + ' · ' + (t.notaNumFilas || 1) + ' tiendas</span>'
              : '') +
          '</div>'
        : '';

      piezasTiendas.push(
        '<div class="plantilla-tienda' + (ti === 0 ? ' primera' : '') + (tieneNota ? ' con-nota' : '') + '" data-tienda-row="' + t.row + '">' +
          '<div class="plantilla-tienda-flechas">' +
            '<button type="button" data-subir="' + t.row + '"' + (ti === 0 ? ' disabled' : '') + ' title="Subir">' +
              '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>' +
            '<button type="button" data-bajar="' + t.row + '"' + (ti === s.tiendas.length - 1 ? ' disabled' : '') + ' title="Bajar">' +
              '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
          '</div>' +
          '<span class="lim' + (t.limiteOverride ? ' lim-override' : '') + '" title="' + (t.limiteOverride ? 'Límite propio de este día (distinto del general de Configuración tiendas: ' + escapeAttr(t.limiteGeneral != null ? t.limiteGeneral : 'sin definir') + ')' : 'Límite (el general de Configuración tiendas)') + '">' + escapeHtml(textoLimite_(t.limite)) + '</span>' +
          camposNombreHtml +
          '<div class="plantilla-tienda-bloqueos">' +
            botonBloqueoPlantillaHtml_(t, 'c60', '60') +
            botonBloqueoPlantillaHtml_(t, 'pta', 'PTA') +
            botonBloqueoPlantillaHtml_(t, 'cart', 'CART.') +
          '</div>' +
          '<button type="button" class="plantilla-tienda-nota' + (tieneNota ? ' con-dato' : '') + '" data-nota-fila="' + t.row + '" data-nota-texto="' + escapeAttr(t.nota || '') + '" data-nota-grupo="' + (t.notaGrupoId ? '1' : '0') + '" title="' + (t.notaGrupoId ? 'Pertenece a un grupo de palets: edítalo desde Grupos de palets' : (tieneNota ? 'Editar comentario' : 'Añadir comentario')) + '"' + (tienePermiso('plantilla') ? '' : ' disabled') + '>' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg></button>' +
          (tienePermiso('plantilla') ? (
            '<button type="button" class="plantilla-tienda-mover" data-mover-tienda="' + t.row + '" title="Mover a otra agrupación">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg></button>' +
            '<button type="button" class="plantilla-tienda-editar" data-editar-tienda="' + t.row + '" title="Límite de palets de esta tienda">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>' +
            '<button type="button" class="plantilla-tienda-borrar" data-borrar-tienda="' + t.row + '" title="Eliminar tienda">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>'
          ) : '') +
          notaLineaHtml +
        '</div>'
      );
    });
    const tiendasHtml = piezasTiendas.join('');

    const notasCargaHtml = s.notasCarga.map(function (n, ni) {
      const idn = 'nc' + si + '_' + ni;
      return (
        '<div class="plantilla-notacarga-item">' +
          '<input type="text" id="' + idn + '" value="' + escapeAttr(n.texto) + '" ' + (tienePermiso('plantilla') ? '' : 'disabled') + '>' +
          (tienePermiso('plantilla') ? (
            '<button type="button" class="plantilla-tienda-guardar" data-guardar-notacarga="' + n.row + '" data-id="' + idn + '" title="Guardar" disabled>' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></button>' +
            '<button type="button" class="plantilla-tienda-borrar" data-borrar-notacarga="' + n.row + '" title="Eliminar nota de carga">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>'
          ) : '') +
        '</div>'
      );
    }).join('');

    return (
      '<div class="plantilla-ruta" data-ruta-nombre="' + escapeAttr(s.nombre) + '">' +
        '<div class="plantilla-ruta-header">' +
          '<div class="plantilla-ruta-flechas">' +
            '<button type="button" data-subir-ruta="' + escapeAttr(s.nombre) + '"' + (si === 0 ? ' disabled' : '') + ' title="Subir ruta">' +
              '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg></button>' +
            '<button type="button" data-bajar-ruta="' + escapeAttr(s.nombre) + '"' + (si === PLANTILLA_ESTADO.secciones.length - 1 ? ' disabled' : '') + ' title="Bajar ruta">' +
              '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
          '</div>' +
          '<span class="plantilla-ruta-nombre-texto">' + escapeHtml(s.nombre) + '</span>' +
          (tienePermiso('plantilla')
            ? '<button type="button" class="plantilla-ruta-editar" data-editar-ruta="' + escapeAttr(s.nombre) + '" title="Editar ubicación y hora de carga">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>'
            : '') +
          '<span class="plantilla-ruta-contador">' + s.tiendas.length + (s.tiendas.length === 1 ? ' tienda' : ' tiendas') + '</span>' +
          '<div class="plantilla-ruta-spacer"></div>' +
          (tienePermiso('plantilla') ? (
            '<button type="button" class="plantilla-ruta-peso' + (s.tienePeso ? ' activo' : '') + '" data-toggle-peso="' + escapeAttr(s.nombre) + '" data-peso-activo="' + (s.tienePeso ? '1' : '0') + '" title="' + (s.tienePeso ? 'Quitar la casilla PESO de esta ruta' : 'Activar la casilla PESO en el conteo de esta ruta') + '">PESO</button>' +
            '<button type="button" class="plantilla-ruta-cexpress' + (s.tieneCExpress ? ' activo' : '') + '" data-toggle-cexpress="' + escapeAttr(s.nombre) + '" data-cexpress-activo="' + (s.tieneCExpress ? '1' : '0') + '" title="' + (s.tieneCExpress ? 'Quitar la casilla C.EXPRESS de esta ruta' : 'Activar la casilla C.EXPRESS en el conteo de esta ruta') + '">C.EXPRESS</button>' +
            '<button type="button" class="plantilla-ruta-sobrestock' + (s.tieneSobrestock ? ' activo' : '') + '" data-toggle-sobrestock="' + escapeAttr(s.nombre) + '" data-sobrestock-activo="' + (s.tieneSobrestock ? '1' : '0') + '" title="' + (s.tieneSobrestock ? 'Quitar la casilla SOBRESTOCK de esta ruta' : 'Activar la casilla SOBRESTOCK en el conteo de esta ruta') + '">SOBRESTOCK</button>' +
            '<button type="button" class="plantilla-ruta-pdfespecial' + (s.tienePdfEspecial ? ' activo' : '') + '" data-toggle-pdfespecial="' + escapeAttr(s.nombre) + '" data-pdfespecial-activo="' + (s.tienePdfEspecial ? '1' : '0') + '" title="' + (s.tienePdfEspecial ? 'Quitar el PDF ESPECIAL de esta ruta' : 'Activar el PDF ESPECIAL para esta ruta') + '">PDF ESPECIAL</button>' +
            '<button type="button" class="plantilla-ruta-orden' + (s.ordenRetirada && s.ordenRetirada.length ? ' activo' : '') + '" data-orden-ruta="' + escapeAttr(s.nombre) + '" title="' + (s.ordenRetirada && s.ordenRetirada.length ? 'Editar el orden de retirada (' + s.ordenRetirada.length + ' tienda(s))' : 'Configurar el orden en que se quitan los palets de esta ruta') + '">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>' +
              'Orden retirada' + (s.ordenRetirada && s.ordenRetirada.length ? ' (' + s.ordenRetirada.length + ')' : '') +
            '</button>' +
            (function () {
              const numGrupos = new Set(s.tiendas.filter(function (t) { return t.notaGrupoId; }).map(function (t) { return t.notaGrupoId; })).size;
              return '<button type="button" class="plantilla-ruta-grupos' + (numGrupos ? ' activo' : '') + '" data-grupos-ruta="' + escapeAttr(s.nombre) + '" title="' + (numGrupos ? 'Editar los grupos de palets (' + numGrupos + ')' : 'Agrupar tiendas que comparten un límite de palets') + '">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' +
                'Grupos de palets' + (numGrupos ? ' (' + numGrupos + ')' : '') +
              '</button>';
            })() +
            '<button type="button" class="plantilla-ruta-anadir-tienda" data-anadir-tienda-ruta="' + escapeAttr(s.nombre) + '" title="Añadir tienda a esta ruta">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Añadir tienda</button>' +
            '<button type="button" class="plantilla-ruta-borrar" data-borrar-ruta="' + escapeAttr(s.nombre) + '" title="Eliminar ruta completa">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg></button>'
          ) : '') +
        '</div>' +
        (notasCargaHtml || tienePermiso('plantilla') ? (
          '<div class="plantilla-notascarga">' +
            notasCargaHtml +
            (tienePermiso('plantilla') ? '<button type="button" class="plantilla-anadir-notacarga" data-anadir-notacarga="' + escapeAttr(s.nombre) + '">' +
              '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Añadir nota de carga</button>' : '') +
          '</div>'
        ) : '') +
        '<div class="plantilla-tiendas">' + (tiendasHtml || '<div class="festivos-item-vacio">Sin tiendas todavía.</div>') + '</div>' +
      '</div>'
    );
  }).join('');

  listaEl.querySelectorAll('[data-nota-fila]').forEach(function (btn) {
    btn.onclick = function () {
      const row = Number(btn.getAttribute('data-nota-fila'));
      if (btn.getAttribute('data-nota-grupo') === '1') {
        const encontrado = buscarTiendaPlantilla_(row);
        if (encontrado) abrirModalGruposLimitePlantilla_(encontrado.seccion.nombre);
        return;
      }
      abrirModalNotaTiendaPlantilla_(row, btn.getAttribute('data-nota-texto'));
    };
  });
  listaEl.querySelectorAll('[data-guardar-notacarga]').forEach(function (btn) {
    btn.onclick = function () { guardarNotaCargaPlantilla_(btn.getAttribute('data-guardar-notacarga'), btn.getAttribute('data-id')); };
  });
  listaEl.querySelectorAll('[data-borrar-notacarga]').forEach(function (btn) {
    btn.onclick = function () { confirmarEliminarNotaCargaPlantilla_(btn.getAttribute('data-borrar-notacarga')); };
  });
  listaEl.querySelectorAll('[data-anadir-notacarga]').forEach(function (btn) {
    btn.onclick = function () { abrirModalAnadirNotaCargaPlantilla_(btn.getAttribute('data-anadir-notacarga')); };
  });
  listaEl.querySelectorAll('.plantilla-notacarga-item').forEach(function (item) {
    const input = item.querySelector('input');
    const boton = item.querySelector('.plantilla-tienda-guardar');
    if (!input || !boton) return;
    const refrescar = function () {
      const cambiado = input.value !== input.defaultValue;
      item.classList.toggle('dirty', cambiado);
      boton.disabled = !cambiado;
    };
    input.addEventListener('input', refrescar);
  });

  listaEl.querySelectorAll('[data-editar-tienda]').forEach(function (btn) {
    btn.onclick = function () { abrirModalEditarTiendaPlantilla_(btn.getAttribute('data-editar-tienda')); };
  });
  listaEl.querySelectorAll('[data-borrar-tienda]').forEach(function (btn) {
    btn.onclick = function () { confirmarEliminarTiendaPlantilla_(btn.getAttribute('data-borrar-tienda')); };
  });
  listaEl.querySelectorAll('[data-mover-tienda]').forEach(function (btn) {
    btn.onclick = function () { confirmarMoverTiendaPlantilla_(btn.getAttribute('data-mover-tienda')); };
  });
  listaEl.querySelectorAll('[data-subir]').forEach(function (btn) {
    btn.onclick = function () { moverTiendaPlantilla_(btn.getAttribute('data-subir'), 'arriba'); };
  });
  listaEl.querySelectorAll('[data-bajar]').forEach(function (btn) {
    btn.onclick = function () { moverTiendaPlantilla_(btn.getAttribute('data-bajar'), 'abajo'); };
  });
  listaEl.querySelectorAll('[data-subir-ruta]').forEach(function (btn) {
    btn.onclick = function () { moverRutaPlantilla_(btn.getAttribute('data-subir-ruta'), 'arriba'); };
  });
  listaEl.querySelectorAll('[data-bajar-ruta]').forEach(function (btn) {
    btn.onclick = function () { moverRutaPlantilla_(btn.getAttribute('data-bajar-ruta'), 'abajo'); };
  });
  listaEl.querySelectorAll('[data-anadir-tienda-ruta]').forEach(function (btn) {
    btn.onclick = function () { abrirModalAnadirTiendaPlantilla_(btn.getAttribute('data-anadir-tienda-ruta')); };
  });
  listaEl.querySelectorAll('[data-editar-ruta]').forEach(function (btn) {
    btn.onclick = function () { abrirModalEditarRutaPlantilla_(btn.getAttribute('data-editar-ruta')); };
  });

  listaEl.querySelectorAll('[data-borrar-ruta]').forEach(function (btn) {
    btn.onclick = function () { confirmarEliminarRutaPlantilla_(btn.getAttribute('data-borrar-ruta')); };
  });
  listaEl.querySelectorAll('[data-toggle-peso]').forEach(function (btn) {
    btn.onclick = function () { togglePesoRutaPlantilla_(btn.getAttribute('data-toggle-peso'), btn.getAttribute('data-peso-activo') === '1'); };
  });
  listaEl.querySelectorAll('[data-toggle-cexpress]').forEach(function (btn) {
    btn.onclick = function () { toggleCExpressRutaPlantilla_(btn.getAttribute('data-toggle-cexpress'), btn.getAttribute('data-cexpress-activo') === '1'); };
  });
  listaEl.querySelectorAll('[data-toggle-sobrestock]').forEach(function (btn) {
    btn.onclick = function () { toggleSobrestockRutaPlantilla_(btn.getAttribute('data-toggle-sobrestock'), btn.getAttribute('data-sobrestock-activo') === '1'); };
  });
  listaEl.querySelectorAll('[data-toggle-pdfespecial]').forEach(function (btn) {
    btn.onclick = function () { togglePdfEspecialRutaPlantilla_(btn.getAttribute('data-toggle-pdfespecial'), btn.getAttribute('data-pdfespecial-activo') === '1'); };
  });
  listaEl.querySelectorAll('[data-orden-ruta]').forEach(function (btn) {
    btn.onclick = function () { abrirModalOrdenRetiradaPlantilla_(btn.getAttribute('data-orden-ruta')); };
  });
  listaEl.querySelectorAll('[data-grupos-ruta]').forEach(function (btn) {
    btn.onclick = function () { abrirModalGruposLimitePlantilla_(btn.getAttribute('data-grupos-ruta')); };
  });
  listaEl.querySelectorAll('[data-bloqueo-row]').forEach(function (btn) {
    btn.onclick = function () {
      toggleBloqueoCampoTiendaPlantilla_(
        btn.getAttribute('data-bloqueo-row'),
        btn.getAttribute('data-bloqueo-campo'),
        btn.getAttribute('data-bloqueo-activo') === '1'
      );
    };
  });
}

/** Activa/desactiva la casilla PESO de una ruta desde "Rutas y tiendas".
 *  Al desactivarla se pide confirmación, porque borra también los valores
 *  de peso ya guardados en esa ruta (ver desactivarPesoRuta en el backend). */
function togglePesoRutaPlantilla_(nombreRuta, activoActualmente) {
  const mutar = function () {
    const s = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreRuta; });
    if (s) s.tienePeso = !activoActualmente;
  };
  if (activoActualmente) {
    appConfirm(
      'Quitar la casilla PESO',
      '¿Seguro que quieres quitar la casilla PESO de "' + nombreRuta + '"? Se borrarán los valores de peso ya guardados en esta ruta.',
      function () { guardarPlantillaOptimista_(mutar, 'desactivarPesoRuta', [PLANTILLA_ESTADO.dia, nombreRuta], 'Casilla PESO desactivada'); },
      true
    );
    return;
  }
  guardarPlantillaOptimista_(mutar, 'activarPesoRuta', [PLANTILLA_ESTADO.dia, nombreRuta], 'Casilla PESO activada');
}

/** Activa/desactiva la casilla C.EXPRESS de una ruta desde "Rutas y tiendas".
 *  Igual que PESO: al desactivarla se pide confirmación porque borra los
 *  valores ya guardados en esa ruta (ver desactivarCExpressRuta en el
 *  backend). A diferencia de PESO, C.EXPRESS sí se suma al TOTAL de cada
 *  tienda (ver recalcTotal en attachCalculoYValidacion). */
function toggleCExpressRutaPlantilla_(nombreRuta, activoActualmente) {
  const mutar = function () {
    const s = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreRuta; });
    if (s) s.tieneCExpress = !activoActualmente;
  };
  if (activoActualmente) {
    appConfirm(
      'Quitar la casilla C.EXPRESS',
      '¿Seguro que quieres quitar la casilla C.EXPRESS de "' + nombreRuta + '"? Se borrarán los valores de C.EXPRESS ya guardados en esta ruta.',
      function () { guardarPlantillaOptimista_(mutar, 'desactivarCExpressRuta', [PLANTILLA_ESTADO.dia, nombreRuta], 'Casilla C.EXPRESS desactivada'); },
      true
    );
    return;
  }
  guardarPlantillaOptimista_(mutar, 'activarCExpressRuta', [PLANTILLA_ESTADO.dia, nombreRuta], 'Casilla C.EXPRESS activada');
}

/** Activa/desactiva la casilla SOBRESTOCK de una ruta desde "Rutas y
 *  tiendas". Igual que C.EXPRESS: al desactivarla se pide confirmación
 *  porque borra los valores ya guardados en esa ruta (ver
 *  desactivarSobrestockRuta en el backend), y SOBRESTOCK también se suma
 *  al TOTAL de cada tienda (ver recalcTotal en attachCalculoYValidacion). */
function toggleSobrestockRutaPlantilla_(nombreRuta, activoActualmente) {
  const mutar = function () {
    const s = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreRuta; });
    if (s) s.tieneSobrestock = !activoActualmente;
  };
  if (activoActualmente) {
    appConfirm(
      'Quitar la casilla SOBRESTOCK',
      '¿Seguro que quieres quitar la casilla SOBRESTOCK de "' + nombreRuta + '"? Se borrarán los valores de SOBRESTOCK ya guardados en esta ruta.',
      function () { guardarPlantillaOptimista_(mutar, 'desactivarSobrestockRuta', [PLANTILLA_ESTADO.dia, nombreRuta], 'Casilla SOBRESTOCK desactivada'); },
      true
    );
    return;
  }
  guardarPlantillaOptimista_(mutar, 'activarSobrestockRuta', [PLANTILLA_ESTADO.dia, nombreRuta], 'Casilla SOBRESTOCK activada');
}

/** Activa/desactiva el "PDF ESPECIAL" de una ruta desde "Rutas y tiendas".
 *  A diferencia de PESO, aquí no hay valores guardados que se pierdan al
 *  desactivar (los campos del PDF especial se rellenan a mano en el papel,
 *  no se guardan en la Sheet), así que no hace falta pedir confirmación. */
function togglePdfEspecialRutaPlantilla_(nombreRuta, activoActualmente) {
  const accion = activoActualmente ? 'desactivarPdfEspecial' : 'activarPdfEspecial';
  const mutar = function () {
    const s = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreRuta; });
    if (s) s.tienePdfEspecial = !activoActualmente;
  };
  guardarPlantillaOptimista_(mutar, accion, [PLANTILLA_ESTADO.dia, nombreRuta], activoActualmente ? 'PDF ESPECIAL desactivado' : 'PDF ESPECIAL activado');
}

/** Bloquea o desbloquea la casilla 60/PTA/CART de una tienda concreta,
 *  desde "Rutas y tiendas" (equivale a escribir/borrar "NO" a mano en la
 *  Sheet). Al bloquear se pide confirmación, porque sobrescribe cualquier
 *  valor que hubiera en esa celda (por ejemplo un conteo ya metido hoy). */
function toggleBloqueoCampoTiendaPlantilla_(row, campo, activoActualmente) {
  row = Number(row);
  const etiquetas = { c60: '60', pta: 'PTA', cart: 'CART.' };
  const etiqueta = etiquetas[campo] || campo;
  const claveBloqueo = campo === 'c60' ? 'bloqueo60' : (campo === 'pta' ? 'bloqueoPta' : 'bloqueoCart');
  const mutar = function () {
    const info = buscarTiendaPlantilla_(row);
    if (info) info.tienda[claveBloqueo] = !activoActualmente;
  };

  if (activoActualmente) {
    guardarPlantillaOptimista_(mutar, 'desbloquearCampoTiendaPlantilla', [PLANTILLA_ESTADO.dia, row, campo], 'Bloqueo quitado');
    return;
  }

  appConfirm(
    'Bloquear ' + etiqueta,
    'Esta tienda quedará marcada como "NO" en ' + etiqueta + ' (no debería recibir palets ahí ese día de la semana). Si esa casilla ya tenía algo escrito, se sobrescribirá. ¿Seguro?',
    function () { guardarPlantillaOptimista_(mutar, 'bloquearCampoTiendaPlantilla', [PLANTILLA_ESTADO.dia, row, campo], 'Bloqueado'); },
    true
  );
}

/** Botón de lápiz de una fila de tienda: abre un modal para editar el
 *  límite, el número y el nombre a la vez (en vez de los campos sueltos
 *  que había antes en la propia fila). */
/** Editar tienda desde "Rutas y tiendas": SOLO el límite de palets de
 *  este día (o volver a usar el general). El número y el nombre de la
 *  tienda ya NO se pueden cambiar desde aquí -- renombrar_tienda_config
 *  (Configuración tiendas) es el único sitio que actualiza a la vez
 *  Config_Tiendas y TODAS las apariciones en tiendas_ruta, así las dos
 *  quedan siempre sincronizadas; editar_tienda_plantilla (este RPC) solo
 *  tocaba tiendas_ruta, así que renombrar desde aquí podía desincronizar
 *  el nombre/clave con Configuración tiendas (roturas de email, tránsito,
 *  límite general...). Se sigue mandando el nombre actual sin tocar al
 *  guardar, para no reventar el contrato del RPC (que lo exige). */
function abrirModalEditarTiendaPlantilla_(row) {
  row = Number(row);
  const info = buscarTiendaPlantilla_(row);
  if (!info) return;

  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Límite de palets — ' + info.tienda.nombre;
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const limiteGeneralTxt = info.tienda.limiteGeneral != null ? info.tienda.limiteGeneral : 'sin definir';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label>Límite de palets</label>' +
      '<div class="modal-limite-pills">' +
        '<button type="button" class="modal-limite-pill' + (info.tienda.limiteOverride ? '' : ' activa') + '" data-opcion="general">Usar el general (' + escapeHtml(limiteGeneralTxt) + ')</button>' +
        '<button type="button" class="modal-limite-pill' + (info.tienda.limiteOverride ? ' activa' : '') + '" data-opcion="propio">Usar uno distinto solo este día</button>' +
      '</div>' +
      '<input type="text" id="modal-editar-tienda-lim" inputmode="numeric" placeholder="Ej: 6" style="margin-top:8px;' + (info.tienda.limiteOverride ? '' : 'display:none;') + '" value="' + escapeAttr(info.tienda.limiteOverride ? info.tienda.limite : '') + '">' +
      '<span class="modal-campo-ayuda">El general se edita desde Configuración tiendas y se aplica a todos los días que no tengan aquí un valor propio.</span>' +
    '</div>' +
    '<p class="modal-campo-ayuda" style="margin-top:2px;">El número y el nombre de la tienda se cambian desde <b>Configuración tiendas</b>: se actualizan solos en todas las rutas donde aparezca.</p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;

  const inputLim = document.getElementById('modal-editar-tienda-lim');

  let usaLimitePropio = !!info.tienda.limiteOverride;
  custom.querySelectorAll('.modal-limite-pill').forEach(function (btn) {
    btn.onclick = function () {
      usaLimitePropio = (btn.getAttribute('data-opcion') === 'propio');
      custom.querySelectorAll('.modal-limite-pill').forEach(function (b) { b.classList.toggle('activa', b === btn); });
      inputLim.style.display = usaLimitePropio ? '' : 'none';
      if (usaLimitePropio) { inputLim.focus(); }
    };
  });

  document.getElementById('modal-confirm-btn').onclick = function () {
    let limite = '';
    if (usaLimitePropio) {
      limite = inputLim.value.trim();
      if (limite === '' || isNaN(Number(limite))) { inputLim.focus(); return; }
    }
    const nombre = info.tienda.nombre; // sin cambios: el nombre solo se toca desde Configuración tiendas
    cerrarModal();
    const mutar = function () {
      const infoActual = buscarTiendaPlantilla_(row);
      if (infoActual) {
        infoActual.tienda.limiteOverride = usaLimitePropio;
        infoActual.tienda.limite = usaLimitePropio ? Number(limite) : infoActual.tienda.limiteGeneral;
      }
    };
    guardarPlantillaOptimista_(mutar, 'editarTiendaPlantilla', [PLANTILLA_ESTADO.dia, row, nombre, limite], 'Guardado');
  };
  setTimeout(function () { (inputNumero || inputNombre).focus(); }, 50);
}

function confirmarEliminarTiendaPlantilla_(row) {
  row = Number(row);
  // Antes de pedir confirmación, se comprueba si esta misma tienda (misma
  // clave interna) aparece también en otros días. Si es así, se ofrece
  // borrarla de golpe en todos esos días a la vez, para no dejar "restos"
  // sueltos que luego salgan como huérfanos en Configuración tiendas.
  llamarApi_('otrasAparicionesTiendaPlantilla', [PLANTILLA_ESTADO.dia, row])
    .then(function (resultado) {
      const dias = (resultado && resultado.dias) || [];
      if (!dias.length) {
        appConfirm(
          'Eliminar tienda',
          '¿Seguro que quieres eliminar esta tienda de la plantilla? Esta acción no se puede deshacer.',
          function () { eliminarTiendaPlantilla_(row); },
          true
        );
        return;
      }
      mostrarModalEliminarTiendaVariosDias_(row, dias);
    })
    .catch(mostrarErrorServidor);
}

/** Modal con 3 opciones cuando la tienda que se va a borrar también
 *  aparece en otros días: cancelar, borrar solo el día actual, o borrar
 *  de golpe en todos los días donde aparezca. */
function mostrarModalEliminarTiendaVariosDias_(row, dias) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Esta tienda aparece en más días';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Esta misma tienda también está en: <b>' +
      dias.map(escapeHtml).join(', ') +
      '</b>. Si borras solo aquí, seguirá existiendo con normalidad en esos otros días (no se queda huérfana). Usa "Borrar en todos" solo si quieres quitarla por completo de la plantilla.</p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-borrar-aqui-btn">Borrar solo aquí</button>' +
    '<button class="modal-confirm danger" id="modal-borrar-todos-btn">Borrar en todos (' + (dias.length + 1) + ' días)</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-borrar-aqui-btn').onclick = function () { cerrarModal(); eliminarTiendaPlantilla_(row); };
  document.getElementById('modal-borrar-todos-btn').onclick = function () { cerrarModal(); eliminarTiendaPlantillaTodosDias_(row); };
}

/** Modal con 2 opciones cuando la tienda que se va a borrar tiene
 *  conteos guardados de días anteriores: borrarlos también (se pierden
 *  para siempre) o conservarlos (la tienda se oculta de la plantilla,
 *  pero su histórico sigue intacto y consultable en esos días). */
function mostrarModalEliminarTiendaConHistorico_(row, nConteos) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Esta tienda tiene conteos guardados';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Esta tienda tiene ' + nConteos + ' conteo(s) guardado(s) de días anteriores. ¿Qué quieres hacer con ese histórico?</p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-conservar-btn">Conservar histórico (ocultar tienda)</button>' +
    '<button class="modal-confirm danger" id="modal-borrar-hist-btn">Borrar también el histórico</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-conservar-btn').onclick = function () { cerrarModal(); eliminarTiendaPlantilla_(row, 'conservar_historico'); };
  document.getElementById('modal-borrar-hist-btn').onclick = function () { cerrarModal(); eliminarTiendaPlantilla_(row, 'borrar_historico'); };
}

function eliminarTiendaPlantilla_(row, modo) {
  row = Number(row);
  const mutar = function () {
    const info = buscarTiendaPlantilla_(row);
    if (!info) return;
    info.seccion.tiendas.splice(info.seccion.tiendas.indexOf(info.tienda), 1);
    desplazarRowsPlantillaDesde_(row + 1, -1);
  };
  guardarPlantillaOptimista_(mutar, 'eliminarTiendaPlantilla', [PLANTILLA_ESTADO.dia, row, modo || null], 'Eliminada', null,
    function (err) {
      const m = err && err.message ? err.message : '';
      const match = /^REQUIERE_ELECCION_HISTORICO:(\d+)/.exec(m);
      if (match) {
        mostrarModalEliminarTiendaConHistorico_(row, Number(match[1]));
        return true; // ya gestionado: no mostrar el toast de error genérico
      }
      return false;
    });
}

/** Borra esta tienda de golpe en TODOS los días donde aparezca (misma
 *  clave interna). Como afecta a días que no se están viendo ahora mismo,
 *  se recarga la plantilla del día actual desde el servidor en vez de
 *  mutar el estado local a mano. */
function eliminarTiendaPlantillaTodosDias_(row) {
  row = Number(row);
  llamarApi_('eliminarTiendaPlantillaTodosDias', [PLANTILLA_ESTADO.dia, row])
    .then(function (resultado) {
      const eliminadas = (resultado && resultado.eliminadas) || 0;
      const ocultadas = (resultado && resultado.ocultadas) || 0;
      let mensaje;
      if (ocultadas > 0) {
        // Alguna(s) aparición(es) tenía(n) conteos guardados: no se han
        // borrado, solo se han ocultado (para conservar ese histórico).
        mensaje = 'Eliminada de ' + eliminadas + ' día(s)' +
          (ocultadas > 0 ? ', y ocultada (por tener histórico) en ' + ocultadas + ' día(s) más' : '');
      } else {
        mensaje = 'Eliminada de ' + eliminadas + ' día(s)';
      }
      mostrarToast(mensaje);
      cargarPlantilla_({ silencioso: true });
    })
    .catch(mostrarErrorServidor);
}

/** Punto de entrada del botón "Mover a otra agrupación" de cada fila de
 *  tienda. Reutiliza PLANTILLA_ESTADO.secciones (ya cargado en memoria)
 *  para ofrecer como destino cualquier otra agrupación del día actual, sin
 *  tener que pedir nada más al servidor todavía. */
function confirmarMoverTiendaPlantilla_(row) {
  row = Number(row);
  const info = buscarTiendaPlantilla_(row);
  if (!info) return;
  const seccionActual = info.seccion.nombre;
  const destinos = PLANTILLA_ESTADO.secciones
    .map(function (s) { return s.nombre; })
    .filter(function (nombre) { return nombre !== seccionActual; });
  if (!destinos.length) {
    mostrarToast('No hay otra agrupación en este día a la que mover esta tienda', true);
    return;
  }
  mostrarModalMoverTiendaPlantilla_(row, info.tienda.nombre, seccionActual, destinos);
}

/** Modal para elegir a qué agrupación (del mismo día) se mueve la tienda. */
function mostrarModalMoverTiendaPlantilla_(row, nombreTienda, seccionActual, destinos) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Mover tienda de agrupación';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label>Tienda</label>' +
      '<input type="text" value="' + escapeAttr(nombreTienda) + '" readonly>' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label>Agrupación actual</label>' +
      '<input type="text" value="' + escapeAttr(seccionActual) + '" readonly>' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label for="modal-mover-destino">Mover a</label>' +
      '<select id="modal-mover-destino">' +
        destinos.map(function (d) { return '<option value="' + escapeAttr(d) + '">' + escapeHtml(d) + '</option>'; }).join('') +
      '</select>' +
    '</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Continuar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const destino = document.getElementById('modal-mover-destino').value;
    cerrarModal();
    prepararMoverTiendaPlantilla_(row, destino);
  };
}

/** Tras elegir la agrupación destino, comprueba (igual que al eliminar) si
 *  esta misma tienda (misma clave interna) aparece también en otros días.
 *  Si es así, ofrece moverla de golpe en todos esos días también, en vez
 *  de mover solo la fila de hoy. */
function prepararMoverTiendaPlantilla_(row, destino) {
  llamarApi_('otrasAparicionesTiendaPlantilla', [PLANTILLA_ESTADO.dia, row])
    .then(function (resultado) {
      const dias = (resultado && resultado.dias) || [];
      if (!dias.length) {
        moverTiendaAgrupacionPlantilla_(row, destino);
        return;
      }
      mostrarModalMoverTiendaVariosDias_(row, destino, dias);
    })
    .catch(mostrarErrorServidor);
}

/** Modal con 3 opciones cuando la tienda que se va a mover también
 *  aparece en otros días: cancelar, mover solo el día actual, o mover de
 *  golpe en todos los días donde aparezca (a la agrupación con el mismo
 *  nombre elegido; si algún día no tiene una agrupación con ese nombre,
 *  esa aparición se deja tal cual, no se fuerza ni se pierde). */
function mostrarModalMoverTiendaVariosDias_(row, destino, dias) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Esta tienda aparece en más días';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Esta misma tienda también está en: <b>' +
      dias.map(escapeHtml).join(', ') +
      '</b>. Si mueves solo aquí, en esos otros días seguirá saliendo por su agrupación de siempre. Usa "Mover en todos" para llevarla también a "' +
      escapeHtml(destino) + '" en los días donde exista una agrupación con ese mismo nombre (si algún día no la tiene, se deja como está ahí).</p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-mover-aqui-btn">Mover solo aquí</button>' +
    '<button class="modal-confirm" id="modal-mover-todos-btn">Mover en todos (' + (dias.length + 1) + ' días)</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-mover-aqui-btn').onclick = function () { cerrarModal(); moverTiendaAgrupacionPlantilla_(row, destino); };
  document.getElementById('modal-mover-todos-btn').onclick = function () { cerrarModal(); moverTiendaAgrupacionPlantillaTodosDias_(row, destino); };
}

/** Mueve la tienda SOLO en el día que se está viendo ahora mismo. Como
 *  afecta a la numeración de filas (la tienda pasa a otra ruta, así que
 *  cambia su posición en el orden general del día), se recarga la
 *  plantilla desde el servidor en vez de mutar el estado local a mano
 *  (mismo motivo que moverTiendaPlantilla_ / eliminarTiendaPlantillaTodosDias_). */
function moverTiendaAgrupacionPlantilla_(row, destino) {
  llamarApi_('moverTiendaAgrupacionPlantilla', [PLANTILLA_ESTADO.dia, row, destino])
    .then(function () {
      mostrarToast('Tienda movida a "' + destino + '"');
      cargarPlantilla_({ silencioso: true });
    })
    .catch(mostrarErrorServidor);
}

/** Mueve esta tienda (misma clave interna) en TODOS los días donde
 *  aparezca, a la agrupación con el mismo nombre elegido. */
function moverTiendaAgrupacionPlantillaTodosDias_(row, destino) {
  llamarApi_('moverTiendaAgrupacionPlantillaTodosDias', [PLANTILLA_ESTADO.dia, row, destino])
    .then(function (resultado) {
      const movidas = (resultado && resultado.movidas) || 0;
      const omitidas = (resultado && resultado.omitidas) || 0;
      mostrarToast(
        'Movida en ' + movidas + ' día(s)' +
        (omitidas ? ' (' + omitidas + ' sin cambios: ese día no tiene esa agrupación, o ya tiene una tienda con ese número)' : '')
      );
      cargarPlantilla_({ silencioso: true });
    })
    .catch(mostrarErrorServidor);
}

function moverTiendaPlantilla_(row, direccion) {
  // El backend es quien decide cómo se reordenan las filas físicas; se
  // pide la plantilla otra vez, pero en modo "silencioso" (sin loader ni
  // salto de scroll) para que no se sienta como una recarga completa.
  llamarApi_('moverTiendaPlantilla', [PLANTILLA_ESTADO.dia, Number(row), direccion])
    .then(function () { cargarPlantilla_({ silencioso: true }); })
    .catch(mostrarErrorServidor);
}

function moverRutaPlantilla_(nombreRuta, direccion) {
  // Igual que moverTiendaPlantilla_, pero moviendo la ruta entera (el
  // backend mueve en bloque título, notas de carga, cabecera y tiendas).
  llamarApi_('moverRutaPlantilla', [PLANTILLA_ESTADO.dia, nombreRuta, direccion])
    .then(function () { cargarPlantilla_({ silencioso: true }); })
    .catch(mostrarErrorServidor);
}

function guardarNotaCargaPlantilla_(row, idSeguro) {
  row = Number(row);
  const texto = document.getElementById(idSeguro).value;
  const mutar = function () {
    const info = buscarNotaCargaPlantilla_(row);
    if (info) info.nota.texto = texto;
  };
  guardarPlantillaOptimista_(mutar, 'editarNotaCargaPlantilla', [PLANTILLA_ESTADO.dia, row, texto], 'Guardado');
}

function confirmarEliminarNotaCargaPlantilla_(row) {
  appConfirm(
    'Eliminar nota de carga',
    '¿Seguro que quieres eliminar esta nota de carga? Esta acción no se puede deshacer.',
    function () {
      const r = Number(row);
      const mutar = function () {
        const info = buscarNotaCargaPlantilla_(r);
        if (!info) return;
        info.seccion.notasCarga.splice(info.seccion.notasCarga.indexOf(info.nota), 1);
        desplazarRowsPlantillaDesde_(r + 1, -1);
      };
      guardarPlantillaOptimista_(mutar, 'eliminarNotaCargaPlantilla', [PLANTILLA_ESTADO.dia, r], 'Eliminada');
    },
    true
  );
}

function abrirModalAnadirNotaCargaPlantilla_(nombreRuta) {
  appPrompt('Añadir nota de carga', 'Ej: 1 CAMIÓN 33 P. + RESTOS TODOS LOS LUNES', function (texto) {
    if (!texto || !texto.trim()) return;
    // Inserta una fila nueva -- el backend decide en qué fila exacta
    // queda, así que hace falta volver a pedir la plantilla; se hace en
    // modo "silencioso" (sin loader ni salto de scroll).
    llamarApi_('añadirNotaCargaPlantilla', [PLANTILLA_ESTADO.dia, nombreRuta, texto.trim()])
      .then(function () { mostrarToast('Nota añadida'); cargarPlantilla_({ silencioso: true }); })
      .catch(mostrarErrorServidor);
  });
}

function abrirModalNotaTiendaPlantilla_(fila, notaActual) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Comentario de la tienda';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label for="modal-nota-texto">Comentario (solo para esta tienda)</label>' +
      '<input type="text" id="modal-nota-texto" value="' + escapeAttr(notaActual || '') + '" placeholder="Déjalo vacío para quitar el comentario">' +
    '</div>' +
    '<p class="modal-campo-ayuda" style="margin:2px 0 0;">Para poner un límite de palets compartido entre varias tiendas, usa el botón "Grupos de palets" de la cabecera de la ruta.</p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    (notaActual ? '<button class="modal-cancel" id="modal-quitar-nota-btn" style="margin-right:auto;">Quitar comentario</button>' : '') +
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;

  if (notaActual) {
    document.getElementById('modal-quitar-nota-btn').onclick = function () {
      cerrarModal();
      llamarApi_('editarNotaTiendaPlantilla', [PLANTILLA_ESTADO.dia, fila, ''])
        .then(function () { mostrarToast('Comentario eliminado'); cargarPlantilla_({ silencioso: true }); })
        .catch(mostrarErrorServidor);
    };
  }

  document.getElementById('modal-confirm-btn').onclick = function () {
    const texto = document.getElementById('modal-nota-texto').value.trim();
    cerrarModal();
    llamarApi_('editarNotaTiendaPlantilla', [PLANTILLA_ESTADO.dia, fila, texto])
      .then(function () { mostrarToast('Guardado'); cargarPlantilla_({ silencioso: true }); })
      .catch(mostrarErrorServidor);
  };

  setTimeout(function () { document.getElementById('modal-nota-texto').focus(); }, 50);
}

/**
 * Modal de "Quitar en este orden" a nivel de RUTA (botón en la cabecera de
 * la agrupación en "Rutas y tiendas"). Sustituye al viejo sistema de un
 * campo de texto libre por tienda: aquí se eligen y ordenan directamente
 * las tiendas de esa misma ruta (checkbox + flechas subir/bajar), así que
 * nunca se puede escribir el nombre de una tienda que no está en la ruta
 * ni que esté mal escrito.
 */
function abrirModalOrdenRetiradaPlantilla_(nombreRuta) {
  const seccion = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreRuta; });
  if (!seccion) return;

  // Estado local del modal: array de "row" (mismo identificador que usa
  // el resto de "Rutas y tiendas") en el orden en que se deben quitar.
  // Se parte del orden ya guardado (seccion.ordenRetirada, ya viene
  // ordenado desde el backend).
  let orden = (seccion.ordenRetirada || []).map(function (o) { return o.row; });

  document.getElementById('modal-box').classList.add('ancho');
  document.getElementById('modal-box').classList.add('orden-retirada-modal');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Orden de retirada — ' + nombreRuta;
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';

  function nombreLimpio(t) { return quitarCodigoTienda(quitarMarcadorNombre(t.nombre)); }
  function tiendaPorRow(row) { return seccion.tiendas.find(function (t) { return t.row === row; }); }

  // Arrastre con puntero (ratón o dedo) dentro de la lista de "Orden de
  // retirada". Se escucha el movimiento/soltado en el "document" (no en el
  // propio icono) porque, si el puntero se mueve deprisa, puede salirse
  // por un instante de un icono tan pequeño y se perdería el arrastre.
  function activarArrastre(lista) {
    lista.querySelectorAll('[data-orden-handle]').forEach(function (handle) {
      handle.onpointerdown = function (ev) {
        if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') return;
        const item = handle.closest('.modal-orden-item');
        if (!item) return;
        ev.preventDefault();
        item.classList.add('arrastrando');

        function actualizarNumeros() {
          Array.prototype.forEach.call(lista.children, function (el, i) {
            const badge = el.querySelector('.modal-orden-pos');
            if (badge) badge.textContent = (i + 1) + 'º';
          });
        }
        function onMove(ev2) {
          ev2.preventDefault();
          const y = ev2.clientY;
          const hermanos = Array.prototype.filter.call(lista.children, function (el) { return el !== item; });
          let siguiente = null;
          for (let i = 0; i < hermanos.length; i++) {
            const r = hermanos[i].getBoundingClientRect();
            if (y < r.top + r.height / 2) { siguiente = hermanos[i]; break; }
          }
          if (siguiente) lista.insertBefore(item, siguiente); else lista.appendChild(item);
          actualizarNumeros();
        }
        function onUp() {
          document.removeEventListener('pointermove', onMove);
          document.removeEventListener('pointerup', onUp);
          document.removeEventListener('pointercancel', onUp);
          item.classList.remove('arrastrando');
          // El DOM ya está en el orden final: se traduce a la lista `orden`.
          orden = Array.prototype.map.call(lista.children, function (el) {
            return Number(el.getAttribute('data-row'));
          });
          pintar();
        }
        document.addEventListener('pointermove', onMove, { passive: false });
        document.addEventListener('pointerup', onUp);
        document.addEventListener('pointercancel', onUp);
      };
    });
  }

  function pintar() {
    const disponibles = seccion.tiendas.filter(function (t) { return orden.indexOf(t.row) === -1; });

    const disponiblesHtml = disponibles.map(function (t) {
      return (
        '<div class="modal-orden-item" data-row="' + t.row + '">' +
          '<label class="modal-orden-check">' +
            '<input type="checkbox" data-orden-check="' + t.row + '">' +
            '<span>' + escapeHtml(nombreLimpio(t)) + '</span>' +
          '</label>' +
        '</div>'
      );
    }).join('');

    const seleccionadasHtml = orden.map(function (row, i) {
      const t = tiendaPorRow(row);
      if (!t) return '';
      return (
        '<div class="modal-orden-item marcada" data-row="' + row + '">' +
          '<span class="modal-orden-handle" data-orden-handle title="Arrastrar para reordenar">' +
            '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><circle cx="2" cy="2" r="1.4"/><circle cx="8" cy="2" r="1.4"/><circle cx="2" cy="7" r="1.4"/><circle cx="8" cy="7" r="1.4"/><circle cx="2" cy="12" r="1.4"/><circle cx="8" cy="12" r="1.4"/></svg>' +
          '</span>' +
          '<label class="modal-orden-check">' +
            '<input type="checkbox" data-orden-check="' + row + '" checked>' +
            '<span>' + escapeHtml(nombreLimpio(t)) + '</span>' +
          '</label>' +
          '<span class="modal-orden-pos">' + (i + 1) + 'º</span>' +
        '</div>'
      );
    }).join('');

    custom.innerHTML =
      '<p class="modal-campo-ayuda" style="margin:0 0 12px;">Marca las tiendas que hay que quitar del camión. Para ponerlas en orden, arrastra cada una (con el icono de puntitos) dentro de "Orden de retirada": el número se pone solo.</p>' +
      '<div class="modal-orden-columnas">' +
        '<div class="modal-orden-col">' +
          '<div class="modal-orden-col-titulo">Tiendas de la ruta</div>' +
          '<div class="modal-orden-lista" id="orden-disponibles">' + (disponiblesHtml || '<div class="festivos-item-vacio">Todas están seleccionadas.</div>') + '</div>' +
        '</div>' +
        '<div class="modal-orden-col">' +
          '<div class="modal-orden-col-titulo">Orden de retirada <span class="modal-orden-col-contador">(' + orden.length + ')</span></div>' +
          '<div class="modal-orden-lista" id="orden-seleccionadas">' + (seleccionadasHtml || '<div class="festivos-item-vacio">Marca alguna tienda de la izquierda.</div>') + '</div>' +
        '</div>' +
      '</div>' +
      (seccion.tiendas.length ? '' : '<div class="festivos-item-vacio">Esta ruta no tiene tiendas.</div>');

    custom.querySelectorAll('[data-orden-check]').forEach(function (chk) {
      chk.onchange = function () {
        const row = Number(chk.getAttribute('data-orden-check'));
        if (chk.checked) {
          if (orden.indexOf(row) === -1) orden.push(row);
        } else {
          orden = orden.filter(function (r) { return r !== row; });
        }
        pintar();
      };
    });

    activarArrastre(document.getElementById('orden-seleccionadas'));
  }
  const actions = document.getElementById('modal-actions');
  function pintarAcciones() {
    actions.innerHTML =
      (orden.length ? '<button class="modal-cancel" id="modal-quitar-orden-btn" style="margin-right:auto;">Quitar todas</button>' : '') +
      '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
      '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
    document.getElementById('modal-cancel-btn').onclick = cerrarModal;
    if (orden.length) {
      document.getElementById('modal-quitar-orden-btn').onclick = function () { orden = []; pintarTodo(); };
    }
    document.getElementById('modal-confirm-btn').onclick = function () {
      cerrarModal();
      llamarApi_('establecerOrdenRetiradaRuta', [PLANTILLA_ESTADO.dia, nombreRuta, orden])
        .then(function () { mostrarToast('Orden de retirada guardado'); cargarPlantilla_({ silencioso: true }); })
        .catch(mostrarErrorServidor);
    };
  }
  function pintarTodo() { pintar(); pintarAcciones(); }
  pintarTodo();
  document.getElementById('modal-overlay').style.display = 'flex';
}

/**
 * Modal de "Grupos de palets" a nivel de RUTA (botón junto a "Orden
 * retirada"). Sustituye al viejo sistema de "nota + cuántas tiendas
 * siguientes contadas desde aquí" -- aquí se marcan directamente las
 * tiendas de checkbox (pueden estar salteadas, no hace falta que sean
 * consecutivas) y el texto/límite/tipo van en campos propios, no
 * escondidos dentro del texto libre.
 */
function abrirModalGruposLimitePlantilla_(nombreRuta) {
  const seccion = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreRuta; });
  if (!seccion) return;

  function nombreLimpio(t) { return quitarCodigoTienda(quitarMarcadorNombre(t.nombre)); }

  // Reconstruye los grupos ya guardados a partir de las tiendas de la
  // ruta: todas las que comparten el mismo notaGrupoId son un grupo.
  const grupos = [];
  const indicePorId = {};
  seccion.tiendas.forEach(function (t) {
    if (!t.notaGrupoId) return;
    if (!(t.notaGrupoId in indicePorId)) {
      indicePorId[t.notaGrupoId] = grupos.length;
      grupos.push({ texto: t.nota || '', limite: t.notaLimite != null ? String(t.notaLimite) : '', tipo: t.notaGrupoTipo || '', rows: [] });
    }
    grupos[indicePorId[t.notaGrupoId]].rows.push(t.row);
  });

  document.getElementById('modal-box').classList.add('ancho');
  document.getElementById('modal-box').classList.add('orden-retirada-modal');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Grupos de palets — ' + nombreRuta;
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';

  function filasOcupadasPorOtros(idx) {
    const ocupadas = new Set();
    grupos.forEach(function (g, i) {
      if (i === idx) return;
      g.rows.forEach(function (r) { ocupadas.add(r); });
    });
    return ocupadas;
  }

  function pintar() {
    const tarjetasHtml = grupos.map(function (g, idx) {
      const ocupadas = filasOcupadasPorOtros(idx);
      const chipsHtml = seccion.tiendas.map(function (t) {
        const marcada = g.rows.indexOf(t.row) !== -1;
        const bloqueada = !marcada && ocupadas.has(t.row);
        return (
          '<label class="modal-grupo-chip' + (marcada ? ' marcada' : '') + (bloqueada ? ' bloqueada' : '') + '"' + (bloqueada ? ' title="Ya está en otro grupo de esta ruta"' : '') + '>' +
            '<input type="checkbox" data-grupo-idx="' + idx + '" data-grupo-row="' + t.row + '"' + (marcada ? ' checked' : '') + (bloqueada ? ' disabled' : '') + '>' +
            '<span>' + escapeHtml(nombreLimpio(t)) + '</span>' +
          '</label>'
        );
      }).join('');

      return (
        '<div class="modal-grupo-card">' +
          '<div class="modal-grupo-card-fila">' +
            '<div class="modal-grupo-campo">' +
              '<label>Texto</label>' +
              '<input type="text" data-grupo-texto="' + idx + '" value="' + escapeAttr(g.texto) + '" placeholder="Ej: MAX POR RUTA">' +
            '</div>' +
            '<div class="modal-grupo-campo modal-grupo-campo-limite">' +
              '<label>Límite palets</label>' +
              '<input type="text" inputmode="numeric" data-grupo-limite="' + idx + '" value="' + escapeAttr(g.limite) + '" placeholder="Sin límite">' +
            '</div>' +
            '<label class="modal-grupo-campo modal-grupo-campo-tipo" title="Solo suma y muestra el total, sin avisar aunque se pase">' +
              '<input type="checkbox" data-grupo-tipo="' + idx + '"' + (g.tipo === 'total' ? ' checked' : '') + '>' +
              '<span>Solo informativo (sin aviso)</span>' +
            '</label>' +
            '<button type="button" class="modal-grupo-eliminar" data-grupo-eliminar="' + idx + '" title="Eliminar este grupo">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>' +
            '</button>' +
          '</div>' +
          '<div class="modal-grupo-chips">' + chipsHtml + '</div>' +
        '</div>'
      );
    }).join('');

    custom.innerHTML =
      '<p class="modal-campo-ayuda" style="margin:0 0 12px;">Marca qué tiendas comparten un límite de palets (o simplemente quieres sumarlas juntas). No hace falta que sean consecutivas, pero cada tienda solo puede estar en un grupo a la vez.</p>' +
      '<div class="modal-grupos-lista">' + (tarjetasHtml || '<div class="festivos-item-vacio">Todavía no hay grupos en esta ruta.</div>') + '</div>' +
      '<button type="button" class="plantilla-anadir-notacarga" id="modal-grupo-anadir" style="margin-top:12px;">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Añadir grupo</button>';

    custom.querySelectorAll('[data-grupo-texto]').forEach(function (inp) {
      inp.oninput = function () { grupos[Number(inp.getAttribute('data-grupo-texto'))].texto = inp.value; };
    });
    custom.querySelectorAll('[data-grupo-limite]').forEach(function (inp) {
      inp.oninput = function () {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 3);
        grupos[Number(inp.getAttribute('data-grupo-limite'))].limite = inp.value;
      };
    });
    custom.querySelectorAll('[data-grupo-tipo]').forEach(function (chk) {
      chk.onchange = function () { grupos[Number(chk.getAttribute('data-grupo-tipo'))].tipo = chk.checked ? 'total' : ''; };
    });
    custom.querySelectorAll('[data-grupo-eliminar]').forEach(function (btn) {
      btn.onclick = function () { grupos.splice(Number(btn.getAttribute('data-grupo-eliminar')), 1); pintar(); };
    });
    custom.querySelectorAll('[data-grupo-row]').forEach(function (chk) {
      chk.onchange = function () {
        const idx = Number(chk.getAttribute('data-grupo-idx'));
        const row = Number(chk.getAttribute('data-grupo-row'));
        const g = grupos[idx];
        if (chk.checked) {
          if (g.rows.indexOf(row) === -1) g.rows.push(row);
        } else {
          g.rows = g.rows.filter(function (r) { return r !== row; });
        }
        pintar();
      };
    });
    const btnAnadir = document.getElementById('modal-grupo-anadir');
    if (btnAnadir) {
      btnAnadir.onclick = function () {
        grupos.push({ texto: '', limite: '', tipo: '', rows: [] });
        pintar();
        setTimeout(function () {
          const inputs = custom.querySelectorAll('[data-grupo-texto]');
          const ultimo = inputs[inputs.length - 1];
          if (ultimo) ultimo.focus();
        }, 30);
      };
    }
  }

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    for (let i = 0; i < grupos.length; i++) {
      if (grupos[i].rows.length > 0 && !grupos[i].texto.trim()) {
        mostrarToast('Ponle un texto al grupo ' + (i + 1) + ' antes de guardar', true);
        return;
      }
    }
    const payload = grupos
      .filter(function (g) { return g.rows.length > 0; })
      .map(function (g) {
        return {
          texto: g.texto.trim(),
          limite: g.limite ? Number(g.limite) : null,
          tipo: g.tipo || null,
          rows: g.rows
        };
      });
    cerrarModal();
    llamarApi_('establecerGruposLimiteRuta', [PLANTILLA_ESTADO.dia, nombreRuta, payload])
      .then(function () { mostrarToast('Grupos de palets guardados'); cargarPlantilla_({ silencioso: true }); })
      .catch(mostrarErrorServidor);
  };

  pintar();
  document.getElementById('modal-overlay').style.display = 'flex';
}

/** "Añadir tienda" desde Rutas y tiendas ya NO crea tiendas nuevas -- eso
 *  solo se puede hacer desde Configuración tiendas (abrirModalNuevaTiendaConfig_
 *  en tiendas.js), para que una tienda tenga siempre una única ficha con
 *  su email/tránsito/límite general, en vez de poder nacer "al vuelo" con
 *  datos sueltos como antes. Aquí solo se elige, de entre las tiendas que
 *  ya existen en Configuración tiendas, cuál asignar a esta ruta/día. */
function abrirModalAnadirTiendaPlantilla_(nombreRuta) {
  // Antes de pintar el modal, se comprueba si esta misma ruta (misma
  // "agrupación", p.ej. "TXT ANDORRA") existe también otros días, para
  // poder ofrecer añadir la tienda de golpe en esos días también, y se
  // trae la lista de tiendas ya existentes en Configuración tiendas.
  Promise.all([
    llamarApi_('diasRutaMismoNombre', [PLANTILLA_ESTADO.dia, nombreRuta]).catch(function () { return []; }),
    llamarApi_('getTiendasConfig', []).catch(function () { return []; })
  ]).then(function (resultados) {
    pintarModalAnadirTiendaPlantilla_(nombreRuta, resultados[0] || [], resultados[1] || []);
  });
}

function pintarModalAnadirTiendaPlantilla_(nombreRuta, otrosDias, tiendasConfig) {
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.add('ancho');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Añadir tienda a "' + nombreRuta + '"';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  // Solo se ofrecen tiendas que todavía no aparezcan hoy (PLANTILLA_ESTADO.dia)
  // en ninguna ruta -- el backend vuelve a comprobarlo al guardar (por si
  // ha cambiado algo entre medias), esto es solo para no ofrecer de
  // entrada algo que se sabe que va a fallar.
  const candidatas = tiendasConfig
    .filter(function (t) { return (t.diasConteo || []).indexOf(PLANTILLA_ESTADO.dia) === -1; })
    .sort(function (a, b) { return a.tienda.localeCompare(b.tienda); });

  let seleccionada = null;

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label for="modal-plantilla-buscar">Tienda</label>' +
      '<input type="text" id="modal-plantilla-buscar" placeholder="Buscar por número o nombre…">' +
      '<div class="modal-plantilla-lista-tiendas" id="modal-plantilla-lista-tiendas"></div>' +
      '<p class="modal-campo-ayuda" id="modal-plantilla-sin-tienda" style="display:none;">' +
        '¿No aparece la tienda que buscas? <button type="button" class="modal-link-btn" id="modal-plantilla-ir-config">Créala primero en Configuración tiendas</button>.' +
      '</p>' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label for="modal-plantilla-lim">Límite de palets para este día (opcional)</label>' +
      '<input type="text" id="modal-plantilla-lim" inputmode="numeric" placeholder="Vacío = usa el límite general de la tienda">' +
      '<span class="modal-campo-ayuda" id="modal-plantilla-lim-general"></span>' +
    '</div>' +
    (otrosDias.length
      ? '<div class="modal-campo">' +
          '<label>"' + escapeHtml(nombreRuta) + '" también existe en estos días. ¿Añadirla ahí también?</label>' +
          '<div class="modal-anadir-tienda-dias">' +
            otrosDias.map(function (d) {
              return '<button type="button" class="modal-anadir-tienda-dia-pill" data-dia="' + escapeAttr(d) + '">' +
                escapeHtml(d) +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>'
      : '');

  Array.prototype.forEach.call(document.querySelectorAll('.modal-anadir-tienda-dia-pill'), function (pill) {
    pill.onclick = function () { pill.classList.toggle('activo'); };
  });

  const listaEl = document.getElementById('modal-plantilla-lista-tiendas');
  const avisoSinTienda = document.getElementById('modal-plantilla-sin-tienda');
  const limGeneralHint = document.getElementById('modal-plantilla-lim-general');
  document.getElementById('modal-plantilla-ir-config').onclick = function () {
    cerrarModal();
    cambiarVista('configuracion', 'tiendas');
  };

  function pintarLista(filtro) {
    const f = (filtro || '').trim().toLowerCase();
    const items = f ? candidatas.filter(function (t) { return t.tienda.toLowerCase().indexOf(f) !== -1; }) : candidatas;
    if (!items.length) {
      listaEl.innerHTML = '<div class="modal-plantilla-tienda-vacio">Ninguna tienda coincide.</div>';
      avisoSinTienda.style.display = '';
      return;
    }
    avisoSinTienda.style.display = candidatas.length ? 'none' : '';
    listaEl.innerHTML = items.map(function (t) {
      const marcada = t.tienda === seleccionada;
      const esSinUso = /^SIN USO/i.test(t.estado || '');
      return '<button type="button" class="modal-plantilla-tienda-item' + (marcada ? ' activa' : '') + '" data-clave="' + escapeAttr(t.tienda) + '" data-limite="' + escapeAttr(t.limite != null ? t.limite : '') + '">' +
        '<span>' + escapeHtml(t.tienda) + '</span>' +
        (esSinUso ? '<span class="modal-plantilla-tienda-badge">sin uso</span>' : '') +
      '</button>';
    }).join('');
    listaEl.querySelectorAll('[data-clave]').forEach(function (btn) {
      btn.onclick = function () {
        seleccionada = btn.getAttribute('data-clave');
        const limGeneral = btn.getAttribute('data-limite');
        limGeneralHint.textContent = limGeneral ? ('Límite general de esta tienda: ' + limGeneral) : 'Esta tienda todavía no tiene límite general definido.';
        listaEl.querySelectorAll('[data-clave]').forEach(function (b) { b.classList.toggle('activa', b === btn); });
      };
    });
  }
  pintarLista('');

  let temporizadorBusqueda = null;
  document.getElementById('modal-plantilla-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusqueda);
    const valor = e.target.value;
    temporizadorBusqueda = setTimeout(function () { pintarLista(valor); }, 150);
  });

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Añadir tienda</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    if (!seleccionada) { mostrarToast('Elige primero qué tienda añadir', true); return; }
    const inputLim = document.getElementById('modal-plantilla-lim');
    const limite = inputLim.value.trim();
    if (limite !== '' && isNaN(Number(limite))) { inputLim.focus(); return; }
    const diasElegidos = Array.prototype.slice.call(document.querySelectorAll('.modal-anadir-tienda-dia-pill.activo'))
      .map(function (pill) { return pill.getAttribute('data-dia'); });

    const btnConfirmar = document.getElementById('modal-confirm-btn');
    const avisoPrevio = document.getElementById('modal-plantilla-error');
    if (avisoPrevio) avisoPrevio.remove();
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Añadiendo…';

    // Primero se intenta en el día que se está viendo. El backend
    // rechaza (sin insertar nada) si esa misma tienda ya existe ese día
    // en cualquier agrupación -- si pasa, se deja el modal ABIERTO con
    // los datos escritos y se muestra el motivo, en vez de cerrarlo y
    // perder lo escrito.
    llamarApi_('asignarTiendaExistentePlantilla', [PLANTILLA_ESTADO.dia, nombreRuta, seleccionada, limite])
      .then(function () {
        cerrarModal();
        cargarPlantilla_({ silencioso: true });
        if (!diasElegidos.length) {
          mostrarToast('Tienda añadida');
          return;
        }
        // El día principal ya está añadido; los demás días marcados se
        // intentan aparte -- si alguno falla (p.ej. porque ya existiera
        // ahí), no se deshace lo del día principal, solo se avisa de
        // cuáles no se han podido añadir y por qué.
        Promise.allSettled(
          diasElegidos.map(function (dia) {
            return llamarApi_('asignarTiendaExistentePlantilla', [dia, nombreRuta, seleccionada, limite]);
          })
        ).then(function (resultados) {
          const fallos = resultados
            .map(function (r, i) {
              return r.status === 'rejected'
                ? diasElegidos[i] + ' (' + (r.reason && r.reason.message ? r.reason.message : 'error') + ')'
                : null;
            })
            .filter(Boolean);
          if (fallos.length) {
            mostrarToast('Tienda añadida. No se pudo añadir en: ' + fallos.join('; '), true);
          } else {
            mostrarToast('Tienda añadida (también en ' + diasElegidos.length + ' día(s) más)');
          }
        });
      })
      .catch(function (err) {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Añadir tienda';
        const aviso = document.createElement('div');
        aviso.id = 'modal-plantilla-error';
        aviso.style.cssText = 'margin-top:12px;font-size:12.5px;color:var(--danger);background:#fceded;border-radius:8px;padding:9px 11px;';
        aviso.textContent = (err && err.message) ? err.message : 'No se ha podido añadir la tienda.';
        document.getElementById('modal-custom').appendChild(aviso);
      });
  };
  setTimeout(function () { document.getElementById('modal-plantilla-buscar').focus(); }, 50);
}

/** Si el nombre de una agrupación sigue el formato habitual
 *  "NOMBRE (UBICACION HORA)" -- incluyendo variantes reales como
 *  "GAITE 8:00", "AMBAS NAVES 14:00 - 19:00", "PTA -", "GAITE NOCHE",
 *  "PTA Y GAITE" (sin hora) -- lo separa en sus 3 partes para poder
 *  editarlas por separado. Si no encaja en ningún caso conocido, deja la
 *  ubicación/hora en blanco y el nombre completo tal cual, sin inventar
 *  ni perder nada. */
function dividirNombreRutaPlantilla_(nombreCompleto) {
  const texto = String(nombreCompleto || '').trim();
  const m = texto.match(/^(.*?)\s*\(\s*(.*?)\s*\)\s*$/);
  if (!m) return { nombre: texto, ubicacion: '', hora: '' };
  const nombre = m[1].trim();
  const contenido = m[2].replace(/\s+/g, ' ').trim();
  const m2 = contenido.match(/^(.*?)\s+(\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?|-|NOCHE)$/i);
  if (m2) return { nombre: nombre, ubicacion: m2[1].trim(), hora: m2[2].trim() };
  return { nombre: nombre, ubicacion: contenido, hora: '' };
}

/** Lápiz junto al nombre de una agrupación: abre un modal para editar SOLO
 *  la ubicación y la hora de carga, en vez de tener que reescribir la
 *  línea completa "NOMBRE (UBICACION HORA)" a mano -- mismo formato que ya
 *  usa "Añadir ruta nueva".
 *
 *  El nombre de la agrupación (la parte antes del paréntesis) ya NO se
 *  puede tocar desde aquí: es la misma identidad que la agrupación tiene
 *  en Configuración agencias (Config_Agrupaciones), de donde sale su
 *  clave y sus emails de agencia. El RPC editarNombreRutaPlantilla solo
 *  actualiza la tabla "rutas" (nombre + clave) y no toca
 *  config_agrupaciones, así que si se dejara cambiar el nombre aquí la
 *  ruta podría acabar con una clave que ya no coincide con ninguna
 *  agrupación configurada (mismo riesgo de desincronización que tenía el
 *  lápiz de "Editar tienda" con el número/nombre de tienda). Por eso este
 *  modal siempre reenvía el nombre de agrupación tal cual estaba. */
function abrirModalEditarRutaPlantilla_(nombreActual) {
  const partes = dividirNombreRutaPlantilla_(nombreActual);

  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Ubicación y hora de carga — ' + partes.nombre;
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label for="modal-ruta-ubicacion">Ubicación de carga</label>' +
      '<input type="text" id="modal-ruta-ubicacion" value="' + escapeAttr(partes.ubicacion) + '" placeholder="Ej: GAITE">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label for="modal-ruta-hora">Hora de carga</label>' +
      '<input type="text" id="modal-ruta-hora" value="' + escapeAttr(partes.hora) + '" placeholder="Ej: 10:00 (déjalo en blanco si no aplica)">' +
    '</div>' +
    '<p class="modal-campo-ayuda">El nombre de la agrupación ("' + escapeHtml(partes.nombre) + '") no se puede cambiar aquí: sale de Configuración agencias.</p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Guardar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const inputUbicacion = document.getElementById('modal-ruta-ubicacion');
    const inputHora = document.getElementById('modal-ruta-hora');
    const ubicacion = inputUbicacion.value.trim();
    const hora = inputHora.value.trim();
    if (!ubicacion) { inputUbicacion.focus(); return; }

    // Mismo formato que "Añadir ruta nueva": "NOMBRE (UBICACION HORA)",
    // o "NOMBRE (UBICACION)" si se deja la hora en blanco (hay rutas
    // reales sin una hora fija, p.ej. "CBL MALAGA (AMBAS NAVES)"). El
    // nombre de la agrupación se reenvía siempre igual (partes.nombre).
    const nombreCompleto = partes.nombre + ' (' + ubicacion + (hora ? ' ' + hora : '') + ')';
    cerrarModal();
    const mutar = function () {
      const s = PLANTILLA_ESTADO.secciones.find(function (s) { return s.nombre === nombreActual; });
      if (s) s.nombre = nombreCompleto;
    };
    guardarPlantillaOptimista_(mutar, 'editarNombreRutaPlantilla', [PLANTILLA_ESTADO.dia, nombreActual, nombreCompleto], 'Ruta actualizada');
  };
  setTimeout(function () { document.getElementById('modal-ruta-ubicacion').focus(); }, 50);
}

function confirmarEliminarRutaPlantilla_(nombreRuta) {
  appConfirm(
    'Eliminar ruta completa',
    '¿Seguro que quieres eliminar la ruta "' + nombreRuta + '" y TODAS sus tiendas de ' + PLANTILLA_ESTADO.dia + '? Esta acción no se puede deshacer.',
    function () { eliminarRutaPlantilla_(nombreRuta); },
    true
  );
}
function eliminarRutaPlantilla_(nombreRuta) {
  // Borra un bloque de filas completo (título + notas + tiendas); se pide
  // la plantilla otra vez, en modo "silencioso" (sin loader ni salto de
  // scroll) para que no se sienta como una recarga completa.
  llamarApi_('eliminarRutaPlantilla', [PLANTILLA_ESTADO.dia, nombreRuta])
    .then(function () { mostrarToast('Ruta eliminada'); cargarPlantilla_({ silencioso: true }); })
    .catch(mostrarErrorServidor);
}

/** Misma normalización que la función SQL "_clave_agrupacion" del backend:
 *  quita cualquier paréntesis "(...)" (ubicación/hora), pasa a mayúsculas,
 *  recorta y colapsa espacios. Se usa aquí SOLO para comparar contra las
 *  agrupaciones ya usadas como ruta en el día actual (PLANTILLA_ESTADO.secciones)
 *  y así no ofrecerlas otra vez en el desplegable -- el backend vuelve a
 *  aplicar la misma regla (y la exige) al guardar, así que esto es solo
 *  para que la lista del desplegable ya venga filtrada. */
function claveAgrupacionJs_(nombre) {
  let s = String(nombre || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  s = s.toUpperCase();
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** "Añadir ruta nueva" ya NO deja escribir el nombre de la ruta a mano:
 *  solo se puede elegir entre las agrupaciones ya dadas de alta en
 *  "Configuración agencias" (Config_Agrupaciones) que todavía no se estén
 *  usando como ruta en este día -- igual que renombrar/crear una tienda
 *  solo se puede hacer desde Configuración tiendas. Si la agrupación que
 *  hace falta todavía no existe, hay que crearla primero ahí (botón
 *  "Nueva agencia"); el backend (añadir_ruta_plantilla) también rechaza
 *  ahora cualquier clave que no exista en Config_Agrupaciones, así que
 *  esto es defensa en profundidad además de guiar al usuario. */
function anadirRutaPlantilla_() {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Añadir ruta nueva';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-dia-aviso">Se creará en <strong>' + escapeHtml(PLANTILLA_ESTADO.dia || '') + '</strong></div>' +
    '<div class="loader">Cargando agrupaciones disponibles…</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn" disabled>Guardar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;

  llamarApi_('getAgrupacionesConfig', [])
    .then(function (todas) {
      // Puede que el modal se haya cerrado mientras llegaba la respuesta.
      if (document.getElementById('modal-overlay').style.display === 'none') return;

      const clavesUsadasHoy = {};
      PLANTILLA_ESTADO.secciones.forEach(function (s) {
        clavesUsadasHoy[claveAgrupacionJs_(s.nombre)] = true;
      });
      const disponibles = (todas || [])
        .filter(function (it) { return !clavesUsadasHoy[claveAgrupacionJs_(it.agrupacion)]; })
        .sort(function (a, b) { return a.agrupacion.localeCompare(b.agrupacion, 'es'); });

      if (!disponibles.length) {
        custom.innerHTML =
          '<div class="modal-dia-aviso">Se creará en <strong>' + escapeHtml(PLANTILLA_ESTADO.dia || '') + '</strong></div>' +
          '<p class="modal-campo-ayuda">Todas las agrupaciones ya dadas de alta en Configuración agencias se están usando hoy en ' + escapeHtml(PLANTILLA_ESTADO.dia || 'este día') + ', o todavía no hay ninguna. Crea una agencia nueva desde "Configuración agencias" (botón "Nueva agencia") y luego vuelve aquí para añadirla como ruta.</p>';
        return;
      }

      custom.innerHTML =
        '<div class="modal-dia-aviso">Se creará en <strong>' + escapeHtml(PLANTILLA_ESTADO.dia || '') + '</strong></div>' +
        '<div class="modal-campo">' +
          '<label for="modal-ruta-agrupacion">Agrupación</label>' +
          '<select id="modal-ruta-agrupacion">' +
            '<option value="">Selecciona…</option>' +
            disponibles.map(function (it) {
              return '<option value="' + escapeAttr(it.agrupacion) + '">' + escapeHtml(it.agrupacion) + '</option>';
            }).join('') +
          '</select>' +
          '<span class="modal-campo-ayuda">¿No está en la lista? Créala primero en "Configuración agencias" (botón "Nueva agencia").</span>' +
        '</div>' +
        '<div class="modal-campo">' +
          '<label for="modal-ruta-ubicacion">Ubicación de carga</label>' +
          '<input type="text" id="modal-ruta-ubicacion" placeholder="Ej: GAITE">' +
        '</div>' +
        '<div class="modal-campo">' +
          '<label for="modal-ruta-hora">Hora de carga</label>' +
          '<input type="text" id="modal-ruta-hora" placeholder="Ej: 10:00">' +
        '</div>';

      const btnConfirmar = document.getElementById('modal-confirm-btn');
      btnConfirmar.disabled = false;
      btnConfirmar.onclick = function () {
        const selectAgrupacion = document.getElementById('modal-ruta-agrupacion');
        const inputUbicacion = document.getElementById('modal-ruta-ubicacion');
        const inputHora = document.getElementById('modal-ruta-hora');
        const nombre = selectAgrupacion.value;
        const ubicacion = inputUbicacion.value.trim();
        const hora = inputHora.value.trim();
        if (!nombre) { selectAgrupacion.focus(); return; }
        if (!ubicacion) { inputUbicacion.focus(); return; }
        if (!hora) { inputHora.focus(); return; }

        const nombreCompleto = nombre + ' (' + ubicacion + ' ' + hora + ')';
        cerrarModal();
        // Inserta un bloque de filas nuevo -- el backend decide dónde queda,
        // así que hace falta volver a pedir la plantilla; modo "silencioso"
        // (sin loader ni salto de scroll).
        llamarApi_('añadirRutaPlantilla', [PLANTILLA_ESTADO.dia, nombreCompleto])
          .then(function () { mostrarToast('Ruta añadida'); cargarPlantilla_({ silencioso: true }); })
          .catch(mostrarErrorServidor);
      };
      setTimeout(function () { document.getElementById('modal-ruta-agrupacion').focus(); }, 50);
    })
    .catch(function (err) {
      if (document.getElementById('modal-overlay').style.display === 'none') return;
      custom.innerHTML =
        '<div class="modal-dia-aviso">Se creará en <strong>' + escapeHtml(PLANTILLA_ESTADO.dia || '') + '</strong></div>' +
        '<p class="modal-campo-ayuda">No se ha podido cargar la lista de agrupaciones.</p>';
      mostrarErrorServidor(err);
    });
}

function renderShellPrincipal() {
  const main = document.getElementById('main');
  main.innerHTML =
    '<div class="layout-grid">' +
      '<aside class="col-sidebar col-calendario">' +
        '<div class="calendar-panel' + (ESTADO.calendarioColapsado ? ' colapsado' : '') + '" id="calendar-panel">' +
          '<div class="calendar-panel-header" id="calendar-toggle">' +
            '<div class="titulo">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>' +
              '<span>Calendario</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<span class="selected-pill" id="selected-pill"></span>' +
              '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>' +
            '</div>' +
          '</div>' +
          '<div class="calendar-body" id="calendar-body">' +
            '<div class="loader">Cargando calendario…</div>' +
          '</div>' +
        '</div>' +
        '<div class="menu-rapido-panel">' +
          '<h4>Acceso rápido a agrupación</h4>' +
          '<div class="menu-rapido-buscar">' +
            '<span class="emoji">🔍</span>' +
            '<input type="text" id="menu-rapido-buscar-input" placeholder="Buscar agrupación o tienda…">' +
          '</div>' +
          '<div class="menu-rapido-body" id="menu-rapido-body"><div class="menu-rapido-vacio">Cargando…</div></div>' +
        '</div>' +
      '</aside>' +
      '<div class="col-contenido">' +
        '<div id="dia-contenido"><div class="loader">Cargando conteo…</div></div>' +
      '</div>' +
      '<aside class="col-sidebar col-resumen">' +
        '<div class="resumen-panel" id="resumen-panel">' +
          '<div class="resumen-header">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
            '<span>Observaciones importantes:</span>' +
            '<div class="resumen-header-right">' +
              '<span class="resumen-count" id="resumen-count" style="display:none;">0</span>' +
              '<button type="button" class="btn-anadir-obs" id="btn-nota-dia">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
              'Añadir</button>' +
            '</div>' +
          '</div>' +
          '<div class="resumen-body" id="resumen-body"><div class="resumen-vacio">Cargando…</div></div>' +
        '</div>' +
      '</aside>' +
    '</div>';

  document.getElementById('calendar-toggle').onclick = function () {
    ESTADO.calendarioColapsado = !ESTADO.calendarioColapsado;
    document.getElementById('calendar-panel').classList.toggle('colapsado', ESTADO.calendarioColapsado);
  };

  let temporizadorBusquedaMenuRapido_ = null;
  document.getElementById('menu-rapido-buscar-input').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusquedaMenuRapido_);
    const valor = e.target.value;
    temporizadorBusquedaMenuRapido_ = setTimeout(function () {
      MENU_RAPIDO_ESTADO.filtro = normalizarBusquedaPlantilla_(valor.trim());
      pintarMenuRapido_();
    }, 150);
  });
}
