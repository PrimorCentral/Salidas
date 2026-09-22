/* SALIDAS · js/conteos-impresion.js — Conteos diarios: hoja de impresión manual */

/** Punto de entrada del botón de imprimir: construye de cero la hoja de
 *  cuadrícula manual (ver construirHojaImpresionDia_) a partir de los
 *  últimos datos del día ya cargados, y lanza el diálogo de impresión del
 *  navegador. No hace falta volver a pedir nada al servidor. */
function imprimirConteoDia_() {
  if (!ESTADO.datosDiaActual) {
    mostrarToast('Espera a que termine de cargar el conteo del día antes de imprimir', true);
    return;
  }
  construirHojaImpresionDia_(ESTADO.datosDiaActual);
  window.print();
}

/** Construye, desde cero, la hoja de impresión en cuadrícula pensada para
 *  rellenar A MANO (no reutiliza el HTML de pantalla en absoluto: colores,
 *  botones, inputs... aquí no pintan nada). Cabecera con la fecha y el
 *  aviso general del día, y luego cada agrupación con su tabla + caja de
 *  TOTAL + caja de "quitar en este orden" al lado, tal como se venía
 *  imprimiendo antes de esta aplicación.
 *  IMPORTANTE: las celdas de conteo (60/PTA/CART./TOTAL/PDTE) se dejan
 *  siempre en blanco a propósito -- es un papel para escribir con boli,
 *  no un volcado de lo que ya haya escrito en pantalla. */
function construirHojaImpresionDia_(data) {
  const cont = document.getElementById('hoja-impresion-manual');
  if (!cont) return;
  cont.innerHTML = '';

  // "2026-08-25" -> "25/08/2026" (con ceros, para "CONTEOS DE MIÉRCOLES - 25/08/2026").
  const partesFecha = String(data.fecha || '').split('-');
  const pad2_ = function (n) { return String(n).padStart(2, '0'); };
  const fechaConCeros = partesFecha.length === 3
    ? pad2_(partesFecha[2]) + '/' + pad2_(partesFecha[1]) + '/' + partesFecha[0]
    : (data.fecha || '');

  const tituloHoja = 'CONTEOS DE ' + String(data.dia || '').toUpperCase() + ' - ' + fechaConCeros;

  const cabecera = document.createElement('div');
  cabecera.className = 'hi-cabecera';
  cabecera.innerHTML = '<b>' + escapeHtml(tituloHoja) + '</b>';

  let aviso = null;
  if (data.notasGenerales && data.notasGenerales.length) {
    aviso = document.createElement('div');
    aviso.className = 'hi-aviso';
    aviso.innerHTML = data.notasGenerales.map(function (n) {
      return '<div>' + escapeHtml(n.texto || '') + '</div>';
    }).join('');
  }

  const grupos = (data.secciones || []).map(construirGrupoImpresionDia_);

  paginarYMontarHojaImpresion_(cont, tituloHoja, cabecera, aviso, grupos);
}

/** Reparte cabecera + aviso + grupos entre tantas ".hi-pagina" como hagan
 *  falta, cada una con el alto exacto de una hoja A4 (menos los márgenes de
 *  @page), para poder poner "Página N de X" en el pie de cada una con el
 *  total real -- dato que el navegador nunca expone durante la impresión,
 *  así que aquí se pagina "a mano" en vez de fiarse del motor de impresión.
 *  Para saber cuánto ocupa cada trozo se mide su alto real metiéndolo,
 *  fuera de la pantalla, en un contenedor con el mismo ancho útil que
 *  tendrá la página impresa (en mm, no en px: el mm de CSS es una unidad
 *  fija -96px por pulgada, siempre igual-, así que la medida hecha en
 *  pantalla normal predice fielmente lo que pasará al imprimir). */
