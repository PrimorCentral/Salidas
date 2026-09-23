/* SALIDAS · js/usuarios.js — Administración: Usuarios y "Mi usuario" */

/* ---------------- ADMINISTRACIÓN: "Usuarios" ----------------
 * CRUD de las cuentas que pueden entrar en la app (tabla "usuarios" en
 * Supabase): usuario/contraseña, nombre completo (el que se muestra en la
 * topbar), rol (admin/operario) y permisos finos (jsonb, solo aplica a
 * Operarios -- ver CATALOGO_PERMISOS). El backend (verificar_permiso en
 * Supabase) es quien realmente aplica estos permisos en cada función RPC;
 * lo que se hace aquí en el cliente además de guardarlos es usarlos para
 * enseñar u ocultar secciones del menú (ver aplicarPermisosUI_).
 * Solo admin ve esta sección (todo el menú "Administración" ya está oculto
 * por CSS para quien no lo sea). El backend (crear_usuario / editar_usuario
 * / eliminar_usuario) protege además que siempre quede al menos un
 * administrador activo, así que no hace falta duplicar esa comprobación
 * aquí en el cliente. */
let ADMIN_USUARIOS_ESTADO = { datos: null, filtroTexto: '' };

/** Catálogo de permisos finos que se le pueden dar a un Operario. Cada
 *  "clave" tiene que coincidir exactamente con la que usa verificar_permiso
 *  en Supabase (ver crear_verificar_permiso / permiso_*.sql) — si se añade
 *  un permiso nuevo en el backend, hay que añadirlo aquí también para que
 *  se pueda activar/desactivar desde este formulario. Los Administradores
 *  siempre tienen acceso a todo (verificar_permiso los deja pasar sin
 *  mirar esta lista), así que este bloque solo se muestra para Operarios. */
const CATALOGO_PERMISOS = [
  {
    grupo: 'Gestión general',
    items: [
      { clave: 'notas', etiqueta: 'Notas y observaciones', desc: 'Añadir y quitar notas en la cuadrícula de conteos diarios.' },
      { clave: 'cierres', etiqueta: 'Cerrar y reabrir tiendas', desc: 'Marcar tiendas como cerradas o reabrirlas en la cuadrícula de conteos.' },
      { clave: 'ver_cuadrante_completo', etiqueta: 'Ver cuadrante completo', desc: 'Ver los conteos de fechas lejanas (más allá de hoy + 1 día) con todos los datos, igual que un administrador, en vez de la versión reducida (solo tiendas y cierres, sin límites, celdas de conteo ni plazos de entrega).' },
    ],
  },
  {
    grupo: 'Envíos a agencias',
    items: [
      { clave: 'enviar_prevision', etiqueta: 'Enviar previsión', desc: 'Enviar por email la previsión de una agrupación a la agencia de transporte (el conteo sigue siendo editable).' },
      { clave: 'enviar_definitivo', etiqueta: 'Enviar definitivo', desc: 'Enviar por email el definitivo de una agrupación a la agencia de transporte (queda bloqueada y archivada).' },
      { clave: 'enviar_informatica', etiqueta: 'Enviar a informática', desc: 'Enviar por email la previsión de carga de una agrupación solo a transporte@primor.eu (el conteo sigue siendo editable).' },
    ],
  },
  {
    grupo: 'Diseño (configuración)',
    items: [
      { clave: 'tiendas', etiqueta: 'Configuración de tiendas', desc: 'Editar email y notas de cada tienda, días de entrega y sincronizar tiendas.' },
      { clave: 'plantilla', etiqueta: 'Rutas y tiendas (plantilla)', desc: 'Límites, nombres, bloqueos y notas de carga de la plantilla de rutas y tiendas.' },
      { clave: 'agencias', etiqueta: 'Agencias y emails', desc: 'Editar emails y notas de cada agrupación de rutas, y sincronizar agrupaciones.' },
      { clave: 'config_hora_aviso_tiendas', etiqueta: 'Configuración hora aviso tiendas', desc: 'Configurar, día a día, la hora a partir de la cual se dispara el aviso automático a tiendas (y la hora límite de reintento, si la hay).' },
    ],
  },
  {
    grupo: 'Administración',
    items: [
      { clave: 'usuarios', etiqueta: 'Gestión de usuarios', desc: 'Crear, editar, eliminar y cambiar la contraseña de otros usuarios.' },
      { clave: 'festivos', etiqueta: 'Cierres y cambios', desc: 'Cierres, notas y cambios puntuales de agrupación a nivel de día completo (no de una tienda o ruta concreta).' },
      { clave: 'palets_forzados', etiqueta: 'Palets forzados', desc: 'Ver el histórico de palets forzados manualmente.' },
      { clave: 'cola_emails', etiqueta: 'Cola de avisos a tiendas', desc: 'Ver la cola de envíos a tiendas y reintentar los que hayan fallado.' },
      { clave: 'aviso_tiendas', etiqueta: 'Simulación envío tiendas', desc: 'Lanzar la vista previa del barrido del día y el envío manual real de avisos a tiendas.' },
    ],
  },
];

