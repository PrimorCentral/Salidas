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
    version: '2.1.16',
    fecha: '2026-10-30',
    cambios: [
      { tipo: 'nuevo',      texto: 'Ajustar carga: mientras alguien tiene abierta la ventana de ajustar la carga de una agrupación, nadie más puede meter palets en ella. Los demás ven la franja azul «Conteo bloqueado · … está ajustando la carga» y, si otro responsable intenta abrirla a la vez, le sale «Ya están ajustando esta carga». Se suelta al guardar o cancelar (y sola a los 2 minutos si se cierra el navegador). Al guardar queda el bloqueo de carga ajustada de siempre' },
      { tipo: 'mejora',     texto: 'La ventana de ajustar carga coge al abrirse los palets que hay guardados en ese momento, también los que hayan metido otros aunque la pantalla no se hubiera refrescado todavía' },
      { tipo: 'mejora',     texto: 'Ajustar carga: «MODO EDICIÓN» sale en grande en la cabecera de la ventana' },
      { tipo: 'correccion', texto: 'Al guardar el conteo solo se guardan las casillas que ha tocado cada persona. Una pantalla sin actualizar ya no borra los palets que haya metido otra persona en el mismo rato' },
      { tipo: 'nuevo',      texto: 'Si dos personas cambian la misma casilla a la vez, a quien guarda el último le sale un aviso con lo que había puesto el otro (quién y a qué hora) y lo que ha puesto él, con el botón «Dejar el …» para volver a lo del otro si era lo bueno' },
      { tipo: 'nuevo',      texto: 'Rutas y tiendas: al eliminar una agrupación que ya tiene palets contados para hoy o los próximos días, avisa con la lista y hay que elegir: pasarlos a la agrupación donde está esa tienda ese día o borrarlos. Antes la agrupación eliminada seguía saliendo en el conteo diario' },
      { tipo: 'nuevo',      texto: 'Rutas y tiendas: si la tienda no está en ninguna otra agrupación ese día, sus palets quedan «en espera» (no salen en el conteo diario). Cuando se mete la tienda en otra agrupación, desde la franja «Palets en espera» se pasan con un botón, o se descartan. Todo queda en el registro de actividad' }
    ]
  },
  {
    version: '2.1.15',
    fecha: '2026-10-30',
    cambios: [
      { tipo: 'nuevo',      texto: 'Lista de carga (camioncito): con el permiso «Ajustar carga» se puede poner o cambiar la matrícula y el remolque en cualquier momento, sin ajustar la carga. Los palets no cambian y el conteo no se bloquea. Esa matrícula sale después en el email de la previsión y del definitivo, al imprimir y en el WhatsApp. Para repartir las tiendas en varios camiones se sigue usando «Ajustar carga»' },
      { tipo: 'mejora',     texto: 'Cuando falla algo importante (guardar el conteo, verificar…) sale un aviso claro en mitad de la pantalla, con qué ha pasado y qué hacer, en vez de quedarse cargando sin avisar. Si el servidor no contesta en 30 segundos, se avisa también' },
      { tipo: 'mejora',     texto: 'Usuarios: un operario puede tener la contraseña igual que su usuario (la regla de que no puede ser igual solo se aplica a los administradores)' },
      { tipo: 'correccion', texto: 'Verificar una nave se quedaba cargando sin terminar nunca en las agrupaciones con una tienda que ese día sale por otra agrupación (cambio puntual), como ONTIME ANDALUCÍA o TXT ANDALUCÍA. Ya se puede verificar con normalidad' }
    ]
  },
  {
    version: '2.1.14',
    fecha: '2026-10-30',
    cambios: [
      { tipo: 'nuevo',      texto: 'Administración → Registro de actividad: quién ha hecho qué en la app (conteos, envíos y desbloqueos, bloqueos y cambios, rutas y tiendas, usuarios, emails de tiendas y de agencias). Filtros por periodo, usuario, sección, tipo de acción y buscador, por páginas y sin scroll de página. No busca sola al entrar: se elige el periodo. Se guardan 6 meses' },
      { tipo: 'nuevo',      texto: 'Conteo diario: al añadir una observación importante pregunta si es del día o de una agrupación (con un desplegable de las agrupaciones de ese día)' },
      { tipo: 'nuevo',      texto: 'Bloqueos y cambios: al editar una nota se puede cambiar entre nota del día y nota de agrupación (si el texto nombra una agrupación, viene ya elegida)' },
      { tipo: 'mejora',     texto: 'Cambios puntuales: la nota automática sale una sola vez, como nota de la agrupación de destino, y ya no aparece repetida en Bloqueos y cambios' },
      { tipo: 'mejora',     texto: 'Bloqueos y cambios: el formulario de añadir se abre sin fecha ni tipo elegidos, y «Guardar» solo se enciende cuando está todo lo necesario' },
      { tipo: 'mejora',     texto: 'Al ajustar la carga, la agrupación queda verificada (60, PTA y CART.) por quien la ajusta y se quitan los avisos de «cambiado tras verificar». «Enviar a informática» manda la carga ajustada, no el conteo real' },
      { tipo: 'mejora',     texto: 'Lista y ajuste de carga: los camiones salen en fichas a la izquierda con su matrícula, remolque y palets (en rojo si pasan del máximo de un camión), y en la tabla una franja «CAMIÓN 2 · Matrícula … · Remolque …»' },
      { tipo: 'mejora',     texto: 'Rutas y tiendas: un solo buscador para agrupaciones y tiendas del día, «Añadir ruta nueva» arriba a la derecha, los interruptores de cada ruta (PESO, C.EXPRESS, SOBRESTOCK, VIERNES, DOMINGO, PDF ESPECIAL) en una franja aparte con un check cuando están activos y una fila de títulos encima de las tiendas' },
      { tipo: 'mejora',     texto: 'Rutas y tiendas: la papelera sale en rojo y para eliminar hay que deslizar, como al desbloquear un conteo. Si hay que elegir qué eliminar, la barra no se puede deslizar hasta elegirlo' },
      { tipo: 'mejora',     texto: 'Rutas y tiendas: un conteo especial ya pasado solo se puede consultar, no editar' },
      { tipo: 'mejora',     texto: 'Acceso rápido a agrupación: al volver a Conteos diarios el buscador conserva lo escrito y tiene una × para borrarlo' },
      { tipo: 'correccion', texto: 'Una agrupación con casillas a 0 ya sale «En progreso» y no «Pendiente», igual que en la pantalla de inicio' },
      { tipo: 'correccion', texto: 'Las cabeceras de agrupaciones con dos horas (p. ej. «14:00 - 19:00») ya no pasan el estado a otra línea' }
    ]
  },
  {
    version: '2.1.13',
    fecha: '2026-10-27',
    cambios: [
      { tipo: 'nuevo',      texto: 'Pantalla de inicio: la columna Estado sigue todo el camino de la carga: En progreso (falta algún check en verde), Carga sin ajustar (los 3 checks en verde), Carga ajustada, Previsión enviada y Definitivo enviado, cada uno con su color. El texto del estado se ve un poco más grande' },
      { tipo: 'nuevo',      texto: 'Aviso en rojo «CARGA NO AJUSTADA POR UN RESPONSABLE» en la cabecera cuando las 3 naves están verificadas y todavía no se ha ajustado la carga' },
      { tipo: 'mejora',     texto: 'La previsión y el definitivo enviados se ven en el sobre del email (azul la previsión, verde el definitivo, con una marca ✓); quién lo envió y a qué hora sale al pasar el ratón y al abrir el menú. Desaparecen de la cabecera los avisos «Previsión enviada por» y «Definitivo enviado por»' },
      { tipo: 'mejora',     texto: 'Cabeceras de las agrupaciones ordenadas e iguales en todas: el nombre más grande, con los checks de las naves justo debajo; ubicación, tiendas, estado y las pestañas de carga en un bloque alineado en el centro, y los botones a la derecha. Todas miden lo mismo y los nombres largos ya no se cortan' },
      { tipo: 'mejora',     texto: 'Las pestañas de la carga pasan a llamarse «Carga ajustada» (siempre, también después de enviar la previsión o el definitivo) y «Conteo real» (antes «Ver conteo real sin ajustar»)' },
      { tipo: 'mejora',     texto: 'Los días con conteo especial se indican con una etiqueta naranja «CONTEO ESPECIAL» en la barra azul, junto a la fecha (en lugar de la franja de aviso encima de las agrupaciones)' },
      { tipo: 'correccion', texto: 'Con la carga ajustada, el aviso de cada ruta («8P MAX. POR RUTA … x/8») cuenta los palets que se cargan y no los contados (antes salía pasada aunque no lo estuviera)' },
      { tipo: 'correccion', texto: 'El PDF especial respeta la pestaña que se está viendo: desde «Carga ajustada» sale la carga ajustada y desde «Conteo real», lo contado' },
      { tipo: 'mejora',     texto: 'El PDF especial pasa a llamarse «PDF Control responsables» y sale siempre en un folio A4 apaisado con sus márgenes (se ajusta para que quepa entero en una hoja)' },
      { tipo: 'mejora',     texto: 'PDF Control responsables: nueva columna NAVE CARGA (sale de la anotación «CARGA EN …»), sin las columnas SOBRAN y AGENCIA (la agencia ya va en el título) y más sitio para las firmas, la recogida y la zona. La fecha va a la derecha del título' },
      { tipo: 'mejora',     texto: 'PDF Control responsables: cada ruta se separa con un borde grueso; las tiendas sueltas llevan TOTAL RUTA rayado (no lleva dato) y su LÍMITE CAMIÓN sale de su propia nota (p. ej. «8P MAX.»). TOTAL, TOTAL RUTA y NAVE CARGA, con letra más grande' },
      { tipo: 'mejora',     texto: 'Rutas y tiendas: los conteos especiales ya pasados no llenan la fila de días; se consultan en «Pasados», agrupados por meses y con buscador por fecha' },
      { tipo: 'mejora',     texto: 'Rutas y tiendas: al editar la ubicación y hora de carga de una agrupación (y al añadir una ruta nueva), la ubicación se elige en un desplegable (GAITE, PTA, CARTAMA, AMBAS NAVES, NAVE RIO, ALBINONI) y la hora con un selector de hora (con «hasta» para las franjas)' }
    ]
  },
  {
    version: '2.1.12',
    fecha: '2026-10-26',
    cambios: [
      { tipo: 'nuevo',      texto: 'Conteo bloqueado con candado: en cuanto se ajusta la carga o se envía la previsión, el conteo queda bloqueado para los operarios (si hay que cambiar algo, se avisa a un responsable). Un responsable lo desbloquea arrastrando el candado hasta el final de la barra (al desbloquear se borra la carga ajustada; la previsión enviada no se deshace). Se vuelve a bloquear si se ajusta la carga o se envía la previsión otra vez' },
      { tipo: 'nuevo',      texto: 'Con el definitivo enviado, el mismo candado sirve para desbloquearlo el mismo día (sustituye a la papelera «Deshacer envío»)' },
      { tipo: 'nuevo',      texto: 'Pestañas «Carga ajustada» (o «Carga enviada») y «Ver conteo real sin ajustar» cuando lo que se carga no coincide con lo contado. La carga se ve limpia; los avisos de límite salen en el conteo real' },
      { tipo: 'mejora',     texto: 'Los envíos (previsión, definitivo e informática) pasan a un sobre junto al camioncito, y el PDF y el Excel a un botón de descarga' },
      { tipo: 'mejora',     texto: 'Verificar conteo pasa a ser un icono de check: verde cuando está verificado, naranja si hay que volver a verificar' },
      { tipo: 'mejora',     texto: 'Cabecera más limpia: sin el botón «Guardar conteo» (se guarda solo), sin el «+» de notas ni la X de bloquear tienda (se hace desde Bloqueo y cambios) y sin hueco en blanco cuando no hay nada que mostrar' },
      { tipo: 'mejora',     texto: 'La columna DOMINGO pasa a color rosa para no confundirse con el verde de verificado' }
    ]
  },
  {
    version: '2.1.11',
    fecha: '2026-10-24',
    cambios: [
      { tipo: 'mejora', texto: 'Inicio de sesión: se quitan el reflejo de luz que cruzaba la pantalla y el del botón Entrar; en el fondo quedan solo las partículas flotantes' }
    ]
  },
  {
    version: '2.1.10',
    fecha: '2026-10-20',
    cambios: [
      { tipo: 'nuevo',      texto: 'Pantalla de inicio de sesión renovada: la foto del almacén a la izquierda con lo que hace la app y el formulario en un panel blanco a la derecha (en el móvil, una tarjeta sobre la foto)' },
      { tipo: 'nuevo',      texto: 'Inicio de sesión animado: la foto se mueve despacio, pasa un reflejo de luz, flota polvo en el aire y un camioncito recorre GAITE, PTA y CARTAMA cargando un palet en cada nave. Se ve también en los equipos con las animaciones de Windows desactivadas' },
      { tipo: 'mejora',     texto: 'El navegador ya no rellena solo el campo Usuario del inicio de sesión' },
      { tipo: 'mejora',     texto: 'El navegador ya no avisa de «contraseña no segura / hay que cambiarla» ni ofrece guardarla: en el inicio de sesión, el cambio obligatorio de contraseña, Mi usuario y Usuarios' },
      { tipo: 'mejora',     texto: 'La contraseña no puede ser igual que el usuario: al cambiarla en Mi usuario, al crear un usuario y al cambiarle la contraseña desde Usuarios' }
    ]
  },
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