function paginarYMontarHojaImpresion_(cont, tituloHoja, cabecera, aviso, grupos) {
  const ANCHO_UTIL_MM = 192; // A4 (210mm) - 2 x margen de @page (9mm)
  const ALTO_UTIL_MM = 279;  // A4 (297mm) - 2 x margen de @page (9mm)
  const MM_A_PX = 96 / 25.4; // conversión fija de CSS, independiente de la pantalla

  const medidor = document.createElement('div');
  medidor.style.cssText = 'position:absolute; left:-9999px; top:0; width:' + ANCHO_UTIL_MM + 'mm; visibility:hidden;';
  document.body.appendChild(medidor);

  const pieMedida = crearPiePaginaImpresion_(tituloHoja, 1, 1);
  medidor.appendChild(cabecera);
  if (aviso) medidor.appendChild(aviso);
  medidor.appendChild(pieMedida);
  const altoCabecera = cabecera.offsetHeight + (aviso ? aviso.offsetHeight : 0);
  const altoPie = pieMedida.offsetHeight;
  medidor.removeChild(pieMedida);

  const alturasGrupos = grupos.map(function (g) {
    medidor.appendChild(g);
    const alto = g.offsetHeight + parseFloat(getComputedStyle(g).marginBottom || 0);
    medidor.removeChild(g);
    return alto;
  });

  document.body.removeChild(medidor);

  const altoUtilPx = ALTO_UTIL_MM * MM_A_PX;
  const presupuestoPagina1 = altoUtilPx - altoCabecera - altoPie;
  const presupuestoPaginaSiguiente = altoUtilPx - altoPie;

  // Reparto "greedy": se van metiendo grupos en la página actual mientras
  // quepan; en cuanto uno no cabe, se cierra esa página y se abre otra.
  // Los grupos nunca se parten (igual que antes con break-inside:avoid),
  // solo que ahora la decisión de "no cabe, página nueva" se toma aquí en
  // vez de dejársela al navegador.
  const paginas = [[]];
  let alturaUsada = 0;
  let presupuestoActual = presupuestoPagina1;
  grupos.forEach(function (g, i) {
    const alto = alturasGrupos[i];
    if (alturaUsada + alto > presupuestoActual && paginas[paginas.length - 1].length > 0) {
      paginas.push([]);
      alturaUsada = 0;
      presupuestoActual = presupuestoPaginaSiguiente;
    }
    paginas[paginas.length - 1].push(g);
    alturaUsada += alto;
  });

  const totalPaginas = paginas.length;
  paginas.forEach(function (gruposPagina, idx) {
    const pagina = document.createElement('div');
    pagina.className = 'hi-pagina' + (idx < totalPaginas - 1 ? ' hi-pagina-salto' : '');

    const contenido = document.createElement('div');
    contenido.className = 'hi-pagina-contenido';
    if (idx === 0) {
      contenido.appendChild(cabecera);
      if (aviso) contenido.appendChild(aviso);
    }
    gruposPagina.forEach(function (g) { contenido.appendChild(g); });
    pagina.appendChild(contenido);

    pagina.appendChild(crearPiePaginaImpresion_(tituloHoja, idx + 1, totalPaginas));
    cont.appendChild(pagina);
  });
}

/** Pie de una hoja impresa: mismo título de la cabecera a la izquierda/
 *  centro, y "Página N de X" a la derecha del todo. */
function crearPiePaginaImpresion_(tituloHoja, numPagina, totalPaginas) {
  const pie = document.createElement('div');
  pie.className = 'hi-pie-pagina';
  pie.innerHTML =
    '<span></span>' +
    '<span class="hi-pie-titulo">' + escapeHtml(tituloHoja) + '</span>' +
    '<span class="hi-pie-num">Página ' + numPagina + ' de ' + totalPaginas + '</span>';
  return pie;
}

/** Construye un ".hi-grupo" (una agrupación completa) para la hoja de
 *  impresión manual: título, notas de carga, tabla con filas en blanco
 *  para rellenar, caja de TOTAL y caja de "quitar en este orden". */
