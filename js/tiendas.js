/* SALIDAS · js/tiendas.js — Configuración: tiendas y aviso a tiendas */

/* ---------------- CONFIGURACIÓN: "Configuración tiendas" y "Aviso a tiendas" ----------------
 * Dos páginas relacionadas pero separadas:
 * - "Configuración tiendas" (renderConfigTiendas): igual patrón que "Emails
 *   agencias" (Config_Agrupaciones), pero sobre Config_Tiendas: email de
 *   cada tienda para el aviso de "barrido de día" y días de la semana en
 *   que recibe entrega (L M X J V S D, usado para calcular la fecha
 *   prevista del aviso).
 * - "Configuración hora aviso tiendas" (renderConfigHoraAvisoTiendas, dentro
 *   de Configuración): solo para admin, la config de horas del barrido
 *   automático por día de la semana.
 * - "Simulación envío tiendas" (renderSimulacionAvisoTiendas, dentro de
 *   Administración): solo para admin, el panel para lanzar el barrido a
 *   mano: envía a cada tienda con palets asignados ese día un correo con el
 *   total y la fecha de entrega calculada (24H/48H/72H según el marcador
 *   "*"/"^" de su nombre — ver detectarPlazoTienda_ en el backend).
 * Requiere en Code.gs: getTiendasConfig, guardarEmailTienda,
 * eliminarTiendaConfig, sincronizarTiendas y enviarAvisosTiendas.
 */
let TIENDAS_CONFIG_ESTADO = { datos: [], filtroTexto: '', soloSinUso: false, soloNueva: false, soloSinEmail: false };
let BARRIDO_TIENDAS_ESTADO = { fecha: null, resultado: null, resultadoFecha: null, simulado: false };
// Días de la semana para la config del barrido automático, numerados en
// ISO (1=lunes ... 7=domingo, igual que extract(isodow from fecha) en
// Postgres) para que casen directo con dia_semana en config_aviso_tiendas_dias.
const DIAS_SEMANA_AVISO = [
  { num: 1, nombre: 'Lunes' },
  { num: 2, nombre: 'Martes' },
  { num: 3, nombre: 'Miércoles' },
  { num: 4, nombre: 'Jueves' },
  { num: 5, nombre: 'Viernes' },
  { num: 6, nombre: 'Sábado' },
  { num: 7, nombre: 'Domingo' }
];
// Horas entre las que se intenta el envío automático del aviso a
// tiendas, UNA config independiente por día de la semana (ver
// getConfigAvisoTiendas/guardarHoraAvisoTiendas en el backend).
// dias[n] = { hora, horaLimite } para el día ISO n (1=lunes..7=domingo).
//   hora        -> primer barrido (obligatoria para que el automático esté activo ese día)
//   horaLimite  -> último barrido de seguridad (opcional):
//                    - vacía: el automático dispara UNA sola vez ese día, en cuanto
//                      se alcanza "hora". Conteos que se pongan después ese día ya no
//                      se avisan solos, hay que usar los botones de abajo.
//                    - rellena: el automático se repite cada ~15 min mientras
//                      "hora" <= ahora <= "horaLimite", avisando a las tiendas
//                      que se van poniendo listas en esa ventana. Pasada
//                      "horaLimite" no se envía nada más automáticamente ese día.
let HORA_AVISO_TIENDAS_ESTADO = { dias: {}, cargando: false };
// NOTA: antes había aquí un intento de calcular "ya avisadas hoy" por
// diferencia (total de tiendas activas menos la suma de los bloques del
// resultado), asumiendo que toda tienda activa aparece siempre en algún
// bloque. Esa suposición era falsa (hay tiendas activas que ese día ni
// siquiera tienen ruta en el cuadrante -- se filtran por día de la semana
// en enviar_avisos_tiendas -- así que tampoco aparecen en ningún bloque
// sin haber sido avisadas) y daba un número incorrecto. Se sustituyó por
// get_avisos_enviados_tiendas(p_fecha, p_token), un RPC nuevo en Supabase
// que consulta directamente la tabla avisos_enviados_tiendas (la misma
// que usa enviar_avisos_tiendas para saber a quién saltarse), así que el
// dato es exacto.
function cargarAvisosEnviadosTiendas_(fecha) {
  return llamarApi_('getAvisosEnviadosTiendas', [fecha]).catch(function () {
    return null; // si falla, sencillamente no se muestra el dato extra
  });
}

