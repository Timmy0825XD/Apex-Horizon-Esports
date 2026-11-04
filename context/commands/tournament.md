# Tournament

Reglas de producto: [../product/overview.md](../product/overview.md). Bracket: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Hojas almacenadas: [../domains/sheet.md](../domains/sheet.md).

## `/tournament add`

**Para qué:** Registrar un torneo operable. Admin u Organiser. Requiere `/settings set`.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| name | STRING | Sí | Nombre visible |
| id | STRING | Sí | Identidad del torneo en el bracket |
| key | STRING | Sí | Clave del bracket (se guarda cifrada) |
| sheet_link | STRING | Sí | Hoja de participantes |
| admin_role | ROLE | Sí | Organizer de *este* torneo |
| helper_role | ROLE | Sí | Helper de *este* torneo |
| attendance_channel | CHANNEL | Sí | Embeds de asistencia |
| transcript_channel | CHANNEL | Sí | HTML al cerrar por score |
| rules_channel | CHANNEL | Sí | Reglamento |
| deadline_channel | CHANNEL | Sí | Deadlines / info |
| result_channel | CHANNEL | Sí | `/schedule results add` |
| closed_ticket_category | CHANNEL (categoría) | Sí | Tickets cerrados |
| ticket_open_category_1 | CHANNEL (categoría) | Sí | Primera cola de tickets |
| ticket_open_category_2 | CHANNEL (categoría) | Sí | Desborde |
| close_ticket_category_2 | CHANNEL (categoría) | No | Desborde de cerrados |
| ticket_open_category_3 | CHANNEL (categoría) | No | Desborde |
| ticket_open_category_4 | CHANNEL (categoría) | No | Desborde |
| events_links | CHANNEL | No | Publicación de YouTube |

