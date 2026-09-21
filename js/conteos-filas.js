/* SALIDAS · js/conteos-filas.js — Conteos diarios: filas, celdas, cálculo/validación y recogerFilas */

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

function filaHtml(t, esPrimeraDeGrupo, esUltimaDeGrupo, tienePeso, tieneCExpress, tieneSobrestock) {
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
      '<td class="limite">' + t.limite + '</td>' +
      '<td colspan="' + (5 + (tienePeso ? 1 : 0) + (tieneCExpress ? 1 : 0) + (tieneSobrestock ? 1 : 0)) + '"><div class="motivo-cierre">CERRADA — ' + escapeHtml(t.motivoCierre) + '</div></td>' +
      '<td><button type="button" class="btn-reabrir">Reabrir</button></td>' +
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
      '<td class="limite">' + t.limite + '</td>' +
      '<td colspan="' + (5 + (tienePeso ? 1 : 0) + (tieneCExpress ? 1 : 0) + (tieneSobrestock ? 1 : 0)) + '"><div class="motivo-cierre motivo-excepcion">POR EXCEPCIÓN SALE POR ' + escapeHtml(t.excepcionAgrupacionDestino || '') + '</div></td>' +
      '<td></td>' +
      '</tr>';
  }
  // Tienda que HOY entra aquí procedente de otra agrupación por un "cambio
  // puntual": se resalta toda la fila en amarillo suave para que no pase
  // desapercibida entre las tiendas de siempre de esta agrupación.
  const claseExcepcionEntrada = t.entraPorExcepcion ? ' fila-entra-excepcion' : '';
  const tituloEntrada = t.entraPorExcepcion ? ' title="Sale por aquí hoy por un cambio puntual (excepción), no es de esta agrupación habitualmente."' : '';
  return '<tr class="' + (claseGrupo.trim() + claseExcepcionEntrada).trim() + '" data-row="' + t.row + '" data-limite="' + t.limite + '" data-nombre="' + escapeAttr(t.nombre) + '"' + atrGrupo + tituloEntrada + '>' +
    '<td class="nombre">' + escapeHtml(nombreLimpio) + badgeHtml + notaHtml + '</td>' +
    '<td class="limite">' + t.limite + '</td>' +
    '<td>' + celdaConteoHtml('c60', t.c60, !!(t.forzados && t.forzados.c60 !== undefined)) + '</td>' +
    '<td>' + celdaConteoHtml('pta', t.pta, !!(t.forzados && t.forzados.pta !== undefined)) + '</td>' +
    '<td>' + celdaConteoHtml('cart', t.cart, !!(t.forzados && t.forzados.cart !== undefined)) + '</td>' +
    '<td>' +
      '<input class="celda celda-total" data-campo="total" type="number" value="' + t.total + '" readonly tabindex="-1" style="display:none">' +
      '<input class="celda celda-total-visual" data-campo="totalVisual" type="number" readonly tabindex="-1" title="Incluye el PDTE. El límite del camión, la cabecera y el envío a agencia siguen contando solo 60+PTA+CART.">' +
      '<div class="diff-nota"></div>' +
    '</td>' +
    '<td><input class="celda" data-campo="pdte" type="number" value="' + t.pdte + '"></td>' +
    (tienePeso ? '<td><input class="celda" data-campo="peso" type="number" step="0.01" value="' + (t.peso == null ? '' : t.peso) + '"></td>' : '') +
    (tieneCExpress ? '<td><input class="celda" data-campo="cexpress" type="number" step="0.01" value="' + (t.cexpress == null ? '' : t.cexpress) + '"></td>' : '') +
    (tieneSobrestock ? '<td><input class="celda" data-campo="sobrestock" type="number" step="0.01" value="' + (t.sobrestock == null ? '' : t.sobrestock) + '"></td>' : '') +
    '<td><button type="button" class="btn-cerrar-tienda" title="Marcar tienda como cerrada">' +
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
  const nota = tr.querySelector('.diff-nota');

  // recalcTotalVisual: solo actualiza lo que VE el usuario en la columna
  // TOTAL (real + PDTE). No toca totalInput (el real), así que no afecta
  // ni al aviso de límite del camión, ni al contador de cabecera de la
  // agrupación, ni a lo que se manda a la agencia en previsión/definitivo
  // — esos siguen leyendo solo el campo "total" real, sin PDTE.
  function recalcTotalVisual() {
    if (!totalVisualInput) return;
    const real = totalInput.value === '' ? 0 : (parseFloat(totalInput.value) || 0);
    const pdte = (pdteInput && pdteInput.value !== '') ? (parseFloat(pdteInput.value) || 0) : 0;
    if (totalInput.value === '' && pdte === 0) {
      totalVisualInput.value = '';
    } else {
      totalVisualInput.value = real + pdte;
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

    const total = parseFloat(totalInput.value);
    if (isNaN(total) || !limite) return;

    const exceso = total - limite;
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
  if (pdteInput) pdteInput.addEventListener('input', recalcTotalVisual);
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
    filas.push(fila);
  });
  return filas;
}
