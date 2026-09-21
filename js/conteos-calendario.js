/* SALIDAS · js/conteos-calendario.js — Conteos diarios: calendario */

/* ---------------- CALENDARIO ---------------- */
function cargarCalendario() {
  document.getElementById('selected-pill').textContent = formatearFechaCorta(ESTADO.fecha);
  llamarApi_('getMesCalendario', [ESTADO.anioMes])
    .then(function (dias) {
      renderCalendario(dias);
    })
    .catch(function (err) {
      mostrarErrorServidor(err);
      // A diferencia del toast (que desaparece solo a los 3s), si el
      // calendario se queda sin cargar hay que dejar algo accionable en su
      // sitio -- si no, el "Cargando calendario…" se queda ahí para
      // siempre hasta que el usuario recargue toda la página a mano.
      const body = document.getElementById('calendar-body');
      if (body) {
        body.innerHTML =
          '<div class="loader">' +
            '<span>No se pudo cargar el calendario.</span>' +
            '<button type="button" id="btn-reintentar-calendario" class="modal-cancel" style="padding:6px 14px;">Reintentar</button>' +
          '</div>';
        document.getElementById('btn-reintentar-calendario').onclick = cargarCalendario;
      }
    });
}

function formatearFechaCorta(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return d.getDate() + ' ' + MESES_ES[d.getMonth()].slice(0, 3) + '.';
}

function cambiarMes(delta) {
  const partes = ESTADO.anioMes.split('-').map(Number);
  let anio = partes[0], mes = partes[1] - 1 + delta;
  anio += Math.floor(mes / 12);
  mes = ((mes % 12) + 12) % 12;
  ESTADO.anioMes = anio + '-' + pad2(mes + 1);
  cargarCalendario();
}

function renderCalendario(dias) {
  const body = document.getElementById('calendar-body');
  const partes = ESTADO.anioMes.split('-').map(Number);
  const anio = partes[0], mes = partes[1]; // 1-12
  const primerDiaSemana = new Date(anio, mes - 1, 1).getDay(); // 0=domingo
  // Queremos la semana empezando en lunes:
  const offset = (primerDiaSemana + 6) % 7;

  let celdas = '';
  for (let i = 0; i < offset; i++) celdas += '<div class="cal-day vacio"></div>';

  dias.forEach(function (info) {
    const clases = ['cal-day'];
    if (!info.dia) clases.push('sin-conteo'); else clases.push('estado-' + info.estado);
    if (info.esHoy) clases.push('hoy');
    if (info.fecha === ESTADO.fecha) clases.push('seleccionado');
    if (info.bloqueada) clases.push('bloqueada-futuro');

    let dots = '';
    if (info.tieneNotas) dots += '<span class="dot dot-nota"></span>';
    if (info.tieneCierres) dots += '<span class="dot dot-cierre"></span>';
    if (info.tieneExcepciones) dots += '<span class="dot dot-cambio"></span>';

    const diaNum = Number(info.fecha.slice(8, 10));
    const atrBloqueo = info.bloqueada ? ' disabled title="Todavía no disponible: solo se puede abrir hoy y mañana"' : (info.soloLectura ? ' title="Solo lectura: han pasado más de 2 días"' : '');
    celdas += '<button type="button" class="' + clases.join(' ') + '" data-fecha="' + info.fecha + '"' + atrBloqueo + '>' +
      '<span>' + diaNum + '</span>' +
      '<span class="dots">' + dots + '</span>' +
      '</button>';
  });

  const mesLabel = MESES_ES[mes - 1] + ' de ' + anio;

  body.innerHTML =
    '<div class="calendar-nav">' +
      '<button type="button" id="cal-prev" aria-label="Mes anterior"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="mes-label">' + mesLabel + '</div>' +
      '<button type="button" id="cal-next" aria-label="Mes siguiente"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>' +
    '</div>' +
    '<div class="calendar-weekdays">' + ['L','M','X','J','V','S','D'].map(function (d) { return '<div>' + d + '</div>'; }).join('') + '</div>' +
    '<div class="calendar-grid">' + celdas + '</div>' +
    '<div class="calendar-leyenda">' +
      '<span><span class="sw" style="background:#eef0f3"></span>Pendiente</span>' +
      '<span><span class="sw" style="background:var(--amber)"></span>Parcial</span>' +
      '<span><span class="sw" style="background:var(--ok)"></span>Enviado</span>' +
      '<span><span class="dot dot-nota" style="width:8px;height:8px;"></span>Con notas</span>' +
      '<span><span class="dot dot-cierre" style="width:8px;height:8px;"></span>Con cierres</span>' +
      '<span><span class="dot dot-cambio" style="width:8px;height:8px;"></span>Con cambios</span>' +
    '</div>';

  document.getElementById('cal-prev').onclick = function () { cambiarMes(-1); };
  document.getElementById('cal-next').onclick = function () { cambiarMes(1); };
  body.querySelectorAll('.cal-day[data-fecha]').forEach(function (btn) {
    if (btn.disabled) return;
    btn.onclick = function () { seleccionarFecha(btn.getAttribute('data-fecha')); };
  });
}

function seleccionarFecha(fecha) {
  ESTADO.fecha = fecha;
  ESTADO.anioMes = anioMesDe(fecha);
  ESTADO.colapsadas = new Set();
  cargarCalendario();
  cargarConteoDia();
}
