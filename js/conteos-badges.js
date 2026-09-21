/* SALIDAS · js/conteos-badges.js — Conteos diarios: badges de estado/tránsito y helpers de nombres */

/** 'lunes, 19 de julio de 2026, 14:32' — usada solo como marca de tiempo de
 *  generación del PDF; no confundir con formatearFechaLarga(), que formatea
 *  la fecha del CONTEO (que puede ser distinta a hoy si se abre un día pasado). */
function Utilities_formatearFechaHora_(d) {
  const dd = pad2(d.getDate());
  const mm = MESES_ES[d.getMonth()];
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return dd + ' de ' + mm + ' de ' + yyyy + ', ' + hh + ':' + min;
}

function badgeEstado(seccion) {
  if (seccion.estado === 'enviado') {
    const texto = seccion.enviadoPor ? ('Definitivo enviado por: ' + escapeHtml(seccion.enviadoPor)) : 'Definitivo enviado';
    const tooltip = seccion.horaEnvio ? ' title="' + escapeAttr(seccion.horaEnvio) + '"' : '';
    return '<span class="badge badge-enviado"' + tooltip + '><span class="badge-dot"></span>' + texto + '</span>';
  }
  if (seccion.estado === 'progreso') return '<span class="badge badge-progreso"><span class="badge-dot"></span>En progreso</span>';
  return ''; // ya no se muestra el badge "Pendiente" en la cabecera de la agrupación
}

/** Badge independiente para la previsión: a diferencia del estado principal
 *  (que solo refleja el envío DEFINITIVO), esto avisa de que ya se ha
 *  mandado una previsión, sin bloquear nada ni sustituir al badge de
 *  estado — ambos pueden verse a la vez. */
function badgePrevision(seccion) {
  if (!seccion.previsionEnviada) return '';
  const texto = seccion.previsionEnviadaPor ? ('Previsión enviada por: ' + escapeHtml(seccion.previsionEnviadaPor)) : 'Previsión enviada';
  const tooltip = ' title="' + escapeAttr(seccion.previsionEnviada) + '"';
  return '<span class="badge badge-prevision"' + tooltip + '><span class="badge-dot"></span>' + texto + '</span>';
}

/**
 * Fila-cabecera de un grupo de rutas: aparece UNA sola vez, justo encima de
 * la primera tienda del grupo. Dos variantes, según t.notaGrupoTipo:
 *
 *  - Ruta normal (tipo null, ej. "8P MAX. POR RUTA"): a la izquierda los
 *    nombres de las tiendas que comparten esa ruta, a la derecha el chip
 *    con el contador en vivo "texto — x/8" (comportamiento de siempre).
 *  - Total informativo (tipo 'total', ej. "TOTAL LISBOA"): a la izquierda
 *    se muestra la descripción tal cual la escribiste en el Excel (no la
 *    lista de tiendas), y a la derecha el chip con la suma de palets en
 *    vivo de esa agrupación, sin ningún aviso/alerta de límite (es solo
 *    información visual).
 */
function filaGrupoHeaderHtml(t, nombresGrupo, tienePeso, tieneCExpress, tieneSobrestock) {
  const esTotal = t.notaGrupoTipo === 'total';
  const tiendas = (nombresGrupo || []).map(quitarCodigoTienda).join(' + ');
  const textoIzquierda = esTotal ? t.nota : tiendas;
  const chipInicial = esTotal ? '0 palets' : t.nota;
  return '<tr class="fila-grupo-header' + (esTotal ? ' fila-grupo-header-total' : '') + '" data-nota-grupo-header="' + escapeAttr(t.notaGrupoId) + '" data-nota-grupo-tipo="' + escapeAttr(t.notaGrupoTipo || '') + '">' +
    '<td colspan="' + (8 + (tienePeso ? 1 : 0) + (tieneCExpress ? 1 : 0) + (tieneSobrestock ? 1 : 0)) + '">' +
    '<div class="grupo-header">' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
    '<span class="grupo-header-tiendas">' + escapeHtml(textoIzquierda) + '</span>' +
    '<span class="grupo-header-chip' + (esTotal ? ' grupo-header-chip-total' : '') + '" data-nota-base="' + escapeAttr(t.nota) + '">' + escapeHtml(chipInicial) + '</span>' +
    '</div></td></tr>';
}

/** "127- NERVIÓN" -> "NERVIÓN" (quita el código numérico de tienda, solo para el
 *  texto de la fila-cabecera del grupo; el nombre completo se sigue mostrando
 *  tal cual en la fila individual de cada tienda). */
function quitarCodigoTienda(nombre) {
  return String(nombre).replace(/^\s*\d+\s*-\s*/, '').trim();
}

/** Quita un "*"/"^" residual del final del nombre, si lo hubiera (nombres
 *  antiguos de antes de mover el tránsito a config_tiendas.transito_dias).
 *  Es solo cosmético para lo que se pinta en pantalla; el badge de plazo
 *  ya no depende de esto, ver badgeTransitoTienda(). */
function quitarMarcadorNombre(nombre) {
  return String(nombre || '').replace(/\s*[*^]\s*$/, '');
}

/**
 * Devuelve el badge de plazo de tránsito a partir del campo `transito`
 * (1 a 5, ver config_tiendas.transito_dias) que ya viene en los datos de
 * la tienda desde get_conteo_dia. transito=1 (24h) es el caso normal y no
 * muestra badge, igual que antes cuando el nombre no llevaba marcador.
 * Sustituye al viejo sistema de "*"/"^" al final del nombre de la tienda.
 */
var TRANSITO_BADGES = {
  2: { texto: '48H', clase: 'badge-48h' },
  3: { texto: '72H', clase: 'badge-72h' },
  4: { texto: '96H', clase: 'badge-96h' },
  5: { texto: '120H', clase: 'badge-120h' }
};
function badgeTransitoTienda(transito) {
  return TRANSITO_BADGES[Number(transito)] || null;
}
