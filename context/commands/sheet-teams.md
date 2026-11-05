# Sheet y equipos

Reglas: [../domains/sheet.md](../domains/sheet.md).

## `/sheet add`

**Para qué:** Meter una hoja al archivo **global** del bot, sin crear un torneo operable. Detecta formato y extra igual que `/tournament add`. Admin. Audita.

Tres campos, todos opcionales; se elige **un** modo:

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| link | STRING | No* | URL de la hoja |
| name | STRING | No* | Nombre del torneo (etiqueta en el archivo) |
| csv | ATTACHMENT | No* | Varias hojas a la vez |

\*Una hoja: **link** y **name** van juntos y son obligatorios. Varias hojas: solo **csv**. No mezclar CSV con link/name.

CSV: columna 1 = nombre del torneo, columna 2 = URL de la Google Sheet. **Sin fila de headers**; se lee desde la fila 1. Acepta coma, punto y coma (Excel en español) o tab. Máximo 40 filas. Filas vacías se ignoran. Un link que ya está en el archivo global se omite.

La copia guarda el servidor de origen (`guildId` + nombre) para mostrarlo en `find player` y `get`, pero el pozo de búsqueda es de **todo el bot**.

Respuesta para una sola hoja: V2 verde `## Sheet Archived` con *Global archive · not an operable tournament* en `-#`. Debajo, torneo, formato y equipos en una línea, y el servidor de origen con las columnas extra en otra. Después el botón de enlace **Open sheet** y el footer `Archived by` con mención, hora y la mención de `/sheet find player`. Con CSV: *Sheets Archived* con una línea por hoja (nombre · formato · equipos · enlace). Las omitidas y las fallidas van en bloques propios (azul y rojo), cada uno con el conteo en el título y una viñeta por fila con el motivo.

## `/sheet get`

**Para qué:** Recuperar el link de una hoja archivada por **nombre de torneo**, o exportar el catálogo entero. Lectura; no audita. Admin u Organiser; respuesta efímera.

| Campo | Tipo | Obligatorio | Uso |
|---|---|---|---|
| name | STRING (Autocomplete) | No* | Nombre en el archivo global |
| csv | BOOLEAN | No* | CSV de todos los torneos + links |

\*Al menos uno. Se pueden usar los dos a la vez.

Autocomplete lista las sheets almacenadas de **todo el bot** (nombre · servidor). El valor interno es el id de la copia. Si el texto no es un id, busca por nombre (exacto primero, si no contiene). Una coincidencia: el nombre del torneo es el título `##`, con el origen (*historical*, *manual archive*, *active tournament*) en `-#`. Debajo van el formato y el servidor, y el botón **Open sheet**. Varias coincidencias: *Sheets Matched* con el conteo y una línea por hoja (nombre · formato · origen · servidor · `[Click Here](url)`). El catálogo CSV va con el conteo, el componente File y el footer `Exported by`.

CSV: columnas `Tournament,Sheet,Server` (con header). Incluye activas, manuales e históricas. Archivo `tournament-sheets.csv`.

## `/sheet find player`

**Para qué:** Buscar una persona en **todas** las sheets almacenadas del bot (cualquier servidor). Lectura; no audita. Relación: distinto de `/team info` (ese mira la hoja **viva** de un torneo). Admin u Organiser; respuesta efímera.

| Campo | Tipo | Obligatorio |
|---|---|---|
| game_id | STRING | No* |
| discord_id | STRING | No* |
| discord_tag | STRING | No* |
| player_name | STRING | No* |

\*Al menos uno. Varios rellenos = **OR**.

`game_id` y `discord_id` aceptan **varios valores separados por espacios** (`123 456 789`); cada uno cuenta como otro **OR**. Los repetidos se ignoran. `game_id` compara sin distinguir mayúsculas; `discord_id`, exacto. `discord_tag` y `player_name` siguen siendo un solo texto (puede llevar espacios).

Un V2 **por jugador distinto**. El título `##` es el nombre y debajo, en `-#`, en cuántas hojas aparece. El capitán va en cuatro líneas: equipo (si no es 1vs1), Discord (tag y mención o ID), in-game (nombre e ID) y título con `hero` / `legend`. Debajo, `### Sheets` con una línea por hoja (nombre · formato · origen · servidor · enlace). Los campos extra de la hoja **no** entran aquí. Varios jugadores → varios V2, cada uno con copy de *ese* jugador.

