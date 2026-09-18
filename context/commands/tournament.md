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
| auto_room_creation | BOOLEAN | Sí | Capacidad de automatizar (no abre salas solo) |
| close_ticket_category_2 | CHANNEL (categoría) | No | Desborde de cerrados |
| ticket_open_category_3 | CHANNEL (categoría) | No | Desborde |
| ticket_open_category_4 | CHANNEL (categoría) | No | Desborde |
| events_links | CHANNEL | No | Publicación de YouTube |

Valida bracket + layout de la hoja. Cada jugador tiene **5** columnas (tag, Discord ID, in-game name, in-game ID, Current Title). Detecta formato (`1vs1`…`5vs5`) y cuántos campos extra hay al final. En `1vs1` el tag del capitán es el nombre de Challonge; en `2vs2`, `3vs3`, `4vs4` y `5vs5` la primera columna es el equipo. La hoja tiene que ser **visible con el link**. Cruza cada in-game ID (ignorando espacios y caracteres invisibles) con la [lista oficial de baneados](https://docs.google.com/spreadsheets/d/17Xv8rF_UmKslmd_MBGiBf610xb2YleQJHivoc-6JqYU/edit?usp=sharing): si hay **uno o más**, **no** registra el torneo y lista quiénes son. **Copia la sheet a la BD** (`format` + `additionalFieldCount`). Máximo 4 torneos activos. Audita.

## `/tournament edit`

**Para qué:** Parchear el mundo del torneo. Admin. Mismos campos que add (excepto `id` de alta): `id` (autocomplete, obligatorio) + el resto opcional. Cambiar `auto_room_creation` afecta al worker al instante. Si cambia `sheet_link`, la copia almacenada se **reemplaza** y se vuelve a cruzar la lista oficial de IDs baneados (si hay coincidencias, no se aplica el cambio). Audita.

## `/tournament delete`

| Campo | Tipo | Obligatorio |
|---|---|---|
| id | STRING (Autocomplete) | Sí |

Apaga automatización y **borra la config del torneo** más todo lo que el bot guardó de ese mundo: partidos, salas, schedules y asistencias. **No** borra canales Discord, la hoja de Google ni el bracket externo. La copia de la sheet en BD **pasa a histórico** (sigue saliendo en `find_player` / `get_sheet`). Admin. Audita.

## `/tournament add_sheet`

**Para qué:** Meter una hoja al archivo **global** del bot, sin crear un torneo operable. Detecta formato y extra igual que add. Admin. Audita.

Tres campos, todos opcionales; se elige **un** modo:

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| link | STRING | No* | URL de la hoja |
| name | STRING | No* | Nombre del torneo (etiqueta en el archivo) |
| csv | ATTACHMENT | No* | Varias hojas a la vez |

\*Una hoja: **link** y **name** van juntos y son obligatorios. Varias hojas: solo **csv**. No mezclar CSV con link/name.

CSV: columna 1 = nombre del torneo, columna 2 = URL de la Google Sheet. **Sin fila de headers**; se lee desde la fila 1. Acepta coma, punto y coma (Excel en español) o tab. Máximo 40 filas. Filas vacías se ignoran. Un link que ya está en el archivo global se omite.

La copia guarda el servidor de origen (`guildId` + nombre) para mostrarlo en `find_player` y `get_sheet`, pero el pozo de búsqueda es de **todo el bot**.

## `/tournament get_sheet`

**Para qué:** Recuperar el link de una hoja archivada por **nombre de torneo**, o exportar el catálogo entero. Lectura; no audita. Público; respuesta efímera.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| name | STRING (Autocomplete) | No* | Nombre en el archivo global |
| csv | BOOLEAN | No* | CSV de todos los torneos + links |

\*Al menos uno. Se pueden usar los dos a la vez.

Autocomplete lista las sheets almacenadas de **todo el bot** (nombre · servidor). El valor interno es el id de la copia. Si el texto no es un id, busca por nombre (exacto primero, si no contiene). Varias coincidencias → varias líneas, cada una con servidor y `[Click Here](url)`.

CSV: columnas `Tournament,Sheet,Server` (con header). Incluye activas, manuales e históricas.

## `/tournament find_player`

**Para qué:** Buscar una persona en **todas** las sheets almacenadas del bot (cualquier servidor). Lectura; no audita. Relación: distinto de `/team info` (ese mira la hoja **viva** de un torneo). Público; respuesta efímera.

| Campo | Tipo | Obligatorio |
|---|---|---|
| game_id | STRING | No* |
| discord_id | STRING | No* |
| discord_tag | STRING | No* |
| player_name | STRING | No* |

\*Al menos uno. Varios rellenos = **OR**.

Un V2 **por jugador distinto**: datos del capitán (y nombre de equipo si no es 1vs1) + lista de sheets. Cada sheet enseña **el servidor** al que pertenece. Los campos extra de la hoja **no** entran aquí. Varios jugadores → varios V2, cada uno con copy de *ese* jugador.

## `/tournament info` / `/tournament list`

Info: un torneo completo. List: todos del servidor (efímero). No mutan. No auditan. Público.

El panel V2 de add / edit / info separa **Identity**, **Roles**, **Channels** y **Ticket categories**. Omite categorías de tickets (y el canal Events Links) que no estén configuradas: no muestra *Not configured*. Footer: *Created by* con mención de quien registró el torneo.
