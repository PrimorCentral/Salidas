/* SALIDAS · js/acciones-supabase.js — SUPABASE_ACCIONES_: cada acción de la app -> función RPC de Supabase */

// Acciones ya migradas a Supabase: cada entrada es una función
// (args) => resultado (o Promise<resultado>) con la MISMA forma que
// devolvía Apps Script para esa acción, para no tener que tocar el resto
// del archivo. Se va rellenando bloque a bloque -- ver cada sección
// "-- Supabase: <bloque> --" según se va migrando.
const SUPABASE_ACCIONES_ = {
  // -- Supabase: getConteoDia --
  getConteoDia: function (args) {
    const fecha = args[0];
    return llamarRpcSupabase_('get_conteo_dia', { p_fecha: fecha });
  },
  // -- Supabase: enviarPrevisionAgencia / enviarDefinitivoAgencia --
  enviarPrevisionAgencia: function (args) {
    const dia = args[0], nombreAgrupacion = args[1], fecha = args[2];
    return llamarRpcSupabase_('enviar_prevision_agencia', {
      p_dia: dia,
      p_nombre_ruta: nombreAgrupacion,
      p_fecha: fecha
    });
  },
  enviarDefinitivoAgencia: function (args) {
    const dia = args[0], nombreAgrupacion = args[1], fecha = args[2];
    return llamarRpcSupabase_('enviar_definitivo_agencia', {
      p_dia: dia,
      p_nombre_ruta: nombreAgrupacion,
      p_fecha: fecha
    });
  },
  // "Enviar a informática": misma previsión, pero solo a transporte@primor.eu.
  enviarInformaticaAgencia: function (args) {
    const dia = args[0], nombreAgrupacion = args[1], fecha = args[2];
    return llamarRpcSupabase_('enviar_informatica_agencia', {
      p_dia: dia,
      p_nombre_ruta: nombreAgrupacion,
      p_fecha: fecha
    });
  },
  // -- Supabase: getMesCalendario --
  getMesCalendario: function (args) {
    const anioMes = args[0];
    return llamarRpcSupabase_('get_mes_calendario', { p_anio_mes: anioMes });
  },
  // -- Supabase: guardarConteo --
  guardarConteo: function (args) {
    const dia = args[0], filas = args[1], fecha = args[2], nombreAgrupacion = args[3];
    return llamarRpcSupabase_('guardar_conteo', {
      p_dia: dia,
      p_filas: filas,
      p_fecha: fecha,
      p_nombre_agrupacion: nombreAgrupacion
    });
  },
  // -- Supabase: resumen de la pantalla de Inicio (estado del conteo de
  // hoy y de mañana) --
  resumenInicio: function () {
    return llamarRpcSupabase_('get_resumen_inicio', {});
  },
  // -- Supabase: Configuración agencias (Config_Agrupaciones) --
  getAgrupacionesConfig: function () {
    return llamarRpcSupabase_('get_agrupaciones_config', {});
  },
  crearAgrupacionConfig: function (args) {
    return llamarRpcSupabase_('crear_agrupacion_config', { p_nombre: args[0] });
  },
  guardarEmailsAgrupacion: function (args) {
    const agrupacion = args[0], emails = args[1], notas = args[2], emailsPrevision = args[3];
    return llamarRpcSupabase_('guardar_emails_agrupacion', {
      p_agrupacion: agrupacion,
      p_emails: emails,
      p_notas: notas,
      p_emails_prevision: emailsPrevision
    });
  },
  eliminarAgrupacionConfig: function (args) {
    return llamarRpcSupabase_('eliminar_agrupacion_config', { p_agrupacion: args[0] });
  },
  sincronizarAgrupaciones: function () {
    return llamarRpcSupabase_('sincronizar_agrupaciones', {});
  },
  // -- Supabase: Rutas y tiendas (Plantilla) --
  getDiasPlantilla: function () {
    return llamarRpcSupabase_('get_dias_plantilla', {});
  },
  getPlantillaDia: function (args) {
    const dia = args[0];
    return llamarRpcSupabase_('get_plantilla_dia', { p_dia: dia });
  },
  añadirTiendaPlantilla: function (args) {
    const dia = args[0], nombreSeccion = args[1], nombre = args[2], limite = args[3];
    return llamarRpcSupabase_('anadir_tienda_plantilla', {
      p_dia: dia,
      p_nombre_seccion: nombreSeccion,
      p_nombre: nombre,
      p_limite: limite
    });
  },
  // -- Supabase: añadir a una ruta/día una tienda que YA existe en
  // Configuración tiendas (sustituye a añadirTiendaPlantilla como forma de
  // "añadir tienda" desde Rutas y tiendas -- las tiendas nuevas de verdad
  // se dan de alta solo desde Configuración tiendas, ver crearTiendaConfig).
  // limite es un override opcional solo para esa ruta/día: vacío = usa el
  // límite general de la tienda.
  asignarTiendaExistentePlantilla: function (args) {
    const dia = args[0], nombreSeccion = args[1], clave = args[2], limite = args[3];
    return llamarRpcSupabase_('asignar_tienda_existente_plantilla', {
      p_dia: dia,
      p_nombre_seccion: nombreSeccion,
      p_clave: clave,
      p_limite: limite || null
    });
  },
  diasRutaMismoNombre: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('dias_ruta_mismo_nombre', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  eliminarTiendaPlantilla: function (args) {
    const dia = args[0], row = args[1], modo = args[2];
    return llamarRpcSupabase_('eliminar_tienda_plantilla', { p_dia: dia, p_row: row, p_modo: modo || null });
  },
  eliminarTiendaPlantillaTodosDias: function (args) {
    const dia = args[0], row = args[1];
    return llamarRpcSupabase_('eliminar_tienda_plantilla_todos_dias', { p_dia: dia, p_row: row });
  },
  otrasAparicionesTiendaPlantilla: function (args) {
    const dia = args[0], row = args[1];
    return llamarRpcSupabase_('otras_apariciones_tienda_plantilla', { p_dia: dia, p_row: row });
  },
  // -- Supabase: Rutas y tiendas -- mover una tienda a otra agrupación
  // (ruta) del mismo día sin borrarla y volverla a crear, así que no
  // pierde su email/notas de "Configuración tiendas" (eso vive aparte,
  // en config_tiendas, ligado a la "clave" de la tienda, que no cambia).
  moverTiendaAgrupacionPlantilla: function (args) {
    const dia = args[0], row = args[1], destino = args[2];
    return llamarRpcSupabase_('mover_tienda_agrupacion_plantilla', { p_dia: dia, p_row: row, p_nombre_seccion_destino: destino });
  },
  moverTiendaAgrupacionPlantillaTodosDias: function (args) {
    const dia = args[0], row = args[1], destino = args[2];
    return llamarRpcSupabase_('mover_tienda_agrupacion_plantilla_todos_dias', { p_dia: dia, p_row: row, p_nombre_seccion_destino: destino });
  },
  // -- Supabase: Configuración tiendas + Aviso a tiendas (barrido del día) --
  getConfigAvisoTiendas: function () {
    return llamarRpcSupabase_('get_config_aviso_tiendas', {});
  },
  guardarHoraAvisoTiendas: function (args) {
    const dias = args[0]; // [{dia, horaAutomatica, horaLimite}, ...] los 7 días
    return llamarRpcSupabase_('guardar_hora_aviso_tiendas', { p_dias: dias });
  },
  enviarAvisosTiendas: function (args) {
    const fecha = args[0], simulacion = args[1];
    return llamarRpcSupabase_('enviar_avisos_tiendas', { p_fecha: fecha, p_simulacion: simulacion });
  },
  getAvisosEnviadosTiendas: function (args) {
    const fecha = args[0];
    return llamarRpcSupabase_('get_avisos_enviados_tiendas', { p_fecha: fecha });
  },
  // -- Supabase: Cola de trabajo emails (envío de avisos a tiendas a ritmo controlado) --
  getColaEmailsTiendas: function (args) {
    const fecha = args[0];
    return llamarRpcSupabase_('get_cola_emails_tiendas', { p_fecha: fecha || null });
  },
  reintentarEmailCola: function (args) {
    const id = args[0];
    return llamarRpcSupabase_('reintentar_email_cola', { p_id: id });
  },
  reintentarTodosErroresCola: function (args) {
    const fecha = args[0];
    return llamarRpcSupabase_('reintentar_todos_errores_cola', { p_fecha: fecha || null });
  },
  getTiendasConfig: function () {
    return llamarRpcSupabase_('get_tiendas_config', {});
  },
  guardarEmailTienda: function (args) {
    const tienda = args[0], email = args[1], notas = args[2];
    return llamarRpcSupabase_('guardar_email_tienda', { p_tienda: tienda, p_email: email, p_notas: notas });
  },
  guardarTransitoTienda: function (args) {
    const tienda = args[0], transito = args[1];
    return llamarRpcSupabase_('guardar_transito_tienda', { p_tienda: tienda, p_transito: transito });
  },
  // -- Supabase: límite de palets "general" de la tienda (mismo patrón que
  // guardarTransitoTienda) -- se guarda en config_tiendas.limite_palets y
  // se usa en todos los días donde no haya un override propio de ese día.
  guardarLimiteTienda: function (args) {
    const tienda = args[0], limite = args[1];
    return llamarRpcSupabase_('guardar_limite_tienda', { p_tienda: tienda, p_limite: (limite === '' || limite == null) ? null : Number(limite) });
  },
  // -- Supabase: alta de una tienda nueva SOLO en Configuración tiendas
  // (clave + email/notas/tránsito/límite general), sin asignarla todavía a
  // ninguna ruta/día -- queda "SIN USO" hasta que se añade desde Rutas y
  // tiendas con asignarTiendaExistentePlantilla.
  crearTiendaConfig: function (args) {
    const tienda = args[0], email = args[1], notas = args[2], transito = args[3], limite = args[4];
    return llamarRpcSupabase_('crear_tienda_config', {
      p_tienda: tienda,
      p_email: email || null,
      p_notas: notas || null,
      p_transito: transito || 1,
      p_limite: (limite === '' || limite == null) ? null : Number(limite)
    });
  },
  eliminarTiendaConfig: function (args) {
    return llamarRpcSupabase_('eliminar_tienda_config', { p_tienda: args[0] });
  },
  // -- Supabase: renombrar una tienda desde "Configuración tiendas". Se
  // propaga a todas las filas de tiendas_ruta que compartan la clave
  // (o sea, a todos los días donde aparezca esa tienda) y a su fila en
  // config_tiendas. aparicionesTiendaConfig se usa antes, para avisar en
  // cuántos días aparece la tienda que se va a renombrar.
  aparicionesTiendaConfig: function (args) {
    return llamarRpcSupabase_('apariciones_tienda_config', { p_clave: args[0] });
  },
  renombrarTiendaConfig: function (args) {
    const claveActual = args[0], nombreNuevo = args[1];
    return llamarRpcSupabase_('renombrar_tienda_config', { p_clave_actual: claveActual, p_nombre_nuevo: nombreNuevo });
  },
  sincronizarTiendas: function () {
    return llamarRpcSupabase_('sincronizar_tiendas', {});
  },
  buscarPosiblesDuplicadosTiendas: function () {
    return llamarRpcSupabase_('buscar_posibles_duplicados_tiendas', {});
  },
  // -- Supabase: Rutas y tiendas — qué días de la semana recibe entrega
  // cada tienda. Afecta a la fecha de entrega prevista que se calcula al
  // enviar el aviso por email (ver _sumar_dias_habiles /
  // _enviar_avisos_tiendas_interna): los días desmarcados no cuentan como
  // día de entrega válido para esa tienda.
  activarDiaEntregaTienda: function (args) {
    const tienda = args[0], dia = args[1];
    return llamarRpcSupabase_('activar_dia_entrega_tienda', { p_tienda: tienda, p_dia: dia });
  },
  desactivarDiaEntregaTienda: function (args) {
    const tienda = args[0], dia = args[1];
    return llamarRpcSupabase_('desactivar_dia_entrega_tienda', { p_tienda: tienda, p_dia: dia });
  },
  // -- Supabase: Rutas y tiendas — casillas opcionales (PESO / C.EXPRESS / SOBRESTOCK / PDF ESPECIAL) --
  // Las 3 casillas comparten exactamente el mismo patrón en el backend
  // (activar_x_ruta / desactivar_x_ruta, con p_dia + p_nombre_ruta): solo
  // se pedía migrar C.EXPRESS y PDF ESPECIAL, pero PESO usaba el mismo
  // fallback sin configurar (SUPABASE_ACCIONES_ no la tenía todavía) y ya
  // existe como función SQL, así que se aprovecha para dejarla también
  // enganchada aquí mismo.
  activarPesoRuta: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('activar_peso_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  desactivarPesoRuta: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('desactivar_peso_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  activarCExpressRuta: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('activar_cexpress_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  desactivarCExpressRuta: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('desactivar_cexpress_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  activarSobrestockRuta: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('activar_sobrestock_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  desactivarSobrestockRuta: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('desactivar_sobrestock_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  activarPdfEspecial: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('activar_pdf_especial', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  desactivarPdfEspecial: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('desactivar_pdf_especial', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  // -- Supabase: Rutas y tiendas — bloqueo 60/PTA/CART por tienda --
  bloquearCampoTiendaPlantilla: function (args) {
    const dia = args[0], row = args[1], campo = args[2];
    return llamarRpcSupabase_('bloquear_campo_tienda_plantilla', { p_dia: dia, p_row: row, p_campo: campo });
  },
  desbloquearCampoTiendaPlantilla: function (args) {
    const dia = args[0], row = args[1], campo = args[2];
    return llamarRpcSupabase_('desbloquear_campo_tienda_plantilla', { p_dia: dia, p_row: row, p_campo: campo });
  },
  moverTiendaPlantilla: function (args) {
    const dia = args[0], row = args[1], direccion = args[2];
    return llamarRpcSupabase_('mover_tienda_plantilla', { p_dia: dia, p_row: row, p_direccion: direccion });
  },
  moverRutaPlantilla: function (args) {
    const dia = args[0], nombreRuta = args[1], direccion = args[2];
    return llamarRpcSupabase_('mover_ruta_plantilla', { p_dia: dia, p_nombre_ruta: nombreRuta, p_direccion: direccion });
  },
  editarNombreRutaPlantilla: function (args) {
    const dia = args[0], nombreActual = args[1], nombreNuevo = args[2];
    return llamarRpcSupabase_('editar_nombre_ruta_plantilla', { p_dia: dia, p_nombre_actual: nombreActual, p_nombre_nuevo: nombreNuevo });
  },
  añadirNotaCargaPlantilla: function (args) {
    const dia = args[0], nombreRuta = args[1], texto = args[2];
    return llamarRpcSupabase_('anadir_nota_carga_plantilla', { p_dia: dia, p_nombre_ruta: nombreRuta, p_texto: texto });
  },
  eliminarRutaPlantilla: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('eliminar_ruta_plantilla', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  editarNotaCargaPlantilla: function (args) {
    const dia = args[0], row = args[1], texto = args[2];
    return llamarRpcSupabase_('editar_nota_carga_plantilla', { p_dia: dia, p_row: row, p_texto: texto });
  },
  eliminarNotaCargaPlantilla: function (args) {
    const dia = args[0], row = args[1];
    return llamarRpcSupabase_('eliminar_nota_carga_plantilla', { p_dia: dia, p_row: row });
  },
  // Comentario libre de UNA sola tienda (sin grupo ni límite). Si la
  // tienda ya pertenece a un grupo de palets, el backend rechaza la
  // llamada -- ese caso se edita desde "Grupos de palets" de la ruta.
  editarNotaTiendaPlantilla: function (args) {
    const dia = args[0], fila = args[1], texto = args[2];
    return llamarRpcSupabase_('editar_nota_tienda_plantilla', { p_dia: dia, p_row: fila, p_texto: texto });
  },
  // Grupos de palets a nivel de ruta: reemplaza TODOS los grupos de esa
  // ruta de una vez. p_grupos es un array de { texto, limite, tipo, rows }
  // donde "rows" son las tiendas (mismo "row" que el resto de la app) que
  // forman ese grupo; el backend comprueba que todas pertenecen a la ruta.
  establecerGruposLimiteRuta: function (args) {
    const dia = args[0], nombreRuta = args[1], grupos = args[2];
    return llamarRpcSupabase_('set_grupos_limite_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta, p_grupos: grupos });
  },
  // "Quitar en este orden" a nivel de ruta: reemplaza al viejo campo de
  // texto libre por tienda. p_filas es el array de "row" (en el orden en
  // que se deben quitar) de las tiendas elegidas en el modal; el backend
  // comprueba que todas pertenecen a esa misma ruta.
  establecerOrdenRetiradaRuta: function (args) {
    const dia = args[0], nombreRuta = args[1], filas = args[2];
    return llamarRpcSupabase_('set_orden_retirada_ruta', { p_dia: dia, p_nombre_ruta: nombreRuta, p_rows: filas });
  },
  // -- Supabase: Observaciones (notas generales, de agrupación y cierres) --
  guardarObservacion: function (args) {
    const obs = args[0];
    return llamarRpcSupabase_('guardar_observacion', {
      p_fecha: obs.fecha,
      p_dia: obs.dia,
      p_agrupacion: obs.agrupacion,
      p_tienda: obs.tienda,
      p_tipo: obs.tipo,
      p_texto: obs.texto
    });
  },
  eliminarObservacion: function (args) {
    return llamarRpcSupabase_('eliminar_observacion', { p_id: args[0] });
  },
  // -- Supabase: Cambios puntuales de agrupación (excepciones por fecha) --
  guardarExcepcionTienda: function (args) {
    const c = args[0];
    return llamarRpcSupabase_('guardar_excepcion_tienda', {
      p_fecha: c.fecha,
      p_dia: c.dia,
      p_agrupacion_origen: c.agrupacionOrigen,
      p_tienda: c.tienda,
      p_agrupacion_destino: c.agrupacionDestino,
      p_transito: (c.transito != null ? c.transito : null)
    });
  },
  eliminarExcepcionTienda: function (args) {
    return llamarRpcSupabase_('eliminar_excepcion_tienda', { p_id: args[0] });
  },
  // -- Supabase: Administración: Palets forzados --
  getPaletsForzadosAdmin: function (args) {
    const fechaIni = args[0], fechaFin = args[1];
    return llamarRpcSupabase_('get_palets_forzados_admin', { p_fecha_ini: fechaIni, p_fecha_fin: fechaFin });
  },
  añadirRutaPlantilla: function (args) {
    const dia = args[0], nombreRuta = args[1];
    return llamarRpcSupabase_('anadir_ruta_plantilla', { p_dia: dia, p_nombre_ruta: nombreRuta });
  },
  editarTiendaPlantilla: function (args) {
    const dia = args[0], row = args[1], nombre = args[2], limite = args[3];
    return llamarRpcSupabase_('editar_tienda_plantilla', { p_dia: dia, p_row: row, p_nombre: nombre, p_limite: limite });
  },
  // -- Supabase: Administración: Usuarios --
  getUsuarios: function () {
    return llamarRpcSupabase_('get_usuarios', {});
  },
  crearUsuario: function (args) {
    const usuario = args[0], nombreCompleto = args[1], password = args[2], rol = args[3], permisos = args[4];
    return llamarRpcSupabase_('crear_usuario', {
      p_usuario: usuario,
      p_nombre_completo: nombreCompleto,
      p_password: password,
      p_rol: rol,
      p_permisos: permisos || {}
    });
  },
  editarUsuario: function (args) {
    const id = args[0], usuario = args[1], nombreCompleto = args[2], rol = args[3], activo = args[4], permisos = args[5];
    return llamarRpcSupabase_('editar_usuario', {
      p_id: id,
      p_usuario: usuario,
      p_nombre_completo: nombreCompleto,
      p_rol: rol,
      p_activo: activo,
      p_permisos: permisos || {}
    });
  },
  cambiarPasswordUsuario: function (args) {
    const id = args[0], passwordNuevo = args[1];
    return llamarRpcSupabase_('cambiar_password_usuario', { p_id: id, p_password_nuevo: passwordNuevo });
  },
  cambiarMiPassword: function (args) {
    const passwordActual = args[0], passwordNuevo = args[1];
    return llamarRpcSupabase_('cambiar_mi_password', { p_password_actual: passwordActual, p_password_nuevo: passwordNuevo });
  },
  eliminarUsuario: function (args) {
    return llamarRpcSupabase_('eliminar_usuario', { p_id: args[0] });
  }
};
