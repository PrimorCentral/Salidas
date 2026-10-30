/* SALIDAS · js/api.js — Tabla de métodos remotos y llamada genérica a RPC de Supabase */

// Nombre usado en el frontend -> nombre de la acción que entiende el backend.
const METODOS_REMOTOS_ = {
  getMesCalendario: 'getMesCalendario',
  getConteoDia: 'getConteoDia',
  resumenInicio: 'resumenInicio',
  guardarConteo: 'guardarConteo',
  borrarConteoSeccion: 'borrarConteoSeccion',
  deshacerEnvioSeccion: 'deshacerEnvioSeccion',
  enviarPrevisionAgencia: 'enviarPrevisionAgencia',
  enviarDefinitivoAgencia: 'enviarDefinitivoAgencia',
  getListaCarga: 'getListaCarga',
  guardarCargaAjustada: 'guardarCargaAjustada',
  enviarInformaticaAgencia: 'enviarInformaticaAgencia',
  guardarObservacion: 'guardarObservacion',
  editarObservacion: 'editarObservacion',
  editarNotaObservacion: 'editarNotaObservacion',
  eliminarObservacion: 'eliminarObservacion',
  getAgrupacionesConfig: 'getAgrupacionesConfig',
  crearAgrupacionConfig: 'crearAgrupacionConfig',
  guardarEmailsAgrupacion: 'guardarEmailsAgrupacion',
  eliminarAgrupacionConfig: 'eliminarAgrupacionConfig',
  sincronizarAgrupaciones: 'sincronizarAgrupaciones',
  getPlantillaDia: 'getPlantillaDia',
  getDiasPlantilla: 'getDiasPlantilla',
  getDiasEspeciales: 'getDiasEspeciales',
  crearDiaEspecial: 'crearDiaEspecial',
  eliminarDiaEspecial: 'eliminarDiaEspecial',
  editarTiendaPlantilla: 'editarTiendaPlantilla',
  añadirTiendaPlantilla: 'añadirTiendaPlantilla',
  asignarTiendaExistentePlantilla: 'asignarTiendaExistentePlantilla',
  diasRutaMismoNombre: 'diasRutaMismoNombre',
  eliminarTiendaPlantilla: 'eliminarTiendaPlantilla',
  eliminarTiendaPlantillaTodosDias: 'eliminarTiendaPlantillaTodosDias',
  otrasAparicionesTiendaPlantilla: 'otrasAparicionesTiendaPlantilla',
  moverTiendaPlantilla: 'moverTiendaPlantilla',
  colocarTiendaPlantilla: 'colocarTiendaPlantilla',
  colocarTiendaNuevaDias: 'colocarTiendaNuevaDias',
  moverRutaPlantilla: 'moverRutaPlantilla',
  editarNombreRutaPlantilla: 'editarNombreRutaPlantilla',
  añadirRutaPlantilla: 'añadirRutaPlantilla',
  eliminarRutaPlantilla: 'eliminarRutaPlantilla',
  añadirNotaCargaPlantilla: 'añadirNotaCargaPlantilla',
  editarNotaCargaPlantilla: 'editarNotaCargaPlantilla',
  eliminarNotaCargaPlantilla: 'eliminarNotaCargaPlantilla',
  editarNotaTiendaPlantilla: 'editarNotaTiendaPlantilla',
  establecerGruposLimiteRuta: 'establecerGruposLimiteRuta',
  getGruposRutaDias: 'getGruposRutaDias',
  copiarGruposRutaDias: 'copiarGruposRutaDias',
  activarPesoRuta: 'activarPesoRuta',
  desactivarPesoRuta: 'desactivarPesoRuta',
  activarPdfEspecial: 'activarPdfEspecial',
  desactivarPdfEspecial: 'desactivarPdfEspecial',
  activarCExpressRuta: 'activarCExpressRuta',
  desactivarCExpressRuta: 'desactivarCExpressRuta',
  activarSobrestockRuta: 'activarSobrestockRuta',
  desactivarSobrestockRuta: 'desactivarSobrestockRuta',
  activarViernesRuta: 'activarViernesRuta',
  desactivarViernesRuta: 'desactivarViernesRuta',
  excluirViernesTiendaPlantilla: 'excluirViernesTiendaPlantilla',
  incluirViernesTiendaPlantilla: 'incluirViernesTiendaPlantilla',
  activarDomingoRuta: 'activarDomingoRuta',
  desactivarDomingoRuta: 'desactivarDomingoRuta',
  excluirDomingoTiendaPlantilla: 'excluirDomingoTiendaPlantilla',
  incluirDomingoTiendaPlantilla: 'incluirDomingoTiendaPlantilla',
  bloquearCampoTiendaPlantilla: 'bloquearCampoTiendaPlantilla',
  desbloquearCampoTiendaPlantilla: 'desbloquearCampoTiendaPlantilla',
  getTiendasConfig: 'getTiendasConfig',
  guardarEmailTienda: 'guardarEmailTienda',
  guardarTransitoTienda: 'guardarTransitoTienda',
  guardarLimiteTienda: 'guardarLimiteTienda',
  crearTiendaConfig: 'crearTiendaConfig',
  eliminarTiendaConfig: 'eliminarTiendaConfig',
  aparicionesTiendaConfig: 'aparicionesTiendaConfig',
  renombrarTiendaConfig: 'renombrarTiendaConfig',
  sincronizarTiendas: 'sincronizarTiendas',
  enviarAvisosTiendas: 'enviarAvisosTiendas',
  getAvisosEnviadosTiendas: 'getAvisosEnviadosTiendas',
  getUsuarios: 'getUsuarios',
  crearUsuario: 'crearUsuario',
  editarUsuario: 'editarUsuario',
  cambiarPasswordUsuario: 'cambiarPasswordUsuario',
  eliminarUsuario: 'eliminarUsuario'
};

