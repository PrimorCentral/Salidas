/* SALIDAS · js/conteos-panel.js — Conteos diarios: agrupación (crearSeccionPanel) y autoguardado */

/* ---------------- SECCIÓN / AGRUPACIÓN ---------------- */

/**
 * Separa el nombre de la agrupación tal como viene de la hoja
 * (ej. "TXT NORTE (PTA 11:00)") en:
 *   titulo:    "TXT NORTE"
 *   ubicacion: "PTA 11:00"  (lo que va entre paréntesis, o null si no hay)
 */
function parsearNombreAgrupacion(nombre) {
  const m = String(nombre).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { titulo: m[1].trim(), ubicacion: m[2].trim() };
  return { titulo: String(nombre).trim(), ubicacion: null };
}

/**
 * Muestra el indicador de sincronización durante el autoguardado.
 * Filosofía: silencio cuando todo va bien, solo se ve algo mientras se
 * está guardando (y desaparece solo, sin más aviso).
 *
 * Vive en un único sitio (la barra superior, junto a "Administrador"), no
 * repetido en cada cabecera de agrupación. Como puede haber varias
 * agrupaciones guardando a la vez (el autoguardado de cada una es
 * independiente), se lleva la cuenta con SYNC_GUARDANDO_CONTADOR_: el
 * indicador se mantiene visible mientras el contador sea > 0, y solo se
 * apaga cuando la última agrupación en vuelo termina de guardar.
 */
let SYNC_GUARDANDO_CONTADOR_ = 0;
function marcarGuardando(panel, activo) {
  const ind = document.getElementById('sync-indicator-global');
  if (!ind) return;
  SYNC_GUARDANDO_CONTADOR_ = Math.max(0, SYNC_GUARDANDO_CONTADOR_ + (activo ? 1 : -1));
  if (SYNC_GUARDANDO_CONTADOR_ > 0) {
    ind.classList.add('mostrando');
    ind.innerHTML = '<span class="sync-spinner"></span><span>Guardando…</span>';
  } else {
    ind.classList.remove('mostrando');
    ind.innerHTML = '';
  }
}

/**
 * Texto "hace X" para el aviso de último guardado junto al botón
 * "Guardar conteo" de cada agrupación. Cada agrupación registra aquí su
 * propia función de refresco (ver REFRESCADORES_ULTIMO_GUARDADO_) y un
 * único intervalo global las va llamando a todas cada 20s, para no tener
 * un setInterval por cada agrupación abierta en pantalla.
 */
function formatearTiempoRelativo_(fecha) {
  const segundos = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 1000));
  if (segundos < 10) return 'justo ahora';
  if (segundos < 60) return 'hace ' + segundos + ' s';
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return 'hace ' + minutos + ' min';
  const horas = Math.round(minutos / 60);
  if (horas < 24) return 'hace ' + horas + ' h';
  return 'hace ' + Math.round(horas / 24) + ' d';
}
let REFRESCADORES_ULTIMO_GUARDADO_ = [];
setInterval(function () {
  // Al re-renderizar (cambio de fecha, recarga de sección…) las agrupaciones
  // viejas se sustituyen en el DOM, pero sus funciones seguirían aquí
  // apuntando a nodos ya desconectados: se limpian solas de paso para que
  // la lista no crezca sin límite en una sesión larga.
  REFRESCADORES_ULTIMO_GUARDADO_ = REFRESCADORES_ULTIMO_GUARDADO_.filter(function (fn) {
    return fn(); // cada función devuelve false si su nodo ya no está en el DOM
  });
}, 20000);

function htmlBotonDeshacerEnvio_() {
  return '<button type="button" class="btn-deshacer-envio" title="Deshacer envío (solo se puede el mismo día)">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="3 6 5 6 21 6"></polyline>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
    '<path d="M10 11v6"></path><path d="M14 11v6"></path>' +
    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
    '</svg></button>';
}

