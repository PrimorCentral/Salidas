/* SALIDAS · js/emails-agencias.js — Configuración: Configuración agencias */

/* ---------------- CONFIGURACIÓN: "Configuración agencias" ----------------
 * Lista editable de "Config_Agrupaciones" (nombre de la ruta, notas y
 * emails de la agencia de transporte), para gestionarla desde la propia
 * app en vez de tener que abrir la Google Sheet. Cualquier rol puede
 * consultarla; solo "admin" puede editar, borrar, crear o sincronizar (los
 * campos e iconos correspondientes se muestran/ocultan vía CSS con la
 * clase "es-admin" del <body>, igual que el resto de acciones de solo
 * administrador de la app).
 *
 * Esta pantalla es la única fuente de verdad para dar de alta una
 * agrupación nueva: "Añadir ruta nueva" (en Rutas y tiendas) solo deja
 * elegir entre las agrupaciones que ya existen aquí, así que una
 * agrupación completamente nueva se tiene que crear primero con el botón
 * "Nueva agencia" de abajo (ver abrirModalNuevaAgrupacionConfig_).
 */
let EMAILS_CONFIG_ESTADO = { datos: [], filtroTexto: '', soloSinUso: false, soloNueva: false, soloSinEmail: false };
/** Nº de tiendas configuradas por agrupación (clave de ruta), calculado a
 *  partir de Config_Tiendas cada vez que se carga "Configuración agencias". */
let TIENDAS_POR_AGRUPACION_CONFIG_ = {};

// Calcula el alto disponible en pantalla para una lista con scroll propio
// dentro de Configuración o Administración (para que sea ELLA la que se
// desplace, y no toda la página): mide dónde termina la cabecera fija de
// encima y deja un margen para el padding inferior de la tarjeta, en vez
// de usar un número fijo en CSS que no encaja en todas las pantallas.
function ajustarAlturaListaScrollable_(idLista) {
  if (ESTADO.vista !== 'configuracion' && ESTADO.vista !== 'administracion') return;
  const listaEl = document.getElementById(idLista);
  if (!listaEl) return;
  const top = listaEl.getBoundingClientRect().top;
  if (top <= 0) return; // sección no visible ahora mismo
  const disponible = window.innerHeight - top - 50; // 50px = padding inferior de la tarjeta (22) + borde (1) + padding inferior de main (24) + margen
  listaEl.style.maxHeight = Math.max(160, Math.round(disponible)) + 'px';
}
let _timerAjusteAlturasConfig = null;
function ajustarAlturasListasConfig_debounced_() {
  clearTimeout(_timerAjusteAlturasConfig);
  _timerAjusteAlturasConfig = setTimeout(function () {
    ajustarAlturaListaScrollable_('emails-config-lista');
    ajustarAlturaListaScrollable_('festivos-lista');
    ajustarAlturaListaScrollable_('tiendas-config-lista');
    ajustarAlturaListaScrollable_('barrido-resultado');
  }, 120);
}

