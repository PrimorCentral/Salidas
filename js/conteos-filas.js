/* SALIDAS · js/conteos-filas.js — Conteos diarios: filas, celdas, cálculo/validación y recogerFilas */

// Evita que la rueda del ratón cambie el número cuando el cursor está
// encima de una casilla de conteo (comportamiento nativo del navegador en
// los <input type="number"> enfocados, no deseado aquí). Un único listener
// delegado en el documento, en captura y sin passive, para poder frenarlo;
// no afecta al scroll normal de la página en el resto de la pantalla.
document.addEventListener('wheel', function (e) {
  const el = e.target;
  if (el && el.tagName === 'INPUT' && el.type === 'number' && el.classList.contains('celda')) {
    e.preventDefault();
  }
}, { passive: false, capture: true });

/** Texto de la columna LÍMITE: el número si la tienda tiene uno
 *  configurado (en Configuración tiendas o, si lo tiene, el propio de
 *  ese día en Plantilla), o "NO" si no tiene límite. Se usa tanto para
 *  la celda en pantalla como para el atributo data-limite (que leen la
 *  validación de exceso, el modal de envío y los PDF/impresión) y para
 *  la hoja de impresión manual (conteos-impresion.js) -- así "NO" sale
 *  igual en todos los sitios en vez del "null" que salía antes cuando
 *  la tienda no tenía límite.
 */
function textoLimite_(limite) {
  return (limite == null || limite === '') ? 'NO' : limite;
}

/**
 * Celda de 60/PTA/CART. Si el valor es "NO", se muestra en rojo y no
 * editable (con un botón para forzar un número igualmente si hiciera
 * falta); si no, es el input numérico normal de siempre.
 */
function celdaConteoHtml(campo, valor, forzado) {
  if (forzado) {
    return '<input class="celda celda-forzada" data-campo="' + campo + '" data-forzado="1" type="number" value="' + valor + '" title="Forzado pese al &quot;NO&quot; original. Toca para volver a forzar/cambiar el número.">';
  }
  if (esValorNo(valor)) {
    return '<input class="celda celda-no" data-campo="' + campo + '" type="text" value="NO" readonly title="Esta tienda no debe recibir palets por esta vía. Toca para forzar un número igualmente.">';
  }
  return '<input class="celda" data-campo="' + campo + '" type="number" value="' + valor + '">';
}

/**
 * "Doble salida" (cambio puntual en el que la tienda sale ese día por DOS
 * agrupaciones, ver Gestión festivos > Cambio puntual): las columnas que
 * rellena la OTRA agrupación se pintan como una casilla vacía, gris
 * azulada y no editable. Sigue llevando data-campo para que el TOTAL, el
 * guardado y el PDF la traten como vacía; el backend (guardar_conteo)
 * ignora además lo que llegue en esas columnas desde esta agrupación.
 */
function celdaOtraAgrupacionHtml_(campo, otraAgrupacion) {
  const nombreOtra = parsearNombreAgrupacion(otraAgrupacion || '').titulo || 'la otra agrupación';
  return '<input class="celda celda-otra-agencia" data-campo="' + campo + '" type="text" value="" placeholder="—" readonly tabindex="-1" ' +
    'title="Doble salida: esta columna la rellena hoy ' + escapeAttr(nombreOtra) + '">';
}

/** Columnas (60/PTA/CARTAMA) que le tocan a ESTA agrupación en una doble
 *  salida, como texto para el aviso de la fila: "60, CARTAMA". Las que
 *  salen por las dos agrupaciones (casilla compartida, cada una con su
 *  número) llevan "(en las dos)". */
function camposPropiosDobleTexto_(camposFuera, camposCompartidos) {
  const etiquetas = { c60: '60', pta: 'PTA', cart: 'CARTAMA' };
  return ['c60', 'pta', 'cart']
    .filter(function (c) { return (camposFuera || []).indexOf(c) === -1; })
    .map(function (c) { return etiquetas[c] + ((camposCompartidos || []).indexOf(c) !== -1 ? ' (en las dos)' : ''); })
    .join(', ');
}

