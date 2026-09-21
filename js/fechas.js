/* SALIDAS · js/fechas.js — Helpers de fechas y reloj de la barra superior */

// La PWA siempre arranca en la pantalla de login: SESSION_TOKEN nunca se
// recupera de un arranque anterior (ver comentario más arriba), así que
// aquí no hace falta comprobar nada más: #login-screen ya está visible
// por defecto en el HTML.

/* ---------------- FECHAS HELPERS ---------------- */
function hoyStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function pad2(n) { return String(n).padStart(2, '0'); }
/** "2026-08-10" -> "10-08-2026". Si no viene en ese formato, se devuelve tal cual. */
function fechaDDMMYYYY_(fecha) {
  if (!fecha) return fecha;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? (m[3] + '-' + m[2] + '-' + m[1]) : fecha;
}
/** Timestamp ISO/con zona ("2026-08-08 17:31:00.013218+00") -> "08-08-2026 17:31",
 *  en la hora local del navegador. Devuelve '' si no hay fecha. */
function fechaHoraDDMMYYYY_(fechaHora) {
  if (!fechaHora) return '';
  const d = new Date(fechaHora);
  if (isNaN(d.getTime())) return fechaHora;
  return pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function anioMesDe(fecha) { return fecha.slice(0, 7); }

/** Reloj en vivo de la cabecera: "11/08/2026  -  21:42:23h", hora local
 *  del navegador, actualizado cada segundo. */
function actualizarRelojTopbar_() {
  const el = document.getElementById('topbar-reloj');
  if (!el) return;
  const d = new Date();
  const fecha = pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  const hora = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  el.textContent = fecha + '  -  ' + hora + 'h';
}
actualizarRelojTopbar_();
setInterval(actualizarRelojTopbar_, 1000);
function formatearFechaLarga(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return DIAS_SEMANA_ES[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES_ES[d.getMonth()] + ' de ' + d.getFullYear();
}