function htmlConfigHoraAvisoTiendasCard_() {
  return (
    '<div class="vista-card" id="config-hora-aviso-tiendas-card" style="margin-bottom:16px;">' +
      '<div class="vista-card-header"><h2>Configuración hora aviso tiendas</h2></div>' +
      '<p>Configura, para cada día de la semana, a partir de qué hora se intenta el envío automático del aviso a tiendas (barrido del día) y, opcionalmente, hasta qué hora se sigue reintentando. La vista previa y el envío manual están en <b>Simulación envío tiendas</b>.</p>' +
      '<div class="barrido-dias-tabla-wrap" id="barrido-hora-automatica-fila">' +
        '<table class="barrido-dias-tabla">' +
          '<thead><tr><th>Día</th><th>Primer barrido a partir de</th><th>Último barrido de seguridad (opcional)</th><th></th><th></th></tr></thead>' +
          '<tbody>' +
            DIAS_SEMANA_AVISO.map(function (d) {
              const cfg = HORA_AVISO_TIENDAS_ESTADO.dias[d.num] || {};
              const esSabado = d.num === 6;
              const adelantaDomingo = !!cfg.offsetDias;
              return (
                '<tr data-dia="' + d.num + '">' +
                  '<td class="barrido-dia-nombre">' + d.nombre + '</td>' +
                  '<td><input type="time" id="barrido-hora-automatica-' + d.num + '" value="' + escapeAttr(cfg.hora || '') + '"></td>' +
                  '<td><input type="time" id="barrido-hora-limite-' + d.num + '" value="' + escapeAttr(cfg.horaLimite || '') + '"></td>' +
                  '<td>' + (esSabado ?
                    '<button type="button" class="barrido-sabado-domingo-toggle' + (adelantaDomingo ? ' activo' : '') + '" id="barrido-sabado-avisa-domingo" data-activo="' + (adelantaDomingo ? '1' : '0') + '" title="Si lo activas, el barrido automático del sábado avisa también de las rutas de domingo (además de las del propio sábado, si las hubiera), porque el domingo la tienda está cerrada y no vería el email hasta el lunes.">Avisar también del Domingo</button>'
                    : '') +
                  '</td>' +
                  '<td><button type="button" class="barrido-dia-quitar" data-dia="' + d.num + '" title="Borra las horas de ' + d.nombre + ' (deja ese día en solo manual, no afecta a los demás días)">Borrar horas</button></td>' +
                '</tr>'
              );
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +
      '<div class="admin-filtros">' +
        '<button type="button" class="btn-admin-buscar" id="btn-guardar-hora-aviso">Guardar horas</button>' +
      '</div>' +
      '<div class="barrido-hora-nota">' +
        '<p><b>Cómo funciona el barrido automático</b></p>' +
        '<ul>' +
          '<li>Cada 15 min la app comprueba las horas configuradas para el día de la semana en curso.</li>' +
          '<li>Si dejas vacío el <b>último barrido de seguridad</b> de un día, el envío se dispara <b>una sola vez</b> en cuanto se alcanza el <b>primer barrido</b>: los conteos que se pongan después ese día ya no se avisan solos (hace falta el botón manual de <b>Simulación envío tiendas</b>).</li>' +
          '<li>Si rellenas también el <b>último barrido</b>, la comprobación se repite cada ~15 min entre esas dos horas, avisando a las tiendas que se van poniendo listas según se guardan más conteos durante esa ventana. Pasado el último barrido, ese día no se envía nada más en automático.</li>' +
          '<li>Cada tienda solo recibe su aviso una vez al día, se mande por el camino que se mande.</li>' +
          '<li>Deja ambos campos de un día en blanco (o pulsa <b>Borrar horas</b>) para que ese día el envío sea siempre manual.</li>' +
        '</ul>' +
        '<p><b>Por qué existe «Avisar también del Domingo» en la fila de Sábado</b></p>' +
        '<ul>' +
          '<li>Las rutas de domingo son operativamente de domingo: el conteo, los envíos a la agencia y el histórico se manejan con fecha de domingo.</li>' +
          '<li>Pero ese día la tienda está cerrada, así que un aviso enviado en domingo no lo verían hasta el lunes.</li>' +
          '<li>Con el toggle activado en la fila de <b>Sábado</b>, el barrido automático del sábado avisa por adelantado de esas rutas de domingo (con el conteo que haya hasta ese momento), además de las rutas propias del sábado si algún día las hubiera.</li>' +
          '<li>El barrido del propio <b>Domingo</b> se sigue lanzando igual y sirve de repaso de seguridad: como es idempotente, solo avisa a las tiendas que se quedaron sin aviso el sábado (conteo puesto tarde, sábado en solo-manual, etc.), sin duplicar avisos a las que ya se avisaron.</li>' +
        '</ul>' +
      '</div>' +
    '</div>'
  );
}

function vincularConfigHoraAvisoTiendas_() {
  const btnGuardarHora = document.getElementById('btn-guardar-hora-aviso');
  if (btnGuardarHora) btnGuardarHora.onclick = function () { guardarHoraAvisoTiendas_(); };
  // Un botón "Quitar" por fila de día: limpia solo los dos inputs de ese
  // día y guarda ya (mismo RPC que "Guardar horas", que siempre manda la
  // config de los 7 días juntos).
  document.querySelectorAll('.barrido-dia-quitar').forEach(function (btn) {
    btn.onclick = function () {
      const dia = btn.getAttribute('data-dia');
      const input = document.getElementById('barrido-hora-automatica-' + dia);
      const inputLimite = document.getElementById('barrido-hora-limite-' + dia);
      if (input) input.value = '';
      if (inputLimite) inputLimite.value = '';
      guardarHoraAvisoTiendas_();
    };
  });
  // Toggle "Avisar también del Domingo" (solo fila Sábado):
  // cambia su estado visual y guarda ya, igual que "Quitar".
  const btnSabadoDomingo = document.getElementById('barrido-sabado-avisa-domingo');
  if (btnSabadoDomingo) {
    btnSabadoDomingo.onclick = function () {
      const activo = btnSabadoDomingo.getAttribute('data-activo') === '1';
      const nuevoActivo = !activo;
      btnSabadoDomingo.setAttribute('data-activo', nuevoActivo ? '1' : '0');
      btnSabadoDomingo.classList.toggle('activo', nuevoActivo);
      guardarHoraAvisoTiendas_(
        nuevoActivo
          ? 'Activado: el barrido del sábado avisará también de las rutas de domingo'
          : 'Desactivado: el barrido del sábado ya no avisa de las rutas de domingo'
      );
    };
  }
  cargarHoraAvisoTiendas_();
}

/** Trae de Supabase las horas configuradas para el aviso automático a
 *  tiendas (una config por día de la semana) y rellena los inputs (solo
 *  los que el admin no ha tocado ya a mano mientras se cargaba). */
function cargarHoraAvisoTiendas_() {
  if (HORA_AVISO_TIENDAS_ESTADO.cargando) return;
  HORA_AVISO_TIENDAS_ESTADO.cargando = true;
  llamarApi_('getConfigAvisoTiendas', [])
    .then(function (dias) {
      HORA_AVISO_TIENDAS_ESTADO.cargando = false;
      const nuevoDias = {};
      (dias || []).forEach(function (d) {
        nuevoDias[d.dia] = {
          hora: d.horaAutomatica || '',
          horaLimite: d.horaLimite || '',
          offsetDias: d.offsetDias || 0
        };
      });
      HORA_AVISO_TIENDAS_ESTADO.dias = nuevoDias;
      DIAS_SEMANA_AVISO.forEach(function (d) {
        const cfg = nuevoDias[d.num] || { hora: '', horaLimite: '', offsetDias: 0 };
        const input = document.getElementById('barrido-hora-automatica-' + d.num);
        if (input && document.activeElement !== input) input.value = cfg.hora;
        const inputLimite = document.getElementById('barrido-hora-limite-' + d.num);
        if (inputLimite && document.activeElement !== inputLimite) inputLimite.value = cfg.horaLimite;
      });
      const btnSabadoDomingo = document.getElementById('barrido-sabado-avisa-domingo');
      if (btnSabadoDomingo) {
        const adelantaDomingo = !!(nuevoDias[6] && nuevoDias[6].offsetDias);
        btnSabadoDomingo.setAttribute('data-activo', adelantaDomingo ? '1' : '0');
        btnSabadoDomingo.classList.toggle('activo', adelantaDomingo);
      }
    })
    .catch(function (err) {
      HORA_AVISO_TIENDAS_ESTADO.cargando = false;
      mostrarErrorServidor(err);
    });
}

/** Guarda de golpe las horas de los 7 días (o las borra en el día que se
 *  haya dejado vacío, dejando el envío automático desactivado solo ese
 *  día). */
function guardarHoraAvisoTiendas_(mensajePersonalizado) {
  const btn = document.getElementById('btn-guardar-hora-aviso');
  const btnSabadoDomingo = document.getElementById('barrido-sabado-avisa-domingo');
  const dias = DIAS_SEMANA_AVISO.map(function (d) {
    const input = document.getElementById('barrido-hora-automatica-' + d.num);
    const inputLimite = document.getElementById('barrido-hora-limite-' + d.num);
    return {
      dia: d.num,
      horaAutomatica: input ? input.value : '',
      horaLimite: inputLimite ? inputLimite.value : '',
      offsetDias: (d.num === 6 && !!btnSabadoDomingo && btnSabadoDomingo.getAttribute('data-activo') === '1') ? 1 : 0
    };
  });
  if (btn) btn.disabled = true;
  llamarApi_('guardarHoraAvisoTiendas', [dias])
    .then(function () {
      if (btn) btn.disabled = false;
      const nuevoDias = {};
      let diasActivos = 0;
      dias.forEach(function (d) {
        nuevoDias[d.dia] = { hora: d.horaAutomatica, horaLimite: d.horaLimite, offsetDias: d.offsetDias };
        if (d.horaAutomatica) diasActivos++;
      });
      HORA_AVISO_TIENDAS_ESTADO.dias = nuevoDias;
      mostrarToast(
        mensajePersonalizado ||
        (diasActivos === 0
          ? 'Envío automático desactivado (solo manual todos los días)'
          : 'Horas guardadas: ' + diasActivos + (diasActivos === 1 ? ' día con' : ' días con') + ' barrido automático')
      );
    })
    .catch(function (err) {
      if (btn) btn.disabled = false;
      mostrarErrorServidor(err);
    });
}

function htmlSimulacionAvisoTiendasCard_() {
  return (
    '<div class="vista-card" id="barrido-tiendas-card" style="margin-bottom:16px;">' +
      '<div class="vista-card-header"><h2>Simulación envío tiendas</h2></div>' +
      '<p>Envía a cada tienda un correo (texto simple) con los palets que va a recibir, calculando la fecha de entrega según su plazo (24H / 48H / 72H, detectado por el nombre de la tienda). Solo se avisa a las tiendas con palets asignados, no cerradas y con el conteo ya puesto (algún dato guardado en su fila, se haya enviado o no la previsión/definitivo a la agencia), con email configurado en Configuración tiendas. La vista previa de abajo se calcula sola al entrar aquí (y al cambiar de fecha), sin necesidad de pulsar nada. Los envíos reales (manuales o automáticos, ver Configuración hora aviso tiendas) no se mandan al instante: se encolan y se van enviando solos a un ritmo máximo de 30/min (ver Cola de avisos a tiendas).</p>' +
      '<div class="admin-filtros">' +
        '<div class="admin-filtro-campo"><label>Fecha del conteo</label><input type="date" id="barrido-fecha" value="' + BARRIDO_TIENDAS_ESTADO.fecha + '"></div>' +
        '<button type="button" class="btn-admin-buscar" id="btn-barrido-preview">Vista previa</button>' +
        '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-barrido-enviar">Enviar avisos reales</button>' +
      '</div>' +
      '<div id="barrido-resultado"></div>' +
    '</div>'
  );
}

function vincularSimulacionAvisoTiendas_() {
  const fechaInput = document.getElementById('barrido-fecha');
  if (fechaInput) {
    fechaInput.addEventListener('change', function (e) {
      if (!e.target.value) return;
      BARRIDO_TIENDAS_ESTADO.fecha = e.target.value;
      ejecutarBarridoTiendas_(true, true); // vista previa automática al cambiar de fecha, sin toast
    });
  }
  const btnPreview = document.getElementById('btn-barrido-preview');
  if (btnPreview) btnPreview.onclick = function () { ejecutarBarridoTiendas_(true); };
  const btnEnviar = document.getElementById('btn-barrido-enviar');
  if (btnEnviar) {
    btnEnviar.onclick = function () {
      appConfirm(
        'Enviar avisos reales',
        'Vas a encolar un correo real para cada tienda con palets asignados el ' + formatearFechaLarga(BARRIDO_TIENDAS_ESTADO.fecha) + '. Se irán enviando solos en los próximos minutos (máx. 30/min) y no se puede deshacer. ¿Seguro que quieres continuar?',
        function () { ejecutarBarridoTiendas_(false); }
      );
    };
  }
  // Al abrir la página, vista previa automática: así se ve de un vistazo si
  // hay tiendas ya avisadas hoy en un envío anterior, sin tener que pulsar
  // nada. Si ya había un resultado en memoria para esta misma fecha (por
  // ejemplo, al volver de otra pestaña de Configuración), se reutiliza en
  // vez de repetir la llamada.
  if (BARRIDO_TIENDAS_ESTADO.resultado && BARRIDO_TIENDAS_ESTADO.resultadoFecha === BARRIDO_TIENDAS_ESTADO.fecha) {
    pintarResultadoBarridoTiendas_();
  } else {
    ejecutarBarridoTiendas_(true, true);
  }
}

function ejecutarBarridoTiendas_(simulacion, silencioso) {
  const resEl = document.getElementById('barrido-resultado');
  const btnPreview = document.getElementById('btn-barrido-preview');
  const btnEnviar = document.getElementById('btn-barrido-enviar');
  if (btnPreview) btnPreview.disabled = true;
  if (btnEnviar) btnEnviar.disabled = true;
  if (resEl) resEl.innerHTML = '<div class="loader">' + (simulacion ? 'Calculando vista previa…' : 'Encolando correos…') + '</div>';

  const fechaSolicitada = BARRIDO_TIENDAS_ESTADO.fecha;
  llamarApi_('enviarAvisosTiendas', [fechaSolicitada, simulacion])
    .then(function (resultado) {
      if (btnPreview) btnPreview.disabled = false;
      if (btnEnviar) btnEnviar.disabled = false;
      BARRIDO_TIENDAS_ESTADO.resultado = resultado;
      BARRIDO_TIENDAS_ESTADO.resultadoFecha = fechaSolicitada;
      BARRIDO_TIENDAS_ESTADO.simulado = simulacion;
      pintarResultadoBarridoTiendas_();
      if (!silencioso) {
        mostrarToast(simulacion
          ? 'Vista previa: ' + resultado.enviados.length + ' se enviarían'
          : resultado.enviados.length + ' correo(s) encolado(s), se irán enviando a un ritmo máx. de 30/min');
      }
    })
    .catch(function (err) {
      if (btnPreview) btnPreview.disabled = false;
      if (btnEnviar) btnEnviar.disabled = false;
      if (resEl) resEl.innerHTML = '';
      mostrarErrorServidor(err);
    });
}

function pintarResultadoBarridoTiendas_() {
  const resEl = document.getElementById('barrido-resultado');
  if (!resEl) return;
  const r = BARRIDO_TIENDAS_ESTADO.resultado;
  if (!r) { resEl.innerHTML = ''; return; }
  const fecha = BARRIDO_TIENDAS_ESTADO.resultadoFecha;

  function listaColapsable(titulo, items, render) {
    if (!items.length) return '';
    return (
      '<details class="barrido-detalle">' +
        '<summary>' + titulo + ' (' + items.length + ')</summary>' +
        '<ul>' + items.map(render).join('') + '</ul>' +
      '</details>'
    );
  }

  cargarAvisosEnviadosTiendas_(fecha).then(function (yaAvisadas) {
    // El resultado puede haber cambiado (otra fecha, otro clic) mientras se
    // cargaba: si ya no es el que estamos pintando, no lo sobrescribas.
    if (BARRIDO_TIENDAS_ESTADO.resultado !== r) return;

    resEl.innerHTML =
      '<div class="barrido-resumen">' +
        '<div class="barrido-chip ok">' + r.enviados.length + (BARRIDO_TIENDAS_ESTADO.simulado ? ' se enviarían' : ' enviados') + '</div>' +
        (yaAvisadas ? '<div class="barrido-chip' + (yaAvisadas.length ? ' info' : '') + '" title="Tiendas que ya recibieron su aviso real hoy en un envío anterior (dato real de la tabla avisos_enviados_tiendas).">' + yaAvisadas.length + ' ya avisadas hoy</div>' : '') +
        '<div class="barrido-chip">' + (r.pendientesDeOtrasRutas ? r.pendientesDeOtrasRutas.length : 0) + ' sin conteo guardado</div>' +
        '<div class="barrido-chip">' + r.sinEmail.length + ' sin email</div>' +
        '<div class="barrido-chip">' + r.sinPalets.length + ' sin palets</div>' +
        '<div class="barrido-chip">' + r.cerradas.length + ' cerradas</div>' +
        (r.errores.length ? '<div class="barrido-chip error">' + r.errores.length + ' con error</div>' : '') +
      '</div>' +
      listaColapsable(BARRIDO_TIENDAS_ESTADO.simulado ? 'Se enviarían' : 'Encolados (se enviarán a 30/min)', r.enviados, function (it) {
        return '<li>' + escapeHtml(it.tienda) + ' — ' + it.total + ' palet(s) — entrega ' + formatearFechaLarga(it.fechaEntrega) + ' — ' + escapeHtml(it.email) + '</li>';
      }) +
      listaColapsable('Ya avisadas hoy (envío anterior)', yaAvisadas || [], function (it) {
        return '<li>' + escapeHtml(it.tienda) + ' — ' + it.total + ' palet(s) — enviado a las ' + formatearHoraCorta_(it.enviadoEn) + ' — ' + escapeHtml(it.email) + '</li>';
      }) +
      listaColapsable('Sin conteo guardado', r.pendientesDeOtrasRutas || [], function (t) { return '<li>' + escapeHtml(t) + '</li>'; }) +
      listaColapsable('Sin email configurado', r.sinEmail, function (t) { return '<li>' + escapeHtml(t) + '</li>'; }) +
      listaColapsable('Sin palets ese día', r.sinPalets, function (t) { return '<li>' + escapeHtml(t) + '</li>'; }) +
      listaColapsable('Cerradas ese día', r.cerradas, function (t) { return '<li>' + escapeHtml(t) + '</li>'; }) +
      listaColapsable('Errores de envío', r.errores, function (it) { return '<li>' + escapeHtml(it.tienda) + ' — ' + escapeHtml(it.error) + '</li>'; });

    ajustarAlturaListaScrollable_('barrido-resultado');
  });
}

/** Formatea un timestamp ISO (con hora) a "HH:MM" en hora local del
 *  navegador. Usado solo para el listado de "Ya avisadas hoy". */
function formatearHoraCorta_(isoTimestamp) {
  if (!isoTimestamp) return '—';
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return '—';
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/** Página "Configuración hora aviso tiendas": solo la tabla de horas por
 *  día de la semana del barrido automático, separada de "Simulación envío
 *  tiendas" para que cada pantalla se vea más despejada. Solo admin puede
 *  tocarlo; para quien no lo sea, se muestra un aviso de solo lectura. */
function renderConfigHoraAvisoTiendas() {
  const cont = document.getElementById('config-contenido');
  if (!cont) return;

  cont.innerHTML = tienePermiso('config_hora_aviso_tiendas')
    ? htmlConfigHoraAvisoTiendasCard_()
    : (
      '<div class="vista-card">' +
        '<div class="vista-card-header"><h2>Configuración hora aviso tiendas</h2></div>' +
        '<div class="emails-config-solo-lectura">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
          'Solo lectura: entra con la contraseña de administrador para poder configurar las horas del barrido.' +
        '</div>' +
      '</div>'
    );

  if (tienePermiso('config_hora_aviso_tiendas')) vincularConfigHoraAvisoTiendas_();
}

/** Página "Simulación envío tiendas": el panel del barrido del día (vista
 *  previa y envío real del correo con los palets que recibe cada tienda).
 *  Solo admin puede lanzarlo; para quien no lo sea, se muestra un aviso de
 *  solo lectura. */
function renderSimulacionAvisoTiendas() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;
  if (!BARRIDO_TIENDAS_ESTADO.fecha) BARRIDO_TIENDAS_ESTADO.fecha = hoyStr();

  cont.innerHTML = tienePermiso('aviso_tiendas')
    ? htmlSimulacionAvisoTiendasCard_()
    : (
      '<div class="vista-card">' +
        '<div class="vista-card-header"><h2>Simulación envío tiendas</h2></div>' +
        '<div class="emails-config-solo-lectura">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
          'Solo lectura: entra con la contraseña de administrador para poder lanzar el barrido y enviar avisos.' +
        '</div>' +
      '</div>'
    );

  if (tienePermiso('aviso_tiendas')) vincularSimulacionAvisoTiendas_();
  ajustarAlturaListaScrollable_('barrido-resultado');
  window.addEventListener('resize', ajustarAlturasListasConfig_debounced_);
}

function renderConfigTiendas() {
  const cont = document.getElementById('config-contenido');
  if (!cont) return;

  TIENDAS_CONFIG_ESTADO.soloSinUso = false;
  TIENDAS_CONFIG_ESTADO.soloNueva = false;
  TIENDAS_CONFIG_ESTADO.soloSinEmail = false;
  TIENDAS_CONFIG_ESTADO.filtroTexto = '';

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="emails-config-fijo">' +
        '<div class="vista-card-header">' +
          '<h2>Configuración tiendas <span class="tiendas-config-total" id="tiendas-config-total"></span><span class="tiendas-config-total nueva-toggle" id="tiendas-config-nueva" title="Mostrar solo las tiendas nuevas (falta email)"></span><span class="tiendas-config-total sinuso-toggle" id="tiendas-config-sinuso" title="Mostrar solo las tiendas sin uso"></span><span class="tiendas-config-total sinemail-toggle" id="tiendas-config-sinemail" title="Mostrar solo las tiendas sin ningún email configurado"></span></h2>' +
          '<div class="vista-card-header-acciones">' +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-exportar-pdf-tiendas" title="Exporta la lista visible (respeta el buscador y los filtros) a PDF">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
              'PDF</button>' +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-exportar-excel-tiendas" title="Exporta la lista visible (respeta el buscador y los filtros) a Excel (CSV)">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
              'Excel</button>' +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-duplicados-tiendas" title="Compara los nombres de todas las tiendas para detectar la misma tienda escrita de forma distinta algún día">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
              'Buscar posibles duplicados</button>' +
            '<button type="button" class="btn-sincronizar-agrupaciones" id="btn-sincronizar-tiendas" title="Vuelve a recorrer todas las hojas de día y añade las tiendas nuevas / marca las que ya no se usan">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
              'Buscar y sincronizar cambios de tiendas</button>' +
          '</div>' +
        '</div>' +
        '<p>Email de cada tienda, usado para avisarle por correo de los palets que va a recibir cuando se hace el barrido del día. Marca con L M X J V S D los días de la semana en que cada tienda recibe entrega, para que la fecha prevista del aviso sea correcta.</p>' +
        (tienePermiso('tiendas') ? '' :
          '<div class="emails-config-solo-lectura">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
            'Solo lectura: entra con la contraseña de administrador para poder editar, borrar o enviar avisos.' +
          '</div>') +
        '<div class="emails-config-toolbar">' +
          '<div class="emails-config-busqueda">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
            '<input type="text" id="tiendas-config-buscar" placeholder="Buscar tienda o email…">' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="tiendas-config-lista"><div class="loader">Cargando…</div></div>' +
    '</div>';

  document.getElementById('btn-sincronizar-tiendas').onclick = sincronizarTiendasDesdeApp_;
  document.getElementById('btn-duplicados-tiendas').onclick = buscarDuplicadosTiendas_;
  document.getElementById('btn-exportar-pdf-tiendas').onclick = exportarTiendasConfigPDF_;
  document.getElementById('btn-exportar-excel-tiendas').onclick = exportarTiendasConfigExcel_;

  let temporizadorBusquedaTiendas = null;
  document.getElementById('tiendas-config-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusquedaTiendas);
    const valor = e.target.value;
    temporizadorBusquedaTiendas = setTimeout(function () {
      TIENDAS_CONFIG_ESTADO.filtroTexto = valor.trim().toLowerCase();
      pintarListaTiendas_();
    }, 200);
  });

  cargarTiendasConfig_();
  ajustarAlturaListaScrollable_('tiendas-config-lista');
  window.addEventListener('resize', ajustarAlturasListasConfig_debounced_);
}

/** Actualiza los contadores junto al título de "Configuración tiendas":
 *  nº total, nº "sin uso", nº "nueva" (falta email) y nº "sin email"
 *  (ninguna tienda con el campo Email relleno, aunque no esté marcada
 *  como "Nueva", para que no se escape ninguna). Los tres badges son
 *  clicables: alternan un filtro que muestra solo esas tiendas, y son
 *  excluyentes entre sí. */
function actualizarTotalTiendasConfig_() {
  const elTotal = document.getElementById('tiendas-config-total');
  const elSinUso = document.getElementById('tiendas-config-sinuso');
  const elNueva = document.getElementById('tiendas-config-nueva');
  const elSinEmail = document.getElementById('tiendas-config-sinemail');
  if (!elTotal || !elSinUso || !elNueva || !elSinEmail) return;

  const total = TIENDAS_CONFIG_ESTADO.datos.length;
  elTotal.textContent = total + (total === 1 ? ' tienda' : ' tiendas');

  const sinUso = TIENDAS_CONFIG_ESTADO.datos.filter(function (it) {
    return /^SIN USO/i.test(it.estado || '');
  }).length;
  const nueva = TIENDAS_CONFIG_ESTADO.datos.filter(function (it) {
    return /^NUEVA/i.test(it.estado || '');
  }).length;
  const sinEmail = TIENDAS_CONFIG_ESTADO.datos.filter(function (it) {
    return !it.email || !it.email.trim();
  }).length;

  elSinUso.textContent = sinUso + ' sin uso';
  elNueva.textContent = nueva + ' nueva' + (nueva === 1 ? '' : 's');
  elSinEmail.textContent = sinEmail + ' sin email';
  if (sinUso === 0) TIENDAS_CONFIG_ESTADO.soloSinUso = false;
  if (nueva === 0) TIENDAS_CONFIG_ESTADO.soloNueva = false;
  if (sinEmail === 0) TIENDAS_CONFIG_ESTADO.soloSinEmail = false;
  elSinUso.classList.toggle('activo', TIENDAS_CONFIG_ESTADO.soloSinUso);
  elNueva.classList.toggle('activo', TIENDAS_CONFIG_ESTADO.soloNueva);
  elSinEmail.classList.toggle('activo', TIENDAS_CONFIG_ESTADO.soloSinEmail);

  elSinUso.onclick = function () {
    TIENDAS_CONFIG_ESTADO.soloSinUso = !TIENDAS_CONFIG_ESTADO.soloSinUso;
    if (TIENDAS_CONFIG_ESTADO.soloSinUso) { TIENDAS_CONFIG_ESTADO.soloNueva = false; TIENDAS_CONFIG_ESTADO.soloSinEmail = false; }
    elSinUso.classList.toggle('activo', TIENDAS_CONFIG_ESTADO.soloSinUso);
    elNueva.classList.remove('activo');
    elSinEmail.classList.remove('activo');
    pintarListaTiendas_();
    ajustarAlturaListaScrollable_('tiendas-config-lista');
  };

  elNueva.onclick = function () {
    TIENDAS_CONFIG_ESTADO.soloNueva = !TIENDAS_CONFIG_ESTADO.soloNueva;
    if (TIENDAS_CONFIG_ESTADO.soloNueva) { TIENDAS_CONFIG_ESTADO.soloSinUso = false; TIENDAS_CONFIG_ESTADO.soloSinEmail = false; }
    elNueva.classList.toggle('activo', TIENDAS_CONFIG_ESTADO.soloNueva);
    elSinUso.classList.remove('activo');
    elSinEmail.classList.remove('activo');
    pintarListaTiendas_();
    ajustarAlturaListaScrollable_('tiendas-config-lista');
  };

  elSinEmail.onclick = function () {
    TIENDAS_CONFIG_ESTADO.soloSinEmail = !TIENDAS_CONFIG_ESTADO.soloSinEmail;
    if (TIENDAS_CONFIG_ESTADO.soloSinEmail) { TIENDAS_CONFIG_ESTADO.soloSinUso = false; TIENDAS_CONFIG_ESTADO.soloNueva = false; }
    elSinEmail.classList.toggle('activo', TIENDAS_CONFIG_ESTADO.soloSinEmail);
    elSinUso.classList.remove('activo');
    elNueva.classList.remove('activo');
    pintarListaTiendas_();
    ajustarAlturaListaScrollable_('tiendas-config-lista');
  };
}

/** Exporta a PDF la lista de tiendas visible en ese momento (respeta el
 *  buscador y los badges "sin uso" / "nueva" / "sin email" activos), con
 *  columnas Tienda, Email, Tránsito y Nota. Usa jsPDF + autoTable, ya
 *  cargados por CDN en el <head> para los PDFs de conteo. */
function exportarTiendasConfigPDF_() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarErrorServidor({ message: 'No se pudo cargar el generador de PDF.' });
    return;
  }
  const jsPDF = window.jspdf.jsPDF;
  const items = obtenerTiendasConfigFiltradas_();

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'p' });
  doc.setFontSize(13);
  doc.text('Configuración tiendas', 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(items.length + ' tienda' + (items.length === 1 ? '' : 's') + ' — ' + hoyStr(), 14, 20);
  doc.setTextColor(0);

  doc.autoTable({
    startY: 25,
    head: [['Tienda', 'Email', 'Tránsito', 'Nota']],
    body: items.map(function (it) {
      return [it.tienda || '', it.email || '', transitoTextoTienda_(it.transito), it.notas || ''];
    }),
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 55 },
      2: { cellWidth: 20 },
      3: { cellWidth: 'auto' }
    }
  });

  doc.save('tiendas_' + hoyStr() + '.pdf');
}