/** Llama a una función RPC de Postgres (Supabase) pasando SIEMPRE el token
 *  de sesión actual como p_token -- mismo patrón que usan las funciones
 *  migradas en el backend (get_conteo_dia, ...), que validan el token
 *  contra la tabla "sesiones" ellas mismas (en vez de depender de
 *  Supabase Auth, que aquí no se usa -- ver loginSupabase_ más arriba).
 *  Si el RPC devuelve el error de sesión caducada, se dispara
 *  volverALogin_() igual que hacía antes sesionCaducada:true en Apps
 *  Script, y además se rechaza la Promise para que el .catch(mostrarErrorServidor)
 *  de turno no muestre un toast duplicado encima del aviso de "vuelve a
 *  entrar". */
function llamarRpcSupabase_(nombreFuncion, argsExtra) {
  if (!supabaseClient) {
    return Promise.reject(new Error('Supabase no está configurado todavía.'));
  }
  const params = Object.assign({ p_token: SESSION_TOKEN }, argsExtra || {});
  // Si el servidor no contesta en 30 s (red caída, wifi del almacén...), se
  // corta la llamada y se da error, para que ningún botón se quede
  // cargando para siempre sin avisar.
  let consulta = supabaseClient.rpc(nombreFuncion, params);
  let temporizador = null;
  let cortada = false;
  if (typeof AbortController === 'function' && consulta && typeof consulta.abortSignal === 'function') {
    const ctrl = new AbortController();
    consulta = consulta.abortSignal(ctrl.signal);
    temporizador = setTimeout(function () { cortada = true; ctrl.abort(); }, 30000);
  }
  return Promise.resolve(consulta).then(function (resp) {
    if (temporizador) clearTimeout(temporizador);
    if (cortada) {
      throw new Error('El servidor no ha respondido. Comprueba la conexión a internet y vuelve a intentarlo.');
    }
    if (resp.error) {
      if (resp.error.message && resp.error.message.indexOf('Sesión caducada') !== -1) {
        volverALogin_();
        return Promise.reject(new Error('')); // ya se ha avisado con el toast de volverALogin_
      }
      throw resp.error;
    }
    return resp.data;
  }, function (err) {
    if (temporizador) clearTimeout(temporizador);
    if (cortada) throw new Error('El servidor no ha respondido. Comprueba la conexión a internet y vuelve a intentarlo.');
    throw err;
  });
}