/**
 * Celda de VIERNES (solo si la agrupación la tiene activada ese día, ver
 * seccion.tieneViernes). Si la tienda está excluida del viernes (desde
 * "Rutas y tiendas"), se pinta una casilla gris bloqueada con una X, como
 * en la hoja de Excel de siempre, y NO lleva data-campo: así recogerFilas
 * no manda "viernes" para esa tienda y el backend no la toca.
 */
function celdaViernesHtml_(t) {
  if (t.excluidaViernes) {
    return '<td><div class="celda-viernes-excluida" title="Esta tienda no lleva VIERNES">X</div></td>';
  }
  return '<td><input class="celda celda-viernes" data-campo="viernes" type="number" value="' + (t.viernes == null ? '' : t.viernes) + '" title="VIERNES: suma al TOTAL de la tienda, pero no al total de palets de la carga ni al envío a la agencia"></td>';
}

/**
 * Celda de DOMINGO: exactamente igual que la de VIERNES (ver
 * celdaViernesHtml_), pero con su propia columna en la base de datos
 * (conteos.casilla_domingo) y su propio interruptor por ruta
 * (seccion.tieneCasillaDomingo) y por tienda (t.excluidaDomingo).
 */
function celdaDomingoHtml_(t) {
  if (t.excluidaDomingo) {
    return '<td><div class="celda-domingo-excluida" title="Esta tienda no lleva DOMINGO">X</div></td>';
  }
  return '<td><input class="celda celda-domingo" data-campo="casillaDomingo" type="number" value="' + (t.casillaDomingo == null ? '' : t.casillaDomingo) + '" title="DOMINGO: suma al TOTAL de la tienda, pero no al total de palets de la carga ni al envío a la agencia"></td>';
}

