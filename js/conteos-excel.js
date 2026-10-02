/* SALIDAS · js/conteos-excel.js — Conteos diarios: exportar una agrupación a Excel */

/**
 * Genera y descarga un .xlsx con el conteo de una agrupación: lo mismo que
 * el PDF normal (cabecera, notas de carga, observaciones, todas las tiendas
 * con sus casillas y la fila de TOTAL), leído de la tabla en pantalla (así
 * incluye cambios aún sin guardar). Reutiliza leerFilasPdfSeccion_ de
 * conteos-pdf.js para que el Excel y el PDF salgan siempre con los mismos
 * datos.
 *
 * Usa ExcelJS, que NO se carga al abrir la app: se descarga la primera vez
 * que alguien pulsa el botón (pesa ~1 MB y la mayoría de días no se usa).
 * Las casillas numéricas se guardan como números, para poder sumar y
 * filtrar en Excel.
 */
const EXCELJS_URLS_ = [
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
];
let EXCELJS_CARGANDO_ = null;

/** Carga ExcelJS una sola vez (probando el segundo CDN si falla el primero). */
function cargarExcelJS_() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (EXCELJS_CARGANDO_) return EXCELJS_CARGANDO_;
  EXCELJS_CARGANDO_ = EXCELJS_URLS_.reduce(function (prev, url) {
    return prev.catch(function () {
      return new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = url;
        s.onload = function () { window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS no disponible')); };
        s.onerror = function () { s.remove(); reject(new Error('No se pudo cargar ' + url)); };
        document.head.appendChild(s);
      });
    });
  }, Promise.reject(new Error('inicio')));
  EXCELJS_CARGANDO_.catch(function () { EXCELJS_CARGANDO_ = null; }); // permitir reintentar
  return EXCELJS_CARGANDO_;
}

