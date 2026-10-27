/* SALIDAS · js/conteos-pdf.js — Conteos diarios: PDF de agrupación y PDF especial */

/** Texto de una tienda con el conteo bloqueado (antes "tienda cerrada"):
 *  solo la observación que se escribió al bloquear, sin añadir "CERRADA". */
function textoBloqueoFila_(tr) {
  const motivo = tr.querySelector('.motivo-cierre');
  const texto = motivo ? motivo.textContent.trim() : '';
  return texto || 'CONTEO BLOQUEADO';
}

/**
 * Genera y descarga un PDF con el conteo completo de una agrupación: todas
 * sus tiendas y casillas (Límite, 60, PTA, CART., TOTAL, PDTE), tal cual
 * están en ese momento en la pantalla (incluye cambios aún sin autoguardar),
 * más las notas de carga, observaciones y el orden de retirada si los hay.
 *
 * Usa jsPDF + el plugin autoTable (cargados por CDN en el <head>). No se
 * usan emojis en el texto para evitar el mismo problema de renderizado que
 * ya se dio en los PDF de incidencias.
 *
 * SIEMPRE UNA SOLA PÁGINA: en vez de usar un A4 apaisado de tamaño fijo (lo
 * que hacía que autoTable repartiera las agrupaciones grandes en varias
 * páginas), primero se "mide" en un lienzo muy alto cuánto ocupa realmente
 * el contenido completo (cabecera + notas + todas las filas) y luego se crea
 * el PDF definitivo con el alto justo para que quepa entero: el ancho de A4
 * apaisado (297mm) siempre, y de alto el estándar de un A4 (210mm) si cabe,
 * o algo más alto si la agrupación es grande — pero nunca una página más.
 */
const PDF_ANCHO_MM_ = 297; // ancho fijo tipo A4 apaisado
const PDF_ALTO_A4_MM_ = 210; // alto estándar de un A4 apaisado

/** Columnas VIERNES y DOMINGO en el PDF (solo si la agrupación las tiene
 *  activadas ese día): van justo después de "Límite", igual que en
 *  pantalla, así que cada una desplaza una posición el resto de columnas
 *  (TOTAL pasa del índice 5 al 6, o al 7 si están las dos). */
function indiceTotalPdf_(seccion) {
  return 5 + (seccion.tieneViernes ? 1 : 0) + (seccion.tieneCasillaDomingo ? 1 : 0);
}

/** Lee de la tabla en pantalla (no de "seccion", para incluir cambios aún
 *  sin guardar) las filas [tienda, límite, (VIERNES), (DOMINGO), 60, PTA, CART., TOTAL, PDTE, (PESO), (C.EXPRESS), (SOBRESTOCK)].
 *  Con VIERNES / DOMINGO, el TOTAL de cada tienda los incluye (como en
 *  pantalla) y el total de la carga sin ellos se guarda aparte en
 *  fila._carga, para la fila de TOTAL GENERAL. */
