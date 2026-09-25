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
  input.type = input.type === 'password' ? 'text' : 'password';
});
document.getElementById('btn-mi-usuario').addEventListener('click', abrirModalMiUsuario_);
document.getElementById('btn-imprimir-dia').addEventListener('click', function () { imprimirConteoDia_(); });
