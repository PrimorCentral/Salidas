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
    version: '2.1.9',
    fecha: '2026-10-20',
    cambios: [
      { tipo: 'mejora', texto: 'Imagen de la lista de carga para WhatsApp: ya no lleva la columna de sobrante y se destaca si es «PREVISIÓN DE CARGA» (en amarillo) o «CARGA DEFINITIVA» (en verde)' }
    ]
  },
  {
    version: '2.1.8',
    fecha: '2026-10-19',
    cambios: [
      { tipo: 'nuevo',      texto: 'Carga del camión: al ajustar la carga se pueden indicar los camiones que salen, con su matrícula y la del remolque (opcional). Con 2 o más camiones se elige en cuál va cada tienda y se ven las tiendas y los palets de cada camión. Un camión lleva como máximo 33 palets: si no caben, se avisa de cuántos camiones hacen falta y no deja guardar' },
      { tipo: 'nuevo',      texto: 'Carga del camión: una tienda se puede repartir entre varios camiones con la opción «Dividir…» (p. ej. 5 palets en un camión y 5 en otro). Lo repartido tiene que sumar lo que se carga para poder guardar' },
      { tipo: 'nuevo',      texto: 'El email de previsión y de definitivo a la agencia, la lista de carga impresa y la del camioncito salen agrupados por camión, con la matrícula, el remolque y el subtotal de cada uno. Sin camiones indicados, todo sale como antes' },
      { tipo: 'nuevo',      texto: 'Conteos especiales: desde Rutas y tiendas, al añadir una tienda que ese día ya está en otra agrupación, se ofrece hacerlo como cambio puntual solo para esa fecha. La tienda puntual se puede colocar arrastrando, meter en un grupo de palets, bloquear 60/PTA/CART., cambiar su límite de ese día o quitar el cambio' },
      { tipo: 'mejora',     texto: 'Los modales de la carga del camión se ven en dos columnas en pantalla ancha: a la izquierda los totales, avisos y camiones, y a la derecha la lista de tiendas' },
      { tipo: 'mejora',     texto: 'Carga del camión: se abre siempre como la ven los operadores (solo lectura); quien tiene el permiso «Ajustar carga» pasa a editarla con el lápiz junto a la X. Si nadie la ha ajustado, se indica que se cargará lo contado' },
      { tipo: 'mejora',     texto: 'Ajustar carga del camión: nuevo botón Imprimir y se indica quién ajustó la carga y a qué hora' },
      { tipo: 'mejora',     texto: 'Buscador de tiendas en Rutas y tiendas y en Conteos: una tienda con cambio puntual lleva a la agrupación por la que sale ese día' },
      { tipo: 'correccion', texto: 'Email a la agencia: cuando se cargan menos palets de los contados, el peso se calcula con los palets que se cargan de verdad (se quitan primero los de PTA, luego CARTAMA y por último GAITE)' }
    ]
  },
  {
    version: '2.1.7',
    fecha: '2026-10-17',
    cambios: [
      { tipo: 'mejora', texto: 'Calendario de conteos: ahora se puede abrir hoy y los 2 días siguientes (antes solo hoy y mañana), y en esos días se puede guardar, ajustar la carga y enviar a la agencia' }
    ]
  },
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
