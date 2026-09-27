/* SALIDAS · js/utilidades.js — Helpers mínimos de HTML (escapeHtml, escapeAttr), usados ya durante la carga */

/* ---------------- UI HELPERS ---------------- */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------- AVISO DE CARGA LENTA ----------------
 * Todo lo que pone "Cargando…" lleva un spinner girando (spinner-navy en
 * las cargas grandes, spinner-mini en los textos pequeños). Además, si
 * un mismo spinner sigue en pantalla más de CARGA_LENTA_MS_, debajo aparece
 * un aviso con un botón "Recargar": así nunca se queda "cargando" sin que
 * se sepa si sigue trabajando o se ha quedado colgado. En cuanto la
 * pantalla termina de cargar (el spinner desaparece), el aviso se va con él.
 */
const CARGA_LENTA_MS_ = 15000;
const CARGA_VISTA_DESDE_ = new WeakMap();

function revisarCargasLentas_() {
  const ahora = Date.now();
  document.querySelectorAll('.loader .spinner-navy, .cargando-linea .spinner-mini').forEach(function (sp) {
    if (!sp.isConnected || sp.offsetParent === null) return; // oculto: no cuenta
    if (!CARGA_VISTA_DESDE_.has(sp)) { CARGA_VISTA_DESDE_.set(sp, ahora); return; }
    const cont = sp.closest('.loader, .cargando-linea');
    if (!cont || cont.querySelector('.carga-lenta')) return;
    if (ahora - CARGA_VISTA_DESDE_.get(sp) < CARGA_LENTA_MS_) return;
    const aviso = document.createElement('div');
    aviso.className = 'carga-lenta';
    aviso.innerHTML = 'Está tardando más de lo normal. Comprueba la conexión o ' +
      '<button type="button" class="carga-lenta-btn">Recargar</button>';
    aviso.querySelector('button').onclick = function () { location.reload(); };
    cont.appendChild(aviso);
  });
}
setInterval(revisarCargasLentas_, 2000);
