/* SALIDAS · js/auth.js — Login: pantalla de entrada y enganche de listeners */

/* ---------------- LOGIN ---------------- */

/** Mide el alto REAL de header.topbar y lo guarda en la variable CSS
 *  --topbar-h, que usan .plantilla-dias-fila, .col-sidebar y
 *  .seccion-panel para "pegarse" justo debajo sin dejar un hueco (por el
 *  que se colaría el contenido al hacer scroll, ver el fix de "Rutas y
 *  tiendas"). Se llama al mostrar la app y en cada resize, porque el alto
 *  del topbar puede variar (p.ej. si el texto envuelve a dos líneas en
 *  pantallas estrechas). */
function ajustarAlturaTopbar_() {
  const topbar = document.querySelector('header.topbar');
  if (!topbar) return;
  document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
}
window.addEventListener('resize', ajustarAlturaTopbar_);

/** Guarda la sesión que devuelve el servidor (login o cambio obligatorio
 *  de contraseña) y muestra la app. */
function entrarEnApp_(resultado) {
  SESSION_TOKEN = resultado.token;
  SESSION_ROL = resultado.rol;
  SESSION_USUARIO = resultado.usuario;
  SESSION_NOMBRE = resultado.nombre_completo;
  SESSION_PERMISOS = resultado.permisos || {};
  SESSION_NAVE = resultado.nave || null;
  aplicarPermisosUI();
  iniciarAvisosVerificacion_();
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  ajustarAlturaTopbar_();
  ESTADO.fecha = hoyStr();
  ESTADO.anioMes = anioMesDe(ESTADO.fecha);
  cambiarVista('inicio');
}

/** Modal OBLIGATORIO de cambio de contraseña (administradores que aún no
 *  la han cambiado). No se puede cerrar: o se cambia la contraseña, o se
 *  sale y se vuelve a la pantalla de login. La comprobación de verdad la
 *  hace el servidor (RPC cambiar_password_obligatorio); aquí solo se
 *  avisa antes para no tener que esperar la respuesta. */
function abrirModalCambioPasswordObligatorio_(datos, passActual) {
  const caja = document.getElementById('modal-box');
  caja.classList.remove('ancho', 'usuario-form', 'peligro', 'sin-permiso');
  caja.classList.add('medio', 'cambio-obligatorio');
  document.getElementById('modal-title').style.display = '';
  document.getElementById('modal-title').textContent = 'Cambia tu contraseña';
  const texto = document.getElementById('modal-text');
  texto.style.display = '';
  texto.textContent = 'Hola' + (datos.nombre_completo ? ' ' + datos.nombre_completo : '') +
    '. Por seguridad, antes de entrar tienes que poner una contraseña nueva. ' +
    'Debe tener al menos 4 caracteres y no puede ser igual que tu usuario. Si tu contraseña actual ya cumple esto, puedes volver a escribirla.';
  document.getElementById('modal-textarea').style.display = 'none';

  const custom = document.getElementById('modal-custom');
  custom.style.display = 'block';
  custom.innerHTML =
    '<input type="text" autocomplete="username" value="' + escapeAttr(datos.usuario || '') + '" style="display:none" readonly>' +
    '<div class="modal-campo">' +
      '<label for="obligatorio-password-nueva">Contraseña nueva</label>' +
      '<input type="text" id="obligatorio-password-nueva" class="campo-oculto" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" placeholder="Mínimo 4 caracteres">' +
    '</div>' +
    '<div class="modal-campo">' +
      '<label for="obligatorio-password-repetir">Repetir contraseña nueva</label>' +
      '<input type="text" id="obligatorio-password-repetir" class="campo-oculto" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other">' +
    '</div>' +
    '<p class="cambio-obligatorio-error" id="obligatorio-error"></p>';

  const actions = document.getElementById('modal-actions');
  actions.innerHTML =
    '<button class="modal-cancel" id="modal-cancel-btn">Salir</button>' +
    '<button class="modal-confirm" id="modal-confirm-btn">Cambiar y entrar</button>';
  document.getElementById('modal-overlay').style.display = 'flex';

  const inputNueva = document.getElementById('obligatorio-password-nueva');
  const inputRepetir = document.getElementById('obligatorio-password-repetir');
  const error = document.getElementById('obligatorio-error');
  function mostrarError(msg, input) {
    error.textContent = msg;
    error.style.display = 'block';
    if (input) input.focus();
  }

  // Salir: vuelve al login sin sesión (el servidor no ha abierto ninguna).
  document.getElementById('modal-cancel-btn').onclick = function () {
    cerrarModal();
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
  };

  const confirmar = function () {
    const nueva = inputNueva.value;
    error.style.display = 'none';
    if (nueva.length < 4) { mostrarError('La contraseña debe tener al menos 4 caracteres.', inputNueva); return; }
    if (nueva.trim().toLowerCase() === String(datos.usuario || '').trim().toLowerCase()) {
      mostrarError('La contraseña no puede ser igual que el usuario.', inputNueva); return;
    }
    if (inputRepetir.value !== nueva) { mostrarError('Las dos contraseñas no coinciden.', inputRepetir); return; }

    const btn = document.getElementById('modal-confirm-btn');
    btn.disabled = true;
    cambiarPasswordObligatorioSupabase_(datos.token_cambio, nueva)
      .then(function (resultado) {
        cerrarModal();
        document.getElementById('login-pass').value = '';
        mostrarToast('Contraseña actualizada');
        entrarEnApp_(resultado);
      })
      .catch(function (err) {
        btn.disabled = false;
        const msg = (err && err.message) || '';
        if (msg.indexOf('Sesión caducada') !== -1) {
          cerrarModal();
          document.getElementById('login-pass').value = '';
          mostrarToast('Ha pasado demasiado tiempo, vuelve a entrar', true);
          return;
        }
        mostrarError(msg || 'No se ha podido cambiar la contraseña.', inputNueva);
      });
  };
  document.getElementById('modal-confirm-btn').onclick = confirmar;
  inputNueva.addEventListener('keydown', function (e) { if (e.key === 'Enter') inputRepetir.focus(); });
  inputRepetir.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmar(); });
  setTimeout(function () { inputNueva.focus(); }, 50);
}