/** "7" -> 7, "" -> null, "NO" / "X" / texto -> se deja como texto. */
function valorCeldaExcel_(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (t === '') return null;
  if (/^-?\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return t;
}

function generarExcelSeccion(seccion, dia, fecha, tableWrap, boton) {
  if (boton) boton.disabled = true;
  cargarExcelJS_()
    .then(function (ExcelJS) { return construirExcelSeccion_(ExcelJS, seccion, dia, fecha, tableWrap); })
    .then(function (res) {
      const blob = new Blob([res.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    })
    .catch(function (err) {
      console.error(err);
      mostrarToast('No se ha podido generar el Excel. Revisa tu conexión e inténtalo de nuevo.', true);
    })
    .finally(function () { if (boton) boton.disabled = false; });
}

function construirExcelSeccion_(ExcelJS, seccion, dia, fecha, tableWrap) {
  const partes = parsearNombreAgrupacion(seccion.nombre);
  const filas = leerFilasPdfSeccion_(tableWrap, seccion);
  const cabeceras = ['Tienda', 'Límite']
    .concat(seccion.tieneViernes ? ['VIERNES'] : [])
    .concat(seccion.tieneCasillaDomingo ? ['DOMINGO'] : [])
    .concat(['60', 'PTA', 'CART.', 'TOTAL', 'PDTE'])
    .concat(seccion.tienePeso ? ['PESO'] : [])
    .concat(seccion.tieneCExpress ? ['C.EXPRESS'] : [])
    .concat(seccion.tieneSobrestock ? ['SOBRESTOCK'] : []);
  const nCols = cabeceras.length;
  const idxTotal = indiceTotalPdf_(seccion);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SALIDAS';
  wb.created = new Date();
  const ws = wb.addWorksheet((partes.titulo || 'Conteo').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31), {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  });

  const NAVY = 'FF1C2B45', GRIS_TEXTO = 'FF5B6472', GRIS_FONDO = 'FFF2F5F9', LINEA = 'FFC9CED6';
  const borde = { style: 'thin', color: { argb: LINEA } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };

  // Cabecera del documento
  const r1 = ws.addRow([partes.titulo + (partes.ubicacion ? ' · ' + partes.ubicacion : '')]);
  r1.font = { bold: true, size: 15, color: { argb: NAVY } };
  const r2 = ws.addRow([(dia || '') + ' · ' + formatearFechaLarga(fecha)]);
  r2.font = { size: 11, color: { argb: GRIS_TEXTO } };
  const r3 = ws.addRow(['Generado el ' + Utilities_formatearFechaHora_(new Date())]);
  r3.font = { size: 9, italic: true, color: { argb: 'FF8C949E' } };
  [r1, r2, r3].forEach(function (r) { ws.mergeCells(r.number, 1, r.number, nCols); });

  const notas = []
    .concat((seccion.notasCarga || []).map(function (t) { return '• ' + t; }))
    .concat((seccion.notas || []).map(function (n) { return 'Nota: ' + n.texto; }));
  if (notas.length) {
    ws.addRow([]);
    notas.forEach(function (t) {
      const r = ws.addRow([t]);
      r.font = { size: 10 };
      ws.mergeCells(r.number, 1, r.number, nCols);
    });
  }
  ws.addRow([]);

  // Tabla
  const filaCab = ws.addRow(cabeceras);
  filaCab.eachCell(function (c) {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = bordes;
  });
  filaCab.height = 20;
  ws.views = [{ state: 'frozen', ySplit: filaCab.number }];

  filas.forEach(function (f) {
    const valores = f.map(function (v, i) { return i === 0 ? v : valorCeldaExcel_(v); });
    const r = ws.addRow(valores);
    r.eachCell({ includeEmpty: true }, function (c, col) {
      if (col > nCols) return;
      c.border = bordes;
      c.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
      if (col === 1) c.font = { bold: true, size: 11 };
      if (col === idxTotal + 1) c.font = { bold: true };
    });
  });

  // Fila de TOTAL: misma regla que el PDF (la carga, sin VIERNES ni DOMINGO).
  const totalGeneral = filas.reduce(function (acc, f) {
    const v = parseFloat(f._carga !== undefined ? f._carga : f[idxTotal]);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const sumaCol = function (idx) {
    return filas.reduce(function (acc, f) { const v = parseFloat(f[idx]); return acc + (isNaN(v) ? 0 : v); }, 0);
  };
  const extrasFuera = [];
  if (seccion.tieneViernes) extrasFuera.push('viernes');
  if (seccion.tieneCasillaDomingo) extrasFuera.push('domingo');
  const filaTotal = new Array(nCols).fill(null);
  filaTotal[0] = extrasFuera.length ? 'TOTAL CARGA (sin ' + extrasFuera.join(' ni ') + ')' : 'TOTAL GENERAL';
  let idxCol = 2;
  if (seccion.tieneViernes) { filaTotal[idxCol] = sumaCol(idxCol); idxCol++; }
  if (seccion.tieneCasillaDomingo) { filaTotal[idxCol] = sumaCol(idxCol); idxCol++; }
  filaTotal[idxTotal] = totalGeneral;
  const rTot = ws.addRow(filaTotal);
  rTot.eachCell({ includeEmpty: true }, function (c, col) {
    if (col > nCols) return;
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_FONDO } };
    c.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
    c.border = { top: { style: 'medium', color: { argb: 'FF1C2430' } }, left: borde, bottom: borde, right: borde };
  });

  // Anchos: la columna de tienda según el nombre más largo, el resto fijas.
  const anchoTienda = filas.reduce(function (m, f) { return Math.max(m, String(f[0] || '').length); }, 12);
  ws.columns.forEach(function (col, i) { col.width = i === 0 ? Math.min(45, anchoTienda + 4) : 11; });

  const nombre = 'Conteo_' + seccion.nombre.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '_' + fecha + '.xlsx';
  return wb.xlsx.writeBuffer().then(function (buffer) { return { buffer: buffer, nombre: nombre }; });
}