function leerFilasPdfSeccion_(tableWrap, seccion) {
  const filas = [];
  const conViernes = !!seccion.tieneViernes;
  const conDomingo = !!seccion.tieneCasillaDomingo;
  tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
    if (tr.classList.contains('fila-grupo-header')) return;

    const nombre = tr.getAttribute('data-nombre') || '';

    if (tr.classList.contains('fila-cerrada')) {
      const limiteCelda = tr.querySelector('td.limite');
      filas.push([
        nombre,
        limiteCelda ? limiteCelda.textContent.trim() : ''
      ].concat(conViernes ? [''] : []).concat(conDomingo ? [''] : []).concat([
        textoBloqueoFila_(tr), '', '', '', ''
      ]).concat(seccion.tienePeso ? [''] : []).concat(seccion.tieneCExpress ? [''] : []).concat(seccion.tieneSobrestock ? [''] : []));
      return;
    }

    if (tr.classList.contains('fila-sale-excepcion')) {
      const limiteCelda = tr.querySelector('td.limite');
      const motivo = tr.querySelector('.motivo-excepcion');
      filas.push([
        nombre,
        limiteCelda ? limiteCelda.textContent.trim() : ''
      ].concat(conViernes ? [''] : []).concat(conDomingo ? [''] : []).concat([
        motivo ? motivo.textContent.trim() : 'SALE POR EXCEPCIÓN', '', '', '', ''
      ]).concat(seccion.tienePeso ? [''] : []).concat(seccion.tieneCExpress ? [''] : []).concat(seccion.tieneSobrestock ? [''] : []));
      return;
    }

    function valorCampo(campo) {
      const inp = tr.querySelector('input[data-campo="' + campo + '"]');
      return inp ? inp.value : '';
    }

    const totalCarga = valorCampo('total');
    let totalTienda = totalCarga;
    let celdaViernes = [];
    if (conViernes) {
      const excluida = tr.querySelector('.celda-viernes-excluida');
      const vieTxt = excluida ? 'X' : valorCampo('viernes');
      const vie = parseFloat(vieTxt);
      if (!isNaN(vie) && vie !== 0) {
        totalTienda = String((parseFloat(totalCarga) || 0) + vie);
      }
      celdaViernes = [vieTxt];
    }
    // DOMINGO: igual que VIERNES.
    let celdaDomingo = [];
    if (conDomingo) {
      const excluidaD = tr.querySelector('.celda-domingo-excluida');
      const domTxt = excluidaD ? 'X' : valorCampo('casillaDomingo');
      const dom = parseFloat(domTxt);
      if (!isNaN(dom) && dom !== 0) {
        totalTienda = String((parseFloat(totalTienda) || 0) + dom);
      }
      celdaDomingo = [domTxt];
    }

    const fila = [
      nombre,
      tr.getAttribute('data-limite') || ''
    ].concat(celdaViernes).concat(celdaDomingo).concat([
      valorCampo('c60'),
      valorCampo('pta'),
      valorCampo('cart'),
      totalTienda,
      valorCampo('pdte')
    ]).concat(seccion.tienePeso ? [valorCampo('peso')] : []).concat(seccion.tieneCExpress ? [valorCampo('cexpress')] : []).concat(seccion.tieneSobrestock ? [valorCampo('sobrestock')] : []);
    fila._carga = totalCarga;
    filas.push(fila);
  });
  return filas;
}

/** Crea un doc de jsPDF con el ancho/alto exactos pedidos (en mm), eligiendo
 *  la orientación ('p' o 'l') que ya cumple esa forma, para que jsPDF no
 *  intercambie ancho y alto por su cuenta (lo hace si, p.ej., pides
 *  orientación "landscape" pero el alto que le das es mayor que el ancho). */
function crearDocPdfPaginaExacta_(jsPDF, anchoMM, altoMM) {
  const orientacion = altoMM > anchoMM ? 'p' : 'l';
  return new jsPDF({ unit: 'mm', format: [anchoMM, altoMM], orientation: orientacion });
}

/** Dibuja la cabecera, las notas y la tabla completa de la agrupación en el
 *  doc dado (empezando siempre en la misma posición) y devuelve la
 *  coordenada Y justo debajo de la tabla, para poder saber cuánto ocupa. */