function filaHtml(t, esPrimeraDeGrupo, esUltimaDeGrupo, tienePeso, tieneCExpress, tieneSobrestock, tieneViernes, tieneDomingo) {
  const nombreLimpio = quitarMarcadorNombre(t.nombre);
  const badge = badgeTransitoTienda(t.transito);
  const badgeHtml = badge
    ? '<span class="badge-plazo ' + badge.clase + '">' + badge.texto + '</span>'
    : '';
  const notaHtml = (t.nota && !t.notaGrupoId)
    ? '<div class="nota-tienda" data-nota-base="' + escapeAttr(t.nota) + '">' + escapeHtml(t.nota) + '</div>'
    : '';
  const atrGrupo = t.notaGrupoId
    ? ' data-nota-grupo="' + escapeAttr(t.notaGrupoId) + '" data-nota-limite="' + (t.notaLimite != null ? t.notaLimite : '') + '" data-nota-grupo-tipo="' + escapeAttr(t.notaGrupoTipo || '') + '"'
    : '';
  const claseGrupo = t.notaGrupoId
    ? ' fila-grupo-ruta' + (t.notaGrupoTipo === 'total' ? ' fila-grupo-total' : '') + (esPrimeraDeGrupo ? ' fila-grupo-primera' : '') + (esUltimaDeGrupo ? ' fila-grupo-ultima' : '')
    : '';
  if (t.cerrada) {
    return '<tr class="fila-cerrada' + claseGrupo + '" data-row="' + t.row + '" data-nombre="' + escapeAttr(t.nombre) + '" data-cierre-id="' + escapeAttr(t.cierreId) + '"' + atrGrupo + '>' +
      '<td class="nombre">' + escapeHtml(nombreLimpio) + badgeHtml + notaHtml + '</td>' +
      '<td class="limite">' + textoLimite_(t.limite) + '</td>' +
      '<td colspan="' + (5 + (tieneViernes ? 1 : 0) + (tieneDomingo ? 1 : 0) + (tienePeso ? 1 : 0) + (tieneCExpress ? 1 : 0) + (tieneSobrestock ? 1 : 0)) + '"><div class="motivo-cierre">' + escapeHtml(String(t.motivoCierre || 'CONTEO BLOQUEADO').toUpperCase()) + '</div></td>' +
      '<td><button type="button" class="btn-reabrir" title="Desbloquear el conteo de esta tienda">Desbloquear</button></td>' +
      '</tr>';
  }
  // Tienda que HOY sale por otra agrupación por un "cambio puntual"
  // (excepción): se mantiene visible aquí, en su agrupación de siempre,
  // pero tachada y sin celdas de conteo — igual que una tienda cerrada,
  // pero dejando claro que no está cerrada: solo sale por otro sitio hoy.
  // Se gestiona (y se quita) desde "Gestión festivos", no desde aquí.
  if (t.salePorExcepcion) {
    return '<tr class="fila-sale-excepcion' + claseGrupo + '" data-row="' + t.row + '" data-nombre="' + escapeAttr(t.nombre) + '"' + atrGrupo + '>' +
      '<td class="nombre">' + escapeHtml(nombreLimpio) + badgeHtml + notaHtml + '</td>' +
      '<td class="limite">' + textoLimite_(t.limite) + '</td>' +
      '<td colspan="' + (5 + (tieneViernes ? 1 : 0) + (tieneDomingo ? 1 : 0) + (tienePeso ? 1 : 0) + (tieneCExpress ? 1 : 0) + (tieneSobrestock ? 1 : 0)) + '"><div class="motivo-cierre motivo-excepcion">POR EXCEPCIÓN SALE POR ' + escapeHtml(t.excepcionAgrupacionDestino || '') + '</div></td>' +
      '<td></td>' +
      '</tr>';
  }
  // Tienda que HOY entra aquí procedente de otra agrupación por un "cambio
  // puntual": se resalta toda la fila en amarillo suave para que no pase
  // desapercibida entre las tiendas de siempre de esta agrupación.
  const claseExcepcionEntrada = t.entraPorExcepcion ? ' fila-entra-excepcion' : '';
  // "Doble salida": la tienda sale hoy por esta agrupación Y por otra; cada
  // una rellena solo sus columnas (t.camposFuera = las que NO son de aquí;
  // 'extras' = PDTE, PESO, C.EXPRESS, SOBRESTOCK, VIERNES y DOMINGO, que se quedan
  // siempre en la agrupación de origen).
  const esDoble = !!t.dobleSalida;
  const fuera = esDoble ? (t.camposFuera || []) : [];
  const esFuera = function (campo) { return fuera.indexOf(campo) !== -1; };
  const otra = t.dobleOtraAgrupacion || '';
  const claseDoble = (esDoble && !t.entraPorExcepcion) ? ' fila-doble-salida' : '';
  const avisoDobleHtml = esDoble
    ? '<div class="aviso-doble-salida">' +
        (t.entraPorExcepcion ? 'Doble salida con ' : 'También sale por ') +
        escapeHtml(parsearNombreAgrupacion(otra).titulo) +
        ' · aquí: ' + escapeHtml(camposPropiosDobleTexto_(fuera, t.camposCompartidos) || 'solo PDTE') +
      '</div>'
    : '';
  const tituloEntrada = t.entraPorExcepcion
    ? (esDoble
        ? ' title="Doble salida: hoy esta tienda sale por aquí y por ' + escapeAttr(otra) + '. Aquí solo se rellenan sus columnas."'
        : ' title="Sale por aquí hoy por un cambio puntual (excepción), no es de esta agrupación habitualmente."')
    : (esDoble ? ' title="Doble salida: hoy esta tienda también sale por ' + escapeAttr(otra) + '. Las columnas en gris las rellena esa agrupación."' : '');
  const celdaNave = function (campo) {
    if (esFuera(campo)) return celdaOtraAgrupacionHtml_(campo, otra);
    return celdaConteoHtml(campo, t[campo], !!(t.forzados && t.forzados[campo] !== undefined));
  };
  const celdaExtra = function (campo, valor, step) {
    if (esFuera('extras')) return celdaOtraAgrupacionHtml_(campo, otra);
    return '<input class="celda" data-campo="' + campo + '" type="number"' + (step ? ' step="' + step + '"' : '') + ' value="' + (valor == null ? '' : valor) + '">';
  };
  return '<tr class="' + (claseGrupo.trim() + claseExcepcionEntrada + claseDoble).trim() + '" data-row="' + t.row + '" data-limite="' + escapeAttr(textoLimite_(t.limite)) + '" data-nombre="' + escapeAttr(t.nombre) + '"' + atrGrupo + tituloEntrada + '>' +
    '<td class="nombre">' + escapeHtml(nombreLimpio) + badgeHtml + notaHtml + avisoDobleHtml + '</td>' +
    '<td class="limite">' + textoLimite_(t.limite) + '</td>' +
    (tieneViernes ? (esFuera('extras') && !t.excluidaViernes ? '<td>' + celdaOtraAgrupacionHtml_('viernes', otra) + '</td>' : celdaViernesHtml_(t)) : '') +
    (tieneDomingo ? (esFuera('extras') && !t.excluidaDomingo ? '<td>' + celdaOtraAgrupacionHtml_('casillaDomingo', otra) + '</td>' : celdaDomingoHtml_(t)) : '') +
    '<td>' + celdaNave('c60') + '</td>' +
    '<td>' + celdaNave('pta') + '</td>' +
    '<td>' + celdaNave('cart') + '</td>' +
    '<td>' +
      '<input class="celda celda-total" data-campo="total" type="number" value="' + t.total + '" readonly tabindex="-1" style="display:none">' +
      '<input class="celda celda-total-visual" data-campo="totalVisual" type="number" readonly tabindex="-1" title="Incluye el PDTE, el VIERNES y el DOMINGO. El límite del camión, la cabecera y el envío a agencia siguen contando solo 60+PTA+CART.">' +
      '<div class="diff-nota"></div>' +
    '</td>' +
    '<td>' + celdaExtra('pdte', t.pdte) + '</td>' +
    (tienePeso ? '<td>' + celdaExtra('peso', t.peso, '0.01') + '</td>' : '') +
    (tieneCExpress ? '<td>' + celdaExtra('cexpress', t.cexpress, '0.01') + '</td>' : '') +
    (tieneSobrestock ? '<td>' + celdaExtra('sobrestock', t.sobrestock, '0.01') + '</td>' : '') +
    '<td><button type="button" class="btn-cerrar-tienda" title="Bloquear conteo de esta tienda">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg></button></td>' +
    '</tr>';
}