function renderConfigEmails() {
  const cont = document.getElementById('config-contenido');
  if (!cont) return;

  EMAILS_CONFIG_ESTADO.soloSinUso = false;
  EMAILS_CONFIG_ESTADO.soloNueva = false;
  EMAILS_CONFIG_ESTADO.soloSinEmail = false;
  EMAILS_CONFIG_ESTADO.filtroTexto = '';

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="emails-config-fijo">' +
        '<div class="vista-card-header">' +
          '<h2>Configuración agencias <span class="tiendas-config-total" id="emails-config-total"></span><span class="tiendas-config-total nueva-toggle" id="emails-config-nueva" title="Mostrar solo las agrupaciones nuevas (falta email)"></span><span class="tiendas-config-total sinuso-toggle" id="emails-config-sinuso" title="Mostrar solo las agrupaciones sin uso"></span><span class="tiendas-config-total sinemail-toggle" id="emails-config-sinemail" title="Mostrar solo las agrupaciones sin ningún email configurado"></span></h2>' +
          '<div class="vista-card-header-acciones">' +
            (tienePermiso('agencias') ?
              '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-nueva-agrupacion-config" title="Da de alta una agencia/agrupación nueva (todavía sin ruta asignada)">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
                'Nueva agencia</button>' : '') +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-exportar-pdf-emails" title="Exporta la lista visible (respeta el buscador y los filtros) a PDF">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
              'PDF</button>' +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-exportar-excel-emails" title="Exporta la lista visible (respeta el buscador y los filtros) a Excel (CSV)">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
              'Excel</button>' +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-sincronizar-agrupaciones" title="Vuelve a recorrer todas las hojas de día y añade las agrupaciones nuevas / marca las que ya no se usan">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
              'Buscar y sincronizar cambios de agrupaciónes</button>' +
            '</div>' +
        '</div>' +
        '<p>Configuración de emails de la agencia de transporte de cada agrupación (ruta): unos para "Enviar Previsión" y otros para "Enviar Definitivo" — pueden ser los mismos o distintos.</p>' +
        '<div class="emails-config-solo-lectura">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
          'Solo lectura: entra con la contraseña de administrador para poder editar o borrar.' +
        '</div>' +
        '<div class="emails-config-toolbar">' +
          '<div class="emails-config-busqueda">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input type="text" id="emails-config-buscar" placeholder="Buscar agrupación o email…">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="emails-config-lista"><div class="loader">Cargando…</div></div>' +
    '</div>';

  document.getElementById('btn-sincronizar-agrupaciones').onclick = sincronizarAgrupacionesDesdeApp_;
  document.getElementById('btn-exportar-pdf-emails').onclick = exportarAgrupacionesConfigPDF_;
  document.getElementById('btn-exportar-excel-emails').onclick = exportarAgrupacionesConfigExcel_;
  const btnNuevaAgrupacion = document.getElementById('btn-nueva-agrupacion-config');
  if (btnNuevaAgrupacion) btnNuevaAgrupacion.onclick = abrirModalNuevaAgrupacionConfig_;

  let temporizadorBusquedaEmails = null;
  document.getElementById('emails-config-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusquedaEmails);
    const valor = e.target.value;
    temporizadorBusquedaEmails = setTimeout(function () {
      EMAILS_CONFIG_ESTADO.filtroTexto = valor.trim().toLowerCase();
      pintarListaEmails_();
    }, 200);
  });

  cargarAgrupacionesConfig_();
  ajustarAlturaListaScrollable_('emails-config-lista');
  window.addEventListener('resize', ajustarAlturasListasConfig_debounced_);
}

/** Actualiza los contadores junto al título de "Configuración agencias": nº total,
 *  nº "sin uso", nº "nueva" (falta email) y nº "sin email" (ninguna
 *  agrupación con Definitivo ni Previsión rellenos, para que no se escape
 *  ninguna aunque no esté marcada como "Nueva"). Los tres badges son
 *  clicables y excluyentes entre sí. */
