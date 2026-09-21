/* SALIDAS · js/estado.js — Constantes de fechas y objeto ESTADO global */

/* ---------------- ESTADO ---------------- */
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS_SEMANA_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_SEMANA_CORTO_ES = ['D','L','M','X','J','V','S'];

let ESTADO = {
  vista: null,          // 'inicio' | 'conteos' | 'configuracion'
  fecha: null,          // 'YYYY-MM-DD' seleccionada
  anioMes: null,        // 'YYYY-MM' mostrado en el calendario
  calendarioColapsado: true,
  colapsadas: new Set(), // nombres de agrupación colapsadas manualmente (persiste al recargar el día)
  datosDiaActual: null  // último `data` completo de getConteoDia recibido (secciones, notasGenerales…);
                         // se usa para construir la hoja de impresión manual bajo demanda, sin re-pedirlo al servidor.
};