/**
 * Calcula TOTAL = 60 + PTA + CART automáticamente al escribir, y colorea la fila
 * en ámbar (1-2 palets de más, se acepta ciñéndose al límite) o rojo
 * (3 o más de más, hay que consultar a informática).
 */
function attachCalculoYValidacion(tr) {
  const limite = Number(tr.getAttribute('data-limite'));
  const c60Input = tr.querySelector('input[data-campo="c60"]');
  const ptaInput = tr.querySelector('input[data-campo="pta"]');
  const cartInput = tr.querySelector('input[data-campo="cart"]');
  const cexpressInput = tr.querySelector('input[data-campo="cexpress"]');
  const sobrestockInput = tr.querySelector('input[data-campo="sobrestock"]');
  const totalInput = tr.querySelector('input[data-campo="total"]');
  const pdteInput = tr.querySelector('input[data-campo="pdte"]');
  const totalVisualInput = tr.querySelector('input[data-campo="totalVisual"]');
  const viernesInput = tr.querySelector('input[data-campo="viernes"]');
  const domingoInput = tr.querySelector('input[data-campo="casillaDomingo"]');
  const nota = tr.querySelector('.diff-nota');

  // VIERNES: igual que el PDTE, se suma solo a lo que VE el usuario en el
  // TOTAL de la tienda y al aviso de límite de esta fila, pero NO al campo
  // "total" real (que es el que suman la cabecera de palets de la
  // agrupación, los grupos de palets y el envío a la agencia).
  function valorViernes() {
    return (viernesInput && viernesInput.value !== '') ? (parseFloat(viernesInput.value) || 0) : 0;
  }
  // DOMINGO: exactamente igual que VIERNES.
  function valorDomingo() {
    return (domingoInput && domingoInput.value !== '') ? (parseFloat(domingoInput.value) || 0) : 0;
  }

  // recalcTotalVisual: solo actualiza lo que VE el usuario en la columna
  // TOTAL (real + PDTE). No toca totalInput (el real), así que no afecta
  // al contador de cabecera de la agrupación ni a lo que se manda a la
  // agencia en previsión/definitivo — esos siguen leyendo solo el campo
  // "total" real, sin PDTE. El aviso de límite de esta fila (validar(),
  // más abajo) sí suma el PDTE.
  function recalcTotalVisual() {
    if (!totalVisualInput) return;
    const real = totalInput.value === '' ? 0 : (parseFloat(totalInput.value) || 0);
    const pdte = (pdteInput && pdteInput.value !== '') ? (parseFloat(pdteInput.value) || 0) : 0;
    const vie = valorViernes();
    const dom = valorDomingo();
    if (totalInput.value === '' && pdte === 0 && vie === 0 && dom === 0) {
      totalVisualInput.value = '';
    } else {
      totalVisualInput.value = real + pdte + vie + dom;
    }
  }

  function recalcTotal() {
    if (c60Input.value === '' && ptaInput.value === '' && cartInput.value === '' && (!cexpressInput || cexpressInput.value === '') && (!sobrestockInput || sobrestockInput.value === '')) {
      totalInput.value = '';
    } else {
      const m = parseFloat(c60Input.value) || 0;
      const p = parseFloat(ptaInput.value) || 0;
      const c = parseFloat(cartInput.value) || 0;
      const ce = cexpressInput ? (parseFloat(cexpressInput.value) || 0) : 0;
      const so = sobrestockInput ? (parseFloat(sobrestockInput.value) || 0) : 0;
      totalInput.value = m + p + c + ce + so;
    }
    validar();
    recalcTotalVisual();
  }

  function validar() {
    tr.classList.remove('fila-aviso', 'fila-alerta');
    nota.textContent = '';
    nota.className = 'diff-nota';

    const vie = valorViernes();
    const dom = valorDomingo();
    const totalReal = parseFloat(totalInput.value);
    if ((isNaN(totalReal) && vie === 0 && dom === 0) || !limite) return;
    const total = isNaN(totalReal) ? 0 : totalReal;

    const pdte = (pdteInput && pdteInput.value !== '') ? (parseFloat(pdteInput.value) || 0) : 0;
    const exceso = (total + pdte + vie + dom) - limite;
    if (exceso >= 3) {
      tr.classList.add('fila-alerta');
      nota.textContent = '+' + exceso + ' sobre el límite — consultar a informática';
      nota.classList.add('alerta');
    } else if (exceso >= 1) {
      tr.classList.add('fila-aviso');
      nota.textContent = '+' + exceso + ' sobre el límite — ceñirse al límite';
      nota.classList.add('aviso');
    }
  }

  c60Input.addEventListener('input', recalcTotal);
  ptaInput.addEventListener('input', recalcTotal);
  cartInput.addEventListener('input', recalcTotal);
  if (cexpressInput) cexpressInput.addEventListener('input', recalcTotal);
  if (sobrestockInput) sobrestockInput.addEventListener('input', recalcTotal);
  if (pdteInput) pdteInput.addEventListener('input', function () { validar(); recalcTotalVisual(); });
  if (viernesInput) viernesInput.addEventListener('input', function () { validar(); recalcTotalVisual(); });
  if (domingoInput) domingoInput.addEventListener('input', function () { validar(); recalcTotalVisual(); });
  validar();
  recalcTotalVisual();
}