function actualizarTotalEmailsConfig_() {
  const elTotal = document.getElementById('emails-config-total');
  const elSinUso = document.getElementById('emails-config-sinuso');
  const elNueva = document.getElementById('emails-config-nueva');
  const elSinEmail = document.getElementById('emails-config-sinemail');
  if (!elTotal || !elSinUso || !elNueva || !elSinEmail) return;

  const total = EMAILS_CONFIG_ESTADO.datos.length;
  elTotal.textContent = total + (total === 1 ? ' agrupación' : ' agrupaciones');

  const sinUso = EMAILS_CONFIG_ESTADO.datos.filter(function (it) {
    return /^SIN USO/i.test(it.estado || '');
  }).length;
  const nueva = EMAILS_CONFIG_ESTADO.datos.filter(function (it) {
    return /^NUEVA/i.test(it.estado || '');
  }).length;
  const sinEmail = EMAILS_CONFIG_ESTADO.datos.filter(function (it) {
    return (!it.emails || !it.emails.length) && (!it.emailsPrevision || !it.emailsPrevision.length);
  }).length;

  elSinUso.textContent = sinUso + ' sin uso';
  elNueva.textContent = nueva + ' nueva' + (nueva === 1 ? '' : 's');
  elSinEmail.textContent = sinEmail + ' sin email';
  if (sinUso === 0) EMAILS_CONFIG_ESTADO.soloSinUso = false;
  if (nueva === 0) EMAILS_CONFIG_ESTADO.soloNueva = false;
  if (sinEmail === 0) EMAILS_CONFIG_ESTADO.soloSinEmail = false;
  elSinUso.classList.toggle('activo', EMAILS_CONFIG_ESTADO.soloSinUso);
  elNueva.classList.toggle('activo', EMAILS_CONFIG_ESTADO.soloNueva);
  elSinEmail.classList.toggle('activo', EMAILS_CONFIG_ESTADO.soloSinEmail);

  elSinUso.onclick = function () {
    EMAILS_CONFIG_ESTADO.soloSinUso = !EMAILS_CONFIG_ESTADO.soloSinUso;
    if (EMAILS_CONFIG_ESTADO.soloSinUso) { EMAILS_CONFIG_ESTADO.soloNueva = false; EMAILS_CONFIG_ESTADO.soloSinEmail = false; }
    elSinUso.classList.toggle('activo', EMAILS_CONFIG_ESTADO.soloSinUso);
    elNueva.classList.remove('activo');
    elSinEmail.classList.remove('activo');
    pintarListaEmails_();
    ajustarAlturaListaScrollable_('emails-config-lista');
  };

  elNueva.onclick = function () {
    EMAILS_CONFIG_ESTADO.soloNueva = !EMAILS_CONFIG_ESTADO.soloNueva;
    if (EMAILS_CONFIG_ESTADO.soloNueva) { EMAILS_CONFIG_ESTADO.soloSinUso = false; EMAILS_CONFIG_ESTADO.soloSinEmail = false; }
    elNueva.classList.toggle('activo', EMAILS_CONFIG_ESTADO.soloNueva);
    elSinUso.classList.remove('activo');
    elSinEmail.classList.remove('activo');
    pintarListaEmails_();
    ajustarAlturaListaScrollable_('emails-config-lista');
  };

  elSinEmail.onclick = function () {
    EMAILS_CONFIG_ESTADO.soloSinEmail = !EMAILS_CONFIG_ESTADO.soloSinEmail;
    if (EMAILS_CONFIG_ESTADO.soloSinEmail) { EMAILS_CONFIG_ESTADO.soloSinUso = false; EMAILS_CONFIG_ESTADO.soloNueva = false; }
    elSinEmail.classList.toggle('activo', EMAILS_CONFIG_ESTADO.soloSinEmail);
    elSinUso.classList.remove('activo');
    elNueva.classList.remove('activo');
    pintarListaEmails_();
    ajustarAlturaListaScrollable_('emails-config-lista');
  };
}

/** Exporta a PDF la lista de agrupaciones visible en ese momento (respeta
 *  el buscador y los badges "sin uso" / "nueva" / "sin email" activos), con
 *  columnas Agrupación, Emails Definitivo, Emails Previsión, Días y Nota. */