function intentarLogin() {
  const usuario = document.getElementById('login-usuario').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('btn-login');
  const spinner = document.getElementById('login-spinner');
  const btnText = document.getElementById('login-btn-text');

  document.getElementById('login-error').style.display = 'none';
  if (!usuario) { document.getElementById('login-usuario').focus(); return; }
  btn.disabled = true; spinner.style.display = 'inline-block'; btnText.textContent = 'Comprobando…';

  loginSupabase_(usuario, pass)
    .then(function (resultado) {
      btn.disabled = false; spinner.style.display = 'none'; btnText.textContent = 'Entrar';
      if (!resultado) {
        document.getElementById('login-error').style.display = 'block';
        return;
      }
      // Administrador que todavía no ha cambiado su contraseña: el servidor
      // NO ha abierto sesión (solo da un token temporal que sirve para
      // cambiarla). Hasta que la cambie no puede entrar en la app.
      if (resultado.debe_cambiar_password) {
        abrirModalCambioPasswordObligatorio_(resultado, pass);
        return;
      }
      entrarEnApp_(resultado);
    })
    .catch(function (err) {
      btn.disabled = false; spinner.style.display = 'none'; btnText.textContent = 'Entrar';
      mostrarErrorServidor(err);
    });
}
document.getElementById('login-usuario').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') document.getElementById('login-pass').focus();
});
document.getElementById('login-pass').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') intentarLogin();
});
document.getElementById('toggle-pass').addEventListener('click', function () {
  const input = document.getElementById('login-pass');
  // Si va con puntos por CSS, se muestra/oculta quitando la clase; si el
  // navegador no admite esos puntos, se usa el cambio de tipo de siempre.
  if (input.type === 'password' || input.dataset.modoTipo === '1') {
    input.type = input.type === 'password' ? 'text' : 'password';
  } else {
    input.classList.toggle('mostrar');
  }
});

/* Campos del login sin autorrelleno ni aviso de "contraseña no segura".
   - Los dos campos empiezan en solo lectura y se desbloquean al entrar en
     ellos: así el navegador no los rellena solo al cargar la página.
   - La contraseña es un campo de texto que se ve con puntos por CSS. Si el
     navegador no admite esos puntos (muy raro), vuelve a type="password"
     para que nunca se vea la contraseña en claro. */
(function () {
  ['login-usuario', 'login-pass'].forEach(function (id) {
    const el = document.getElementById(id);
    const desbloquear = function () { el.removeAttribute('readonly'); };
    el.addEventListener('focus', desbloquear);
    el.addEventListener('pointerdown', desbloquear);
    if (document.activeElement === el) desbloquear();
  });
  const pass = document.getElementById('login-pass');
  const admitePuntos = window.CSS && CSS.supports &&
    (CSS.supports('-webkit-text-security', 'disc') || CSS.supports('text-security', 'disc'));
  if (!admitePuntos) {
    pass.type = 'password'; pass.dataset.modoTipo = '1';
    // Lo mismo para las contraseñas de los modales (cambio obligatorio,
    // Mi usuario, Usuarios), que se crean más tarde.
    new MutationObserver(function () {
      document.querySelectorAll('input.campo-oculto:not([data-modo-tipo])').forEach(function (el) {
        el.type = 'password'; el.dataset.modoTipo = '1';
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  // Las partículas del fondo del login van en js/login-estaciones.js.
})();
document.getElementById('btn-mi-usuario').addEventListener('click', abrirModalMiUsuario_);
document.getElementById('btn-imprimir-dia').addEventListener('click', function () { imprimirConteoDia_(); });
