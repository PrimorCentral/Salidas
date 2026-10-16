/* SALIDAS · js/acerca-de.js — Ventana "Acerca de" al pulsar el logo (login y cabecera).
 * Misma ventana que en GIDT: pestañas "Licencia" y "Novedades" (historial
 * de versiones de js/changelog.js). El marcado está en index.html
 * (#acercaDeModalOverlay) y los estilos al final de styles.css. */

/* Datos que se muestran en la ventana. Para cambiar el titular de la
 * licencia o el número de activación, basta con tocarlos aquí.
 * La versión NO se pone aquí: sale siempre de version.json (la misma que
 * usa js/actualizaciones.js), así que se actualiza sola con cada versión. */
const ACERCA_DE_ = {
  autor: 'JOSE LUIS FRANCO FERNANDEZ',
  licenciatario: 'PRIMOR',
  activacion: 'PR7KX-M9Q2T-4HWVB-J8C3D-RN6YF',
  anio: '2026',
  titularDerechos: 'Jose Luis Franco Fernandez'
};

(function () {
  function pintarContenido() {
    const d = ACERCA_DE_;
    document.getElementById('acercaDeAutor').textContent = d.autor;
    document.getElementById('acercaDeLicenciatario').textContent = d.licenciatario;
    document.getElementById('acercaDeActivacion').textContent = d.activacion;
    document.getElementById('acercaDeCopy').innerHTML =
      '© ' + escapeHtml(d.anio) + ' ' + escapeHtml(d.titularDerechos) + '<span>Todos los derechos reservados.</span>';
  }

  // Pestaña "Novedades": historial de versiones de js/changelog.js.
  const TIPOS_CAMBIO = { nuevo: 'Nuevo', mejora: 'Mejora', correccion: 'Corrección' };

  function fechaChangelog(iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? p[2].padStart(2, '0') + '/' + p[1].padStart(2, '0') + '/' + p[0] : '';
  }

  function pintarNovedades() {
    const cont = document.getElementById('acercaDeNovedades');
    if (!cont) return;
    const e = escapeHtml;
    const lista = (typeof CHANGELOG_SALIDAS !== 'undefined' && Array.isArray(CHANGELOG_SALIDAS)) ? CHANGELOG_SALIDAS : [];
    if (!lista.length) {
      cont.innerHTML = '<p class="acerca-novedades-vacio">Aún no hay novedades registradas.</p>';
      return;
    }
    // La versión más reciente sale desplegada; las anteriores, plegadas
    // (solo la cabecera con un resumen de cuántos cambios de cada tipo tienen).
    cont.innerHTML = lista.map(function (v, i) {
      const conteo = { nuevo: 0, mejora: 0, correccion: 0 };
      const cambios = (v.cambios || []).map(function (c) {
        const tipo = TIPOS_CAMBIO[c.tipo] ? c.tipo : 'mejora';
        conteo[tipo] += 1;
        return '<li><span class="acerca-tag ' + tipo + '">' + TIPOS_CAMBIO[tipo] + '</span><span>' + e(c.texto) + '</span></li>';
      }).join('');
      const resumen = Object.keys(conteo).filter(function (t) { return conteo[t] > 0; }).map(function (t) {
        return '<span class="acerca-resumen-tag ' + t + '">' + conteo[t] + ' ' + TIPOS_CAMBIO[t] + '</span>';
      }).join('');
      const abierta = i === 0;
      return '<div class="acerca-version-item' + (abierta ? ' abierta' : '') + '">' +
        '<button type="button" class="acerca-version-cab" aria-expanded="' + abierta + '">' +
          '<span class="acerca-version-num">v' + e(v.version) + '</span>' +
          (i === 0 ? '<span class="acerca-version-actual">Actual</span>' : '') +
          '<span class="acerca-version-resumen">' + resumen + '</span>' +
          '<span class="acerca-version-fecha">' + e(fechaChangelog(v.fecha)) + '</span>' +
          '<svg class="acerca-version-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
        '</button>' +
        '<div class="acerca-version-detalle"><div><ul class="acerca-cambios">' + cambios + '</ul></div></div></div>';
    }).join('');

    cont.querySelectorAll('.acerca-version-cab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = btn.closest('.acerca-version-item');
        const abrir = !item.classList.contains('abierta');
        item.classList.toggle('abierta', abrir);
        btn.setAttribute('aria-expanded', String(abrir));
      });
    });
  }

  function mostrarPestana(cual) {
    const esNov = cual === 'novedades';
    const tabL = document.getElementById('acercaTabLicencia');
    const tabN = document.getElementById('acercaTabNovedades');
    tabL.classList.toggle('activa', !esNov);
    tabN.classList.toggle('activa', esNov);
    tabL.setAttribute('aria-selected', String(!esNov));
    tabN.setAttribute('aria-selected', String(esNov));
    document.getElementById('acercaPanelLicencia').hidden = esNov;
    document.getElementById('acercaPanelNovedades').hidden = !esNov;
  }

  function abrir() {
    const overlay = document.getElementById('acercaDeModalOverlay');
    if (!overlay) return;
    // Si ya hay otro modal abierto (un conteo a medio confirmar, el aviso
    // de actualización...), no se le pisa.
    const generico = document.getElementById('modal-overlay');
    if (generico && generico.style.display === 'flex') return;
    const act = document.getElementById('actualizacionModalOverlay');
    if (act && act.classList.contains('show')) return;

    pintarContenido();
    pintarNovedades();
    mostrarPestana('licencia');
    const elVersion = document.getElementById('acercaDeVersion');
    elVersion.textContent = APP_VERSION_ACTUAL ? 'Versión ' + APP_VERSION_ACTUAL : '';
    // Si al arrancar no se pudo leer version.json (p.ej. sin conexión), se
    // intenta ahora para que la ventana muestre el número igualmente.
    if (!APP_VERSION_ACTUAL) {
      obtenerVersionRemota_().then(function (v) {
        if (v) elVersion.textContent = 'Versión ' + v;
      });
    }

    overlay.classList.add('show');
    document.body.classList.add('modal-propio-abierto');
    document.getElementById('btnAcercaDeCerrar').focus();
  }

  function cerrar() {
    const overlay = document.getElementById('acercaDeModalOverlay');
    if (overlay) overlay.classList.remove('show');
    document.body.classList.remove('modal-propio-abierto');
  }

  function init() {
    const overlay = document.getElementById('acercaDeModalOverlay');
    if (!overlay) return;

    document.getElementById('btnAcercaDeCerrar').addEventListener('click', cerrar);
    document.getElementById('acercaTabLicencia').addEventListener('click', function () { mostrarPestana('licencia'); });
    document.getElementById('acercaTabNovedades').addEventListener('click', function () { mostrarPestana('novedades'); });
    // Un clic fuera de la ventana NO la cierra (solo la ✕ o Escape): la
    // ventana da un pequeño "toque" para indicar que hay que usar la ✕.
    overlay.addEventListener('click', function (ev) {
      if (ev.target !== overlay) return;
      const box = overlay.querySelector('.acerca-de-box');
      if (box && box.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        box.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && overlay.classList.contains('show')) cerrar();
    });

    // El logo del login y el nombre de la cabecera abren la ventana.
    ['.login-logo', 'header.topbar .brand'].forEach(function (selector) {
      const el = document.querySelector(selector);
      if (!el) return;
      el.classList.add('abre-acerca-de');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('title', 'Acerca de');
      el.addEventListener('click', abrir);
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); }
      });
    });
  }

  window.mostrarModalAcercaDe = abrir;
  window.cerrarModalAcercaDe_ = cerrar;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