function exportarAgrupacionesConfigPDF_() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarErrorServidor({ message: 'No se pudo cargar el generador de PDF.' });
    return;
  }
  const jsPDF = window.jspdf.jsPDF;
  const items = obtenerAgrupacionesConfigFiltradas_();

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'l' });
  doc.setFontSize(13);
  doc.text('Configuración agencias', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(items.length + ' agrupación' + (items.length === 1 ? '' : 'es') + ' — ' + hoyStr(), 14, 20);
  doc.setTextColor(0);

  doc.autoTable({
    startY: 25,
    head: [['Agrupación', 'Emails Definitivo', 'Emails Previsión', 'Días', 'Nota']],
    body: items.map(function (it) {
      return [
        it.agrupacion || '',
        (it.emails || []).join(', '),
        (it.emailsPrevision || []).join(', '),
        (it.dias || []).join(', '),
        it.notas || ''
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 60 },
      2: { cellWidth: 60 },
      3: { cellWidth: 45 },
      4: { cellWidth: 'auto' }
    }
  });

  doc.save('agrupaciones_' + hoyStr() + '.pdf');
}

/** Exporta a Excel (CSV con BOM y ; como separador) la misma lista visible
 *  que la exportación a PDF, con las mismas columnas. */
function exportarAgrupacionesConfigExcel_() {
  const items = obtenerAgrupacionesConfigFiltradas_();
  const filas = [['Agrupación', 'Emails Definitivo', 'Emails Previsión', 'Días', 'Nota']].concat(items.map(function (it) {
    return [
      it.agrupacion || '',
      (it.emails || []).join(', '),
      (it.emailsPrevision || []).join(', '),
      (it.dias || []).join(', '),
      it.notas || ''
    ];
  }));

  const csv = filas.map(function (fila) {
    return fila.map(function (campo) {
      return '"' + String(campo == null ? '' : campo).replace(/"/g, '""') + '"';
    }).join(';');
  }).join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agrupaciones_' + hoyStr() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function cargarAgrupacionesConfig_() {
  if (ESTADO.vista !== 'configuracion' || ESTADO_CONFIG.seccionActiva !== 'emails') return;
  Promise.all([
    llamarApi_('getAgrupacionesConfig', []),
    llamarApi_('getTiendasConfig', [])
  ])
    .then(function (resultados) {
      if (ESTADO.vista !== 'configuracion' || ESTADO_CONFIG.seccionActiva !== 'emails') return;
      EMAILS_CONFIG_ESTADO.datos = resultados[0] || [];
      TIENDAS_POR_AGRUPACION_CONFIG_ = calcularTiendasPorAgrupacion_(resultados[1] || []);
      pintarListaEmails_();
      actualizarTotalEmailsConfig_();
      ajustarAlturaListaScrollable_('emails-config-lista');
    })
    .catch(function (err) {
      mostrarErrorServidor(err);
      const listaEl = document.getElementById('emails-config-lista');
      if (listaEl) listaEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar la lista.</div>';
    });
}

/** Cuenta, para cada agrupación (clave de ruta), cuántas tiendas tienen esa
 *  agrupación entre las suyas (una tienda puede estar en varias agrupaciones
 *  distintas según el día). Se usa en la tarjeta de "Configuración agencias" para
 *  mostrar "Tiendas configuradas: X tiendas". */
function calcularTiendasPorAgrupacion_(tiendas) {
  const mapa = {};
  (tiendas || []).forEach(function (t) {
    (t.agrupaciones || []).forEach(function (a) {
      mapa[a] = (mapa[a] || 0) + 1;
    });
  });
  return mapa;
}

/** Aplica el buscador y los badges (sin uso / nueva / sin email) activos en
 *  EMAILS_CONFIG_ESTADO sobre EMAILS_CONFIG_ESTADO.datos. Centralizado
 *  aquí para que la lista en pantalla y las exportaciones a PDF/Excel
 *  muestren siempre exactamente lo mismo. */
function obtenerAgrupacionesConfigFiltradas_() {
  const filtro = EMAILS_CONFIG_ESTADO.filtroTexto;
  return EMAILS_CONFIG_ESTADO.datos.filter(function (it) {
    const sinEmail = (!it.emails || !it.emails.length) && (!it.emailsPrevision || !it.emailsPrevision.length);
    if (EMAILS_CONFIG_ESTADO.soloSinUso && !/^SIN USO/i.test(it.estado || '')) return false;
    if (EMAILS_CONFIG_ESTADO.soloNueva && !/^NUEVA/i.test(it.estado || '')) return false;
    if (EMAILS_CONFIG_ESTADO.soloSinEmail && !sinEmail) return false;
    if (!filtro) return true;
    const texto = (it.agrupacion + ' ' + it.emails.join(' ') + ' ' + (it.emailsPrevision || []).join(' ') + ' ' + (it.notas || '')).toLowerCase();
    return texto.indexOf(filtro) !== -1;
  });
}

function pintarListaEmails_() {
  const listaEl = document.getElementById('emails-config-lista');
  if (!listaEl) return;

  const items = obtenerAgrupacionesConfigFiltradas_();

  if (!items.length) {
    listaEl.innerHTML =
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>' +
        (EMAILS_CONFIG_ESTADO.soloSinUso
          ? 'Ninguna agrupación sin uso coincide con la búsqueda.'
          : (EMAILS_CONFIG_ESTADO.soloNueva
            ? 'Ninguna agrupación nueva coincide con la búsqueda.'
            : (EMAILS_CONFIG_ESTADO.soloSinEmail
              ? 'Ninguna agrupación sin email coincide con la búsqueda.'
              : (EMAILS_CONFIG_ESTADO.datos.length ? 'Ninguna agrupación coincide con la búsqueda.' : 'Todavía no hay agrupaciones en Config_Agrupaciones. Usa "Sincronizar con hojas de día" para traerlas.')))) +
      '</div>';
    return;
  }

  listaEl.innerHTML = items.map(function (it, idx) {
    const esNueva = /^NUEVA/i.test(it.estado || '');
    const esSinUso = /^SIN USO/i.test(it.estado || '');
    const esSinEmail = !esNueva && (!it.emails || !it.emails.length) && (!it.emailsPrevision || !it.emailsPrevision.length);
    const clase = 'emails-config-item' + (esNueva ? ' nueva' : (esSinUso ? ' sinuso' : (esSinEmail ? ' sinemail' : '')));
    const badge = esNueva
      ? '<span class="emails-config-badge nueva">Nueva — falta email</span>'
      : (esSinUso ? '<span class="emails-config-badge sinuso">Sin uso</span>'
        : (esSinEmail ? '<span class="emails-config-badge sinemail">Sin email</span>' : ''));
    const idSeguro = 'ec' + idx;
    const dias = it.dias || [];
    const nTiendas = TIENDAS_POR_AGRUPACION_CONFIG_[it.agrupacion] || 0;
    const filaDias =
      '<div class="emails-config-fila-info">' +
        '<div class="emails-config-fila-info-col">' +
          '<div class="emails-config-dias-etiqueta">Aparece en la hoja del</div>' +
          '<div class="emails-config-dias-conteo">' +
            (dias.length ? dias.map(escapeHtml).join(', ') : '—') +
          '</div>' +
        '</div>' +
        '<div class="emails-config-fila-info-col">' +
          '<div class="emails-config-dias-etiqueta">Tiendas configuradas</div>' +
          '<div class="emails-config-dias-conteo">' +
            nTiendas + (nTiendas === 1 ? ' tienda' : ' tiendas') +
          '</div>' +
        '</div>' +
      '</div>';
    return (
      '<div class="' + clase + '">' +
        '<div class="emails-config-cabecera">' +
          '<span class="emails-config-nombre">' + escapeHtml(it.agrupacion) + '</span>' +
          badge +
          '<button type="button" class="emails-config-borrar" title="' + (dias.length ? 'No se puede eliminar: todavía aparece en alguna hoja de día' : 'Eliminar de la configuración') + '" data-borrar="' + escapeAttr(it.agrupacion) + '" ' + (dias.length ? 'disabled' : '') + '>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>' +
          '</button>' +
        '</div>' +
        filaDias +
        '<div class="emails-config-campos">' +
          '<div class="emails-config-campo">' +
            '<label>Emails Definitivo (separados por comas)</label>' +
            '<input type="text" id="' + idSeguro + '_emails" value="' + escapeAttr(it.emails.join(', ')) + '" placeholder="agencia@ejemplo.com, otra@ejemplo.com" ' + (tienePermiso('agencias') ? '' : 'disabled') + '>' +
          '</div>' +
          '<div class="emails-config-campo">' +
            '<label>Emails Previsión (separados por comas)</label>' +
            '<input type="text" id="' + idSeguro + '_emailsPrevision" value="' + escapeAttr((it.emailsPrevision || []).join(', ')) + '" placeholder="agencia@ejemplo.com, otra@ejemplo.com" ' + (tienePermiso('agencias') ? '' : 'disabled') + '>' +
          '</div>' +
          '<div class="emails-config-campo">' +
            '<label>Notas</label>' +
            '<input type="text" id="' + idSeguro + '_notas" value="' + escapeAttr(it.notas || '') + '" placeholder="Notas libres (opcional)" ' + (tienePermiso('agencias') ? '' : 'disabled') + '>' +
          '</div>' +
        '</div>' +
        '<div class="emails-config-pie">' +
          '<button type="button" class="emails-config-guardar" data-guardar="' + escapeAttr(it.agrupacion) + '" data-id="' + idSeguro + '">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>' +
            'Guardar</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  listaEl.querySelectorAll('[data-guardar]').forEach(function (btn) {
    btn.onclick = function () { guardarEmailAgrupacion_(btn.getAttribute('data-guardar'), btn.getAttribute('data-id'), btn); };
  });
  listaEl.querySelectorAll('[data-borrar]').forEach(function (btn) {
    btn.onclick = function () { confirmarEliminarAgrupacionConfig_(btn.getAttribute('data-borrar')); };
  });
}

function guardarEmailAgrupacion_(agrupacion, idSeguro, btn) {
  const emailsTexto = document.getElementById(idSeguro + '_emails').value;
  const emailsPrevisionTexto = document.getElementById(idSeguro + '_emailsPrevision').value;
  const notas = document.getElementById(idSeguro + '_notas').value;
  btn.disabled = true;
  llamarApi_('guardarEmailsAgrupacion', [agrupacion, emailsTexto, notas, emailsPrevisionTexto])
    .then(function () {
      mostrarToast('Emails guardados');
      cargarAgrupacionesConfig_();
    })
    .catch(function (err) {
      btn.disabled = false;
      mostrarErrorServidor(err);
    });
}

function confirmarEliminarAgrupacionConfig_(agrupacion) {
  appConfirm(
    'Eliminar de la configuración',
    '¿Seguro que quieres eliminar "' + agrupacion + '" de Config_Agrupaciones? Si esa agrupación se sigue usando en alguna hoja de día, no se le podrá enviar el resumen por email hasta que vuelvas a añadirla.',
    function () { eliminarAgrupacionConfig_(agrupacion); }
  );
}

function eliminarAgrupacionConfig_(agrupacion) {
  llamarApi_('eliminarAgrupacionConfig', [agrupacion])
    .then(function () {
      mostrarToast('Eliminado');
      cargarAgrupacionesConfig_();
    })
    .catch(mostrarErrorServidor);
}

/** Modal para dar de alta una agrupación (agencia) nueva en
 *  Config_Agrupaciones, sin asignarla todavía a ninguna ruta/día -- por
 *  eso, nada más crearla, aparecerá en la lista como "SIN USO" hasta que
 *  se use como ruta desde "Rutas y tiendas" (botón "Añadir ruta nueva",
 *  que a partir de ahora solo deja elegir entre agrupaciones ya dadas de
 *  alta aquí). El backend (crear_agrupacion_config) normaliza el nombre
 *  con la misma regla que usa el resto de la app (_clave_agrupacion) y
 *  rechaza duplicados. */
function abrirModalNuevaAgrupacionConfig_() {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Nueva agencia';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label for="modal-nueva-agrupacion-nombre">Nombre de la agrupación</label>' +
      '<input type="text" id="modal-nueva-agrupacion-nombre" style="text-transform:uppercase;" placeholder="Ej: NIEVES">' +
      '<span class="modal-campo-ayuda">Usa el mismo nombre que luego elegirás al crear la ruta (sin la parte de ubicación/hora entre paréntesis).</span>' +
    '</div>' +
    '<p class="modal-campo-ayuda" style="margin-top:8px;">Esta agrupación quedará dada de alta pero "SIN USO" hasta que la elijas al añadir una ruta nueva desde "Rutas y tiendas".</p>';

  const inputNombre = document.getElementById('modal-nueva-agrupacion-nombre');
  inputNombre.oninput = function () {
    const pos = inputNombre.selectionStart;
    inputNombre.value = inputNombre.value.toUpperCase();
    inputNombre.setSelectionRange(pos, pos);
  };

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Crear agencia</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;

  document.getElementById('modal-confirm-btn').onclick = function () {
    const nombre = inputNombre.value.trim().replace(/\s+/g, ' ');
    if (!nombre) { inputNombre.focus(); return; }

    const btnConfirmar = document.getElementById('modal-confirm-btn');
    const avisoPrevio = document.getElementById('modal-nueva-agrupacion-error');
    if (avisoPrevio) avisoPrevio.remove();
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = 'Creando…';

    llamarApi_('crearAgrupacionConfig', [nombre])
      .then(function () {
        cerrarModal();
        mostrarToast('Agencia creada — todavía SIN USO, elígela al añadir una ruta nueva');
        cargarAgrupacionesConfig_();
      })
      .catch(function (err) {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Crear agencia';
        const aviso = document.createElement('div');
        aviso.id = 'modal-nueva-agrupacion-error';
        aviso.style.cssText = 'margin-top:12px;font-size:12.5px;color:var(--danger);background:#fceded;border-radius:8px;padding:9px 11px;';
        aviso.textContent = (err && err.message) ? err.message : 'No se ha podido crear la agencia.';
        document.getElementById('modal-custom').appendChild(aviso);
      });
  };
  setTimeout(function () { inputNombre.focus(); }, 50);
}

function sincronizarAgrupacionesDesdeApp_() {
  const btn = document.getElementById('btn-sincronizar-agrupaciones');
  if (btn) { btn.classList.add('girando'); btn.disabled = true; }
  llamarApi_('sincronizarAgrupaciones', [])
    .then(function (resultado) {
      if (btn) { btn.classList.remove('girando'); btn.disabled = false; }
      const nuevas = (resultado && resultado.nuevas) || [];
      const huerfanas = (resultado && resultado.huerfanas) || [];
      mostrarToast(!nuevas.length && !huerfanas.length
        ? 'Todo al día: no hay cambios'
        : nuevas.length + ' nueva(s), ' + huerfanas.length + ' sin uso');
      cargarAgrupacionesConfig_();
    })
    .catch(function (err) {
      if (btn) { btn.classList.remove('girando'); btn.disabled = false; }
      mostrarErrorServidor(err);
    });
}
