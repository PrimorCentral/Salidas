/* SALIDAS · js/acerca-de.js — Ventana "Acerca de" al pulsar el logo (login y cabecera) */

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

function mostrarModalAcercaDe() {
  // Si ya hay otro modal abierto (un conteo a medio confirmar, el aviso de
  // actualización...), no se le pisa.
  const overlay = document.getElementById('modal-overlay');
  if (overlay.style.display === 'flex') return;

  const cajaModal = document.getElementById('modal-box');
  cajaModal.classList.remove('ancho', 'medio', 'peligro', 'usuario-form', 'gestor-obs', 'orden-retirada-modal');
  cajaModal.classList.add('acerca-de');

  document.getElementById('modal-title').style.display = 'none';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const version = APP_VERSION_ACTUAL ? 'Versión ' + escapeHtml(APP_VERSION_ACTUAL) : '';
  const d = ACERCA_DE_;

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="acerca-cabecera">' +
      '<div class="acerca-logo">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#f3f4f6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/>' +
          '<circle cx="7.5" cy="18" r="1.6" fill="#f3f4f6" stroke="none"/>' +
          '<circle cx="17.5" cy="18" r="1.6" fill="#f3f4f6" stroke="none"/>' +
        '</svg>' +
      '</div>' +
      '<div class="acerca-nombre">GESTIÓN <span>SALIDAS</span></div>' +
      '<div class="acerca-version" id="acerca-version">' + version + '</div>' +
    '</div>' +
    '<div class="acerca-cuerpo">' +
      '<div class="acerca-campo">' +
        '<span class="lbl">Desarrollado por</span>' +
        '<span class="val">' + escapeHtml(d.autor) + '</span>' +
      '</div>' +
      '<div class="acerca-campo">' +
        '<span class="lbl">Licencia de uso concedida a</span>' +
        '<span class="val">' + escapeHtml(d.licenciatario) + '</span>' +
      '</div>' +
      '<div class="acerca-campo">' +
        '<span class="lbl">Nº de activación</span>' +
        '<span class="acerca-clave">' + escapeHtml(d.activacion) + '</span>' +
        '<span class="acerca-activado">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
          'Producto activado' +
        '</span>' +
      '</div>' +
    '</div>' +
    '<div class="acerca-legal">' +
      '<p class="acerca-copy">© ' + escapeHtml(d.anio) + ' ' + escapeHtml(d.titularDerechos) + '. Todos los derechos reservados.</p>' +
      '<p>Este software está protegido por la legislación sobre propiedad intelectual. La licencia de uso concedida es no exclusiva e intransferible y se limita a la actividad interna del licenciatario.</p>' +
      '<p>Queda prohibida su copia, cesión, distribución, modificación o ingeniería inversa, total o parcial, sin autorización previa y por escrito del autor. Cualquier uso no autorizado podrá dar lugar a las acciones legales correspondientes.</p>' +
    '</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML = '<button class="modal-confirm" id="modal-confirm-btn">Aceptar</button>';
  overlay.style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = cerrarModal;

  // Si al arrancar no se pudo leer version.json (p.ej. sin conexión), se
  // intenta ahora para que la ventana muestre el número igualmente.
  if (!APP_VERSION_ACTUAL) {
    obtenerVersionRemota_().then(function (v) {
      const el = document.getElementById('acerca-version');
      if (v && el) el.textContent = 'Versión ' + v;
    });
  }
}

// El logo del login y el nombre de la cabecera abren la ventana.
(function () {
  ['.login-logo', 'header.topbar .brand'].forEach(function (selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('abre-acerca-de');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('title', 'Acerca de');
    el.addEventListener('click', mostrarModalAcercaDe);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mostrarModalAcercaDe(); }
    });
  });
})();
