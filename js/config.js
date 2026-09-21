/* SALIDAS · js/config.js — Versión de la app y estado de la sesión (variables globales) */
/* ---------------- COMUNICACIÓN CON EL BACKEND (Apps Script como Aplicación Web) ---------------- */
// Esta página ya no se sirve desde Apps Script (ahora vive en GitHub Pages,
// de cara a convertirla en PWA instalable), así que "google.script.run"
// —que solo existe dentro del HtmlService de Apps Script— no está disponible.
// En su lugar se llama al backend por fetch() contra la URL de la
// implementación como "Aplicación web". Para no tener que tocar el resto del
// archivo, se crea aquí una réplica de "google.script.run" con la misma
// forma (withSuccessHandler / withFailureHandler / nombreMetodo(args)).

// 👉 Apunta DIRECTAMENTE a la implementación de Apps Script como
//    "Aplicación web" (ya no hay ningún Worker de Cloudflare por delante:
//    ese proxy se usó en su día para esquivar los 302/CORS erráticos de
//    Apps Script visto desde el navegador, pero ya no está en uso — se ha
//    quitado también toda la lógica de reintentos que asumía su
//    comportamiento, ver llamarApi_ más abajo). Si algún día vuelve a
//    hacer falta un proxy delante de Apps Script, solo hay que tocar esta
//    línea.
// APPS_SCRIPT_URL ELIMINADA: la app ya no llama a Apps Script para nada.
// Lo que aún no está migrado a Supabase avisa con "no configurado aún con
// Supabase" (ver SUPABASE_ACCIONES_ / llamarApi_ más abajo) en vez de
// intentar hablar con el backend antiguo.

// Versión de la app: la ÚNICA fuente del número es version.json (aquí no hay
// que escribirlo). Al arrancar, js/actualizaciones.js lo lee y lo deja en esta
// variable; se muestra abajo a la derecha en el login y en "Inicio", y se
// compara periódicamente con version.json para detectar que hay una
// actualización nueva. Para publicar una versión nueva solo hay que cambiar
// el número de version.json.
let APP_VERSION_ACTUAL = null;

const TOKEN_STORAGE_KEY = 'conteos_diarios_token';
// El token de sesión ya NO se guarda en localStorage a propósito: así la PWA
// siempre pide contraseña al abrirse (cada vez que se recarga o se relanza
// la app), aunque dentro de la misma sesión abierta el token siga viviendo
// en memoria para no tener que reintroducir la contraseña en cada llamada.
let SESSION_TOKEN = null;
// Rol de la sesión actual: 'admin' | 'operario' | null (aún sin login). Solo
// el rol "admin" puede crear/borrar notas y cerrar/reabrir tiendas; se
// guarda igual que el token, solo en memoria (no en localStorage).
let SESSION_ROL = null;
// Permisos finos del operario actual (objeto { clave: true, ... }, tal cual
// devuelve login desde usuarios.permisos). Un admin no necesita mirar esto
// -- ver tienePermiso() -- se queda vacío en su caso.
let SESSION_PERMISOS = {};
// Nombre completo de la persona que ha entrado (el que devuelve login desde
// usuarios.nombre_completo), para mostrarlo en la topbar en vez del rol.
let SESSION_NOMBRE = null;
// Nombre de usuario con el que se ha entrado (el que devuelve login), por si
// hace falta mostrarlo o compararlo (p.ej. en la pantalla de Usuarios, para
// no dejar que alguien se desactive/borre a sí mismo). También en memoria.
let SESSION_USUARIO = null;