function dibujarPdfSeccion_(doc, partes, dia, fecha, fechaGeneracion, seccion, filas) {
  doc.setFontSize(8);
  doc.setTextColor(140, 148, 158);
  doc.text('Generado el ' + fechaGeneracion, 14, 10);
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(15);
  doc.setTextColor(28, 43, 69);
  doc.text(partes.titulo + (partes.ubicacion ? ' · ' + partes.ubicacion : ''), 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(90, 100, 114);
  doc.text((dia || '') + ' · ' + formatearFechaLarga(fecha), 14, 24);
  doc.setTextColor(0, 0, 0);

  let y = 31;

  if (seccion.notasCarga && seccion.notasCarga.length) {
    doc.setFontSize(9);
    seccion.notasCarga.forEach(function (texto) {
      doc.text('• ' + texto, 14, y);
      y += 5;
    });
    y += 2;
  }

  if (seccion.notas && seccion.notas.length) {
    doc.setFontSize(9);
    seccion.notas.forEach(function (n) {
      doc.text('Nota: ' + n.texto, 14, y);
      y += 5;
    });
    y += 2;
  }

  // Fila final de TOTAL GENERAL: suma del TOTAL de todas las tiendas no
  // cerradas (misma lógica que el total que se ve en el chip de cabecera
  // de la agrupación en pantalla). El resto de columnas de esa fila se
  // dejan en blanco salvo "Tienda", donde va la etiqueta.
  // Con VIERNES: el TOTAL GENERAL sigue siendo solo la carga (sin viernes,
  // igual que el chip de palets de la cabecera), y la suma de VIERNES va
  // aparte en su propia columna de esa misma fila.
  const idxTotal = indiceTotalPdf_(seccion);
  const totalGeneral = filas.reduce(function (acc, fila) {
    const v = parseFloat(fila._carga !== undefined ? fila._carga : fila[idxTotal]);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  // DOMINGO funciona igual que VIERNES (su suma, en su propia columna).
  const sumaColumnaPdf = function (idx) {
    return filas.reduce(function (acc, fila) {
      const v = parseFloat(fila[idx]);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  };
  const extrasFuera = [];
  if (seccion.tieneViernes) extrasFuera.push('viernes');
  if (seccion.tieneCasillaDomingo) extrasFuera.push('domingo');
  let filaTotal = [extrasFuera.length ? 'TOTAL CARGA (sin ' + extrasFuera.join(' ni ') + ')' : 'TOTAL GENERAL', ''];
  let idxCol = 2;
  if (seccion.tieneViernes) { filaTotal.push(String(sumaColumnaPdf(idxCol))); idxCol++; }
  if (seccion.tieneCasillaDomingo) { filaTotal.push(String(sumaColumnaPdf(idxCol))); idxCol++; }
  filaTotal = filaTotal.concat(['', '', '', String(totalGeneral), '']);
  filaTotal = filaTotal
    .concat(seccion.tienePeso ? [''] : [])
    .concat(seccion.tieneCExpress ? [''] : [])
    .concat(seccion.tieneSobrestock ? [''] : []);
  const filasConTotal = filas.concat([filaTotal]);
  const indiceFilaTotal = filasConTotal.length - 1;

  doc.autoTable({
    startY: y,
    head: [['Tienda', 'Límite'].concat(seccion.tieneViernes ? ['VIERNES'] : []).concat(seccion.tieneCasillaDomingo ? ['DOMINGO'] : []).concat(['60', 'PTA', 'CART.', 'TOTAL', 'PDTE']).concat(seccion.tienePeso ? ['PESO'] : []).concat(seccion.tieneCExpress ? ['C.EXPRESS'] : []).concat(seccion.tieneSobrestock ? ['SOBRESTOCK'] : [])],
    body: filasConTotal,
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'middle', halign: 'center' },
    headStyles: { fillColor: [28, 43, 69], textColor: 255, halign: 'center' },
    bodyStyles: { halign: 'center' },
    columnStyles: (function () {
      const cs = { 0: { fontStyle: 'bold', fontSize: 11, halign: 'left' } };
      cs[idxTotal] = { fontStyle: 'bold' };
      return cs;
    })(),
    // La fila de TOTAL GENERAL se pinta con un fondo distinto y en negrita,
    // igual que una fila de cierre en una tabla contable.
    didParseCell: function (data) {
      if (data.section === 'body' && data.row.index === indiceFilaTotal) {
        data.cell.styles.fillColor = [242, 245, 249];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.lineWidth = { top: 0.4 };
      }
    },
    // Margen inferior reducido y a propósito pequeño: la página final se
    // dimensiona para que quepa justo, así que no hace falta el hueco de
    // 20mm que deja autoTable por defecto (y que forzaría un salto de
    // página con el alto ajustado que calculamos más abajo).
    margin: { bottom: 10 },
    // Por si acaso: nunca partir una fila entre dos páginas.
    rowPageBreak: 'avoid'
  });

  return doc.lastAutoTable.finalY;
}

function generarPdfSeccion(seccion, dia, fecha, tableWrap) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast('No se ha podido cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.', true);
    return;
  }

  const jsPDF = window.jspdf.jsPDF;
  const partes = parsearNombreAgrupacion(seccion.nombre);

  // Fecha/hora de generación del PDF (no la fecha del conteo), arriba del todo.
  const ahora = new Date();
  const fechaGeneracion = Utilities_formatearFechaHora_(ahora);

  const filas = leerFilasPdfSeccion_(tableWrap, seccion);

  // 1ª pasada (de medición, se descarta): se dibuja todo en un lienzo muy
  // alto (2000mm) para que la tabla nunca necesite paginarse, y así saber
  // cuánto ocupa el contenido real completo, sea cual sea el tamaño de la
  // agrupación.
  const docMedida = crearDocPdfPaginaExacta_(jsPDF, PDF_ANCHO_MM_, 2000);
  const alturaContenido = dibujarPdfSeccion_(docMedida, partes, dia, fecha, fechaGeneracion, seccion, filas);

  // 2ª pasada (definitiva): si con el alto estándar de un A4 apaisado
  // (210mm) ya cabe todo, se usa ese tamaño normal de siempre; si la
  // agrupación es más grande, se alarga la página lo justo para que quepa
  // entera en UNA sola hoja (nunca se generan páginas adicionales).
  const alturaPagina = Math.max(PDF_ALTO_A4_MM_, alturaContenido + 14);
  const doc = crearDocPdfPaginaExacta_(jsPDF, PDF_ANCHO_MM_, alturaPagina);
  dibujarPdfSeccion_(doc, partes, dia, fecha, fechaGeneracion, seccion, filas);

  const nombreArchivo = 'Conteo_' + seccion.nombre.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '_' + fecha + '.pdf';
  doc.save(nombreArchivo);
}

/**
 * PDF ESPECIAL: mismo formato que la plantilla Excel de reparto en camión
 * (columnas LÍMITE CAMIÓN / NAVE CARGA / LÍMITE / TIENDA / NAVE 60 / PTA /
 * CÁRTAMA / TOTAL / TOTAL RUTA / FIRMA RES. TARDE / FIRMA RES.
 * NOCHE / CONFIRMACIÓN RECOGIDA / ZONA-PASILLO), pensado para imprimir y
 * rellenar a mano en el momento del reparto.
 *
 * Igual que en pantalla, las tiendas que comparten camión/ruta (la misma
 * anotación "8P MAX. POR RUTA" de las columnas K:L del Excel — en la app,
 * mismo "data-nota-grupo") se agrupan visualmente: LÍMITE CAMIÓN,
 * NAVE CARGA, TOTAL RUTA y los campos de firma se pintan en UNA sola celda que
 * abarca todas las filas de esa ruta (como una celda combinada), en vez de
 * repetirse en cada tienda. Una tienda sin ruta compartida forma su propio
 * grupo de una sola fila.
 *
 * - LÍMITE CAMIÓN sale del número de la anotación de la ruta (ej. "8P MAX.
 *   POR RUTA" -> 8) o, si la tienda va sola, de su propia nota ("8P MAX. -
 *   CARGA EN GAITE" -> 8). Sin número ("SIN LIMITE...") o sin nota: SIN LÍMITE.
 * - Ya no hay columna AGENCIA: el nombre de la agrupación sale en el título.
 * - TOTAL RUTA de una tienda suelta (que no es ruta) sale rayada (campo nulo).
 * - TOTAL RUTA es la suma en vivo del TOTAL de todas las tiendas de esa
 *   ruta (misma suma que ya se ve en pantalla en el chip de la
 *   fila-cabecera del grupo).
 * - NAVE CARGA sale de la anotación de la ruta (o de la tienda si va
 *   sola): "... CARGA EN GAITE" -> GAITE. En blanco si no lo dice.
 *   (Sustituye a la antigua columna SOBRAN, que ya no se usa.)
 * - LÍMITE, TIENDA, 60, PTA, CART. y TOTAL de cada fila salen de los
 *   datos ya introducidos en el conteo (igual que el PDF normal).
 * - Las 3 firmas y ZONA/PASILLO siguen en blanco para rellenar a mano,
 *   como se pidió: no hay ningún dato de la app del que puedan salir.
 */
/** Nave de carga sacada de la anotación de la ruta o de la tienda
 *  (ej. "8P MAX. POR RUTA - CARGA EN GAITE" -> "GAITE"). '' si no la dice. */
function naveCargaDeNota_(texto) {
  const m = String(texto || '').match(/CARGA\s+EN\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ]*?)\s*(?:[-—·,;(]|$)/i);
  return m ? m[1].trim().toUpperCase() : '';
}

function leerFilasPdfEspecialSeccion_(tableWrap, agenciaNombre) {
  // 1) Se recorren las filas de la tabla en pantalla y se agrupan por
  // "data-nota-grupo" (mismas tiendas que comparten ruta/camión). Una fila
  // sin ese atributo forma un grupo de 1 sola tienda.
  const grupos = [];
  let grupoActualId = null;
  let grupoActual = null;

  tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
    if (tr.classList.contains('fila-grupo-header')) return;
    const id = tr.getAttribute('data-nota-grupo'); // null si no comparte ruta con nadie

    if (id && id === grupoActualId) {
      grupoActual.filas.push(tr);
      return;
    }
    const limiteStr = tr.getAttribute('data-nota-limite');
    // NAVE DE CARGA: de la anotación de la ruta (chip de la cabecera del
    // grupo) o, si la tienda va sola, de su propia nota.
    let notaTexto = '';
    if (id) {
      const chip = tableWrap.querySelector('tr[data-nota-grupo-header="' + id + '"] .grupo-header-chip');
      notaTexto = chip ? chip.getAttribute('data-nota-base') : '';
    } else {
      const notaTienda = tr.querySelector('.nota-tienda');
      notaTexto = notaTienda ? notaTienda.getAttribute('data-nota-base') : '';
    }
    // LÍMITE CAMIÓN: el de la ruta; si la tienda va sola, el número de su
    // propia nota ("8P MAX. - CARGA EN GAITE" -> 8). "SIN LIMITE" o sin
    // nota -> SIN LÍMITE.
    let limiteCamion = id && limiteStr ? Number(limiteStr) : null;
    if (!id) {
      const mLim = String(notaTexto || '').match(/(\d+)\s*P\b/i);
      if (mLim) limiteCamion = Number(mLim[1]);
    }
    grupoActual = {
      // Solo las tiendas de un grupo de palets (mismo "data-nota-grupo")
      // son una ruta como tal; una tienda suelta con su comentario no.
      esRuta: !!id,
      naveCarga: naveCargaDeNota_(notaTexto),
      limiteCamion: limiteCamion,
      esGrupoInformativo: tr.getAttribute('data-nota-grupo-tipo') === 'total',
      filas: [tr]
    };
    grupos.push(grupoActual);
    grupoActualId = id || null;
  });

  // 2) Cada grupo se convierte en sus filas de tabla del PDF: la primera
  // fila lleva las celdas "de ruta" (LÍMITE CAMIÓN, NAVE CARGA, TOTAL
  // RUTA, firmas, ZONA/PASILLO) con rowSpan = nº de tiendas del grupo; las
  // siguientes filas del mismo grupo NO repiten esas columnas (quedan
  // cubiertas por la celda combinada de la primera).
  const filasPdf = [];
  const grupoPorFilaPdf = []; // índice de grupo por cada fila añadida, para marcar las rutas al dibujar
  const esRutaPorFilaPdf = []; // true si esa fila es de una ruta (grupo de palets)

  grupos.forEach(function (grupo, indiceGrupo) {
    let sumaTotal = 0;
    grupo.filas.forEach(function (tr) {
      const totalInput = tr.querySelector('input[data-campo="total"]');
      const v = totalInput ? parseFloat(totalInput.value) : NaN;
      if (!isNaN(v)) sumaTotal += v;
    });

    // LÍMITE CAMIÓN: el número de la nota de la ruta o de la tienda suelta
    // (nunca el LÍMITE propio de la tienda). Si no hay ningún número (nota
    // tipo "SIN LÍMITE..." o sin nota), se escribe "SIN LÍMITE".
    const limiteCamion = grupo.limiteCamion;
    const limiteCamionTexto = limiteCamion == null ? 'SIN LÍMITE' : String(limiteCamion);
    // TOTAL RUTA solo en las rutas de verdad (grupo de palets); una tienda
    // suelta lo deja en blanco.
    const totalRuta = (grupo.esGrupoInformativo || !grupo.esRuta) ? '' : sumaTotal;

    grupo.filas.forEach(function (tr, i) {
      const esPrimera = i === 0;
      const rowSpan = grupo.filas.length;
      const nombre = tr.getAttribute('data-nombre') || '';

      function celdaGrupo(valor) {
        return esPrimera ? { content: valor === '' || valor == null ? '' : String(valor), rowSpan: rowSpan } : null;
      }

      let celdasPropias;
      if (tr.classList.contains('fila-cerrada')) {
        const limiteCelda = tr.querySelector('td.limite');
        celdasPropias = [
          limiteCelda ? limiteCelda.textContent.trim() : '', nombre,
          { content: textoBloqueoFila_(tr), colSpan: 4, styles: { fontStyle: 'bold', textColor: [201, 79, 79] } }
        ];
      } else if (tr.classList.contains('fila-sale-excepcion')) {
        const limiteCelda = tr.querySelector('td.limite');
        const motivo = tr.querySelector('.motivo-excepcion');
        celdasPropias = [
          limiteCelda ? limiteCelda.textContent.trim() : '', nombre,
          { content: motivo ? motivo.textContent.trim() : 'SALE POR EXCEPCIÓN', colSpan: 4, styles: { fontStyle: 'bold', textColor: [31, 78, 140] } }
        ];
      } else {
        function valorCampo(campo) {
          const inp = tr.querySelector('input[data-campo="' + campo + '"]');
          return inp ? inp.value : '';
        }
        celdasPropias = [
          tr.getAttribute('data-limite') || '', nombre,
          valorCampo('c60'), valorCampo('pta'), valorCampo('cart'), valorCampo('total')
        ];
      }

      const fila = [];
      if (esPrimera) {
        fila.push(celdaGrupo(limiteCamionTexto));
        fila.push(celdaGrupo(grupo.naveCarga));
        // (Sin columna AGENCIA: ya sale en el título de la hoja.)
      }
      fila.push.apply(fila, celdasPropias);
      if (esPrimera) {
        // Tienda suelta (no es una ruta): su TOTAL RUTA no lleva dato y se
        // raya entera (_nulo), para que se vea que es un campo vacío a
        // propósito y no un hueco para rellenar.
        const celdaTotalRuta = celdaGrupo(totalRuta);
        if (celdaTotalRuta && !grupo.esRuta) celdaTotalRuta._nulo = true;
        fila.push(celdaTotalRuta);
        fila.push(celdaGrupo('')); // FIRMA RES. TARDE
        fila.push(celdaGrupo('')); // FIRMA RES. NOCHE
        fila.push(celdaGrupo('')); // CONFIRMACIÓN RECOGIDA
        fila.push(celdaGrupo('')); // ZONA/PASILLO
      }

      filasPdf.push(fila);
      grupoPorFilaPdf.push(indiceGrupo);
      esRutaPorFilaPdf.push(grupo.esRuta);
    });
  });

  return { filas: filasPdf, grupoPorFila: grupoPorFilaPdf, esRutaPorFila: esRutaPorFilaPdf };
}

