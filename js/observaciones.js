/* SALIDAS · js/observaciones.js — Observaciones: guardar y eliminar */

/* ---------------- OBSERVACIONES ---------------- */
function guardarObservacionYRecargar(obs) {
  llamarApi_('guardarObservacion', [obs])
    .then(function () {
      mostrarToast('Guardado');
      if (document.getElementById('dia-contenido')) {
        cargarConteoDia();
        cargarCalendario();
      }
      if (ESTADO.vista === 'administracion' && ESTADO_ADMIN.seccionActiva === 'festivos') {
        cargarFestivos();
      }
    })
    .catch(mostrarErrorServidor);
}

function eliminarObservacionYRecargar(id) {
  llamarApi_('eliminarObservacion', [id])
    .then(function () {
      mostrarToast('Eliminado');
      cargarConteoDia();
      cargarCalendario();
    })
    .catch(mostrarErrorServidor);
}
