# Schedule

Reglas: [../domains/schedules.md](../domains/schedules.md). Todos los de creación/cambio **excepto show / unassigned** se auditan.

Las respuestas del comando (éxito, error e info) son **Components V2** en el canal. Siguen en **texto plano** el aviso de asignar juez o recorder, el de renuncia o reemplazo, y la confirmación de asistencia. Los embeds clásicos son el post del schedule (ticket y canal de schedules) y la declaración de results (ticket y canal de resultados). Ningún mensaje de este flujo es efímero. El capitán no ejecuta ningún subcomando.

| Subcomando | Quién |
|---|---|
| `create` · `update` · `delete` | Rol **admin** o **helper** de ese torneo |
| `show` · `unassigned` | Rol **staff** del servidor (`/staff config`) |
| `refresh` | Rol **judge** o **recorder** del servidor |
| `results` · `results_delete` | Rol **judge** del servidor |
| `resign` | Solo quien está asignado a ese schedule, dentro del ticket |

## `/schedule create`

**Solo ticket.** Admin o helper del torneo. Requiere canal de schedules.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| hour | INTEGER | Sí | UTC |
| minute | INTEGER | Sí | UTC |
| day | INTEGER | Sí | |
| month | INTEGER | Sí | |
| year | INTEGER | Sí | |
| judge | USER | No | Preasignar. Tiene que tener el rol **judge** |
| recorder | USER | No | Preasignar. Tiene que tener el rol **recorder** |
| remark | STRING | No | Máx. 130 |

Mínimo +10 minutos. Marca `🔴`. Admin o helper del torneo. Posts, punto rojo y evento son una sola operación: si uno falla, se borran el resto y el comando responde el error. Si el create trae juez o recorder, el ticket publica el mismo texto plano que el botón Assign. Encima del embed, el ticket y el canal de schedules mencionan a los dos capitanes. El ping sale en el ticket. La respuesta al crear es un Components V2: **Schedule created** y `Match scheduled successfully. Thumbnail generated.` El thumbnail se compone sobre el fondo rotativo con icono del servidor, torneo, etapa (`ROUND n`, `SEMIFINAL`, `FINAL`, `3RD PLACE`…), equipos, fecha y hora UTC y nombre del servidor; los nombres demasiado anchos reducen fuente y luego terminan en elipsis. Relación: attendance, results, worker T-10/T-0, thumbnails de settings.

## `/schedule update`

**Solo ticket.** Admin o helper del torneo. El ticket vuelve a publicar el schedule: el texto menciona a los capitanes y, si hay juez o grabador asignado, también a ellos, y ese mensaje hace ping. El canal de schedules muestra las mismas menciones y no vuelve a notificar. `hour`, `minute`, `day`, `month` y `year` son opcionales y se pueden mandar de uno en uno: el trozo que falta se conserva. La fecha resultante no puede estar en el pasado ni a menos de 10 minutos en el momento del comando. También `judge`, `recorder`, `note`, `remove_judge`, `remove_recorder`, `reason`, `regenerate_image`. Al menos un campo. `judge` y `recorder` solo se aceptan si ese usuario tiene el rol correspondiente; si no, no se actualiza nada. Asignar publica en el ticket el texto del botón Assign. Quitar o reemplazar publica el texto de resign del puesto anterior y, si entra alguien nuevo, el de Assign. Recalendarizar resetea recordatorios y reconstruye el thumbnail con la fecha/hora actualizada. `regenerate_image` reconstruye la composición con el fondo ya asignado y los datos actuales sobre el embed, el post del canal de thumbnails y el evento. No avanza la rotación.

## `/schedule show`

Cualquier canal. Rol **staff**. No audita. Siempre **Components V2** en el canal, sin ping. Muestra schedules de cualquier estado mientras el torneo **siga registrado** en el servidor. Si el torneo se borró, ese schedule no sale.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| match | STRING (Autocomplete) | No | Abre la ficha de ese schedule. Se ve `lado vs lado`; el valor es el id interno. Si viene, gana sobre el resto. |
| filter | STRING (Choice) | No | `all` · `pending` · `past` · `overdue`. Por defecto `all`. |
| tour | STRING (Autocomplete) | No | Solo ese torneo. |
| user | USER | No | Schedules donde esa persona es juez o recorder. |

Sin `match`, lista. `tour`, `user` y `filter` se combinan. Sin ninguno, lista todos los schedules de torneos que siguen existiendo. 5 por página, el más reciente primero. Cada fila lleva enfrentamiento, hora relativa y UTC, torneo, estado, id de Challonge, y juez o recorder si están asignados. Las flechas las pulsa quien tenga el rol staff.

Estados:

- **Pending**: hora futura y sin declaración.
- **Completed**: hay `/schedule results`.
- **Result pending**: la hora ya pasó y no hay declaración.

`past` (Past/Completed) incluye Completed y Result pending.

La ficha de `match` repite la tarjeta del schedule. Con declaración muestra la hora del resultado, el marcador, remarks, links y transcript, más botones al post de results y al post del canal de schedules. Sin declaración muestra la hora programada y el remark. Verde si está completado, dorado si está pendiente, rojo si el resultado está atrasado.

## `/schedule delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

`confirm=False` cancela. Quita `🔴`. Admin o helper del torneo.

## `/schedule unassigned`

| Campo | Tipo | Obligatorio |
|---|---|---|
| filter | STRING (Choice) | Depende de implementación | `all` · `missing_judge` · `missing_recorder` · `any` |

Consulta. Rol staff. Alimenta reclutamiento de staff de mesa.

## `/schedule refresh`

**Cualquier canal.** Rol judge o recorder. Abre otra vez los botones de reclamar durante 10 minutos. Un puesto ya ocupado sigue apagado. No cambia la hora. La respuesta incluye el **Link** al post del schedule en el canal de schedules.

| Campo | Tipo | Obligatorio |
|---|---|---|
| match | STRING (Autocomplete) | Sí | Schedules del servidor (`lado vs lado | torneo | fecha UTC`) |

## `/schedule resign`

**Solo ticket, solo el asignado.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | STRING (Choice) | No | Judge · Recorder · Both |
| reason | STRING | No | `.` si es privado |
| regenerate_image | BOOLEAN | No | Reaplica el fondo ya asignado |

## `/schedule results`

**Solo ticket.** Rol judge. Hora ya pasada. El único empate permitido es **0 - 0**. Una declaración por schedule. El capitán no declara.

| Campo | Tipo | Obligatorio |
|---|---|---|
| team_1 | INTEGER | Sí | 0–99 |
| team_2 | INTEGER | Sí | 0–99 |
| notes | STRING | No | Máx. 500. Sale como **Remarks** |
| image1 … image10 | ATTACHMENT | No | Pruebas. Todas opcionales |

Publica el mismo embed en el ticket y en `result_channel`. Solo el ticket lleva encima el texto **Match Complete** con los capitanes, y esas menciones les hacen ping. Es la tarjeta del schedule, en verde, con la hora de la declaración (**Result UTC Time** / **Result Local Time**), más **Results** (marcador; el ganador lleva el trofeo) y **Links**. Links nace vacío: lo llenan `/attendance mark` y `/link add` llamando `attachResultsLinks` con la lista completa. `/link delete` y `/attendance delete` lo vacían. El título no lleva enlace hasta que `/bracket upload` transcriba el ticket y llame `attachResultsTranscript` con la URL de ese mensaje. No sube el bracket. Relación: `/bracket upload`, `/schedule results_delete`.

## `/schedule results_delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

Rol judge. No borra el schedule.
