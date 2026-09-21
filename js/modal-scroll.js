/* SALIDAS · js/modal-scroll.js — Bloquea el scroll del fondo con un modal abierto y desactiva el clic derecho */
// Cada modal de la app abre/cierra poniendo display:flex/none en
// #modal-overlay directamente (no hay una única función "abrirModal").
// Para no tener que tocar cada punto donde se abre un modal, se
// observa ese cambio de estilo aquí y se bloquea el scroll del
// fondo (body) mientras cualquier modal esté visible.
(function () {
  const overlay = document.getElementById('modal-overlay');
  function sincronizar() {
    const visible = getComputedStyle(overlay).display !== 'none';
    document.body.classList.toggle('modal-abierto', visible);
  }
  new MutationObserver(sincronizar).observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] });
  sincronizar();
})();
// El menú contextual del navegador (clic derecho) tampoco debería
// aparecer dentro de la app: se desactiva en toda la página.
document.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