Valida bracket + layout de la hoja. Cada jugador tiene **5** columnas (tag, Discord ID, in-game name, in-game ID, Current Title). Detecta formato (`1vs1`…`5vs5`) y cuántos campos extra hay al final. En `1vs1` el tag del capitán es el nombre de Challonge; en `2vs2`, `3vs3`, `4vs4` y `5vs5` la primera columna es el equipo. La hoja tiene que ser **visible con el link**. Cruza cada in-game ID (ignorando espacios y caracteres invisibles) con la [lista oficial de baneados](https://docs.google.com/spreadsheets/d/17Xv8rF_UmKslmd_MBGiBf610xb2YleQJHivoc-6JqYU/edit?usp=sharing): si hay **uno o más**, **no** registra el torneo y lista quiénes son. **Copia la sheet a la BD** (`format` + `additionalFieldCount`). Máximo 4 torneos activos. Auto-room nace **apagado**; solo lo enciende `/room auto`. Audita.

## `/tournament edit`

**Para qué:** Parchear el mundo del torneo. Admin u Organiser. Mismos campos que add (excepto `id` de alta): `id` (autocomplete, obligatorio) + el resto opcional. No toca auto-room. Si cambia `sheet_link`, la copia almacenada se **reemplaza** y se vuelve a cruzar la lista oficial de IDs baneados (si hay coincidencias, no se aplica el cambio). Audita.

## `/tournament delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| id | STRING (Autocomplete) | Sí |

Apaga automatización y **borra la config del torneo** más todo lo que el bot guardó de ese mundo: partidos, salas, schedules y asistencias. **No** borra canales Discord, la hoja de Google ni el bracket externo. La copia de la sheet en BD **pasa a histórico** (sigue saliendo en `/sheet find player` / `/sheet get`). Admin u Organiser. Audita.

La respuesta es un V2 rojo `## Tournament Removed`. Lleva lo borrado (**Cleared**: matches, rooms, schedules, attendance) y lo que se queda (**Left in place**) en una línea cada uno, y el footer `Removed by` con hora y la mención de `/sheet find player`.

## `/tournament info` / `/tournament list`

Info: un torneo completo. List: todos del servidor (efímero), con `N of 4 slots used`, una línea por torneo (formato y auto-room **On**/**Off**), el bracket en `-#` y el footer con la mención de `/tournament info`. No mutan. No auditan. Admin u Organiser.

El panel V2 de add / edit / info lleva:

- Título `##`: en `info` es el nombre con el bracket en `-#`; en `add` / `edit`, *Tournament Registered* / *Tournament Updated*.
- Una línea de identidad (formato, columnas extra, auto-room, API key).
- Si algo ya no existe, aviso con `alert`.
- El botón **Open sheet**.
- `### Roles`, `### Channels` (emparejados de dos en dos en la misma línea) y `### Ticket Categories`.

`edit` dice cuántos valores cambiaron y marca cada uno con *updated*. Omite categorías de tickets (y el canal Events Links) que no estén configuradas: no muestra *Not configured*. Footer en `info`: *Created by* con mención de quien registró el torneo.

## `/tournament report`

**Para qué:** Exportar el dossier del torneo. **Organiser**. Efímero. No muta. No audita.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

Al ejecutarse, lee el bracket de Challonge **una vez** (con la key guardada del torneo) para que el avance sea el de ese momento. Si Challonge no responde, usa los partidos guardados en la última sincronización de salas y lo dice en el libro y en Discord. No escribe nada en el almacén.

**Respuesta (Components V2):** icono del servidor, nombre del torneo y la etapa en curso (la primera, en orden de bracket, con partidos sin terminar; *Bracket complete* si no queda ninguna). Bloque **Progress**: partidos completos / total y porcentaje, abiertos y pendientes. Bloque **Records**: asistencias, resultados y personas en el tablero. Bloque **To do**: cuántos pendientes hay, el desglose de los de prioridad alta y cuántos de menor prioridad quedan en el libro; si no hay ninguno, *Nothing to fix*. Luego el **File** `.xlsx` y el pie con quién lo pidió y de dónde salió el bracket.

El libro tiene siete hojas, en este orden. Los nombres de usuario, rol y canal van en texto plano, con el ID al lado. La API key no se escribe.

| Hoja | Qué lleva |
|---|---|
| Overview | Cifras clave (partidos completos, abiertos, resultados, asistencias con DW, pendientes con los de prioridad alta), avance por etapa (partidos, completos, abiertos, pendientes, barra y %, tickets, asistencias, resultados, fila total), las 5 personas con más trabajo y los schedules (total, completados, atrasados, próximos, próximos con juez y recorder, tiempo medio hasta el resultado). |
| To do | Pendientes, ordenados por prioridad y luego por orden de bracket. Cada fila: prioridad, comprobación, etapa, partido, ticket, comando con que se resuelve y detalle. Si no hay ninguno, lo dice. Ver la tabla de comprobaciones abajo. |
| Schedules | Todos los schedules, con o sin resultado, en orden de bracket. Estado (*Completed*, *Overdue*, *Upcoming*), hora programada, hora del resultado, minutos hasta el resultado, juez y recorder (*Open* si falta), quién confirmó *Present*, marcador, ticket y nota. |
| Attendance | Marcas activas, en orden de bracket. Etapa, partido, ticket, juez, recorder, si ocupó los dos puestos, marcador, juegos, ganador, `DW`, grabaciones, prueba del resultado si existe, si hay resultado declarado, quién marcó y cuándo. Las borradas no entran. |
| Work count | Una fila por persona. Rondas y juegos como juez, como recorder y en ambos puestos. Los `DW` entran en esa cubeta y además se listan aparte; esa columna no se suma a las rondas. No muestra oro. La tarifa del encabezado sale del formato guardado. |
| Results | Declaraciones de `/schedule results add`, en orden de bracket. Marcador, ganador, empate, decisión o default win (si la asistencia activa es `DW`), staff del schedule, quién declaró, cuándo, hora programada, minutos hasta el resultado, si hay asistencia, notas, nota del schedule, transcript, grabaciones y pruebas. |
| Configuration | Identidad, roles, canales, categorías, auto-room, alta del mundo y un snapshot: de dónde salió el bracket, partidos en el bracket, salas, schedules, resultados y asistencias. Lo que no está configurado sale como *Not configured*. |

**Comprobaciones de To do:**

| Prioridad | Comprobación | Se resuelve con |
|---|---|---|
| Alta | Partido completo en el bracket que tuvo ticket y no tiene asistencia activa. Los partidos cerrados sin ticket (forfeits automáticos) no cuentan. | `/attendance mark` |
| Alta | Schedule cuya hora ya pasó y no tiene resultado declarado. | `/schedule results add` |
| Alta | Schedule en las próximas **24 horas** sin juez, sin recorder o sin ambos. | `/schedule update` |
| Media | Ticket abierto de un partido ya completo en el bracket. | `/ticket close` |
| Media | Resultado declarado sin asistencia activa. | `/attendance mark` |
| Baja | Asistencia activa sin grabaciones, salvo `DW`. | `/link add` |
| Baja | Partido abierto en el bracket sin ticket. | `/room create` |

## `/tournament role`

**Para qué:** Dar un rol Discord a jugadores de un torneo operable, por columna de **Discord ID**. **Organiser**. Lee la hoja **viva**. Audita si se asignó al menos un rol.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| role | ROLE | Sí |
| id_header | STRING (Autocomplete) | No |

`tournament` lista los torneos **de ese servidor**. `id_header` lista **solo** las columnas de Discord ID de ese formato: `1vs1` → 1 header, `2vs2` → 2, y así hasta `5vs5`. Los demás headers de la hoja no aparecen. El valor interno es el slot (capitán = 0). Los nombres salen de la fila 1 almacenada, o del contrato canónico (`Captain Discord ID`, `Player 2 Discord ID`, …).

Con `id_header`: asigna el rol a los jugadores de **esa** columna (Discord ID). Sin `id_header`: **todos** los jugadores de todas las columnas de Discord ID, pero **antes** un V2 de confirmación (qué rol, a quién, qué se omite). Es un aviso naranja con las columnas y los jugadores en una línea y dos viñetas (qué se omite, que no se puede deshacer). Los botones **Give to all players** (rojo) / **Cancel** solo los pulsa quien lanzó el comando, como dice el `-#` de encima. Sin confirmación no se asigna nada; cancelar deja *Role Assignment Cancelled* con `Cancelled by`.

El resultado es **un solo** V2: *Role Given to Players* con torneo y alcance en `-#` y todos los conteos en una línea (Given, Already had it, Not in server, Banned, Invalid ID, Failed). Debajo, solo los grupos con gente, cada uno con su conteo en el título: quienes recibieron el rol como menciones seguidas, y los problemas en viñetas con equipo e ID. Verde si todo salió, naranja si hubo saltos, rojo si no se dio a nadie. Footer `Given by` con hora.

Resuelve por Discord ID (snowflake). Omite y reporta: IDs inválidos o vacíos, no están en el servidor, ya tenían el rol, o están baneados (usuario o ID de juego oficial). En Discord **no** menciona la hoja.

## `/tournament validate`

**Para qué:** Comprobar que cada slot del formato está en el servidor y tiene el `verified_role` de `/settings`. **Organiser**. Lee la hoja **viva**. Si abre al menos un ticket, audita (**Tournaments**).

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| tournament | STRING (Autocomplete) | Sí | Torneo de ese servidor |
| category | CHANNEL (categoría) | Sí | Donde se crean los tickets |
| transcript_channel | CHANNEL | Sí | Destino del transcript de esos tickets |
| secondary_category | CHANNEL (categoría) | No | Desborde cuando la primera llega a **50** canales |

Cada slot del formato (`1vs1`…`5vs5`) queda en uno de tres resultados:

| Resultado | Cuándo |
|---|---|
| verified | En el servidor y con el rol |
| missing_role | En el servidor, sin el rol |
| not_in_server | No está, el ID no es un snowflake, o la celda de Discord está vacía. Un hueco del formato cuenta como fallo |

El equipo pasa solo si **todos** sus slots están `verified`. Esos equipos no reciben canal.

Si no pasa, se abre un canal de texto en `category` (o en `secondary_category` si la primera está llena, **50** canales). `@everyone` no lo ve. Lo ven el admin y el helper **de ese torneo**, más un miembro del roster: el capitán si está en el servidor; si no está o Discord no lo dejó entrar, el siguiente slot, en orden, hasta que uno quede dentro. Si nadie del equipo está en el servidor, no se crea canal y el equipo sale en la lista **No one to add** de la respuesta.

Al crear el canal se publica un Components V2 y, después, un mensaje de texto:

1. Título: `Group Validation Ticket`
2. Separador
3. Reglas: todos los registrados deben estar verificados. Menciona el `verified_role` de `/settings` y, al cerrar, el `admin_role` del torneo (sin ping en el V2)
4. Separador
5. Subtítulo **Issues**: una línea por slot con problema, `- @usuario **tag** -` y el mismo rótulo que Verification en `/team info` (`Not verified` o `Not in server`, con el emoji de error). Sin ID válido no hay mención: va el tag o el nombre del slot
6. Mensaje de texto que menciona a quien quedó en el canal: *Please read this and take care of solving it as soon as possible.*

El topic del canal queda `Group validation | Tournament ID: <id de Challonge> | Transcript: <id del canal>`. Ese canal es el de `transcript_channel` de este comando, no el transcript de las salas. Este comando no genera el HTML. `/ticket close` dentro de ese canal avisa en efímero que se borra en **5** segundos, envía el transcript al canal anotado y borra el canal. `reopen` y `delete` no lo archivan. La respuesta de `validate` se publica en el canal donde se usó:

- Un V2 con el título según el resultado, y el torneo con el `verified_role` en una línea.
- **Checked**, **Verified**, **Tickets** y **No one to add** en una línea.
- Las categorías y el canal de transcripts en otra, y una frase corta.
- Debajo, solo las secciones con contenido (*Opened*, *No One to Add*, *Category Full*, *Could Not Continue*, *Channel Not Created*). Cada una lleva el conteo en el título y los canales o equipos seguidos.
- Naranja si quedan huecos.
- Footer `Requested by` con hora.
