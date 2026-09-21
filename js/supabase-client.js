/* SALIDAS · js/supabase-client.js — Cliente de Supabase y login (RPC public.login) */

/* ---------------- SUPABASE ---------------- */
// El login usa esta función RPC (login.sql / ya creada en tu proyecto) en
// vez de Apps Script. El resto de acciones de la app SIGUEN sin migrar:
// llamarApi_ (más abajo) las detecta y avisa con "no configurado aún con
// Supabase" en vez de intentar llamar a Apps Script (que ya no existe en
// este archivo).
//
// El login NO usa Supabase Auth (no hay "usuarios" de verdad): llama a la
// función RPC public.login que ya tenías creada en Supabase, que reproduce
// el mismo esquema que Apps Script -- hashes en config_app
// (app_password_admin_hash / app_password_hash) y token de sesión en la
// tabla sesiones. Por eso solo hace falta la clave "anon" / "publishable",
// nunca la "service_role".
//
// 👉 Rellena estos dos valores con los de tu proyecto (Supabase ->
//    Project Settings -> API -> "Project URL" / "anon public" o
//    "Publishable key").
const SUPABASE_URL = 'https://plqcnqjlxfxjvxyktqbx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_O7FxndlZ08NVAbZeGx6jYw_HKdqLqFr';

const supabaseClient = (window.supabase && SUPABASE_URL.indexOf('TU_SUPABASE_URL') === -1)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
if (!supabaseClient) {
  console.warn('[Supabase] cliente NO inicializado -- window.supabase =', typeof window.supabase, '(¿ha cargado el <script> del CDN? revisa la pestaña Network). No se intentará el login en paralelo.');
} else {
  console.info('[Supabase] cliente inicializado contra', SUPABASE_URL);
}

/** Llama a la RPC public.login con el usuario y la contraseña tal cual los
 *  ha escrito la persona (la comparación con el hash bcrypt la hace el
 *  propio Postgres). Devuelve { token, rol, usuario, permisos } si son
 *  correctos, null si no lo son, o rechaza la Promise si hay un fallo real
 *  (red, Supabase mal configurado...). */
function loginSupabase_(usuario, pass) {
  if (!supabaseClient) {
    return Promise.reject(new Error('Supabase no está configurado todavía (revisa SUPABASE_URL / SUPABASE_ANON_KEY).'));
  }
  return supabaseClient.rpc('login', { p_usuario: usuario, p_password: pass })
    .then(function (resp) {
      if (resp.error) {
        if (resp.error.message && resp.error.message.indexOf('Usuario o contraseña incorrectos') !== -1) {
          return null; // credenciales mal -- no es un error de servidor
        }
        throw resp.error;
      }
      return resp.data;
    });
}