/** Exporta a Excel (CSV con BOM y ; como separador, para que Excel en
 *  español lo abra bien de un doble clic) la misma lista visible que la
 *  exportación a PDF, con las mismas columnas. */
function exportarTiendasConfigExcel_() {
  const items = obtenerTiendasConfigFiltradas_();
  const filas = [['Tienda', 'Email', 'Tránsito', 'Nota']].concat(items.map(function (it) {
    return [it.tienda || '', it.email || '', transitoTextoTienda_(it.transito), it.notas || ''];
  }));

  const csv = filas.map(function (fila) {
    return fila.map(function (campo) {
      return '"' + String(campo == null ? '' : campo).replace(/"/g, '""') + '"';
    }).join(';');
  }).join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tiendas_' + hoyStr() + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function cargarTiendasConfig_() {
  if (ESTADO.vista !== 'configuracion' || ESTADO_CONFIG.seccionActiva !== 'tiendas') return;
  llamarApi_('getTiendasConfig', [])
    .then(function (datos) {
      if (ESTADO.vista !== 'configuracion' || ESTADO_CONFIG.seccionActiva !== 'tiendas') return;
      TIENDAS_CONFIG_ESTADO.datos = datos || [];
      pintarListaTiendas_();
      actualizarTotalTiendasConfig_();
      ajustarAlturaListaScrollable_('tiendas-config-lista');
    })
    .catch(function (err) {
      mostrarErrorServidor(err);
      const listaEl = document.getElementById('tiendas-config-lista');
      if (listaEl) listaEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar la lista.</div>';
    });
}

/** Aplica el buscador y los badges (sin uso / nueva / sin email) activos en
 *  TIENDAS_CONFIG_ESTADO sobre TIENDAS_CONFIG_ESTADO.datos. Centralizado
 *  aquí para que la lista en pantalla y las exportaciones a PDF/Excel
 *  muestren siempre exactamente lo mismo. */
function obtenerTiendasConfigFiltradas_() {
  const filtro = TIENDAS_CONFIG_ESTADO.filtroTexto;
  return TIENDAS_CONFIG_ESTADO.datos.filter(function (it) {
    if (TIENDAS_CONFIG_ESTADO.soloSinUso && !/^SIN USO/i.test(it.estado || '')) return false;
    if (TIENDAS_CONFIG_ESTADO.soloNueva && !/^NUEVA/i.test(it.estado || '')) return false;
    if (TIENDAS_CONFIG_ESTADO.soloSinEmail && (it.email && it.email.trim())) return false;
    if (!filtro) return true;
    const texto = (it.tienda + ' ' + it.email + ' ' + (it.notas || '')).toLowerCase();
    return texto.indexOf(filtro) !== -1;
  });
}

/** Texto legible ("48h (2d)") para el valor numérico (1-5) de tránsito,
 *  reutilizando las mismas etiquetas que el desplegable de la lista. */
function transitoTextoTienda_(valor) {
  const op = TRANSITO_OPCIONES.filter(function (o) { return o.valor === Number(valor || 1); })[0];
  return op ? op.texto : TRANSITO_OPCIONES[0].texto;
}

function pintarListaTiendas_() {
  const listaEl = document.getElementById('tiendas-config-lista');
  if (!listaEl) return;

  const items = obtenerTiendasConfigFiltradas_();

  if (!items.length) {
    listaEl.innerHTML =
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>' +
        (TIENDAS_CONFIG_ESTADO.soloSinUso
          ? 'Ninguna tienda sin uso coincide con la búsqueda.'
          : (TIENDAS_CONFIG_ESTADO.soloNueva
            ? 'Ninguna tienda nueva coincide con la búsqueda.'
            : (TIENDAS_CONFIG_ESTADO.soloSinEmail
              ? 'Ninguna tienda sin email coincide con la búsqueda.'
              : (TIENDAS_CONFIG_ESTADO.datos.length ? 'Ninguna tienda coincide con la búsqueda.' : 'Todavía no hay tiendas en Config_Tiendas. Usa "Buscar y sincronizar cambios de tiendas" para traerlas de las hojas de día.')))) +
      '</div>';
    return;
  }

  listaEl.innerHTML = items.map(function (it, idx) {
    const esNueva = /^NUEVA/i.test(it.estado || '');
    const esSinUso = /^SIN USO/i.test(it.estado || '');
    const esSinEmail = !esNueva && !(it.email && it.email.trim());
    const clase = 'emails-config-item' + (esNueva ? ' nueva' : (esSinUso ? ' sinuso' : (esSinEmail ? ' sinemail' : '')));
    const badge = esNueva
      ? '<span class="emails-config-badge nueva">Nueva — falta email</span>'
      : (esSinUso ? '<span class="emails-config-badge sinuso">Sin uso</span>'
        : (esSinEmail ? '<span class="emails-config-badge sinemail">Sin email</span>' : ''));
    const idSeguro = 'tc' + idx;
    const dias = it.dias || {};
    const DIAS_FILA = [
      { clave: 'lunes', letra: 'L' },
      { clave: 'martes', letra: 'M' },
      { clave: 'miercoles', letra: 'X' },
      { clave: 'jueves', letra: 'J' },
      { clave: 'viernes', letra: 'V' },
      { clave: 'sabado', letra: 'S' },
      { clave: 'domingo', letra: 'D' }
    ];
    const diasConteo = it.diasConteo || [];
    const agrupaciones = it.agrupaciones || [];
    const filaDias =
      '<div class="emails-config-fila-info">' +
        '<div class="emails-config-fila-info-col">' +
          '<div class="emails-config-dias-etiqueta">Configuración días de entregas de palets</div>' +
          '<div class="emails-config-dias">' +
            DIAS_FILA.map(function (d) {
              const activo = !!dias[d.clave];
              return '<button type="button" class="emails-config-dia' + (activo ? ' activo' : '') +
                '" data-dia-tienda="' + escapeAttr(it.tienda) + '" data-dia="' + d.clave +
                '" title="' + (activo ? 'Recibe entrega en ' : 'No recibe entrega en ') + d.clave +
                '" ' + (tienePermiso('tiendas') ? '' : 'disabled') + '>' + d.letra + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="emails-config-fila-info-col">' +
          '<div class="emails-config-dias-etiqueta">Configurada en los conteos del</div>' +
          '<div class="emails-config-dias-conteo">' +
            (diasConteo.length ? diasConteo.map(escapeHtml).join(', ') : '—') +
          '</div>' +
        '</div>' +
        '<div class="emails-config-fila-info-col">' +
          '<div class="emails-config-dias-etiqueta">Agrupación configurada</div>' +
          '<div class="emails-config-dias-conteo">' +
            (agrupaciones.length ? agrupaciones.map(escapeHtml).join(', ') : '—') +
          '</div>' +
        '</div>' +
      '</div>';
    return (
      '<div class="' + clase + '">' +
        '<div class="emails-config-cabecera">' +
          '<span class="emails-config-nombre-wrap">' +
            '<span class="emails-config-nombre">' + escapeHtml(it.tienda) + '</span>' +
            (tienePermiso('tiendas') ?
              '<button type="button" class="emails-config-renombrar" title="Cambiar el nombre de esta tienda" data-renombrar="' + escapeAttr(it.tienda) + '">' +
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
              '</button>' : '') +
          '</span>' +
          '<span class="emails-config-acciones-derecha">' +
            badge +
            '<button type="button" class="emails-config-borrar" title="' + (esSinUso ? 'Eliminar de la configuración' : 'No se puede eliminar: esta tienda está activa en el cuadrante de algún día') + '" data-borrar="' + escapeAttr(it.tienda) + '" ' + (esSinUso ? '' : 'disabled') + '>' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>' +
            '</button>' +
          '</span>' +
        '</div>' +
        filaDias +
        '<div class="emails-config-campos">' +
          '<div class="emails-config-campo">' +
            '<label>Email</label>' +
            '<input type="text" id="' + idSeguro + '_email" value="' + escapeAttr(it.email || '') + '" placeholder="tienda@ejemplo.com" ' + (tienePermiso('tiendas') ? '' : 'disabled') + '>' +
          '</div>' +
          '<div class="emails-config-campo">' +
            '<label>Notas</label>' +
            '<input type="text" id="' + idSeguro + '_notas" value="' + escapeAttr(it.notas || '') + '" placeholder="Notas libres (opcional)" ' + (tienePermiso('tiendas') ? '' : 'disabled') + '>' +
          '</div>' +
          '<div class="emails-config-campo">' +
            '<label>Tránsito</label>' +
            '<select class="emails-config-transito" data-transito-tienda="' + escapeAttr(it.tienda) + '" ' + (tienePermiso('tiendas') ? '' : 'disabled') + '>' +
              TRANSITO_OPCIONES.map(function (op) {
                return '<option value="' + op.valor + '"' + (Number(it.transito || 1) === op.valor ? ' selected' : '') + '>' + op.texto + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="emails-config-pie">' +
          '<button type="button" class="emails-config-guardar" data-guardar="' + escapeAttr(it.tienda) + '" data-id="' + idSeguro + '">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>' +
            'Guardar</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  listaEl.querySelectorAll('[data-guardar]').forEach(function (btn) {
    btn.onclick = function () { guardarEmailTienda_(btn.getAttribute('data-guardar'), btn.getAttribute('data-id'), btn); };
  });
  listaEl.querySelectorAll('[data-borrar]').forEach(function (btn) {
    btn.onclick = function () {
      if (btn.disabled) return;
      confirmarEliminarTiendaConfig_(btn.getAttribute('data-borrar'));
    };
  });
  listaEl.querySelectorAll('[data-renombrar]').forEach(function (btn) {
    btn.onclick = function () { abrirModalRenombrarTiendaConfig_(btn.getAttribute('data-renombrar')); };
  });
  listaEl.querySelectorAll('[data-dia-tienda]').forEach(function (btn) {
    btn.onclick = function () {
      toggleDiaEntregaTienda_(btn.getAttribute('data-dia-tienda'), btn.getAttribute('data-dia'), btn);
    };
  });
  listaEl.querySelectorAll('[data-transito-tienda]').forEach(function (sel) {
    sel.onchange = function () { guardarTransitoTienda_(sel.getAttribute('data-transito-tienda'), sel); };
  });
}

/** Opciones del selector de tránsito en "Configuración tiendas". Sustituye
 *  al viejo sistema de poner "*" (48H) o "^" (72H) al final del nombre de
 *  la tienda: ahora el tránsito se guarda como campo propio en
 *  config_tiendas.transito_dias (1 a 5) y se lee desde ahí en las
 *  pantallas de conteo, en vez de parsearlo del nombre. */
var TRANSITO_OPCIONES = [
  { valor: 1, texto: '24h (1d)' },
  { valor: 2, texto: '48h (2d)' },
  { valor: 3, texto: '72h (3d)' },
  { valor: 4, texto: '96h (4d)' },
  { valor: 5, texto: '120h (5d)' }
];

function guardarTransitoTienda_(tienda, sel) {
  const valorAnterior = sel.getAttribute('data-valor-anterior') || sel.value;
  sel.disabled = true;
  llamarApi_('guardarTransitoTienda', [tienda, Number(sel.value)])
    .then(function () {
      sel.setAttribute('data-valor-anterior', sel.value);
      sel.disabled = false;
      mostrarToast('Tránsito guardado');
    })
    .catch(function (err) {
      sel.value = valorAnterior;
      sel.disabled = false;
      mostrarErrorServidor(err);
    });
}

function toggleDiaEntregaTienda_(tienda, dia, btn) {
  const activarAhora = !btn.classList.contains('activo');
  btn.disabled = true;
  llamarApi_(activarAhora ? 'activarDiaEntregaTienda' : 'desactivarDiaEntregaTienda', [tienda, dia])
    .then(function () {
      cargarTiendasConfig_();
    })
    .catch(function (err) {
      btn.disabled = false;
      mostrarErrorServidor(err);
    });
}

function guardarEmailTienda_(tienda, idSeguro, btn) {
  const email = document.getElementById(idSeguro + '_email').value;
  const notas = document.getElementById(idSeguro + '_notas').value;
  btn.disabled = true;
  llamarApi_('guardarEmailTienda', [tienda, email, notas])
    .then(function () {
      mostrarToast('Email guardado');
      cargarTiendasConfig_();
    })
    .catch(function (err) {
      btn.disabled = false;
      mostrarErrorServidor(err);
    });
}

/** Modal para cambiar el nombre de una tienda desde "Configuración
 *  tiendas". Antes de mostrar el formulario, consulta en cuántos días
 *  (hojas de ruta activas) aparece esa tienda, para avisar de que el
 *  cambio se propagará a todas ellas -- igual que ya pasaba al renombrar
 *  desde "Rutas y tiendas (plantilla)". */
function abrirModalRenombrarTiendaConfig_(claveActual) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Cambiar nombre de tienda';
  document.getElementById('modal-text').style.display = 'block';
  document.getElementById('modal-text').textContent = 'Consultando en cuántos días aparece…';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label for="modal-tienda-nombre-nuevo">Nombre nuevo</label>' +
      '<input type="text" id="modal-tienda-nombre-nuevo" value="' + escapeAttr(claveActual) + '">' +
    '</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn" disabled>Cambiar nombre</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;

  llamarApi_('aparicionesTiendaConfig', [claveActual])
    .then(function (resultado) {
      const total = (resultado && resultado.total) || 0;
      const dias = (resultado && resultado.dias) || [];
      const ORDEN_DIAS_SEMANA = ['LUNES', 'MARTES', 'MIERCOLES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'SÁBADO', 'DOMINGO'];
      const diasOrdenados = dias.slice().sort(function (a, b) {
        const ia = ORDEN_DIAS_SEMANA.indexOf(String(a).toUpperCase());
        const ib = ORDEN_DIAS_SEMANA.indexOf(String(b).toUpperCase());
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      document.getElementById('modal-text').textContent = total > 0
        ? 'Esta tienda aparece en los conteos de ' + total + (total === 1 ? ' día' : ' días') +
          (diasOrdenados.length ? ' (' + diasOrdenados.join(', ') + ')' : '') +
          '. Si le cambias el nombre, también se cambiará en todos esos días.'
        : 'Esta tienda no aparece actualmente en ningún día de las hojas de ruta activas.';
      const btn = document.getElementById('modal-confirm-btn');
      if (btn) btn.disabled = false;
    })
    .catch(function (err) {
      document.getElementById('modal-text').textContent = '';
      mostrarErrorServidor(err);
    });

  document.getElementById('modal-confirm-btn').onclick = function () {
    const input = document.getElementById('modal-tienda-nombre-nuevo');
    const nombreNuevo = input.value.trim();
    if (!nombreNuevo) { input.focus(); return; }
    const btn = document.getElementById('modal-confirm-btn');
    btn.disabled = true;
    llamarApi_('renombrarTiendaConfig', [claveActual, nombreNuevo])
      .then(function (resultado) {
        cerrarModal();
        const propagadas = (resultado && resultado.propagadas) || 0;
        mostrarToast('Nombre actualizado' + (propagadas ? ' en ' + propagadas + (propagadas === 1 ? ' sitio' : ' sitios') : ''));
        cargarTiendasConfig_();
      })
      .catch(function (err) { btn.disabled = false; mostrarErrorServidor(err); });
  };
  setTimeout(function () { document.getElementById('modal-tienda-nombre-nuevo').focus(); document.getElementById('modal-tienda-nombre-nuevo').select(); }, 50);
}

function confirmarEliminarTiendaConfig_(tienda) {
  const it = TIENDAS_CONFIG_ESTADO.datos.find(function (d) { return d.tienda === tienda; });
  const esSinUso = !it || /^SIN USO/i.test(it.estado || '');
  if (!esSinUso) {
    mostrarToast('No se puede eliminar: esta tienda está activa en el cuadrante de algún día.');
    return;
  }
  appConfirm(
    'Eliminar de la configuración',
    '¿Seguro que quieres eliminar "' + tienda + '" de Config_Tiendas?',
    function () { eliminarTiendaConfig_(tienda); }
  );
}

function eliminarTiendaConfig_(tienda) {
  llamarApi_('eliminarTiendaConfig', [tienda])
    .then(function () {
      mostrarToast('Eliminado');
      cargarTiendasConfig_();
    })
    .catch(mostrarErrorServidor);
}

function sincronizarTiendasDesdeApp_() {
  const btn = document.getElementById('btn-sincronizar-tiendas');
  if (btn) { btn.classList.add('girando'); btn.disabled = true; }
  llamarApi_('sincronizarTiendas', [])
    .then(function (resultado) {
      if (btn) { btn.classList.remove('girando'); btn.disabled = false; }
      const nuevas = (resultado && resultado.nuevas) || [];
      const huerfanas = (resultado && resultado.huerfanas) || [];
      mostrarToast(!nuevas.length && !huerfanas.length
        ? 'Todo al día: no hay cambios'
        : nuevas.length + ' nueva(s), ' + huerfanas.length + ' sin uso');
      cargarTiendasConfig_();
    })
    .catch(function (err) {
      if (btn) { btn.classList.remove('girando'); btn.disabled = false; }
      mostrarErrorServidor(err);
    });
}

/** Compara por similitud de texto todas las claves de tiendas y muestra
 * en un modal las que se parecen mucho entre sí, para detectar la misma
 * tienda escrita de forma distinta algún día (espacios, guiones,
 * tildes...). El backend (buscar_posibles_duplicados_tiendas, con
 * pg_trgm) hace la comparación; aquí solo se pinta el resultado. */
function buscarDuplicadosTiendas_() {
  const btn = document.getElementById('btn-duplicados-tiendas');
  if (btn) { btn.classList.add('girando'); btn.disabled = true; }
  llamarApi_('buscarPosiblesDuplicadosTiendas', [])
    .then(function (pares) {
      if (btn) { btn.classList.remove('girando'); btn.disabled = false; }
      mostrarModalDuplicadosTiendas_(pares || []);
    })
    .catch(function (err) {
      if (btn) { btn.classList.remove('girando'); btn.disabled = false; }
      mostrarErrorServidor(err);
    });
}

function mostrarModalDuplicadosTiendas_(pares) {
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Posibles tiendas duplicadas';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML = !pares.length
    ? '<div class="modal-envio-ok">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
        '<span>No se ha encontrado ningún nombre sospechosamente parecido.</span>' +
      '</div>'
    : '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">Estos nombres se parecen mucho entre sí. Si son la misma tienda, corrige el nombre en "Rutas y tiendas" el día que esté distinto, para que quede igual todos los días.</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        pares.map(function (p) {
          return '<div style="border:1px solid var(--line);border-radius:9px;padding:9px 11px;">' +
            '<div style="font-weight:700;font-size:13px;color:var(--navy);">' + escapeHtml(p.tienda1) + '</div>' +
            '<div style="font-weight:700;font-size:13px;color:var(--navy);">' + escapeHtml(p.tienda2) + '</div>' +
            '<div style="font-size:11px;color:var(--ink-soft);margin-top:3px;">Coincidencia: ' + Math.round(p.similitud * 100) + '%</div>' +
          '</div>';
        }).join('') +
      '</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML = '<button class="modal-confirm" id="modal-confirm-btn">Cerrar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-confirm-btn').onclick = cerrarModal;
}