**Todos** los jugadores encontrados salen, sin tope fijo de tarjetas. Las tarjetas se empaquetan en mensajes efímeros respetando los límites de Discord por mensaje (**40** componentes y **4000** caracteres; hasta 7 tarjetas por mensaje): la primera es la respuesta y el resto van como follow-ups, en orden. Si un jugador sale en tantas hojas que su tarjeta no cabe, la lista de `### Sheets` se corta con *…and N more sheets*. Para que una búsqueda vaga no inunde el chat, como mucho **10** mensajes; si aun así faltan jugadores, el último mensaje añade un bloque *N More Players in the CSV* con `sheet-players.csv`: **todas** las coincidencias, una fila por jugador y hoja (`Player,Team,Discord tag,Discord ID,In-game name,In-game ID,Tournament,Format,Origin,Server,Sheet`, con los datos del capitán como en la tarjeta).

## `/sheet validate`

| Campo | Tipo | Obligatorio |
|---|---|---|
| sheet_link | STRING | Sí |

Admin u Organiser. Previo a crear torneo. Efímero. No archiva la hoja y no audita. Relación: `/utility discord tag` para corregir tags, `/tournament add` para registrar después.

Recorre cada jugador de la hoja viva y aplica las comprobaciones de [../domains/sheet.md](../domains/sheet.md). Si algo falla, un V2 de resumen y un V2 por tipo de fallo. El resumen es *Sheet Needs Fixes*, con formato, equipos, jugadores y **Failed checks** en una línea, y el footer con la mención de `/sheet validate`. Cada tipo de fallo lleva el conteo en el título `###` y la explicación en `-#`. Si pasa, es *Sheet Passed* y el footer indica que se puede registrar con `/tournament add`.

## `/utility discord tag`

| Campo | Tipo | Obligatorio |
|---|---|---|
| ids | STRING | Sí |

Admin u Organiser. Salida efímera, un username por línea.

## `/team info`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |
| user | USER | No* |
| alias | STRING | No* |

\*Al menos uno. Si van los dos, la fila tiene que coincidir en **ambos**. Cualquier miembro. Lectura de la hoja **viva** de Google de ese torneo (no la copia en BD). No audita.

Busca en **cualquier jugador** de la fila. `user` coincide por Discord ID. `alias` coincide por **game ID**, **in-game name** o **Discord ID** (el bot clasifica el texto: snowflake → Discord ID, hex 8–16 → game ID, si no → nombre; nombre exacto primero, si no contiene con ≥ 3 caracteres).

Un V2 por equipo coincidente. El **título es el nombre del equipo** (sin thumbnail del container). Bajo el título `##` van el torneo y *matched by* en una línea, y `-# Team N of M` si hay varios. Cada jugador va en su propio **Section** con el avatar de Discord como thumbnail. El título del section es `### Captain` / `Player N` con la **Verification** al lado. Debajo, tres líneas: Discord (tag y mención, o el ID si no es válido), juego (nombre e ID) y Title (emoji `hero` / `legend` si el título contiene *hero* o *legend*). Verification: **success + In server** si está en el servidor **y** tiene el `verified_role` de `/settings`; **banned + Banned** si está baneado del servidor; si está pero sin el rol, *Not verified*; si no está, *Not in server*. En `2vs2`…`5vs5` el nombre de equipo es el título. Los campos extra van **al final**, con el nombre de cada header. Footer: `-# Requested by` con `formatUser` y la hora. Varios equipos → varios V2 (máximo 5 + aviso). Sin coincidencias: V2 de vacío. En Discord **no** menciona la hoja ni `/sheet find player`.

## `/team list`

| Campo | Tipo | Obligatorio |
|---|---|---|
| tournament | STRING (Autocomplete) | Sí |

**Organiser**. Lectura de la hoja **viva**. Publica **en el canal** (no efímero) un V2 por cada equipo o participante, el mismo panel que `/team info` (sin *Matched by*), de forma sucesiva hasta completar todos. No audita. En Discord **no** menciona la hoja.