/** Devuelve el HTML de la cuadrícula de permisos, con las casillas ya
 *  marcadas según `permisosActuales` (objeto { clave: true/false, ... }
 *  tal cual viene/va en la columna jsonb "permisos" de la tabla usuarios). */
function renderPermisosCheckboxes_(permisosActuales) {
  const permisos = permisosActuales || {};
  return '<div class="permisos-grupos">' +
    CATALOGO_PERMISOS.map(function (grupo) {
      return '<div class="permiso-grupo">' +
        '<h4>' + escapeHtml(grupo.grupo) + '</h4>' +
        grupo.items.map(function (item) {
          const id = 'permiso-' + item.clave;
          const marcado = permisos[item.clave] ? ' checked' : '';
          return '<div class="permiso-item">' +
            '<input type="checkbox" id="' + id + '" data-permiso-clave="' + escapeAttr(item.clave) + '"' + marcado + '>' +
            '<div class="permiso-item-textos">' +
              '<label class="permiso-item-etiqueta" for="' + id + '">' + escapeHtml(item.etiqueta) + '</label>' +
              '<div class="permiso-item-desc">' + escapeHtml(item.desc) + '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('') +
  '</div>';
}

/** Lee las casillas marcadas del formulario y devuelve el objeto de
 *  permisos { clave: true, ... } listo para mandar a crear_usuario /
 *  editar_usuario (solo se incluyen las que están marcadas). */
function leerPermisosMarcados_(custom) {
  const permisos = {};
  custom.querySelectorAll('[data-permiso-clave]').forEach(function (chk) {
    if (chk.checked) permisos[chk.getAttribute('data-permiso-clave')] = true;
  });
  return permisos;
}

function renderAdminUsuarios() {
  const cont = document.getElementById('admin-contenido');
  if (!cont) return;

  ADMIN_USUARIOS_ESTADO.filtroTexto = '';

  cont.innerHTML =
    '<div class="vista-card">' +
      '<div class="vista-card-header">' +
        '<h2>Usuarios</h2>' +
        '<div class="vista-card-header-acciones">' +
          '<button type="button" class="btn-admin-refrescar" id="btn-admin-usuarios-refrescar" title="Volver a consultar la lista ahora mismo">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6M3 22v-6h6M3.5 9a9 9 0 0 1 15-4L21 8M20.5 15a9 9 0 0 1-15 4L3 16"/></svg>' +
            'Refrescar</button>' +
          '<button type="button" class="btn-anadir-obs" id="btn-admin-usuarios-anadir">' +
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>' +
            'Añadir usuario</button>' +
        '</div>' +
      '</div>' +
      '<p>Quién puede entrar en la app: usuario y contraseña de acceso, el nombre completo que se muestra arriba a la derecha, y si es administrador u operario.</p>' +
      '<div class="emails-config-toolbar">' +
        '<div class="emails-config-busqueda">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
          '<input type="text" id="admin-usuarios-buscar" placeholder="Buscar por usuario o nombre…">' +
        '</div>' +
      '</div>' +
      '<div id="admin-usuarios-resultado"><div class="loader">Cargando…</div></div>' +
    '</div>';

  document.getElementById('btn-admin-usuarios-refrescar').onclick = function () { cargarUsuariosAdmin_(true); };
  document.getElementById('btn-admin-usuarios-anadir').onclick = function () { abrirModalUsuario_(null); };

  let temporizadorBusquedaUsuarios = null;
  document.getElementById('admin-usuarios-buscar').addEventListener('input', function (e) {
    clearTimeout(temporizadorBusquedaUsuarios);
    const valor = e.target.value;
    temporizadorBusquedaUsuarios = setTimeout(function () {
      ADMIN_USUARIOS_ESTADO.filtroTexto = valor.trim().toLowerCase();
      pintarTablaUsuarios_();
    }, 200);
  });

  if (ADMIN_USUARIOS_ESTADO.datos) {
    pintarTablaUsuarios_();
  } else {
    cargarUsuariosAdmin_();
  }
}

function cargarUsuariosAdmin_(esRefrescoManual) {
  if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'usuarios') return;
  const resultadoEl = document.getElementById('admin-usuarios-resultado');
  const btnRefrescar = document.getElementById('btn-admin-usuarios-refrescar');
  if (esRefrescoManual && btnRefrescar) { btnRefrescar.classList.add('girando'); btnRefrescar.disabled = true; }
  if (!esRefrescoManual && resultadoEl) resultadoEl.innerHTML = '<div class="loader">Cargando…</div>';

  llamarApi_('getUsuarios', [])
    .then(function (datos) {
      if (ESTADO.vista !== 'administracion' || ESTADO_ADMIN.seccionActiva !== 'usuarios') return;
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      ADMIN_USUARIOS_ESTADO.datos = datos || [];
      pintarTablaUsuarios_();
    })
    .catch(function (err) {
      if (btnRefrescar) { btnRefrescar.classList.remove('girando'); btnRefrescar.disabled = false; }
      mostrarErrorServidor(err);
      if (resultadoEl) resultadoEl.innerHTML = '<div class="emails-config-vacio">No se ha podido cargar la lista de usuarios.</div>';
    });
}

/** El usuario "12942" es el administrador principal y no se puede editar,
 *  cambiar de contraseña ni eliminar salvo que quien esté conectado sea
 *  precisamente ese mismo usuario (SESSION_USUARIO). Además, desde ahora,
 *  ningún Operario (aunque tenga el permiso "usuarios") puede tocar
 *  ninguna cuenta con rol Administrador -- eso incluye asignar o quitar
 *  ese rol, solo lo puede hacer otro Administrador. El backend
 *  (editar_usuario / eliminar_usuario / cambiar_password_usuario) hace
 *  además las mismas comprobaciones por su cuenta, así que esto es solo
 *  para no mostrar botones que el servidor rechazaría igualmente. */
function esUsuarioProtegidoIntocable_(usuario) {
  if (usuario.usuario === '12942' && SESSION_USUARIO !== '12942') return true;
  if (usuario.rol === 'admin' && !esAdmin()) return true;
  return false;
}

function pintarTablaUsuarios_() {
  const cont = document.getElementById('admin-usuarios-resultado');
  if (!cont) return;
  const datos = ADMIN_USUARIOS_ESTADO.datos || [];

  const filtro = ADMIN_USUARIOS_ESTADO.filtroTexto;
  const items = datos.filter(function (it) {
    if (!filtro) return true;
    const texto = (it.usuario + ' ' + (it.nombreCompleto || '')).toLowerCase();
    return texto.indexOf(filtro) !== -1;
  });

  if (!items.length) {
    cont.innerHTML =
      '<div class="emails-config-vacio">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>' +
        (datos.length ? 'Ningún usuario coincide con la búsqueda.' : 'No hay usuarios todavía.') +
      '</div>';
    return;
  }

  const totalAdmin = datos.filter(function (it) { return it.rol === 'admin' && it.activo; }).length;

  cont.innerHTML =
    '<div class="admin-resumen">' + items.length + (items.length === 1 ? ' usuario' : ' usuarios') +
      ' · ' + totalAdmin + (totalAdmin === 1 ? ' administrador activo' : ' administradores activos') + '</div>' +
    '<div class="admin-tabla-wrap"><table class="admin-tabla usuarios-tabla">' +
      '<thead><tr><th>Nombre completo</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Creado</th><th></th></tr></thead>' +
      '<tbody>' + items.map(function (it) {
        return '<tr>' +
          '<td class="usuarios-col-nombre">' + escapeHtml(it.nombreCompleto || '—') + '</td>' +
          '<td>' + escapeHtml(it.usuario) + '</td>' +
          '<td><span class="usuarios-badge-rol ' + it.rol + '">' + (it.rol === 'admin' ? 'Administrador' : 'Operario') + '</span></td>' +
          '<td><span class="usuarios-badge-estado ' + (it.activo ? 'activo' : 'inactivo') + '"><span class="badge-dot"></span>' + (it.activo ? 'Activo' : 'Inactivo') + '</span></td>' +
          '<td>' + escapeHtml(it.creadoEn || '') + '</td>' +
          '<td><div class="usuarios-fila-acciones">' +
            (esUsuarioProtegidoIntocable_(it) ?
              '<button type="button" class="usuarios-btn-icono" title="Este usuario no se puede modificar" disabled>' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
              '</button>'
            :
              '<button type="button" class="usuarios-btn-icono" title="Editar" data-editar="' + escapeAttr(it.id) + '">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
              '</button>' +
              '<button type="button" class="usuarios-btn-icono" title="Cambiar contraseña" data-password="' + escapeAttr(it.id) + '">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3"/><path d="M16 7l3 3"/><path d="M19 4l3 3"/></svg>' +
              '</button>' +
              '<button type="button" class="usuarios-btn-icono peligro" title="Eliminar" data-eliminar="' + escapeAttr(it.id) + '">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>' +
              '</button>'
            ) +
          '</div></td>' +
        '</tr>';
      }).join('') +
      '</tbody>' +
    '</table></div>';

  cont.querySelectorAll('[data-editar]').forEach(function (btn) {
    btn.onclick = function () {
      const usuario = ADMIN_USUARIOS_ESTADO.datos.find(function (u) { return u.id === btn.getAttribute('data-editar'); });
      if (usuario) abrirModalUsuario_(usuario);
    };
  });
  cont.querySelectorAll('[data-password]').forEach(function (btn) {
    btn.onclick = function () {
      const usuario = ADMIN_USUARIOS_ESTADO.datos.find(function (u) { return u.id === btn.getAttribute('data-password'); });
      if (usuario) abrirModalPasswordUsuario_(usuario);
    };
  });
  cont.querySelectorAll('[data-eliminar]').forEach(function (btn) {
    btn.onclick = function () {
      const usuario = ADMIN_USUARIOS_ESTADO.datos.find(function (u) { return u.id === btn.getAttribute('data-eliminar'); });
      if (usuario) confirmarEliminarUsuario_(usuario);
    };
  });
}

/** Modal de "Añadir usuario" (usuarioExistente = null) o "Editar usuario"
 *  (usuarioExistente = fila de ADMIN_USUARIOS_ESTADO.datos). La contraseña
 *  se pide aquí solo al crear; para cambiarla en un usuario ya existente
 *  está el botón aparte (llave), vía abrirModalPasswordUsuario_. */
function abrirModalUsuario_(usuarioExistente) {
  const esNuevo = !usuarioExistente;

  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-box').classList.remove('medio');
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.add('usuario-form');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = esNuevo ? 'Añadir usuario' : 'Editar usuario';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const rolInicial = usuarioExistente ? usuarioExistente.rol : 'operario';
  const activoInicial = usuarioExistente ? !!usuarioExistente.activo : true;
  const permisosIniciales = (usuarioExistente && usuarioExistente.permisos) || {};

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-usuario-grid">' +
      '<div class="modal-usuario-col-izq">' +
        '<div class="modal-campo">' +
          '<label for="modal-usuario-nombre">Nombre completo</label>' +
          '<input type="text" id="modal-usuario-nombre" placeholder="Ej: JOSE LUIS FRANCO FERNANDEZ" value="' + escapeAttr(usuarioExistente ? usuarioExistente.nombreCompleto : '') + '">' +
        '</div>' +
        '<div class="modal-campo">' +
          '<label for="modal-usuario-usuario">Usuario (para entrar en la app)</label>' +
          '<input type="text" id="modal-usuario-usuario" placeholder="Ej: 12942" value="' + escapeAttr(usuarioExistente ? usuarioExistente.usuario : '') + '">' +
        '</div>' +
        (esNuevo
          ? '<div class="modal-campo">' +
              '<label for="modal-usuario-password">Contraseña</label>' +
              '<input type="password" id="modal-usuario-password" placeholder="Mínimo 3 caracteres" autocomplete="new-password">' +
            '</div>'
          : '') +
        '<div class="modal-campo">' +
          '<label>Rol</label>' +
          '<div class="modal-pills" id="modal-usuario-rol-pills">' +
            (esAdmin()
              ? '<button type="button" class="modal-pill' + (rolInicial === 'admin' ? ' activo' : '') + '" data-rol="admin">Administrador</button>'
              : '') +
            '<button type="button" class="modal-pill' + (rolInicial === 'operario' || !esAdmin() ? ' activo' : '') + '" data-rol="operario">Operario</button>' +
          '</div>' +
          (!esAdmin() ? '<div class="modal-campo-ayuda">Solo un administrador puede asignar el rol de Administrador.</div>' : '') +
        '</div>' +
        '<div class="modal-campo">' +
          '<div class="modal-campo-check">' +
            '<input type="checkbox" id="modal-usuario-activo"' + (activoInicial ? ' checked' : '') + '>' +
            '<label for="modal-usuario-activo">Activo (puede entrar en la app)</label>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-usuario-col-der">' +
        '<div class="modal-campo" id="modal-usuario-permisos-wrap"' + (rolInicial === 'operario' ? '' : ' style="display:none"') + '>' +
          '<div class="modal-permisos-cabecera">' +
            '<label>Permisos</label>' +
            '<span class="modal-campo-ayuda modal-campo-ayuda-inline">Marca lo que este operario puede hacer. Lo que no esté marcado no lo verá ni podrá usarlo.</span>' +
          '</div>' +
          renderPermisosCheckboxes_(permisosIniciales) +
        '</div>' +
        '<div class="modal-campo" id="modal-usuario-permisos-admin-nota"' + (rolInicial === 'admin' ? '' : ' style="display:none"') + '>' +
          '<div class="permisos-admin-nota">Un Administrador tiene acceso a todo automáticamente, así que aquí no hay nada que marcar.</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  custom.querySelectorAll('#modal-usuario-rol-pills .modal-pill').forEach(function (pill) {
    pill.onclick = function () {
      custom.querySelectorAll('#modal-usuario-rol-pills .modal-pill').forEach(function (p) { p.classList.remove('activo'); });
      pill.classList.add('activo');
      const esOperario = pill.getAttribute('data-rol') === 'operario';
      document.getElementById('modal-usuario-permisos-wrap').style.display = esOperario ? '' : 'none';
      document.getElementById('modal-usuario-permisos-admin-nota').style.display = esOperario ? 'none' : '';
    };
  });

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">' + (esNuevo ? 'Crear usuario' : 'Guardar cambios') + '</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const inputNombre = document.getElementById('modal-usuario-nombre');
    const inputUsuario = document.getElementById('modal-usuario-usuario');
    const nombreCompleto = inputNombre.value.trim();
    const usuario = inputUsuario.value.trim();
    const rolElegido = custom.querySelector('#modal-usuario-rol-pills .modal-pill.activo');
    const rol = rolElegido ? rolElegido.getAttribute('data-rol') : null;
    const activo = document.getElementById('modal-usuario-activo').checked;

    if (!usuario) { inputUsuario.focus(); return; }
    if (!rol) { mostrarToast('Elige un rol', true); return; }

    // Los administradores tienen acceso a todo por su rol, así que no se
    // les guarda ningún permiso fino (el backend los deja pasar igual).
    const permisos = rol === 'operario' ? leerPermisosMarcados_(custom) : {};

    if (esNuevo) {
      const inputPassword = document.getElementById('modal-usuario-password');
      const password = inputPassword.value;
      if (!password || password.length < 3) { inputPassword.focus(); return; }
      const btn = document.getElementById('modal-confirm-btn');
      btn.disabled = true;
      llamarApi_('crearUsuario', [usuario, nombreCompleto, password, rol, permisos])
        .then(function () {
          cerrarModal();
          mostrarToast('Usuario creado');
          cargarUsuariosAdmin_(true);
        })
        .catch(function (err) { btn.disabled = false; mostrarErrorServidor(err); });
    } else {
      const btn = document.getElementById('modal-confirm-btn');
      btn.disabled = true;
      llamarApi_('editarUsuario', [usuarioExistente.id, usuario, nombreCompleto, rol, activo, permisos])
        .then(function () {
          cerrarModal();
          mostrarToast('Usuario actualizado' + (usuario === SESSION_USUARIO ? ' (vuelve a entrar para ver el nombre nuevo arriba)' : ''));
          cargarUsuariosAdmin_(true);
        })
        .catch(function (err) { btn.disabled = false; mostrarErrorServidor(err); });
    }
  };
  setTimeout(function () { document.getElementById('modal-usuario-nombre').focus(); }, 50);
}

