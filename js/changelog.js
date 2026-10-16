/* SALIDAS · js/changelog.js — Historial de versiones (pestaña "Novedades"
 * de la ventana "Acerca de", js/acerca-de.js). Igual que en GIDT.
 *
 * Con cada versión nueva: añadir una entrada ARRIBA del todo (la más
 * reciente primero) y subir version.json al mismo número.
 * tipo: 'nuevo' | 'mejora' | 'correccion'
 * fecha: 'AAAA-MM-DD'
 * Redacción en impersonal (la lee todo el equipo). */
const CHANGELOG_SALIDAS = [
  {
    version: '2.1.6',
    fecha: '2026-10-16',
    cambios: [
      { tipo: 'nuevo',  texto: 'Las tiendas se sincronizan solas desde GIDT: el nombre, el límite de palets y el tránsito de cada tienda llegan de GIDT y se actualizan automáticamente; las altas y bajas de tiendas también se hacen en GIDT' },
      { tipo: 'nuevo',  texto: 'Ventana "Acerca de" renovada (se abre pulsando el logo o el nombre de la app), con una pestaña de Novedades donde se ve qué cambia en cada versión' },
      { tipo: 'mejora', texto: 'Nuevo aviso de actualización disponible, con los números de la versión actual y la nueva y una barra de progreso mientras se actualiza' },
      { tipo: 'mejora', texto: 'Configuración tiendas: el tránsito y el límite de palets se muestran como solo lectura, con la etiqueta "Solo lectura · GIDT"' },
      { tipo: 'mejora', texto: 'Configuración tiendas: se quita el botón "Buscar posibles duplicados"' },
      { tipo: 'mejora', texto: 'Los tránsitos de más de 5 días que vienen de GIDT (p. ej. 144H) se muestran con su etiqueta en los conteos' },
      { tipo: 'mejora', texto: 'Rutas y tiendas: los textos de ayuda indican que el número, el nombre y el límite general de la tienda se cambian en GIDT' }
    ]
  }
];
