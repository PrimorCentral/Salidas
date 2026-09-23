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
  enviarInformaticaAgencia: 'enviarInformaticaAgencia',
  guardarObservacion: 'guardarObservacion',
  eliminarObservacion: 'eliminarObservacion',
  getAgrupacionesConfig: 'getAgrupacionesConfig',
  crearAgrupacionConfig: 'crearAgrupacionConfig',
  guardarEmailsAgrupacion: 'guardarEmailsAgrupacion',
  eliminarAgrupacionConfig: 'eliminarAgrupacionConfig',
  sincronizarAgrupaciones: 'sincronizarAgrupaciones',
  getPlantillaDia: 'getPlantillaDia',
  getDiasPlantilla: 'getDiasPlantilla',
  editarTiendaPlantilla: 'editarTiendaPlantilla',
  añadirTiendaPlantilla: 'añadirTiendaPlantilla',
  asignarTiendaExistentePlantilla: 'asignarTiendaExistentePlantilla',
  diasRutaMismoNombre: 'diasRutaMismoNombre',
  eliminarTiendaPlantilla: 'eliminarTiendaPlantilla',
  eliminarTiendaPlantillaTodosDias: 'eliminarTiendaPlantillaTodosDias',
  otrasAparicionesTiendaPlantilla: 'otrasAparicionesTiendaPlantilla',
  moverTiendaPlantilla: 'moverTiendaPlantilla',
  moverRutaPlantilla: 'moverRutaPlantilla',
  editarNombreRutaPlantilla: 'editarNombreRutaPlantilla',
  añadirRutaPlantilla: 'añadirRutaPlantilla',
  eliminarRutaPlantilla: 'eliminarRutaPlantilla',
  añadirNotaCargaPlantilla: 'añadirNotaCargaPlantilla',
  editarNotaCargaPlantilla: 'editarNotaCargaPlantilla',
  eliminarNotaCargaPlantilla: 'eliminarNotaCargaPlantilla',
  editarNotaTiendaPlantilla: 'editarNotaTiendaPlantilla',
  establecerGruposLimiteRuta: 'establecerGruposLimiteRuta',
  activarPesoRuta: 'activarPesoRuta',
  desactivarPesoRuta: 'desactivarPesoRuta',
  activarPdfEspecial: 'activarPdfEspecial',
  desactivarPdfEspecial: 'desactivarPdfEspecial',
  activarCExpressRuta: 'activarCExpressRuta',
  desactivarCExpressRuta: 'desactivarCExpressRuta',
  activarSobrestockRuta: 'activarSobrestockRuta',
  desactivarSobrestockRuta: 'desactivarSobrestockRuta',
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
  return supabaseClient.rpc(nombreFuncion, params).then(function (resp) {
    if (resp.error) {
      if (resp.error.message && resp.error.message.indexOf('Sesión caducada') !== -1) {
        volverALogin_();
        return Promise.reject(new Error('')); // ya se ha avisado con el toast de volverALogin_
      }
      throw resp.error;
    }
    return resp.data;
  });
}
