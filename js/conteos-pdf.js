/* SALIDAS · js/conteos-pdf.js — Conteos diarios: PDF de agrupación y PDF especial */

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

/** Lee de la tabla en pantalla (no de "seccion", para incluir cambios aún
 *  sin guardar) las filas [tienda, límite, 60, PTA, CART., TOTAL, PDTE, (PESO), (C.EXPRESS), (SOBRESTOCK)]. */
function leerFilasPdfSeccion_(tableWrap, seccion) {
  const filas = [];
  tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
    if (tr.classList.contains('fila-grupo-header')) return;

    const nombre = tr.getAttribute('data-nombre') || '';

    if (tr.classList.contains('fila-cerrada')) {
      const limiteCelda = tr.querySelector('td.limite');
      filas.push([
        nombre,
        limiteCelda ? limiteCelda.textContent.trim() : '',
        'CERRADA', '', '', '', ''
      ].concat(seccion.tienePeso ? [''] : []).concat(seccion.tieneCExpress ? [''] : []).concat(seccion.tieneSobrestock ? [''] : []));
      return;
    }

    if (tr.classList.contains('fila-sale-excepcion')) {
      const limiteCelda = tr.querySelector('td.limite');
      const motivo = tr.querySelector('.motivo-excepcion');
      filas.push([
        nombre,
        limiteCelda ? limiteCelda.textContent.trim() : '',
        motivo ? motivo.textContent.trim() : 'SALE POR EXCEPCIÓN', '', '', '', ''
      ].concat(seccion.tienePeso ? [''] : []).concat(seccion.tieneCExpress ? [''] : []).concat(seccion.tieneSobrestock ? [''] : []));
      return;
    }

    function valorCampo(campo) {
      const inp = tr.querySelector('input[data-campo="' + campo + '"]');
      return inp ? inp.value : '';
    }

    filas.push([
      nombre,
      tr.getAttribute('data-limite') || '',
      valorCampo('c60'),
      valorCampo('pta'),
      valorCampo('cart'),
      valorCampo('total'),
      valorCampo('pdte')
    ].concat(seccion.tienePeso ? [valorCampo('peso')] : []).concat(seccion.tieneCExpress ? [valorCampo('cexpress')] : []).concat(seccion.tieneSobrestock ? [valorCampo('sobrestock')] : []));
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
  const totalGeneral = filas.reduce(function (acc, fila) {
    const v = parseFloat(fila[5]); // índice 5 = TOTAL
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const filaTotal = ['TOTAL GENERAL', '', '', '', '', String(totalGeneral), '']
    .concat(seccion.tienePeso ? [''] : [])
    .concat(seccion.tieneCExpress ? [''] : [])
    .concat(seccion.tieneSobrestock ? [''] : []);
  const filasConTotal = filas.concat([filaTotal]);
  const indiceFilaTotal = filasConTotal.length - 1;

  doc.autoTable({
    startY: y,
    head: [['Tienda', 'Límite', '60', 'PTA', 'CART.', 'TOTAL', 'PDTE'].concat(seccion.tienePeso ? ['PESO'] : []).concat(seccion.tieneCExpress ? ['C.EXPRESS'] : []).concat(seccion.tieneSobrestock ? ['SOBRESTOCK'] : [])],
    body: filasConTotal,
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'middle', halign: 'center' },
    headStyles: { fillColor: [28, 43, 69], textColor: 255, halign: 'center' },
    bodyStyles: { halign: 'center' },
    columnStyles: {
      0: { fontStyle: 'bold', fontSize: 11, halign: 'left' },
      5: { fontStyle: 'bold' }
    },
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
 * (columnas LÍMITE CAMIÓN / AGENCIA / LÍMITE / TIENDA / NAVE 60 / PTA /
 * CÁRTAMA / TOTAL / SOBRAN / TOTAL RUTA / FIRMA RES. TARDE / FIRMA RES.
 * NOCHE / CONFIRMACIÓN RECOGIDA / ZONA-PASILLO), pensado para imprimir y
 * rellenar a mano en el momento del reparto.
 *
 * Igual que en pantalla, las tiendas que comparten camión/ruta (la misma
 * anotación "8P MAX. POR RUTA" de las columnas K:L del Excel — en la app,
 * mismo "data-nota-grupo") se agrupan visualmente: LÍMITE CAMIÓN, AGENCIA,
 * SOBRAN, TOTAL RUTA y los campos de firma se pintan en UNA sola celda que
 * abarca todas las filas de esa ruta (como una celda combinada), en vez de
 * repetirse en cada tienda. Una tienda sin ruta compartida forma su propio
 * grupo de una sola fila.
 *
 * - LÍMITE CAMIÓN sale del número de la anotación de ruta compartida por
 *   varias tiendas (ej. "8P MAX. POR RUTA" -> 8). Si la tienda no comparte
 *   ruta con nadie, o la anotación no tiene un número reconocible (p.ej.
 *   "SIN LÍMITE..."), queda en blanco: no es el límite de una tienda
 *   suelta, es el del camión.
 * - AGENCIA es el nombre de la agrupación (ej. "SEYLOTRANS MEDIO DIA").
 * - TOTAL RUTA es la suma en vivo del TOTAL de todas las tiendas de esa
 *   ruta (misma suma que ya se ve en pantalla en el chip de la
 *   fila-cabecera del grupo).
 * - SOBRAN queda SIEMPRE en blanco: es un dato que se anota a mano en el
 *   momento del reparto, no se calcula.
 * - LÍMITE, TIENDA, 60, PTA, CART. y TOTAL de cada fila salen de los
 *   datos ya introducidos en el conteo (igual que el PDF normal).
 * - Las 3 firmas y ZONA/PASILLO siguen en blanco para rellenar a mano,
 *   como se pidió: no hay ningún dato de la app del que puedan salir.
 */
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
    grupoActual = {
      limiteCamion: id && limiteStr ? Number(limiteStr) : null,
      esGrupoInformativo: tr.getAttribute('data-nota-grupo-tipo') === 'total',
      filas: [tr]
    };
    grupos.push(grupoActual);
    grupoActualId = id || null;
  });

  // 2) Cada grupo se convierte en sus filas de tabla del PDF: la primera
  // fila lleva las celdas "de ruta" (LÍMITE CAMIÓN, AGENCIA, SOBRAN, TOTAL
  // RUTA, firmas, ZONA/PASILLO) con rowSpan = nº de tiendas del grupo; las
  // siguientes filas del mismo grupo NO repiten esas columnas (quedan
  // cubiertas por la celda combinada de la primera).
  const filasPdf = [];
  const grupoPorFilaPdf = []; // índice de grupo por cada fila añadida, para sombrear por ruta al dibujar

  grupos.forEach(function (grupo, indiceGrupo) {
    let sumaTotal = 0;
    grupo.filas.forEach(function (tr) {
      const totalInput = tr.querySelector('input[data-campo="total"]');
      const v = totalInput ? parseFloat(totalInput.value) : NaN;
      if (!isNaN(v)) sumaTotal += v;
    });

    // LÍMITE CAMIÓN solo se rellena cuando de verdad hay una nota de ruta
    // compartida por varias tiendas (ej. "8P MAX. POR RUTA"): es el límite
    // del CAMIÓN, no el de una tienda suelta, así que una tienda sin ruta
    // compartida se deja en blanco (antes se rellenaba con su propio
    // límite de tienda por error). Si no hay ningún número (ruta sin
    // límite, o nota tipo "SIN LÍMITE..."), se escribe "SIN LÍMITE" en vez
    // de dejarlo vacío. SOBRAN se deja SIEMPRE en blanco: es un dato que
    // se anota a mano en el reparto, no se calcula.
    const limiteCamion = grupo.limiteCamion;
    const limiteCamionTexto = limiteCamion == null ? 'SIN LÍMITE' : String(limiteCamion);
    const sobran = '';
    const totalRuta = grupo.esGrupoInformativo ? '' : sumaTotal;

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
          { content: 'CERRADA', colSpan: 4, styles: { fontStyle: 'bold', textColor: [201, 79, 79] } }
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
        fila.push(celdaGrupo(agenciaNombre));
      }
      fila.push.apply(fila, celdasPropias);
      if (esPrimera) {
        fila.push(celdaGrupo(sobran));
        fila.push(celdaGrupo(totalRuta));
        fila.push(celdaGrupo('')); // FIRMA RES. TARDE
        fila.push(celdaGrupo('')); // FIRMA RES. NOCHE
        fila.push(celdaGrupo('')); // CONFIRMACIÓN RECOGIDA
        fila.push(celdaGrupo('')); // ZONA/PASILLO
      }

      filasPdf.push(fila);
      grupoPorFilaPdf.push(indiceGrupo);
    });
  });

  return { filas: filasPdf, grupoPorFila: grupoPorFilaPdf };
}

