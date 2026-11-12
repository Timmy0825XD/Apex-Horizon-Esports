# Schedule

Reglas: [../domains/schedules.md](../domains/schedules.md). Todos los de creación/cambio **excepto show / unassigned** se auditan.

Todo lo que publica la familia es **Components V2**, también el post del schedule (ticket y canal de schedules), la declaración de results y el aviso **New Schedule**. Las respuestas de `/schedule update` son **efímeras**. El capitán no ejecuta ningún subcomando.

Pings: en Components V2 una mención dentro de un **Text Display** notifica según `allowed_mentions` (en un embed no). Los mensajes que avisan a alguien ponen las menciones en un Text Display propio, **encima** de la tarjeta, y limitan `allowed_mentions` a esas personas o roles; las menciones de dentro de la tarjeta no vuelven a notificar. Editar nunca notifica, así que un ping nuevo (por ejemplo, `update`) publica otro mensaje y borra el anterior. Un post del schedule anterior al rediseño (embed) se sustituye por uno V2 la próxima vez que se repinta; un post de results anterior se sigue repintando como embed.

| Mensaje | Línea de arriba | Notifica |
|---|---|---|
| Post del schedule en el ticket | Capitanes (y staff tras `update`) | Sí: capitanes al crear, capitanes y staff al actualizar; al repintar sin ping, no |
| Post del canal de schedules | Capitanes | No |
| Results en el ticket | `Match Complete!` y capitanes | Sí, a los capitanes |
| Results en `result_channel` | — | No |
| New Schedule en el staff chat | Rol de cada puesto libre | Sí, a esos roles |

Molde de las tarjetas (`respond.ts`): eyebrow `-#` con torneo y fase, título `##` con emoji de `emojis.ts`, bloques separados, botones dentro del container y footer `-#` con autor y hora. Color por estado: azul informa, verde confirma, dorado pendiente, naranja avisa (no se pudo, puesto tomado, botones cerrados, choque de horario), rojo borra, urge o falla. Todos los errores de la familia usan esa tarjeta. Solo el éxito de `create` (**Schedule created** y **Finish manually**) y el de `update` (**Schedule updated** y **Find a replacement**) conservan su tarjeta anterior (`legacyNotice`).

Los avisos de asignar, renunciar o liberar un puesto en el ticket (desde `create`, `update`, botón Assign, `resign` y el worker de T-0) son un V2 de una línea con ping a la persona: verde al tomar el puesto, naranja al dejarlo. La confirmación de asistencia es otro V2 verde de una línea, sin ping.

| Subcomando | Quién |
|---|---|
| `create` · `update` · `delete` | Admin o helper **de ese torneo**, u Organiser |
| `show` · `unassigned` | Admin, Organiser, helper de un torneo o rol **staff** |
| `refresh` | Organiser, helper de un torneo, **staff**, **judge** o **recorder** |
| `results add` · `results delete` | Rol **judge** del servidor |
| `resign` | Solo quien está asignado a ese schedule, dentro del ticket |

## `/schedule create`

**Solo ticket.** Admin o helper del torneo, u Organiser. Requiere canal de schedules.

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
| notify | BOOLEAN | No | Si es `false`, no se manda **New Schedule** al staff chat. Si se omite o es `true`, se manda cuando queda un puesto libre |