/** "escala" (1 = tamaño normal) encoge letras, rellenos y alto de filas
 *  para que la tabla entera quepa en un A4 apaisado (ver
 *  generarPdfEspecialSeccion). */
function dibujarPdfEspecialSeccion_(doc, partes, dia, fecha, fechaGeneracion, seccion, filasInfo, escala) {
  const e = escala || 1;
  const anchoPagina = doc.internal.pageSize.getWidth();
  const M = PDF_ESP_MARGEN_MM_;

  doc.setFontSize(7.5);
  doc.setTextColor(140, 148, 158);
  doc.text('Generado el ' + fechaGeneracion, M, M);
  doc.setTextColor(0, 0, 0);

  // Título (agrupación) a la izquierda y el día/fecha a la derecha, en la
  // misma línea.
  doc.setFontSize(15);
  doc.setTextColor(28, 43, 69);
  doc.text(partes.titulo + (partes.ubicacion ? ' · ' + partes.ubicacion : ''), M, M + 8);

  doc.setFontSize(11);
  doc.setTextColor(90, 100, 114);
  doc.text((dia || '') + ' · ' + formatearFechaLarga(fecha), anchoPagina - M, M + 8, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  const grupoPorFila = filasInfo.grupoPorFila;
  const esRutaPorFila = filasInfo.esRutaPorFila;
  // ¿Hay que pintar borde grueso justo encima de la fila i? Sí al cambiar de
  // grupo cuando a uno de los dos lados hay una ruta de verdad. Entre dos
  // tiendas sueltas (sin grupo de palets) va la línea fina normal.
  function bordeGruesoEncima(i) {
    if (i === 0) return true;
    if (grupoPorFila[i] === grupoPorFila[i - 1]) return false;
    return esRutaPorFila[i] || esRutaPorFila[i - 1];
  }

  doc.autoTable({
    startY: M + 13,
    theme: 'plain',
    head: [['LÍMITE\nCAMIÓN', 'NAVE\nCARGA', 'LÍMITE', 'TIENDA', '60', 'PTA', 'CART.', 'TOTAL', 'TOTAL\nRUTA', 'FIRMA RES.\nTARDE', 'FIRMA RES.\nNOCHE', 'CONFIRMACIÓN\nRECOGIDA', 'ZONA/\nPASILLO']],
    body: filasInfo.filas,
    styles: { fontSize: 7.5 * e, cellPadding: 2.5 * e, valign: 'middle', halign: 'center', lineColor: [190, 196, 205], lineWidth: 0.15, fillColor: [255, 255, 255] },
    headStyles: { fillColor: [28, 43, 69], textColor: 255, halign: 'center', fontSize: 7 * Math.max(e, 0.85) },
    bodyStyles: { halign: 'center', minCellHeight: 9 * e },
    // Anchos fijos (suman los 277 mm útiles del A4 apaisado): las columnas
    // de datos, justas; el sitio que deja la antigua columna AGENCIA va a
    // las 4 columnas que se rellenan a mano (firmas, recogida y zona).
    columnStyles: {
      0: { cellWidth: 18 },                                                // LÍMITE CAMIÓN
      1: { cellWidth: 16, fontStyle: 'bold', fontSize: 8.5 * e },         // NAVE CARGA
      2: { cellWidth: 13 },                                                // LÍMITE
      3: { cellWidth: 46, fontStyle: 'bold', fontSize: 9 * e, halign: 'left' }, // TIENDA
      4: { cellWidth: 10 },                                                // 60
      5: { cellWidth: 10 },                                                // PTA
      6: { cellWidth: 12 },                                                // CART.
      // TOTAL y TOTAL RUTA más grandes, con menos relleno arriba/abajo para
      // que la fila no crezca (el alto lo marca minCellHeight).
      7: { cellWidth: 15, fontStyle: 'bold', fontSize: 12 * e, cellPadding: { top: 0.5 * e, bottom: 0.5 * e, left: 1, right: 1 } }, // TOTAL
      8: { cellWidth: 16, fontStyle: 'bold', fontSize: 14 * e, cellPadding: { top: 0.5 * e, bottom: 0.5 * e, left: 1, right: 1 } }, // TOTAL RUTA
      9: { cellWidth: 31 },                                                // FIRMA RES. TARDE
      10: { cellWidth: 31 },                                               // FIRMA RES. NOCHE
      11: { cellWidth: 31 },                                               // CONFIRMACIÓN RECOGIDA
      12: { cellWidth: 28 }                                                // ZONA/PASILLO
    },
    // Todo el cuerpo en blanco (sin sombreado alternado): las rutas se
    // separan solo con el borde grueso de abajo. Con "theme: 'plain'" se
    // desactiva también el rayado propio de la librería.
    // Borde grueso al empezar y al acabar cada ruta (y al final de la
    // tabla), para que se vea de un vistazo dónde acaba una y empieza la
    // siguiente. Las tiendas sueltas no llevan borde grueso entre ellas.
    didDrawCell: function (data) {
      if (data.section !== 'body') return;
      if (data.cell.raw && data.cell.raw._nulo) rayarCeldaPdf_(doc, data.cell);
      const i = data.row.index;
      const ultimaFilaCelda = i + (data.cell.rowSpan || 1) - 1;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.8);
      if (bordeGruesoEncima(i)) {
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
      }
      if (ultimaFilaCelda === grupoPorFila.length - 1) {
        doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    },
    margin: { top: M, left: M, right: M, bottom: M },
    rowPageBreak: 'avoid'
  });

  return doc.lastAutoTable.finalY;
}

/** Raya en diagonal toda la celda (campo que no lleva dato). */
function rayarCeldaPdf_(doc, cell) {
  const x = cell.x, y = cell.y, w = cell.width, h = cell.height, paso = 2.2;
  doc.setDrawColor(150, 156, 166);
  doc.setLineWidth(0.2);
  for (let t = -h; t < w; t += paso) {
    let x0 = x + t, y0 = y + h, x1 = x + t + h, y1 = y;
    if (x0 < x) { y0 -= (x - x0); x0 = x; }
    if (x1 > x + w) { y1 += (x1 - (x + w)); x1 = x + w; }
    if (x1 > x0) doc.line(x0, y0, x1, y1);
  }
}

const PDF_ESP_MARGEN_MM_ = 10; // margen del folio A4 en el PDF Control responsables
// Escalas que se prueban, de más grande a más pequeña, hasta que la tabla
// entera quepa en un A4 apaisado. Si ni con la más pequeña cabe (agrupación
// enorme), se usa esa y la tabla sigue en una 2ª hoja A4.
const PDF_ESP_ESCALAS_ = [1, 0.93, 0.86, 0.8, 0.74, 0.68, 0.63, 0.58, 0.54, 0.5];

function generarPdfEspecialSeccion(seccion, dia, fecha, tableWrap) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast('No se ha podido cargar el generador de PDF. Revisa tu conexión e inténtalo de nuevo.', true);
    return;
  }

  const jsPDF = window.jspdf.jsPDF;
  const partes = parsearNombreAgrupacion(seccion.nombre);
  const ahora = new Date();
  const fechaGeneracion = Utilities_formatearFechaHora_(ahora);
  const filasInfo = leerFilasPdfEspecialSeccion_(tableWrap, partes.titulo);

  // SIEMPRE un folio A4 apaisado de verdad (297 x 210 mm, con sus márgenes),
  // para que al imprimir salga a tamaño real. Antes la hoja se alargaba lo
  // que hiciera falta y al imprimir en A4 se encogía o se cortaba. Ahora se
  // mide en un lienzo muy alto con cada escala y se usa la primera con la
  // que la tabla entera cabe en el alto del A4.
  const altoUtil = PDF_ALTO_A4_MM_ - PDF_ESP_MARGEN_MM_;
  let escala = PDF_ESP_ESCALAS_[PDF_ESP_ESCALAS_.length - 1];
  for (let i = 0; i < PDF_ESP_ESCALAS_.length; i++) {
    const docMedida = crearDocPdfPaginaExacta_(jsPDF, PDF_ANCHO_MM_, 2000);
    const alto = dibujarPdfEspecialSeccion_(docMedida, partes, dia, fecha, fechaGeneracion, seccion, filasInfo, PDF_ESP_ESCALAS_[i]);
    if (alto <= altoUtil) { escala = PDF_ESP_ESCALAS_[i]; break; }
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  dibujarPdfEspecialSeccion_(doc, partes, dia, fecha, fechaGeneracion, seccion, filasInfo, escala);

  const nombreArchivo = 'Control_responsables_' + seccion.nombre.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '_' + fecha + '.pdf';
  doc.save(nombreArchivo);
}
