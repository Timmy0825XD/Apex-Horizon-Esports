# Tournament

Reglas de producto: [../product/overview.md](../product/overview.md). Bracket: [../domains/bracket-rooms.md](../domains/bracket-rooms.md). Hojas almacenadas: [../domains/sheet.md](../domains/sheet.md).

## `/tournament add`

**Para qué:** Registrar un torneo operable. Admin. Requiere `/settings set`.

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
| result_channel | CHANNEL | Sí | `/schedule results` |
| closed_ticket_category | CHANNEL (categoría) | Sí | Tickets cerrados |
| ticket_open_category_1 | CHANNEL (categoría) | Sí | Primera cola de tickets |
| ticket_open_category_2 | CHANNEL (categoría) | Sí | Desborde |
| close_ticket_category_2 | CHANNEL (categoría) | No | Desborde de cerrados |
| ticket_open_category_3 | CHANNEL (categoría) | No | Desborde |
| ticket_open_category_4 | CHANNEL (categoría) | No | Desborde |
| events_links | CHANNEL | No | Publicación de YouTube |

Valida bracket + layout de la hoja. Cada jugador tiene **5** columnas (tag, Discord ID, in-game name, in-game ID, Current Title). Detecta formato (`1vs1`…`5vs5`) y cuántos campos extra hay al final. En `1vs1` el tag del capitán es el nombre de Challonge; en `2vs2`, `3vs3`, `4vs4` y `5vs5` la primera columna es el equipo. La hoja tiene que ser **visible con el link**. Cruza cada in-game ID (ignorando espacios y caracteres invisibles) con la [lista oficial de baneados](https://docs.google.com/spreadsheets/d/17Xv8rF_UmKslmd_MBGiBf610xb2YleQJHivoc-6JqYU/edit?usp=sharing): si hay **uno o más**, **no** registra el torneo y lista quiénes son. **Copia la sheet a la BD** (`format` + `additionalFieldCount`). Máximo 4 torneos activos. Auto-room nace **apagado**; solo lo enciende `/auto_room`. Audita.

## `/tournament edit`

**Para qué:** Parchear el mundo del torneo. Admin. Mismos campos que add (excepto `id` de alta): `id` (autocomplete, obligatorio) + el resto opcional. No toca auto-room. Si cambia `sheet_link`, la copia almacenada se **reemplaza** y se vuelve a cruzar la lista oficial de IDs baneados (si hay coincidencias, no se aplica el cambio). Audita.

## `/tournament delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| id | STRING (Autocomplete) | Sí |

Apaga automatización y **borra la config del torneo** más todo lo que el bot guardó de ese mundo: partidos, salas, schedules y asistencias. **No** borra canales Discord, la hoja de Google ni el bracket externo. La copia de la sheet en BD **pasa a histórico** (sigue saliendo en `/sheet find_player` / `/sheet get`). Admin. Audita.

## `/tournament info` / `/tournament list`

Info: un torneo completo. List: todos del servidor (efímero). No mutan. No auditan. Público.

El panel V2 de add / edit / info separa **Identity**, **Roles**, **Channels** y **Ticket categories**. Omite categorías de tickets (y el canal Events Links) que no estén configuradas: no muestra *Not configured*. Footer: *Created by* con mención de quien registró el torneo.

## `/tournament role`

**Para qué:** Dar un rol Discord a jugadores de un torneo operable, por columna de **Discord ID**. **Organiser**. Lee la hoja **viva**. Audita si se asignó al menos un rol.

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| role | ROLE | Sí |
| id_header | STRING (Autocomplete) | No |

`tournament` lista los torneos **de ese servidor**. `id_header` lista **solo** las columnas de Discord ID de ese formato: `1vs1` → 1 header, `2vs2` → 2, y así hasta `5vs5`. Los demás headers de la hoja no aparecen. El valor interno es el slot (capitán = 0). Los nombres salen de la fila 1 almacenada, o del contrato canónico (`Captain Discord ID`, `Player 2 Discord ID`, …).

Con `id_header`: asigna el rol a los jugadores de **esa** columna (Discord ID). Sin `id_header`: **todos** los jugadores de todas las columnas de Discord ID, pero **antes** un V2 de confirmación (qué rol, a quién, qué se omite). Botones Confirm / Cancel; solo quien lanzó el comando puede pulsarlos. Sin confirmación no se asigna nada.

Resuelve por Discord ID (snowflake). Omite y reporta: IDs inválidos o vacíos, no están en el servidor, ya tenían el rol, o están baneados (usuario o ID de juego oficial). En Discord **no** menciona la hoja.