function dibujarPdfEspecialSeccion_(doc, partes, dia, fecha, fechaGeneracion, seccion, filasInfo) {
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

  const grupoPorFila = filasInfo.grupoPorFila;

  doc.autoTable({
    startY: 31,
    theme: 'plain',
    head: [['LÍMITE\nCAMIÓN', 'AGENCIA', 'LÍMITE', 'TIENDA', '60', 'PTA', 'CART.', 'TOTAL', 'SOBRAN', 'TOTAL\nRUTA', 'FIRMA RES.\nTARDE', 'FIRMA RES.\nNOCHE', 'CONFIRMACIÓN\nRECOGIDA', 'ZONA/\nPASILLO']],
    body: filasInfo.filas,
    styles: { fontSize: 7.5, cellPadding: 2.5, valign: 'middle', halign: 'center', lineColor: [190, 196, 205], lineWidth: 0.15, fillColor: [255, 255, 255] },
    headStyles: { fillColor: [28, 43, 69], textColor: 255, halign: 'center', fontSize: 7 },
    bodyStyles: { halign: 'center', minCellHeight: 9 },
    columnStyles: {
      1: { fontStyle: 'bold' },
      3: { fontStyle: 'bold', fontSize: 9, halign: 'left' },
      7: { fontStyle: 'bold' },
      13: { cellWidth: 30 }
    },
    // Sombreado suave alternado POR RUTA (no por fila): todas las filas del
    // mismo grupo comparten color, para que se aprecien de un vistazo los
    // bloques de reparto por camión, igual que las celdas combinadas del
    // Excel original. Con "theme: 'plain'" se desactiva el rayado propio
    // de la librería (que alterna por FILA, no por ruta, y pisaba este
    // color de forma inconsistente dentro de un mismo grupo).
    didParseCell: function (data) {
      if (data.section !== 'body') return;
      const grupo = grupoPorFila[data.row.index];
      if (grupo % 2 === 1) data.cell.styles.fillColor = [242, 245, 249];
    },
    margin: { bottom: 10 },
    rowPageBreak: 'avoid'
  });

  return doc.lastAutoTable.finalY;
}

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

  const docMedida = crearDocPdfPaginaExacta_(jsPDF, PDF_ANCHO_MM_, 2000);
  const alturaContenido = dibujarPdfEspecialSeccion_(docMedida, partes, dia, fecha, fechaGeneracion, seccion, filasInfo);

  const alturaPagina = Math.max(PDF_ALTO_A4_MM_, alturaContenido + 14);
  const doc = crearDocPdfPaginaExacta_(jsPDF, PDF_ANCHO_MM_, alturaPagina);
  dibujarPdfEspecialSeccion_(doc, partes, dia, fecha, fechaGeneracion, seccion, filasInfo);

  const nombreArchivo = 'Especial_' + seccion.nombre.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '_' + fecha + '.pdf';
  doc.save(nombreArchivo);
}