/**
 * Engancha el botón "+" de las casillas que traen "NO". Al pulsarlo, tras
 * confirmar, deja escribir un número igualmente: la misma casilla pasa a
 * ser un input numérico normal (marcado en ámbar) y se manda al backend
 * como campoForzado, así el "NO" original de la hoja no se borra (ver
 * guardarConteo / escribirCeldaConteo_ en el backend).
 */
function attachForzarNo(tr) {
  tr.querySelectorAll('input.celda-no').forEach(function (input) {
    input.addEventListener('click', function () {
      appConfirm('FORZAR SALIDA DE PALETS', 'Esta casilla trae "NO" configurado.\nSignifica que esta tienda no debería recibir palets de esta nave\n¿Quieres forzar el envio de palets de esta nave?.',
        function () {
          appPrompt('Número de palets a forzar', 'Ej: 2', function (texto) {
            const numero = Number(String(texto).replace(',', '.'));
            if (isNaN(numero)) { mostrarToast('Introduce un número válido', true); return; }
            input.type = 'number';
            input.readOnly = false;
            input.value = numero;
            input.classList.remove('celda-no');
            input.classList.add('celda-forzada');
            input.setAttribute('data-forzado', '1');
            input.title = 'Forzado pese al "NO" original';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            actualizarTotalPalets();
          }, false);
        }
      );
    });
  });
}