/** Modal pequeño solo para cambiar la contraseña de un usuario existente
 *  (separado del formulario de editar, para no pedir la contraseña cada
 *  vez que se toca el nombre o el rol). */
function abrirModalPasswordUsuario_(usuarioExistente) {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Cambiar contraseña';
  document.getElementById('modal-text').style.display = 'block';
  document.getElementById('modal-text').textContent = 'Nueva contraseña para "' + (usuarioExistente.nombreCompleto || usuarioExistente.usuario) + '" (usuario ' + usuarioExistente.usuario + ').';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label for="modal-usuario-password-nueva">Contraseña nueva</label>' +
      '<input type="password" id="modal-usuario-password-nueva" placeholder="Mínimo 3 caracteres" autocomplete="new-password">' +
    '</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cancelar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Cambiar contraseña</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const input = document.getElementById('modal-usuario-password-nueva');
    const password = input.value;
    if (!password || password.length < 3) { input.focus(); return; }
    const btn = document.getElementById('modal-confirm-btn');
    btn.disabled = true;
    llamarApi_('cambiarPasswordUsuario', [usuarioExistente.id, password])
      .then(function () {
        cerrarModal();
        mostrarToast('Contraseña actualizada');
      })
      .catch(function (err) { btn.disabled = false; mostrarErrorServidor(err); });
  };
  setTimeout(function () { document.getElementById('modal-usuario-password-nueva').focus(); }, 50);
}