Mínimo +10 minutos. Máximo **4** schedules vivos en el mismo minuto UTC del servidor (*Time slot full*). `judge` y `recorder` no pueden tener otro schedule vivo a menos de 30 minutos (*Staff already booked*). Detalle en [domains/schedules.md](../domains/schedules.md#cupo-por-minuto-y-choques-de-staff). Marca `🔴`. Admin o helper del torneo, u Organiser. El orden y qué bloquea viven en [domains/schedules.md](../domains/schedules.md#al-crear). Si fallan el thumbnail, el acceso del staff, el post del ticket o el post del canal de schedules, se borra todo y el comando responde el error. El `🔴`, el evento, el aviso de asignación, **New Schedule** y la auditoría no bloquean: lo que falle se lista en un efímero **Finish manually** para quien creó. Si el create trae juez o recorder, el ticket publica el mismo texto plano que el botón Assign, después del ping a capitanes; si es la misma persona en los dos puestos, sale un solo aviso. Encima de la tarjeta, el ticket y el canal de schedules mencionan a los dos capitanes. Tarjeta del ticket (amarilla): eyebrow con torneo y fase, título con los emojis `torneo` y `vs`, hora UTC y local en una línea, la miniatura en galería, **Captains** (cada capitán en su fila con el nombre de su equipo), **Staff** (*Open* si falta), el remark en cita solo si hay, y footer *Created by*. Tarjeta del canal de schedules: lo mismo sin **Captains**, con **Assign** y el botón de enlace **Open ticket** en la misma fila, y footer con hasta cuándo se puede reclamar. **New Schedule** (staff chat, dorado): sección con el GIF de Tenor como thumbnail (URL directa `media.tenor.com`), qué partido necesita qué puesto, hora UTC y local, botón **Go to Assign** al post del canal de schedules y footer *Created by*. El ping sale solo en el ticket y solo a ellos. La respuesta al crear es un Components V2: **Schedule created** y `Match scheduled successfully. Thumbnail generated.` Sale cuando todo el comando terminó. El thumbnail se compone sobre el fondo rotativo con icono del servidor, torneo, etapa (`ROUND n`, `SEMIFINAL`, `FINAL`, `3RD PLACE`…), equipos, fecha y hora UTC y nombre del servidor; los nombres demasiado anchos reducen fuente y luego terminan en elipsis. Relación: attendance, results, worker T-10/T-0, thumbnails de settings.

## `/schedule update`

**Solo ticket.** Admin o helper del torneo, u Organiser. La respuesta del comando, tanto si se actualizó como si falló, es **efímera**. El ticket vuelve a publicar el schedule: el texto menciona a los capitanes y, si hay juez o grabador asignado, también a ellos, y ese mensaje hace ping. El canal de schedules muestra las mismas menciones y no vuelve a notificar. `hour`, `minute`, `day`, `month` y `year` son opcionales y se pueden mandar de uno en uno: el trozo que falta se conserva. La fecha resultante no puede estar en el pasado ni a menos de 10 minutos en el momento del comando. También `judge`, `recorder`, `note`, `remove_judge`, `remove_recorder`, `reason`, `regenerate_image`. Al menos un campo. `judge` y `recorder` solo se aceptan si ese usuario tiene el rol correspondiente; si no, no se actualiza nada. Si el schedule ya tiene resultados o el ticket está cerrado, asignar juez o recorder no cambia nada: el partido ya concluyó. Quitar un puesto, la hora, la nota y regenerar la imagen siguen permitidos. Asignar publica en el ticket el texto del botón Assign. Quitar o reemplazar publica el texto de resign del puesto anterior y, si entra alguien nuevo, el de Assign. Recalendarizar resetea recordatorios y reconstruye el thumbnail con la fecha/hora actualizada. La nueva hora no puede caer en un minuto con 4 schedules vivos. `judge` / `recorder` nuevos no pueden tener otro schedule vivo a menos de 30 minutos. Si con la nueva hora el staff que sigue asignado choca con otro partido suyo, sale del puesto: el ticket lo anuncia y la respuesta efímera añade **Find a replacement** con los nombres. `regenerate_image` reconstruye la composición con el fondo ya asignado y los datos actuales sobre los posts del schedule, el post del canal de thumbnails y el evento. No avanza la rotación.

## `/schedule show`

Cualquier canal. Admin, Organiser, helper de un torneo o rol **staff**. No audita. Siempre **Components V2** en el canal, sin ping. Muestra schedules de cualquier estado mientras el torneo **siga registrado** en el servidor. Si el torneo se borró, ese schedule no sale.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| match | STRING (Autocomplete) | No | Abre la ficha de ese schedule. Se ve `lado vs lado`; el valor es el id interno. Si viene, gana sobre el resto. |
| filter | STRING (Choice) | No | `all` · `pending` · `past` · `overdue`. Por defecto `all`. |
| tour | STRING (Autocomplete) | No | Solo ese torneo. |
| user | USER | No | Schedules donde esa persona es juez o recorder. |

Sin `match`, lista. `tour`, `user` y `filter` se combinan. Sin ninguno, lista todos los schedules de torneos que siguen existiendo. 5 por página, el más reciente primero. Eyebrow con filtro, torneo y staff si se pasaron; título **Schedules**; una línea con los conteos por estado de todo el filtro. Las filas se agrupan por estado (`###`). Cada fila es una sección: enfrentamiento, hora relativa y UTC corta, ronda (y torneo si no se filtró por torneo), y la línea de staff con *Open* en el puesto vacío; a la derecha, botón **Ticket**. Paginación dentro del container y footer *Requested by*. Color: azul con `all`, dorado `pending`, verde `past`, rojo `overdue`. Las flechas las pulsa quien puede usar `/schedule show`.

Estados:

- **Pending**: hora futura y sin declaración.
- **Completed**: hay `/schedule results add`.
- **Result pending**: la hora ya pasó y no hay declaración.

`past` (Past/Completed) incluye Completed y Result pending.

La ficha de `match`: eyebrow con torneo, grupo y ronda; título `lado vs lado`; línea de estado (con resultado: hora y quién lo subió; sin resultado: hora programada y relativa) e ID del partido; la miniatura del schedule. Con declaración, bloque **Result** (marcador con el trofeo y remarks en cita); sin declaración, el **Remark** si lo hay. Bloque **People**: capitanes, juez y recorder con *confirmed* si confirmaron. Al final, botones de enlace: **Ticket**, **Schedule post**, **Results post**, **Transcript** y **Recording N**. Las pruebas del resultado no se muestran en la ficha: se abren desde **Results post**. Verde si está completado, dorado si está pendiente, rojo si el resultado está atrasado. Footer *Requested by*.

## `/schedule delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

`confirm=False` cancela (V2 azul *Delete cancelled* con el partido). Quita `🔴`. Arrastra lo que cuelga del schedule: si tenía `/schedule results add`, quita la declaración (posts del ticket y del canal de resultados); si el partido tenía asistencia activa, la borra en suave (motivo `Schedule deleted`, más el `reason` si se dio) y quita sus avisos del ticket y del canal de asistencia. Los posts de `events_links` no se tocan, igual que en `/attendance delete`. No deshace `/bracket upload`. La auditoría lista el resultado y la asistencia quitados. Admin o helper del torneo, u Organiser. La respuesta es un V2 rojo **Schedule deleted**: el partido y la hora que tenía, qué se quitó (incluidos el resultado y la asistencia si los había), el motivo en cita si se dio, cómo volver a programarlo con `/schedule create` y footer *Deleted by*.

## `/schedule unassigned`

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| filter | STRING (Choice) | No | `any` · `all` · `missing_judge` · `missing_recorder`. Por defecto `any` |

Cualquier canal. Admin, Organiser, helper de un torneo o rol staff. No audita. Components V2 en el canal, sin ping, 5 por página. Solo schedules cuyo torneo sigue registrado, sin `/schedule results add` y con el ticket abierto. Un resultado o un ticket cerrado deja ese schedule fuera de la lista. Título **Open Seats**, eyebrow con el filtro y una línea con cuántos hay de cada hueco. Las filas se agrupan en **Both seats open**, **Judge open** y **Recorder open** (`###`), y dentro de cada grupo van por hora. Cada fila es una sección: enfrentamiento, hora relativa y UTC corta, torneo y ronda, y la línea de staff con *Open* en el puesto vacío; a la derecha, botón verde **Claim** que lleva al post del canal de schedules (donde están los Assign). Paginación dentro y footer *Requested by*. Sin filas: V2 verde *No open seats*. Las flechas las pulsa quien puede usar el comando.

## `/schedule refresh`

**Cualquier canal.** Organiser, helper de un torneo, staff, judge o recorder. `admin_role` no entra. Abre otra vez los botones de reclamar durante 10 minutos. Un puesto ya ocupado sigue apagado. No cambia la hora. La respuesta es un V2 azul **Claim buttons reopened**: el partido, hasta qué hora siguen abiertos los Assign, la línea de staff, el botón **Go to schedule post** y footer *Refreshed by*. El autocomplete solo lista schedules cuya hora UTC aún no pasó, sin resultado y con el ticket abierto. Si la hora ya pasó, no abre la ventana. Si el schedule ya tiene resultados o el ticket está cerrado, tampoco: responde que el partido concluyó y deja los Assign apagados.

| Campo | Tipo | Obligatorio |
|---|---|---|
| match | STRING (Autocomplete) | Sí | Solo schedules refrescables: hora UTC futura, sin resultado y ticket abierto (`lado vs lado | torneo | fecha UTC`) |

## `/schedule resign`

**Solo ticket, solo el asignado.**

| Campo | Tipo | Obligatorio |
|---|---|---|
| role | STRING (Choice) | No | Judge · Recorder · Both |
| reason | STRING | No | `.` si es privado |
| regenerate_image | BOOLEAN | No | Reaplica el fondo ya asignado |

Publica en el ticket un V2 naranja **Seat released** con ping a quien renuncia: qué puesto (o los dos) deja y de qué partido, el motivo en cita (con `.` no se muestra) y que el puesto vuelve a `/schedule unassigned`.

## `/schedule results add`

**Solo ticket.** Rol judge. Hora ya pasada. El único empate permitido es **0 - 0**. Una declaración por schedule. El capitán no declara.

| Campo | Tipo | Obligatorio |
|---|---|---|
| team_1 | INTEGER | Sí | 0–99 |
| team_2 | INTEGER | Sí | 0–99 |
| notes | STRING | No | Máx. 500. Sale como **Remarks** |
| image1 … image10 | ATTACHMENT | No | Pruebas. Todas opcionales |

Publica la misma tarjeta V2 verde en el ticket y en `result_channel`. Solo el ticket lleva encima la línea **Match Complete!** con los capitanes, y esas menciones les hacen ping. La tarjeta: eyebrow con torneo y fase, título `lado vs lado`, hora de la declaración (UTC y local), bloque **Result** (marcador; el ganador lleva el trofeo junto a su nombre, el título de la sección no lleva emoji), notes en cita, bloque **Staff**, galería con las pruebas (adjuntos renombrados `proof-N.ext` y mostrados con `attachment://`), botones **Recording N**, y footer *Uploaded by*. **No** hay botón de Transcript: cuando existe, cada nombre del título `lado VS lado` es un enlace al mensaje del transcript; el emoji `VS` queda fuera de los enlaces porque Discord no pinta un enlace cuyo texto lleva un emoji personalizado. Los botones de grabación nacen vacíos: los llenan `/attendance mark` y `/link add` llamando `attachResultsLinks` con la lista completa. `/link delete` y `/attendance delete` los vacían. El enlace del título aparece cuando `/bracket upload` transcribe el ticket y llama `attachResultsTranscript` con la URL de ese mensaje. Al repintar, el bot lee las pruebas de la galería del propio mensaje (en Components V2 Discord no las devuelve como adjuntos), las vuelve a subir con la edición y la galería apunta a esos archivos; si no puede descargarlas, conserva las imágenes por URL en vez de quitar la galería. Las URLs que se guardan como prueba también salen de la galería. No sube el bracket. Relación: `/bracket upload`, `/schedule results delete`.

## `/schedule results delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| confirm | BOOLEAN | Sí |
| reason | STRING | No |

Rol judge. No borra el schedule. Responde con un V2 rojo **Result removed**: el marcador que se quitó, de dónde, el motivo en cita, que el bracket no cambió y cómo volver a declarar; footer *Removed by*.
