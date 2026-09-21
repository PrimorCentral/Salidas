/* SALIDAS · js/conteos-resumen.js — Conteos diarios: resumen rápido del día */

/* ---------------- RESUMEN RÁPIDO DEL DÍA (sidebar derecho) ---------------- */

/**
 * Recorre las notas generales del día y, para cada agrupación, sus notas y
 * tiendas cerradas, y construye un resumen agrupado en el panel lateral
 * derecho. Al pulsar sobre un bloque de agrupación, se hace scroll y se
 * expande esa sección en el contenido principal.
 */
function renderResumenDia(data) {
  const body = document.getElementById('resumen-body');
  const countEl = document.getElementById('resumen-count');
  const bloques = [];
  let total = 0;

  if (data.notasGenerales && data.notasGenerales.length) {
    total += data.notasGenerales.length;
    bloques.push({
      titulo: 'Nota general del día',
      key: null,
      items: data.notasGenerales.map(function (n) {
        return { texto: n.texto, tipo: n.tipo, tienda: null };
      })
    });
  }

  (data.secciones || []).forEach(function (seccion) {
    const items = [];
    (seccion.notas || []).forEach(function (n) {
      items.push({ texto: n.texto, tipo: n.tipo, tienda: null });
    });
    seccion.tiendas.forEach(function (t) {
      if (t.cerrada) items.push({ texto: t.motivoCierre || 'Tienda cerrada', tipo: 'cierre', tienda: t.nombre });
    });
    if (items.length) {
      total += items.length;
      bloques.push({
        titulo: parsearNombreAgrupacion(seccion.nombre).titulo,
        key: seccion.nombre,
        items: items
      });
    }
  });

  if (!bloques.length) {
    body.innerHTML = '<div class="resumen-vacio">Sin cierres ni anotaciones para este día.</div>';
    countEl.style.display = 'none';
    return;
  }

  countEl.style.display = 'inline-block';
  countEl.textContent = total;

  body.innerHTML = '';
  bloques.forEach(function (b) {
    const div = document.createElement('div');
    div.className = 'resumen-grupo';
    const itemsHtml = b.items.map(function (it) {
      const clase = it.tipo === 'cierre' ? 'resumen-item cierre' : 'resumen-item';
      const prefijo = it.tienda ? '<span class="tienda">' + escapeHtml(it.tienda) + ':</span> ' : '';
      return '<div class="' + clase + '">' + prefijo + escapeHtml(it.texto) + '</div>';
    }).join('');
    div.innerHTML =
      '<div class="resumen-grupo-titulo"><span>' + escapeHtml(b.titulo) + '</span>' +
      (b.key ? '<span class="ir">Ver &#8599;</span>' : '') + '</div>' +
      itemsHtml;
    if (b.key) {
      div.onclick = function () { irASeccion(b.key); };
    }
    body.appendChild(div);
  });
}

/** Expande y hace scroll hasta la agrupación indicada dentro del contenido principal */
function irASeccion(key) {
  const selector = '.seccion-panel[data-seccion-key="' + cssEscapeAtributo(key) + '"]';
  const panel = document.querySelector(selector);
  if (!panel) return;
  panel.classList.remove('colapsada');
  ESTADO.colapsadas.delete(key);
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.style.transition = 'box-shadow .3s';
  panel.style.boxShadow = '0 0 0 3px rgba(28,43,69,.35)';
  setTimeout(function () { panel.style.boxShadow = ''; }, 1300);
}

function cssEscapeAtributo(s) {
  if (window.CSS && CSS.escape) return CSS.escape(s);
  return String(s).replace(/["\\]/g, '\\$&');
}