/** Modal "Mi usuario": abre el icono de persona en la topbar. Muestra los
 *  datos de la sesión actual (nombre, usuario, rol, permisos) en solo
 *  lectura -- ya vienen en memoria desde el login (SESSION_*), no hace
 *  falta pedirlos otra vez al servidor -- y debajo deja cambiar la propia
 *  contraseña (pidiendo la actual, a diferencia del cambio de contraseña
 *  de OTRO usuario desde Administración, que no la pide). */
function abrirModalMiUsuario_() {
  document.getElementById('modal-box').classList.remove('ancho');
  document.getElementById('modal-box').classList.remove('usuario-form');
  document.getElementById('modal-box').classList.add('medio');
  document.getElementById('modal-box').classList.remove('peligro');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Mi usuario';
  document.getElementById('modal-text').style.display = 'none';
  document.getElementById('modal-textarea').style.display = 'none';

  const esAdministrador = esAdmin();
  const clavesPermisos = Object.keys(SESSION_PERMISOS || {}).filter(function (c) { return SESSION_PERMISOS[c]; });
  const etiquetasPermisos = [];
  CATALOGO_PERMISOS.forEach(function (grupo) {
    grupo.items.forEach(function (item) {
      if (clavesPermisos.indexOf(item.clave) !== -1) etiquetasPermisos.push(item.etiqueta);
    });
  });
  const permisosHtml = esAdministrador
    ? '<div class="modal-pills"><span class="modal-pill activo">Acceso a todo (Administrador)</span></div>'
    : (etiquetasPermisos.length
        ? '<div class="modal-pills">' + etiquetasPermisos.map(function (e) { return '<span class="modal-pill activo">' + escapeHtml(e) + '</span>'; }).join('') + '</div>'
        : '<div class="mi-usuario-permisos-vacio">Sin permisos adicionales asignados.</div>');

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<div class="modal-campo">' +
      '<label>Nombre completo</label>' +
      '<input type="text" readonly value="' + escapeAttr(SESSION_NOMBRE || '') + '">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label>Usuario</label>' +
      '<input type="text" readonly value="' + escapeAttr(SESSION_USUARIO || '') + '">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label>Rol</label>' +
      '<input type="text" readonly value="' + (esAdministrador ? 'Administrador' : 'Operario') + '">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label>Permisos</label>' +
      permisosHtml +
    '</div>' +
    '<hr class="mi-usuario-separador">' +
    '<div class="modal-campo">' +
      '<label for="mi-usuario-password-actual">Contraseña actual</label>' +
      '<input type="password" id="mi-usuario-password-actual" autocomplete="current-password">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label for="mi-usuario-password-nueva">Contraseña nueva</label>' +
      '<input type="password" id="mi-usuario-password-nueva" placeholder="Mínimo 3 caracteres" autocomplete="new-password">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label for="mi-usuario-password-repetir">Repetir contraseña nueva</label>' +
      '<input type="password" id="mi-usuario-password-repetir" autocomplete="new-password">' +
    '</div>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Cerrar</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Cambiar contraseña</button>';
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById('modal-cancel-btn').onclick = cerrarModal;
  document.getElementById('modal-confirm-btn').onclick = function () {
    const inputActual = document.getElementById('mi-usuario-password-actual');
    const inputNueva = document.getElementById('mi-usuario-password-nueva');
    const inputRepetir = document.getElementById('mi-usuario-password-repetir');

    if (!inputActual.value) { mostrarToast('Escribe tu contraseña actual', true); inputActual.focus(); return; }
    if (!inputNueva.value || inputNueva.value.length < 3) { mostrarToast('La contraseña nueva debe tener al menos 3 caracteres', true); inputNueva.focus(); return; }
    if (inputRepetir.value !== inputNueva.value) { mostrarToast('Las dos contraseñas nuevas no coinciden', true); inputRepetir.focus(); return; }

    const btn = document.getElementById('modal-confirm-btn');
    btn.disabled = true;
    llamarApi_('cambiarMiPassword', [inputActual.value, inputNueva.value])
      .then(function () {
        cerrarModal();
        mostrarToast('Contraseña actualizada');
      })
      .catch(function (err) { btn.disabled = false; mostrarErrorServidor(err); });
  };
}

function confirmarEliminarUsuario_(usuarioExistente) {
  appConfirm(
    'Eliminar usuario',
    '¿Seguro que quieres eliminar a "' + (usuarioExistente.nombreCompleto || usuarioExistente.usuario) + '" (usuario ' + usuarioExistente.usuario + ')? No podrá volver a entrar en la app.',
    function () {
      llamarApi_('eliminarUsuario', [usuarioExistente.id])
        .then(function () {
          mostrarToast('Usuario eliminado');
          cargarUsuariosAdmin_(true);
        })
        .catch(mostrarErrorServidor);
    },
    true
  );
}