function construirGrupoImpresionDia_(seccion) {
  const grupo = document.createElement('div');
  grupo.className = 'hi-grupo';

  const titulo = document.createElement('div');
  titulo.className = 'hi-grupo-titulo';
  titulo.textContent = seccion.nombre;
  grupo.appendChild(titulo);

  if (seccion.notasCarga && seccion.notasCarga.length) {
    const notas = document.createElement('div');
    notas.className = 'hi-notas-carga';
    notas.innerHTML = seccion.notasCarga.map(function (texto) {
      return '<div>' + escapeHtml(texto) + '</div>';
    }).join('');
    grupo.appendChild(notas);
  }

  // extraCols cuenta solo las columnas de datos en blanco (60/PTA/CART/
  // TOTAL/PDTE + opcionales); la fila de cabecera de una agrupación (p.ej.
  // "MENDEZ + FORUM ALG.") necesita cubrir TODAS las columnas de la tabla,
  // así que a extraCols hay que sumarle las 2 columnas iniciales (LIM y
  // nombre) para que la barra llegue hasta el final -- si no, se queda
  // corta y no tapa las últimas columnas (TOTAL, PDTE...).
  const extraCols = 5 + (seccion.tienePeso ? 1 : 0) + (seccion.tieneCExpress ? 1 : 0) + (seccion.tieneSobrestock ? 1 : 0);
  const totalCols = extraCols + 2;

  // Solo las tiendas que hoy hay que contar físicamente aquí: se dejan
  // fuera las cerradas y las que hoy salen por otra agrupación (cambio
  // puntual), igual que en pantalla no se cuentan ahí.
  const tiendas = (seccion.tiendas || []).filter(function (t) { return !t.cerrada && !t.salePorExcepcion; });

  const nombresPorGrupo = {};
  tiendas.forEach(function (t) {
    if (!t.notaGrupoId) return;
    if (!nombresPorGrupo[t.notaGrupoId]) nombresPorGrupo[t.notaGrupoId] = [];
    nombresPorGrupo[t.notaGrupoId].push(t.nombre);
  });

  const filasHtml = tiendas.map(function (t, i) {
    const anterior = tiendas[i - 1];
    const siguiente = tiendas[i + 1];
    const esPrimeraDeGrupo = !!t.notaGrupoId && (!anterior || anterior.notaGrupoId !== t.notaGrupoId);
    const esUltimaDeGrupo = !!t.notaGrupoId && (!siguiente || siguiente.notaGrupoId !== t.notaGrupoId);
    let html = '';
    if (esPrimeraDeGrupo) {
      const esTotal = t.notaGrupoTipo === 'total';
      const nombresGrupo = (nombresPorGrupo[t.notaGrupoId] || []).map(quitarCodigoTienda).join(' + ');
      // Si la ruta compartida trae una anotación de carga (ej. "8P MAX. POR
      // RUTA - CARGA EN GAITE", lo mismo que se ve en pantalla en el chip de
      // la cabecera del grupo), se añade también aquí -- en pantalla se ve
      // aparte en un chip a la derecha, pero en el papel no hay chip, así
      // que se pega al final del mismo renglón de cabecera.
      const textoIzquierda = esTotal
        ? t.nota
        : (t.nota ? nombresGrupo + ' — ' + t.nota : nombresGrupo);
      html += '<tr class="hi-fila-grupo"><td colspan="' + totalCols + '">' + escapeHtml(textoIzquierda) + '</td></tr>';
    }
    const badge = badgeTransitoTienda(t.transito);
    // El "*" tras el nombre marca las tiendas que tienen una nota/aviso
    // propio (ver icono de nota en pantalla) -- igual que en las hojas de
    // toda la vida.
    const sufijo = (badge ? ' (' + badge.texto + ')' : '') + (t.nota && !t.notaGrupoId ? ' *' : '');
    // Las tiendas que pertenecen a una agrupación de rutas llevan un fondo
    // tenue en TODAS sus filas (no solo en la cabecera), y la última de
    // ellas cierra el bloque con un borde inferior grueso -- así se ve de
    // un vistazo dónde empieza y termina la agrupación, sin confundirla
    // con las tiendas sueltas que vienen después.
    const claseFila = t.notaGrupoId
      ? ' class="hi-fila-grupo-miembro' + (esUltimaDeGrupo ? ' hi-fila-grupo-fin' : '') + '"'
      : '';
    html += '<tr' + claseFila + '>' +
      '<td class="hi-lim">' + escapeHtml(String(textoLimite_(t.limite))) + '</td>' +
      '<td class="hi-nombre">' + escapeHtml(quitarMarcadorNombre(t.nombre)) + escapeHtml(sufijo) + '</td>' +
      celdaImpresionManual_(t.c60) + celdaImpresionManual_(t.pta) + celdaImpresionManual_(t.cart) +
      '<td class="hi-blanco"></td><td class="hi-blanco"></td>' +
      (seccion.tienePeso ? '<td class="hi-blanco"></td>' : '') +
      (seccion.tieneCExpress ? '<td class="hi-blanco"></td>' : '') +
      (seccion.tieneSobrestock ? '<td class="hi-blanco"></td>' : '') +
      '</tr>';
    return html;
  }).join('');

  const tabla = document.createElement('table');
  tabla.className = 'hi-tabla';
  tabla.innerHTML =
    '<thead><tr><th>Lim</th><th></th><th>60</th><th>PTA</th><th>Cart.</th><th>Total</th><th>Pdte</th>' +
    (seccion.tienePeso ? '<th>Peso</th>' : '') +
    (seccion.tieneCExpress ? '<th>C.Express</th>' : '') +
    (seccion.tieneSobrestock ? '<th>Sobrestock</th>' : '') +
    '</tr></thead><tbody>' + filasHtml + '</tbody>';

  const layout = document.createElement('table');
  layout.className = 'hi-layout';
  const tbody = document.createElement('tbody');
  const fila = document.createElement('tr');

  const tdTabla = document.createElement('td');
  tdTabla.className = 'hi-tabla-cell';
  tdTabla.appendChild(tabla);
  fila.appendChild(tdTabla);

  // El cuadro de TOTAL tiene un tamaño fijo pensado para agrupaciones con
  // varias tiendas (la tabla, más alta, "sostiene" ese tamaño). Cuando la
  // agrupación tiene muy pocas filas (p.ej. una sola tienda), ese mismo
  // cuadro obliga a estirar la fila entera y queda un hueco enorme -- aquí
  // se calcula un tamaño más pequeño para esos casos, en proporción al
  // número de filas reales de la tabla (tiendas + cabeceras de subgrupo).
  const filasTablaTotal = tiendas.length + Object.keys(nombresPorGrupo).length;
  let ladoCajaTotal = 60;
  if (filasTablaTotal <= 1) ladoCajaTotal = 30;
  else if (filasTablaTotal === 2) ladoCajaTotal = 42;

  const tdTotal = document.createElement('td');
  tdTotal.className = 'hi-total-cell';
  tdTotal.innerHTML = '<div class="hi-total-label">Total</div><div class="hi-total-box" style="width:' + ladoCajaTotal + 'px;height:' + ladoCajaTotal + 'px;"></div>';
  fila.appendChild(tdTotal);

  if (seccion.ordenRetirada && seccion.ordenRetirada.length) {
    const tdOrden = document.createElement('td');
    tdOrden.className = 'hi-orden-cell';
    tdOrden.innerHTML =
      '<div class="hi-orden-label">Quitar en este orden</div>' +
      '<div class="hi-orden-wrap">' +
      '<table class="hi-orden-tabla">' +
      seccion.ordenRetirada.map(function (o, i) {
        return '<tr><td class="hi-orden-num">' + (i + 1) + 'º</td><td>' + escapeHtml(quitarCodigoTienda(quitarMarcadorNombre(o))) + '</td></tr>';
      }).join('') +
      '</table>' +
      '</div>';
    fila.appendChild(tdOrden);
  }

  tbody.appendChild(fila);
  layout.appendChild(tbody);
  grupo.appendChild(layout);
  return grupo;
}

/** "NO" tal cual viene del Excel (sin importar mayúsculas/espacios): esa
 *  tienda no debe recibir palets por esa vía ese día. */
function esValorNo(v) {
  return String(v == null ? '' : v).trim().toUpperCase() === 'NO';
}

/** Celda de 60/PTA/CART en la hoja de impresión manual (construirGrupoImpresionDia_):
 *  se deja en blanco para rellenar a mano, salvo que el valor de origen sea
 *  "NO" (ver esValorNo), en cuyo caso se marca con una "X" para que quede
 *  claro sobre el papel que esa tienda no debe recibir palets por esa vía. */
function celdaImpresionManual_(valor) {
  return esValorNo(valor) ? '<td class="hi-blanco hi-no">X</td>' : '<td class="hi-blanco"></td>';
}