/**
 * Algunas anotaciones de carga (ej. "8P MAX. POR RUTA") no son un límite de
 * cada tienda por separado, sino de varias tiendas juntas (mismo camión/
 * ruta). Esas filas comparten "data-nota-grupo" (mismo id = misma celda
 * combinada en el Excel) y "data-nota-limite" (el número sacado del texto,
 * ej. 8). Aquí se agrupan esas filas, se suma su TOTAL en vivo cada vez que
 * cambia cualquiera de ellas, y se pinta el aviso en el chip ÚNICO de la
 * fila-cabecera del grupo (ya no se repite en cada tienda).
 */
function attachValidacionGrupos(tableWrap) {
  const grupos = {};
  tableWrap.querySelectorAll('table.conteo tbody tr[data-nota-grupo]').forEach(function (tr) {
    const id = tr.getAttribute('data-nota-grupo');
    if (!grupos[id]) grupos[id] = [];
    grupos[id].push(tr);
  });

  Object.keys(grupos).forEach(function (id) {
    const filas = grupos[id];
    const limiteStr = filas[0].getAttribute('data-nota-limite');
    const limite = limiteStr ? Number(limiteStr) : null;
    const esTotal = filas[0].getAttribute('data-nota-grupo-tipo') === 'total';
    const headerRow = tableWrap.querySelector('tr[data-nota-grupo-header="' + id + '"]');
    const chip = headerRow ? headerRow.querySelector('.grupo-header-chip') : null;

    function recalcGrupo() {
      let suma = 0;
      filas.forEach(function (tr) {
        const totalInput = tr.querySelector('input[data-campo="total"]');
        const v = totalInput ? parseFloat(totalInput.value) : NaN;
        if (!isNaN(v)) suma += v;
      });

      // Los grupos "total" son solo informativos: nunca se marcan en
      // amarillo/rojo, sea cual sea la suma (no hay límite que comprobar).
      if (!esTotal) {
        filas.forEach(function (tr) {
          tr.classList.remove('fila-grupo-aviso', 'fila-grupo-alerta');
          if (limite) {
            if (suma > limite) tr.classList.add('fila-grupo-alerta');
            else if (suma === limite) tr.classList.add('fila-grupo-aviso');
          }
        });
      }

      if (headerRow) headerRow.classList.remove('fila-grupo-header-aviso', 'fila-grupo-header-alerta');
      if (chip) {
        const base = chip.getAttribute('data-nota-base') || '';
        chip.classList.remove('nota-grupo-aviso', 'nota-grupo-alerta');
        if (esTotal) {
          chip.textContent = suma + ' ' + (suma === 1 ? 'palet' : 'palets');
        } else if (limite) {
          chip.textContent = base + ' — ' + suma + '/' + limite;
          if (suma > limite) { chip.classList.add('nota-grupo-alerta'); if (headerRow) headerRow.classList.add('fila-grupo-header-alerta'); }
          else if (suma === limite) { chip.classList.add('nota-grupo-aviso'); if (headerRow) headerRow.classList.add('fila-grupo-header-aviso'); }
        } else {
          chip.textContent = base;
        }
      }
    }

    filas.forEach(function (tr) {
      tr.querySelectorAll('input.celda:not(.celda-total):not(.celda-total-visual)').forEach(function (input) {
        input.addEventListener('input', recalcGrupo);
      });
    });
    recalcGrupo();
  });
}