function crearSeccionPanel(seccion, dia, fecha, esHoy) {
  // El backend calcula seccion.editable teniendo en cuenta la fecha (solo
  // lectura si han pasado más de 2 días) y si ya se envió a la agencia
  // (una vez enviado, ya no se puede modificar). Si por lo que sea no
  // viniera ese campo, se asume editable (compatibilidad hacia atrás).
  let editable = seccion.editable !== false && seccion.estado !== 'enviado';

  const panel = document.createElement('div');
  panel.className = 'seccion-panel estado-' + seccion.estado + (editable ? '' : ' no-editable');
  panel.setAttribute('data-seccion-key', seccion.nombre);
  if (ESTADO.colapsadas.has(seccion.nombre)) panel.classList.add('colapsada');

  const partes = parsearNombreAgrupacion(seccion.nombre);
  const iniciales = partes.titulo.replace(/[^A-ZÁÉÍÓÚÑ ]/gi, '').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '·';

  const badgeUbicacion = partes.ubicacion
    ? '<span class="badge-ubicacion">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>' +
      escapeHtml(partes.ubicacion) + '</span>'
    : '';

  const header = document.createElement('div');
  header.className = 'seccion-header';
  header.innerHTML =
    '<div class="seccion-header-top">' +
    '<div class="icono-agrup">' + iniciales + '</div>' +
    '<div class="info"><div class="name-row">' +
    '<span class="name">' + escapeHtml(partes.titulo) + '</span>' + badgeUbicacion +
    '<span class="count">' + seccion.tiendas.filter(function (t) { return !t.salePorExcepcion; }).length + ' tienda(s)</span>' +
    badgeEstado(seccion) +
    '</div></div>' +
    '<span class="badge-total-palets"><span class="total-palets-valor">0</span>&nbsp;palets</span>' +
    '<button type="button" class="btn-toggle-colapsar" title="Contraer / expandir">' +
    '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>' +
    '</div>' +
    '<div class="seccion-header-meta">' +
    '<div class="seccion-header-badges">' +
    badgePrevision(seccion) +
    (seccion.estado === 'enviado' && esHoy ? htmlBotonDeshacerEnvio_() : '') +
    (!editable && seccion.estado !== 'enviado' ? '<span class="badge badge-solo-lectura">Solo lectura</span>' : '') +
    '</div>' +
    '<div class="seccion-header-acciones">' +
    (editable && seccion.estado !== 'enviado' && !seccion.previsionEnviada
      ? '<button type="button" class="btn-header-prevision" title="Enviar previsión por email (no bloquea el conteo, se puede volver a enviar)">Enviar Previsión</button>'
      : '') +
    (editable && seccion.estado !== 'enviado'
      ? '<button type="button" class="btn-header-definitivo" title="Enviar definitivo por email (bloquea el conteo, lo archiva y vacía las casillas)">Enviar Definitivo</button>'
      : '') +
    '</div>' +
    '<div class="seccion-header-extra">' +
    (editable && seccion.estado !== 'enviado'
      ? '<button type="button" class="btn-header-guardar sin-cambios" title="Guarda el conteo de esta agrupación. Los botones de envío no se activan hasta pulsar aquí.">Guardar conteo</button>' +
        '<span class="ultimo-guardado"></span>'
      : '') +
    '<button type="button" class="btn-add-nota" title="Añadir nota a esta agrupación">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg></button>' +
    '<button type="button" class="btn-pdf-seccion" title="Generar PDF de esta agrupación">' +
    '<svg width="16" height="18" viewBox="0 0 24 26">' +
    '<path d="M4 2h11l6 6v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#e0342a"/>' +
    '<path d="M15 2v6h6" fill="#ffffff" opacity="0.32"/>' +
    '<text x="12" y="19" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="7.5" font-weight="800" fill="#ffffff">PDF</text>' +
    '</svg></button>' +
    (seccion.tienePdfEspecial
      ? '<button type="button" class="btn-pdf-especial-seccion" title="Generar PDF especial (formato de reparto en camión) de esta agrupación">' +
        '<svg width="16" height="18" viewBox="0 0 24 26">' +
        '<path d="M4 2h11l6 6v15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="var(--prevision)"/>' +
        '<path d="M15 2v6h6" fill="#ffffff" opacity="0.32"/>' +
        '<text x="12" y="19" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="6" font-weight="800" fill="#ffffff">PDF+</text>' +
        '</svg></button>'
      : '') +
    '</div>' +
    '</div>';
  panel.appendChild(header);

  header.querySelector('.btn-add-nota').onclick = function (e) {
    e.stopPropagation();
    appPrompt('Nota para ' + seccion.nombre, 'Escribe una observación para esta agrupación…', function (texto) {
      guardarObservacionYRecargar({ fecha: fecha, dia: dia, agrupacion: seccion.nombre, tienda: '', tipo: 'nota', texto: texto });
    });
  };
  header.addEventListener('click', function (e) {
    if (!e.target.closest('.btn-toggle-colapsar')) return;
    panel.classList.toggle('colapsada');
    if (panel.classList.contains('colapsada')) ESTADO.colapsadas.add(seccion.nombre);
    else ESTADO.colapsadas.delete(seccion.nombre);
  });

  // Notas/instrucciones de carga escritas en la propia hoja de Excel
  // (ej. "1 CAMIÓN 33 P. + ... TODOS LOS LUNES"). De solo lectura.
  if (seccion.notasCarga && seccion.notasCarga.length) {
    const cargaWrap = document.createElement('div');
    cargaWrap.className = 'seccion-notas-carga';
    seccion.notasCarga.forEach(function (texto) {
      cargaWrap.appendChild(crearNotaCargaChip(texto));
    });
    panel.appendChild(cargaWrap);
  }

  // Observaciones manuales guardadas para esta agrupación (hoja Observaciones), sí se pueden borrar.
  if (seccion.notas && seccion.notas.length) {
    const notasWrap = document.createElement('div');
    notasWrap.className = 'seccion-notas';
    seccion.notas.forEach(function (n) { notasWrap.appendChild(crearNotaChip(n)); });
    panel.appendChild(notasWrap);
  }

  const body = document.createElement('div');
  body.className = 'seccion-body';

  // Columna lateral: solo se muestra si hay una lista de "quitar en este
  // orden" que mostrar; ya no aloja botones (Guardar / Enviar), que ahora
  // viven en la cabecera.
  let acciones = null;
  if (seccion.ordenRetirada && seccion.ordenRetirada.length) {
    acciones = document.createElement('div');
    acciones.className = 'seccion-acciones';
    const ordenWrap = document.createElement('div');
    ordenWrap.className = 'orden-retirada';
    ordenWrap.innerHTML =
      '<div class="orden-retirada-titulo">Quitar en este orden</div>' +
      '<ol>' + seccion.ordenRetirada.map(function (o) { return '<li>' + escapeHtml(quitarCodigoTienda(quitarMarcadorNombre(o))) + '</li>'; }).join('') + '</ol>';
    acciones.appendChild(ordenWrap);
    body.appendChild(acciones);
  }

  const tablaCol = document.createElement('div');
  tablaCol.className = 'seccion-tabla-col';
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  // Nombres de las tiendas de cada grupo (para mostrarlos juntos una sola
  // vez en la fila-cabecera, en vez de repetir la nota en cada tienda).
  const nombresPorGrupo = {};
  seccion.tiendas.forEach(function (t) {
    if (!t.notaGrupoId) return;
    if (!nombresPorGrupo[t.notaGrupoId]) nombresPorGrupo[t.notaGrupoId] = [];
    nombresPorGrupo[t.notaGrupoId].push(t.nombre);
  });

  const filasHtml = seccion.tiendas.map(function (t, i) {
    const anterior = seccion.tiendas[i - 1];
    const siguiente = seccion.tiendas[i + 1];
    const esPrimeraDeGrupo = !!t.notaGrupoId && (!anterior || anterior.notaGrupoId !== t.notaGrupoId);
    const esUltimaDeGrupo = !!t.notaGrupoId && (!siguiente || siguiente.notaGrupoId !== t.notaGrupoId);
    const headerHtml = esPrimeraDeGrupo ? filaGrupoHeaderHtml(t, nombresPorGrupo[t.notaGrupoId], seccion.tienePeso, seccion.tieneCExpress, seccion.tieneSobrestock) : '';
    return headerHtml + filaHtml(t, esPrimeraDeGrupo, esUltimaDeGrupo, seccion.tienePeso, seccion.tieneCExpress, seccion.tieneSobrestock);
  }).join('');
  tableWrap.innerHTML =
    '<table class="conteo"><thead><tr>' +
    '<th class="th-nombre">Tienda</th><th>Límite</th><th>60</th><th>PTA</th><th>CART.</th><th class="th-total">TOTAL</th><th>PDTE</th>' +
    (seccion.tienePeso ? '<th>PESO</th>' : '') +
    (seccion.tieneCExpress ? '<th>C.EXPRESS</th>' : '') +
    (seccion.tieneSobrestock ? '<th>SOBRESTOCK</th>' : '') +
    '<th></th>' +
    '</tr></thead><tbody>' + filasHtml + '</tbody></table>';
  if (!editable) {
    // Fecha demasiado antigua (2+ días atrás) o ya enviada: se puede
    // consultar, pero no modificar nada de esta agrupación.
    tableWrap.querySelectorAll('input.celda, input.celda-total').forEach(function (input) { input.disabled = true; });
    tableWrap.querySelectorAll('.btn-cerrar-tienda, .btn-reabrir, input.celda-no').forEach(function (btn) { btn.disabled = true; });
  }
  tablaCol.appendChild(tableWrap);
  body.appendChild(tablaCol);

  panel.appendChild(body);

  // Total de palets de la agrupación: suma en vivo del TOTAL de cada tienda
  // (no cuenta las tiendas cerradas, que no tienen input de TOTAL).
  function actualizarTotalPalets() {
    let suma = 0;
    tableWrap.querySelectorAll('input.celda-total').forEach(function (inp) {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) suma += v;
    });
    const el = header.querySelector('.total-palets-valor');
    if (el) el.textContent = suma;
    return suma;
  }
  const sumaInicialPalets = actualizarTotalPalets();

  // GUARDADO MANUAL: ya no se guarda solo mientras se escribe. En su
  // lugar, cualquier cambio en un input marca la agrupación como "con
  // cambios sin guardar" (botón "Guardar conteo" destacado y con pulso).
  // Los botones "Enviar Previsión" / "Enviar Definitivo" se activan si ya
  // hay algún total guardado para esta agrupación (venga de esta sesión o
  // de una anterior: si al recargar la página ya trae datos, no tiene
  // sentido pedir pulsar "Guardar conteo" otra vez solo para desbloquear
  // el envío). Si después se edita algo, se apagan otra vez hasta el
  // siguiente guardado.
  const btnGuardarConteo = header.querySelector('.btn-header-guardar');
  const spanUltimoGuardado = header.querySelector('.ultimo-guardado');
  let hayCambiosSinGuardar = false;
  let haGuardadoAlMenosUnaVez = sumaInicialPalets > 0;
  let ultimoGuardadoEn = null; // Date del último guardado con éxito (esta sesión)
  function refrescarTextoUltimoGuardado_() {
    if (!spanUltimoGuardado || !spanUltimoGuardado.isConnected) return false;
    if (ultimoGuardadoEn) {
      spanUltimoGuardado.textContent = 'Guardado ' + formatearTiempoRelativo_(ultimoGuardadoEn);
      spanUltimoGuardado.title = 'Guardado a las ' + ultimoGuardadoEn.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return true;
  }
  REFRESCADORES_ULTIMO_GUARDADO_.push(refrescarTextoUltimoGuardado_);
  function actualizarBotonesEnvio_() {
    const bloquear = !haGuardadoAlMenosUnaVez || hayCambiosSinGuardar;
    [header.querySelector('.btn-header-prevision'), header.querySelector('.btn-header-definitivo')].forEach(function (btn) {
      if (!btn) return;
      if (!btn.hasAttribute('data-title-original')) btn.setAttribute('data-title-original', btn.title);
      btn.disabled = bloquear;
      btn.title = bloquear ? 'Pulsa antes "Guardar conteo"' : btn.getAttribute('data-title-original');
    });
  }
  function marcarCambiosSinGuardar_() {
    hayCambiosSinGuardar = true;
    if (btnGuardarConteo) {
      btnGuardarConteo.classList.remove('sin-cambios');
      btnGuardarConteo.classList.add('con-cambios');
      btnGuardarConteo.textContent = 'Guardar conteo';
    }
    actualizarBotonesEnvio_();
  }
  function marcarTodoGuardado_() {
    hayCambiosSinGuardar = false;
    haGuardadoAlMenosUnaVez = true;
    if (btnGuardarConteo) {
      btnGuardarConteo.classList.remove('con-cambios');
      btnGuardarConteo.classList.add('sin-cambios');
      btnGuardarConteo.textContent = 'Guardado';
    }
    actualizarBotonesEnvio_();
  }
  // Se llama solo cuando de verdad ha habido una vuelta al servidor con
  // éxito (no en el caso de "Guardar conteo" pulsado sin cambios), para
  // que el "hace X min" refleje guardados reales.
  function marcarGuardadoAhora_() {
    ultimoGuardadoEn = new Date();
    refrescarTextoUltimoGuardado_();
  }
  // "Guardar conteo" siempre se puede pulsar (mientras sea editable),
  // haya o no cambios: si no hay nada nuevo que guardar, no llama al
  // servidor (evita una petición de red innecesaria), pero igualmente
  // deja constancia de que se ha "confirmado" el guardado en esta
  // sesión, que es lo que activa los botones de envío.
  function autoguardarSeccion(onDone) {
    if (!editable) { if (onDone) onDone(false); return; } // por si acaso: no se guarda nada de una agrupación no editable
    if (!hayCambiosSinGuardar) { marcarTodoGuardado_(); if (onDone) onDone(true); return; }
    const filas = recogerFilas(tableWrap);
    marcarGuardando(panel, true);
    if (btnGuardarConteo) btnGuardarConteo.disabled = true;
    llamarApi_('guardarConteo', [dia, filas, fecha, seccion.nombre])
      .then(function () {
        marcarGuardando(panel, false);
        if (btnGuardarConteo) btnGuardarConteo.disabled = false;
        marcarTodoGuardado_();
        marcarGuardadoAhora_();
        if (onDone) onDone(true);
      })
      .catch(function (err) {
        marcarGuardando(panel, false);
        if (btnGuardarConteo) btnGuardarConteo.disabled = false;
        marcarCambiosSinGuardar_(); // el guardado falló: sigue habiendo cambios sin guardar
        mostrarErrorServidor(err);
        if (onDone) onDone(false);
      });
  }
  if (btnGuardarConteo) {
    btnGuardarConteo.onclick = function (e) {
      e.stopPropagation();
      autoguardarSeccion();
    };
  }

  // GUARDADO AUTOMÁTICO AL PERDER EL FOCO: si el usuario termina de tocar
  // una casilla de esta tabla y el foco se va fuera de ella (a otra
  // agrupación, a un botón, o fuera de la página), se guarda solo, sin
  // esperar a que pulse "Guardar conteo" a mano. Si el foco simplemente
  // salta a otra casilla DENTRO de la misma tabla (lo normal al usar
  // Tab o ir campo a campo), no se hace nada todavía: se espera a que de
  // verdad termine con esta agrupación. El botón sigue ahí como respaldo
  // manual y como indicador visual de si queda algo sin guardar.
  tableWrap.addEventListener('focusout', function () {
    if (!editable) return;
    // No nos fiamos solo de e.relatedTarget (en algunos navegadores llega
    // null al hacer clic fuera de la ventana o en un elemento no
    // enfocable), así que se revisa en el siguiente tick dónde ha
    // quedado realmente el foco.
    setTimeout(function () {
      const focoActual = document.activeElement;
      const siguetocandoEstaTabla = focoActual && tableWrap.contains(focoActual);
      if (siguetocandoEstaTabla) return; // saltó a otra casilla de la misma tabla: no hacer nada aún
      if (!hayCambiosSinGuardar) return; // nada pendiente
      autoguardarSeccion();
    }, 0);
  }, true);

  actualizarBotonesEnvio_(); // estado inicial: envío apagado hasta el primer "Guardar conteo" de esta sesión

  /** Recalcula EN VIVO (sin esperar a guardar ni a recargar) si esta
   *  agrupación "tiene datos" (pendiente -> en progreso), para que el
   *  borde de la cabecera y el punto de "Acceso rápido a agrupación" se
   *  pongan en naranja nada más empezar a escribir, en vez de solo tras
   *  guardar/enviar o recargar la página. Nunca toca una agrupación ya
   *  enviada (candado). */
  function actualizarEstadoLocalSeccion_() {
    if (seccion.estado === 'enviado') return;
    let tieneDatos = false;
    tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
      if (tr.classList.contains('fila-grupo-header') || tr.classList.contains('fila-cerrada') || tr.classList.contains('fila-sale-excepcion')) return;
      tr.querySelectorAll('input.celda').forEach(function (inp) {
        const v = String(inp.value || '').trim();
        if (v !== '' && v.toUpperCase() !== 'NO') tieneDatos = true;
      });
    });
    const nuevoEstado = tieneDatos ? 'progreso' : 'pendiente';
    if (seccion.estado === nuevoEstado) return;
    seccion.estado = nuevoEstado;
    panel.classList.remove('estado-pendiente', 'estado-progreso');
    panel.classList.add('estado-' + nuevoEstado);
    actualizarMenuRapidoItem_(seccion);
  }

  tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
    if (tr.classList.contains('fila-grupo-header')) {
      return; // fila-resumen del grupo: no es una tienda, no lleva inputs
    }
    if (tr.classList.contains('fila-sale-excepcion')) {
      return; // tienda que hoy sale por otra agrupación: solo un td-colspan informativo, sin inputs
    }
    if (tr.classList.contains('fila-cerrada')) {
      const btnReabrir = tr.querySelector('.btn-reabrir');
      if (btnReabrir) {
        btnReabrir.onclick = function () {
          if (!editable) return;
          const cierreId = tr.getAttribute('data-cierre-id');
          appConfirm('Reabrir tienda', '¿Quieres reabrir esta tienda para el conteo de hoy?', function () {
            eliminarObservacionYRecargar(cierreId);
          });
        };
      }
    } else {
      attachCalculoYValidacion(tr);
      attachForzarNo(tr);
      tr.querySelectorAll('input.celda:not(.celda-total):not(.celda-total-visual)').forEach(function (input) {
        input.addEventListener('input', function () {
          marcarCambiosSinGuardar_();
          actualizarTotalPalets();
          actualizarEstadoLocalSeccion_();
        });
      });
      const btnCerrar = tr.querySelector('.btn-cerrar-tienda');
      if (btnCerrar) {
        btnCerrar.onclick = function () {
          if (!editable) return;
          const nombreTienda = tr.getAttribute('data-nombre');
          appPrompt('Cerrar tienda', 'Motivo (ej. "Tienda cerrada, no se da a agencia")…', function (texto) {
            guardarObservacionYRecargar({ fecha: fecha, dia: dia, agrupacion: seccion.nombre, tienda: nombreTienda, tipo: 'cierre', texto: texto });
          });
        };
      }
    }
  });

  attachValidacionGrupos(tableWrap);

  const btnHeaderPrevision = header.querySelector('.btn-header-prevision');
  if (btnHeaderPrevision) {
    btnHeaderPrevision.onclick = function (e) {
      e.stopPropagation();
      // El botón se ve siempre, pero enviar requiere el permiso "Enviar previsión"
      // (el backend lo vuelve a comprobar en enviar_prevision_agencia).
      if (!tienePermiso('enviar_prevision')) { mostrarModalSinPermiso(); return; }
      mostrarModalEnviarAgencia(calcularResumenEnvio(), function (callback) {
        enviarSeccion('prevision', callback);
      }, 'prevision');
    };
  }

  const btnHeaderDefinitivo = header.querySelector('.btn-header-definitivo');
  if (btnHeaderDefinitivo) {
    btnHeaderDefinitivo.onclick = function (e) {
      e.stopPropagation();
      // Igual que la previsión: requiere el permiso "Enviar definitivo"
      // (el backend lo vuelve a comprobar en enviar_definitivo_agencia).
      if (!tienePermiso('enviar_definitivo')) { mostrarModalSinPermiso(); return; }
      mostrarModalEnviarAgencia(calcularResumenEnvio(), function (callback) {
        enviarSeccion('definitivo', callback);
      }, 'definitivo');
    };
  }

  // Enlaza el click de "Deshacer envío" sobre el botón que se le pase: sirve
  // tanto para el que ya viniera en el HTML inicial del panel (si la página
  // se carga con la agrupación ya enviada hoy) como para el que se añade
  // dinámicamente justo después de un envío definitivo (ver
  // aplicarResultadoEnvio_ más abajo), sin duplicar esta lógica.
  function bindBotonDeshacerEnvio_(btnDeshacerEnvio) {
    if (!btnDeshacerEnvio) return;
    btnDeshacerEnvio.onclick = function (e) {
      e.stopPropagation();
      appConfirm(
        'Deshacer envío',
        'Vas a deshacer el envío de "' + seccion.nombre + '". Se quitará la marca de enviado y se recuperarán los datos para poder seguir editándolos. Solo puedes hacer esto el mismo día en que se envió. ¿Seguro que quieres continuar?',
        function () {
          btnDeshacerEnvio.disabled = true;
          google.script.run
            .withSuccessHandler(function () {
              btnDeshacerEnvio.disabled = false;
              cargarConteoDia();
              cargarCalendario();
            })
            .withFailureHandler(function (err) {
              btnDeshacerEnvio.disabled = false;
              mostrarErrorServidor(err);
            })
            .deshacerEnvioSeccion(dia, seccion.nombre, fecha);
        },
        true
      );
    };
  }
  bindBotonDeshacerEnvio_(header.querySelector('.btn-deshacer-envio'));

  const btnPdf = header.querySelector('.btn-pdf-seccion');
  if (btnPdf) {
    btnPdf.onclick = function (e) {
      e.stopPropagation();
      generarPdfSeccion(seccion, dia, fecha, tableWrap);
    };
  }

  const btnPdfEspecial = header.querySelector('.btn-pdf-especial-seccion');
  if (btnPdfEspecial) {
    btnPdfEspecial.onclick = function (e) {
      e.stopPropagation();
      generarPdfEspecialSeccion(seccion, dia, fecha, tableWrap);
    };
  }

  /** Recopila, en vivo desde los inputs actuales, los datos para el modal de envío. */
  function calcularResumenEnvio() {
    let totalTiendas = 0;
    let tiendasConDatos = 0;
    const pendientes = [];
    const excedidas = [];
    const pesoFaltante = [];
    tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
      if (tr.classList.contains('fila-grupo-header') || tr.classList.contains('fila-cerrada') || tr.classList.contains('fila-sale-excepcion')) return;
      totalTiendas++;
      const totalInput = tr.querySelector('input[data-campo="total"]');
      const valor = totalInput ? parseFloat(totalInput.value) : NaN;
      if (!isNaN(valor) && valor > 0) tiendasConDatos++;
      else pendientes.push(tr.getAttribute('data-nombre') || '');
      const limite = parseFloat(tr.getAttribute('data-limite'));
      if (!isNaN(valor) && valor > 0 && !isNaN(limite) && limite > 0 && valor > limite) {
        excedidas.push({
          nombre: tr.getAttribute('data-nombre') || '',
          total: valor,
          limite: limite,
          exceso: valor - limite
        });
      }
      if (seccion.tienePeso && !isNaN(valor) && valor > 0) {
        const pesoInput = tr.querySelector('input[data-campo="peso"]');
        const peso = pesoInput ? parseFloat(pesoInput.value) : NaN;
        if (isNaN(peso) || peso <= 0) pesoFaltante.push(tr.getAttribute('data-nombre') || '');
      }
    });
    let totalPalets = 0;
    tableWrap.querySelectorAll('input.celda-total').forEach(function (inp) {
      const v = parseFloat(inp.value);
      if (!isNaN(v)) totalPalets += v;
    });
    return {
      nombre: seccion.nombre,
      fechaTexto: formatearFechaLarga(fecha),
      totalTiendas: totalTiendas,
      tiendasConDatos: tiendasConDatos,
      pendientes: pendientes,
      totalPalets: totalPalets,
      excedidas: excedidas,
      pesoFaltante: pesoFaltante
    };
  }

  function enviarSeccion(tipo, callback) {
    if (!editable) { if (callback) callback(false, 'Esta agrupación ya no se puede modificar.'); return; }
    const btnPrevision = header.querySelector('.btn-header-prevision');
    const btnDefinitivo = header.querySelector('.btn-header-definitivo');
    if (btnPrevision) btnPrevision.disabled = true;
    if (btnDefinitivo) btnDefinitivo.disabled = true;
    const metodo = tipo === 'definitivo' ? 'enviarDefinitivoAgencia' : 'enviarPrevisionAgencia';
    // Guarda inmediatamente (sin esperar el debounce) y, si todo va bien, envía.
    autoguardarSeccion(function (ok) {
      if (!ok) {
        if (btnPrevision) btnPrevision.disabled = false;
        if (btnDefinitivo) btnDefinitivo.disabled = false;
        if (callback) callback(false, 'No se han podido guardar los datos. Inténtalo de nuevo.');
        return;
      }
      google.script.run
        .withSuccessHandler(function (res) {
          if (btnPrevision) btnPrevision.disabled = false;
          if (btnDefinitivo) btnDefinitivo.disabled = false;
          aplicarResultadoEnvio_(tipo, res);
          // El cuadrante (este panel) ya se ha actualizado en vivo, sin
          // recargar nada; solo se refresca el calendario mensual (ligero,
          // sin loader de página) para que la celda del día refleje el
          // nuevo estado (pendiente/parcial/enviado).
          cargarCalendario();
          const mensaje = tipo === 'definitivo' 
          ? 'Definitivo enviado correctamente' 
          : 'Previsión enviada correctamente';

if (callback) callback(true, mensaje);
        })
        .withFailureHandler(function (err) {
          if (btnPrevision) btnPrevision.disabled = false;
          if (btnDefinitivo) btnDefinitivo.disabled = false;
          if (callback) callback(false, (err && err.message) ? err.message : String(err));
        })
        [metodo](dia, seccion.nombre, fecha);
    });
  }

  /**
   * Aplica el resultado de un envío de previsión/definitivo directamente
   * sobre el panel ya pintado en pantalla, sin volver a pedir todo el
   * cuadrante al servidor (mismo espíritu que quitarDeCacheFestivos_ en
   * "Gestión festivos": actualizar en vivo el estado local + el DOM).
   *
   *  - 'prevision': no bloquea nada; solo se añade/actualiza el badge
   *    "Previsión enviada" y se oculta el botón de "Enviar Previsión".
   *  - 'definitivo': la agrupación pasa a "enviado": se bloquean los
   *    inputs de la tabla, se ocultan los botones de envío, se actualiza
   *    el badge de estado y, si es hoy, aparece "Deshacer envío".
   */
  function aplicarResultadoEnvio_(tipo, resultado) {
    if (tipo === 'prevision') {
      seccion.previsionEnviada = (resultado && resultado.previsionEnviada) || seccion.previsionEnviada || '';
      seccion.previsionEnviadaPor = (resultado && resultado.enviadoPor) || seccion.previsionEnviadaPor || '';

      const badgeExistente = header.querySelector('.badge-prevision');
      if (badgeExistente) badgeExistente.remove();
      const wrapTmp = document.createElement('div');
      wrapTmp.innerHTML = badgePrevision(seccion);
      const nuevoBadge = wrapTmp.firstElementChild;
      if (nuevoBadge) {
        const anclaBoton = header.querySelector('.btn-header-prevision, .btn-header-definitivo');
        if (anclaBoton) anclaBoton.insertAdjacentElement('beforebegin', nuevoBadge);
        else header.appendChild(nuevoBadge);
      }

      const btnPrevisionEl = header.querySelector('.btn-header-prevision');
      if (btnPrevisionEl) btnPrevisionEl.remove();
      actualizarMenuRapidoItem_(seccion);
      return;
    }

    // tipo === 'definitivo'
    seccion.estado = 'enviado';
    seccion.horaEnvio = (resultado && resultado.horaEnvio) || seccion.horaEnvio || '';
    seccion.enviadoPor = (resultado && resultado.enviadoPor) || seccion.enviadoPor || '';
    // OJO: seccion.previsionEnviada NO se limpia aquí a propósito: el
    // backend (Estado_Previsiones) tampoco se borra al enviar el
    // definitivo, así que si se había mandado antes una previsión, su
    // badge se sigue viendo junto al de "Definitivo enviado" -- igual que
    // pasaría si recargases la página. Si aquí lo ocultáramos, quedaría
    // una diferencia entre "recién enviado, en esta sesión" y "recargado
    // desde cero", que es justo lo que queremos evitar.
    editable = false;

    panel.classList.remove('estado-pendiente', 'estado-progreso');
    panel.classList.add('estado-enviado', 'no-editable');

    const badgeEstadoExistente = header.querySelector('.badge-enviado, .badge-progreso');
    if (badgeEstadoExistente) badgeEstadoExistente.remove();

    const wrapTmp = document.createElement('div');
    wrapTmp.innerHTML = badgeEstado(seccion);
    const nuevoBadgeEstado = wrapTmp.firstElementChild;
    const countEl = header.querySelector('.name-row .count');
    if (nuevoBadgeEstado && countEl) countEl.insertAdjacentElement('afterend', nuevoBadgeEstado);

    const btnPrevisionEl = header.querySelector('.btn-header-prevision');
    if (btnPrevisionEl) btnPrevisionEl.remove();
    const btnDefinitivoEl = header.querySelector('.btn-header-definitivo');
    if (btnDefinitivoEl) btnDefinitivoEl.remove();

    if (esHoy && !header.querySelector('.btn-deshacer-envio')) {
      const wrapBtn = document.createElement('div');
      wrapBtn.innerHTML = htmlBotonDeshacerEnvio_();
      const nuevoBtn = wrapBtn.firstElementChild;
      const anclaBoton = header.querySelector('.btn-header-prevision, .btn-header-definitivo');
      if (anclaBoton) anclaBoton.insertAdjacentElement('beforebegin', nuevoBtn);
      else header.appendChild(nuevoBtn);
      bindBotonDeshacerEnvio_(nuevoBtn);
    }

    tableWrap.querySelectorAll('input.celda, input.celda-total').forEach(function (input) { input.disabled = true; });
    tableWrap.querySelectorAll('.btn-cerrar-tienda, .btn-reabrir, input.celda-no').forEach(function (btn) { btn.disabled = true; });
    actualizarMenuRapidoItem_(seccion);
  }

  // AUTOREFRESCO EN VIVO (varios ordenadores a la vez): antes de devolver
  // el panel se le cuelgan dos cosas para que refrescarConteoDiaEnVivo_()
  // sepa si puede sustituirlo sin molestar:
  //  - _firma: "foto" de los datos con los que se pintó, para no
  //    reconstruir nada si el próximo sondeo trae exactamente lo mismo.
  //  - _enUso: si hay cambios sin guardar, un guardado en curso, o el
  //    foco está dentro de este panel, se considera que el usuario está
  //    trabajando aquí y el refresco automático no debe tocarlo todavía
  //    (se reintentará en el siguiente sondeo).
  panel._firma = JSON.stringify([seccion, dia, esHoy]);
  panel._enUso = function () {
    // OJO: document.activeElement es por documento, no por ventana. Si el
    // usuario hizo clic en una casilla de esta agrupación y luego cambió de
    // ventana/pestaña SIN volver a tocar nada en esta página, el navegador
    // no dispara "focusout" (el foco no se ha movido a otro elemento del
    // DOM) y esa casilla se queda como activeElement para siempre, aunque
    // la ventana ya no esté activa. Sin el "document.hasFocus() &&" de abajo,
    // eso bloquearía el autorefresco de esta agrupación indefinidamente. Por
    // eso el "cursor puesto en un campo" solo cuenta como "en uso" si la
    // ventana realmente tiene el foco en este instante; los cambios sin
    // guardar o un guardado en curso sí protegen siempre, foco o no.
    return hayCambiosSinGuardar || (btnGuardarConteo && btnGuardarConteo.disabled) || (document.hasFocus() && panel.contains(document.activeElement));
  };

  return panel;
}