function recogerFilas(tableWrap) {
  const filas = [];
  tableWrap.querySelectorAll('table.conteo tbody tr').forEach(function (tr) {
    if (tr.classList.contains('fila-cerrada') || tr.classList.contains('fila-grupo-header')) return; // tiendas cerradas y fila-resumen del grupo no se guardan
    // "row" es ahora el UUID de tiendas_ruta (antes era el nº de fila de
    // la hoja de Google Sheets), así que NO se convierte con Number().
    const row = tr.getAttribute('data-row');
    // Para 60/PTA/CART: si la casilla se forzó pese a traer "NO", se manda
    // "NO" en el campo normal (para que el backend NO sobrescriba esa
    // celda) y el número escrito va aparte en xxxForzado, tal como espera
    // guardarConteo() en el backend.
    // "borrado" avisa al backend de que la casilla estaba forzada y se ha
    // dejado vacía, para que quite el forzado guardado en palets_forzados
    // (si no, al recargar volvería a aparecer el número). Una casilla que
    // sigue en "NO" sin forzar NO manda esta marca, así una pantalla
    // desactualizada no puede borrar un forzado que puso otra persona.
    const getConEscape = function (campo) {
      const input = tr.querySelector('input[data-campo="' + campo + '"]');
      if (input.getAttribute('data-forzado') === '1') {
        const vacio = input.value === '';
        return { valor: 'NO', forzado: vacio ? '' : input.value, borrado: vacio };
      }
      return { valor: input.value === '' ? '' : input.value, forzado: '', borrado: false };
    };
    const get = function (campo) {
      const input = tr.querySelector('input[data-campo="' + campo + '"]');
      if (!input) return undefined;
      return input.value === '' ? '' : input.value;
    };
    const c60 = getConEscape('c60');
    const pta = getConEscape('pta');
    const cart = getConEscape('cart');
    const fila = {
      row: row,
      c60: c60.valor, c60Forzado: c60.forzado, c60ForzadoBorrado: c60.borrado,
      pta: pta.valor, ptaForzado: pta.forzado, ptaForzadoBorrado: pta.borrado,
      cart: cart.valor, cartForzado: cart.forzado, cartForzadoBorrado: cart.borrado,
      total: get('total'), pdte: get('pdte')
    };
    // El campo "peso" solo existe en las tiendas de rutas que lo tengan
    // activado (ver seccion.tienePeso); si no hay casilla, no se manda nada.
    const peso = get('peso');
    if (peso !== undefined) fila.peso = peso;
    // Igual que "peso", "cexpress" solo existe si la ruta lo tiene activado
    // (ver seccion.tieneCExpress).
    const cexpress = get('cexpress');
    if (cexpress !== undefined) fila.cexpress = cexpress;
    // Igual que "peso" y "cexpress", "sobrestock" solo existe si la ruta lo
    // tiene activado (ver seccion.tieneSobrestock).
    const sobrestock = get('sobrestock');
    if (sobrestock !== undefined) fila.sobrestock = sobrestock;
    // "viernes" solo existe si la agrupación lo tiene activado ese día (ver
    // seccion.tieneViernes) y la tienda no está excluida. Si no hay
    // casilla, no se manda nada y el backend deja el valor como estaba.
    const viernes = get('viernes');
    if (viernes !== undefined) fila.viernes = viernes;
    // "casillaDomingo": igual que "viernes" (solo si la agrupación tiene la
    // casilla DOMINGO activada y la tienda no está excluida).
    const casillaDomingo = get('casillaDomingo');
    if (casillaDomingo !== undefined) fila.casillaDomingo = casillaDomingo;
    filas.push(fila);
  });
  return filas;
}
